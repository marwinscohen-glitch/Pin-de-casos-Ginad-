export type VulnerabilityType = 
  | "EVASIÓN NÚCLEO FAMILIAR"
  | "CIBER ACOSO"
  | "VIOLENCIA INTRAFAMILIAR (VERBAL O PSICOLÓGICA)"
  | "SITUACIÓN DE CALLE"
  | "QUEMADURA CON PÓLVORA"
  | "VÍCTIMA DE ARTEFACTO EXPLOSIVOS O IMPROVISADOS"
  | "EMERGENCIAS POR DESASTRES NATURALES"
  | "POR CAPTURA DE SU REPRESENTANTE LEGAL"
  | "PROBLEMAS DE COMPORTAMIENTO"
  | "ACCESO CARNAL O ACTO SEXUAL"
  | "CONSUMO DE SUSTANCIAS PSICOACTIVAS"
  | "DESPLAZADOS(A)";

export interface ReportData {
  incident: {
    vulnerabilityType: VulnerabilityType;
    date: string;
    time: string;
    location: string;
  };
  victim: {
    fullName: string;
    docType: string;
    docNumber: string;
    birthDate: string;
    age: string;
  };
  informant: {
    isFamily: boolean;
    relationship: string;
    fullName: string;
    docType: string;
    docNumber: string;
    address: string;
    phone: string;
  };
  narrative: {
    userFacts: string;
  };
  diagnosis: {
    applyMedical: boolean;
    medicalDiagnosis: string;
    notifiedEntities: string;
  };
  signature: {
    chiefRank: string;
    chiefName: string;
  };
}
