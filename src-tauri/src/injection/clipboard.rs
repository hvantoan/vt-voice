use std::thread;
use std::time::Duration;
use windows_sys::Win32::Foundation::{HANDLE, HGLOBAL, HWND};
use windows_sys::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, GetClipboardSequenceNumber,
    OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
};
use windows_sys::Win32::System::Memory::{
    GlobalAlloc, GlobalLock, GlobalUnlock, GHND,
};

const CF_UNICODETEXT: u32 = 13;

#[derive(Debug, thiserror::Error)]
pub enum ClipboardError {
    #[error("Failed to open Windows clipboard after multiple retries")]
    OpenFailed,
    #[error("Failed to allocate global memory")]
    AllocFailed,
    #[error("Failed to lock global memory")]
    LockFailed,
    #[error("Failed to set clipboard data")]
    SetDataFailed,
}

pub struct ClipboardManager {
    exclude_format: u32,
}

impl ClipboardManager {
    pub fn new() -> Self {
        let name: Vec<u16> = "ExcludeClipboardContentFromMonitorProcessing\0"
            .encode_utf16()
            .collect();
        let exclude_format = unsafe { RegisterClipboardFormatW(name.as_ptr()) };
        Self { exclude_format }
    }

    /// Try to open clipboard with exponential backoff retries
    fn open_clipboard_with_retry(&self) -> bool {
        let mut delay_ms = 5;
        for _ in 0..5 {
            if unsafe { OpenClipboard(0 as HWND) } != 0 {
                return true;
            }
            thread::sleep(Duration::from_millis(delay_ms));
            delay_ms *= 2;
        }
        false
    }

    /// Snapshot current clipboard text (CF_UNICODETEXT) and sequence number
    pub fn snapshot_text(&self) -> (Option<Vec<u16>>, u32) {
        let seq = unsafe { GetClipboardSequenceNumber() };

        if !self.open_clipboard_with_retry() {
            return (None, seq);
        }

        let mut result = None;
        unsafe {
            let handle = GetClipboardData(CF_UNICODETEXT);
            if !handle.is_null() {
                let ptr = GlobalLock(handle as HGLOBAL) as *const u16;
                if !ptr.is_null() {
                    let mut len = 0;
                    while *ptr.add(len) != 0 {
                        len += 1;
                    }
                    let slice = std::slice::from_raw_parts(ptr, len);
                    result = Some(slice.to_vec());
                    let _ = GlobalUnlock(handle as HGLOBAL);
                }
            }
            let _ = CloseClipboard();
        }

        (result, seq)
    }

    /// Write text to clipboard, marking it with ExcludeClipboardContentFromMonitorProcessing
    pub fn set_text_transient(&self, text: &str) -> Result<(), ClipboardError> {
        if !self.open_clipboard_with_retry() {
            return Err(ClipboardError::OpenFailed);
        }

        let utf16: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
        let bytes_len = utf16.len() * std::mem::size_of::<u16>();

        unsafe {
            let _ = EmptyClipboard();

            let h_mem = GlobalAlloc(GHND, bytes_len);
            if h_mem.is_null() {
                let _ = CloseClipboard();
                return Err(ClipboardError::AllocFailed);
            }

            let ptr = GlobalLock(h_mem) as *mut u16;
            if ptr.is_null() {
                let _ = CloseClipboard();
                return Err(ClipboardError::LockFailed);
            }

            std::ptr::copy_nonoverlapping(utf16.as_ptr(), ptr, utf16.len());
            let _ = GlobalUnlock(h_mem);

            if SetClipboardData(CF_UNICODETEXT, h_mem as HANDLE).is_null() {
                let _ = CloseClipboard();
                return Err(ClipboardError::SetDataFailed);
            }

            // Also tag with ExcludeClipboardContentFromMonitorProcessing to prevent Win+V clutter
            if self.exclude_format != 0 {
                let h_flag = GlobalAlloc(GHND, 4);
                if !h_flag.is_null() {
                    let flag_ptr = GlobalLock(h_flag) as *mut u32;
                    if !flag_ptr.is_null() {
                        *flag_ptr = 1;
                        let _ = GlobalUnlock(h_flag);
                        let _ = SetClipboardData(self.exclude_format, h_flag as HANDLE);
                    }
                }
            }

            let _ = CloseClipboard();
        }

        Ok(())
    }

    /// Restore previously snapshotted text if the clipboard sequence hasn't been changed by the user
    pub fn restore_text(&self, snapshotted_utf16: Option<Vec<u16>>, original_seq: u32) {
        let current_seq = unsafe { GetClipboardSequenceNumber() };
        if current_seq > original_seq + 1 {
            return;
        }

        let utf16 = match snapshotted_utf16 {
            Some(u) => u,
            None => {
                if self.open_clipboard_with_retry() {
                    unsafe {
                        let _ = EmptyClipboard();
                        let _ = CloseClipboard();
                    }
                }
                return;
            }
        };

        if !self.open_clipboard_with_retry() {
            return;
        }

        let mut with_null = utf16;
        with_null.push(0);
        let bytes_len = with_null.len() * std::mem::size_of::<u16>();

        unsafe {
            let _ = EmptyClipboard();
            let h_mem = GlobalAlloc(GHND, bytes_len);
            if !h_mem.is_null() {
                let ptr = GlobalLock(h_mem) as *mut u16;
                if !ptr.is_null() {
                    std::ptr::copy_nonoverlapping(with_null.as_ptr(), ptr, with_null.len());
                    let _ = GlobalUnlock(h_mem);
                    let _ = SetClipboardData(CF_UNICODETEXT, h_mem as HANDLE);
                }
            }
            let _ = CloseClipboard();
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clipboard_manager_creation() {
        let manager = ClipboardManager::new();
        assert!(manager.exclude_format > 0);
    }

    #[test]
    fn test_transient_write_and_snapshot() {
        let manager = ClipboardManager::new();
        let test_str = "vt-voice-test-clipboard-transient";
        
        let (orig_text, orig_seq) = manager.snapshot_text();
        let write_res = manager.set_text_transient(test_str);
        assert!(write_res.is_ok());

        let (new_text, _) = manager.snapshot_text();
        if let Some(utf16) = new_text {
            let read_back = String::from_utf16_lossy(&utf16);
            assert_eq!(read_back, test_str);
        }

        // Restore original
        manager.restore_text(orig_text, orig_seq);
    }
}
