import * as cheerio from 'cheerio';

async function testGoogle() {
  const query = '凡人修仙 赠送机缘 暴击返还 目录';
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=zh-CN`;
  console.log('Testing Google...');
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });
    console.log('Google status:', res.status);
    const html = await res.text();
    const $ = cheerio.load(html);
    const links: string[] = [];
    $('a').each((_, el) => {
      const h = $(el).attr('href') || '';
      if (h.startsWith('/url?q=')) {
        const m = h.match(/\/url\?q=([^&]+)/);
        if (m) links.push(decodeURIComponent(m[1]));
      } else if (h.startsWith('http') && !h.includes('google.com')) {
        links.push(h);
      }
    });
    console.log('Google links count:', links.length, links.slice(0, 5));
  } catch (e: any) {
    console.log('Google err:', e.message);
  }
}

testGoogle();
