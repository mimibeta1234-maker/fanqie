export interface ChapterBookmark {
  bookId: string;
  itemId: string;
  chapterIndex: number;
  title: string;
  markedAt: number;
}

const STORAGE_KEY = 'fanqie_chapter_bookmarks_v1';

function getAllStoredBookmarks(): Record<string, ChapterBookmark[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    console.warn("Failed to parse chapter bookmarks:", e);
    return {};
  }
}

function saveAllStoredBookmarks(data: Record<string, ChapterBookmark[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to persist chapter bookmarks:", e);
  }
}

export function getBookmarks(bookId: string): ChapterBookmark[] {
  if (!bookId) return [];
  const all = getAllStoredBookmarks();
  return all[bookId] || [];
}

export function isChapterMarked(bookId: string, itemId: string): boolean {
  if (!bookId || !itemId) return false;
  const list = getBookmarks(bookId);
  return list.some(b => b.itemId === itemId);
}

export function toggleChapterBookmark(
  bookId: string,
  chapter: { item_id: string; title: string },
  chapterIndex: number
): { list: ChapterBookmark[]; isMarked: boolean } {
  if (!bookId || !chapter.item_id) return { list: [], isMarked: false };
  const all = getAllStoredBookmarks();
  const current = all[bookId] || [];

  const existingIdx = current.findIndex(b => b.itemId === chapter.item_id);
  let updated: ChapterBookmark[];
  let isMarked = false;

  if (existingIdx !== -1) {
    // Unmark
    updated = current.filter(b => b.itemId !== chapter.item_id);
    isMarked = false;
  } else {
    // Mark
    const newEntry: ChapterBookmark = {
      bookId,
      itemId: chapter.item_id,
      chapterIndex,
      title: chapter.title,
      markedAt: Date.now()
    };
    // Sort by chapterIndex
    updated = [...current, newEntry].sort((a, b) => a.chapterIndex - b.chapterIndex);
    isMarked = true;
  }

  all[bookId] = updated;
  saveAllStoredBookmarks(all);
  return { list: updated, isMarked };
}
