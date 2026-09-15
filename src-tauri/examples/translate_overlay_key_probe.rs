//! Runtime proof of the pure overlay-key decision helper, compiled standalone from types.rs
//! (like examples/verify_hotkey.rs) so it produces a small binary that actually loads in this
//! environment — linking the full vt_voice_lib (tauri stack) yields console exes that abort with
//! 0xC0000139. Run: `cargo run --example translate_overlay_key_probe`.

#![allow(dead_code)]
#[path = "../src/hotkey/types.rs"]
mod types;

use types::{
    translate_overlay_key_decide, TranslateOverlayKeyAction, VK_ESCAPE, VK_RETURN,
};

fn main() {
    let mut failed = 0u32;
    let mut check = |name: &str, cond: bool| {
        println!("{:<34} {}", name, if cond { "PASS" } else { "FAIL" });
        if !cond {
            failed += 1;
        }
    };

    // Esc down → Hide + consume.
    let (a, c) = translate_overlay_key_decide(0, VK_ESCAPE, true, false, false);
    check("esc down => Hide, consume", a == TranslateOverlayKeyAction::Hide && c == VK_ESCAPE);

    // Esc repeat down while held → swallowed, still consumed.
    let (a2, c2) = translate_overlay_key_decide(c, VK_ESCAPE, true, false, false);
    check("esc repeat => None, still consumed", a2 == TranslateOverlayKeyAction::None && c2 == VK_ESCAPE);

    // Esc up → clears consumed (and is the "swallow the up" event).
    let (a3, c3) = translate_overlay_key_decide(c2, VK_ESCAPE, false, true, false);
    check("esc up => clear consumed", a3 == TranslateOverlayKeyAction::None && c3 == 0);

    // Enter down with result → Copy + consume.
    let (b, d) = translate_overlay_key_decide(0, VK_RETURN, true, false, true);
    check("enter down (has result) => Copy, consume",
        b == TranslateOverlayKeyAction::Copy && d == VK_RETURN);

    // Enter down without result → consumed (no newline leak) but no Copy action.
    let (b2, d2) = translate_overlay_key_decide(0, VK_RETURN, true, false, false);
    check("enter down (no result) => consumed, no Copy",
        b2 == TranslateOverlayKeyAction::None && d2 == VK_RETURN);

    // Unrelated key while visible → None.
    let (_, d3) = translate_overlay_key_decide(0, 0x41, true, false, false); // A
    check("unrelated key => None", d3 == 0);

    // Interleaved key while Enter consumed → swallowed, kept consumed.
    let (i, ic) = translate_overlay_key_decide(VK_RETURN, 0x41, true, false, true);
    check("interleaved key under consumed => swallowed",
        i == TranslateOverlayKeyAction::None && ic == VK_RETURN);

    println!("\n{} failures", failed);
    std::process::exit(if failed == 0 { 0 } else { 1 });
}
