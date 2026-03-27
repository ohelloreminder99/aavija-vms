'use client';

import * as React from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrScannerProps {
  /** Called once when a QR code is successfully decoded */
  onScan: (data: string) => void;
  /** Called when the camera fails to start */
  onError?: (error: string) => void;
  /** Width/height of the detection region (px). Default 260. */
  qrBoxSize?: number;
  /** Scan frequency in Hz. Default 10. */
  fps?: number;
  /** CSS class for the wrapper */
  className?: string;
}

/**
 * A resilient and mobile-first HTML5 QR Code scanner.
 * Uses the Polling Initialization Pattern to avoid DOM rendering timing issues.
 */
export default function QrScanner({
  onScan,
  onError,
  qrBoxSize = 250,
  fps = 10,
  className,
}: QrScannerProps) {
  const scannerId = React.useId().replace(/:/g, ''); // creates a safe DOM id
  const regionId = `scanner-region-${scannerId}`;
  
  const didScanRef = React.useRef(false);
  const scannerRef = React.useRef<Html5Qrcode | null>(null);

  React.useEffect(() => {
    let mounted = true;

    // Reset scan state on mount
    didScanRef.current = false;

    // DOM Polling Initialization Pattern
    const initializeScanner = () => {
      if (!mounted) return;
      
      const el = document.getElementById(regionId);
      if (!el) {
        // Not in DOM yet, poll again
        setTimeout(initializeScanner, 100);
        return;
      }

      // Element exists, safely initialize
      try {
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        const config = {
          fps: fps,
          qrbox: { width: qrBoxSize, height: qrBoxSize },
          aspectRatio: 1.0, 
        };

        scanner.start(
          { facingMode: 'environment' }, // Hardware targeting for rear camera
          config,
          (decodedText) => {
            // Race Condition Guard
            if (!didScanRef.current) {
              didScanRef.current = true; // Flip immediately
              
              // Clean-up Lifecycle: Stop hardware immediately upon successful scan
              try {
                 scanner.stop().then(() => {
                   scanner.clear();
                 }).catch(console.warn);
              } catch (e) {
                 // ignore stop errors
              }

              // Route to application logic
              onScan(decodedText);
            }
          },
          (errorMessage) => {
            // This fires on every frame without a QR code, which is noisy, so we usually ignore it.
            // But we can log if it's a fatal camera error
          }
        ).catch((err) => {
          if (mounted && onError) {
            onError(err?.message || 'Failed to start camera');
          }
        });

      } catch (err: any) {
        if (mounted && onError) {
          onError(err?.message || 'Failed to initialize scanner');
        }
      }
    };

    // Start polling loop
    initializeScanner();

    // Clean-up Lifecycle
    return () => {
      mounted = false;
      didScanRef.current = true; // prevent any pending callbacks
      
      const cleanupScanner = async () => {
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch (e) {
            console.warn('Scanner cleanup error:', e);
          }
        }
      };
      
      cleanupScanner();
    };
  }, [regionId, fps, qrBoxSize, onScan, onError]);

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', minHeight: '300px' }}>
      {/* Scanner binding region */}
      <div 
        id={regionId} 
        style={{ width: '100%', height: '100%', borderRadius: '1rem', overflow: 'hidden' }}
      ></div>
      
      {/* CSS overlay to hide the default html5-qrcode UI if desired, but html5-qrcode provides its own UI 
          Often we want to style the scanner using the ID itself. */}
      <style>{`
        #${regionId} {
          border-radius: 1rem;
          overflow: hidden;
        }
        #${regionId} video {
          border-radius: 1rem;
          object-fit: cover !important;
        }
        /* Hide the default start/stop buttons from the library if it injects any */
        #${regionId} button {
           display: none !important;
        }
        #${regionId}__status_span {
           display: none !important;
        }
      `}</style>
    </div>
  );
}
