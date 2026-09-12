import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, BookOpen, ArrowUpDown, Copy, Check, Loader2, FileSearch, Bookmark } from 'lucide-react';
import { Chapter } from '../types';

interface ChapterListModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  bookTitle: string;
  onPreviewChapter: (chapter: Chapter) => void;
  onOpenPlotSearch?: () => void;
  markedItemIds?: Set<string>;
  onToggleMarkChapter?: (chapter: Chapter, chapterIndex: number) => void;
  initialShowMarkedOnly?: boolean;
}

// Helper to convert an integer (1 - 9999) to standard Chinese numeral
function toChineseNum(num: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const units = ["", "十", "百", "千", "万"];
  if (num === 0) return "零";
  if (num < 10) return digits[num];
  if (num < 20) return "十" + (num % 10 !== 0 ? digits[num % 10] : "");

  let str = "";
  const s = String(num);
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const d = parseInt(s[i], 10);
    const unit = units[len - i - 1];
    if (d !== 0) {
      str += digits[d] + unit;
    } else {
      if (!str.endsWith("零") && i < len - 1) {
        str += "零";
      }
    }
  }
  return str.replace(/零+$/, "");
}

export const ChapterListModal: React.FC<ChapterListModalProps> = ({
  isOpen,
  onClose,
  chapters,
  bookTitle,
  onPreviewChapter,
  onOpenPlotSearch,
  markedItemIds = new Set<string>(),
  onToggleMarkChapter,
  initialShowMarkedOnly = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVolume, setSelectedVolume] = useState<string>('all');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [showMarkedOnly, setShowMarkedOnly] = useState<boolean>(initialShowMarkedOnly);

  // Sync initialShowMarkedOnly when modal is opened
  useEffect(() => {
    if (isOpen) {
      setShowMarkedOnly(initialShowMarkedOnly);
    }
  }, [isOpen, initialShowMarkedOnly]);

  // Copying states
  const [copyingItemId, setCopyingItemId] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  // Extract unique volume titles
  const volumes = useMemo(() => {
    const set = new Set<string>();
    chapters.forEach(c => {
      if (c.volume_title) set.add(c.volume_title);
    });
    return Array.from(set);
  }, [chapters]);

  // Filtered chapters with smart chapter number and Chinese numeral support
  const filteredChapters = useMemo(() => {
    const term = searchTerm.trim();
    const isNumQuery = /^(?:chương|chap|c|第)?\s*(\d+)\s*(?:chương|chap|c|章)?$/i.test(term);
    const targetNum = isNumQuery ? parseInt(term.replace(/[^\d]/g, ''), 10) : null;
    const chineseNum = targetNum !== null && targetNum > 0 ? toChineseNum(targetNum) : null;

    // Attach 1-based original index to each chapter
    const indexed = chapters.map((ch, idx) => ({
      ...ch,
      originalIndex: idx + 1
    }));

    let list = indexed.filter(c => {
      // Marked only filter
      if (showMarkedOnly && !markedItemIds.has(c.item_id)) {
        return false;
      }

      // Volume filter
      if (selectedVolume !== 'all' && c.volume_title !== selectedVolume) {
        return false;
      }

      // If no search term, keep all
      if (!term) return true;

      // 1. If user typed a number (e.g. "289" or "chương 289" or "第289章"):
      if (targetNum !== null) {
        // Match exact chapter index (e.g. the 289th chapter)
        if (c.originalIndex === targetNum) return true;

        // Match if title contains the number (e.g. "289", "第289章", "Chương 289")
        if (c.title.includes(String(targetNum))) return true;

        // Match Chinese numeral representation (e.g. "第二百八十九")
        if (chineseNum && c.title.includes(chineseNum)) return true;

        return false;
      }

      // 2. If general text query:
      const lowerTerm = term.toLowerCase();
      if (c.title.toLowerCase().includes(lowerTerm)) {
        return true;
      }

      // Only check itemId if user pasted a long ID string (>= 15 characters)
      if (term.length >= 15 && c.item_id.includes(term)) {
        return true;
      }

      return false;
    });

    if (!sortAsc) {
      list = [...list].reverse();
    }
    return list;
  }, [chapters, searchTerm, selectedVolume, sortAsc, showMarkedOnly, markedItemIds]);

  // Handle quick copy chapter
  const handleQuickCopy = async (chapter: Chapter, index: number) => {
    try {
      setCopyingItemId(chapter.item_id);
      const res = await fetch('/api/chapter/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: chapter.item_id })
      });
      const data = await res.json();
      if (!data.success || !data.chapter) {
        throw new Error(data.error || "Không thể tải nội dung chương");
      }

      const textToCopy = `${chapter.title}\n\n${data.chapter.content}`;
      await navigator.clipboard.writeText(textToCopy);

      setCopiedItemId(chapter.item_id);
      setTimeout(() => {
        setCopiedItemId(null);
      }, 2000);
    } catch (err: any) {
      alert(`Lỗi copy chương: ${err.message}`);
    } finally {
      setCopyingItemId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-3 sm:p-6"
      id="catalog-modal-backdrop"
    >
      <div
        className="w-full max-w-3xl h-[85vh] bg-white rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-stone-200"
        id="catalog-modal-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div>
            <h3 className="font-bold text-stone-900 text-base sm:text-lg">
              Mục lục chương ({chapters.length} chương)
            </h3>
            <p className="text-xs text-stone-500 truncate max-w-md">{bookTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenPlotSearch && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPlotSearch();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium border border-red-200 transition-colors cursor-pointer"
                title="Tìm kiếm tình tiết trong nội dung chương"
              >
                <FileSearch className="w-3.5 h-3.5" />
                <span>Tìm tình tiết</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              id="btn-close-catalog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter bar */}
        <div className="p-4 border-b border-stone-200 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Tìm theo số chương (VD: 289) hoặc tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              id="input-search-chapters"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 p-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            {/* Filter Marked Only */}
            <button
              type="button"
              onClick={() => setShowMarkedOnly(!showMarkedOnly)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg font-medium border transition-colors cursor-pointer ${
                showMarkedOnly
                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
              }`}
              title="Lọc chỉ hiển thị các chương bạn đã đánh dấu"
              id="btn-filter-marked-chapters"
            >
              <Bookmark className={`w-3.5 h-3.5 ${showMarkedOnly || markedItemIds.size > 0 ? 'text-amber-600 fill-amber-500' : 'text-stone-400'}`} />
              <span>Đã dấu {markedItemIds.size > 0 ? `(${markedItemIds.size})` : ''}</span>
            </button>

            {volumes.length > 1 && (
              <select
                value={selectedVolume}
                onChange={(e) => setSelectedVolume(e.target.value)}
                className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2 text-stone-700 focus:outline-none focus:ring-2 focus:ring-red-500 max-w-[150px] truncate"
              >
                <option value="all">Tất cả cuốn ({volumes.length})</option>
                {volumes.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="flex items-center gap-1 text-xs px-3 py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg font-medium transition-colors cursor-pointer"
              title="Đổi thứ tự hiển thị"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-500" />
              <span>{sortAsc ? "Cũ nhất" : "Mới nhất"}</span>
            </button>

            {onOpenPlotSearch && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPlotSearch();
                }}
                className="sm:hidden flex items-center gap-1 text-xs px-2.5 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium"
              >
                <FileSearch className="w-3.5 h-3.5" />
                <span>Tìm tình tiết</span>
              </button>
            )}
          </div>
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-stone-100">
          {filteredChapters.length === 0 ? (
            <div className="text-center py-16 text-stone-400 text-sm">
              {showMarkedOnly ? (
                <div>
                  <Bookmark className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p>Chưa có chương nào được đánh dấu trong truyện này.</p>
                  <button
                    onClick={() => setShowMarkedOnly(false)}
                    className="mt-3 text-xs text-red-600 hover:underline font-medium"
                  >
                    Xem tất cả các chương
                  </button>
                </div>
              ) : (
                `Không tìm thấy chương nào phù hợp với "${searchTerm}"`
              )}
            </div>
          ) : (
            filteredChapters.map((ch) => {
              const isCopied = copiedItemId === ch.item_id;
              const isCopying = copyingItemId === ch.item_id;
              const isMarked = markedItemIds.has(ch.item_id);

              return (
                <div
                  key={ch.item_id}
                  className={`py-3 px-2 flex items-center justify-between hover:bg-stone-50 rounded-lg transition-colors group ${
                    isMarked ? 'bg-amber-50/60 border-l-2 border-l-amber-500 pl-2.5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden pr-3">
                    <span className="text-xs font-mono text-stone-400 w-10 text-right shrink-0">
                      {ch.originalIndex}
                    </span>
                    <div className="truncate">
                      <p className={`text-sm font-medium truncate group-hover:text-red-600 transition-colors ${
                        isMarked ? 'text-amber-950 font-semibold' : 'text-stone-800'
                      }`}>
                        {ch.title}
                      </p>
                      <p className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                        {isMarked && (
                          <span className="text-amber-600 font-medium">Đã đánh dấu •</span>
                        )}
                        {ch.volume_title && <span>{ch.volume_title}</span>}
                        {ch.char_count > 0 && <span>• {ch.char_count.toLocaleString()} chữ</span>}
                        {ch.update_time && <span>• {ch.update_time}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Mark chapter button */}
                    {onToggleMarkChapter && (
                      <button
                        onClick={() => onToggleMarkChapter(ch, ch.originalIndex)}
                        className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isMarked
                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-medium'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-500 border-stone-200'
                        }`}
                        title={isMarked ? "Bỏ đánh dấu chương này" : "Đánh dấu chương này"}
                        id={`btn-mark-chapter-${ch.item_id}`}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 ${
                            isMarked ? 'fill-amber-500 text-amber-600' : 'text-stone-400'
                          }`}
                        />
                        <span className="hidden sm:inline">{isMarked ? "Đã dấu" : "Dấu"}</span>
                      </button>
                    )}

                    {/* Quick copy button */}
                    <button
                      onClick={() => handleQuickCopy(ch, ch.originalIndex)}
                      disabled={isCopying}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-medium'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                      title="Sao chép nội dung chương vào clipboard"
                      id={`btn-copy-chapter-${ch.item_id}`}
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

                    {/* Read chapter button */}
                    <button
                      onClick={() => onPreviewChapter(ch)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-medium border border-red-200 transition-colors cursor-pointer"
                      title="Đọc thử chương này (Đã giải mã vượt khóa)"
                      id={`btn-read-chapter-${ch.item_id}`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Đọc thử</span>
                    </button>
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
