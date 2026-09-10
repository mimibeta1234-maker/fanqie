import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSearchOrFetch: (query: string) => void;
  loading: boolean;
}

const SAMPLE_BOOKS = [
  { id: '7069948840148732967', title: '原始蛮荒部落' },
  { id: '7117195748957817892', title: '十日终焉' },
  { id: '7184497677840485387', title: '斩神' }
];

export const SearchBar: React.FC<SearchBarProps> = ({ onSearchOrFetch, loading }) => {
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSearchOrFetch(inputVal.trim());
    }
  };

  const handleSampleClick = (sampleId: string) => {
    setInputVal(sampleId);
    onSearchOrFetch(sampleId);
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
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Dán link Fanqie, ID truyện, hoặc tên truyện..."
            disabled={loading}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-stone-800 disabled:opacity-70"
            id="input-book-query"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !inputVal.trim()}
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

      {/* Quick sample chips */}
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-stone-500 overflow-x-auto pt-0.5">
        <span className="text-stone-400 shrink-0">Mẫu:</span>
        {SAMPLE_BOOKS.map(sample => (
          <button
            key={sample.id}
            type="button"
            onClick={() => handleSampleClick(sample.id)}
            disabled={loading}
            className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded text-xs transition-colors cursor-pointer shrink-0"
            id={`btn-sample-${sample.id}`}
          >
            {sample.title}
          </button>
        ))}
      </div>
    </div>
  );
};
