import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const mirrorDetailedCatalogCache = new Map<string, Array<{ num: number; title: string; url: string }>>();
const candidateUrlsCache = new Map<string, string[]>();

async function fetchPageSmart(url: string, timeoutMs: number = 3500): Promise<string> {
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
    text.includes('charset=GB2312')
  ) {
    try {
      text = iconv.decode(rawBuf, 'gbk');
    } catch (e) {}
  }
  return text;
}

async function getCandidateUrls(cleanBook: string): Promise<string[]> {
  if (candidateUrlsCache.has(cleanBook)) return candidateUrlsCache.get(cleanBook)!;
  const qUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${cleanBook} 章节目录 小说`)}`;
  const res = await fetch(qUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      'Accept-Language': 'zh-CN,zh-Hans;q=0.9'
    },
    signal: AbortSignal.timeout(3500)
  });
  const candidateUrls: string[] = [];
  if (res.ok) {
    const html = await res.text();
    const $ = cheerio.load(html);
    $('a').each((_, el) => {
      const rawHref = $(el).attr('href') || '';
      let decoded = '';
      if (rawHref.includes('uddg=')) {
        const m = rawHref.match(/uddg=([^&]+)/);
        if (m) decoded = decodeURIComponent(m[1]);
      } else if (rawHref.startsWith('http')) {
        decoded = rawHref;
      }
      const isJunk = /v\.qq\.com|bilibili\.com|youku\.com|iqiyi\.com|douyin\.com|kuaishou\.com|weibo\.com|zhihu\.com|baidu\.com|tieba/i.test(decoded);
      if (
        decoded &&
        !isJunk &&
        !decoded.includes('duckduckgo.com') &&
        !decoded.includes('qimao.com') &&
        !decoded.includes('zongheng.com') &&
        !candidateUrls.includes(decoded)
      ) {
        candidateUrls.push(decoded);
      }
    });
  }
  candidateUrlsCache.set(cleanBook, candidateUrls);
  return candidateUrls;
}

async function getChapterItem(cleanBook: string, chapNum: number): Promise<{ num: number; title: string; url: string } | null> {
  // 1. Check existing detailed catalog cache
  let chaps = mirrorDetailedCatalogCache.get(cleanBook) || [];
  let found = chaps.find(c => c.num === chapNum);
  if (found) return found;

  // 2. Fetch candidate URLs
  const candidateUrls = await getCandidateUrls(cleanBook);

  for (const u of candidateUrls) {
    try {
      const pageHtml = await fetchPageSmart(u, 4000);
      const $c = cheerio.load(pageHtml);
      const isCatalog =
        $c('a[href*="/read/"], a[href*="/chapter/"], a[href*="/xiaoshuo/"], a[href*=".html"], a[href*="/book_"]').length > 15 &&
        $c('#content, #chaptercontent, .showtxt, #nr_content').length === 0;

      if (isCatalog) {
        const siteChaps: Array<{ num: number; title: string; url: string }> = [];
        $c('a').each((_, aEl) => {
          const aText = $c(aEl).text().trim();
          const aHref = $c(aEl).attr('href');
          if (aHref && aText) {
            const m = aText.match(/第\s*(\d+)\s*章/);
            if (m) {
              try {
                siteChaps.push({
                  num: parseInt(m[1], 10),
                  title: aText,
                  url: new URL(aHref, u).toString()
                });
              } catch (e) {}
            }
          }
        });

        // Merge discovered chapters into cache
        if (siteChaps.length >= 10) {
          const existing = mirrorDetailedCatalogCache.get(cleanBook) || [];
          const mergedMap = new Map<number, { num: number; title: string; url: string }>();
          existing.forEach(c => mergedMap.set(c.num, c));
          siteChaps.forEach(c => mergedMap.set(c.num, c)); // overwrite/expand
          const merged = Array.from(mergedMap.values()).sort((a, b) => a.num - b.num);
          mirrorDetailedCatalogCache.set(cleanBook, merged);

          const curFound = siteChaps.find(c => c.num === chapNum);
          if (curFound) return curFound;
        }
      }
    } catch (e) {}
  }

  return null;
}

async function simulateFetchChapter(bookName: string, chapNum: number): Promise<{ chapNum: number; title: string; length: number; timeMs: number }> {
  const t0 = Date.now();
  const item = await getChapterItem(bookName, chapNum);
  if (!item) throw new Error(`Chapter ${chapNum} not found in any mirror`);
  const html = await fetchPageSmart(item.url, 4000);
  const $c = cheerio.load(html);
  const paras: string[] = [];
  $c('#content p, #content, #chaptercontent p, #chaptercontent, .content p, .content, #nr_content, .showtxt').each((_, el) => {
    const t = $c(el).text().trim();
    if (t.length > 5 && !t.includes('下载APP')) paras.push(t);
  });
  return { chapNum, title: item.title, length: paras.join('\n').length, timeMs: Date.now() - t0 };
}

(async () => {
  const bookName = '凡人修仙 赠送机缘 暴击返还';
  console.log('Simulating parallel download of 10 VIP chapters (Chapters 21 to 30):');
  const tStart = Date.now();
  const promises = [];
  for (let ch = 21; ch <= 30; ch++) {
    promises.push(simulateFetchChapter(bookName, ch));
  }
  const results = await Promise.all(promises);
  console.log('\n--- BATCH DOWNLOAD SUCCESS ---');
  console.log(`Total time for all 10 VIP chapters in parallel: ${Date.now() - tStart} ms`);
  results.forEach(r => {
    console.log(`Ch ${r.chapNum} (${r.title}): Length = ${r.length} chars (took ${r.timeMs} ms)`);
  });
})();
