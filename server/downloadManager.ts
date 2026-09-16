import { getBookInfo, getCatalog, getChapters, getChapter, formatChapterText, parseBookId, formatAbstract } from './fanqieCore';
import { getQimaoChapter } from './qimaoCore';
import { generateEpub } from './epubGenerator';

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
  chapters: { index: number; itemId: string; title: string; content: string; error?: string }[];
  selectedRange?: { start: number; end: number };
  includeIntro?: boolean;
}

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  createTask(
    bookId: string,
    bookInfo: any,
    catalog: any,
    range?: { start: number; end: number },
    provider: 'fanqie' | 'qimao' = 'fanqie',
    includeIntro: boolean = true
  ): DownloadTask {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const allChapters = catalog.chapter_list || [];

    let targetChapters = allChapters;
    if (range && range.start >= 1 && range.end >= range.start) {
      targetChapters = allChapters.slice(range.start - 1, range.end);
    }

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
      chapters: targetChapters.map((ch: any, idx: number) => ({
        index: (range ? range.start + idx : idx + 1),
        itemId: ch.item_id,
        title: ch.title,
        content: '',
      })),
      selectedRange: range,
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

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        if (abortController.signal.aborted || (task.status as string) === 'cancelled') {
          break;
        }

        const batchSlice = task.chapters.slice(i, i + BATCH_SIZE);
        task.currentChapterTitle = batchSlice[0].title;

        if (isQimao) {
          // Parallel fetch for Qimao batch
          await Promise.all(
            batchSlice.map(async (ch) => {
              if (abortController.signal.aborted) return;
              try {
                const res = await getQimaoChapter(task.bookId, ch.itemId, ch.title, task.bookInfo?.book_name, ch.index);
                if (res && res.content) {
                  ch.content = res.content;
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
          const itemIds = batchSlice.map(c => c.itemId);
          try {
            const batchRes: any = await getChapters(itemIds, task.bookId);

            for (const ch of batchSlice) {
              const data = batchRes?.[ch.itemId];
              if (data && data.content && !data.error) {
                ch.content = formatChapterText(data.content, ch.title);
                completed++;
              } else {
                try {
                  const single: any = await getChapter(ch.itemId, 0);
                  if (single && single.content) {
                    ch.content = formatChapterText(single.content, ch.title);
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
            for (const ch of batchSlice) {
              if (abortController.signal.aborted) break;
              try {
                const single: any = await getChapter(ch.itemId, 0);
                if (single && single.content) {
                  ch.content = formatChapterText(single.content, ch.title);
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

  generateTxt(taskId: string): string {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("Task not found");

    const info: any = task.bookInfo || {};
    const totalCount = task.totalChapters || info.chapter_count || task.completedChapters || 0;
    const tagVal = info.tags || info.category || "Tiểu thuyết";

    const headerLines = [
      `Tên truyện: ${info.book_name || "Không rõ"}`,
      `Tác giả: ${info.author || "Không rõ"}`,
      `Thể loại / Tag: ${tagVal}`,
    ];

    if (task.selectedRange) {
      headerLines.push(`Khoảng chương tải: Từ chương ${task.selectedRange.start} đến chương ${task.selectedRange.end} (${task.totalChapters} chương)`);
    } else {
      headerLines.push(`Số chương: ${totalCount}`);
    }

    // Include book description/intro if requested and available
    const shouldIncludeIntro = task.includeIntro !== false;
    const rawIntro = info.abstract || info.summary || info.description || "";
    const cleanAbstract = formatAbstract(rawIntro);

    if (shouldIncludeIntro && cleanAbstract) {
      headerLines.push(
        '',
        '========================================',
        'GIỚI THIỆU',
        '========================================',
        cleanAbstract,
        '========================================',
        'NỘI DUNG',
        '========================================'
      );
    }

    const chapterBlocks: string[] = [];
    for (const ch of task.chapters) {
      if (ch.content && ch.content.trim().length > 0) {
        const lines = ch.content
          .split('\n')
          .map(l => l.replace(/^[\s\u3000\u00A0]+/, '').replace(/[\s\u3000\u00A0]+$/, ''))
          .filter(l => l.length > 0);
        if (lines.length > 0) {
          chapterBlocks.push(lines.join('\n'));
        }
      }
    }

    if (chapterBlocks.length > 0) {
      return headerLines.join('\n') + '\n\n' + chapterBlocks.join('\n\n');
    }
    return headerLines.join('\n');
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

    return await generateEpub({
      title: info.book_name || (task.provider === 'qimao' ? "Truyện Qimao" : "Truyện Fanqie"),
      author: info.author || "Tác giả",
      description: cleanAbstract,
      coverUrl: info.thumb_url,
      chapters: epubChapters
    });
  }
}

export const downloadManager = new DownloadManager();
