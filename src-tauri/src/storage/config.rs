use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

use crate::hotkey::types::{HotkeyMode, KeyBinding};

const APP_DIR_NAME: &str = "com.itvan.vt-voice";
const CONFIG_FILE_NAME: &str = "settings.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub hotkey_mode: HotkeyMode,
    pub hotkey_binding: KeyBinding,
    pub audio_device_name: Option<String>,
    pub autostart: bool,
    pub start_minimized: bool,
    pub ai_provider: String,
    pub stt_model: String,
    pub polish_model: String,
    pub system_prompt: String,
    pub custom_vocabulary: Vec<String>,
    pub vad_timeout_ms: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hotkey_mode: HotkeyMode::PushToTalk,
            hotkey_binding: KeyBinding::default(), // Right Alt
            audio_device_name: None,
            autostart: false,
            start_minimized: true,
            ai_provider: "groq".to_string(),
            stt_model: "whisper-large-v3-turbo".to_string(),
            polish_model: "llama-3.3-70b-versatile".to_string(),
            system_prompt: crate::ai::DEFAULT_POLISH_SYSTEM_PROMPT.to_string(),
            custom_vocabulary: vec![
                "commit".to_string(),
                "PR".to_string(),
                "pull request".to_string(),
                "merge".to_string(),
                "rebase".to_string(),
                "deploy".to_string(),
                "staging".to_string(),
                "production".to_string(),
                "API".to_string(),
                "K8s".to_string(),
                "Docker".to_string(),
                "refactor".to_string(),
                "bug".to_string(),
            ],
            vad_timeout_ms: 700,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Could not determine config directory")]
    NoConfigDir,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
}

fn get_config_path() -> Result<PathBuf, ConfigError> {
    let mut path = dirs::config_dir().ok_or(ConfigError::NoConfigDir)?;
    path.push(APP_DIR_NAME);
    if !path.exists() {
        fs::create_dir_all(&path)?;
    }
    path.push(CONFIG_FILE_NAME);
    Ok(path)
}

/// Load configuration from disk, falling back to defaults if not found
pub fn load_config() -> AppConfig {
    let Ok(path) = get_config_path() else {
        return AppConfig::default();
    };

    if !path.exists() {
        let default_cfg = AppConfig::default();
        let _ = save_config(&default_cfg);
        return default_cfg;
    }

    let mut file = match File::open(&path) {
        Ok(f) => f,
        Err(_) => return AppConfig::default(),
    };

    let mut contents = String::new();
    if file.read_to_string(&mut contents).is_err() {
        return AppConfig::default();
    }

    serde_json::from_str(&contents).unwrap_or_default()
}

/// Save configuration to disk
pub fn save_config(config: &AppConfig) -> Result<(), ConfigError> {
    let path = get_config_path()?;
    let json_bytes = serde_json::to_vec_pretty(config)?;
    let mut file = File::create(&path)?;
    file.write_all(&json_bytes)?;
    Ok(())
}
