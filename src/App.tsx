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
import { GoogleGenAI } from "@google/genai";
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
  "DESPLAZADOS(A)"
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
    victim: {
      fullName: "",
      docType: "TI",
      docNumber: "",
      birthDate: "",
      age: ""
    },
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
    signature: {
      chiefRank: "Teniente Coronel",
      chiefName: "Alvaro Hernando Valenzuela Oviedo"
    }
  });

  const [aiDraft, setAiDraft] = useState("");
  const [finalReport, setFinalReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [copied, setCopied] = useState(false);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // Auto-calculate age
  useEffect(() => {
    if (formData.victim.birthDate) {
      const birth = new Date(formData.victim.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      setFormData(prev => ({
        ...prev,
        victim: { ...prev.victim, age: age.toString() }
      }));
    }
  }, [formData.victim.birthDate]);

  // Generate AI Draft for "Relato de los Hechos"
  const generateAiDraft = async () => {
    if (!formData.incident.location || !formData.informant.relationship) return;
    
    setIsDrafting(true);
    try {
      const prompt = `Como asistente policial experto, redacta una frase de inicio técnica para un informe de restablecimiento de derechos. 
      Datos: Fecha: ${formData.incident.date}, Hora: ${formData.incident.time}, Lugar: ${formData.incident.location}, Informante: ${formData.informant.relationship}.
      Estilo: Formal, técnico, policial. Solo una frase de inicio.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiDraft(response.text || "");
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
    setIsGenerating(true);
    try {
      const prompt = `Genera un informe policial formal de restablecimiento de derechos basado en los siguientes datos:
      
      MOTIVO: ${formData.incident.vulnerabilityType}
      FECHA/HORA: ${formData.incident.date} ${formData.incident.time}
      LUGAR: ${formData.incident.location}
      
      VÍCTIMA: ${formData.victim.fullName}, ${formData.victim.docType} ${formData.victim.docNumber}, Edad: ${formData.victim.age}
      INFORMANTE: ${formData.informant.fullName} (${formData.informant.relationship}), ${formData.informant.docType} ${formData.informant.docNumber}, Tel: ${formData.informant.phone}
      
      HECHOS MANIFESTADOS: ${formData.narrative.userFacts}
      
      DIAGNÓSTICO MÉDICO: ${formData.diagnosis.applyMedical ? formData.diagnosis.medicalDiagnosis : "No aplica"}
      ENTIDADES NOTIFICADAS: ${formData.diagnosis.notifiedEntities}
      
      FIRMA: ${formData.signature.chiefRank} ${formData.signature.chiefName}
      
      El informe debe ser redactado en tercera persona, con lenguaje técnico-policial, estructurado y profesional.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });
      setFinalReport(response.text || "");
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setIsGenerating(false);
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
        <Section title="Datos de la Víctima" icon={<User className="w-5 h-5" />}>
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
                value={formData.victim.fullName}
                onChange={(e) => setFormData({...formData, victim: {...formData.victim, fullName: e.target.value}})}
              />
            </Field>
            
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de Documento">
                <input 
                  type="text" 
                  className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                  value={formData.victim.docType}
                  onChange={(e) => setFormData({...formData, victim: {...formData.victim, docType: e.target.value}})}
                />
              </Field>
              <Field label="Número de Documento (sin puntos)">
                <input 
                  type="text" 
                  className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                  value={formData.victim.docNumber}
                  onChange={(e) => setFormData({...formData, victim: {...formData.victim, docNumber: e.target.value}})}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha de Nacimiento">
                <input 
                  type="date" 
                  className="w-full bg-brand-input border-none rounded-lg p-3 text-brand-text outline-none"
                  value={formData.victim.birthDate}
                  onChange={(e) => setFormData({...formData, victim: {...formData.victim, birthDate: e.target.value}})}
                />
              </Field>
              <Field label="Edad">
                <input 
                  type="text" 
                  readOnly
                  placeholder="Se calcula autom"
                  className="w-full bg-brand-input/50 border-none rounded-lg p-3 text-brand-text outline-none cursor-not-allowed"
                  value={formData.victim.age}
                />
              </Field>
            </div>
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
        <AnimatePresence>
          {finalReport && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-brand-card rounded-2xl p-6 border border-brand-accent/20 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-brand-accent">Vista Previa del Informe</h2>
                <button 
                  onClick={copyToClipboard}
                  className="p-2 hover:bg-brand-input rounded-lg transition-colors relative group"
                >
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-brand-text/60" />}
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-brand-input text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {copied ? "Copiado" : "Copiar"}
                  </span>
                </button>
              </div>
              <div className="bg-brand-bg/80 rounded-xl p-6 text-sm text-brand-text/90 leading-relaxed font-mono whitespace-pre-wrap border border-white/5 min-h-[300px]">
                {finalReport}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <motion.section 
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="bg-brand-card rounded-2xl p-6 border border-white/5 shadow-lg"
    >
      <div className="flex items-center gap-3 mb-6 pb-4 border-bottom border-white/5">
        <div className="p-2 bg-brand-accent/10 rounded-lg text-brand-accent">
          {icon}
        </div>
        <h2 className="text-lg font-bold text-brand-text tracking-tight">{title}</h2>
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
