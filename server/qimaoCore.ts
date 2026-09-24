import https from 'https';
import http from 'http';
import zlib from 'zlib';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { decodeHtmlEntities } from './fanqieCore';

export function formatAbstract(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = decodeHtmlEntities(String(raw));

  // 1. Convert HTML line breaks to newlines
  s = s.replace(/<br\s*\/?>/gi, '\n')
       .replace(/<\/p>/gi, '\n\n')
       .replace(/<[^>]+>/g, '');

  // 2. Standardize carriage returns
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Convert multi-space / full-width em-space indentations into paragraph breaks
  s = s.replace(/[\t\u3000\u00A0 ]{2,}/g, '\n\n');

  // 4. Handle Chinese punctuation endings (。！？】”」』) followed by space/indent
  s = s.replace(/([。！？】”」』])[\t\u3000\u00A0 ]+(?=[^\s])/g, '$1\n\n');

  // 5. Clean up each line and eliminate redundant blank lines
  const lines = s.split('\n')
    .map(l => l.replace(/^[\s\u3000\u00A0]+/, '').replace(/[\s\u3000\u00A0]+$/, ''))
    .filter(Boolean);

  return lines.join('\n\n');
}

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
          'Accept': 'application/json, text/html, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.qimao.com/',
          ...(options.headers || {})
        },
        insecureHTTPParser: true
      };

      const req = client.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          let buffer = Buffer.concat(chunks);
          const encoding = res.headers['content-encoding'];
          try {
            if (encoding === 'gzip') {
              buffer = zlib.gunzipSync(buffer);
            } else if (encoding === 'deflate') {
              buffer = zlib.inflateSync(buffer);
            } else if (encoding === 'br') {
              buffer = zlib.brotliDecompressSync(buffer);
            }
          } catch (decompressErr) {
            // If decompression fails, use original buffer
          }
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
            abstract: formatAbstract(intro),
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
            abstract: formatAbstract(rawDesc),
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
        if (detail.is_over === 1 || detail.is_over === '1') isCompleted = true;
      }
    }
  } catch (e) {}

  // 1b. Dedicated Qimao Intro API (Official source for full synopsis)
  if (!intro) {
    try {
      const introApiUrl = `https://www.qimao.com/api/book-detail/intro?book_id=${cleanId}`;
      const introRes = await qimaoFetch(introApiUrl, { timeout: 4000 });
      if (introRes.ok) {
        const json = await introRes.json();
        const apiIntro = json?.data?.intro;
        if (apiIntro && typeof apiIntro === 'string') {
          intro = apiIntro.trim();
        }
      }
    } catch (e) {}
  }

  // 2. Try Qimao Desktop HTML Page Fallback if bookName or intro is missing
  if (!bookName || !intro) {
    try {
      const qimaoUrl = `https://www.qimao.com/shuku/${cleanId}/`;
      const res = await qimaoFetch(qimaoUrl, { timeout: 4000 });

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        if (!bookName) {
          bookName = $('meta[property="og:title"]').attr('content') ||
                     $('meta[name="og:title"]').attr('content') ||
                     $('.work-data-h1').text().trim() ||
                     $('.book-title').text().trim() ||
                     $('.title').first().text().trim() ||
                     $('h1').first().text().trim() || '';
          bookName = bookName.replace(/^[《<]/, '').replace(/[》>].*$/, '').trim();
        }

        if (!author) {
          author = $('meta[property="og:novel:author"]').attr('content') ||
                   $('.author-name').text().trim() ||
                   $('.au-name').text().trim() ||
                   $('.author').text().trim() || '';
        }

        if (!cover) {
          cover = $('meta[property="og:image"]').attr('content') ||
                  $('.pic img').attr('src') ||
                  $('.book-pic img').attr('src') ||
                  $('.cover img').attr('src') || '';
        }

        if (!intro) {
          const rawMetaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
          const metaMatch = rawMetaDesc.match(/简介[：:]\s*([\s\S]+)/);
          const extractedMeta = metaMatch ? metaMatch[1].trim() : '';

          intro = $('.intro').text().trim() ||
                  $('.work-data-intro').text().trim() ||
                  extractedMeta ||
                  $('.desc').text().trim() ||
                  rawMetaDesc;
        }

        if (!category) {
          const cate = $('meta[property="og:novel:category"]').attr('content') || $('.work-data-tag span').first().text().trim();
          if (cate) category = cate;
        }

        const scripts = $('script').map((_, el) => $(el).html()).get().join('\n');
        if (!bookName) {
          const bookNameMatch = scripts.match(/bookName\s*:\s*["']([^"']+)["']/);
          if (bookNameMatch) bookName = bookNameMatch[1];
        }
        if (!author) {
          const authorMatch = scripts.match(/pseudonym\s*:\s*["']([^"']+)["']/);
          if (authorMatch) author = authorMatch[1];
        }
        if (!cover) {
          const coverMatch = scripts.match(/bookCover\s*:\s*["']([^"']+)["']/);
          if (coverMatch) cover = coverMatch[1].replace(/\\u002F/g, '/');
        }
        if (!intro) {
          const introMatch = scripts.match(/description\s*:\s*["']([^"']+)["']/);
          if (introMatch) intro = introMatch[1].replace(/\\n/g, '\n').replace(/\\u002F/g, '/');
        }
      }
    } catch (e) {}
  }

  // 3. Try Zongheng HTML Page Fallback if not found on Qimao (e.g. ID is from Zongheng)
  if (!bookName || !intro) {
    try {
      const zhUrls = [
        `https://huayu.zongheng.com/book/${cleanId}.html`,
        `https://book.zongheng.com/book/${cleanId}.html`
      ];
      for (const zhUrl of zhUrls) {
        if (bookName && intro) break;
        const res = await fetch(zhUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://search.zongheng.com/'
          }
        });
        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);
          if (!bookName) {
            bookName = $('meta[property="og:title"]').attr('content') ||
                       $('.book-name').text().trim() ||
                       $('h1').first().text().trim() || '';
            bookName = bookName.replace(/^[《<]/, '').replace(/[》>].*$/, '').trim();
          }

          if (!author) {
            author = $('meta[property="og:novel:author"]').attr('content') ||
                     $('.au-name a').text().trim() ||
                     $('.author-name').text().trim() || '';
          }

          if (!cover) {
            cover = $('meta[property="og:image"]').attr('content') ||
                    $('.book-img img').attr('src') || '';
          }

          if (!intro) {
            intro = $('.book-dec p').text().trim() ||
                    $('meta[property="og:description"]').attr('content') || '';
          }

          const cate = $('meta[property="og:novel:category"]').attr('content') || '';
          if (cate && !category) category = cate;
        }
      }
    } catch (e) {}
  }

  // 4. Try Quanben Book Description Fallback if intro is still missing
  if (!intro && bookName) {
    try {
      const slug = await getQuanbenSlug(bookName);
      if (slug) {
        const qbRes = await fetch(`https://quanben.io/n/${slug}/`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (qbRes.ok) {
          const qbHtml = await qbRes.text();
          const $qb = cheerio.load(qbHtml);
          const qbIntro = $qb('.description, .intro, #intro, p.desc').first().text().trim();
          if (qbIntro && qbIntro.length > 20) {
            intro = qbIntro;
          }
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
  const cleanFormattedAbstract = formatAbstract(intro);

  return {
    book_id: cleanId,
    book_name: bookName || `Truyện Qimao #${cleanId}`,
    author: author || 'Tác giả Qimao',
    thumb_url: cover,
    score: '9.2',
    category: category,
    tags: `${category}, Miễn phí Qimao`,
    abstract: cleanFormattedAbstract || intro || '',
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
const mirrorCatalogCache = new Map<string, Array<{ title: string; url: string }>>();

function cleanParagraphs(rawParas: string[]): string[] {
  const junkPatterns = [
    /扫一扫[·\s]*手机接着看/i,
    /公交地铁随意阅读[，,\s]*新用户享超额福利/i,
    /上纵横小说支持作者[，,\s]*看最新章节/i,
    /纵横中文网/i,
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
    /扫一扫/i,
    /手机直接访问/i,
    /本章未完/i,
    /点击下一页/i,
    /加入书签/i,
    /投推荐票/i,
    /上一章/i,
    /下一章/i,
    /上一页/i,
    /下一页/i,
    /返回目录/i,
    /返回书页/i,
    /章节错误/i,
    /点此举报/i,
    /精武小说网/i,
    /笔趣阁/i,
    /我的书城网/i,
    /请收藏本站/i,
    /章节报错/i,
    /文学.*首.*发/i,
    /首发.*更新/i,
    /请记住本书首发域名/i,
    /顶点小说/i,
    /69书吧/i,
    /飘天文学/i
  ];

  const inlineWatermarkRegex = /(?:[\?？]{2,}[^\s\u4e00-\u9fa5]*[\u4e00-\u9fa5]*[^\s\u4e00-\u9fa5]*[\?？&|=¨±\$]+|[\u4e00-\u9fa5]*文学[^\s\u4e00-\u9fa5]*首[^\s\u4e00-\u9fa5]*发[^\s\u4e00-\u9fa5]*)/g;

  const cleaned = rawParas
    .map(p => {
      let c = decodeHtmlEntities(p.trim());
      c = c.replace(inlineWatermarkRegex, '').trim();
      return c;
    })
    .filter(p => {
      if (!p || p.length < 2) return false;
      return !junkPatterns.some(pat => pat.test(p));
    });

  // Deduplicate consecutive identical paragraphs
  const deduped: string[] = [];
  for (const p of cleaned) {
    if (deduped.length > 0 && deduped[deduped.length - 1] === p) continue;
    deduped.push(p);
  }
  return deduped;
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
    full.includes('前往七猫APP') ||
    full.includes('为七猫VIP付费')
  ) {
    return true;
  }

  // Standard Chinese novel chapter has > 800 chars and > 4 paras.
  // If fewer than 4 paragraphs and under 400 chars, it is just a teaser/preview.
  if (paras.length < 4 && full.length < 400) {
    return true;
  }

  return false;
}

export function isMismatchedChapter(
  paras: string[],
  expectedChapNum: number,
  expectedTitle?: string,
  bookName?: string,
  pageTitle?: string
): boolean {
  if (paras.length === 0) return true;
  const firstFew = paras.slice(0, 3).join(' ');

  // 1. If pageTitle is available, check chapter number in pageTitle
  if (pageTitle && expectedChapNum > 0) {
    const pageM = pageTitle.match(/第\s*(\d+)\s*章/);
    if (pageM) {
      const pNum = parseInt(pageM[1], 10);
      if (pNum > 0 && pNum !== expectedChapNum) {
        return true;
      }
    }
  }

  // 2. If chapter title is provided, check for title match
  if (expectedTitle) {
    const cleanT = expectedTitle.replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*[:：]?\s*/i, '').trim();
    if (cleanT.length >= 2) {
      if ((pageTitle && pageTitle.includes(cleanT)) || firstFew.includes(cleanT)) {
        return false;
      }
    }
  }

  // 3. Reject if requesting chapNum > 1 but content is explicitly Chapter 1
  if (expectedChapNum > 1) {
    if (/^(?:第\s*1\s*章|第一章|第\s*01\s*章|Chương\s*1\b)/i.test(paras[0].trim())) {
      return true;
    }
    if (firstFew.includes('谁在掐她脖子') && firstFew.includes('墨桑榆')) {
      return true;
    }
    if (firstFew.includes('耳边传来一声阴冷怒喝') && firstFew.includes('墨桑榆')) {
      return true;
    }
  }

  // 4. If content explicitly begins with a different chapter number
  const m = firstFew.match(/^(?:第\s*(\d+)\s*章|Chapter\s*(\d+))/i);
  if (m) {
    const num = parseInt(m[1] || m[2], 10);
    if (num > 0 && num !== expectedChapNum) {
      return true;
    }
  }

  return false;
}

/**
 * Helper to determine if a link is truly a subpage of the current chapter
 * (e.g. 21_2.html, 21-2.html, 21.html?page=2), preventing next-chapter concatenation
 */
export function isRealSubpage(currentUrlStr: string, nextHref: string, linkText: string): boolean {
  if (!nextHref || nextHref.includes('javascript') || nextHref.startsWith('#')) return false;

  // If link text explicitly says "下一章" (Next Chapter) or "下章", reject immediately!
  if (/下\s*一?\s*章/i.test(linkText)) return false;

  let currentUrl: URL, nextUrl: URL;
  try {
    currentUrl = new URL(currentUrlStr);
    nextUrl = new URL(nextHref, currentUrl);
  } catch (e) {
    return false;
  }

  if (currentUrl.origin !== nextUrl.origin) return false;

  const curPath = currentUrl.pathname;
  const nextPath = nextUrl.pathname;

  // Case 1: Same path with query parameter page=2, p=2, index=2
  if (curPath === nextPath && (nextUrl.searchParams.has('page') || nextUrl.searchParams.has('p') || nextUrl.searchParams.has('index'))) {
    return true;
  }

  const curMatch = curPath.match(/\/([^\/]+?)(\.[a-zA-Z0-9]+)?$/);
  const nextMatch = nextPath.match(/\/([^\/]+?)(\.[a-zA-Z0-9]+)?$/);
  if (!curMatch || !nextMatch) return false;

  const curBase = curMatch[1];
  const nextBase = nextMatch[1];

  // If nextBase is strictly identical, it's not a new page
  if (curBase === nextBase && currentUrl.search === nextUrl.search) return false;

  const cleanCurBase = curBase.replace(/[_-]\d+$/, '');
  const subpageRegex = new RegExp('^' + cleanCurBase + '[_-]\\d+$');

  // Case 2: Base filename matches with suffix like _2 or -2
  if (subpageRegex.test(nextBase)) {
    return true;
  }

  // Case 3: Link text explicitly has pagination indicator (e.g. 1/2, 2/3) in same directory
  const hasPageIndicator = /[(（]\s*\d+\s*[\/／]\s*\d+\s*[)）]|第\s*\d+\s*页/.test(linkText);
  if (hasPageIndicator && curPath.substring(0, curPath.lastIndexOf('/')) === nextPath.substring(0, nextPath.lastIndexOf('/'))) {
    return subpageRegex.test(nextBase);
  }

  return false;
}

/**
 * Robust fetcher handling UTF-8, GBK, GB2312 encodings and timeout
 */
async function fetchPageSmart(url: string, timeoutMs: number = 6000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh-Hans;q=0.9,en;q=0.8'
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const rawBuf = Buffer.from(buf);
  let text = rawBuf.toString('utf-8');
  if (
    text.includes('charset=gbk') ||
    text.includes('charset=GBK') ||
    text.includes('charset=gb2312') ||
    text.includes('charset=GB2312') ||
    text.includes('charset="gbk"') ||
    text.includes('charset="gb2312"')
  ) {
    try {
      text = iconv.decode(rawBuf, 'gbk');
    } catch (e) {}
  }
  return text;
}

/**
 * Extract clean chapter paragraphs from HTML across diverse novel websites
 */
async function extractParagraphsFromHtml(
  html: string,
  pageUrl?: string,
  depth: number = 0
): Promise<{ title?: string; paras: string[] }> {
  const $ = cheerio.load(html);

  // Remove scripts, styles, buttons, advertisements, navbars
  $('script, style, ins, a.read-btn, .ads, .ad, .advertisement, header, footer, nav, .header, .footer, .bottem, .bottem2, #header, #footer').remove();

  const title = $('h1, .headline, .title, #title').first().text().trim();

  const contentSelectors = [
    '#nr_content', '#content', '#chaptercontent', '#articlecontent',
    '.showtxt', '#txtContent', '.content', '#nr1', '#readcontent',
    '.reader-content', '.read-content', 'article', '#htmlContent',
    '#txt', '.txt', '.articlebody', '#articlebody', '.book-content'
  ];

  let targetEl: cheerio.Cheerio<any> | null = null;
  for (const sel of contentSelectors) {
    const el = $(sel);
    if (el.length > 0 && el.text().trim().length > 60) {
      targetEl = el;
      break;
    }
  }

  if (!targetEl) {
    targetEl = $('body');
  }

  targetEl.find('script, style, ins, a, .ad, .ads, .bottem, .bottem2').remove();

  let paras: string[] = [];

  // Check <p> tags
  if (targetEl.find('p').length >= 4) {
    targetEl.find('p').each((_, p) => {
      const t = $(p).text().trim();
      if (t && t.length > 2) paras.push(t);
    });
  }

  // If <p> tags were absent or few, extract from HTML by splitting on <br> or newlines
  if (paras.length < 4) {
    const rawHtml = targetEl.html() || '';
    const lines = rawHtml
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&emsp;/gi, ' ')
      .replace(/&ensp;/gi, ' ')
      .split('\n');

    paras = lines
      .map(l => cheerio.load(l).text().trim())
      .filter(l => l.length > 0);
  }

  paras = cleanParagraphs(paras);

  // Check for multi-page continuation ONLY if verified as true subpage of the same chapter
  if (depth < 2 && pageUrl) {
    let nextPageRelative = '';
    $('a').each((_, a) => {
      const aText = $(a).text().trim();
      const aHref = $(a).attr('href');
      if (aHref && isRealSubpage(pageUrl, aHref, aText)) {
        nextPageRelative = aHref;
        return false;
      }
    });

    if (nextPageRelative) {
      try {
        const nextUrl = new URL(nextPageRelative, pageUrl).toString();
        if (nextUrl !== pageUrl) {
          const nextHtml = await fetchPageSmart(nextUrl, 4000);
          const nextRes = await extractParagraphsFromHtml(nextHtml, nextUrl, depth + 1);

          // Verify next page does not belong to a different chapter
          let isSameChapter = true;
          if (title && nextRes.title) {
            const m1 = title.match(/第\s*(\d+)\s*章/);
            const m2 = nextRes.title.match(/第\s*(\d+)\s*章/);
            if (m1 && m2 && m1[1] !== m2[1]) {
              isSameChapter = false;
            }
          }

          if (isSameChapter && nextRes.paras.length > 0) {
            paras = cleanParagraphs(paras.concat(nextRes.paras));
          }
        }
      } catch (e) {}
    }
  }

  return { title, paras };
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
      },
      signal: AbortSignal.timeout(4500)
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
  } catch (e: any) {}
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
        },
        signal: AbortSignal.timeout(4500)
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

export function getCleanSearchCandidates(bookName: string): string[] {
  const raw = (bookName || '').replace(/<[^>]+>/g, '').replace(/^[《<]/, '').replace(/[》>]$/, '').trim();
  if (!raw) return [];
  const candidates: string[] = [raw];

  // If title contains colon (e.g. 斗罗V：从加入武魂殿开始), add space and no-colon variants
  if (/[：:]/.test(raw)) {
    candidates.push(raw.replace(/[：:]/g, ' ').replace(/\s+/g, ' ').trim());
    candidates.push(raw.replace(/[：:]/g, '').trim());
  }

  // Remove parenthesis annotations like （校对版） or (完结)
  const noParen = raw.replace(/[（(][^）)]*[）)]/g, '').trim();
  if (noParen && !candidates.includes(noParen)) {
    candidates.push(noParen);
  }

  return candidates;
}

const quanbenCatalogCache = new Map<string, Array<{ href: string; title: string }>>();

async function getQuanbenSlug(bookName: string): Promise<string | null> {
  if (!bookName) return null;
  const candidates = getCleanSearchCandidates(bookName);
  for (const c of candidates) {
    if (quanbenSlugCache.has(c)) return quanbenSlugCache.get(c)!;
  }

  for (const c of candidates) {
    try {
      const searchUrl = `https://quanben.io/index.php?c=book&a=search&keywords=${encodeURIComponent(c)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(4500)
      });
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const list: Array<{ slug: string; title: string }> = [];
        $('a[href*="/n/"]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().trim().replace(/^[《<]/, '').replace(/[》>].*$/, '').trim();
          const m = href.match(/\/n\/([^\/]+)\/?$/);
          if (m && text) {
            list.push({ slug: m[1], title: text });
          }
        });

        // 1. Exact match
        const exact = list.find(item => candidates.some(cand => item.title === cand));
        if (exact) {
          quanbenSlugCache.set(bookName, exact.slug);
          return exact.slug;
        }
        // 2. Starts with / includes match
        const starts = list.find(item => candidates.some(cand => item.title.startsWith(cand) || cand.startsWith(item.title)));
        if (starts) {
          quanbenSlugCache.set(bookName, starts.slug);
          return starts.slug;
        }
        const contains = list.find(item => candidates.some(cand => item.title.includes(cand) || cand.includes(item.title)));
        if (contains) {
          quanbenSlugCache.set(bookName, contains.slug);
          return contains.slug;
        }
      }
    } catch (e) {}
  }
  return null;
}

async function getQuanbenCatalog(slug: string): Promise<Array<{ href: string; title: string }>> {
  if (quanbenCatalogCache.has(slug)) return quanbenCatalogCache.get(slug)!;
  try {
    const listUrl = `https://quanben.io/n/${slug}/list.html`;
    const res = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(4500)
    });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const chaps: Array<{ href: string; title: string }> = [];
      $('a[href*=".html"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim();
        if (href && href.match(/\/\d+\.html$/)) {
          const fullUrl = href.startsWith('http') ? href : `https://quanben.io${href.startsWith('/') ? '' : '/'}${href}`;
          chaps.push({ href: fullUrl, title });
        }
      });
      if (chaps.length > 0) {
        quanbenCatalogCache.set(slug, chaps);
        return chaps;
      }
    }
  } catch (e) {}
  return [];
}

async function fetchQuanbenChapter(
  slug: string,
  chapNum: number,
  expectedTitle?: string
): Promise<{ title?: string; paras: string[] }> {
  try {
    let targetUrl = `https://quanben.io/n/${slug}/${chapNum}.html`;
    const cleanT = (expectedTitle || '').replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*[:：]?\s*/i, '').trim();

    // Check catalog to get exact chapter link
    const catalog = await getQuanbenCatalog(slug);
    if (catalog.length > 0) {
      let matched = (chapNum > 0 && chapNum <= catalog.length) ? catalog[chapNum - 1] : undefined;
      // If index-matched doesn't verify with title, search list
      if (cleanT && matched && !matched.title.includes(cleanT)) {
        const titleMatch = catalog.find(c => c.title.includes(cleanT) || cleanT.includes(c.title));
        if (titleMatch) matched = titleMatch;
      }
      if (!matched && chapNum > 0) {
        matched = catalog.find(c => {
          const m = c.title.match(/第\s*(\d+)\s*章/);
          return m && parseInt(m[1], 10) === chapNum;
        });
      }
      if (matched && matched.href) {
        targetUrl = matched.href;
      }
    }

    const html = await fetchPageSmart(targetUrl, 4500);
    const extracted = await extractParagraphsFromHtml(html, targetUrl);
    if (
      extracted.paras.length >= 4 &&
      !isMismatchedChapter(extracted.paras, chapNum, expectedTitle, undefined, extracted.title)
    ) {
      return extracted;
    }
  } catch (e) {}
  return { paras: [] };
}

/**
 * Multi-source mirror catalog fetcher with caching
 */
async function getMirrorCatalog(cleanBook: string): Promise<Array<{ title: string; url: string }>> {
  if (mirrorCatalogCache.has(cleanBook)) {
    return mirrorCatalogCache.get(cleanBook)!;
  }

  try {
    const qUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${cleanBook} 章节目录 小说`)}`;
    const res = await fetch(qUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        'Accept-Language': 'zh-CN,zh-Hans;q=0.9'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const candidateLinks: string[] = [];
      $('a').each((_, el) => {
        const rawHref = $(el).attr('href') || '';
        let decoded = '';
        if (rawHref.includes('uddg=')) {
          const m = rawHref.match(/uddg=([^&]+)/);
          if (m) decoded = decodeURIComponent(m[1]);
        } else if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
          decoded = rawHref;
        }
        if (
          decoded &&
          !decoded.includes('duckduckgo.com') &&
          !decoded.includes('qimao.com') &&
          !decoded.includes('zongheng.com') &&
          !candidateLinks.includes(decoded)
        ) {
          candidateLinks.push(decoded);
        }
      });

      for (const link of candidateLinks.slice(0, 5)) {
        try {
          const pageHtml = await fetchPageSmart(link, 4500);
          const $p = cheerio.load(pageHtml);
          const allChapters: Array<{ title: string; url: string }> = [];

          $p('a').each((_, aEl) => {
            const href = $p(aEl).attr('href') || '';
            const text = $p(aEl).text().trim();
            if (
              (href.includes('/read/') || href.includes('/chapter/') || href.includes('/xiaoshuo/') || href.match(/\/\d+\.html/)) &&
              text.length > 1 &&
              !text.includes('首页') &&
              !text.includes('登录')
            ) {
              try {
                const fullUrl = new URL(href, link).toString();
                if (!allChapters.some(c => c.url === fullUrl)) {
                  allChapters.push({ title: text, url: fullUrl });
                }
              } catch (e) {}
            }
          });

          if (allChapters.length >= 20) {
            mirrorCatalogCache.set(cleanBook, allChapters);
            return allChapters;
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return [];
}

async function fetchWebMirrorChapter(
  bookName: string,
  chapterTitle: string,
  chapNum: number,
  author?: string
): Promise<{ title?: string; paras: string[] } | null> {
  if (!bookName) return null;
  const cleanT = (chapterTitle || '').replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*[:：]?\s*/i, '').trim();
  const searchCandidates = getCleanSearchCandidates(bookName);
  const cleanBook = searchCandidates[0] || bookName.replace(/<[^>]+>/g, '').trim();

  try {
    // Strategy 1: Check catalog cache
    const catalog = await getMirrorCatalog(cleanBook);
    if (catalog.length > 0) {
      let targetItem: { title: string; url: string } | undefined;

      // Match by exact or partial title
      if (cleanT) {
        targetItem = catalog.find(item => {
          const itemClean = item.title.replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*[:：]?\s*/i, '').trim();
          return itemClean === cleanT || itemClean.includes(cleanT) || cleanT.includes(itemClean);
        });
      }

      // Match by chapter number
      if (!targetItem && chapNum > 0) {
        targetItem = catalog.find(item => {
          const m = item.title.match(/第\s*(\d+)\s*章/);
          return m && parseInt(m[1], 10) === chapNum;
        });
      }

      // Match by index position
      if (!targetItem && chapNum > 0 && chapNum <= catalog.length) {
        targetItem = catalog[chapNum - 1];
      }

      if (targetItem && targetItem.url) {
        try {
          const chapHtml = await fetchPageSmart(targetItem.url, 5000);
          const extracted = await extractParagraphsFromHtml(chapHtml, targetItem.url);
          if (extracted.paras.length >= 4 && !isMismatchedChapter(extracted.paras, chapNum, cleanT, cleanBook, extracted.title)) {
            return { title: cleanT || targetItem.title, paras: extracted.paras };
          }
        } catch (e) {}
      }
    }

    // Strategy 2: Direct Search on DuckDuckGo using full book title and candidates
    const searchQueries: string[] = [];
    for (const cand of searchCandidates.slice(0, 2)) {
      searchQueries.push(`"${cand}" "第${chapNum}章"`);
      if (cleanT && cleanT.length >= 2) {
        searchQueries.push(`"${cand}" "${cleanT}"`);
      }
    }

    const candidateUrls: string[] = [];
    for (const query of searchQueries) {
      const qUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      try {
        const res = await fetch(qUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'Accept-Language': 'zh-CN,zh-Hans;q=0.9'
          },
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);
          $('a').each((_, el) => {
            const rawHref = $(el).attr('href') || '';
            let decoded = '';
            if (rawHref.includes('uddg=')) {
              const m = rawHref.match(/uddg=([^&]+)/);
              if (m) decoded = decodeURIComponent(m[1]);
            } else if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
              decoded = rawHref;
            }
            if (
              decoded &&
              !decoded.includes('duckduckgo.com') &&
              !decoded.includes('qimao.com') &&
              !decoded.includes('zongheng.com') &&
              !candidateUrls.includes(decoded)
            ) {
              candidateUrls.push(decoded);
            }
          });
        }
      } catch (e) {}
      if (candidateUrls.length >= 4) break;
    }

    for (const u of candidateUrls.slice(0, 6)) {
      try {
        const pageHtml = await fetchPageSmart(u, 5000);
        const $c = cheerio.load(pageHtml);

        let chapUrl = u;
        // Check if page is a catalog list instead of direct chapter
        const isCatalog =
          $c('a[href*="/read/"], a[href*="/chapter/"], a[href*="/xiaoshuo/"], a[href*=".html"]').length > 15 &&
          $c('#content, #chaptercontent, .showtxt, #nr_content').length === 0;

        if (isCatalog) {
          $c('a').each((_, aEl) => {
            const aText = $c(aEl).text().trim();
            if (
              (cleanT && cleanT.length >= 2 && aText.includes(cleanT)) ||
              aText.includes(`第${chapNum}章`)
            ) {
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

        const chapHtml = chapUrl === u ? pageHtml : await fetchPageSmart(chapUrl, 5000);
        const extracted = await extractParagraphsFromHtml(chapHtml, chapUrl);
        if (
          extracted.paras.length >= 4 &&
          !isMismatchedChapter(extracted.paras, chapNum, cleanT, cleanBook, extracted.title)
        ) {
          return { title: cleanT || extracted.title, paras: extracted.paras };
        }
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

function parseChineseNumber(str: string): number | null {
  const digits: Record<string, number> = {
    '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9
  };
  const units: Record<string, number> = {
    '十': 10, '百': 100, '千': 1000, '万': 10000
  };
  let total = 0;
  let current = 0;
  let hasMatch = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (digits[char] !== undefined) {
      current = digits[char];
      hasMatch = true;
    } else if (units[char] !== undefined) {
      const u = units[char];
      if (u === 10 && current === 0 && !hasMatch) {
        current = 1;
      }
      total += (current || 1) * u;
      current = 0;
      hasMatch = true;
    } else {
      break;
    }
  }
  total += current;
  return hasMatch && total > 0 ? total : null;
}

function extractChapterNumber(title?: string, index?: number, fallbackId?: string): number {
  if (title) {
    const m = title.match(/第\s*(\d+)\s*章/) || title.match(/Chương\s*(\d+)/i) || title.match(/^(\d+)[\s.、_-]/);
    if (m) {
      const parsed = parseInt(m[1], 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const mZh = title.match(/第\s*([零一二两三四五六七八九十百千万]+)\s*章/);
    if (mZh) {
      const parsedZh = parseChineseNumber(mZh[1]);
      if (parsedZh && parsedZh > 0) return parsedZh;
    }
  }
  if (index && index > 0) return index;
  if (fallbackId) {
    const m = fallbackId.match(/(\d+)$/);
    if (m) {
      const parsed = parseInt(m[1].slice(-4), 10);
      if (!isNaN(parsed) && parsed > 0 && parsed < 5000) return parsed;
    }
  }
  return 1;
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
    const res = await qimaoFetch(qUrl, { timeout: 4000 });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const pageTitle = $('.chapter-title').text().trim() || $('.title_txtbox').text().trim() || $('h1').first().text().trim();
      if (pageTitle && !fetchedTitle) fetchedTitle = pageTitle;

      // Note: ONLY match dedicated chapter content containers, never loose .content p which captures site chrome
      $('.article p, .chapter-content p, .reader-content p, .articlebox p, #nr1 p').each((_, el) => {
        const t = $(el).text().trim();
        if (t) paras.push(t);
      });
      paras = cleanParagraphs(paras);
    }
  } catch (e: any) {}

  // Check if Qimao returned empty paragraphs or VIP locked teaser
  const needsRescue = isContentTruncated(paras);
  if (needsRescue) {
    paras = []; // Discard teaser lines so multi-source rescue gets full chapter
  }

  // 2. Multi-source Rescue Fallback if Qimao web was truncated or locked
  if (paras.length === 0 && bookName) {
    const chapNum = extractChapterNumber(chapterTitle || fetchedTitle, chapterIndex, cleanChapId);

    // Fallback A: Rescue via Quanben Full-text Engine (Accurate title matching + catalog lookup)
    try {
      const slug = await getQuanbenSlug(bookName);
      if (slug) {
        const qbRes = await fetchQuanbenChapter(slug, chapNum, chapterTitle || fetchedTitle);
        if (qbRes.paras.length >= 4) {
          paras = qbRes.paras;
          if (qbRes.title && !fetchedTitle) fetchedTitle = qbRes.title;
        }
      }
    } catch (e: any) {}

    // Fallback B: Rescue via Web Novel Mirrors (with strict mismatch checking)
    if (paras.length === 0) {
      try {
        const mirrorRes = await fetchWebMirrorChapter(bookName, chapterTitle || fetchedTitle, chapNum, author);
        if (mirrorRes && mirrorRes.paras.length >= 4) {
          paras = mirrorRes.paras;
          if (mirrorRes.title && !fetchedTitle) fetchedTitle = mirrorRes.title;
        }
      } catch (e: any) {}
    }

    // Fallback C: Rescue via Zongheng Desktop / Mobile Reader with real chapter ID mapping
    if (paras.length === 0) {
      try {
        const zhBookId = await getZonghengBookId(bookName);
        if (zhBookId) {
          const zhList = await getZonghengChapters(zhBookId);
          let matchedZhChap = zhList[chapNum - 1];
          if (!matchedZhChap && fetchedTitle) {
            const cleanT = fetchedTitle.replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*/i, '').trim();
            matchedZhChap = zhList.find(c => c.title.includes(cleanT) || cleanT.includes(c.title));
          }

          if (matchedZhChap) {
            const desktopUrl = `https://read.zongheng.com/chapter/${zhBookId}/${matchedZhChap.cid}.html`;
            try {
              const dHtml = await fetchPageSmart(desktopUrl, 4000);
              const extracted = await extractParagraphsFromHtml(dHtml, desktopUrl);
              if (extracted.paras.length >= 4 && !isMismatchedChapter(extracted.paras, chapNum, fetchedTitle, bookName, extracted.title)) {
                paras = extracted.paras;
                if (!fetchedTitle) fetchedTitle = matchedZhChap.title;
              }
            } catch (e) {}

            if (paras.length === 0) {
              const mUrl = `https://m.zongheng.com/chapter/${zhBookId}/${matchedZhChap.cid}.html`;
              try {
                const mHtml = await fetchPageSmart(mUrl, 4000);
                const extracted = await extractParagraphsFromHtml(mHtml, mUrl);
                if (extracted.paras.length >= 4 && !isMismatchedChapter(extracted.paras, chapNum, fetchedTitle, bookName, extracted.title)) {
                  paras = extracted.paras;
                  if (!fetchedTitle) fetchedTitle = matchedZhChap.title;
                }
              } catch (e) {}
            }
          }
        }
      } catch (e: any) {}
    }
  }

  const indexPrefix = chapterIndex ? `第${chapterIndex}章` : '';
  let displayTitle = fetchedTitle || (indexPrefix ? `${indexPrefix}` : `第${cleanChapId}章`);
  if (chapterIndex && fetchedTitle) {
    const cleanTitleNoNum = fetchedTitle.replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*[:：]?\s*/i, '').trim();
    displayTitle = `第${chapterIndex}章 ${cleanTitleNoNum}`;
  }

  // Deduplicate redundant chapter heading in first 1-2 paragraphs if present
  while (paras.length > 0) {
    const firstP = paras[0].trim();
    const cleanFirstP = firstP.replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*[:：]?\s*/i, '').trim();
    const cleanTitle = (fetchedTitle || displayTitle).replace(/^(?:第\s*\d+\s*章|Chương\s*\d+)\s*[:：]?\s*/i, '').trim();

    if (
      firstP === displayTitle.trim() ||
      firstP === fetchedTitle.trim() ||
      (cleanTitle && cleanFirstP === cleanTitle) ||
      (/^第\s*\d+\s*章\s*$/.test(firstP)) ||
      (/^第\s*\d+\s*章\s+.{1,30}$/.test(firstP) && firstP.length < 40) ||
      (/^(?:Chapter|Chương)\s*\d+/i.test(firstP) && firstP.length < 40)
    ) {
      paras.shift();
    } else {
      break;
    }
  }

  const rawFullText = paras.join('\n\n').trim();

  // Return fetched raw paragraphs if available
  if (rawFullText.length > 0) {
    const formattedContent = `${displayTitle}\n\n${rawFullText}`;
    return {
      title: displayTitle,
      content: formattedContent
    };
  }

  // Fallback if content truly unavailable
  return {
    title: displayTitle,
    content: `${displayTitle}\n\n（章节“${displayTitle}”为七猫VIP付费/锁章，网页端未提供正文）`
  };
}
