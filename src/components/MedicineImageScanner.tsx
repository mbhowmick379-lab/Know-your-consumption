import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanLine,
  SwitchCamera,
  X,
} from 'lucide-react';
import type { ExtractedMedicineImageResult } from '../types/clinical';

interface MedicineImageScannerProps {
  mode: 'single' | 'multi' | 'interactions';
  onExtracted: (result: ExtractedMedicineImageResult) => void;
  onSwitchToMultiWithExtracted?: (result: ExtractedMedicineImageResult) => void;
}

/**
 * Resizes and compresses any captured/uploaded photo to a crisp JPEG data URL (max 1400px)
 * so fine composition print remains legible while keeping upload payloads fast (~180-450 KB).
 */
async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('Selected file could not be read as an image.'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        // Fallback to raw data URL if browser image decode skips special formats
        resolve(rawDataUrl);
      };
      img.onload = () => {
        const maxDim = 1400;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const MedicineImageScanner: React.FC<MedicineImageScannerProps> = ({
  mode,
  onExtracted,
  onSwitchToMultiWithExtracted,
}) => {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraFallbackRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastExtracted, setLastExtracted] = useState<ExtractedMedicineImageResult | null>(null);

  // Live Camera Modal state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCameraStream = useCallback(
    async (preferredFacing: 'environment' | 'user') => {
      stopCameraStream();
      setCameraError(null);
      setCameraLoading(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraLoading(false);
        setCameraError(
          'Live webcam access is unavailable in this browser. Use the "Capture / Choose Photo" button below to take or upload a photo directly.'
        );
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: preferredFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback to any available camera without strict facingMode constraint
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (/Permission|NotAllowed|denied/i.test(msg)) {
          setCameraError(
            'Camera permission was denied. Allow camera access in your browser, or use "Upload / Native Camera" below.'
          );
        } else {
          setCameraError(
            'No live camera device was detected. You can still upload a medicine strip photo or open your device camera below.'
          );
        }
      } finally {
        setCameraLoading(false);
      }
    },
    [stopCameraStream]
  );

  useEffect(() => {
    if (cameraOpen) {
      startCameraStream(facingMode);
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [cameraOpen, facingMode, startCameraStream, stopCameraStream]);

  const analyzeImageDataUrl = async (dataUrl: string) => {
    setPreviewUrl(dataUrl);
    setScanError(null);
    setLastExtracted(null);
    setScanning(true);

    try {
      const response = await fetch('/api/clinical/extract-composition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: dataUrl,
          mode: mode === 'multi' ? 'multi' : 'single',
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload.error || 'Could not read medicine ingredients from this photo. Try a sharper angle.'
        );
      }

      const extracted = payload as ExtractedMedicineImageResult;
      setLastExtracted(extracted);
      onExtracted(extracted);
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Unable to scan medicine label right now. Please try again.'
      );
    } finally {
      setScanning(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so the same image can be re-selected if needed
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setScanError('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    setCameraOpen(false);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      await analyzeImageDataUrl(compressed);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not process the selected photo.');
    }
  };

  const handleCaptureFrame = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera stream is not ready yet. Wait a second or upload a photo instead.');
      return;
    }

    const maxDim = 1400;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCameraOpen(false);
    await analyzeImageDataUrl(dataUrl);
  };

  const clearScanState = () => {
    setPreviewUrl(null);
    setLastExtracted(null);
    setScanError(null);
  };

  const helperSubtitle =
    mode === 'multi'
      ? 'Scan a combination strip or multiple strips one by one to auto-fill all compositions'
      : mode === 'interactions'
        ? 'Snap or upload a medicine strip/bottle to add its active ingredients automatically'
        : 'Snap or upload a medicine strip, box, or syrup bottle to auto-fill ingredients & mg/mL';

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-3 ${
        mode === 'multi'
          ? 'bg-white border-teal-200'
          : 'bg-white border-teal-200'
      }`}
    >
      <div className="space-y-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <ScanLine
              className={`w-3.5 h-3.5 shrink-0 ${
                mode === 'multi' ? 'text-teal-700' : 'text-teal-700'
              }`}
              aria-hidden="true"
            />
            <span>Scan Medicine Strip or Bottle Photo</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{helperSubtitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={scanning}
            onClick={() => {
              setScanError(null);
              setCameraOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 rounded-lg shadow-xs transition-all disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Camera Capture</span>
          </button>

          <button
            type="button"
            disabled={scanning}
            onClick={() => uploadInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 rounded-lg shadow-xs transition-all disabled:opacity-50"
          >
            <ImagePlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Upload Image</span>
          </button>
        </div>
      </div>

      {/* Hidden file inputs: standard photo upload + native mobile camera fallback */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        aria-label="Upload medicine strip or bottle image"
        onChange={handleFileSelected}
        className="sr-only"
      />
      <input
        ref={mobileCameraFallbackRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Capture medicine photo with device camera"
        onChange={handleFileSelected}
        className="sr-only"
      />

      {/* Active scanning state */}
      {scanning && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 p-2.5 rounded-lg bg-teal-50 border border-teal-200"
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Scanned medicine preview"
              className="w-12 h-12 rounded-lg object-cover border border-slate-300 shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
              Reading brand name, active compositions &amp; strengths…
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Analyzing printed ingredients and syrup concentration from your photo.
            </p>
          </div>
        </div>
      )}

      {/* Scan Error */}
      {scanError && !scanning && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800"
        >
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-rose-900">Could not extract composition</p>
            <p className="text-[11px] text-rose-800 mt-0.5">{scanError}</p>
          </div>
          <button
            type="button"
            onClick={clearScanState}
            aria-label="Dismiss scan error"
            className="p-1 text-rose-700 hover:text-slate-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Extracted Composition Confirmation Banner */}
      {lastExtracted && !scanning && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2">
          <div className="flex items-start gap-2.5">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Scanned medicine label thumbnail"
                className="w-12 h-12 rounded-lg object-cover border border-emerald-200 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {lastExtracted.compositions.length > 0
                    ? `Detected ${lastExtracted.compositions.length} Composition${
                        lastExtracted.compositions.length > 1 ? 's' : ''
                      }`
                    : 'Medicine Label Recognized'}
                </span>
                <button
                  type="button"
                  onClick={clearScanState}
                  aria-label="Clear scanned medicine preview"
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              </div>

              {lastExtracted.brandName && (
                <p className="text-xs font-semibold text-slate-900 mt-0.5">
                  Brand: <span className="text-teal-700">{lastExtracted.brandName}</span>
                  {lastExtracted.dosageForm ? (
                    <span className="text-slate-500 font-normal"> · {lastExtracted.dosageForm}</span>
                  ) : null}
                </p>
              )}

              {lastExtracted.compositions.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {lastExtracted.compositions.map((comp, i) => (
                    <li
                      key={`${comp.name}-${i}`}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-900"
                    >
                      {comp.name}
                      {comp.strength ? (
                        <span className="text-amber-700 font-mono ml-1">{comp.strength}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {lastExtracted.liquidStrengthMg && lastExtracted.liquidPerMl && (
                <p className="text-[11px] text-teal-700 font-medium mt-1">
                  Auto-filled liquid bottle strength: {lastExtracted.liquidStrengthMg} mg /{' '}
                  {lastExtracted.liquidPerMl} mL
                </p>
              )}

              {lastExtracted.extractedSummary && (
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  {lastExtracted.extractedSummary}
                </p>
              )}
            </div>
          </div>

          {mode === 'single' &&
            lastExtracted.compositions.length >= 2 &&
            onSwitchToMultiWithExtracted && (
              <div className="pt-1.5 border-t border-emerald-200 flex items-center justify-between gap-2">
                <span className="text-[11px] text-teal-800">
                  Multiple active ingredients detected on this label.
                </span>
                <button
                  type="button"
                  onClick={() => onSwitchToMultiWithExtracted(lastExtracted)}
                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-500 hover:to-teal-500 rounded-md shrink-0"
                >
                  Open in Multi-Composition ({lastExtracted.compositions.length})
                </button>
              </div>
            )}

          <p className="text-[10px] text-amber-800">
            Always verify the extracted ingredient names and mg strengths against your physical strip
            or bottle before calculating dosage.
          </p>
        </div>
      )}

      {/* Live Camera Capture Modal */}
      {cameraOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Camera capture for medicine strip or bottle"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-300 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900">
                  Capture Medicine Strip or Label
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                aria-label="Close camera modal"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                {!cameraError ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                    {/* Framing guide overlay */}
                    <div className="pointer-events-none absolute inset-4 border-2 border-dashed border-teal-200 rounded-xl flex items-end justify-center pb-2">
                      <span className="px-2.5 py-1 rounded-md bg-white text-[11px] font-semibold text-teal-800">
                        Align the composition / active ingredients text inside frame
                      </span>
                    </div>
                    {cameraLoading && (
                      <div className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-2 text-xs text-slate-700">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-700" />
                        Starting camera…
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-5 text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-amber-700 mx-auto" aria-hidden="true" />
                    <p className="text-xs text-slate-700 leading-relaxed max-w-sm mx-auto">
                      {cameraError}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => mobileCameraFallbackRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 rounded-lg"
                      >
                        <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                        Use Device Camera / Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => uploadInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg"
                      >
                        <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                        Browse Image File
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!cameraError && (
                    <button
                      type="button"
                      onClick={() =>
                        setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg"
                    >
                      <SwitchCamera className="w-3.5 h-3.5" aria-hidden="true" />
                      Flip Camera
                    </button>
                  )}
                  {cameraError && (
                    <button
                      type="button"
                      onClick={() => startCameraStream(facingMode)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      Retry Camera
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCameraOpen(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  {!cameraError && (
                    <button
                      type="button"
                      disabled={cameraLoading}
                      onClick={handleCaptureFrame}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-500 via-teal-500 to-blue-600 hover:from-teal-400 hover:via-teal-400 hover:to-blue-500 rounded-lg shadow-sm disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                      Capture &amp; Extract
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
