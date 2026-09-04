use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub const TRAY_ID: &str = "main-tray";

pub struct TrayManager;

impl TrayManager {
    pub fn build(app: &AppHandle) -> Result<TrayIcon, tauri::Error> {
        let settings_i = MenuItem::with_id(app, "settings", "Cài đặt (Settings)", true, None::<&str>)?;
        let quit_i = MenuItem::with_id(app, "quit", "Thoát (Quit)", true, None::<&str>)?;

        let menu = Menu::with_items(app, &[&settings_i, &quit_i])?;

        let mut builder = TrayIconBuilder::with_id(TRAY_ID)
            .tooltip("vt-voice: Sẵn sàng (Ready)")
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

    pub fn set_idle(app: &AppHandle) {
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some("vt-voice: Sẵn sàng (Ready)"));
        }
    }

    pub fn set_recording(app: &AppHandle) {
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some("vt-voice: Đang ghi âm (Recording)..."));
        }
    }

    pub fn set_processing(app: &AppHandle) {
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some("vt-voice: Đang xử lý AI (Processing)..."));
        }
    }

    pub fn set_error(app: &AppHandle, msg: &str) {
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_tooltip(Some(format!("vt-voice: Lỗi - {}", msg)));
        }
    }
}
