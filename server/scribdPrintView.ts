import { ScribdDocInfo } from './scribdCore';

export function buildPrintableScribdHtml(
  info: ScribdDocInfo,
  pagesHtml: string[],
  scribdStyle: string,
  fontStyles: string = ''
): string {
  const wrappedPages = pagesHtml.map((pHtml, idx) => {
    return `<div class="page-wrapper" id="page-wrapper-${idx + 1}" data-page="${idx + 1}">
      ${pHtml}
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>${info.title || 'Tài liệu Scribd'}</title>
  
  <!-- Scribd Original Embed CSS -->
  ${scribdStyle}
  
  <!-- Scribd Extracted Web Fonts -->
  ${fontStyles}

  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      background: #3f4245;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      color: #1a1a1a;
    }
    
    /* Top Action & Status Bar */
    .print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 56px;
      background: #0f172a;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 99999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      gap: 16px;
    }
    .print-bar .title-group {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      max-width: 55%;
    }
    .print-bar .doc-icon {
      font-size: 20px;
      flex-shrink: 0;
    }
    .print-bar .title {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #f8fafc;
    }
    .print-bar .badge {
      background: #334155;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    
    .print-bar .actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    
    .status-pill {
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
    }
    .status-pill.ready {
      background: #14532d;
      color: #86efac;
    }
    
    .print-btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 9px 18px;
      border-radius: 7px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;
      box-shadow: 0 2px 6px rgba(37,99,235,0.3);
    }
    .print-btn:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }
    .print-btn:active {
      transform: translateY(0);
    }

    /* Document Pages Container */
    .document-container {
      margin-top: 76px;
      margin-bottom: 60px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      align-items: center;
      padding: 0 16px;
    }

    /* Page Wrapper & High-Fidelity Rendering */
    .page-wrapper {
      position: relative;
      background: #ffffff;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
      border-radius: 2px;
      overflow: hidden;
      width: 902px;
      height: 1274px;
    }

    .newpage {
      background: #ffffff !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 902px !important;
      height: 1274px !important;
      overflow: hidden !important;
      display: block !important;
    }

    .text_layer {
      width: 0 !important;
      height: 0 !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      transform: scale(0.2) !important;
      transform-origin: top left !important;
      visibility: visible !important;
      opacity: 1 !important;
    }

    .text_layer div, .text_layer span {
      white-space: nowrap !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      line-height: 1 !important;
      visibility: visible !important;
    }

    .image_layer {
      width: 0 !important;
      height: 0 !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      visibility: visible !important;
    }

    .image_layer .absimg {
      position: absolute !important;
      pointer-events: none !important;
      border: none !important;
      left: 0 !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      max-width: none !important;
    }

    /* Print Specific Styles */
    @media print {
      @page {
        size: A4 portrait;
        margin: 0mm;
      }
      
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        width: 210mm !important;
        height: auto !important;
        min-height: auto !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      .print-bar {
        display: none !important;
      }
      
      .document-container {
        margin: 0 !important;
        padding: 0 !important;
        gap: 0 !important;
        display: block !important;
        width: 210mm !important;
      }
      
      .page-wrapper {
        width: 210mm !important;
        height: 297mm !important;
        max-width: 210mm !important;
        max-height: 297mm !important;
        page-break-after: always !important;
        page-break-inside: avoid !important;
        break-after: page !important;
        overflow: hidden !important;
        position: relative !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        display: block !important;
      }
      
      .page-wrapper > .newpage {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 902px !important;
        height: 1274px !important;
        /* Scale exactly from 902x1274 px to A4 210x297 mm (793.7x1122.5 px at 96 DPI) */
        transform: scale(0.8799) !important;
        transform-origin: top left !important;
        margin: 0 !important;
        box-shadow: none !important;
        overflow: hidden !important;
        display: block !important;
        visibility: visible !important;
      }

      .text_layer {
        transform: scale(0.2) !important;
        transform-origin: top left !important;
        visibility: visible !important;
      }

      .image_layer .absimg {
        visibility: visible !important;
        opacity: 1 !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div class="title-group">
      <span class="doc-icon">📄</span>
      <div class="title" title="${info.title}">${info.title}</div>
      <span class="badge">${pagesHtml.length} trang</span>
    </div>

    <div class="actions">
      <div id="status-badge" class="status-pill">
        <span id="spinner">🔄</span>
        <span id="status-text">Đang nạp dữ liệu...</span>
      </div>

      <button class="print-btn" id="btn-do-print" onclick="startPrintProcess()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        <span>In / Lưu PDF (Ctrl + P)</span>
      </button>
    </div>
  </div>

  <div class="document-container" id="doc-container">
    ${wrappedPages}
  </div>

  <script>
    let isFullyLoaded = false;

    // Check preloading of all images & fonts
    async function checkReadiness() {
      const statusText = document.getElementById('status-text');
      const statusBadge = document.getElementById('status-badge');
      const spinner = document.getElementById('spinner');

      const images = Array.from(document.querySelectorAll('.image_layer img'));
      let loadedCount = 0;
      const totalImages = images.length;

      const updateProgress = () => {
        if (totalImages > 0) {
          statusText.textContent = 'Đang tải hình ảnh (' + loadedCount + '/' + totalImages + ')...';
        }
      };

      if (totalImages === 0) {
        setReady();
        return;
      }

      const imgPromises = images.map((img) => {
        return new Promise((resolve) => {
          if (img.complete && img.naturalHeight !== 0) {
            loadedCount++;
            resolve();
          } else {
            img.onload = () => {
              loadedCount++;
              updateProgress();
              resolve();
            };
            img.onerror = () => {
              loadedCount++;
              updateProgress();
              resolve();
            };
          }
        });
      });

      // Also wait for document fonts
      const fontsPromise = document.fonts ? document.fonts.ready : Promise.resolve();

      // Wait for all images or 3.5s timeout max
      await Promise.race([
        Promise.all([...imgPromises, fontsPromise]),
        new Promise((res) => setTimeout(res, 3500))
      ]);

      setReady();
    }

    function setReady() {
      isFullyLoaded = true;
      const statusText = document.getElementById('status-text');
      const statusBadge = document.getElementById('status-badge');
      const spinner = document.getElementById('spinner');

      if (statusBadge && statusText && spinner) {
        statusBadge.classList.add('ready');
        spinner.textContent = '✅';
        statusText.textContent = 'Đã sẵn sàng in';
      }

      // Check autoprint
      if (new URLSearchParams(window.location.search).get('autoprint') === 'true') {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    }

    function startPrintProcess() {
      window.print();
    }

    window.addEventListener('load', () => {
      checkReadiness();
    });

    // Keyboard shortcut Ctrl+P / Cmd+P
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        startPrintProcess();
      }
    });
  </script>
</body>
</html>`;
}
