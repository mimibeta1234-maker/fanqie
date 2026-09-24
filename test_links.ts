import * as cheerio from 'cheerio';

async function testLinks() {
  const qUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('凡人修仙 赠送机缘 暴击返还 章节')}`;
  const res = await fetch(qUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      'Accept-Language': 'zh-CN,zh-Hans;q=0.9'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  $('a').each((_, el) => {
    const raw = $(el).attr('href') || '';
    if (raw.includes('uddg=')) {
      const m = raw.match(/uddg=([^&]+)/);
      if (m) console.log(decodeURIComponent(m[1]));
    }
  });
}

testLinks();
