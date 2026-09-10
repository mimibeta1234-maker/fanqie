import { getBookInfo, getCatalog, getChapters, getChapter, formatChapterText, parseBookId } from './fanqieCore';
import { generateEpub } from './epubGenerator';

export interface DownloadTask {
  taskId: string;
  bookId: string;
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
}

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  createTask(bookId: string, bookInfo: any, catalog: any, range?: { start: number; end: number }): DownloadTask {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const allChapters = catalog.chapter_list || [];

    let targetChapters = allChapters;
    if (range && range.start >= 1 && range.end >= range.start) {
      targetChapters = allChapters.slice(range.start - 1, range.end);
    }

    const task: DownloadTask = {
      taskId,
      bookId,
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
        index: idx + 1,
        itemId: ch.item_id,
        title: ch.title,
        content: '',
      })),
      selectedRange: range
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

    const BATCH_SIZE = 5; // Optimal batch size for Fanqie API stability
    const total = task.chapters.length;
    let completed = 0;
    let failed = 0;

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        if (abortController.signal.aborted || (task.status as string) === 'cancelled') {
          break;
        }

        const batchSlice = task.chapters.slice(i, i + BATCH_SIZE);
        const itemIds = batchSlice.map(c => c.itemId);
        task.currentChapterTitle = batchSlice[0].title;

        try {
          // Use batch API
          const batchRes: any = await getChapters(itemIds, task.bookId);

          for (const ch of batchSlice) {
            const data = batchRes?.[ch.itemId];
            if (data && data.content && !data.error) {
              ch.content = formatChapterText(data.content, ch.title);
              completed++;
            } else {
              // Fallback to single fetch
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
          // Fallback each chapter individually
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

        task.completedChapters = completed;
        task.failedChapters = failed;
        task.percent = Math.floor((completed / total) * 100);

        const elapsedSec = Math.max((Date.now() - task.startTime) / 1000, 0.5);
        task.speed = `${(completed / elapsedSec).toFixed(1)} chương/s`;

        // Small respectful delay between batches
        await new Promise(r => setTimeout(r, 150));
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

    // Header with only requested info: Tên truyện, Tác giả, Tag, Số chương
    const headerLines = [
      `Tên truyện: ${info.book_name || "Không rõ"}`,
      `Tác giả: ${info.author || "Không rõ"}`,
      `Tag: ${tagVal}`,
      `Số chương: ${totalCount}`
    ];

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

    return await generateEpub({
      title: info.book_name || "Truyện Fanqie",
      author: info.author || "Tác giả",
      description: info.abstract,
      coverUrl: info.thumb_url,
      chapters: validChapters
    });
  }
}

export const downloadManager = new DownloadManager();
