/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  User, 
  Users, 
  FileText, 
  Stethoscope, 
  PenTool, 
  Sparkles, 
  Copy, 
  Check, 
  Upload, 
  Camera,
  MapPin
} from 'lucide-react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ReportData, VulnerabilityType } from './types';

const VULNERABILITY_OPTIONS: VulnerabilityType[] = [
  "EVASIÓN NÚCLEO FAMILIAR",
  "CIBER ACOSO",
  "VIOLENCIA INTRAFAMILIAR (VERBAL O PSICOLÓGICA)",
  "SITUACIÓN DE CALLE",
  "QUEMADURA CON PÓLVORA",
  "VÍCTIMA DE ARTEFACTO EXPLOSIVOS O IMPROVISADOS",
  "EMERGENCIAS POR DESASTRES NATURALES",
  "POR CAPTURA DE SU REPRESENTANTE LEGAL",
  "PROBLEMAS DE COMPORTAMIENTO",
  "ACCESO CARNAL O ACTO SEXUAL",
  "CONSUMO DE SUSTANCIAS PSICOACTIVAS",
  "DESPLAZADOS(A)",
  "INTENTO DE SUICIDIO",
  "VÍCTIMAS DE LESIONES PERSONALES",
  "QUEMADOS OTRAS SUSTANCIAS",
  "ABANDONO",
  "AMENAZA",
  "INTOXICACIÓN",
  "RIÑA",
  "ACTO SEXUAL ABUSIVO",
  "CONSUMO DE BEBIDAS EMBRIAGANTES",
  "CONDUCTAS PUNIBLES COMETIDAS POR MENOR DE 14 AÑOS",
  "Otro"
];

const RANKS = [
  "Teniente Coronel",
  "Mayor",
  "Capitán",
  "Teniente",
  "Subteniente",
  "Sargento Mayor",
  "Sargento Primero",
  "Sargento Viceprimero",
  "Sargento Segundo",
  "Cabo Primero",
  "Cabo Segundo",
  "Cabo Tercero",
  "Patrullero"
];

export default function App() {
  const [formData, setFormData] = useState<ReportData>({
    incident: {
      vulnerabilityType: "EVASIÓN NÚCLEO FAMILIAR",
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      location: ""
    },
    victim: [{
      fullName: "",
      docType: "TI",
      docNumber: "",
      birthDate: "",
      age: "",
      gender: "M",
      nationality: "Colombiano"
    }],
    informant: {
      isFamily: true,
      relationship: "la progenitora",
      fullName: "",
      docType: "CC",
      docNumber: "",
      address: "",
      phone: ""
    },
    narrative: {
      userFacts: ""
    },
    diagnosis: {
      applyMedical: true,
      medicalDiagnosis: "",
      notifiedEntities: "ICBF centro zonal..."
    },
    perpetrator: {
      applies: false,
      fullName: "",
      address: "",
      age: ""
    },
    signature: {
      chiefRank: "Teniente Coronel",
      chiefName: "Alvaro Hernando Valenzuela Oviedo",
      chiefRole: "Jefe Seccional de Protección y Servicios Especiales – MECAR."
    }
  });

  const [customVulnerability, setCustomVulnerability] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [finalReport, setFinalReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "buenos días";
    if (hour >= 12 && hour < 18) return "buenas tardes";
    return "buenas noches";
  };

  const getFormattedDate = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const formatDateInWords = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    const months = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    return `${day} de ${months[parseInt(month) - 1]} de ${year}`;
  };

  const addVictim = () => {
    setFormData(prev => ({
      ...prev,
      victim: [...prev.victim, {
        fullName: "",
        docType: "TI",
        docNumber: "",
        birthDate: "",
        age: "",
        gender: "M",
        nationality: "Colombiano"
      }]
    }));
  };

  const removeVictim = (index: number) => {
    if (formData.victim.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      victim: prev.victim.filter((_, i) => i !== index)
    }));
  };

  // Auto-calculate age
  useEffect(() => {
    const updatedVictims = formData.victim.map(v => {
      if (v.birthDate) {
        const birth = new Date(v.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        return { ...v, age: age.toString() };
      }
      return v;
    });

    // Only update if something actually changed to avoid infinite loops
    const hasChanged = JSON.stringify(updatedVictims) !== JSON.stringify(formData.victim);
    if (hasChanged) {
      setFormData(prev => ({
        ...prev,
        victim: updatedVictims
      }));
    }
  }, [formData.victim]);

  // Generate AI Draft for "Relato de los Hechos"
  const generateAiDraft = async () => {
    if (!formData.incident.location || !formData.informant.relationship) return;
    
    setIsDrafting(true);
    try {
      const dateInWords = formatDateInWords(formData.incident.date);
      const draft = `El día ${dateInWords}, siendo las ${formData.incident.time} horas, se atiende requerimiento policivo en ${formData.incident.location}, donde nos entrevistamos con ${formData.informant.relationship} en mención...`;
      setAiDraft(draft);
    } catch (error) {
      console.error("Error generating draft:", error);
    } finally {
      setIsDrafting(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.incident.location) generateAiDraft();
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData.incident.location, formData.informant.relationship]);

  const handleGenerateReport = async () => {
    if (!formData.narrative.userFacts.trim()) {
      setError("Por favor, redacte los hechos antes de generar el informe.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setNeedsKey(false);
    setFinalReport("");
    try {
      // Try to get the API key from various possible locations
      let apiKey = userApiKey || (process.env as any).GEMINI_API_KEY || (process.env as any).API_KEY || "";
      
      if (!apiKey) {
        // Check if we are in AI Studio environment and can prompt for a key
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          try {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (hasKey) {
              // The key is injected into process.env.API_KEY automatically by the platform
              apiKey = (process.env as any).API_KEY || "";
            } else {
              setNeedsKey(true);
              throw new Error("Se requiere una clave de API. Por favor, selecciónela o ingrésela manualmente.");
            }
          } catch (e) {
            // Fallback if aistudio calls fail
            setShowKeyInput(true);
            throw new Error("No se pudo detectar la clave automáticamente. Por favor, ingrésela manualmente.");
          }
        } else {
          setShowKeyInput(true);
          throw new Error("No se encontró la clave de API. Por favor, ingrésela manualmente en el recuadro de abajo.");
        }
      }

      const ai = new GoogleGenAI({ apiKey });
      const dateInWords = formatDateInWords(formData.incident.date);
      const vulnerability = formData.incident.vulnerabilityType === "Otro" ? customVulnerability : formData.incident.vulnerabilityType;
      
      const victimsList = formData.victim.map((v) => 
        `*VÍCTIMA:* ${v.fullName} (${v.gender}) ${v.docType}: ${v.docNumber}, FN: ${v.birthDate ? v.birthDate.split('-').reverse().join('/') : ''}, ${v.age} años, ${v.nationality}.`
      ).join('\n');

      let perpetratorInfo = "";
      if (formData.perpetrator.applies) {
        const p = formData.perpetrator;
        const details = [];
        if (p.fullName) details.push(`Nombre: ${p.fullName}`);
        if (p.address) details.push(`Dirección: ${p.address}`);
        if (p.age) details.push(`Edad: ${p.age} años`);
        
        if (details.length > 0) {
          perpetratorInfo = `\n\n*VICTIMARIO:*\n${details.join(', ')}.\n`;
        }
      }

      const prompt = `Genera un informe policial formal de restablecimiento de derechos en Colombia siguiendo ESTRICTAMENTE esta estructura y estilo:

REGIÓN 8
SEPRO – MECAR
FECHA: ${getFormattedDate()}

Mi General, ${getGreeting()}

INFORME DE NOVEDAD

*${vulnerability.toUpperCase()}*

${victimsList}${perpetratorInfo}

*${formData.informant.relationship.toUpperCase()}:* ${formData.informant.fullName}, ${formData.informant.docType} ${formData.informant.docNumber}, residente en ${formData.informant.address}, celular: ${formData.informant.phone}.

El día de hoy ${formData.incident.date.split('-').reverse().join('/')}, siendo las ${formData.incident.time} horas, se atiende requerimiento policivo en ${formData.incident.location}, dónde al llegar al lugar, nos entrevistamos con ${formData.informant.relationship} en mención, quien nos manifiesta que [AQUÍ DEBES ARGUMENTAR Y EXPANDIR EL SIGUIENTE RELATO USANDO LENGUAJE TÉCNICO POLICIAL: "${formData.narrative.userFacts}"]

*DIAGNÓSTICO MÉDICO:* ${formData.diagnosis.applyMedical ? formData.diagnosis.medicalDiagnosis : "No aplica"}

Se deja el caso en conocimiento del ${formData.diagnosis.notifiedEntities}.

${formData.signature.chiefRank}
*${formData.signature.chiefName}*
${formData.signature.chiefRole}

REGLAS ADICIONALES:
1. Usa lenguaje técnico-policial de Colombia.
2. Sé conciso pero profesional.
3. No agregues introducciones ni conclusiones adicionales fuera de la estructura.
4. Separa claramente los datos del acudiente/informante de la narrativa de los hechos.
5. En el relato de los hechos, refiérete al informante como "${formData.informant.relationship} en mención".`;

      const response = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });
      
      let fullText = "";
      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          setFinalReport(fullText);
        }
      }
    } catch (err: any) {
      console.error("Error generating report:", err);
      // If the error is about missing entity, it might be a key issue
      if (err.message?.includes("Requested entity was not found")) {
        setNeedsKey(true);
        setError("La clave de API parece no ser válida o ha expirado. Por favor, selecciónela de nuevo.");
      } else {
        setError(err.message || "Error al generar el informe. Por favor, intente de nuevo.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectKey = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      // After opening the dialog, we assume the user might have selected a key
      // and we can try generating again or at least clear the immediate error
      setError(null);
      setNeedsKey(false);
      handleGenerateReport();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(finalReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen pb-20 px-4 pt-8 max-w-2xl mx-auto">
      <header className="text-center mb-12">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block p-3 bg-brand-accent/20 rounded-2xl mb-4"
        >
          <Shield className="w-10 h-10 text-brand-accent" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-4xl font-bold bg-gradient-to-r from-brand-accent to-blue-400 bg-clip-text text-transparent mb-4"
        >
          Generador de Informes Policiales
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-brand-text/60 text-lg"
        >
          Asistente inteligente para la redacción técnica de informes de restablecimiento de derechos.
        </motion.p>
      </header>

      <div className="space-y-8">
        {/* Incident Info */}
        <Section title="Información del Incidente" icon={<FileText className="w-5 h-5" />}>
          <div className="space-y-4">
            <Field label="Motivo / Tipo de Vulnerabilidad">
              <select 
                className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text focus:ring-2 focus:ring-brand-accent outline-none appearance-none"
                value={formData.incident.vulnerabilityType}
                onChange={(e) => setFormData({...formData, incident: {...formData.incident, vulnerabilityType: e.target.value as VulnerabilityType}})}
              >
                {VULNERABILITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </Field>

            <AnimatePresence>
              {formData.incident.vulnerabilityType === "Otro" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <Field label="Especifique el Motivo">
                    <input 
                      type="text" 
                      placeholder="Escriba el motivo aquí..."
                      className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none focus:ring-2 focus:ring-brand-accent"
                      value={customVulnerability}
                      onChange={(e) => setCustomVulnerability(e.target.value)}
                    />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha del Incidente">
                <input 
                  type="date" 
                  className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                  value={formData.incident.date}
                  onChange={(e) => setFormData({...formData, incident: {...formData.incident, date: e.target.value}})}
                />
              </Field>
              <Field label="Hora del Incidente (formato 24h)">
                <input 
                  type="time" 
                  className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                  value={formData.incident.time}
                  onChange={(e) => setFormData({...formData, incident: {...formData.incident, time: e.target.value}})}
                />
              </Field>
            </div>

            <Field label="Lugar de los Hechos">
              <div className="relative">
                <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-brand-text/40" />
                <input 
                  type="text" 
                  placeholder="Hospital..."
                  className="w-full bg-brand-input border-none rounded-lg p-3 pl-10 text-brand-text outline-none"
                  value={formData.incident.location}
                  onChange={(e) => setFormData({...formData, incident: {...formData.incident, location: e.target.value}})}
                />
              </div>
            </Field>
          </div>
        </Section>

        {/* Victim Data */}
        <Section 
          title="Datos de la Víctima" 
          icon={<User className="w-5 h-5" />}
          action={
            <button 
              onClick={addVictim}
              className="bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3" />
              + Agregar Víctima
            </button>
          }
        >
          <div className="space-y-12">
            {formData.victim.map((v, index) => (
              <div key={index} className="space-y-6 pt-4 border-t border-white/5 first:border-t-0 first:pt-0 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-brand-accent/40 tracking-[0.2em] uppercase">VÍCTIMA {index + 1}</span>
                  {formData.victim.length > 1 && (
                    <button 
                      onClick={() => removeVictim(index)}
                      className="text-[10px] font-bold text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      Eliminar Víctima
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <button className="flex flex-col items-center justify-center p-6 bg-brand-input/50 border-2 border-dashed border-brand-accent/30 rounded-xl hover:bg-brand-input transition-colors group">
                    <Upload className="w-6 h-6 text-brand-accent mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs text-brand-accent font-medium">Subir documento de identidad</span>
                  </button>
                  <button className="flex flex-col items-center justify-center p-6 bg-brand-input/50 border-2 border-dashed border-brand-accent/30 rounded-xl hover:bg-brand-input transition-colors group opacity-60 cursor-not-allowed">
                    <Camera className="w-6 h-6 text-brand-accent mb-2" />
                    <span className="text-xs text-brand-accent font-medium">Tomar Foto (Próximamente)</span>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <Field label="Nombres y Apellidos Completos">
                    <input 
                      type="text" 
                      className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                      value={v.fullName}
                      onChange={(e) => {
                        const newVictims = [...formData.victim];
                        newVictims[index].fullName = e.target.value;
                        setFormData({...formData, victim: newVictims});
                      }}
                    />
                  </Field>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Tipo de Documento">
                      <input 
                        type="text" 
                        className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                        value={v.docType}
                        onChange={(e) => {
                          const newVictims = [...formData.victim];
                          newVictims[index].docType = e.target.value;
                          setFormData({...formData, victim: newVictims});
                        }}
                      />
                    </Field>
                    <Field label="Número de Documento (sin puntos)">
                      <input 
                        type="text" 
                        className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                        value={v.docNumber}
                        onChange={(e) => {
                          const newVictims = [...formData.victim];
                          newVictims[index].docNumber = e.target.value;
                          setFormData({...formData, victim: newVictims});
                        }}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Fecha de Nacimiento">
                      <input 
                        type="date" 
                        className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                        value={v.birthDate}
                        onChange={(e) => {
                          const newVictims = [...formData.victim];
                          newVictims[index].birthDate = e.target.value;
                          setFormData({...formData, victim: newVictims});
                        }}
                      />
                    </Field>
                    <Field label="Edad">
                      <input 
                        type="text" 
                        readOnly
                        placeholder="Se calcula autom"
                        className="w-full bg-brand-input/50 border-none rounded-lg p-3 text-brand-text outline-none cursor-not-allowed"
                        value={v.age}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Género">
                      <select 
                        className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none appearance-none"
                        value={v.gender}
                        onChange={(e) => {
                          const newVictims = [...formData.victim];
                          newVictims[index].gender = e.target.value;
                          setFormData({...formData, victim: newVictims});
                        }}
                      >
                        <option value="M">Masculino (M)</option>
                        <option value="F">Femenino (F)</option>
                        <option value="X">Otro (X)</option>
                      </select>
                    </Field>
                    <Field label="Nacionalidad">
                      <input 
                        type="text" 
                        className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                        value={v.nationality}
                        onChange={(e) => {
                          const newVictims = [...formData.victim];
                          newVictims[index].nationality = e.target.value;
                          setFormData({...formData, victim: newVictims});
                        }}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Informant Data */}
        <Section title="Datos del Acompañante/Informante" icon={<Users className="w-5 h-5" />}>
          <div className="flex items-center gap-3 mb-6">
            <input 
              type="checkbox" 
              id="isFamily"
              className="w-5 h-5 rounded border-none bg-brand-input text-brand-accent focus:ring-brand-accent"
              checked={formData.informant.isFamily}
              onChange={(e) => setFormData({...formData, informant: {...formData.informant, isFamily: e.target.checked}})}
            />
            <label htmlFor="isFamily" className="text-sm text-brand-text/80">El informante es familiar o acudiente</label>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <button className="flex flex-col items-center justify-center p-6 bg-brand-input/50 border-2 border-dashed border-brand-accent/30 rounded-xl hover:bg-brand-input transition-colors group">
              <Upload className="w-6 h-6 text-brand-accent mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs text-brand-accent font-medium">Subir documento de identidad</span>
            </button>
            <button className="flex flex-col items-center justify-center p-6 bg-brand-input/50 border-2 border-dashed border-brand-accent/30 rounded-xl hover:bg-brand-input transition-colors group opacity-60 cursor-not-allowed">
              <Camera className="w-6 h-6 text-brand-accent mb-2" />
              <span className="text-xs text-brand-accent font-medium">Tomar Foto (Próximamente)</span>
            </button>
          </div>

          <div className="space-y-4">
            <Field label="Parentesco o Relación">
              <input 
                type="text" 
                className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                value={formData.informant.relationship}
                onChange={(e) => setFormData({...formData, informant: {...formData.informant, relationship: e.target.value}})}
              />
            </Field>
            <Field label="Nombres y Apellidos del Acompañante">
              <input 
                type="text" 
                className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                value={formData.informant.fullName}
                onChange={(e) => setFormData({...formData, informant: {...formData.informant, fullName: e.target.value}})}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de Documento">
                <input 
                  type="text" 
                  className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                  value={formData.informant.docType}
                  onChange={(e) => setFormData({...formData, informant: {...formData.informant, docType: e.target.value}})}
                />
              </Field>
              <Field label="Número de Documento">
                <input 
                  type="text" 
                  className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                  value={formData.informant.docNumber}
                  onChange={(e) => setFormData({...formData, informant: {...formData.informant, docNumber: e.target.value}})}
                />
              </Field>
            </div>
            <Field label="Dirección de Residencia">
              <input 
                type="text" 
                className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                value={formData.informant.address}
                onChange={(e) => setFormData({...formData, informant: {...formData.informant, address: e.target.value}})}
              />
            </Field>
            <Field label="Teléfono de Contacto">
              <input 
                type="text" 
                className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                value={formData.informant.phone}
                onChange={(e) => setFormData({...formData, informant: {...formData.informant, phone: e.target.value}})}
              />
            </Field>
          </div>
        </Section>

        {/* Narrative */}
        <Section title="Relato de los Hechos" icon={<PenTool className="w-5 h-5" />}>
          <div className="bg-brand-bg/50 rounded-xl p-4 mb-6 border border-brand-accent/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-brand-accent" />
              <span className="text-xs font-medium text-brand-text/60 uppercase tracking-wider">Ayuda para la redacción:</span>
            </div>
            <p className="text-sm text-cyan-400 font-mono leading-relaxed">
              {isDrafting ? "Generando sugerencia..." : aiDraft || "Complete el lugar de los hechos para generar una sugerencia..."}
            </p>
          </div>

          <Field label="Redacte aquí los hechos manifestados por el informante">
            <textarea 
              rows={4}
              placeholder="Ej: '...nos manifiesta que el menor de edad salió de su residencia sin autorización...'"
              className="w-full bg-brand-input border-none rounded-lg p-4 text-brand-text outline-none resize-none focus:ring-2 focus:ring-brand-accent"
              value={formData.narrative.userFacts}
              onChange={(e) => setFormData({...formData, narrative: { userFacts: e.target.value }})}
            />
          </Field>
        </Section>

        {/* Diagnosis */}
        <Section title="Actuaciones y Diagnóstico" icon={<Stethoscope className="w-5 h-5" />}>
          <div className="flex items-center gap-3 mb-6">
            <input 
              type="checkbox" 
              id="applyMedical"
              className="w-5 h-5 rounded border-none bg-brand-input text-brand-accent focus:ring-brand-accent"
              checked={formData.diagnosis.applyMedical}
              onChange={(e) => setFormData({...formData, diagnosis: {...formData.diagnosis, applyMedical: e.target.checked}})}
            />
            <label htmlFor="applyMedical" className="text-sm text-brand-text/80">Aplica diagnóstico médico</label>
          </div>

          <AnimatePresence>
            {formData.diagnosis.applyMedical && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                <Field label="Diagnóstico Médico">
                  <input 
                    type="text" 
                    className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                    value={formData.diagnosis.medicalDiagnosis}
                    onChange={(e) => setFormData({...formData, diagnosis: {...formData.diagnosis, medicalDiagnosis: e.target.value}})}
                  />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4">
            <Field label="Entidades Notificadas">
              <input 
                type="text" 
                className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                value={formData.diagnosis.notifiedEntities}
                onChange={(e) => setFormData({...formData, diagnosis: {...formData.diagnosis, notifiedEntities: e.target.value}})}
              />
            </Field>
          </div>
        </Section>

        {/* Perpetrator Data */}
        <Section title="Victimario" icon={<User className="w-5 h-5 text-red-400" />}>
          <div className="flex items-center gap-3 mb-6">
            <input 
              type="checkbox" 
              id="perpetratorApplies"
              className="w-5 h-5 rounded border-none bg-brand-input text-brand-accent focus:ring-brand-accent"
              checked={formData.perpetrator.applies}
              onChange={(e) => setFormData({...formData, perpetrator: {...formData.perpetrator, applies: e.target.checked}})}
            />
            <label htmlFor="perpetratorApplies" className="text-sm text-brand-text/80">Aplica datos del victimario</label>
          </div>

          <AnimatePresence>
            {formData.perpetrator.applies && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                <Field label="Nombre Completo del Victimario">
                  <input 
                    type="text" 
                    className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                    value={formData.perpetrator.fullName}
                    onChange={(e) => setFormData({...formData, perpetrator: {...formData.perpetrator, fullName: e.target.value}})}
                  />
                </Field>
                <Field label="Dirección de Residencia">
                  <input 
                    type="text" 
                    className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                    value={formData.perpetrator.address}
                    onChange={(e) => setFormData({...formData, perpetrator: {...formData.perpetrator, address: e.target.value}})}
                  />
                </Field>
                <Field label="Edad">
                  <input 
                    type="text" 
                    className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                    value={formData.perpetrator.age}
                    onChange={(e) => setFormData({...formData, perpetrator: {...formData.perpetrator, age: e.target.value}})}
                  />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        {/* Signature */}
        <Section title="Firma del Informe" icon={<Shield className="w-5 h-5" />}>
          <div className="space-y-4">
            <Field label="Grado del Jefe">
              <select 
                className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none appearance-none"
                value={formData.signature.chiefRank}
                onChange={(e) => setFormData({...formData, signature: {...formData.signature, chiefRank: e.target.value}})}
              >
                {RANKS.map(rank => <option key={rank} value={rank}>{rank}</option>)}
              </select>
            </Field>
            <Field label="Nombre del Jefe">
              <input 
                type="text" 
                className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                value={formData.signature.chiefName}
                onChange={(e) => setFormData({...formData, signature: {...formData.signature, chiefName: e.target.value}})}
              />
            </Field>
            <Field label="Cargo del Jefe">
              <input 
                type="text" 
                className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                value={formData.signature.chiefRole}
                onChange={(e) => setFormData({...formData, signature: {...formData.signature, chiefRole: e.target.value}})}
              />
            </Field>
          </div>
        </Section>

        {/* Generate Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="w-full bg-brand-accent hover:bg-cyan-500 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <div className="w-6 h-6 border-2 border-brand-bg border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generar Informe
            </>
          )}
        </motion.button>

        {/* Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-brand-card rounded-2xl p-6 border border-brand-accent/20 shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse" />
              <h2 className="text-xl font-bold text-brand-accent">Vista Previa del Informe</h2>
            </div>
            <button 
              onClick={copyToClipboard}
              disabled={!finalReport}
              className="p-2 hover:bg-brand-input rounded-lg transition-colors relative group disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-brand-text/60" />}
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-brand-input text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {copied ? "Copiado" : "Copiar"}
              </span>
            </button>
          </div>
          <div className="bg-brand-bg/80 rounded-xl p-6 text-sm text-brand-text/90 leading-relaxed font-mono whitespace-pre-wrap border border-white/5 min-h-[400px] flex flex-col">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center text-brand-accent text-center space-y-4">
                <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
                <p className="animate-pulse">Generando informe técnico...</p>
                <p className="text-[10px] text-brand-text/40 uppercase tracking-widest">Esto puede tardar unos segundos</p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center text-red-400 text-center space-y-4">
                <Shield className="w-12 h-12 opacity-20" />
                <p className="font-bold">Error en la generación</p>
                <p className="text-xs opacity-80 max-w-xs">{error}</p>
                {needsKey || showKeyInput ? (
                  <div className="space-y-4 w-full max-w-xs">
                    <div className="space-y-2">
                      <input 
                        type="password"
                        placeholder="Pegue su clave de API aquí..."
                        className="w-full bg-brand-input border border-brand-accent/30 rounded-lg p-3 text-brand-text text-sm outline-none focus:ring-2 focus:ring-brand-accent"
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                      />
                      <p className="text-[10px] text-brand-text/40">
                        Puede obtener una clave gratuita en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-brand-accent underline">Google AI Studio</a>
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={handleGenerateReport}
                        className="text-[10px] uppercase tracking-widest bg-brand-accent text-brand-bg font-bold px-6 py-3 rounded-lg hover:bg-cyan-500 transition-colors"
                      >
                        Usar Clave e Intentar de Nuevo
                      </button>
                      {typeof window !== 'undefined' && (window as any).aistudio && (
                        <button 
                          onClick={handleSelectKey}
                          className="text-[10px] uppercase tracking-widest bg-white/10 text-brand-text px-6 py-2 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          O seleccionar clave del sistema
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={handleGenerateReport}
                    className="text-[10px] uppercase tracking-widest bg-red-400/10 px-4 py-2 rounded-lg hover:bg-red-400/20 transition-colors"
                  >
                    Reintentar
                  </button>
                )}
              </div>
            ) : finalReport ? (
              finalReport
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-brand-text/30 text-center space-y-4">
                <FileText className="w-12 h-12 opacity-10" />
                <p>El texto del informe generado aparecerá aquí.</p>
                <p className="text-[10px] uppercase tracking-widest">Complete los datos y presione "Generar Informe"</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Section({ title, icon, action, children }: { title: string, icon: React.ReactNode, action?: React.ReactNode, children: React.ReactNode }) {
  return (
    <motion.section 
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="bg-brand-card rounded-2xl p-6 border border-white/5 shadow-lg"
    >
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-accent/10 rounded-lg text-brand-accent">
            {icon}
          </div>
          <h2 className="text-lg font-bold text-brand-text tracking-tight">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-brand-text/40 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
