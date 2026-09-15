import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import { jsPDF } from 'jspdf';
import { ScribdPage } from './scribdCore';

/**
 * Detect image format from magic bytes
 */
function detectImageFormat(buffer: Buffer): 'JPEG' | 'PNG' | null {
  if (!buffer || buffer.length < 32) return null;
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'PNG';
  }
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'JPEG';
  }
  return null;
}

/**
 * Fetch image buffer safely with auto-fallback (.png <-> .jpg) and fast timeout
 */
async function fetchImageBuffer(url: string, timeoutMs: number = 4000): Promise<{ buffer: Buffer; format: 'JPEG' | 'PNG' } | null> {
  const tryUrls: string[] = [url];
  if (url.endsWith('.png')) {
    tryUrls.push(url.replace(/\.png$/, '.jpg'));
  } else if (url.endsWith('.jpg') || url.endsWith('.jpeg')) {
    tryUrls.push(url.replace(/\.jpe?g$/, '.png'));
  }

  for (const targetUrl of tryUrls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Referer: 'https://www.scribd.com/',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const format = detectImageFormat(buffer);
        if (format) {
          clearTimeout(timeoutId);
          return { buffer, format };
        }
      }
    } catch {
      // Continue to next candidate
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

/**
 * Pre-fetch full-page scans/images
 */
async function prefetchAllImages(pages: ScribdPage[]): Promise<Map<number, { buffer: Buffer; format: 'JPEG' | 'PNG' }>> {
  const imageMap = new Map<number, { buffer: Buffer; format: 'JPEG' | 'PNG' }>();
  // Only fetch images that are likely full scans or meaningful assets
  const pagesWithImages = pages.filter((p) => p.imageUrl);

  const CONCURRENCY = 25;
  for (let i = 0; i < pagesWithImages.length; i += CONCURRENCY) {
    const batch = pagesWithImages.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (p) => {
        if (!p.imageUrl) return;
        try {
          const result = await fetchImageBuffer(p.imageUrl);
          if (result && result.buffer.length > 50000) {
            // Only consider large images as full page scans
            imageMap.set(p.pageNumber, result);
          }
        } catch {
          // Continue on error
        }
      })
    );
  }

  return imageMap;
}

/**
 * Generate TXT Buffer
 */
export function generateTxtBuffer(
  title: string,
  docId: string,
  pages: ScribdPage[]
): Buffer {
  let content = `========================================================\n`;
  content += `TÀI LIỆU: ${title}\n`;
  content += `NGUỒN: Scribd (ID: ${docId})\n`;
  content += `SỐ TRANG: ${pages.length}\n`;
  content += `XUẤT QUA: Scribd Downloader\n`;
  content += `========================================================\n\n`;

  pages.forEach((p) => {
    content += `\n--- TRANG ${p.pageNumber} ---\n\n`;
    if (p.text && p.text.trim()) {
      content += p.text + '\n';
    } else {
      content += `[Trang ${p.pageNumber}: Trang trống / Bản scan]\n`;
    }
  });

  return Buffer.from(content, 'utf-8');
}

/**
 * Generate Microsoft Word DOCX Buffer
 */
export async function generateDocxBuffer(
  title: string,
  docId: string,
  pages: ScribdPage[]
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Nguồn: Scribd (ID: ${docId}) • Số trang: ${pages.length}`,
          italics: true,
          color: '666666',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ];

  for (let idx = 0; idx < pages.length; idx++) {
    const p = pages[idx];

    children.push(
      new Paragraph({
        text: `Trang ${p.pageNumber}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        pageBreakBefore: idx > 0,
      })
    );

    if (p.text && p.text.trim()) {
      const lines = p.text.split('\n');
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          children.push(
            new Paragraph({
              children: [new TextRun(trimmed)],
              spacing: { after: 80 },
            })
          );
        }
      });
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '(Trang trống)', italics: true, color: '999999' })],
          spacing: { after: 80 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Generate PDF Buffer using jsPDF (Formatted Book & Clean Typography)
 */
export async function generatePdfBuffer(
  title: string,
  docId: string,
  pages: ScribdPage[]
): Promise<Buffer> {
  const imageMap = await prefetchAllImages(pages);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxLineWidth = pageWidth - margin * 2;

  // Cover / First Page header
  let isFirstPage = true;

  for (let idx = 0; idx < pages.length; idx++) {
    const p = pages[idx];

    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    const imgData = imageMap.get(p.pageNumber);

    // If a full-page scan exists and is high quality, render image
    if (imgData && imgData.buffer.length > 50000) {
      try {
        const base64 = imgData.buffer.toString('base64');
        const mime = imgData.format === 'PNG' ? 'image/png' : 'image/jpeg';
        const dataUri = `data:${mime};base64,${base64}`;
        doc.addImage(dataUri, imgData.format, 0, 0, pageWidth, pageHeight);
        continue;
      } catch {
        // Fallback to text
      }
    }

    // Clean Running Header
    doc.setFontSize(8.5);
    doc.setTextColor(130, 130, 130);
    const shortTitle = title.length > 50 ? title.slice(0, 47) + '...' : title;
    doc.text(shortTitle, margin, 13);
    doc.text(`Trang ${p.pageNumber}`, pageWidth - margin, 13, { align: 'right' });

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, 16, pageWidth - margin, 16);

    // Footer
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Scribd ID: ${docId}`, margin, pageHeight - 7);
    doc.text(`${p.pageNumber} / ${pages.length}`, pageWidth - margin, pageHeight - 7, { align: 'right' });

    // Page Content Rendering
    let currentY = 25;
    const lines = p.text ? p.text.split('\n') : [];

    if (lines.length === 0 || !p.text?.trim()) {
      doc.setFontSize(10);
      doc.setTextColor(160, 160, 160);
      doc.text('(Trang trống / Trang đệm trong tài liệu gốc)', margin, currentY + 15);
      continue;
    }

    doc.setTextColor(30, 30, 30);

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        currentY += 4;
        continue;
      }

      // Detect Headings (e.g. Unit X, Part X, Chapter)
      const isHeading = /^(Unit|Part|Chapter|Bài|Chương|Section)\s+\d+/i.test(trimmed);

      if (isHeading) {
        currentY += 3;
        doc.setFontSize(11);
        doc.setTextColor(10, 40, 95);
      } else {
        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
      }

      const wrapped = doc.splitTextToSize(trimmed, maxLineWidth);
      for (const line of wrapped) {
        if (currentY > pageHeight - 20) {
          doc.addPage();
          currentY = 25;
          // Re-draw header on overflow page
          doc.setFontSize(8.5);
          doc.setTextColor(130, 130, 130);
          doc.text(shortTitle, margin, 13);
          doc.text(`Trang ${p.pageNumber} (tiếp)`, pageWidth - margin, 13, { align: 'right' });
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.3);
          doc.line(margin, 16, pageWidth - margin, 16);
          doc.setFontSize(9.5);
          doc.setTextColor(40, 40, 40);
        }
        doc.text(line, margin, currentY);
        currentY += isHeading ? 5.5 : 4.8;
      }

      if (isHeading) {
        currentY += 1.5;
      }
    }
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
