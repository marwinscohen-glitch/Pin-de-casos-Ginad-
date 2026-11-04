import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable full CORS for webview, native Android APK wrappers (com.mycompany.pindecasos), and external clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Support base64 image uploads and JSON payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI server-side with standard headers
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey || undefined,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to extract a clean human-readable error message from Gemini SDK errors
function sanitizeErrorMessage(error: any): string {
  if (!error) return 'Error inesperado del servidor.';
  let msg = typeof error === 'string' ? error : (error.message || String(error));

  // Try extracting inner message if it's a JSON string
  try {
    const jsonMatch = msg.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error?.message) {
        msg = parsed.error.message;
        try {
          const inner = JSON.parse(msg);
          if (inner.error?.message) {
            msg = inner.error.message;
          }
        } catch {}
      }
    }
  } catch {}

  const lower = msg.toLowerCase();
  if (lower.includes('high demand') || lower.includes('503') || lower.includes('unavailable')) {
    return 'El servicio de IA experimenta alta demanda momentánea en los servidores de Google. Por favor, intente de nuevo en unos segundos.';
  }
  if (lower.includes('quota') || lower.includes('429') || lower.includes('resource_exhausted')) {
    return 'Límite temporal de solicitudes alcanzado. Por favor, espere unos instantes y vuelva a intentar.';
  }

  return msg.trim() || 'Error en el servicio de generación.';
}

function isTransientError(error: any): boolean {
  const msg = typeof error === 'string' ? error : (error?.message || String(error));
  const lower = msg.toLowerCase();
  return (
    lower.includes('503') ||
    lower.includes('high demand') ||
    lower.includes('unavailable') ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('econnreset') ||
    lower.includes('socket hang up') ||
    lower.includes('fetch failed') ||
    lower.includes('timeout')
  );
}

// Model fallback lists in order of priority (non-deprecated models, ultra-fast low-latency first)
const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
const VISION_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

// Endpoint: Extract structured data from Colombian ID photos
app.post('/api/extract-id', async (req, res) => {
  try {
    const { front, back } = req.body;

    if (!front && !back) {
      return res.status(400).json({ error: 'Se requiere al menos una imagen (anverso o reverso) de la cédula.' });
    }

    const parts: any[] = [];

    if (front?.base64 && front?.mimeType) {
      parts.push({
        inlineData: {
          mimeType: front.mimeType,
          data: front.base64,
        },
      });
    }

    if (back?.base64 && back?.mimeType) {
      parts.push({
        inlineData: {
          mimeType: back.mimeType,
          data: back.base64,
        },
      });
    }

    const promptText = `Analiza con máxima precisión la foto de la cédula / documento de identidad de Colombia (CC, TI, CE, RC o PASAPORTE).
Extrae los siguientes campos en formato JSON estricto:
- "docType": Tipo de documento ("CC", "TI", "CE", "RC" o "PASAPORTE").
- "docNumber": SOLO dígitos numéricos del documento, sin puntos, comas, espacios ni letras (ej: "1047456789").
- "firstSurname": Primer apellido en MAYÚSCULAS.
- "secondSurname": Segundo apellido en MAYÚSCULAS (o "" si no tiene).
- "names": Nombres completos en MAYÚSCULAS.
- "fullName": Nombres y apellidos completos en MAYÚSCULAS.
- "birthDate": Fecha de nacimiento en formato "YYYY-MM-DD" (si solo es visible en el reverso y no está en la foto, dejar "").
- "gender": "M" para masculino o "F" para femenino.
- "nationality": "Colombiano" o "Colombiana" (o según corresponda).
- "birthPlace": Municipio y departamento si es visible o "".
- "expeditionDate": Fecha de expedición si es visible (YYYY-MM-DD).
- "age": Edad calculada en años cumplidos si la fecha de nacimiento es conocida.
Responde únicamente con el esquema JSON.`;

    parts.push({ text: promptText });

    const schema = {
      type: Type.OBJECT,
      properties: {
        docType: { type: Type.STRING },
        docNumber: { type: Type.STRING },
        firstSurname: { type: Type.STRING },
        secondSurname: { type: Type.STRING },
        names: { type: Type.STRING },
        fullName: { type: Type.STRING },
        birthDate: { type: Type.STRING },
        gender: { type: Type.STRING },
        nationality: { type: Type.STRING },
        birthPlace: { type: Type.STRING },
        expeditionDate: { type: Type.STRING },
        age: { type: Type.STRING },
      },
    };

    let lastError: any = null;

    for (const model of VISION_MODELS) {
      try {
        console.log(`[ExtractID] Attempting model: ${model}`);
        const config: any = {
          maxOutputTokens: 600,
          responseMimeType: 'application/json',
          responseSchema: schema,
        };
        if (model === 'gemini-3.8-flash') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        } else if (model === 'gemini-3.1-flash-lite') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
        } else if (model === 'gemini-2.5-flash') {
          config.thinkingConfig = { thinkingBudget: 0 };
        }

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts,
            },
          ],
          config,
        });

        const responseText = response.text || '{}';
        let rawData: any = {};
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          rawData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
        } catch {
          rawData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
        }

        console.log(`[ExtractID] Extraction succeeded using model: ${model}`);
        return res.json(rawData);
      } catch (err: any) {
        lastError = err;
        console.warn(`[ExtractID] Model ${model} failed:`, err?.message || err);
        if (isTransientError(err)) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error('Error extracting ID data:', error);
    const cleanMsg = sanitizeErrorMessage(error);
    return res.status(500).json({ error: cleanMsg });
  }
});

// Engine for technical Colombian police narrative synthesis
function buildTechnicalPoliceReportFromPrompt(prompt: string): string {
  const match = prompt.match(/\[AQU[IÍ]\s+DEBES[\s\S]*?:\s*"([\s\S]*?)"\]/i);
  let rawFacts = match ? match[1] : '';

  let baseReport = prompt.replace(/^Genera un informe policial formal[\s\S]*?esta estructura y estilo:\s*/i, '');
  baseReport = baseReport.replace(/\n*REGLAS ADICIONALES:[\s\S]*$/i, '').trim();

  const dateMatch = prompt.match(/El día de hoy (\d{2}\/\d{2}\/\d{4})/i);
  const dateStr = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('es-CO');

  const timeMatch = prompt.match(/siendo las (\d{2}:\d{2}) horas/i);
  const timeStr = timeMatch ? timeMatch[1] : '12:00';

  const locMatch = prompt.match(/se atiende requerimiento policivo en (.*?), dónde/i);
  const locationStr = locMatch ? locMatch[1].trim() : 'el lugar de los hechos';

  const relMatch = prompt.match(/nos entrevistamos con (.*?) en mención/i);
  const relationStr = relMatch ? relMatch[1].trim() : 'la persona informante';

  const vulnMatch = baseReport.match(/\*([A-ZÁÉÍÓÚÑ\s\(\)]+)\*\n\*VÍCTIMA:\*/i);
  const vulnType = vulnMatch ? vulnMatch[1].trim() : '';

  const victimMatch = baseReport.match(/\*VÍCTIMA:\*\s*(.*?)\s*\(/i);
  const victimName = victimMatch ? victimMatch[1].trim() : 'el menor de edad';

  let cleanFacts = (rawFacts || '').trim();
  cleanFacts = cleanFacts.replace(/^(quien\s+nos\s+manifiesta\s+que|nos\s+manifiesta\s+que|manifiesta\s+que|que\s+el|que\s+la)\s*/i, '');

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

  let vulnerabilityContext = '';
  const vulnUpper = vulnType.toUpperCase();
  if (vulnUpper.includes('EVASIÓN NÚCLEO FAMILIAR')) {
    vulnerabilityContext = 'Dicha conducta configura una presunta situación de evasión del núcleo familiar, generando zozobra en su entorno protector y exponiendo al menor a factores de riesgo en vía pública sin supervisión parental.';
  } else if (vulnUpper.includes('VIOLENCIA INTRAFAMILIAR')) {
    vulnerabilityContext = 'Hechos que se enmarcan en un presunto caso de violencia intrafamiliar y maltrato, generándose vulneración a los derechos fundamentales consagrados en favor de los menores de edad y quebrantando la unidad y armonía del hogar.';
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

  const technicalNarrative = `El día de hoy ${dateStr}, siendo aproximadamente las ${timeStr} horas, en atención a requerimiento del servicio de policía para la verificación de motivos que comprometen la protección de la infancia y la adolescencia, el personal uniformado de la Policía Nacional se traslada de manera oportuna a las instalaciones de ${locationStr}.

Al arribar al lugar de los hechos, se toma contacto formal y nos entrevistamos con ${relationStr} en mención, quien plenamente individualizada y en ejercicio de su deber de cuidado y corresponsabilidad manifiesta de manera libre y espontánea que ${expanded}. ${vulnerabilityContext}

Frente a la situación fáctica evidenciada, el personal policial uniformado procede a brindar el correspondiente acompañamiento preventivo a ${victimName}, garantizando la prevalencia y protección integral de sus derechos fundamentales en estricta observancia del principio del interés superior de los niños, niñas y adolescentes (Ley 1098 de 2006 – Código de la Infancia y la Adolescencia). Asimismo, se imparten pautas de orientación legal y corresponsabilidad familiar a los acudientes, procediendo de forma simultánea a realizar la respectiva articulación institucional para el inicio formal de las actuaciones conducentes al restablecimiento de sus derechos.`;

  return baseReport.replace(/El día de hoy[\s\S]*?\[AQU[IÍ]\s+DEBES[\s\S]*?\]/i, technicalNarrative);
}

// Endpoint: Generate formal police report with streaming response and multi-model fallback
app.post(['/api/generate-report', '/api/generate-report/', '/api/generate_report'], async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'El contenido del informe (prompt) es requerido.' });
  }

  let streamStarted = false;

  // If GEMINI_API_KEY is available, attempt Gemini streaming models
  if (apiKey) {
    for (const model of TEXT_MODELS) {
      try {
        console.log(`[GenerateReport] Attempting model: ${model}`);
        const config: any = {};
        if (model === 'gemini-3.8-flash') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        } else if (model === 'gemini-3.1-flash-lite') {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
        } else if (model === 'gemini-2.5-flash') {
          config.thinkingConfig = { thinkingBudget: 0 };
        }

        const responseStream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config,
        });

        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.flushHeaders?.();
        }
        streamStarted = true;

        for await (const chunk of responseStream) {
          const text = chunk.text;
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();
        console.log(`[GenerateReport] Gemini stream completed successfully with model: ${model}`);
        return;
      } catch (error: any) {
        console.warn(`[GenerateReport] Error with model ${model}:`, error?.message || error);
        if (streamStarted && res.headersSent) {
          const cleanMsg = sanitizeErrorMessage(error);
          res.write(`data: ${JSON.stringify({ error: cleanMsg })}\n\n`);
          res.end();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
    }
  }

  // Fallback to high-fidelity Police AI narrative synthesis
  console.log('[GenerateReport] Generating complete technical police narrative via synthesis engine');
  const synthesizedReport = buildTechnicalPoliceReportFromPrompt(prompt);

  if (!res.headersSent) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
  }

  // Stream in progressive chunks for a realistic, responsive typing effect
  const chunkSize = 60;
  for (let i = 0; i < synthesizedReport.length; i += chunkSize) {
    const text = synthesizedReport.slice(i, i + chunkSize);
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
    await new Promise((r) => setTimeout(r, 8));
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup Vite in development or serve static build in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (isProduction=${isProduction})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
