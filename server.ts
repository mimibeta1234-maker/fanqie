import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  parseBookId,
  getBookInfo,
  getCatalog,
  getChapter,
  getChapters,
  formatChapterText,
  searchBooks
} from "./server/fanqieCore";
import { downloadManager } from "./server/downloadManager";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Search books
  app.get("/api/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        return res.json({ success: true, books: [] });
      }
      const books = await searchBooks(q, 15);
      res.json({ success: true, books });
    } catch (err: any) {
      console.error("Search error:", err);
      res.status(500).json({ success: false, error: err.message || "Lỗi tìm kiếm" });
    }
  });

  // Book details
  app.get("/api/book/info", async (req, res) => {
    try {
      const rawInput = String(req.query.id || req.query.url || "").trim();
      if (!rawInput) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp ID hoặc link truyện" });
      }
      const bookId = parseBookId(rawInput);
      const book: any = await getBookInfo(bookId);

      // Normalize book fields
      const bookData = book?.data || book;
      const isCompleted = String(bookData.creation_status) === "0";
      const normalized = {
        book_id: bookData.book_id || bookId,
        book_name: bookData.book_name || bookData.title || "Truyện Fanqie",
        author: bookData.author || "Tác giả",
        thumb_url: bookData.thumb_url || bookData.detail_page_thumb_url || bookData.cover_url || "",
        score: bookData.score || "9.0",
        category: bookData.category || "Tiểu thuyết",
        tags: bookData.tags || bookData.category || "Tiểu thuyết",
        abstract: bookData.book_abstract_v2 || bookData.abstract || bookData.summary || "",
        word_number: bookData.word_number || "0",
        chapter_count: Number(bookData.content_chapter_number || bookData.serial_count || bookData.chapter_count || 0),
        last_chapter_title: bookData.last_chapter_title || "",
        creation_status: isCompleted ? "Đã hoàn thành" : "Đang ra"
      };

      res.json({ success: true, book: normalized });
    } catch (err: any) {
      console.error("Book info error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể tải thông tin truyện" });
    }
  });

  // Book chapter catalog
  app.get("/api/book/catalog", async (req, res) => {
    try {
      const rawInput = String(req.query.id || "").trim();
      if (!rawInput) {
        return res.status(400).json({ success: false, error: "Thiếu ID truyện" });
      }
      const bookId = parseBookId(rawInput);
      const catalog = await getCatalog(bookId);
      res.json({ success: true, catalog });
    } catch (err: any) {
      console.error("Catalog error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể tải danh sách chương" });
    }
  });

  // Preview / Read single chapter (even if locked on web!)
  app.post("/api/chapter/preview", async (req, res) => {
    try {
      const { itemId } = req.body;
      if (!itemId) {
        return res.status(400).json({ success: false, error: "Thiếu ID chương (itemId)" });
      }
      const chapter: any = await getChapter(String(itemId), 0);
      const cleanContent = formatChapterText(chapter.content, "");
      res.json({
        success: true,
        chapter: {
          itemId,
          title: chapter.title || "Chương không tên",
          content: cleanContent,
          rawContent: chapter.content
        }
      });
    } catch (err: any) {
      console.error("Chapter preview error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể giải mã chương này" });
    }
  });

  // Search plot / keyword within chapters
  app.post("/api/book/search-plot", async (req, res) => {
    try {
      const { bookId, query, itemIds, startIndex = 1 } = req.body;
      if (!bookId || !query || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ success: false, error: "Thiếu thông tin tìm kiếm" });
      }

      const cleanBookId = parseBookId(bookId);
      const q = String(query).trim().toLowerCase();
      if (!q) {
        return res.json({ success: true, matches: [] });
      }

      // Fetch batch of chapters
      const batchResult: any = await getChapters(itemIds, cleanBookId);
      const matches = [];

      for (let i = 0; i < itemIds.length; i++) {
        const id = String(itemIds[i]);
        const ch = batchResult[id];
        if (!ch || !ch.content) continue;

        const cleanText = formatChapterText(ch.content, "");
        const lowerText = cleanText.toLowerCase();
        const foundIdx = lowerText.indexOf(q);

        if (foundIdx !== -1) {
          // Extract snippet of ~140 chars around the match
          const startSnippet = Math.max(0, foundIdx - 40);
          const endSnippet = Math.min(cleanText.length, foundIdx + q.length + 80);
          let snippet = cleanText.substring(startSnippet, endSnippet).replace(/\s+/g, ' ').trim();
          if (startSnippet > 0) snippet = "..." + snippet;
          if (endSnippet < cleanText.length) snippet = snippet + "...";

          matches.push({
            itemId: id,
            chapterIndex: startIndex + i,
            title: ch.title || `Chương ${startIndex + i}`,
            snippet
          });
        }
      }

      res.json({ success: true, matches });
    } catch (err: any) {
      console.error("Plot search error:", err);
      res.status(500).json({ success: false, error: err.message || "Lỗi khi tìm kiếm theo tình tiết" });
    }
  });

  // Start download task
  app.post("/api/download/start", async (req, res) => {
    try {
      const { bookId, range } = req.body;
      if (!bookId) {
        return res.status(400).json({ success: false, error: "Thiếu ID truyện" });
      }
      const cleanId = parseBookId(bookId);
      const bookRaw: any = await getBookInfo(cleanId);
      const catalog: any = await getCatalog(cleanId);
      const bookData = bookRaw?.data || bookRaw;

      const bookInfo = {
        book_id: cleanId,
        book_name: bookData.book_name || bookData.title || "Truyện Fanqie",
        author: bookData.author || "Tác giả",
        thumb_url: bookData.thumb_url || bookData.detail_page_thumb_url || bookData.cover_url || "",
        score: bookData.score || "9.0",
        abstract: bookData.book_abstract_v2 || bookData.abstract || bookData.summary || "",
        category: bookData.category || "Tiểu thuyết",
        tags: bookData.tags || bookData.category || "Tiểu thuyết"
      };

      const task = downloadManager.createTask(cleanId, bookInfo, catalog, range);
      // Run async in background
      downloadManager.runDownload(task.taskId);

      res.json({ success: true, taskId: task.taskId, totalChapters: task.totalChapters });
    } catch (err: any) {
      console.error("Start download error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể khởi tạo tiến trình tải" });
    }
  });

  // Check download task progress
  app.get("/api/download/status", (req, res) => {
    const taskId = String(req.query.taskId || "");
    const task = downloadManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: "Tiến trình không tồn tại" });
    }
    res.json({
      success: true,
      task: {
        taskId: task.taskId,
        bookId: task.bookId,
        bookInfo: task.bookInfo,
        status: task.status,
        totalChapters: task.totalChapters,
        completedChapters: task.completedChapters,
        failedChapters: task.failedChapters,
        currentChapterTitle: task.currentChapterTitle,
        percent: task.percent,
        speed: task.speed,
        errorMessage: task.errorMessage
      }
    });
  });

  // Cancel download task
  app.post("/api/download/cancel", (req, res) => {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ success: false, error: "Thiếu taskId" });
    const success = downloadManager.cancelTask(taskId);
    res.json({ success });
  });

  // Export downloaded novel as TXT or EPUB
  app.get("/api/download/export", async (req, res) => {
    try {
      const taskId = String(req.query.taskId || "");
      const format = String(req.query.format || "txt").toLowerCase();
      const task = downloadManager.getTask(taskId);

      if (!task) {
        return res.status(404).send("Không tìm thấy tiến trình tải này");
      }

      const bookName = (task.bookInfo?.book_name || "novel").replace(/[^\w\s\u4e00-\u9fa5\u00C0-\u1EF9]/gi, '_');

      if (format === "epub") {
        const epubBuffer = await downloadManager.generateEpub(taskId);
        res.setHeader("Content-Type", "application/epub+zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(bookName)}.epub"`
        );
        return res.send(epubBuffer);
      } else {
        const txtContent = downloadManager.generateTxt(taskId);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(bookName)}.txt"`
        );
        return res.send(txtContent);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      res.status(500).send(`Lỗi khi xuất file: ${err.message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Fanqie Downloader Server running on http://localhost:${PORT}`);
  });
}

startServer();
