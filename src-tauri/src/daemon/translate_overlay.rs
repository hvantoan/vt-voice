use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use super::win32::{
    apply_overlay_styles, hide_window, position_overlay_at_cursor, show_window_no_activate,
};
use crate::hotkey::{set_translate_visible, set_translate_overlay_hwnd};

pub const TRANSLATE_OVERLAY_WINDOW_LABEL: &str = "translate-overlay";

/// Payload emitted when a translation starts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslatePayload {
    pub source_text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub is_loading: bool,
    pub error: Option<String>,
}

/// Payload emitted when a translation completes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateResult {
    pub translated_text: String,
    pub is_loading: bool,
}

#[derive(Clone)]
pub struct TranslateOverlayController;

impl TranslateOverlayController {
    pub fn new() -> Self {
        Self
    }

    pub fn is_visible(&self) -> bool {
        crate::hotkey::translate_visible()
    }

    fn get_window(app: &AppHandle) -> Option<WebviewWindow> {
        app.get_webview_window(TRANSLATE_OVERLAY_WINDOW_LABEL)
    }

    /// Non-activating extended styles + hide (called once at startup).
    pub fn setup_window(app: &AppHandle) {
        if let Some(window) = Self::get_window(app) {
            if let Ok(hwnd) = window.hwnd() {
                apply_overlay_styles(hwnd.0 as _);
                hide_window(hwnd.0 as _);
            }
        }
    }

    /// Show the popover non-activatingly at the cursor, sized from the webview window's real size
    /// (never a hardcoded physical `340x150`, which would clip on HiDPI).
    pub fn show_at_cursor(&self, app: &AppHandle) {
        if let Some(window) = Self::get_window(app) {
            if let Ok(hwnd) = window.hwnd() {
                set_translate_overlay_hwnd(hwnd.0 as isize);
                let (width, height) = window_size_physical(&window);
                position_overlay_at_cursor(hwnd.0 as _, width, height);
                show_window_no_activate(hwnd.0 as _);
                set_translate_visible(true);
            }
        }
    }

    pub fn emit_payload(&self, app: &AppHandle, payload: &TranslatePayload) {
        let _ = app.emit("translate:payload", payload);
    }

    pub fn emit_result(&self, app: &AppHandle, result: &TranslateResult) {
        let _ = app.emit("translate:result", result);
    }

    pub fn hide(&self, app: &AppHandle) {
        set_translate_visible(false);
        if let Some(window) = Self::get_window(app) {
            if let Ok(hwnd) = window.hwnd() {
                hide_window(hwnd.0 as _);
            }
        }
    }
}

/// Derive the window's physical pixel size, preferring `outer_size()` and falling back to
/// `scale_factor()` times the logical config size. Physical px is what `SetWindowPos` expects.
fn window_size_physical(window: &WebviewWindow) -> (i32, i32) {
    if let Ok(sz) = window.outer_size() {
        if sz.width > 0 && sz.height > 0 {
            return (sz.width as i32, sz.height as i32);
        }
    }
    // Fallback: logical 340x150 scaled.
    let scale = window.scale_factor().unwrap_or(1.0);
    (
        (340.0 * scale).round() as i32,
        (150.0 * scale).round() as i32,
    )
}
