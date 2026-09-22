import React, { useState, useMemo, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  BookMarked, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  FileCheck, 
  Archive, 
  Plus, 
  Trash2, 
  Layers, 
  CheckSquare, 
  Square, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { DownloadTaskStatus, Catalog, ChapterRange } from '../types';
import { getAbstractParagraphs } from '../utils/textFormatter';

interface CustomRangeItem {
  id: string;
  start: number;
  end: number;
}

interface DownloadPanelProps {
  task: DownloadTaskStatus | null;
  totalChapters: number;
  onStartDownload: (
    rangeOrRanges?: { start: number; end: number } | { start: number; end: number; label?: string }[],
    includeIntro?: boolean
  ) => void;
  onCancelDownload: () => void;
  bookName: string;
  abstract?: string;
  catalog?: Catalog | null;
  themeColor?: 'red' | 'amber';
  onResetTask?: () => void;
}

export const DownloadPanel: React.FC<DownloadPanelProps> = ({
  task,
  totalChapters,
  onStartDownload,
  onCancelDownload,
  bookName,
  abstract = '',
  catalog = null,
  themeColor = 'red',
  onResetTask
}) => {
  // Modes: 'all' = Trọn bộ, 'preset' = Chia sẵn khoảng, 'custom' = Tùy chỉnh khoảng
  const [downloadMode, setDownloadMode] = useState<'all' | 'preset' | 'custom'>('preset');

  // Preset size: number (e.g. 10, 20, 50, 100) or 'volume'
  const [presetSize, setPresetSize] = useState<number | 'volume'>(() => {
    if (totalChapters && totalChapters <= 30) return 10;
    if (totalChapters && totalChapters <= 100) return 20;
    return 50;
  });
  const [customChunkInput, setCustomChunkInput] = useState<string>(() => {
    if (totalChapters && totalChapters <= 30) return '10';
    if (totalChapters && totalChapters <= 100) return '20';
    return '50';
  });

  // Preset scope boundaries (custom start and end chapters)
  const [presetStartChapter, setPresetStartChapter] = useState<number>(1);
  const [presetEndChapter, setPresetEndChapter] = useState<number>(totalChapters || 1);

  useEffect(() => {
    if (totalChapters && totalChapters > 0) {
      setPresetEndChapter(prev => (prev <= 1 || prev > totalChapters ? totalChapters : prev));
    }
  }, [totalChapters]);

  const [selectedPresetIndices, setSelectedPresetIndices] = useState<number[]>([]);

  // Custom ranges list
  const [customRanges, setCustomRanges] = useState<CustomRangeItem[]>([
    { id: '1', start: 1, end: Math.min(totalChapters || 100, 100) }
  ]);
  const [customQuickInput, setCustomQuickInput] = useState<string>('');
  const [showQuickInput, setShowQuickInput] = useState<boolean>(false);

  // Common options
  const [includeIntro, setIncludeIntro] = useState<boolean>(true);
  const [showIntroPreview, setShowIntroPreview] = useState<boolean>(false);
  const [showIndividualExports, setShowIndividualExports] = useState<boolean>(false);

  const isDownloading = task?.status === 'downloading';
  const isCompleted = task?.status === 'completed';
  const isError = task?.status === 'error';

  const paragraphs = getAbstractParagraphs(abstract);

  // Colors based on theme
  const accentText = themeColor === 'amber' ? 'text-amber-600' : 'text-red-600';
  const accentBg = themeColor === 'amber' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700';
  const accentBorder = themeColor === 'amber' ? 'focus:border-amber-500' : 'focus:border-red-500';
  const accentRing = themeColor === 'amber' ? 'focus:ring-amber-500 text-amber-600' : 'focus:ring-red-500 text-red-600';

  // Has volumes?
  const hasVolumes = useMemo(() => {
    return Boolean(catalog?.volume_list && catalog.volume_list.length > 1);
  }, [catalog]);

  // Compute preset ranges
  const presetRanges = useMemo(() => {
    if (!totalChapters || totalChapters <= 0) return [];

    const startBound = Math.max(1, Math.min(presetStartChapter || 1, totalChapters));
    const endBound = Math.max(startBound, Math.min(presetEndChapter || totalChapters, totalChapters));

    if (presetSize === 'volume' && hasVolumes && catalog?.volume_list) {
      let cumulativeIndex = 1;
      const ranges: { start: number; end: number; label: string; count: number }[] = [];

      catalog.volume_list.forEach((vol, idx) => {
        const count = vol.chapter_list?.length || 0;
        if (count > 0) {
          const volStart = cumulativeIndex;
          const volEnd = cumulativeIndex + count - 1;
          cumulativeIndex = volEnd + 1;

          if (volEnd >= startBound && volStart <= endBound) {
            const clippedStart = Math.max(volStart, startBound);
            const clippedEnd = Math.min(volEnd, endBound);
            const cleanTitle = (vol.title || `Quyển ${idx + 1}`).replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
            ranges.push({
              start: clippedStart,
              end: clippedEnd,
              label: `${cleanTitle} (Ch. ${clippedStart} - ${clippedEnd})`,
              count: clippedEnd - clippedStart + 1
            });
          }
        }
      });
      return ranges;
    }

    // Fixed chunk size
    const rawChunk = typeof presetSize === 'number' ? presetSize : 50;
    const chunkSize = Math.max(1, rawChunk);
    const ranges: { start: number; end: number; label: string; count: number }[] = [];
    let currentStart = startBound;

    while (currentStart <= endBound) {
      const currentEnd = Math.min(currentStart + chunkSize - 1, endBound);
      ranges.push({
        start: currentStart,
        end: currentEnd,
        label: `Chương ${currentStart} - ${currentEnd}`,
        count: currentEnd - currentStart + 1
      });
      currentStart = currentEnd + 1;
    }

    return ranges;
  }, [totalChapters, presetStartChapter, presetEndChapter, presetSize, hasVolumes, catalog]);

  // Auto-select first preset range when preset list changes
  useEffect(() => {
    if (presetRanges.length > 0) {
      // By default, select the first 1 or 2 ranges
      setSelectedPresetIndices(prev => {
        if (prev.length === 0) return [0];
        // Keep valid indices
        const filtered = prev.filter(i => i >= 0 && i < presetRanges.length);
        return filtered.length > 0 ? filtered : [0];
      });
    }
  }, [presetRanges.length]);

  // Toggle single preset checkbox
  const togglePresetIndex = (index: number) => {
    setSelectedPresetIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index].sort((a, b) => a - b);
      }
    });
  };

  // Preset Selection Helpers
  const selectAllPresets = () => {
    setSelectedPresetIndices(presetRanges.map((_, i) => i));
  };

  const deselectAllPresets = () => {
    setSelectedPresetIndices([]);
  };

  const invertPresetSelection = () => {
    setSelectedPresetIndices(prev => {
      const all = presetRanges.map((_, i) => i);
      return all.filter(i => !prev.includes(i));
    });
  };

  // Custom Range management
  const addCustomRange = () => {
    const last = customRanges[customRanges.length - 1];
    const newStart = last ? Math.min(last.end + 1, totalChapters) : 1;
    const newEnd = Math.min(newStart + 99, totalChapters);
    setCustomRanges(prev => [
      ...prev,
      { id: String(Date.now() + Math.random()), start: newStart, end: newEnd }
    ]);
  };

  const updateCustomRange = (id: string, field: 'start' | 'end', value: number) => {
    setCustomRanges(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const clampedVal = Math.max(1, Math.min(value, totalChapters));
        if (field === 'start') {
          return { ...r, start: clampedVal, end: Math.max(clampedVal, r.end) };
        } else {
          return { ...r, end: Math.max(r.start, clampedVal) };
        }
      })
    );
  };

  const removeCustomRange = (id: string) => {
    if (customRanges.length <= 1) return;
    setCustomRanges(prev => prev.filter(r => r.id !== id));
  };

  const applyQuickInput = () => {
    if (!customQuickInput.trim()) return;
    // Format: "1-50, 100-200, 300-350"
    const parts = customQuickInput.split(/[,;\n]+/);
    const parsed: CustomRangeItem[] = [];

    parts.forEach((p, idx) => {
      const match = p.trim().match(/^(\d+)\s*[-~_—tođến]+\s*(\d+)$/i) || p.trim().match(/^(\d+)$/);
      if (match) {
        const s = parseInt(match[1]);
        const e = match[2] ? parseInt(match[2]) : s;
        if (!isNaN(s) && !isNaN(e)) {
          const start = Math.max(1, Math.min(s, totalChapters));
          const end = Math.max(start, Math.min(e, totalChapters));
          parsed.push({
            id: `quick_${Date.now()}_${idx}`,
            start,
            end
          });
        }
      }
    });

    if (parsed.length > 0) {
      setCustomRanges(parsed);
      setShowQuickInput(false);
      setCustomQuickInput('');
    }
  };

  // Total selected chapters for preset mode
  const selectedPresetTotalChapters = useMemo(() => {
    return selectedPresetIndices.reduce((sum, idx) => {
      return sum + (presetRanges[idx]?.count || 0);
    }, 0);
  }, [selectedPresetIndices, presetRanges]);

  // Total selected chapters for custom mode
  const customTotalChapters = useMemo(() => {
    return customRanges.reduce((sum, r) => sum + Math.max(0, r.end - r.start + 1), 0);
  }, [customRanges]);

  // Start download trigger
  const handleStart = () => {
    if (downloadMode === 'all') {
      onStartDownload(undefined, includeIntro);
    } else if (downloadMode === 'preset') {
      if (selectedPresetIndices.length === 0) return;
      const ranges = selectedPresetIndices
        .sort((a, b) => a - b)
        .map(i => presetRanges[i])
        .filter(Boolean)
        .map(r => ({
          start: r.start,
          end: r.end,
          label: r.label
        }));

      if (ranges.length === 1) {
        onStartDownload(ranges[0], includeIntro);
      } else {
        onStartDownload(ranges, includeIntro);
      }
    } else {
      // Custom mode
      if (customRanges.length === 0) return;
      const ranges = customRanges
        .sort((a, b) => a.start - b.start)
        .map(r => ({
          start: r.start,
          end: r.end,
          label: `Chương ${r.start} - ${r.end}`
        }));

      if (ranges.length === 1) {
        onStartDownload(ranges[0], includeIntro);
      } else {
        onStartDownload(ranges, includeIntro);
      }
    }
  };

  // Instant single-range download (1-click from preset row)
  const handleDownloadSinglePreset = (r: { start: number; end: number; label: string }) => {
    onStartDownload({ start: r.start, end: r.end, label: r.label }, includeIntro);
  };

  // File export helpers
  const handleExport = (format: 'txt' | 'epub' | 'zip', rangeIndex?: number) => {
    if (!task?.taskId) return;
    let url = `/api/download/export?taskId=${task.taskId}&format=${format}`;
    if (rangeIndex !== undefined) {
      url += `&rangeIndex=${rangeIndex}`;
    }
    window.location.href = url;
  };

  const isMultiRangeDownload = Boolean(task?.ranges && task.ranges.length > 1);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-xs" id="download-panel">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
          <Download className={`w-4 h-4 ${accentText}`} />
          <span>Tải truyện về máy</span>
        </h3>
        {isDownloading && (
          <span className="text-xs text-stone-500 font-mono flex items-center gap-1.5">
            <RefreshCw className={`w-3 h-3 ${accentText} animate-spin`} />
            {task?.speed || "Đang tải..."}
          </span>
        )}
      </div>

      {/* Mode & Config (Hidden during downloading) */}
      {!isDownloading && (
        <div className="mt-4 space-y-4">
          {/* Main 3-Way Mode Switcher */}
          <div className="flex bg-stone-100 p-1 rounded-lg text-xs font-medium gap-1">
            <button
              type="button"
              onClick={() => setDownloadMode('preset')}
              className={`flex-1 py-1.5 px-2 rounded-md transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                downloadMode === 'preset'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              id="btn-mode-preset"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Chia sẵn khoảng</span>
            </button>

            <button
              type="button"
              onClick={() => setDownloadMode('custom')}
              className={`flex-1 py-1.5 px-2 rounded-md transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                downloadMode === 'custom'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              id="btn-mode-custom"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tùy chỉnh khoảng</span>
            </button>

            <button
              type="button"
              onClick={() => setDownloadMode('all')}
              className={`flex-1 py-1.5 px-2 rounded-md transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                downloadMode === 'all'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              id="btn-mode-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Trọn bộ ({totalChapters})</span>
            </button>
          </div>

          {/* ================= MODE: CHIA SẴN KHOẢNG (PRESETS) ================= */}
          {downloadMode === 'preset' && (
            <div className="space-y-3 bg-stone-50/70 p-3 rounded-lg border border-stone-200/70">
              {/* Range Scope / Boundaries: Từ chương ... Đến chương ... */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-200/60 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-stone-700">Phạm vi chia:</span>
                  <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-md px-2 py-1 shadow-2xs">
                    <span className="text-stone-500 text-[11px]">Từ c.</span>
                    <input
                      type="number"
                      min={1}
                      max={presetEndChapter || totalChapters || 1}
                      value={presetStartChapter}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setPresetStartChapter(isNaN(val) ? 1 : Math.max(1, Math.min(val, totalChapters || 1)));
                      }}
                      className="w-14 text-center font-bold text-stone-900 bg-transparent focus:outline-none border-b border-stone-300 focus:border-stone-600"
                      id="input-preset-start-chapter"
                    />
                    <span className="text-stone-400 font-bold px-0.5">→</span>
                    <span className="text-stone-500 text-[11px]">Đến c.</span>
                    <input
                      type="number"
                      min={presetStartChapter || 1}
                      max={totalChapters || 1}
                      value={presetEndChapter}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setPresetEndChapter(isNaN(val) ? (totalChapters || 1) : Math.min(totalChapters || 1, val));
                      }}
                      className="w-14 text-center font-bold text-stone-900 bg-transparent focus:outline-none border-b border-stone-300 focus:border-stone-600"
                      id="input-preset-end-chapter"
                    />
                  </div>
                  <span className="text-[11px] text-stone-400 font-medium">
                    (tổng {Math.max(0, (presetEndChapter || totalChapters || 1) - (presetStartChapter || 1) + 1)} ch.)
                  </span>
                </div>

                {/* Quick reset to full novel */}
                {(presetStartChapter > 1 || (totalChapters && presetEndChapter < totalChapters)) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPresetStartChapter(1);
                      setPresetEndChapter(totalChapters || 1);
                    }}
                    className="text-[11px] text-stone-500 hover:text-stone-900 underline decoration-dotted cursor-pointer font-medium transition-colors"
                  >
                    Toàn bộ (1 → {totalChapters})
                  </button>
                )}
              </div>

              {/* Preset chunk size picker */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-200/60">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-stone-700">Chia mỗi:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {[10, 20, 50, 100].map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setPresetSize(size);
                          setCustomChunkInput(String(size));
                        }}
                        className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer ${
                          presetSize === size
                            ? `${accentBg} text-white font-semibold shadow-2xs`
                            : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {size} ch.
                      </button>
                    ))}
                    {hasVolumes && (
                      <button
                        type="button"
                        onClick={() => setPresetSize('volume')}
                        className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer ${
                          presetSize === 'volume'
                            ? `${accentBg} text-white font-semibold shadow-2xs`
                            : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        Theo Quyển
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom Chunk Size Input */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-stone-500 font-medium">Hoặc tự đặt:</span>
                  <div className={`flex items-center gap-1 bg-white border rounded px-2 py-0.5 shadow-2xs transition-all ${
                    typeof presetSize === 'number' && ![10, 20, 50, 100].includes(presetSize)
                      ? 'border-stone-400 ring-1 ring-stone-300'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}>
                    <input
                      type="number"
                      min={1}
                      max={totalChapters || 9999}
                      value={customChunkInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomChunkInput(val);
                        const n = parseInt(val, 10);
                        if (n && n > 0) {
                          setPresetSize(n);
                        }
                      }}
                      onBlur={() => {
                        const n = parseInt(customChunkInput, 10);
                        if (!n || n <= 0) {
                          setCustomChunkInput('50');
                          setPresetSize(50);
                        }
                      }}
                      placeholder="vd: 25"
                      className="w-12 text-center font-bold text-stone-900 bg-transparent focus:outline-none"
                      id="input-custom-chunk-size"
                    />
                    <span className="text-[11px] text-stone-500">chương/khoảng</span>
                  </div>
                </div>
              </div>

              {/* Selection Tools & Counters */}
              <div className="flex items-center justify-between text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllPresets}
                    className="hover:text-stone-900 font-medium cursor-pointer underline decoration-dotted"
                  >
                    Chọn tất cả
                  </button>
                  <span className="text-stone-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllPresets}
                    className="hover:text-stone-900 font-medium cursor-pointer underline decoration-dotted"
                  >
                    Bỏ chọn
                  </button>
                  <span className="text-stone-300">|</span>
                  <button
                    type="button"
                    onClick={invertPresetSelection}
                    className="hover:text-stone-900 font-medium cursor-pointer underline decoration-dotted"
                  >
                    Đảo chọn
                  </button>
                </div>
                <span className="font-semibold text-stone-800 bg-white px-2 py-0.5 rounded border border-stone-200 text-[11px]">
                  Đã chọn: <strong className={accentText}>{selectedPresetIndices.length}</strong> / {presetRanges.length} khoảng ({selectedPresetTotalChapters} ch.)
                </span>
              </div>

              {/* Presets Checklist (Scrollable) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {presetRanges.map((range, idx) => {
                  const isChecked = selectedPresetIndices.includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-md border transition-all text-xs ${
                        isChecked
                          ? 'bg-white border-stone-300 shadow-2xs ring-1 ring-stone-200'
                          : 'bg-white/60 border-stone-200/80 hover:bg-white text-stone-600'
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer select-none flex-1 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePresetIndex(idx)}
                          className={`rounded border-stone-300 ${accentRing} w-3.5 h-3.5 cursor-pointer shrink-0`}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-stone-900 truncate">
                            {range.label}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            {range.count} chương
                          </p>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDownloadSinglePreset(range)}
                        title="Tải riêng lẻ khoảng này"
                        className="text-[10px] px-1.5 py-0.5 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-transparent hover:border-stone-200 transition-colors cursor-pointer shrink-0"
                      >
                        Tải riêng
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= MODE: TÙY CHỈNH KHOẢNG (CUSTOM RANGES) ================= */}
          {downloadMode === 'custom' && (
            <div className="space-y-3 bg-stone-50/70 p-3 rounded-lg border border-stone-200/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-800">
                  Danh sách khoảng tùy chỉnh:
                </span>
                <button
                  type="button"
                  onClick={() => setShowQuickInput(!showQuickInput)}
                  className="text-[11px] text-stone-500 hover:text-stone-800 underline cursor-pointer"
                >
                  {showQuickInput ? "Đóng nhập nhanh" : "Nhập nhanh dạng chuỗi"}
                </button>
              </div>

              {/* Quick Input Bar */}
              {showQuickInput && (
                <div className="p-2 bg-white rounded border border-stone-200 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="VD: 1-50, 101-200, 350-400"
                      value={customQuickInput}
                      onChange={e => setCustomQuickInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyQuickInput()}
                      className={`flex-1 px-2 py-1 text-xs border border-stone-300 rounded ${accentBorder} focus:outline-none`}
                    />
                    <button
                      type="button"
                      onClick={applyQuickInput}
                      className="px-2.5 py-1 text-xs bg-stone-800 text-white rounded hover:bg-stone-900 cursor-pointer font-medium"
                    >
                      Áp dụng
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-400">
                    Nhập các khoảng cách nhau bằng dấu phẩy hoặc chấm phẩy (VD: 1-100, 201-300).
                  </p>
                </div>
              )}

              {/* Custom Range Rows */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {customRanges.map((item, idx) => {
                  const count = Math.max(0, item.end - item.start + 1);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 bg-white rounded border border-stone-200 text-xs shadow-2xs"
                    >
                      <span className="font-semibold text-stone-400 text-[11px] w-6">
                        #{idx + 1}
                      </span>
                      <span className="text-stone-600">Từ</span>
                      <input
                        type="number"
                        min={1}
                        max={totalChapters}
                        value={item.start}
                        onChange={e => updateCustomRange(item.id, 'start', parseInt(e.target.value) || 1)}
                        className={`w-16 px-1.5 py-1 text-center font-mono font-medium border border-stone-300 rounded ${accentBorder} focus:outline-none`}
                      />
                      <span className="text-stone-600">đến</span>
                      <input
                        type="number"
                        min={item.start}
                        max={totalChapters}
                        value={item.end}
                        onChange={e => updateCustomRange(item.id, 'end', parseInt(e.target.value) || totalChapters)}
                        className={`w-16 px-1.5 py-1 text-center font-mono font-medium border border-stone-300 rounded ${accentBorder} focus:outline-none`}
                      />
                      <span className="text-stone-400 font-mono text-[11px] flex-1 text-right">
                        ({count} ch.)
                      </span>
                      {customRanges.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCustomRange(item.id)}
                          className="p-1 text-stone-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Xóa khoảng này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Range & Summary */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={addCustomRange}
                  className="px-2.5 py-1 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-medium rounded flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm khoảng nữa</span>
                </button>
                <span className="text-xs text-stone-600">
                  Tổng: <strong>{customRanges.length} khoảng</strong> ({customTotalChapters} chương)
                </span>
              </div>
            </div>
          )}

          {/* ================= INTRO / ABSTRACT OPTION ================= */}
          <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200/80 text-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-medium text-stone-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeIntro}
                  onChange={e => setIncludeIntro(e.target.checked)}
                  className={`rounded border-stone-300 ${accentRing} w-4 h-4 cursor-pointer`}
                />
                <span className="flex items-center gap-1.5">
                  <FileCheck className={`w-3.5 h-3.5 ${accentText}`} />
                  Kèm phần Giới thiệu ở đầu file
                </span>
              </label>
              {paragraphs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowIntroPreview(!showIntroPreview)}
                  className={`text-[11px] text-stone-500 hover:${accentText} font-medium flex items-center gap-0.5 cursor-pointer ml-2 shrink-0`}
                >
                  <span>{showIntroPreview ? "Ẩn giới thiệu" : "Xem giới thiệu"}</span>
                  {showIntroPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Expandable Preview */}
            {showIntroPreview && paragraphs.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-stone-200/60 max-h-48 overflow-y-auto space-y-1.5 pr-1 text-[11px] text-stone-600">
                {paragraphs.map((para, idx) => (
                  <p key={idx} className="indent-2 leading-relaxed text-justify">{para}</p>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleStart}
            disabled={
              totalChapters === 0 ||
              (downloadMode === 'preset' && selectedPresetIndices.length === 0) ||
              (downloadMode === 'custom' && customRanges.length === 0)
            }
            className={`w-full py-2.5 ${accentBg} text-white text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50`}
            id="btn-start-download"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloadMode === 'all'
                ? `Tải Full ${totalChapters} chương`
                : downloadMode === 'preset'
                ? `Tải ${selectedPresetIndices.length} khoảng đã chọn (${selectedPresetTotalChapters} ch.)`
                : `Tải ${customRanges.length} khoảng tùy chỉnh (${customTotalChapters} ch.)`}
            </span>
          </button>
        </div>
      )}

      {/* ================= DOWNLOADING & COMPLETED PROGRESS ================= */}
      {task && (
        <div className="mt-4 space-y-3">
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-stone-600">
              <span className="flex items-center gap-1.5 truncate max-w-[280px]">
                {isDownloading && <RefreshCw className={`w-3 h-3 ${accentText} animate-spin shrink-0`} />}
                {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                <span className="truncate">{task.currentChapterTitle || "Đang xử lý..."}</span>
              </span>
              <span className="font-mono font-bold text-stone-800 shrink-0">
                {task.completedChapters}/{task.totalChapters} ({task.percent}%)
              </span>
            </div>

            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  isCompleted ? 'bg-emerald-500' : isError ? 'bg-rose-500' : themeColor === 'amber' ? 'bg-amber-600' : 'bg-red-600'
                }`}
                style={{ width: `${task.percent}%` }}
              />
            </div>
          </div>

          {/* List of ranges being/already downloaded */}
          {task.ranges && task.ranges.length > 1 && (
            <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/80 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-stone-700">
                  {isCompleted ? "Các khoảng đã tải xong:" : "Đang tải các khoảng:"}
                </span>
                <span className="text-[11px] text-stone-500 font-mono">
                  {task.ranges.length} khoảng
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {task.ranges.map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-stone-200 rounded text-[11px] text-stone-700 font-medium"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {r.label || `Chương ${r.start}-${r.end}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action on Complete */}
          {isCompleted && (
            <div className="space-y-2 pt-1">
              {/* If multi-range: Primary ZIP button (separate files) */}
              {isMultiRangeDownload ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleExport('zip')}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    id="btn-export-zip"
                  >
                    <Archive className="w-4 h-4 text-indigo-200" />
                    <span>Tải file nén ZIP (Tách riêng từng khoảng)</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleExport('txt')}
                      className="flex-1 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      id="btn-export-combined-txt"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Lưu 1 file TXT gộp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExport('epub')}
                      className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      id="btn-export-epub"
                    >
                      <BookMarked className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Lưu EPUB</span>
                    </button>
                  </div>

                  {/* Accordion to export individual range files */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowIndividualExports(!showIndividualExports)}
                      className="text-[11px] text-stone-500 hover:text-stone-800 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showIndividualExports ? "Ẩn danh sách tải riêng lẻ" : "Hoặc tải riêng lẻ từng file TXT cho mỗi khoảng"}</span>
                      {showIndividualExports ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showIndividualExports && task.ranges && (
                      <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {task.ranges.map((r, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-1.5 bg-stone-50 rounded border border-stone-200 text-xs"
                          >
                            <span className="font-medium text-stone-700 truncate mr-2">
                              {r.label || `Chương ${r.start} - ${r.end}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleExport('txt', idx)}
                              className="px-2 py-0.5 bg-white border border-stone-300 hover:bg-stone-100 rounded text-[11px] font-medium text-stone-700 flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <FileText className="w-3 h-3 text-stone-500" />
                              <span>Tải TXT</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Single Range / Full Novel Export Buttons */
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleExport('txt')}
                    className="flex-1 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    id="btn-export-txt"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lưu TXT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('epub')}
                    className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    id="btn-export-epub"
                  >
                    <BookMarked className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Lưu EPUB</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('zip')}
                    className="py-2 px-3 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    id="btn-export-zip-single"
                    title="Lưu dạng file ZIP"
                  >
                    <Archive className="w-3.5 h-3.5 text-indigo-200" />
                    <span>ZIP</span>
                  </button>
                </div>
              )}

              {/* Reset task to download more */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (onResetTask) {
                      onResetTask();
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="text-[11px] text-stone-500 hover:text-stone-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Tải thêm khoảng khác hoặc truyện khác</span>
                </button>
              </div>
            </div>
          )}

          {isDownloading && (
            <button
              type="button"
              onClick={onCancelDownload}
              className="w-full py-1.5 text-xs text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1 cursor-pointer transition-colors"
              id="btn-cancel-download"
            >
              <X className="w-3.5 h-3.5" />
              <span>Dừng tải</span>
            </button>
          )}

          {isError && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{task.errorMessage || "Lỗi tải chương"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
