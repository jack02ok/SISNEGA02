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
