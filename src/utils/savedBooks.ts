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

export function saveBook(book: Book): SavedBook[] {
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
      saved_at: Date.now()
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
