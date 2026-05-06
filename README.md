# MLFinder

Herramienta para encontrar productos en Mercado Libre Argentina a partir de una imagen.

---

## ¿Qué hace?

1. Pegás una captura de pantalla con **Ctrl+V** (o subís una imagen).
2. La app analiza visualmente el producto con IA.
3. Busca en Mercado Libre Argentina publicaciones del mismo producto.
4. Te muestra los resultados ordenados por score de coincidencia.
5. Te dice cuáles publicaciones son útiles, cuáles revisar y cuáles descartar.

---

## Características principales

- ✅ **Ctrl+V para pegar capturas** — no hace falta guardar archivos.
- ✅ **Drag & drop** — también podés arrastrar imágenes.
- ✅ **Búsqueda visual inteligente** — usa IA para extraer atributos y comparar.
- ✅ **API oficial de Mercado Libre** — resultados reales y actualizados.
- ✅ **Manejo de límites de IA** — no se rompe, te avisa con mensaje claro.
- ✅ **Clasificación automática** — coincidencia exacta, probable, revisar, descartar.
- ✅ **Precisión sobre falsos positivos** — prefiere decir "no encontré" antes que mostrar cualquier cosa.

---

## Setup rápido (deploy en Vercel)

### 1. Requisitos previos

- Cuenta gratuita en **GitHub** (https://github.com/signup)
- Cuenta gratuita en **Vercel** (https://vercel.com/signup)
- **API key de Google AI Studio** (https://aistudio.google.com/) — **100% GRATIS**
  - Entrá a https://aistudio.google.com/
  - Iniciá sesión con tu cuenta de Google (Gmail)
  - Click en "Get API key" (arriba a la derecha)
  - Click en "Create API key"
  - Copiá la key (empieza con `AIza...`)
  - **NO te pide tarjeta, NO te cobra nada, límite: 1,500 requests/día (gratis para siempre)**

### 2. Subir el código a GitHub

**Opción A - Con GitHub Desktop (más fácil):**
1. Descargá e instalá GitHub Desktop (https://desktop.github.com/)
2. Abrí GitHub Desktop → File → "New repository"
3. Name: `mlfinder`
4. Local path: elegí una carpeta
5. Click "Create repository"
6. Copiá todos los archivos de esta carpeta al repo
7. En GitHub Desktop, escribí "Initial commit" y clickeá "Commit to main"
8. Click "Publish repository" → asegurate que NO esté marcado "Keep this code private" si querés que Vercel lo vea, o dejalo privado (funciona igual)

**Opción B - Con línea de comandos (si sabés usar terminal):**
```bash
cd /ruta/donde/descargaste/mlfinder
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/mlfinder.git
git push -u origin main
```

### 3. Deploy en Vercel

1. Entrá a https://vercel.com
2. Click en "Add New..." → "Project"
3. Importá el repositorio de GitHub que acabás de crear
4. En la pantalla de configuración:
   - **Framework Preset:** Next.js (lo detecta automáticamente)
   - **Root Directory:** `./` (dejar por defecto)
   - Click en "Environment Variables"
   - Agregá una variable:
     - Name: `GOOGLE_API_KEY`
     - Value: pegá tu API key de Google (la que empieza con `AIza...`)
5. Click "Deploy"
6. Esperá 2-3 minutos mientras buildea
7. Cuando termine, te va a dar una URL tipo `mlfinder-xxxxx.vercel.app`
8. ¡Listo! Abrí esa URL y ya podés usar la app.

### 4. Configurar dominio personalizado (opcional)

Si querés que la app esté en `mlfinder.tudominio.com`:
1. En Vercel, andá a tu proyecto → Settings → Domains
2. Agregá tu dominio
3. Vercel te va a decir qué registro DNS crear (un CNAME)
4. Andá a tu proveedor de dominio y agregá ese registro
5. Esperá unos minutos y listo

---

## Uso

### Analizar un producto individual

1. Hacé captura de pantalla (Print Screen) de un producto
2. Entrá a la app
3. Presioná **Ctrl+V**
4. La imagen se carga automáticamente
5. Click en "Buscar en Mercado Libre"
6. Esperá 30-90 segundos
7. Revisá los resultados

### Interpretar resultados

Cada resultado tiene:
- **Score 0-100**: qué tan probable es que sea el mismo producto
- **Clasificación**:
  - 85-100: Coincidencia exacta ✓
  - 70-84: Probable mismo producto ✓
  - 55-69: Revisar manualmente ?
  - <55: Descartar (ocultos por defecto) ✗
- **Motivos de coincidencia**: qué cosas SÍ matchean
- **Diferencias**: qué cosas NO coinciden o son dudosas
- **Recomendación**: Usar / Revisar / Descartar

### Reemplazar imagen

Si cargaste una imagen y querés probar con otra:
- Opción 1: Presioná **Ctrl+V** de nuevo con otra captura
- Opción 2: Click en "Reemplazar imagen"
- Opción 3: Click en "Limpiar" para empezar de cero

---

## Troubleshooting

### Error: "Falta configurar GOOGLE_API_KEY"

**Solución:**
1. Entrá a Vercel → tu proyecto → Settings → Environment Variables
2. Verificá que exista `GOOGLE_API_KEY` con tu key de Google AI Studio
3. Si la agregaste recién, hacé un redeploy: Deployments → tres puntitos → Redeploy

### Error: "Se alcanzó el límite de la API de IA"

**Qué pasó:** Llegaste al límite de 1,500 requests/día de Google AI Studio (MUY difícil de alcanzar).

**Solución:**
- Esperá hasta el día siguiente (el límite se resetea a las 00:00 UTC)
- O revisá en https://aistudio.google.com/ → Usage si hay algún problema con tu cuenta

### La app tarda mucho (más de 2 minutos)

**Posibles causas:**
- Imagen muy grande → probá con una más chica (< 2MB recomendado)
- La API de IA está lenta → reintentá en unos minutos
- Si siempre tarda, revisá los logs en Vercel → tu proyecto → Deployments → (último) → Function Logs

### "No se encontraron coincidencias claras"

**Esto es normal.** Significa que:
- El producto no está publicado en Mercado Libre, o
- Está publicado pero con título/fotos muy distintos, o
- La imagen que subiste no es suficientemente clara

**Qué probar:**
- Asegurate que la imagen muestre bien el producto (sin fondo muy cargado)
- Si el producto tiene marca/modelo, asegurate que se vea en la foto
- Probá con otra foto del mismo producto desde otro ángulo

### La imagen no se pega con Ctrl+V

**Causas comunes:**
- El navegador no soporta Clipboard API (probá con Chrome/Edge/Firefox actualizados)
- No tenés una imagen en el portapapeles (hacé Print Screen primero)
- Estás en modo incógnito (algunos navegadores bloquean clipboard ahí)

**Alternativa:** Usá "Elegir archivo" o arrastrá la imagen.

---

## Costos aproximados

### Vercel (hosting)
- **Gratis** hasta 100GB bandwidth/mes
- Si pasás ese límite (muy difícil con uso personal): ~USD 20/mes

### Google AI Studio (IA)
- **100% GRATIS**
- Límite: 1,500 requests por día
- Cada análisis usa ~2 requests → **~750 búsquedas/día GRATIS**
- Sin tarjeta de crédito, sin cargos ocultos

**Total estimado:** **USD 0/mes** 🎉

---

## Limitaciones conocidas

1. **No busca por imagen directamente en ML** — Mercado Libre no tiene API de búsqueda visual. Lo que hacemos es extraer atributos con IA y generar búsquedas de texto inteligentes, después comparar visualmente los candidatos.

2. **Productos muy genéricos dan más falsos positivos** — Si buscás "vaso transparente redondo" sin marca, vas a ver muchos candidatos parecidos que no son exactamente el mismo modelo. Para esos casos, revisá manualmente. Gemini 2.0 Flash es más "optimista" que Claude, así que filtrá con criterio.

3. **Depende de la calidad de la imagen** — Fotos borrosas, con mucho fondo, mal iluminadas → peor precisión.

4. **Catálogos/lotes no están en esta versión** — Por ahora solo podés analizar 1 imagen a la vez. La versión con procesamiento de catálogos completos viene en Tanda 2.

5. **No exporta a Excel todavía** — También viene en Tanda 2.

6. **No hay historial persistente** — Si recargás la página, perdés los resultados. Tanda 2 agrega base de datos.

7. **Límite de 1,500 requests/día** — Muy generoso (750 búsquedas), pero existe. Si lo superás, esperá al día siguiente.

---

## Soporte

Si algo no funciona:

1. Revisá esta sección de Troubleshooting
2. Verificá los logs en Vercel (Deployments → Function Logs)
3. Revisá que la API key de Anthropic esté bien configurada y tenga crédito

---

## Próximos pasos (Tanda 2)

- ✅ Historial de búsquedas (con base de datos)
- ✅ Caché por hash (no volver a procesar la misma imagen)
- ✅ Export a Excel
- ✅ Procesamiento de catálogos/lotes (PDF, múltiples imágenes)
- ✅ Cola de procesamiento (para no explotar límites con lotes grandes)

---

## Estructura del proyecto

```
mlfinder/
├── app/
│   ├── page.tsx              # UI principal (Ctrl+V, resultados)
│   ├── layout.tsx            # Layout de Next.js
│   ├── globals.css           # Estilos
│   └── api/
│       ├── analyze/route.ts  # POST /api/analyze - endpoint principal
│       └── health/route.ts   # GET /api/health - diagnóstico
├── lib/
│   ├── types.ts              # Tipos TypeScript compartidos
│   ├── claude.ts             # Cliente Anthropic + manejo de errores
│   ├── meli.ts               # Cliente API Mercado Libre
│   ├── pipeline.ts           # Pipeline completo de análisis
│   └── scoring.ts            # Scoring y clasificación
├── package.json
├── tsconfig.json
├── next.config.js
├── vercel.json               # Config de timeouts para Vercel
└── README.md                 # Este archivo
```

---

## Licencia

Proyecto privado para uso personal.
