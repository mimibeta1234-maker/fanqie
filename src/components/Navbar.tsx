import React from 'react';
import {
  Bookmark,
  Download,
  FileText,
  Image as ImageIcon,
  BookOpen,
  Languages,
  Lock
} from 'lucide-react';

export type StudioTab = 'downloader' | 'qimao' | 'align';

interface NavbarProps {
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  onOpenSavedBooks?: () => void;
  savedCount?: number;
  onLogout?: () => void;
  onOpenHdCoverModal?: () => void;
  onOpenChapterTitlesModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenSavedBooks,
  savedCount = 0,
  onLogout,
  onOpenHdCoverModal,
  onOpenChapterTitlesModal
}) => {
  return (
    <header className="border-b border-stone-200 bg-white/95 backdrop-blur-md sticky top-0 z-30" id="main-header">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
        {/* Brand & Main Navigation */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-stone-900 to-stone-800 text-white flex items-center justify-center font-black text-sm shadow-xs">
              S
            </div>
            <span className="text-sm font-black text-stone-900 tracking-tight hidden xs:inline">Studio</span>
          </div>

          {/* Module Switcher Tabs */}
          <nav className="flex items-center bg-stone-100/90 p-1 rounded-xl border border-stone-200/80 gap-1">
            {/* Fanqie */}
            <button
              type="button"
              onClick={() => onTabChange('downloader')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'downloader'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
              }`}
              id="tab-fanqie-downloader"
              title="Fanqie"
            >
              <Download className={`w-3.5 h-3.5 ${activeTab === 'downloader' ? 'text-red-600' : 'text-stone-500'}`} />
              <span className="hidden md:inline">Fanqie</span>
            </button>

            {/* Qimao */}
            <button
              type="button"
              onClick={() => onTabChange('qimao')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'qimao'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
              }`}
              id="tab-qimao-downloader"
              title="Qimao"
            >
              <BookOpen className={`w-3.5 h-3.5 ${activeTab === 'qimao' ? 'text-amber-600' : 'text-stone-500'}`} />
              <span className="hidden md:inline">Qimao</span>
            </button>

            {/* Đối Chiếu */}
            <button
              type="button"
              onClick={() => onTabChange('align')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'align'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
              }`}
              id="tab-align"
              title="Đối chiếu Raw - Dịch"
            >
              <Languages className={`w-3.5 h-3.5 ${activeTab === 'align' ? 'text-emerald-600' : 'text-stone-500'}`} />
              <span className="hidden md:inline">Đối Chiếu</span>
            </button>
          </nav>
        </div>

        {/* Right Tools: Icon-Only */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Tiêu đề chương */}
          {onOpenChapterTitlesModal && (
            <button
              onClick={onOpenChapterTitlesModal}
              className="p-2 sm:p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
              id="btn-nav-chapter-titles"
              title="Tiêu đề chương"
              aria-label="Tiêu đề chương"
            >
              <FileText className="w-4 h-4 text-rose-600" />
            </button>
          )}

          {/* Bìa HD Fanqie */}
          {onOpenHdCoverModal && (
            <button
              onClick={onOpenHdCoverModal}
              className="p-2 sm:p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
              id="btn-nav-hd-cover"
              title="Bìa HD"
              aria-label="Bìa HD"
            >
              <ImageIcon className="w-4 h-4 text-red-600" />
            </button>
          )}

          {/* Truyện đã lưu */}
          {onOpenSavedBooks && (
            <button
              onClick={onOpenSavedBooks}
              className="relative p-2 sm:p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
              id="btn-nav-saved-books"
              title="Truyện đã lưu"
              aria-label="Truyện đã lưu"
            >
              <Bookmark className="w-4 h-4 text-amber-600 fill-amber-500" />
              {savedCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full font-bold text-[9px] shadow-xs">
                  {savedCount}
                </span>
              )}
            </button>
          )}

          {/* Lock / Logout */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 sm:p-2.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 border border-transparent hover:border-stone-200 transition-all cursor-pointer"
              id="btn-nav-lock"
              title="Khóa"
              aria-label="Khóa"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
