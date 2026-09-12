import React, { useState } from 'react';
import { BookOpen, User, List, Bookmark, Sparkles } from 'lucide-react';
import { Book } from '../types';

interface BookDetailCardProps {
  book: Book;
  totalChapters: number;
  onOpenCatalog: () => void;
  onOpenPlotSearch?: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}

export const BookDetailCard: React.FC<BookDetailCardProps> = ({
  book,
  totalChapters,
  onOpenCatalog,
  onOpenPlotSearch,
  isSaved = false,
  onToggleSave
}) => {
  const [showFullAbstract, setShowFullAbstract] = useState<boolean>(false);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-xs" id="book-detail-card">
      <div className="flex gap-4 sm:gap-5 items-start">
        {/* Cover */}
        <div className="w-20 sm:w-24 h-28 sm:h-32 shrink-0 bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
          {book.thumb_url ? (
            <img
              src={book.thumb_url}
              alt={book.book_name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
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
              {book.book_name}
            </h2>
            {book.score && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                ★ {book.score}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-stone-500">
            <span className="flex items-center gap-1 font-medium text-stone-700">
              <User className="w-3.5 h-3.5 text-stone-400" />
              {book.author}
            </span>
            <span>•</span>
            <span>{book.category || "Tiểu thuyết"}</span>
            <span>•</span>
            <span className="font-semibold text-stone-800">
              {totalChapters || book.chapter_count || 0} chương
            </span>
          </div>

          {/* Tags */}
          {book.tags && (
            <div className="flex flex-wrap gap-1.5 mt-2" id="book-tags-container">
              {book.tags
                .split(/[,，、]/)
                .map((t) => t.trim())
                .filter(Boolean)
                .map((tag, idx) => {
                  const isStatus = tag === "已完结" || tag === "连载中" || tag === "完结" || tag === "连载";
                  return (
                    <span
                      key={idx}
                      className={`inline-block text-[11px] px-2 py-0.5 rounded border ${
                        isStatus
                          ? "bg-amber-50 text-amber-800 border-amber-300 font-medium"
                          : "bg-stone-50 text-stone-600 border-stone-200"
                      }`}
                    >
                      {tag}
                    </span>
                  );
                })}
            </div>
          )}

          {/* Synopsis */}
          {book.abstract && (
            <div className="mt-2 text-xs text-stone-600 leading-relaxed">
              <p className={showFullAbstract ? '' : 'line-clamp-2'}>
                {book.abstract}
              </p>
              {book.abstract.length > 140 && (
                <button
                  type="button"
                  onClick={() => setShowFullAbstract(!showFullAbstract)}
                  className="text-[11px] text-red-600 hover:underline font-medium mt-0.5 cursor-pointer"
                >
                  {showFullAbstract ? "Thu gọn" : "Xem thêm"}
                </button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenCatalog}
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              id="btn-open-catalog"
            >
              <List className="w-3.5 h-3.5 text-stone-500" />
              <span>Mục lục & Đọc thử</span>
            </button>

            {onOpenPlotSearch && (
              <button
                type="button"
                onClick={onOpenPlotSearch}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors border border-red-200 flex items-center gap-1.5 cursor-pointer"
                id="btn-open-plot-search"
                title="Tìm kiếm tình tiết trong nội dung các chương"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tìm theo tình tiết</span>
              </button>
            )}

            {onToggleSave && (
              <button
                type="button"
                onClick={onToggleSave}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1.5 cursor-pointer ${
                  isSaved
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-white hover:bg-stone-100 text-stone-600 border-stone-200'
                }`}
                id="btn-toggle-save-book"
                title={isSaved ? "Bỏ lưu truyện này" : "Lưu truyện vào danh sách yêu thích"}
              >
                <Bookmark
                  className={`w-3.5 h-3.5 ${
                    isSaved ? 'text-amber-600 fill-amber-500' : 'text-stone-400'
                  }`}
                />
                <span>{isSaved ? "Đã lưu truyện" : "Lưu truyện"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
