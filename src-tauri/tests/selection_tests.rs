//! Regression tests for Phase 2 selection capture (clipboard guard).
//!
//! The pure decision `should_restore` — never restore a `None` original (it would empty a
//! non-text clipboard) — is unit-tested here. Live clipboard capture requires a GUI foreground
//! window and is verified manually in Phase 5.

use vt_voice_lib::injection::should_restore;

#[test]
fn should_restore_true_when_original_had_text() {
    let original = Some("some text".encode_utf16().collect::<Vec<u16>>());
    assert!(should_restore(&original));
}

#[test]
fn should_restore_false_when_original_had_no_text() {
    // Non-text clipboard (image/file/HTML-only): snapshot returned None → must NOT restore,
    // otherwise `restore_text(None)` would EmptyClipboard and destroy the held image/file.
    assert!(!should_restore(&None));
}
