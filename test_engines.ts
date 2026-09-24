import * as cheerio from 'cheerio';

async function testEngines() {
  const query = '凡人修仙 赠送机缘 暴击返还 章节';

  // 1. Bing
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-Hans`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const bingLinks: string[] = [];
    $('h2 a, .b_algo a').each((_, el) => {
      const raw = $(el).attr('href') || '';
      let dec = raw;
      if (raw.includes('bing.com/ck/a?')) {
        const m = raw.match(/u=a1([a-zA-Z0-9_-]+)/);
        if (m) {
          try {
            let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            dec = Buffer.from(b64, 'base64').toString('utf-8');
          } catch (e) {}
        }
      }
      if (dec.startsWith('http') && !dec.includes('bing.com') && !bingLinks.includes(dec)) {
        bingLinks.push(dec);
      }
    });
    console.log('Bing returned links:', bingLinks.length, bingLinks);
  } catch (e: any) {
    console.log('Bing err:', e.message);
  }

  // 2. Sogou
  try {
    const url = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const sogouLinks: string[] = [];
    $('h3 a, .vrTitle a').each((_, el) => {
      const raw = $(el).attr('href') || '';
      if (raw.startsWith('http')) sogouLinks.push(raw);
    });
    console.log('\nSogou returned links:', sogouLinks.length, sogouLinks.slice(0, 5));
  } catch (e: any) {
    console.log('Sogou err:', e.message);
  }
}

testEngines();
