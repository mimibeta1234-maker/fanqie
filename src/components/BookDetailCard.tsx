import React, { useState } from 'react';
import { BookOpen, User, List, Bookmark, FileSearch, BookmarkCheck, ChevronDown, ChevronUp, Image as ImageIcon, FileText } from 'lucide-react';
import { Book } from '../types';
import { getAbstractParagraphs } from '../utils/textFormatter';
import { HdCoverModal } from './HdCoverModal';

interface BookDetailCardProps {
  book: Book;
  totalChapters: number;
  onOpenCatalog: () => void;
  onOpenPlotSearch?: () => void;
  onOpenChapterTitles?: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
  markedChaptersCount?: number;
  onOpenMarkedChapters?: () => void;
}

export const BookDetailCard: React.FC<BookDetailCardProps> = ({
  book,
  totalChapters,
  onOpenCatalog,
  onOpenPlotSearch,
  onOpenChapterTitles,
  isSaved = false,
  onToggleSave,
  markedChaptersCount = 0,
  onOpenMarkedChapters
}) => {
  const [showFullAbstract, setShowFullAbstract] = useState<boolean>(false);
  const [isHdCoverOpen, setIsHdCoverOpen] = useState<boolean>(false);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-xs" id="book-detail-card">
      <div className="flex gap-4 sm:gap-5 items-start">
        {/* Cover */}
        <div
          onClick={() => setIsHdCoverOpen(true)}
          className="w-20 sm:w-24 h-28 sm:h-32 shrink-0 bg-stone-100 rounded-lg overflow-hidden border border-stone-200 relative group cursor-pointer shadow-xs"
          title="Bấm để xem và tải ảnh bìa gốc Ultra HD"
        >
          {book.thumb_url ? (
            <>
              <img
                src={book.thumb_url}
                alt={book.book_name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* HD Badge Overlay */}
              <div className="absolute top-1 right-1 bg-black/75 backdrop-blur-xs text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                <ImageIcon className="w-2.5 h-2.5" />
                <span>HD</span>
              </div>
              {/* Hover overlay hint */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-1 p-1 text-center">
                <ImageIcon className="w-4 h-4 text-amber-300" />
                <span>Bìa HD</span>
              </div>
            </>
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
          {book.abstract && (() => {
            const paragraphs = getAbstractParagraphs(book.abstract);
            const isLong = paragraphs.length > 2 || book.abstract.length > 120;
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
                      className="inline-flex items-center gap-0.5 text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                    >
                      <span>{showFullAbstract ? "Thu gọn" : "Xem đầy đủ"}</span>
                      {showFullAbstract ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                <div className={`text-xs text-stone-700 leading-relaxed ${showFullAbstract ? 'max-h-96 overflow-y-auto pr-1 select-text' : ''}`}>
                  {showFullAbstract ? (
                    <div className="space-y-2">
                      {paragraphs.map((para, pIdx) => (
                        <p key={pIdx} className="text-justify indent-3">{para}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="line-clamp-2 text-stone-600">
                      {paragraphs[0] || book.abstract}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

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
                <FileSearch className="w-3.5 h-3.5" />
                <span>Tìm theo tình tiết</span>
              </button>
            )}

            {onOpenChapterTitles && (
              <button
                type="button"
                onClick={onOpenChapterTitles}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors border border-rose-200 flex items-center gap-1.5 cursor-pointer"
                id="btn-open-chapter-titles"
                title="Trích xuất danh sách tiêu đề chương tuần tự (sạch theo từng dòng)"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>Trích xuất tiêu đề</span>
              </button>
            )}

            {markedChaptersCount > 0 && onOpenMarkedChapters && (
              <button
                type="button"
                onClick={onOpenMarkedChapters}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-medium transition-colors border border-amber-300 flex items-center gap-1.5 cursor-pointer"
                id="btn-open-marked-chapters"
                title="Xem các chương bạn đã đánh dấu"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Đã dấu {markedChaptersCount} chương</span>
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

            {/* Extract HD Cover Button */}
            <button
              type="button"
              onClick={() => setIsHdCoverOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              id="btn-open-hd-cover-modal"
              title="Trích xuất và tải ảnh bìa gốc độ phân giải cao Ultra HD (1200p / 1600p / Gốc)"
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-200" />
              <span>Trích xuất Bìa HD</span>
            </button>
          </div>
        </div>
      </div>

      {/* HD Cover Extraction Modal */}
      <HdCoverModal
        isOpen={isHdCoverOpen}
        onClose={() => setIsHdCoverOpen(false)}
        initialCoverUrl={book.thumb_url}
        initialBookName={book.book_name}
        initialAuthor={book.author}
      />
    </div>
  );
};
