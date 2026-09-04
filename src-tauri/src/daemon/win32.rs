use windows_sys::Win32::Foundation::{HWND, RECT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, ShowWindow,
    SystemParametersInfoW, GWL_EXSTYLE, HWND_TOPMOST, SM_CXSCREEN, SM_CYSCREEN,
    SPI_GETWORKAREA, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SW_HIDE, SW_SHOWNOACTIVATE,
    WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
};

#[link(name = "dwmapi")]
extern "system" {
    fn DwmSetWindowAttribute(
        hwnd: HWND,
        dw_attribute: u32,
        pv_attribute: *const std::ffi::c_void,
        cb_attribute: u32,
    ) -> i32;
}

/// Configure main window HWND to force dark mode and suppress Windows 11 DWM white border
pub fn setup_main_window_theme(hwnd: HWND) {
    unsafe {
        // DWMWA_USE_IMMERSIVE_DARK_MODE = 20
        let dark_mode: i32 = 1;
        let _ = DwmSetWindowAttribute(
            hwnd,
            20,
            &dark_mode as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );

        // DWMWA_BORDER_COLOR = 34, DWMWA_COLOR_NONE = 0xFFFFFFFE (suppresses border completely)
        let border_color: u32 = 0xFFFFFFFE;
        let _ = DwmSetWindowAttribute(
            hwnd,
            34,
            &border_color as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );
    }
}

/// Configure overlay window HWND with non-activating extended styles
pub fn apply_overlay_styles(hwnd: HWND) {
    unsafe {
        let current_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let target_style = current_style
            | (WS_EX_NOACTIVATE as isize)
            | (WS_EX_TOOLWINDOW as isize)
            | (WS_EX_TOPMOST as isize);

        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, target_style);

        // Ensure window stays topmost without activation
        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
}

/// Show the window without stealing focus or activating
pub fn show_window_no_activate(hwnd: HWND) {
    unsafe {
        ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }
}

/// Hide the window
pub fn hide_window(hwnd: HWND) {
    unsafe {
        ShowWindow(hwnd, SW_HIDE);
    }
}

/// Position the overlay window horizontally centered at the bottom of the work area
pub fn position_overlay_bottom_center(hwnd: HWND, width: i32, height: i32, margin_bottom: i32) {
    unsafe {
        let mut work_area = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };

        let success = SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            &mut work_area as *mut _ as *mut _,
            0,
        );

        let (screen_w, work_bottom) = if success != 0 {
            (work_area.right - work_area.left, work_area.bottom)
        } else {
            (
                GetSystemMetrics(SM_CXSCREEN),
                GetSystemMetrics(SM_CYSCREEN),
            )
        };

        let x = (screen_w - width) / 2;
        let y = work_bottom - height - margin_bottom;

        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            x,
            y,
            width,
            height,
            SWP_NOACTIVATE,
        );
    }
}
