// Usar la API REST de Google Gemini directamente (v1)
const API_KEY = process.env.GOOGLE_API_KEY || "";
const API_VERSION = "v1";
const BASE_URL = `https://generativelanguage.googleapis.com/${API_VERSION}`;
export const MODEL = "gemini-1.5-flash";

export class AIError extends Error {
  tipo: "rate_limit" | "timeout" | "interno";
  retryAfter?: number;

  constructor(message: string, tipo: "rate_limit" | "timeout" | "interno", retryAfter?: number) {
    super(message);
    this.tipo = tipo;
    this.retryAfter = retryAfter;
    this.name = "AIError";
  }
}

export async function llamarGemini(prompt: string, imagenBase64?: string): Promise<string> {
  try {
    const url = `${BASE_URL}/models/${MODEL}:generateContent?key=${API_KEY}`;
    
    const parts: any[] = [{ text: prompt }];
    
    if (imagenBase64) {
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: imagenBase64,
        },
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No se recibió respuesta del modelo");
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error: any) {
    if (error.message?.includes("429") || error.status === 429) {
      throw new AIError("Límite de requests excedido. Intentá de nuevo en unos minutos.", "rate_limit");
    }
    
    if (error.message?.includes("timeout") || error.code === "ETIMEDOUT") {
      throw new AIError("Timeout en la llamada a Google AI", "timeout");
    }

    throw new AIError(
      `Error de IA: ${error.message}`,
      "interno"
    );
  }
}

// Función para llamadas con visión (imagen + texto)
export async function callGeminiVision({
  systemPrompt,
  userText,
  imagen,
  images,
}: {
  systemPrompt: string;
  userText: string;
  imagen?: { mediaType: string; base64: string };
  images?: { mediaType: string; base64: string }[];
}): Promise<string> {
  try {
    const url = `${BASE_URL}/models/${MODEL}:generateContent?key=${API_KEY}`;
    
    const parts: any[] = [{ text: userText }];
    
    // Aceptar imagen singular o images plural
    const imagenesToUse = images || (imagen ? [imagen] : []);
    
    for (const img of imagenesToUse) {
      parts.push({
        inline_data: {
          mime_type: img.mediaType,
          data: img.base64,
        },
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{ parts }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No se recibió respuesta del modelo");
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error: any) {
    if (error.message?.includes("429") || error.status === 429) {
      throw new AIError("Límite de requests excedido. Intentá de nuevo en unos minutos.", "rate_limit");
    }
    
    if (error.message?.includes("timeout") || error.code === "ETIMEDOUT") {
      throw new AIError("Timeout en la llamada a Google AI", "timeout");
    }

    throw new AIError(
      `Error de IA: ${error.message}`,
      "interno"
    );
  }
}

// Función para extraer JSON de respuestas de IA
export function extraerJSON<T>(texto: string): T {
  let limpio = texto.trim();
  
  // Quitar markdown
  limpio = limpio.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  limpio = limpio.trim();

  try {
    return JSON.parse(limpio) as T;
  } catch (error: any) {
    throw new AIError(
      `Error parseando JSON de la IA: ${error.message}. Respuesta: ${limpio.substring(0, 200)}`,
      "interno"
    );
  }
}