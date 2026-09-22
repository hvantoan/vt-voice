import {
  DiffToken,
  DiffTokenStatus,
  LocalEvaluationResult,
  StudySentence,
  TargetVocabItem,
} from "./types";

/**
 * Bản đồ mở rộng các dạng viết tắt phổ biến trong tiếng Anh.
 */
const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am",
  "you're": "you are",
  "he's": "he is",
  "she's": "she is",
  "it's": "it is",
  "we're": "we are",
  "they're": "they are",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "i will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "it'll": "it will",
  "we'll": "we will",
  "they'll": "they will",
  "i'd": "i would",
  "you'd": "you would",
  "he'd": "he would",
  "she'd": "she would",
  "we'd": "we would",
  "they'd": "they would",
  "can't": "cannot",
  "cannot": "cannot",
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "won't": "will not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "couldn't": "could not",
  "shouldn't": "should not",
  "wouldn't": "would not",
  "let's": "let us",
  "that's": "that is",
  "there's": "there is",
  "what's": "what is",
  "who's": "who is",
};

/**
 * Loại bỏ dấu câu ở đầu và cuối từ (giữ nguyên ký tự bên trong từ như dấu nháy đơn nếu có).
 */
export function stripPunctuation(word: string): string {
  // Thay thế dấu ngoặc kép cong, dấu nháy đơn cong thành ký tự ASCII chuẩn
  const normalizedApostrophe = word
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
  return normalizedApostrophe.replace(/^['"\W]+|['"\W]+$/g, "");
}
/**
 * Chuẩn hóa một từ đơn lẻ: chuyển chữ thường, bỏ dấu câu viền, mở rộng viết tắt nếu khớp.
 */
export function normalizeWord(word: string): string {
  const stripped = stripPunctuation(word.toLowerCase());
  return CONTRACTIONS[stripped] || stripped;
}

/**
 * Chuẩn hóa toàn bộ câu văn:
 * - Chuyển chữ thường
 * - Chuẩn hóa khoảng trắng
 * - Mở rộng các dạng viết tắt
 * - Loại bỏ các dấu câu ngăn cách thừa
 */
export function normalizeText(text: string): string {
  if (!text) return "";

  // Chuẩn hóa dấu nháy và khoảng trắng
  const cleaned = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .toLowerCase();

  // Tách từng từ, chuẩn hóa và mở rộng viết tắt
  const words = cleaned.split(/\s+/).filter(Boolean);
  const normalizedWords = words.map((w) => {
    const stripped = stripPunctuation(w);
    return CONTRACTIONS[stripped] || stripped;
  });

  return normalizedWords.join(" ").trim();
}

/**
 * Thuật toán Damerau-Levenshtein tính khoảng cách chỉnh sửa giữa 2 chuỗi:
 * Hỗ trợ 4 phép biến đổi: Thêm (Insert), Xóa (Delete), Thay thế (Substitute), và Đảo 2 ký tự kề nhau (Transposition).
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;

  if (al === 0) return bl;
  if (bl === 0) return al;

  // Ma trận dp (al + 2) x (bl + 2)
  const dp: number[][] = [];
  const maxDist = al + bl;

  for (let i = 0; i <= al + 1; i++) {
    dp[i] = new Array(bl + 2).fill(0);
  }

  dp[0][0] = maxDist;
  for (let i = 0; i <= al; i++) {
    dp[i + 1][0] = maxDist;
    dp[i + 1][1] = i;
  }
  for (let j = 0; j <= bl; j++) {
    dp[0][j + 1] = maxDist;
    dp[1][j + 1] = j;
  }

  const lastPos: Record<string, number> = {};

  for (let i = 1; i <= al; i++) {
    let db = 0;
    for (let j = 1; j <= bl; j++) {
      const i1 = lastPos[b[j - 1]] || 0;
      const j1 = db;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      if (cost === 0) db = j;

      dp[i + 1][j + 1] = Math.min(
        dp[i][j + 1] + 1, // Xóa
        dp[i + 1][j] + 1, // Thêm
        dp[i][j] + cost,  // Thay thế
        dp[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1) // Đảo vị trí (Transposition)
      );
    }
    lastPos[a[i - 1]] = i;
  }

  return dp[al + 1][bl + 1];
}

interface RawToken {
  id: number;
  text: string;
  normalized: string;
  startIndex: number;
  endIndex: number;
  isSubToken?: boolean;
}

/**
 * Tách chuỗi thành danh sách token kèm vị trí ký tự đầu/cuối và hỗ trợ mở rộng sub-token viết tắt.
 */
export function extractRawTokens(text: string): RawToken[] {
  const tokens: RawToken[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  let idCounter = 0;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const normalized = normalizeWord(raw);
    const subWords = normalized.split(/\s+/).filter(Boolean);
    const tokenId = ++idCounter;

    if (subWords.length > 1) {
      tokens.push({
        id: tokenId,
        text: raw,
        normalized: subWords[0],
        startIndex: match.index,
        endIndex: match.index + raw.length,
        isSubToken: false,
      });
      for (let k = 1; k < subWords.length; k++) {
        tokens.push({
          id: tokenId,
          text: "",
          normalized: subWords[k],
          startIndex: match.index + raw.length,
          endIndex: match.index + raw.length,
          isSubToken: true,
        });
      }
    } else {
      tokens.push({
        id: tokenId,
        text: raw,
        normalized,
        startIndex: match.index,
        endIndex: match.index + raw.length,
        isSubToken: false,
      });
    }
  }

  return tokens;
}

/**
 * Kiểm tra xem 2 token có phải là typo hay không dựa trên độ dài từ và khoảng cách Damerau-Levenshtein.
 */
export function isTypo(userNorm: string, refNorm: string): boolean {
  if (userNorm === refNorm) return false;
  if (!userNorm || !refNorm) return false;

  const dist = damerauLevenshtein(userNorm, refNorm);
  const maxLen = Math.max(userNorm.length, refNorm.length);
  const lenDiff = Math.abs(userNorm.length - refNorm.length);

  // Nếu độ dài chênh lệch > 1, không coi là lỗi gõ phím đơn thuần
  if (lenDiff > 1) return false;

  // Từ ngắn (<= 4 ký tự): cho phép sai tối đa 1 ký tự
  if (maxLen <= 4) {
    return dist === 1;
  }
  // Từ trung bình (5-6 ký tự): cho phép sai tối đa 1 ký tự
  if (maxLen <= 6) {
    return dist === 1;
  }
  // Từ dài (> 6 ký tự): cho phép sai tối đa 2 ký tự (với lenDiff <= 1)
  return dist <= 2;
}

/**
 * Căn chỉnh hai chuỗi token bằng thuật toán Needleman-Wunsch (Global Sequence Alignment):
 * Tối ưu hóa so khớp từng từ giữa câu người dùng và câu chuẩn.
 */
export function alignTokens(userTokens: RawToken[], refTokens: RawToken[]): DiffToken[] {
  const n = userTokens.length;
  const m = refTokens.length;

  if (n === 0 && m === 0) return [];

  // Nếu người dùng không nhập gì: tất cả ref tokens đều là "missing"
  if (n === 0) {
    return refTokens.map((r) => ({
      text: "",
      expected: r.text,
      status: "missing" as DiffTokenStatus,
      startIndex: 0,
      endIndex: 0,
    }));
  }

  // Nếu câu chuẩn rỗng: tất cả user tokens đều là "extraneous"
  if (m === 0) {
    return userTokens.map((u) => ({
      text: u.text,
      status: "extraneous" as DiffTokenStatus,
      startIndex: u.startIndex,
      endIndex: u.endIndex,
    }));
  }

  // Điểm số căn chỉnh
  const MATCH_SCORE = 4;
  const TYPO_SCORE = 2;
  const MISMATCH_PENALTY = -2;
  const GAP_PENALTY = -2;

  // Bảng tính điểm dp[i][j]
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  // Bảng truy vết: 0=diag, 1=up (delete/extraneous), 2=left (insert/missing)
  const trace: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    score[i][0] = i * GAP_PENALTY;
    trace[i][0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    score[0][j] = j * GAP_PENALTY;
    trace[0][j] = 2;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const uNorm = userTokens[i - 1].normalized;
      const rNorm = refTokens[j - 1].normalized;

      let sim = MISMATCH_PENALTY;
      if (uNorm === rNorm) {
        sim = MATCH_SCORE;
      } else if (isTypo(uNorm, rNorm)) {
        sim = TYPO_SCORE;
      }

      const diag = score[i - 1][j - 1] + sim;
      const up = score[i - 1][j] + GAP_PENALTY;
      const left = score[i][j - 1] + GAP_PENALTY;

      let best = diag;
      let dir = 0; // diag
      if (up > best) {
        best = up;
        dir = 1; // up
      }
      if (left > best) {
        best = left;
        dir = 2; // left
      }

      score[i][j] = best;
      trace[i][j] = dir;
    }
  }

  // Truy vết ngược lại
  let i = n;
  let j = m;
  interface AlignedInternal extends DiffToken {
    userTokenId?: number;
    isSubToken?: boolean;
  }

  const rawAligned: AlignedInternal[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && trace[i][j] === 0) {
      const u = userTokens[i - 1];
      const r = refTokens[j - 1];
      if (u.normalized === r.normalized) {
        rawAligned.push({
          text: u.text,
          expected: r.text,
          status: "correct",
          startIndex: u.startIndex,
          endIndex: u.endIndex,
          userTokenId: u.id,
          isSubToken: u.isSubToken,
        });
      } else if (isTypo(u.normalized, r.normalized)) {
        rawAligned.push({
          text: u.text,
          expected: r.text,
          status: "typo",
          startIndex: u.startIndex,
          endIndex: u.endIndex,
          userTokenId: u.id,
          isSubToken: u.isSubToken,
        });
      } else {
        rawAligned.push({
          text: u.text,
          expected: r.text,
          status: "replaced",
          startIndex: u.startIndex,
          endIndex: u.endIndex,
          userTokenId: u.id,
          isSubToken: u.isSubToken,
        });
      }
      i--;
      j--;
    } else if (i > 0 && (j === 0 || trace[i][j] === 1)) {
      const u = userTokens[i - 1];
      rawAligned.push({
        text: u.text,
        status: "extraneous",
        startIndex: u.startIndex,
        endIndex: u.endIndex,
        userTokenId: u.id,
        isSubToken: u.isSubToken,
      });
      i--;
    } else {
      const r = refTokens[j - 1];
      const nextUserToken = i < n ? userTokens[i] : null;
      const pos = nextUserToken ? nextUserToken.startIndex : userTokens[n - 1]?.endIndex ?? 0;
      rawAligned.push({
        text: "",
        expected: r.text,
        status: "missing",
        startIndex: pos,
        endIndex: pos,
      });
      j--;
    }
  }

  rawAligned.reverse();

  // Hậu xử lý: Hợp nhất các sub-token viết tắt (contractions) có cùng userTokenId
  const finalAligned: DiffToken[] = [];
  const tokenGroups: Record<number, AlignedInternal[]> = {};

  for (const item of rawAligned) {
    if (item.userTokenId !== undefined) {
      if (!tokenGroups[item.userTokenId]) {
        tokenGroups[item.userTokenId] = [];
      }
      tokenGroups[item.userTokenId].push(item);
    }
  }

  const processedGroupIds = new Set<number>();

  for (const item of rawAligned) {
    if (item.userTokenId === undefined) {
      // Token missing từ reference không có userTokenId
      finalAligned.push({
        text: item.text,
        expected: item.expected,
        status: item.status,
        startIndex: item.startIndex,
        endIndex: item.endIndex,
      });
      continue;
    }

    if (processedGroupIds.has(item.userTokenId)) {
      continue;
    }
    processedGroupIds.add(item.userTokenId);

    const group = tokenGroups[item.userTokenId];
    if (group.length === 1) {
      finalAligned.push({
        text: group[0].text,
        expected: group[0].expected,
        status: group[0].status,
        startIndex: group[0].startIndex,
        endIndex: group[0].endIndex,
      });
    } else {
      // Nhóm có nhiều sub-token (do viết tắt)
      const primary = group.find((g) => !g.isSubToken) || group[0];
      const allCorrect = group.every((g) => g.status === "correct");
      const allExpected = group.map((g) => g.expected).filter(Boolean);

      finalAligned.push({
        text: primary.text,
        expected: allExpected.length > 0 ? allExpected.join(" ") : primary.expected,
        status: allCorrect ? "correct" : "replaced",
        startIndex: primary.startIndex,
        endIndex: primary.endIndex,
      });
    }
  }

  return finalAligned;
}
/**
 * Đánh giá bài làm của người dùng so với một câu tham chiếu cụ thể.
 */
export function evaluateAgainstCandidate(
  userTranslation: string,
  reference: string
): {
  score: number;
  isExactMatch: boolean;
  hasTypo: boolean;
  diffTokens: DiffToken[];
} {
  const normUser = normalizeText(userTranslation);
  const normRef = normalizeText(reference);

  const userTokens = extractRawTokens(userTranslation);
  const refTokens = extractRawTokens(reference);

  // 1. Kiểm tra Exact Match sau khi chuẩn hóa
  if (normUser === normRef && normUser.length > 0) {
    const diffTokens = alignTokens(userTokens, refTokens);
    return {
      score: 100,
      isExactMatch: true,
      hasTypo: false,
      diffTokens,
    };
  }

  // 2. Chạy căn chỉnh từng token
  const diffTokens = alignTokens(userTokens, refTokens);

  let correctCount = 0;
  let typoCount = 0;
  let replacedCount = 0;
  let extraneousCount = 0;
  let missingCount = 0;

  for (const token of diffTokens) {
    switch (token.status) {
      case "correct":
        correctCount++;
        break;
      case "typo":
        typoCount++;
        break;
      case "replaced":
        replacedCount++;
        break;
      case "extraneous":
        extraneousCount++;
        break;
      case "missing":
        missingCount++;
        break;
    }
  }

  const totalRefTokens = Math.max(refTokens.length, 1);
  const hasTypo = typoCount > 0;

  // Tính điểm
  // Điểm cơ bản dựa trên tỷ lệ từ đúng và từ typo
  let rawScore = ((correctCount + typoCount * 0.9) / totalRefTokens) * 100;

  // Trừ điểm các lỗi khác
  rawScore -= replacedCount * 12;
  rawScore -= extraneousCount * 8;
  rawScore -= missingCount * 10;

  // Nếu toàn bộ từ đều đúng hoặc typo và không thiếu/thừa từ nào
  if (replacedCount === 0 && extraneousCount === 0 && missingCount === 0) {
    if (typoCount === 0) {
      rawScore = 100;
    } else {
      // 1 typo -> 95, 2 typo -> 90
      rawScore = Math.max(95 - (typoCount - 1) * 5, 80);
    }
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    score: finalScore,
    isExactMatch: false,
    hasTypo,
    diffTokens,
  };
}

/**
 * Trích xuất danh sách các câu tham chiếu (canonical + alternatives) từ StudySentence.
 * Hỗ trợ tương thích ngược với dữ liệu cũ (khi alternatives là null, chuỗi JSON hoặc mảng).
 */
export function extractCandidateReferences(sentence: StudySentence): {
  canonical: string;
  alternatives: string[];
} {
  const canonical = sentence.referenceTranslation?.trim() || "";
  let alternatives: string[] = [];

  if (Array.isArray(sentence.acceptableAlternatives)) {
    alternatives = sentence.acceptableAlternatives.filter((s) => typeof s === "string" && s.trim());
  } else if (typeof sentence.acceptableAlternatives === "string") {
    try {
      const parsed = JSON.parse(sentence.acceptableAlternatives);
      if (Array.isArray(parsed)) {
        alternatives = parsed.filter((s) => typeof s === "string" && s.trim());
      }
    } catch {
      alternatives = [];
    }
  }

  return { canonical, alternatives };
}

/**
 * Trích xuất danh sách TargetVocabItem an toàn từ StudySentence.
 */
export function extractTargetVocab(sentence: StudySentence): TargetVocabItem[] {
  if (Array.isArray(sentence.targetVocab)) {
    return sentence.targetVocab;
  }
  if (typeof sentence.targetVocab === "string") {
    try {
      const parsed = JSON.parse(sentence.targetVocab);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Trích xuất danh sách CommonMistakes an toàn từ StudySentence.
 */
export function extractCommonMistakes(sentence: StudySentence): string[] {
  if (Array.isArray(sentence.commonMistakes)) {
    return sentence.commonMistakes;
  }
  if (typeof sentence.commonMistakes === "string") {
    try {
      const parsed = JSON.parse(sentence.commonMistakes);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Hàm đánh giá chính chạy hoàn toàn tại Client (< 5ms):
 * Đánh giá bài làm của người dùng qua các tầng:
 * 1. Text Normalization & Contractions
 * 2. Exact & Alternative Match (Tier 1)
 * 3. Damerau-Levenshtein Typo Tolerance (Tier 2)
 * 4. Token Diff Alignment & Scoring (Tier 3)
 */
export function evaluateLocalAttempt(
  sentence: StudySentence | null | undefined,
  userTranslation: string
): LocalEvaluationResult {
  const trimmedInput = userTranslation.trim();

  // Fallback an toàn nếu sentence là null hoặc không có đáp án tham chiếu
  if (!sentence) {
    return {
      score: 0,
      isExactMatch: false,
      hasTypo: false,
      diffTokens: [],
      bestReference: "",
      grammarFocus: null,
      commonMistakes: null,
      targetVocab: null,
    };
  }

  const { canonical, alternatives } = extractCandidateReferences(sentence);
  const targetVocab = extractTargetVocab(sentence);
  const commonMistakes = extractCommonMistakes(sentence);

  const candidates = [canonical, ...alternatives].filter(Boolean);

  if (candidates.length === 0) {
    return {
      score: 0,
      isExactMatch: false,
      hasTypo: false,
      diffTokens: [],
      bestReference: "",
      grammarFocus: sentence.grammarFocus ?? null,
      commonMistakes: commonMistakes.length > 0 ? commonMistakes : null,
      targetVocab: targetVocab.length > 0 ? targetVocab : null,
    };
  }

  // Đánh giá lần lượt với từng ứng viên để tìm câu khớp nhất
  let bestResult: LocalEvaluationResult | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const res = evaluateAgainstCandidate(trimmedInput, candidate);
    const isAlt = candidate !== canonical;

    const evalResult: LocalEvaluationResult = {
      score: res.score,
      isExactMatch: res.isExactMatch,
      hasTypo: res.hasTypo,
      diffTokens: res.diffTokens,
      bestReference: candidate,
      matchedAlternative: isAlt && res.score >= 85 ? candidate : undefined,
      grammarFocus: sentence.grammarFocus ?? null,
      commonMistakes: commonMistakes.length > 0 ? commonMistakes : null,
      targetVocab: targetVocab.length > 0 ? targetVocab : null,
    };

    // Nếu đạt 100 điểm tuyệt đối, trả về ngay lập tức
    if (res.isExactMatch || res.score === 100) {
      return evalResult;
    }

    if (res.score > bestScore) {
      bestScore = res.score;
      bestResult = evalResult;
    }
  }

  return (
    bestResult || {
      score: 0,
      isExactMatch: false,
      hasTypo: false,
      diffTokens: [],
      bestReference: canonical,
      grammarFocus: sentence.grammarFocus ?? null,
      commonMistakes: commonMistakes.length > 0 ? commonMistakes : null,
      targetVocab: targetVocab.length > 0 ? targetVocab : null,
    }
  );
}
