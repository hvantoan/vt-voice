# vt-voice v0.1.0 — Release Notes

**Ngày phát hành:** 19/09/2026  
**Phiên bản:** v0.1.0 (Bản phát hành chính thức đầu tiên)  
**Nền tảng hỗ trợ:** Windows 10 / Windows 11 (64-bit)

---

## 🚀 Tổng Quan (Overview)

**vt-voice** là tiện ích desktop thế hệ mới dành riêng cho hệ điều hành Windows, cung cấp giải pháp **nhập liệu giọng nói độ trễ cực thấp (Voice Typing)**, **trau chuốt văn bản bằng AI (AI Text Polishing)** và **dịch nhanh văn bản bôi đen trên màn hình (Selection Translation)**.

Được xây dựng trên nền tảng **Tauri v2** kết hợp backend **Rust native (`vt_voice_lib`)** và frontend **React 19 + TypeScript + Vite 7**, `vt-voice` mang lại hiệu năng tối đa, tiêu thụ tài nguyên cực thấp, phản hồi dưới 300ms và cam kết bảo mật dữ liệu tuyệt đối.

---

## ✨ Điểm Nổi Bật & Tính Năng Mới (New Features)

### 🎙️ 1. Nhập Liệu Giọng Nói Toàn Cục (Push-to-Talk Voice Typing)
- **Cơ chế kích hoạt Hold-to-Record / Push-to-Talk**: Kích hoạt thu âm ngay lập tức bằng phím tắt toàn cục chạy trên thread OS riêng biệt thông qua Windows Low-Level Hook (`WH_KEYBOARD_LL`).
- **Tùy biến phím tắt linh hoạt**: Hỗ trợ mọi tổ hợp phím (kết hợp `Ctrl`, `Alt`, `Shift`, `Win`, các phím chức năng `F1`-`F12`) và các nút chuột mở rộng (`Mouse Middle`, `X1`, `X2`).
- **Thu âm độ trễ thấp với WASAPI**: Sử dụng Windows Audio Session API (`cpal`), resample âm thanh chuẩn 16kHz Mono chất lượng cao (`rubato`) và mã hóa PCM WAV (`hound`).
- **Overlay Pill trạng thái nổi thông minh**: Giao diện thanh trạng thái mượt mà, luôn ở trên cùng (Always-on-Top), không bao giờ cướp tiêu điểm của ứng dụng đang gõ (`WS_EX_NOACTIVATE`), tích hợp visualizer mức âm lượng (RMS) cập nhật liên tục mỗi 50ms.
- **Tùy chọn linh hoạt STT & AI Polish**:
  - **Pure STT Mode**: Chuyển giọng nói thành văn bản trực tiếp siêu tốc (độ trễ < 300ms), bảo toàn tuyệt đối thuật ngữ chuyên ngành và cách nói pha trộn Việt - Anh (code-switching).
  - **AI Polish Mode**: Sử dụng các mô hình ngôn ngữ lớn (LLM) để tự động sửa lỗi chính tả, bổ sung dấu câu và trau chuốt câu từ mạch lạc.
- **Chèn văn bản an toàn (Smart Paste Injection)**: Tự động dán văn bản trực tiếp vào con trỏ của ứng dụng đang hoạt động bằng mô phỏng `Ctrl+V` (`SendInput`). Bảo toàn clipboard gốc, không làm mất dữ liệu người dùng vừa copy trước đó và chặn các trình quản lý clipboard ghi nhận dữ liệu tạm.

### 🌐 2. Dịch Nhanh Văn Bản Vùng Chọn (Selection Translate Overlay)
- **Kích hoạt tức thì**: Nhấn phím tắt toàn cục tùy chỉnh (mặc định `Alt+T`) tại bất kỳ cửa sổ nào trên Windows để dịch ngay đoạn văn bản đang chọn.
- **Tự động bắt nội dung thông minh**: Bắt văn bản bôi đen qua cơ chế chụp và phục hồi clipboard tức thì, không làm gián đoạn luồng làm việc.
- **Cửa sổ dịch nổi đa năng (Translate Overlay)**:
  - Hiển thị popover nổi ngay gần vị trí con trỏ chuột, hỗ trợ không chiếm quyền điều khiển (`SWP_NOACTIVATE`).
  - Cho phép người dùng chỉnh sửa văn bản gốc hoặc nhập trực tiếp nội dung mới để dịch lại ngay trên overlay.
- **Động cơ dịch kép (Dual-Engine Translation)**:
  - **Google Translate RPC (Mặc định)**: Tốc độ cao, dịch đa ngôn ngữ tức thì, hoàn toàn miễn phí và không cần cấu hình API key.
  - **OpenAI Chat Completions (Fallback)**: Hỗ trợ dịch nâng cao bằng các model LLM chất lượng cao khi cần dịch ngữ cảnh phức tạp.
- **Thao tác bàn phím tiện lợi**: Nhấn `Enter` để copy ngay kết quả dịch vào clipboard, nhấn `Esc` để đóng cửa sổ nhanh chóng.

### 🧠 3. Kiến Trúc AI Đa Nhà Cung Cấp (Modular AI Providers)
- **Hỗ trợ đa dạng nền tảng**: Tích hợp sẵn sàng với **Groq**, **OpenRouter** và **Custom OpenAI-compatible Endpoints** (hỗ trợ hoàn hảo các mô hình chạy cục bộ qua Ollama, LM Studio, vLLM hoặc các gateway trung gian như 9router).
- **Phân bổ tính năng độc lập (Feature Profile Bindings)**: Cho phép gán từng nhà cung cấp và model riêng biệt cho từng tác vụ:
  - Provider & Model cho **STT** (nhận diện giọng nói).
  - Provider & Model cho **Polish** (trau chuốt văn bản).
  - Provider & Model cho **Translate** (dịch thuật).
- **Tự động khám phá danh mục model**: Quản trị và đồng bộ danh sách model từ nhà cung cấp với cơ chế lưu đệm cục bộ (`models.json`).

### 🔒 4. Bảo Mật Cấp Hệ Thống (DPAPI Credential Vault)
- **Lưu trữ bảo mật trong Windows Credential Manager**: Mọi API key được mã hóa và bảo vệ bằng Windows Data Protection API (DPAPI) thông qua crate `keyring`.
- **Zero Plaintext Storage**: Tuyệt đối không lưu trữ khóa API dạng văn bản rõ trên ổ đĩa, tệp cấu hình `settings.json`, log hay console.
- **Bảo vệ chống ghi đè khóa**: Cơ chế chống ghi đè tự động khóa đang được che giấu (`sk-or-••••••••abcd`) trong giao diện người dùng.

### 📜 5. Quản Lý Lịch Sử Hoạt Động (History Management)
- **Lưu trữ tự động**: Tự động lưu trữ lịch sử chép chính tả và bản dịch (giới hạn an toàn 50 mục gần nhất, cơ chế chống trùng lặp thông minh).
- **Giao diện quản lý trực quan**:
  - Tìm kiếm và lọc nhanh nội dung theo từ khóa.
  - Sao chép lại nội dung chỉ với 1 cú click chuột.
  - Xóa từng mục hoặc xóa toàn bộ lịch sử kèm hộp thoại xác nhận an toàn.
  - Xuất dữ liệu lịch sử ra định dạng `JSON`.
- **Độ tin cậy cao**: Thiết kế an toàn luồng (thread-safety), ghi file nguyên tử (`atomic rename`) ngăn ngừa tình trạng hỏng dữ liệu khi tắt ứng dụng đột ngột.

### 🌍 6. Đa Ngôn Ngữ & Thiết Kế Trải Nghiệm Người Dùng (i18n & Polished UI)
- **Hỗ trợ song ngữ hoàn chỉnh**: Toàn bộ giao diện và thông báo lỗi hỗ trợ 100% **Tiếng Việt** và **Tiếng Anh**.
- **Tự động nhận diện ngôn ngữ Windows**: Khay hệ thống (System Tray) và ứng dụng tự động thích ứng với ngôn ngữ hiển thị của hệ điều hành.
- **Thiết kế hiện đại (Obsidian Dark Theme)**: Giao diện dựa trên các primitive của **Radix UI** và **shadcn/ui**, tuân thủ nghiêm ngặt bảng màu và phong cách chuẩn thiết kế.
- **Tối ưu hiển thị tiếng Việt**: Căn chỉnh lề dọc an toàn, đảm bảo các ký tự có dấu thanh âm tiếng Việt (như ệ, ộ, ử, ỹ) không bao giờ bị cắt xén.
- **Tiện ích Khay Hệ thống (System Tray)**: Thu nhỏ ứng dụng vào khay hệ thống, hỗ trợ bật/tắt nhanh, mở cài đặt, mở thư mục log và xem trạng thái hoạt động.

### 🛡️ 7. Ghi Nhật Ký An Toàn Tuyệt Đối (Zero-PII Structured Logging)
- **Logging có cấu trúc**: Ghi log chuyên biệt cho toàn bộ pipeline AI (`vt_voice::ai::*`) với cơ chế xoay vòng tự động (5 MiB x 3 tệp).
- **Cam kết Không Lưu Thông Tin Cá Nhân (Zero-PII)**: Được bảo vệ bởi bộ kiểm tra tĩnh mã nguồn. Nhật ký chỉ ghi lại metadata kỹ thuật (`duration_ms`, `model`, `base_url`, `error_kind`, `status`), cam kết 100% không ghi nhận nội dung văn bản nói/dịch hay khóa API của người dùng.
- **Tiện ích mở log**: Tích hợp nút mở trực tiếp thư mục log ngay trong giao diện cài đặt để người dùng dễ dàng kiểm tra hoặc hỗ trợ kỹ thuật.

---

## 🔧 Các Cải Tiến & Sửa Lỗi Quan Trọng (Bug Fixes & Improvements)

- **Sửa lỗi Parse Error với Gateway trả về SSE**: Chuẩn hóa việc gửi header `Accept: application/json` mặc định trên toàn bộ HTTP client AI, khắc phục lỗi gateway tương thích OpenAI trả về `text/event-stream` gây lỗi parse kết quả dịch và trau chuốt.
- **Chuẩn hóa URL Endpoint Nhà cung cấp**: Tự động loại bỏ các hậu tố `/models` hoặc `/chat/completions` khi lưu và tải cấu hình, loại bỏ triệt để lỗi `401 / 404` do nhân đôi đường dẫn URL.
- **Bảo toàn trạng thái phím tắt**: Khắc phục hiện tượng mất trạng thái phím tắt đang hoạt động khi người dùng lưu cấu hình trong mục Cài đặt.
- **Loại bỏ hiện tượng tranh chấp thiết bị thu âm (Race Condition)**: Đồng bộ hóa quá trình dò tìm danh sách microphone WASAPI, loại bỏ lỗi gián đoạn khi khởi động hoặc cắm/rút thiết bị âm thanh.
- **Cơ chế ghi file cấu hình và lịch sử nguyên tử**: Đảm bảo an toàn dữ liệu, chống xung đột khóa và nghẽn luồng I/O.

---

## 💻 Yêu Cầu Hệ Thống (System Requirements)

| Thành phần | Yêu cầu tối thiểu | Khuyến nghị |
| :--- | :--- | :--- |
| **Hệ điều hành** | Windows 10 (64-bit) Build 19041+ | Windows 11 (64-bit) phiên bản mới nhất |
| **Bộ vi xử lý** | Intel Core i3 / AMD Ryzen 3 trở lên | Intel Core i5 / AMD Ryzen 5 trở lên |
| **Bộ nhớ RAM** | 4 GB RAM | 8 GB RAM trở lên |
| **Thiết bị âm thanh** | Microphone tích hợp hoặc gắn ngoài hỗ trợ WASAPI | Microphone chất lượng tốt có lọc ồn |
| **Kết nối mạng** | Bắt buộc (kết nối tới các dịch vụ Cloud AI / STT) | Kết nối Internet băng thông ổn định |

---

## 🚦 Hướng Dẫn Bắt Đầu Nhanh (Quick Start)

1. **Khởi chạy ứng dụng**: Tải và mở `vt-voice.exe`. Ứng dụng sẽ xuất hiện biểu tượng ở Khay hệ thống (System Tray).
2. **Cấu hình Nhà cung cấp AI**:
   - Nhấp đúp vào biểu tượng khay hệ thống hoặc chọn **Cài đặt**.
   - Chuyển sang tab **Nhà cung cấp AI (AI Providers)**.
   - Thêm API key cho **Groq** (khuyến nghị cho STT siêu tốc) hoặc **OpenRouter**, hoặc kết nối tới Endpoint cục bộ.
3. **Thiết lập Phím tắt & Thiết bị**:
   - Chuyển sang tab **Âm thanh (Audio)** để chọn Microphone phù hợp và kiểm tra mức âm lượng.
   - Chuyển sang tab **Cài đặt chung (General)** để gán phím tắt thu âm (ví dụ: `Ctrl + Space` hoặc `F7`).
   - Gán phím tắt dịch vùng chọn (mặc định: `Alt + T`).
4. **Sử dụng**:
   - **Gõ giọng nói**: Đặt con trỏ văn bản ở bất kỳ đâu, nhấn giữ phím tắt đã cài đặt, nói nội dung cần nhập và thả phím ra.
   - **Dịch tức thì**: Bôi đen một đoạn văn bản bất kỳ và nhấn `Alt + T`.
