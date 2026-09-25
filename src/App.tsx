import React, { useState, useEffect, useRef } from 'react';
import { Navbar, StudioTab } from './components/Navbar';
import { SearchBar } from './components/SearchBar';
import { BookDetailCard } from './components/BookDetailCard';
import { DownloadPanel } from './components/DownloadPanel';
import { ChapterListModal } from './components/ChapterListModal';
import { ReaderModal } from './components/ReaderModal';
import { SearchResultsModal } from './components/SearchResultsModal';
import { SavedBooksModal } from './components/SavedBooksModal';
import { PlotSearchModal } from './components/PlotSearchModal';
import { CompareView } from './components/CompareView';
import { QimaoView } from './components/QimaoView';
import { Book, Catalog, Chapter, DownloadTaskStatus, SavedBook } from './types';
import { getSavedBooks, saveBook, removeSavedBook, isBookSaved } from './utils/savedBooks';
import { ChapterBookmark, getBookmarks, toggleChapterBookmark } from './utils/chapterBookmarks';
import { isUserAuthenticated, clearAuthentication } from './utils/auth';
import { PasswordGate } from './components/PasswordGate';
import { HdCoverModal } from './components/HdCoverModal';
import { ChapterTitlesModal } from './components/ChapterTitlesModal';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  // Authentication gate
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isUserAuthenticated());

  // Studio navigation tab: 'downloader' | 'qimao' | 'compare'
  const [activeTab, setActiveTab] = useState<StudioTab>(() => {
    try {
      const saved = localStorage.getItem('fanqie_active_tab') as StudioTab;
      if (saved && ['downloader', 'qimao', 'compare'].includes(saved)) {
        return saved;
      }
    } catch (e) {}
    return 'downloader';
  });

  useEffect(() => {
    try {
      localStorage.setItem('fanqie_active_tab', activeTab);
    } catch (e) {}
  }, [activeTab]);

  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [downloadTask, setDownloadTask] = useState<DownloadTaskStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Saved books state
  const [savedBooks, setSavedBooks] = useState<SavedBook[]>(() => getSavedBooks());
  const [isSavedBooksOpen, setIsSavedBooksOpen] = useState<boolean>(false);
  const [qimaoTargetBookId, setQimaoTargetBookId] = useState<string | null>(null);

  // Chapter bookmarks state
  const [bookmarkedChapters, setBookmarkedChapters] = useState<ChapterBookmark[]>([]);
  const [catalogInitialMarkedFilter, setCatalogInitialMarkedFilter] = useState<boolean>(false);

  // Plot search state
  const [isPlotSearchOpen, setIsPlotSearchOpen] = useState<boolean>(false);

  // Chapter Titles modal state
  const [isChapterTitlesOpen, setIsChapterTitlesOpen] = useState<boolean>(false);

  // Modals state
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isGlobalHdCoverOpen, setIsGlobalHdCoverOpen] = useState<boolean>(false);

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


  // Update bookmarked chapters when currentBook changes
  useEffect(() => {
    if (currentBook?.book_id) {
      setBookmarkedChapters(getBookmarks(currentBook.book_id));
    } else {
      setBookmarkedChapters([]);
    }
  }, [currentBook?.book_id]);

  // Set of marked item ids for fast lookup
  const markedItemIds = React.useMemo(() => {
    return new Set(bookmarkedChapters.map(b => b.itemId));
  }, [bookmarkedChapters]);

  // Toggle bookmark for a chapter
  const handleToggleMarkChapter = (chapter: Chapter, chapterIndex: number) => {
    if (!currentBook) return;
    const { list } = toggleChapterBookmark(currentBook.book_id, chapter, chapterIndex);
    setBookmarkedChapters(list);
  };

  // Toggle bookmark directly from reader modal
  const handleToggleMarkFromReader = () => {
    if (!currentBook || !readerState.itemId) return;
    const idx = catalog?.chapter_list?.findIndex(c => c.item_id === readerState.itemId) ?? -1;
    const chapter = (idx !== -1 && catalog?.chapter_list?.[idx]) || {
      item_id: readerState.itemId,
      title: readerState.title,
      volume_title: '',
      char_count: 0,
      update_time: ''
    };
    const { list } = toggleChapterBookmark(currentBook.book_id, chapter, idx !== -1 ? idx + 1 : 1);
    setBookmarkedChapters(list);
  };

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
    const trimmedInput = String(queryOrId || '').trim();
    if (!trimmedInput) return;

    setLoading(true);
    setErrorMessage(null);

    // Extract 15-22 digit book ID if present
    const idMatch = trimmedInput.match(/\b(\d{15,22})\b/);
    const extractedBookId = idMatch ? idMatch[1] : '';
    const isUrlOrLink = /fanqie|fqnovel|dragon|read|page\/|reader\/|book_?id=|https?:\/\//i.test(trimmedInput);

    // If it's purely text with no book ID and no link pattern, do keyword search
    if (!extractedBookId && !isUrlOrLink) {
      try {
        setSearchQuery(trimmedInput);
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmedInput)}`);
        const data = await res.json();
        if (data.success && data.books && data.books.length > 0) {
          setSearchResults(data.books);
          setIsSearchOpen(true);
        } else {
          setErrorMessage(`Không tìm thấy truyện nào với từ khóa "${trimmedInput}". Bạn hãy thử dán link hoặc ID truyện trực tiếp.`);
        }
      } catch (err: any) {
        setErrorMessage(`Lỗi tìm kiếm: ${err.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Try loading book info and catalog directly by ID/link
    const targetQuery = extractedBookId || trimmedInput;
    try {
      // 1. Fetch Book Info
      const bookRes = await fetch(`/api/book/info?id=${encodeURIComponent(targetQuery)}`);
      const bookData = await bookRes.json();

      if (!bookData.success || !bookData.book) {
        // If direct load failed and input wasn't pure digits, try search as fallback
        if (!/^\d+$/.test(targetQuery)) {
          const searchRes = await fetch(`/api/search?q=${encodeURIComponent(trimmedInput)}`);
          const searchData = await searchRes.json();
          if (searchData.success && searchData.books && searchData.books.length > 0) {
            setSearchResults(searchData.books);
            setIsSearchOpen(true);
            return;
          }
        }
        throw new Error(bookData.error || "Không thể tải thông tin truyện");
      }

      let bookObj = bookData.book;
      setCurrentBook(bookObj);

      // 2. Fetch Catalog
      const catRes = await fetch(`/api/book/catalog?id=${encodeURIComponent(bookObj.book_id)}`);
      const catData = await catRes.json();

      if (catData.success && catData.catalog) {
        setCatalog(catData.catalog);
        const chapterCount = catData.catalog.chapter_list?.length || 0;
        if (chapterCount > 0) {
          if (!bookObj.chapter_count || bookObj.chapter_count === 0) {
            bookObj = { ...bookObj, chapter_count: chapterCount };
            setCurrentBook(bookObj);
          }
        }
      } else if (catData.error) {
        setErrorMessage(`Đã tìm thấy truyện nhưng lỗi khi lấy danh sách chương: ${catData.error}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Có lỗi xảy ra khi tải truyện");
    } finally {
      setLoading(false);
    }
  };

  // Start download task
  const handleStartDownload = async (
    rangeOrRanges?: { start: number; end: number } | { start: number; end: number; label?: string }[],
    includeIntro: boolean = true
  ) => {
    if (!currentBook) return;
    setErrorMessage(null);

    const isArray = Array.isArray(rangeOrRanges);
    const payload: any = {
      bookId: currentBook.book_id,
      includeIntro
    };
    if (isArray) {
      payload.ranges = rangeOrRanges;
    } else if (rangeOrRanges) {
      payload.range = rangeOrRanges;
    }

    try {
      const res = await fetch('/api/download/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
        speed: '0 chap/s',
        ranges: data.ranges
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

  // Saved books management
  const isCurrentBookSaved = currentBook ? isBookSaved(currentBook.book_id) : false;

  const handleToggleSaveBook = () => {
    if (!currentBook) return;
    if (isCurrentBookSaved) {
      const updated = removeSavedBook(currentBook.book_id);
      setSavedBooks(updated);
    } else {
      const updated = saveBook(currentBook, 'fanqie');
      setSavedBooks(updated);
    }
  };

  const handleRemoveSavedBook = (id: string) => {
    const updated = removeSavedBook(id);
    setSavedBooks(updated);
  };

  const handleSelectSavedBook = async (bookId: string, source: 'fanqie' | 'qimao') => {
    if (source === 'qimao') {
      setActiveTab('qimao');
      setQimaoTargetBookId(bookId);
    } else {
      setActiveTab('downloader');
      await handleLoadBook(bookId);
    }
  };

  // If not authenticated, require password gate
  if (!isAuthenticated) {
    return <PasswordGate onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] text-stone-900 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSavedBooks={() => setIsSavedBooksOpen(true)}
        savedCount={savedBooks.length}
        onLogout={() => {
          clearAuthentication();
          setIsAuthenticated(false);
        }}
        onOpenHdCoverModal={() => setIsGlobalHdCoverOpen(true)}
        onOpenChapterTitlesModal={() => setIsChapterTitlesOpen(true)}
      />

      <main className={`flex-1 w-full mx-auto px-4 py-6 ${activeTab === 'compare' ? 'max-w-5xl' : 'max-w-2xl space-y-4'}`}>
        {activeTab === 'downloader' ? (
          <>
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
                  onOpenCatalog={() => {
                    setCatalogInitialMarkedFilter(false);
                    setIsCatalogOpen(true);
                  }}
                  onOpenPlotSearch={() => setIsPlotSearchOpen(true)}
                  onOpenChapterTitles={() => setIsChapterTitlesOpen(true)}
                  isSaved={isCurrentBookSaved}
                  onToggleSave={handleToggleSaveBook}
                  markedChaptersCount={bookmarkedChapters.length}
                  onOpenMarkedChapters={() => {
                    setCatalogInitialMarkedFilter(true);
                    setIsCatalogOpen(true);
                  }}
                />

                <DownloadPanel
                  task={downloadTask}
                  totalChapters={totalChapters}
                  onStartDownload={handleStartDownload}
                  onCancelDownload={handleCancelDownload}
                  bookName={currentBook.book_name}
                  abstract={currentBook.abstract}
                  catalog={catalog}
                  onResetTask={() => setDownloadTask(null)}
                />
              </div>
            )}
          </>
        ) : activeTab === 'qimao' ? (
          /* Qimao Downloader View */
          <QimaoView
            initialBookId={qimaoTargetBookId}
            onClearInitialBookId={() => setQimaoTargetBookId(null)}
            onSavedBooksUpdate={() => setSavedBooks(getSavedBooks())}
          />
        ) : (
          /* Compare Tool View */
          <CompareView />
        )}
      </main>

      {/* Catalog Modal */}
      <ChapterListModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        chapters={catalog?.chapter_list || []}
        bookTitle={currentBook?.book_name || ""}
        onPreviewChapter={handlePreviewChapter}
        onOpenPlotSearch={() => setIsPlotSearchOpen(true)}
        onOpenChapterTitles={() => setIsChapterTitlesOpen(true)}
        markedItemIds={markedItemIds}
        onToggleMarkChapter={handleToggleMarkChapter}
        initialShowMarkedOnly={catalogInitialMarkedFilter}
      />

      {/* Plot Search Modal */}
      <PlotSearchModal
        isOpen={isPlotSearchOpen}
        onClose={() => setIsPlotSearchOpen(false)}
        bookId={currentBook?.book_id || ""}
        bookTitle={currentBook?.book_name || ""}
        chapters={catalog?.chapter_list || []}
        onPreviewChapter={handlePreviewChapter}
      />

      {/* Saved Books Modal */}
      <SavedBooksModal
        isOpen={isSavedBooksOpen}
        onClose={() => setIsSavedBooksOpen(false)}
        savedBooks={savedBooks}
        onSelectBook={handleSelectSavedBook}
        onRemoveBook={handleRemoveSavedBook}
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
        isMarked={markedItemIds.has(readerState.itemId)}
        onToggleMark={handleToggleMarkFromReader}
      />

      {/* Standalone HD Cover Extractor Modal */}
      <HdCoverModal
        isOpen={isGlobalHdCoverOpen}
        onClose={() => setIsGlobalHdCoverOpen(false)}
        initialCoverUrl={currentBook?.thumb_url}
        initialBookName={currentBook?.book_name}
        initialAuthor={currentBook?.author}
      />

      {/* Chapter Titles Extraction Modal */}
      <ChapterTitlesModal
        isOpen={isChapterTitlesOpen}
        onClose={() => setIsChapterTitlesOpen(false)}
        initialBookId={currentBook?.book_id}
        initialBookTitle={currentBook?.book_name}
        initialChapters={catalog?.chapter_list || []}
        source="fanqie"
      />
    </div>
  );
}
