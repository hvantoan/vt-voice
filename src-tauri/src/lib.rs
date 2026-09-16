pub mod ai;
pub mod audio;
pub mod daemon;
pub mod hotkey;
pub mod injection;
pub mod storage;

use std::sync::Arc;
use crossbeam_channel::unbounded;
use parking_lot::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

use ai::{AiHttpClient, AiPipelineResult, SttModelInfo};
use audio::{AudioDevice, AudioRecorder};
use daemon::{OverlayController, TranslateOverlayController, TrayManager};
use hotkey::{
    set_translate_last_result, set_translate_visible, translate_last_result, translate_visible,
    HotkeyEvent, HotkeyManager,
};
use injection::{capture_selected_text, ClipboardManager, SelectionResult};
use storage::{load_config, save_config, AppConfig, HistoryItem, push_history_item};

pub struct AppState {
    pub audio_recorder: Arc<Mutex<AudioRecorder>>,
    pub hotkey_manager: Arc<Mutex<HotkeyManager>>,
    pub clipboard_manager: Arc<ClipboardManager>,
    pub overlay_controller: Arc<OverlayController>,
    pub translate_overlay: Arc<TranslateOverlayController>,
    pub http_client: Arc<AiHttpClient>,
    pub config: Arc<Mutex<AppConfig>>,
    pub history: Arc<Mutex<Vec<HistoryItem>>>,
}

#[tauri::command]
fn get_transcription_history(state: State<'_, AppState>) -> Result<Vec<HistoryItem>, String> {
    Ok(state.history.lock().clone())
}

#[tauri::command]
fn clear_transcription_history(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let mut h = state.history.lock();
    storage::clear_history().map_err(|e| {
        eprintln!("[vt-voice] Failed to clear transcription history: {}", e);
        e.to_string()
    })?;
    h.clear();
    let _ = app.emit("history-cleared", ());
    Ok(())
}
#[tauri::command]
fn export_transcription_history_json(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let items = state.history.lock().clone();
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("vt-voice-history.json");
    let json = serde_json::to_string_pretty(&items).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    let _ = tauri_plugin_opener::reveal_item_in_dir(&path);
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    audio::list_input_devices().map_err(|e| e.to_string())
}

#[tauri::command]
fn start_test_mic(app: AppHandle, state: State<'_, AppState>, device_name: Option<String>) -> Result<(), String> {
    let mut recorder = state.audio_recorder.lock();
    recorder
        .start(Some(app), device_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_test_mic(state: State<'_, AppState>) -> Result<(), String> {
    let mut recorder = state.audio_recorder.lock();
    let _ = recorder.stop();
    Ok(())
}

#[tauri::command]
fn get_app_config(state: State<'_, AppState>) -> AppConfig {
    state.config.lock().clone()
}

#[tauri::command]
fn save_app_config(
    app: AppHandle,
    state: State<'_, AppState>,
    mut config: AppConfig,
) -> Result<(), String> {
    let locale_changed = {
        let current = state.config.lock();
        if config.feature_profiles.is_empty() {
            config.feature_profiles = current.feature_profiles.clone();
        }
        current.locale != config.locale
    };
    config.ensure_feature_profiles_migrated();
    save_config(&config).map_err(|e| e.to_string())?;
    state
        .hotkey_manager
        .lock()
        .update_config(config.hotkey_binding.clone(), config.hotkey_mode, Some(config.translate_binding.clone()));
    if locale_changed {
        let effective_locale = daemon::tray::TrayStrings::resolve_locale(&config.locale);
        let _ = TrayManager::update_tray_locale(&app, &effective_locale);
        let _ = app.emit("locale-changed", &config.locale);
    }
    *state.config.lock() = config;
    Ok(())
}

#[tauri::command]
fn update_tray_locale_cmd(app: AppHandle, locale: String) -> Result<(), String> {
    TrayManager::update_tray_locale(&app, &locale).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_api_key_cmd(provider: Option<String>) -> Result<Option<String>, String> {
    let prov = provider.as_deref().unwrap_or("groq");
    storage::get_provider_key(prov).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_api_key_cmd(key: String) -> Result<(), String> {
    storage::set_api_key(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_provider_api_key(
    provider: String,
    key: Option<String>,
    api_key: Option<String>,
) -> Result<(), String> {
    let key_to_save = key
        .or(api_key)
        .ok_or_else(|| "Missing required parameter `key` or `apiKey`".to_string())?;

    let trimmed = key_to_save.trim();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".to_string());
    }
    if trimmed.contains('•') || trimmed.contains('*') {
        return Err("Cannot save a masked API key".to_string());
    }
    storage::set_provider_key(&provider, trimmed).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_masked_provider_api_key(provider: String) -> Result<Option<String>, String> {
    let key = storage::get_provider_key(&provider).map_err(|e| e.to_string())?;
    Ok(key.map(|k| storage::mask_key(&k)))
}

#[tauri::command]
fn has_provider_api_key(provider: String) -> Result<bool, String> {
    Ok(storage::has_provider_key(&provider))
}

#[tauri::command]
fn delete_provider_api_key(provider: String) -> Result<(), String> {
    storage::delete_provider_key(&provider).map_err(|e| e.to_string())
}

#[tauri::command]
fn hide_translate_overlay(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.translate_overlay.hide(&app);
    set_translate_visible(false);
    Ok(())
}

#[tauri::command]
fn copy_translation(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(text) = translate_last_result() {
        state
            .clipboard_manager
            .set_text_transient(&text)
            .map_err(|e| e.to_string())?;
    }
    state.translate_overlay.hide(&app);
    set_translate_visible(false);
    Ok(())
}

#[tauri::command]
async fn test_ai_connection(
    state: State<'_, AppState>,
    api_key: String,
) -> Result<u64, String> {
    ai::test_connection(&state.http_client, &api_key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn test_provider_connection(
    state: State<'_, AppState>,
    provider: String,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<u64, String> {
    let key = match api_key {
        Some(k) if !k.trim().is_empty() && !k.contains('•') && !k.contains('*') => k,
        _ => storage::get_provider_key(&provider)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Chưa cấu hình API key cho provider này".to_string())?,
    };

    ai::test_provider_connection(&provider, &state.http_client, &key, endpoint.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_available_stt_models(
    state: State<'_, AppState>,
    provider: String,
    force_refresh: bool,
) -> Result<Vec<SttModelInfo>, String> {
    let key = storage::get_provider_key(&provider).unwrap_or(None);
    let models = ai::get_available_stt_models(
        &provider,
        &state.http_client,
        key.as_deref(),
        force_refresh,
    )
    .await;
    Ok(models)
}

#[tauri::command]
fn get_providers() -> Result<Vec<storage::ProviderConfig>, String> {
    Ok(storage::load_models_catalog().providers)
}

#[tauri::command]
fn save_provider(provider: storage::ProviderConfig) -> Result<(), String> {
    storage::upsert_provider(provider).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_provider_cmd(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let cfg = state.config.lock();
    for (feature, profile) in &cfg.feature_profiles {
        if profile.provider_id.eq_ignore_ascii_case(&id) {
            return Err(format!(
                "Không thể xóa nhà cung cấp vì đang được sử dụng bởi tính năng '{}'. Vui lòng chuyển tính năng sang nhà cung cấp khác trước khi xóa.",
                feature
            ));
        }
    }
    drop(cfg);

    storage::delete_provider(&id).map_err(|e| e.to_string())?;
    let _ = storage::delete_provider_key(&id);
    Ok(())
}

#[tauri::command]
async fn fetch_provider_models(
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<Vec<ai::DiscoveredModel>, String> {
    let provider = storage::get_provider(&provider_id)
        .ok_or_else(|| format!("Không tìm thấy nhà cung cấp '{}'", provider_id))?;
    let key = storage::get_provider_key(&provider_id).map_err(|e| e.to_string())?;
    ai::fetch_openai_models(&state.http_client, &provider.base_url, key.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_models_to_provider(
    provider_id: String,
    models: Vec<storage::ModelEntry>,
) -> Result<(), String> {
    storage::add_models_to_allowlist(&provider_id, models).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_model_from_provider(
    provider_id: String,
    model_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let cfg = state.config.lock();
    for (feature, profile) in &cfg.feature_profiles {
        if profile.provider_id.eq_ignore_ascii_case(&provider_id)
            && profile.model_id.as_deref() == Some(&model_id)
        {
            return Err(format!(
                "Không thể xóa model '{}' vì đang được sử dụng bởi tính năng '{}'.",
                model_id, feature
            ));
        }
    }
    drop(cfg);

    storage::remove_model_from_allowlist(&provider_id, &model_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn test_provider_endpoint_cmd(
    state: State<'_, AppState>,
    base_url: String,
    api_key: Option<String>,
    provider_id: Option<String>,
) -> Result<u64, String> {
    let resolved_key = match api_key.filter(|k| !k.trim().is_empty() && !k.contains('•') && !k.contains('*')) {
        Some(k) => Some(k),
        None => {
            if let Some(pid) = &provider_id {
                storage::get_provider_key(pid).ok().flatten()
            } else {
                let clean_base = ai::provider::normalize_base_url(&base_url);
                let catalog = storage::load_models_catalog();
                catalog
                    .providers
                    .iter()
                    .find(|p| ai::provider::normalize_base_url(&p.base_url) == clean_base)
                    .and_then(|p| storage::get_provider_key(&p.id).ok().flatten())
            }
        }
    };

    ai::test_endpoint_latency(&state.http_client, &base_url, resolved_key.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_feature_profiles(
    state: State<'_, AppState>,
) -> Result<std::collections::HashMap<String, storage::FeatureProfile>, String> {
    Ok(state.config.lock().feature_profiles.clone())
}

#[tauri::command]
fn set_feature_profile(
    state: State<'_, AppState>,
    feature: String,
    profile: storage::FeatureProfile,
) -> Result<(), String> {
    if profile.provider_id == "google_free" {
        if feature != "translate" {
            return Err("Google Translate miễn phí chỉ hỗ trợ cho tính năng Dịch thuật.".to_string());
        }
    } else {
        let catalog = storage::load_models_catalog();
        let provider = catalog
            .providers
            .iter()
            .find(|p| p.id.eq_ignore_ascii_case(&profile.provider_id))
            .ok_or_else(|| format!("Nhà cung cấp '{}' không tồn tại.", profile.provider_id))?;

        let model_id = profile
            .model_id
            .as_ref()
            .ok_or_else(|| "Model ID không được để trống cho nhà cung cấp này.".to_string())?;

        if !provider.models.iter().any(|m| m.id == *model_id) {
            return Err(format!(
                "Model '{}' chưa có trong danh sách cho phép (allowlist) của '{}'. Vui lòng thêm model vào allowlist trước khi chọn.",
                model_id, provider.name
            ));
        }
    }

    let mut cfg = state.config.lock();
    cfg.feature_profiles.insert(feature.clone(), profile.clone());
    if feature == "stt" {
        cfg.active_provider = profile.provider_id.clone();
        if let Some(ref mid) = profile.model_id {
            cfg.stt_model = mid.clone();
        }
    } else if feature == "polish" {
        if let Some(ref mid) = profile.model_id {
            cfg.polish_model = mid.clone();
        }
    } else if feature == "translate" {
        if profile.provider_id != "google_free" {
            if let Some(prov) = storage::get_provider(&profile.provider_id) {
                cfg.translate_endpoint = Some(prov.base_url);
            }
            cfg.translate_model = profile.model_id.clone();
        } else {
            cfg.translate_endpoint = None;
            cfg.translate_model = None;
        }
    }
    storage::save_config(&cfg).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn transcribe_and_polish(
    app: AppHandle,
    state: State<'_, AppState>,
    wav_bytes: Vec<u8>,
) -> Result<AiPipelineResult, String> {
    let (stt_profile, polish_profile, enable_polish, vocab, sys_prompt) = {
        let cfg = state.config.lock();
        let stt = cfg.feature_profiles.get("stt").cloned().unwrap_or_else(|| storage::FeatureProfile {
            provider_id: cfg.active_provider.clone(),
            model_id: Some(cfg.stt_model.clone()),
        });
        let polish = cfg.feature_profiles.get("polish").cloned().unwrap_or_else(|| storage::FeatureProfile {
            provider_id: cfg.active_provider.clone(),
            model_id: Some(cfg.polish_model.clone()),
        });
        (
            stt,
            polish,
            cfg.enable_polish,
            cfg.custom_vocabulary.clone(),
            cfg.system_prompt.clone(),
        )
    };

    let stt_provider = storage::get_provider(&stt_profile.provider_id)
        .ok_or_else(|| format!("Nhà cung cấp STT '{}' không tồn tại", stt_profile.provider_id))?;

    let stt_key = storage::get_provider_key(&stt_profile.provider_id)
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    if stt_key.trim().is_empty() {
        return Err(format!("Chưa cài đặt API key cho {}", stt_provider.name));
    }

    let stt_model = stt_profile
        .model_id
        .as_deref()
        .unwrap_or("whisper-large-v3-turbo");

    let total_start = std::time::Instant::now();
    let stt_start = std::time::Instant::now();

    let raw_text = ai::transcribe_with_endpoint(
        &state.http_client,
        &stt_provider.base_url,
        &stt_key,
        stt_model,
        wav_bytes,
        &vocab,
    )
    .await
    .map_err(|e| e.to_string())?;

    if raw_text.trim().is_empty() {
        return Ok(AiPipelineResult {
            raw_text: String::new(),
            polished_text: String::new(),
            duration_ms: total_start.elapsed().as_millis() as u64,
        });
    }
    let stt_duration_ms = stt_start.elapsed().as_millis() as u64;

    let (polished_text, llm_duration_ms) = if !enable_polish {
        (raw_text.clone(), 0)
    } else {
        let llm_start = std::time::Instant::now();
        let polish_key = storage::get_provider_key(&polish_profile.provider_id)
            .map_err(|e| e.to_string())?
            .unwrap_or_default();

        let polished = if !polish_key.trim().is_empty() {
            let base_url = storage::get_provider(&polish_profile.provider_id)
                .map(|p| p.base_url)
                .unwrap_or_else(|| match polish_profile.provider_id.to_lowercase().as_str() {
                    "openrouter" => "https://openrouter.ai/api/v1".to_string(),
                    _ => "https://api.groq.com/openai/v1".to_string(),
                });
            let model = polish_profile.model_id.as_deref().unwrap_or("llama-3.3-70b-versatile");
            match ai::polish_with_endpoint(
                &state.http_client,
                &base_url,
                &polish_key,
                model,
                &raw_text,
                Some(&sys_prompt),
            )
            .await
            {
                Ok(p) => p,
                Err(_) => ai::LocalPolisher::polish(&raw_text),
            }
        } else {
            ai::LocalPolisher::polish(&raw_text)
        };
        (polished, llm_start.elapsed().as_millis() as u64)
    };

    let total_duration_ms = total_start.elapsed().as_millis() as u64;

    let history_item = HistoryItem {
        id: format!("hist_{}", chrono::Utc::now().timestamp_micros()),
        timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        raw_text: raw_text.clone(),
        polished_text: polished_text.clone(),
        stt_duration_ms,
        llm_duration_ms,
        total_duration_ms,
    };
    let history_snapshot = {
        let mut h = state.history.lock();
        push_history_item(&mut h, history_item.clone());
        h.clone()
    };
    if let Err(e) = storage::save_history(&history_snapshot) {
        eprintln!("[vt-voice] Failed to persist transcription history: {}", e);
    } else {
        let _ = app.emit("history-updated", &history_item);
    }

    Ok(AiPipelineResult {
        raw_text,
        polished_text,
        duration_ms: total_duration_ms,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = load_config();
    let initial_history = storage::load_history();
    let audio_recorder = Arc::new(Mutex::new(AudioRecorder::new()));
    let hotkey_manager = Arc::new(Mutex::new(HotkeyManager::new()));
    let clipboard_manager = Arc::new(ClipboardManager::new());
    let overlay_controller = Arc::new(OverlayController::new());
    let translate_overlay = Arc::new(TranslateOverlayController::new());
    let http_client = Arc::new(AiHttpClient::new());
    let config = Arc::new(Mutex::new(initial_config.clone()));
    let history = Arc::new(Mutex::new(initial_history));

    let (hotkey_tx, hotkey_rx) = unbounded::<HotkeyEvent>();

    // Start hotkey hook on dedicated OS thread
    {
        let mut hm = hotkey_manager.lock();
        let _ = hm.start(
            initial_config.hotkey_binding,
            initial_config.hotkey_mode,
            Some(initial_config.translate_binding.clone()),
            hotkey_tx,
        );
    }

    let state = AppState {
        audio_recorder: Arc::clone(&audio_recorder),
        hotkey_manager: Arc::clone(&hotkey_manager),
        clipboard_manager: Arc::clone(&clipboard_manager),
        overlay_controller: Arc::clone(&overlay_controller),
        translate_overlay: Arc::clone(&translate_overlay),
        http_client: Arc::clone(&http_client),
        config: Arc::clone(&config),
        history: Arc::clone(&history),
    };
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .manage(state)
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // 1. Build System Tray
            let initial_locale = daemon::tray::TrayStrings::resolve_locale(&config.lock().locale);
            let _ = TrayManager::build(&app_handle);
            let _ = TrayManager::update_tray_locale(&app_handle, &initial_locale);
            // 2. Setup Overlay Window HWND properties
            OverlayController::setup_window(&app_handle);
            TranslateOverlayController::setup_window(&app_handle);

            // Setup Main Settings Window theme & suppress white borders on Win11
            if let Some(main_win) = app_handle.get_webview_window("main") {
                if let Ok(hwnd) = main_win.hwnd() {
                    daemon::win32::setup_main_window_theme(hwnd.0 as _);
                }
            }

            // 3. Spawn background event loop for hotkey triggers
            let app_loop = app_handle.clone();
            let recorder_loop = Arc::clone(&audio_recorder);
            let overlay_loop = Arc::clone(&overlay_controller);
            let translate_overlay_loop = Arc::clone(&translate_overlay);
            let clipboard_loop = Arc::clone(&clipboard_manager);
            let http_loop = Arc::clone(&http_client);
            let config_loop = Arc::clone(&config);
            let history_loop = Arc::clone(&history);

            std::thread::spawn(move || {
                while let Ok(event) = hotkey_rx.recv() {
                    match event {
                        HotkeyEvent::TranslateTrigger => {
                            // The capture + translate is async; run the whole arm on the tauri runtime.
                            // Clone the loop handles so the async block doesn't move out the originals
                            // still used by the Pressed/Released arms.
                            let tl = Arc::clone(&translate_overlay_loop);
                            let ap = app_loop.clone();
                            let cb = Arc::clone(&clipboard_loop);
                            let hp = Arc::clone(&http_loop);
                            let cf = Arc::clone(&config_loop);
                            tauri::async_runtime::spawn(async move {
                                // Toggle: already showing → hide.
                                if translate_visible() {
                                    tl.hide(&ap);
                                    set_translate_visible(false);
                                    return;
                                }

                                // Capture the current selection (guarded Ctrl+C).
                                let selection = match capture_selected_text(Arc::clone(&cb)).await {
                                    Ok(result) => result,
                                    Err(err) => {
                                        tl.emit_payload(
                                            &ap,
                                            &daemon::TranslatePayload {
                                                source_text: String::new(),
                                                source_lang: "auto".into(),
                                                target_lang: "vi".into(),
                                                is_loading: false,
                                                error: Some(format!("Không đọc được vùng chọn: {}", err)),
                                            },
                                        );
                                        tl.show_at_cursor(&ap);
                                        set_translate_visible(true);
                                        // Auto-hide after the error is shown.
                                        tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
                                        tl.hide(&ap);
                                        set_translate_visible(false);
                                        return;
                                    }
                                };

                                let text = match selection {
                                    SelectionResult::Captured { text } => text,
                                    SelectionResult::TargetElevated => {
                                        tl.emit_payload(
                                            &ap,
                                            &daemon::TranslatePayload {
                                                source_text: String::new(),
                                                source_lang: "auto".into(),
                                                target_lang: "vi".into(),
                                                is_loading: false,
                                                error: Some("Không thể sao chép: cửa sổ đang chạy với quyền quản trị viên".into()),
                                            },
                                        );
                                        tl.show_at_cursor(&ap);
                                        set_translate_visible(true);
                                        tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
                                        tl.hide(&ap);
                                        set_translate_visible(false);
                                        return;
                                    }
                                    SelectionResult::EmptySelection => return, // nothing selected → do nothing
                                };

                                // Show "loading…" popover at the cursor, then translate in the background.
                                tl.emit_payload(
                                    &ap,
                                    &daemon::TranslatePayload {
                                        source_text: text.clone(),
                                        source_lang: "auto".into(),
                                        target_lang: "vi".into(),
                                        is_loading: true,
                                        error: None,
                                    },
                                );
                                tl.show_at_cursor(&ap);
                                set_translate_visible(true);

                                // Điều phối theo feature_profiles["translate"]
                                let translate_profile = {
                                    let cfg = cf.lock();
                                    cfg.feature_profiles
                                        .get("translate")
                                        .cloned()
                                        .unwrap_or_else(|| storage::FeatureProfile {
                                            provider_id: "google_free".to_string(),
                                            model_id: None,
                                        })
                                };

                                let translation = if translate_profile.provider_id == "google_free" {
                                    ai::translate::translate_google(&hp, &text).await
                                } else if let Some(provider) = storage::get_provider(&translate_profile.provider_id) {
                                    if let Some(api_key) = storage::get_provider_key(&translate_profile.provider_id).unwrap_or(None) {
                                        let model = translate_profile.model_id.as_deref().unwrap_or("llama-3.3-70b-versatile");
                                        ai::translate::translate_chat(
                                            &hp,
                                            Some(&provider.base_url),
                                            &api_key,
                                            model,
                                            &text,
                                        )
                                        .await
                                    } else {
                                        Err(ai::AiError::MissingApiKey)
                                    }
                                } else {
                                    ai::translate::translate_google(&hp, &text).await
                                };

                                match translation {
                                    Ok(vi) => {
                                        set_translate_last_result(&vi);
                                        tl.emit_result(
                                            &ap,
                                            &daemon::TranslateResult {
                                                translated_text: vi.clone(),
                                                is_loading: false,
                                            },
                                        );
                                        // Clipboard is written only on explicit Copy (button/Enter) —
                                        // auto-copying here would clobber the clipboard selection capture restored.
                                    }
                                    Err(err) => {
                                        tl.emit_payload(
                                            &ap,
                                            &daemon::TranslatePayload {
                                                source_text: text,
                                                source_lang: "auto".into(),
                                                target_lang: "vi".into(),
                                                is_loading: false,
                                                error: Some(err.to_string()),
                                            },
                                        );
                                        // Auto-hide after error.
                                        tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
                                        tl.hide(&ap);
                                        set_translate_visible(false);
                                    }
                                }
                            });
                        }
                        HotkeyEvent::TranslateHide => {
                            translate_overlay_loop.hide(&app_loop);
                            set_translate_visible(false);
                        }
                        HotkeyEvent::TranslateCopy => {
                            if let Some(text) = translate_last_result() {
                                let _ = clipboard_loop.set_text_transient(&text);
                            }
                            translate_overlay_loop.hide(&app_loop);
                            set_translate_visible(false);
                        }
                        HotkeyEvent::Pressed => {
                            // Visual Feedback: Show Overlay + Update Tray
                            overlay_loop.set_listening(&app_loop);
                            TrayManager::set_recording(&app_loop);

                            // Audio Capture: Start streaming
                            let dev_name = config_loop.lock().audio_device_name.clone();
                            let mut rec = recorder_loop.lock();
                            let _ = rec.start(Some(app_loop.clone()), dev_name);
                        }
                        HotkeyEvent::Released => {
                            // Visual Feedback: Transition Overlay & Tray to Processing
                            overlay_loop.set_processing(&app_loop);
                            TrayManager::set_processing(&app_loop);

                            // Audio Capture: Stop and extract WAV bytes
                            let wav_result = {
                                let mut rec = recorder_loop.lock();
                                rec.stop()
                            };

                            let wav_bytes = match wav_result {
                                Ok(bytes) => bytes,
                                Err(err) => {
                                    overlay_loop.set_error(&app_loop, &format!("Lỗi thu âm: {}", err));
                                    TrayManager::set_idle(&app_loop);
                                    continue;
                                }
                            };

                            // Spawn asynchronous AI Pipeline + Injection worker
                            let app_async = app_loop.clone();
                            let overlay_async = Arc::clone(&overlay_loop);
                            let clipboard_async = Arc::clone(&clipboard_loop);
                            let http_async = Arc::clone(&http_loop);
                            let config_async = Arc::clone(&config_loop);
                            let history_async = Arc::clone(&history_loop);

                            tauri::async_runtime::spawn(async move {
                                let total_start = std::time::Instant::now();
                                let (stt_profile, polish_profile, enable_polish, vocab, sys_prompt) = {
                                    let cfg = config_async.lock();
                                    let stt = cfg.feature_profiles.get("stt").cloned().unwrap_or_else(|| storage::FeatureProfile {
                                        provider_id: cfg.active_provider.clone(),
                                        model_id: Some(cfg.stt_model.clone()),
                                    });
                                    let polish = cfg.feature_profiles.get("polish").cloned().unwrap_or_else(|| storage::FeatureProfile {
                                        provider_id: cfg.active_provider.clone(),
                                        model_id: Some(cfg.polish_model.clone()),
                                    });
                                    (
                                        stt,
                                        polish,
                                        cfg.enable_polish,
                                        cfg.custom_vocabulary.clone(),
                                        cfg.system_prompt.clone(),
                                    )
                                };

                                let stt_prov = storage::get_provider(&stt_profile.provider_id);
                                let provider_display = stt_prov
                                    .as_ref()
                                    .map(|p| p.name.clone())
                                    .unwrap_or_else(|| match stt_profile.provider_id.as_str() {
                                        "openrouter" => "OpenRouter".to_string(),
                                        "custom" => "Custom Endpoint".to_string(),
                                        _ => "Groq".to_string(),
                                    });

                                let key = storage::get_provider_key(&stt_profile.provider_id).unwrap_or(None).unwrap_or_default();

                                if key.trim().is_empty() {
                                    overlay_async.set_error(
                                        &app_async,
                                        &format!("Chưa cài đặt API key cho {}", provider_display),
                                    );
                                    TrayManager::set_idle(&app_async);
                                    return;
                                }

                                // 1. Transcribe with active provider
                                let stt_start = std::time::Instant::now();
                                let stt_model = stt_profile
                                    .model_id
                                    .as_deref()
                                    .unwrap_or("whisper-large-v3-turbo");

                                let transcribe_res = if let Some(prov) = &stt_prov {
                                    ai::transcribe_with_endpoint(
                                        &http_async,
                                        &prov.base_url,
                                        &key,
                                        stt_model,
                                        wav_bytes,
                                        &vocab,
                                    )
                                    .await
                                } else {
                                    ai::transcribe_with_provider(
                                        &stt_profile.provider_id,
                                        &http_async,
                                        &key,
                                        stt_model,
                                        wav_bytes,
                                        &vocab,
                                        None,
                                    )
                                    .await
                                };

                                let raw_text = match transcribe_res {
                                    Ok(text) => text,
                                    Err(err) => {
                                        overlay_async.set_error(
                                            &app_async,
                                            &format!("Lỗi {}: {}", provider_display, err),
                                        );
                                        TrayManager::set_idle(&app_async);
                                        return;
                                    }
                                };

                                let stt_duration_ms = stt_start.elapsed().as_millis() as u64;

                                if raw_text.trim().is_empty() {
                                    overlay_async.hide(&app_async);
                                    TrayManager::set_idle(&app_async);
                                    return;
                                }

                                // 2. Pure STT vs Full LLM Polish
                                let (text_to_inject, llm_duration_ms) = if !enable_polish {
                                    // Direct verbatim insertion in Pure STT mode without regex or heuristic processing
                                    (raw_text.clone(), 0)
                                } else {
                                    let llm_start = std::time::Instant::now();
                                    let polish_key = storage::get_provider_key(&polish_profile.provider_id).unwrap_or(None).unwrap_or_default();
                                    let polished = if !polish_key.trim().is_empty() {
                                        let base_url = storage::get_provider(&polish_profile.provider_id)
                                            .map(|p| p.base_url)
                                            .unwrap_or_else(|| match polish_profile.provider_id.to_lowercase().as_str() {
                                                "openrouter" => "https://openrouter.ai/api/v1".to_string(),
                                                _ => "https://api.groq.com/openai/v1".to_string(),
                                            });
                                        let model = polish_profile.model_id.as_deref().unwrap_or("llama-3.3-70b-versatile");
                                        match ai::polish_with_endpoint(
                                            &http_async,
                                            &base_url,
                                            &polish_key,
                                            model,
                                            &raw_text,
                                            Some(&sys_prompt),
                                        )
                                        .await
                                        {
                                            Ok(p) => p,
                                            Err(_) => ai::LocalPolisher::polish(&raw_text),
                                        }
                                    } else {
                                        ai::LocalPolisher::polish(&raw_text)
                                    };
                                    (polished, llm_start.elapsed().as_millis() as u64)
                                };

                                if text_to_inject.trim().is_empty() {
                                    overlay_async.hide(&app_async);
                                    TrayManager::set_idle(&app_async);
                                    return;
                                }

                                // 3. Inject text at active Windows cursor
                                match injection::inject_text_at_cursor(
                                    clipboard_async,
                                    &text_to_inject,
                                )
                                .await
                                {
                                    Ok(injection::InjectionResult::TargetElevated) => {
                                        overlay_async.set_error(
                                            &app_async,
                                            "Cửa sổ Admin: Nhấn Ctrl+V để dán",
                                        );
                                    }
                                    Ok(injection::InjectionResult::Inserted) => {
                                        overlay_async.set_pasted(&app_async);
                                    }
                                    Err(err) => {
                                        overlay_async.set_error(
                                            &app_async,
                                            &format!("Lỗi dán: {}", err),
                                        );
                                    }
                                }

                                let total_duration_ms = total_start.elapsed().as_millis() as u64;
                                let history_item = HistoryItem {
                                    id: format!("hist_{}", chrono::Utc::now().timestamp_micros()),
                                    timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                                    raw_text,
                                    polished_text: text_to_inject,
                                    stt_duration_ms,
                                    llm_duration_ms,
                                    total_duration_ms,
                                };
                                let history_snapshot = {
                                    let mut h = history_async.lock();
                                    push_history_item(&mut h, history_item.clone());
                                    h.clone()
                                };
                                if let Err(e) = storage::save_history(&history_snapshot) {
                                    eprintln!("[vt-voice] Failed to persist transcription history: {}", e);
                                } else {
                                    let _ = app_async.emit("history-updated", &history_item);
                                }

                                TrayManager::set_idle(&app_async);
                            });
                        }
                    }
                }
            });

            // 4. Check initial start_minimized behavior
            if !initial_config.start_minimized {
                if let Some(main_win) = app_handle.get_webview_window("main") {
                    let _ = main_win.show();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Prevent process termination, hide settings window to tray
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_audio_devices,
            start_test_mic,
            stop_test_mic,
            get_app_config,
            save_app_config,
            save_api_key_cmd,
            test_ai_connection,
            save_provider_api_key,
            get_masked_provider_api_key,
            has_provider_api_key,
            delete_provider_api_key,
            test_provider_connection,
            get_available_stt_models,
            transcribe_and_polish,
            get_api_key_cmd,
            update_tray_locale_cmd,
            get_transcription_history,
            export_transcription_history_json,
            clear_transcription_history,
            hide_translate_overlay,
            copy_translation,
            get_providers,
            save_provider,
            delete_provider_cmd,
            fetch_provider_models,
            add_models_to_provider,
            remove_model_from_provider,
            test_provider_endpoint_cmd,
            get_feature_profiles,
            set_feature_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running vt-voice daemon");
}
