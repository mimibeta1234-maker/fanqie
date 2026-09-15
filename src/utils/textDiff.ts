export interface ChapterDiff {
  chapterNumber: number;
  titleA: string;
  titleB: string;
  contentA: string;
  contentB: string;
  charCountA: number;
  charCountB: number;
  similarityScore: number; // 0 to 100
  editPercentage: number;   // 0 to 100 (100 - similarityScore)
  matchedStatus: 'both' | 'only_a' | 'only_b';
  diffChunks: DiffChunk[];
}

export interface DiffChunk {
  type: 'equal' | 'insert' | 'delete';
  value: string;
}

export interface OverallComparison {
  totalChaptersA: number;
  totalChaptersB: number;
  pairedChaptersCount: number;
  totalCharsA: number;
  totalCharsB: number;
  overallSimilarity: number; // 0 to 100
  overallEditPercentage: number; // 0 to 100
  addedChars: number;
  deletedChars: number;
  identicalChars: number;
  chapterResults: ChapterDiff[];
}

export interface ParsedChapter {
  index: number;
  title: string;
  content: string;
}

/**
 * Split a full text into chapters based on standard Vietnamese / Chinese / English chapter title patterns.
 * e.g., "Chương 1: ...", "Chương 1 - ...", "Hồi 1: ...", "第1章 ...", "Chapter 1 ...", "Quyển 1 Chương 1 ..."
 */
export function splitIntoChapters(fullText: string): ParsedChapter[] {
  if (!fullText || !fullText.trim()) return [];

  const lines = fullText.split(/\r?\n/);
  const chapterRegex = /^(?:(?:\s*Quyển\s*\d+[\s:]+)?\s*(?:Chương|Hồi|Chapter|第)\s*[\d一二两三四五六七八九十百千万0-9]+(?:\s*[章:.-]|\s+|$)|(?:CHAPTER|CHƯƠNG)\s+\d+)/i;

  const chapters: ParsedChapter[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];
  let chapterIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (chapterRegex.test(trimmed) && trimmed.length < 120) {
      if (currentTitle || currentLines.length > 0) {
        chapterIndex++;
        chapters.push({
          index: chapterIndex,
          title: currentTitle || `Chương ${chapterIndex}`,
          content: currentLines.join('\n').trim()
        });
      }
      currentTitle = trimmed;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Push the last chapter
  if (currentTitle || currentLines.length > 0) {
    chapterIndex++;
    chapters.push({
      index: chapterIndex,
      title: currentTitle || `Chương ${chapterIndex}`,
      content: currentLines.join('\n').trim()
    });
  }

  // If no chapter pattern was found at all, treat the entire document as a single chapter
  if (chapters.length === 0) {
    chapters.push({
      index: 1,
      title: 'Toàn bộ văn bản',
      content: fullText.trim()
    });
  }

  return chapters;
}

/**
 * Fast Longest Common Subsequence (LCS) / Diff algorithm on character tokens or line tokens.
 * Computes difference chunks, identical characters count, additions, deletions.
 */
export function computeTextDiff(textA: string, textB: string): {
  similarity: number;
  editPercentage: number;
  chunks: DiffChunk[];
  identicalCount: number;
  deletedCount: number;
  addedCount: number;
} {
  const s1 = textA;
  const s2 = textB;

  if (s1 === s2) {
    return {
      similarity: 100,
      editPercentage: 0,
      chunks: [{ type: 'equal', value: s1 }],
      identicalCount: s1.length,
      deletedCount: 0,
      addedCount: 0
    };
  }

  if (s1.length === 0) {
    return {
      similarity: 0,
      editPercentage: 100,
      chunks: [{ type: 'insert', value: s2 }],
      identicalCount: 0,
      deletedCount: 0,
      addedCount: s2.length
    };
  }

  if (s2.length === 0) {
    return {
      similarity: 0,
      editPercentage: 100,
      chunks: [{ type: 'delete', value: s1 }],
      identicalCount: 0,
      deletedCount: s1.length,
      addedCount: 0
    };
  }

  // If texts are large, do line-based or word-based diff to prevent O(N*M) memory blowout
  if (s1.length > 3000 || s2.length > 3000) {
    return computeWordOrLineDiff(s1, s2);
  }

  // Myers or LCS on characters for high precision on moderate chapter sizes
  return computeCharLCS(s1, s2);
}

/**
 * Word/Token based diff for larger texts (very fast and memory efficient)
 */
function computeWordOrLineDiff(textA: string, textB: string): {
  similarity: number;
  editPercentage: number;
  chunks: DiffChunk[];
  identicalCount: number;
  deletedCount: number;
  addedCount: number;
} {
  // Tokenize by word boundaries or whitespace, keeping tokens
  const tokenize = (str: string) => {
    return str.split(/([ \t\r\n]+|[.,!?;:()""''«»—–])/).filter(Boolean);
  };

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  const m = tokensA.length;
  const n = tokensB.length;

  // Standard DP Matrix bounded
  // To avoid huge matrix allocation if m * n > 4_000_000, we fallback to paragraph/line diff
  if (m * n > 2_000_000) {
    return computeParagraphDiff(textA, textB);
  }

  const dp: number[] = new Array((m + 1) * (n + 1)).fill(0);
  const get = (i: number, j: number) => dp[i * (n + 1) + j];
  const set = (i: number, j: number, val: number) => { dp[i * (n + 1) + j] = val; };

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (tokensA[i - 1] === tokensB[j - 1]) {
        set(i, j, get(i - 1, j - 1) + 1);
      } else {
        set(i, j, Math.max(get(i - 1, j), get(i, j - 1)));
      }
    }
  }

  // Backtrack to build chunks
  let i = m;
  let j = n;
  const rawChunks: DiffChunk[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
      rawChunks.push({ type: 'equal', value: tokensA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || get(i, j - 1) >= get(i - 1, j))) {
      rawChunks.push({ type: 'insert', value: tokensB[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || get(i, j - 1) < get(i - 1, j))) {
      rawChunks.push({ type: 'delete', value: tokensA[i - 1] });
      i--;
    }
  }

  rawChunks.reverse();
  const mergedChunks = mergeAdjacentChunks(rawChunks);

  let identicalCount = 0;
  let deletedCount = 0;
  let addedCount = 0;

  for (const c of mergedChunks) {
    if (c.type === 'equal') identicalCount += c.value.length;
    else if (c.type === 'delete') deletedCount += c.value.length;
    else if (c.type === 'insert') addedCount += c.value.length;
  }

  const totalRef = Math.max(textA.length, textB.length);
  const similarity = totalRef === 0 ? 100 : Math.max(0, Math.min(100, Math.round((identicalCount / totalRef) * 10000) / 100));
  const editPercentage = Math.round((100 - similarity) * 100) / 100;

  return {
    similarity,
    editPercentage,
    chunks: mergedChunks,
    identicalCount,
    deletedCount,
    addedCount
  };
}

/**
 * Paragraph/line fallback for very large texts
 */
function computeParagraphDiff(textA: string, textB: string): {
  similarity: number;
  editPercentage: number;
  chunks: DiffChunk[];
  identicalCount: number;
  deletedCount: number;
  addedCount: number;
} {
  const linesA = textA.split(/\n/);
  const linesB = textB.split(/\n/);

  const m = linesA.length;
  const n = linesB.length;
  const dp: number[] = new Array((m + 1) * (n + 1)).fill(0);
  const get = (i: number, j: number) => dp[i * (n + 1) + j];
  const set = (i: number, j: number, val: number) => { dp[i * (n + 1) + j] = val; };

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        set(i, j, get(i - 1, j - 1) + 1);
      } else {
        set(i, j, Math.max(get(i - 1, j), get(i, j - 1)));
      }
    }
  }

  let i = m;
  let j = n;
  const rawChunks: DiffChunk[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      rawChunks.push({ type: 'equal', value: linesA[i - 1] + (i < m ? '\n' : '') });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || get(i, j - 1) >= get(i - 1, j))) {
      rawChunks.push({ type: 'insert', value: linesB[j - 1] + (j < n ? '\n' : '') });
      j--;
    } else if (i > 0 && (j === 0 || get(i, j - 1) < get(i - 1, j))) {
      rawChunks.push({ type: 'delete', value: linesA[i - 1] + (i < m ? '\n' : '') });
      i--;
    }
  }

  rawChunks.reverse();
  const mergedChunks = mergeAdjacentChunks(rawChunks);

  let identicalCount = 0;
  let deletedCount = 0;
  let addedCount = 0;

  for (const c of mergedChunks) {
    if (c.type === 'equal') identicalCount += c.value.length;
    else if (c.type === 'delete') deletedCount += c.value.length;
    else if (c.type === 'insert') addedCount += c.value.length;
  }

  const totalRef = Math.max(textA.length, textB.length);
  const similarity = totalRef === 0 ? 100 : Math.max(0, Math.min(100, Math.round((identicalCount / totalRef) * 10000) / 100));
  const editPercentage = Math.round((100 - similarity) * 100) / 100;

  return {
    similarity,
    editPercentage,
    chunks: mergedChunks,
    identicalCount,
    deletedCount,
    addedCount
  };
}

/**
 * Character-level LCS for medium texts
 */
function computeCharLCS(s1: string, s2: string): {
  similarity: number;
  editPercentage: number;
  chunks: DiffChunk[];
  identicalCount: number;
  deletedCount: number;
  addedCount: number;
} {
  const m = s1.length;
  const n = s2.length;
  const dp: number[] = new Array((m + 1) * (n + 1)).fill(0);
  const get = (i: number, j: number) => dp[i * (n + 1) + j];
  const set = (i: number, j: number, val: number) => { dp[i * (n + 1) + j] = val; };

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        set(i, j, get(i - 1, j - 1) + 1);
      } else {
        set(i, j, Math.max(get(i - 1, j), get(i, j - 1)));
      }
    }
  }

  let i = m;
  let j = n;
  const rawChunks: DiffChunk[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && s1[i - 1] === s2[j - 1]) {
      rawChunks.push({ type: 'equal', value: s1[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || get(i, j - 1) >= get(i - 1, j))) {
      rawChunks.push({ type: 'insert', value: s2[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || get(i, j - 1) < get(i - 1, j))) {
      rawChunks.push({ type: 'delete', value: s1[i - 1] });
      i--;
    }
  }

  rawChunks.reverse();
  const mergedChunks = mergeAdjacentChunks(rawChunks);

  let identicalCount = 0;
  let deletedCount = 0;
  let addedCount = 0;

  for (const c of mergedChunks) {
    if (c.type === 'equal') identicalCount += c.value.length;
    else if (c.type === 'delete') deletedCount += c.value.length;
    else if (c.type === 'insert') addedCount += c.value.length;
  }

  const totalRef = Math.max(s1.length, s2.length);
  const similarity = totalRef === 0 ? 100 : Math.max(0, Math.min(100, Math.round((identicalCount / totalRef) * 10000) / 100));
  const editPercentage = Math.round((100 - similarity) * 100) / 100;

  return {
    similarity,
    editPercentage,
    chunks: mergedChunks,
    identicalCount,
    deletedCount,
    addedCount
  };
}

function mergeAdjacentChunks(chunks: DiffChunk[]): DiffChunk[] {
  if (chunks.length === 0) return [];
  const merged: DiffChunk[] = [];
  let cur = { ...chunks[0] };

  for (let k = 1; k < chunks.length; k++) {
    if (chunks[k].type === cur.type) {
      cur.value += chunks[k].value;
    } else {
      merged.push(cur);
      cur = { ...chunks[k] };
    }
  }
  merged.push(cur);
  return merged;
}

/**
 * Compare two whole manuscripts or texts with automatic chapter splitting.
 */
export function compareTextsWithChapters(rawTextA: string, rawTextB: string): OverallComparison {
  const chaptersA = splitIntoChapters(rawTextA);
  const chaptersB = splitIntoChapters(rawTextB);

  const maxCount = Math.max(chaptersA.length, chaptersB.length);
  const chapterResults: ChapterDiff[] = [];

  let totalCharsA = 0;
  let totalCharsB = 0;
  let totalIdentical = 0;
  let totalDeleted = 0;
  let totalAdded = 0;
  let pairedCount = 0;

  for (let idx = 0; idx < maxCount; idx++) {
    const chA = chaptersA[idx];
    const chB = chaptersB[idx];

    if (chA && chB) {
      pairedCount++;
      const lenA = chA.content.length;
      const lenB = chB.content.length;
      totalCharsA += lenA;
      totalCharsB += lenB;

      const diff = computeTextDiff(chA.content, chB.content);
      totalIdentical += diff.identicalCount;
      totalDeleted += diff.deletedCount;
      totalAdded += diff.addedCount;

      chapterResults.push({
        chapterNumber: idx + 1,
        titleA: chA.title,
        titleB: chB.title,
        contentA: chA.content,
        contentB: chB.content,
        charCountA: lenA,
        charCountB: lenB,
        similarityScore: diff.similarity,
        editPercentage: diff.editPercentage,
        matchedStatus: 'both',
        diffChunks: diff.chunks
      });
    } else if (chA && !chB) {
      const lenA = chA.content.length;
      totalCharsA += lenA;
      totalDeleted += lenA;

      chapterResults.push({
        chapterNumber: idx + 1,
        titleA: chA.title,
        titleB: '(Không có)',
        contentA: chA.content,
        contentB: '',
        charCountA: lenA,
        charCountB: 0,
        similarityScore: 0,
        editPercentage: 100,
        matchedStatus: 'only_a',
        diffChunks: [{ type: 'delete', value: chA.content }]
      });
    } else if (!chA && chB) {
      const lenB = chB.content.length;
      totalCharsB += lenB;
      totalAdded += lenB;

      chapterResults.push({
        chapterNumber: idx + 1,
        titleA: '(Không có)',
        titleB: chB.title,
        contentA: '',
        contentB: chB.content,
        charCountA: 0,
        charCountB: lenB,
        similarityScore: 0,
        editPercentage: 100,
        matchedStatus: 'only_b',
        diffChunks: [{ type: 'insert', value: chB.content }]
      });
    }
  }

  const maxTotalChars = Math.max(totalCharsA, totalCharsB);
  const overallSimilarity = maxTotalChars === 0 ? 100 : Math.max(0, Math.min(100, Math.round((totalIdentical / maxTotalChars) * 10000) / 100));
  const overallEditPercentage = Math.round((100 - overallSimilarity) * 100) / 100;

  return {
    totalChaptersA: chaptersA.length,
    totalChaptersB: chaptersB.length,
    pairedChaptersCount: pairedCount,
    totalCharsA,
    totalCharsB,
    overallSimilarity,
    overallEditPercentage,
    addedChars: totalAdded,
    deletedChars: totalDeleted,
    identicalChars: totalIdentical,
    chapterResults
  };
}
