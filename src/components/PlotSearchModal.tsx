import React, { useState, useRef } from 'react';
import { X, Search, BookOpen, Copy, Check, Sparkles, AlertCircle, Loader2, StopCircle } from 'lucide-react';
import { Chapter, PlotMatch } from '../types';

interface PlotSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle: string;
  chapters: Chapter[];
  onPreviewChapter: (chapter: Chapter) => void;
}

export const PlotSearchModal: React.FC<PlotSearchModalProps> = ({
  isOpen,
  onClose,
  bookId,
  bookTitle,
  chapters,
  onPreviewChapter
}) => {
  const [query, setQuery] = useState<string>('');
  const [rangeMode, setRangeMode] = useState<'all' | 'custom'>('all');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(Math.min(100, chapters.length || 100));

  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [matches, setMatches] = useState<PlotMatch[]>([]);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [copyingItemId, setCopyingItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<boolean>(false);

  if (!isOpen) return null;

  const totalCount = chapters.length;

  const handleStartSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setErrorMessage("Vui lòng nhập từ khóa hoặc đoạn tình tiết cần tìm");
      return;
    }

    if (totalCount === 0) {
      setErrorMessage("Chưa có danh sách chương để tìm kiếm");
      return;
    }

    setErrorMessage(null);
    setMatches([]);
    setIsSearching(true);
    setProgressPercent(0);
    abortRef.current = false;

    const startIdx = rangeMode === 'all' ? 1 : Math.max(1, Math.min(rangeStart, totalCount));
    const endIdx = rangeMode === 'all' ? totalCount : Math.max(startIdx, Math.min(rangeEnd, totalCount));

    const targetChapters = chapters.slice(startIdx - 1, endIdx);
    const totalToScan = targetChapters.length;
    const batchSize = 15;

    let scannedCount = 0;
    const foundMatches: PlotMatch[] = [];

    try {
      for (let i = 0; i < totalToScan; i += batchSize) {
        if (abortRef.current) {
          break;
        }

        const currentBatch = targetChapters.slice(i, i + batchSize);
        const itemIds = currentBatch.map(c => c.item_id);
        const currentStartChapter = startIdx + i;
        const currentEndChapter = Math.min(endIdx, currentStartChapter + currentBatch.length - 1);

        setProgressText(`Đang quét chương ${currentStartChapter} - ${currentEndChapter}/${endIdx}...`);

        const res = await fetch('/api/book/search-plot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId,
            query: trimmed,
            itemIds,
            startIndex: currentStartChapter
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Lỗi máy chủ (${res.status})`);
        }

        const data = await res.json();
        if (data.success && Array.isArray(data.matches)) {
          for (const m of data.matches) {
            foundMatches.push(m);
          }
          setMatches([...foundMatches]);
        }

        scannedCount += currentBatch.length;
        const percent = Math.min(100, Math.round((scannedCount / totalToScan) * 100));
        setProgressPercent(percent);
      }

      if (abortRef.current) {
        setProgressText(`Đã dừng tìm kiếm. Quét được ${scannedCount}/${totalToScan} chương.`);
      } else {
        setProgressText(`Hoàn tất quét ${totalToScan} chương. Tìm thấy ${foundMatches.length} chương chứa tình tiết.`);
      }
    } catch (err: any) {
      console.error("Plot search execution error:", err);
      setErrorMessage(err.message || "Có lỗi xảy ra trong quá trình quét");
    } finally {
      setIsSearching(false);
    }
  };

  const handleStopSearch = () => {
    abortRef.current = true;
    setIsSearching(false);
  };

  const handleCopyChapter = async (itemId: string, title: string) => {
    try {
      setCopyingItemId(itemId);
      const res = await fetch('/api/chapter/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });
      const data = await res.json();
      if (data.success && data.chapter) {
        await navigator.clipboard.writeText(`${title}\n\n${data.chapter.content}`);
        setCopiedItemId(itemId);
        setTimeout(() => setCopiedItemId(null), 2000);
      }
    } catch (err) {
      console.warn("Copy chapter error:", err);
    } finally {
      setCopyingItemId(null);
    }
  };

  // Helper highlight keyword in snippet
  const renderHighlightedSnippet = (snippet: string, term: string) => {
    if (!term || !snippet) return snippet;
    try {
      const parts = snippet.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      return (
        <span>
          {parts.map((part, i) =>
            part.toLowerCase() === term.toLowerCase() ? (
              <mark key={i} className="bg-amber-200 text-amber-950 font-semibold px-1 py-0.5 rounded">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </span>
      );
    } catch {
      return snippet;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-3 sm:p-6"
      id="plot-search-backdrop"
    >
      <div
        className="w-full max-w-3xl h-[88vh] bg-white rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-stone-200"
        id="plot-search-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base sm:text-lg">
                Tìm theo tình tiết truyện
              </h3>
              <p className="text-xs text-stone-500 truncate max-w-md">{bookTitle}</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isSearching) handleStopSearch();
              onClose();
            }}
            className="p-2 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            id="btn-close-plot-search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search controls */}
        <div className="p-4 border-b border-stone-200 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Nhập tên nhân vật, câu thoại, tình tiết (VD: 申屠勇, 退婚, Đột phá)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSearching) handleStartSearch();
                }}
                disabled={isSearching}
                className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-60"
                id="input-plot-query"
              />
            </div>

            <div className="flex items-center gap-2">
              {isSearching ? (
                <button
                  onClick={handleStopSearch}
                  className="px-4 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  id="btn-stop-plot-search"
                >
                  <StopCircle className="w-4 h-4 text-red-400" />
                  <span>Dừng lại</span>
                </button>
              ) : (
                <button
                  onClick={handleStartSearch}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                  id="btn-start-plot-search"
                >
                  <Search className="w-4 h-4" />
                  <span>Tìm chương</span>
                </button>
              )}
            </div>
          </div>

          {/* Scope selection */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 pt-1">
            <span className="font-medium text-stone-700">Phạm vi quét:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="rangeMode"
                checked={rangeMode === 'all'}
                onChange={() => setRangeMode('all')}
                disabled={isSearching}
                className="text-red-600 focus:ring-red-500"
              />
              <span>Tất cả ({totalCount} chương)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="rangeMode"
                checked={rangeMode === 'custom'}
                onChange={() => setRangeMode('custom')}
                disabled={isSearching}
                className="text-red-600 focus:ring-red-500"
              />
              <span>Khoảng cụ thể:</span>
            </label>

            {rangeMode === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={totalCount}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(parseInt(e.target.value, 10) || 1)}
                  disabled={isSearching}
                  className="w-16 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-center text-xs font-mono"
                />
                <span>đến</span>
                <input
                  type="number"
                  min={rangeStart}
                  max={totalCount}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(parseInt(e.target.value, 10) || totalCount)}
                  disabled={isSearching}
                  className="w-16 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-center text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Progress bar */}
          {(isSearching || progressText) && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-stone-600">
                <span className="flex items-center gap-1.5">
                  {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />}
                  <span>{progressText}</span>
                </span>
                <span className="font-semibold text-stone-800">
                  {matches.length} chương tìm thấy
                </span>
              </div>
              <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-red-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-stone-100 bg-[#faf9f7]">
          {matches.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-stone-700">
                {isSearching ? "Đang quét các chương..." : "Chưa có kết quả tìm kiếm"}
              </p>
              <p className="text-xs text-stone-400 mt-1 max-w-md mx-auto leading-relaxed">
                Nhập tên nhân vật (VD: <em>申屠勇</em>), sự kiện (VD: <em>退婚, 突破, viên thuốc</em>) để tìm chính xác tình tiết đó xuất hiện ở chương nào trong truyện.
              </p>
            </div>
          ) : (
            matches.map((m) => {
              const ch = chapters.find((c) => c.item_id === m.itemId) || {
                item_id: m.itemId,
                title: m.title,
                volume_title: '',
                update_time: '',
                char_count: 0
              };
              const isCopied = copiedItemId === m.itemId;
              const isCopying = copyingItemId === m.itemId;

              return (
                <div
                  key={m.itemId}
                  className="py-3.5 px-3 bg-white hover:bg-stone-50/80 rounded-xl mb-2 border border-stone-200/80 transition-colors shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          Chương {m.chapterIndex}
                        </span>
                        <h4 className="text-sm font-semibold text-stone-900 truncate">
                          {m.title}
                        </h4>
                      </div>

                      {/* Snippet */}
                      <div className="mt-2 text-xs text-stone-700 bg-stone-50 p-2.5 rounded-lg border border-stone-200/60 leading-relaxed font-serif select-text">
                        {renderHighlightedSnippet(m.snippet, query.trim())}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      <button
                        onClick={() => handleCopyChapter(m.itemId, m.title)}
                        disabled={isCopying}
                        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-medium'
                            : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                        title="Sao chép toàn bộ chương"
                      >
                        {isCopying ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                        ) : isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-stone-500" />
                        )}
                        <span>{isCopied ? "Đã copy!" : "Copy"}</span>
                      </button>

                      <button
                        onClick={() => onPreviewChapter(ch)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium border border-red-200 transition-colors cursor-pointer"
                        title="Đọc thử chương này"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Đọc</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
