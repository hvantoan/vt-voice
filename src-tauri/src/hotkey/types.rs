use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum HotkeyMode {
    #[default]
    PushToTalk,
    Toggle,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KeyBinding {
    pub code: u32,
    pub name: String,
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub win: bool,
}

impl Default for KeyBinding {
    fn default() -> Self {
        Self {
            // VK_RMENU = 0xA5 (Right Alt)
            code: 0xA5,
            name: "Right Alt".to_string(),
            ctrl: false,
            alt: false,
            shift: false,
            win: false,
        }
    }
}

impl KeyBinding {
    pub fn new_single(code: u32, name: &str) -> Self {
        Self {
            code,
            name: name.to_string(),
            ctrl: false,
            alt: false,
            shift: false,
            win: false,
        }
    }

    pub fn is_mouse(&self) -> bool {
        matches!(self.code, 0x01 | 0x02 | 0x04 | 0x05 | 0x06)
    }

    pub fn is_combo(&self) -> bool {
        self.ctrl || self.alt || self.shift || self.win
    }

    pub fn matches(&self, vk_code: u32, ctrl: bool, alt: bool, shift: bool, win: bool) -> bool {
        self.matches_press(vk_code, ctrl, alt, shift, win)
    }

    pub fn matches_press(&self, vk_code: u32, ctrl: bool, alt: bool, shift: bool, win: bool) -> bool {
        if self.is_combo() {
            // Combination mode: main key + required modifiers must match
            self.code == vk_code
                && self.ctrl == ctrl
                && self.alt == alt
                && self.shift == shift
                && self.win == win
        } else {
            // Single key mode (ANY key on keyboard or mouse)
            match self.code {
                0xA5 => vk_code == 0xA5 || (vk_code == 0x12 && alt), // Right Alt / Alt
                0xA4 => vk_code == 0xA4 || (vk_code == 0x12 && alt), // Left Alt / Alt
                0x12 => vk_code == 0x12 || vk_code == 0xA4 || vk_code == 0xA5, // Alt generic
                0xA3 => vk_code == 0xA3 || (vk_code == 0x11 && ctrl), // Right Ctrl
                0xA2 => vk_code == 0xA2 || (vk_code == 0x11 && ctrl), // Left Ctrl
                0x11 => vk_code == 0x11 || vk_code == 0xA2 || vk_code == 0xA3, // Ctrl generic
                0xA1 => vk_code == 0xA1 || (vk_code == 0x10 && shift), // Right Shift
                0xA0 => vk_code == 0xA0 || (vk_code == 0x10 && shift), // Left Shift
                0x10 => vk_code == 0x10 || vk_code == 0xA0 || vk_code == 0xA1, // Shift generic
                0x5B | 0x5C => vk_code == 0x5B || vk_code == 0x5C, // Win keys
                0x14 => vk_code == 0x14, // CapsLock
                _ => self.code == vk_code, // Any other single key (F1-F24, Space, A-Z, Mouse buttons, etc.)
            }
        }
    }

    pub fn matches_release(&self, vk_code: u32) -> bool {
        if !self.is_combo() {
            // Single key mode: matches when that key is released
            match self.code {
                0xA5 => vk_code == 0xA5 || vk_code == 0x12,
                0xA4 => vk_code == 0xA4 || vk_code == 0x12,
                0x12 => vk_code == 0x12 || vk_code == 0xA4 || vk_code == 0xA5,
                0xA3 => vk_code == 0xA3 || vk_code == 0x11,
                0xA2 => vk_code == 0xA2 || vk_code == 0x11,
                0x11 => vk_code == 0x11 || vk_code == 0xA2 || vk_code == 0xA3,
                0xA1 => vk_code == 0xA1 || vk_code == 0x10,
                0xA0 => vk_code == 0xA0 || vk_code == 0x10,
                0x10 => vk_code == 0x10 || vk_code == 0xA0 || vk_code == 0xA1,
                0x5B | 0x5C => vk_code == 0x5B || vk_code == 0x5C,
                0x14 => vk_code == 0x14,
                _ => self.code == vk_code,
            }
        } else {
            // Combination mode: releasing main key OR any required modifier releases the hotkey
            if self.code == vk_code {
                return true;
            }
            if self.ctrl && matches!(vk_code, 0x11 | 0xA2 | 0xA3) {
                return true;
            }
            if self.alt && matches!(vk_code, 0x12 | 0xA4 | 0xA5) {
                return true;
            }
            if self.shift && matches!(vk_code, 0x10 | 0xA0 | 0xA1) {
                return true;
            }
            if self.win && matches!(vk_code, 0x5B | 0x5C) {
                return true;
            }
            false
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HotkeyEvent {
    Pressed,
    Released,
    TranslateTrigger,
    TranslateHide,
    TranslateCopy,
}

/// High-level action a hotkey registration drives. STT actions keep their existing
/// hold/toggle timing; `Translate` is one-shot and release-triggered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HotkeyAction {
    SttPushToTalk,
    SttToggle,
    Translate,
}

/// Per-action registration set shared by the single hook thread. This is the single source
/// of truth for which bindings the `WH_KEYBOARD_LL` proc dispatches against.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct HotkeyRegistry {
    pub stt_binding: Option<KeyBinding>,
    pub stt_mode: HotkeyMode,
    pub translate_binding: Option<KeyBinding>,
}

/// Outcome of evaluating one keyboard event against the translate binding.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TranslateDecision {
    /// Main-key event must be swallowed (never reaches the foreground app's menu accelerator).
    pub swallow: bool,
    /// The combo has fully released; emit a `TranslateTrigger`.
    pub fire: bool,
}

/// Virtual-key codes for the translate popover's dismiss keys.
pub const VK_ESCAPE: u32 = 0x1B;
pub const VK_RETURN: u32 = 0x0D;

/// What the popover-key gate should do with a key event while the translate popover is visible.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TranslateOverlayKeyAction {
    /// Let the event reach the foreground app.
    None,
    /// Swallow it and hide the popover (Esc).
    Hide,
    /// Swallow it and copy the last result (Enter).
    Copy,
}

/// Pure decision for Esc (hide) / Enter (copy) while the translate popover is visible.
///
/// The popover is `WS_EX_NOACTIVATE`, so it never receives keystrokes natively — the global hook
/// must intercept them and the decision is pure so it can be unit-tested. The main key is consumed
/// on the first key-*down* and `consumed` is retained, so auto-repeat key-downs and the key-up are
/// swallowed too (otherwise holding Enter types newlines into the editor, holding Esc sends Esc to
/// it once `hide()` flips `visible` on the down). `consumed` is cleared on the final key-up.
///
/// Returns `(action, new_consumed)`. When `new_consumed != 0` (or a pre-existing consumed state is
/// active) the caller must swallow the event even if `action` is `None`.
pub fn translate_overlay_key_decide(
    consumed: u32,
    vk: u32,
    is_down: bool,
    is_up: bool,
    has_result: bool,
) -> (TranslateOverlayKeyAction, u32) {
    if consumed != 0 {
        // A key is already consumed (held). Clear on its final key-up; swallow everything
        // (the held key's auto-repeat downs, and any interleaved key) until it releases.
        if vk == consumed && is_up {
            return (TranslateOverlayKeyAction::None, 0);
        }
        return (TranslateOverlayKeyAction::None, consumed);
    }

    if !is_down {
        return (TranslateOverlayKeyAction::None, 0);
    }
    if vk == VK_ESCAPE {
        return (TranslateOverlayKeyAction::Hide, VK_ESCAPE);
    }
    // Enter is always consumed while visible (so no newline leaks into the editor behind the
    // popover during the loading/error state); the Copy *action* is conditional on a result.
    if vk == VK_RETURN {
        let action = if has_result {
            TranslateOverlayKeyAction::Copy
        } else {
            TranslateOverlayKeyAction::None
        };
        return (action, VK_RETURN);
    }
    (TranslateOverlayKeyAction::None, 0)
}

/// Pure decision helper for the one-shot translate hotkey.
///
/// `translate` fires once on **combo release** (main key and all required modifiers up), never on
/// key-down — firing on key-down would run capture while `Alt` is still physically held, converting
/// the injected `Ctrl+C` into `Ctrl+Alt+C`. The main key is swallowed on down *and* up so the
/// `Alt+<letter>` menu accelerator never reaches the app; modifier events are never swallowed
/// (otherwise the app would think `Alt` is stuck down). Both release orders are handled via the
/// async-key-derived `main_pressed`/`mods_up` flags.
///
/// Pure so the two release orders can be unit-tested without a real keyboard.
pub fn translate_swallow_decide(
    armed: bool,
    binding: &KeyBinding,
    vk: u32,
    is_down: bool,
    is_up: bool,
    ctrl: bool,
    alt: bool,
    shift: bool,
    win: bool,
    main_pressed: bool,
    mods_up: bool,
) -> (bool, TranslateDecision) {
    let arm_press = is_down && binding.matches_press(vk, ctrl, alt, shift, win);
    // Swallow the main-key down (the accelerator trigger) and its matching up (keep up/down
    // balanced in the target app). Never swallow a modifier event.
    let swallow = vk == binding.code && (arm_press || (armed && is_up));
    // Fire on a main/modifier release while armed, only when the main key is clear and every
    // required modifier is up.
    let is_release_candidate = is_up && binding.matches_release(vk);
    let fire = armed && is_release_candidate && !main_pressed && mods_up;

    let new_armed = if fire {
        false
    } else if arm_press {
        true
    } else {
        armed
    };

    (new_armed, TranslateDecision { swallow, fire })
}

/// Determines whether active hotkey tracking flags (IS_HELD / IS_TOGGLED_ON)
/// must be reset when transitioning to a new hotkey configuration.
///
/// Returns true if either the key binding or hotkey mode has changed.
pub fn should_reset_hotkey_state(
    current_binding: Option<&KeyBinding>,
    new_binding: &KeyBinding,
    current_mode: HotkeyMode,
    new_mode: HotkeyMode,
) -> bool {
    current_binding != Some(new_binding) || current_mode != new_mode
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::translate_overlay_key_decide;
    use super::TranslateOverlayKeyAction;

    #[test]
    fn test_default_keybinding() {
        let binding = KeyBinding::default();
        assert_eq!(binding.name, "Right Alt");
        assert_eq!(binding.code, 0xA5);
        assert!(binding.matches(0xA5, false, false, false, false));
    }

    #[test]
    fn test_combo_keybinding() {
        let binding = KeyBinding {
            code: 0x20, // Space
            name: "Ctrl+Shift+Space".to_string(),
            ctrl: true,
            alt: false,
            shift: true,
            win: false,
        };

        assert!(binding.matches(0x20, true, false, true, false));
        assert!(!binding.matches(0x20, false, false, true, false));
        assert!(!binding.matches(0x41, true, false, true, false));
    }

    #[test]
    fn test_combo_release_modifier_first() {
        let binding = KeyBinding {
            code: 0x20, // Space
            name: "Ctrl+Space".to_string(),
            ctrl: true,
            alt: false,
            shift: false,
            win: false,
        };

        // Press requires both
        assert!(binding.matches_press(0x20, true, false, false, false));
        assert!(!binding.matches_press(0x20, false, false, false, false));

        // Releasing Ctrl breaks the combo
        assert!(binding.matches_release(0xA2)); // VK_LCONTROL
        assert!(binding.matches_release(0xA3)); // VK_RCONTROL
        assert!(binding.matches_release(0x11)); // VK_CONTROL

        // Unrelated key release does not match
        assert!(!binding.matches_release(0x41)); // A
    }

    #[test]
    fn test_combo_release_key_first() {
        let binding = KeyBinding {
            code: 0x20, // Space
            name: "Ctrl+Space".to_string(),
            ctrl: true,
            alt: false,
            shift: false,
            win: false,
        };

        // Releasing Space breaks the combo
        assert!(binding.matches_release(0x20));
    }

    #[test]
    fn test_mouse_button_press_and_release() {
        let mouse4 = KeyBinding {
            code: 0x05, // VK_XBUTTON1
            name: "Mouse 4".to_string(),
            ctrl: false,
            alt: false,
            shift: false,
            win: false,
        };

        assert!(mouse4.is_mouse());
        assert!(mouse4.matches_press(0x05, false, false, false, false));
        assert!(!mouse4.matches_press(0x06, false, false, false, false));
        assert!(mouse4.matches_release(0x05));
        assert!(!mouse4.matches_release(0x06));

        let mouse5 = KeyBinding {
            code: 0x06, // VK_XBUTTON2
            name: "Mouse 5".to_string(),
            ctrl: false,
            alt: false,
            shift: false,
            win: false,
        };

        assert!(mouse5.is_mouse());
        assert!(mouse5.matches_press(0x06, false, false, false, false));
        assert!(mouse5.matches_release(0x06));
    }

    #[test]
    fn test_mouse_combo_press_and_release() {
        let ctrl_mouse4 = KeyBinding {
            code: 0x05, // VK_XBUTTON1
            name: "Ctrl + Mouse 4".to_string(),
            ctrl: true,
            alt: false,
            shift: false,
            win: false,
        };

        assert!(ctrl_mouse4.matches_press(0x05, true, false, false, false));
        assert!(!ctrl_mouse4.matches_press(0x05, false, false, false, false));
        // Releasing mouse 4 releases
        assert!(ctrl_mouse4.matches_release(0x05));
        // Releasing Ctrl releases
        assert!(ctrl_mouse4.matches_release(0xA2));
    }

    #[test]
    fn test_should_reset_hotkey_state() {
        let binding1 = KeyBinding::default();
        let binding2 = KeyBinding::new_single(0x20, "Space");

        // Unchanged
        assert!(!should_reset_hotkey_state(
            Some(&binding1),
            &binding1,
            HotkeyMode::PushToTalk,
            HotkeyMode::PushToTalk
        ));

        // Mode changed
        assert!(should_reset_hotkey_state(
            Some(&binding1),
            &binding1,
            HotkeyMode::PushToTalk,
            HotkeyMode::Toggle
        ));

        // Binding changed
        assert!(should_reset_hotkey_state(
            Some(&binding1),
            &binding2,
            HotkeyMode::PushToTalk,
            HotkeyMode::PushToTalk
        ));

        // Initial none
        assert!(should_reset_hotkey_state(
            None,
            &binding1,
            HotkeyMode::PushToTalk,
            HotkeyMode::PushToTalk
        ));
    }

    fn alt_t() -> KeyBinding {
        KeyBinding {
            code: 0x54, // T
            name: "Alt+T".to_string(),
            ctrl: false,
            alt: true,
            shift: false,
            win: false,
        }
    }

    #[test]
    fn test_hotkey_registry_serde_roundtrip() {
        let reg = HotkeyRegistry {
            stt_binding: Some(KeyBinding::default()),
            stt_mode: HotkeyMode::PushToTalk,
            translate_binding: Some(alt_t()),
        };
        let json = serde_json::to_string(&reg).expect("serialize");
        let back: HotkeyRegistry = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back, reg);
    }

    #[test]
    fn test_translate_action_serde() {
        assert_eq!(
            serde_json::to_string(&HotkeyAction::Translate).unwrap(),
            "\"translate\""
        );
        let round: HotkeyAction = serde_json::from_str("\"stt_push_to_talk\"").unwrap();
        assert_eq!(round, HotkeyAction::SttPushToTalk);
    }

    #[test]
    fn test_translate_swallow_main_key_and_fire() {
        let b = alt_t();
        // main key down, Alt held → arm + swallow
        let (armed, d) =
            translate_swallow_decide(false, &b, 0x54, true, false, false, true, false, false, true, false);
        assert!(armed);
        assert!(d.swallow);
        assert!(!d.fire);
        // release T (Alt now up, main clear) → fire, swallowed up
        let (armed2, d2) =
            translate_swallow_decide(armed, &b, 0x54, false, true, false, false, false, false, false, true);
        assert!(!armed2);
        assert!(d2.swallow);
        assert!(d2.fire);
        // modifier (Alt) events never swallowed
        let (_a, d3) =
            translate_swallow_decide(false, &b, 0x12, true, false, false, true, false, false, false, false);
        assert!(!d3.swallow);
        assert!(!d3.fire);
        let (_a, d4) =
            translate_swallow_decide(false, &b, 0x12, false, true, false, false, false, false, false, false);
        assert!(!d4.swallow);
        assert!(!d4.fire);
    }

    #[test]
    fn test_translate_release_orders() {
        let b = alt_t();
        // T down under Alt → armed
        let (armed, _) =
            translate_swallow_decide(false, &b, 0x54, true, false, false, true, false, false, true, false);
        // Alt-up before T: T still held → must NOT fire
        let (a2, d_alt_up) =
            translate_swallow_decide(armed, &b, 0x12, false, true, false, false, false, false, true, false);
        assert!(!d_alt_up.fire, "must not fire while T still held");
        // now T releases, alt clear → fires
        let (_a3, d_t_up) =
            translate_swallow_decide(a2, &b, 0x54, false, true, false, false, false, false, false, true);
        assert!(d_t_up.fire);
    }

    #[test]
    fn test_translate_fire_clears_armed() {
        let b = alt_t();
        let (armed, _) =
            translate_swallow_decide(false, &b, 0x54, true, false, false, true, false, false, true, false);
        let (armed2, d) =
            translate_swallow_decide(armed, &b, 0x54, false, true, false, false, false, false, false, true);
        assert!(!armed2, "armed must clear on fire");
        assert!(d.fire);
    }

    #[test]
    fn test_translate_unrelated_key_does_nothing() {
        let b = alt_t();
        let (armed, d) =
            translate_swallow_decide(false, &b, 0x41, true, false, false, false, false, false, false, false);
        assert!(!armed);
        assert!(!d.swallow);
        assert!(!d.fire);
    }

    #[test]
    fn test_translate_press_requires_modifiers() {
        let b = alt_t();
        // T down WITHOUT Alt → not a combo press, not armed, not swallowed
        let (armed, d) =
            translate_swallow_decide(false, &b, 0x54, true, false, false, false, false, false, false, false);
        assert!(!armed);
        assert!(!d.swallow);
        assert!(!d.fire);
    }

    #[test]
    fn esc_down_hides_and_consumes_up() {
        let (a, consumed) = translate_overlay_key_decide(0, VK_ESCAPE, true, false, false);
        assert_eq!(a, TranslateOverlayKeyAction::Hide);
        assert_eq!(consumed, VK_ESCAPE);
        // Repeat down while held: swallowed, still consumed.
        let (a2, c2) = translate_overlay_key_decide(consumed, VK_ESCAPE, true, false, false);
        assert_eq!(a2, TranslateOverlayKeyAction::None);
        assert_eq!(c2, VK_ESCAPE);
        // Key-up clears consumed.
        let (a3, c3) = translate_overlay_key_decide(c2, VK_ESCAPE, false, true, false);
        assert_eq!(a3, TranslateOverlayKeyAction::None);
        assert_eq!(c3, 0);
    }

    #[test]
    fn enter_with_result_copies() {
        let (a, consumed) = translate_overlay_key_decide(0, VK_RETURN, true, false, true);
        assert_eq!(a, TranslateOverlayKeyAction::Copy);
        assert_eq!(consumed, VK_RETURN);
        // Enter up clears consumed so the editor is not left in a swallowed state.
        let (_, c2) = translate_overlay_key_decide(consumed, VK_RETURN, false, true, true);
        assert_eq!(c2, 0);
    }

    #[test]
    fn enter_without_result_consumed_but_no_copy() {
        // Enter during loading/error (no result): still consumed so no newline leaks, but the
        // Copy action only fires when a result exists.
        let (a, consumed) = translate_overlay_key_decide(0, VK_RETURN, true, false, false);
        assert_eq!(a, TranslateOverlayKeyAction::None);
        assert_eq!(consumed, VK_RETURN);
        // Repeat down swallowed, still consumed.
        let (a2, c2) = translate_overlay_key_decide(consumed, VK_RETURN, true, false, false);
        assert_eq!(a2, TranslateOverlayKeyAction::None);
        assert_eq!(c2, VK_RETURN);
        // Up clears consumed.
        let (_, c3) = translate_overlay_key_decide(c2, VK_RETURN, false, true, false);
        assert_eq!(c3, 0);
    }

    #[test]
    fn unrelated_key_none() {
        let (a, c) = translate_overlay_key_decide(0, 0x41, true, false, false); // A
        assert_eq!(a, TranslateOverlayKeyAction::None);
        assert_eq!(c, 0);
    }

    #[test]
    fn consumed_swallows_interleaved_keys_until_up() {
        let consumed = VK_RETURN;
        // While Enter is held (consumed), an A key-down is also swallowed/kept consumed.
        let (a, c) = translate_overlay_key_decide(consumed, 0x41, true, false, true);
        assert_eq!(a, TranslateOverlayKeyAction::None);
        assert_eq!(c, VK_RETURN);
        // The held Enter's up clears it.
        let (_, c2) = translate_overlay_key_decide(c, VK_RETURN, false, true, true);
        assert_eq!(c2, 0);
    }
}
