import * as cheerio from 'cheerio';

async function testChapterContent() {
  const freeChapUrl = `https://read.zongheng.com/chapter/672340/36898237.html`;
  const vipChapUrl = `https://read.zongheng.com/chapter/672340/95208034.html`;

  for (const [name, url] of [['Free Chapter', freeChapUrl], ['VIP Chapter', vipChapUrl]]) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      console.log(`${name} Status:`, res.status);
      const html = await res.text();
      const $ = cheerio.load(html);
      const title = $('.title_txtbox').text().trim() || $('h1').text().trim() || $('.reader-title').text().trim();
      const content = $('.content p').map((_, el) => $(el).text().trim()).get().join('\n') || $('.reader-main').text().trim();
      console.log(`${name} parsed: title="${title}", content length=${content.length}`);
      console.log(`  Sample:`, content.slice(0, 150).replace(/\s+/g, ' '));
    } catch (e: any) {
      console.error(name, e.message);
    }
  }
}

testChapterContent();
