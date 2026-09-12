import React from 'react';
import { BookOpen, Bookmark } from 'lucide-react';

interface NavbarProps {
  onOpenSavedBooks?: () => void;
  savedCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSavedBooks,
  savedCount = 0
}) => {
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-30" id="main-header">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-bold text-stone-900 tracking-tight">Fanqie Downloader</h1>
            <span className="text-xs text-stone-400 font-normal hidden sm:inline">Tải truyện 番茄 full chương</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenSavedBooks && (
            <button
              onClick={onOpenSavedBooks}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
              id="btn-nav-saved-books"
              title="Xem danh sách truyện đã lưu"
            >
              <Bookmark className="w-3.5 h-3.5 text-red-600 fill-red-500" />
              <span>Truyện đã lưu</span>
              {savedCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-red-100 text-red-700 rounded-full font-bold text-[10px]">
                  {savedCount}
                </span>
              )}
            </button>
          )}

          <div className="text-xs text-stone-500 font-medium hidden sm:inline">
            Xuất TXT & EPUB
          </div>
        </div>
      </div>
    </header>
  );
};
