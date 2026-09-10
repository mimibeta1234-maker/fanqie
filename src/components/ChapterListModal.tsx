import React, { useState, useMemo } from 'react';
import { X, Search, BookOpen, ExternalLink, ArrowUpDown } from 'lucide-react';
import { Chapter } from '../types';

interface ChapterListModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  bookTitle: string;
  onPreviewChapter: (chapter: Chapter) => void;
}

export const ChapterListModal: React.FC<ChapterListModalProps> = ({
  isOpen,
  onClose,
  chapters,
  bookTitle,
  onPreviewChapter
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVolume, setSelectedVolume] = useState<string>('all');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Extract unique volume titles
  const volumes = useMemo(() => {
    const set = new Set<string>();
    chapters.forEach(c => {
      if (c.volume_title) set.add(c.volume_title);
    });
    return Array.from(set);
  }, [chapters]);

  // Filtered chapters
  const filteredChapters = useMemo(() => {
    let list = chapters.filter(c => {
      const matchSearch = searchTerm
        ? c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.item_id.includes(searchTerm)
        : true;
      const matchVolume = selectedVolume === 'all' || c.volume_title === selectedVolume;
      return matchSearch && matchVolume;
    });

    if (!sortAsc) {
      list = [...list].reverse();
    }
    return list;
  }, [chapters, searchTerm, selectedVolume, sortAsc]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-3 sm:p-6" id="catalog-modal-backdrop">
      <div className="w-full max-w-3xl h-[85vh] bg-white rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-stone-200" id="catalog-modal-container">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div>
            <h3 className="font-bold text-stone-900 text-base sm:text-lg">Mục lục chương ({chapters.length} chương)</h3>
            <p className="text-xs text-stone-500 truncate max-w-md">{bookTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors"
            id="btn-close-catalog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-stone-200 flex flex-wrap items-center gap-3 bg-white">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Tìm số chương hoặc tên chương..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              id="input-search-chapter"
            />
          </div>

          {volumes.length > 0 && (
            <select
              value={selectedVolume}
              onChange={e => setSelectedVolume(e.target.value)}
              className="text-xs sm:text-sm px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              id="select-volume-filter"
            >
              <option value="all">Tất cả các quyển ({volumes.length})</option>
              {volumes.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50 font-medium"
            id="btn-sort-chapters"
            title="Đảo thứ tự sắp xếp"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortAsc ? "Thứ tự 1 -> N" : "Mới nhất trước"}</span>
          </button>
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-stone-100">
          {filteredChapters.length === 0 ? (
            <div className="text-center py-16 text-stone-400 text-sm">
              Không tìm thấy chương nào phù hợp
            </div>
          ) : (
            filteredChapters.map((ch, idx) => (
              <div
                key={ch.item_id}
                className="py-3 px-2 flex items-center justify-between hover:bg-stone-50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3 overflow-hidden pr-3">
                  <span className="text-xs font-mono text-stone-400 w-9 text-right shrink-0">
                    {sortAsc ? idx + 1 : chapters.length - idx}
                  </span>
                  <div className="truncate">
                    <p className="text-sm font-medium text-stone-800 truncate group-hover:text-red-600 transition-colors">
                      {ch.title}
                    </p>
                    <p className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                      {ch.volume_title && <span>{ch.volume_title}</span>}
                      {ch.char_count > 0 && <span>• {ch.char_count.toLocaleString()} chữ</span>}
                      {ch.update_time && <span>• {ch.update_time}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onPreviewChapter(ch)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium border border-red-200 transition-colors"
                    title="Đọc thử chương này (Đã giải mã vượt khóa)"
                    id={`btn-read-chapter-${ch.item_id}`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Đọc thử</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
