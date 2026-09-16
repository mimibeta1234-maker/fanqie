import React, { useState } from 'react';
import { Download, FileText, BookMarked, X, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp, FileCheck } from 'lucide-react';
import { DownloadTaskStatus } from '../types';
import { getAbstractParagraphs } from '../utils/textFormatter';

interface DownloadPanelProps {
  task: DownloadTaskStatus | null;
  totalChapters: number;
  onStartDownload: (range?: { start: number; end: number }, includeIntro?: boolean) => void;
  onCancelDownload: () => void;
  bookName: string;
  abstract?: string;
}

export const DownloadPanel: React.FC<DownloadPanelProps> = ({
  task,
  totalChapters,
  onStartDownload,
  onCancelDownload,
  bookName,
  abstract = '',
}) => {
  const [downloadMode, setDownloadMode] = useState<'all' | 'range'>('all');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(Math.min(totalChapters || 100, 100));
  const [includeIntro, setIncludeIntro] = useState<boolean>(true);
  const [showIntroPreview, setShowIntroPreview] = useState<boolean>(false);

  const isDownloading = task?.status === 'downloading';
  const isCompleted = task?.status === 'completed';
  const isError = task?.status === 'error';

  const paragraphs = getAbstractParagraphs(abstract);

  const handleStart = () => {
    if (downloadMode === 'all') {
      onStartDownload(undefined, includeIntro);
    } else {
      const start = Math.max(1, Math.min(rangeStart, totalChapters));
      const end = Math.max(start, Math.min(rangeEnd, totalChapters));
      onStartDownload({ start, end }, includeIntro);
    }
  };

  const handleExport = (format: 'txt' | 'epub') => {
    if (!task?.taskId) return;
    window.location.href = `/api/download/export?taskId=${task.taskId}&format=${format}`;
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-5 shadow-xs" id="download-panel">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
          <Download className="w-4 h-4 text-red-600" />
          <span>Tải truyện về máy</span>
        </h3>
        {isDownloading && (
          <span className="text-xs text-stone-500 font-mono">
            {task.speed || "Đang tải..."}
          </span>
        )}
      </div>

      {/* Mode & Config (Hidden during downloading) */}
      {!isDownloading && (
        <div className="mt-4 space-y-3">
          <div className="flex bg-stone-100 p-1 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setDownloadMode('all')}
              className={`flex-1 py-1.5 rounded-md transition-colors text-center cursor-pointer ${
                downloadMode === 'all'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Tải trọn bộ ({totalChapters} chương)
            </button>
            <button
              type="button"
              onClick={() => setDownloadMode('range')}
              className={`flex-1 py-1.5 rounded-md transition-colors text-center cursor-pointer ${
                downloadMode === 'range'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Chọn khoảng chương
            </button>
          </div>

          {downloadMode === 'range' && (
            <div className="flex items-center gap-2 text-xs text-stone-600 pt-1">
              <span>Từ chương:</span>
              <input
                type="number"
                min={1}
                max={totalChapters}
                value={rangeStart ?? ''}
                onChange={e => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 bg-stone-50 border border-stone-300 rounded text-center font-semibold focus:outline-none focus:border-red-500"
              />
              <span>đến</span>
              <input
                type="number"
                min={rangeStart}
                max={totalChapters}
                value={rangeEnd ?? ''}
                onChange={e => setRangeEnd(Math.max(rangeStart, parseInt(e.target.value) || totalChapters))}
                className="w-16 px-2 py-1 bg-stone-50 border border-stone-300 rounded text-center font-semibold focus:outline-none focus:border-red-500"
              />
              <span className="text-stone-400">
                ({Math.max(0, rangeEnd - rangeStart + 1)} chương)
              </span>
            </div>
          )}

          {/* Include Intro / Abstract Option */}
          <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200/80 text-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-medium text-stone-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeIntro}
                  onChange={e => setIncludeIntro(e.target.checked)}
                  className="rounded border-stone-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-red-600" />
                  Kèm phần Giới thiệu ở đầu file
                </span>
              </label>
              {paragraphs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowIntroPreview(!showIntroPreview)}
                  className="text-[11px] text-stone-500 hover:text-red-600 font-medium flex items-center gap-0.5 cursor-pointer ml-2 shrink-0"
                >
                  <span>{showIntroPreview ? "Ẩn giới thiệu" : "Xem giới thiệu"}</span>
                  {showIntroPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {includeIntro && downloadMode === 'range' && (
              <p className="text-[11px] text-stone-500 mt-1 pl-6">
                ℹ️ Phần giới thiệu sẽ được chèn trước Chương {rangeStart} (định dạng rõ ràng, không dính dòng).
              </p>
            )}

            {/* Expandable Preview */}
            {showIntroPreview && paragraphs.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-stone-200/60 max-h-48 overflow-y-auto space-y-1.5 pr-1 text-[11px] text-stone-600">
                {paragraphs.map((para, idx) => (
                  <p key={idx} className="indent-2 leading-relaxed text-justify">{para}</p>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={totalChapters === 0}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            id="btn-start-download"
          >
            <Download className="w-4 h-4" />
            <span>
              {downloadMode === 'all' ? `Tải Full ${totalChapters} chương` : `Tải ${rangeEnd - rangeStart + 1} chương đã chọn`}
            </span>
          </button>
        </div>
      )}

      {/* Download Progress & Export */}
      {task && (
        <div className="mt-4 space-y-3">
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-stone-600">
              <span className="flex items-center gap-1.5 truncate max-w-[280px]">
                {isDownloading && <RefreshCw className="w-3 h-3 text-red-600 animate-spin shrink-0" />}
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
                  isCompleted ? 'bg-emerald-500' : isError ? 'bg-rose-500' : 'bg-red-600'
                }`}
                style={{ width: `${task.percent}%` }}
              />
            </div>
          </div>

          {/* Action on Complete */}
          {isCompleted && (
            <div className="flex gap-2 pt-1">
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
