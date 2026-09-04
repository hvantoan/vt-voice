# vt-voice Verification & Testing Guide

This guide outlines end-to-end smoke testing, Vietnamese IME stress testing, and performance validation for `vt-voice`.

---

## 1. Prerequisites & Setup

1. **Groq API Key**: Obtain an API key from [Groq Console](https://console.groq.com/keys).
2. **Launch Development Daemon**:
   ```bash
   bun run dev       # Starts Vite webview dev server on http://localhost:1420
   bun run tauri dev # Runs Tauri v2 background daemon with system tray
   ```
3. **Open Settings**: Click the `vt-voice` microphone tray icon (or right-click -> Cài đặt) to open the Settings dashboard.
4. **Configure Key & Test Connection**:
   - Navigate to **AI & Mô hình**.
   - Enter your Groq API Key (`gsk_...`).
   - Click **Kiểm tra**. Verify a green checkmark appears with latency measured (typically 120ms - 250ms).
   - Click **Lưu cài đặt**.

---

## 2. End-to-End Voice Injection Verification

### Scenario A: Windows Notepad
1. Open Windows Notepad (`notepad.exe`).
2. Position the blinking cursor anywhere inside the text document.
3. Hold the **Right Alt** key (Push-to-Talk mode):
   - Notice the floating pill overlay appears smoothly at the bottom-center above the taskbar.
   - Speak: *"Tạo một hàm đọc dữ liệu từ database và kiểm tra lỗi memory leak."*
   - Waveform bars bounce in real-time matching vocal volume.
4. Release **Right Alt**:
   - Floating pill transitions to **Đang xử lý AI...** (amber spinner).
   - Within ~400-800ms, text appears cleanly at the Notepad cursor:
     > `Tạo một hàm đọc dữ liệu từ database và kiểm tra lỗi memory leak.`
   - Floating pill flashes green **Đã chèn văn bản!** and auto-dismisses after 1.2s.

### Scenario B: VS Code Editor (Mixed Code-Switching Speech)
1. Open VS Code and place caret inside an open `.ts` or `.rs` file.
2. Hold **Right Alt** and speak technical developer jargon:
   > *"Anh push code lên branch staging để fix bug api và tạo pull request trên github nhé"*
3. Release **Right Alt**:
   - Target cursor in VS Code never lost focus during speech or injection.
   - Injected result:
     > `Anh push code lên branch staging để fix bug API và tạo Pull Request trên GitHub nhé.`
   - Notice: "API", "Pull Request", "GitHub" auto-capitalized cleanly; filler words stripped.

---

## 3. Vietnamese IME Compatibility Stress Test (Unikey / EVKey)

- **Test Goal**: Prove zero double letters (`dd`, `aa`), zero tone dropping, and zero phonetic corruption during simulated paste.
1. Start **Unikey** or **EVKey** with **Telex** mode active (or **VNI** mode).
2. Place cursor in an input field and type a few characters manually (e.g. `tieng viet`).
3. Press and hold **Right Alt**, speak a phrase with heavy diacritics:
   > *"Hệ thống microservices đang triển khai lên cụm Kubernetes hoàn toàn tự động."*
4. Release hotkey.
5. **Expected Output**:
   > `Hệ thống microservices đang triển khai lên cụm Kubernetes hoàn toàn tự động.`
   - No characters corrupted by active IME buffer.

---

## 4. Clipboard Preservation Verification

1. Copy any text to clipboard (e.g. `https://github.com/itvan/vt-voice`).
2. Verify clipboard holds the URL by pressing `Ctrl+V` once.
3. Speak a new phrase using `vt-voice` via **Right Alt**.
4. 300ms after text injection completes, press `Ctrl+V` manually again.
5. **Expected Result**: Your original URL (`https://github.com/itvan/vt-voice`) pastes normally!
6. Press `Win+V` (Windows Clipboard History):
   - Notice the voice transcription did NOT pollute history (guaranteed by `ExcludeClipboardContentFromMonitorProcessing`).

---

## 5. Performance & Telemetry Validation

- **Idle Memory Footprint**:
  - Open Windows Task Manager -> Details -> `vt-voice.exe`.
  - Idle Working Set RAM must remain **< 28MB**.
  - CPU utilization must remain **0.0%** when not recording.
- **Audio Thread Responsiveness**:
  - MMCSS audio thread guarantees zero dropped samples.
