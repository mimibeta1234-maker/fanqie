import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSearchOrFetch: (query: string) => void;
  loading: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearchOrFetch, loading }) => {
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((inputVal || '').trim()) {
      onSearchOrFetch((inputVal || '').trim());
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs" id="search-section">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
            <Search className="w-4 h-4" />
          </div>

          <input
            type="text"
            value={inputVal || ''}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Dán link Fanqie, ID truyện, hoặc tên truyện..."
            disabled={loading}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-stone-800 disabled:opacity-70"
            id="input-book-query"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !(inputVal || '').trim()}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          id="btn-submit-search"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tải...</span>
            </>
          ) : (
            <span>Tìm / Tải</span>
          )}
        </button>
      </form>
    </div>
  );
};
