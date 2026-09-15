pub mod clipboard;
pub mod paste;
pub mod selection;

pub use clipboard::{ClipboardError, ClipboardManager};
pub use paste::{inject_text_at_cursor, is_foreground_elevated, synthesize_ctrl_v, InjectionError, InjectionResult};
pub use selection::{capture_selected_text, should_restore, SelectionError, SelectionResult};
