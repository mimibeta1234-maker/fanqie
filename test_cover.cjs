async function run() {
  const res = await fetch("https://fanqienovel.com/rank", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });
  const html = await res.text();
  const fq = html.match(/https?:\/\/[^"'\s<>]+fqnovelpic\.com[^"'\s<>]+/g) || [];
  const byte = html.match(/https?:\/\/[^"'\s<>]+byteimg\.com[^"'\s<>]+/g) || [];
  console.log("fq count:", fq.length);
  console.log("byte count:", byte.length);
  if (fq.length > 0) {
    console.log("Sample FQ URL:", fq[0]);
  }
  if (byte.length > 0) {
    console.log("Sample Byte URL:", byte[0]);
  }
}
run();
