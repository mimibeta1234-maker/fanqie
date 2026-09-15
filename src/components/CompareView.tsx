import React, { useState, useEffect, useMemo } from 'react';
import {
  GitCompare,
  Upload,
  RotateCcw,
  FileText,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  Columns2,
  AlignLeft
} from 'lucide-react';
import { compareTextsWithChapters, OverallComparison, ChapterDiff } from '../utils/textDiff';

const COMPARE_DRAFT_KEY = 'fanqie_compare_draft_v1';

interface CompareDraft {
  textA: string;
  textB: string;
  fileNameA: string;
  fileNameB: string;
  selectedChapterIndex: number;
  searchFilter?: string;
  isInputsExpanded?: boolean;
  savedAt: number;
}

function getStoredCompareDraft(): Partial<CompareDraft> | null {
  try {
    const raw = localStorage.getItem(COMPARE_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data === 'object' && data !== null) {
      return data;
    }
    return null;
  } catch (err) {
    console.warn('Không thể đọc bản nháp so sánh từ localStorage:', err);
    return null;
  }
}

export const CompareView: React.FC = () => {
  // Read initial values from stored draft if present
  const [initialDraft] = useState<Partial<CompareDraft> | null>(() => getStoredCompareDraft());
  const [restoredFromDraft, setRestoredFromDraft] = useState<boolean>(() => {
    const d = getStoredCompareDraft();
    return Boolean(d?.textA?.trim() || d?.textB?.trim());
  });

  const [textA, setTextA] = useState<string>(() => initialDraft?.textA || '');
  const [textB, setTextB] = useState<string>(() => initialDraft?.textB || '');
  const [fileNameA, setFileNameA] = useState<string>(() => initialDraft?.fileNameA || '');
  const [fileNameB, setFileNameB] = useState<string>(() => initialDraft?.fileNameB || '');

  const [result, setResult] = useState<OverallComparison | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(() => {
    return typeof initialDraft?.selectedChapterIndex === 'number' ? initialDraft.selectedChapterIndex : 0;
  });
  const [searchFilter, setSearchFilter] = useState<string>(() => initialDraft?.searchFilter || '');
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [isInputsExpanded, setIsInputsExpanded] = useState<boolean>(() => {
    return initialDraft?.isInputsExpanded !== undefined ? initialDraft.isInputsExpanded : true;
  });

  // Diff Display Mode: 'inline' (track changes) vs 'split' (side-by-side 2 columns)
  const [diffViewMode, setDiffViewMode] = useState<'inline' | 'split'>('inline');
  // Filter for inline display: 'all' | 'new_only' | 'old_only'
  const [filterDisplay, setFilterDisplay] = useState<'all' | 'new_only' | 'old_only'>('all');

  // Auto-compare whenever textA or textB changes (Debounced 150ms)
  useEffect(() => {
    if (!(textA || '').trim() && !(textB || '').trim()) {
      setResult(null);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    const timer = setTimeout(() => {
      try {
        const comp = compareTextsWithChapters(textA, textB);
        setResult(comp);
        setSelectedChapterIndex((prev) => {
          if (comp.chapterResults.length === 0) return 0;
          return prev < comp.chapterResults.length ? prev : 0;
        });
      } catch (err) {
        console.error('Error comparing texts:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [textA, textB]);

  // Auto-save draft to localStorage whenever content changes (Debounced 300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const hasContent = Boolean(textA?.trim() || textB?.trim());
        if (!hasContent) {
          localStorage.removeItem(COMPARE_DRAFT_KEY);
        } else {
          const draft: CompareDraft = {
            textA,
            textB,
            fileNameA,
            fileNameB,
            selectedChapterIndex,
            searchFilter,
            isInputsExpanded,
            savedAt: Date.now()
          };
          localStorage.setItem(COMPARE_DRAFT_KEY, JSON.stringify(draft));
        }
      } catch (err) {
        console.warn('Không thể lưu bản nháp so sánh vào localStorage (vượt hạn mức dung lượng?):', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [textA, textB, fileNameA, fileNameB, selectedChapterIndex, searchFilter, isInputsExpanded]);

  // File Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      if (target === 'A') {
        setTextA(content);
        setFileNameA(file.name);
      } else {
        setTextB(content);
        setFileNameB(file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleReset = () => {
    setTextA('');
    setTextB('');
    setFileNameA('');
    setFileNameB('');
    setResult(null);
    setSelectedChapterIndex(0);
    setSearchFilter('');
    setRestoredFromDraft(false);
    try {
      localStorage.removeItem(COMPARE_DRAFT_KEY);
    } catch (err) {
      console.warn('Lỗi khi xóa bản nháp so sánh:', err);
    }
  };

  // Filtered chapters
  const filteredChapters = useMemo(() => {
    if (!result) return [];
    if (!(searchFilter || '').trim()) return result.chapterResults;
    const q = searchFilter.toLowerCase();
    return result.chapterResults.filter(
      (c) =>
        c.titleA.toLowerCase().includes(q) ||
        c.titleB.toLowerCase().includes(q) ||
        c.chapterNumber.toString() === q
    );
  }, [result, searchFilter]);

  const selectedChapter: ChapterDiff | undefined = result?.chapterResults[selectedChapterIndex];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStatus(label);
    setTimeout(() => setCopiedStatus(null), 1500);
  };

  return (
    <div className="space-y-4 font-sans text-stone-900" id="compare-container">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <GitCompare className="w-5 h-5 text-red-600 shrink-0" />
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">So Sánh Văn Bản</h2>
          {isProcessing ? (
            <span className="flex items-center gap-1 text-xs text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full border border-stone-200">
              <Loader2 className="w-3 h-3 animate-spin text-red-600" />
              <span>Đang tính toán...</span>
            </span>
          ) : (textA || textB) ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium" title="Nội dung đang được tự động lưu nháp liên tục">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Tự động lưu nháp</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {(textA || textB) && (
            <>
              {result && (
                <button
                  type="button"
                  onClick={() => setIsInputsExpanded(!isInputsExpanded)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-600 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
                >
                  {isInputsExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Thu gọn ô nhập</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Hiện ô nhập</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-red-700 bg-stone-100 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Xóa cả 2 văn bản để làm mới"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Làm mới</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Restored Draft Banner */}
      {restoredFromDraft && (textA || textB) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-amber-50/90 border border-amber-200 text-amber-900 rounded-xl text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Đã khôi phục nội dung đang so sánh:</strong> Bạn có thể tiếp tục làm việc mà không cần dán lại văn bản.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setRestoredFromDraft(false)}
              className="text-[11px] text-amber-800 hover:text-amber-950 font-medium px-2 py-1 rounded bg-amber-100/70 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
            >
              Xóa để làm mới
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Input Boxes (Auto-compares upon paste or typing) */}
      {isInputsExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File/Text A */}
          <div className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-stone-100 text-stone-700 text-xs font-bold flex items-center justify-center">
                  A
                </span>
                <span className="font-semibold text-stone-800 text-xs sm:text-sm">Bản gốc / Bản 1</span>
              </div>

              <div className="flex items-center gap-1.5">
                {textA && (
                  <button
                    onClick={() => {
                      setTextA('');
                      setFileNameA('');
                    }}
                    className="text-stone-400 hover:text-red-600 p-1"
                    title="Xóa bản A"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <label className="flex items-center gap-1 px-2.5 py-1 bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-lg text-xs font-medium cursor-pointer transition-colors">
                  <Upload className="w-3 h-3 text-stone-500" />
                  <span>{fileNameA ? 'Đổi file' : 'File TXT'}</span>
                  <input
                    type="file"
                    accept=".txt,.md,.text"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'A')}
                  />
                </label>
              </div>
            </div>

            {fileNameA && (
              <div className="text-[11px] text-stone-500 flex items-center gap-1 bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                <FileText className="w-3 h-3 text-stone-400" />
                <span className="truncate">{fileNameA}</span>
                <span className="text-stone-400">({textA.length.toLocaleString()} ký tự)</span>
              </div>
            )}

            <textarea
              value={textA}
              onChange={(e) => setTextA(e.target.value)}
              placeholder="Dán văn bản bản gốc vào đây... (Tự động so sánh ngay khi dán)"
              className={`w-full p-3 text-xs font-sans text-stone-800 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-y leading-relaxed ${
                result ? 'h-32 sm:h-36' : 'h-64 sm:h-80'
              }`}
            />
          </div>

          {/* File/Text B */}
          <div className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">
                  B
                </span>
                <span className="font-semibold text-stone-800 text-xs sm:text-sm">Bản đối chiếu / Bản 2 (Đã chỉnh sửa)</span>
              </div>

              <div className="flex items-center gap-1.5">
                {textB && (
                  <button
                    onClick={() => {
                      setTextB('');
                      setFileNameB('');
                    }}
                    className="text-stone-400 hover:text-red-600 p-1"
                    title="Xóa bản B"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <label className="flex items-center gap-1 px-2.5 py-1 bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-lg text-xs font-medium cursor-pointer transition-colors">
                  <Upload className="w-3 h-3 text-stone-500" />
                  <span>{fileNameB ? 'Đổi file' : 'File TXT'}</span>
                  <input
                    type="file"
                    accept=".txt,.md,.text"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'B')}
                  />
                </label>
              </div>
            </div>

            {fileNameB && (
              <div className="text-[11px] text-stone-500 flex items-center gap-1 bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                <FileText className="w-3 h-3 text-stone-400" />
                <span className="truncate">{fileNameB}</span>
                <span className="text-stone-400">({textB.length.toLocaleString()} ký tự)</span>
              </div>
            )}

            <textarea
              value={textB}
              onChange={(e) => setTextB(e.target.value)}
              placeholder="Dán bản dịch hoặc bản đã sửa vào đây... (Tự động so sánh ngay khi dán)"
              className={`w-full p-3 text-xs font-sans text-stone-800 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-y leading-relaxed ${
                result ? 'h-32 sm:h-36' : 'h-64 sm:h-80'
              }`}
            />
          </div>
        </div>
      )}

      {/* Comparison Results (Automatically displayed when text is present) */}
      {result && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Overall Edit % */}
            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Tỷ lệ chỉnh sửa</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-2xl font-bold tracking-tight ${
                    result.overallEditPercentage > 50
                      ? 'text-amber-600'
                      : result.overallEditPercentage > 20
                      ? 'text-blue-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {result.overallEditPercentage}%
                </span>
                <span className="text-xs text-stone-400">sửa đổi</span>
              </div>
              <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, result.overallEditPercentage)}%` }}
                />
              </div>
            </div>

            {/* Overall Similarity % */}
            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Độ tương đồng</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-stone-900 tracking-tight">
                  {result.overallSimilarity}%
                </span>
                <span className="text-xs text-stone-400">giữ nguyên</span>
              </div>
              <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, result.overallSimilarity)}%` }}
                />
              </div>
            </div>

            {/* Chapters Count */}
            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Tổng số chương</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-stone-900 tracking-tight">
                  {result.chapterResults.length}
                </span>
                <span className="text-xs text-stone-400">chương</span>
              </div>
              <div className="text-[11px] text-stone-500 mt-1 truncate">
                Bản A: {result.totalChaptersA} • Bản B: {result.totalChaptersB}
              </div>
            </div>

            {/* Character stats */}
            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">Ký tự thay đổi</span>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  +{result.addedChars.toLocaleString()}
                </span>
                <span className="text-red-700 font-semibold bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                  -{result.deletedChars.toLocaleString()}
                </span>
              </div>
              <div className="text-[11px] text-stone-400 mt-1.5 truncate">
                Khớp {result.identicalChars.toLocaleString()} chữ
              </div>
            </div>
          </div>

          {/* Two Columns: Left = Chapter List, Right = Side-by-Side Diff View */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left: Chapters List */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden flex flex-col max-h-[720px]">
              <div className="p-3 border-b border-stone-200 bg-stone-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">
                    Danh sách chương ({filteredChapters.length})
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Lọc tên chương..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-sans bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
                {filteredChapters.length === 0 ? (
                  <div className="p-6 text-center text-stone-400 text-xs">
                    Không tìm thấy chương nào phù hợp
                  </div>
                ) : (
                  filteredChapters.map((ch) => {
                    const isSelected = selectedChapter?.chapterNumber === ch.chapterNumber;
                    return (
                      <button
                        key={ch.chapterNumber}
                        onClick={() => {
                          const realIdx = result.chapterResults.findIndex(
                            (r) => r.chapterNumber === ch.chapterNumber
                          );
                          if (realIdx !== -1) setSelectedChapterIndex(realIdx);
                        }}
                        className={`w-full text-left p-3 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-red-50/80 border-l-3 border-l-red-600'
                            : 'hover:bg-stone-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-stone-800 truncate">
                              {ch.titleB !== '(Không có)' ? ch.titleB : ch.titleA}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-2 truncate">
                            <span>A: {ch.charCountA.toLocaleString()} ký tự</span>
                            <span>•</span>
                            <span>B: {ch.charCountB.toLocaleString()} ký tự</span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border ${
                              ch.editPercentage === 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : ch.editPercentage < 30
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : ch.editPercentage < 70
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {ch.editPercentage}% sửa
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Detailed Chapter Diff Viewer (Clean sans-serif typography, no font glitch) */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden flex flex-col min-h-[500px] max-h-[720px]">
              {selectedChapter ? (
                <>
                  {/* Chapter Header */}
                  <div className="p-3.5 sm:p-4 border-b border-stone-200 bg-stone-50/70 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-stone-800 text-white rounded text-xs font-bold">
                          #{selectedChapter.chapterNumber}
                        </span>
                        <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                          {selectedChapter.titleB !== '(Không có)'
                            ? selectedChapter.titleB
                            : selectedChapter.titleA}
                        </h3>
                      </div>
                      <div className="text-xs text-stone-500 mt-1 flex items-center gap-3">
                        <span>
                          Chỉnh sửa: <strong className="text-stone-800">{selectedChapter.editPercentage}%</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Tương đồng: <strong className="text-stone-800">{selectedChapter.similarityScore}%</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* View Mode Toggle */}
                      <div className="inline-flex items-center p-0.5 bg-stone-100 rounded-lg border border-stone-200 text-xs">
                        <button
                          type="button"
                          onClick={() => setDiffViewMode('inline')}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${
                            diffViewMode === 'inline'
                              ? 'bg-white text-stone-900 font-semibold shadow-2xs'
                              : 'text-stone-500 hover:text-stone-800'
                          }`}
                          title="Hiển thị theo dõi sửa đổi trong dòng văn bản"
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                          <span>Nội dòng</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiffViewMode('split')}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${
                            diffViewMode === 'split'
                              ? 'bg-white text-stone-900 font-semibold shadow-2xs'
                              : 'text-stone-500 hover:text-stone-800'
                          }`}
                          title="So sánh song song 2 cột Bản A và Bản B"
                        >
                          <Columns2 className="w-3.5 h-3.5" />
                          <span>Song song (2 cột)</span>
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          handleCopy(
                            selectedChapter.contentB || selectedChapter.contentA,
                            'chapter'
                          )
                        }
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                      >
                        {copiedStatus === 'chapter' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Đã copy</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy nội dung</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Diff Color Legend & Filter */}
                  <div className="px-4 py-2 border-b border-stone-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-stone-400 font-medium">Chú thích:</span>
                      <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px]">
                        <span className="line-through">[-Từ bị xóa/thay thế (A)-]</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                        <span>[+Từ mới thêm vào (B)+]</span>
                      </span>
                    </div>

                    {diffViewMode === 'inline' && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-stone-400">Hiển thị:</span>
                        <button
                          type="button"
                          onClick={() => setFilterDisplay('all')}
                          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            filterDisplay === 'all'
                              ? 'bg-stone-800 text-white border-stone-800 font-medium'
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          Cả hai bản
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterDisplay('new_only')}
                          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            filterDisplay === 'new_only'
                              ? 'bg-emerald-700 text-white border-emerald-700 font-medium'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title="Chỉ hiển thị bản B sạch sau khi chỉnh sửa"
                        >
                          Chỉ Bản mới (B)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterDisplay('old_only')}
                          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            filterDisplay === 'old_only'
                              ? 'bg-red-700 text-white border-red-700 font-medium'
                              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          }`}
                          title="Chỉ hiển thị bản A gốc trước khi chỉnh sửa"
                        >
                          Chỉ Bản gốc (A)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Diff Content Box */}
                  {diffViewMode === 'inline' ? (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 font-sans text-sm leading-relaxed whitespace-pre-wrap select-text text-stone-800 bg-[#faf9f6]">
                      {selectedChapter.diffChunks.map((chunk, cIdx) => {
                        if (chunk.type === 'equal') {
                          return <span key={cIdx}>{chunk.value}</span>;
                        } else if (chunk.type === 'delete') {
                          if (filterDisplay === 'new_only') return null;
                          return (
                            <span
                              key={cIdx}
                              className="bg-red-100/90 text-red-800 line-through rounded-xs px-1 mx-0.5 decoration-red-600/70 border border-red-200/50"
                              title="Bị xóa ở bản B"
                            >
                              {chunk.value}
                            </span>
                          );
                        } else if (chunk.type === 'insert') {
                          if (filterDisplay === 'old_only') return null;
                          return (
                            <span
                              key={cIdx}
                              className="bg-emerald-100/90 text-emerald-950 font-semibold rounded-xs px-1 mx-0.5 border-b-2 border-emerald-500"
                              title="Thêm mới ở bản B"
                            >
                              {chunk.value}
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                  ) : (
                    /* Side-by-Side Split View */
                    <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200 bg-[#faf9f6]">
                      {/* Left: Original (A) */}
                      <div className="flex flex-col h-full overflow-hidden">
                        <div className="px-3 py-1.5 bg-red-50/70 border-b border-stone-200 text-xs font-bold text-red-800 flex items-center justify-between">
                          <span>Bản Gốc (A): {fileNameA || 'Văn bản A'}</span>
                          <span className="text-[11px] font-normal text-stone-500">
                            {selectedChapter.charCountA.toLocaleString()} ký tự
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap select-text text-stone-800">
                          {selectedChapter.diffChunks.map((chunk, cIdx) => {
                            if (chunk.type === 'equal') {
                              return <span key={cIdx}>{chunk.value}</span>;
                            } else if (chunk.type === 'delete') {
                              return (
                                <span
                                  key={cIdx}
                                  className="bg-red-100 text-red-800 line-through rounded-xs px-1 mx-0.5 decoration-red-600/70"
                                  title="Đã bị xóa hoặc thay thế"
                                >
                                  {chunk.value}
                                </span>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>

                      {/* Right: Revised (B) */}
                      <div className="flex flex-col h-full overflow-hidden">
                        <div className="px-3 py-1.5 bg-emerald-50/70 border-b border-stone-200 text-xs font-bold text-emerald-800 flex items-center justify-between">
                          <span>Bản Mới (B): {fileNameB || 'Văn bản B'}</span>
                          <span className="text-[11px] font-normal text-stone-500">
                            {selectedChapter.charCountB.toLocaleString()} ký tự
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap select-text text-stone-800">
                          {selectedChapter.diffChunks.map((chunk, cIdx) => {
                            if (chunk.type === 'equal') {
                              return <span key={cIdx}>{chunk.value}</span>;
                            } else if (chunk.type === 'insert') {
                              return (
                                <span
                                  key={cIdx}
                                  className="bg-emerald-100 text-emerald-950 font-semibold rounded-xs px-1 mx-0.5 border-b-2 border-emerald-500"
                                  title="Được sửa hoặc thêm mới"
                                >
                                  {chunk.value}
                                </span>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-stone-400 text-sm font-sans">
                  Chọn một chương ở danh sách bên trái để xem nội dung so sánh chi tiết.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
