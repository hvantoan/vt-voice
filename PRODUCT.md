# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Người dùng phổ thông & đa năng**: Người dùng máy tính cần công cụ hỗ trợ công việc hàng ngày, nhập liệu giọng nói nhanh chóng và tra cứu, dịch thuật văn bản tức thì mà không cần thao tác phức tạp.
- **Lập trình viên & Kỹ sư phần mềm**: Gõ code, commit messages, tài liệu kỹ thuật, trao đổi trong Slack/Discord/Teams mà không cần rời tay khỏi bàn phím hay mất focus IDE. Hỗ trợ nhận diện và trau chuốt chuẩn xác các thuật ngữ công nghệ pha trộn Việt - Anh (code-switching).
- **Nhân viên văn phòng & Người viết lách**: Soạn thảo email, báo cáo, tài liệu Word/Excel với tốc độ cao, sửa lỗi chính tả và làm mượt câu văn tự động.
- **Học sinh & Sinh viên học tiếng Anh**: Tra cứu và dịch nhanh các đoạn văn bản, tài liệu học tập ngay trên màn hình bằng thao tác bôi đen và phím tắt `Alt+T`.

## Product Purpose

`vt-voice` là tiện ích máy tính (desktop daemon) chạy ngầm trên Windows 11, cung cấp khả năng nhập liệu văn bản bằng giọng nói với độ trễ cực thấp (< 500ms) kết hợp AI trau chuốt câu từ và dịch nhanh văn bản bôi đen trên màn hình.

Sản phẩm tồn tại để xóa bỏ rào cản gõ phím thủ công, tăng tốc độ chuyển đổi suy nghĩ thành văn bản ở bất kỳ ứng dụng nào, và hỗ trợ đọc hiểu đa ngôn ngữ liền mạch.

Thành công nghĩa là: người dùng kích hoạt bằng phím tắt toàn cục, nói một câu hoặc bôi đen một từ, và văn bản chính xác xuất hiện ngay tại vị trí con trỏ trong nháy mắt mà không làm gián đoạn mạch tập trung hay ứng dụng đang thao tác.

## Positioning

**Ambient, Zero-Distraction & Low-Latency Desktop Daemon**:
- Khác biệt với các công cụ nhập liệu hay phần mềm dịch thuật chiếm dụng không gian và cướp tiêu điểm (focus stealing), `vt-voice` vận hành hoàn toàn ngầm.
- Cửa sổ nổi hiển thị trạng thái (pill overlay & translate popover) sử dụng cờ Win32 `WS_EX_NOACTIVATE`, tuyệt đối không cướp focus của ứng dụng đích (IDE, browser, terminal, office).
- Không làm bẩn clipboard: áp dụng cờ loại trừ giám sát (`ExcludeClipboardContentFromMonitorProcessing`), khôi phục nội dung clipboard gốc (bao gồm cả dữ liệu phi văn bản) ngay sau khi dán qua phím tắt mô phỏng `Ctrl+V`.
- Độ trễ cực thấp: phản hồi visual indicator trong vòng 50ms và hoàn tất phiên dịch/nhập liệu trong dưới 500ms với STT cloud tốc độ cao.

## Operating Context

- **Hệ điều hành**: Windows 10/11 64-bit. Thường trực dưới khay hệ thống (System Tray).
- **Quy trình nhập liệu giọng nói**: Nhấn giữ phím tắt (Hold-to-record) hoặc bật/tắt (Toggle-to-talk) -> thu âm WASAPI, xử lý mono 16kHz -> gửi STT provider (Groq, OpenRouter, hoặc endpoint tương thích) -> AI Polisher trau chuốt -> dán trực tiếp vào ứng dụng đích qua `Ctrl+V`.
- **Quy trình dịch thuật bôi đen**: Bôi đen văn bản bất kỳ -> bấm `Alt+T` -> chụp văn bản qua clipboard an toàn -> cửa sổ nổi hiển thị bản dịch tức thì (Google Translate RPC hoặc OpenAI fallback) tại vị trí con trỏ chuột.
- **Quy trình cấu hình**: Mở bảng Settings từ khay hệ thống để quản lý phím tắt, micro, danh sách AI providers, khóa API và xem lại lịch sử nhập liệu.

## Capabilities and Constraints

- **Khả năng đã xác nhận**:
  - Thu âm giọng nói WASAPI độ trung thực cao, resample 16kHz mono, mã hóa WAV chuẩn.
  - Cơ chế Multi-Provider AI linh hoạt: Groq, OpenRouter, Custom OpenAI-compatible endpoints.
  - Lưu trữ API Key an toàn tuyệt đối qua Windows Credential Manager DPAPI (`keyring` crate) — không ghi plaintext lên đĩa hay file cấu hình.
  - Dịch thuật văn bản bôi đen không cướp focus (`Alt+T`).
  - Quản lý lịch sử nhập liệu 50 mục gần nhất, hỗ trợ tìm kiếm và sao chép.
  - Giao diện song ngữ hoàn chỉnh: Tiếng Việt và Tiếng Anh với tính nhất quán 100% giữa các từ điển ngôn ngữ.
- **Ràng buộc kỹ thuật & thiết kế**:
  - Nền tảng: Windows 10/11 64-bit native (Tauri v2 + Rust backend `vt_voice_lib` + React 19 / TypeScript / Tailwind CSS / Radix UI).
  - An toàn thanh dấu tiếng Việt (Diacritics safety): bắt buộc duy trì padding dọc và chiều cao dòng hợp lý (`py-2`, tránh `leading-none` trên text tiếng Việt) để không cắt gọt dấu thanh.
  - Mở rộng kích thước & Giao diện linh hoạt: Bảng điều khiển Settings hỗ trợ co giãn kích thước linh hoạt (responsive/scalable) và hỗ trợ đầy đủ cả Light Mode lẫn Dark Mode.
  - Overlays nổi: Luôn tuân thủ `WS_EX_NOACTIVATE`, kích thước nhỏ gọn và tinh tế, không che khuất nội dung làm việc.

## Brand Commitments

- **Tên sản phẩm**: `vt-voice`.
- **Biểu tượng nhận diện**: "Sonic Spark" — hình capsule microphone tối giản giao thoa cùng sóng âm sắc nét thành tia chớp năng lượng.
- **Tính cách thương hiệu**: Nhẹ nhàng, tốc độ, đáng tin cậy, thấu hiểu ngữ cảnh làm việc và tôn trọng quyền riêng tư.
- **Phong cách thẩm mỹ**: Windows 11 Fluent Design / Mica / Acrylic. Hệ màu Dark Obsidian / Zinc sang trọng kết hợp màu trạng thái rõ ràng (Rose, Amber, Emerald), cùng với phiên bản Light mode tinh tế, sắc sảo.

## Evidence on Hand

- Mã nguồn hoạt động thực tế: Backend Rust (`src-tauri`), Frontend React 19 (`src`).
- Tài liệu kỹ thuật: `docs/architecture.md`, `docs/design-guidelines.md`, `docs/tech-stack.md`.
- File kiểm thử tự động: `tests/i18n.test.ts`, `tests/history.test.ts`, `tests/ipc-errors.test.ts`, `tests/confirm.test.ts`.
- Mẫu wireframe: `docs/wireframes/overlay-preview.webp`, `docs/wireframes/settings-preview.webp`.

## Product Principles

- **Focus is Sacred (Tiêu điểm là tối thượng)**: Không bao giờ cướp focus cửa sổ, không làm gián đoạn dòng suy nghĩ hay vị trí con trỏ của người dùng.
- **Sub-Second Responsiveness (Tốc độ tức thì)**: Mọi thao tác phải phản hồi trực quan dưới 50ms và hoàn tất nhập liệu/dịch thuật trong dưới 500ms.
- **Bilingual Polish & Diacritics Safety (Song ngữ hoàn mỹ)**: Tối ưu hàng đầu cho môi trường làm việc kết hợp Việt - Anh; giữ trọn vẹn vẻ đẹp và độ chính xác của dấu tiếng Việt.
- **Privacy by Design (Bảo mật tối đa)**: Khóa API và dữ liệu cá nhân chỉ lưu trong Windows Credential Vault (DPAPI), không làm bẩn clipboard người dùng.
- **Ergonomic Versatility (Công thái học đa năng)**: Phục vụ tốt từ tác vụ lập trình chuyên sâu đến công việc văn phòng và học tập; thích ứng hoàn hảo giữa Light và Dark mode.

## Accessibility & Inclusion

- Độ tương phản màu sắc đáp ứng chuẩn WCAG 2.1 AA (tỉ lệ tối thiểu 4.5:1, đạt >13:1 cho văn bản chính).
- Hỗ trợ bàn phím toàn diện với focus indicators rõ ràng cho mọi tương tác.
- Tôn trọng thiết lập `prefers-reduced-motion` của hệ điều hành.
- Phông chữ hỗ trợ hoàn chỉnh tập ký tự Unicode Tiếng Việt mở rộng (Plus Jakarta Sans).
