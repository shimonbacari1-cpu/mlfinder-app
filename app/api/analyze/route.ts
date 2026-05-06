import { NextRequest, NextResponse } from "next/server";
import { ejecutarPipeline } from "@/lib/pipeline";
import { AIError } from "@/lib/gemini";
import { RespuestaAPI } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function generarJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest): Promise<NextResponse<RespuestaAPI>> {
  const jobId = generarJobId();

  try {
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          tipo: "interno",
          mensaje_usuario:
            "Falta configurar GOOGLE_API_KEY en las variables de entorno. Revisá la configuración del servidor.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          ok: false,
          tipo: "imagen_invalida",
          mensaje_usuario: "El cuerpo del request no es JSON válido.",
        },
        { status: 400 }
      );
    }

    const { imagen, mediaType } = body as {
      imagen?: string;
      mediaType?: string;
    };

    if (!imagen || typeof imagen !== "string") {
      return NextResponse.json(
        {
          ok: false,
          tipo: "imagen_invalida",
          mensaje_usuario: "No se recibió imagen.",
        },
        { status: 400 }
      );
    }

    // validar mediaType
    const tiposValidos = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!mediaType || !tiposValidos.includes(mediaType)) {
      return NextResponse.json(
        {
          ok: false,
          tipo: "imagen_invalida",
          mensaje_usuario: `Formato de imagen no soportado. Usá JPG, PNG, WEBP o GIF.`,
        },
        { status: 400 }
      );
    }

    // tamaño aprox: base64 a bytes
    const aproxBytes = (imagen.length * 3) / 4;
    if (aproxBytes > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          ok: false,
          tipo: "imagen_invalida",
          mensaje_usuario: "La imagen pesa más de 10MB. Probá con una más chica.",
        },
        { status: 400 }
      );
    }

    const resultado = await ejecutarPipeline({
      imagenBase64: imagen,
      mediaType: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      jobId,
    });

    return NextResponse.json(resultado);
  } catch (err: unknown) {
    console.error(`[${jobId}] error:`, err);

    if (err instanceof AIError) {
      if (err.tipo === "rate_limit") {
        return NextResponse.json(
          {
            ok: false,
            tipo: "rate_limit",
            mensaje_usuario:
              "Se alcanzó el límite de la API de IA. Esperá unos minutos y volvé a probar. Tu imagen no se perdió, podés reintentar.",
            reintentar_en_segundos: err.retryAfter || 60,
          },
          { status: 429 }
        );
      }
      if (err.tipo === "timeout") {
        return NextResponse.json(
          {
            ok: false,
            tipo: "timeout",
            mensaje_usuario:
              "La consulta tardó demasiado. Probá nuevamente o con una imagen más chica.",
          },
          { status: 504 }
        );
      }
    }

    const msg = err instanceof Error ? err.message : "Error desconocido";

    if (msg.includes("Mercado Libre")) {
      return NextResponse.json(
        {
          ok: false,
          tipo: "ml_api_error",
          mensaje_usuario:
            "No se pudo consultar Mercado Libre en este momento. Intentá de nuevo en unos segundos.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        tipo: "interno",
        mensaje_usuario:
          "Hubo un error procesando la imagen. Probá de nuevo. Si sigue fallando, revisá la consola del servidor.",
      },
      { status: 500 }
    );
  }
}
