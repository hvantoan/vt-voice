---
title: "Phase 4: Frontend Vocab Tab in Settings (720x560)"
status: complete
priority: P1
effort: 4h
---

# Phase 4: Frontend Vocab Tab in Settings (720x560)

## Overview

Tích hợp tab **Vocab** vào cửa sổ Cài đặt chính (`SettingsLayout.tsx` trong cửa sổ `main` 720x560). Xây dựng component `VocabTab.tsx` với trải nghiệm học tập dịch ngược hoàn chỉnh: tương tác chọn từ (Click / Ctrl+Click), ô gõ bài dịch nhận focus bình thường, hiển thị feedback 3 phần trực quan, và giao diện quản lý Sổ tay từ vựng + Lịch sử bài tập.

## UI/UX Design & 720x560 Invariants

1. **Bảo toàn bố cục 720x560**: Cửa sổ có kích thước cố định, vì vậy vùng nội dung bài học dùng `h-[460px] flex flex-col` với thanh cuộn `ScrollArea` mượt mà, không làm vỡ các thanh tab của Settings.
2. **Tab Trigger**:
   - Thêm vào danh sách tab của Settings:
     ```tsx
     <TabsTrigger value="vocab" className="...">
       <BookOpen className="w-4 h-4 mr-2" />
       {t("tabs.vocab")}
     </TabsTrigger>
     ```
3. **Sub-Navigation trong VocabTab**:
   - Chuyển đổi giữa 2 chế độ bằng Segmented Control nhỏ gọn:
     - **Luyện tập (Practice)**: Luồng dịch câu và nhận feedback.
     - **Sổ tay từ vựng (Notebook)**: Quản lý từ đã lưu và lịch sử bài làm.

## Key Component Architecture

```
src/components/settings/
├── SettingsLayout.tsx          # Thêm tab "vocab"
└── vocab/
    ├── VocabTab.tsx            # Component gốc quản lý state
    ├── StudyMode.tsx           # Giao diện luyện dịch, tokenized sentence, input & feedback
    ├── TokenizedSentence.tsx   # Tách từ, xử lý Click / Ctrl+Click đa chọn
    ├── FeedbackPanel.tsx       # Hiển thị 3 phần: Điểm/Ngữ pháp - Câu gợi ý - Từ đã note
    ├── VocabNotebook.tsx       # Danh sách từ vựng đã lưu kèm ngữ cảnh
    ├── AttemptHistory.tsx      # Lịch sử các bài tập đã nộp
    ├── PasteSentencesModal.tsx # Dialog dán đoạn văn
    └── GenerateSentencesModal.tsx # Dialog chọn Topic/Level để AI sinh câu
```

## Related Code Files

### Files to Modify
- `src/components/settings/SettingsLayout.tsx`: Thêm `type TabId = ... | "vocab"`, tab trigger `BookOpen` và nội dung tab `VocabTab`.

### Files to Create
- `src/components/settings/vocab/VocabTab.tsx`
- `src/components/settings/vocab/StudyMode.tsx`
- `src/components/settings/vocab/TokenizedSentence.tsx`
- `src/components/settings/vocab/FeedbackPanel.tsx`
- `src/components/settings/vocab/VocabNotebook.tsx`
- `src/components/settings/vocab/PasteSentencesModal.tsx`
- `src/components/settings/vocab/GenerateSentencesModal.tsx`

## Implementation Steps

1. **TokenizedSentence Interaction**:
   - Tách chuỗi câu nguồn thành các token bằng regex: `sourceText.split(/(\s+|[.,!?;:"'()]+)/)`.
   - Lưu trạng thái: `selectedIndices: Set<number>`.
   - Sự kiện click trên từng token:
     - Nếu `e.ctrlKey || e.metaKey`: thêm hoặc loại bỏ token khỏi `Set`.
     - Nếu click thông thường: nếu từ chưa được chọn thì xóa các từ khác và chỉ chọn từ đó (single select); nếu đã được chọn thì bỏ chọn.
   - Hiển thị danh sách các từ đang được note dưới dạng Badges để người dùng xem lại trước khi nộp.
2. **Translation Input & Submit**:
   - Textarea có auto-focus, hỗ trợ tổ hợp phím `Ctrl + Enter` để nộp bài.
   - Nút Nộp bài hiển thị trạng thái `isSubmitting` với spinner.
3. **Feedback 3 Phần (FeedbackPanel)**:
   - **Thẻ 1 - Điểm số & Đánh giá**: Điểm số kèm màu sắc (Xanh >80, Vàng 60-80, Cam <60) và nhận xét ngữ pháp.
   - **Thẻ 2 - Câu dịch cải thiện**: Hiển thị câu tự nhiên hơn kèm nút copy vào clipboard.
   - **Thẻ 3 - Từ vựng đã note**: Hiển thị bảng từ vựng gồm: Từ/Cụm từ, Nghĩa tiếng Việt, và Giải thích ngữ cảnh.
4. **Vocab Notebook (Sổ tay từ vựng)**:
   - Truy vấn `get_saved_vocab` khi mở view.
   - Hiển thị danh sách từ, câu ngữ cảnh gốc và ngày lưu.
   - Hỗ trợ xóa từ với nút thùng rác gọi IPC `delete_saved_vocab`.
5. **Dán đoạn văn & AI sinh câu**:
   - Modal dán text: nhập văn bản -> gọi `save_pasted_sentences` -> tự động nạp câu đầu tiên vào phiên học.
   - Modal AI sinh câu: chọn Topic (Daily, Tech, Business...) & Level (A1-C2) -> gọi `generate_study_sentences` -> nạp câu mới.

## Todo

- [X] Cập nhật `SettingsLayout.tsx` thêm tab `vocab` và icon `BookOpen`.
- [X] Tạo các component trong thư mục `src/components/settings/vocab/`.
- [X] Xây dựng tương tác Click / Ctrl+Click tách từ trên `TokenizedSentence.tsx`.
- [X] Xây dựng bảng hiển thị feedback 3 phần trên `FeedbackPanel.tsx`.
- [X] Tích hợp Sổ tay từ vựng `VocabNotebook.tsx` với tính năng xóa từ.
- [X] Tích hợp 2 modal: dán đoạn văn và AI sinh câu theo chủ đề.
- [X] Kiểm tra responsive và thanh cuộn trong kích thước 720x560.

## Success Criteria

- Tab Vocab hiển thị cân đối và hòa nhập vào giao diện chung của Settings.
- Tương tác Click và Ctrl+Click mượt mà, từ được highlight chính xác.
- Ô gõ bài dịch nhận focus bình thường, không đâm xuyên phím ra ngoài.
- Nộp bài hiển thị đầy đủ 3 phần feedback; từ đã note tự động xuất hiện trong Sổ tay từ vựng.
