import * as cheerio from 'cheerio';

async function testQimaoEndpoints() {
  // Let's test PC search, WAP search, and APIs
  const urls = [
    "https://www.qimao.com/search/index.html?word=剑来",
    "https://www.qimao.com/api/search?word=剑来",
    "https://api-bc.km.com/api/v1/search?word=剑来",
    "https://api-bc.qimao.com/api/v1/search?word=剑来",
    "https://m.qimao.com/search/?word=剑来",
    "https://www.qimao.com/shuku/",
    "https://m.qimao.com/shuku/",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          'Referer': 'https://m.qimao.com/',
        }
      });
      console.log(`URL: ${url} -> Status: ${res.status}, Type: ${res.headers.get('content-type')}`);
      const text = await res.text();
      console.log(`  Length: ${text.length}, Preview: ${text.slice(0, 200).replace(/\s+/g, ' ')}`);
    } catch (e: any) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testQimaoEndpoints();
