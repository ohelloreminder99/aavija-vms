'use client';

import * as React from 'react';
import jsQR from 'jsqr';

interface QrScannerProps {
  /** Called once when a QR code is successfully decoded */
  onScan: (data: string) => void;
  /** Called when the camera fails to start */
  onError?: (error: string) => void;
  /** Width/height of the detection region (px). Default 260. */
  qrBoxSize?: number;
  /** Scan frequency in Hz. Default 15. */
  fps?: number;
  /** CSS class for the wrapper */
  className?: string;
}

/**
 * A lightweight QR-code scanner built on getUserMedia + jsQR.
 * Replaces html5-qrcode for reliability.
 *
 * Usage:
 *   <QrScanner onScan={(text) => console.log(text)} />
 */
export default function QrScanner({
  onScan,
  onError,
  qrBoxSize = 260,
  fps = 15,
  className,
}: QrScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number>(0);
  const didScanRef = React.useRef(false);
  const lastScanTimeRef = React.useRef(0);

  React.useEffect(() => {
    let mounted = true;
    const interval = 1000 / fps;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true'); // Required for iOS
          await video.play();
          scanLoop();
        }
      } catch (err: any) {
        if (mounted) {
          onError?.(err.message || 'Camera access denied or unavailable.');
        }
      }
    };

    const scanLoop = () => {
      if (!mounted || didScanRef.current) return;

      const now = performance.now();
      if (now - lastScanTimeRef.current < interval) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }
      lastScanTimeRef.current = now;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      // Set canvas to the video's natural resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to the hidden canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get the pixel data and run jsQR on it
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data && !didScanRef.current) {
        didScanRef.current = true;
        // Stop the camera immediately
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        onScan(code.data);
        return; // Don't schedule the next frame
      }

      rafRef.current = requestAnimationFrame(scanLoop);
    };

    startCamera();

    return () => {
      mounted = false;
      didScanRef.current = true; // Prevent further scanning
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [onScan, onError, fps]);

  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Live camera feed */}
      <video
        ref={videoRef}
        style={{ width: '100%', display: 'block', borderRadius: '1rem' }}
        muted
        playsInline
      />
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {/* Scan region overlay */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: qrBoxSize,
          height: qrBoxSize,
          transform: 'translate(-50%, -50%)',
          border: '2px solid rgba(255,255,255,0.5)',
          borderRadius: '1rem',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}
      />
      {/* Animated scan line */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          width: qrBoxSize - 20,
          height: 2,
          transform: 'translateX(-50%)',
          background: 'linear-gradient(90deg, transparent, var(--primary, #22c55e), transparent)',
          borderRadius: 4,
          animation: 'qrScanLine 2s ease-in-out infinite',
          top: '30%',
          boxShadow: '0 0 8px 2px rgba(34, 197, 94, 0.4)',
          pointerEvents: 'none',
        }}
      />
      <style>{`
        @keyframes qrScanLine {
          0%, 100% { top: calc(50% - ${qrBoxSize / 2 - 10}px); }
          50% { top: calc(50% + ${qrBoxSize / 2 - 10}px); }
        }
      `}</style>
    </div>
  );
}
