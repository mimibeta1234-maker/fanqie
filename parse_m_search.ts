import * as cheerio from 'cheerio';

async function parseMobileSearch() {
  const url = `https://m.qimao.com/search/?keyword=${encodeURIComponent('剑来')}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  // Check script tags for state
  $('script').each((i, el) => {
    const txt = $(el).html() || '';
    if (txt.includes('window.__INITIAL_STATE__') || txt.includes('window.__NUXT__') || txt.includes('search') || txt.includes('books')) {
      console.log(`Script ${i}: length ${txt.length}`);
      console.log(txt.slice(0, 500));
    }
  });
}

parseMobileSearch();
