import https from 'https';
import http from 'http';
import * as cheerio from 'cheerio';

export interface QimaoBook {
  book_id: string;
  book_name: string;
  author: string;
  thumb_url: string;
  score: string;
  category: string;
  tags: string;
  abstract: string;
  word_number: string;
  chapter_count: number;
  last_chapter_title: string;
  creation_status: string;
}

export interface QimaoChapterItem {
  item_id: string;
  title: string;
  volume_title?: string;
  char_count?: number;
  update_time?: string;
  is_vip?: boolean;
}

export function parseQimaoBookId(input: string): string {
  const trimmed = String(input || '').trim();
  // Pure digits
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  // Matches detail/12345 or showchapter/12345.html or book/12345 or shuku/12345 or shuku/12345/
  const match = trimmed.match(/(?:detail|showchapter|book|shuku|chapter)\/(\d+)/i) ||
                trimmed.match(/[?&](?:bookId|book_id|id)=(\d+)/i) ||
                trimmed.match(/(\d+)(?:\.html|\/)?$/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Custom fetch helper using Node native HTTP/HTTPS with insecureHTTPParser: true
 * to bypass non-standard whitespace headers returned by Qimao servers.
 */
export function qimaoFetch(urlStr: string, options: any = {}): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(urlStr);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      const reqOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.qimao.com/',
          ...(options.headers || {})
        },
        insecureHTTPParser: true
      };

      const req = client.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString('utf-8');
          resolve({
            ok: !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
            status: res.statusCode || 500,
            text: async () => text,
            json: async () => JSON.parse(text)
          });
        });
      });

      req.on('error', err => reject(err));
      if (options.timeout) {
        req.setTimeout(options.timeout, () => {
          req.destroy(new Error('Request timeout'));
        });
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Search Qimao / Zongheng Books
 */
export async function searchQimaoBooks(keyword: string, limit: number = 20): Promise<QimaoBook[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const results: QimaoBook[] = [];
  const seenIds = new Set<string>();

  // 1. Qimao Official Web Search API
  try {
    const qimaoSearchUrl = `https://www.qimao.com/api/search/result?keyword=${encodeURIComponent(trimmed)}`;
    const res = await qimaoFetch(qimaoSearchUrl, { timeout: 4000 });
    if (res.ok) {
      const json = await res.json();
      const list = json?.data?.search_list || json?.data?.all_search_list || [];
      if (Array.isArray(list)) {
        for (const item of list) {
          if (results.length >= limit) break;
          const bookId = String(item.book_id || item.id || '');
          if (!bookId || seenIds.has(bookId)) continue;
          seenIds.add(bookId);

          const title = String(item.title || item.book_name || '').replace(/<[^>]+>/g, '').trim();
          const author = String(item.author || '').replace(/<[^>]+>/g, '').trim();
          const cover = item.image_link || item.free_image_link || item.cover || '';
          const intro = String(item.intro || item.abstract || item.description || '').replace(/<[^>]+>/g, '').trim();
          const wordsNum = item.words_num ? `${item.words_num} vạn chữ` : 'Đang cập nhật';

          results.push({
            book_id: bookId,
            book_name: title || `Truyện Qimao #${bookId}`,
            author: author || 'Tác giả Qimao',
            thumb_url: cover,
            score: item.score || '9.2',
            category: item.category_1_name || 'Tiểu thuyết',
            tags: `${item.category_1_name || 'Tiểu thuyết'}, Qimao Miễn phí`,
            abstract: intro,
            word_number: wordsNum,
            chapter_count: Number(item.chapter_count || item.total_chapter_num || 0),
            last_chapter_title: item.latest_chapter_title || '',
            creation_status: 'Đang ra'
          });
        }
      }
    }
  } catch (e: any) {
    console.error("Qimao official web search error:", e.message);
  }

  // 2. Zongheng API Search Fallback
  if (results.length < limit) {
    try {
      const searchUrl = `https://search.zongheng.com/search/book?keyword=${encodeURIComponent(trimmed)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://search.zongheng.com/',
          'Accept': 'application/json, text/plain, */*',
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const rawList = data?.data?.datas?.list || [];
        for (const item of rawList) {
          if (results.length >= limit) break;
          const bookId = String(item.bookId);
          if (seenIds.has(bookId)) continue;
          seenIds.add(bookId);

          const rawName = String(item.name || '').replace(/<[^>]+>/g, '').trim();
          const rawDesc = String(item.description || '').replace(/<[^>]+>/g, '').trim();
          let cover = item.coverUrl || item.coverUrlNonLogo || '';
          if (cover && !cover.startsWith('http')) {
            cover = `https://static.zongheng.com/upload${cover.startsWith('/') ? '' : '/'}${cover}`;
          }

          const totalWords = Number(item.totalWord || 0);
          let wordDisplay = totalWords > 10000 ? `${(totalWords / 10000).toFixed(1)} vạn chữ` : `${totalWords} chữ`;

          results.push({
            book_id: bookId,
            book_name: rawName || `Truyện #${bookId}`,
            author: item.authorName || 'Tác giả',
            thumb_url: cover,
            score: '9.2',
            category: item.cateFineName || item.catePName || 'Tiểu thuyết',
            tags: `${item.cateFineName || item.catePName || 'Tiểu thuyết'}${item.keyword ? `, ${item.keyword}` : ''}`,
            abstract: rawDesc,
            word_number: wordDisplay,
            chapter_count: 0,
            last_chapter_title: item.chapterName || '',
            creation_status: item.serialStatus === 0 ? 'Đã hoàn thành' : 'Đang ra'
          });
        }
      }
    } catch (e: any) {
      console.error("Zongheng search error:", e.message);
    }
  }

  return results;
}

/**
 * Fetch Book Metadata for Qimao / Zongheng book
 */
export async function getQimaoBookInfo(bookId: string): Promise<QimaoBook> {
  const cleanId = parseQimaoBookId(bookId);

  let bookName = '';
  let author = '';
  let cover = '';
  let intro = '';
  let category = 'Tiểu thuyết';
  let totalWords = '0';
  let latestChapterName = '';
  let isCompleted = false;

  // 1. Try Qimao Official Main Info API
  try {
    const qimaoApiUrl = `https://www.qimao.com/api/book-detail/main-info?book_id=${cleanId}`;
    const res = await qimaoFetch(qimaoApiUrl, { timeout: 4000 });
    if (res.ok) {
      const json = await res.json();
      const detail = json?.data?.book_detail;
      if (detail) {
        bookName = detail.title || detail.book_name || '';
        author = detail.author || '';
        cover = detail.free_image_link || detail.image_link || '';
        intro = detail.intro || detail.description || detail.abstract || '';
        category = detail.category_1_name || 'Tiểu thuyết';
        totalWords = detail.words_num ? String(detail.words_num) : '0';
        latestChapterName = detail.latest_chapter_title || '';
      }
    }
  } catch (e) {}

  // 2. Try Qimao Desktop HTML Page Fallback if needed
  if (!bookName) {
    try {
      const qimaoUrl = `https://www.qimao.com/shuku/${cleanId}/`;
      const res = await qimaoFetch(qimaoUrl, { timeout: 4000 });

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        bookName = $('meta[property="og:title"]').attr('content') ||
                   $('meta[name="og:title"]').attr('content') ||
                   $('.work-data-h1').text().trim() ||
                   $('.book-title').text().trim() ||
                   $('.title').first().text().trim() ||
                   $('h1').first().text().trim() || '';
        bookName = bookName.replace(/^[《<]/, '').replace(/[》>].*$/, '').trim();

        author = $('meta[property="og:novel:author"]').attr('content') ||
                 $('.author-name').text().trim() ||
                 $('.au-name').text().trim() ||
                 $('.author').text().trim() || '';

        cover = $('meta[property="og:image"]').attr('content') ||
                $('.pic img').attr('src') ||
                $('.book-pic img').attr('src') ||
                $('.cover img').attr('src') || '';

        intro = $('meta[property="og:description"]').attr('content') ||
                $('.work-data-intro').text().trim() ||
                $('.intro').text().trim() ||
                $('.desc').text().trim() || '';

        const cate = $('meta[property="og:novel:category"]').attr('content') || $('.work-data-tag span').first().text().trim();
        if (cate) category = cate;

        const scripts = $('script').map((_, el) => $(el).html()).get().join('\n');
        const bookNameMatch = scripts.match(/bookName\s*:\s*["']([^"']+)["']/);
        if (bookNameMatch && !bookName) bookName = bookNameMatch[1];
        const authorMatch = scripts.match(/pseudonym\s*:\s*["']([^"']+)["']/);
        if (authorMatch && !author) author = authorMatch[1];
        const coverMatch = scripts.match(/bookCover\s*:\s*["']([^"']+)["']/);
        if (coverMatch && !cover) cover = coverMatch[1].replace(/\\u002F/g, '/');
        const introMatch = scripts.match(/description\s*:\s*["']([^"']+)["']/);
        if (introMatch && !intro) intro = introMatch[1].replace(/\\n/g, '\n').replace(/\\u002F/g, '/');
      }
    } catch (e) {}
  }

  // Fetch catalog to get exact chapter count & latest chapter title
  let chapterCount = 0;
  try {
    const catalog = await getQimaoCatalog(cleanId);
    chapterCount = catalog.chapter_list.length;
    if (chapterCount > 0 && !latestChapterName) {
      latestChapterName = catalog.chapter_list[chapterCount - 1].title;
    }
  } catch (e) {}

  const wordsNum = Number(totalWords || 0);
  const wordDisplay = wordsNum > 0 ? `${wordsNum} vạn chữ` : (chapterCount > 0 ? `${chapterCount} chương` : 'Đang cập nhật');

  return {
    book_id: cleanId,
    book_name: bookName || `Truyện Qimao #${cleanId}`,
    author: author || 'Tác giả Qimao',
    thumb_url: cover,
    score: '9.2',
    category: category,
    tags: `${category}, Miễn phí Qimao`,
    abstract: intro || 'Truyện chữ miễn phí từ Qimao / Zongheng',
    word_number: wordDisplay,
    chapter_count: chapterCount,
    last_chapter_title: latestChapterName,
    creation_status: isCompleted ? 'Đã hoàn thành' : 'Đang ra'
  };
}

/**
 * Fetch Full Chapter Catalog for Qimao / Zongheng book
 */
export async function getQimaoCatalog(bookId: string): Promise<{ chapter_list: QimaoChapterItem[]; total_count: number }> {
  const cleanId = parseQimaoBookId(bookId);
  const chapterList: QimaoChapterItem[] = [];
  const seenIds = new Set<string>();

  // Source A: Try Qimao Official Web Chapter List API
  try {
    const apiUrl = `https://www.qimao.com/api/book/chapter-list?book_id=${cleanId}`;
    const res = await qimaoFetch(apiUrl, { timeout: 4000 });
    if (res.ok) {
      const json = await res.json();
      const rawChapters = json?.data?.chapters || json?.data?.chapter_list || [];
      if (Array.isArray(rawChapters) && rawChapters.length > 0) {
        rawChapters.forEach((c: any, index: number) => {
          const itemId = String(c.id || c.chapter_id || c.item_id || '');
          let rawTitle = String(c.title || c.name || c.chapter_name || '').replace(/\s+/g, ' ').trim();
          if (itemId && rawTitle && !seenIds.has(itemId)) {
            seenIds.add(itemId);
            let updateTimeStr = '';
            if (c.update_time) {
              try {
                const ts = Number(c.update_time) * (String(c.update_time).length === 10 ? 1000 : 1);
                updateTimeStr = new Date(ts).toISOString().split('T')[0];
              } catch (e) {}
            }

            // Ensure title has clear chapter index formatting
            const hasChapNum = /^(?:第|Chương\s*)\d+/i.test(rawTitle);
            const formattedTitle = hasChapNum ? rawTitle : `第${index + 1}章 ${rawTitle}`;

            chapterList.push({
              item_id: itemId,
              title: formattedTitle,
              volume_title: c.volume_name || c.volume_title || undefined,
              char_count: c.words ? Number(c.words) : undefined,
              update_time: updateTimeStr,
              is_vip: c.is_vip === '1' || !!c.is_vip
            });
          }
        });
      }
    }
  } catch (e: any) {
    console.error("Qimao chapter-list API error:", e.message);
  }

  // Source B: Try Qimao Mobile APIs
  if (chapterList.length === 0) {
    const mApiUrls = [
      `https://www.qimao.com/api/m/book/chapter-list?book_id=${cleanId}`,
      `https://m.qimao.com/api/m/book/chapter-list?book_id=${cleanId}`,
      `https://www.wtzw.com/api/m/book/chapter-list?book_id=${cleanId}`
    ];

    for (const mUrl of mApiUrls) {
      if (chapterList.length > 0) break;
      try {
        const res = await qimaoFetch(mUrl, {
          timeout: 3500,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Referer': `https://m.qimao.com/shuku/${cleanId}/`
          }
        });

        if (res.ok) {
          const json = await res.json();
          const rawList = json?.data?.chapter_list || json?.data || json?.chapters || [];
          if (Array.isArray(rawList) && rawList.length > 0) {
            rawList.forEach((c: any, index: number) => {
              const itemId = String(c.id || c.chapter_id || c.item_id || '');
              let rawTitle = String(c.title || c.name || c.chapter_name || '').replace(/\s+/g, ' ').trim();
              if (itemId && rawTitle && !seenIds.has(itemId)) {
                seenIds.add(itemId);
                const hasChapNum = /^(?:第|Chương\s*)\d+/i.test(rawTitle);
                const formattedTitle = hasChapNum ? rawTitle : `第${index + 1}章 ${rawTitle}`;
                chapterList.push({
                  item_id: itemId,
                  title: formattedTitle,
                  volume_title: c.volume_name || c.volume_title || undefined,
                  is_vip: !!(c.is_vip || c.vip)
                });
              }
            });
          }
        }
      } catch (e) {}
    }
  }

  return {
    chapter_list: chapterList,
    total_count: chapterList.length
  };
}

const zhBookIdCache = new Map<string, string>();

export async function getZonghengBookId(bookName: string): Promise<string | null> {
  if (!bookName) return null;
  const cleanName = bookName.replace(/<[^>]+>/g, '').trim();
  if (zhBookIdCache.has(cleanName)) {
    return zhBookIdCache.get(cleanName)!;
  }

  try {
    const searchUrl = `https://search.zongheng.com/search/book?keyword=${encodeURIComponent(cleanName)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://search.zongheng.com/'
      }
    });
    if (res.ok) {
      const data = await res.json();
      const list = data?.data?.datas?.list || [];
      if (Array.isArray(list) && list.length > 0) {
        const exactMatch = list.find((b: any) => {
          const nameNoTag = (b.name || '').replace(/<[^>]+>/g, '').trim();
          return nameNoTag === cleanName;
        }) || list[0];
        if (exactMatch && exactMatch.bookId) {
          const zhId = String(exactMatch.bookId);
          zhBookIdCache.set(cleanName, zhId);
          return zhId;
        }
      }
    }
  } catch (e: any) {
    console.error("getZonghengBookId error:", e.message);
  }
  return null;
}

/**
 * Fetch Full Unabridged Chapter Content
 */
export async function getQimaoChapter(
  bookId: string,
  chapterId: string,
  chapterTitle?: string,
  bookName?: string,
  chapterIndex?: number
): Promise<{ title: string; content: string }> {
  const cleanBookId = parseQimaoBookId(bookId);
  const cleanChapId = parseQimaoBookId(chapterId);

  let fetchedTitle = chapterTitle || '';
  let paras: string[] = [];

  // 1. Try Qimao Desktop Reading Page
  try {
    const qUrl = `https://www.qimao.com/shuku/${cleanBookId}-${cleanChapId}/`;
    const res = await qimaoFetch(qUrl, { timeout: 4000 });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const pageTitle = $('.chapter-title').text().trim() || $('.title_txtbox').text().trim() || $('h1').first().text().trim();
      if (pageTitle && !fetchedTitle) fetchedTitle = pageTitle;

      $('.chapter-content p, .article p, .reader-content p, .txt p, .content p').each((_, el) => {
        const t = $(el).text().trim();
        if (t && !t.includes('下下下 载载载') && !t.includes('看全文') && !t.includes('扫描下方二维码') && !t.includes('下载七猫')) {
          paras.push(t);
        }
      });
    }
  } catch (e) {}

  // 2. If Qimao web page returned 0 paragraphs, try Zongheng Mobile Reader page (native official free reader)
  if (paras.length === 0 && bookName) {
    try {
      const zhBookId = await getZonghengBookId(bookName);
      if (zhBookId) {
        const zhUrl = `https://m.zongheng.com/chapter/${zhBookId}/${cleanChapId}.html`;
        const res = await fetch(zhUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            'Referer': `https://m.zongheng.com/book/${zhBookId}.html`
          }
        });
        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);
          const pageTitle = $('title').text().trim().split('_')[0] || '';
          if (pageTitle && !fetchedTitle) fetchedTitle = pageTitle;

          $('.content p, .reader p, #reader-content p, .chap-content p, p').each((_, el) => {
            const t = $(el).text().trim();
            if (t && t.length > 5 && !t.includes('下载') && !t.includes('App') && !t.includes('七猫') && !t.includes('纵横')) {
              paras.push(t);
            }
          });
        }
      }
    } catch (e: any) {
      console.error("Zongheng mobile chapter fetch error:", e.message);
    }
  }

  const rawFullText = paras.join('\n\n').trim();
  const indexPrefix = chapterIndex ? `第${chapterIndex}章` : '';
  let displayTitle = fetchedTitle || (indexPrefix ? `${indexPrefix}` : `第${cleanChapId}章`);
  if (chapterIndex && fetchedTitle) {
    const cleanTitleNoNum = fetchedTitle.replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*[:：]?\s*/i, '').trim();
    displayTitle = `第${chapterIndex}章 ${cleanTitleNoNum}`;
  }

  // Return fetched raw paragraphs if available
  if (rawFullText.length > 0) {
    const formattedContent = `==================================================\n${displayTitle}\n==================================================\n\n${rawFullText}`;
    return {
      title: displayTitle,
      content: formattedContent
    };
  }

  // Fallback if content truly unavailable
  const fallbackHeader = `==================================================\n${displayTitle}\n==================================================\n\n`;
  return {
    title: displayTitle,
    content: fallbackHeader + `（章节“${displayTitle}”为七猫VIP付费/锁章，网页端未提供正文）`
  };
}
