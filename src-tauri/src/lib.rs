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
use daemon::{OverlayController, TrayManager};
use hotkey::{HotkeyEvent, HotkeyManager};
use injection::ClipboardManager;
use storage::{load_config, save_config, AppConfig, HistoryItem, push_history_item};

pub struct AppState {
    pub audio_recorder: Arc<Mutex<AudioRecorder>>,
    pub hotkey_manager: Arc<Mutex<HotkeyManager>>,
    pub clipboard_manager: Arc<ClipboardManager>,
    pub overlay_controller: Arc<OverlayController>,
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
    config: AppConfig,
) -> Result<(), String> {
    let locale_changed = {
        let current = state.config.lock();
        current.locale != config.locale
    };
    save_config(&config).map_err(|e| e.to_string())?;
    state
        .hotkey_manager
        .lock()
        .update_config(config.hotkey_binding.clone(), config.hotkey_mode);
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
fn get_api_key_cmd() -> Result<Option<String>, String> {
    storage::get_api_key().map_err(|e| e.to_string())
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
    if trimmed.contains('•') {
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
        Some(k) if !k.trim().is_empty() && !k.contains('•') => k,
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
async fn transcribe_and_polish(
    app: AppHandle,
    state: State<'_, AppState>,
    wav_bytes: Vec<u8>,
) -> Result<AiPipelineResult, String> {
    let (provider, model, enable_polish, custom_endpoint, vocab, sys_prompt) = {
        let cfg = state.config.lock();
        (
            cfg.active_provider.clone(),
            cfg.stt_model.clone(),
            cfg.enable_polish,
            cfg.custom_endpoint.clone(),
            cfg.custom_vocabulary.clone(),
            cfg.system_prompt.clone(),
        )
    };

    let key = storage::get_provider_key(&provider)
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    if key.trim().is_empty() {
        let provider_display = match provider.as_str() {
            "openrouter" => "OpenRouter",
            "custom" => "Custom Endpoint",
            _ => "Groq",
        };
        return Err(format!("Chưa cài đặt API key cho {}", provider_display));
    }

    let total_start = std::time::Instant::now();
    let stt_start = std::time::Instant::now();
    let raw_text = ai::transcribe_with_provider(
        &provider,
        &state.http_client,
        &key,
        &model,
        wav_bytes,
        &vocab,
        custom_endpoint.as_deref(),
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
        let groq_key = storage::get_provider_key("groq")
            .map_err(|e| e.to_string())?
            .unwrap_or_default();

        let llm_start = std::time::Instant::now();
        let polished = if !groq_key.trim().is_empty() {
            match ai::polish_grammar(&state.http_client, &groq_key, &raw_text, Some(&sys_prompt)).await {
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
            hotkey_tx,
        );
    }

    let state = AppState {
        audio_recorder: Arc::clone(&audio_recorder),
        hotkey_manager: Arc::clone(&hotkey_manager),
        clipboard_manager: Arc::clone(&clipboard_manager),
        overlay_controller: Arc::clone(&overlay_controller),
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
            let clipboard_loop = Arc::clone(&clipboard_manager);
            let http_loop = Arc::clone(&http_client);
            let config_loop = Arc::clone(&config);
            let history_loop = Arc::clone(&history);

            std::thread::spawn(move || {
                while let Ok(event) = hotkey_rx.recv() {
                    match event {
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
                                let (provider, model, enable_polish, custom_endpoint, vocab, sys_prompt) = {
                                    let cfg = config_async.lock();
                                    (
                                        cfg.active_provider.clone(),
                                        cfg.stt_model.clone(),
                                        cfg.enable_polish,
                                        cfg.custom_endpoint.clone(),
                                        cfg.custom_vocabulary.clone(),
                                        cfg.system_prompt.clone(),
                                    )
                                };

                                let key = storage::get_provider_key(&provider).unwrap_or(None).unwrap_or_default();

                                if key.trim().is_empty() {
                                    let provider_display = match provider.as_str() {
                                        "openrouter" => "OpenRouter",
                                        "custom" => "Custom Endpoint",
                                        _ => "Groq",
                                    };
                                    overlay_async.set_error(
                                        &app_async,
                                        &format!("Chưa cài đặt API key cho {}", provider_display),
                                    );
                                    TrayManager::set_idle(&app_async);
                                    return;
                                }

                                // 1. Transcribe with active provider
                                let stt_start = std::time::Instant::now();
                                let transcribe_res = ai::transcribe_with_provider(
                                    &provider,
                                    &http_async,
                                    &key,
                                    &model,
                                    wav_bytes,
                                    &vocab,
                                    custom_endpoint.as_deref(),
                                )
                                .await;

                                let raw_text = match transcribe_res {
                                    Ok(text) => text,
                                    Err(err) => {
                                        let provider_name = match provider.as_str() {
                                            "openrouter" => "OpenRouter",
                                            "custom" => "Custom",
                                            _ => "Groq",
                                        };
                                        overlay_async.set_error(
                                            &app_async,
                                            &format!("Lỗi {}: {}", provider_name, err),
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
                                    let groq_key = storage::get_provider_key("groq").unwrap_or(None).unwrap_or_default();
                                    let polished = if !groq_key.trim().is_empty() {
                                        match ai::polish_grammar(
                                            &http_async,
                                            &groq_key,
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
            clear_transcription_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running vt-voice daemon");
}
