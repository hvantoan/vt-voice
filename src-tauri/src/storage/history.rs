use std::fs::{self, File};
use std::io::{BufReader, BufWriter};
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
    let file = File::create(&path)?;
    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, items)?;
    Ok(())
}

pub fn append_history_item(item: HistoryItem) -> Result<Vec<HistoryItem>, HistoryError> {
    let mut items = load_history();
    items.insert(0, item);
    if items.len() > MAX_HISTORY_ITEMS {
        items.truncate(MAX_HISTORY_ITEMS);
    }
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
    fn test_max_history_items_truncation() {
        let mut items: Vec<HistoryItem> = (0..60)
            .map(|i| HistoryItem {
                id: format!("hist_{}", i),
                timestamp: "2026-09-08 12:00:00".to_string(),
                raw_text: format!("raw {}", i),
                polished_text: format!("polished {}", i),
                stt_duration_ms: 100,
                llm_duration_ms: 200,
                total_duration_ms: 300,
            })
            .collect();

        assert_eq!(items.len(), 60);
        if items.len() > MAX_HISTORY_ITEMS {
            items.truncate(MAX_HISTORY_ITEMS);
        }
        assert_eq!(items.len(), MAX_HISTORY_ITEMS);
        assert_eq!(items[0].id, "hist_0");
        assert_eq!(items[49].id, "hist_49");
    }

    #[test]
    fn test_history_prepending_order() {
        let mut items = Vec::new();
        let item1 = HistoryItem {
            id: "hist_1".to_string(),
            timestamp: "2026-09-08 12:00:00".to_string(),
            raw_text: "first".to_string(),
            polished_text: "First".to_string(),
            stt_duration_ms: 100,
            llm_duration_ms: 150,
            total_duration_ms: 250,
        };
        let item2 = HistoryItem {
            id: "hist_2".to_string(),
            timestamp: "2026-09-08 12:01:00".to_string(),
            raw_text: "second".to_string(),
            polished_text: "Second".to_string(),
            stt_duration_ms: 120,
            llm_duration_ms: 180,
            total_duration_ms: 300,
        };

        items.insert(0, item1);
        items.insert(0, item2);

        // Newest item should be at index 0
        assert_eq!(items[0].id, "hist_2");
        assert_eq!(items[1].id, "hist_1");
    }
}
