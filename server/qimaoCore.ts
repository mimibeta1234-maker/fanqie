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

  // 3. Try Zongheng HTML Page Fallback if not found on Qimao (e.g. ID is from Zongheng)
  if (!bookName) {
    try {
      const zhUrls = [
        `https://huayu.zongheng.com/book/${cleanId}.html`,
        `https://book.zongheng.com/book/${cleanId}.html`
      ];
      for (const zhUrl of zhUrls) {
        if (bookName) break;
        const res = await fetch(zhUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://search.zongheng.com/'
          }
        });
        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);
          bookName = $('meta[property="og:title"]').attr('content') ||
                     $('.book-name').text().trim() ||
                     $('h1').first().text().trim() || '';
          bookName = bookName.replace(/^[《<]/, '').replace(/[》>].*$/, '').trim();

          author = $('meta[property="og:novel:author"]').attr('content') ||
                   $('.au-name a').text().trim() ||
                   $('.author-name').text().trim() || '';

          cover = $('meta[property="og:image"]').attr('content') ||
                  $('.book-img img').attr('src') || '';

          intro = $('meta[property="og:description"]').attr('content') ||
                  $('.book-dec p').text().trim() || '';

          const cate = $('meta[property="og:novel:category"]').attr('content') || '';
          if (cate) category = cate;
        }
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

  // Source C: Try Zongheng / Huayu chapter catalog (essential when bookId originates from Zongheng)
  if (chapterList.length === 0) {
    const zhCatalogUrls = [
      `https://huayu.zongheng.com/showchapter/${cleanId}.html`,
      `https://book.zongheng.com/showchapter/${cleanId}.html`
    ];

    for (const zhUrl of zhCatalogUrls) {
      if (chapterList.length > 0) break;
      try {
        const res = await fetch(zhUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://search.zongheng.com/'
          }
        });
        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);
          $('a[href*="/chapter/"]').each((index, el) => {
            const href = $(el).attr('href') || '';
            const title = $(el).text().trim();
            const cidMatch = href.match(/chapter\/\d+\/(\d+)\.html/);
            if (cidMatch && title) {
              const itemId = cidMatch[1];
              if (!seenIds.has(itemId)) {
                seenIds.add(itemId);
                const hasChapNum = /^(?:第|Chương\s*)\d+/i.test(title);
                const formattedTitle = hasChapNum ? title : `第${index + 1}章 ${title}`;
                const isVip = $(el).hasClass('vip') || $(el).find('em.vip').length > 0 || $(el).find('.icon-vip').length > 0;
                chapterList.push({
                  item_id: itemId,
                  title: formattedTitle,
                  is_vip: isVip
                });
              }
            }
          });
        }
      } catch (e: any) {
        console.error("Zongheng showchapter catalog fetch error:", e.message);
      }
    }
  }

  return {
    chapter_list: chapterList,
    total_count: chapterList.length
  };
}

const zhBookIdCache = new Map<string, string>();
const zhCatalogCache = new Map<string, Array<{ cid: string; title: string }>>();
const quanbenSlugCache = new Map<string, string>();
const mirrorBookCache = new Map<string, string>();

function cleanParagraphs(rawParas: string[]): string[] {
  const junkPatterns = [
    /扫一扫[·\s]*手机接着看/i,
    /公交地铁随意阅读[，,\s]*新用户享超额福利/i,
    /手机接着看/i,
    /扫码继续阅读/i,
    /打开七猫免费小说/i,
    /下载七猫免费小说/i,
    /扫描下方二维码/i,
    /在APP中继续阅读/i,
    /前往七猫APP/i,
    /APP内免费看/i,
    /去APP看完整版/i,
    /一秒记住/i,
    /xstime/i,
    /quanben/i,
    /最新网址/i,
    /本站域名/i,
    /关注微信公众号/i,
    /无广告阅读/i,
    /下下下\s*载载载/i,
    /扫一扫/i
  ];

  return rawParas
    .map(p => p.trim())
    .filter(p => {
      if (!p || p.length < 2) return false;
      return !junkPatterns.some(pat => pat.test(p));
    });
}

function isContentTruncated(paras: string[]): boolean {
  if (paras.length === 0) return true;
  const full = paras.join('\n');

  if (
    full.includes('扫一扫') ||
    full.includes('手机接着看') ||
    full.includes('公交地铁随意阅读') ||
    full.includes('超额福利') ||
    full.includes('扫码继续阅读') ||
    full.includes('在APP中继续阅读') ||
    full.includes('前往七猫APP')
  ) {
    return true;
  }

  // Standard Chinese web novel chapter is 1500 - 5000 chars.
  // If fewer than 8 paragraphs and < 900 chars, or ends abruptly with ellipsis and short
  if (paras.length < 8 && full.length < 900) {
    return true;
  }
  if (full.length < 1000 && (/……\s*$/.test(full) || /\.\.\.\s*$/.test(full))) {
    return true;
  }

  return false;
}

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

export async function getZonghengChapters(zhBookId: string): Promise<Array<{ cid: string; title: string }>> {
  if (zhCatalogCache.has(zhBookId)) {
    return zhCatalogCache.get(zhBookId)!;
  }
  const urls = [
    `https://huayu.zongheng.com/showchapter/${zhBookId}.html`,
    `https://book.zongheng.com/showchapter/${zhBookId}.html`
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://search.zongheng.com/'
        }
      });
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const list: Array<{ cid: string; title: string }> = [];
        const seen = new Set<string>();
        $('a[href*="/chapter/"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const title = $(el).text().trim();
          const m = href.match(/chapter\/\d+\/(\d+)\.html/);
          if (m && title && !seen.has(m[1])) {
            seen.add(m[1]);
            list.push({ cid: m[1], title });
          }
        });
        if (list.length > 0) {
          zhCatalogCache.set(zhBookId, list);
          return list;
        }
      }
    } catch (e) {}
  }
  return [];
}

async function getQuanbenSlug(bookName: string): Promise<string | null> {
  if (!bookName) return null;
  const cleanName = bookName.replace(/<[^>]+>/g, '').replace(/[，,！!？?：:].*$/, '').trim();
  if (!cleanName) return null;
  if (quanbenSlugCache.has(cleanName)) return quanbenSlugCache.get(cleanName)!;

  try {
    const searchUrl = `https://quanben.io/index.php?c=book&a=search&keywords=${encodeURIComponent(cleanName)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const candidates: Array<{ slug: string; title: string }> = [];
      $('a[href*="/n/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim().replace(/^[《<]/, '').replace(/[》>].*$/, '').trim();
        const m = href.match(/\/n\/([^\/]+)\/?$/);
        if (m && text) {
          candidates.push({ slug: m[1], title: text });
        }
      });

      // Priority 1: Exact title match
      const exact = candidates.find(c => c.title === cleanName);
      if (exact) {
        quanbenSlugCache.set(cleanName, exact.slug);
        return exact.slug;
      }
      // Priority 2: Starts with cleanName
      const starts = candidates.find(c => c.title.startsWith(cleanName));
      if (starts) {
        quanbenSlugCache.set(cleanName, starts.slug);
        return starts.slug;
      }
      // Priority 3: Contains cleanName
      const contains = candidates.find(c => c.title.includes(cleanName));
      if (contains) {
        quanbenSlugCache.set(cleanName, contains.slug);
        return contains.slug;
      }
      if (candidates.length > 0) {
        quanbenSlugCache.set(cleanName, candidates[0].slug);
        return candidates[0].slug;
      }
    }
  } catch (e) {}
  return null;
}

async function fetchQuanbenChapter(slug: string, chapNum: number): Promise<{ title?: string; paras: string[] }> {
  try {
    const url = `https://quanben.io/n/${slug}/${chapNum}.html`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return { paras: [] };
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('h1, .headline, .title').first().text().trim();
    const paras: string[] = [];
    $('#content p, #articlebody p, .articlebody p, .content p').each((_, el) => {
      const t = $(el).text().trim();
      if (t && t.length > 4) {
        paras.push(t);
      }
    });
    return { title, paras: cleanParagraphs(paras) };
  } catch (e) {
    return { paras: [] };
  }
}

async function fetchWebMirrorChapter(
  bookName: string,
  chapterTitle: string,
  author?: string
): Promise<{ title?: string; paras: string[] } | null> {
  if (!bookName || !chapterTitle) return null;
  const cleanT = chapterTitle.replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*[:：]?\s*/i, '').trim();
  const cleanBook = bookName.replace(/<[^>]+>/g, '').replace(/[，,！!？?：:].*$/, '').trim();

  try {
    const cachedUrl = mirrorBookCache.get(cleanBook);
    const candidateUrls: string[] = cachedUrl ? [cachedUrl] : [];

    if (candidateUrls.length === 0) {
      const query = `${cleanBook} ${author || ''} ${cleanT}`.trim();
      const qUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(qUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        $('a').each((_, el) => {
          const href = $(el).attr('href') || '';
          if (href.includes('uddg=')) {
            const m = href.match(/uddg=([^&]+)/);
            if (m) {
              const decoded = decodeURIComponent(m[1]);
              if (
                !decoded.includes('qimao.com') &&
                !decoded.includes('zongheng.com') &&
                !decoded.includes('baidu.com') &&
                !decoded.includes('zhihu.com') &&
                !candidateUrls.includes(decoded)
              ) {
                candidateUrls.push(decoded);
              }
            }
          }
        });
      }
    }

    for (const u of candidateUrls.slice(0, 4)) {
      try {
        const cRes = await fetch(u, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (!cRes.ok) continue;
        const cHtml = await cRes.text();
        const $c = cheerio.load(cHtml);

        let chapUrl = u;
        if (u.includes('/book/') || u.includes('/novel/') || u.includes('/b/')) {
          if (!mirrorBookCache.has(cleanBook)) {
            mirrorBookCache.set(cleanBook, u);
          }
          $c('a').each((_, aEl) => {
            const aText = $c(aEl).text().trim();
            if (aText.includes(cleanT) || (cleanT.length > 3 && cleanT.slice(0, 4).split('').every(ch => aText.includes(ch)))) {
              const aHref = $c(aEl).attr('href');
              if (aHref) {
                try {
                  chapUrl = new URL(aHref, u).toString();
                  return false;
                } catch (e) {}
              }
            }
          });
        }

        if (chapUrl !== u || !u.includes('/book/')) {
          const chapRes = await fetch(chapUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (chapRes.ok) {
            const chapHtml = await chapRes.text();
            const $chap = cheerio.load(chapHtml);
            const paras: string[] = [];
            $chap('#nr_content p, #articlecontent p, #content p, #chaptercontent p, #readcontent p, .content p, .reader-content p').each((_, pEl) => {
              const t = $chap(pEl).text().trim();
              if (t && t.length > 5) paras.push(t);
            });
            const cleaned = cleanParagraphs(paras);
            if (cleaned.length >= 10) {
              return { title: cleanT, paras: cleaned };
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

function extractChapterNumber(title?: string, index?: number, fallbackId?: string): number {
  if (index && index > 0) return index;
  if (title) {
    const m = title.match(/第\s*(\d+)\s*章/) || title.match(/Chương\s*(\d+)/i) || title.match(/^(\d+)[\s.、_-]/);
    if (m) {
      const parsed = parseInt(m[1], 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  if (fallbackId) {
    const m = fallbackId.match(/(\d+)$/);
    if (m) {
      const parsed = parseInt(m[1].slice(-4), 10);
      if (!isNaN(parsed) && parsed > 0 && parsed < 5000) return parsed;
    }
  }
  return index || 1;
}

/**
 * Fetch Full Unabridged Chapter Content
 */
export async function getQimaoChapter(
  bookId: string,
  chapterId: string,
  chapterTitle?: string,
  bookName?: string,
  chapterIndex?: number,
  author?: string
): Promise<{ title: string; content: string }> {
  const cleanBookId = parseQimaoBookId(bookId);
  const cleanChapId = parseQimaoBookId(chapterId);

  let fetchedTitle = chapterTitle || '';
  let paras: string[] = [];

  // 1. Try Qimao Desktop Reading Page
  try {
    const qUrl = `https://www.qimao.com/shuku/${cleanBookId}-${cleanChapId}/`;
    const res = await qimaoFetch(qUrl, { timeout: 2500 });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const pageTitle = $('.chapter-title').text().trim() || $('.title_txtbox').text().trim() || $('h1').first().text().trim();
      if (pageTitle && !fetchedTitle) fetchedTitle = pageTitle;

      $('.chapter-content p, .article p, .reader-content p, .txt p, .content p').each((_, el) => {
        const t = $(el).text().trim();
        if (t) paras.push(t);
      });
      paras = cleanParagraphs(paras);
    }
  } catch (e) {}

  // Check if Qimao returned 0 paragraphs OR truncated preview/teaser
  const needsRescue = isContentTruncated(paras);
  if (needsRescue) {
    paras = []; // Discard truncated teaser lines so rescue fills real full content
  }

  // 2. Multi-source Rescue Fallback if Qimao web was truncated or locked
  if (paras.length === 0 && bookName) {
    const chapNum = extractChapterNumber(chapterTitle || fetchedTitle, chapterIndex, cleanChapId);

    // Fallback A: Rescue via Quanben Full-text Engine
    try {
      const slug = await getQuanbenSlug(bookName);
      if (slug) {
        const qbRes = await fetchQuanbenChapter(slug, chapNum);
        if (qbRes.paras.length > 0) {
          paras = qbRes.paras;
          if (qbRes.title && !fetchedTitle) fetchedTitle = qbRes.title;
        }
      }
    } catch (e: any) {
      console.error("Quanben fallback error:", e.message);
    }

    // Fallback B: Rescue via Web Novel Mirrors (xstime / wanshuku / xlink2 / etc.)
    if (paras.length === 0) {
      try {
        const mirrorRes = await fetchWebMirrorChapter(bookName, chapterTitle || fetchedTitle, author);
        if (mirrorRes && mirrorRes.paras.length > 0) {
          paras = mirrorRes.paras;
          if (mirrorRes.title && !fetchedTitle) fetchedTitle = mirrorRes.title;
        }
      } catch (e: any) {
        console.error("Mirror fallback error:", e.message);
      }
    }

    // Fallback C: Rescue via Zongheng Desktop / Mobile Reader with real chapter ID mapping
    if (paras.length === 0) {
      try {
        const zhBookId = await getZonghengBookId(bookName);
        if (zhBookId) {
          const zhList = await getZonghengChapters(zhBookId);
          // Find chapter by index or title matching
          let matchedZhChap = zhList[chapNum - 1];
          if (!matchedZhChap && fetchedTitle) {
            const cleanT = fetchedTitle.replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*/i, '').trim();
            matchedZhChap = zhList.find(c => c.title.includes(cleanT) || cleanT.includes(c.title));
          }

          if (matchedZhChap) {
            // Try Desktop Reader first
            const desktopUrl = `https://read.zongheng.com/chapter/${zhBookId}/${matchedZhChap.cid}.html`;
            const dRes = await fetch(desktopUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://huayu.zongheng.com/'
              }
            });
            if (dRes.ok) {
              const dHtml = await dRes.text();
              const $d = cheerio.load(dHtml);
              const dParas: string[] = [];
              $d('.content p, .reader-main p').each((_, el) => {
                const t = $d(el).text().trim();
                if (t && t.length > 5) dParas.push(t);
              });
              const cleanedD = cleanParagraphs(dParas);
              if (!isContentTruncated(cleanedD)) {
                paras = cleanedD;
                if (!fetchedTitle) fetchedTitle = matchedZhChap.title;
              }
            }

            // If desktop gave few paragraphs, try mobile
            if (paras.length === 0) {
              const mUrl = `https://m.zongheng.com/chapter/${zhBookId}/${matchedZhChap.cid}.html`;
              const mRes = await fetch(mUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
                  'Referer': `https://m.zongheng.com/book/${zhBookId}.html`
                }
              });
              if (mRes.ok) {
                const mHtml = await mRes.text();
                const $m = cheerio.load(mHtml);
                const mParas: string[] = [];
                $m('.content p, .reader p, #reader-content p, .chap-content p, p').each((_, el) => {
                  const t = $m(el).text().trim();
                  if (t && t.length > 5) mParas.push(t);
                });
                const cleanedM = cleanParagraphs(mParas);
                if (!isContentTruncated(cleanedM)) {
                  paras = cleanedM;
                }
              }
            }
          }
        }
      } catch (e: any) {
        console.error("Zongheng chapter fetch error:", e.message);
      }
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
