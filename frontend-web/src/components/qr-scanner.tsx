"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface QrScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<any>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mounted || !scannerRef.current) return;

      const scanner = new Html5Qrcode("qr-reader");
      html5QrRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            scanner.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {},
        );
        if (mounted) setReady(true);
      } catch (err: any) {
        if (mounted) {
          setError(
            err?.message?.includes("NotAllowed") || err?.message?.includes("Permission")
              ? "Camera permission denied. Please allow camera access and try again."
              : "Could not access camera. Make sure no other app is using it."
          );
        }
      }
    };

    init();

    return () => {
      mounted = false;
      html5QrRef.current?.stop?.().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: "rgba(0,0,0,0.92)" }}>
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: "#ffffff" }}>Scan QR Code</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <X className="w-5 h-5" style={{ color: "#ffffff" }} />
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden" style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div id="qr-reader" ref={scannerRef} className="w-full" />
          {!ready && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "#1a1a2e" }}>
              <Camera className="w-10 h-10 animate-pulse" style={{ color: "#ffffff" }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Starting camera...</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl text-center" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
            <button
              onClick={onClose}
              className="mt-3 px-4 py-2 rounded-lg text-sm transition-colors"
              style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff" }}
            >
              Close
            </button>
          </div>
        )}

        {ready && (
          <p className="text-center text-sm mt-4" style={{ color: "rgba(255,255,255,0.5)" }}>
            Point your camera at the attendance QR code
          </p>
        )}

        {/* Exit button */}
        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all"
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#ffffff" }}
        >
          Exit Scanner
        </button>
      </div>
    </div>
  );
}
