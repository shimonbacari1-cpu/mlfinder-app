"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  RespuestaAPI,
  RespuestaAnalisis,
  RespuestaError,
  ResultadoComparado,
  Clasificacion,
} from "@/lib/types";

type Estado =
  | { tipo: "vacio" }
  | { tipo: "imagen_lista"; archivo: File; previewUrl: string }
  | { tipo: "procesando"; previewUrl: string; etapaActual: string }
  | { tipo: "resultados"; previewUrl: string; data: RespuestaAnalisis }
  | { tipo: "error"; previewUrl?: string; error: RespuestaError };

const ETAPAS = [
  "Analizando imagen con IA...",
  "Generando búsquedas inteligentes...",
  "Consultando Mercado Libre Argentina...",
  "Pre-filtrando candidatos...",
  "Comparando visualmente con IA...",
];

export default function Home() {
  const [estado, setEstado] = useState<Estado>({ tipo: "vacio" });
  const [arrastrando, setArrastrando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const etapaIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // === Manejo de archivo ===
  const cargarArchivo = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Solo se aceptan imágenes (JPG, PNG, WEBP, GIF).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("La imagen pesa más de 10MB. Probá con una más chica.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setEstado({ tipo: "imagen_lista", archivo: file, previewUrl });
  }, []);

  // === Ctrl+V (Clipboard API) ===
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // si está procesando, ignorar
      if (estado.tipo === "procesando") return;

      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            cargarArchivo(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [cargarArchivo, estado.tipo]);

  // === Drag & drop ===
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(true);
  };
  const handleDragLeave = () => setArrastrando(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) cargarArchivo(file);
  };

  // === File input ===
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) cargarArchivo(file);
    e.target.value = "";
  };

  const limpiar = () => {
    if (estado.tipo !== "vacio" && "previewUrl" in estado && estado.previewUrl) {
      URL.revokeObjectURL(estado.previewUrl);
    }
    setEstado({ tipo: "vacio" });
  };

  // === Buscar ===
  const buscar = async () => {
    if (estado.tipo !== "imagen_lista") return;
    const { archivo, previewUrl } = estado;

    setEstado({ tipo: "procesando", previewUrl, etapaActual: ETAPAS[0] });

    // simulación de avance de etapas (visual)
    let etapaIdx = 0;
    etapaIntervalRef.current = setInterval(() => {
      etapaIdx = Math.min(etapaIdx + 1, ETAPAS.length - 1);
      setEstado((prev) =>
        prev.tipo === "procesando"
          ? { ...prev, etapaActual: ETAPAS[etapaIdx] }
          : prev
      );
    }, 6000);

    try {
      const base64 = await fileABase64(archivo);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagen: base64,
          mediaType: archivo.type,
        }),
      });

      const data: RespuestaAPI = await res.json();

      if (etapaIntervalRef.current) clearInterval(etapaIntervalRef.current);

      if (data.ok) {
        setEstado({ tipo: "resultados", previewUrl, data });
      } else {
        setEstado({ tipo: "error", previewUrl, error: data });
      }
    } catch (err) {
      if (etapaIntervalRef.current) clearInterval(etapaIntervalRef.current);
      setEstado({
        tipo: "error",
        previewUrl,
        error: {
          ok: false,
          tipo: "interno",
          mensaje_usuario:
            "No se pudo conectar con el servidor. Revisá tu conexión y probá de nuevo.",
        },
      });
    }
  };

  const reintentar = () => {
    if (estado.tipo === "error" && estado.previewUrl) {
      // reconstruir el estado a partir del archivo si todavía tenemos uno
      // como ya consumimos el file, pedimos al user que vuelva a pegar
      setEstado({ tipo: "vacio" });
    }
  };

  // === Render ===
  return (
    <>
      <div className="header">
        <div className="container" style={{ padding: "0" }}>
          <h1>MLFinder</h1>
          <div className="subtitle">
            Buscar productos en Mercado Libre Argentina por imagen
          </div>
        </div>
      </div>

      <div className="container">
        {/* Zona de paste */}
        {(estado.tipo === "vacio" || estado.tipo === "imagen_lista") && (
          <div
            className={`paste-zone ${arrastrando ? "dragging" : ""} ${
              estado.tipo === "imagen_lista" ? "has-image" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {estado.tipo === "vacio" ? (
              <>
                <div className="paste-zone-text">
                  Pegá una captura con <strong>Ctrl+V</strong>
                </div>
                <div className="paste-zone-subtext">
                  o arrastrá una imagen acá, o{" "}
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "4px 10px", fontSize: "13px" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    elegí un archivo
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </>
            ) : (
              <>
                <img
                  className="preview-img"
                  src={estado.previewUrl}
                  alt="Producto a buscar"
                />
                <div className="preview-actions">
                  <button className="btn btn-primary" onClick={buscar}>
                    Buscar en Mercado Libre
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Reemplazar imagen
                  </button>
                  <button className="btn btn-danger" onClick={limpiar}>
                    Limpiar
                  </button>
                </div>
                <div
                  className="paste-zone-subtext"
                  style={{ marginTop: 12 }}
                >
                  También podés pegar otra imagen con Ctrl+V para reemplazar
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </>
            )}
          </div>
        )}

        {/* Procesando */}
        {estado.tipo === "procesando" && (
          <>
            <div className="paste-zone has-image">
              <img
                className="preview-img"
                src={estado.previewUrl}
                alt="Procesando"
                style={{ opacity: 0.6 }}
              />
            </div>
            <div className="progress">
              <div>
                <span className="spinner" />
                <strong>{estado.etapaActual}</strong>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${((ETAPAS.indexOf(estado.etapaActual) + 1) / ETAPAS.length) * 100}%`,
                  }}
                />
              </div>
              <div
                style={{ fontSize: 12, color: "#666", marginTop: 8 }}
              >
                Esto puede tardar 30-90 segundos. No cierres la pestaña.
              </div>
            </div>
          </>
        )}

        {/* Error */}
        {estado.tipo === "error" && (
          <>
            {estado.previewUrl && (
              <div className="paste-zone has-image">
                <img
                  className="preview-img"
                  src={estado.previewUrl}
                  alt="Imagen"
                />
              </div>
            )}
            <div className="error-box">
              <h3>
                {estado.error.tipo === "rate_limit"
                  ? "Límite de IA alcanzado"
                  : estado.error.tipo === "timeout"
                  ? "Tiempo de espera agotado"
                  : estado.error.tipo === "imagen_invalida"
                  ? "Imagen inválida"
                  : estado.error.tipo === "ml_api_error"
                  ? "Error con Mercado Libre"
                  : "Algo falló"}
              </h3>
              <div>{estado.error.mensaje_usuario}</div>
              {estado.error.tipo === "rate_limit" &&
                estado.error.reintentar_en_segundos && (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    Sugerencia: esperá ~
                    {Math.ceil(estado.error.reintentar_en_segundos / 60)} minutos
                    antes de reintentar.
                  </div>
                )}
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-secondary" onClick={reintentar}>
                  Volver a empezar
                </button>
              </div>
            </div>
          </>
        )}

        {/* Resultados */}
        {estado.tipo === "resultados" && (
          <Resultados
            previewUrl={estado.previewUrl}
            data={estado.data}
            onNueva={limpiar}
          />
        )}
      </div>
    </>
  );
}

// ===========================================================
// Componente de resultados
// ===========================================================
function Resultados({
  previewUrl,
  data,
  onNueva,
}: {
  previewUrl: string;
  data: RespuestaAnalisis;
  onNueva: () => void;
}) {
  const [mostrarDescartados, setMostrarDescartados] = useState(false);
  const visibles = mostrarDescartados
    ? data.resultados
    : data.resultados.filter((r) => r.clasificacion !== "descartar");

  return (
    <>
      <div className="paste-zone has-image">
        <img className="preview-img" src={previewUrl} alt="Producto buscado" />
        <div className="preview-actions">
          <button className="btn btn-primary" onClick={onNueva}>
            Analizar otro producto
          </button>
        </div>
      </div>

      <div className="results">
        <h2>Atributos detectados</h2>
        <div className="atributos">
          <div className="atributos-grid">
            <Atributo label="Tipo" valor={data.atributos.tipo_producto} />
            <Atributo label="Color" valor={data.atributos.color} />
            <Atributo label="Material" valor={data.atributos.material} />
            <Atributo label="Forma" valor={data.atributos.forma} />
            <Atributo label="Medidas" valor={data.atributos.medidas} />
            <Atributo
              label="Piezas"
              valor={data.atributos.cantidad_piezas?.toString() || null}
            />
            <Atributo label="Marca" valor={data.atributos.marca} />
            <Atributo label="Modelo" valor={data.atributos.modelo} />
            <Atributo label="Texto visible" valor={data.atributos.texto_visible} />
          </div>
          {data.atributos.detalles_distintivos.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 12 }}>Detalles: </strong>
              <span style={{ fontSize: 13 }}>
                {data.atributos.detalles_distintivos.join(" • ")}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h2>
            Resultados ({visibles.length} de {data.resultados.length})
          </h2>
          <div style={{ fontSize: 12, color: "#666" }}>
            Buscado en {data.queries_usadas.length} consultas •{" "}
            {data.total_candidatos_evaluados} candidatos evaluados •{" "}
            {(data.duracion_ms / 1000).toFixed(1)}s
          </div>
        </div>

        <div style={{ marginBottom: 12, fontSize: 12, color: "#666" }}>
          <strong>Queries usadas: </strong>
          {data.queries_usadas.map((q, i) => (
            <code
              key={i}
              style={{
                background: "#f0f0f0",
                padding: "2px 6px",
                borderRadius: 3,
                marginRight: 4,
              }}
            >
              {q}
            </code>
          ))}
        </div>

        {data.resultados.length === 0 ? (
          <div className="empty-state">
            <strong>No se encontraron coincidencias claras.</strong>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Probá con una imagen del producto en mejor resolución, sin fondo, o
              que muestre la marca/modelo si lo tiene.
            </div>
          </div>
        ) : (
          <>
            <table className="tabla">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Imagen</th>
                  <th style={{ width: 70 }}>Score</th>
                  <th>Publicación</th>
                  <th style={{ width: 100 }}>Precio</th>
                  <th>Análisis</th>
                  <th style={{ width: 80 }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <FilaResultado key={r.candidato.item_id} resultado={r} />
                ))}
              </tbody>
            </table>

            {data.resultados.some((r) => r.clasificacion === "descartar") && (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setMostrarDescartados(!mostrarDescartados)}
                >
                  {mostrarDescartados ? "Ocultar" : "Mostrar"} descartados
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Atributo({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div className="atributo">
      <div className="atributo-label">{label}</div>
      <div className="atributo-valor">{valor || "—"}</div>
    </div>
  );
}

function FilaResultado({ resultado }: { resultado: ResultadoComparado }) {
  const claseScore = claseDeScore(resultado.clasificacion);
  const labelClasif = labelDeClasificacion(resultado.clasificacion);

  return (
    <tr>
      <td>
        <a href={resultado.candidato.link} target="_blank" rel="noopener">
          <img
            src={resultado.candidato.thumbnail}
            alt={resultado.candidato.titulo}
          />
        </a>
      </td>
      <td>
        <div className={`score ${claseScore}`}>{resultado.score}</div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
          {labelClasif}
        </div>
      </td>
      <td>
        <a
          href={resultado.candidato.link}
          target="_blank"
          rel="noopener"
          style={{ fontWeight: 500 }}
        >
          {resultado.candidato.titulo}
        </a>
        {resultado.candidato.vendedor_nickname && (
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
            por {resultado.candidato.vendedor_nickname}
          </div>
        )}
      </td>
      <td>
        <div className="precio">
          ${resultado.candidato.precio.toLocaleString("es-AR")}
        </div>
        <div style={{ fontSize: 11, color: "#888" }}>
          {resultado.candidato.moneda}
        </div>
      </td>
      <td>
        {resultado.motivos_coincidencia.length > 0 && (
          <div className="motivos motivos-coincidencia">
            ✓ {resultado.motivos_coincidencia.join(" • ")}
          </div>
        )}
        {resultado.diferencias.length > 0 && (
          <div className="motivos motivos-diferencia">
            ✗ {resultado.diferencias.join(" • ")}
          </div>
        )}
      </td>
      <td>
        <strong style={{ fontSize: 12 }}>
          {resultado.recomendacion === "usar" && "✓ Usar"}
          {resultado.recomendacion === "revisar" && "? Revisar"}
          {resultado.recomendacion === "descartar" && "✗ Descartar"}
        </strong>
      </td>
    </tr>
  );
}

function claseDeScore(c: Clasificacion): string {
  switch (c) {
    case "coincidencia_exacta":
      return "score-exacto";
    case "probable_mismo":
      return "score-probable";
    case "revisar":
      return "score-revisar";
    case "descartar":
      return "score-descartar";
  }
}

function labelDeClasificacion(c: Clasificacion): string {
  switch (c) {
    case "coincidencia_exacta":
      return "Exacta";
    case "probable_mismo":
      return "Probable";
    case "revisar":
      return "Revisar";
    case "descartar":
      return "Descartar";
  }
}

// ===========================================================
// Helpers
// ===========================================================
async function fileABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // viene como data:image/jpeg;base64,xxxx → me quedo con xxxx
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
