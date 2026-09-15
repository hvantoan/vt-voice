pub mod overlay;
pub mod tray;
pub mod translate_overlay;
pub mod win32;

pub use overlay::{OverlayController, OverlayEventPayload, OverlayStatus, OVERLAY_WINDOW_LABEL};
pub use tray::{TrayManager, TRAY_ID};
pub use translate_overlay::{
    TranslateOverlayController, TranslatePayload, TranslateResult, TRANSLATE_OVERLAY_WINDOW_LABEL,
};
pub use win32::{
    apply_overlay_styles, clamp_position, hide_window, position_overlay_at_cursor,
    position_overlay_bottom_center, show_window_no_activate,
};
