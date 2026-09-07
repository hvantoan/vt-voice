use parking_lot::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub const TRAY_ID: &str = "main-tray";

static CURRENT_LOCALE: Mutex<String> = Mutex::new(String::new());
static CURRENT_STATE: Mutex<String> = Mutex::new(String::new());
static TRAY_UPDATE_LOCK: Mutex<()> = Mutex::new(());

pub struct TrayStrings {
    pub settings: &'static str,
    pub quit: &'static str,
    pub tooltip_ready: &'static str,
    pub tooltip_recording: &'static str,
    pub tooltip_processing: &'static str,
    pub tooltip_error_prefix: &'static str,
}

impl TrayStrings {
    pub fn resolve_locale(locale: &str) -> String {
        if locale == "system" || locale.trim().is_empty() {
            #[cfg(target_os = "windows")]
            {
                extern "system" {
                    fn GetUserDefaultUILanguage() -> u16;
                }
                let lang_id = unsafe { GetUserDefaultUILanguage() };
                let primary_lang = lang_id & 0x3ff;
                if primary_lang == 0x2a {
                    "vi".to_string()
                } else {
                    "en".to_string()
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                if let Ok(lang) = std::env::var("LANG").or_else(|_| std::env::var("LC_ALL")) {
                    if lang.to_lowercase().starts_with("vi") {
                        return "vi".to_string();
                    }
                }
                "en".to_string()
            }
        } else {
            locale.to_string()
        }
    }

    pub fn for_locale(locale: &str) -> Self {
        let effective = Self::resolve_locale(locale);
        match effective.as_str() {
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
    pub fn localize_error_msg(msg: &str, locale: &str) -> String {
        if locale != "en" {
            return msg.to_string();
        }

        let trimmed = msg.trim();
        if trimmed == "Cửa sổ Admin: Nhấn Ctrl+V để dán" {
            return "Admin window: Press Ctrl+V to paste".to_string();
        }
        if trimmed == "Chưa cấu hình API key cho provider này" {
            return "API key not configured for this provider".to_string();
        }
        if let Some(detail) = trimmed.strip_prefix("Lỗi thu âm: ") {
            return format!("Recording error: {}", detail);
        }
        if trimmed == "Lỗi thu âm" {
            return "Recording error".to_string();
        }
        if let Some(detail) = trimmed.strip_prefix("Lỗi dán: ") {
            return format!("Paste error: {}", detail);
        }
        if trimmed == "Lỗi dán" {
            return "Paste error".to_string();
        }
        if let Some(provider) = trimmed.strip_prefix("Chưa cài đặt API key cho ") {
            return format!("API key not configured for {}", provider);
        }
        if let Some(rest) = trimmed.strip_prefix("Lỗi ") {
            if let Some((prov, detail)) = rest.split_once(": ") {
                return format!("{} error: {}", prov, detail);
            }
        }

        msg.to_string()
    }
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
        let effective = TrayStrings::resolve_locale(locale);
        let strings = TrayStrings::for_locale(&effective);
        let menu = Self::create_menu(app, &strings)?;

        let _guard = TRAY_UPDATE_LOCK.lock();
        *CURRENT_LOCALE.lock() = effective.clone();
        let current_state = CURRENT_STATE.lock().clone();

        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_menu(Some(menu));

            let tooltip = if current_state.starts_with("error: ") {
                let msg = &current_state["error: ".len()..];
                let localized_msg = Self::localize_error_msg(msg, &effective);
                format!("{}{}", strings.tooltip_error_prefix, localized_msg)
            } else {
                match current_state.as_str() {
                    "recording" => strings.tooltip_recording.to_string(),
                    "processing" => strings.tooltip_processing.to_string(),
                    _ => strings.tooltip_ready.to_string(),
                }
            };
            let _ = tray.set_tooltip(Some(tooltip));
        }
        Ok(())
    }

    pub fn set_idle(app: &AppHandle) {
        let _guard = TRAY_UPDATE_LOCK.lock();
        *CURRENT_STATE.lock() = "ready".to_string();
        let locale = CURRENT_LOCALE.lock().clone();
        let strings = TrayStrings::for_locale(&locale);
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some(strings.tooltip_ready));
        }
    }

    pub fn set_recording(app: &AppHandle) {
        let _guard = TRAY_UPDATE_LOCK.lock();
        *CURRENT_STATE.lock() = "recording".to_string();
        let locale = CURRENT_LOCALE.lock().clone();
        let strings = TrayStrings::for_locale(&locale);
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some(strings.tooltip_recording));
        }
    }

    pub fn set_processing(app: &AppHandle) {
        let _guard = TRAY_UPDATE_LOCK.lock();
        *CURRENT_STATE.lock() = "processing".to_string();
        let locale = CURRENT_LOCALE.lock().clone();
        let strings = TrayStrings::for_locale(&locale);
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some(strings.tooltip_processing));
        }
    }

    pub fn set_error(app: &AppHandle, msg: &str) {
        let _guard = TRAY_UPDATE_LOCK.lock();
        *CURRENT_STATE.lock() = format!("error: {}", msg);
        let locale = CURRENT_LOCALE.lock().clone();
        let strings = TrayStrings::for_locale(&locale);
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let localized_msg = Self::localize_error_msg(msg, &locale);
            let _ = tray.set_tooltip(Some(format!("{}{}", strings.tooltip_error_prefix, localized_msg)));
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

        // System resolves to OS effective locale
        let fallback = TrayStrings::for_locale("system");
        let expected = TrayStrings::resolve_locale("system");
        let expected_strings = TrayStrings::for_locale(&expected);
        assert_eq!(fallback.settings, expected_strings.settings);
        assert_eq!(fallback.quit, expected_strings.quit);

        // Unknown fallback defaults to Vietnamese
        let unknown = TrayStrings::for_locale("unknown");
        assert_eq!(unknown.settings, "Cài đặt");
        assert_eq!(unknown.quit, "Thoát");
    }
    #[test]
    fn test_tray_error_localization() {
        let raw_mic = "Lỗi thu âm: Device busy";
        assert_eq!(TrayManager::localize_error_msg(raw_mic, "en"), "Recording error: Device busy");
        assert_eq!(TrayManager::localize_error_msg(raw_mic, "vi"), raw_mic);

        let raw_key = "Chưa cài đặt API key cho Groq";
        assert_eq!(TrayManager::localize_error_msg(raw_key, "en"), "API key not configured for Groq");
        assert_eq!(TrayManager::localize_error_msg(raw_key, "vi"), raw_key);

        let raw_admin = "Cửa sổ Admin: Nhấn Ctrl+V để dán";
        assert_eq!(TrayManager::localize_error_msg(raw_admin, "en"), "Admin window: Press Ctrl+V to paste");
    }
}
