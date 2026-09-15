use windows_sys::Win32::Foundation::{HWND, POINT, RECT};
use windows_sys::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, GetSystemMetrics, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, ShowWindow,
    SystemParametersInfoW, GWL_EXSTYLE, HWND_TOPMOST, SM_CXSCREEN, SM_CYSCREEN, SPI_GETWORKAREA,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, SW_HIDE, SW_SHOWNOACTIVATE,
    WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
};

/// Compute the top-left corner for a popover anchored below-right of the cursor, clamping into the
/// work area and flipping above the cursor when it would overflow the bottom edge. Pure so it is
/// unit-testable without a display.
///
/// `work` is the monitor work-area `RECT`; `cursor` is the cursor position; `width`/`height` are in
/// physical px.
pub fn clamp_position(
    cursor: (i32, i32),
    work: RECT,
    width: i32,
    height: i32,
) -> (i32, i32) {
    const OFFSET_X: i32 = 12;
    const OFFSET_Y: i32 = 20;

    let mut x = cursor.0 + OFFSET_X;
    let mut y = cursor.1 + OFFSET_Y;

    // Clamp X inside work area.
    x = x.clamp(work.left, work.right - width);

    // Flip above the cursor if we'd overflow the bottom of the work area.
    if y + height > work.bottom {
        y = cursor.1 - height - OFFSET_Y;
    }
    // Clamp Y into work area.
    y = y.clamp(work.top, work.bottom - height);

    (x, y)
}

/// Position an overlay window at the cursor, non-activating, clamped/flipped to the monitor work area.
pub fn position_overlay_at_cursor(hwnd: HWND, width: i32, height: i32) {
    unsafe {
        let mut cursor: POINT = std::mem::zeroed();
        if GetCursorPos(&mut cursor) == 0 {
            return;
        }

        let monitor = MonitorFromPoint(cursor, MONITOR_DEFAULTTONEAREST);
        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(monitor, &mut info) == 0 {
            return;
        }

        let (x, y) = clamp_position(
            (cursor.x, cursor.y),
            info.rcWork,
            width,
            height,
        );

        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            x,
            y,
            width,
            height,
            SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn work() -> RECT {
        RECT { left: 0, top: 0, right: 1920, bottom: 1040 }
    }

    #[test]
    fn clamps_into_work_area() {
        // Cursor near the right edge: x clamped so the window stays inside.
        let (x, _) = clamp_position((1900, 500), work(), 340, 150);
        assert!(x <= 1920 - 340);
        assert!(x >= 0);
    }

    #[test]
    fn flips_above_when_overflowing_bottom() {
        // Cursor near the bottom: window would overflow → flips above the cursor.
        let (_, y) = clamp_position((500, 1020), work(), 340, 150);
        assert!(y + 150 <= 1040);
        assert!(y < 1020, "flipped above cursor, got y={}", y);
    }

    #[test]
    fn anchors_below_right_of_cursor_within_bounds() {
        let (x, y) = clamp_position((100, 100), work(), 340, 150);
        assert_eq!(x, 112); // cursor.x + 12
        assert_eq!(y, 120); // cursor.y + 20
    }

    #[test]
    fn y_clamped_above_top() {
        // Cursor near top-left; flip could push above work.top → clamped to top.
        let (_, y) = clamp_position((100, 10), RECT { left: 0, top: 40, right: 1920, bottom: 1040 }, 340, 150);
        assert!(y >= 40);
    }
}


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
