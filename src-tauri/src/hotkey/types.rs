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
}
