import React from 'react';
import { Bookmark, Download, FileText, GitCompare, Sparkles, BookOpen, BookmarkCheck } from 'lucide-react';

export type StudioTab = 'downloader' | 'qimao' | 'zhihu' | 'scribd' | 'compare';

interface NavbarProps {
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  onOpenSavedBooks?: () => void;
  savedCount?: number;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenSavedBooks,
  savedCount = 0,
  onLogout
}) => {
  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-30" id="main-header">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand: Studio */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-sm shadow-xs tracking-wider">
              S
            </div>
            <div className="flex items-baseline gap-1.5">
              <h1 className="text-base font-bold text-stone-900 tracking-tight">Studio</h1>
            </div>
          </div>

          {/* Module Switcher Tabs: Fanqie Downloader | Qimao Downloader | Scribd Downloader | So Sánh */}
          <nav className="flex items-center bg-stone-100/90 p-1 rounded-xl border border-stone-200/80 gap-0.5">
            <button
              type="button"
              onClick={() => onTabChange('downloader')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'downloader'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              id="tab-fanqie-downloader"
            >
              <Download className="w-3.5 h-3.5 text-red-600" />
              <span>Fanqie Downloader</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('qimao')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'qimao'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              id="tab-qimao-downloader"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>Qimao Downloader</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('zhihu')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'zhihu'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              id="tab-zhihu-downloader"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-sky-600" />
              <span>Zhihu (Free & VIP)</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('scribd')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'scribd'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              id="tab-scribd-downloader"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Scribd Downloader</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('compare')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'compare'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              id="tab-compare"
            >
              <GitCompare className="w-3.5 h-3.5 text-stone-700" />
              <span>So Sánh Văn Bản</span>
            </button>
          </nav>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2">
          {(activeTab === 'downloader' || activeTab === 'qimao') && onOpenSavedBooks && (
            <button
              onClick={onOpenSavedBooks}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
              id="btn-nav-saved-books"
              title="Xem danh sách truyện đã lưu"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>Truyện đã lưu</span>
              {savedCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
                  {savedCount}
                </span>
              )}
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              id="btn-nav-lock"
              title="Khóa lại"
            >
              <span>Khóa</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
