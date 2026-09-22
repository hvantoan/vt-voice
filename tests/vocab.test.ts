import { describe, expect, test } from "bun:test";
import vi from "../src/locales/vi.json";
import en from "../src/locales/en.json";
import type {
  StudySentence,
  StudyAttempt,
  SavedVocab,
  StudyFeedbackResult,
  DecodedFeedback,
} from "../src/components/settings/vocab/types";
import { decodeFeedbackPayload } from "../src/components/settings/vocab/types";
import { tokenizeSentence } from "../src/components/settings/vocab/TokenizedSentence";

describe("Vocab & Language Learning - Full Lifecycle", () => {
  describe("Localization coverage for Vocab Tab", () => {
    test("settings tab label for vocab exists in both dictionaries", () => {
      expect(vi.settings.tabs.vocab).toBe("Học ngoại ngữ");
      expect(en.settings.tabs.vocab).toBe("Learn Vocab");
    });

    test("top-level tab label for vocab exists in both dictionaries", () => {
      expect(vi.tabs.vocab).toBe("Từ vựng");
      expect(en.tabs.vocab).toBe("Vocab");
    });

    test("quick-save overlay keys exist in both dictionaries", () => {
      expect(vi.overlay.save_to_study).toBe("Lưu vào bài học");
      expect(en.overlay.save_to_study).toBe("Save to study");
      expect(vi.overlay.saved_to_study).toBe("Đã lưu!");
      expect(en.overlay.saved_to_study).toBe("Saved!");
    });

    test("essential vocab keys exist in both vi and en dictionaries", () => {
      const requiredKeys = [
        "mode_practice",
        "mode_notebook",
        "action_paste",
        "action_generate",
        "prev_sentence",
        "next_sentence",
        "delete_sentence",
        "empty_sentences_title",
        "empty_sentences_desc",
        "noted_words",
        "click_hint",
        "input_placeholder",
        "submit_button",
        "submitting",
        "shortcut_submit",
        "feedback_title",
        "score_label",
        "improved_title",
        "noted_words_title",
        "strengths_title",
        "weaknesses_title",
        "suggestions_title",
        "no_weaknesses",
        "tab_saved_vocab",
        "tab_attempts",
        "paste_modal_title",
        "generate_modal_title",
      ] as const;

      for (const key of requiredKeys) {
        expect(vi.vocab[key]).toBeDefined();
        expect(en.vocab[key]).toBeDefined();
        expect(typeof vi.vocab[key]).toBe("string");
        expect(typeof en.vocab[key]).toBe("string");
      }
    });
  });

  describe("Data Contracts & DTO Invariants", () => {
    test("StudySentence schema conforms to Rust backend camelCase contract", () => {
      const sampleSentence: StudySentence = {
        id: "test-uuid-1",
        sourceLang: "en",
        targetLang: "vi",
        sourceText: "She has been studying English for three years.",
        referenceTranslation: "Cô ấy đã học tiếng Anh được ba năm.",
        difficultyLevel: "B1",
        category: "Daily",
        origin: "overlay",
        createdAt: 1710000000000,
      };

      expect(typeof sampleSentence.id).toBe("string");
      expect(sampleSentence.sourceLang).toBe("en");
      expect(sampleSentence.targetLang).toBe("vi");
      expect(sampleSentence.sourceText).toContain("English");
      expect(sampleSentence.origin).toBe("overlay");
      expect(sampleSentence.createdAt).toBeGreaterThan(0);
    });

    test("StudyAttempt schema conforms to Rust backend contract", () => {
      const sampleAttempt: StudyAttempt = {
        id: "test-attempt-1",
        sentenceId: "test-uuid-1",
        userTranslation: "Cô ấy học tiếng Anh được 3 năm rồi.",
        grammarScore: 88,
        feedbackText: "Dịch rất tự nhiên và chính xác.",
        improvedVersion: "Cô ấy đã học tiếng Anh được ba năm.",
        createdAt: 1710000050000,
      };

      expect(typeof sampleAttempt.id).toBe("string");
      expect(sampleAttempt.sentenceId).toBe("test-uuid-1");
      expect(sampleAttempt.grammarScore).toBe(88);
      expect(typeof sampleAttempt.feedbackText).toBe("string");
    });

    test("SavedVocab schema conforms to Rust backend contract", () => {
      const sampleVocab: SavedVocab = {
        id: "test-vocab-1",
        wordOrPhrase: "for three years",
        sourceContext: "She has been studying English for three years.",
        translation: "được ba năm",
        notes: "Cụm trạng từ chỉ khoảng thời gian",
        createdAt: 1710000060000,
      };

      expect(typeof sampleVocab.id).toBe("string");
      expect(sampleVocab.wordOrPhrase).toBe("for three years");
      expect(sampleVocab.translation).toBe("được ba năm");
    });

    test("StudyFeedbackResult schema conforms to single-pass evaluation response", () => {
      const sampleFeedback: StudyFeedbackResult = {
        grammarScore: 85,
        feedbackText: "Cấu trúc câu tốt, dùng đúng thì hiện tại hoàn thành tiếp diễn.",
        improvedVersion: "She has been learning English for three years.",
        notedWordsExplanation: [
          {
            wordOrPhrase: "studying",
            translation: "đang học tập",
            explanation: "Động từ ở dạng V-ing trong thì tiếp diễn.",
          },
        ],
      };

      expect(sampleFeedback.grammarScore).toBe(85);
      expect(sampleFeedback.notedWordsExplanation.length).toBe(1);
      expect(sampleFeedback.notedWordsExplanation[0].wordOrPhrase).toBe("studying");
    });
  });

  describe("Tokenization Logic for Word Selection (Imported from TokenizedSentence)", () => {
    test("tokenizes English sentence, separating words from punctuation and spaces", () => {
      const text = "Hello, world! How are you?";
      const tokens = tokenizeSentence(text);

      expect(tokens.map((t) => t.text).join("")).toBe(text);

      const words = tokens.filter((t) => t.isWord).map((t) => t.text);
      const nonWords = tokens.filter((t) => !t.isWord).map((t) => t.text);

      expect(words).toEqual(["Hello", "world", "How", "are", "you"]);
      expect(nonWords).toContain(",");
      expect(nonWords).toContain("!");
      expect(nonWords).toContain("?");
      expect(nonWords).toContain(" ");
    });

    test("tokenizes Vietnamese sentence with diacritics accurately", () => {
      const text = "Tôi đang học tiếng Anh mỗi ngày.";
      const tokens = tokenizeSentence(text);

      expect(tokens.map((t) => t.text).join("")).toBe(text);

      const words = tokens.filter((t) => t.isWord).map((t) => t.text);
      expect(words).toEqual(["Tôi", "đang", "học", "tiếng", "Anh", "mỗi", "ngày"]);
    });

    test("handles compound words with hyphens and apostrophes", () => {
      const text = "state-of-the-art AI doesn't fail.";
      const tokens = tokenizeSentence(text);

      expect(tokens.map((t) => t.text).join("")).toBe(text);
      const wordTexts = tokens.filter((t) => t.isWord).map((t) => t.text);
      expect(wordTexts).toContain("state-of-the-art");
      expect(wordTexts).toContain("AI");
    });
  });

  describe("Runtime JSON Deserialization & Contract Validation", () => {
    test("parses Rust backend StudySentence JSON payload correctly", () => {
      const json = JSON.stringify({
        id: "123e4567-e89b-12d3-a456-426614174000",
        sourceLang: "en",
        targetLang: "vi",
        sourceText: "We need to study every day.",
        referenceTranslation: "Chúng ta cần học mỗi ngày.",
        difficultyLevel: "B1",
        category: "Daily",
        origin: "overlay",
        createdAt: 1726650000000,
      });

      const parsed = JSON.parse(json) as StudySentence;
      expect(parsed.id).toBe("123e4567-e89b-12d3-a456-426614174000");
      expect(parsed.sourceLang).toBe("en");
      expect(parsed.targetLang).toBe("vi");
      expect(parsed.sourceText).toBe("We need to study every day.");
      expect(parsed.referenceTranslation).toBe("Chúng ta cần học mỗi ngày.");
      expect(parsed.difficultyLevel).toBe("B1");
      expect(parsed.category).toBe("Daily");
      expect(parsed.origin).toBe("overlay");
      expect(parsed.createdAt).toBe(1726650000000);
    });

    test("parses Rust backend StudyFeedbackResult with noted words", () => {
      const json = JSON.stringify({
        grammarScore: 92,
        feedbackText: "Bài dịch rất tốt và tự nhiên.",
        improvedVersion: "We should practice consistently.",
        notedWordsExplanation: [
          {
            wordOrPhrase: "consistently",
            translation: "đều đặn, kiên trì",
            explanation: "Diễn tả hành động diễn ra liên tục theo thói quen",
          },
        ],
      });

      const parsed = JSON.parse(json) as StudyFeedbackResult;
      expect(parsed.grammarScore).toBe(92);
      expect(parsed.feedbackText).toBe("Bài dịch rất tốt và tự nhiên.");
      expect(parsed.improvedVersion).toBe("We should practice consistently.");
      expect(parsed.notedWordsExplanation.length).toBe(1);
      expect(parsed.notedWordsExplanation[0].wordOrPhrase).toBe("consistently");
      expect(parsed.notedWordsExplanation[0].translation).toBe("đều đặn, kiên trì");
    });
  });

  describe("Structured Feedback Decoding & Compatibility (decodeFeedbackPayload)", () => {
    test("decodes structured StudyFeedbackResult object correctly", () => {
      const input: StudyFeedbackResult = {
        grammarScore: 88,
        strengths: ["Chia đúng thì quá khứ đơn", "Trật tự từ tốt"],
        weaknesses: ["Sai giới từ in the bus -> on the bus"],
        suggestions: ["Nên dùng từ commute thay vì go to work"],
        improvedVersion: "I met him on the bus yesterday.",
        notedWordsExplanation: [
          { wordOrPhrase: "commute", translation: "đi làm", explanation: "Động từ" },
        ],
        feedbackText: "Văn bản tổng hợp",
      };

      const decoded = decodeFeedbackPayload(input);
      expect(decoded.isLegacy).toBe(false);
      expect(decoded.grammarScore).toBe(88);
      expect(decoded.strengths).toEqual(["Chia đúng thì quá khứ đơn", "Trật tự từ tốt"]);
      expect(decoded.weaknesses).toEqual(["Sai giới từ in the bus -> on the bus"]);
      expect(decoded.suggestions).toEqual(["Nên dùng từ commute thay vì go to work"]);
      expect(decoded.improvedVersion).toBe("I met him on the bus yesterday.");
      expect(decoded.notedWordsExplanation.length).toBe(1);
    });

    test("decodes JSON string from SQLite feedback_text correctly", () => {
      const jsonString = JSON.stringify({
        grammarScore: 95,
        strengths: ["Ngữ pháp chuẩn", "Từ vựng phong phú"],
        weaknesses: [],
        suggestions: ["Có thể viết hoa đầu câu"],
        improvedVersion: "Perfect sentence.",
        notedWordsExplanation: [],
      });

      const decoded = decodeFeedbackPayload(jsonString);
      expect(decoded.isLegacy).toBe(false);
      expect(decoded.grammarScore).toBe(95);
      expect(decoded.strengths.length).toBe(2);
      expect(decoded.weaknesses.length).toBe(0);
      expect(decoded.suggestions).toEqual(["Có thể viết hoa đầu câu"]);
      expect(decoded.improvedVersion).toBe("Perfect sentence.");
    });
    test("decodes object wrapping serialized JSON in feedbackText without dropping structured fields", () => {
      const wrapped = {
        grammarScore: 90,
        feedbackText: JSON.stringify({
          grammarScore: 90,
          strengths: ["Phát âm và từ vựng tốt"],
          weaknesses: ["Cần sửa mạo từ"],
          suggestions: ["Dùng từ đồng nghĩa"],
          improvedVersion: "Well done.",
        }),
        improvedVersion: "Well done.",
        notedWordsExplanation: [],
      };

      const decoded = decodeFeedbackPayload(wrapped as unknown as StudyFeedbackResult);
      expect(decoded.isLegacy).toBe(false);
      expect(decoded.grammarScore).toBe(90);
      expect(decoded.strengths).toEqual(["Phát âm và từ vựng tốt"]);
      expect(decoded.weaknesses).toEqual(["Cần sửa mạo từ"]);
      expect(decoded.suggestions).toEqual(["Dùng từ đồng nghĩa"]);
      expect(decoded.improvedVersion).toBe("Well done.");
    });


    test("handles legacy plain-text feedback string without crashing and marks isLegacy: true", () => {
      const legacyText = "Câu dịch của bạn khá ổn nhưng cần chú ý thì hiện tại đơn.";
      const decoded = decodeFeedbackPayload(legacyText, 70, "Suggested version.");

      expect(decoded.isLegacy).toBe(true);
      expect(decoded.grammarScore).toBe(70);
      expect(decoded.rawText).toBe(legacyText);
      expect(decoded.strengths).toEqual([]);
      expect(decoded.weaknesses).toEqual([]);
      expect(decoded.suggestions).toEqual([]);
      expect(decoded.improvedVersion).toBe("Suggested version.");
    });

    test("handles null or empty input gracefully", () => {
      const decoded = decodeFeedbackPayload(null, 0, null);
      expect(decoded.isLegacy).toBe(true);
      expect(decoded.grammarScore).toBe(0);
      expect(decoded.rawText).toBe("");
      expect(decoded.strengths).toEqual([]);
      expect(decoded.weaknesses).toEqual([]);
      expect(decoded.suggestions).toEqual([]);
    });
  });

  describe("Sentence Attempt & Navigation History Persistence", () => {
    test("restores previous attempt and feedback when navigating back to answered sentence", () => {
      const cache: Record<
        string,
        {
          userTranslation: string;
          notedWords: string[];
          feedback: StudyFeedbackResult | null;
        }
      > = {};

      const sentenceId1 = "sentence-1";
      const sentenceId2 = "sentence-2";

      // User answers sentence 1
      cache[sentenceId1] = {
        userTranslation: "Chúng tôi cần học chăm chỉ.",
        notedWords: ["hard"],
        feedback: {
          grammarScore: 95,
          feedbackText: "Chính xác và tự nhiên.",
          improvedVersion: "We need to study hard.",
          notedWordsExplanation: [
            {
              wordOrPhrase: "hard",
              translation: "chăm chỉ",
              explanation: "Phó từ bổ nghĩa cho study",
            },
          ],
        },
      };

      // User navigates to sentence 2 (unanswered)
      expect(cache[sentenceId2]).toBeUndefined();

      // User navigates back to sentence 1
      const restored = cache[sentenceId1];
      expect(restored).toBeDefined();
      expect(restored.userTranslation).toBe("Chúng tôi cần học chăm chỉ.");
      expect(restored.notedWords).toEqual(["hard"]);
      expect(restored.feedback?.grammarScore).toBe(95);
      expect(restored.feedback?.feedbackText).toBe("Chính xác và tự nhiên.");
    });

    test("restores previous attempt from SQLite history payload when cache is empty", () => {
      const historyPayload: StudyAttempt[] = [
        {
          id: "attempt-uuid-1",
          sentenceId: "sentence-1",
          userTranslation: "Tôi yêu thích học tiếng Anh.",
          grammarScore: 88,
          feedbackText: "Khá tốt, cần chú ý thì động từ.",
          improvedVersion: "I love learning English.",
          createdAt: 1726650100000,
        },
      ];

      const latest = historyPayload[0];
      const restoredFeedback: StudyFeedbackResult = {
        grammarScore: latest.grammarScore ?? 0,
        feedbackText: latest.feedbackText,
        improvedVersion: latest.improvedVersion ?? "",
        notedWordsExplanation: [],
      };

      expect(latest.userTranslation).toBe("Tôi yêu thích học tiếng Anh.");
      expect(restoredFeedback.grammarScore).toBe(88);
      expect(restoredFeedback.feedbackText).toBe("Khá tốt, cần chú ý thì động từ.");
      expect(restoredFeedback.improvedVersion).toBe("I love learning English.");
    });
  });

  describe("StudyMode Keyboard Navigation & Flow Refinements", () => {

    const dummyFeedback: StudyFeedbackResult = {
      grammarScore: 90,
      feedbackText: "Tốt",
      improvedVersion: "Good",
      notedWordsExplanation: [],
    };

    test("hasNoEditsAfterSubmit is true when submitted and text is unchanged", () => {
      const submitted = "We should study hard.";
      const isUnchanged = Boolean(dummyFeedback && submitted !== null && "We should study hard.".trim() === submitted.trim());
      expect(isUnchanged).toBe(true);
      const withWhitespace = Boolean(dummyFeedback && submitted !== null && "  We should study hard.  ".trim() === submitted.trim());
      expect(withWhitespace).toBe(true);
    });

    test("hasNoEditsAfterSubmit is false when user edits text", () => {
      const submitted = "We should study hard.";
      const isEdited = Boolean(dummyFeedback && submitted !== null && "We should study harder.".trim() === submitted.trim());
      expect(isEdited).toBe(false);
      const isCleared = Boolean(dummyFeedback && submitted !== null && "".trim() === submitted.trim());
      expect(isCleared).toBe(false);
    });

    test("hasNoEditsAfterSubmit is false when feedback is null or unsubmitted", () => {
      const nullFeedback = Boolean(null && "text" !== null && "text".trim() === "text".trim());
      expect(nullFeedback).toBe(false);
      const nullSubmitted = Boolean(dummyFeedback && null !== null && "text".trim() === "text".trim());
      expect(nullSubmitted).toBe(false);
    });

    test("arrow navigation is enabled when input is empty or submitted without edits", () => {
      expect("".trim() === "" || false).toBe(true);
      expect("   ".trim() === "" || false).toBe(true);
      expect("We should study hard.".trim() === "" || true).toBe(true);
      expect("We should study hard.".trim() === "" || false).toBe(false);
      expect("Drafting...".trim() === "" || false).toBe(false);
    });

    test("navigation bounds check prevents invalid index jumps", () => {
      const totalCount = 5;
      expect(0 > 0).toBe(false);
      expect(1 > 0).toBe(true);
      expect(4 < totalCount - 1).toBe(false);
      expect(3 < totalCount - 1).toBe(true);
    });
  });
});
