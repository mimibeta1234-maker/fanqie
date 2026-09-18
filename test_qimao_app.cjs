async function test() {
  const bookId = "1485079";
  const itemId = "40808711";
  // Let us see how qimao app or wap serves chapter 18
  const endpoints = [
    `https://www.qimao.com/shuku/1485079-40808711/`,
    `https://m.qimao.com/shuku/1485079-40808711/`,
    `https://api-wap.qimao.com/api/chapter/content?book_id=1485079&chapter_id=40808711`,
    `https://api-wap.qimao.com/api/v1/chapter/content?book_id=1485079&chapter_id=40808711`,
    `https://m.qimao.com/chapter/1485079-40808711.html`
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15",
          "Referer": "https://m.qimao.com/"
        }
      });
      console.log(ep, "Status:", r.status);
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("json")) {
        const j = await r.json();
        console.log("JSON response:", JSON.stringify(j).slice(0, 150));
      } else if (r.ok) {
        const text = await r.text();
        console.log("HTML length:", text.length, "contains 言擎?", text.includes("言擎"));
      }
    } catch (e) {
      console.log(ep, "Err:", e.message);
    }
  }
}
test();
