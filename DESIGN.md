---
name: vt-voice
description: Zero-distraction, ultra-low-latency desktop daemon for voice typing and selection translation
colors:
  primary: "#10b981"
  primary-foreground: "#09090b"
  recording: "#f43f5e"
  processing: "#fbbf24"
  ai-badge: "#6366f1"
  canvas-dark: "#09090b"
  card-dark: "#18181b"
  elevated-dark: "#27272a"
  border-subtle: "rgba(39, 39, 42, 0.8)"
  border-glass: "rgba(255, 255, 255, 0.08)"
  text-primary: "#f4f4f5"
  text-secondary: "#a1a1aa"
  text-muted: "#71717a"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  mono:
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: "0.04em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input-base:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge-hotkey:
    backgroundColor: "{colors.elevated-dark}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  overlay-capsule:
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
---

# Design System: vt-voice

## Overview

**Creative North Star: "Sonic Precision"**

`vt-voice` mang triết lý thẩm mỹ của một thiết bị thu phát phòng thu chuyên nghiệp đặt trong không gian Windows 11 Fluent Acrylic hiện đại. Không có chi tiết thừa, không có hoạt ảnh phô trương. Mọi tương tác thị giác tồn tại để phục vụ tốc độ suy nghĩ, hỗ trợ lập trình viên, nhân viên văn phòng và người học ngoại ngữ chuyển lời nói thành văn bản chính xác trong tích tắc.

Bề mặt ứng dụng được điêu khắc từ các lớp kính mờ tối màu (Obsidian Zinc) sâu thẳm, bắt sáng tinh tế qua những đường viền hairline 1px bán trong suốt (`rgba(255, 255, 255, 0.08)`). Khi người dùng nói, thanh chỉ báo xuất hiện như một viên thuốc âm thanh nổi không trọng lượng (`win11-pill`) ngay phía trên thanh tác vụ Windows, giao tiếp trạng thái tức thì bằng các xung nhịp màu sắc chuẩn mực: sắc hoa hồng phát tín hiệu ghi âm, sắc hổ phách biểu thị trí tuệ nhân tạo đang trau chuốt, và ánh ngọc lục bảo xác nhận văn bản đã được đưa vào ứng dụng đích.

Hệ thống thiết kế từ chối các yếu tố gây xao nhãng: không cướp focus cửa sổ làm việc (`WS_EX_NOACTIVATE`), không làm biến dạng clipboard, và tuyệt đối nâng niu tính toàn vẹn của thanh dấu tiếng Việt trên mọi độ phân giải hiển thị.

**Key Characteristics:**
- **Ambient Translucency**: Mô phỏng vật liệu Windows 11 Acrylic & Frosted Glass với độ mờ 20px-24px và bão hòa 180%-190%.
- **Studio-Grade Telemetry**: Các chỉ số độ trễ, phím tắt và tần số âm thanh được định dạng bằng typography đơn cách (JetBrains Mono) sắc bén, số dạng tabular.
- **Zero-Occlusion Etiquette**: Cửa sổ nổi tự thu gọn hoặc ẩn hoàn toàn khi không hoạt động; vị trí và kích thước được tính toán để không che khuất dòng mã hoặc tài liệu đang mở.
- **Bilingual & Diacritics Safety**: Hệ thống khoảng cách dọc và chiều cao dòng được kiến tạo có chủ đích để bảo vệ mọi dấu mũ, dấu thanh tiếng Việt không bao giờ bị cắt xén.

## Colors

Bảng màu mang đặc tính "Sonic Studio" — nền tối obsidian sâu lắng tạo chiều sâu vô tận, điểm xuyết các hạt màu trạng thái có độ bão hòa cao mang năng lượng điện tử chính xác.

### Primary
- **Electric Emerald** (`#10b981` / `hsl(158 64% 52%)`): Điểm nhấn năng lượng chính của ứng dụng. Đại diện cho thao tác hoàn tất, lưu cấu hình thành công, trạng thái kết nối AI khả dụng và nút bấm hành động ưu tiên.

### Secondary
- **Sonic Rose** (`#f43f5e`): Tín hiệu đèn thu âm (Recording Beacon), visualizer cột sóng âm thời gian thực và các trạng thái lỗi/hủy bỏ. Sắc độ rực rỡ cảnh báo trực giác ngay lập tức khi microphone đang mở.
- **Amber Shimmer** (`#fbbf24`): Trạng thái AI đang suy nghĩ, trau chuốt ngữ pháp (Grammar Polishing) hoặc cảnh báo thiếu khóa API. Mang cảm giác ấm áp, tính toán thông minh.
- **Cloud Indigo** (`#6366f1`): Nhận diện các nhà cung cấp đám mây cao cấp (Groq, OpenRouter, Llama-3.3, Whisper Cloud).
- **Offline Sky** (`#0ea5e9`): Nhận diện mô hình chạy cục bộ (Ollama, whisper-rs) độc lập không cần Internet.

### Neutral
- **Deep Obsidian Canvas** (`#09090b` / `zinc-950`): Màu nền máy tính chính và khung vỏ ngoài của ứng dụng, triệt tiêu ánh sáng chói để mắt tập trung tối đa.
- **Elevated Card Surface** (`#18181b` / `zinc-900`): Bề mặt thẻ cài đặt, sidebar và các phân khu chức năng.
- **Surface Hover** (`#27272a` / `zinc-800`): Trạng thái hover của nút bấm, tabs kích hoạt và nền ô chọn.
- **Hairline Divider** (`rgba(39, 39, 42, 0.8)` / `border-zinc-800/80`): Đường kẻ phân tách thanh mảnh, giữ cấu trúc giao diện rõ ràng mà không nặng nề.
- **Glass Rim Light** (`rgba(255, 255, 255, 0.08)`): Viền phản quang trên kính mờ tạo cảm giác nổi khối Windows 11 Fluent.
- **Primary Text** (`#f4f4f5` / `zinc-100`): Tiêu đề, văn bản dịch và nội dung nhập liệu với độ tương phản 13.8:1 đạt chuẩn WCAG AAA.
- **Secondary Text** (`#a1a1aa` / `zinc-400`): Nhãn mô tả, phụ đề và gợi ý phím tắt.
- **Muted Text** (`#71717a` / `zinc-500`): Trạng thái chờ, icon thụ động và số đo dung lượng.

### Named Rules
**The One Accent Rule.** Màu Electric Emerald chỉ được xuất hiện ở tối đa một thành phần hành động chính trên một màn hình tại một thời điểm. Độ hiếm của màu xanh lục chính là sự bảo chứng cho tính định hướng người dùng.

**The Beacon Isolation Rule.** Màu Sonic Rose chỉ được dùng duy nhất cho hành động ghi âm giọng nói và trạng thái lỗi nghiêm trọng. Tuyệt đối không dùng Sonic Rose cho các nút trang trí hoặc nhãn thông thường.

## Typography

**Display Font:** `Plus Jakarta Sans` (fallback: `"Segoe UI Variable Text", "Segoe UI", -apple-system, sans-serif`)  
**Body Font:** `Plus Jakarta Sans` (fallback: `"Segoe UI", -apple-system, sans-serif`)  
**Label/Mono Font:** `JetBrains Mono` (fallback: `"Cascadia Code", Consolas, monospace`)

**Character:** Sự kết hợp hoàn hảo giữa nét hình học hiện đại, thân thiện, x-height thoáng đãng của Plus Jakarta Sans cho giao tiếp ngôn ngữ tự nhiên, và sự nghiêm cẩn, chính xác từng ký tự của JetBrains Mono cho thông số kỹ thuật, phím bấm và độ trễ.

### Hierarchy
- **Display** (Semibold 600, `18px` / `1.125rem`, line-height `1.3`, tracking `-0.02em`): Tiêu đề chính của các tab cài đặt và các thông báo lớn.
- **Title** (Semibold 600, `14px` / `0.875rem`, line-height `1.4`, tracking `-0.01em`): Tiêu đề thẻ tính năng, tên nhóm thiết lập.
- **Body** (Regular 400 / Medium 500, `13px` / `0.8125rem`, line-height `1.5`): Nội dung giải thích, văn bản dịch thuật, kết quả phiên âm.
- **Label** (Medium 500, `11px-12px`, line-height `1.4`, tracking `0.02em`): Nhãn trạng thái, ghi chú micro, mô tả phụ trợ.
- **Mono / Hotkey Badge** (Semibold 600, `11px`, line-height `1.0`, tracking `+0.04em`, tabular-nums): Ký tự phím tắt (`Ctrl`, `Alt`, `Space`), chỉ số đo độ trễ (`210ms`), dung lượng audio (`108 KB`).

### Named Rules
**The Diacritics Sanctuary Rule.** Mọi thẻ HTML chứa văn bản hiển thị tiếng Việt hoặc dữ liệu nhập liệu không bao giờ được áp dụng `leading-none` hoặc `leading-tight`. Bắt buộc duy trì tối thiểu `leading-normal` (1.5) cùng khoảng cách đệm dọc (`py-2` / 8px) để các dấu hỏi, ngã, nặng, sắc, huyền trên các nguyên âm mở rộng (`ễ`, `ệ`, `ở`, `ứ`) được hiển thị tròn vẹn, không bị xén đỉnh hay đáy.

**The Tabular Telemetry Rule.** Mọi con số biểu thị thời gian, độ trễ, dung lượng hoặc tần số âm thanh phải luôn được render với font `JetBrains Mono` và thuộc tính `tabular-nums` để ngăn hiện tượng giật chiều rộng khi giá trị thay đổi liên tục.

## Layout

Cấu trúc không gian dựa trên hệ lưới module 4px (`4px`, `8px`, `12px`, `16px`, `24px`), tối ưu hóa cho công thái học của người dùng máy tính bàn và độ sắc nét trên màn hình DPI cao.

Hệ thống điều phối 3 bề mặt độc lập:
1. **Settings Dashboard**: Bố cục 2 cột linh hoạt (sidebar cố định `192px - 208px`, khung nội dung co giãn thích ứng). Kích thước cơ sở `720px × 560px` với khả năng mở rộng kích thước mượt mà theo cửa sổ desktop. Bố cục dạng tab ngăn nắp: General, Audio, Models, Providers, History.
2. **Floating Pill Overlay (`overlay`)**: Viên thuốc nổi trung tâm đáy màn hình (`bottom: 64px`), kích thước cố định chiều cao `44px`, chiều rộng co giãn thông minh từ `240px` đến `320px` tùy theo trạng thái (Listening, Processing, Pasted, Error).
3. **Translate Floating Popover (`translate-overlay`)**: Hộp thoại nổi không cướp focus hiển thị ngay cạnh con trỏ chuột khi bấm `Alt+T`, kích thước cơ sở `340px × 150px`, tích hợp thanh cuộn tinh gọn và nút sao chép nhanh 1-chạm.

### Named Rules
**The Fixed Header Anchor Rule.** Khung cửa sổ cài đặt duy trì thanh tiêu đề cố định với nút điều khiển cửa sổ chuẩn Windows (`Minimize`, `Maximize/Restore`, `Close`) và hiển thị trực quan trạng thái lưu tự động (Auto-save Indicator) mà không làm dịch chuyển bố cục bên dưới.

## Elevation & Depth

Hệ thống không sử dụng các bóng đổ đục ngầu truyền thống mà ứng dụng triệt để kỹ thuật **phân tầng quang học (Optical Translucency Layering)** kết hợp hiệu ứng kính mờ Windows 11 Mica & Acrylic.

Độ sâu được kiến tạo qua 4 cấp độ:
- **Canvas Level (0dp)**: Nền sâu nhất `#09090b` của desktop window.
- **Card Surface Level (1dp)**: Nền thẻ `#18181b` với viền `border-zinc-800/80` mảnh 1px tạo giới hạn xúc giác.
- **Interactive Control Level (2dp)**: Ô nhập liệu, dropdown trigger và nút phụ với nền `#27272a` và hiệu ứng hover phản hồi.
- **Floating Ambient Level (3dp / Ambient)**: Các lớp cửa sổ nổi trên màn hình (`win11-acrylic`, `win11-pill`) sử dụng backdrop blur sâu `20px - 24px`, độ bão hòa `180% - 190%`, viền sáng rim light `rgba(255, 255, 255, 0.08 - 0.12)` và bóng đổ khuếch tán rộng `box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.6)`.

### Shadow Vocabulary
- **Acrylic Depth**: `box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.06)` — Dành cho khung cửa sổ và modal.
- **Floating Pill Glow**: `box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.7)` — Dành cho viên thuốc ghi âm nổi trên màn hình.
- **Active Focus Ring**: `box-shadow: 0 0 0 2px #09090b, 0 0 0 4px rgba(16, 185, 129, 0.5)` — Vòng sáng nhận diện tiêu điểm bàn phím.
- **Recording Beacon Halo**: `box-shadow: 0 0 10px rgba(244, 63, 94, 0.8)` — Vầng sáng tỏa xung quanh chấm thu âm đỏ.

### Named Rules
**The Ghost Border Rule.** Mọi thẻ nổi kính mờ bắt buộc phải sở hữu đường viền hairline 1px với màu trắng mờ `rgba(255, 255, 255, 0.08)`. Khi nằm trên nền tối hoặc hình nền desktop đa sắc, viền sáng này đảm bảo phân tách thị giác rõ ràng mà không cần gia tăng bóng đổ đen.

## Shapes

Ngôn ngữ hình khối được định hình bởi sự chuyển tiếp mượt mà giữa các góc bo chuẩn mực công nghệ:
- **Badge & Keybind Glyph (`rounded-md` / 6px)**: Bo góc sắc gọn, mô phỏng phím bấm vật lý của bàn phím cơ.
- **Control & Input (`rounded-lg` / 8px)**: Kích thước bo góc tiêu chuẩn cho các nút tương tác, dropdown menu, ô văn bản và thẻ nhóm cài đặt.
- **Dialog & Sheet Panels (`rounded-xl` / 12px)**: Bo góc êm ái cho các modal lớn và popover tra cứu.
- **Floating Capsule Pill (`rounded-full` / 9999px)**: Dáng viên thuốc hoàn hảo cho `OverlayPill` và các nút chỉ báo trạng thái sóng âm.

## Components

### Buttons
- **Primary Button**: Nền `bg-primary` (`#10b981`), chữ đen sâu `text-zinc-950` font semibold 13px, bo góc `rounded-md`, đệm `px-4 py-2`. Khi hover: độ sáng tăng nhẹ `hover:bg-primary/90`. Khi click: phản hồi micro-scale `active:scale-[0.98]`.
- **Secondary Button**: Nền `bg-zinc-800`, chữ trắng `text-zinc-100`, viền mảnh `border border-zinc-700/60`, hover `hover:bg-zinc-750 hover:text-white`.
- **Ghost Button**: Trong suốt, hover `hover:bg-zinc-800/60`, dành cho các icon thu nhỏ, đóng cửa sổ hoặc sao chép nhanh.
- **Destructive Button**: Nền `bg-rose-950/40`, viền `border-rose-800/60`, chữ `text-rose-300`, hover `hover:bg-rose-900/60`.

### Hotkey Recorder Badge
- **Style**: Nền `bg-zinc-900/90`, viền `border border-zinc-700/80`, chữ `text-zinc-200` hiển thị phông `JetBrains Mono` hoa văn ký tự phím bấm (`Ctrl + Space`, `Right Alt`).
- **State**: Khi kích hoạt chế độ lắng nghe ghi nhận phím: viền đổi sang `border-emerald-500` kèm hiệu ứng nhấp nháy êm dịu và nhãn `"Press keys..."`.

### Inputs & Textareas
- **Style**: Nền `bg-zinc-950/80`, viền `border border-zinc-800`, chữ `text-zinc-100`, placeholder `text-zinc-500`, bo góc `rounded-md`, đệm `px-3 py-2 text-xs`.
- **Focus**: Viền sáng `focus:border-emerald-500/80`, vầng sáng `ring-2 ring-emerald-500/20`.

### Overlay Pill (Signature Component)
- **Cấu trúc**: Viên thuốc `rounded-full` nổi ở trung tâm đáy màn hình, kính mờ `win11-pill`, chiều cao 44px.
- **Listening State**: Chấm tròn `rose-500` phát xung nhịp vầng sáng đỏ bên trái, nhãn `"Listening..."` trắng sáng ở giữa, bên phải là 5 thanh sóng âm thời gian thực chuyển động mềm mại theo độ lớn micro WASAPI (từ 4px đến 20px).
- **Processing State**: Icon `Loader2` màu hổ phách xoay tròn nhẹ nhàng, nhãn `"Polishing grammar..."` kèm hiệu ứng shimmer gradient.
- **Pasted State**: Biểu tượng chữ `Check` màu xanh ngọc lục bảo nhảy lên nhẹ, nhãn `"Pasted!"` và tự động biến mất trong 800ms.

### Translate Popover (Signature Component)
- **Cấu trúc**: Thẻ kính mờ `win11-acrylic` bo góc `rounded-lg`, chia 2 tầng nội dung:
  - Tầng trên: Văn bản gốc nguồn (Source text) thu nhỏ màu xám `text-zinc-400`.
  - Tầng giữa: Bản dịch kết quả (Translated text) chữ sáng rõ `text-zinc-100` kèm thanh cuộn tự động.
  - Tầng đáy: Nút đóng `X` và nút sao chép `Copy` với phản hồi icon `Check` xanh lá khi hoàn tất.

## Do's and Don'ts

### Do:
- **Do** bảo toàn cờ Win32 `WS_EX_NOACTIVATE` trên mọi cửa sổ overlay để đảm bảo 100% không cướp focus ứng dụng đích của người dùng.
- **Do** sử dụng `Plus Jakarta Sans` cho văn bản ngôn ngữ và `JetBrains Mono` cho phím tắt, độ trễ, telemetry.
- **Do** đệm thở tối thiểu `py-2` và dùng `leading-normal` hoặc `leading-relaxed` trên mọi vùng văn bản hiển thị tiếng Việt.
- **Do** sử dụng viền hairline trắng mờ `rgba(255, 255, 255, 0.08)` trên các thành phần kính mờ Fluent Acrylic.
- **Do** phản hồi trạng thái lưu tự động (Auto-save) một cách tinh tế trong sidebar thay vì yêu cầu nút "Save" thủ công cồng kềnh.

### Don't:
- **Don't** áp dụng `leading-none` hoặc `overflow-hidden` gây cắt xén dấu thanh tiếng Việt trên các nguyên âm tiếng Việt.
- **Don't** sử dụng màu sắc rực rỡ ngoài 3 màu ngữ nghĩa cốt lõi (Emerald cho thành công, Rose cho ghi âm/lỗi, Amber cho xử lý/cảnh báo).
- **Don't** tạo hoạt ảnh chuyển động kéo dài vượt quá 200ms; mọi micro-interaction phải kết thúc nhanh gọn (< 150ms) để giữ cảm giác tức thì.
- **Don't** biến đổi clipboard của người dùng mà không có cơ chế hoàn trả lại dữ liệu gốc ngay sau khi inject văn bản.
- **Don't** hardcode chuỗi ký tự hiển thị trực tiếp trong component; bắt buộc gọi qua hook `useI18n()` với các khóa song ngữ đồng bộ trong `vi.json` và `en.json`.
