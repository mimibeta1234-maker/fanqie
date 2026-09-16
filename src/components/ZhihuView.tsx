import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  BookOpen,
  Eye,
  FileText,
  Key,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
  BookMarked,
  Type,
  ClipboardPaste,
  Globe
} from 'lucide-react';
import { ZhihuEntry, ZhihuStory } from '../types';

const POPULAR_TAGS = [
  { label: 'Tất cả (Mới nhất)', query: '' },
  { label: 'Chuyên mục & Bài viết', query: '专栏' },
  { label: 'Hỏi đáp & Diễn đàn', query: '故事' },
  { label: 'Ngôn tình', query: '偏执' },
  { label: 'Trọng sinh', query: '重生' },
  { label: 'Trinh thám & Hình sự', query: '刑侦' },
  { label: 'Cung đấu', query: '皇后' },
  { label: 'Giới giải trí', query: '顶流' },
  { label: 'Khoa học & Đời sống', query: '科普' },
];

export const ZhihuView: React.FC = () => {
  const [inputMode, setInputMode] = useState<'search' | 'direct'>('search');
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'txt' | 'epub'>('txt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Direct paste state
  const [directTitle, setDirectTitle] = useState('');
  const [directAuthor, setDirectAuthor] = useState('');
  const [directContent, setDirectContent] = useState('');

  // Story state
  const [currentStory, setCurrentStory] = useState<ZhihuStory | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [showFullAbstract, setShowFullAbstract] = useState(false);

  // Search / Browse state
  const [results, setResults] = useState<ZhihuEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  // Reader Modal State
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [readerTheme, setReaderTheme] = useState<'light' | 'sepia' | 'dark'>('light');
  const [readerFontSize, setReaderFontSize] = useState<number>(17);
  const [copied, setCopied] = useState(false);

  // Cookie settings modal
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [zhihuCookie, setZhihuCookie] = useState(() => {
    return localStorage.getItem('zhihu_custom_cookie') || '';
  });

  const handleSaveCookie = (cookieVal: string) => {
    setZhihuCookie(cookieVal);
    localStorage.setItem('zhihu_custom_cookie', cookieVal);
    setShowCookieModal(false);
  };

  useEffect(() => {
    fetchStories('', 1);
  }, []);

  const fetchStories = async (query: string, page: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/zhihu/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`
      );
      const data = await res.json();
      if (data.success) {
        setResults(data.list || []);
        setTotalCount(data.total || 0);
        setCurrentPage(page);
        setActiveSearchTerm(query);
      } else {
        setErrorMessage(data.error || 'Lỗi khi tải danh sách nội dung Zhihu');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = inputVal.trim();
    if (!q) {
      fetchStories('', 1);
      return;
    }
    if (q.startsWith('http') || q.includes('zhihu.com') || q.includes('onehu.xyz')) {
      handleLoadStory(q);
      return;
    }
    fetchStories(q, 1);
  };

  const handleDirectParseSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!directContent.trim()) {
      setErrorMessage('Vui lòng dán văn bản hoặc nội dung bài viết từ Zhihu vào khung bên dưới.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/zhihu/parse-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: directContent,
          title: directTitle,
          author: directAuthor,
          sourceUrl: 'direct://pasted'
        })
      });
      const data = await res.json();
      if (data.success && data.story) {
        setCurrentStory(data.story);
        setCurrentSectionIndex(0);
        setShowFullAbstract(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMessage(data.error || 'Không thể xử lý nội dung đã dán');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadStory = async (urlOrId: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const cookieParam = zhihuCookie ? `&cookie=${encodeURIComponent(zhihuCookie)}` : '';
      const res = await fetch(`/api/zhihu/detail?query=${encodeURIComponent(urlOrId)}${cookieParam}`);
      const data = await res.json();
      if (data.success && data.story) {
        setCurrentStory(data.story);
        setCurrentSectionIndex(0);
        setShowFullAbstract(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrorMessage(data.error || 'Không thể tải nội dung Zhihu');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (story: ZhihuStory, format: 'txt' | 'epub') => {
    setDownloading(true);
    try {
      if (format === 'txt') {
        const header = `【${story.title}】\n` +
          `Tác giả: ${story.author}\n` +
          `Nguồn: ${story.sourceUrl}\n` +
          `Thời gian: ${story.date}\n` +
          `Số chữ: ~${story.wordCount.toLocaleString()} chữ\n` +
          `Phân loại: ${story.tags.join(', ')}\n` +
          `Trạng thái: Đã mở khóa trọn vẹn (Studio)\n` +
          `--------------------------------------------------\n\n`;

        const fullContent = header + story.fullText;
        const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = story.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Zhihu_Story';
        a.download = `${cleanName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const res = await fetch('/api/zhihu/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            story,
            format: 'epub'
          })
        });

        if (!res.ok) {
          throw new Error('Lỗi khi xuất file EPUB');
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = story.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Zhihu_Story';
        a.download = `${cleanName}.epub`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setErrorMessage(`Lỗi khi tải file: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4" id="zhihu-view-container">
      {/* Top Controls Box */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs" id="zhihu-search-section">
        {/* Mode Switcher */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-3">
          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setInputMode('search')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                inputMode === 'search'
                  ? 'bg-white text-sky-800 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-sky-600" />
              <span>Tải qua Link / Tìm kiếm</span>
            </button>

            <button
              type="button"
              onClick={() => setInputMode('direct')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                inputMode === 'direct'
                  ? 'bg-white text-sky-800 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-sky-600" />
              <span>Dán nội dung Zhihu trực tiếp</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCookieModal(true)}
            className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-sky-700 font-medium cursor-pointer"
            title="Cài đặt Cookie Zhihu (Free hoặc VIP)"
          >
            <Key className="w-3 h-3 text-amber-500" />
            <span>{zhihuCookie ? 'Cookie Zhihu đã lưu ✓' : 'Cookie Zhihu'}</span>
          </button>
        </div>

        {/* Mode 1: Search / Link Form */}
        {inputMode === 'search' ? (
          <div>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                  <Search className="w-4 h-4" />
                </div>

                <input
                  type="text"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  placeholder="Dán link Zhihu (câu trả lời, câu hỏi, bài viết chuyên mục, truyện 盐选) hoặc từ khóa..."
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-stone-800 disabled:opacity-70"
                  id="input-zhihu-query"
                />
              </div>

              <button
                type="submit"
                disabled={loading || (!inputVal.trim() && results.length > 0)}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                id="btn-submit-zhihu-search"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang tải...</span>
                  </>
                ) : (
                  <span>Tìm / Tải</span>
                )}
              </button>
            </form>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-stone-100 mt-3">
              <span className="text-xs text-stone-400 font-medium">Gợi ý chủ đề:</span>
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => {
                    setInputVal(tag.query);
                    fetchStories(tag.query, 1);
                  }}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors cursor-pointer ${
                    activeSearchTerm === tag.query
                      ? 'bg-sky-50 border-sky-300 text-sky-800 font-semibold'
                      : 'bg-stone-100 hover:bg-sky-50 hover:text-sky-800 text-stone-600 border-stone-200'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Mode 2: Direct Paste Form */
          <form onSubmit={handleDirectParseSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={directTitle}
                onChange={e => setDirectTitle(e.target.value)}
                placeholder="Tiêu đề bài viết / câu hỏi (Tùy chọn, tự nhận diện nếu để trống)"
                className="px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <input
                type="text"
                value={directAuthor}
                onChange={e => setDirectAuthor(e.target.value)}
                placeholder="Tác giả Zhihu (Tùy chọn)"
                className="px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div className="relative">
              <textarea
                value={directContent}
                onChange={e => setDirectContent(e.target.value)}
                rows={5}
                placeholder="Dán văn bản hoặc nội dung HTML bạn vừa sao chép từ Zhihu vào đây... Hệ thống sẽ tự động lọc bỏ quảng cáo, chia chương và tạo file TXT/EPUB ngay tức thì!"
                className="w-full p-3 text-xs font-sans bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-stone-800"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-stone-500">
                Hỗ trợ mọi bài viết, câu trả lời miễn phí lẫn VIP đang mở trên trình duyệt.
              </span>

              <button
                type="submit"
                disabled={loading || !directContent.trim()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Xử lý & Tải về ngay</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 font-bold px-1 cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Story Detail & Download Section */}
      {currentStory ? (
        <div className="space-y-4">
          {/* Story Detail Card */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-xs" id="zhihu-story-detail-card">
            <div className="flex gap-4 sm:gap-5 items-start">
              {/* Cover badge */}
              <div className="w-20 sm:w-24 h-28 sm:h-32 shrink-0 bg-sky-50 rounded-lg overflow-hidden border border-sky-200 flex flex-col items-center justify-center text-sky-600 shadow-2xs p-2 text-center">
                <BookOpen className="w-6 h-6 mb-1.5 text-sky-600" />
                <span className="text-[11px] font-bold tracking-tight text-sky-900 leading-tight">
                  {currentStory.sourceType === 'onehu_yanxuan' ? '知乎盐选' : currentStory.sourceType === 'zhihu_article' ? '知乎专栏' : currentStory.sourceType === 'zhihu_question' ? '知乎问答' : '知乎内容'}
                </span>
                <span className="text-[9px] text-sky-600/80 font-medium">
                  {currentStory.vipNotice && !currentStory.unlocked
                    ? 'VIP Yanxuan'
                    : currentStory.contentType === 'vip_story' || currentStory.sourceType === 'onehu_yanxuan'
                    ? 'VIP 100%'
                    : 'Miễn Phí'}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 truncate">
                    {currentStory.title}
                  </h2>
                  
                  {/* Status Badge */}
                  {currentStory.vipNotice && !currentStory.unlocked ? (
                    <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 shrink-0 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>Zhihu 盐选 VIP</span>
                    </span>
                  ) : currentStory.contentType === 'vip_story' || currentStory.sourceType === 'onehu_yanxuan' ? (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>VIP Mở khóa 100%</span>
                    </span>
                  ) : currentStory.sourceType === 'zhihu_article' ? (
                    <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-sky-600" />
                      <span>Bài viết chuyên mục (Free)</span>
                    </span>
                  ) : currentStory.sourceType === 'zhihu_answer' ? (
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-blue-600" />
                      <span>Câu trả lời tuyển chọn (Free)</span>
                    </span>
                  ) : currentStory.sourceType === 'zhihu_question' ? (
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                      <span>Tuyển tập câu trả lời (Free)</span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-purple-600" />
                      <span>Nhập trực tiếp</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-stone-500">
                  <span className="text-stone-700 font-medium">Tác giả: {currentStory.author || '知乎专栏'}</span>
                  {currentStory.date && (
                    <>
                      <span>•</span>
                      <span>{currentStory.date}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{currentStory.wordCount.toLocaleString()} chữ</span>
                  {currentStory.sections.length > 1 && (
                    <>
                      <span>•</span>
                      <span className="bg-sky-50 text-sky-700 font-medium px-1.5 py-0.5 rounded">
                        {currentStory.sections.length} chương / phần
                      </span>
                    </>
                  )}
                </div>

                {/* VIP Yanxuan Guidance Notice */}
                {currentStory.vipNotice && !currentStory.unlocked && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900">
                          Chương VIP Yanxuan: {currentStory.vipNotice.chapterTitle}
                        </p>
                        <p className="text-amber-800 mt-0.5 leading-relaxed">
                          Thuộc chuyên mục <strong>{currentStory.vipNotice.columnTitle}</strong> (Dung lượng: {currentStory.vipNotice.wordCountText || '~11.000 chữ'}). 
                          Đây là chương truyện trả phí trên Zhihu.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/70">
                      <button
                        type="button"
                        onClick={() => {
                          setDirectTitle(currentStory.vipNotice?.chapterTitle || currentStory.title);
                          setDirectAuthor(currentStory.author || '知乎盐选专栏');
                          setDirectContent('');
                          setInputMode('direct');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-md shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        <span>Dán nội dung chương này để xuất file (3 giây)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowCookieModal(true)}
                        className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-600" />
                        <span>Nhập Cookie Zhihu VIP</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Abstract Preview */}
                {currentStory.paragraphs && currentStory.paragraphs.length > 0 && (
                  <div className="mt-2.5">
                    <p className={`text-xs text-stone-600 leading-relaxed ${showFullAbstract ? '' : 'line-clamp-2'}`}>
                      {currentStory.paragraphs.slice(0, 2).join(' ')}
                    </p>
                    {currentStory.paragraphs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowFullAbstract(!showFullAbstract)}
                        className="text-[11px] text-sky-700 hover:text-sky-800 font-medium mt-1 cursor-pointer"
                      >
                        {showFullAbstract ? 'Thu gọn' : 'Xem thêm'}
                      </button>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 mt-3.5 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsReaderOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold transition-colors cursor-pointer"
                    id="btn-open-zhihu-reader"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-600" />
                    <span>Đọc trực tuyến</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyText(currentStory.fullText)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-stone-400" />
                    <span>{copied ? 'Đã chép ✓' : 'Sao chép văn bản'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStory(null)}
                    className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 ml-auto cursor-pointer"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>Chọn nội dung khác</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Download Panel */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-xs" id="zhihu-download-panel">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-sky-600" />
                <span>Tải nội dung về máy</span>
              </h3>
              <span className="text-xs text-emerald-700 font-medium">Toàn văn chuẩn sạch</span>
            </div>

            <div className="mt-4 space-y-3">
              {/* Format selection */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-600 font-medium">Định dạng file tải về:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExportFormat('txt')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-semibold ${
                      exportFormat === 'txt'
                        ? 'bg-sky-50 border-sky-300 text-sky-900 shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-600" />
                    <span>TXT (Văn bản thuần)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('epub')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-semibold ${
                      exportFormat === 'epub'
                        ? 'bg-sky-50 border-sky-300 text-sky-900 shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <BookMarked className="w-3.5 h-3.5 text-sky-600" />
                    <span>EPUB (E-book)</span>
                  </button>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => handleDownload(currentStory, exportFormat)}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  id="btn-download-zhihu-story"
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang tạo file...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Tải file {exportFormat.toUpperCase()} về máy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STORY LIST / BROWSE VIEW - Clean, minimalist list like Fanqie */
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50/70 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-stone-700">
              <Compass className="w-3.5 h-3.5 text-sky-600" />
              <span>
                {activeSearchTerm ? (
                  <>Kết quả cho &ldquo;<strong>{activeSearchTerm}</strong>&rdquo; ({totalCount} mục)</>
                ) : (
                  <>Kho truyện & bài viết Zhihu ({totalCount.toLocaleString()} mục)</>
                )}
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 text-stone-500">
                <button
                  type="button"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => fetchStories(activeSearchTerm, currentPage - 1)}
                  className="p-1 rounded border border-stone-200 disabled:opacity-30 hover:bg-stone-100 cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span>{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => fetchStories(activeSearchTerm, currentPage + 1)}
                  className="p-1 rounded border border-stone-200 disabled:opacity-30 hover:bg-stone-100 cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* List Content */}
          {loading ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              <RefreshCw className="w-5 h-5 text-sky-600 animate-spin mx-auto mb-2" />
              <span>Đang tải nội dung Zhihu...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              Không tìm thấy nội dung nào với từ khóa này. Bạn có thể dán link trực tiếp hoặc chuyển sang tab &quot;Dán nội dung trực tiếp&quot;.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {results.map((item, idx) => (
                <div
                  key={`${item.id || 'zhihu'}-${idx}`}
                  className="p-3.5 sm:p-4 hover:bg-sky-50/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h4
                      onClick={() => handleLoadStory(item.url)}
                      className="text-sm font-semibold text-stone-900 hover:text-sky-600 transition-colors truncate cursor-pointer"
                    >
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-400">
                      {item.date && <span>{item.date}</span>}
                      <span>•</span>
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium text-[11px]">
                        Toàn văn
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLoadStory(item.url)}
                    className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    Chọn tải
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reader Modal */}
      {isReaderOpen && currentStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-3 sm:p-6" id="zhihu-reader-backdrop">
          <div
            className={`w-full max-w-3xl h-[88vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden border ${
              readerTheme === 'sepia'
                ? 'bg-[#fbf7ee] text-[#2c261e] border-amber-200'
                : readerTheme === 'dark'
                ? 'bg-stone-900 text-stone-200 border-stone-800'
                : 'bg-[#faf8f5] text-stone-900 border-stone-300'
            }`}
            id="zhihu-reader-container"
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between px-5 py-3 border-b ${
                readerTheme === 'dark' ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-white/90'
              }`}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <BookOpen className="w-4 h-4 text-sky-600 shrink-0" />
                <h3 className="font-semibold text-sm truncate">{currentStory.title}</h3>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Theme buttons */}
                <div className="flex items-center bg-stone-100 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setReaderTheme('light')}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                      readerTheme === 'light' ? 'bg-white font-bold shadow-2xs' : 'text-stone-500'
                    }`}
                  >
                    Sáng
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderTheme('sepia')}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                      readerTheme === 'sepia' ? 'bg-[#f4ecd8] font-bold shadow-2xs' : 'text-stone-500'
                    }`}
                  >
                    Vàng
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderTheme('dark')}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                      readerTheme === 'dark' ? 'bg-stone-800 text-white font-bold shadow-2xs' : 'text-stone-500'
                    }`}
                  >
                    Đêm
                  </button>
                </div>

                {/* Font size */}
                <div className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-lg text-xs">
                  <Type className="w-3 h-3 text-stone-400" />
                  <button
                    onClick={() => setReaderFontSize((prev) => Math.max(14, prev - 1))}
                    className="font-bold text-stone-600 hover:text-stone-900 px-0.5 cursor-pointer"
                  >
                    A-
                  </button>
                  <button
                    onClick={() => setReaderFontSize((prev) => Math.min(24, prev + 1))}
                    className="font-bold text-stone-600 hover:text-stone-900 px-0.5 cursor-pointer"
                  >
                    A+
                  </button>
                </div>

                {/* Close */}
                <button
                  type="button"
                  onClick={() => setIsReaderOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-header section selector if multi-section */}
            {currentStory.sections.length > 1 && (
              <div className="flex items-center gap-1.5 px-4 py-2 border-b border-stone-200/60 overflow-x-auto bg-stone-50 text-xs">
                {currentStory.sections.map((sec, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSectionIndex(idx)}
                    className={`px-2.5 py-1 rounded-md shrink-0 transition-colors cursor-pointer ${
                      currentSectionIndex === idx
                        ? 'bg-sky-600 text-white font-semibold'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
                    }`}
                  >
                    {sec.title || `Phần ${idx + 1}`}
                  </button>
                ))}
              </div>
            )}

            {/* Reader Content Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-4">
              {currentStory.sections.length > 1 && (
                <h4 className="font-bold text-base pb-2 border-b border-stone-200/50">
                  {currentStory.sections[currentSectionIndex]?.title}
                </h4>
              )}

              {(currentStory.sections.length > 1
                ? currentStory.sections[currentSectionIndex]?.content.split('\n\n')
                : currentStory.paragraphs
              ).map((p, idx) => (
                <p
                  key={idx}
                  style={{ fontSize: `${readerFontSize}px`, lineHeight: '1.8' }}
                  className="indent-6 text-justify"
                >
                  {p}
                </p>
              ))}

              {/* Section Nav */}
              {currentStory.sections.length > 1 && (
                <div className="flex items-center justify-between pt-6 mt-6 border-t border-stone-200/40">
                  <button
                    disabled={currentSectionIndex === 0}
                    onClick={() => setCurrentSectionIndex((prev) => Math.max(0, prev - 1))}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Phần trước</span>
                  </button>

                  <span className="text-xs text-stone-500 font-medium">
                    {currentSectionIndex + 1} / {currentStory.sections.length}
                  </span>

                  <button
                    disabled={currentSectionIndex === currentStory.sections.length - 1}
                    onClick={() => setCurrentSectionIndex((prev) => Math.min(currentStory.sections.length - 1, prev + 1))}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-300 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Phần sau</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zhihu Cookie Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                <Key className="w-4 h-4 text-amber-500" />
                <span>Cài đặt Cookie Zhihu (Free & VIP)</span>
              </div>
              <button
                onClick={() => setShowCookieModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500 leading-relaxed">
              Hỗ trợ cả <strong>tài khoản Zhihu Miễn Phí (Free)</strong> để tải các bài viết, câu trả lời chính thức không bị chặn chống bot 403, lẫn <strong>tài khoản VIP 盐选</strong> nếu bạn có gói thành viên riêng. Dán toàn bộ Cookie hoặc token <code className="bg-stone-100 px-1 py-0.5 rounded text-sky-700">z_c0</code>:
            </p>

            <textarea
              value={zhihuCookie}
              onChange={(e) => setZhihuCookie(e.target.value)}
              placeholder="Dán chuỗi Cookie từ trình duyệt zhihu.com..."
              rows={3}
              className="w-full p-2.5 text-xs font-mono bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSaveCookie('')}
                className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
              >
                Xóa Cookie
              </button>
              <button
                type="button"
                onClick={() => handleSaveCookie(zhihuCookie)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
              >
                Lưu cài đặt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
