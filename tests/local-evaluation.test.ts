import { describe, expect, it } from "bun:test";
import {
  damerauLevenshtein,
  isTypo,
  normalizeText,
  stripPunctuation,
  evaluateLocalAttempt,
  extractCandidateReferences,
} from "../src/components/settings/vocab/localEvaluation";
import { StudySentence } from "../src/components/settings/vocab/types";

describe("localEvaluation Engine", () => {
  describe("Group 1: Normalizer & Contractions", () => {
    it("should normalize lowercase and trim redundant whitespace", () => {
      expect(normalizeText("   Hello    World   ")).toBe("hello world");
    });

    it("should strip punctuation while keeping contraction apostrophes", () => {
      expect(stripPunctuation("Hello,")).toBe("Hello");
      expect(stripPunctuation('"world!"')).toBe("world");
      expect(stripPunctuation("don't")).toBe("don't");
      expect(stripPunctuation("‘test’")).toBe("test");
    });
    it("should preserve Vietnamese Unicode characters when stripping punctuation", () => {
      expect(stripPunctuation("đã,")).toBe("đã");
      expect(stripPunctuation("ở!")).toBe("ở");
      expect(stripPunctuation("‘ý’")).toBe("ý");
      expect(stripPunctuation("...đã...")).toBe("đã");
      expect(normalizeText("Tôi ý à nhà")).not.toBe(normalizeText("Tôi đã ở nhà"));
      expect(normalizeText("Tôi ý à nhà")).toBe("tôi ý à nhà");
      expect(normalizeText("Tôi đã ở nhà")).toBe("tôi đã ở nhà");
    });

    it("should expand common contractions accurately", () => {
      expect(normalizeText("I'm fine, thanks.")).toBe("i am fine thanks");
      expect(normalizeText("Don't worry about it!")).toBe("do not worry about it");
      expect(normalizeText("They'll arrive soon.")).toBe("they will arrive soon");
      expect(normalizeText("She's my best friend.")).toBe("she is my best friend");
      expect(normalizeText("We've done our homework.")).toBe("we have done our homework");
      expect(normalizeText("Can't stop the feeling.")).toBe("cannot stop the feeling");
    });

    it("should handle empty or null string gracefully", () => {
      expect(normalizeText("")).toBe("");
      // @ts-expect-error testing null safety
      expect(normalizeText(null)).toBe("");
    });
  });

  describe("Group 2: Damerau-Levenshtein Distance", () => {
    it("should return 0 for identical strings", () => {
      expect(damerauLevenshtein("hello", "hello")).toBe(0);
      expect(damerauLevenshtein("", "")).toBe(0);
    });

    it("should recognize transposition of adjacent characters with distance 1", () => {
      expect(damerauLevenshtein("teh", "the")).toBe(1);
      expect(damerauLevenshtein("recieve", "receive")).toBe(1);
    });

    it("should recognize single insertion, deletion, and substitution with distance 1", () => {
      expect(damerauLevenshtein("book", "bookk")).toBe(1);
      expect(damerauLevenshtein("book", "bok")).toBe(1);
      expect(damerauLevenshtein("book", "look")).toBe(1);
    });

    it("should correctly identify typo based on length rules", () => {
      // Ultra-short words (<= 2 chars): distance = 0 required, never a typo
      expect(isTypo("he", "me")).toBe(false);
      expect(isTypo("in", "on")).toBe(false);
      expect(isTypo("to", "at")).toBe(false);

      // 3-char words:
      // Real-word pair (cat vs car, bat vs bad): replaced, never a typo
      expect(isTypo("cat", "car")).toBe(false);
      expect(isTypo("bat", "bad")).toBe(false);
      // Non-word typo / transposition (teh vs the): typo
      expect(isTypo("teh", "the")).toBe(true);
      expect(isTypo("ta", "the")).toBe(false);

      // Medium words (4-6 chars): max 1 char distance
      expect(isTypo("aple", "apple")).toBe(true);
      expect(isTypo("applle", "apple")).toBe(true);
      // Long words (> 6 chars): max 2 char distance
      expect(isTypo("postpone", "postponed")).toBe(true);
      expect(isTypo("pospone", "postpone")).toBe(true);
      expect(isTypo("completely", "complete")).toBe(false); // distance = 2, length diff
    });
  });

  describe("Group 3: Token Diff & Alignment", () => {
    const mockSentence: StudySentence = {
      id: "s1",
      sourceLang: "vi",
      targetLang: "en",
      sourceText: "Họ đã hoãn cuộc họp đến thứ Sáu.",
      referenceTranslation: "They postponed the meeting until Friday.",
      acceptableAlternatives: [
        "They delayed the meeting until Friday.",
        "They put off the meeting until Friday.",
      ],
      difficultyLevel: "B1",
      category: "Business",
      origin: "ai_generated",
      createdAt: 1000,
      targetVocab: [
        { word: "postpone", type: "verb", meaning: "hoãn lại" },
      ],
      grammarFocus: "Thì quá khứ đơn",
      commonMistakes: ["Dùng nhầm giới từ to thay vì until"],
    };

    it("TS-02: should evaluate exact match of reference translation with score 100", () => {
      const result = evaluateLocalAttempt(mockSentence, "They postponed the meeting until Friday.");
      expect(result.score).toBe(100);
      expect(result.isExactMatch).toBe(true);
      expect(result.hasTypo).toBe(false);
      expect(result.diffTokens.every((t) => t.status === "correct")).toBe(true);
      expect(result.matchedAlternative).toBeUndefined();
    });

    it("TS-01: should match when user uses contraction or different punctuation", () => {
      const s: StudySentence = {
        ...mockSentence,
        referenceTranslation: "I do not know the answer.",
      };
      const result = evaluateLocalAttempt(s, "I don't know the answer!");
      expect(result.score).toBe(100);
      expect(result.isExactMatch).toBe(true);
    });

    it("TS-03: should match acceptable alternative and set matchedAlternative", () => {
      const result = evaluateLocalAttempt(mockSentence, "They delayed the meeting until Friday.");
      expect(result.score).toBe(100);
      expect(result.matchedAlternative).toBe("They delayed the meeting until Friday.");
      expect(result.bestReference).toBe("They delayed the meeting until Friday.");
    });

    it("TS-04: should tolerate single typo and award 95 points", () => {
      const result = evaluateLocalAttempt(mockSentence, "They postponed teh meeting until Friday.");
      expect(result.score).toBe(95);
      expect(result.hasTypo).toBe(true);
      const typoToken = result.diffTokens.find((t) => t.status === "typo");
      expect(typoToken).toBeDefined();
      expect(typoToken?.text).toBe("teh");
      expect(typoToken?.expected).toBe("the");
    });

    it("TS-05: should detect missing word and extraneous word with token offsets", () => {
      // Missing "the", extraneous "really"
      const result = evaluateLocalAttempt(mockSentence, "They really postponed meeting until Friday.");
      expect(result.score).toBeLessThan(90);
      
      const missingToken = result.diffTokens.find((t) => t.status === "missing");
      expect(missingToken).toBeDefined();
      expect(missingToken?.expected).toBe("the");

      const extraToken = result.diffTokens.find((t) => t.status === "extraneous");
      expect(extraToken).toBeDefined();
      expect(extraToken?.text).toBe("really");
      expect(extraToken?.startIndex).toBeDefined();
      expect(extraToken?.endIndex).toBeDefined();
    });

    it("should detect replaced word", () => {
      const result = evaluateLocalAttempt(mockSentence, "They postponed the concert until Friday.");
      const replacedToken = result.diffTokens.find((t) => t.status === "replaced");
      expect(replacedToken).toBeDefined();
      expect(replacedToken?.text).toBe("concert");
      expect(replacedToken?.expected).toBe("meeting");
    });

    it("TS-P5-06: should treat ultra-short word differences (<= 2 chars) and 3-char real-word differences as replaced, not typo", () => {
      const sShort: StudySentence = {
        id: "s-short",
        sourceLang: "vi",
        targetLang: "en",
        sourceText: "Anh ấy nhìn thấy con mèo.",
        referenceTranslation: "He saw the cat.",
        origin: "test",
        createdAt: 1,
      };

      // "Me saw the car." -> "he" replaced by "me", "cat" replaced by "car"
      const result = evaluateLocalAttempt(sShort, "Me saw the car.");
      expect(result.hasTypo).toBe(false);
      const replacedTokens = result.diffTokens.filter((t) => t.status === "replaced");
      expect(replacedTokens.length).toBe(2);
      expect(replacedTokens[0].text).toBe("Me");
      expect(replacedTokens[0].expected).toBe("He");
      expect(replacedTokens[1].text).toBe("car.");
      expect(replacedTokens[1].expected).toBe("cat.");
    });
  });

  describe("Group 4: Edge Cases & Backward Compatibility", () => {
    it("TS-07: should handle legacy sentence with null/empty fields safely", () => {
      const legacySentence: StudySentence = {
        id: "legacy-1",
        sourceLang: "vi",
        targetLang: "en",
        sourceText: "Xin chào",
        referenceTranslation: null,
        acceptableAlternatives: null,
        difficultyLevel: null,
        category: null,
        origin: "overlay",
        createdAt: 2000,
      };

      const result = evaluateLocalAttempt(legacySentence, "Hello");
      expect(result.score).toBe(0);
      expect(result.isExactMatch).toBe(false);
      expect(result.diffTokens).toEqual([]);
    });

    it("should extract candidate references from JSON string or Array", () => {
      const sWithJson: StudySentence = {
        id: "s-json",
        sourceLang: "en",
        targetLang: "vi",
        sourceText: "Hello",
        referenceTranslation: "Xin chào",
        // @ts-expect-error testing legacy string
        acceptableAlternatives: '["Chào bạn", "Xin chào bạn"]',
        origin: "test",
        createdAt: 1,
      };
      const { canonical, alternatives } = extractCandidateReferences(sWithJson);
      expect(canonical).toBe("Xin chào");
      expect(alternatives).toEqual(["Chào bạn", "Xin chào bạn"]);
    });

    it("should benchmark evaluateLocalAttempt (< 2ms per iteration)", () => {
      const s: StudySentence = {
        id: "perf-1",
        sourceLang: "vi",
        targetLang: "en",
        sourceText: "Họ đã hoãn cuộc họp quan trọng cho đến thứ Sáu tuần sau.",
        referenceTranslation: "They postponed the important meeting until next Friday.",
        acceptableAlternatives: ["They delayed the important meeting until next Friday."],
        origin: "test",
        createdAt: 1,
      };

      const start = performance.now();
      const iterations = 500;
      for (let i = 0; i < iterations; i++) {
        evaluateLocalAttempt(s, "They postponed the important meeting until next Friday.");
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;
      expect(avgMs).toBeLessThan(2.0); // well under 5ms constraint
    });

    it("should handle contractions correctly and avoid index desynchronization", () => {
      const s: StudySentence = {
        id: "contraction-1",
        sourceLang: "vi",
        targetLang: "en",
        sourceText: "Tôi không biết.",
        referenceTranslation: "I do not know.",
        acceptableAlternatives: [],
        origin: "test",
        createdAt: 1,
      };

      // Exact match via contraction
      const resExact = evaluateLocalAttempt(s, "I don't know.");
      expect(resExact.score).toBe(100);
      expect(resExact.isExactMatch).toBe(true);
      expect(resExact.diffTokens.length).toBe(3);
      expect(resExact.diffTokens[0].text).toBe("I");
      expect(resExact.diffTokens[0].status).toBe("correct");
      expect(resExact.diffTokens[1].text).toBe("don't");
      expect(resExact.diffTokens[1].status).toBe("correct");
      expect(resExact.diffTokens[2].text).toBe("know.");
      expect(resExact.diffTokens[2].status).toBe("correct");

      // Extraneous word with contraction: "I don't really know" vs "I do not know"
      const resExtraneous = evaluateLocalAttempt(s, "I don't really know.");
      expect(resExtraneous.score).toBeGreaterThanOrEqual(65);
      const reallyToken = resExtraneous.diffTokens.find((t) => t.text === "really");
      expect(reallyToken?.status).toBe("extraneous");
      const dontToken = resExtraneous.diffTokens.find((t) => t.text === "don't");
      expect(dontToken?.status).toBe("correct");
    });
    it("should maintain consistent scoring weights for contractions and expanded forms", () => {
      const sentence: StudySentence = {
        id: "s-contractions",
        sourceLang: "vi",
        targetLang: "en",
        sourceText: "Tôi khỏe hôm nay",
        referenceTranslation: "I am fine today",
        origin: "manual",
        createdAt: Date.now(),
      };

      const resContracted = evaluateLocalAttempt(sentence, "I'm fine now");
      const resExpanded = evaluateLocalAttempt(sentence, "I am fine now");

      // Both should have identical score (63) and not penalize contraction sub-tokens
      expect(resContracted.score).toBe(resExpanded.score);
      expect(resContracted.score).toBe(63);
    });

    it("should not falsely match completely different Vietnamese sentences with special characters", () => {
      const sentence: StudySentence = {
        id: "s-vi-unicode",
        sourceLang: "en",
        targetLang: "vi",
        sourceText: "I was at home",
        referenceTranslation: "Tôi đã ở nhà",
        origin: "manual",
        createdAt: Date.now(),
      };

      const resWrong = evaluateLocalAttempt(sentence, "Tôi ý à nhà");
      expect(resWrong.isExactMatch).toBe(false);
      expect(resWrong.score).toBeLessThan(100);

      const resRight = evaluateLocalAttempt(sentence, "Tôi đã ở nhà");
      expect(resRight.isExactMatch).toBe(true);
      expect(resRight.score).toBe(100);
    });
  });
});
