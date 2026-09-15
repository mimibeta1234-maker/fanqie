async function testQimaoWeb() {
  console.log("Testing Qimao Web & Search...");

  // Let's test search on Qimao web
  // e.g. search for popular Zongheng novel: 剑来, 雪中悍刀行, 逆天邪神, 完美世界, 仙逆, etc.
  const keyword = encodeURIComponent("剑来");
  try {
    const res = await fetch(`https://www.qimao.com/shuku/0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-0-${keyword}-1/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    });
    console.log("Qimao Shuku Search Status:", res.status);
    const html = await res.text();
    console.log("HTML length:", html.length);
    console.log("Sample HTML snippet:", html.slice(0, 1000));
  } catch (err) {
    console.error("Search error:", err);
  }
}

testQimaoWeb();
