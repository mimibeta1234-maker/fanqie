import { Book, SavedBook } from '../types';

const STORAGE_KEY = 'fanqie_saved_books_v1';

export function getSavedBooks(): SavedBook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to get saved books from localStorage:", err);
    return [];
  }
}

export function inferBookSource(bookId: string, source?: string): 'fanqie' | 'qimao' {
  if (source === 'qimao' || source === 'fanqie') {
    return source;
  }
  const cleanId = String(bookId || '').trim();
  // Fanqie IDs are 15-22 digits (commonly 19 digits)
  if (/^\d{15,22}$/.test(cleanId)) {
    return 'fanqie';
  }
  // Qimao IDs are shorter numbers (typically 5-10 digits) or contain alphanumeric ids
  return 'qimao';
}

export function saveBook(book: Book, source: 'fanqie' | 'qimao' = 'fanqie'): SavedBook[] {
  try {
    const current = getSavedBooks();
    const existingIdx = current.findIndex(b => b.book_id === book.book_id);
    
    const entry: SavedBook = {
      book_id: book.book_id,
      book_name: book.book_name,
      author: book.author,
      thumb_url: book.thumb_url,
      score: book.score,
      category: book.category,
      tags: book.tags,
      chapter_count: book.chapter_count,
      saved_at: Date.now(),
      source: source || inferBookSource(book.book_id)
    };

    let updated: SavedBook[];
    if (existingIdx !== -1) {
      // update
      updated = [...current];
      updated[existingIdx] = entry;
    } else {
      // prepend
      updated = [entry, ...current];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("Failed to save book:", err);
    return getSavedBooks();
  }
}

export function removeSavedBook(bookId: string): SavedBook[] {
  try {
    const current = getSavedBooks();
    const filtered = current.filter(b => b.book_id !== bookId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.warn("Failed to remove saved book:", err);
    return getSavedBooks();
  }
}

export function isBookSaved(bookId: string): boolean {
  if (!bookId) return false;
  const current = getSavedBooks();
  return current.some(b => b.book_id === bookId);
}
