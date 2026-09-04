use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use super::win32::{apply_overlay_styles, hide_window, position_overlay_bottom_center, show_window_no_activate};

pub const OVERLAY_WINDOW_LABEL: &str = "overlay";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverlayStatus {
    Idle,
    Listening,
    Processing,
    Pasted,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayEventPayload {
    pub status: OverlayStatus,
    pub message: Option<String>,
}

#[derive(Clone)]
pub struct OverlayController {
    is_visible: Arc<AtomicBool>,
}

impl OverlayController {
    pub fn new() -> Self {
        Self {
            is_visible: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Retrieve the overlay webview window and its HWND
    fn get_overlay_window(app: &AppHandle) -> Option<WebviewWindow> {
        app.get_webview_window(OVERLAY_WINDOW_LABEL)
    }

    /// Prepare overlay window styles and position (called once at startup)
    pub fn setup_window(app: &AppHandle) {
        if let Some(window) = Self::get_overlay_window(app) {
            if let Ok(hwnd) = window.hwnd() {
                apply_overlay_styles(hwnd.0 as _);
                // 280 width, 48 height, 36px margin above taskbar
                position_overlay_bottom_center(hwnd.0 as _, 280, 48, 36);
            }
        }
    }

    /// Transition to listening state
    pub fn set_listening(&self, app: &AppHandle) {
        self.is_visible.store(true, Ordering::SeqCst);
        let _ = app.emit(
            "overlay-state",
            OverlayEventPayload {
                status: OverlayStatus::Listening,
                message: None,
            },
        );

        if let Some(window) = Self::get_overlay_window(app) {
            if let Ok(hwnd) = window.hwnd() {
                position_overlay_bottom_center(hwnd.0 as _, 280, 48, 36);
                show_window_no_activate(hwnd.0 as _);
            }
        }
    }

    /// Transition to processing state
    pub fn set_processing(&self, app: &AppHandle) {
        let _ = app.emit(
            "overlay-state",
            OverlayEventPayload {
                status: OverlayStatus::Processing,
                message: None,
            },
        );
    }

    /// Transition to pasted state (auto-hides after 1.2s)
    pub fn set_pasted(&self, app: &AppHandle) {
        let _ = app.emit(
            "overlay-state",
            OverlayEventPayload {
                status: OverlayStatus::Pasted,
                message: None,
            },
        );

        let app_clone = app.clone();
        let is_vis = Arc::clone(&self.is_visible);
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(1200)).await;
            is_vis.store(false, Ordering::SeqCst);
            if let Some(window) = app_clone.get_webview_window(OVERLAY_WINDOW_LABEL) {
                if let Ok(hwnd) = window.hwnd() {
                    hide_window(hwnd.0 as _);
                }
            }
            let _ = app_clone.emit(
                "overlay-state",
                OverlayEventPayload {
                    status: OverlayStatus::Idle,
                    message: None,
                },
            );
        });
    }

    /// Transition to error state (auto-hides after 2.5s)
    pub fn set_error(&self, app: &AppHandle, message: &str) {
        self.is_visible.store(true, Ordering::SeqCst);
        let _ = app.emit(
            "overlay-state",
            OverlayEventPayload {
                status: OverlayStatus::Error,
                message: Some(message.to_string()),
            },
        );

        if let Some(window) = Self::get_overlay_window(app) {
            if let Ok(hwnd) = window.hwnd() {
                position_overlay_bottom_center(hwnd.0 as _, 320, 48, 36);
                show_window_no_activate(hwnd.0 as _);
            }
        }

        let app_clone = app.clone();
        let is_vis = Arc::clone(&self.is_visible);
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(2500)).await;
            is_vis.store(false, Ordering::SeqCst);
            if let Some(window) = app_clone.get_webview_window(OVERLAY_WINDOW_LABEL) {
                if let Ok(hwnd) = window.hwnd() {
                    hide_window(hwnd.0 as _);
                }
            }
            let _ = app_clone.emit(
                "overlay-state",
                OverlayEventPayload {
                    status: OverlayStatus::Idle,
                    message: None,
                },
            );
        });
    }

    /// Immediately hide overlay
    pub fn hide(&self, app: &AppHandle) {
        self.is_visible.store(false, Ordering::SeqCst);
        if let Some(window) = Self::get_overlay_window(app) {
            if let Ok(hwnd) = window.hwnd() {
                hide_window(hwnd.0 as _);
            }
        }
        let _ = app.emit(
            "overlay-state",
            OverlayEventPayload {
                status: OverlayStatus::Idle,
                message: None,
            },
        );
    }
}
