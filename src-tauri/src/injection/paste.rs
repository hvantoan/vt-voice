use std::sync::Arc;
use std::time::Duration;
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, HWND};
use windows_sys::Win32::Security::{
    GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
};
use windows_sys::Win32::System::Threading::{
    OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    VK_CONTROL, VK_MENU, VK_SHIFT, VK_V,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

use super::clipboard::{ClipboardError, ClipboardManager};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InjectionResult {
    Inserted,
    TargetElevated,
}

#[derive(Debug, thiserror::Error)]
pub enum InjectionError {
    #[error("Clipboard operation failed: {0}")]
    Clipboard(#[from] ClipboardError),
    #[error("SendInput failed to inject keyboard strokes")]
    SendInputFailed,
}

/// Check if the current foreground window is running elevated (as Administrator)
pub fn is_foreground_elevated() -> bool {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.is_null() {
            return false;
        }

        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return false;
        }

        let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process_handle.is_null() {
            // Target is likely elevated while we are standard user
            return true;
        }

        let mut token: HANDLE = std::ptr::null_mut();
        if OpenProcessToken(process_handle, TOKEN_QUERY, &mut token) == 0 {
            let _ = CloseHandle(process_handle);
            return true;
        }

        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut return_len = 0;
        let success = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut return_len,
        ) != 0;

        let _ = CloseHandle(token);
        let _ = CloseHandle(process_handle);

        if success {
            elevation.TokenIsElevated != 0
        } else {
            false
        }
    }
}

fn make_key_input(vk: u16, is_up: bool) -> INPUT {
    let mut flags = 0;
    if is_up {
        flags |= KEYEVENTF_KEYUP;
    }

    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

/// Send simulated Ctrl+V keyboard paste via SendInput
pub fn synthesize_ctrl_v() -> Result<(), InjectionError> {
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

        std::thread::sleep(Duration::from_millis(5));

        let paste_inputs = [
            make_key_input(VK_CONTROL, false),
            make_key_input(VK_V, false),
            make_key_input(VK_V, true),
            make_key_input(VK_CONTROL, true),
        ];

        let sent = SendInput(
            paste_inputs.len() as u32,
            paste_inputs.as_ptr() as *mut _,
            std::mem::size_of::<INPUT>() as i32,
        );

        if sent != paste_inputs.len() as u32 {
            return Err(InjectionError::SendInputFailed);
        }
    }

    Ok(())
}

/// High-level text insertion engine
pub async fn inject_text_at_cursor(
    clipboard: Arc<ClipboardManager>,
    text: &str,
) -> Result<InjectionResult, InjectionError> {
    if text.trim().is_empty() {
        return Ok(InjectionResult::Inserted);
    }

    let (original_snapshot, original_seq) = clipboard.snapshot_text();
    clipboard.set_text_transient(text)?;

    if is_foreground_elevated() {
        return Ok(InjectionResult::TargetElevated);
    }

    synthesize_ctrl_v()?;

    let clipboard_clone = Arc::clone(&clipboard);
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(250)).await;
        clipboard_clone.restore_text(original_snapshot, original_seq);
    });

    Ok(InjectionResult::Inserted)
}
