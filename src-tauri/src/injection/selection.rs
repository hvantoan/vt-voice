use std::sync::Arc;
use std::time::{Duration, Instant};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    VK_CONTROL, VK_C, VK_MENU, VK_SHIFT,
};
use windows_sys::Win32::System::DataExchange::GetClipboardSequenceNumber;

use super::clipboard::{ClipboardError, ClipboardManager};
use super::paste::is_foreground_elevated;

/// Outcome of a selection-capture attempt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SelectionResult {
    /// Text captured and the original (text-only) clipboard restored.
    Captured { text: String },
    /// Foreground app is elevated; capture blocked by UIPI.
    TargetElevated,
    /// No selectable text was captured (copy produced no change / timed out / empty).
    EmptySelection,
}

#[derive(Debug, thiserror::Error)]
pub enum SelectionError {
    #[error("Clipboard operation failed: {0}")]
    Clipboard(#[from] ClipboardError),
    #[error("SendInput failed to inject copy keystrokes")]
    SendInputFailed,
}

fn make_key_input(vk: u16, is_up: bool) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: if is_up { KEYEVENTF_KEYUP } else { 0 },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

/// Synthesize a physical Ctrl+C (with modifier key-ups so a held modifier is not stuck).
fn synthesize_ctrl_c() -> Result<(), SelectionError> {
    unsafe {
        let release_modifiers = [
            make_key_input(VK_CONTROL, true),
            make_key_input(VK_MENU, true),
            make_key_input(VK_SHIFT, true),
        ];
        let _ = SendInput(
            release_modifiers.len() as u32,
            release_modifiers.as_ptr() as *mut _,
            std::mem::size_of::<INPUT>() as i32,
        );

        let copy_inputs = [
            make_key_input(VK_CONTROL, false),
            make_key_input(VK_C, false),
            make_key_input(VK_C, true),
            make_key_input(VK_CONTROL, true),
        ];

        let sent = SendInput(
            copy_inputs.len() as u32,
            copy_inputs.as_ptr() as *mut _,
            std::mem::size_of::<INPUT>() as i32,
        );

        if sent != copy_inputs.len() as u32 {
            return Err(SelectionError::SendInputFailed);
        }
    }

    Ok(())
}

/// A non-empty original clipboard text should be restored after capture; a non-text clipboard
/// (image/file/HTML-only) must be left alone — restoring `None` would `EmptyClipboard` and destroy
/// it. Pure so it is unit-testable without a real clipboard.
pub fn should_restore(original_clip: &Option<Vec<u16>>) -> bool {
    original_clip.is_some()
}

/// Capture the currently selected text by snapshotting the clipboard, sending Ctrl+C, reading the
/// new text, then restoring the original clipboard. Never empties a non-text clipboard.
///
/// `ponytail:` upgrade path: rich content (HTML/RTF/images) is not preserved — only
/// `CF_UNICODETEXT` is snapshotted/restored. Add `EnumClipboardFormats` + hold `HGLOBAL` per format
/// when preserving rich media matters.
pub async fn capture_selected_text(
    clipboard: Arc<ClipboardManager>,
) -> Result<SelectionResult, SelectionError> {
    if is_foreground_elevated() {
        return Ok(SelectionResult::TargetElevated);
    }

    let (original_clip, original_seq) = clipboard.snapshot_text();
    let seq_before = unsafe { GetClipboardSequenceNumber() };

    synthesize_ctrl_c()?;

    // Poll for the target app's own Ctrl+C to land on the clipboard.
    let deadline = Instant::now() + Duration::from_millis(120);
    loop {
        if unsafe { GetClipboardSequenceNumber() } != seq_before {
            break;
        }
        if Instant::now() >= deadline {
            return Ok(SelectionResult::EmptySelection);
        }
        tokio::time::sleep(Duration::from_millis(5)).await;
    }

    let (new_text, _) = clipboard.snapshot_text();

    // Restore only if the original clipboard held text. Otherwise skip — restoring `None` would
    // empty a non-text clipboard (image/file) the user may be holding.
    if should_restore(&original_clip) {
        if let Some(orig) = original_clip {
            clipboard.restore_text(Some(orig), original_seq);
        }
    }

    match new_text {
        Some(utf16) => {
            let text = String::from_utf16_lossy(&utf16).trim().to_string();
            if text.is_empty() {
                return Ok(SelectionResult::EmptySelection);
            }
            Ok(SelectionResult::Captured { text })
        }
        None => Ok(SelectionResult::EmptySelection),
    }
}
