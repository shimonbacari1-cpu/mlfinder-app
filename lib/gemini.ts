import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export const MODEL = "gemini-1.5-flash-latest";

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
    const model = genAI.getGenerativeModel({ 
      model: MODEL
    });

    const partes: any[] = [{ text: prompt }];
    
    if (imagenBase64) {
      partes.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imagenBase64,
        },
      });
    }

    const resultado = await model.generateContent(partes);
    const respuesta = resultado.response;
    return respuesta.text();
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
