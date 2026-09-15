import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  BookOpen,
  Search,
  ExternalLink,
  Layers,
  Check,
  AlertTriangle,
  RefreshCw,
  Copy,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  FileCode,
  Eye,
  Loader2,
  FileCheck2,
  Maximize2,
  Minimize2,
  AlignLeft,
  Sparkles,
  Globe,
  Printer,
} from 'lucide-react';

interface ScribdDocInfo {
  id: string;
  title: string;
  pageCount: number;
  url: string;
  embedUrl?: string;
  author?: string;
  previewText?: string;
  availableFormats: ('pdf' | 'txt' | 'docx')[];
}

interface ScribdPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
}

export const ScribdView: React.FC = () => {
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docInfo, setDocInfo] = useState<ScribdDocInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'print_pdf' | 'html' | 'docx' | 'txt' | 'pdf'>('print_pdf');
  const [pageRangeMode, setPageRangeMode] = useState<'all' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState(1);
  const [customTo, setCustomTo] = useState(10);
  const [extractedPages, setExtractedPages] = useState<ScribdPage[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<'embed' | 'text'>('embed');
  const [currentPreviewPage, setCurrentPreviewPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [pageCopied, setPageCopied] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [jumpPageInput, setJumpPageInput] = useState('1');

  // Keyboard navigation for reader
  useEffect(() => {
    if (!isPreviewOpen || previewTab !== 'text') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleJumpPage(currentPreviewPage - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleJumpPage(currentPreviewPage + 1);
      } else if (e.key === 'Escape') {
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen, previewTab, currentPreviewPage, extractedPages.length]);

  const handleFetchDoc = async (query: string) => {
    setLoading(true);
    setError(null);
    setDocInfo(null);
    setExtractedPages([]);

    try {
      const res = await fetch(`/api/scribd/info?query=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không tìm thấy tài liệu Scribd với đường dẫn/ID này');
      }

      const info = data.info || data.doc;
      setDocInfo(info);
      setCustomFrom(1);
      setCustomTo(Math.min(info.pageCount, 50));
      setCurrentPreviewPage(1);
      setJumpPageInput('1');
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối khi trích xuất tài liệu Scribd');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      handleFetchDoc(inputQuery.trim());
    }
  };

  const handlePrintOriginal = () => {
    if (!docInfo) return;
    const from = pageRangeMode === 'custom' ? customFrom : 1;
    const to = pageRangeMode === 'custom' ? customTo : docInfo.pageCount;
    const printUrl = `/api/scribd/print?id=${encodeURIComponent(docInfo.id)}&from=${from}&to=${to}&autoprint=true`;
    window.open(printUrl, '_blank');
  };

  const handleDownload = async () => {
    if (!docInfo) return;

    if (selectedFormat === 'print_pdf') {
      handlePrintOriginal();
      return;
    }

    setDownloading(true);
    setError(null);

    const from = pageRangeMode === 'custom' ? customFrom : 1;
    const to = pageRangeMode === 'custom' ? customTo : docInfo.pageCount;

    try {
      const downloadUrl = `/api/scribd/download?id=${encodeURIComponent(docInfo.id)}&format=${selectedFormat}&from=${from}&to=${to}`;
      const res = await fetch(downloadUrl);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Tải tài liệu thất bại (HTTP ${res.status})`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html') && selectedFormat !== 'html') {
        const text = await res.text();
        if (text.includes('__cookie_check')) {
          throw new Error('Scribd đang giới hạn kết nối nhanh. Vui lòng thử lại sau vài giây.');
        }
        try {
          const json = JSON.parse(text);
          if (json.error) throw new Error(json.error);
        } catch {
          // Not json
        }
      }

      const blob = await res.blob();
      const safeTitle = (docInfo.title || `Scribd_${docInfo.id}`)
        .replace(/[\\/:*?"<>|]/g, '_')
        .trim()
        .slice(0, 100);
      const fileName = `${safeTitle}.${selectedFormat}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải file');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenPreview = async () => {
    if (!docInfo) return;
    setIsPreviewOpen(true);

    if (extractedPages.length > 0) return;

    setLoadingPages(true);
    try {
      const from = 1;
      const to = Math.min(docInfo.pageCount, 100);
      const res = await fetch(`/api/scribd/pages?id=${encodeURIComponent(docInfo.id)}&from=${from}&to=${to}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setExtractedPages(data.pages);
        setCurrentPreviewPage(1);
        setJumpPageInput('1');
      }
    } catch (err: any) {
      // Background fetch error for text, embed view still works fine
    } finally {
      setLoadingPages(false);
    }
  };

  const handleCopyPageText = async () => {
    if (!currentPageObj?.text) return;
    try {
      await navigator.clipboard.writeText(currentPageObj.text);
      setPageCopied(true);
      setTimeout(() => setPageCopied(false), 2000);
    } catch {}
  };

  const handleCopyAllText = async () => {
    if (!docInfo) return;

    try {
      let fullText = '';
      if (extractedPages.length > 0) {
        fullText = extractedPages
          .filter((p) => p.text && p.text.trim())
          .map((p) => `--- Trang ${p.pageNumber} ---\n${p.text}`)
          .join('\n\n');
      } else {
        const res = await fetch(`/api/scribd/pages?id=${encodeURIComponent(docInfo.id)}`);
        const data = await res.json();
        if (data.pages) {
          fullText = data.pages
            .filter((p: any) => p.text && p.text.trim())
            .map((p: any) => `--- Trang ${p.pageNumber} ---\n${p.text}`)
            .join('\n\n');
        }
      }

      if (fullText) {
        await navigator.clipboard.writeText(fullText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      setError('Không thể sao chép vào bộ nhớ tạm');
    }
  };

  const currentPageObj = extractedPages.find((p) => p.pageNumber === currentPreviewPage);

  const handleJumpPage = (target: number) => {
    const valid = Math.max(1, Math.min(extractedPages.length || docInfo?.pageCount || 1, target));
    setCurrentPreviewPage(valid);
    setJumpPageInput(String(valid));
  };

  return (
    <div className="space-y-4" id="scribd-downloader-view">
      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs" id="scribd-search-section">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
              <Search className="w-4 h-4" />
            </div>

            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Dán link Scribd hoặc ID tài liệu (ví dụ: 909832905)..."
              disabled={loading}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-stone-800 disabled:opacity-70"
              id="input-scribd-query"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            id="btn-submit-scribd"
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

      {/* Error message */}
      {error && (
        <div
          className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between gap-2"
          id="scribd-error-banner"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-bold px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Document Details & Download Panel */}
      {docInfo && (
        <div
          className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden space-y-0"
          id="scribd-document-card"
        >
          {/* Header Bar */}
          <div className="p-4 sm:p-5 border-b border-stone-100 bg-stone-50/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-12 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex flex-col items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
                <span className="text-[9px] font-bold uppercase mt-0.5">DOC</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  className="text-base font-bold text-stone-900 leading-snug tracking-tight mb-1"
                  id="scribd-doc-title"
                >
                  {docInfo.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 bg-stone-200/70 text-stone-700 rounded-md">
                    <Layers className="w-3 h-3" />
                    {docInfo.pageCount} trang
                  </span>
                  <span>•</span>
                  <span>
                    ID: <code className="font-mono text-stone-700">{docInfo.id}</code>
                  </span>
                  <span>•</span>
                  <a
                    href={docInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    <span>Xem trên Scribd</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {docInfo.previewText && (
              <div className="mt-3 p-2.5 bg-white rounded-lg border border-stone-200/70 text-xs text-stone-600 leading-relaxed line-clamp-2">
                <span className="font-semibold text-stone-700">Trích đoạn mở đầu: </span>
                {docInfo.previewText}
              </div>
            )}
          </div>

          {/* Download Options */}
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Định dạng xuất file
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3" id="format-selector-group">
                {/* Print / Save Original PDF */}
                <button
                  type="button"
                  onClick={() => setSelectedFormat('print_pdf')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                    selectedFormat === 'print_pdf'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/30'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                  id="format-option-print-pdf"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <span>📄 PDF Gốc (1:1)</span>
                      <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">Chuẩn</span>
                    </span>
                    {selectedFormat === 'print_pdf' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">Giữ nguyên 100% hình ảnh & layout</p>
                </button>

                {/* HTML Offline */}
                <button
                  type="button"
                  onClick={() => setSelectedFormat('html')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                    selectedFormat === 'html'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/30'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                  id="format-option-html"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-stone-900 text-xs sm:text-sm">Web (.html)</span>
                    {selectedFormat === 'html' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">Mở đọc offline trên mọi máy</p>
                </button>

                {/* DOCX */}
                <button
                  type="button"
                  onClick={() => setSelectedFormat('docx')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                    selectedFormat === 'docx'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/30'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                  id="format-option-docx"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-stone-900 text-xs sm:text-sm">Word (.docx)</span>
                    {selectedFormat === 'docx' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">Dễ dàng chỉnh sửa văn bản</p>
                </button>

                {/* TXT */}
                <button
                  type="button"
                  onClick={() => setSelectedFormat('txt')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                    selectedFormat === 'txt'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/30'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                  id="format-option-txt"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-stone-900 text-xs sm:text-sm">Văn Bản (.txt)</span>
                    {selectedFormat === 'txt' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">Văn bản thuần siêu nhẹ</p>
                </button>
              </div>
            </div>

            {/* Page Range Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                Phạm vi trang
              </label>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-stone-700">
                  <input
                    type="radio"
                    name="pageRange"
                    checked={pageRangeMode === 'all'}
                    onChange={() => setPageRangeMode('all')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Tất cả ({docInfo.pageCount} trang)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-stone-700">
                  <input
                    type="radio"
                    name="pageRange"
                    checked={pageRangeMode === 'custom'}
                    onChange={() => setPageRangeMode('custom')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Tùy chọn:</span>
                </label>

                {pageRangeMode === 'custom' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-500">Từ</span>
                    <input
                      type="number"
                      min={1}
                      max={customTo}
                      value={customFrom}
                      onChange={(e) => setCustomFrom(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 h-7 px-1 border border-stone-300 rounded text-center text-xs font-medium"
                    />
                    <span className="text-stone-500">đến</span>
                    <input
                      type="number"
                      min={customFrom}
                      max={docInfo.pageCount}
                      value={customTo}
                      onChange={(e) =>
                        setCustomTo(
                          Math.min(docInfo.pageCount, parseInt(e.target.value, 10) || docInfo.pageCount)
                        )
                      }
                      className="w-14 h-7 px-1 border border-stone-300 rounded text-center text-xs font-medium"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="h-10 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  id="btn-download-scribd-now"
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xử lý {selectedFormat.toUpperCase()}...</span>
                    </>
                  ) : selectedFormat === 'print_pdf' ? (
                    <>
                      <Printer className="w-4 h-4" />
                      <span>In / Xuất PDF Bản Gốc (1:1)</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải {selectedFormat.toUpperCase()}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePrintOriginal}
                  className="h-10 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-amber-200"
                  id="btn-print-direct-original"
                  title="Mở giao diện in PDF chuẩn gốc"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-700" />
                  <span>Mở Bản In PDF Gốc (Ctrl+P)</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenPreview}
                  className="h-10 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-stone-200"
                  id="btn-preview-scribd-doc"
                >
                  <BookOpen className="w-3.5 h-3.5 text-stone-500" />
                  <span>Xem trước / Đọc tài liệu</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAllText}
                  className="h-10 px-3.5 bg-white hover:bg-stone-50 text-stone-700 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-stone-200"
                  id="btn-copy-scribd-text"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-green-700 font-medium">Đã chép text</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-stone-400" />
                      <span>Chép text</span>
                    </>
                  )}
                </button>
              </div>

              {selectedFormat === 'print_pdf' && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">💡</span>
                  <div className="leading-relaxed">
                    <span className="font-semibold">Mẹo xuất PDF chuẩn nét:</span> Khi nhấn <strong>In / Xuất PDF Bản Gốc</strong>, cửa sổ in sẽ mở ra. Tại mục <em>Máy in đích (Destination)</em>, hãy chọn <strong>"Lưu dưới dạng PDF" (Save as PDF)</strong> để lưu lại toàn bộ file với layout và hình ảnh nguyên bản 100%.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reader & Document Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[94vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-stone-200 flex items-center justify-between bg-stone-50/90">
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2 text-xs text-stone-500 mb-0.5">
                  <span className="font-semibold text-blue-700">Trình đọc tài liệu</span>
                  <span>•</span>
                  <span>{docInfo?.pageCount} trang</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">{docInfo?.title}</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintOriginal}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                  title="In / Lưu thành file PDF 1:1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In / Lưu PDF Gốc</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Tải {selectedFormat.toUpperCase()}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Navigation & Tab Bar */}
            <div className="px-5 py-2.5 border-b border-stone-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Tab Selector */}
              <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200/60">
                <button
                  type="button"
                  onClick={() => setPreviewTab('embed')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    previewTab === 'embed'
                      ? 'bg-white shadow-xs text-blue-700 font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bản gốc Scribd</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('text')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    previewTab === 'text'
                      ? 'bg-white shadow-xs text-blue-700 font-semibold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5 text-stone-600" />
                  <span>Văn bản trích xuất</span>
                </button>
              </div>

              {previewTab === 'text' && (
                <>
                  {/* Search */}
                  <div className="relative flex-1 max-w-xs">
                    <input
                      type="text"
                      placeholder="Tìm từ khóa..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-blue-500 bg-stone-50/50"
                    />
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>

                  {/* Page Navigator */}
                  <div className="flex items-center gap-2 text-stone-600">
                    <span>Trang:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={extractedPages.length || docInfo?.pageCount || 1}
                        value={jumpPageInput}
                        onChange={(e) => setJumpPageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleJumpPage(parseInt(jumpPageInput, 10) || 1);
                          }
                        }}
                        onBlur={() => handleJumpPage(parseInt(jumpPageInput, 10) || 1)}
                        className="w-12 h-7 px-1 text-center font-bold text-stone-900 border border-stone-300 rounded text-xs"
                      />
                      <span>/ {extractedPages.length || docInfo?.pageCount}</span>
                    </div>

                    <div className="flex items-center gap-1 ml-1">
                      <button
                        disabled={currentPreviewPage <= 1}
                        onClick={() => handleJumpPage(currentPreviewPage - 1)}
                        className="p-1 rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-40 cursor-pointer"
                        title="Trang trước (Phím ←)"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        disabled={currentPreviewPage >= (extractedPages.length || 1)}
                        onClick={() => handleJumpPage(currentPreviewPage + 1)}
                        className="p-1 rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-40 cursor-pointer"
                        title="Trang tiếp theo (Phím →)"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Content Body */}
            <div className="flex-1 overflow-hidden bg-stone-100 flex flex-col">
              {previewTab === 'embed' && docInfo?.id ? (
                <div className="w-full h-full relative bg-stone-900 flex flex-col">
                  <iframe
                    src={`https://www.scribd.com/embeds/${docInfo.id}/content?start_page=1&view_mode=scroll&access_key=key-fFexxf7r1bzEfWu3HKwf`}
                    title={docInfo.title}
                    className="w-full h-full border-0"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {loadingPages ? (
                    <div className="py-24 text-center">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                      <p className="text-sm font-semibold text-stone-800">Đang nạp dữ liệu trang...</p>
                    </div>
                  ) : currentPageObj ? (
                    <div className="max-w-3xl mx-auto space-y-4">
                      {/* Text View Card */}
                      {currentPageObj.text && currentPageObj.text.trim() ? (
                        <div className="bg-white p-6 sm:p-8 rounded-xl border border-stone-200 shadow-sm">
                          <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-100 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                TRANG {currentPageObj.pageNumber}
                              </span>
                              <span className="text-stone-400 font-mono">SCRIBD #{docInfo?.id}</span>
                            </div>

                            <button
                              type="button"
                              onClick={handleCopyPageText}
                              className="text-stone-600 hover:text-blue-700 flex items-center gap-1 font-medium cursor-pointer"
                            >
                              {pageCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-green-600" />
                                  <span className="text-green-600 font-semibold">Đã chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-stone-400" />
                                  <span>Chép trang này</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap font-serif selection:bg-blue-100">
                            {currentPageObj.text}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white p-12 rounded-xl border border-dashed border-stone-300 text-center shadow-xs">
                          <FileCheck2 className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-stone-700">
                            Trang {currentPageObj.pageNumber}: Trang đệm / Trang trống
                          </p>
                          <p className="text-xs text-stone-400 mt-1">
                            Tài liệu gốc không chứa văn bản trên trang này.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-stone-500 text-xs">
                      Không tìm thấy trang nào khớp với yêu cầu.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-stone-200 bg-white flex items-center justify-between text-xs text-stone-600">
              <div className="flex items-center gap-2">
                <span>Định dạng xuất:</span>
                <span className="font-bold uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                  {selectedFormat}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleCopyAllText}
                  className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép toàn bộ văn bản</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
