import * as cheerio from 'cheerio';

async function testZonghengTOC() {
  const bookId = "672340";
  // Let's test PC Show Chapter
  const urls = [
    `https://www.zongheng.com/showchapter/${bookId}.html`,
    `https://m.zongheng.com/h5/book?bookid=${bookId}`,
    `https://m.zongheng.com/h5/chapter/list?bookId=${bookId}`,
    `https://m.zongheng.com/api/chapter/getChapterList?bookId=${bookId}`,
    `https://api.zongheng.com/v1/book/chapterList?bookId=${bookId}`,
    `https://api.zongheng.com/v1/book/detail?bookId=${bookId}`,
    `https://www.zongheng.com/api/chapter/getChapterList?bookId=${bookId}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.zongheng.com/',
        }
      });
      console.log(`URL: ${url} -> Status: ${res.status}, Type: ${res.headers.get('content-type')}`);
      const text = await res.text();
      console.log(`  Length: ${text.length}, Preview: ${text.slice(0, 250).replace(/\s+/g, ' ')}`);
    } catch (e: any) {
      console.log(`URL: ${url} -> Error: ${e.message}`);
    }
  }
}

testZonghengTOC();
