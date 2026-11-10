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
  const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const [year, month, day] = parts;
      const mIdx = parseInt(month, 10) - 1;
      return `${String(day).padStart(2, '0')} de ${months[mIdx] || month} de ${year}`;
    } else {
      // DD-MM-YYYY or DD/MM/YYYY
      const [day, month, year] = parts;
      const mIdx = parseInt(month, 10) - 1;
      return `${String(day).padStart(2, '0')} de ${months[mIdx] || month} de ${year}`;
    }
  }
  return dateStr;
}

/**
 * Resolves the grammatically correct connector ('el' or 'la') for any relationship term,
 * ensuring proper feminine/masculine agreement in Colombian police narratives and helpers.
 * Examples:
 * - 'progenitora' -> 'la progenitora'
 * - 'progenitor' -> 'el progenitor'
 * - 'abuelo' -> 'el abuelo'
 * - 'abuela' -> 'la abuela'
 * - 'tía' / 'tia' -> 'la tía'
 * - 'tío' / 'tio' -> 'el tío'
 */
export function getRelationshipWithConnector(rel: string): string {
  if (!rel || !rel.trim()) return "la persona";

  const raw = rel.trim();
  const lower = raw.toLowerCase();

  // Strip existing leading articles if user typed them ("el", "la", "el/la", "los", "las")
  let base = raw;
  if (lower.startsWith("la ")) {
    base = raw.slice(3).trim();
  } else if (lower.startsWith("el ")) {
    base = raw.slice(3).trim();
  } else if (lower.startsWith("las ") || lower.startsWith("los ")) {
    base = raw.slice(4).trim();
  } else if (lower.startsWith("el/la ") || lower.startsWith("la/el ")) {
    base = raw.slice(6).trim();
  }

  const baseLower = base.toLowerCase();

  // Explicit feminine relationships
  const FEMININE_KEYWORDS = [
    'progenitora', 'madre', 'mama', 'mamá', 'mami', 'abuela', 'abuelita', 
    'tia', 'tía', 'hermana', 'hermanita', 'prima', 'madrastra', 'sobrina', 
    'cuñada', 'suegra', 'nuera', 'madrina', 'hija', 'hijastra', 'pareja', 
    'esposa', 'novia', 'vecina', 'amiga', 'tutora', 'profesora', 'docente', 
    'compañera', 'señora', 'mujer', 'tía paterna', 'tía materna', 'abuela materna', 'abuela paterna'
  ];

  // Explicit masculine relationships
  const MASCULINE_KEYWORDS = [
    'progenitor', 'padre', 'papa', 'papá', 'papi', 'abuelo', 'abuelito', 
    'tio', 'tío', 'hermano', 'hermanito', 'primo', 'padrastro', 'sobrino', 
    'cuñado', 'suegro', 'yerno', 'padrino', 'hijo', 'hijastro', 'esposo', 
    'novio', 'vecino', 'amigo', 'tutor', 'profesor', 'compañero', 'señor', 
    'hombre', 'tío paterno', 'tío materno', 'abuelo materno', 'abuelo paterno',
    'acudiente'
  ];

  let connector = 'el';

  if (FEMININE_KEYWORDS.some(k => baseLower === k || baseLower.startsWith(k + ' ') || baseLower.endsWith(' ' + k))) {
    connector = 'la';
  } else if (MASCULINE_KEYWORDS.some(k => baseLower === k || baseLower.startsWith(k + ' ') || baseLower.endsWith(' ' + k))) {
    connector = 'el';
  } else if (baseLower.endsWith('a') || baseLower.endsWith('as')) {
    // General Spanish feminine noun rule (ends in 'a')
    connector = 'la';
  } else {
    // Default masculine
    connector = 'el';
  }

  return `${connector} ${base}`;
}

/**
 * Returns clean uppercase title for headers without leading articles
 * e.g. "la progenitora" -> "PROGENITORA", "el abuelo" -> "ABUELO"
 */
export function getCleanRelationshipTitle(rel: string): string {
  if (!rel || !rel.trim()) return "ACUDIENTE";
  const raw = rel.trim();
  const lower = raw.toLowerCase();
  let base = raw;
  if (lower.startsWith("la ") || lower.startsWith("el ")) {
    base = raw.slice(3).trim();
  } else if (lower.startsWith("las ") || lower.startsWith("los ")) {
    base = raw.slice(4).trim();
  }
  return base.toUpperCase();
}

/**
 * Transforms informal field notes into formal, technical Colombian police narrative language.
 * Strictly begins with the mandatory heading:
 * "El día [Fecha en letras], siendo las [Hora] horas, se atiende requerimiento policivo en [Lugar], donde nos entrevistamos con [el/la Parentesco] en mención, quien nos manifiesta que [Hechos pulidos con lenguaje técnico policial]"
 */
export function expandPoliceNarrativeWithTechnicalLanguage(
  rawFacts: string,
  _vulnerabilityType: string,
  incidentDateStr: string,
  time: string,
  location: string,
  relationWithConnector: string,
  _victimData: { fullName?: string; age?: string; gender?: string }[] = []
): string {
  const dateInWords = formatDateInWords(incidentDateStr) || 'de hoy';
  const timeFormatted = time ? time.trim() : '12:00';
  const locationFormatted = (location && location.trim()) ? location.trim() : 'el lugar de los hechos';
  const relationText = (relationWithConnector && relationWithConnector.trim()) ? relationWithConnector.trim() : 'la persona informante';

  let cleanFacts = (rawFacts || '').trim();
  if (!cleanFacts) {
    return `El día ${dateInWords}, siendo las ${timeFormatted} horas, se atiende requerimiento policivo en ${locationFormatted}, donde nos entrevistamos con ${relationText} en mención.`;
  }

  // Remove redundant starting prefixes if typed by user
  cleanFacts = cleanFacts.replace(/^(quien\s+nos\s+manifiesta\s+que|nos\s+manifiesta\s+que|manifiesta\s+que|que\s+el|que\s+la)\s*/i, '');
  cleanFacts = cleanFacts.charAt(0).toLowerCase() + cleanFacts.slice(1);

  // Technical police phrase enhancements (IA de vocabulario policial aplicado a lo manifestado)
  let expanded = cleanFacts;

  const replacements: [RegExp, string][] = [
    [/\b(el niño|el pelao|el muchacho|el hijo|el menor)\b/gi, 'el menor de edad'],
    [/\b(la niña|la pelada|la muchacha|la hija|la menor)\b/gi, 'la menor de edad'],
    [/\b(los niños|los pelaos|los muchachos|los hijos|los menores)\b/gi, 'los menores de edad'],
    [/\b(se fue de la casa|se volo|se voló|se escapo|se escapó|se perdió|se perdio)\b/gi, 'abandonó el inmueble de residencia sin autorización previa ni causa justificada'],
    [/\b(no fue al colegio|no asistio a clases|no asistió a clases|no fue a la escuela)\b/gi, 'inobservó su jornada académica regular en la institución educativa'],
    [/\b(con unos amigos|con amigos|con unas amistades)\b/gi, 'en compañía de terceros no identificados por el acudiente'],
    [/\b(sin decir nada|sin avisar|sin permiso)\b/gi, 'sin dar previo aviso sobre su destino ni paradero'],
    [/\b(le pego|le pegó|le dio golpes|lo golpeo|lo golpeó|la golpeo|la golpeó|le pegaron|le dieron golpes)\b/gi, 'fue objeto de presuntas agresiones físicas contundentes que atentan contra su integridad corporal'],
    [/\b(le grito|le gritó|la insulto|la insultó|lo insulto|lo insultó|groserias|groserías|maltrato)\b/gi, 'fue víctima de agresiones verbales e intimidaciones reiteradas afectando su estabilidad socioemocional'],
    [/\b(lo amenazo|lo amenazó|la amenazo|la amenazó|le dijo que lo iba a matar|amenazas)\b/gi, 'ha recibido presuntas amenazas e intimidaciones que comprometen su seguridad personal y derecho a la vida'],
    [/\b(vicios|drogas|marihuana|bazuco|perico|tusi|sustancias)\b/gi, 'presunto consumo de sustancias psicoactivas que genera alteraciones conductuales y pone en inminente riesgo su integridad'],
    [/\b(tomando|alcohol|trago|borracho|embriagado)\b/gi, 'ingesta recurrente de bebidas embriagantes'],
    [/\b(lo toco|lo tocó|la toco|la tocó|abuso sexual|tocamientos|tocó sus partes)\b/gi, 'la presunta comisión de conductas punibles contra la libertad, integridad y formación sexuales'],
    [/\b(pelea|riña|se dieron golpes|se pelearon)\b/gi, 'altercado violento y confrontación física en espacio público'],
    [/\b(no le da comida|no le dan comida|lo dejaron solo|la dejaron sola|abandono|descuido)\b/gi, 'presunta negligencia en la provisión de alimentos y omisión de los deberes de cuidado y asistencia integral obligatoria'],
  ];

  for (const [pattern, repl] of replacements) {
    expanded = expanded.replace(pattern, repl);
  }

  expanded = expanded.trim();
  if (!expanded.endsWith('.')) {
    expanded += '.';
  }

  return `El día ${dateInWords}, siendo las ${timeFormatted} horas, se atiende requerimiento policivo en ${locationFormatted}, donde nos entrevistamos con ${relationText} en mención, quien nos manifiesta que ${expanded}`;
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
  const informantRelation = getCleanRelationshipTitle(formData.informant.relationship || 'acudiente');
  const informantFullName = formData.informant.fullName || 'persona en mención';
  const relationWithConnector = getRelationshipWithConnector(formData.informant.relationship || 'persona');

  const incidentDateFormatted = formData.incident.date 
    ? formData.incident.date.split('-').reverse().join('/') 
    : getFormattedDate();

  const medicalText = formData.diagnosis.applyMedical
    ? (formData.diagnosis.medicalDiagnosis || "Valoración médica pendiente")
    : "No aplica";

  const entityText = formData.diagnosis.notifiedEntities || "ICBF centro zonal de turno";

  // Police formal technical expanded narrative
  const rawFacts = formData.narrative.userFacts.trim();
  const polishedNarrative = expandPoliceNarrativeWithTechnicalLanguage(
    rawFacts,
    vulnerability,
    formData.incident.date || incidentDateFormatted,
    formData.incident.time,
    formData.incident.location,
    relationWithConnector,
    formData.victim
  );

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
