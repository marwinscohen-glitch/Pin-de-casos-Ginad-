import { ReportData } from '../types';

export interface SavedDraft {
  id: string;
  timestamp: number;
  dateFormatted: string;
  title: string;
  victimName: string;
  vulnerability: string;
  formData: ReportData;
  customVulnerability?: string;
  generatedReport?: string;
  syncedWithAi?: boolean;
}

const CURRENT_FORM_KEY = 'policia_informes_current_form';
const SAVED_DRAFTS_KEY = 'policia_informes_saved_drafts';

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "buenos días";
  if (hour >= 12 && hour < 18) return "buenas tardes";
  return "buenas noches";
}

export function getFormattedDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

export function formatDateInWords(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split('-');
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  return `${day} de ${months[parseInt(month) - 1]} de ${year}`;
}

/**
 * Generates an official, strictly formatted Colombian Police technical report on-device.
 * Requires 0kb of internet, works instantaneously in the field.
 */
export function generateOfflineReport(formData: ReportData, customVulnerability = ""): string {
  const isNone = formData.incident.vulnerabilityType === "Ninguno";
  const vulnerability = formData.incident.vulnerabilityType === "Otro" 
    ? (customVulnerability || "OTRO") 
    : formData.incident.vulnerabilityType;

  const vulnLine = isNone ? "" : `\n*${vulnerability.toUpperCase()}*\n`;

  const victimsList = formData.victim.map((v) => {
    const fn = v.birthDate ? v.birthDate.split('-').reverse().join('/') : 'Sin registrar';
    const ageStr = v.age ? `${v.age} años` : 'edad por establecer';
    return `*VÍCTIMA:* ${v.fullName || 'Por identificar'} (${v.gender || 'M'}) ${v.docType}: ${v.docNumber || 'S/N'}, FN: ${fn}, ${ageStr}, ${v.nationality || 'Colombiano'}.`;
  }).join('\n');

  let perpetratorInfo = "";
  if (formData.perpetrator.applies) {
    const p = formData.perpetrator;
    const details = [];
    let nameWithRelationship = p.fullName || 'Por identificar';
    if (p.relationship) {
      nameWithRelationship += ` (${p.relationship})`;
    }
    
    if (p.fullName) details.push(`Nombre: ${nameWithRelationship}`);
    if (p.address) details.push(`Dirección: ${p.address}`);
    if (p.age) details.push(`Edad: ${p.age} años`);
    
    if (details.length > 0) {
      perpetratorInfo = `\n\n*VICTIMARIO:*\n${details.join(', ')}.`;
    }
  }

  const informantDoc = formData.informant.docNumber 
    ? `${formData.informant.docType} ${formData.informant.docNumber}` 
    : 'indocumentado(a)';
  const informantAddress = formData.informant.address || 'dirección pendiente';
  const informantPhone = formData.informant.phone || 'sin número de contacto';
  const informantRelation = (formData.informant.relationship || 'acudiente').toUpperCase();
  const informantFullName = formData.informant.fullName || 'persona en mención';

  const incidentDateFormatted = formData.incident.date 
    ? formData.incident.date.split('-').reverse().join('/') 
    : getFormattedDate();

  const medicalText = formData.diagnosis.applyMedical
    ? (formData.diagnosis.medicalDiagnosis || "Valoración médica pendiente")
    : "No aplica";

  const entityText = formData.diagnosis.notifiedEntities || "ICBF centro zonal de turno";

  // Police formal narrative construction
  const rawFacts = formData.narrative.userFacts.trim();
  const polishedNarrative = rawFacts
    ? `El día de hoy ${incidentDateFormatted}, siendo las ${formData.incident.time || '12:00'} horas, se atiende requerimiento policivo en ${formData.incident.location || 'el sector'}, dónde al llegar al lugar nos entrevistamos con ${formData.informant.relationship || 'la persona en mención'} en mención, quien nos manifiesta que ${rawFacts}`
    : `El día de hoy ${incidentDateFormatted}, siendo las ${formData.incident.time || '12:00'} horas, se atiende requerimiento policivo en ${formData.incident.location || 'el lugar de los hechos'}, entrevistando a ${formData.informant.relationship || 'el acompañante en mención'}.`;

  return `REGIÓN 8
SEPRO – MECAR
FECHA: ${getFormattedDate()}

Mi Coronel, ${getGreeting()}

INFORME DE NOVEDAD${vulnLine ? `${vulnLine}` : '\n'}
${victimsList}${perpetratorInfo}

*${informantRelation}:* ${informantFullName}, ${informantDoc}, residente en ${informantAddress}, celular: ${informantPhone}.

${polishedNarrative}

*DIAGNÓSTICO MÉDICO:* ${medicalText}

Se deja el caso en conocimiento del ${entityText}.

${formData.signature.chiefRank}
*${formData.signature.chiefName}*
${formData.signature.chiefRole}`;
}

export function saveCurrentFormDraft(formData: ReportData, customVulnerability = "") {
  try {
    const payload = JSON.stringify({
      formData,
      customVulnerability,
      updatedAt: Date.now()
    });
    localStorage.setItem(CURRENT_FORM_KEY, payload);
  } catch (err) {
    console.warn("Could not save current form draft to localStorage", err);
  }
}

export function loadCurrentFormDraft(): { formData: ReportData; customVulnerability: string } | null {
  try {
    const raw = localStorage.getItem(CURRENT_FORM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.formData) {
      return {
        formData: parsed.formData,
        customVulnerability: parsed.customVulnerability || ""
      };
    }
  } catch (err) {
    console.warn("Could not load form draft", err);
  }
  return null;
}

export function clearCurrentFormDraft() {
  try {
    localStorage.removeItem(CURRENT_FORM_KEY);
  } catch {}
}

export function getSavedDrafts(): SavedDraft[] {
  try {
    const raw = localStorage.getItem(SAVED_DRAFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveDraftToHistory(
  formData: ReportData, 
  customVulnerability = "",
  generatedReport = "",
  syncedWithAi = false
): SavedDraft {
  const drafts = getSavedDrafts();
  const victimName = formData.victim[0]?.fullName || "Sin nombre";
  const isNone = formData.incident.vulnerabilityType === "Ninguno";
  const vuln = isNone 
    ? "Caso" 
    : (formData.incident.vulnerabilityType === "Otro" 
        ? (customVulnerability || "Otro") 
        : formData.incident.vulnerabilityType);

  const now = new Date();
  const dateFormatted = `${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;

  const newDraft: SavedDraft = {
    id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    dateFormatted,
    title: isNone ? `Informe - ${victimName}` : `${vuln} - ${victimName}`,
    victimName,
    vulnerability: isNone ? "Ninguno" : vuln,
    formData: JSON.parse(JSON.stringify(formData)),
    customVulnerability,
    generatedReport,
    syncedWithAi
  };

  // Keep latest 50 drafts on device
  const updated = [newDraft, ...drafts.filter(d => d.id !== newDraft.id)].slice(0, 50);
  try {
    localStorage.setItem(SAVED_DRAFTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Storage full while saving draft", err);
  }

  return newDraft;
}

export function deleteSavedDraft(id: string): SavedDraft[] {
  const drafts = getSavedDrafts().filter(d => d.id !== id);
  try {
    localStorage.setItem(SAVED_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {}
  return drafts;
}
