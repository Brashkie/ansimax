<div align="center">

<img src="media/ansimax.png" alt="Logo de Ansimax" width="380"/>

### La librería definitiva de renderizado CLI para Node.js

_Colores • Gradientes • Animaciones • ASCII Art • Pixel Art • Árboles • Componentes • Temas_

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![npm](https://img.shields.io/badge/npm-v1.1.0-cb3837.svg?style=flat-square)](https://www.npmjs.com/package/ansimax)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg?style=flat-square)](tsconfig.json)
[![Coverage](https://img.shields.io/badge/coverage-98%25-brightgreen.svg?style=flat-square)](#testing)
[![Tests](https://img.shields.io/badge/tests-1700%2B%20passing-brightgreen.svg?style=flat-square)](#testing)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen.svg?style=flat-square)](#)
[![Bundle](https://img.shields.io/badge/bundle-%3C100kb-brightgreen.svg?style=flat-square)](#)

[English](README.md) · **Español**

</div>

---

## 🌟 ¿Qué es Ansimax?

Ansimax es una **librería de renderizado todo-en-uno** para construir interfaces de terminal hermosas en Node.js. Un solo paquete reemplaza un stack de más de 8 dependencias — colores, gradientes, ASCII art, spinners, barras de progreso, tablas, menús, árboles, temas, pixel art — combinadas en una única API coherente de TypeScript con **cero dependencias en runtime**.

```bash
npm install ansimax
```

```ts
import { color, gradient, ascii, loader } from 'ansimax';

console.log(ascii.banner('hola', {
  colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9', '#8be9fd']),
}));

const stop = loader.spin('Construyendo proyecto', { color: '#bd93f9' });
await algunaTareaAsync();
stop('Build completado', true);
```

---

## 💡 ¿Por qué Ansimax?

| Sin Ansimax | Con Ansimax |
|---|---|
| Instalar 8+ paquetes: `chalk`, `gradient-string`, `figlet`, `ora`, `cli-progress`, `cli-table3`, `boxen`, `inquirer` | Una sola instalación: `ansimax` |
| Mezclar APIs incompatibles, paradigmas diferentes, tipos en conflicto | API funcional consistente, fuente única de verdad |
| Sin sistema de temas coherente entre paquetes | Temas integrados (Dracula, Nord, Matrix, Cyberpunk, +5) |
| Limpieza manual del cursor, sin protección ante crashes | Cursor con conteo de referencias + handlers de crash integrados |
| Sin soporte de `AbortSignal` en la mayoría de libs CLI | Toda animación, loader y prompt es abortable |
| Cada lib trae su propia lógica de fallback en runtime | `NO_COLOR` / `FORCE_COLOR` / detección de TTY unificada |
| Sin límites de memoria en cachés de color | Cachés LRU acotadas en todo el código (sin fugas bajo carga) |

---

## 🆚 Comparación con el ecosistema Node.js

Ansimax reemplaza un stack de dependencias de librerías populares de Node.js con un solo paquete coherente y tipado:

| Característica | chalk | gradient-string | ora | cli-progress | figlet | boxen | inquirer | cli-table3 | **Ansimax** |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Colores básicos + 256 | ✅ | — | — | — | — | — | — | — | ✅ |
| Truecolor con fallback adaptativo | ✅ | ✅ | — | — | — | — | — | — | ✅ |
| Gradientes multi-stop | — | ✅ | — | — | — | — | — | — | ✅ |
| **Gradientes animados** | — | — | — | — | — | — | — | — | 🔜 |
| Banners ASCII | — | — | — | — | ✅ | — | — | — | ✅ |
| Registro de fuentes personalizadas | — | — | — | — | parcial | — | — | — | ✅ |
| Cajas con múltiples estilos | — | — | — | — | — | ✅ | — | — | ✅ |
| Spinners (varios estilos) | — | — | ✅ | — | — | — | — | — | ✅ (11 estilos) |
| Barras de progreso animadas | — | — | — | ✅ | — | — | — | — | ✅ |
| **Tareas jerárquicas/paralelas** | — | — | — | — | — | — | — | — | ✅ |
| Tablas (multi-línea, conscientes de ANSI) | — | — | — | — | — | — | — | ✅ | ✅ |
| Menús interactivos + multi-select | — | — | — | — | — | — | ✅ | — | ✅ |
| **Árboles con detección de ciclos** | — | — | — | — | — | — | — | — | ✅ |
| **Pixel art + canvas + sprites** | — | — | — | — | — | — | — | — | ✅ |
| **Sistema de temas + aislamiento por instancia** | — | — | — | — | — | — | — | — | ✅ |
| `AbortSignal` en todas partes | — | — | parcial | — | — | — | parcial | — | ✅ |
| Soporte de `NO_COLOR` | ✅ | parcial | parcial | — | — | — | — | — | ✅ |
| TypeScript-first | parcial | parcial | ✅ | parcial | parcial | ✅ | parcial | parcial | ✅ |
| Cero dependencias en runtime | ✅ | — | — | — | — | — | — | — | ✅ |
| **Tamaño total de instalación** | pequeño | pequeño | medio | medio | medio | pequeño | grande | medio | **< 100 KB** |

---

## 📦 Instalación

```bash
npm install ansimax
# o
pnpm add ansimax
# o
yarn add ansimax
```

**Requisitos:** Node.js ≥ 18. Soporta ESM y CJS. Los ejemplos se publican junto con el paquete — ver [`/examples`](./examples).

---

## ⚡ Ejemplo en 30 segundos

```ts
import { color, gradient, loader, ascii } from 'ansimax';

console.log(ascii.banner('deploy', {
  colorFn: (t) => gradient(t, ['#ff6b6b', '#feca57', '#48dbfb']),
}));

const stop = loader.spin('Construyendo proyecto', { color: '#bd93f9' });
await algunaTareaAsync();
stop('Build completado', true);  // ✓ + color de éxito

console.log(color.green('✓') + ' Listo en ' + color.bold('1.4s'));
```

---

## 🚀 Inicio rápido

```ts
import { configure, color, themes, gradient } from 'ansimax';

// Configuración global
configure({ theme: 'dracula', animationSpeed: 'normal' });

// Estilos básicos
console.log(color.red('error'));
console.log(color.bold(color.cyan('importante')));

// Gradiente multi-stop
console.log(gradient('texto arcoiris', [
  '#ff5555', '#ffaa00', '#ffff00',
  '#00ff00', '#0099ff', '#cc44ff',
]));

// Cambiar tema — dispara los subscribers
themes.use('cyberpunk');
console.log(themes.primary('primary de cyberpunk'));
```

---

## ✨ Características

- 🎨 **Colores** — Truecolor / 256 / básico con fallback adaptativo. Detección de NO_COLOR / FORCE_COLOR / TTY
- 🌈 **Gradientes** — Lineales multi-stop, radiales, diagonales, ángulo arbitrario. Presets personalizados vía `registerPreset`
- 🔠 **ASCII Art** — Banners (fuentes `big`/`small`), cajas (6 estilos), divisores, logos. API de stream + registro de fuentes
- 🖼️ **Pixel Art** — Sprites, alpha blending, gradientes con dithering, canvas con renderizado dirty-rect, modo braille (sub-pixel 2×4)
- 🌳 **Árboles** — API builder + data plana, 4 estilos, colores/iconos por nodo, max-depth, detección de ciclos, algoritmos walk/find/map/filter
- 🎞️ **Animaciones** — Typewriter, fade, slide, pulse, wave, glitch, reveal. Conscientes de AbortSignal, modo reducedMotion
- ⏳ **Loaders** — 11 estilos de spinner, barras animadas, tareas jerárquicas/paralelas, cuentas regresivas, gestor multi-spinner
- 🎬 **Frames** — Reproducción secuenciada con pause/resume/seek, renderizador live push-based, timing con corrección de drift, morph
- 🧱 **Componentes** — Tablas (conscientes de ANSI, celdas multi-línea), badges, líneas de estado, secciones, columnas, timelines, menús interactivos
- 🎨 **Temas** — 8 built-in (Dracula, Nord, Monokai, Cyberpunk, Pastel, Matrix, Ocean, Sunset). Aislamiento por instancia, listeners `onChange`, helpers `bg*`
- ⚙️ **Configure** — Config centralizada con subscribers, updates batched, overrides temporales con `withConfig()`, modo strict
- 🛠️ **Utils** — Primitivas ANSI, control del cursor, hyperlinks de terminal (OSC 8), `setTitle`, `safeJson`, `onResize`, debounce/throttle/memoize

---

## 📸 Showcase

### Colores y Gradientes

<img src="media/colors.png" alt="Colores y gradientes" />

```ts
import { color, gradient } from 'ansimax';

color.red('rojo');   color.green('verde');  color.blue('azul');
color.bold(texto);   color.italic(texto);    color.underline(texto);
gradient('fuego a océano', ['#ff6b6b', '#feca57', '#48dbfb']);
color.rainbow('preset rainbow integrado');
```

### ASCII Art

<img src="media/ascii_art.png" alt="ASCII art" />

```ts
import { ascii, gradient } from 'ansimax';

ascii.banner('HOLA', {
  font: 'big',
  align: 'center',
  colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9']),
});

ascii.box('¡Caja arcoiris!', { padding: 1, borderStyle: 'rounded' });
```

### Árboles

<img src="media/trees.png" alt="Árboles" />

```ts
import { tree, color } from 'ansimax';

const proyecto = tree({ label: 'mi-app', icon: '📦', color: color.bold });
const src = proyecto.add({ label: 'src', icon: '📁' });
src.addLeaf({ label: 'index.ts', icon: '📄' });
src.addLeaf({ label: 'app.ts',   icon: '📄' });

console.log(proyecto.render({
  style: 'rounded',
  palette: [color.cyan, color.green, color.magenta],
  guideColor: color.dim,
}));
```

### Pixel Art y Canvas

<img src="media/pixel_art.png" alt="Pixel art" />

```ts
import { images, createCanvas, gradientRect } from 'ansimax';

// Sprite integrado
console.log(images.sprite('heart'));

// Gradiente suave con dither Bayer
console.log(gradientRect({
  width: 50, height: 4,
  colors: ['#ff6b6b', '#feca57', '#48dbfb'],
  dither: 'bayer',
}));

// Canvas personalizado
const c = createCanvas(40, 10);
c.fill({ r: 18, g: 18, b: 38 });
c.drawCircle(20, 5, 4, { r: 255, g: 200, b: 0 }, true);
c.drawSprite(2, 2, images.sprites.star!.pixels);
c.print();
```

### Componentes

<img src="media/components.png" alt="Componentes" />

```ts
import { components, color } from 'ansimax';

components.table([
  ['Módulo',     'Estado',                'Cobertura'],
  ['colors',     color.green('● listo'),  '100%'],
  ['animations', color.green('● listo'),  '100%'],
  ['loaders',    color.green('● listo'),  '100%'],
], { borderStyle: 'rounded' });

components.badge('VERSION', 'v1.1.0');
components.badge('BUILD',   'passing');
```

### Timeline

<img src="media/timeline.png" alt="Timeline" />

```ts
components.timeline([
  { label: 'Init del proyecto', done: true,  time: '10:00' },
  { label: 'Pipeline de build', done: true,  time: '10:15' },
  { label: 'Correr tests',      done: false, time: '10:32' },
  { label: 'Deploy a npm',      done: false },
]);
```

### Loaders y Progreso

```ts
import { loader } from 'ansimax';

// Spinner con éxito/fallo
const stop = loader.spin('Cargando...', { color: '#bd93f9' });
await tarea();
stop('¡Listo!', true);   // ✓ ícono verde

// Barra de progreso animada
await loader.progressAnimate(100, 'Descargando', {
  color: '#50fa7b', delay: 25,
});

// Tareas jerárquicas con ejecución paralela
await loader.tasks([
  { text: 'Build', fn: async () => build(), subtasks: [
    { text: 'TypeScript', fn: async () => tsc() },
    { text: 'Bundle',     fn: async () => bundle() },
  ]},
  { text: 'Test',  fn: async () => test() },
], { parallel: true });
```

### Animaciones

```ts
import { animate, gradient } from 'ansimax';

await animate.typewriter('Bienvenido al wizard de deployment...', {
  speed: 30,
  colorFn: (t) => gradient(t, ['#bd93f9', '#ff79c6']),
});

await animate.fadeIn('Carga completa', { duration: 600 });

// Carrera de pasos contra timeout — nunca se cuelga
await animate.parallel([
  async () => await checkNetwork(),
  async () => await checkDatabase(),
  async () => await checkAuth(),
], { timeout: 5000 });
```

### Temas

<img src="media/themes.png" alt="Temas" />

```ts
import { themes, createTheme } from 'ansimax';

// Temas built-in
themes.use('dracula');
themes.primary('hola');

// Escuchar cambios
const off = themes.onChange((nuevo, anterior) => {
  console.log(`Tema: ${anterior.name} → ${nuevo.name}`);
});

// Multi-tenant: cada instancia totalmente aislada
const tenantA = createTheme('nord');
const tenantB = createTheme('matrix');
tenantA.register('custom', miDef);  // no se filtra a tenantB
```

---

## 📚 Ejemplos

Siete ejemplos de calidad de producción se publican en el paquete npm y son ejecutables directamente. Los encuentras en [`/examples`](./examples) después de instalar:

| Archivo | Qué demuestra |
|---|---|
| `trees-basic.ts` | Ejemplo mínimo de árboles — API builder + algoritmos |
| `01-cli-installer.ts` | Instalador estilo npm-create — banner + tareas jerárquicas + íconos de estado + caja resumen |
| `02-live-dashboard.ts` | Dashboard en tiempo real — `frames.live` + tabla de servicios + barras con gradiente + `onResize` + limpieza SIGINT |
| `03-pixel-art-game.ts` | Sprite de cohete rebotando — canvas + alpha blending + gradiente + contador de FPS + loop con corrección de drift |
| `04-interactive-deploy.ts` | Menú + multi-select + `loader.multi` + `createTheme` + `onConfigChange` |
| `05-tree-visualizations.ts` | Árboles de filesystem + dependencias + JSON + decisión (`walk` + `measure` extra) |
| `06-everything-together.ts` | Showcase completo — cada módulo ejercitado en un demo cohesivo |

Ejecuta cualquier ejemplo con:
```bash
npx tsx examples/06-everything-together.ts
```

---

## 🎯 Casos de uso

- **Instaladores y scaffolders CLI** — hermosa experiencia de primer arranque (estilo create-react-app, create-next-app)
- **Herramientas DevOps** — dashboards de deployment, pipelines de build, monitores de salud
- **Dev experience** — mejores test runners, output de lint, formateo de errores
- **Prompts interactivos** — menús, confirmaciones, wizards multi-select
- **Exploración de datos** — tablas, árboles, charts para workflows terminal-first
- **Reportes de estado** — progreso en tiempo real, orquestación multi-tarea
- **Intros ASCII** — launchers de juego, splash screens, banners de login

---

## ⚙️ Configuración

La config global afecta cada módulo que la respeta (colores, temas, velocidad de animación, etc.):

```ts
import { configure, getConfig, withConfig, onConfigKeyChange } from 'ansimax';

configure({
  colorMode:      'auto',     // 'none' | 'basic' | '256' | 'truecolor' | 'auto'
  animationSpeed: 'normal',   // 'slow' | 'normal' | 'fast' | 'instant'
  theme:          'dracula',  // cualquier tema registrado
  reducedMotion:  false,
});

// Escuchar cambios (por-key — evita disparos excesivos)
const off = onConfigKeyChange('theme', (nuevo, anterior) => {
  console.log(`Tema: ${anterior} → ${nuevo}`);
});

// Override temporal + restauración automática al completar o lanzar
await withConfig({ animationSpeed: 'fast' }, async () => {
  await correrDemo();
});

// Modo strict captura typos en config
configure({ unknwnKey: 'x' }, { strict: true });  // lanza RangeError
```

---

## 🛣️ Roadmap

Ansimax se está construyendo hacia una **plataforma completa de renderizado de terminal** — una respuesta nativa de Node a lo que los desarrolladores de Python obtienen de `rich` + `textual` combinados, con mejoras específicas de Node donde importa.

El roadmap apunta intencionalmente — y busca superar — gaps que ni siquiera librerías TUI maduras de Python han resuelto completamente: renderers live-diff, gradientes animados, protocolos de imágenes en terminal, y una verdadera capa reactiva.

### ✅ Fase 1 — Fundamento core
- [x] Motor de estilos — ANSI 16 / 256 / truecolor con fallback adaptativo
- [x] Helpers Hex + RGB con clamping y validación
- [x] Soporte `NO_COLOR` / `FORCE_COLOR` + auto-detección no-TTY
- [x] Integración de `AbortSignal` en animaciones y loaders
- [x] Stacking de estilos `compose()` con emisión single-reset
- [x] Caché LRU acotada de escapes (512 entradas, key packed-RGB)
- [x] Registro de presets personalizados (`registerPreset`, `listPresets`)

### ✅ Fase 2 — Motor de gradientes
- [x] Gradientes lineales (multi-stop)
- [x] Rainbow + 6 presets built-in
- [x] Gradientes radiales (en `gradientRect`)
- [x] Gradientes diagonales
- [x] Gradientes a ángulo arbitrario
- [x] Dithering Bayer 4×4 para transiciones tonales suaves
- [x] UX single-stop (comportamiento estilo CSS)
- [ ] **Gradientes animados** (flujo de color en el tiempo, loops infinitos)
- [ ] **Curvas de interpolación** (linear / ease-in / ease-out / cubic-bezier)
- [ ] **Gradientes cónicos** (barrido radial)

### 🟡 Fase 3 — Motor ASCII
- [x] Fuentes de bloque (`big`, `small`)
- [x] Banner con gradiente + alineación + coloreado por carácter
- [x] Dibujo de cajas (6 estilos de borde)
- [x] Divisores con variantes de estilo
- [x] Compositor de logos (gradiente + box wrapping)
- [x] Registro de fuentes personalizadas (`registerFont`, `hasFont`, `listFonts`)
- [x] API de stream (`ascii.stream()` con AbortSignal)
- [ ] **Conversor Imagen → ASCII** (con detección de bordes, Sobel/Canny)
- [ ] **Renderizado ASCII en color** (preservar colores de imagen)
- [ ] **Dithering de imágenes** para mejor rango tonal (Floyd-Steinberg)
- [ ] **ASCII optimizado para rostros** (modo de alto detalle para retratos)
- [ ] **Soporte de fuentes figlet** (loader de archivos `.flf` — 250+ fuentes de comunidad)

### ✅ Fase 4 — Primitivas TUI
- [x] Tablas (filas irregulares, celdas multi-línea, conscientes de ANSI)
- [x] Cajas con múltiples estilos
- [x] Mensajes de estado + badges (con opción de borde)
- [x] Timelines con estados done/pending
- [x] Menús interactivos (single + multi-select)
- [x] Layout de columnas (overflow truncate/wrap)
- [x] Secciones (cabeceras con gradiente, ancho automático)
- [x] Árboles (colapsables, max-depth, cycle-safe)
- [ ] **Panels** (split layouts: hsplit, vsplit)
- [ ] **Layouts** (posicionamiento estilo flexbox)
- [ ] **Sistema de grid** (spans column/row inspirados en CSS Grid)
- [ ] **Renderizado de Markdown** (headings, listas, code blocks, tablas)
- [ ] **Syntax highlighting** (gramáticas integradas)
- [ ] **Pretty-printing JSON/YAML** (con límite de profundidad + collapse)
- [ ] **Integración de logging** (drop-in para `console`/`pino`/`winston`)

### ✅ Fase 5 — Control de cursor y pantalla
- [x] Visibilidad de cursor, save/restore, posicionamiento, navegación por líneas
- [x] Limpieza de pantalla (línea, área, completa)
- [x] Cursor con conteo de referencias (calls superpuestas son seguras)
- [x] Restauración crash-safe (handlers de exit/SIGINT/SIGTERM)
- [x] Hyperlinks de terminal (OSC 8)
- [x] Título de ventana (OSC 2)
- [x] Bell (BEL)

### ✅ Fase 6 — Motor de animaciones
- [x] Typewriter, fadeIn, fadeOut, slide, pulse, wave, glitch, reveal
- [x] Conscientes de `AbortSignal`
- [x] Modo `reducedMotion` para accesibilidad
- [x] Frame morph (interpolación texto → texto, descifrado cinematográfico)
- [x] `parallel()` con timeout
- [x] Propagación de signal a animaciones anidadas
- [ ] **Librería de funciones easing** (24 easings estándar: cubic, elastic, bounce, back)
- [ ] **Composición de animaciones** (DSL `parallel + sequence + delay`)
- [ ] **Animaciones con física de spring** (estilo `react-spring`)
- [ ] **Motor de tween** (interpolar cualquier tipo de valor)

### 🟡 Fase 7 — Ecosistema de progreso
- [x] Spinners (11 estilos) con color + AbortSignal
- [x] Barras de progreso animadas
- [x] Runners multi-tarea (secuencial + paralelo)
- [x] Cuentas regresivas
- [x] Manager multi-spinner (spinners concurrentes apilados)
- [x] Tareas jerárquicas (rollup padre + subtareas)
- [ ] **Estimación live de ETA** (rolling average + proyección con filtro de Kalman)
- [ ] **Refresh live con diff renderer** (sin flicker, solo redibujar líneas cambiadas)
- [ ] **Grupos de progreso** (grupos con nombre y tema compartido)
- [ ] **Medidores de throughput** (bytes/s, ops/s con unidades auto-escaladas)

### 🟡 Fase 8 — Detección de capacidades
- [x] Detección de TTY (auto-desactivar en pipes/CI)
- [x] Soporte de env `NO_COLOR` / `FORCE_COLOR`
- [x] Detección de profundidad de color (16 / 256 / truecolor)
- [x] Detección de proveedor CI (GitHub Actions, CircleCI, GitLab, Buildkite, Drone, Travis)
- [x] Detección de programa de terminal (iTerm, vscode, WezTerm, Hyper, Apple_Terminal)
- [x] Detección de Windows Terminal (`WT_SESSION`)
- [ ] **Detección de ancho Unicode** (CJK halfwidth/fullwidth, clusters de emoji, ZWJ)
- [ ] **Detección de protocolos de imagen** (Sixel, imágenes inline de iTerm, protocolo de Kitty)
- [ ] **Base de datos de capacidades de terminal** (flags xterm completos + probes de versión)
- [ ] **Detección de métricas de fuente** (ancho/alto de celda para layouts pixel-accurate)

### 🟡 Fase 9 — Renderizado avanzado
- [x] Canvas dirty-rectangle (solo redibujar píxeles cambiados)
- [x] Cachés LRU acotadas (escape sequences, render cache, ANSI cache)
- [x] Timing con corrección de drift (animaciones permanecen pegadas al reloj)
- [ ] **Diff renderer** (damage tracking a nivel de línea para UIs completas)
- [ ] **Buffer virtual** (componer UI sin escribir a stdout)
- [ ] **Z-index / layering** (overlapping de paneles con prioridad)
- [ ] **Soporte de eventos de mouse** (click, hover, drag, scroll)
- [ ] **Abstracción de eventos de teclado** (flechas, modificadores, secuencias, dead keys)
- [ ] **Framework TUI completo** (componentes reactivos — equivalente a Textual para Node)

### 🔴 Fase 10 — Charts de terminal
- [ ] Barras (horizontal + vertical, agrupadas, apiladas)
- [ ] Líneas (con braille para resolución sub-carácter)
- [ ] Sparklines (mini-charts inline para status bars)
- [ ] Áreas (rellenas con gradientes)
- [ ] Heatmaps (grids 2D color-mapped)
- [ ] Pie / donut (con etiquetas de porcentaje)
- [ ] Scatter plots
- [ ] Box plots / candlestick
- [ ] Charts en streaming en tiempo real (feed de datos con ventana móvil)
- [ ] **Compositor de plots** (dashboards multi-chart con ejes compartidos)

### 🔴 Fase 11 — Formularios e input
- [ ] Prompts de texto (con autocomplete + historial)
- [ ] Prompts de password (mascarados, medidor de fortaleza)
- [ ] Diálogos de confirmación (yes/no con highlight de default)
- [ ] Input numérico (con validación min/max)
- [ ] Pickers de fecha/hora (widget calendario)
- [ ] Picker de archivos (navegador de filesystem)
- [ ] Compositor de formularios (multi-campo con validación + display de errores)
- [ ] **Flujos de wizard** (formularios multi-paso con back/forward, indicador de progreso)

### 🔴 Fase 12 — Imagen y media
- [ ] Renderizado de imágenes Sixel (xterm, mlterm, WezTerm)
- [ ] Imágenes inline de iTerm2 (protocolo base64)
- [ ] Protocolo gráfico de Kitty
- [ ] PNG/JPEG → imagen de terminal (auto-detecta mejor protocolo)
- [ ] Preview de video (frame-por-frame a bajo FPS)
- [ ] Generación de códigos QR (con opciones de tamaño + nivel ECC)
- [ ] Generación de códigos de barras (Code 128, EAN-13)

### 🔴 Fase 13 — Sistema de plugins
- [ ] API de plugins para componentes personalizados
- [ ] Marketplace de temas
- [ ] Registro de fuentes personalizadas vía paquetes npm
- [ ] Registro de animaciones de la comunidad
- [ ] Interfaz de proveedor de capabilities (plug-in para detectores propios)
- [ ] Plugins de renderer (cambiar stdout por cualquier writable stream)

### 🔴 Fase 14 — Capa reactiva (framework TUI)
- [ ] **Ciclo de vida de componentes** (hooks mount/unmount/update)
- [ ] **Estado reactivo** (auto re-render al cambiar data, signals o hooks)
- [ ] **Diffing de Virtual DOM** (updates a nivel de línea)
- [ ] **Event bus** (comunicación entre componentes)
- [ ] **Loop de aplicación** (árbol de render único con ciclo de vida completo)
- [ ] **Routing** (apps multi-pantalla con historial)
- [ ] **Integración DevTools** (inspector de árbol de componentes, mark de nodos cambiados)
- [ ] **CSS-in-TS styling** (estilos con scope por componente)

**Leyenda:** ✅ Completo · 🟡 Parcial · 🔴 Planeado

---

## 🧪 Testing

```bash
npm test              # Correr todos los 1700+ tests
npm run test:watch    # Modo watch
npm run test:coverage # Reporte de cobertura
```

Targets de cobertura:
- Statements: **98%**
- Branches: **95%**
- Functions: **99%**
- Lines: **99%**

---

## 🛠️ Requisitos

- **Node.js** ≥ 18
- **TypeScript** ≥ 5.0 (para consumo tipado — opcional)
- **Terminal** con soporte truecolor recomendado (Windows Terminal, iTerm2, WezTerm, Kitty, xterm moderno). Degrada gracefully a 256 / 16 / sin-color.

---

## 🏗️ Estructura del proyecto

```
ansimax/
├── src/
│   ├── colors/         Renderizado de color + motor de gradientes
│   ├── themes/         Sistema de temas + 8 built-ins
│   ├── ascii/          Banners, cajas, fuentes
│   ├── animations/     Typewriter, fade, slide, pulse, wave, glitch, reveal
│   ├── loaders/        Spinners, progreso, tareas, multi-loader
│   ├── frames/         Reproducción secuenciada + renderer live + morph
│   ├── components/     Tablas, badges, status, timelines, menús
│   ├── images/         Sprites, canvas, gradientes con dither
│   ├── trees/          Builder de árboles + algoritmos
│   ├── utils/          Primitivas ANSI + helpers
│   └── configure.ts    Config global + subscribers
├── examples/           7 ejemplos de calidad de producción
└── __tests__/          16 test suites, 1700+ tests
```

---

## 📝 Changelog

### v1.1.0 — Hardening exhaustivo + nuevas features

Una pasada masiva de robustez sobre todo módulo, más un nuevo módulo `trees`. **100% retrocompatible** — toda API existente funciona idéntica.

**Highlights:**

- 🌳 **Nuevo módulo `trees`** — API builder + API data-plana, 4 estilos, detección de ciclos, algoritmos (`walk`, `find`, `count`, `map`, `filter`)
- ⚙️ **Mejoras de `configure.ts`** — `onConfigKeyChange`, `pauseListeners` / `resumeListeners`, `withConfig()`, modo strict
- 🎨 **Themes** — aislamiento por instancia (multi-tenant safe), `tryUse`, listeners `onChange`, `unregister`, helpers `bg*`, accesor dinámico `style(name)`
- 🌈 **Colors** — `registerPreset` / `listPresets`, caché LRU acotada, RGB safe ante NaN/Infinity, UX de gradient single-stop
- 🖼️ **Images** — `Pixel` / `PixelGrid` exportados, deep-clone en `canvas.pixels`, coords defensivas, caché ANSI LRU acotada
- 🔠 **ASCII** — `hasFont`, `measure`, `stream` con AbortSignal, grapheme-aware
- 🎞️ **Frames** — cursor con conteo de refs, restauración crash-safe, `repeat: 0` = infinito, fps cap a 60, corrección de drift
- 🧱 **Components** — `menu([])` retorna `MENU_CANCELLED` (no throw), inputs numéricos defensivos en todas partes
- 🛠️ **Utils** — `setTitle`, `link` (hyperlinks OSC 8), `bell`, `safeJson` (BigInt + circular), `once`, `escapeRegex`, `padBoth`, `nextTick`, `memoize` con keyFn personalizado, `debounce` con `maxWait`, `onResize` con throttle
- 🧪 **Tests** — ~1700+ tests en 16 suites, todos verdes, ~98% de cobertura

Ver [CHANGELOG.md](CHANGELOG.md) para el historial completo de versiones con desglose por módulo.

### v1.0.0 — Release inicial

- Módulos core: `color`, `animate`, `ascii`, `loader`, `frames`, `components`, `themes`, `images`, `configure`
- Tipos TypeScript exportados, build dual ESM + CJS
- Renderizado de color adaptativo (detección NO_COLOR / FORCE_COLOR / TTY)
- Soporte de `AbortSignal` en todas las APIs bloqueantes
- 750+ tests, 85%+ cobertura

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Áreas donde la ayuda es especialmente apreciada:

- Nuevos presets de animación (easings, física spring)
- Fuentes ASCII adicionales (parser de figlet `.flf`)
- Entradas en la base de capacidades de terminal
- Traducciones (fr, de, ja, ...)
- Apps de ejemplo del mundo real
- Implementaciones de charts (Fase 10)

Por favor lee [CONTRIBUTING.md](.github/CONTRIBUTING.md) para las guías.

---

## 🐛 Reportar issues

¿Encontraste un bug? ¿Tienes una sugerencia? [Abre un issue](https://github.com/Brashkie/ansimax/issues/new).

Para divulgaciones de seguridad, envía un email a [security@brashkie.dev](mailto:security@brashkie.dev) en lugar de abrir un issue público.

---

## ⭐ Apoyo

Si Ansimax te ahorra tiempo, por favor dale estrella al repo en [GitHub](https://github.com/Brashkie/ansimax) — ayuda al proyecto a crecer y acelera el roadmap.

---

## 👨‍💻 Autor

**Brashkie** · [@Brashkie](https://github.com/Brashkie)

---

## 📜 Licencia

[Apache License 2.0](LICENSE) © 2026 Brashkie

Ansimax está licenciada bajo **Apache License, Version 2.0** — una licencia permisiva que permite uso comercial, modificación, distribución, e incluye un grant explícito de patentes. Ver el archivo [LICENSE](LICENSE) para el texto completo.

---

**Keywords:** cli, terminal, ansi, colors, gradients, animation, spinner, ascii, ascii-art, pixel-art, progress-bar, loader, components, table, banner, theme, tree, trees, tui, typescript, nodejs, zero-dependencies, chalk, ora, boxen, figlet, inquirer

---

<div align="center">

**Construido con ❤️ y TypeScript**

Si Ansimax te ayuda a hacer mejores CLIs, ¡dale ⭐ en [GitHub](https://github.com/Brashkie/ansimax)!

</div>
