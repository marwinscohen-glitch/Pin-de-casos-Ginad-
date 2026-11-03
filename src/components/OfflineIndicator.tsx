import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wifi, 
  WifiOff, 
  HardDrive, 
  FolderClock, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  Trash2, 
  FileText,
  Sparkles,
  Info
} from 'lucide-react';
import { SavedDraft, getSavedDrafts, deleteSavedDraft } from '../utils/offlineStorage';
import { ReportData } from '../types';

interface OfflineIndicatorProps {
  isOnline: boolean;
  onRestoreDraft: (draft: SavedDraft) => void;
}

export function OfflineIndicator({ isOnline, onRestoreDraft }: OfflineIndicatorProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'drafts'>('info');

  const handleOpenModal = (tab: 'info' | 'drafts' = 'info') => {
    setActiveTab(tab);
    setDrafts(getSavedDrafts());
    setModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteSavedDraft(id);
    setDrafts(updated);
  };

  const draftCount = drafts.length || (typeof window !== 'undefined' ? getSavedDrafts().length : 0);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Connection status badge */}
        <button
          onClick={() => handleOpenModal('info')}
          type="button"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all shadow-sm ${
            isOnline 
              ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60' 
              : 'bg-amber-950/80 border border-amber-500/60 text-amber-300 hover:bg-amber-900/70 animate-pulse'
          }`}
          title="Ver estado de conexión y modo sin internet"
        >
          {isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20"></span>
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">En Línea</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20"></span>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Sin Internet (Modo Local)</span>
            </>
          )}
        </button>

        {/* Saved Drafts Counter Button */}
        <button
          onClick={() => handleOpenModal('drafts')}
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Borradores guardados en el teléfono"
        >
          <FolderClock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden md:inline">Borradores</span>
          {draftCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-600 text-[10px] font-bold text-white">
              {draftCount}
            </span>
          )}
        </button>
      </div>

      {/* Modal Dialog */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isOnline ? 'bg-emerald-950/80 text-emerald-400' : 'bg-amber-950/80 text-amber-400'}`}>
                    {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {isOnline ? 'Conexión Activa' : 'Modo Sin Conexión a Internet'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isOnline ? 'Todos los servicios de IA y sincronización disponibles' : 'La app funciona directamente desde la memoria de tu teléfono'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-800 bg-slate-900/50 px-5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('info')}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'info'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  ¿Cómo funciona sin internet?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrafts(getSavedDrafts());
                    setActiveTab('drafts');
                  }}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'drafts'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FolderClock className="w-3.5 h-3.5" />
                  Borradores en el teléfono ({drafts.length})
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-300">
                {activeTab === 'info' ? (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-2">
                      <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                        <HardDrive className="w-4 h-4" />
                        <span>100% Funcional sin señal ni datos móviles</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Esta aplicación está configurada como una Aplicación Web Progresiva (PWA). Todos los archivos necesarios quedan descargados en tu teléfono, por lo que puedes abrirla y usarla en zonas rurales, sótanos o lugares sin cobertura celular.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">¿Qué funciona SIN internet?</h4>
                      <ul className="space-y-2 text-xs">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span><strong>Apertura instantánea:</strong> La aplicación abre y carga todos sus menús sin necesidad de red.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span><strong>Diligenciamiento de formularios:</strong> Ingreso de víctimas, cédulas, datos del acudiente, relato de los hechos y diagnóstico.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span><strong>Generación inmediata de informe:</strong> Puedes presionar "Generar Informe" y se genera el informe oficial estructurado de la Policía Nacional al instante.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span><strong>Guardado de borradores:</strong> Puedes almacenar todos tus casos en la memoria del teléfono para revisarlos o continuarlos luego.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span><strong>Copiar al portapapeles:</strong> Puedes copiar el texto generado para enviarlo por WhatsApp, mensajes o archivo de texto.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">¿Qué requiere internet?</h4>
                      <ul className="space-y-2 text-xs">
                        <li className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <span><strong>Expansión narrativa avanzada con IA:</strong> El pulido de lenguaje técnico adicional por Google Gemini se ejecuta al tener conexión. Sin internet, se redacta automáticamente el informe técnico estructurado directo en tu teléfono.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {drafts.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 space-y-2">
                        <FolderClock className="w-10 h-10 mx-auto text-slate-600" />
                        <p className="text-sm font-medium">No tienes borradores guardados</p>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          Cuando estés llenando un caso o generes un informe, pulsa "Guardar Borrador" para almacenarlo en este teléfono.
                        </p>
                      </div>
                    ) : (
                      drafts.map((d) => (
                        <div
                          key={d.id}
                          onClick={() => {
                            onRestoreDraft(d);
                            setModalOpen(false);
                          }}
                          className="p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 cursor-pointer transition-all flex items-center justify-between group"
                        >
                          <div className="space-y-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">
                                {d.title}
                              </span>
                              {d.generatedReport && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0">
                                  Informe listo
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">
                              {d.dateFormatted} • {d.formData.victim.length} víctima(s)
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={(e) => handleDelete(e, d.id)}
                              type="button"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                              title="Eliminar borrador"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
