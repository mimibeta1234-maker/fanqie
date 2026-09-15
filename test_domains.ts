async function testQimaoDomains() {
  const testUrls = [
    "https://www.qimao.com/shuku/12345/",
    "https://www.qimao.com/book/12345/",
    "https://www.wtzw.com/", // Wantu (Qimao's old/sibling domain)
    "https://api-bc.km.com",
  ];

  for (const url of testUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'follow',
      });
      console.log(`${url} => Status: ${res.status}, Final URL: ${res.url}`);
    } catch (e: any) {
      console.log(`${url} => Error: ${e.message}`);
    }
  }
}

testQimaoDomains();
