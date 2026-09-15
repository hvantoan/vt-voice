//! Regression tests for the multi-binding hotkey refactor (Phase 1).
//!
//! These exercise the pure decision helpers exported from `hotkey::types`, which is where the
//! swallow/arm/fire logic lives. True `WH_KEYBOARD_LL` swallow requires a running window; the
//! hook's `return 1` is a thin wrapper over this decision.

use vt_voice_lib::hotkey::{
    translate_swallow_decide, HotkeyAction, HotkeyEvent, HotkeyMode, HotkeyRegistry, KeyBinding,
};

fn alt_t() -> KeyBinding {
    KeyBinding {
        code: 0x54,
        name: "Alt+T".to_string(),
        ctrl: false,
        alt: true,
        shift: false,
        win: false,
    }
}

#[test]
fn registry_holds_two_actions() {
    let reg = HotkeyRegistry {
        stt_binding: Some(KeyBinding::default()),
        stt_mode: HotkeyMode::PushToTalk,
        translate_binding: Some(alt_t()),
    };
    assert_eq!(reg.stt_mode, HotkeyMode::PushToTalk);
    assert!(reg.translate_binding.is_some());
    // Serde round-trips so config save/load is lossless.
    let json = serde_json::to_string(&reg).unwrap();
    let back: HotkeyRegistry = serde_json::from_str(&json).unwrap();
    assert_eq!(back, reg);
}

#[test]
fn stt_binding_not_swallowed() {
    // STT is a single Right-Alt push-to-talk. The translate binding is Alt+T, so a bare Right-Alt
    // key event (the STT key, not part of the translate combo) must never arm or swallow it.
    // The real STT-swallow guard lives in dispatch (the STT branch always falls through to
    // CallNextHookEx and never calls translate_swallow_decide); here we assert the helper itself
    // stays inert for a Right-Alt event against the combo translate binding.
    let b = alt_t();
    let (armed, d) =
        translate_swallow_decide(false, &b, 0xA5, true, false, false, false, false, false, true, false);
    assert!(!armed);
    assert!(!d.swallow);
    assert!(!d.fire);
}

#[test]
fn translate_main_key_swallowed_down_and_up() {
    let b = alt_t();
    let (armed, down) =
        translate_swallow_decide(false, &b, 0x54, true, false, false, true, false, false, true, false);
    assert!(armed);
    assert!(down.swallow);
    let (_after, up) =
        translate_swallow_decide(armed, &b, 0x54, false, true, false, false, false, false, false, true);
    assert!(up.swallow);
}

#[test]
fn translate_modifiers_never_swallowed() {
    let b = alt_t();
    // Alt down and Alt up both pass through.
    let (_a, alt_down) =
        translate_swallow_decide(false, &b, 0x12, true, false, false, true, false, false, false, false);
    let (_a, alt_up) =
        translate_swallow_decide(false, &b, 0x12, false, true, false, false, false, false, false, false);
    assert!(!alt_down.swallow);
    assert!(!alt_up.swallow);
}

#[test]
fn combo_fires_once_on_full_release() {
    let b = alt_t();
    let (armed, _) =
        translate_swallow_decide(false, &b, 0x54, true, false, false, true, false, false, true, false);
    let (a2, alt_up_first) =
        translate_swallow_decide(armed, &b, 0x12, false, true, false, false, false, false, true, false);
    // Alt released before T: T still held → must NOT fire.
    assert!(!alt_up_first.fire);
    // Now T releases → fires once, and a follow-up event must not fire again (armed cleared).
    let (a3, t_up) =
        translate_swallow_decide(a2, &b, 0x54, false, true, false, false, false, false, false, true);
    assert!(t_up.fire);
    let (_a4, again) =
        translate_swallow_decide(a3, &b, 0x54, false, true, false, false, false, false, false, true);
    assert!(!again.fire, "fired exactly once; subsequent releases do not re-fire");
}

#[test]
fn unrelated_keys_do_nothing() {
    let b = alt_t();
    let (armed, d) =
        translate_swallow_decide(false, &b, 0x41, true, false, false, false, false, false, false, false);
    assert!(!armed);
    assert!(!d.swallow);
    assert!(!d.fire);
}

#[test]
fn actions_are_distinct_events() {
    // STT Pressed/Released vs TranslateTrigger are separate variants, so the rx loop can fan out.
    assert_ne!(HotkeyEvent::TranslateTrigger, HotkeyEvent::Pressed);
    assert_ne!(HotkeyEvent::TranslateTrigger, HotkeyEvent::Released);
    let _ = HotkeyAction::SttPushToTalk;
    let _ = HotkeyAction::SttToggle;
    let _ = HotkeyAction::Translate;
}
