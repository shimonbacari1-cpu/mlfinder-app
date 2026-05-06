// Tipos compartidos entre frontend y backend

export type Clasificacion =
  | "coincidencia_exacta"
  | "probable_mismo"
  | "revisar"
  | "descartar";

export interface AtributosExtraidos {
  tipo_producto: string;
  forma: string | null;
  color: string | null;
  material: string | null;
  medidas: string | null;
  cantidad_piezas: number | null;
  marca: string | null;
  modelo: string | null;
  texto_visible: string | null;
  detalles_distintivos: string[];
  packaging: string | null;
}

export interface CandidatoML {
  item_id: string;
  titulo: string;
  precio: number;
  moneda: string;
  link: string;
  thumbnail: string;
  vendedor_nickname?: string;
  categoria_id?: string;
  condicion?: string;
}

export interface ResultadoComparado {
  candidato: CandidatoML;
  score: number; // 0-100
  clasificacion: Clasificacion;
  motivos_coincidencia: string[];
  diferencias: string[];
  recomendacion: "usar" | "revisar" | "descartar";
}

export interface RespuestaAnalisis {
  ok: true;
  job_id: string;
  atributos: AtributosExtraidos;
  queries_usadas: string[];
  total_candidatos_evaluados: number;
  resultados: ResultadoComparado[];
  duracion_ms: number;
}

export interface RespuestaError {
  ok: false;
  tipo:
    | "rate_limit"
    | "timeout"
    | "imagen_invalida"
    | "ml_api_error"
    | "interno";
  mensaje_usuario: string;
  reintentar_en_segundos?: number;
}

export type RespuestaAPI = RespuestaAnalisis | RespuestaError;

export interface EtapaProgreso {
  etapa:
    | "extraccion"
    | "queries"
    | "busqueda_ml"
    | "prefiltro"
    | "comparacion_visual"
    | "completado";
  mensaje: string;
}
