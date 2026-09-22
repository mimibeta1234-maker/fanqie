import { getBookInfo, getCatalog, getChapters, getChapter, formatChapterText, parseBookId, formatAbstract, parseFanqieCoverFromUrl } from './fanqieCore';
import { getQimaoChapter } from './qimaoCore';
import { generateEpub } from './epubGenerator';
import JSZip from 'jszip';

export interface ChapterRangeItem {
  start: number;
  end: number;
  label?: string;
  count?: number;
}

export interface DownloadTask {
  taskId: string;
  bookId: string;
  provider?: 'fanqie' | 'qimao';
  bookInfo: any;
  status: 'idle' | 'downloading' | 'completed' | 'paused' | 'cancelled' | 'error';
  totalChapters: number;
  completedChapters: number;
  failedChapters: number;
  currentChapterTitle: string;
  percent: number;
  startTime: number;
  endTime?: number;
  speed: string; // e.g., "5 chap/s"
  errorMessage?: string;
  chapters: {
    index: number;
    itemId: string;
    title: string;
    content: string;
    rangeIndex?: number;
    rangeLabel?: string;
    error?: string;
  }[];
  selectedRange?: { start: number; end: number };
  ranges?: ChapterRangeItem[];
  includeIntro?: boolean;
}

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  createTask(
    bookId: string,
    bookInfo: any,
    catalog: any,
    rangeOrRanges?: { start: number; end: number } | { start: number; end: number; label?: string }[],
    provider: 'fanqie' | 'qimao' = 'fanqie',
    includeIntro: boolean = true
  ): DownloadTask {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const allChapters = catalog.chapter_list || [];
    const totalCount = allChapters.length;

    let validRanges: ChapterRangeItem[] = [];
    if (Array.isArray(rangeOrRanges) && rangeOrRanges.length > 0) {
      for (const r of rangeOrRanges) {
        if (typeof r.start === 'number' && typeof r.end === 'number') {
          const s = Math.max(1, Math.min(r.start, totalCount));
          const e = Math.max(s, Math.min(r.end, totalCount));
          validRanges.push({
            start: s,
            end: e,
            label: r.label || `Chương ${s} - ${e}`,
            count: e - s + 1
          });
        }
      }
    } else if (rangeOrRanges && typeof (rangeOrRanges as any).start === 'number') {
      const single = rangeOrRanges as { start: number; end: number };
      const s = Math.max(1, Math.min(single.start, totalCount));
      const e = Math.max(s, Math.min(single.end, totalCount));
      validRanges = [{
        start: s,
        end: e,
        label: `Chương ${s} - ${e}`,
        count: e - s + 1
      }];
    }

    if (validRanges.length === 0) {
      validRanges = [{
        start: 1,
        end: totalCount,
        label: `Toàn bộ (${totalCount} chương)`,
        count: totalCount
      }];
    }

    // Map chapters to download for all ranges
    const targetChapters: {
      index: number;
      itemId: string;
      title: string;
      content: string;
      rangeIndex?: number;
      rangeLabel?: string;
    }[] = [];

    validRanges.forEach((r, rIdx) => {
      const slice = allChapters.slice(r.start - 1, r.end);
      slice.forEach((ch: any, offset: number) => {
        targetChapters.push({
          index: r.start + offset,
          itemId: ch.item_id,
          title: ch.title,
          content: '',
          rangeIndex: rIdx,
          rangeLabel: r.label
        });
      });
    });

    const task: DownloadTask = {
      taskId,
      bookId,
      provider,
      bookInfo,
      status: 'idle',
      totalChapters: targetChapters.length,
      completedChapters: 0,
      failedChapters: 0,
      currentChapterTitle: '',
      percent: 0,
      startTime: Date.now(),
      speed: '0 chap/s',
      chapters: targetChapters,
      selectedRange: validRanges.length === 1 ? { start: validRanges[0].start, end: validRanges[0].end } : undefined,
      ranges: validRanges,
      includeIntro
    };

    this.tasks.set(taskId, task);
    return task;
  }

  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId);
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    task.status = 'cancelled';
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
    }
    return true;
  }

  async runDownload(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'downloading';
    task.startTime = Date.now();
    const abortController = new AbortController();
    this.abortControllers.set(taskId, abortController);

    const isQimao = task.provider === 'qimao';
    const BATCH_SIZE = isQimao ? 6 : 5;
    const total = task.chapters.length;
    let completed = 0;
    let failed = 0;

    // Cache content by itemId so identical chapters across overlapping ranges don't re-fetch
    const contentCache = new Map<string, string>();

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        if (abortController.signal.aborted || (task.status as string) === 'cancelled') {
          break;
        }

        const batchSlice = task.chapters.slice(i, i + BATCH_SIZE);
        task.currentChapterTitle = batchSlice[0].title;

        // Check if any in batchSlice is already cached
        const needingFetch = batchSlice.filter(ch => {
          if (contentCache.has(ch.itemId)) {
            ch.content = contentCache.get(ch.itemId)!;
            completed++;
            return false;
          }
          return true;
        });

        if (needingFetch.length > 0) {
          if (isQimao) {
            // Parallel fetch for Qimao batch
            await Promise.all(
              needingFetch.map(async (ch) => {
                if (abortController.signal.aborted) return;
                try {
                  const res = await getQimaoChapter(
                    task.bookId,
                    ch.itemId,
                    ch.title,
                    task.bookInfo?.book_name,
                    ch.index,
                    task.bookInfo?.author
                  );
                  if (res && res.content) {
                    ch.content = res.content;
                    contentCache.set(ch.itemId, res.content);
                    completed++;
                  } else {
                    ch.error = 'Lỗi tải chương';
                    failed++;
                  }
                } catch (e: any) {
                  ch.error = e.message || 'Lỗi tải chương';
                  failed++;
                }
              })
            );
          } else {
            // Fanqie batch API
            const itemIds = needingFetch.map(c => c.itemId);
            try {
              const batchRes: any = await getChapters(itemIds, task.bookId);

              for (const ch of needingFetch) {
                const data = batchRes?.[ch.itemId];
                if (data && data.content && !data.error) {
                  const formatted = formatChapterText(data.content, ch.title);
                  ch.content = formatted;
                  contentCache.set(ch.itemId, formatted);
                  completed++;
                } else {
                  try {
                    const single: any = await getChapter(ch.itemId, 0);
                    if (single && single.content) {
                      const formatted = formatChapterText(single.content, ch.title);
                      ch.content = formatted;
                      contentCache.set(ch.itemId, formatted);
                      completed++;
                    } else {
                      ch.error = "Không tải được nội dung";
                      failed++;
                    }
                  } catch (singleErr: any) {
                    ch.error = singleErr.message || "Lỗi tải chương";
                    failed++;
                  }
                }
              }
            } catch (batchErr) {
              for (const ch of needingFetch) {
                if (abortController.signal.aborted) break;
                try {
                  const single: any = await getChapter(ch.itemId, 0);
                  if (single && single.content) {
                    const formatted = formatChapterText(single.content, ch.title);
                    ch.content = formatted;
                    contentCache.set(ch.itemId, formatted);
                    completed++;
                  } else {
                    ch.error = "Lỗi nội dung";
                    failed++;
                  }
                } catch (err: any) {
                  ch.error = err.message;
                  failed++;
                }
                await new Promise(r => setTimeout(r, 100));
              }
            }
          }
        }

        task.completedChapters = completed;
        task.failedChapters = failed;
        task.percent = Math.floor((completed / total) * 100);

        const elapsedSec = Math.max((Date.now() - task.startTime) / 1000, 0.5);
        task.speed = `${(completed / elapsedSec).toFixed(1)} chương/s`;

        await new Promise(r => setTimeout(r, 120));
      }

      if ((task.status as string) !== 'cancelled') {
        task.status = 'completed';
        task.endTime = Date.now();
        task.percent = 100;
        task.currentChapterTitle = 'Hoàn thành!';
      }
    } catch (err: any) {
      task.status = 'error';
      task.errorMessage = err.message || "Có lỗi xảy ra trong quá trình tải";
    } finally {
      this.abortControllers.delete(taskId);
    }
  }

  generateTxt(taskId: string, rangeIndex?: number): string {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("Task not found");

    const info: any = task.bookInfo || {};
    const rawTag = info.tags || info.category || "";
    let tagVal = rawTag;
    if (tagVal && /[\u4e00-\u9fa5]/.test(tagVal)) {
      tagVal = tagVal.split(/[,，、/]\s*/).filter(Boolean).join('，');
    }

    const allLines: string[] = [
      `Tên truyện: ${info.book_name || "Không rõ"}`,
      `Tác giả: ${info.author || "Không rõ"}`,
    ];

    if (rangeIndex !== undefined && task.ranges && task.ranges[rangeIndex]) {
      const r = task.ranges[rangeIndex];
      allLines.push(`Phần: ${r.label || `Chương ${r.start} - ${r.end}`}`);
    } else if (task.ranges && task.ranges.length > 1) {
      allLines.push(`Các khoảng tải: ${task.ranges.map(r => r.label || `Chương ${r.start}-${r.end}`).join(', ')}`);
    }

    if (tagVal) {
      allLines.push(`Tag: ${tagVal}`);
    }

    // Include book description/intro if requested and available
    const shouldIncludeIntro = task.includeIntro !== false;
    // For single specific range export, only include intro on rangeIndex 0
    const includeIntroForThis = shouldIncludeIntro && (rangeIndex === undefined || rangeIndex === 0);
    const rawIntro = info.abstract || info.summary || info.description || "";
    const cleanAbstract = formatAbstract(rawIntro);

    if (includeIntroForThis && cleanAbstract) {
      allLines.push('Giới thiệu:');
      const introParagraphs = cleanAbstract
        .split('\n')
        .map(l => l.replace(/^[\s\u3000\u00A0]+/, '').replace(/[\s\u3000\u00A0]+$/, ''))
        .filter(l => l.length > 0 && !/^={3,}$/.test(l) && !/^-{3,}$/.test(l));

      allLines.push(...introParagraphs);
    }

    let targetChapters = task.chapters;
    if (rangeIndex !== undefined) {
      targetChapters = task.chapters.filter(ch => ch.rangeIndex === rangeIndex);
    }

    let lastRangeIndex: number | undefined = undefined;
    for (const ch of targetChapters) {
      // Print separator when transitioning to next range in combined mode
      if (rangeIndex === undefined && task.ranges && task.ranges.length > 1 && ch.rangeIndex !== undefined && ch.rangeIndex !== lastRangeIndex) {
        lastRangeIndex = ch.rangeIndex;
        const currentR = task.ranges[ch.rangeIndex];
        allLines.push('');
        allLines.push(`==================== ${currentR?.label || `KHOẢNG: CHƯƠNG ${currentR?.start} - ${currentR?.end}`} ====================`);
        allLines.push('');
      }

      if (ch.content && ch.content.trim().length > 0) {
        const lines = ch.content
          .split('\n')
          .map(l => l.replace(/^[\s\u3000\u00A0]+/, '').replace(/[\s\u3000\u00A0]+$/, ''))
          .filter(l => l.length > 0 && !/^={3,}$/.test(l) && !/^-{3,}$/.test(l));
        allLines.push(...lines);
      }
    }

    return allLines.join('\n');
  }

  async generateZip(taskId: string): Promise<Buffer> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("Task not found");

    const zip = new JSZip();
    const cleanBookName = (task.bookInfo?.book_name || "novel").replace(/[\\/:*?"<>|]/g, '_').trim();
    
    // Create a root folder named after the story inside the zip archive
    const novelFolder = zip.folder(cleanBookName) || zip;

    if (task.ranges && task.ranges.length > 1) {
      // 1. Separate file for each range inside the novel folder
      task.ranges.forEach((r, idx) => {
        const rangeTxt = this.generateTxt(taskId, idx);
        const fileName = `${cleanBookName}_[Chương_${String(r.start).padStart(4, '0')}-${String(r.end).padStart(4, '0')}].txt`;
        novelFolder.file(fileName, rangeTxt);
      });

      // 2. Also include combined file for convenience inside the novel folder
      const combinedTxt = this.generateTxt(taskId);
      novelFolder.file(`${cleanBookName}_[Gộp_Tất_Cả_Các_Khoảng].txt`, combinedTxt);
    } else {
      const txt = this.generateTxt(taskId);
      const r = task.ranges?.[0];
      const suffix = r ? `_[Chương_${r.start}-${r.end}]` : '';
      novelFolder.file(`${cleanBookName}${suffix}.txt`, txt);
    }

    return await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }

  async generateEpub(taskId: string): Promise<Buffer> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("Task not found");

    const info = task.bookInfo || {};
    const validChapters = task.chapters
      .filter(ch => ch.content && ch.content.trim().length > 0)
      .map(ch => ({
        title: ch.title,
        content: ch.content
      }));

    const shouldIncludeIntro = task.includeIntro !== false;
    const rawIntro = info.abstract || info.summary || info.description || "";
    const cleanAbstract = formatAbstract(rawIntro);

    const epubChapters = [...validChapters];
    if (shouldIncludeIntro && cleanAbstract) {
      epubChapters.unshift({
        title: "Giới thiệu",
        content: cleanAbstract
      });
    }

    let coverUrl = info.thumb_url;
    if (task.provider !== 'qimao' && coverUrl) {
      const parsed = parseFanqieCoverFromUrl(coverUrl);
      if (parsed) {
        coverUrl = `https://p3-novel.byteimg.com/origin/${parsed.folder}/${parsed.hash}`;
      }
    }

    return await generateEpub({
      title: info.book_name || (task.provider === 'qimao' ? "Truyện Qimao" : "Truyện Fanqie"),
      author: info.author || "Tác giả",
      description: cleanAbstract,
      coverUrl,
      chapters: epubChapters
    });
  }
}

export const downloadManager = new DownloadManager();
