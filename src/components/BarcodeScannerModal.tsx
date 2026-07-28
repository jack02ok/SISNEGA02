import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, Keyboard, CheckCircle } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  placeholderText?: string;
}

export const BarcodeScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Scan Barcode ID Card / Buku",
  placeholderText = "Atau ketik ID / NISN / Kode Buku..."
}) => {
  const [manualInput, setManualInput] = useState('');
  const [scannedResult, setScannedResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let scanner: Html5QrcodeScanner | null = null;
    const scannerRegionId = "html5-qr-code-region";

    // Small delay to allow modal DOM rendering
    const timer = setTimeout(() => {
      const element = document.getElementById(scannerRegionId);
      if (element) {
        scanner = new Html5QrcodeScanner(
          scannerRegionId,
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.77,
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            setScannedResult(decodedText);
            if (scanner) {
              scanner.clear().catch(err => console.error(err));
            }
            onScanSuccess(decodedText);
            onClose();
          },
          (error) => {
            // silent scan errors
          }
        );
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (scanner) {
        scanner.clear().catch(err => console.error("Error clearing scanner", err));
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onScanSuccess(manualInput.trim());
    setManualInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>
              <p className="text-xs text-slate-500">Arahkan kamera ke Barcode / QR Code ID Card Siswa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Region */}
        <div className="my-4 bg-slate-900 rounded-xl p-2 min-h-[220px] flex items-center justify-center overflow-hidden">
          <div id="html5-qr-code-region" className="w-full text-white"></div>
        </div>

        {/* Manual Fallback Input */}
        <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-slate-400" />
            Input Manual (Jika kamera tidak aktif / tersedia)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={placeholderText}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Proses
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
