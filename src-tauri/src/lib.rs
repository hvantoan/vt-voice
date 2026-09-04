pub mod ai;
pub mod audio;
pub mod daemon;
pub mod hotkey;
pub mod injection;
pub mod storage;

use std::sync::Arc;
use crossbeam_channel::unbounded;
use parking_lot::Mutex;
use tauri::{AppHandle, Manager, State, WindowEvent};

use ai::{AiHttpClient, AiPipelineResult};
use audio::{AudioDevice, AudioRecorder};
use daemon::{OverlayController, TrayManager};
use hotkey::{HotkeyEvent, HotkeyManager};
use injection::ClipboardManager;
use storage::{AppConfig, load_config, save_config, get_api_key, set_api_key};

pub struct AppState {
    pub audio_recorder: Arc<Mutex<AudioRecorder>>,
    pub hotkey_manager: Arc<Mutex<HotkeyManager>>,
    pub clipboard_manager: Arc<ClipboardManager>,
    pub overlay_controller: Arc<OverlayController>,
    pub http_client: Arc<AiHttpClient>,
    pub config: Arc<Mutex<AppConfig>>,
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
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<(), String> {
    save_config(&config).map_err(|e| e.to_string())?;
    *state.config.lock() = config;
    Ok(())
}

#[tauri::command]
fn get_api_key_cmd() -> Result<Option<String>, String> {
    get_api_key().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_api_key_cmd(key: String) -> Result<(), String> {
    set_api_key(&key).map_err(|e| e.to_string())
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
async fn transcribe_and_polish(
    state: State<'_, AppState>,
    wav_bytes: Vec<u8>,
) -> Result<AiPipelineResult, String> {
    let (key, vocab, sys_prompt) = {
        let cfg = state.config.lock();
        let key = get_api_key().map_err(|e| e.to_string())?.unwrap_or_default();
        (key, cfg.custom_vocabulary.clone(), cfg.system_prompt.clone())
    };

    ai::run_pipeline(
        &state.http_client,
        &key,
        wav_bytes,
        &vocab,
        Some(&sys_prompt),
    )
    .await
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = load_config();
    let audio_recorder = Arc::new(Mutex::new(AudioRecorder::new()));
    let hotkey_manager = Arc::new(Mutex::new(HotkeyManager::new()));
    let clipboard_manager = Arc::new(ClipboardManager::new());
    let overlay_controller = Arc::new(OverlayController::new());
    let http_client = Arc::new(AiHttpClient::new());
    let config = Arc::new(Mutex::new(initial_config.clone()));

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
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // 1. Build System Tray
            let _ = TrayManager::build(&app_handle);

            // 2. Setup Overlay Window HWND properties
            OverlayController::setup_window(&app_handle);

            // 3. Spawn background event loop for hotkey triggers
            let app_loop = app_handle.clone();
            let recorder_loop = Arc::clone(&audio_recorder);
            let overlay_loop = Arc::clone(&overlay_controller);
            let clipboard_loop = Arc::clone(&clipboard_manager);
            let http_loop = Arc::clone(&http_client);
            let config_loop = Arc::clone(&config);

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

                            tauri::async_runtime::spawn(async move {
                                let (key, vocab, sys_prompt) = {
                                    let cfg = config_async.lock();
                                    let key = get_api_key().unwrap_or(None).unwrap_or_default();
                                    (key, cfg.custom_vocabulary.clone(), cfg.system_prompt.clone())
                                };

                                if key.trim().is_empty() {
                                    overlay_async.set_error(&app_async, "Chưa cài đặt API key trong Settings");
                                    TrayManager::set_idle(&app_async);
                                    return;
                                }

                                match ai::run_pipeline(
                                    &http_async,
                                    &key,
                                    wav_bytes,
                                    &vocab,
                                    Some(&sys_prompt),
                                )
                                .await
                                {
                                    Ok(res) => {
                                        if res.polished_text.trim().is_empty() {
                                            overlay_async.hide(&app_async);
                                            TrayManager::set_idle(&app_async);
                                            return;
                                        }

                                        // Inject text at active Windows cursor
                                        match injection::inject_text_at_cursor(
                                            clipboard_async,
                                            &res.polished_text,
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
                                    }
                                    Err(err) => {
                                        overlay_async.set_error(
                                            &app_async,
                                            &format!("Lỗi AI: {}", err),
                                        );
                                    }
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
            get_api_key_cmd,
            save_api_key_cmd,
            test_ai_connection,
            transcribe_and_polish,
        ])
        .run(tauri::generate_context!())
        .expect("error while running vt-voice daemon");
}
