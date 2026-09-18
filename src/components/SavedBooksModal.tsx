import React, { useState, useMemo } from 'react';
import { X, Bookmark, Trash2, BookOpen, User, ArrowRight, Layers } from 'lucide-react';
import { SavedBook } from '../types';
import { inferBookSource } from '../utils/savedBooks';

interface SavedBooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedBooks: SavedBook[];
  onSelectBook: (bookId: string, source: 'fanqie' | 'qimao') => void;
  onRemoveBook: (bookId: string) => void;
}

export const SavedBooksModal: React.FC<SavedBooksModalProps> = ({
  isOpen,
  onClose,
  savedBooks,
  onSelectBook,
  onRemoveBook
}) => {
  const [platformFilter, setPlatformFilter] = useState<'all' | 'fanqie' | 'qimao'>('all');

  const filteredBooks = useMemo(() => {
    if (platformFilter === 'all') return savedBooks;
    return savedBooks.filter(b => inferBookSource(b.book_id, b.source) === platformFilter);
  }, [savedBooks, platformFilter]);

  const counts = useMemo(() => {
    let fanqieCount = 0;
    let qimaoCount = 0;
    for (const b of savedBooks) {
      if (inferBookSource(b.book_id, b.source) === 'qimao') {
        qimaoCount++;
      } else {
        fanqieCount++;
      }
    }
    return { all: savedBooks.length, fanqie: fanqieCount, qimao: qimaoCount };
  }, [savedBooks]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-3 sm:p-6"
      id="saved-books-backdrop"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-stone-200"
        id="saved-books-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <Bookmark className="w-4 h-4 fill-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base sm:text-lg">
                Truyện đã lưu ({savedBooks.length})
              </h3>
              <p className="text-xs text-stone-500">Danh sách truyện bạn đã đánh dấu để đọc hoặc tải từ Fanqie và Qimao</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            id="btn-close-saved-books"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs if multiple platforms exist */}
        {savedBooks.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-stone-100/70 border-b border-stone-200 text-xs">
            <span className="text-stone-500 font-medium mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Nền tảng:
            </span>
            <button
              type="button"
              onClick={() => setPlatformFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                platformFilter === 'all'
                  ? 'bg-stone-800 text-white shadow-2xs'
                  : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              Tất cả ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter('fanqie')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                platformFilter === 'fanqie'
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              Fanqie ({counts.fanqie})
            </button>
            <button
              type="button"
              onClick={() => setPlatformFilter('qimao')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                platformFilter === 'qimao'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              Qimao ({counts.qimao})
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-stone-100">
          {filteredBooks.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
                <Bookmark className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-stone-700">
                {savedBooks.length === 0 ? 'Chưa có truyện nào được lưu' : 'Không có truyện nào thuộc mục này'}
              </p>
              <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                Khi tìm thấy truyện ưng ý trên Fanqie hoặc Qimao, hãy nhấn nút <strong>"Lưu truyện"</strong> để xem lại nhanh tại đây.
              </p>
            </div>
          ) : (
            filteredBooks.map((b) => {
              const src = inferBookSource(b.book_id, b.source);
              const isQimao = src === 'qimao';

              return (
                <div
                  key={b.book_id}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-stone-50 rounded-xl transition-colors group"
                >
                  <div
                    onClick={() => {
                      onSelectBook(b.book_id, src);
                      onClose();
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-12 h-16 shrink-0 bg-stone-100 rounded-md overflow-hidden border border-stone-200 relative">
                      {b.thumb_url ? (
                        <img
                          src={b.thumb_url}
                          alt={b.book_name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300">
                          <BookOpen className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                            isQimao
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          {isQimao ? 'Qimao' : 'Fanqie'}
                        </span>
                        <h4 className={`text-sm font-semibold text-stone-900 truncate transition-colors ${
                          isQimao ? 'group-hover:text-amber-600' : 'group-hover:text-red-600'
                        }`}>
                          {b.book_name}
                        </h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-stone-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-stone-400" />
                          {b.author}
                        </span>
                        <span>•</span>
                        <span>{b.chapter_count || 0} chương</span>
                        {b.category && (
                          <>
                            <span>•</span>
                            <span className="text-stone-600">{b.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onSelectBook(b.book_id, src);
                        onClose();
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer border ${
                        isQimao
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                      }`}
                      title={`Mở truyện này trên ${isQimao ? 'Qimao' : 'Fanqie'}`}
                    >
                      <span>Mở</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemoveBook(b.book_id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa khỏi danh sách lưu"
                    >
                      <Trash2 className="w-4 h-4" />
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
