use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

use crate::hotkey::types::{HotkeyMode, KeyBinding};

const APP_DIR_NAME: &str = "com.itvan.vt-voice";
const CONFIG_FILE_NAME: &str = "settings.json";

fn default_active_provider() -> String {
    "groq".to_string()
}

fn default_stt_model() -> String {
    "whisper-large-v3-turbo".to_string()
}

fn default_polish_model() -> String {
    "llama-3.3-70b-versatile".to_string()
}

fn default_enable_polish() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub hotkey_mode: HotkeyMode,
    pub hotkey_binding: KeyBinding,
    pub audio_device_name: Option<String>,
    pub autostart: bool,
    pub start_minimized: bool,
    #[serde(alias = "ai_provider", default = "default_active_provider")]
    pub active_provider: String,
    #[serde(default = "default_stt_model")]
    pub stt_model: String,
    #[serde(default = "default_polish_model")]
    pub polish_model: String,
    #[serde(default = "default_enable_polish")]
    pub enable_polish: bool,
    #[serde(default)]
    pub custom_endpoint: Option<String>,
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
            active_provider: "groq".to_string(),
            stt_model: "whisper-large-v3-turbo".to_string(),
            polish_model: "llama-3.3-70b-versatile".to_string(),
            enable_polish: true,
            custom_endpoint: None,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_config_defaults() {
        let cfg = AppConfig::default();
        assert_eq!(cfg.active_provider, "groq");
        assert_eq!(cfg.stt_model, "whisper-large-v3-turbo");
        assert!(cfg.enable_polish);
        assert!(cfg.custom_endpoint.is_none());
    }

    #[test]
    fn test_app_config_deserialize_with_legacy_ai_provider() {
        let json = r#"{
            "hotkey_mode": "push_to_talk",
            "hotkey_binding": {"code": 165, "name": "Right Alt", "ctrl": false, "alt": false, "shift": false, "win": false},
            "audio_device_name": null,
            "autostart": false,
            "start_minimized": true,
            "ai_provider": "openrouter",
            "stt_model": "openai/whisper-1",
            "polish_model": "llama-3.3-70b-versatile",
            "system_prompt": "test prompt",
            "custom_vocabulary": ["API"],
            "vad_timeout_ms": 700
        }"#;
        let cfg: AppConfig = serde_json::from_str(json).expect("deserialize failed");
        assert_eq!(cfg.active_provider, "openrouter");
        assert_eq!(cfg.stt_model, "openai/whisper-1");
        assert!(cfg.enable_polish); // defaults to true
        assert!(cfg.custom_endpoint.is_none());
    }

    #[test]
    fn test_app_config_pure_stt_and_custom_endpoint() {
        let mut cfg = AppConfig::default();
        cfg.active_provider = "custom".to_string();
        cfg.enable_polish = false;
        cfg.custom_endpoint = Some("http://localhost:8000/v1/audio/transcriptions".to_string());

        let serialized = serde_json::to_string(&cfg).expect("serialize failed");
        assert!(serialized.contains(r#""enable_polish":false"#));
        assert!(serialized.contains("http://localhost:8000/v1/audio/transcriptions"));
        // Ensure zero API keys in serialized configuration
        assert!(!serialized.contains("api_key"));
        assert!(!serialized.contains("groq_key"));
    }
}
