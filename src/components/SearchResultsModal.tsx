import React from 'react';
import { X, Star, BookOpen, User, ListOrdered } from 'lucide-react';
import { Book } from '../types';

interface SearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: Book[];
  onSelectBook: (bookId: string) => void;
  query: string;
}

export const SearchResultsModal: React.FC<SearchResultsModalProps> = ({
  isOpen,
  onClose,
  results,
  onSelectBook,
  query
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-3 sm:p-6" id="search-modal-backdrop">
      <div className="w-full max-w-3xl h-[85vh] bg-white rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-stone-200" id="search-modal-container">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div>
            <h3 className="font-bold text-stone-900 text-base sm:text-lg">
              Kết quả tìm kiếm cho "{query}" ({results.length} truyện)
            </h3>
            <p className="text-xs text-stone-500">Bấm "Chọn tải truyện" để mở và tải full chương</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors"
            id="btn-close-search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {results.length === 0 ? (
            <div className="text-center py-16 text-stone-400 text-sm">
              Không tìm thấy truyện nào với từ khóa này
            </div>
          ) : (
            results.map(book => (
              <div
                key={book.book_id}
                className="p-4 border border-stone-200 rounded-xl hover:border-red-300 hover:shadow-sm transition-all bg-white flex flex-col sm:flex-row gap-4 items-start"
              >
                {/* Book Cover */}
                <div className="w-20 h-28 shrink-0 bg-stone-100 rounded-lg overflow-hidden border border-stone-200 shadow-xs">
                  {book.thumb_url ? (
                    <img
                      src={book.thumb_url}
                      alt={book.book_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-400">
                      <BookOpen className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-stone-900 text-base line-clamp-1 hover:text-red-600 transition-colors">
                      {book.book_name}
                    </h4>
                    {book.score && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {book.score}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-stone-500">
                    <span className="flex items-center gap-1 font-medium text-stone-700">
                      <User className="w-3 h-3" />
                      {book.author}
                    </span>
                    <span>•</span>
                    <span className="px-2 py-0.5 bg-stone-100 rounded text-stone-600">
                      {book.category || "Tiểu thuyết"}
                    </span>
                    <span>•</span>
                    <span>{book.creation_status || "Đang ra"}</span>
                    {book.chapter_count > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-stone-700">{book.chapter_count} chương</span>
                      </>
                    )}
                  </div>

                  {book.abstract && (
                    <p className="text-xs text-stone-500 line-clamp-2 mt-2 leading-relaxed">
                      {book.abstract}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-stone-400">ID: {book.book_id}</span>
                    <button
                      onClick={() => {
                        onSelectBook(book.book_id);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                      id={`btn-select-book-${book.book_id}`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Chọn truyện này</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
