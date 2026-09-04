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

    pub fn matches(&self, vk_code: u32, ctrl: bool, alt: bool, shift: bool, win: bool) -> bool {
        // Standalone modifier keys (Right Alt, Right Ctrl, CapsLock)
        if self.code == 0xA5 { // VK_RMENU
            return vk_code == 0xA5 || (vk_code == 0x12 && alt);
        }
        if self.code == 0xA3 { // VK_RCONTROL
            return vk_code == 0xA3;
        }
        if self.code == 0x14 { // VK_CAPITAL (CapsLock)
            return vk_code == 0x14;
        }

        self.code == vk_code
            && self.ctrl == ctrl
            && self.alt == alt
            && self.shift == shift
            && self.win == win
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HotkeyEvent {
    Pressed,
    Released,
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
}
