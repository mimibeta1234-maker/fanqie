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
  searchBooks,
  formatAbstract,
  extractFanqieHdCover
} from "./server/fanqieCore";
import {
  parseQimaoBookId,
  getQimaoBookInfo,
  getQimaoCatalog,
  getQimaoChapter,
  searchQimaoBooks
} from "./server/qimaoCore";
import { downloadManager } from "./server/downloadManager";

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
        abstract: formatAbstract(bookData.book_abstract_v2 || bookData.abstract || bookData.summary || ""),
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

  // Extract HD cover for Fanqie
  app.get("/api/book/cover/extract", async (req, res) => {
    try {
      const input = String(req.query.input || req.query.url || req.query.id || "").trim();
      const bookName = String(req.query.bookName || "").trim();
      const author = String(req.query.author || "").trim();

      if (!input) {
        return res.status(400).json({ success: false, error: "Thiếu link ảnh bìa, ID truyện hoặc link truyện" });
      }

      const coverData = await extractFanqieHdCover(input, bookName, author);
      res.json({ success: true, cover: coverData });
    } catch (err: any) {
      console.error("Cover extract error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể trích xuất bìa HD" });
    }
  });

  // Helper to fetch novel cover image buffer across multiple CDNs & referers
  async function fetchCoverBufferWithFallback(targetUrl: string, hash?: string, folder?: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const candidateUrls: string[] = [targetUrl];
    
    if (hash && hash !== 'direct') {
      const f = folder || 'novel-pic-r';
      candidateUrls.push(
        `https://p3-novel.byteimg.com/${f}/${hash}~tplv-resize:1600:0.image`,
        `https://p6-novel.byteimg.com/${f}/${hash}~tplv-resize:1600:0.image`,
        `https://p3-novel.byteimg.com/${f}/${hash}~noop.image`,
        `https://p3-novel.byteimg.com/origin/${f}/${hash}`,
        `https://p3-novel.byteimg.com/novel-pic-r/${hash}~tplv-resize:1600:0.image`,
        `https://p3-novel.byteimg.com/novel-pic/${hash}~tplv-resize:1600:0.image`,
        `https://p3-novel.byteimg.com/tos-cn-i-qvj2lq49zg/${hash}~tplv-resize:1600:0.image`,
        `https://p3-novel.byteimg.com/novel-pic-r/${hash}~tplv-resize:225:300.image`
      );
    }

    const uniqueCandidates = Array.from(new Set(candidateUrls.filter(Boolean)));
    const referers = [
      "https://fanqienovel.com/",
      "https://www.qimao.com/",
      "https://novel.snssdk.com/",
      ""
    ];

    for (const url of uniqueCandidates) {
      for (const referer of referers) {
        try {
          const headers: Record<string, string> = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          };
          if (referer) {
            headers["Referer"] = referer;
          }

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const imgRes = await fetch(url, { headers, signal: controller.signal });
          clearTimeout(timer);

          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf.length > 500) {
              const ct = imgRes.headers.get("content-type") || "image/jpeg";
              return { buffer: buf, contentType: ct };
            }
          }
        } catch (e) {}
      }
    }

    return null;
  }

  // Cover image proxy (bypasses browser CORS & hotlink 403 blocks)
  app.get("/api/book/cover/proxy", async (req, res) => {
    try {
      const targetUrl = String(req.query.url || "").trim();
      const hash = String(req.query.hash || "").trim();
      const folder = String(req.query.folder || "").trim();

      if (!targetUrl && !hash) {
        return res.status(400).send("Thiếu thông tin ảnh bìa");
      }

      const result = await fetchCoverBufferWithFallback(targetUrl, hash, folder);
      if (!result) {
        return res.status(404).send("Không thể tải ảnh bìa từ các máy chủ CDN");
      }

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Length", result.buffer.length);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(result.buffer);
    } catch (err: any) {
      console.error("Cover proxy error:", err);
      res.status(500).send("Lỗi tải ảnh");
    }
  });

  // Download HD cover proxy (handles CORS and enforces file download header)
  app.get("/api/book/cover/download", async (req, res) => {
    try {
      const targetUrl = String(req.query.url || "").trim();
      const filename = String(req.query.filename || "Bia_Truyen_HD.jpg").trim();
      const hash = String(req.query.hash || "").trim();
      const folder = String(req.query.folder || "").trim();

      if (!targetUrl && !hash) {
        return res.status(400).json({ success: false, error: "Thiếu link ảnh hợp lệ" });
      }

      const result = await fetchCoverBufferWithFallback(targetUrl, hash, folder);
      if (!result) {
        return res.status(500).json({ success: false, error: "Không thể tải ảnh từ máy chủ" });
      }

      const contentType = result.contentType || (filename.endsWith(".png") ? "image/png" : "image/jpeg");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader("Content-Length", result.buffer.length);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(result.buffer);
    } catch (err: any) {
      console.error("Cover download proxy error:", err);
      res.status(500).json({ success: false, error: err.message || "Lỗi khi tải ảnh bìa" });
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
      const rawInput = String(req.query.id || req.query.url || req.query.bookId || req.query.book_id || "").trim();
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
      const rawInput = String(req.query.id || req.query.bookId || req.query.book_id || "").trim();
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
      const { bookId, itemId, title, bookName, chapterIndex, author } = req.body;
      if (!itemId) {
        return res.status(400).json({ success: false, error: "Thiếu ID chương" });
      }
      const cleanBookId = parseQimaoBookId(bookId || "");
      const chapter = await getQimaoChapter(cleanBookId, String(itemId), title, bookName, chapterIndex, author);
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
      const { bookId, range, ranges, includeIntro } = req.body;
      if (!bookId) {
        return res.status(400).json({ success: false, error: "Thiếu ID truyện" });
      }
      const cleanId = parseQimaoBookId(bookId);
      const bookInfo = await getQimaoBookInfo(cleanId);
      const catalog = await getQimaoCatalog(cleanId);

      const rangeParam = ranges && Array.isArray(ranges) && ranges.length > 0 ? ranges : range;
      const task = downloadManager.createTask(cleanId, bookInfo, catalog, rangeParam, 'qimao', includeIntro !== false);
      downloadManager.runDownload(task.taskId);

      res.json({ success: true, taskId: task.taskId, totalChapters: task.totalChapters, ranges: task.ranges });
    } catch (err: any) {
      console.error("Start Qimao download error:", err);
      res.status(500).json({ success: false, error: err.message || "Không thể khởi tạo tiến trình tải Qimao" });
    }
  });

  // Start download task
  app.post("/api/download/start", async (req, res) => {
    try {
      const { bookId, range, ranges, includeIntro } = req.body;
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
        abstract: formatAbstract(bookData.book_abstract_v2 || bookData.abstract || bookData.summary || ""),
        category: bookData.category || "Tiểu thuyết",
        tags: bookData.tags || bookData.category || "Tiểu thuyết"
      };

      const rangeParam = ranges && Array.isArray(ranges) && ranges.length > 0 ? ranges : range;
      const task = downloadManager.createTask(cleanId, bookInfo, catalog, rangeParam, 'fanqie', includeIntro !== false);
      // Run async in background
      downloadManager.runDownload(task.taskId);

      res.json({ success: true, taskId: task.taskId, totalChapters: task.totalChapters, ranges: task.ranges });
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
        errorMessage: task.errorMessage,
        ranges: task.ranges
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

  // Export downloaded novel as TXT, EPUB or ZIP
  app.get("/api/download/export", async (req, res) => {
    try {
      const taskId = String(req.query.taskId || "");
      const format = String(req.query.format || "txt").toLowerCase();
      const rangeIndexStr = req.query.rangeIndex;
      const rangeIndex = rangeIndexStr !== undefined && rangeIndexStr !== '' ? parseInt(String(rangeIndexStr)) : undefined;

      const task = downloadManager.getTask(taskId);

      if (!task) {
        return res.status(404).send("Không tìm thấy tiến trình tải này");
      }

      const bookName = (task.bookInfo?.book_name || "novel").replace(/[^\w\s\u4e00-\u9fa5\u00C0-\u1EF9]/gi, '_');

      if (format === "zip") {
        const zipBuffer = await downloadManager.generateZip(taskId);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(bookName)}_cac_khoang.zip"`
        );
        return res.send(zipBuffer);
      } else if (format === "epub") {
        const epubBuffer = await downloadManager.generateEpub(taskId);
        res.setHeader("Content-Type", "application/epub+zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(bookName)}.epub"`
        );
        return res.send(epubBuffer);
      } else {
        const txtContent = downloadManager.generateTxt(taskId, rangeIndex);
        let filename = `${bookName}.txt`;
        if (rangeIndex !== undefined && task.ranges && task.ranges[rangeIndex]) {
          const r = task.ranges[rangeIndex];
          filename = `${bookName}_[Chương_${r.start}-${r.end}].txt`;
        }
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(filename)}"`
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
