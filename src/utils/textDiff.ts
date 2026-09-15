import { diffLines, diffWordsWithSpace } from 'diff';

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
 * High-precision Word-level and Hierarchical Line+Word Diff algorithm.
 * Identifies exact words, phrases, and punctuation changes within sentences/paragraphs,
 * rather than replacing whole paragraphs with red strikethroughs and green additions.
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

  let rawChunks: DiffChunk[] = [];

  // If text is within standard chapter size (< 80,000 characters), run full-fidelity word diff directly
  if (s1.length < 80000 && s2.length < 80000) {
    const diff = diffWordsWithSpace(s1, s2);
    rawChunks = diff.map(p => ({
      type: (p.added ? 'insert' : p.removed ? 'delete' : 'equal') as 'insert' | 'delete' | 'equal',
      value: p.value
    }));
  } else {
    // Hierarchical two-pass diff for very large texts:
    // 1. Line-level alignment
    // 2. Intra-line word diffing on modified line groups
    const lineDiff = diffLines(s1, s2);
    let i = 0;
    while (i < lineDiff.length) {
      const p = lineDiff[i];
      if (!p.added && !p.removed) {
        rawChunks.push({ type: 'equal', value: p.value });
        i++;
      } else if (p.removed && i + 1 < lineDiff.length && lineDiff[i + 1].added) {
        // Paired changed lines: diff words to pinpoint changes instead of blocking whole lines!
        const wDiff = diffWordsWithSpace(p.value, lineDiff[i + 1].value);
        for (const w of wDiff) {
          rawChunks.push({
            type: (w.added ? 'insert' : w.removed ? 'delete' : 'equal') as 'insert' | 'delete' | 'equal',
            value: w.value
          });
        }
        i += 2;
      } else if (p.removed) {
        rawChunks.push({ type: 'delete', value: p.value });
        i++;
      } else if (p.added) {
        rawChunks.push({ type: 'insert', value: p.value });
        i++;
      }
    }
  }

  // Merge consecutive adjacent chunks of the same type
  const mergedChunks: DiffChunk[] = [];
  for (const c of rawChunks) {
    if (!c.value) continue;
    if (mergedChunks.length > 0 && mergedChunks[mergedChunks.length - 1].type === c.type) {
      mergedChunks[mergedChunks.length - 1].value += c.value;
    } else {
      mergedChunks.push({ ...c });
    }
  }

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
