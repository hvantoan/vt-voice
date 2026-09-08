use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Write};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

const APP_DIR_NAME: &str = "com.itvan.vt-voice";
const HISTORY_FILE_NAME: &str = "history.json";
pub const MAX_HISTORY_ITEMS: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub timestamp: String,
    pub raw_text: String,
    pub polished_text: String,
    pub stt_duration_ms: u64,
    pub llm_duration_ms: u64,
    pub total_duration_ms: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum HistoryError {
    #[error("Could not determine config directory")]
    NoConfigDir,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

fn get_history_path() -> Result<PathBuf, HistoryError> {
    let mut path = dirs::config_dir().ok_or(HistoryError::NoConfigDir)?;
    path.push(APP_DIR_NAME);
    if !path.exists() {
        fs::create_dir_all(&path)?;
    }
    path.push(HISTORY_FILE_NAME);
    Ok(path)
}

pub fn load_history() -> Vec<HistoryItem> {
    let Ok(path) = get_history_path() else {
        return Vec::new();
    };

    if !path.exists() {
        return Vec::new();
    }

    let Ok(file) = File::open(&path) else {
        return Vec::new();
    };

    let reader = BufReader::new(file);
    serde_json::from_reader(reader).unwrap_or_default()
}

pub fn save_history(items: &[HistoryItem]) -> Result<(), HistoryError> {
    let path = get_history_path()?;
    let tmp_path = path.with_extension("json.tmp");
    {
        let file = File::create(&tmp_path)?;
        let mut writer = BufWriter::new(file);
        serde_json::to_writer_pretty(&mut writer, items)?;
        writer.flush()?;
    }
    fs::rename(&tmp_path, &path)?;
    Ok(())
}

pub fn push_history_item(items: &mut Vec<HistoryItem>, item: HistoryItem) {
    items.insert(0, item);
    if items.len() > MAX_HISTORY_ITEMS {
        items.truncate(MAX_HISTORY_ITEMS);
    }
}

pub fn append_history_item(item: HistoryItem) -> Result<Vec<HistoryItem>, HistoryError> {
    let mut items = load_history();
    push_history_item(&mut items, item);
    save_history(&items)?;
    Ok(items)
}

pub fn clear_history() -> Result<(), HistoryError> {
    let empty: [HistoryItem; 0] = [];
    save_history(&empty)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_history_item_camel_case_serialization() {
        let item = HistoryItem {
            id: "hist_123".to_string(),
            timestamp: "2026-09-08 15:30:00".to_string(),
            raw_text: "hello world raw".to_string(),
            polished_text: "Hello, world!".to_string(),
            stt_duration_ms: 150,
            llm_duration_ms: 300,
            total_duration_ms: 450,
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains(r#""id":"hist_123""#));
        assert!(json.contains(r#""timestamp":"2026-09-08 15:30:00""#));
        assert!(json.contains(r#""rawText":"hello world raw""#));
        assert!(json.contains(r#""polishedText":"Hello, world!""#));
        assert!(json.contains(r#""sttDurationMs":150"#));
        assert!(json.contains(r#""llmDurationMs":300"#));
        assert!(json.contains(r#""totalDurationMs":450"#));

        let deserialized: HistoryItem = serde_json::from_str(&json).unwrap();
        assert_eq!(item, deserialized);
    }

    #[test]
    fn test_push_history_item_truncation_and_order() {
        let mut items = Vec::new();
        for i in 0..60 {
            let item = HistoryItem {
                id: format!("hist_{}", i),
                timestamp: "2026-09-08 12:00:00".to_string(),
                raw_text: format!("raw {}", i),
                polished_text: format!("polished {}", i),
                stt_duration_ms: 100,
                llm_duration_ms: 200,
                total_duration_ms: 300,
            };
            push_history_item(&mut items, item);
        }

        assert_eq!(items.len(), MAX_HISTORY_ITEMS);
        assert_eq!(items[0].id, "hist_59");
        assert_eq!(items[49].id, "hist_10");
    }
}
