import * as cheerio from 'cheerio';

async function testFullChapterDownload() {
  const bookTitle = "剑来";
  const author = "烽火戏诸侯";
  console.log(`Testing full chapter download for: ${bookTitle} by ${author}`);

  // Test search on free novel aggregator sources
  const searchEndpoints = [
    `https://api.biquge.tv/api/search?keyword=${encodeURIComponent(bookTitle)}`,
    `https://www.69shuba.com/modules/article/search.php`,
  ];

  // Test direct chapter fetch for VIP chapter (e.g. Chapter 81 of 剑来)
  const mirrorEndpoints = [
    `https://www.biquge.tv`,
    `https://www.69shuba.com`,
    `https://www.xbiquge.la`,
  ];

  console.log("Testing search & chapter fetching...");
}

testFullChapterDownload();
