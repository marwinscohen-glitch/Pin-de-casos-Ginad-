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
 * Expands facts with proper legal context, administrative procedures, and procedural clarity.
 */
export function expandPoliceNarrativeWithTechnicalLanguage(
  rawFacts: string,
  vulnerabilityType: string,
  incidentDateFormatted: string,
  time: string,
  location: string,
  relationWithConnector: string,
  victimData: { fullName?: string; age?: string; gender?: string }[] = []
): string {
  let cleanFacts = (rawFacts || '').trim();
  if (!cleanFacts) {
    return `El día de hoy ${incidentDateFormatted}, siendo aproximadamente las ${time || '12:00'} horas, el personal policial adscrito a la Seccional de Protección y Servicios Especiales atiende motivo de policía en ${location || 'el sector asignado'}, dónde al llegar al lugar nos entrevistamos con ${relationWithConnector} en mención para la verificación correspondiente.`;
  }

  // Remove redundant starting prefixes if typed by user
  cleanFacts = cleanFacts.replace(/^(quien\s+nos\s+manifiesta\s+que|nos\s+manifiesta\s+que|manifiesta\s+que|que\s+el|que\s+la)\s*/i, '');
  cleanFacts = cleanFacts.charAt(0).toLowerCase() + cleanFacts.slice(1);

  // Technical police phrase enhancements
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

  // Contextualization based on vulnerability
  let vulnerabilityContext = '';
  const vulnUpper = (vulnerabilityType || '').toUpperCase();

  if (vulnUpper.includes('EVASIÓN NÚCLEO FAMILIAR')) {
    vulnerabilityContext = 'Dicha conducta configura una presunta situación de evasión del núcleo familiar, generando zozobra en su entorno protector y exponiendo al menor a múltiples factores de vulnerabilidad en la vía pública ante la ausencia de supervisión parental.';
  } else if (vulnUpper.includes('VIOLENCIA INTRAFAMILIAR')) {
    vulnerabilityContext = 'Hechos que se enmarcan en un presunto caso de violencia intrafamiliar y maltrato, generándose vulneración a los derechos fundamentales consagrados en favor de los niños, niñas y adolescentes y quebrantando la unidad y armonía del hogar.';
  } else if (vulnUpper.includes('SITUACIÓN DE CALLE')) {
    vulnerabilityContext = 'Configurándose una permanencia no autorizada en espacio público con exposición a condiciones de vulnerabilidad, desarraigo y factores generadores de riesgo social.';
  } else if (vulnUpper.includes('CONSUMO DE SUSTANCIAS')) {
    vulnerabilityContext = 'Situación que amerita prioritaria canalización y valoración ante las entidades de salud competentes para activar las rutas de deshabituación y acompañamiento psicosocial correspondientes.';
  } else if (vulnUpper.includes('ACCESO CARNAL') || vulnUpper.includes('ACTO SEXUAL')) {
    vulnerabilityContext = 'Presuntos hechos de alta gravedad que atentan de manera directa contra la libertad e integridad de la víctima, procediéndose de manera prioritaria a la activación de la ruta integral para la protección de víctimas de violencia sexual.';
  } else if (vulnUpper.includes('ABANDONO')) {
    vulnerabilityContext = 'Inobservancia grave a los deberes de custodia, sostenimiento y protección integral que los acudientes deben garantizar conforme a los principios de corresponsabilidad civil y legal.';
  } else if (vulnUpper.includes('AMENAZA')) {
    vulnerabilityContext = 'Generándose un riesgo latente para la seguridad del menor, lo cual exige medidas perentorias de protección preventiva y articulación interinstitucional.';
  } else if (vulnUpper.includes('RIÑA') || vulnUpper.includes('LESIONES')) {
    vulnerabilityContext = 'Configurándose afectación a la integridad física mediante actos de intolerancia social, requiriéndose la debida atención médica y activación de la ruta legal pertinente.';
  }

  const primaryVictim = victimData[0];
  const victimName = primaryVictim?.fullName || 'el menor de edad';
  const victimAge = primaryVictim?.age ? `(${primaryVictim.age} años)` : '';

  return `El día de hoy ${incidentDateFormatted}, siendo aproximadamente las ${time || '12:00'} horas, en atención a requerimiento del servicio de policía para la verificación de motivos que comprometen la protección de la infancia y la adolescencia, el personal uniformado de la Policía Nacional se traslada de manera oportuna a las instalaciones de ${location || 'el sector en mención'}.

Al arribar al lugar de los hechos, se toma contacto formal y nos entrevistamos con ${relationWithConnector} en mención, quien plenamente individualizada y en ejercicio de su deber de cuidado y corresponsabilidad manifiesta de manera libre y espontánea que ${expanded}. ${vulnerabilityContext}

Frente a la situación fáctica evidenciada, el personal policial uniformado procede a brindar el correspondiente acompañamiento preventivo a ${victimName} ${victimAge}, garantizando la prevalencia y protección integral de sus derechos fundamentales en estricta observancia del principio del interés superior de los niños, niñas y adolescentes (Ley 1098 de 2006 – Código de la Infancia y la Adolescencia). Asimismo, se imparten pautas de orientación legal y corresponsabilidad familiar a los acudientes, procediendo de forma simultánea a realizar la respectiva articulación institucional para el inicio formal de las actuaciones conducentes al restablecimiento de sus derechos.`;
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
    incidentDateFormatted,
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
