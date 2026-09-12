export interface Book {
  book_id: string;
  book_name: string;
  author: string;
  thumb_url: string;
  score: string;
  category: string;
  tags?: string;
  abstract: string;
  word_number: string;
  chapter_count: number;
  last_chapter_title: string;
  creation_status: string;
}

export interface Chapter {
  item_id: string;
  title: string;
  volume_title: string;
  update_time: string;
  char_count: number;
}

export interface Catalog {
  book_id: string;
  chapter_list: Chapter[];
  volume_list: { title: string; chapter_list: Chapter[] }[];
  all_item_ids: string[];
}

export interface DownloadTaskStatus {
  taskId: string;
  bookId: string;
  bookInfo: Book;
  status: 'idle' | 'downloading' | 'completed' | 'paused' | 'cancelled' | 'error';
  totalChapters: number;
  completedChapters: number;
  failedChapters: number;
  currentChapterTitle: string;
  percent: number;
  speed: string;
  errorMessage?: string;
}

export interface SavedBook {
  book_id: string;
  book_name: string;
  author: string;
  thumb_url: string;
  score?: string;
  category?: string;
  tags?: string;
  chapter_count?: number;
  saved_at: number;
}

export interface PlotMatch {
  itemId: string;
  chapterIndex: number;
  title: string;
  snippet: string;
  matchCount?: number;
}
