import React, { useState } from 'react';
import { X, Moon, Sun, Type, BookOpen, AlertCircle, Copy, Check, Bookmark } from 'lucide-react';

interface ReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  itemId: string;
  loading: boolean;
  error?: string;
  isMarked?: boolean;
  onToggleMark?: () => void;
}

export const ReaderModal: React.FC<ReaderModalProps> = ({
  isOpen,
  onClose,
  title,
  content,
  itemId,
  loading,
  error,
  isMarked = false,
  onToggleMark
}) => {
  const [fontSize, setFontSize] = useState<number>(18);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    let textToCopy = (content || '').trim();
    if (!textToCopy.startsWith(title) && !textToCopy.startsWith('=')) {
      textToCopy = `${title}\n\n${textToCopy}`;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(textToCopy);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-3 sm:p-6" id="reader-modal-backdrop">
      <div
        className={`w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col shadow-2xl transition-colors duration-200 overflow-hidden border ${
          isDarkMode ? 'bg-stone-900 text-stone-200 border-stone-800' : 'bg-[#faf8f5] text-stone-900 border-stone-300'
        }`}
        id="reader-modal-container"
      >
        {/* Header toolbar */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isDarkMode ? 'border-stone-800 bg-stone-900/90' : 'border-stone-200 bg-stone-50/90'
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <BookOpen className="w-5 h-5 text-red-600 shrink-0" />
            <div className="truncate">
              <h3 className="font-semibold text-sm sm:text-base truncate">{title || "Đang tải chương..."}</h3>
              <p className="text-xs text-stone-400">ID: {itemId} • Đã mở khóa giả lập App</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Font size control */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${
              isDarkMode ? 'border-stone-700 bg-stone-800' : 'border-stone-200 bg-white'
            }`}>
              <Type className="w-3.5 h-3.5 text-stone-400" />
              <button
                onClick={() => setFontSize(s => Math.max(14, s - 2))}
                className="w-5 h-5 flex items-center justify-center hover:bg-stone-200/50 rounded font-bold"
                title="Giảm cỡ chữ"
                id="btn-font-decrease"
              >
                -
              </button>
              <span className="w-6 text-center font-mono">{fontSize}</span>
              <button
                onClick={() => setFontSize(s => Math.min(28, s + 2))}
                className="w-5 h-5 flex items-center justify-center hover:bg-stone-200/50 rounded font-bold"
                title="Tăng cỡ chữ"
                id="btn-font-increase"
              >
                +
              </button>
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg border ${
                isDarkMode ? 'border-stone-700 bg-stone-800 text-amber-400' : 'border-stone-200 bg-white text-stone-600'
              } hover:opacity-80 transition-opacity`}
              title={isDarkMode ? "Chế độ sáng" : "Chế độ tối"}
              id="btn-toggle-darkmode"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Mark / Bookmark chapter button */}
            {onToggleMark && (
              <button
                onClick={onToggleMark}
                className={`p-2 rounded-lg border transition-all cursor-pointer ${
                  isMarked
                    ? 'border-amber-400 bg-amber-500/10 text-amber-500'
                    : isDarkMode
                    ? 'border-stone-700 bg-stone-800 text-stone-300 hover:text-amber-400'
                    : 'border-stone-200 bg-white text-stone-600 hover:text-amber-600'
                }`}
                title={isMarked ? "Bỏ đánh dấu chương này" : "Đánh dấu chương này"}
                id="btn-mark-chapter"
              >
                <Bookmark className={`w-4 h-4 ${isMarked ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>
            )}

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className={`p-2 rounded-lg border ${
                isDarkMode ? 'border-stone-700 bg-stone-800 text-stone-300' : 'border-stone-200 bg-white text-stone-600'
              } hover:opacity-80 transition-opacity`}
              title="Sao chép toàn bộ chương"
              id="btn-copy-chapter"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 text-stone-400 transition-colors ml-1"
              title="Đóng"
              id="btn-close-reader"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <div className="w-10 h-10 border-3 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium">Đang kết nối API Fanqie & giải mã chương...</p>
              <p className="text-xs text-stone-400 mt-1">Đang vượt qua cơ chế khóa chương web</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 text-red-500">
              <AlertCircle className="w-12 h-12 mb-3 opacity-80" />
              <p className="text-base font-semibold">Không thể tải hoặc giải mã chương</p>
              <p className="text-xs text-stone-400 mt-1 max-w-md">{error}</p>
            </div>
          ) : (
            <div
              className="max-w-2xl mx-auto leading-relaxed whitespace-pre-line tracking-wide select-text font-serif"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
            >
              <h1 className="font-bold text-xl sm:text-2xl mb-8 text-center pb-4 border-b border-stone-200/50">
                {title}
              </h1>
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
