import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Columns,
  Rows3,
  Copy,
  Check,
  Download,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ArrowLeftRight,
  Plus,
  Minus
} from 'lucide-react';

export interface AlignedChapter {
  index: number;
  rawTitle: string;
  rawContent: string;
  rawParas: string[];
  transTitle: string;
  transContent: string;
  transParas: string[];
}

const CHINESE_CHAPTER_REGEX = /^[\s*_#=\-\[\(【《]*第\s*[0-9一二三四五六七八九十百千万]+\s*[章回节卷]|^[\s*_#=\-\[\(【《]*(?:Chapter|Chap)\s*\d+/i;
const VIETNAMESE_CHAPTER_REGEX = /^[\s*_#=\-\[\(【《]*(?:Chương|chuong|CHƯƠNG|CHUONG|Cương|cương|Chapter|chapter|Chap|chap)\s*([0-9一二三四五六七八九十百千万IVXLCDM]+|[0-9]+)\b/i;

function splitTextIntoChapters(text: string, isChinese: boolean): { title: string; content: string }[] {
  if (!text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const strictRegex = isChinese ? CHINESE_CHAPTER_REGEX : VIETNAMESE_CHAPTER_REGEX;

  // Check if text has any explicit chapter keyword lines
  const hasStrictKeywords = lines.some(l => {
    const clean = l.replace(/[\u00A0\u3000\t]+/g, ' ').trim();
    return clean.length <= 250 && strictRegex.test(clean);
  });

  const fallbackNumberRegex = isChinese 
    ? /^[\s*_#=\-\[\(【《]*[0-9]{1,5}\s*[.、\s\-_–—:：]/ 
    : /^[\s*_#=\-\[\(【《]*[0-9]{1,5}\s*[:.、\-_–—\s][a-zA-Zà-ỹÀ-Ỹ0-9]/;

  const chapters: { title: string; content: string }[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const cleanLine = rawLine.replace(/[\u00A0\u3000\t]+/g, ' ').trim();
    if (!cleanLine) continue;

    const isHeading = cleanLine.length <= 250 && (
      strictRegex.test(cleanLine) ||
      (!hasStrictKeywords && fallbackNumberRegex.test(cleanLine))
    );

    if (isHeading) {
      if (currentTitle) {
        chapters.push({
          title: currentTitle,
          content: currentLines.join('\n').trim()
        });
        currentLines = [];
      } else {
        // Discard preamble lines before the first real chapter heading
        currentLines = [];
      }
      currentTitle = cleanLine;
    } else {
      currentLines.push(cleanLine);
    }
  }

  if (currentTitle) {
    chapters.push({
      title: currentTitle,
      content: currentLines.join('\n').trim()
    });
  } else if (currentLines.length > 0) {
    chapters.push({
      title: isChinese ? '第1章' : 'Chương 1',
      content: currentLines.join('\n').trim()
    });
  }

  return chapters;
}

function splitIntoParagraphs(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

const SAMPLE_RAW = `第1章 绝处逢生
夜幕降临，暴雨倾盆。
少年林云浑身是血地倒在泥泞中，冰冷的雨水不断冲刷着他身上的伤口。
“林云，交出九阳神玉，我可以给你留个全尸！”
树林深处，三名黑衣人步步紧逼，眼中满是贪婪与杀意。
林云咬紧牙关，死死护住怀中温热的玉佩。

第2章 神玉认主
就在剑尖刺入林云胸膛的瞬间，九阳神玉突然爆发出万道金光！
璀璨的神芒瞬间笼罩方圆百丈，狂暴的气浪直接将三名黑衣人轰飞出数十丈远。
“这……这是神器觉醒？！”
黑衣首领满脸惊恐，然而还没等他爬起来，一道刺目的剑芒已然划破雨夜。
神玉融入林云体内，经脉重生，一股无穷无尽的龙魂之力在他丹田内汹涌觉醒！`;

const SAMPLE_TRANS = `Chương 1: Tuyệt xứ phùng sinh
Màn đêm buông xuống, mưa như trút nước.
Thiếu niên Lâm Vân toàn thân đẫm máu ngã quỵ giữa vũng bùn lầy, làn nước mưa lạnh buốt không ngừng xối xả lên những vết thương chằng chịt trên người hắn.
"Lâm Vân, giao Cửu Dương Thần Ngọc ra đây, ta có thể cho ngươi giữ lại một cái toàn thây!"
Từ sâu trong rừng cây, ba tên hắc y nhân từng bước ép sát, trong mắt tràn ngập vẻ tham lam cùng sát khí nồng nặc.
Lâm Vân nghiến chặt răng, liều mạng ôm chặt lấy khối ngọc bội ấm áp trong lồng ngực.

Chương 2: Thần ngọc nhận chủ
Ngay khoảnh khắc mũi kiếm đâm thẳng vào lồng ngực Lâm Vân, Cửu Dương Thần Ngọc bỗng bộc phát ra muôn vàn tia kim quang chói lọi!
Hào quang thần thánh rực rỡ lập tức bao phủ phạm vi trăm trượng, sóng khí cuồng bạo trực tiếp đánh bay ba tên hắc y nhân ra xa mấy chục trượng.
"Đây... đây là Thần Khí thức tỉnh?!"
Tên thủ lĩnh áo đen kinh hoàng tột độ, thế nhưng còn chưa kịp gượng dậy, một đường kiếm quang chói mắt đã xé toạc màn đêm mưa gió.
Thần ngọc dung hợp vào cơ thể Lâm Vân, kinh mạch tái sinh, một luồng long hồn chi lực vô cùng vô tận điên cuồng thức tỉnh trong đan điền hắn!`;

export const ChapterAlignmentView: React.FC = () => {
  const [rawText, setRawText] = useState<string>(() => {
    try { return localStorage.getItem('align_raw_text') || ''; } catch { return ''; }
  });
  const [transText, setTransText] = useState<string>(() => {
    try { return localStorage.getItem('align_trans_text') || ''; } catch { return ''; }
  });
  const [isAnalyzed, setIsAnalyzed] = useState<boolean>(() => {
    try { return localStorage.getItem('align_is_analyzed') === 'true'; } catch { return false; }
  });
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('align_active_chapter');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch { return 0; }
  });
  const [viewMode, setViewMode] = useState<'columns' | 'interleaved'>('columns');
  const [theme, setTheme] = useState<'light' | 'sepia' | 'dark'>('light');
  const [fontSize, setFontSize] = useState<number>(16);
  const [syncScroll, setSyncScroll] = useState<boolean>(true);
  const [transOffset, setTransOffset] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('align_trans_offset');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch { return 0; }
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeParaHover, setActiveParaHover] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Auto-save draft to localStorage whenever content or state changes
  useEffect(() => {
    try {
      localStorage.setItem('align_raw_text', rawText);
      localStorage.setItem('align_trans_text', transText);
      localStorage.setItem('align_is_analyzed', String(isAnalyzed));
      localStorage.setItem('align_active_chapter', String(activeChapterIndex));
      localStorage.setItem('align_trans_offset', String(transOffset));
    } catch (e) {}
  }, [rawText, transText, isAnalyzed, activeChapterIndex, transOffset]);

  const handleClear = () => {
    setRawText('');
    setTransText('');
    setIsAnalyzed(false);
    setActiveChapterIndex(0);
    setTransOffset(0);
    try {
      localStorage.removeItem('align_raw_text');
      localStorage.removeItem('align_trans_text');
      localStorage.removeItem('align_is_analyzed');
      localStorage.removeItem('align_active_chapter');
      localStorage.removeItem('align_trans_offset');
    } catch (e) {}
  };

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<'left' | 'right' | null>(null);

  const rawChapters = useMemo(() => splitTextIntoChapters(rawText, true), [rawText]);
  const transChapters = useMemo(() => splitTextIntoChapters(transText, false), [transText]);

  const alignedChapters: AlignedChapter[] = useMemo(() => {
    const total = Math.max(rawChapters.length, transChapters.length + transOffset);
    const list: AlignedChapter[] = [];

    for (let i = 0; i < total; i++) {
      const raw = rawChapters[i];
      const transIndex = i - transOffset;
      const trans = transIndex >= 0 && transIndex < transChapters.length ? transChapters[transIndex] : undefined;

      list.push({
        index: i,
        rawTitle: raw ? raw.title : '',
        rawContent: raw ? raw.content : '',
        rawParas: raw ? splitIntoParagraphs(raw.content) : [],
        transTitle: trans ? trans.title : '',
        transContent: trans ? trans.content : '',
        transParas: trans ? splitIntoParagraphs(trans.content) : []
      });
    }

    return list;
  }, [rawChapters, transChapters, transOffset]);

  const currentChapter = alignedChapters[activeChapterIndex] || alignedChapters[0];

  const maxParasCount = useMemo(() => {
    if (!currentChapter) return 0;
    return Math.max(currentChapter.rawParas.length, currentChapter.transParas.length);
  }, [currentChapter]);

  const handleLeftScroll = () => {
    if (!syncScroll || isScrollingRef.current === 'right') return;
    isScrollingRef.current = 'left';
    if (leftScrollRef.current && rightScrollRef.current) {
      const left = leftScrollRef.current;
      const right = rightScrollRef.current;
      const percentage = left.scrollTop / (left.scrollHeight - left.clientHeight || 1);
      right.scrollTop = percentage * (right.scrollHeight - right.clientHeight);
    }
    setTimeout(() => {
      if (isScrollingRef.current === 'left') isScrollingRef.current = null;
    }, 50);
  };

  const handleRightScroll = () => {
    if (!syncScroll || isScrollingRef.current === 'left') return;
    isScrollingRef.current = 'right';
    if (leftScrollRef.current && rightScrollRef.current) {
      const left = leftScrollRef.current;
      const right = rightScrollRef.current;
      const percentage = right.scrollTop / (right.scrollHeight - right.clientHeight || 1);
      left.scrollTop = percentage * (left.scrollHeight - left.clientHeight);
    }
    setTimeout(() => {
      if (isScrollingRef.current === 'right') isScrollingRef.current = null;
    }, 50);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleExportTxt = () => {
    let output = '';
    alignedChapters.forEach((ch, i) => {
      output += `${ch.rawTitle || `Chương ${i + 1}`}\n${ch.transTitle}\n\n`;
      const maxP = Math.max(ch.rawParas.length, ch.transParas.length);
      for (let p = 0; p < maxP; p++) {
        if (ch.rawParas[p]) output += `${ch.rawParas[p]}\n`;
        if (ch.transParas[p]) output += `${ch.transParas[p]}\n`;
        output += '\n';
      }
      output += '\n\n';
    });

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Doi_Chieu_${alignedChapters.length}_chuong.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const themeStyles = {
    light: {
      bg: 'bg-white',
      text: 'text-stone-800',
      border: 'border-stone-200',
      paraHover: 'hover:bg-amber-50/60',
      paraActive: 'bg-amber-100/70 border-l-2 border-amber-500'
    },
    sepia: {
      bg: 'bg-[#f8f1e5]',
      text: 'text-[#433422]',
      border: 'border-[#e4d5be]',
      paraHover: 'hover:bg-[#ede0ce]',
      paraActive: 'bg-[#e5d5c0] border-l-2 border-[#9c6d3b]'
    },
    dark: {
      bg: 'bg-[#1c1c1e]',
      text: 'text-stone-200',
      border: 'border-stone-800',
      paraHover: 'hover:bg-stone-800/60',
      paraActive: 'bg-stone-800 border-l-2 border-amber-400'
    }
  }[theme];

  return (
    <div className={`w-full ${isFullscreen ? 'fixed inset-0 z-50 bg-[#faf9f6] overflow-y-auto p-4' : 'space-y-3'}`}>
      {!isAnalyzed ? (
        /* STEP 1: INPUT BOXES */
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Raw Input */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col space-y-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-stone-800">Raw</span>
                <span className="text-[11px] text-stone-500 font-medium">
                  {rawChapters.length > 0 ? `${rawChapters.length} chương` : ''}
                </span>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Dán toàn bộ Raw vào đây (hỗ trợ hàng chục hoặc hàng trăm chương)..."
                className="w-full h-80 sm:h-96 p-3 text-xs leading-relaxed font-mono bg-stone-50/60 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-stone-400 transition-all resize-none"
              />
            </div>

            {/* Translation Input */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col space-y-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-stone-800">Bản Dịch</span>
                <span className="text-[11px] text-stone-500 font-medium">
                  {transChapters.length > 0 ? `${transChapters.length} chương` : ''}
                </span>
              </div>
              <textarea
                value={transText}
                onChange={(e) => setTransText(e.target.value)}
                placeholder="Dán toàn bộ bản dịch tương ứng vào đây..."
                className="w-full h-80 sm:h-96 p-3 text-xs leading-relaxed font-sans bg-stone-50/60 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-stone-400 transition-all resize-none"
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {(rawText || transText) && (
                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Xóa
                </button>
              )}
            </div>

            <button
              onClick={() => {
                if (!rawText.trim() && !transText.trim()) return;
                setIsAnalyzed(true);
                setActiveChapterIndex(0);
              }}
              disabled={!rawText.trim() && !transText.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Đối chiếu</span>
            </button>
          </div>
        </div>
      ) : (
        /* STEP 2: COMPARISON WORKSPACE */
        <div className="space-y-2.5">
          {/* Top Control Bar */}
          <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
            {/* Chapter Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveChapterIndex(Math.max(0, activeChapterIndex - 1))}
                disabled={activeChapterIndex === 0}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-stone-700" />
              </button>

              <select
                value={activeChapterIndex}
                onChange={(e) => setActiveChapterIndex(parseInt(e.target.value, 10))}
                className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-bold text-stone-800 bg-stone-50 focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[240px]"
              >
                {alignedChapters.map((ch, idx) => (
                  <option key={idx} value={idx}>
                    Chương {idx + 1} {ch.rawTitle || ch.transTitle ? `: ${ch.rawTitle || ch.transTitle}` : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setActiveChapterIndex(Math.min(alignedChapters.length - 1, activeChapterIndex + 1))}
                disabled={activeChapterIndex === alignedChapters.length - 1}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-stone-700" />
              </button>

              <span className="text-xs font-medium text-stone-400 ml-1">
                {activeChapterIndex + 1}/{alignedChapters.length}
              </span>
            </div>

            {/* View Mode & Customization */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
                <button
                  onClick={() => setViewMode('columns')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    viewMode === 'columns' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>2 Cột</span>
                </button>

                <button
                  onClick={() => setViewMode('interleaved')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    viewMode === 'interleaved' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Rows3 className="w-3.5 h-3.5" />
                  <span>Xen kẽ</span>
                </button>
              </div>

              {/* Offset adjustment */}
              <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200 text-[11px] text-stone-600">
                <span>Lệch:</span>
                <button
                  onClick={() => setTransOffset(transOffset - 1)}
                  className="px-1.5 py-0.5 bg-white rounded border border-stone-200 font-bold hover:bg-stone-100 cursor-pointer"
                >
                  -1
                </button>
                <span className="font-bold min-w-[16px] text-center">{transOffset}</span>
                <button
                  onClick={() => setTransOffset(transOffset + 1)}
                  className="px-1.5 py-0.5 bg-white rounded border border-stone-200 font-bold hover:bg-stone-100 cursor-pointer"
                >
                  +1
                </button>
              </div>

              {/* Theme */}
              <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                <button
                  onClick={() => setTheme('light')}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    theme === 'light' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-400'
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => setTheme('sepia')}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all cursor-pointer bg-[#f4ebd9] ${
                    theme === 'sepia' ? 'ring-1 ring-[#9c6d3b] text-[#5e4428]' : 'text-[#856b4f]'
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all cursor-pointer bg-stone-900 ${
                    theme === 'dark' ? 'ring-1 ring-stone-400 text-white' : 'text-stone-500'
                  }`}
                >
                  A
                </button>
              </div>

              {/* Font size */}
              <div className="flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded-lg border border-stone-200">
                <button
                  onClick={() => setFontSize(Math.max(12, fontSize - 1))}
                  className="p-1 hover:bg-stone-200 rounded text-stone-600 cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-[11px] font-bold text-stone-700 min-w-[14px] text-center">{fontSize}</span>
                <button
                  onClick={() => setFontSize(Math.min(26, fontSize + 1))}
                  className="p-1 hover:bg-stone-200 rounded text-stone-600 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={handleExportTxt}
                className="p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                title="Xuất file TXT"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsAnalyzed(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đổi bài</span>
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* MAIN COMPARISON VIEW */}
          {currentChapter && (
            <div className={`rounded-2xl border ${themeStyles.border} ${themeStyles.bg} shadow-xs overflow-hidden`}>
              {/* Header Title Bar */}
              <div className={`px-4 py-3 border-b ${themeStyles.border} flex items-center justify-between gap-3 bg-stone-50/40`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-stone-500">Chương {activeChapterIndex + 1}</span>
                  <span className={`text-xs sm:text-sm font-bold ${themeStyles.text}`}>
                    {currentChapter.rawTitle || currentChapter.transTitle}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => copyToClipboard(currentChapter.rawContent, `raw_${activeChapterIndex}`)}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition-colors cursor-pointer"
                  >
                    {copiedKey === `raw_${activeChapterIndex}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Raw</span>
                  </button>

                  <button
                    onClick={() => copyToClipboard(currentChapter.transContent, `trans_${activeChapterIndex}`)}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 transition-colors cursor-pointer"
                  >
                    {copiedKey === `trans_${activeChapterIndex}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Dịch</span>
                  </button>
                </div>
              </div>

              {/* View Content */}
              {viewMode === 'columns' ? (
                /* 2 Columns View */
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200">
                  {/* Left: Raw */}
                  <div className="flex flex-col h-[650px]">
                    <div className="px-4 py-1.5 bg-stone-100/60 border-b border-stone-200 text-xs font-bold text-stone-700">
                      Raw
                    </div>
                    <div
                      ref={leftScrollRef}
                      onScroll={handleLeftScroll}
                      className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 font-mono"
                      style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
                    >
                      {currentChapter.rawParas.length > 0 ? (
                        currentChapter.rawParas.map((para, pIdx) => (
                          <p
                            key={pIdx}
                            onMouseEnter={() => setActiveParaHover(pIdx)}
                            onMouseLeave={() => setActiveParaHover(null)}
                            className={`p-1.5 rounded transition-all ${themeStyles.text} ${
                              activeParaHover === pIdx ? themeStyles.paraActive : themeStyles.paraHover
                            }`}
                          >
                            {para}
                          </p>
                        ))
                      ) : (
                        <div className="text-xs text-stone-400 italic py-8 text-center">Không có Raw</div>
                      )}
                    </div>
                  </div>

                  {/* Right: Trans */}
                  <div className="flex flex-col h-[650px]">
                    <div className="px-4 py-1.5 bg-stone-100/60 border-b border-stone-200 text-xs font-bold text-stone-700">
                      Bản Dịch
                    </div>
                    <div
                      ref={rightScrollRef}
                      onScroll={handleRightScroll}
                      className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 font-sans"
                      style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
                    >
                      {currentChapter.transParas.length > 0 ? (
                        currentChapter.transParas.map((para, pIdx) => (
                          <p
                            key={pIdx}
                            onMouseEnter={() => setActiveParaHover(pIdx)}
                            onMouseLeave={() => setActiveParaHover(null)}
                            className={`p-1.5 rounded transition-all ${themeStyles.text} ${
                              activeParaHover === pIdx ? themeStyles.paraActive : themeStyles.paraHover
                            }`}
                          >
                            {para}
                          </p>
                        ))
                      ) : (
                        <div className="text-xs text-stone-400 italic py-8 text-center">Không có bản dịch</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Interleaved View */
                <div className="p-4 sm:p-6 space-y-3 max-h-[700px] overflow-y-auto">
                  {Array.from({ length: maxParasCount }).map((_, pIdx) => {
                    const rawP = currentChapter.rawParas[pIdx];
                    const transP = currentChapter.transParas[pIdx];

                    return (
                      <div
                        key={pIdx}
                        className={`p-3 rounded-xl border ${themeStyles.border} transition-all space-y-2 ${
                          activeParaHover === pIdx ? themeStyles.paraActive : themeStyles.bg
                        }`}
                        onMouseEnter={() => setActiveParaHover(pIdx)}
                        onMouseLeave={() => setActiveParaHover(null)}
                      >
                        {rawP && (
                          <p
                            className={`font-mono ${themeStyles.text}`}
                            style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
                          >
                            {rawP}
                          </p>
                        )}
                        {transP && (
                          <p
                            className={`font-sans text-emerald-800 dark:text-emerald-300 font-medium`}
                            style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
                          >
                            {transP}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom chapter navigation */}
              <div className={`px-4 py-3 border-t ${themeStyles.border} bg-stone-50/50 flex items-center justify-between`}>
                <button
                  onClick={() => {
                    setActiveChapterIndex(Math.max(0, activeChapterIndex - 1));
                    if (leftScrollRef.current) leftScrollRef.current.scrollTop = 0;
                    if (rightScrollRef.current) rightScrollRef.current.scrollTop = 0;
                  }}
                  disabled={activeChapterIndex === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </button>

                <span className="text-xs font-semibold text-stone-500">
                  {activeChapterIndex + 1}/{alignedChapters.length}
                </span>

                <button
                  onClick={() => {
                    setActiveChapterIndex(Math.min(alignedChapters.length - 1, activeChapterIndex + 1));
                    if (leftScrollRef.current) leftScrollRef.current.scrollTop = 0;
                    if (rightScrollRef.current) rightScrollRef.current.scrollTop = 0;
                  }}
                  disabled={activeChapterIndex === alignedChapters.length - 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Sau</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
