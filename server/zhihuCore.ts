import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { generateEpub } from './epubGenerator';

export interface ZhihuIndexEntry {
  id: string;
  title: string;
  link: string;
  url: string;
  date: string;
  snippet: string;
}

export interface ZhihuStorySection {
  title: string;
  content: string;
}

export interface ZhihuStoryDetail {
  id: string;
  title: string;
  author: string;
  date: string;
  tags: string[];
  wordCount: number;
  unlocked: boolean;
  sourceUrl: string;
  sourceType: 'onehu_yanxuan' | 'zhihu_official' | 'zhihu_answer' | 'zhihu_question' | 'zhihu_article' | 'zhihu_paid_column' | 'direct_import';
  contentType?: 'free_article' | 'free_answer' | 'free_question' | 'vip_story' | 'imported';
  questionTitle?: string;
  upvotes?: number;
  paragraphs: string[];
  fullText: string;
  sections: ZhihuStorySection[];
  vipNotice?: {
    isPaid: boolean;
    chapterTitle: string;
    columnTitle: string;
    wordCountText?: string;
    colId?: string;
    sectionId?: string;
  };
}

let cachedEntries: ZhihuIndexEntry[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 20 * 60 * 1000; // 20 minutes

/**
 * Fetch and cache the full Yanxuan library index
 */
export async function getZhihuIndex(forceRefresh = false): Promise<ZhihuIndexEntry[]> {
  const now = Date.now();
  if (!forceRefresh && cachedEntries.length > 0 && now - lastFetchTime < CACHE_TTL) {
    return cachedEntries;
  }

  try {
    const searchXmlUrl = 'https://onehu.xyz/local-search.xml';
    const res = await fetch(searchXmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      if (cachedEntries.length > 0) return cachedEntries;
      throw new Error(`Failed to load Yanxuan index: HTTP ${res.status}`);
    }

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const entries: ZhihuIndexEntry[] = [];

    $('entry').each((_, el) => {
      const node = $(el);
      const title = node.find('title').text().trim();
      let rawLink = node.find('url').text().trim() || node.find('link').attr('href') || '';
      if (!title || !rawLink) return;

      if (!rawLink.startsWith('http')) {
        if (!rawLink.startsWith('/')) rawLink = '/' + rawLink;
        rawLink = `https://onehu.xyz${rawLink}`;
      }

      // Extract date from URL if available, e.g. /2026/09/13/
      const dateMatch = rawLink.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
      const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';

      const contentHtml = node.find('content').text() || '';
      const snippet = contentHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);

      // Unique ID based on MD5 hash of rawLink
      const id = crypto.createHash('md5').update(rawLink).digest('hex');

      entries.push({
        id,
        title,
        link: rawLink,
        url: rawLink,
        date,
        snippet
      });
    });

    if (entries.length > 0) {
      cachedEntries = entries;
      lastFetchTime = now;
    }
    return cachedEntries;
  } catch (err: any) {
    console.error('getZhihuIndex error:', err.message);
    if (cachedEntries.length > 0) return cachedEntries;
    return [];
  }
}

/**
 * Search Yanxuan library by keywords or get latest stories
 */
export async function searchZhihuStories(
  query: string,
  page = 1,
  pageSize = 20
): Promise<{ total: number; page: number; pageSize: number; list: ZhihuIndexEntry[] }> {
  const index = await getZhihuIndex();
  const q = query.trim().toLowerCase();

  let filtered = index;
  if (q) {
    const qParts = q.split(/\s+/).filter(Boolean);
    filtered = index
      .map(item => {
        let score = 0;
        const titleLower = item.title.toLowerCase();
        const snippetLower = item.snippet.toLowerCase();

        // Exact match on title
        if (titleLower === q) score += 100;
        else if (titleLower.includes(q)) score += 50;

        for (const part of qParts) {
          if (titleLower.includes(part)) score += 20;
          if (snippetLower.includes(part)) score += 5;
        }

        return { item, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  return {
    total,
    page,
    pageSize,
    list
  };
}

/**
 * Split long novel content into structured sections / chapters
 */
function parseStorySections(title: string, paras: string[]): ZhihuStorySection[] {
  const sections: ZhihuStorySection[] = [];
  let currentSectionTitle = 'Phần mở đầu';
  let currentSectionParas: string[] = [];

  // Patterns matching section dividers: "1", "2", "3", "第1节", "第一节", "【一】", "一、"
  const sectionDividerRegex = /^(?:第\s*[\d一二三四五六七八九十百]+\s*[节章节篇]|[\d]{1,2}[.、\s]|【[一二三四五六七八九十\d]+】|[一二三四五六七八九十]+[、.])/;

  for (const p of paras) {
    const trimmed = p.trim();
    if (trimmed.length <= 40 && sectionDividerRegex.test(trimmed)) {
      if (currentSectionParas.length > 0) {
        sections.push({
          title: currentSectionTitle,
          content: currentSectionParas.join('\n\n')
        });
        currentSectionParas = [];
      }
      currentSectionTitle = trimmed;
    } else {
      currentSectionParas.push(p);
    }
  }

  if (currentSectionParas.length > 0) {
    sections.push({
      title: currentSectionTitle,
      content: currentSectionParas.join('\n\n')
    });
  }

  // If no subdivisions were found, create single chapter with the story title
  if (sections.length <= 1) {
    return [
      {
        title: title,
        content: paras.join('\n\n')
      }
    ];
  }

  return sections;
}

/**
 * Create a structured Zhihu story from raw text / HTML copied from Zhihu
 */
export function createZhihuStoryFromRawText(
  rawInput: string,
  customTitle?: string,
  customAuthor?: string,
  sourceUrl?: string
): ZhihuStoryDetail {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    throw new Error('Nội dung văn bản trống. Vui lòng dán nội dung từ Zhihu.');
  }

  // Check if input is HTML or Markdown/plain text
  let rawText = trimmed;
  let detectedTitle = customTitle?.trim() || '';
  let detectedAuthor = customAuthor?.trim() || '';

  if (trimmed.includes('<p>') || trimmed.includes('<div>') || trimmed.includes('<article>')) {
    const $ = cheerio.load(trimmed);
    if (!detectedTitle) {
      detectedTitle = $('h1, h2, .title, .Post-Title').first().text().trim();
    }
    if (!detectedAuthor) {
      detectedAuthor = $('.AuthorInfo-name, .author, .UserLink-link').first().text().trim();
    }
    $('script, style, noscript, .ad, header, footer').remove();
    const paras: string[] = [];
    $('p, h2, h3, h4, blockquote').each((_, el) => {
      const t = $(el).text().trim();
      if (t) paras.push(t);
    });
    if (paras.length > 0) {
      rawText = paras.join('\n\n');
    }
  }

  // Split lines into clean paragraphs
  const lines = rawText.split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
  const paragraphs: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect title from first line if not provided
    if (i === 0 && !detectedTitle) {
      if (line.startsWith('# ')) {
        detectedTitle = line.replace(/^#+\s*/, '').trim();
        continue;
      } else if (line.length < 60 && !line.endsWith('。') && !line.endsWith('.')) {
        detectedTitle = line;
        continue;
      }
    }

    // Detect author if line matches
    if (!detectedAuthor && (line.startsWith('作者：') || line.startsWith('作者: ') || line.startsWith('Author: '))) {
      detectedAuthor = line.replace(/^(作者[：:]|Author:\s*)/, '').trim();
      continue;
    }

    paragraphs.push(line);
  }

  const finalTitle = detectedTitle || 'Bài viết Zhihu (Nhập trực tiếp)';
  const finalAuthor = detectedAuthor || 'Zhihu Tác giả';
  const fullText = paragraphs.join('\n\n');
  const sections = parseStorySections(finalTitle, paragraphs);

  return {
    id: crypto.createHash('md5').update(finalTitle + fullText.slice(0, 100)).digest('hex'),
    title: finalTitle,
    author: finalAuthor,
    date: new Date().toISOString().split('T')[0],
    tags: ['Zhihu Trực Tiếp', 'Tự do', 'Miễn phí'],
    wordCount: fullText.length,
    unlocked: true,
    sourceUrl: sourceUrl || 'direct://input',
    sourceType: 'direct_import',
    contentType: 'imported',
    paragraphs,
    fullText,
    sections
  };
}

/**
 * Fetch and unlock full unabridged Zhihu content (Free & VIP)
 * Supports: Answers, Questions, Zhuanlan Articles, Paid Columns, Mirror sites
 */
export async function getZhihuStoryDetail(
  urlOrId: string,
  customCookie?: string
): Promise<ZhihuStoryDetail> {
  let targetUrl = urlOrId.trim();

  // If base64url or MD5 encoded ID, lookup in index
  if (!targetUrl.startsWith('http')) {
    const index = await getZhihuIndex();
    const found = index.find(e => e.id === targetUrl || e.url.includes(targetUrl));
    if (found) {
      targetUrl = found.url;
    } else {
      // Decode if base64url
      try {
        const decoded = Buffer.from(targetUrl, 'base64url').toString('utf-8');
        if (decoded.startsWith('http')) {
          targetUrl = decoded;
        }
      } catch {}
    }
  }

  // Case 1: Fetching from Yanxuan Mirror (onehu.xyz) - 100% Unlocked VIP
  if (targetUrl.includes('onehu.xyz')) {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Không thể tải truyện từ kho 盐选: HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract title
    let title = $('h1.post-title, h1').first().text().trim();
    if (!title) {
      title = $('title').text().replace(/_.*| - .*/, '').trim();
    }
    // Clean redundant duplicated titles
    title = title.replace(/^(.{3,40})\1+$/, '$1').trim();

    // Extract meta
    const dateText = $('.post-meta, .post-date, time').first().text().trim();
    const tags: string[] = [];
    $('.post-meta a, .tagcloud a, a[href*="/tags/"]').each((_, el) => {
      const tag = $(el).text().replace(/^#/, '').trim();
      if (tag && !tags.includes(tag) && tag !== 'zhihu') {
        tags.push(tag);
      }
    });

    // Content container
    const contentEl = $('.markdown-body, article.post-content, .post-content').first();
    contentEl.find('script, style, .adsbygoogle, .reward-container, noscript, header, footer').remove();

    const paras: string[] = [];
    contentEl.find('p, h2, h3, h4, blockquote').each((_, el) => {
      const t = $(el).text().trim();
      if (
        t &&
        !t.includes('adsbygoogle') &&
        !t.includes('转载请注明') &&
        !t.includes('未经允许禁止转载') &&
        !t.includes('扫描二维码') &&
        !t.includes('打赏')
      ) {
        paras.push(t);
      }
    });

    // If paras are empty, try splitting text blocks
    if (paras.length === 0) {
      const rawText = contentEl.text();
      const rawLines = rawText.split(/\n+/).map(s => s.trim()).filter(Boolean);
      for (const line of rawLines) {
        if (line.length > 5) paras.push(line);
      }
    }

    const fullText = paras.join('\n\n');
    const wordCount = fullText.length;
    const sections = parseStorySections(title, paras);

    return {
      id: crypto.createHash('md5').update(targetUrl).digest('hex'),
      title: title || 'Truyện 知乎 盐选',
      author: '知乎盐选专栏',
      date: dateText || 'Gần đây',
      tags: tags.length > 0 ? tags : ['知乎盐选', 'VIP小说'],
      wordCount,
      unlocked: true,
      sourceUrl: targetUrl,
      sourceType: 'onehu_yanxuan',
      contentType: 'vip_story',
      paragraphs: paras,
      fullText,
      sections
    };
  }

  // Case 2: Official Zhihu URLs (Answers, Questions, Zhuanlan Articles, Paid Columns)
  if (targetUrl.includes('zhihu.com')) {
    const answerMatch = targetUrl.match(/answer\/(\d+)/);
    const questionOnlyMatch = !answerMatch ? targetUrl.match(/question\/(\d+)/) : null;
    const articleMatch = targetUrl.match(/p\/(\d+)/);
    const paidColumnMatch = targetUrl.match(/paid_column\/([a-zA-Z0-9_-]+)/);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': targetUrl,
      'Accept': 'application/json, text/plain, */*'
    };
    if (customCookie && customCookie.trim()) {
      headers['Cookie'] = customCookie.trim();
    }

    // Subcase 2A: Zhihu Answer
    if (answerMatch) {
      const answerId = answerMatch[1];
      const apiUrl = `https://www.zhihu.com/api/v4/answers/${answerId}?include=content,excerpt,title,question,author,voteup_count,paid_info,updated_time`;
      try {
        const res = await fetch(apiUrl, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            const $ = cheerio.load(data.content || '');
            $('script, style, noscript').remove();
            const paras = $('p, h2, h3, blockquote').map((_, el) => $(el).text().trim()).get().filter(Boolean);
            const questionTitle = data.question?.title || '';
            const title = questionTitle ? `${questionTitle}` : (data.title || `Câu trả lời Zhihu #${answerId}`);
            const author = data.author?.name || 'Zhihu Tác giả';
            const date = data.updated_time ? new Date(data.updated_time * 1000).toISOString().split('T')[0] : 'Gần đây';
            const fullText = paras.join('\n\n');

            return {
              id: crypto.createHash('md5').update(targetUrl).digest('hex'),
              title,
              author,
              date,
              tags: ['Zhihu Câu Trả Lời', data.paid_info?.is_paid ? 'VIP 盐选' : 'Miễn Phí'],
              wordCount: fullText.length,
              unlocked: !data.paid_info?.is_paid,
              sourceUrl: targetUrl,
              sourceType: 'zhihu_answer',
              contentType: data.paid_info?.is_paid ? 'vip_story' : 'free_answer',
              questionTitle,
              upvotes: data.voteup_count,
              paragraphs: paras,
              fullText,
              sections: parseStorySections(title, paras)
            };
          }
        }
      } catch (e: any) {
        console.error('Answer fetch error:', e.message);
      }
    }

    // Subcase 2B: Zhihu Zhuanlan Article
    if (articleMatch) {
      const articleId = articleMatch[1];
      const apiUrl = `https://zhuanlan.zhihu.com/api/articles/${articleId}`;
      try {
        const res = await fetch(apiUrl, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            const $ = cheerio.load(data.content || '');
            $('script, style, noscript').remove();
            const paras = $('p, h2, h3, blockquote').map((_, el) => $(el).text().trim()).get().filter(Boolean);
            const title = data.title || `Chuyên mục Zhihu #${articleId}`;
            const author = data.author?.name || 'Zhihu Tác giả';
            const fullText = paras.join('\n\n');

            return {
              id: crypto.createHash('md5').update(targetUrl).digest('hex'),
              title,
              author,
              date: new Date().toISOString().split('T')[0],
              tags: ['Zhihu Chuyên Mục', 'Miễn Phí'],
              wordCount: fullText.length,
              unlocked: true,
              sourceUrl: targetUrl,
              sourceType: 'zhihu_article',
              contentType: 'free_article',
              paragraphs: paras,
              fullText,
              sections: parseStorySections(title, paras)
            };
          }
        }
      } catch (e: any) {
        console.error('Article fetch error:', e.message);
      }
    }

    // Subcase 2C: Zhihu Question (Fetch Question Details & Top Answers into a multi-chapter compilation)
    if (questionOnlyMatch) {
      const questionId = questionOnlyMatch[1];
      try {
        const qUrl = `https://www.zhihu.com/api/v4/questions/${questionId}?include=title,detail,author,answer_count`;
        const qRes = await fetch(qUrl, { headers });
        if (qRes.ok) {
          const qData = await qRes.json();
          const qTitle = qData.title || `Câu hỏi Zhihu #${questionId}`;

          // Fetch top answers for this question
          const aUrl = `https://www.zhihu.com/api/v4/questions/${questionId}/answers?limit=5&sort_by=default&include=content,author,voteup_count`;
          const aRes = await fetch(aUrl, { headers });
          let answersData: any[] = [];
          if (aRes.ok) {
            const aJson = await aRes.json();
            answersData = aJson.data || [];
          }

          const sections: ZhihuStorySection[] = [];
          const allParas: string[] = [];

          // Question detail as prologue
          if (qData.detail) {
            const $d = cheerio.load(qData.detail);
            const dParas = $d('p').map((_, el) => $d(el).text().trim()).get().filter(Boolean);
            if (dParas.length > 0) {
              sections.push({
                title: '【Mô tả câu hỏi】',
                content: dParas.join('\n\n')
              });
              allParas.push(...dParas);
            }
          }

          // Each answer as a chapter
          answersData.forEach((ans, idx) => {
            const $a = cheerio.load(ans.content || '');
            const aParas = $a('p').map((_, el) => $a(el).text().trim()).get().filter(Boolean);
            if (aParas.length > 0) {
              const authorName = ans.author?.name || `Người dùng ẩn danh ${idx + 1}`;
              const upvotes = ans.voteup_count ? ` (${ans.voteup_count} lượt thích)` : '';
              sections.push({
                title: `Trả lời của ${authorName}${upvotes}`,
                content: aParas.join('\n\n')
              });
              allParas.push(...aParas);
            }
          });

          if (sections.length > 0) {
            const fullText = allParas.join('\n\n');
            return {
              id: crypto.createHash('md5').update(targetUrl).digest('hex'),
              title: qTitle,
              author: 'Tổng hợp Zhihu',
              date: new Date().toISOString().split('T')[0],
              tags: ['Zhihu Hỏi Đáp', 'Diễn Đàn', 'Miễn Phí'],
              wordCount: fullText.length,
              unlocked: true,
              sourceUrl: targetUrl,
              sourceType: 'zhihu_question',
              contentType: 'free_question',
              paragraphs: allParas,
              fullText,
              sections
            };
          }
        }
      } catch (e: any) {
        console.error('Question fetch error:', e.message);
      }
    }

    // Subcase 2D: Zhihu Paid Column / Yanxuan Section (专栏 / 课时 / 章节)
    if (paidColumnMatch) {
      const columnId = paidColumnMatch[1];
      const sectionMatch = targetUrl.match(/section\/([a-zA-Z0-9_-]+)/);
      const targetSectionId = sectionMatch ? sectionMatch[1] : '';

      try {
        // Fetch catalog of this paid column directly from Zhihu Remix API
        const catalogUrl = `https://api.zhihu.com/remix/well/${columnId}/catalog?offset=0&limit=100&order_by=global_idx`;
        const catRes = await fetch(catalogUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': targetUrl,
            ...(customCookie ? { 'Cookie': customCookie.trim() } : {})
          }
        });

        if (catRes.ok) {
          const catJson: any = await catRes.json();
          const colTitle = catJson.extra?.title || 'Zhihu 盐选专栏';
          const sectionsData: any[] = Array.isArray(catJson.data) ? catJson.data : [];

          // Find targeted section or fallback to first section
          let targetSec = sectionsData.find((s: any) =>
            String(s.id) === String(targetSectionId) ||
            String(s.section_cell?.id) === String(targetSectionId)
          );
          if (!targetSec && sectionsData.length > 0) {
            targetSec = sectionsData[0];
          }

          const secTitle = targetSec?.title || colTitle;
          const isFree = targetSec?.is_free === true;
          const wordCountText = targetSec?.meta_v2?.[0]?.content || '';
          const likeCount = targetSec?.like_count || 0;
          const serialText = targetSec?.index?.serial_number_txt || '';

          // 1. Check if this exact title or column is in our 8,000+ unlocked repository!
          try {
            const index = await getZhihuIndex();
            const matchedInIndex = index.find(e =>
              (secTitle && e.title.includes(secTitle)) ||
              (secTitle && secTitle.includes(e.title)) ||
              (e.snippet && secTitle && e.snippet.includes(secTitle))
            );
            if (matchedInIndex) {
              const unlockedStory = await getZhihuStoryDetail(matchedInIndex.url, customCookie);
              if (unlockedStory && unlockedStory.paragraphs && unlockedStory.paragraphs.length > 0) {
                return unlockedStory;
              }
            }
          } catch {}

          // 2. If customCookie is provided, try to fetch the section HTML with credentials
          let unlockedContent: string[] = [];
          if (customCookie && customCookie.trim()) {
            try {
              const fetchUrl = targetSectionId
                ? `https://www.zhihu.com/market/paid_column/${columnId}/section/${targetSectionId}`
                : targetUrl;
              const pageRes = await fetch(fetchUrl, { headers });
              if (pageRes.ok) {
                const html = await pageRes.text();
                const $ = cheerio.load(html);
                $('script, style, noscript, nav, header, footer').remove();

                const paras = $('div[class*="ManuscriptIntro"], div[class*="content"], div[class*="article"], p')
                  .map((_, el) => $(el).text().trim())
                  .get()
                  .filter(t => t.length > 10 && !t.includes('知乎') && !t.includes('下载APP'));
                if (paras.length >= 3) {
                  unlockedContent = paras;
                }
              }
            } catch (fetchErr: any) {
              console.warn('Authenticated section fetch failed:', fetchErr.message);
            }
          }

          // Build catalog list for all sections in this column
          const storySections: ZhihuStorySection[] = sectionsData.map((s: any) => {
            const sIdx = s.index?.serial_number_txt ? `${s.index.serial_number_txt}: ` : '';
            return {
              title: `${sIdx}${s.title || 'Chương'} ${s.is_free ? '(Miễn phí)' : '(VIP 盐选)'}`,
              content: `Mục: ${s.title}\nDung lượng: ${s.meta_v2?.[0]?.content || 'N/A'}\nTrạng thái: ${s.is_free ? 'Miễn phí' : 'VIP 盐选'}`
            };
          });

          if (unlockedContent.length > 0) {
            const fullText = unlockedContent.join('\n\n');
            return {
              id: crypto.createHash('md5').update(targetUrl).digest('hex'),
              title: secTitle !== colTitle ? `${secTitle} (${colTitle})` : colTitle,
              author: '知乎盐选专栏',
              date: new Date().toISOString().split('T')[0],
              tags: ['Zhihu 盐选 VIP', 'Chuyên Mục Trả Phí', isFree ? 'Chương Miễn Phí' : 'Đã mở khóa qua Cookie'],
              wordCount: fullText.length,
              unlocked: true,
              sourceUrl: targetUrl,
              sourceType: 'zhihu_paid_column',
              contentType: 'vip_story',
              paragraphs: unlockedContent,
              fullText,
              sections: storySections
            };
          }

          // If not unlocked directly (VIP Yanxuan chapter requiring VIP cookie or direct paste)
          const infoNotice = [
            `【Thông tin nhận diện chuyên mục Zhihu 盐选】`,
            `• Tên chương: ${secTitle} ${serialText ? `(${serialText})` : ''}`,
            `• Thuộc chuyên mục: ${colTitle}`,
            `• Dung lượng: ${wordCountText || 'Khoảng 1.1 万字 (~11.000 chữ)'} | Lượt thích: ${likeCount}`,
            `• Trạng thái bản quyền: ${isFree ? 'Miễn phí (Zhihu yêu cầu đăng nhập)' : 'VIP Yanxuan Trả Phí (is_free: false)'}`,
            `--------------------------------------------------`,
            `💡 HƯỚNG DẪN MỞ KHÓA & TẢI XUỐNG:`,
            `Cách 1 (Nhanh nhất - Chỉ 3 giây): Nếu bạn đang mở xem truyện này trên trình duyệt máy tính hoặc app Zhihu, hãy chọn bôi đen sao chép (Ctrl+C) và chuyển sang tab "Nhập nội dung trực tiếp" (hệ thống đã tự động điền sẵn tên truyện "${secTitle}"), dán vào (Ctrl+V) và tải file TXT/EPUB hoàn chỉnh!`,
            `Cách 2: Nếu bạn có tài khoản Zhihu (đã mua VIP hoặc mua chuyên mục này), hãy bấm nút "Cookie Zhihu" ở góc trên để dán Cookie tài khoản, hệ thống sẽ tự động tải trực tiếp từ Zhihu.`,
            `Cách 3: Sử dụng thanh tìm kiếm để tra cứu hơn 8.000+ truyện Muối Chọn VIP đã được mở khóa toàn văn sẵn trong kho dữ liệu.`
          ];

          const fullTextNotice = infoNotice.join('\n\n');

          return {
            id: crypto.createHash('md5').update(targetUrl).digest('hex'),
            title: secTitle !== colTitle ? `${secTitle} (${colTitle})` : colTitle,
            author: '知乎盐选专栏',
            date: 'VIP 盐选',
            tags: ['Zhihu 盐选 VIP', 'Chuyên Mục Trả Phí', isFree ? 'Chương Miễn Phí' : 'Cần VIP / Dán trực tiếp'],
            wordCount: 11000,
            unlocked: false,
            sourceUrl: targetUrl,
            sourceType: 'zhihu_paid_column',
            contentType: 'vip_story',
            paragraphs: infoNotice,
            fullText: fullTextNotice,
            sections: storySections,
            vipNotice: {
              isPaid: !isFree,
              chapterTitle: secTitle,
              columnTitle: colTitle,
              wordCountText: wordCountText || '1.1 万字',
              colId: columnId,
              sectionId: targetSectionId
            }
          };
        }
      } catch (colErr: any) {
        console.error('Paid column catalog error:', colErr.message);
      }
    }

    // Subcase 2E: Fallback - check if title or ID exists in the 8,000+ unlocked repository!
    try {
      const index = await getZhihuIndex();
      const idPart = targetUrl.match(/\/(?:p|answer|question|paid_column)\/(\d+)/)?.[1];
      if (idPart) {
        const found = index.find(e => e.url.includes(idPart) || e.snippet.includes(idPart));
        if (found) {
          return await getZhihuStoryDetail(found.url, customCookie);
        }
      }
    } catch {}

    // If still blocked by anti-bot 403 or missing cookie
    throw new Error(
      'Zhihu yêu cầu xác thực phiên truy cập cho liên kết này (anti-bot Zhihu). ' +
      'Bạn có thể: (1) Nhập Cookie Zhihu (kể cả tài khoản miễn phí) trong nút "Cookie Zhihu" ở góc phải; ' +
      'hoặc (2) Dùng tính năng "Nhập nội dung trực tiếp" để dán văn bản bài viết và xuất TXT/EPUB ngay lập tức; ' +
      'hoặc (3) Nhập từ khóa để tìm trong kho 8.000+ truyện VIP đã mở khóa sẵn.'
    );
  }

  throw new Error('Đường link không hợp lệ. Vui lòng nhập link Zhihu (câu trả lời, câu hỏi, bài viết, truyện 盐选) hoặc dán nội dung trực tiếp.');
}

/**
 * Generate TXT file content for a Zhihu Story
 */
export function generateZhihuTxt(story: Partial<ZhihuStoryDetail>): string {
  const tags = Array.isArray(story.tags) ? story.tags.join(', ') : '';
  const sections = Array.isArray(story.sections) ? story.sections : [];
  const paragraphs = Array.isArray(story.paragraphs)
    ? story.paragraphs
    : (story.fullText ? story.fullText.split('\n\n') : []);
  const wordCount = story.wordCount || (story.fullText ? story.fullText.length : 0);

  const header = `==================================================
Tựa đề: ${story.title || 'Zhihu'}
Tác giả / Nguồn: ${story.author || 'Zhihu'}
Thời gian: ${story.date || ''}
Tags: ${tags}
Số chữ: ${wordCount.toLocaleString()} ký tự
Trạng thái: ${story.unlocked ? 'Đã mở khóa toàn văn' : 'Toàn văn'}
Nguồn: ${story.sourceUrl || ''}
==================================================

`;

  let body = '';
  if (sections.length > 1) {
    body = sections
      .map(sec => `\n### ${sec.title || 'Phần'}\n\n${sec.content || ''}\n`)
      .join('\n--------------------------------------------------\n');
  } else if (paragraphs.length > 0) {
    body = paragraphs.map(p => `  ${p}`).join('\n\n');
  } else {
    body = story.fullText || '';
  }

  return header + body + '\n\n(Hết)';
}

/**
 * Generate EPUB buffer for a Zhihu Story
 */
export async function generateZhihuEpub(story: Partial<ZhihuStoryDetail>): Promise<Buffer> {
  const sections = Array.isArray(story.sections) && story.sections.length > 0
    ? story.sections
    : [{ title: story.title || 'Chương chính', content: story.fullText || '' }];

  const epubChapters = sections.map((sec, idx) => {
    const secParas = (sec.content || '').split('\n\n').filter(Boolean);
    const htmlParas = secParas.map(p => `<p>${cheerio.load('')(p).text()}</p>`).join('\n');
    return {
      title: sec.title || `Phần ${idx + 1}`,
      content: `<h1>${sec.title || `Phần ${idx + 1}`}</h1>\n${htmlParas}`
    };
  });

  const tags = Array.isArray(story.tags) ? story.tags.join(', ') : '';
  const wordCount = story.wordCount || (story.fullText ? story.fullText.length : 0);

  return generateEpub({
    title: story.title || 'Zhihu Story',
    author: story.author || 'Zhihu',
    description: `Nội dung Zhihu: ${story.title}. Tags: ${tags}. Số chữ: ${wordCount}`,
    chapters: epubChapters
  });
}
