use parking_lot::Mutex;
use vt_voice_lib::injection::ClipboardManager;

static CLIPBOARD_TEST_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn test_clipboard_manager_initialization() {
    let _guard = CLIPBOARD_TEST_LOCK.lock();
    let mgr = ClipboardManager::new();
    let (snapshot, seq) = mgr.snapshot_text();
    let _ = seq;
    let _ = snapshot;
}

#[test]
fn test_clipboard_transient_write_and_snapshot() {
    let _guard = CLIPBOARD_TEST_LOCK.lock();
    let mgr = ClipboardManager::new();
    let test_str = "vt-voice: Kiểm tra tiếng Việt với Unikey Telex";

    let write_res = mgr.set_text_transient(test_str);
    assert!(write_res.is_ok(), "Setting transient text should succeed");

    let (snapshot, _) = mgr.snapshot_text();
    assert!(snapshot.is_some(), "Snapshot after writing should contain text");

    let text_u16 = snapshot.unwrap();
    let read_str = String::from_utf16_lossy(&text_u16);
    assert_eq!(read_str, test_str);
}
