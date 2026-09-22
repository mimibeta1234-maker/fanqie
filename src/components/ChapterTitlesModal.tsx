import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Search,
  ListOrdered,
  FileText,
  Layers,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { Chapter } from '../types';

export interface ChapterTitlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBookId?: string;
  initialBookTitle?: string;
  initialChapters?: Chapter[];
  source?: 'fanqie' | 'qimao';
}

export type TitleFormatMode = 'pure' | 'raw' | 'numbered' | 'prefixed';

/**
 * Strips chapter number prefixes like "第1章", "第123话", "1.", etc. to obtain the pure chapter title
 */
export function extractPureChapterTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle.trim();

  // 1. Strip patterns like "第123章", "第123话", "第123回", "第 123 章", "第123节"
  title = title.replace(/^第\s*[0-9一二三四五六七八九十百千万零]+\s*[章节回话部卷节]\s*[:：、.\s_-]*/i, '');

  // 2. Strip numeric prefix like "1. ", "01. ", "1、", "1: ", "1 - "
  title = title.replace(/^(?:chương|chap|c)?\s*\d+\s*[:：、.\s_-]+/i, '');

  title = title.trim();

  // Fallback to rawTitle if stripped result is empty (e.g. original title was purely "第1章")
  return title || rawTitle.trim();
}

export const ChapterTitlesModal: React.FC<ChapterTitlesModalProps> = ({
  isOpen,
  onClose,
  initialBookId = '',
  initialBookTitle = '',
  initialChapters = [],
  source = 'fanqie'
}) => {
  const [inputQuery, setInputQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState<string>(initialBookTitle || '');
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters || []);

  // Formatting settings
  const [formatMode, setFormatMode] = useState<TitleFormatMode>('pure'); // 'pure' is default (như ảnh mẫu)
  const [fromChapter, setFromChapter] = useState<number>(1);
  const [toChapter, setToChapter] = useState<number>(initialChapters?.length || 100);
  const [includeVolume, setIncludeVolume] = useState<boolean>(false);
  const [lineSpacing, setLineSpacing] = useState<'single' | 'double'>('single');
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      if (initialChapters && initialChapters.length > 0) {
        setChapters(initialChapters);
        setBookTitle(initialBookTitle || 'Truyện Fanqie');
        setFromChapter(1);
        setToChapter(initialChapters.length);
        setErrorMessage(null);
      } else if (initialBookId) {
        setInputQuery(initialBookId);
        fetchCatalog(initialBookId);
      } else {
        setChapters([]);
        setBookTitle('');
        setInputQuery('');
        setErrorMessage(null);
      }
    }
  }, [isOpen, initialBookId, initialBookTitle, initialChapters]);

  // Fetch catalog from server when user enters a link / ID
  const fetchCatalog = async (rawInput: string) => {
    const q = rawInput.trim();
    if (!q) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      if (source === 'qimao' || q.includes('qimao')) {
        const res = await fetch(`/api/qimao/catalog?id=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!data.success || !data.catalog) {
          throw new Error(data.error || 'Không thể tải mục lục Qimao');
        }
        const chs: Chapter[] = data.catalog.chapter_list || [];
        setChapters(chs);
        setBookTitle(data.catalog.book_name || initialBookTitle || 'Truyện Qimao');
        setFromChapter(1);
        setToChapter(chs.length || 1);
      } else {
        const res = await fetch(`/api/book/catalog?id=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!data.success || !data.catalog) {
          throw new Error(data.error || 'Không thể tải mục lục Fanqie');
        }
        const chs: Chapter[] = data.catalog.chapter_list || [];
        setChapters(chs);
        setBookTitle(data.catalog.book_name || initialBookTitle || 'Truyện Fanqie');
        setFromChapter(1);
        setToChapter(chs.length || 1);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi tải danh sách chương');
    } finally {
      setLoading(false);
    }
  };

  // Generate output text based on formatting options
  const formattedText = useMemo(() => {
    if (!chapters || chapters.length === 0) return '';

    const total = chapters.length;
    const startIdx = Math.max(0, Math.min(fromChapter - 1, total - 1));
    const endIdx = Math.max(startIdx + 1, Math.min(toChapter, total));

    const slice = chapters.slice(startIdx, endIdx);
    const lines: string[] = [];

    let currentVol = '';

    slice.forEach((ch, idx) => {
      const chapterNum = startIdx + idx + 1;
      const raw = (ch.title || '').trim();
      const pure = extractPureChapterTitle(raw);

      if (includeVolume && ch.volume_title && ch.volume_title !== currentVol) {
        currentVol = ch.volume_title;
        if (lines.length > 0) lines.push('');
        lines.push(`=== ${currentVol} ===`);
      }

      let line = '';
      switch (formatMode) {
        case 'pure':
          // Pure title as in the sample image: "请问有吃的吗"
          line = pure;
          break;
        case 'raw':
          // Original title: "第1章 请问有吃的吗"
          line = raw;
          break;
        case 'numbered':
          // Numbered list: "1. 请问有吃的吗"
          line = `${chapterNum}. ${pure}`;
          break;
        case 'prefixed':
          // Standard chapter label: "Chương 1: 请问有吃的吗"
          line = `Chương ${chapterNum}: ${pure}`;
          break;
        default:
          line = pure;
      }

      lines.push(line);
    });

    const separator = lineSpacing === 'double' ? '\n\n' : '\n';
    return lines.join(separator);
  }, [chapters, fromChapter, toChapter, formatMode, includeVolume, lineSpacing]);

  const totalLines = useMemo(() => {
    if (!formattedText) return 0;
    return formattedText.split('\n').filter(l => l.trim().length > 0).length;
  }, [formattedText]);

  const handleCopy = async () => {
    if (!formattedText) return;
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleDownloadTxt = () => {
    if (!formattedText) return;
    setDownloading(true);
    try {
      const safeTitle = (bookTitle || 'Fanqie_Truyen')
        .replace(/[^a-zA-Z0-9À-ỹ\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const filename = `Tieu_De_${safeTitle}_(${fromChapter}-${toChapter}).txt`;

      const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setDownloading(false), 600);
    }
  };

  const handleSelectAll = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      id="chapter-titles-modal"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:px-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900 text-base">Trích Xuất Tiêu Đề Chương</h3>
                <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Fanqie / Qimao
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Xuất danh sách tên chương tuần tự theo định dạng sạch phục vụ dịch thuật và mục lục
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer"
            id="btn-close-chapter-titles-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Input Bar for custom book link or ID */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchCatalog(inputQuery)}
                placeholder="Nhập ID truyện hoặc dán liên kết Fanqie / Qimao..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono"
                id="input-chapter-titles-query"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            </div>
            <button
              type="button"
              onClick={() => fetchCatalog(inputQuery)}
              disabled={loading || !inputQuery.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              id="btn-fetch-chapter-titles-catalog"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Đang trích xuất...' : 'Trích xuất'}</span>
            </button>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-red-500 hover:text-red-800 text-[11px] font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          )}

          {chapters.length > 0 ? (
            <div className="space-y-3.5">
              {/* Controls Grid */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="text-xs font-bold text-stone-900 truncate max-w-xs sm:max-w-md">
                      {bookTitle}
                    </span>
                    <span className="text-[11px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded-md font-semibold">
                      {chapters.length} chương
                    </span>
                  </div>

                  {/* Range Selector */}
                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <span className="text-[11px] font-medium text-stone-500">Từ:</span>
                    <input
                      type="number"
                      min={1}
                      max={chapters.length}
                      value={fromChapter}
                      onChange={(e) => setFromChapter(Math.max(1, Math.min(Number(e.target.value) || 1, chapters.length)))}
                      className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded-md focus:outline-none focus:border-red-500 text-xs"
                    />
                    <span className="text-[11px] font-medium text-stone-500">Đến:</span>
                    <input
                      type="number"
                      min={fromChapter}
                      max={chapters.length}
                      value={toChapter}
                      onChange={(e) => setToChapter(Math.max(fromChapter, Math.min(Number(e.target.value) || chapters.length, chapters.length)))}
                      className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded-md focus:outline-none focus:border-red-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => { setFromChapter(1); setToChapter(chapters.length); }}
                      className="text-[10px] text-red-600 hover:text-red-700 font-bold ml-1 cursor-pointer"
                    >
                      Tất cả
                    </button>
                  </div>
                </div>

                {/* Format Mode Selectors */}
                <div>
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400" />
                    <span>Định dạng tiêu đề hiển thị</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormatMode('pure')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        formatMode === 'pure'
                          ? 'bg-red-50/80 border-red-400 ring-1 ring-red-400 text-red-900'
                          : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                      }`}
                      title="Thuần tên chương như ảnh mẫu, lược bỏ 第X章"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Thuần tên (Mẫu)</span>
                        <span className="text-[9px] bg-red-600 text-white font-extrabold px-1 rounded">CHUẨN</span>
                      </div>
                      <p className="text-[10px] text-stone-500 mt-0.5 font-mono truncate">请问有吃的吗</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormatMode('raw')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        formatMode === 'raw'
                          ? 'bg-red-50/80 border-red-400 ring-1 ring-red-400 text-red-900'
                          : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                      }`}
                      title="Giữ nguyên gốc từ mục lục Fanqie"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Tiêu đề gốc</span>
                        <span className="text-[9px] bg-stone-600 text-white font-extrabold px-1 rounded">GỐC</span>
                      </div>
                      <p className="text-[10px] text-stone-500 mt-0.5 font-mono truncate">第1章 请问有吃的吗</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormatMode('numbered')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        formatMode === 'numbered'
                          ? 'bg-red-50/80 border-red-400 ring-1 ring-red-400 text-red-900'
                          : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                      }`}
                      title="Đánh số thứ tự 1, 2, 3..."
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Đánh số thứ tự</span>
                        <span className="text-[9px] bg-amber-600 text-white font-extrabold px-1 rounded">1, 2, 3</span>
                      </div>
                      <p className="text-[10px] text-stone-500 mt-0.5 font-mono truncate">1. 请问有吃的吗</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormatMode('prefixed')}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        formatMode === 'prefixed'
                          ? 'bg-red-50/80 border-red-400 ring-1 ring-red-400 text-red-900'
                          : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                      }`}
                      title="Chương X: [Tên]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Chương X: Tên</span>
                        <span className="text-[9px] bg-sky-600 text-white font-extrabold px-1 rounded">VI</span>
                      </div>
                      <p className="text-[10px] text-stone-500 mt-0.5 font-mono truncate">Chương 1: 请问有吃的吗</p>
                    </button>
                  </div>
                </div>

                {/* Additional Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 pt-1 border-t border-stone-200/60">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeVolume}
                      onChange={(e) => setIncludeVolume(e.target.checked)}
                      className="rounded border-stone-300 text-red-600 focus:ring-red-500"
                    />
                    <span>Kèm tiêu đề phân quyển / volume</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-500">Giãn dòng:</span>
                    <button
                      type="button"
                      onClick={() => setLineSpacing('single')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        lineSpacing === 'single' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      Đơn
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineSpacing('double')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        lineSpacing === 'double' ? 'bg-stone-800 text-white' : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      Kép
                    </button>
                  </div>
                </div>
              </div>

              {/* Textarea Live Output */}
              <div className="relative">
                <div className="flex items-center justify-between pb-1.5 text-xs text-stone-500">
                  <span className="font-semibold text-stone-700">
                    Kết quả trích xuất ({totalLines} dòng):
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[11px] text-stone-500 hover:text-stone-800 underline cursor-pointer"
                  >
                    Bôi đen tất cả
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  value={formattedText}
                  readOnly
                  rows={12}
                  className="w-full p-3.5 bg-stone-900 text-stone-100 font-mono text-xs sm:text-sm leading-relaxed rounded-xl border border-stone-700 focus:outline-none focus:ring-2 focus:ring-red-500 select-text resize-y shadow-inner"
                  id="textarea-chapter-titles-output"
                  spellCheck={false}
                />
              </div>
            </div>
          ) : (
            <div className="py-14 text-center text-stone-400 space-y-2">
              <ListOrdered className="w-12 h-12 mx-auto text-stone-300 stroke-1" />
              <p className="text-xs">
                Nhập liên kết hoặc ID sách ở trên, hoặc mở từ thông tin truyện để bắt đầu trích xuất tiêu đề chương.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {chapters.length > 0 && (
          <div className="p-3.5 sm:px-5 border-t border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-xs text-stone-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Tổng cộng <strong>{totalLines}</strong> tiêu đề chương</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                id="btn-copy-chapter-titles"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-stone-500" />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép tất cả'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                disabled={downloading}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer"
                id="btn-download-chapter-titles-txt"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'Đang xuất file...' : 'Tải file TXT'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
