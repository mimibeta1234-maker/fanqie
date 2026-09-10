import JSZip from 'jszip';

export interface EpubChapter {
  title: string;
  content: string; // Plain text or HTML
}

export interface EpubOptions {
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  chapters: EpubChapter[];
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateEpub(options: EpubOptions): Promise<Buffer> {
  const zip = new JSZip();

  // 1. mimetype (Must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. Stylesheet
  const css = `
body {
  font-family: serif;
  margin: 5% 8%;
  line-height: 1.8;
  color: #222;
}
h1 {
  font-size: 1.4em;
  font-weight: bold;
  text-align: center;
  margin: 1.5em 0 1em 0;
  color: #111;
}
p {
  text-indent: 2em;
  margin: 0.8em 0;
  text-align: justify;
}
`;
  zip.file('OEBPS/style.css', css);

  // 4. Download Cover Image if provided
  let hasCover = false;
  if (options.coverUrl) {
    try {
      const res = await fetch(options.coverUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (res.ok) {
        const coverBuf = await res.arrayBuffer();
        zip.file('OEBPS/cover.jpg', coverBuf);
        hasCover = true;
      }
    } catch (e) {
      console.warn("Could not download cover for epub:", e);
    }
  }

  // 5. Chapters XHTML
  const manifestItems: string[] = [
    '<item id="style" href="style.css" media-type="text/css"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'
  ];
  if (hasCover) {
    manifestItems.push('<item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>');
  }

  const spineRefs: string[] = [];
  const navPoints: string[] = [];

  options.chapters.forEach((ch, idx) => {
    const chId = `chapter_${idx + 1}`;
    const filename = `chapter_${idx + 1}.xhtml`;

    manifestItems.push(`<item id="${chId}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spineRefs.push(`<itemref idref="${chId}"/>`);
    navPoints.push(`
    <navPoint id="nav_${chId}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="${filename}"/>
    </navPoint>`);

    // Format paragraphs
    const paras = ch.content
      .split('\n')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${escapeXml(p.replace(/^[　\s]+/, ''))}</p>`)
      .join('\n');

    const chXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN">
<head>
  <title>${escapeXml(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${escapeXml(ch.title)}</h1>
  ${paras}
</body>
</html>`;

    zip.file(`OEBPS/${filename}`, chXhtml);
  });

  // 6. content.opf
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(options.title)}</dc:title>
    <dc:creator opf:role="aut">${escapeXml(options.author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="BookId">urn:uuid:fanqie-${Date.now()}</dc:identifier>
    ${options.description ? `<dc:description>${escapeXml(options.description)}</dc:description>` : ''}
    ${hasCover ? '<meta name="cover" content="cover-image"/>' : ''}
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineRefs.join('\n    ')}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', opf);

  // 7. toc.ncx
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:fanqie-${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(options.title)}</text></docTitle>
  <docAuthor><text>${escapeXml(options.author)}</text></docAuthor>
  <navMap>
    ${navPoints.join('')}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', ncx);

  return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
}
