import React, { useState } from 'react';
import { Download, Check, Share, PlusSquare, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // Check if device is iOS (Safari doesn't support beforeinstallprompt, requires Share -> Add to Home Screen)
  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await installApp();
      if (ok) {
        setInstalledSuccess(true);
        setTimeout(() => setInstalledSuccess(false), 3000);
      }
    } else if (isIos && !isInstalled) {
      setShowIosGuide(true);
    }
  };

  if (isInstalled) {
    return null;
  }

  // If not installable and not iOS, don't show to keep header clean
  if (!isInstallable && !isIos) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 transition-all shadow-sm active:scale-95"
        title="Instalar en la pantalla de inicio para usar sin conexión"
      >
        {installedSuccess ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300">¡Instalada!</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>Instalar App</span>
          </>
        )}
      </button>

      {/* iOS Safari Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-white font-bold">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <span>Instalar en iPhone / iPad</span>
            </div>
            <p className="text-xs text-slate-300">
              Para usar esta app sin conexión desde tu pantalla de inicio:
            </p>
            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <li className="flex items-center gap-2">
                <span>1. Toca el botón <strong>Compartir</strong></span>
                <Share className="w-4 h-4 text-cyan-400 inline" />
              </li>
              <li className="flex items-center gap-2">
                <span>2. Selecciona <strong>Agregar a inicio</strong></span>
                <PlusSquare className="w-4 h-4 text-cyan-400 inline" />
              </li>
              <li>3. Toca <strong>Agregar</strong> en la esquina superior</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
