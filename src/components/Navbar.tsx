import React from 'react';
import { BookOpen } from 'lucide-react';

export const Navbar: React.FC = () => {
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
        <div className="text-xs text-stone-500 font-medium">
          Xuất file TXT & EPUB
        </div>
      </div>
    </header>
  );
};
