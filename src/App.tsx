import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { SearchBar } from './components/SearchBar';
import { BookDetailCard } from './components/BookDetailCard';
import { DownloadPanel } from './components/DownloadPanel';
import { ChapterListModal } from './components/ChapterListModal';
import { ReaderModal } from './components/ReaderModal';
import { SearchResultsModal } from './components/SearchResultsModal';
import { Book, Catalog, Chapter, DownloadTaskStatus } from './types';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [downloadTask, setDownloadTask] = useState<DownloadTaskStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reader modal state
  const [readerState, setReaderState] = useState<{
    isOpen: boolean;
    itemId: string;
    title: string;
    content: string;
    loading: boolean;
    error?: string;
  }>({
    isOpen: false,
    itemId: '',
    title: '',
    content: '',
    loading: false
  });

  // Polling ref for download progress
  const pollIntervalRef = useRef<any>(null);

  // Load default sample book on startup
  useEffect(() => {
    handleLoadBook('7069948840148732967');
  }, []);

  // Poll active download task
  useEffect(() => {
    if (downloadTask?.status === 'downloading') {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/download/status?taskId=${downloadTask.taskId}`);
          const data = await res.json();
          if (data.success && data.task) {
            setDownloadTask(data.task);
            if (data.task.status === 'completed' || data.task.status === 'error' || data.task.status === 'cancelled') {
              clearInterval(pollIntervalRef.current);
            }
          }
        } catch (err) {
          console.warn("Poll status error:", err);
        }
      }, 800);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [downloadTask?.status, downloadTask?.taskId]);

  // Load a book by ID or link
  const handleLoadBook = async (queryOrId: string) => {
    setLoading(true);
    setErrorMessage(null);

    // Check if input looks like a search keyword rather than an ID/URL
    const isLikelyKeyword = !/^https?:\/\//i.test(queryOrId) && !/^\d{15,22}$/.test(queryOrId);

    if (isLikelyKeyword) {
      // Execute search
      try {
        setSearchQuery(queryOrId);
        const res = await fetch(`/api/search?q=${encodeURIComponent(queryOrId)}`);
        const data = await res.json();
        if (data.success && data.books && data.books.length > 0) {
          setSearchResults(data.books);
          setIsSearchOpen(true);
        } else {
          setErrorMessage(`Không tìm thấy truyện nào với từ khóa "${queryOrId}". Bạn hãy thử dán link hoặc ID truyện trực tiếp.`);
        }
      } catch (err: any) {
        setErrorMessage(`Lỗi tìm kiếm: ${err.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      // 1. Fetch Book Info
      const bookRes = await fetch(`/api/book/info?id=${encodeURIComponent(queryOrId)}`);
      const bookData = await bookRes.json();

      if (!bookData.success || !bookData.book) {
        throw new Error(bookData.error || "Không thể tải thông tin truyện");
      }

      setCurrentBook(bookData.book);

      // 2. Fetch Catalog
      const catRes = await fetch(`/api/book/catalog?id=${encodeURIComponent(bookData.book.book_id)}`);
      const catData = await catRes.json();

      if (catData.success && catData.catalog) {
        setCatalog(catData.catalog);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Có lỗi xảy ra khi tải truyện");
    } finally {
      setLoading(false);
    }
  };

  // Start download task
  const handleStartDownload = async (range?: { start: number; end: number }) => {
    if (!currentBook) return;
    setErrorMessage(null);

    try {
      const res = await fetch('/api/download/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: currentBook.book_id,
          range
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Không thể bắt đầu tải");
      }

      setDownloadTask({
        taskId: data.taskId,
        bookId: currentBook.book_id,
        bookInfo: currentBook,
        status: 'downloading',
        totalChapters: data.totalChapters,
        completedChapters: 0,
        failedChapters: 0,
        currentChapterTitle: 'Đang khởi tạo...',
        percent: 0,
        speed: '0 chap/s'
      });
    } catch (err: any) {
      setErrorMessage(`Lỗi bắt đầu tải: ${err.message}`);
    }
  };

  // Cancel download
  const handleCancelDownload = async () => {
    if (!downloadTask?.taskId) return;
    try {
      await fetch('/api/download/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: downloadTask.taskId })
      });
      setDownloadTask(prev => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (err) {
      console.warn("Cancel error:", err);
    }
  };

  // Preview / Read single chapter (even if locked on web!)
  const handlePreviewChapter = async (chapter: Chapter) => {
    setReaderState({
      isOpen: true,
      itemId: chapter.item_id,
      title: chapter.title,
      content: '',
      loading: true
    });

    try {
      const res = await fetch('/api/chapter/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: chapter.item_id })
      });
      const data = await res.json();
      if (!data.success || !data.chapter) {
        throw new Error(data.error || "Không thể giải mã chương");
      }

      setReaderState(prev => ({
        ...prev,
        content: data.chapter.content,
        title: data.chapter.title || chapter.title,
        loading: false
      }));
    } catch (err: any) {
      setReaderState(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Lỗi khi đọc chương"
      }));
    }
  };

  const totalChapters = catalog?.chapter_list?.length || currentBook?.chapter_count || 0;

  return (
    <div className="min-h-screen bg-[#faf9f6] text-stone-900 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-4">
        {/* Search Bar */}
        <SearchBar onSearchOrFetch={handleLoadBook} loading={loading} />

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Book Details & Download Panel */}
        {currentBook && (
          <div className="space-y-4">
            <BookDetailCard
              book={currentBook}
              totalChapters={totalChapters}
              onOpenCatalog={() => setIsCatalogOpen(true)}
            />

            <DownloadPanel
              task={downloadTask}
              totalChapters={totalChapters}
              onStartDownload={handleStartDownload}
              onCancelDownload={handleCancelDownload}
              bookName={currentBook.book_name}
            />
          </div>
        )}
      </main>

      {/* Catalog Modal */}
      <ChapterListModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        chapters={catalog?.chapter_list || []}
        bookTitle={currentBook?.book_name || ""}
        onPreviewChapter={handlePreviewChapter}
      />

      {/* Search Results Modal */}
      <SearchResultsModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        results={searchResults}
        onSelectBook={handleLoadBook}
        query={searchQuery}
      />

      {/* Chapter Reader Modal */}
      <ReaderModal
        isOpen={readerState.isOpen}
        onClose={() => setReaderState(prev => ({ ...prev, isOpen: false }))}
        title={readerState.title}
        content={readerState.content}
        itemId={readerState.itemId}
        loading={readerState.loading}
        error={readerState.error}
      />
    </div>
  );
}
