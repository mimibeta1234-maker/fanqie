import * as cheerio from 'cheerio';

async function parseZonghengState() {
  const url = `https://www.zongheng.com/showchapter/672340.html`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  $('script').each((i, el) => {
    const txt = $(el).html() || '';
    if (txt.includes('window.__INITIAL_STATE__') || txt.includes('chapter') || txt.includes('tome')) {
      console.log(`Script ${i}: length ${txt.length}`);
      // Find JSON or variables
      const m = txt.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
      if (m) {
        console.log("Found window.__INITIAL_STATE__!");
      }
      // Or check Nuxt __NUXT__
      const nuxt = txt.match(/window\.__NUXT__\s*=\s*([\s\S]*?);/);
      if (nuxt) {
        console.log("Found window.__NUXT__! Length:", nuxt[1].length);
        console.log(nuxt[1].slice(0, 500));
      }
    }
  });
}

parseZonghengState();
