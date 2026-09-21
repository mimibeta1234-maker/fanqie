import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Copy,
  Check,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Layers,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import { HdCoverData } from '../types';

interface HdCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoverUrl?: string;
  initialBookName?: string;
  initialAuthor?: string;
}

type CoverQuality = 'original' | 'hd2k' | 'hd1200' | 'png';

export const HdCoverModal: React.FC<HdCoverModalProps> = ({
  isOpen,
  onClose,
  initialCoverUrl,
  initialBookName,
  initialAuthor
}) => {
  const [inputQuery, setInputQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [coverData, setCoverData] = useState<HdCoverData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<CoverQuality>('original');
  const [copied, setCopied] = useState<boolean>(false);
  const [bgMode, setBgMode] = useState<'dark' | 'light' | 'check'>('dark');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [downloading, setDownloading] = useState<boolean>(false);

  // Extract cover function
  const extractCover = async (input: string, name?: string, author?: string) => {
    if (!input.trim()) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({
        input: input.trim(),
        bookName: name || '',
        author: author || ''
      });
      const res = await fetch(`/api/book/cover/extract?${params.toString()}`);
      const data = await res.json();
      if (!data.success || !data.cover) {
        throw new Error(data.error || 'Không thể trích xuất bìa HD');
      }
      setCoverData(data.cover);
      setZoomLevel(1);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi trích xuất bìa');
    } finally {
      setLoading(false);
    }
  };

  // When modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      if (initialCoverUrl) {
        setInputQuery(initialCoverUrl);
        extractCover(initialCoverUrl, initialBookName, initialAuthor);
      } else {
        setCoverData(null);
        setErrorMessage(null);
        setInputQuery('');
      }
    }
  }, [isOpen, initialCoverUrl, initialBookName, initialAuthor]);

  if (!isOpen) return null;

  // Determine current active URL based on quality
  const getCurrentUrl = (): string => {
    if (!coverData) return '';
    switch (selectedQuality) {
      case 'original':
        return coverData.originalUrl || coverData.rawUrl || '';
      case 'hd2k':
        return coverData.hd2kUrl || coverData.originalUrl || coverData.rawUrl || '';
      case 'hd1200':
        return coverData.hd1200Url || coverData.originalUrl || coverData.rawUrl || '';
      case 'png':
        return coverData.pngUrl || coverData.originalUrl || coverData.rawUrl || '';
      default:
        return coverData.originalUrl || coverData.rawUrl || '';
    }
  };

  const currentUrl = getCurrentUrl();

  const handleCopyLink = async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = async () => {
    if (!currentUrl) return;
    setDownloading(true);
    try {
      const safeTitle = (coverData?.bookName || initialBookName || 'Fanqie')
        .replace(/[^a-zA-Z0-9À-ỹ\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const ext = selectedQuality === 'png' ? 'png' : 'jpg';
      const filename = `Bia_${safeTitle}_${selectedQuality.toUpperCase()}.${ext}`;

      const downloadUrl = `/api/book/cover/download?url=${encodeURIComponent(currentUrl)}&filename=${encodeURIComponent(filename)}`;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      id="hd-cover-modal"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:px-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shadow-xs">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900 text-base">Trích Xuất Bìa HD Fanqie</h3>
                <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Ultra HD
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Lấy ảnh bìa gốc nguyên bản chất lượng cao nhất từ máy chủ ByteDance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
            id="btn-close-hd-cover-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Bar (Allows extracting any novel cover anytime) */}
        <div className="p-3 sm:px-5 bg-stone-100/60 border-b border-stone-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              extractCover(inputQuery);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Dán link truyện, ID truyện hoặc link ảnh bìa Fanqie..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputQuery.trim()}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{loading ? 'Đang trích xuất...' : 'Trích xuất'}</span>
            </button>
          </form>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-stone-400 gap-3">
              <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium text-stone-600">Đang phân tích cấu trúc CDN & trích xuất bìa gốc Ultra HD...</p>
            </div>
          ) : coverData ? (
            <div className="space-y-4">
              {/* Novel info heading */}
              <div className="flex items-baseline justify-between gap-2 border-b border-stone-100 pb-2">
                <div>
                  <h4 className="font-bold text-stone-900 text-sm sm:text-base">
                    {coverData.bookName || initialBookName || 'Truyện Fanqie'}
                  </h4>
                  {(coverData.author || initialAuthor) && (
                    <p className="text-xs text-stone-500">Tác giả: {coverData.author || initialAuthor}</p>
                  )}
                </div>
                <span className="text-[11px] font-mono text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                  Hash: {coverData.hash.slice(0, 8)}...
                </span>
              </div>

              {/* Quality selector tabs */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-stone-400" />
                  <span>Chọn độ phân giải trích xuất</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedQuality('original')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedQuality === 'original'
                        ? 'bg-red-50/80 border-red-400 ring-1 ring-red-400 text-red-900'
                        : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Bìa Gốc (Master)</span>
                      <span className="text-[9px] bg-red-600 text-white font-extrabold px-1 rounded">GỐC</span>
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5">Không nén, chi tiết gốc 100%</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedQuality('hd2k')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedQuality === 'hd2k'
                        ? 'bg-red-50/80 border-red-400 ring-1 ring-red-400 text-red-900'
                        : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Siêu Nét 2K</span>
                      <span className="text-[9px] bg-amber-600 text-white font-extrabold px-1 rounded">1600p</span>
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5">Phóng to 1600px cực nét</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedQuality('hd1200')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedQuality === 'hd1200'
                        ? 'bg-red-50/80 border-red-400 ring-1 ring-red-400 text-red-900'
                        : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Chuẩn HD</span>
                      <span className="text-[9px] bg-stone-600 text-white font-extrabold px-1 rounded">1200p</span>
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5">Chuẩn bìa ebook điện tử</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedQuality('png')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedQuality === 'png'
                        ? 'bg-red-50/80 border-red-400 ring-1 ring-red-400 text-red-900'
                        : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Định dạng PNG</span>
                      <span className="text-[9px] bg-sky-600 text-white font-extrabold px-1 rounded">PNG</span>
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5">Không suy hao chất lượng</p>
                  </button>
                </div>
              </div>

              {/* Preview Stage */}
              <div className="relative rounded-xl border border-stone-300 overflow-hidden group">
                {/* Control Overlay Bar */}
                <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-white text-xs">
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2.5))}
                    className="p-1 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Phóng to"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.75))}
                    className="p-1 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Thu nhỏ"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="p-1 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Đặt lại zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-stone-300 font-mono pl-1 border-l border-white/20">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  {/* Background toggle */}
                  <div className="flex items-center gap-1 pl-1 border-l border-white/20">
                    <button
                      type="button"
                      onClick={() => setBgMode('dark')}
                      className={`w-3.5 h-3.5 rounded-full border ${bgMode === 'dark' ? 'bg-stone-900 border-white ring-1 ring-amber-400' : 'bg-stone-800 border-stone-500'}`}
                      title="Nền tối"
                    />
                    <button
                      type="button"
                      onClick={() => setBgMode('light')}
                      className={`w-3.5 h-3.5 rounded-full border ${bgMode === 'light' ? 'bg-white border-white ring-1 ring-amber-400' : 'bg-stone-200 border-stone-400'}`}
                      title="Nền sáng"
                    />
                  </div>
                </div>

                {/* Canvas image container */}
                <div
                  className={`h-72 sm:h-96 flex items-center justify-center overflow-hidden transition-colors ${
                    bgMode === 'dark'
                      ? 'bg-stone-950'
                      : bgMode === 'light'
                      ? 'bg-stone-100'
                      : 'bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] bg-white'
                  }`}
                >
                  <img
                    src={currentUrl}
                    alt={coverData.bookName || 'Bìa HD'}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // If HD byteimg fails (e.g. signed CDN token required), fallback to raw URL if available
                      if (coverData.rawUrl && e.currentTarget.src !== coverData.rawUrl) {
                        e.currentTarget.src = coverData.rawUrl;
                      }
                    }}
                    style={{ transform: `scale(${zoomLevel})` }}
                    className="max-h-full object-contain shadow-2xl transition-transform duration-200 rounded-sm"
                  />
                </div>
              </div>

              {/* Info notice */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-900">
                <FileCheck2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <p className="font-semibold">Đảm bảo độ phân giải gốc HD/2K:</p>
                  <p className="text-[11px] text-amber-800">
                    Ảnh được trích xuất trực tiếp từ máy chủ lưu trữ gốc của ByteDance (`p3-novel.byteimg.com`), 
                    loại bỏ hoàn toàn các bộ lọc nén thu nhỏ (~tplv-resize:225:300) của giao diện web/app để đạt độ nét tối đa.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-stone-400 space-y-2">
              <ImageIcon className="w-12 h-12 mx-auto text-stone-300 stroke-1" />
              <p className="text-xs">Nhập liên kết truyện hoặc ID sách Fanqie ở trên để bắt đầu trích xuất bìa HD.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {coverData && (
          <div className="p-3.5 sm:px-5 border-t border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Sao chép liên kết ảnh chất lượng cao"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                <span>{copied ? 'Đã sao chép!' : 'Chép link HD'}</span>
              </button>

              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Mở ảnh kích thước gốc trong tab mới"
              >
                <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                <span>Mở tab mới</span>
              </a>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer"
              id="btn-download-hd-cover-file"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Đang chuẩn bị tải...' : `Tải Bìa ${selectedQuality === 'original' ? 'Gốc (HD)' : selectedQuality.toUpperCase()}`}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
