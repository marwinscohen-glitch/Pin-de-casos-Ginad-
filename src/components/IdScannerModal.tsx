import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  X, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Scan, 
  Sparkles, 
  SwitchCamera, 
  User, 
  FileText,
  Trash2,
  ArrowRight
} from 'lucide-react';

export interface ExtractedIdData {
  docType: string;
  docNumber: string;
  firstSurname: string;
  secondSurname: string;
  names: string;
  fullName: string;
  birthDate: string; // YYYY-MM-DD
  gender: string; // M, F, X
  nationality: string;
  birthPlace?: string;
  expeditionDate?: string;
  age?: string;
}

interface ImageSlot {
  preview: string;
  base64: string;
  mimeType: string;
}

interface IdScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
  initialTarget: {
    role: 'victim' | 'informant' | 'perpetrator';
    victimIndex?: number;
  };
  initialAction?: 'camera' | 'upload';
  initialFile?: File | null;
  victimsCount: number;
  onApplyData: (
    target: { role: 'victim' | 'informant' | 'perpetrator'; victimIndex?: number },
    data: ExtractedIdData
  ) => void;
}

// Play synthetic shutter sound for immediate feedback
function playShutterSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    // Ignore audio context errors
  }
}

// Helper to optimize and convert image to lightweight base64 at maximum speed (<25ms)
async function optimizeImage(fileOrBlob: Blob): Promise<{ base64: string; mimeType: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Error al procesar la imagen"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // 900px is ultra-fast to process, generates ~70KB payloads, perfect for Gemini OCR
        const MAX_DIM = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo inicializar canvas"));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
        ctx.drawImage(img, 0, 0, width, height);

        // Quality 0.74 gives ~70KB payload with crisp text lines
        const dataUrl = canvas.toDataURL("image/jpeg", 0.74);
        const base64 = dataUrl.split(",")[1];
        resolve({
          preview: dataUrl,
          base64,
          mimeType: "image/jpeg"
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

// Calculate age from YYYY-MM-DD
function calculateAgeFromBirthDate(birthDateStr: string): string {
  try {
    if (!birthDateStr || !birthDateStr.includes('-')) return '';
    const [year, month, day] = birthDateStr.split('-').map(Number);
    if (!year || !month || !day) return '';
    const birth = new Date(year, month - 1, day);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 && age < 125 ? String(age) : '';
  } catch {
    return '';
  }
}

export const IdScannerModal: React.FC<IdScannerModalProps> = ({
  isOpen,
  onClose,
  apiKey: propApiKey,
  initialTarget,
  initialAction,
  initialFile,
  victimsCount,
  onApplyData,
}) => {
  const [target, setTarget] = useState(initialTarget);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [frontImage, setFrontImage] = useState<ImageSlot | null>(null);
  const [backImage, setBackImage] = useState<ImageSlot | null>(null);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  // Extraction states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<ExtractedIdData | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frontCameraInputRef = useRef<HTMLInputElement | null>(null);
  const frontUploadInputRef = useRef<HTMLInputElement | null>(null);
  const backCameraInputRef = useRef<HTMLInputElement | null>(null);
  const backUploadInputRef = useRef<HTMLInputElement | null>(null);
  const countdownTimerRef = useRef<any>(null);

  // Sync initial target
  useEffect(() => {
    setTarget(initialTarget);
  }, [initialTarget]);
  useEffect(() => {
    if (isOpen && initialFile) {
      processIncomingFile(initialFile, 'front');
    }
  }, [isOpen, initialFile]);

  // Handle initialAction if no initialFile provided
  useEffect(() => {
    if (isOpen && !initialFile && !frontImage && initialAction) {
      const timer = setTimeout(() => {
        if (initialAction === 'camera') {
          frontCameraInputRef.current?.click();
        } else if (initialAction === 'upload') {
          frontUploadInputRef.current?.click();
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialAction]);

  // Clean camera and states when closing
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setExtractedResult(null);
      setAnalysisError(null);
      setAutoApplied(false);
      clearCountdown();
    }
  }, [isOpen]);

  const clearCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  };

  // Start auto-close countdown (3 seconds)
  const startAutoCloseCountdown = () => {
    clearCountdown();
    let current = 3;
    setCountdown(current);
    countdownTimerRef.current = setInterval(() => {
      current -= 1;
      if (current <= 0) {
        clearCountdown();
        stopCamera();
        onClose();
      } else {
        setCountdown(current);
      }
    }, 1000);
  };

  // Process incoming file and trigger AUTO-EXTRACTION immediately
  const processIncomingFile = async (file: File | Blob, side: 'front' | 'back') => {
    try {
      playShutterSound();
      setAnalysisError(null);
      clearCountdown();
      const optimized = await optimizeImage(file);
      
      let nextFront = frontImage;
      let nextBack = backImage;

      if (side === 'front') {
        setFrontImage(optimized);
        nextFront = optimized;
      } else {
        setBackImage(optimized);
        nextBack = optimized;
      }

      // AUTO-ANALYZE IMMEDIATELY: ZERO DELAY, NO EXTRA CLICKS
      await executeAiExtraction(nextFront, nextBack);
    } catch (err: any) {
      setAnalysisError(err.message || "Error al procesar la foto.");
    }
  };

  // Live webcam controller
  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Su navegador no permite acceso directo a la cámara.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;
      setIsCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.warn("Video play error:", e));
        }
      }, 50);

    } catch (err: any) {
      console.warn("Camera start error:", err);
      setCameraError(
        err.name === 'NotAllowedError' 
          ? "Permiso denegado. Use 'Tomar foto' o 'Subir foto'." 
          : "No se pudo iniciar la cámara en pantalla. Use los botones 'Tomar foto' o 'Subir foto'."
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  // Snapshot from live webcam
  const captureSnapshot = async () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      setIsFlashing(true);
      playShutterSound();
      setTimeout(() => setIsFlashing(false), 200);

      const canvas = document.createElement("canvas");
      let vWidth = video.videoWidth || 1280;
      let vHeight = video.videoHeight || 720;
      const MAX_DIM = 900;
      if (vWidth > MAX_DIM) {
        vHeight = Math.round((vHeight * MAX_DIM) / vWidth);
        vWidth = MAX_DIM;
      }
      canvas.width = vWidth;
      canvas.height = vHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(video, 0, 0, vWidth, vHeight);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.74);
      const base64 = dataUrl.split(",")[1];

      const slotData: ImageSlot = {
        preview: dataUrl,
        base64,
        mimeType: "image/jpeg"
      };

      stopCamera();

      let nextFront = frontImage;
      let nextBack = backImage;

      if (activeSide === 'front') {
        setFrontImage(slotData);
        nextFront = slotData;
      } else {
        setBackImage(slotData);
        nextBack = slotData;
      }

      // Auto analyze immediately
      await executeAiExtraction(nextFront, nextBack);
    } catch (err) {
      console.error("Error capturing snapshot:", err);
      setCameraError("Error al capturar la imagen. Intente de nuevo.");
    }
  };

  // Native input triggers
  const triggerTakePhoto = (side: 'front' | 'back' = activeSide) => {
    stopCamera();
    clearCountdown();
    setActiveSide(side);
    if (side === 'front') {
      frontCameraInputRef.current?.click();
    } else {
      backCameraInputRef.current?.click();
    }
  };

  const triggerUploadPhoto = (side: 'front' | 'back' = activeSide) => {
    stopCamera();
    clearCountdown();
    setActiveSide(side);
    if (side === 'front') {
      frontUploadInputRef.current?.click();
    } else {
      backUploadInputRef.current?.click();
    }
  };

  // File change handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processIncomingFile(file, side);
    e.target.value = '';
  };

  // ULTRA-FAST AI EXTRACTION USING SERVER-SIDE GEMINI API
  const executeAiExtraction = async (front: ImageSlot | null, back: ImageSlot | null) => {
    if (!front && !back) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/extract-id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          front: front ? { base64: front.base64, mimeType: front.mimeType } : undefined,
          back: back ? { base64: back.base64, mimeType: back.mimeType } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let rawErr = errorData.error || `Error del servidor (${response.status})`;
        try {
          const jsonMatch = rawErr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const p = JSON.parse(jsonMatch[0]);
            if (p.error?.message) rawErr = p.error.message;
          }
        } catch {}
        throw new Error(rawErr);
      }

      const rawData = await response.json();

      // Normalization
      const docNumberClean = String(rawData.docNumber || rawData.numeroDocumento || rawData.cedula || "")
        .replace(/\D/g, '')
        .trim();

      const names = String(rawData.names || rawData.nombres || "").trim().toUpperCase();
      const firstSurname = String(rawData.firstSurname || rawData.primerApellido || "").trim().toUpperCase();
      const secondSurname = String(rawData.secondSurname || rawData.segundoApellido || "").trim().toUpperCase();

      let fullName = String(rawData.fullName || rawData.nombreCompleto || "").trim().toUpperCase();
      if (!fullName && (names || firstSurname)) {
        fullName = [names, firstSurname, secondSurname].filter(Boolean).join(" ");
      }

      let birthDate = String(rawData.birthDate || rawData.fechaNacimiento || "").trim();
      if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(birthDate)) {
        const p = birthDate.split(/[-/]/);
        birthDate = `${p[2]}-${p[1]}-${p[0]}`;
      }

      let age = String(rawData.age || rawData.edad || "").trim();
      if (!age && birthDate) {
        age = calculateAgeFromBirthDate(birthDate);
      }

      let gender = String(rawData.gender || rawData.sexo || "M").trim().toUpperCase();
      if (gender.startsWith("M") || gender.includes("MASC")) gender = "M";
      else if (gender.startsWith("F") || gender.includes("FEM")) gender = "F";
      else gender = "M";

      let nationality = String(rawData.nationality || rawData.nacionalidad || "").trim();
      if (!nationality) {
        nationality = gender === "F" ? "Colombiana" : "Colombiano";
      }

      const normalized: ExtractedIdData = {
        docType: rawData.docType || "CC",
        docNumber: docNumberClean,
        firstSurname,
        secondSurname,
        names,
        fullName,
        birthDate,
        gender,
        nationality,
        birthPlace: rawData.birthPlace || "",
        expeditionDate: rawData.expeditionDate || "",
        age
      };

      if (!normalized.fullName && !normalized.docNumber && !normalized.birthDate) {
        throw new Error("No se detectaron datos legibles. Verifique que la foto esté enfocada y sin sombras ni reflejos sobre el número y nombres.");
      }

      setExtractedResult(normalized);

      // INSTANT AUTO-FILL: APPLY DATA TO FORM IMMEDIATELY WITHOUT DELAY!
      onApplyData(target, normalized);
      setAutoApplied(true);
      playShutterSound();

      // Start brief auto-close countdown so user doesn't even have to click anything
      startAutoCloseCountdown();
    } catch (err: any) {
      console.error("Error analyzing ID:", err);
      let errMsg = err.message || "Error al procesar la cédula con IA.";
      const lower = errMsg.toLowerCase();
      if (!navigator.onLine || lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load failed')) {
        errMsg = "Sin conexión a internet. El reconocimiento de cédula requiere red. Puedes ingresar los datos manualmente en el formulario o reintentar al recuperar señal.";
      } else if (lower.includes('high demand') || lower.includes('503') || lower.includes('unavailable') || lower.includes('alta demanda')) {
        errMsg = "Alta demanda en los servidores de IA. Por favor, vuelva a intentar la captura en unos segundos.";
      }
      setAnalysisError(errMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleManualClose = () => {
    clearCountdown();
    stopCamera();
    onClose();
  };

  return (
    <>
      {/* Hidden inputs are ALWAYS mounted in DOM for instant synchronous triggering */}
      <input
        ref={frontCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'front')}
      />
      <input
        ref={frontUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'front')}
      />
      <input
        ref={backCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'back')}
      />
      <input
        ref={backUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 'back')}
      />

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-brand-card border border-brand-accent/40 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh] relative"
          >
            {/* Flash Effect Overlay */}
            <AnimatePresence>
              {isFlashing && (
                <motion.div
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-white z-50 pointer-events-none"
                />
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-brand-bg/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-accent/20 rounded-xl text-brand-accent">
                  <Scan className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-brand-text flex items-center gap-2">
                    Autollenado Rápido de Cédula
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono uppercase font-black">
                      ⚡ Rápido
                    </span>
                  </h2>
                  <p className="text-xs text-brand-text/60">
                    Extracción instantánea y llenado automático con IA
                  </p>
                </div>
              </div>
              <button
                onClick={handleManualClose}
                className="p-2 text-brand-text/60 hover:text-brand-text hover:bg-white/5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Destination Indicator */}
            <div className="px-4 sm:px-5 py-2.5 bg-brand-input/30 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-brand-text/70">
                <span className="font-semibold text-brand-accent uppercase tracking-wider text-[11px]">Llenando casillas de:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: victimsCount }).map((_, idx) => (
                  <button
                    key={`vic-${idx}`}
                    onClick={() => {
                      setTarget({ role: 'victim', victimIndex: idx });
                      if (extractedResult) onApplyData({ role: 'victim', victimIndex: idx }, extractedResult);
                    }}
                    className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      target.role === 'victim' && target.victimIndex === idx
                        ? 'bg-brand-accent text-brand-bg font-bold shadow-md shadow-brand-accent/30'
                        : 'bg-brand-input text-brand-text/70 hover:text-brand-text'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    {victimsCount > 1 ? `Víctima ${idx + 1}` : 'Víctima'}
                  </button>
                ))}

                <button
                  onClick={() => {
                    setTarget({ role: 'informant' });
                    if (extractedResult) onApplyData({ role: 'informant' }, extractedResult);
                  }}
                  className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    target.role === 'informant'
                      ? 'bg-brand-accent text-brand-bg font-bold shadow-md shadow-brand-accent/30'
                      : 'bg-brand-input text-brand-text/70 hover:text-brand-text'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Informante
                </button>

                <button
                  onClick={() => {
                    setTarget({ role: 'perpetrator' });
                    if (extractedResult) onApplyData({ role: 'perpetrator' }, extractedResult);
                  }}
                  className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    target.role === 'perpetrator'
                      ? 'bg-red-500 text-white font-bold shadow-md shadow-red-500/30'
                      : 'bg-brand-input text-brand-text/70 hover:text-brand-text'
                  }`}
                >
                  Victimario
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* ANALYZING SPINNER OVERLAY */}
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-brand-accent/15 border border-brand-accent/50 rounded-2xl flex items-center gap-3 text-brand-accent shadow-lg"
                >
                  <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-extrabold text-sm text-brand-text flex items-center gap-2">
                      <span>⚡ Leyendo cédula y autollenando casillas...</span>
                    </p>
                    <p className="text-[11px] text-brand-text/60">
                      Gemini Flash está extrayendo nombres, documento y fechas a máxima velocidad.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* SUCCESS BANNER: INSTANT AUTO-APPLIED */}
              {autoApplied && extractedResult && !isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-emerald-500/20 border-2 border-emerald-500/60 rounded-2xl flex items-center justify-between gap-3 text-emerald-300 shadow-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-sm text-emerald-200">
                        ¡Casillas autollenadas con éxito!
                      </p>
                      <p className="text-xs text-emerald-300/80">
                        Datos transferidos a {target.role === 'victim' ? `Víctima ${(target.victimIndex ?? 0) + 1}` : target.role === 'informant' ? 'Informante' : 'Victimario'}.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleManualClose}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-brand-bg font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <span>Listo {countdown !== null ? `(${countdown}s)` : ''}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* Live Webcam view if toggled */}
              {isCameraActive ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[16/10] max-h-72 flex items-center justify-center border-2 border-brand-accent shadow-2xl">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                    <div className="w-[88%] h-[82%] border-2 border-dashed border-cyan-400 rounded-2xl relative shadow-[0_0_25px_rgba(0,188,212,0.4)]">
                      <div className="absolute top-2 left-2 text-[10px] text-cyan-200 font-mono bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm">
                        Alinee la cédula en este marco
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={captureSnapshot}
                      className="w-16 h-16 rounded-full bg-white text-brand-bg flex items-center justify-center shadow-2xl border-4 border-cyan-400 hover:bg-cyan-50 transition-transform cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-accent shadow-inner" />
                    </motion.button>
                  </div>
                </div>
              ) : (
                /* MAIN 2-BUTTON SECTION */
                <div className="bg-brand-bg/50 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
                  {/* Cards side toggles / indicators */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveSide('front')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        activeSide === 'front'
                          ? 'border-brand-accent bg-brand-accent/15'
                          : 'border-white/10 bg-brand-input/30 hover:bg-brand-input/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-brand-text">1. Frente</span>
                        {frontImage ? (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Listo
                          </span>
                        ) : (
                          <span className="text-[10px] text-brand-accent font-semibold">Principal</span>
                        )}
                      </div>
                      <p className="text-[10px] text-brand-text/50 mt-0.5 truncate">Nombres y Número</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSide('back')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        activeSide === 'back'
                          ? 'border-brand-accent bg-brand-accent/15'
                          : 'border-white/10 bg-brand-input/30 hover:bg-brand-input/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-brand-text">2. Reverso</span>
                        {backImage ? (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Listo
                          </span>
                        ) : (
                          <span className="text-[10px] text-brand-text/40 font-semibold">Opcional</span>
                        )}
                      </div>
                      <p className="text-[10px] text-brand-text/50 mt-0.5 truncate">Fecha nacimiento y edad</p>
                    </button>
                  </div>

                  {/* TWO PROMINENT ACTION BUTTONS */}
                  <div className="text-center pt-1 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                      <button
                        type="button"
                        onClick={() => triggerTakePhoto(activeSide)}
                        className="py-3.5 px-5 bg-brand-accent hover:bg-cyan-400 text-brand-bg font-extrabold rounded-xl text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-brand-accent/25 transition-all cursor-pointer hover:scale-[1.02]"
                      >
                        <Camera className="w-5 h-5" />
                        <span>Tomar foto {activeSide === 'back' ? '(Reverso)' : ''}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => triggerUploadPhoto(activeSide)}
                        className="py-3.5 px-5 bg-brand-input hover:bg-brand-input/80 text-brand-text font-bold rounded-xl text-sm flex items-center justify-center gap-2.5 border border-white/10 transition-colors cursor-pointer hover:scale-[1.02]"
                      >
                        <Upload className="w-5 h-5 text-brand-accent" />
                        <span>Subir foto {activeSide === 'back' ? '(Reverso)' : ''}</span>
                      </button>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="text-[11px] text-brand-text/40 hover:text-brand-accent transition-colors underline cursor-pointer"
                      >
                        Abrir visor de cámara en pantalla
                      </button>
                    </div>
                  </div>

                  {/* Image thumbnails if available */}
                  {(frontImage || backImage) && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {frontImage && (
                        <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-black/50 aspect-[16/10] flex items-center justify-center">
                          <img src={frontImage.preview} alt="Frente" className="w-full h-full object-contain" />
                          <div className="absolute top-1 right-1">
                            <button
                              type="button"
                              onClick={() => setFrontImage(null)}
                              className="p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-lg cursor-pointer"
                              title="Borrar foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="absolute bottom-1 left-1 bg-black/80 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold">
                            Frente
                          </span>
                        </div>
                      )}

                      {backImage && (
                        <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-black/50 aspect-[16/10] flex items-center justify-center">
                          <img src={backImage.preview} alt="Reverso" className="w-full h-full object-contain" />
                          <div className="absolute top-1 right-1">
                            <button
                              type="button"
                              onClick={() => setBackImage(null)}
                              className="p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-lg cursor-pointer"
                              title="Borrar foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="absolute bottom-1 left-1 bg-black/80 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold">
                            Reverso
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}



              {/* Error Banner */}
              {analysisError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-xs text-red-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <p className="font-bold text-red-200">Aviso sobre la foto:</p>
                    <p className="mt-0.5">{analysisError}</p>
                    <p className="mt-1 text-[11px] text-brand-text/50">
                      Tome la foto bien enfocada y centrada para que la IA lea el texto en menos de un segundo.
                    </p>
                  </div>
                </div>
              )}

              {/* Extracted Data Card Preview */}
              {extractedResult && (
                <div className="bg-brand-input/40 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Datos Extraídos
                    </span>
                    <span className="text-[11px] font-mono text-brand-accent">
                      {extractedResult.docType} {extractedResult.docNumber}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-brand-bg/60 rounded-xl border border-white/5">
                      <span className="text-brand-text/40 text-[10px] block font-bold">Nombres y Apellidos</span>
                      <span className="text-brand-text font-bold text-sm">{extractedResult.fullName || 'No detectado'}</span>
                    </div>

                    <div className="p-2.5 bg-brand-bg/60 rounded-xl border border-white/5">
                      <span className="text-brand-text/40 text-[10px] block font-bold">Documento</span>
                      <span className="text-brand-text font-bold text-sm">{extractedResult.docType} {extractedResult.docNumber || 'No detectado'}</span>
                    </div>

                    <div className="p-2.5 bg-brand-bg/60 rounded-xl border border-white/5">
                      <span className="text-brand-text/40 text-[10px] block font-bold">Fecha Nacimiento / Edad</span>
                      <span className="text-brand-text font-medium">
                        {extractedResult.birthDate || 'Pendiente reverso'} {extractedResult.age ? `(${extractedResult.age} años)` : ''}
                      </span>
                    </div>

                    <div className="p-2.5 bg-brand-bg/60 rounded-xl border border-white/5">
                      <span className="text-brand-text/40 text-[10px] block font-bold">Género y Nacionalidad</span>
                      <span className="text-brand-text font-medium">
                        {extractedResult.gender === 'M' ? 'Masculino' : extractedResult.gender === 'F' ? 'Femenino' : extractedResult.gender} - {extractedResult.nationality || 'Colombiano'}
                      </span>
                    </div>
                  </div>

                  {/* Suggest reverse side if not captured yet */}
                  {frontImage && !backImage && (
                    <div className="p-3 bg-brand-accent/10 border border-brand-accent/30 rounded-xl flex items-center justify-between gap-2">
                      <span className="text-[11px] text-brand-accent">
                        ¿Cédula tradicional amarilla? Capture el reverso para autollenar fecha y edad.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          clearCountdown();
                          triggerTakePhoto('back');
                        }}
                        className="px-3 py-1.5 bg-brand-accent hover:bg-cyan-400 text-brand-bg font-bold rounded-lg text-xs whitespace-nowrap cursor-pointer transition-colors"
                      >
                        Tomar Reverso
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-brand-bg/80 flex items-center justify-between gap-3">
              <span className="text-xs text-brand-text/60">
                {extractedResult ? "✓ Casillas listas en el formulario" : "Capture o suba la foto para autollenar"}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualClose}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-brand-bg font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Aceptar y Cerrar {countdown !== null ? `(${countdown}s)` : ''}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};
