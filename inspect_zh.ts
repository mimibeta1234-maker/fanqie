import * as cheerio from 'cheerio';

async function inspectZonghengHtml() {
  const zhUrl = `https://www.zongheng.com/detail/672340`;
  const res = await fetch(zhUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  console.log("HTML Length:", html.length);
  const $ = cheerio.load(html);
  console.log("Title tag:", $('title').text());
  console.log("Meta description:", $('meta[name="description"]').attr('content'));
  console.log("Meta og:title:", $('meta[property="og:title"]').attr('content') || $('meta[name="og:title"]').attr('content'));
  console.log("Meta og:novel:author:", $('meta[property="og:novel:author"]').attr('content'));

  // Look for any text or classes
  $('div').each((_, el) => {
    const cls = $(el).attr('class');
    if (cls && (cls.includes('title') || cls.includes('name') || cls.includes('author') || cls.includes('info') || cls.includes('catalog'))) {
      // console.log("Class:", cls, "Text snippet:", $(el).text().slice(0, 50).replace(/\s+/g, ' '));
    }
  });

  // Let's check chapter catalog API or script tags
  const scriptContent = $('script').map((_, el) => $(el).html()).get().join('\n');
  const bookIdMatches = scriptContent.match(/bookId\s*[:=]\s*["']?(\d+)["']?/i);
  console.log("Script bookId:", bookIdMatches);

  // Check if there are API calls in the HTML
  const apiUrls = scriptContent.match(/https?:\/\/[^"'\s]+\/api\/[^"'\s]+/gi) || [];
  console.log("API URLs found in script:", apiUrls);
}

inspectZonghengHtml();
