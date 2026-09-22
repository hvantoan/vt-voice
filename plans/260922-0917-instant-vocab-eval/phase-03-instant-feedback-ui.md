---
title: "Phase 3: Instant Feedback & Diagnostic UI"
status: complete
---

# Phase 3: Instant Feedback & Diagnostic UI

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Pre-requisites: [Phase 1: Pre-generated Packet](./phase-01-start.md), [Phase 2: Local Evaluation Engine](./phase-02-local-eval-engine.md)
- Target Component: `src/components/settings/vocab/InstantFeedbackPanel.tsx`
- Container Component: `src/components/settings/vocab/StudyMode.tsx`
- i18n Dictionaries: `src/locales/vi.json`, `src/locales/en.json`

## Overview
- **Priority**: P1 (User Experience & Visual Polish)
- **Status**: Todo
- **Description**: Xây dựng giao diện phản hồi tức thì `InstantFeedbackPanel.tsx` và tích hợp vào `StudyMode.tsx`. Khi người dùng gõ câu dịch và nhấn `Enter`, giao diện hiển thị ngay lập tức trong `< 5ms` mà không có spinner xoay. Giao diện trực quan hóa lỗi sai bằng màu sắc (Token Diff), hiển thị điểm số, câu sửa mẫu, từ vựng trọng tâm và bẫy ngữ pháp có sẵn.

## Key Insights
- Phản xạ học từ vựng phụ thuộc vào **vòng lặp phản hồi tức thì (Instant Feedback Loop)**: Gõ $\to$ Enter $\to$ Thấy kết quả ngay $\to$ Ghi nhớ lỗi $\to$ Enter sang câu tiếp theo.
- Token Diff trực quan giúp người học nhận ra lỗi sai chỉ trong 1 giây lướt nhìn (thay vì phải đọc đoạn văn bản nhận xét dài dòng từ AI).
- Phím tắt `Enter` thông minh:
  - Khi chưa nộp: `Enter` $\to$ Chấm bài tức thì.
  - Khi đã có kết quả và không sửa: `Enter` $\to$ Chuyển ngay sang câu tiếp theo.
  - Nhờ đó, người học có thể lướt qua hàng chục câu bài tập với tốc độ cao.

## Requirements
### Functional Requirements
- [ ] Tạo component `InstantFeedbackPanel.tsx`:
  - **Header & Score Badge**:
    - `Score >= 95`: Huy hiệu Xanh lá (`emerald`) - "Hoàn hảo" / "Chính xác".
    - `Score 85 - 94`: Huy hiệu Xanh ngọc (`teal`) - "Lỗi gõ nhẹ" (kèm vị trí typo).
    - `Score 65 - 84`: Huy hiệu Vàng hổ phách (`amber`) - "Khá tốt, cần lưu ý".
    - `Score < 65`: Huy hiệu Đỏ hồng (`rose`) - "Cần xem lại".
  - **Visual Token Diff Container**:
    - Hiển thị từng từ trong câu với style chuyên biệt:
      - `correct`: Chữ trắng/xanh lá, nền nhẹ `bg-emerald-950/40 text-emerald-300 border-emerald-500/30`.
      - `typo`: Chữ vàng chanh, gạch chân nét sóng, hover hiện từ đúng.
      - `replaced`: Chữ cam gạch ngang, theo sau bởi từ đúng trong ngoặc vuông màu xanh `[went]`.
      - `extraneous`: Chữ đỏ gạch ngang `line-through text-rose-400 bg-rose-950/40`.
      - `missing`: Khung viền đứt nét màu vàng hiển thị từ bị thiếu `border-dashed border-amber-500/60 text-amber-300`.
  - **Reference Translation**:
    - Hiển thị câu chuẩn (`canonicalAnswer`).
    - Nếu khớp với biến thể (`matchedAlternative`), hiển thị nhãn: *"Khớp với cách diễn đạt tương đương: ..."*.
  - **Target Vocabulary Pills**:
    - Hiển thị các từ vựng mục tiêu (`targetVocab`) dưới dạng tag tương tác (click để xem nghĩa/từ loại).
  - **Diagnostic Hints & Grammar Focus**:
    - Nếu câu có `grammarFocus` hoặc `commonMistakes`, hiển thị khối lưu ý nhỏ gọn có thể thu gọn/mở rộng.
  - **Cơ chế Sửa lỗi & Thay thế Tương tác (Interactive Word Correction & Replace)**:
    - **Click để Thay thế (One-Click Replace)**: Khi một từ bị sai (`replaced`) hoặc thiếu (`missing`), từ gợi ý đúng màu xanh hiển thị ngay phía trên/bên cạnh. Người dùng chỉ cần click vào từ gợi ý đó $\to$ Tự động thay thế/chèn đúng từ đó vào ô `textarea` mà không cần xóa gõ lại cả câu!
    - **Tự động Bôi đen & Nhảy con trỏ tới từ sai (Auto-Jump Caret to Error)**: Ngay khi nhấn `Enter` và phát hiện có từ sai/thiếu, con trỏ trong `textarea` **tự động nhảy về và bôi đen (select) đúng từ sai đầu tiên** (`textarea.setSelectionRange(token.startIndex, token.endIndex)`). Người dùng chỉ cần gõ là chữ mới sẽ đè lên chữ cũ ngay, không cần rời tay sang chuột.
    - **Điều hướng Bàn phím Thông minh**:
      - Dùng mũi tên `ArrowLeft` / `ArrowRight` để di chuyển con trỏ trong ô nhập.
      - Dùng `Tab` / `Shift+Tab` để nhảy nhanh giữa các từ bị lỗi (Next/Prev Error Token).
      - Sau khi sửa từ sai, nhấn `Enter` $\to$ **Recheck tức thì (< 5ms)**:
        - Nếu vẫn còn từ sai tiếp theo: Con trỏ tự động nhảy sang từ sai kế tiếp.
        - Nếu toàn bộ câu đã đúng (hoặc $\ge 85$ điểm): Câu chuyển sang màu xanh hoàn hảo, nhấn `Enter` lần nữa để **chuyển sang câu mới**!
      - Phím tắt bỏ qua: `Ctrl + ArrowRight` để chuyển câu mới ngay cả khi chưa sửa hết lỗi.
  - **Action Bar**:
    - Nút sao chép câu chuẩn (`Copy`).
    - Nút *"Hỏi AI chi tiết"* (`Sparkles` icon) để mở phân tích chuyên sâu nếu muốn.
    - Hướng dẫn phím tắt linh hoạt:
      - Nếu câu đã đúng ($\ge 85$ điểm): *"↵ Nhấn Enter để sang câu tiếp theo"*.
      - Nếu câu còn sai: *"↵ Sửa từ sai rồi nhấn Enter để chấm lại (hoặc Ctrl+→ để bỏ qua)"*.
- [ ] Tích hợp vào `StudyMode.tsx`:
  - Thêm state `localResult: LocalEvaluationResult | null`.
  - Cập nhật hàm `handleKeyDown` trên `textarea`:
    - `e.key === "Enter"` (khi không giữ Shift):
      - Nếu `!localResult`: Gọi `evaluateLocalAttempt(sentence, userTranslation)` $\to$ Lưu vào `localResult` $\to$ Hiển thị `InstantFeedbackPanel`.
      - Nếu `localResult` đã có và người dùng không sửa text: Gọi `handleNextSentence()`.
  - Khi người dùng gõ phím thay đổi nội dung (`handleTranslationChange`): Reset `localResult` về `null` để người dùng có thể nộp bài lại.

### Non-functional Requirements
- Tương thích kích thước cửa sổ Settings `720x560` (không bị vỡ layout hoặc tràn màn hình).
- Đảm bảo đệm dọc (`py-1.5` / `py-2`) cho văn bản tiếng Việt để tránh cắt dấu thanh (tuân thủ quy chuẩn `AGENTS.md`).

## Component Mockup & Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│ [95/100 - CHÍNH XÁC (TYPO)]               [Sao chép] [Hỏi AI]│
├──────────────────────────────────────────────────────────────┤
│ Bạn dịch:                                                    │
│ [They] [postponed] [teh (typo)] [meeting] [until] [Friday]   │
│                                                              │
│ Đáp án chuẩn:                                                │
│ They postponed the meeting until next Friday.                │
├──────────────────────────────────────────────────────────────┤
│ 📚 Từ vựng trọng tâm:                                        │
│ [postpone (v): hoãn lại]  [put off (phr v): trì hoãn]       │
│                                                              │
│ 💡 Lưu ý ngữ pháp:                                           │
│ • Thì quá khứ đơn; chú ý dùng 'until' thay vì 'to'.          │
├──────────────────────────────────────────────────────────────┤
│ ↵ Nhấn Enter để sang câu tiếp theo                           │
└──────────────────────────────────────────────────────────────┘
```

## Related Code Files

### Files to Create
- `src/components/settings/vocab/InstantFeedbackPanel.tsx`

### Files to Modify
- `src/components/settings/vocab/StudyMode.tsx`
- `src/locales/vi.json` & `src/locales/en.json`

## File Inventory Table

| File | Action | Description | Test Impact |
|---|---|---|---|
| `src/components/settings/vocab/InstantFeedbackPanel.tsx` | Create | Component hiển thị kết quả tức thì và Token Diff | React component rendering |
| `src/components/settings/vocab/StudyMode.tsx` | Modify | Tích hợp instant evaluation và phím tắt Enter | End-to-end study flow |
| `src/locales/vi.json` | Modify | Thêm các key từ vựng, điểm số, gợi ý | Parity test `tests/i18n.test.ts` |
| `src/locales/en.json` | Modify | Thêm các key tương ứng tiếng Anh | Parity test `tests/i18n.test.ts` |

## Test Scenario Matrix

| ID | Path | Priority | Scenario Description | Expected Outcome |
|---|---|---|---|---|
| TS-P3-01 | Instant Render | Critical | Gõ câu dịch và nhấn `Enter` | `InstantFeedbackPanel` xuất hiện tức thì trong `< 5ms` |
| TS-P3-02 | Visual Diff Color | Critical | Câu có 1 từ đúng, 1 từ sai, 1 từ thiếu | Mỗi token được gán đúng màu và class CSS |
| TS-P3-03 | Next on Enter | Critical | Đã có kết quả, nhấn `Enter` lần 2 | Chuyển ngay sang câu tiếp theo |
| TS-P3-04 | Edit Invalidation | High | Sửa lại câu dịch sau khi đã chấm | `InstantFeedbackPanel` biến mất, cho phép chấm lại |
| TS-P3-05 | Responsive 720x560 | High | Hiển thị trong cửa sổ Settings nhỏ | Không xuất hiện thanh cuộn ngang, text không bị cắt dấu |

## Todo List
- [ ] Xây dựng component `InstantFeedbackPanel.tsx` với đầy đủ các section
- [ ] Tích hợp `evaluateLocalAttempt` vào hàm xử lý phím tắt `Enter` trong `StudyMode.tsx`
- [ ] Thêm các chuỗi bản dịch song ngữ vào `vi.json` và `en.json`
- [ ] Đảm bảo chuyển đổi mượt mà giữa trạng thái tức thì và trạng thái chỉnh sửa
- [ ] Kiểm tra hiển thị responsive trên giao diện thực tế

## Success Criteria
- [ ] Nhấn `Enter` phản hồi ngay lập tức, không có bất kỳ trạng thái loading spinner nào ở luồng chính.
- [ ] Các token màu sắc hiển thị rõ ràng, dễ phân biệt giữa đúng, sai, thừa, thiếu.
- [ ] Nhấn `Enter` lần 2 chuyển câu mượt mà, giữ vững nhịp độ học tập.

## Risk Assessment
- **Risk**: Người dùng bấm nhầm phím `Enter` khi đang muốn xuống dòng trong ô dịch.
  - *Mitigation*: Hướng dẫn rõ ràng phím tắt: `Shift+Enter` để xuống dòng (nếu cần), `Enter` để nộp bài hoặc sang câu.

## Security Considerations
- Tất cả các token văn bản của người dùng được escape và render an toàn qua JSX, không dùng `dangerouslySetInnerHTML`.

## Next Steps
- Chuyển sang **Phase 4: On-Demand Deep AI & Attempt Persistence** để kết nối nút "Hỏi AI chi tiết" và tự động lưu lịch sử bài tập vào SQLite.
