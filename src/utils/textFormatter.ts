/**
 * Normalizes and formats novel abstracts / synopses so paragraphs are cleanly separated
 * instead of sticking together into a single wall of text ("dính đoạn").
 */
export function formatAbstract(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw);

  // 1. Convert HTML break tags to newlines
  s = s.replace(/<br\s*\/?>/gi, '\n')
       .replace(/<\/p>/gi, '\n\n')
       .replace(/<[^>]+>/g, '');

  // 2. Standardize carriage returns
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Convert multi-space / full-width em-space indentations into paragraph breaks
  // Fanqie and other Chinese sources often encode paragraph breaks as 2+ spaces or \u3000 (em-space)
  s = s.replace(/[\t\u3000\u00A0 ]{2,}/g, '\n\n');

  // 4. Handle Chinese punctuation endings (。！？】”」』) followed by space/indent
  s = s.replace(/([。！？】”」』])[\t\u3000\u00A0 ]+(?=[^\s])/g, '$1\n\n');

  // 5. Clean up each line and eliminate redundant blank lines
  const lines = s.split('\n')
    .map(l => l.replace(/^[\s\u3000\u00A0]+/, '').replace(/[\s\u3000\u00A0]+$/, ''))
    .filter(Boolean);

  return lines.join('\n\n');
}

/**
 * Splits formatted abstract text into an array of non-empty paragraph strings.
 */
export function getAbstractParagraphs(raw: string | undefined | null): string[] {
  const formatted = formatAbstract(raw);
  if (!formatted) return [];
  return formatted.split('\n\n').filter(Boolean);
}
