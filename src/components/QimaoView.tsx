import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  Download, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Bookmark, 
  BookmarkCheck, 
  FileText, 
  BookMarked,
  Eye,
  X,
  FileCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Book, Catalog, DownloadTaskStatus } from '../types';
import { saveBook, removeSavedBook, isBookSaved } from '../utils/savedBooks';
import { getAbstractParagraphs } from '../utils/textFormatter';
import { ChapterListModal } from './ChapterListModal';
import { ReaderModal } from './ReaderModal';
import { SearchResultsModal } from './SearchResultsModal';
import { ChapterTitlesModal } from './ChapterTitlesModal';

const SUGGESTED_NOVELS = [
  { name: 'Kiếm Lai (剑来)', id: '672340' },
  { name: 'Nghịch Thiên Tà Thần (逆天邪神)', id: '408586' },
  { name: 'Tuyết Trung Hãn Đao Hành (雪中悍刀行)', id: '189169' },
  { name: 'Vạn Tướng Chi Vương (万相之王)', id: '1152063' },
  { name: 'Tiên Nghịch (仙逆)', id: '47007' },
];

function parseQimaoBookId(input: string): string {
  const trimmed = String(input || '').trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/(?:detail|showchapter|book|shuku|chapter)\/(\d+)/i) ||
                trimmed.match(/[?&](?:bookId|book_id|id)=(\d+)/i) ||
                trimmed.match(/(\d+)(?:\.html)?$/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export interface QimaoViewProps {
  initialBookId?: string | null;
  onClearInitialBookId?: () => void;
  onSavedBooksUpdate?: () => void;
}

export const QimaoView: React.FC<QimaoViewProps> = ({
  initialBookId,
  onClearInitialBookId,
  onSavedBooksUpdate
}) => {
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [downloadTask, setDownloadTask] = useState<DownloadTaskStatus | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showFullAbstract, setShowFullAbstract] = useState(false);

  // Range & Format settings (similar to Fanqie DownloadPanel)
  const [downloadMode, setDownloadMode] = useState<'all' | 'range'>('all');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(1);
  const [exportFormat, setExportFormat] = useState<'txt' | 'epub'>('txt');
  const [includeIntro, setIncludeIntro] = useState<boolean>(true);
  const [showIntroPreview, setShowIntroPreview] = useState<boolean>(false);

  // Modals
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isChapterTitlesOpen, setIsChapterTitlesOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Reader state
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

  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (currentBook?.book_id) {
      setIsSaved(isBookSaved(currentBook.book_id));
    }
  }, [currentBook?.book_id]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Handle initialBookId when opened from SavedBooksModal or navigation
  useEffect(() => {
    if (initialBookId) {
      setInputVal(initialBookId);
      handleFetchBook(initialBookId);
      onClearInitialBookId?.();
    }
  }, [initialBookId]);

  const handleToggleSave = () => {
    if (!currentBook) return;
    if (isSaved) {
      removeSavedBook(currentBook.book_id);
      setIsSaved(false);
      onSavedBooksUpdate?.();
    } else {
      saveBook(currentBook, 'qimao');
      setIsSaved(true);
      onSavedBooksUpdate?.();
    }
  };

  const handleFetchBook = async (queryInput?: string) => {
    const raw = String(queryInput ?? inputVal ?? '').trim();
    if (!raw) {
      setErrorMessage('Vui lòng dán link, ID truyện hoặc nhập tên truyện');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const extractedQimaoId = parseQimaoBookId(raw);
    const isIdOrUrl = /^\d+$/.test(raw) || /^\d+$/.test(extractedQimaoId) || /zongheng|qimao|wtzw|detail|shuku|showchapter|book/i.test(raw);

    if (isIdOrUrl) {
      try {
        const res = await fetch(`/api/qimao/book/info?id=${encodeURIComponent(raw)}`);
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Không tìm thấy truyện');
        }

        const book = data.book;
        setCurrentBook(book);
        setIsSaved(isBookSaved(book.book_id));

        // Fetch catalog
        const catRes = await fetch(`/api/qimao/book/catalog?id=${encodeURIComponent(book.book_id)}`);
        const catData = await catRes.json();
        if (catData.success && catData.catalog) {
          const fetchedCatalog: Catalog = {
            book_id: book.book_id,
            chapter_list: catData.catalog.chapter_list.map((c: any) => ({
              item_id: c.item_id,
              title: c.title,
              volume_title: c.volume_title || '',
              update_time: '',
              char_count: 0
            })),
            volume_list: [],
            all_item_ids: catData.catalog.chapter_list.map((c: any) => c.item_id)
          };
          setCatalog(fetchedCatalog);
          const totalChaps = fetchedCatalog.chapter_list.length;
          setRangeStart(1);
          setRangeEnd(totalChaps || 1);
          if (totalChaps > 0) {
            setCurrentBook(prev => prev ? { ...prev, chapter_count: totalChaps } : { ...book, chapter_count: totalChaps });
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi khi tải thông tin truyện');
      } finally {
        setLoading(false);
      }
    } else {
      // Keyword search
      try {
        setSearchQuery(raw);
        const res = await fetch(`/api/qimao/search?q=${encodeURIComponent(raw)}`);
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Lỗi tìm kiếm');
        }

        if (!data.books || data.books.length === 0) {
          setErrorMessage(`Không tìm thấy truyện phù hợp với từ khóa "${raw}"`);
        } else if (data.books.length === 1) {
          handleSelectBook(data.books[0]);
        } else {
          setSearchResults(data.books);
          setIsSearchOpen(true);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi khi tìm kiếm truyện');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSelectBook = async (bookOrId: Book | string) => {
    setIsSearchOpen(false);
    const bookId = typeof bookOrId === 'string' ? bookOrId : (bookOrId?.book_id || '');
    if (!bookId) return;
    setInputVal(bookId);
    await handleFetchBook(bookId);
  };

  const handleOpenReader = async (itemId: string, title: string, index?: number) => {
    const formattedTitle = title || (index ? `第${index}章` : '');
    setReaderState({
      isOpen: true,
      itemId,
      title: formattedTitle,
      content: '',
      loading: true
    });

    try {
      const res = await fetch('/api/qimao/chapter/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: currentBook?.book_id,
          bookName: currentBook?.book_name,
          itemId,
          title,
          chapterIndex: index
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Không tải được nội dung');

      setReaderState(prev => ({
        ...prev,
        title: data.chapter?.title || formattedTitle,
        content: data.chapter?.content || '',
        loading: false
      }));
    } catch (err: any) {
      setReaderState(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Lỗi đọc chương'
      }));
    }
  };

  const handleStartDownload = async () => {
    if (!currentBook || !catalog) return;

    const totalChaps = catalog.chapter_list.length || currentBook.chapter_count || 1;
    const range = downloadMode === 'all' 
      ? { start: 1, end: totalChaps }
      : { 
          start: Math.max(1, Math.min(rangeStart, totalChaps)),
          end: Math.max(rangeStart, Math.min(rangeEnd, totalChaps))
        };

    try {
      const res = await fetch('/api/qimao/download/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: currentBook.book_id,
          range,
          includeIntro,
          exportFormat
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Không thể bắt đầu tải');
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

      // Start polling
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/download/status?taskId=${data.taskId}`);
          const pollData = await pollRes.json();
          if (pollData.success && pollData.task) {
            setDownloadTask(pollData.task);
            if (pollData.task.status === 'completed' || pollData.task.status === 'error' || pollData.task.status === 'cancelled') {
              clearInterval(pollIntervalRef.current);
            }
          }
        } catch (pollErr) {
          console.error("Poll error:", pollErr);
        }
      }, 1000);

    } catch (err: any) {
      setErrorMessage(`Lỗi bắt đầu tải: ${err.message}`);
    }
  };

  const handleCancelDownload = async () => {
    if (!downloadTask?.taskId) return;
    try {
      await fetch('/api/download/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: downloadTask.taskId })
      });
      setDownloadTask(prev => prev ? { ...prev, status: 'cancelled' } : null);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    } catch (err) {
      console.warn("Cancel error:", err);
    }
  };

  const totalChapters = catalog?.chapter_list?.length || currentBook?.chapter_count || 0;
  const isDownloading = downloadTask?.status === 'downloading';

  return (
    <div className="space-y-4" id="qimao-view-container">
      {/* Search Bar - Exactly like Fanqie SearchBar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs" id="qimao-search-section">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleFetchBook();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
              <Search className="w-4 h-4" />
            </div>

            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Dán link Qimao/Zongheng, ID truyện (VD: 672340), hoặc tên truyện..."
              disabled={loading}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all text-stone-800 disabled:opacity-70"
              id="input-qimao-query"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !inputVal.trim()}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            id="btn-submit-qimao-search"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang tải...</span>
              </>
            ) : (
              <span>Tìm / Tải</span>
            )}
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-stone-100 mt-3">
          <span className="text-xs text-stone-400 font-medium">Gợi ý:</span>
          {SUGGESTED_NOVELS.map((novel) => (
            <button
              key={novel.id}
              type="button"
              onClick={() => {
                setInputVal(novel.id);
                handleFetchBook(novel.id);
              }}
              className="px-2 py-0.5 text-xs bg-stone-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 text-stone-600 rounded border border-stone-200 transition-colors cursor-pointer"
            >
              {novel.name.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 font-bold px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Book Detail & Download Section - Exactly like Fanqie */}
      {currentBook && (
        <div className="space-y-4">
          {/* Book Detail Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-xs" id="qimao-book-detail-card">
            <div className="flex gap-4 sm:gap-5 items-start">
              {/* Cover */}
              <div className="w-20 sm:w-24 h-28 sm:h-32 shrink-0 bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
                {currentBook.thumb_url ? (
                  <img
                    src={currentBook.thumb_url}
                    alt={currentBook.book_name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <BookOpen className="w-6 h-6" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 truncate">
                    {currentBook.book_name}
                  </h2>
                  {currentBook.creation_status && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      {currentBook.creation_status}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-stone-500">
                  <span className="text-stone-700 font-medium">Tác giả: {currentBook.author || 'Đang cập nhật'}</span>
                  <span>•</span>
                  <span>{totalChapters} chương</span>
                  {currentBook.category && (
                    <>
                      <span>•</span>
                      <span className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
                        {currentBook.category}
                      </span>
                    </>
                  )}
                  {currentBook.word_number && (
                    <>
                      <span>•</span>
                      <span>{currentBook.word_number}</span>
                    </>
                  )}
                </div>

                {/* Abstract */}
                {currentBook.abstract && (() => {
                  const paragraphs = getAbstractParagraphs(currentBook.abstract);
                  const isLong = paragraphs.length > 2 || currentBook.abstract.length > 90;
                  return (
                    <div className="mt-2.5 bg-stone-50/70 p-2.5 rounded-lg border border-stone-200/70">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wide">
                          Giới thiệu
                        </span>
                        {isLong && (
                          <button
                            type="button"
                            onClick={() => setShowFullAbstract(!showFullAbstract)}
                            className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                          >
                            {showFullAbstract ? 'Thu gọn' : 'Xem đầy đủ'}
                          </button>
                        )}
                      </div>
                      <div className={`text-xs text-stone-700 leading-relaxed ${showFullAbstract ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
                        {showFullAbstract ? (
                          <div className="space-y-2">
                            {paragraphs.map((p, idx) => (
                              <p key={idx} className="indent-3 text-justify">{p}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="line-clamp-2 text-stone-600">
                            {paragraphs[0] || currentBook.abstract}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 mt-3.5 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsCatalogOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                    id="btn-open-qimao-catalog"
                  >
                    <Layers className="w-3.5 h-3.5 text-stone-500" />
                    <span>Mục lục ({totalChapters})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsChapterTitlesOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-colors cursor-pointer"
                    id="btn-open-qimao-chapter-titles"
                    title="Trích xuất danh sách tiêu đề chương tuần tự"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    <span>Trích xuất tiêu đề</span>
                  </button>

                  {catalog && catalog.chapter_list.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenReader(catalog.chapter_list[0].item_id, catalog.chapter_list[0].title, 1)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-colors cursor-pointer"
                      id="btn-read-first-qimao-chap"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-600" />
                      <span>Đọc thử ch.1</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleSave}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ml-auto ${
                      isSaved
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-stone-200 hover:bg-stone-50 text-stone-600'
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                        <span>Đã lưu</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5 text-stone-400" />
                        <span>Lưu truyện</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Download Panel - Exactly like Fanqie DownloadPanel */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-xs" id="qimao-download-panel">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-600" />
                <span>Tải truyện về máy</span>
              </h3>
              {isDownloading && (
                <span className="text-xs text-stone-500 font-mono">
                  {downloadTask?.speed || "Đang tải..."}
                </span>
              )}
            </div>

            {/* Mode & Config (Hidden during downloading) */}
            {!isDownloading && (
              <div className="mt-4 space-y-3">
                {/* Mode Selector */}
                <div className="flex bg-stone-100 p-1 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setDownloadMode('all')}
                    className={`flex-1 py-1.5 rounded-md transition-colors text-center cursor-pointer ${
                      downloadMode === 'all'
                        ? 'bg-white text-stone-900 shadow-xs font-semibold'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Tải trọn bộ ({totalChapters} chương)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDownloadMode('range')}
                    className={`flex-1 py-1.5 rounded-md transition-colors text-center cursor-pointer ${
                      downloadMode === 'range'
                        ? 'bg-white text-stone-900 shadow-xs font-semibold'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Tùy chọn phạm vi
                  </button>
                </div>

                {/* Range inputs if range mode */}
                {downloadMode === 'range' && (
                  <div className="flex items-center justify-between gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs">
                    <span className="text-stone-600 font-medium">Phạm vi chương:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={totalChapters || 1}
                        value={rangeStart}
                        onChange={(e) => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-1 text-center bg-white border border-stone-300 rounded font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <span className="text-stone-400 font-bold">→</span>
                      <input
                        type="number"
                        min={rangeStart}
                        max={totalChapters || 1}
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(Math.min(totalChapters || 1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-1 text-center bg-white border border-stone-300 rounded font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* Include Intro / Abstract Option */}
                <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200/80 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 font-medium text-stone-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeIntro}
                        onChange={e => setIncludeIntro(e.target.checked)}
                        className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                        Kèm phần Giới thiệu ở đầu file
                      </span>
                    </label>
                    {currentBook?.abstract && (() => {
                      const paragraphs = getAbstractParagraphs(currentBook.abstract);
                      if (paragraphs.length === 0) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => setShowIntroPreview(!showIntroPreview)}
                          className="text-[11px] text-stone-500 hover:text-amber-700 font-medium flex items-center gap-0.5 cursor-pointer ml-2 shrink-0"
                        >
                          <span>{showIntroPreview ? "Ẩn giới thiệu" : "Xem giới thiệu"}</span>
                          {showIntroPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      );
                    })()}
                  </div>

                  {includeIntro && downloadMode === 'range' && (
                    <p className="text-[11px] text-stone-500 mt-1 pl-6">
                      ℹ️ Phần giới thiệu sẽ được chèn trước Chương {rangeStart} (định dạng rõ ràng, không dính dòng).
                    </p>
                  )}

                  {/* Expandable Preview */}
                  {showIntroPreview && currentBook?.abstract && (() => {
                    const paragraphs = getAbstractParagraphs(currentBook.abstract);
                    if (paragraphs.length === 0) return null;
                    return (
                      <div className="mt-2.5 pt-2 border-t border-stone-200/60 max-h-48 overflow-y-auto space-y-1.5 pr-1 text-[11px] text-stone-600">
                        {paragraphs.map((para, idx) => (
                          <p key={idx} className="indent-2 text-justify">{para}</p>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Format selection */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-stone-600 font-medium">Định dạng file:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setExportFormat('txt')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-semibold ${
                        exportFormat === 'txt'
                          ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      <span>TXT (Gộp 1 file)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('epub')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-semibold ${
                        exportFormat === 'epub'
                          ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <BookMarked className="w-3.5 h-3.5 text-amber-600" />
                      <span>EPUB</span>
                    </button>
                  </div>
                </div>

                {/* Start Download Button */}
                <button
                  type="button"
                  onClick={handleStartDownload}
                  className="w-full mt-2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  id="btn-start-qimao-download"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Bắt đầu tải {downloadMode === 'all' ? `${totalChapters} chương` : `${rangeEnd - rangeStart + 1} chương`}
                  </span>
                </button>
              </div>
            )}

            {/* Progress / Status during or after download */}
            {downloadTask && (
              <div className="mt-4 p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    {isDownloading && <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
                    {downloadTask.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
                    <span className="text-stone-800">
                      {isDownloading && (downloadTask.currentChapterTitle || 'Đang tải chương...')}
                      {downloadTask.status === 'completed' && 'Tải hoàn tất 100%!'}
                      {downloadTask.status === 'cancelled' && 'Đã hủy tải'}
                      {downloadTask.status === 'error' && 'Lỗi trong quá trình tải'}
                    </span>
                  </div>
                  <span className="text-amber-700 font-bold">{downloadTask.percent}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-600 transition-all duration-200"
                    style={{ width: `${downloadTask.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>
                    Tiến độ: <strong className="text-stone-800">{downloadTask.completedChapters}</strong> / {downloadTask.totalChapters} chương
                  </span>
                  {downloadTask.speed && <span>{downloadTask.speed}</span>}
                </div>

                {/* Actions: Cancel or Export */}
                <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                  {isDownloading ? (
                    <button
                      type="button"
                      onClick={handleCancelDownload}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                    >
                      Hủy tải
                    </button>
                  ) : downloadTask.status === 'completed' ? (
                    <div className="flex items-center gap-2 w-full">
                      <a
                        href={`/api/download/export?taskId=${downloadTask.taskId}&format=txt`}
                        download
                        className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Lưu file TXT</span>
                      </a>
                      <a
                        href={`/api/download/export?taskId=${downloadTask.taskId}&format=epub`}
                        download
                        className="flex-1 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <BookMarked className="w-3.5 h-3.5" />
                        <span>Lưu file EPUB</span>
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chapter List Modal */}
      {catalog && (
        <ChapterListModal
          isOpen={isCatalogOpen}
          onClose={() => setIsCatalogOpen(false)}
          chapters={catalog.chapter_list}
          bookTitle={currentBook?.book_name || ""}
          source="qimao"
          onOpenChapterTitles={() => setIsChapterTitlesOpen(true)}
          onPreviewChapter={(ch, idx) => {
            setIsCatalogOpen(false);
            handleOpenReader(ch.item_id, ch.title, idx || (ch as any).originalIndex);
          }}
          onFetchChapterContent={async (ch, idx) => {
            const res = await fetch('/api/qimao/chapter/preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookId: currentBook?.book_id,
                bookName: currentBook?.book_name,
                author: currentBook?.author,
                itemId: ch.item_id,
                title: ch.title,
                chapterIndex: idx || (ch as any).originalIndex || 1
              })
            });
            const data = await res.json();
            if (!data.success || !data.chapter) {
              throw new Error(data.error || 'Không tải được nội dung chương Qimao');
            }
            return {
              title: data.chapter.title || ch.title,
              content: data.chapter.content || ''
            };
          }}
        />
      )}

      {/* Reader Modal */}
      <ReaderModal
        isOpen={readerState.isOpen}
        onClose={() => setReaderState(prev => ({ ...prev, isOpen: false }))}
        title={readerState.title}
        content={readerState.content}
        itemId={readerState.itemId}
        loading={readerState.loading}
        error={readerState.error}
      />

      {/* Search Results Modal */}
      <SearchResultsModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        results={searchResults}
        onSelectBook={handleSelectBook}
        query={searchQuery}
      />

      {/* Chapter Titles Modal */}
      <ChapterTitlesModal
        isOpen={isChapterTitlesOpen}
        onClose={() => setIsChapterTitlesOpen(false)}
        initialBookId={currentBook?.book_id}
        initialBookTitle={currentBook?.book_name}
        initialChapters={catalog?.chapter_list || []}
        source="qimao"
      />
    </div>
  );
};
