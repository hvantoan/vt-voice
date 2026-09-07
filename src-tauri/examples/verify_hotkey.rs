#![allow(dead_code)]
#[path = "../src/hotkey/types.rs"]
mod types;

use types::KeyBinding;

fn main() {
    println!("=== Testing Full Hotkey Logic: Any Single Key & Any Combo ===");

    // 1. Single regular keys
    let f2 = KeyBinding::new_single(0x71, "F2");
    assert!(!f2.is_combo());
    assert!(f2.matches_press(0x71, false, false, false, false));
    assert!(f2.matches_release(0x71));
    println!("✓ Single key F2: PASS");

    let space = KeyBinding::new_single(0x20, "Space");
    assert!(!space.is_combo());
    assert!(space.matches_press(0x20, false, false, false, false));
    assert!(space.matches_release(0x20));
    println!("✓ Single key Space: PASS");

    // 2. Single modifier keys
    let right_alt = KeyBinding::default(); // 0xA5
    assert!(!right_alt.is_combo());
    assert!(right_alt.matches_press(0xA5, false, true, false, false));
    assert!(right_alt.matches_press(0x12, false, true, false, false));
    assert!(right_alt.matches_release(0xA5));
    println!("✓ Single key Right Alt: PASS");

    let left_alt = KeyBinding::new_single(0xA4, "Left Alt");
    assert!(!left_alt.is_combo());
    assert!(left_alt.matches_press(0xA4, false, true, false, false));
    assert!(left_alt.matches_release(0xA4));
    println!("✓ Single key Left Alt: PASS");

    let left_ctrl = KeyBinding::new_single(0xA2, "Left Ctrl");
    assert!(!left_ctrl.is_combo());
    assert!(left_ctrl.matches_press(0xA2, true, false, false, false));
    assert!(left_ctrl.matches_release(0xA2));
    println!("✓ Single key Left Ctrl: PASS");

    let right_ctrl = KeyBinding::new_single(0xA3, "Right Ctrl");
    assert!(!right_ctrl.is_combo());
    assert!(right_ctrl.matches_press(0xA3, true, false, false, false));
    assert!(right_ctrl.matches_release(0xA3));
    println!("✓ Single key Right Ctrl: PASS");

    let left_shift = KeyBinding::new_single(0xA0, "Left Shift");
    assert!(!left_shift.is_combo());
    assert!(left_shift.matches_press(0xA0, false, false, true, false));
    assert!(left_shift.matches_release(0xA0));
    println!("✓ Single key Left Shift: PASS");

    let capslock = KeyBinding::new_single(0x14, "CapsLock");
    assert!(!capslock.is_combo());
    assert!(capslock.matches_press(0x14, false, false, false, false));
    assert!(capslock.matches_release(0x14));
    println!("✓ Single key CapsLock: PASS");

    // 3. Single mouse buttons
    let mouse4 = KeyBinding::new_single(0x05, "Mouse 4");
    assert!(mouse4.is_mouse());
    assert!(!mouse4.is_combo());
    assert!(mouse4.matches_press(0x05, false, false, false, false));
    assert!(mouse4.matches_release(0x05));
    println!("✓ Single mouse button Mouse 4: PASS");

    let mouse5 = KeyBinding::new_single(0x06, "Mouse 5");
    assert!(mouse5.is_mouse());
    assert!(!mouse5.is_combo());
    assert!(mouse5.matches_press(0x06, false, false, false, false));
    assert!(mouse5.matches_release(0x06));
    println!("✓ Single mouse button Mouse 5: PASS");

    // 4. Combos (modifier + key)
    let ctrl_space = KeyBinding {
        code: 0x20,
        name: "Ctrl+Space".to_string(),
        ctrl: true,
        alt: false,
        shift: false,
        win: false,
    };
    assert!(ctrl_space.is_combo());
    assert!(ctrl_space.matches_press(0x20, true, false, false, false));
    assert!(!ctrl_space.matches_press(0x20, false, false, false, false));
    assert!(ctrl_space.matches_release(0x20));
    assert!(ctrl_space.matches_release(0xA2)); // VK_LCONTROL
    println!("✓ Combo Ctrl+Space: PASS");

    // 5. Combos (modifier + mouse button)
    let ctrl_mouse4 = KeyBinding {
        code: 0x05,
        name: "Ctrl + Mouse 4".to_string(),
        ctrl: true,
        alt: false,
        shift: false,
        win: false,
    };
    assert!(ctrl_mouse4.is_combo());
    assert!(ctrl_mouse4.is_mouse());
    assert!(ctrl_mouse4.matches_press(0x05, true, false, false, false));
    assert!(ctrl_mouse4.matches_release(0x05));
    assert!(ctrl_mouse4.matches_release(0xA2));
    println!("✓ Combo Ctrl + Mouse 4: PASS");

    // 6. Verify real should_reset_hotkey_state function (avoids resetting active recording on unrelated autosaves)
    {
        use types::{should_reset_hotkey_state, HotkeyMode};

        let current_binding = ctrl_mouse4.clone();
        let same_binding = ctrl_mouse4.clone();
        let different_binding = KeyBinding::default();

        // 6.1 Identical binding & identical mode -> should NOT reset state
        assert!(
            !should_reset_hotkey_state(
                Some(&current_binding),
                &same_binding,
                HotkeyMode::PushToTalk,
                HotkeyMode::PushToTalk
            ),
            "Unchanged hotkey config must not reset active hotkey state"
        );

        // 6.2 Changed mode -> MUST reset state
        assert!(
            should_reset_hotkey_state(
                Some(&current_binding),
                &same_binding,
                HotkeyMode::PushToTalk,
                HotkeyMode::Toggle
            ),
            "Changing hotkey mode must reset active hotkey state"
        );

        // 6.3 Changed binding -> MUST reset state
        assert!(
            should_reset_hotkey_state(
                Some(&current_binding),
                &different_binding,
                HotkeyMode::PushToTalk,
                HotkeyMode::PushToTalk
            ),
            "Changing key binding must reset active hotkey state"
        );

        // 6.4 Initial state (no current binding) -> MUST reset/initialize state
        assert!(
            should_reset_hotkey_state(
                None,
                &current_binding,
                HotkeyMode::PushToTalk,
                HotkeyMode::PushToTalk
            ),
            "Initial hotkey config must reset/initialize state"
        );

        println!("✓ Real should_reset_hotkey_state logic: PASS");
    }

    println!("\nALL 13 TESTS PASSED! Both ANY single key, ANY combination, and state preservation are fully verified!");
}
