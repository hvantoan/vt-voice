use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use crossbeam_channel::Sender;
use parking_lot::Mutex;
use windows_sys::Win32::Foundation::{HMODULE, LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::Threading::GetCurrentThreadId;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_CONTROL, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_LWIN, VK_MENU,
    VK_RCONTROL, VK_RMENU, VK_RSHIFT, VK_RWIN, VK_SHIFT,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, HHOOK, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP,
    WM_QUIT, WM_SYSKEYDOWN, WM_SYSKEYUP, WM_USER,
};

use super::types::{HotkeyEvent, HotkeyMode, KeyBinding};

const WM_HOTKEY_EVENT: u32 = WM_USER + 1;

#[repr(C)]
#[derive(Clone, Copy)]
pub struct KbdLlHookStruct {
    pub vk_code: u32,
    pub scan_code: u32,
    pub flags: u32,
    pub time: u32,
    pub extra_info: usize,
}

static CURRENT_BINDING: Mutex<Option<KeyBinding>> = Mutex::new(None);
static CURRENT_MODE: Mutex<HotkeyMode> = Mutex::new(HotkeyMode::PushToTalk);
static IS_HELD: AtomicBool = AtomicBool::new(false);
static IS_TOGGLED_ON: AtomicBool = AtomicBool::new(false);
static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);

#[derive(Debug, thiserror::Error)]
pub enum HookError {
    #[error("Failed to install Windows keyboard hook")]
    InstallFailed,
    #[error("Hook thread not running")]
    ThreadNotRunning,
}

unsafe extern "system" fn low_level_keyboard_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code >= 0 && lparam != 0 {
        let kbd = *(lparam as *const KbdLlHookStruct);
        let msg = wparam as u32;

        let is_down = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
        let is_up = msg == WM_KEYUP || msg == WM_SYSKEYUP;

        let mut vk = kbd.vk_code;
        let is_extended = (kbd.flags & 0x01) != 0;

        if vk == VK_MENU as u32 {
            vk = if is_extended {
                VK_RMENU as u32
            } else {
                VK_LMENU as u32
            };
        } else if vk == VK_CONTROL as u32 {
            vk = if is_extended {
                VK_RCONTROL as u32
            } else {
                VK_LCONTROL as u32
            };
        }

        let ctrl = (GetAsyncKeyState(VK_CONTROL as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_LCONTROL as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_RCONTROL as i32) as u16 & 0x8000) != 0;

        let alt = (GetAsyncKeyState(VK_MENU as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_LMENU as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_RMENU as i32) as u16 & 0x8000) != 0;

        let shift = (GetAsyncKeyState(VK_SHIFT as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_LSHIFT as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_RSHIFT as i32) as u16 & 0x8000) != 0;

        let win = (GetAsyncKeyState(VK_LWIN as i32) as u16 & 0x8000) != 0
            || (GetAsyncKeyState(VK_RWIN as i32) as u16 & 0x8000) != 0;

        let binding_opt = CURRENT_BINDING.lock().clone();
        if let Some(binding) = binding_opt {
            if binding.matches(vk, ctrl, alt, shift, win) {
                let mode = *CURRENT_MODE.lock();
                let thread_id = HOOK_THREAD_ID.load(Ordering::SeqCst);

                if thread_id != 0 {
                    match mode {
                        HotkeyMode::PushToTalk => {
                            if is_down && !IS_HELD.load(Ordering::SeqCst) {
                                IS_HELD.store(true, Ordering::SeqCst);
                                // 1 = Pressed
                                PostThreadMessageW(thread_id, WM_HOTKEY_EVENT, 1, 0);
                            } else if is_up && IS_HELD.load(Ordering::SeqCst) {
                                IS_HELD.store(false, Ordering::SeqCst);
                                // 2 = Released
                                PostThreadMessageW(thread_id, WM_HOTKEY_EVENT, 2, 0);
                            }
                        }
                        HotkeyMode::Toggle => {
                            if is_down && !IS_HELD.load(Ordering::SeqCst) {
                                IS_HELD.store(true, Ordering::SeqCst);
                                let currently_on = IS_TOGGLED_ON.load(Ordering::SeqCst);
                                if currently_on {
                                    IS_TOGGLED_ON.store(false, Ordering::SeqCst);
                                    PostThreadMessageW(thread_id, WM_HOTKEY_EVENT, 2, 0);
                                } else {
                                    IS_TOGGLED_ON.store(true, Ordering::SeqCst);
                                    PostThreadMessageW(thread_id, WM_HOTKEY_EVENT, 1, 0);
                                }
                            } else if is_up {
                                IS_HELD.store(false, Ordering::SeqCst);
                            }
                        }
                    }
                }
            }
        }
    }

    CallNextHookEx(0 as HHOOK, code, wparam, lparam)
}

pub struct HotkeyManager {
    thread_handle: Option<JoinHandle<()>>,
    is_running: Arc<AtomicBool>,
}

impl HotkeyManager {
    pub fn new() -> Self {
        Self {
            thread_handle: None,
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(
        &mut self,
        binding: KeyBinding,
        mode: HotkeyMode,
        sender: Sender<HotkeyEvent>,
    ) -> Result<(), HookError> {
        *CURRENT_BINDING.lock() = Some(binding);
        *CURRENT_MODE.lock() = mode;
        IS_HELD.store(false, Ordering::SeqCst);
        IS_TOGGLED_ON.store(false, Ordering::SeqCst);

        let running_flag = Arc::clone(&self.is_running);
        running_flag.store(true, Ordering::SeqCst);

        let handle = thread::spawn(move || unsafe {
            let thread_id = GetCurrentThreadId();
            HOOK_THREAD_ID.store(thread_id, Ordering::SeqCst);

            let hook: HHOOK = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(low_level_keyboard_proc),
                0 as HMODULE,
                0,
            );

            if hook.is_null() {
                eprintln!("[HotkeyManager] Failed to set hook");
                running_flag.store(false, Ordering::SeqCst);
                return;
            }

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, 0 as _, 0, 0) > 0 {
                if msg.message == WM_QUIT {
                    break;
                }
                if msg.message == WM_HOTKEY_EVENT {
                    let event = if msg.wParam == 1 {
                        HotkeyEvent::Pressed
                    } else {
                        HotkeyEvent::Released
                    };
                    let _ = sender.try_send(event);
                }
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            if !hook.is_null() {
                UnhookWindowsHookEx(hook);
            }
            running_flag.store(false, Ordering::SeqCst);
        });

        self.thread_handle = Some(handle);
        Ok(())
    }

    pub fn update_config(&self, binding: KeyBinding, mode: HotkeyMode) {
        *CURRENT_BINDING.lock() = Some(binding);
        *CURRENT_MODE.lock() = mode;
        IS_HELD.store(false, Ordering::SeqCst);
        IS_TOGGLED_ON.store(false, Ordering::SeqCst);
    }

    pub fn stop(&mut self) {
        let thread_id = HOOK_THREAD_ID.load(Ordering::SeqCst);
        if thread_id != 0 {
            unsafe {
                PostThreadMessageW(thread_id, WM_QUIT, 0, 0);
            }
        }
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
        self.is_running.store(false, Ordering::SeqCst);
    }
}

impl Drop for HotkeyManager {
    fn drop(&mut self) {
        self.stop();
    }
}
