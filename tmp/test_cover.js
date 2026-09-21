async function run() {
  const res = await fetch("https://fanqienovel.com/rank", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });
  const html = await res.text();
  const fq = html.match(/https?:\/\/[^"'\s<>]+fqnovelpic\.com[^"'\s<>]+/g) || [];
  const byte = html.match(/https?:\/\/[^"'\s<>]+byteimg\.com[^"'\s<>]+/g) || [];
  console.log("fq count:", fq.length, fq.slice(0, 3));
  console.log("byte count:", byte.length, byte.slice(0, 3));
  if (fq.length > 0) {
    console.log("Sample FQ URL:", fq[0]);
  }
}
run();
