import { AtributosExtraidos, CandidatoML, Clasificacion } from "./types";

/**
 * Pre-filtro por texto: puntúa qué tan bien matchea el título de un candidato
 * con los atributos extraídos. Se usa para reducir el set antes de mandar a IA.
 */
export function scoreTextual(
  titulo: string,
  atributos: AtributosExtraidos
): number {
  const t = normalizar(titulo);
  let score = 0;
  let total = 0;

  const checkPalabra = (palabra: string | null, peso: number) => {
    if (!palabra) return;
    total += peso;
    const tokens = normalizar(palabra).split(/\s+/).filter((x) => x.length >= 3);
    if (tokens.length === 0) return;
    const hits = tokens.filter((tok) => t.includes(tok)).length;
    score += peso * (hits / tokens.length);
  };

  checkPalabra(atributos.tipo_producto, 3);
  checkPalabra(atributos.color, 1);
  checkPalabra(atributos.material, 2);
  checkPalabra(atributos.marca, 4);
  checkPalabra(atributos.modelo, 4);

  // si hay cantidad de piezas y aparece en el título suma
  if (atributos.cantidad_piezas && atributos.cantidad_piezas > 1) {
    total += 2;
    if (
      t.includes(`${atributos.cantidad_piezas}`) ||
      t.includes(`x${atributos.cantidad_piezas}`) ||
      t.includes(`set de ${atributos.cantidad_piezas}`)
    ) {
      score += 2;
    }
  }

  // medidas (busca cualquier número de medidas en el título)
  if (atributos.medidas) {
    total += 1;
    const numeros = atributos.medidas.match(/\d+/g) || [];
    const hits = numeros.filter((n) => t.includes(n)).length;
    if (numeros.length > 0) score += hits / numeros.length;
  }

  if (total === 0) return 0;
  return (score / total) * 100;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca acentos
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pre-filtra candidatos: ordena por score textual y deja los top N.
 * Sirve para no mandar 30 imágenes a Claude en la etapa de visión.
 */
export function prefiltrarCandidatos(
  candidatos: CandidatoML[],
  atributos: AtributosExtraidos,
  topN: number = 8
): CandidatoML[] {
  const conScore = candidatos.map((c) => ({
    candidato: c,
    score: scoreTextual(c.titulo, atributos),
  }));
  conScore.sort((a, b) => b.score - a.score);
  return conScore.slice(0, topN).map((x) => x.candidato);
}

/**
 * Convierte un score 0-100 en una clasificación.
 */
export function clasificar(score: number): Clasificacion {
  if (score >= 85) return "coincidencia_exacta";
  if (score >= 70) return "probable_mismo";
  if (score >= 55) return "revisar";
  return "descartar";
}

export function recomendacion(c: Clasificacion): "usar" | "revisar" | "descartar" {
  if (c === "coincidencia_exacta" || c === "probable_mismo") return "usar";
  if (c === "revisar") return "revisar";
  return "descartar";
}
