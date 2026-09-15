async function findZonghengChapterApi() {
  const docUrl = `https://www.zongheng.com/showchapter/672340.html`;
  const res = await fetch(docUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  const html = await res.text();
  // Find all script src
  const scriptSrcs = html.match(/src=["']([^"']+\.js[^"']*)["']/g) || [];
  console.log("Scripts on page:", scriptSrcs);

  // Let's test standard Zongheng chapter catalog endpoints:
  const testApis = [
    "https://api.zongheng.com/v1/book/chapterList?bookId=672340",
    "https://www.zongheng.com/api/chapter/getChapterList?bookId=672340",
    "https://www.zongheng.com/api/book/getChapterList?bookId=672340",
    "https://read.zongheng.com/showchapter/672340.html",
    "https://book.zongheng.com/showchapter/672340.html",
    "https://comic.zongheng.com",
    "https://api.zongheng.com/chapter/getChapterList?bookId=672340"
  ];

  for (const api of testApis) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      const r = await fetch(api, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.zongheng.com/',
        },
        signal: controller.signal
      });
      clearTimeout(t);
      console.log(`API ${api} -> Status: ${r.status}, Content-Type: ${r.headers.get('content-type')}`);
      const txt = await r.text();
      console.log(`  Length: ${txt.length}, Preview: ${txt.slice(0, 150).replace(/\s+/g, ' ')}`);
    } catch (e: any) {
      console.log(`API ${api} -> Failed: ${e.message}`);
    }
  }
}

findZonghengChapterApi();
