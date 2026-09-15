async function testFullSources() {
  const bookName = "剑来";
  const author = "烽火戏诸侯";

  // Let's test searching for this book on free aggregator / fast mirror engines that have 100% full Qimao / Zongheng content
  const searchSources = [
    // Source 1: 69shuba / 69shu
    {
      name: '69shuba',
      searchUrl: `https://www.69shuba.com/api/search.php?key=${encodeURIComponent(bookName)}`
    },
    // Source 2: Waptxt / Biquge fast API
    {
      name: 'biquge',
      searchUrl: `https://api.biquge.tv/api/search?keyword=${encodeURIComponent(bookName)}`
    },
  ];

  for (const s of searchSources) {
    try {
      const res = await fetch(s.searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      console.log(`Source ${s.name} -> Status: ${res.status}`);
      const txt = await res.text();
      console.log(`  Length: ${txt.length}, Preview: ${txt.slice(0, 200)}`);
    } catch (e: any) {
      console.log(`Source ${s.name} error: ${e.message}`);
    }
  }
}

testFullSources();
