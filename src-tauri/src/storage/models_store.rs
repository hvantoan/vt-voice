use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

use super::config::get_app_dir;

const MODELS_FILE_NAME: &str = "models.json";
const CURRENT_CATALOG_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ModelEntry {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub base_url: String,
    #[serde(default)]
    pub is_builtin: bool,
    #[serde(default)]
    pub models: Vec<ModelEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ModelsCatalog {
    pub version: u32,
    pub providers: Vec<ProviderConfig>,
}

impl Default for ModelsCatalog {
    fn default() -> Self {
        Self {
            version: CURRENT_CATALOG_VERSION,
            providers: create_default_providers(None, None),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CatalogError {
    #[error("Không thể xác định thư mục cấu hình")]
    NoConfigDir,
    #[error("Lỗi I/O: {0}")]
    Io(#[from] std::io::Error),
    #[error("Lỗi parse/serialize JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Không tìm thấy provider với id '{0}'")]
    ProviderNotFound(String),
}

/// Tạo danh sách các nhà cung cấp mặc định, có kế thừa các endpoint tùy chỉnh nếu có
pub fn create_default_providers(
    custom_endpoint: Option<&str>,
    translate_endpoint: Option<&str>,
) -> Vec<ProviderConfig> {
    let custom_url = custom_endpoint
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("http://localhost:8000/v1")
        .to_string();

    let mut providers = vec![
        ProviderConfig {
            id: "groq".to_string(),
            name: "Groq Cloud".to_string(),
            base_url: "https://api.groq.com/openai/v1".to_string(),
            is_builtin: true,
            models: vec![
                ModelEntry {
                    id: "whisper-large-v3-turbo".to_string(),
                    name: "Whisper Large V3 Turbo".to_string(),
                    capabilities: vec!["stt".to_string()],
                },
                ModelEntry {
                    id: "llama-3.3-70b-versatile".to_string(),
                    name: "Llama 3.3 70B Versatile".to_string(),
                    capabilities: vec!["chat".to_string()],
                },
            ],
        },
        ProviderConfig {
            id: "openrouter".to_string(),
            name: "OpenRouter".to_string(),
            base_url: "https://openrouter.ai/api/v1".to_string(),
            is_builtin: true,
            models: vec![
                ModelEntry {
                    id: "openai/whisper-1".to_string(),
                    name: "Whisper-1".to_string(),
                    capabilities: vec!["stt".to_string()],
                },
            ],
        },
        ProviderConfig {
            id: "custom".to_string(),
            name: "Self-hosted / Custom".to_string(),
            base_url: custom_url,
            is_builtin: false,
            models: vec![
                ModelEntry {
                    id: "whisper-1".to_string(),
                    name: "Whisper-1".to_string(),
                    capabilities: vec!["stt".to_string()],
                },
            ],
        },
    ];

    // Kế thừa provider translate riêng biệt nếu người dùng từng cài đặt
    if let Some(endpoint) = translate_endpoint.filter(|s| !s.trim().is_empty()) {
        providers.push(ProviderConfig {
            id: "translate".to_string(),
            name: "Custom Translate Endpoint".to_string(),
            base_url: endpoint.to_string(),
            is_builtin: false,
            models: vec![
                ModelEntry {
                    id: "llama-3.3-70b-versatile".to_string(),
                    name: "Llama 3.3 70B Versatile".to_string(),
                    capabilities: vec!["chat".to_string()],
                },
            ],
        });
    }

    providers
}

pub fn get_models_catalog_path() -> Result<PathBuf, CatalogError> {
    let mut path = get_app_dir().map_err(|_| CatalogError::NoConfigDir)?;
    path.push(MODELS_FILE_NAME);
    Ok(path)
}

/// Tải danh mục models từ đĩa, tự động seed nếu chưa tồn tại
pub fn load_models_catalog() -> ModelsCatalog {
    let Ok(path) = get_models_catalog_path() else {
        return ModelsCatalog::default();
    };

    if !path.exists() {
        // Tự động kiểm tra cấu hình cũ từ settings.json để kế thừa endpoint
        let (custom_ep, trans_ep) = read_existing_endpoints_from_settings();
        let catalog = ModelsCatalog {
            version: CURRENT_CATALOG_VERSION,
            providers: create_default_providers(custom_ep.as_deref(), trans_ep.as_deref()),
        };
        let _ = save_models_catalog(&catalog);
        return catalog;
    }

    let mut file = match File::open(&path) {
        Ok(f) => f,
        Err(_) => return ModelsCatalog::default(),
    };

    let mut contents = String::new();
    if file.read_to_string(&mut contents).is_err() {
        return ModelsCatalog::default();
    }

    serde_json::from_str(&contents).unwrap_or_default()
}

/// Đọc nhanh các endpoint từ settings.json hiện tại (nếu có) để seed dữ liệu chính xác
fn read_existing_endpoints_from_settings() -> (Option<String>, Option<String>) {
    let Ok(mut path) = get_app_dir() else {
        return (None, None);
    };
    path.push("settings.json");
    if !path.exists() {
        return (None, None);
    }
    let Ok(contents) = fs::read_to_string(&path) else {
        return (None, None);
    };
    let Ok(val) = serde_json::from_str::<serde_json::Value>(&contents) else {
        return (None, None);
    };

    let custom_ep = val.get("custom_endpoint").and_then(|v| v.as_str()).map(|s| s.to_string());
    let trans_ep = val.get("translate_endpoint").and_then(|v| v.as_str()).map(|s| s.to_string());
    (custom_ep, trans_ep)
}

/// Lưu danh mục models xuống đĩa (atomic write)
pub fn save_models_catalog(catalog: &ModelsCatalog) -> Result<(), CatalogError> {
    let path = get_models_catalog_path()?;
    let tmp_path = path.with_extension("json.tmp");
    let json_bytes = serde_json::to_vec_pretty(catalog)?;

    {
        let mut file = File::create(&tmp_path)?;
        file.write_all(&json_bytes)?;
        file.flush()?;
    }

    fs::rename(&tmp_path, &path)?;
    Ok(())
}

/// Tìm thông tin provider theo ID
pub fn get_provider(id: &str) -> Option<ProviderConfig> {
    let catalog = load_models_catalog();
    catalog.providers.into_iter().find(|p| p.id.eq_ignore_ascii_case(id))
}

/// Thêm hoặc cập nhật provider
pub fn upsert_provider(mut provider: ProviderConfig) -> Result<(), CatalogError> {
    provider.base_url = crate::ai::provider::normalize_base_url(&provider.base_url);
    let mut catalog = load_models_catalog();
    if let Some(existing) = catalog.providers.iter_mut().find(|p| p.id.eq_ignore_ascii_case(&provider.id)) {
        existing.name = provider.name;
        existing.base_url = provider.base_url;
        // Giữ lại models cũ nếu provider mới không truyền models hoặc hợp nhất
        if !provider.models.is_empty() {
            for m in provider.models {
                if !existing.models.iter().any(|em| em.id == m.id) {
                    existing.models.push(m);
                }
            }
        }
    } else {
        catalog.providers.push(provider);
    }
    save_models_catalog(&catalog)
}

/// Xóa provider theo ID
pub fn delete_provider(id: &str) -> Result<bool, CatalogError> {
    let mut catalog = load_models_catalog();
    let initial_len = catalog.providers.len();
    catalog.providers.retain(|p| !p.id.eq_ignore_ascii_case(id));
    if catalog.providers.len() < initial_len {
        save_models_catalog(&catalog)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Thêm danh sách model vào allowlist của một provider (loại bỏ trùng lặp theo id)
pub fn add_models_to_allowlist(provider_id: &str, new_models: Vec<ModelEntry>) -> Result<(), CatalogError> {
    let mut catalog = load_models_catalog();
    let provider = catalog
        .providers
        .iter_mut()
        .find(|p| p.id.eq_ignore_ascii_case(provider_id))
        .ok_or_else(|| CatalogError::ProviderNotFound(provider_id.to_string()))?;

    for model in new_models {
        if let Some(existing) = provider.models.iter_mut().find(|m| m.id == model.id) {
            existing.name = model.name;
            existing.capabilities = model.capabilities;
        } else {
            provider.models.push(model);
        }
    }

    save_models_catalog(&catalog)
}

/// Gỡ bỏ một model khỏi allowlist của một provider
pub fn remove_model_from_allowlist(provider_id: &str, model_id: &str) -> Result<(), CatalogError> {
    let mut catalog = load_models_catalog();
    let provider = catalog
        .providers
        .iter_mut()
        .find(|p| p.id.eq_ignore_ascii_case(provider_id))
        .ok_or_else(|| CatalogError::ProviderNotFound(provider_id.to_string()))?;

    provider.models.retain(|m| m.id != model_id);
    save_models_catalog(&catalog)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_catalog_initialization() {
        let catalog = ModelsCatalog::default();
        assert_eq!(catalog.version, 1);
        assert!(catalog.providers.len() >= 3);
        assert!(catalog.providers.iter().any(|p| p.id == "groq" && p.is_builtin));
        assert!(catalog.providers.iter().any(|p| p.id == "openrouter" && p.is_builtin));
        assert!(catalog.providers.iter().any(|p| p.id == "custom"));
    }

    #[test]
    fn test_add_models_deduplication() {
        let mut provider = ProviderConfig {
            id: "test_provider".to_string(),
            name: "Test".to_string(),
            base_url: "http://localhost:8000".to_string(),
            is_builtin: false,
            models: vec![
                ModelEntry {
                    id: "model-1".to_string(),
                    name: "Model One".to_string(),
                    capabilities: vec!["stt".to_string()],
                }
            ],
        };

        let new_model = ModelEntry {
            id: "model-1".to_string(),
            name: "Model One Updated".to_string(),
            capabilities: vec!["stt".to_string(), "chat".to_string()],
        };

        // Update existing model
        if let Some(existing) = provider.models.iter_mut().find(|m| m.id == new_model.id) {
            existing.name = new_model.name.clone();
            existing.capabilities = new_model.capabilities.clone();
        }

        assert_eq!(provider.models.len(), 1);
        assert_eq!(provider.models[0].name, "Model One Updated");
        assert_eq!(provider.models[0].capabilities, vec!["stt", "chat"]);
    }
}