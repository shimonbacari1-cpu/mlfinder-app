import { callGeminiVision, extraerJSON, AIError } from "./gemini";
import { buscarMultiplesQueries, descargarComoBase64 } from "./meli";
import {
  AtributosExtraidos,
  CandidatoML,
  ResultadoComparado,
  RespuestaAnalisis,
} from "./types";
import { prefiltrarCandidatos, clasificar, recomendacion } from "./scoring";
 
// =====================================================================
// ETAPA 1 - Extracción de atributos con visión
// =====================================================================
const SYSTEM_EXTRACCION = `Sos un asistente experto en análisis visual de productos de bazar (vasos, platos, fuentes, jarrones, bandejas, utensilios, accesorios de cocina) para Mercado Libre Argentina.
 
Tu trabajo: mirar UNA imagen y extraer atributos estructurados que sirvan para buscar el mismo producto en Mercado Libre.
 
Reglas:
- Sé preciso. Si no estás seguro de algo, poné null.
- "tipo_producto" debe ser una palabra o frase corta y específica (ej: "copa de champagne", "set de cuchillos", "fuente rectangular").
- "color" describe el color principal y secundarios (ej: "transparente con borde dorado").
- "material" describe el material aparente (ej: "vidrio", "cerámica esmaltada", "acero inoxidable", "porcelana").
- "medidas" solo si aparecen visibles en la imagen o packaging (ej: "30cm x 20cm", "500ml"). Si no aparecen, null.
- "cantidad_piezas" es un número entero. Si es un set de varias unidades visibles, contalas. Si es una sola unidad, 1.
- "marca" y "modelo" solo si aparecen escritos visiblemente. Si no, null.
- "texto_visible" es OCR de cualquier texto legible en la imagen, packaging, etiquetas. Si no hay, null.
- "detalles_distintivos" es un array de hasta 5 strings cortos describiendo elementos diferenciadores (ej: ["asa lateral curva", "patrón floral grabado", "borde ondulado"]).
- "packaging" describe la caja/blister/etiqueta si aparece. Si no aparece, null.
 
Respondé SOLO con JSON válido, sin markdown, sin texto previo ni posterior. Estructura exacta:
{
  "tipo_producto": "string",
  "forma": "string o null",
  "color": "string o null",
  "material": "string o null",
  "medidas": "string o null",
  "cantidad_piezas": "número o null",
  "marca": "string o null",
  "modelo": "string o null",
  "texto_visible": "string o null",
  "detalles_distintivos": ["string"],
  "packaging": "string o null"
}`;
 
async function extraerAtributos(
  imagen: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string }
): Promise<AtributosExtraidos> {
  const respuesta = await callGeminiVision({
    systemPrompt: SYSTEM_EXTRACCION,
    userText: "Analizá esta imagen y devolveme los atributos en JSON.",
    imagen: imagen,
  });
  return extraerJSON<AtributosExtraidos>(respuesta);
}
 
// =====================================================================
// ETAPA 2 - Generación de queries
// =====================================================================
function generarQueries(attrs: AtributosExtraidos): string[] {
  const queries: string[] = [];
 
  // Query 1: marca + modelo (más específica, si existe)
  if (attrs.marca && attrs.modelo) {
    queries.push(`${attrs.marca} ${attrs.modelo}`);
  }
 
  // Query 2: marca + tipo + cantidad
  if (attrs.marca) {
    const partes = [attrs.marca, attrs.tipo_producto];
    if (attrs.cantidad_piezas && attrs.cantidad_piezas > 1) {
      partes.push(`${attrs.cantidad_piezas} piezas`);
    }
    queries.push(partes.filter(Boolean).join(" "));
  }
 
  // Query 3: tipo + material + color (la genérica)
  const partesGenerica = [attrs.tipo_producto, attrs.material, attrs.color]
    .filter((x): x is string => Boolean(x))
    .map((x) => x.split(" ").slice(0, 2).join(" "));
  if (partesGenerica.length > 0) {
    queries.push(partesGenerica.join(" "));
  }
 
  // Query 4: tipo + detalle distintivo principal
  if (attrs.detalles_distintivos.length > 0 && attrs.tipo_producto) {
    queries.push(
      `${attrs.tipo_producto} ${attrs.detalles_distintivos[0]
        .split(" ")
        .slice(0, 3)
        .join(" ")}`
    );
  }
 
  // Query 5: solo el tipo (fallback amplio)
  if (attrs.tipo_producto) {
    queries.push(attrs.tipo_producto);
  }
 
  // dedup y limpiar
  const limpio = queries
    .map((q) => q.trim().replace(/\s+/g, " "))
    .filter((q) => q.length > 0);
  return Array.from(new Set(limpio)).slice(0, 5);
}
 
// =====================================================================
// ETAPA 5 - Comparación visual con Claude
// =====================================================================
const SYSTEM_COMPARACION = `Sos un asistente experto en comparación visual de productos de Mercado Libre Argentina.
 
Te van a pasar:
- 1 imagen del PRODUCTO ORIGINAL (el primero).
- N imágenes de CANDIDATOS de Mercado Libre (las siguientes), numeradas en el mismo orden que te paso en el texto.
 
Tu trabajo: para CADA candidato, decidir si es el MISMO PRODUCTO que el original (no solo similar) y darme un score 0-100.
 
Criterios para que sea "el mismo producto":
- Misma forma general y proporciones.
- Mismo diseño y detalles distintivos.
- Mismo color (o muy cercano).
- Mismo material aparente.
- Misma cantidad de piezas si es un set.
- Si hay marca/modelo visible, debe coincidir.
 
NO confundas "del mismo rubro" con "el mismo producto". Si dos vasos tienen forma distinta, NO son el mismo producto aunque ambos sean de vidrio.
 
Sé conservador: ante la duda, bajá el score. Es mejor decir "revisar" que un falso positivo.
 
Para cada candidato devolvé:
- "score": 0-100 (qué tan probable es que sea el mismo producto)
- "motivos_coincidencia": array de strings cortos con qué cosas SÍ coinciden
- "diferencias": array de strings cortos con qué cosas NO coinciden o son dudosas
 
Respondé SOLO con JSON válido. Estructura exacta:
{
  "comparaciones": [
    { "indice": 1, "score": 92, "motivos_coincidencia": ["..."], "diferencias": ["..."] },
    { "indice": 2, "score": 45, "motivos_coincidencia": ["..."], "diferencias": ["..."] }
  ]
}
 
El "indice" es el número del candidato (1, 2, 3...) en el orden que te lo paso.`;
 
interface ComparacionIA {
  indice: number;
  score: number;
  motivos_coincidencia: string[];
  diferencias: string[];
}
 
async function compararVisualmente(
  imagenOriginal: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string },
  candidatos: Array<{
    candidato: CandidatoML;
    imagen: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string };
  }>
): Promise<ComparacionIA[]> {
  if (candidatos.length === 0) return [];
 
  const userText = `Imagen 1: producto ORIGINAL (el que quiero identificar).
 
Las siguientes ${candidatos.length} imágenes son CANDIDATOS de Mercado Libre. Compará cada uno con el original:
 
${candidatos
  .map(
    (c, i) =>
      `Candidato ${i + 1}: "${c.candidato.titulo}" - $${c.candidato.precio} ${c.candidato.moneda}`
  )
  .join("\n")}
 
Devolveme el JSON con una entrada por cada candidato.`;
 
  const imagenes = [imagenOriginal, ...candidatos.map((c) => c.imagen)];
 
  const respuesta = await callGeminiVision({
    systemPrompt: SYSTEM_COMPARACION,
    userText,
    images: imagenes,
  });
 
  const parsed = extraerJSON<{ comparaciones: ComparacionIA[] }>(respuesta);
  return parsed.comparaciones || [];
}
 
// =====================================================================
// PIPELINE COMPLETO
// =====================================================================
export async function ejecutarPipeline(args: {
  imagenBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  jobId: string;
}): Promise<RespuestaAnalisis> {
  const inicio = Date.now();
  const imagen = { mediaType: args.mediaType, base64: args.imagenBase64 };
 
  // ETAPA 1
  console.log(`[${args.jobId}] etapa 1: extracción`);
  const atributos = await extraerAtributos(imagen);
 
  // ETAPA 2
  console.log(`[${args.jobId}] etapa 2: queries`, atributos);
  const queries = generarQueries(atributos);
  if (queries.length === 0) {
    throw new AIError("No se pudieron generar queries de búsqueda", "interno");
  }
 
  // ETAPA 3
  console.log(`[${args.jobId}] etapa 3: búsqueda ML`, queries);
  const candidatos = await buscarMultiplesQueries(queries, 15);
  console.log(`[${args.jobId}] candidatos brutos: ${candidatos.length}`);
 
  if (candidatos.length === 0) {
    return {
      ok: true,
      job_id: args.jobId,
      atributos,
      queries_usadas: queries,
      total_candidatos_evaluados: 0,
      resultados: [],
      duracion_ms: Date.now() - inicio,
    };
  }
 
  // ETAPA 4
  const top = prefiltrarCandidatos(candidatos, atributos, 8);
  console.log(`[${args.jobId}] candidatos prefiltrados: ${top.length}`);
 
  // ETAPA 5: descargar thumbnails en paralelo
  const conImagenes = await Promise.all(
    top.map(async (c) => {
      const img = await descargarComoBase64(c.thumbnail);
      return img ? { candidato: c, imagen: img } : null;
    })
  );
  const validos = conImagenes.filter(
    (x): x is { candidato: CandidatoML; imagen: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string } } => x !== null
  );
 
  if (validos.length === 0) {
    return {
      ok: true,
      job_id: args.jobId,
      atributos,
      queries_usadas: queries,
      total_candidatos_evaluados: candidatos.length,
      resultados: [],
      duracion_ms: Date.now() - inicio,
    };
  }
 
  // ETAPA 6: comparación visual con Claude
  console.log(`[${args.jobId}] etapa 6: comparación visual con ${validos.length} candidatos`);
  const comparaciones = await compararVisualmente(imagen, validos);
 
  // armar resultados finales
  const resultados: ResultadoComparado[] = [];
  for (const comp of comparaciones) {
    const idx = comp.indice - 1;
    if (idx < 0 || idx >= validos.length) continue;
    const candidato = validos[idx].candidato;
    const score = Math.max(0, Math.min(100, Math.round(comp.score)));
    const clasif = clasificar(score);
    resultados.push({
      candidato,
      score,
      clasificacion: clasif,
      motivos_coincidencia: comp.motivos_coincidencia || [],
      diferencias: comp.diferencias || [],
      recomendacion: recomendacion(clasif),
    });
  }
 
  // ordenar por score desc
  resultados.sort((a, b) => b.score - a.score);
 
  return {
    ok: true,
    job_id: args.jobId,
    atributos,
    queries_usadas: queries,
    total_candidatos_evaluados: candidatos.length,
    resultados,
    duracion_ms: Date.now() - inicio,
  };
}