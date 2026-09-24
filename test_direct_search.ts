import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

async function testMirrorSearches() {
  const bookName = '凡人修仙：赠送机缘，暴击返还';
  const cleanBook = '凡人修仙 赠送机缘 暴击返还';

  // 1. Test wodescw search
  try {
    const url = `https://www.wodescw.com/search.html?keyword=${encodeURIComponent('赠送机缘')}`;
    console.log('Testing wodescw search:', url);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000)
    });
    console.log('wodescw status:', res.status);
    const html = await res.text();
    const $ = cheerio.load(html);
    $('a').each((_, el) => {
      const t = $(el).text().trim();
      const h = $(el).attr('href') || '';
      if (t.includes('凡人') || t.includes('机缘') || h.includes('/book_')) {
        console.log('wodescw found:', t, '->', h);
      }
    });
  } catch (e: any) {
    console.log('wodescw err:', e.message);
  }

  // 2. Test biquge search
  try {
    const bqUrl = `https://www.biquge.tw/modules/article/search.php?searchkey=${encodeURIComponent('绝世龙王')}`;
    console.log('\nTesting biquge search:', bqUrl);
    const res = await fetch(bqUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000)
    });
    console.log('biquge status:', res.status);
  } catch (e: any) {
    console.log('biquge err:', e.message);
  }
}

testMirrorSearches();
