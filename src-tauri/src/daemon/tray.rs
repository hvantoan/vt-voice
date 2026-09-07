use parking_lot::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub const TRAY_ID: &str = "main-tray";

static CURRENT_LOCALE: Mutex<String> = Mutex::new(String::new());
static CURRENT_STATE: Mutex<String> = Mutex::new(String::new());

pub struct TrayStrings {
    pub settings: &'static str,
    pub quit: &'static str,
    pub tooltip_ready: &'static str,
    pub tooltip_recording: &'static str,
    pub tooltip_processing: &'static str,
    pub tooltip_error_prefix: &'static str,
}

impl TrayStrings {
    pub fn for_locale(locale: &str) -> Self {
        match locale {
            "en" => Self {
                settings: "Settings",
                quit: "Quit",
                tooltip_ready: "vt-voice: Ready",
                tooltip_recording: "vt-voice: Recording...",
                tooltip_processing: "vt-voice: Processing AI...",
                tooltip_error_prefix: "vt-voice: Error - ",
            },
            _ => Self {
                settings: "Cài đặt",
                quit: "Thoát",
                tooltip_ready: "vt-voice: Sẵn sàng",
                tooltip_recording: "vt-voice: Đang ghi âm...",
                tooltip_processing: "vt-voice: Đang xử lý AI...",
                tooltip_error_prefix: "vt-voice: Lỗi - ",
            },
        }
    }
}

pub struct TrayManager;

impl TrayManager {
    fn create_menu(app: &AppHandle, strings: &TrayStrings) -> Result<Menu<tauri::Wry>, tauri::Error> {
        let settings_i = MenuItem::with_id(app, "settings", strings.settings, true, None::<&str>)?;
        let quit_i = MenuItem::with_id(app, "quit", strings.quit, true, None::<&str>)?;
        Menu::with_items(app, &[&settings_i, &quit_i])
    }

    pub fn build(app: &AppHandle) -> Result<TrayIcon, tauri::Error> {
        let locale = CURRENT_LOCALE.lock().clone();
        let strings = TrayStrings::for_locale(&locale);
        *CURRENT_STATE.lock() = "ready".to_string();

        let menu = Self::create_menu(app, &strings)?;

        let mut builder = TrayIconBuilder::with_id(TRAY_ID)
            .tooltip(strings.tooltip_ready)
            .menu(&menu)
            .show_menu_on_left_click(false);
        if let Some(icon) = app.default_window_icon() {
            builder = builder.icon(icon.clone());
        }

        let tray = builder
            .on_menu_event(|app, event| match event.id.as_ref() {
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            })
            .build(app)?;

        Ok(tray)
    }

    pub fn update_tray_locale(app: &AppHandle, locale: &str) -> Result<(), tauri::Error> {
        *CURRENT_LOCALE.lock() = locale.to_string();
        let current_state = CURRENT_STATE.lock().clone();
        let strings = TrayStrings::for_locale(locale);

        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let menu = Self::create_menu(app, &strings)?;
            let _ = tray.set_menu(Some(menu));

            let tooltip = match current_state.as_str() {
                "recording" => strings.tooltip_recording,
                "processing" => strings.tooltip_processing,
                _ => strings.tooltip_ready,
            };
            let _ = tray.set_tooltip(Some(tooltip));
        }
        Ok(())
    }

    pub fn set_idle(app: &AppHandle) {
        *CURRENT_STATE.lock() = "ready".to_string();
        let locale = CURRENT_LOCALE.lock().clone();
        let strings = TrayStrings::for_locale(&locale);
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some(strings.tooltip_ready));
        }
    }

    pub fn set_recording(app: &AppHandle) {
        *CURRENT_STATE.lock() = "recording".to_string();
        let locale = CURRENT_LOCALE.lock().clone();
        let strings = TrayStrings::for_locale(&locale);
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some(strings.tooltip_recording));
        }
    }

    pub fn set_processing(app: &AppHandle) {
        *CURRENT_STATE.lock() = "processing".to_string();
        let locale = CURRENT_LOCALE.lock().clone();
        let strings = TrayStrings::for_locale(&locale);
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some(strings.tooltip_processing));
        }
    }

    pub fn set_error(app: &AppHandle, msg: &str) {
        *CURRENT_STATE.lock() = format!("error: {}", msg);
        let locale = CURRENT_LOCALE.lock().clone();
        let strings = TrayStrings::for_locale(&locale);
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some(format!("{}{}", strings.tooltip_error_prefix, msg)));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_strings_for_locale() {
        let en = TrayStrings::for_locale("en");
        assert_eq!(en.settings, "Settings");
        assert_eq!(en.quit, "Quit");
        assert_eq!(en.tooltip_ready, "vt-voice: Ready");
        assert_eq!(en.tooltip_recording, "vt-voice: Recording...");
        assert_eq!(en.tooltip_processing, "vt-voice: Processing AI...");
        assert_eq!(en.tooltip_error_prefix, "vt-voice: Error - ");

        let vi = TrayStrings::for_locale("vi");
        assert_eq!(vi.settings, "Cài đặt");
        assert_eq!(vi.quit, "Thoát");
        assert_eq!(vi.tooltip_ready, "vt-voice: Sẵn sàng");
        assert_eq!(vi.tooltip_recording, "vt-voice: Đang ghi âm...");
        assert_eq!(vi.tooltip_processing, "vt-voice: Đang xử lý AI...");
        assert_eq!(vi.tooltip_error_prefix, "vt-voice: Lỗi - ");

        // Fallback to Vietnamese for unknown / system
        let fallback = TrayStrings::for_locale("system");
        assert_eq!(fallback.settings, "Cài đặt");
        assert_eq!(fallback.quit, "Thoát");
    }
}
