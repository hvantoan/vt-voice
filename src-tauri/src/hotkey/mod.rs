pub mod hook;
pub mod types;

pub use hook::{
    set_translate_last_result, set_translate_overlay_hwnd, set_translate_visible,
    translate_last_result, translate_visible, HookError, HotkeyManager,
};
pub use types::{
    translate_overlay_key_decide, translate_swallow_decide, should_reset_hotkey_state, HotkeyAction,
    HotkeyEvent, HotkeyMode, HotkeyRegistry, KeyBinding, TranslateDecision,
    TranslateOverlayKeyAction, VK_ESCAPE, VK_RETURN,
};
