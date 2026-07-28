// @ts-ignore - html2pdf.js module declaration fallback
import html2pdf from 'html2pdf.js';

export function downloadElementAsPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert("Elemen PDF tidak ditemukan!");
    return;
  }

  const opt = {
    margin:       0.5,
    filename:     filename || 'dokumen.pdf',
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
  };

  html2pdf().set(opt).from(element).save();
}

/**
 * Print a target HTML element directly to physical printer or browser native PDF print dialog
 */
export function printElement(elementId: string, title?: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert("Elemen dokumen untuk dicetak tidak ditemukan!");
    return;
  }

  // Clone element to avoid modifying original DOM
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.display = 'block';

  // Open dedicated print window
  const printWin = window.open('', '_blank', 'width=900,height=700');
  if (printWin) {
    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>${title || 'Cetak Dokumen'}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0;
                padding: 15px;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print, button, nav, header {
                display: none !important;
              }
              @page {
                size: A4;
                margin: 10mm;
              }
            }
            body {
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              padding: 20px;
              background: #fff;
              color: #000;
            }
            .no-print {
              margin-bottom: 20px;
              padding: 10px;
              background: #f1f5f9;
              border-radius: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
          </style>
        </head>
        <body>
          <div className="no-print" style="margin-bottom: 20px; padding: 12px 16px; background: #f1f5f9; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #cbd5e1;">
            <span style="font-size: 13px; font-weight: bold; color: #334155;">🖨️ Dokumen Siap Dicetak</span>
            <button onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">
              Klik Untuk Cetak (Printer / PDF)
            </button>
          </div>
          <div>${clone.outerHTML}</div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  } else {
    // Fallback if popup blocked: direct window.print()
    window.print();
  }
}

