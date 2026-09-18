use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicU32, Ordering};
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
    CallNextHookEx, DispatchMessageW, GetForegroundWindow, GetMessageW, GetWindowThreadProcessId,
    PostThreadMessageW, SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, HHOOK, MSG,
    WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_KEYUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_QUIT,
    WM_SYSKEYDOWN, WM_SYSKEYUP, WM_USER, WM_XBUTTONDOWN, WM_XBUTTONUP,
};

use super::types::{
    should_reset_hotkey_state, translate_overlay_key_decide, translate_swallow_decide, HotkeyEvent,
    HotkeyMode, KeyBinding, TranslateOverlayKeyAction,
};

const WM_HOTKEY_EVENT: u32 = WM_USER + 1;
const WM_HOTKEY_TRANSLATE: usize = 3;
const WM_HOTKEY_TRANSLATE_HIDE: usize = 4;
const WM_HOTKEY_TRANSLATE_COPY: usize = 5;

#[repr(C)]
#[derive(Clone, Copy)]
pub struct KbdLlHookStruct {
    pub vk_code: u32,
    pub scan_code: u32,
    pub flags: u32,
    pub time: u32,
    pub extra_info: usize,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct MsLlHookStruct {
    pub pt_x: i32,
    pub pt_y: i32,
    pub mouse_data: u32,
    pub flags: u32,
    pub time: u32,
    pub extra_info: usize,
}

// Single hook thread, single set of statics. STT and translate share the thread but each has its
// own binding slot; hold/toggle flags remain STT-only. Do NOT add a second HotkeyManager.
static STT_BINDING: Mutex<Option<KeyBinding>> = Mutex::new(None);
static STT_MODE: Mutex<HotkeyMode> = Mutex::new(HotkeyMode::PushToTalk);
static TRANSLATE_BINDING: Mutex<Option<KeyBinding>> = Mutex::new(None);
static TRANSLATE_ARMED: AtomicBool = AtomicBool::new(false);
/// True while the translate popover is showing; only then are Esc/Enter swallowed.
static TRANSLATE_VISIBLE: AtomicBool = AtomicBool::new(false);
/// Last translated text, for the Enter/Copy path (set by the pipeline on success).
static TRANSLATE_LAST_RESULT: Mutex<Option<String>> = Mutex::new(None);
/// Virtual-key currently consumed by the popover key-gate (so its up, and repeats/interleaved
/// keys while held, are swallowed too — otherwise a held Enter types newlines into the editor).
static TRANSLATE_CONSUMED_KEY: AtomicU32 = AtomicU32::new(0);
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

unsafe fn handle_stt_input_event(
    binding: &KeyBinding,
    vk: u32,
    is_down: bool,
    is_up: bool,
    ctrl: bool,
    alt: bool,
    shift: bool,
    win: bool,
) {
    let mode = *STT_MODE.lock();
    let thread_id = HOOK_THREAD_ID.load(Ordering::SeqCst);
    if thread_id == 0 {
        return;
    }

    match mode {
        HotkeyMode::PushToTalk => {
            if is_down && !IS_HELD.load(Ordering::SeqCst) {
                if binding.matches_press(vk, ctrl, alt, shift, win) {
                    IS_HELD.store(true, Ordering::SeqCst);
                    // 1 = Pressed
                    PostThreadMessageW(thread_id, WM_HOTKEY_EVENT, 1, 0);
                }
            } else if is_up && IS_HELD.load(Ordering::SeqCst) {
                if binding.matches_release(vk) {
                    IS_HELD.store(false, Ordering::SeqCst);
                    // 2 = Released
                    PostThreadMessageW(thread_id, WM_HOTKEY_EVENT, 2, 0);
                }
            }
        }
        HotkeyMode::Toggle => {
            if is_down && !IS_HELD.load(Ordering::SeqCst) {
                if binding.matches_press(vk, ctrl, alt, shift, win) {
                    IS_HELD.store(true, Ordering::SeqCst);
                    let currently_on = IS_TOGGLED_ON.load(Ordering::SeqCst);
                    if currently_on {
                        IS_TOGGLED_ON.store(false, Ordering::SeqCst);
                        PostThreadMessageW(thread_id, WM_HOTKEY_EVENT, 2, 0);
                    } else {
                        IS_TOGGLED_ON.store(true, Ordering::SeqCst);
                        PostThreadMessageW(thread_id, WM_HOTKEY_EVENT, 1, 0);
                    }
                }
            } else if is_up && IS_HELD.load(Ordering::SeqCst) {
                if binding.matches_release(vk) {
                    IS_HELD.store(false, Ordering::SeqCst);
                }
            }
        }
    }
}

/// Evaluate one keyboard event against the translate binding. Returns `true` when the event must
/// be swallowed (the main key down/up), posting a `WM_HOTKEY_EVENT` trigger on combo release.
///
/// The event's own key state is taken from the event (`is_down`/`is_up`) because this low-level
/// hook runs *before* that key's asynchronous state is updated, so `GetAsyncKeyState` on `vk`
/// itself would be stale (e.g. at T's own key-up it still reads "down", so the T-last release
/// order would never fire; likewise a modifier's own key-up still reads "down"). Async state is
/// only consulted for the *other* keys in the combo.
fn vk_is_alt(vk: u32) -> bool { matches!(vk, 0x12 | 0xA4 | 0xA5) }
fn vk_is_ctrl(vk: u32) -> bool { matches!(vk, 0x11 | 0xA2 | 0xA3) }
fn vk_is_shift(vk: u32) -> bool { matches!(vk, 0x10 | 0xA0 | 0xA1) }
fn vk_is_win(vk: u32) -> bool { matches!(vk, 0x5B | 0x5C) }

unsafe fn handle_translate_input_event(
    binding: &KeyBinding,
    vk: u32,
    is_down: bool,
    is_up: bool,
    ctrl: bool,
    alt: bool,
    shift: bool,
    win: bool,
) -> bool {
    let thread_id = HOOK_THREAD_ID.load(Ordering::SeqCst);
    if thread_id == 0 {
        return false;
    }

    let armed = TRANSLATE_ARMED.load(Ordering::SeqCst);

    // Main key is "up" iff this event is the main key's own release, or the main key is not the
    // current event and async state reports it up. Never read async state for the event's own key.
    let main_pressed = if binding.code == vk {
        is_down
    } else {
        (GetAsyncKeyState(binding.code as i32) as u16 & 0x8000) != 0
    };

    // Per-modifier held state: trust the event for the modifier that IS this event's own key
    // (async state is stale for it); use async state for the others.
    let ctrl_held = if vk_is_ctrl(vk) { is_down } else { ctrl };
    let alt_held = if vk_is_alt(vk) { is_down } else { alt };
    let shift_held = if vk_is_shift(vk) { is_down } else { shift };
    let win_held = if vk_is_win(vk) { is_down } else { win };

    let mods_up = !(binding.ctrl && ctrl_held)
        && !(binding.alt && alt_held)
        && !(binding.shift && shift_held)
        && !(binding.win && win_held);

    let (new_armed, decision) =
        translate_swallow_decide(armed, binding, vk, is_down, is_up, ctrl, alt, shift, win, main_pressed, mods_up);
    TRANSLATE_ARMED.store(new_armed, Ordering::SeqCst);

    if decision.fire {
        // 3 = TranslateTrigger
        PostThreadMessageW(thread_id, WM_HOTKEY_EVENT, WM_HOTKEY_TRANSLATE, 0);
    }

    decision.swallow
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

            // If foreground window belongs to our own process (e.g. Settings window),
            // bypass hotkey capture & swallowing so the user can freely record hotkeys
            // or type in Settings without triggers or swallowed keystrokes.
            let foreground = GetForegroundWindow();
            if !foreground.is_null() {
                let mut pid: u32 = 0;
                GetWindowThreadProcessId(foreground, &mut pid);
                if pid == std::process::id() {
                    return CallNextHookEx(0 as HHOOK, code, wparam, lparam);
                }
            }

        if is_down || is_up {
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
            } else if vk == VK_SHIFT as u32 {
                vk = if kbd.scan_code == 0x36 {
                    VK_RSHIFT as u32
                } else {
                    VK_LSHIFT as u32
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

            // STT dispatch (unchanged behaviour)
            let stt_binding = STT_BINDING.lock().clone();
            if let Some(binding) = stt_binding {
                handle_stt_input_event(&binding, vk, is_down, is_up, ctrl, alt, shift, win);
            }

            // Translate dispatch; swallow returns 1 (block the event) so Alt+T never reaches the
            // foreground app's menu accelerator. Only a matched main-key is ever swallowed.
            let translate_binding = TRANSLATE_BINDING.lock().clone();
            if let Some(binding) = translate_binding {
                if handle_translate_input_event(&binding, vk, is_down, is_up, ctrl, alt, shift, win) {
                    return 1;
                }
            }

            // While the translate popover is visible, intercept Esc (hide) and Enter (copy) so the
            // non-activating window's keystrokes (which it never receives natively) still work.
            // Decision is pure (`translate_overlay_key_decide`) and tracks a consumed key so the
            // held auto-repeat downs and the key-up are swallowed too — otherwise a held Enter
            // types newlines into the editor, a held Esc sends Esc to it once hide() flips visible.
            let consumed = TRANSLATE_CONSUMED_KEY.load(Ordering::SeqCst);
            if (TRANSLATE_VISIBLE.load(Ordering::SeqCst) || consumed != 0) && (is_down || is_up) {
                let has_result = TRANSLATE_LAST_RESULT.lock().is_some();
                let (action, new_consumed) =
                    translate_overlay_key_decide(consumed, vk, is_down, is_up, has_result);
                if consumed != 0 || new_consumed != 0 || action != TranslateOverlayKeyAction::None {
                    TRANSLATE_CONSUMED_KEY.store(new_consumed, Ordering::SeqCst);
                    // Only the consuming key's first key-down posts an action.
                    if action != TranslateOverlayKeyAction::None && is_down {
                        let hook_thread = HOOK_THREAD_ID.load(Ordering::SeqCst);
                        if hook_thread != 0 {
                            let w = if action == TranslateOverlayKeyAction::Hide {
                                WM_HOTKEY_TRANSLATE_HIDE
                            } else {
                                WM_HOTKEY_TRANSLATE_COPY
                            };
                            PostThreadMessageW(hook_thread, WM_HOTKEY_EVENT, w, 0);
                        }
                    }
                    // Swallow through the consumed key's up (cleared then) so up/down stay balanced.
                    return 1;
                }
            }
        }
    }

    CallNextHookEx(0 as HHOOK, code, wparam, lparam)
}

unsafe extern "system" fn low_level_mouse_proc(
    code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if code >= 0 && lparam != 0 {
        let msg = wparam as u32;


        let (is_down, is_up, vk) = match msg {
            WM_XBUTTONDOWN => {
                let ms = *(lparam as *const MsLlHookStruct);
                let xbutton = (ms.mouse_data >> 16) & 0xFFFF;
                let vk = if xbutton == 1 { 0x05 } else if xbutton == 2 { 0x06 } else { 0 };
                (true, false, vk)
            }
            WM_XBUTTONUP => {
                let ms = *(lparam as *const MsLlHookStruct);
                let xbutton = (ms.mouse_data >> 16) & 0xFFFF;
                let vk = if xbutton == 1 { 0x05 } else if xbutton == 2 { 0x06 } else { 0 };
                (false, true, vk)
            }
            WM_MBUTTONDOWN => (true, false, 0x04),
            WM_MBUTTONUP => (false, true, 0x04),
            _ => (false, false, 0),
        };

            let foreground = GetForegroundWindow();
            if !foreground.is_null() {
                let mut pid: u32 = 0;
                GetWindowThreadProcessId(foreground, &mut pid);
                if pid == std::process::id() {
                    return CallNextHookEx(0 as HHOOK, code, wparam, lparam);
                }
            }

        if vk != 0 {
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

            let stt_binding = STT_BINDING.lock().clone();
            if let Some(binding) = stt_binding {
                handle_stt_input_event(&binding, vk, is_down, is_up, ctrl, alt, shift, win);
            }
        }
    }

    CallNextHookEx(0 as HHOOK, code, wparam, lparam)
}

pub struct HotkeyManager {
    thread_handle: Option<JoinHandle<()>>,
    is_running: Arc<AtomicBool>,
}

/// HWND of the translate popover, registered when it is shown, used for outside-click dismiss.
static TRANSLATE_OVERLAY_HWND: AtomicIsize = AtomicIsize::new(0);

/// Set/query translate popover visibility (drives Esc/Enter swallow gating).
///
/// Note: this deliberately does NOT clear `TRANSLATE_CONSUMED_KEY`. The Hide/Copy action is posted
/// by the very key-down that consumed the key, so clearing here would zero the consumed state before
/// the held key's auto-repeats arrive — letting a held Enter still type newlines into the editor.
/// The consumed key is only cleared by its own key-up (or by a subsequent show).
pub fn set_translate_visible(visible: bool) {
    TRANSLATE_VISIBLE.store(visible, Ordering::SeqCst);
    if !visible {
        *TRANSLATE_LAST_RESULT.lock() = None;
        TRANSLATE_OVERLAY_HWND.store(0, Ordering::SeqCst);
    }
}

/// Register the popover HWND so the mouse hook can detect outside-click dismiss.
pub fn set_translate_overlay_hwnd(hwnd: isize) {
    TRANSLATE_OVERLAY_HWND.store(hwnd, Ordering::SeqCst);
}

pub fn translate_visible() -> bool {
    TRANSLATE_VISIBLE.load(Ordering::SeqCst)
}

/// Store the last translated text for the Enter/Copy path.
pub fn set_translate_last_result(text: &str) {
    *TRANSLATE_LAST_RESULT.lock() = Some(text.to_string());
}

pub fn translate_last_result() -> Option<String> {
    TRANSLATE_LAST_RESULT.lock().clone()
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
        translate_binding: Option<KeyBinding>,
        sender: Sender<HotkeyEvent>,
    ) -> Result<(), HookError> {
        *STT_BINDING.lock() = Some(binding);
        *STT_MODE.lock() = mode;
        *TRANSLATE_BINDING.lock() = translate_binding;
        TRANSLATE_ARMED.store(false, Ordering::SeqCst);
        IS_HELD.store(false, Ordering::SeqCst);
        IS_TOGGLED_ON.store(false, Ordering::SeqCst);

        let running_flag = Arc::clone(&self.is_running);
        running_flag.store(true, Ordering::SeqCst);

        let handle = thread::spawn(move || unsafe {
            let thread_id = GetCurrentThreadId();
            HOOK_THREAD_ID.store(thread_id, Ordering::SeqCst);

            let kbd_hook: HHOOK = SetWindowsHookExW(
                WH_KEYBOARD_LL,
                Some(low_level_keyboard_proc),
                0 as HMODULE,
                0,
            );

            let mouse_hook: HHOOK = SetWindowsHookExW(
                WH_MOUSE_LL,
                Some(low_level_mouse_proc),
                0 as HMODULE,
                0,
            );

            if kbd_hook.is_null() && mouse_hook.is_null() {
                eprintln!("[HotkeyManager] Failed to set hooks");
                running_flag.store(false, Ordering::SeqCst);
                return;
            }

            let mut msg: MSG = std::mem::zeroed();
            while GetMessageW(&mut msg, 0 as _, 0, 0) > 0 {
                if msg.message == WM_QUIT {
                    break;
                }
                if msg.message == WM_HOTKEY_EVENT {
                    let event = match msg.wParam {
                        1 => HotkeyEvent::Pressed,
                        2 => HotkeyEvent::Released,
                        WM_HOTKEY_TRANSLATE => HotkeyEvent::TranslateTrigger,
                        WM_HOTKEY_TRANSLATE_HIDE => HotkeyEvent::TranslateHide,
                        WM_HOTKEY_TRANSLATE_COPY => HotkeyEvent::TranslateCopy,
                        _ => HotkeyEvent::Released,
                    };
                    let _ = sender.try_send(event);
                }
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            if !kbd_hook.is_null() {
                UnhookWindowsHookEx(kbd_hook);
            }
            if !mouse_hook.is_null() {
                UnhookWindowsHookEx(mouse_hook);
            }
            running_flag.store(false, Ordering::SeqCst);
        });

        self.thread_handle = Some(handle);
        Ok(())
    }

    pub fn update_config(
        &self,
        binding: KeyBinding,
        mode: HotkeyMode,
        translate_binding: Option<KeyBinding>,
    ) {
        let mut current_binding = STT_BINDING.lock();
        let mut current_mode = STT_MODE.lock();

        if should_reset_hotkey_state(current_binding.as_ref(), &binding, *current_mode, mode) {
            *current_binding = Some(binding);
            *current_mode = mode;
            IS_HELD.store(false, Ordering::SeqCst);
            IS_TOGGLED_ON.store(false, Ordering::SeqCst);
        }

        *TRANSLATE_BINDING.lock() = translate_binding;
        TRANSLATE_ARMED.store(false, Ordering::SeqCst);
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
