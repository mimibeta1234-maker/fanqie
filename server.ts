import express from "express";
import path from "path";
import crypto from "crypto";
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
import {
  parseQimaoBookId,
  getQimaoBookInfo,
  getQimaoCatalog,
  getQimaoChapter,
  searchQimaoBooks
} from "./server/qimaoCore";
import { downloadManager } from "./server/downloadManager";
import {
  parseScribdId,
  getScribdDocInfo,
  getScribdDocPages,
  getScribdFullPrintableDoc,
} from "./server/scribdCore";
import {
  generateTxtBuffer,
  generateDocxBuffer,
  generatePdfBuffer,
} from "./server/scribdExport";
import { buildPrintableScribdHtml } from "./server/scribdPrintView";
import {
  searchZhihuStories,
  getZhihuStoryDetail,
  generateZhihuTxt,
  generateZhihuEpub,
  createZhihuStoryFromRawText
} from "./server/zhihuCore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Auth verify endpoint - Verifies one-way SHA-256 hash without plaintext password exposure
  const SECURE_ACCESS_DIGEST = "89506301a08dfab0bdf70907dd805f6bdafa9cf25d6d445b0867bd7fffa93697";
  app.post("/api/auth/verify", (req, res) => {
    try {
      const { password } = req.body || {};
      if (!password || typeof password !== "string") {
        return res.status(400).json({ success: false, error: "Thiếu mật khẩu" });
      }
      const hash = crypto.createHash("sha256").update(password.trim()).digest("hex");
      if (hash === SECURE_ACCESS_DIGEST) {
        return res.json({ success: true });
      }
      return res.status(401).json({ success: false, error: "Mật khẩu không đúng" });
    } catch {
      return res.status(500).json({ success: false, error: "Lỗi hệ thống xác thực" });
    }
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

  // --- Qimao Endpoints ---
  app.get("/api/qimao/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        return res.json({ success: true, books: [] });
      }
      const books = await searchQimaoBooks(q, 20);
      res.json({ success: true, books });
    } catch (err: any) {
      console.error("Qimao search error:", err);
      res.status(500).json({ success: false, error: err.message || "Lỗi tìm kiếm Qimao" });
    }
  });

  app.get("/api/qimao/book/info", async (req, res) => {
    try {
      const rawInput = String(req.query.id || req.query.url || "").trim();
      if (!rawInput) {
        return res.status(400).json({ success: false, error: "Vui lòng cung cấp ID hoặc link truyện Qimao/Zongheng" });
      }
      const bookId = parseQimaoBookId(rawInput);
      const book = await getQimaoBookInfo(bookId);
      res.json({ success: true, book });
    } catch (err: any) {
      console.error("Qimao book info error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể tải thông tin truyện Qimao" });
    }
  });

  app.get("/api/qimao/book/catalog", async (req, res) => {
    try {
      const rawInput = String(req.query.id || "").trim();
      if (!rawInput) {
        return res.status(400).json({ success: false, error: "Thiếu ID truyện Qimao" });
      }
      const bookId = parseQimaoBookId(rawInput);
      const catalog = await getQimaoCatalog(bookId);
      res.json({ success: true, catalog });
    } catch (err: any) {
      console.error("Qimao catalog error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể tải danh sách chương Qimao" });
    }
  });

  app.post("/api/qimao/chapter/preview", async (req, res) => {
    try {
      const { bookId, itemId, title, bookName, chapterIndex } = req.body;
      if (!itemId) {
        return res.status(400).json({ success: false, error: "Thiếu ID chương" });
      }
      const cleanBookId = parseQimaoBookId(bookId || "");
      const chapter = await getQimaoChapter(cleanBookId, String(itemId), title, bookName, chapterIndex);
      res.json({
        success: true,
        chapter: {
          itemId,
          title: chapter.title || title || `Chương ${itemId}`,
          content: chapter.content
        }
      });
    } catch (err: any) {
      console.error("Qimao chapter preview error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể tải chương này" });
    }
  });

  app.post("/api/qimao/download/start", async (req, res) => {
    try {
      const { bookId, range } = req.body;
      if (!bookId) {
        return res.status(400).json({ success: false, error: "Thiếu ID truyện" });
      }
      const cleanId = parseQimaoBookId(bookId);
      const bookInfo = await getQimaoBookInfo(cleanId);
      const catalog = await getQimaoCatalog(cleanId);

      const task = downloadManager.createTask(cleanId, bookInfo, catalog, range, 'qimao');
      downloadManager.runDownload(task.taskId);

      res.json({ success: true, taskId: task.taskId, totalChapters: task.totalChapters });
    } catch (err: any) {
      console.error("Start Qimao download error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể khởi tạo tiến trình tải Qimao" });
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

  // Scribd: Get Document Metadata
  app.get("/api/scribd/info", async (req, res) => {
    try {
      const q = String(req.query.query || req.query.url || req.query.id || "").trim();
      const docId = parseScribdId(q);
      if (!docId) {
        return res.status(400).json({ success: false, error: "Link hoặc ID tài liệu Scribd không hợp lệ" });
      }
      const info = await getScribdDocInfo(docId);
      res.json({ success: true, info, doc: info });
    } catch (err: any) {
      console.error("Scribd info error:", err);
      res.status(500).json({ success: false, error: err.message || "Lỗi khi lấy thông tin từ Scribd" });
    }
  });

  // Scribd: Get Extracted Pages
  app.get("/api/scribd/pages", async (req, res) => {
    try {
      const q = String(req.query.id || req.query.query || req.query.url || "").trim();
      const docId = parseScribdId(q);
      if (!docId) {
        return res.status(400).json({ success: false, error: "Thiếu ID hoặc liên kết tài liệu Scribd" });
      }
      const fromPage = parseInt(String(req.query.from || "1"), 10) || 1;
      const toPage = req.query.to ? parseInt(String(req.query.to), 10) : undefined;
      const result = await getScribdDocPages(docId, fromPage, toPage);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Scribd pages error:", err);
      res.status(500).json({ success: false, error: err.message || "Lỗi khi trích xuất trang tài liệu" });
    }
  });

  // Scribd: Direct Download in chosen format (PDF, TXT, DOCX, HTML)
  app.get("/api/scribd/download", async (req, res) => {
    try {
      const q = String(req.query.id || req.query.query || "").trim();
      const docId = parseScribdId(q);
      if (!docId) {
        return res.status(400).send("Thiếu ID tài liệu Scribd hợp lệ");
      }
      const format = String(req.query.format || "pdf").toLowerCase();
      const fromPage = parseInt(String(req.query.from || "1"), 10) || 1;
      const toPage = req.query.to ? parseInt(String(req.query.to), 10) : undefined;

      const safeTitle = `Scribd_${docId}`;

      if (format === "html") {
        const { info, pagesHtml, scribdStyle, fontStyles } = await getScribdFullPrintableDoc(docId, fromPage, toPage);
        const htmlDoc = buildPrintableScribdHtml(info, pagesHtml, scribdStyle, fontStyles);
        const title = (info.title || safeTitle).replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 100);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(title)}.html"`);
        return res.send(htmlDoc);
      }

      const { info, pages } = await getScribdDocPages(docId, fromPage, toPage);
      const title = (info.title || safeTitle).replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 100);

      if (format === "docx") {
        const buffer = await generateDocxBuffer(info.title, info.id, pages);
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(title)}.docx"`
        );
        return res.send(buffer);
      } else if (format === "txt") {
        const buffer = generateTxtBuffer(info.title, info.id, pages);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(title)}.txt"`
        );
        return res.send(buffer);
      } else {
        // Default format: PDF
        const buffer = await generatePdfBuffer(info.title, info.id, pages);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(title)}.pdf"`
        );
        return res.send(buffer);
      }
    } catch (err: any) {
      console.error("Scribd download error:", err);
      res.status(500).send(`Lỗi khi tạo file tải xuống: ${err.message}`);
    }
  });

  // Scribd: 1:1 Pixel-Perfect Printable View (Direct Print-to-PDF / Vector High Fidelity)
  app.get("/api/scribd/print", async (req, res) => {
    try {
      const q = String(req.query.id || req.query.query || "").trim();
      const docId = parseScribdId(q);
      if (!docId) {
        return res.status(400).send("Thiếu ID tài liệu Scribd hợp lệ");
      }
      const fromPage = parseInt(String(req.query.from || "1"), 10) || 1;
      const toPage = req.query.to ? parseInt(String(req.query.to), 10) : undefined;

      const { info, pagesHtml, scribdStyle, fontStyles } = await getScribdFullPrintableDoc(docId, fromPage, toPage);
      const html = buildPrintableScribdHtml(info, pagesHtml, scribdStyle, fontStyles);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (err: any) {
      console.error("Scribd print view error:", err);
      res.status(500).send(`Lỗi khi tải bản in: ${err.message}`);
    }
  });

  // Scribd: Image Proxy (Bypasses CORS/Referer restrictions for reader with automatic format fallback)
  app.get("/api/scribd/image-proxy", async (req, res) => {
    try {
      const initialUrl = String(req.query.url || "");
      if (!initialUrl || !initialUrl.startsWith("http")) {
        return res.status(400).send("Invalid image URL");
      }

      const candidateUrls: string[] = [initialUrl];
      if (initialUrl.endsWith(".png")) {
        candidateUrls.push(initialUrl.replace(/\.png$/, ".jpg"));
      } else if (initialUrl.endsWith(".jpg") || initialUrl.endsWith(".jpeg")) {
        candidateUrls.push(initialUrl.replace(/\.jpe?g$/, ".png"));
      }

      for (const targetUrl of candidateUrls) {
        try {
          const imgRes = await fetch(targetUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Referer: "https://www.scribd.com/",
              Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            },
          });
          if (imgRes.ok) {
            const contentType = imgRes.headers.get("content-type") || (targetUrl.endsWith(".png") ? "image/png" : "image/jpeg");
            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "public, max-age=86400");
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            return res.send(buffer);
          }
        } catch {
          // Continue to next candidate
        }
      }

      return res.status(404).send("Image not found");
    } catch (err: any) {
      res.status(500).send("Image proxy error: " + err.message);
    }
  });

  // Zhihu / Yanxuan: Search & Latest Stories
  app.get("/api/zhihu/search", async (req, res) => {
    try {
      const q = String(req.query.q || req.query.query || "").trim();
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const pageSize = Math.max(1, Math.min(100, parseInt(String(req.query.pageSize || "20"), 10) || 20));

      const result = await searchZhihuStories(q, page, pageSize);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Zhihu search error:", err);
      res.status(500).json({ success: false, error: err.message || "Lỗi khi tìm kiếm truyện Zhihu / 盐选" });
    }
  });

  // Zhihu / Yanxuan: Get Story Detail & Full Text (Unlocked VIP)
  app.get("/api/zhihu/detail", async (req, res) => {
    try {
      const query = String(req.query.query || req.query.url || req.query.id || "").trim();
      if (!query) {
        return res.status(400).json({ success: false, error: "Thiếu đường dẫn, ID hoặc tên truyện Zhihu" });
      }
      const cookie = req.query.cookie ? String(req.query.cookie) : undefined;
      const story = await getZhihuStoryDetail(query, cookie);
      res.json({ success: true, story });
    } catch (err: any) {
      console.error("Zhihu detail error:", err);
      res.status(500).json({ success: false, error: err.message || "Lỗi khi mở khóa nội dung truyện" });
    }
  });

  // Zhihu / Yanxuan: Direct Download (TXT / EPUB)
  app.get("/api/zhihu/download", async (req, res) => {
    try {
      const query = String(req.query.query || req.query.url || req.query.id || "").trim();
      if (!query) {
        return res.status(400).send("Thiếu đường link hoặc ID truyện Zhihu");
      }
      const format = String(req.query.format || "txt").toLowerCase();
      const cookie = req.query.cookie ? String(req.query.cookie) : undefined;

      const story = await getZhihuStoryDetail(query, cookie);
      const safeTitle = (story.title || "Zhihu_Story").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 100);

      if (format === "epub") {
        const epubBuffer = await generateZhihuEpub(story);
        res.setHeader("Content-Type", "application/epub+zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(safeTitle)}.epub"`
        );
        return res.send(epubBuffer);
      } else {
        // Default TXT
        const txtContent = generateZhihuTxt(story);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(safeTitle)}.txt"`
        );
        return res.send(txtContent);
      }
    } catch (err: any) {
      console.error("Zhihu download error:", err);
      res.status(500).send(`Lỗi khi tải truyện Zhihu: ${err.message}`);
    }
  });

  // Zhihu: Parse Raw Text / HTML Input
  app.post("/api/zhihu/parse-raw", (req, res) => {
    try {
      const { text, title, author, sourceUrl } = req.body || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ success: false, error: "Vui lòng nhập nội dung văn bản" });
      }
      const story = createZhihuStoryFromRawText(text, title, author, sourceUrl);
      res.json({ success: true, story });
    } catch (err: any) {
      console.error("Zhihu parse-raw error:", err);
      res.status(400).json({ success: false, error: err.message || "Lỗi xử lý nội dung văn bản" });
    }
  });

  // Zhihu: Export in-memory story to EPUB or TXT
  app.post("/api/zhihu/export", async (req, res) => {
    try {
      const { story, format = "txt" } = req.body || {};
      if (!story || !story.title) {
        return res.status(400).send("Dữ liệu bài viết không hợp lệ");
      }
      const safeTitle = (story.title || "Zhihu_Story").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 100);

      if (String(format).toLowerCase() === "epub") {
        const epubBuffer = await generateZhihuEpub(story);
        res.setHeader("Content-Type", "application/epub+zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(safeTitle)}.epub"`
        );
        return res.send(epubBuffer);
      } else {
        const txtContent = generateZhihuTxt(story);
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(safeTitle)}.txt"`
        );
        return res.send(txtContent);
      }
    } catch (err: any) {
      console.error("Zhihu export error:", err);
      res.status(500).send(`Lỗi xuất file: ${err.message}`);
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
