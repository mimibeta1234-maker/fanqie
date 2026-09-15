import * as cheerio from 'cheerio';

export interface ScribdDocInfo {
  id: string;
  title: string;
  pageCount: number;
  url: string;
  author?: string;
  previewText?: string;
  availableFormats: ('pdf' | 'txt' | 'docx')[];
  assetPrefix?: string;
  embedUrl?: string;
}

export interface ScribdPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
  hash?: string;
  contentUrl?: string;
}

export interface ScribdDocDetails extends ScribdDocInfo {
  pages: ScribdPage[];
}

/**
 * Extract Scribd Document ID from URLs or raw IDs
 */
export function parseScribdId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{6,12}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/(?:document|doc|presentation)\/(\d{6,12})/i);
  if (match && match[1]) {
    return match[1];
  }

  const anyDigits = trimmed.match(/\b(\d{6,12})\b/);
  if (anyDigits && anyDigits[1]) {
    return anyDigits[1];
  }

  return null;
}

/**
 * Fetch Scribd Embed HTML for a document
 */
async function fetchEmbedHtml(docId: string): Promise<string> {
  const embedUrl = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=key-fFexxf7r1bzEfWu3HKwf`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(embedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: 'https://www.scribd.com/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      throw new Error(`Scribd trả về mã HTTP ${res.status}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Clean and normalize text from Scribd HTML by parsing text layer coordinates
 * and stripping header/footer noise and corrupted ligatures.
 */
export function cleanScribdText(html: string): string {
  if (!html || !html.trim()) return '';

  const $ = cheerio.load(html);

  // Extract all text elements with coordinate positioning
  const items: { top: number; left: number; text: string }[] = [];

  $('span.a, .text_line, p').each((_, el) => {
    const style = $(el).attr('style') || '';
    const topMatch = style.match(/top:\s*(-?\d+)px/i);
    const leftMatch = style.match(/left:\s*(-?\d+)px/i);

    const top = topMatch ? parseInt(topMatch[1], 10) : 0;
    const left = leftMatch ? parseInt(leftMatch[1], 10) : 0;

    let text = $(el).text();
    text = text.replace(/\s+/g, ' ').trim();

    if (text) {
      items.push({ top, left, text });
    }
  });

  // If no position spans found, fallback to basic text extraction
  if (items.length === 0) {
    const clone = $.root().clone();
    clone.find('style, script, .image_layer').remove();
    return clone.text().replace(/\s+/g, ' ').trim();
  }

  // Sort top-to-bottom, left-to-right
  items.sort((a, b) => {
    if (Math.abs(a.top - b.top) > 20) {
      return a.top - b.top;
    }
    return a.left - b.left;
  });

  const cleanLines: string[] = [];
  let currentLineTop = -99999;
  let currentLineParts: string[] = [];

  for (const item of items) {
    const txt = item.text;

    // Filter headers, footers & metadata markers
    if (/^HEAAADER/i.test(txt) || /^FOOOOTER/i.test(txt)) continue;
    if (/^\d+\s*\/\s*\d+$/i.test(txt)) continue; // e.g. 5/306
    if (/Learn without forge/i.test(txt)) continue;
    if (/Scan the QR/i.test(txt)) continue;
    if (/Photocopiable and licensed for use/i.test(txt)) continue;
    if (/Expemo/i.test(txt) && /lesson/i.test(txt)) continue;

    // Fix ligature corruptions common in Scribd custom fonts
    let fixed = txt
      .replace(/e[û\u00fb]ort/gi, 'effort')
      .replace(/re[û\u00fb]ect/gi, 'reflect')
      .replace(/di[û\u00fb]erent/gi, 'different')
      .replace(/o[û\u00fb]er/gi, 'offer')
      .replace(/a[û\u00fb]ect/gi, 'affect')
      .replace(/forge[\uE000]ng/gi, 'forgetting')
      .replace(/[\uE001]ashcards/gi, 'flashcards')
      .replace(/\uFB00/g, 'ff')
      .replace(/\uFB01/g, 'fi')
      .replace(/\uFB02/g, 'fl');

    if (Math.abs(item.top - currentLineTop) > 25) {
      if (currentLineParts.length > 0) {
        cleanLines.push(currentLineParts.join(' '));
      }
      currentLineTop = item.top;
      currentLineParts = [fixed];
    } else {
      currentLineParts.push(fixed);
    }
  }

  if (currentLineParts.length > 0) {
    cleanLines.push(currentLineParts.join(' '));
  }

  return cleanLines.join('\n');
}

/**
 * Get Scribd Document Information
 */
export async function getScribdDocInfo(docId: string): Promise<ScribdDocInfo> {
  const html = await fetchEmbedHtml(docId);
  const $ = cheerio.load(html);

  // Asset prefix
  const assetPrefixMatch =
    html.match(/docManager\.assetPrefix\s*=\s*["']([^"']+)["']/i) ||
    html.match(/html\.scribd(?:assets)?\.com\/([a-zA-Z0-9_-]+)\//i);
  const assetPrefix = assetPrefixMatch ? assetPrefixMatch[1] : undefined;

  // Parse Scribd.EmbedsShow configuration
  const configMatch = html.match(/new\s+Scribd\.EmbedsShow\([^,]+,\s*(\{[\s\S]*?\})\s*\);/);
  let title = `Tài liệu Scribd #${docId}`;
  let pageCount = 0;
  let url = `https://www.scribd.com/document/${docId}`;
  let author = '';

  if (configMatch) {
    try {
      const config = JSON.parse(configMatch[1]);
      if (config.document) {
        title = config.document.title || title;
        pageCount = Number(config.document.page_count) || 0;
        url = config.document.url || url;
      }
    } catch {
      // Ignore json parse error
    }
  } else {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1] && !titleMatch[1].includes('Client Challenge')) {
      title = titleMatch[1].replace(/\s*-\s*Scribd$/i, '').trim();
    }
  }

  // Count pages from docManager.addPage
  const addPageMatches = html.match(/docManager\.addPage\(\{/g) || [];
  if (addPageMatches.length > 0) {
    pageCount = Math.max(pageCount, addPageMatches.length);
  }

  if (pageCount === 0) {
    const pagesCountMatch = html.match(/["']page_count["']\s*:\s*(\d+)/);
    if (pagesCountMatch) {
      pageCount = parseInt(pagesCountMatch[1], 10);
    } else {
      pageCount = 1;
    }
  }

  // Preview text
  let previewText = '';
  const p1El = $('#page1');
  if (p1El.length > 0) {
    const clean = cleanScribdText(p1El.html() || '');
    if (clean && clean.length > 3) {
      previewText = clean.slice(0, 300);
    }
  }

  const embedUrl = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll&access_key=key-fFexxf7r1bzEfWu3HKwf`;

  return {
    id: docId,
    title,
    pageCount,
    url,
    embedUrl,
    author: author || undefined,
    previewText: previewText || undefined,
    availableFormats: ['pdf', 'txt', 'docx'],
    assetPrefix,
  };
}

/**
 * Fetch and extract pages of a Scribd Document with fast concurrency
 */
export async function getScribdDocPages(
  docId: string,
  fromPage: number = 1,
  toPage?: number
): Promise<{ info: ScribdDocInfo; pages: ScribdPage[] }> {
  const html = await fetchEmbedHtml(docId);
  const info = await getScribdDocInfo(docId);
  const $ = cheerio.load(html);

  const maxPages = toPage ? Math.min(toPage, info.pageCount) : info.pageCount;
  const startPage = Math.max(1, fromPage);
  const assetPrefix = info.assetPrefix;

  // Extract all docManager.addPage definitions
  const pageDefsMap = new Map<number, { contentUrl?: string; hash?: string; isFullImage?: boolean }>();
  const addPageRegex = /docManager\.addPage\(\{([\s\S]*?)\}\);/g;
  let addPageMatch;
  while ((addPageMatch = addPageRegex.exec(html)) !== null) {
    const body = addPageMatch[1];
    const pageNumMatch = body.match(/pageNum:\s*(\d+)/);
    const contentUrlMatch = body.match(/contentUrl:\s*["']([^"']+)["']/);

    if (pageNumMatch) {
      const pNum = parseInt(pageNumMatch[1], 10);
      const contentUrl = contentUrlMatch ? contentUrlMatch[1] : undefined;
      let hash: string | undefined;
      if (contentUrl) {
        const hashMatch = contentUrl.match(/pages\/\d+-([a-zA-Z0-9_-]+)\.jsonp/);
        if (hashMatch) hash = hashMatch[1];
      }
      pageDefsMap.set(pNum, { contentUrl, hash });
    }
  }

  const pageTextsMap = new Map<number, string>();
  const pageImagesMap = new Map<number, string>();

  // 1. Direct page extraction from initial embed HTML
  $('[id^="page"]').each((_, el) => {
    const id = $(el).attr('id');
    const pNumMatch = id?.match(/^page(\d+)$/);
    if (!pNumMatch) return;
    const pNum = parseInt(pNumMatch[1], 10);

    if (pNum >= startPage && pNum <= maxPages) {
      const cleanText = cleanScribdText($(el).html() || '');
      if (cleanText) {
        pageTextsMap.set(pNum, cleanText);
      }

      // Check for standalone full page scan image
      const imgEl = $(el).find('img.absimg, img[orig], img[src]');
      if (imgEl.length > 0) {
        const orig = imgEl.attr('orig') || imgEl.attr('src');
        if (orig) {
          const norm = orig.replace('http://html.scribd.com/', 'https://html.scribdassets.com/');
          pageImagesMap.set(pNum, norm);
        }
      }
    }
  });

  // Assign image URLs directly from hash where available
  for (let p = startPage; p <= maxPages; p++) {
    const def = pageDefsMap.get(p);
    if (assetPrefix && def?.hash && !pageImagesMap.has(p)) {
      pageImagesMap.set(p, `https://html.scribdassets.com/${assetPrefix}/images/${p}-${def.hash}.png`);
    }
  }

  // 2. Fetch JSONP for text content with 25 concurrency & 3.5s timeout
  const pagesToFetch: { pageNum: number; contentUrl: string; hash?: string }[] = [];
  for (let p = startPage; p <= maxPages; p++) {
    if (!pageTextsMap.has(p)) {
      const def = pageDefsMap.get(p);
      if (def?.contentUrl) {
        pagesToFetch.push({ pageNum: p, contentUrl: def.contentUrl, hash: def.hash });
      }
    }
  }

  const CONCURRENCY = 25;
  for (let i = 0; i < pagesToFetch.length; i += CONCURRENCY) {
    const batch = pagesToFetch.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ pageNum, contentUrl }) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        try {
          const res = await fetch(contentUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Referer: 'https://www.scribd.com/',
            },
          });

          if (res.ok) {
            const raw = await res.text();
            const callbackMatch = raw.match(/window\.\w+\(([\s\S]*)\);?\s*$/);
            let pageHtml = '';
            if (callbackMatch) {
              const rawArgs = callbackMatch[1];
              try {
                const arr = JSON.parse(rawArgs);
                pageHtml = Array.isArray(arr) ? arr.join('') : String(arr);
              } catch {
                pageHtml = rawArgs;
              }
            } else {
              pageHtml = raw;
            }

            const text = cleanScribdText(pageHtml);
            if (text) {
              pageTextsMap.set(pageNum, text);
            }
          }
        } catch {
          // Ignore individual timeout / fetch error
        } finally {
          clearTimeout(timeoutId);
        }
      })
    );
  }

  // Compile sorted pages array
  const pages: ScribdPage[] = [];
  for (let p = startPage; p <= maxPages; p++) {
    const text = pageTextsMap.get(p) || '';
    const imageUrl = pageImagesMap.get(p);
    const def = pageDefsMap.get(p);
    pages.push({
      pageNumber: p,
      text,
      imageUrl,
      hash: def?.hash,
      contentUrl: def?.contentUrl,
    });
  }

  return { info, pages };
}

/**
 * Fetch raw HTML pages, font definitions, and original Scribd styles for 1:1 Pixel-Perfect Print & Rendering
 */
export async function getScribdFullPrintableDoc(
  docId: string,
  fromPage: number = 1,
  toPage?: number
): Promise<{ info: ScribdDocInfo; pagesHtml: string[]; scribdStyle: string; fontStyles: string }> {
  const html = await fetchEmbedHtml(docId);
  const info = await getScribdDocInfo(docId);
  const $ = cheerio.load(html);

  const maxPages = toPage ? Math.min(toPage, info.pageCount) : info.pageCount;
  const startPage = Math.max(1, fromPage);

  // Extract <style> from embed
  const styles = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const scribdStyle = styles.join('\n');

  // Extract Asset Prefix
  const assetPrefix = html.match(/docManager\.assetPrefix\s*=\s*["']([^"']+)["']/)?.[1] || '';

  // Extract font definitions from docManager.addFont(...)
  const addFontRegex =
    /docManager\.addFont\(\s*(\d+)\s*,\s*["']([^"']*)["']\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\);/g;
  let fontMatch;
  const fontFaces: string[] = [];
  const fontClasses: string[] = [];

  while ((fontMatch = addFontRegex.exec(html)) !== null) {
    const fontId = fontMatch[1];
    const family = fontMatch[3];
    const fallback = fontMatch[4] || 'sans-serif';
    const weight = fontMatch[5] || 'normal';
    const style = fontMatch[6] || 'normal';

    const fontNum = fontId.toString().padStart(4, '0');
    if (assetPrefix) {
      const woff2Url = `https://html.scribdassets.com/${assetPrefix}/fonts/${fontNum}.woff2`;
      fontFaces.push(`@font-face {
  font-family: '${family}';
  src: url('${woff2Url}') format('woff2');
  font-weight: ${weight};
  font-style: ${style};
  font-display: swap;
}`);
    }

    fontClasses.push(`.${family} {
  font-family: '${family}', ${fallback};
  font-weight: ${weight};
  font-style: ${style};
}`);
  }

  const fontStyles = `<style>
${fontFaces.join('\n')}
${fontClasses.join('\n')}
</style>`;

  // Extract page content URLs
  const contentUrls = new Map<number, string>();
  const addPageRegex = /docManager\.addPage\(\{([\s\S]*?)\}\);/g;
  let m;
  while ((m = addPageRegex.exec(html)) !== null) {
    const pNumMatch = m[1].match(/pageNum:\s*(\d+)/);
    const contentUrlMatch = m[1].match(/contentUrl:\s*["']([^"']+)["']/);
    if (pNumMatch && contentUrlMatch) {
      contentUrls.set(parseInt(pNumMatch[1], 10), contentUrlMatch[1]);
    }
  }

  const rawPagesMap = new Map<number, string>();

  // 1. Initial pages in DOM
  $('[id^="page"]').each((_, el) => {
    const id = $(el).attr('id');
    const pNumMatch = id?.match(/^page(\d+)$/);
    if (!pNumMatch) return;
    const pNum = parseInt(pNumMatch[1], 10);
    if (pNum >= startPage && pNum <= maxPages) {
      const clone = $(el).clone();
      clone.find('img').each((__, imgEl) => {
        const orig = $(imgEl).attr('orig') || $(imgEl).attr('src');
        if (orig) {
          const norm = orig.replace('http://html.scribd.com/', 'https://html.scribdassets.com/');
          $(imgEl).attr('src', norm);
          $(imgEl).attr('loading', 'eager');
        }
      });
      rawPagesMap.set(pNum, $.html(clone));
    }
  });

  // 2. Fetch JSONP for missing pages
  const pagesToFetch: { pageNum: number; contentUrl: string }[] = [];
  for (let p = startPage; p <= maxPages; p++) {
    if (!rawPagesMap.has(p)) {
      const cUrl = contentUrls.get(p);
      if (cUrl) {
        pagesToFetch.push({ pageNum: p, contentUrl: cUrl });
      }
    }
  }

  const CONCURRENCY = 30;
  for (let i = 0; i < pagesToFetch.length; i += CONCURRENCY) {
    const batch = pagesToFetch.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ pageNum, contentUrl }) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        try {
          const res = await fetch(contentUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Referer: 'https://www.scribd.com/',
            },
          });
          if (res.ok) {
            const raw = await res.text();
            const callbackMatch = raw.match(/window\.\w+\(([\s\S]*)\);?\s*$/);
            let pageHtml = '';
            if (callbackMatch) {
              const rawArgs = callbackMatch[1];
              try {
                const arr = JSON.parse(rawArgs);
                pageHtml = Array.isArray(arr) ? arr.join('') : String(rawArgs);
              } catch {
                pageHtml = rawArgs;
              }
            } else {
              pageHtml = raw;
            }

            const $p = cheerio.load(pageHtml);
            $p('img').each((__, imgEl) => {
              const orig = $p(imgEl).attr('orig') || $p(imgEl).attr('src');
              if (orig) {
                const norm = orig.replace('http://html.scribd.com/', 'https://html.scribdassets.com/');
                $p(imgEl).attr('src', norm);
                $p(imgEl).attr('loading', 'eager');
              }
            });

            // Extract page div
            const pageDiv = $p('.newpage').length > 0 ? $p.html($p('.newpage')) : $p.html($p.root());
            if (pageDiv) {
              rawPagesMap.set(pageNum, pageDiv);
            }
          }
        } catch {
        } finally {
          clearTimeout(timeoutId);
        }
      })
    );
  }

  const pagesHtml: string[] = [];
  for (let p = startPage; p <= maxPages; p++) {
    const pageHtml = rawPagesMap.get(p);
    if (pageHtml) {
      pagesHtml.push(pageHtml);
    }
  }

  return { info, pagesHtml, scribdStyle, fontStyles };
}

