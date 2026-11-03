import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Support base64 image uploads from camera / gallery
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

// Model fallback lists in order of priority (non-deprecated models)
const TEXT_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
const VISION_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

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

// Endpoint: Generate formal police report with streaming response and multi-model fallback
app.post('/api/generate-report', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'El contenido del informe (prompt) es requerido.' });
  }

  let streamStarted = false;
  let lastError: any = null;

  for (const model of TEXT_MODELS) {
    try {
      console.log(`[GenerateReport] Attempting model: ${model}`);
      const config: any = {};
      if (model === 'gemini-3.8-flash') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      } else if (model === 'gemini-3.1-flash-lite') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      }

      const responseStream = await ai.models.generateContentStream({
        model,
        contents: prompt,
        config,
      });

      // Headers sent only once the stream is successfully established
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
      console.log(`[GenerateReport] Report completed successfully with model: ${model}`);
      return;
    } catch (error: any) {
      lastError = error;
      console.warn(`[GenerateReport] Error with model ${model}:`, error?.message || error);

      // If headers were already sent and stream was actively writing, abort cleanly with SSE error
      if (streamStarted && res.headersSent) {
        const cleanMsg = sanitizeErrorMessage(error);
        res.write(`data: ${JSON.stringify({ error: cleanMsg })}\n\n`);
        res.end();
        return;
      }

      // If stream has not sent data yet, delay slightly and fall back to the next model
      if (isTransientError(error)) {
        console.log(`[GenerateReport] Transient spike on ${model}, attempting fallback model...`);
        await new Promise((resolve) => setTimeout(resolve, 400));
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
      continue;
    }
  }

  // All fallback models were exhausted
  console.error('[GenerateReport] All fallback models failed:', lastError);
  const cleanMsg = sanitizeErrorMessage(lastError);
  if (!res.headersSent) {
    return res.status(503).json({ error: cleanMsg });
  } else {
    res.write(`data: ${JSON.stringify({ error: cleanMsg })}\n\n`);
    res.end();
  }
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
