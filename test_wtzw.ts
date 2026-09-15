import crypto from 'crypto';

async function testWtzwEndpoints() {
  const bookId = "672340"; // or Qimao book ID
  console.log("Testing wtzw API endpoints...");

  const endpoints = [
    `https://api-ks.wtzw.com/api/v1/chapter/content?book_id=${bookId}&chapter_id=36898237`,
    `https://api-bc.wtzw.com/api/v1/chapter/chapter-list?book_id=${bookId}`,
    `https://api-bc.wtzw.com/search/v1/words?word=${encodeURIComponent('剑来')}`,
    `https://api-bc.wtzw.com/api/v1/book/detail?book_id=${bookId}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://m.qimao.com/',
        }
      });
      console.log(`Endpoint: ${ep}`);
      console.log(`  Status: ${res.status}, Type: ${res.headers.get('content-type')}`);
      const text = await res.text();
      console.log(`  Length: ${text.length}, Body: ${text.slice(0, 300)}`);
    } catch (e: any) {
      console.log(`Endpoint: ${ep} -> Error: ${e.message}`);
    }
  }
}

testWtzwEndpoints();
