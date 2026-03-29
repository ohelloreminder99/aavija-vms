'use client';

import * as React from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QrScannerProps {
  /** Called once when a QR code is successfully decoded */
  onScan: (data: string) => void;
  /** Called when the camera fails to start */
  onError?: (error: string) => void;
  /** CSS class for the wrapper */
  className?: string;
}

/**
 * A resilient and mobile-first HTML5 QR Code scanner.
 *
 * KEY FIX: onScan and onError are captured in a stable ref so they never
 * cause the useEffect to re-run and tear down the camera mid-scan.
 */
export default function QrScanner({ onScan, onError, className }: QrScannerProps) {
  // Use a static ID so the DOM element is stable across re-renders.
  const regionId = React.useId().replace(/:/g, '_') + '_scanner';

  const didScanRef = React.useRef(false);
  const scannerRef = React.useRef<Html5Qrcode | null>(null);

  // Capture the latest callbacks in refs so we never need to restart the
  // scanner when the parent re-renders and passes new function instances.
  const onScanRef = React.useRef(onScan);
  const onErrorRef = React.useRef(onError);
  React.useLayoutEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  });

  React.useEffect(() => {
    let mounted = true;
    didScanRef.current = false;

    const startScanner = (el: HTMLElement) => {
      if (!mounted) return;

      try {
        const scanner = new Html5Qrcode(regionId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = scanner;

        scanner
          .start(
            { facingMode: 'environment' },
            {
              fps: 25,
              // Responsive detection box — 75% of video feed dimensions.
              // Clamped between 200px and 400px to work on all screens.
              qrbox: (vW: number, vH: number) => {
                const side = Math.round(Math.min(vW, vH) * 0.75);
                const clamped = Math.max(200, Math.min(side, 400));
                return { width: clamped, height: clamped };
              },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              if (!didScanRef.current) {
                didScanRef.current = true;
                // Stop camera ASAP, then fire the callback
                try {
                  scanner
                    .stop()
                    .then(() => scanner.clear())
                    .catch(() => {});
                } catch (_) {}
                onScanRef.current(decodedText);
              }
            },
            (_errorMessage) => {
              // Per-frame decode errors are normal noise — suppress them.
            }
          )
          .catch((err) => {
            if (mounted && onErrorRef.current) {
              onErrorRef.current(err?.message || 'Failed to start camera');
            }
          });
      } catch (err: any) {
        if (mounted && onErrorRef.current) {
          onErrorRef.current(err?.message || 'Failed to initialize scanner');
        }
      }
    };

    // Poll until the DOM element is ready (handles React's async rendering)
    const tryInit = () => {
      if (!mounted) return;
      const el = document.getElementById(regionId);
      if (el) {
        startScanner(el);
      } else {
        setTimeout(tryInit, 80);
      }
    };

    tryInit();

    return () => {
      mounted = false;
      didScanRef.current = true; // Prevent stale callbacks from firing

      const cleanup = async () => {
        const s = scannerRef.current;
        if (!s) return;
        try {
          if (s.isScanning) await s.stop();
          s.clear();
        } catch (_) {}
        scannerRef.current = null;
      };

      cleanup();
    };
    // IMPORTANT: regionId is the only real dependency.
    // onScan/onError are tracked via their refs above.
  }, [regionId]);

  return (
    <div
      className={className}
      style={{ position: 'relative', overflow: 'hidden', minHeight: '300px' }}
    >
      {/* Scanner binding region */}
      <div
        id={regionId}
        className="w-full h-full rounded-2xl overflow-hidden"
        style={{ minHeight: '300px' }}
      />

      {/* Visual scanning line overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
        <div className="relative w-[80%] aspect-square border-2 border-emerald-500/50 rounded-2xl overflow-hidden">
          {/* Corner markers for better UX */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
          {/* Animated scanning line */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-scan-line" />
          <div className="absolute inset-0 bg-emerald-500/5" />
        </div>
      </div>

      <style>{`
        #${regionId} {
          border-radius: 1rem;
          overflow: hidden;
          background: #000;
        }
        #${regionId} video {
          border-radius: 1rem;
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 300px;
        }
        /* Hide all html5-qrcode UI chrome */
        #${regionId} button,
        #${regionId}__header_message,
        #${regionId}__status_span,
        #${regionId}__dashboard,
        #${regionId}__dashboard_section,
        #${regionId}__dashboard_section_swaplink,
        #${regionId}__dashboard_section_fileselection {
          display: none !important;
        }

        @keyframes scan-line {
          0%   { top: 4px;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% - 4px); opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
