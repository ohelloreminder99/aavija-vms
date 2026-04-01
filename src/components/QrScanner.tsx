'use client';

import * as React from 'react';
import jsQR from 'jsqr';

interface QrScannerProps {
  /** Called once when a QR code is successfully decoded */
  onScan: (data: string) => void;
  /** Called when the camera fails to start */
  onError?: (error: string) => void;
  /** CSS class for the wrapper */
  className?: string;
}

/**
 * A ultra-robust QR Scanner using jsQR directly on a canvas.
 * This approach provides maximum control over the processing loop,
 * bypassing common issues in high-level libraries.
 */
export default function QrScanner({ onScan, onError, className }: QrScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scanLoopRef = React.useRef<number | null>(null);
  const isScanningRef = React.useRef(true);

  // Use refs for callbacks to avoid re-running the effect
  const onScanRef = React.useRef(onScan);
  const onErrorRef = React.useRef(onError);
  
  React.useLayoutEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  });

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    isScanningRef.current = true;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Important for iOS compatibility
          videoRef.current.setAttribute('playsinline', 'true'); 
          try {
             await videoRef.current.play();
          } catch (e) {
             console.error("Video play failed:", e);
          }
          requestAnimationFrame(scan);
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        onErrorRef.current?.(err.message || "Could not access camera. Please check permissions.");
      }
    };

    const scan = () => {
      if (!isScanningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        scanLoopRef.current = requestAnimationFrame(scan);
        return;
      }

      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      // Match canvas to video stream resolution for scanning
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw frame to hidden canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data for jsQR
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // DECODE
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        isScanningRef.current = false;
        onScanRef.current(code.data);
        return; // Stop the loop
      }

      scanLoopRef.current = requestAnimationFrame(scan);
    };

    startCamera();

    return () => {
      isScanningRef.current = false;
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={className} 
      style={{ position: 'relative', overflow: 'hidden', minHeight: '300px', backgroundColor: '#000' }}
    >
      {/* The visible video feed */}
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        playsInline
        muted
        autoPlay
      />

      {/* Hidden canvas for pixel extraction */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* UX Overlay: Visual scanning box and line */}
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
        <div className="relative w-[70%] aspect-square border-2 border-emerald-500/40 rounded-2xl overflow-hidden backdrop-blur-[1px]">
          {/* Corner Markers */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />
          
          {/* Scanning Line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-scan-line" />
          <div className="absolute inset-0 bg-emerald-500/5" />
        </div>
        
        {/* Subtle hint */}
        <div className="absolute bottom-10 left-0 right-0 text-center">
           <span className="px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] text-emerald-400 font-bold uppercase tracking-widest border border-emerald-500/20">
              Detecting Visitor QR...
           </span>
        </div>
      </div>

      <style>{`
        @keyframes scan-line {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
