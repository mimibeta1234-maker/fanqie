import * as cheerio from 'cheerio';

async function testZonghengAndSources() {
  console.log("=== Testing Zongheng Novel Info & Chapters ===");
  // Test a popular Zongheng novel: 剑来 (book id: 672340 on Zongheng)
  const zonghengBookId = "672340";
  const zhUrl = `https://www.zongheng.com/detail/${zonghengBookId}`;

  try {
    const res = await fetch(zhUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    console.log("Zongheng Detail Status:", res.status);
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('.book-info .book-name').text().trim() || $('h1').text().trim();
    const author = $('.book-info .au-name a').text().trim() || $('.author-name').text().trim();
    const intro = $('.book-info .book-dec').text().trim() || $('.book-intro').text().trim();
    const cover = $('.book-info img').attr('src') || $('.book-img img').attr('src');
    console.log("Parsed Zongheng Book:", { title, author, cover, intro: intro.slice(0, 100) });
  } catch (e: any) {
    console.error("Zongheng fetch error:", e.message);
  }

  // Test Zongheng Chapter List (TOC)
  try {
    const tocUrl = `https://www.zongheng.com/showchapter/${zonghengBookId}.html`;
    const res = await fetch(tocUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    console.log("Zongheng TOC Status:", res.status);
    const html = await res.text();
    const $ = cheerio.load(html);
    const chapters: { id: string; title: string; isVip: boolean }[] = [];
    $('.chapter-list li a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      const isVip = $(el).find('em.vip').length > 0 || $(el).hasClass('vip');
      const match = href.match(/\/(\d+)\.html/);
      if (match) {
        chapters.push({ id: match[1], title: text, isVip });
      }
    });
    console.log(`Zongheng Found ${chapters.length} chapters! Sample:`, chapters.slice(0, 5));
  } catch (e: any) {
    console.error("Zongheng TOC error:", e.message);
  }
}

testZonghengAndSources();
