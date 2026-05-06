import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export const MODEL = "gemini-1.5-flash";

export class AIError extends Error {
  tipo: "rate_limit" | "timeout" | "interno";
  retryAfter?: number;
  constructor(tipo: "rate_limit" | "timeout" | "interno", message: string, retryAfter?: number) {
    super(message);
    this.tipo = tipo;
    this.retryAfter = retryAfter;
  }
}

/**
 * Llama a Gemini con visión. Maneja todos los errores y los traduce
 * a AIError con tipo claro. NUNCA tira el error crudo del SDK.
 */
export async function callGeminiVision(args: {
  systemPrompt: string;
  userText: string;
  images: Array<{ mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string }>;
}): Promise<string> {
  const { systemPrompt, userText, images } = args;

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: systemPrompt,
    });

    // convertir imágenes al formato de Gemini
    const imageParts = images.map((img) => ({
      inlineData: {
        mimeType: img.mediaType,
        data: img.base64,
      },
    }));

    const parts = [...imageParts, { text: userText }];

    const result = await model.generateContent(parts);
    const response = result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      throw new AIError("interno", "Respuesta vacía de IA");
    }

    return text;
  } catch (err: unknown) {
    // Manejo de errores específicos de Gemini
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();

      // Rate limit / quota
      if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("429")) {
        throw new AIError("rate_limit", "Se alcanzó el límite de la API de IA", 60);
      }

      // Timeout
      if (msg.includes("timeout") || msg.includes("deadline")) {
        throw new AIError("timeout", "Timeout llamando a IA");
      }

      // Service unavailable
      if (msg.includes("503") || msg.includes("unavailable")) {
        throw new AIError("rate_limit", "Servicio de IA temporalmente no disponible", 30);
      }

      // API key inválida
      if (msg.includes("api key") || msg.includes("invalid")) {
        throw new AIError("interno", "API key de Google inválida o mal configurada");
      }

      throw new AIError("interno", `Error de IA: ${err.message}`);
    }

    if (err instanceof AIError) throw err;
    const msg = String(err);
    throw new AIError("interno", `Error inesperado de IA: ${msg}`);
  }
}

/**
 * Extrae JSON de un string que puede venir con ```json ... ``` o texto extra.
 */
export function extraerJSON<T = unknown>(texto: string): T {
  const limpio = texto
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // buscar primer { y último }
  const start = limpio.indexOf("{");
  const end = limpio.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new AIError("interno", "Respuesta de IA no contiene JSON válido");
  }
  const jsonStr = limpio.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new AIError("interno", "JSON inválido en respuesta de IA");
  }
}
