import { CandidatoML } from "./types";

const ML_API = "https://api.mercadolibre.com";
const SITE = "MLA"; // Argentina

interface MLSearchResult {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  permalink: string;
  thumbnail: string;
  thumbnail_id?: string;
  seller?: { id: number; nickname?: string };
  category_id: string;
  condition: string;
}

interface MLSearchResponse {
  results: MLSearchResult[];
}

/**
 * Busca en la API pública de Mercado Libre Argentina.
 * No requiere auth para búsquedas. Devuelve hasta `limit` resultados.
 */
export async function buscarML(query: string, limit: number = 20): Promise<CandidatoML[]> {
  const url = `${ML_API}/sites/${SITE}/search?q=${encodeURIComponent(query)}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // sin caché del lado de Next para tener resultados frescos
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`ML API respondió ${res.status}`);
    }
    const data = (await res.json()) as MLSearchResponse;
    if (!Array.isArray(data.results)) return [];

    return data.results.map((r) => ({
      item_id: r.id,
      titulo: r.title,
      precio: r.price,
      moneda: r.currency_id,
      link: r.permalink,
      // los thumbnails de ML son http; los pasamos a https
      thumbnail: r.thumbnail.replace(/^http:/, "https:"),
      vendedor_nickname: r.seller?.nickname,
      categoria_id: r.category_id,
      condicion: r.condition,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`No se pudo consultar Mercado Libre: ${msg}`);
  }
}

/**
 * Ejecuta varias queries en paralelo y deduplica por item_id.
 */
export async function buscarMultiplesQueries(
  queries: string[],
  limitePorQuery: number = 15
): Promise<CandidatoML[]> {
  const promesas = queries.map((q) =>
    buscarML(q, limitePorQuery).catch((err) => {
      console.error(`[ML] query falló: "${q}"`, err);
      return [] as CandidatoML[];
    })
  );
  const resultados = await Promise.all(promesas);
  const map = new Map<string, CandidatoML>();
  for (const lista of resultados) {
    for (const item of lista) {
      if (!map.has(item.item_id)) map.set(item.item_id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Descarga un thumbnail y lo devuelve como base64 con su mediaType.
 * Lo necesitamos para mandar a Claude en la etapa de comparación visual.
 */
export async function descargarComoBase64(url: string): Promise<{
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  base64: string;
} | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());

    let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg";
    if (contentType.includes("png")) mediaType = "image/png";
    else if (contentType.includes("webp")) mediaType = "image/webp";
    else if (contentType.includes("gif")) mediaType = "image/gif";

    return { mediaType, base64: buffer.toString("base64") };
  } catch (err) {
    console.error(`[ML] error descargando thumbnail`, err);
    return null;
  }
}
