export interface TargetVocabItem {
  word: string;
  type?: string;
  meaning: string;
}

export interface StudySentence {
  id: string;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  referenceTranslation?: string | null;
  difficultyLevel?: string | null;
  category?: string | null;
  origin: string;
  createdAt: number;
  acceptableAlternatives?: string[] | null;
  targetVocab?: TargetVocabItem[] | null;
  grammarFocus?: string | null;
  commonMistakes?: string[] | null;
}

export interface StudyAttempt {
  id: string;
  sentenceId?: string | null;
  userTranslation: string;
  grammarScore?: number | null;
  feedbackText: string;
  improvedVersion?: string | null;
  createdAt: number;
}

export interface SavedVocab {
  id: string;
  wordOrPhrase: string;
  sourceContext?: string | null;
  translation?: string | null;
  notes?: string | null;
  createdAt: number;
}

export interface NotedWordExplanation {
  wordOrPhrase: string;
  translation: string;
  explanation: string;
}

export interface StudyFeedbackResult {
  grammarScore: number;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  feedbackText: string;
  improvedVersion: string;
  notedWordsExplanation: NotedWordExplanation[];
}

export interface DecodedFeedback {
  grammarScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  improvedVersion: string;
  notedWordsExplanation: NotedWordExplanation[];
  rawText: string;
  isLegacy: boolean;
}

export type DiffTokenStatus = "correct" | "typo" | "replaced" | "extraneous" | "missing";

export interface DiffToken {
  text: string;
  expected?: string;
  status: DiffTokenStatus;
  startIndex?: number;
  endIndex?: number;
}

export interface LocalEvaluationResult {
  score: number;
  isExactMatch: boolean;
  hasTypo: boolean;
  diffTokens: DiffToken[];
  bestReference: string;
  matchedAlternative?: string;
  grammarFocus?: string | null;
  commonMistakes?: string[] | null;
  targetVocab?: TargetVocabItem[] | null;
}

/**
 * Giải mã chuỗi feedback_text từ SQLite hoặc đối tượng StudyFeedbackResult từ AI IPC.
 * Tự động phân biệt giữa cấu trúc JSON mới (3 phần) và văn bản thuần cũ (legacy).
 */
export function decodeFeedbackPayload(
  rawOrResult: string | StudyFeedbackResult | null | undefined,
  fallbackScore?: number | null,
  fallbackImproved?: string | null
): DecodedFeedback {
  if (!rawOrResult) {
    return {
      grammarScore: fallbackScore ?? 0,
      strengths: [],
      weaknesses: [],
      suggestions: [],
      improvedVersion: fallbackImproved ?? "",
      notedWordsExplanation: [],
      rawText: "",
      isLegacy: true,
    };
  }

  // Trường hợp 1: Đầu vào đã là object StudyFeedbackResult
  if (typeof rawOrResult === "object") {
    const raw = rawOrResult as Partial<StudyFeedbackResult> & {
      grammar_score?: number;
      feedback_text?: string;
      improved_version?: string;
      noted_words_explanation?: NotedWordExplanation[];
    };
    const strengths = Array.isArray(raw.strengths) ? raw.strengths : [];
    const weaknesses = Array.isArray(raw.weaknesses) ? raw.weaknesses : [];
    const suggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];
    if (strengths.length === 0 && weaknesses.length === 0 && suggestions.length === 0) {
      const candidate = (raw.feedbackText || raw.feedback_text || "").trim();
      if (candidate.startsWith("{") && candidate.endsWith("}")) {
        return decodeFeedbackPayload(
          candidate,
          raw.grammarScore ?? raw.grammar_score ?? fallbackScore,
          raw.improvedVersion || raw.improved_version || fallbackImproved
        );
      }
    }
    const isLegacy = strengths.length === 0 && weaknesses.length === 0 && suggestions.length === 0;
    return {
      grammarScore: raw.grammarScore ?? raw.grammar_score ?? fallbackScore ?? 0,
      strengths,
      weaknesses,
      suggestions,
      improvedVersion: raw.improvedVersion || raw.improved_version || fallbackImproved || "",
      notedWordsExplanation: Array.isArray(raw.notedWordsExplanation)
        ? raw.notedWordsExplanation
        : Array.isArray(raw.noted_words_explanation)
        ? raw.noted_words_explanation
        : [],
      rawText: raw.feedbackText || raw.feedback_text || "",
      isLegacy,
    };
  }

  // Trường hợp 2: Đầu vào là chuỗi (từ SQLite feedback_text)
  const trimmed = rawOrResult.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const strengths = Array.isArray(parsed.strengths) ? (parsed.strengths as string[]) : [];
      const weaknesses = Array.isArray(parsed.weaknesses) ? (parsed.weaknesses as string[]) : [];
      const suggestions = Array.isArray(parsed.suggestions) ? (parsed.suggestions as string[]) : [];
      const isLegacy = strengths.length === 0 && weaknesses.length === 0 && suggestions.length === 0;

      const grammarScore =
        typeof parsed.grammarScore === "number"
          ? parsed.grammarScore
          : typeof parsed.grammar_score === "number"
          ? parsed.grammar_score
          : fallbackScore ?? 0;

      const improvedVersion =
        typeof parsed.improvedVersion === "string"
          ? parsed.improvedVersion
          : typeof parsed.improved_version === "string"
          ? parsed.improved_version
          : fallbackImproved ?? "";

      const rawText =
        typeof parsed.feedbackText === "string"
          ? parsed.feedbackText
          : typeof parsed.feedback_text === "string"
          ? parsed.feedback_text
          : "";

      const rawVocab = Array.isArray(parsed.notedWordsExplanation)
        ? parsed.notedWordsExplanation
        : Array.isArray(parsed.noted_words_explanation)
        ? parsed.noted_words_explanation
        : [];

      return {
        grammarScore,
        strengths,
        weaknesses,
        suggestions,
        improvedVersion,
        notedWordsExplanation: rawVocab as NotedWordExplanation[],
        rawText,
        isLegacy,
      };
    } catch {
      // Nếu không parse được JSON, fallback về text thông thường
    }
  }

  // Dữ liệu text cũ
  return {
    grammarScore: fallbackScore ?? 0,
    strengths: [],
    weaknesses: [],
    suggestions: [],
    improvedVersion: fallbackImproved ?? "",
    notedWordsExplanation: [],
    rawText: trimmed,
    isLegacy: true,
  };
}
