import * as cheerio from 'cheerio';

async function testMobileQimao() {
  const urls = [
    `https://m.qimao.com/search/?keyword=${encodeURIComponent('剑来')}`,
    `https://m.qimao.com/api/search?keyword=${encodeURIComponent('剑来')}`,
    `https://www.qimao.com/search/index.html?keyword=${encodeURIComponent('剑来')}`,
    `https://www.qimao.com/api/search/suggest?keyword=${encodeURIComponent('剑来')}`,
    `https://m.qimao.com/`,
    `https://www.qimao.com/`
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          'Referer': 'https://m.qimao.com/',
        }
      });
      console.log(`URL: ${url} -> Status: ${res.status}`);
      const text = await res.text();
      console.log(`  Length: ${text.length}, Preview: ${text.slice(0, 150).replace(/\s+/g, ' ')}`);
    } catch (e: any) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testMobileQimao();
