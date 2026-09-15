import * as cheerio from 'cheerio';

async function testBookZongheng() {
  const url = `https://book.zongheng.com/showchapter/672340.html`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    console.log("book.zongheng.com status:", res.status);
    const html = await res.text();
    console.log("Length:", html.length);
    const $ = cheerio.load(html);
    const chapters: { id: string; title: string; isVip: boolean }[] = [];
    $('li.col-4 a, .chapter-list a, .volume-list a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const title = $(el).text().trim();
      const m = href.match(/\/(\d+)\.html/);
      if (m) {
        chapters.push({ id: m[1], title, isVip: $(el).hasClass('vip') || $(el).find('em.vip').length > 0 });
      }
    });
    console.log(`Found ${chapters.length} chapters on book.zongheng.com! Sample:`, chapters.slice(0, 5));
  } catch (e: any) {
    console.error(e);
  }
}

testBookZongheng();
