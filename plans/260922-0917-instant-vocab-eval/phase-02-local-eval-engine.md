---
title: "Phase 2: Local Instant Evaluation Engine"
status: complete
---

# Phase 2: Local Instant Evaluation Engine

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Pre-requisite: [Phase 1: Pre-generated Packet & SQLite Schema Migration](./phase-01-start.md)
- Target File: `src/components/settings/vocab/localEvaluation.ts`
- Types: `src/components/settings/vocab/types.ts`
- Test File: `tests/local-evaluation.test.ts`

## Overview
- **Priority**: P1 (Core Algorithmic Engine)
- **Status**: Todo
- **Description**: Hiện thực hóa bộ engine đánh giá cục bộ chạy trực tiếp tại client (`localEvaluation.ts`) với độ trễ `< 5ms`. Engine chịu trách nhiệm chuẩn hóa văn bản, phát hiện lỗi chính tả nhẹ (Damerau-Levenshtein), so khớp với đồ thị đáp án (canonical + alternatives) và căn chỉnh từng từ (Myers Token Diff / LCS) để tạo ra dữ liệu tô màu trực quan (Xanh/Đỏ/Vàng/Cam) cho người dùng ngay lập tức.

## Key Insights
- Thuật toán so khớp chuỗi không được quá khắt khe (chỉ so khớp tuyệt đối `===` sẽ làm người học ức chế vì một câu có thể viết tắt `I'm` hoặc `I am`, hoặc dùng dấu chấm/phẩy khác nhau).
- **Damerau-Levenshtein Distance** cho phép phát hiện lỗi gõ phím đảo 2 ký tự liền kề (`teh` $\to$ `the`), điều mà Levenshtein cơ bản không làm được.
- **Myers Diff / LCS** ở cấp độ từ (token-level) chia câu thành các khối từ: Đúng (`correct`), Lỗi gõ nhẹ (`typo`), Sai/thay thế (`replaced`), Thừa (`extraneous`), Thiếu (`missing`).
- Hiệu năng: Xử lý 1 câu 10–20 từ bằng Myers Diff chỉ mất dưới `1ms` trên trình duyệt/webview.

## Requirements
### Functional Requirements
- [ ] Hàm `normalizeText(text: string): string`:
  - Chuyển thành chữ thường (`toLowerCase`).
  - Chuẩn hóa khoảng trắng (`\s+` $\to$ ` `).
  - Loại bỏ dấu câu ở đầu/cuối từ (`. , ! ? ; : " ' ( ) [ ]`).
  - Mở rộng các dạng viết tắt phổ biến trong tiếng Anh:
    - `i'm` $\to$ `i am`, `you're` $\to$ `you are`, `he's` $\to$ `he is`, `she's` $\to$ `she is`, `it's` $\to$ `it is`, `we're` $\to$ `we are`, `they're` $\to$ `they are`
    - `can't` $\to$ `cannot`, `don't` $\to$ `do not`, `doesn't` $\to$ `does not`, `didn't` $\to$ `did not`, `won't` $\to$ `will not`
    - `haven't` $\to$ `have not`, `hasn't` $\to$ `has not`, `hadn't` $\to$ `had not`
    - `i'd` $\to$ `i would`, `i've` $\to$ `i have`, `i'll` $\to$ `i will`.
- [ ] Hàm `damerauLevenshtein(a: string, b: string): number`:
  - Tính toán khoảng cách chỉnh sửa giữa 2 chuỗi với 4 phép biến đổi: Thêm (Insert), Xóa (Delete), Thay thế (Substitute), và Đảo 2 ký tự kề nhau (Transposition).
- [ ] Hàm `myersTokenDiff(userTokens: string[], referenceTokens: string[]): DiffToken[]`:
  - Phân tích và căn chỉnh từng token giữa câu người dùng và câu chuẩn.
  - Phân loại trạng thái từng token:
    - `correct`: Trùng khớp hoàn toàn (sau chuẩn hóa) hoặc tương đương.
    - `typo`: Sai $\le 1$ ký tự với từ ngắn ($\le 5$ ký tự) hoặc $\le 2$ ký tự với từ dài ($> 5$ ký tự).
    - `replaced`: Từ bị thay thế hoặc sai dạng động từ/danh từ (ví dụ `go` thay vì `went`).
    - `extraneous`: Từ thừa mà câu chuẩn không có.
    - `missing`: Từ trong câu chuẩn mà người dùng bỏ sót.
  - **Theo dõi vị trí ký tự (Character Offset Tracking)**: Mỗi `DiffToken` lưu `startIndex` và `endIndex` trong chuỗi gốc của người dùng (`userTranslation`), cho phép `textarea.setSelectionRange(startIndex, endIndex)` tự động bôi đen đúng từ sai trên bàn phím.
- [ ] Hàm `evaluateLocalAttempt(sentence: StudySentence, userTranslation: string): LocalEvaluationResult`:
  - Thu thập danh sách các câu tham chiếu: `[sentence.referenceTranslation, ...(sentence.acceptableAlternatives || [])]`.
  - Chạy so khớp trên từng câu tham chiếu để tìm câu có điểm tương đồng cao nhất.
  - Trả về cấu trúc `LocalEvaluationResult`:
    ```typescript
    export interface LocalEvaluationResult {
      score: number; // 0 - 100
      isExactMatch: boolean;
      hasTypo: boolean;
      diffTokens: DiffToken[];
      bestReference: string;
      matchedAlternative?: string;
      grammarFocus?: string | null;
      commonMistakes?: string[] | null;
      targetVocab?: TargetVocabItem[] | null;
    }
    ```

### Non-functional Requirements
- Tốc độ thực thi: `< 5ms` cho câu dài tối đa 50 từ.
- Không có bất kỳ external dependencies nặng nề nào; thuật toán được viết bằng pure TypeScript, dễ bảo trì và test độc lập.

## Architecture & Algorithm Design

```
User Input: "They postponed meeting until next Friday"
Reference:  "They postponed the meeting until next Friday."
                 │
                 ▼ 1. Normalize & Tokenize
User Tokens: ["they", "postponed", "meeting", "until", "next", "friday"]
Ref Tokens:  ["they", "postponed", "the", "meeting", "until", "next", "friday"]
                 │
                 ▼ 2. Myers Token-level Alignment (LCS)
Tokens Alignment:
- "they"       -> Match (correct - Xanh)
- "postponed"  -> Match (correct - Xanh)
- "the"        -> Missing in User (missing - Vàng đứt)
- "meeting"    -> Match (correct - Xanh)
- "until"      -> Match (correct - Xanh)
- "next"       -> Match (correct - Xanh)
- "friday"     -> Match (correct - Xanh)
                 │
                 ▼ 3. Score Calculation
Matched: 6/7 words. Penalty for missing "the": -10 points.
Final Score: 90/100 ("Tốt! Thiếu mạo từ 'the'").
```

## Related Code Files

### Files to Create
- `src/components/settings/vocab/localEvaluation.ts` - Toàn bộ mã nguồn Engine đánh giá cục bộ.
- `tests/local-evaluation.test.ts` - Suite kiểm thử tự động toàn diện.

### Files to Modify
- `src/components/settings/vocab/types.ts` - Khai báo các interface `DiffToken`, `DiffTokenStatus`, `LocalEvaluationResult`.

## File Inventory Table

| File | Action | Description | Test Impact |
|---|---|---|---|
| `src/components/settings/vocab/localEvaluation.ts` | Create | Engine so khớp, Levenshtein, Myers Diff | Độc lập, test bằng `bun test tests/local-evaluation.test.ts` |
| `src/components/settings/vocab/types.ts` | Modify | Thêm `DiffToken`, `LocalEvaluationResult` | Typecheck `bun run build` |
| `tests/local-evaluation.test.ts` | Create | 25+ unit tests cho các trường hợp biên | Kiểm thử độ chính xác thuật toán |

## Test Scenario Matrix

| ID | Path | Priority | Scenario Description | Expected Outcome |
|---|---|---|---|---|
| TS-P2-01 | Contraction | Critical | `I'm` so với `I am` | Coi như trùng khớp hoàn toàn, score = 100 |
| TS-P2-02 | Punctuation | High | `Hello, world!` so với `hello world` | Chuẩn hóa bỏ dấu câu, score = 100 |
| TS-P2-03 | Typo 1 Char | Critical | `recieved` so với `received` | `status: "typo"`, score = 95, hasTypo = true |
| TS-P2-04 | Transposition | Critical | `teh` so với `the` | Damerau-Levenshtein nhận diện đảo chữ, `status: "typo"` |
| TS-P2-05 | Alternative | High | Trùng với `acceptableAlternatives[1]` | Score = 100, `matchedAlternative` được gán đúng |
| TS-P2-06 | Missing Word | Critical | Thiếu 1 từ mạo từ hoặc giới từ | `status: "missing"`, trừ điểm tỷ lệ |
| TS-P2-07 | Extra Word | Critical | Người dùng gõ thêm từ thừa | `status: "extraneous"`, gạch đỏ từ thừa |
| TS-P2-08 | Replaced Word | High | Dùng sai thì: `went` thay vì `go` | `status: "replaced"`, gợi ý từ chuẩn |

## Todo List
- [ ] Định nghĩa `DiffToken`, `DiffTokenStatus`, `LocalEvaluationResult` trong `types.ts`
- [ ] Viết hàm `normalizeText` với từ điển contraction phổ biến
- [ ] Viết hàm `damerauLevenshtein` với tối ưu ma trận $O(\min(N,M))$
- [ ] Viết hàm `myersTokenDiff` căn chỉnh token
- [ ] Viết hàm `evaluateLocalAttempt` tổng hợp kết quả và tính điểm
- [ ] Viết bộ test `tests/local-evaluation.test.ts` và chạy `bun test` đạt 100% pass

## Success Criteria
- [ ] Hàm `evaluateLocalAttempt` chạy xong dưới `3ms` cho mọi câu kiểm thử.
- [ ] Toàn bộ 25+ assertions trong `tests/local-evaluation.test.ts` vượt qua.
- [ ] Không phụ thuộc vào thư viện bên ngoài (zero external dependency).

## Risk Assessment
- **Risk**: Một số trường hợp câu dịch tiếng Việt có trật tự từ tự do hơn tiếng Anh.
  - *Mitigation*: Khi dịch từ Anh sang Việt (`targetLang === "vi"`), nới lỏng ngưỡng phạt vị trí từ và dựa nhiều hơn vào tập các biến thể `acceptableAlternatives` được sinh sẵn từ Phase 1.

## Security Considerations
- Pure client-side string processing, không thực thi `eval()` hay DOM injection nguy hiểm.

## Next Steps
- Chuyển sang **Phase 3: Instant Feedback & Diagnostic UI** để kết nối Engine này với giao diện `StudyMode.tsx` và tạo component hiển thị `InstantFeedbackPanel.tsx`.
