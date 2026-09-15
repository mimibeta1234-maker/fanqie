import * as cheerio from 'cheerio';

async function inspectShowChapter() {
  const url = `https://www.zongheng.com/showchapter/672340.html`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  console.log("HTML length:", html.length);
  const $ = cheerio.load(html);

  // Check script tags for JSON state
  $('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('window.__INITIAL_STATE__') || text.includes('chapterList') || text.includes('volumeList') || text.includes('tomeList') || text.includes('chapterView')) {
      console.log(`Script ${i} matches! Length:`, text.length);
      console.log(text.slice(0, 500));
    }
  });

  // Let's also check if chapters are directly rendered in HTML
  $('a[href*="/chapter/"]').each((i, el) => {
    if (i < 5) {
      console.log("Chapter A tag:", $(el).attr('href'), $(el).text());
    }
  });
}

inspectShowChapter();
