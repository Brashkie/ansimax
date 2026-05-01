<div align="center">

<img src="media/ansimax.png" alt="Ansimax" width="180"/>

# Ansimax

### La librería definitiva para crear interfaces de consola en Node.js

Colores • Gradientes • Animaciones • ASCII Art • Pixel Art • Componentes • Temas

[![status](https://img.shields.io/badge/status-unreleased-orange?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg?style=flat-square)](tsconfig.json)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg?style=flat-square)](#)
[![Tests](https://img.shields.io/badge/tests-750%2B%20passing-brightgreen.svg?style=flat-square)](#)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen.svg?style=flat-square)](#)

[English](README.md) · **Español**

</div>

---

## 🎬 Vista previa en vivo

Mira Ansimax en acción — todas las animaciones y loaders corriendo en vivo:

### Animaciones

https://github.com/Brashkie/ansimax/raw/main/media/animations.mp4

### Loaders

https://github.com/Brashkie/ansimax/raw/main/media/loaders.mp4

> 💡 GitHub renderiza estos MP4 como reproductores de video integrados al subir el repo. O ejecútalos localmente con `npx tsx examples/animations.ts` y `npx tsx examples/loaders.ts`.

---

## 🌟 ¿Qué es Ansimax?

**Ansimax** es una librería moderna de Node.js, sin dependencias, que convierte tu terminal en un lienzo vibrante y dinámico. Combina colores ANSI avanzados, animaciones fluidas, ASCII art, pixel art, componentes interactivos y un sistema de temas — todo en un único paquete escrito en TypeScript estricto y con tipos completos.

Diseñada para desarrolladores que quieren publicar CLIs que **se sientan** profesionales.

---

## 💡 ¿Por qué Ansimax?

- ⚡ **Cero dependencias** — sin bloat, sin vulnerabilidades transitivas, sin conflictos de versiones
- 🎯 **Una librería en lugar de 10** — reemplaza `chalk` + `ora` + `cli-table3` + `figlet` + `gradient-string` y más
- 🎨 **Truecolor de 24 bits + gradientes** out of the box — fallback automático a 256/16 cuando hace falta
- 🧠 **Pensada para CLIs reales** — soporte de `AbortSignal`, cumple `NO_COLOR`, consciente de TTY
- 🛡️ **100% de cobertura de tests** — más de 750 tests en cada módulo
- 📘 **TypeScript primero** — modo estricto, tipos completos, cero `any`

---

## 🆚 Comparación

| Característica         | **Ansimax** | chalk | ora  | cli-table3 | figlet | gradient-string |
|------------------------|-------------|-------|------|------------|--------|-----------------|
| 16 colores             | ✅          | ✅    | ➖   | ➖         | ➖     | ➖              |
| 256 colores            | ✅          | ✅    | ➖   | ➖         | ➖     | ➖              |
| Truecolor (24 bits)    | ✅          | ✅    | ➖   | ➖         | ➖     | ✅              |
| Gradientes             | ✅          | ❌    | ❌   | ❌         | ❌     | ✅              |
| Animaciones            | ✅          | ❌    | ❌   | ❌         | ❌     | ❌              |
| Spinners               | ✅          | ❌    | ✅   | ❌         | ❌     | ❌              |
| Barras de progreso     | ✅          | ❌    | ❌   | ❌         | ❌     | ❌              |
| Tablas                 | ✅          | ❌    | ❌   | ✅         | ❌     | ❌              |
| ASCII art / banners    | ✅          | ❌    | ❌   | ❌         | ✅     | ❌              |
| Pixel art / canvas     | ✅          | ❌    | ❌   | ❌         | ❌     | ❌              |
| Temas                  | ✅          | ❌    | ❌   | ❌         | ❌     | ❌              |
| Soporte de AbortSignal | ✅          | ❌    | ❌   | ❌         | ❌     | ❌              |
| Cero dependencias      | ✅          | ❌    | ❌   | ❌         | ❌     | ❌              |

> Ansimax reemplaza más de 5 paquetes separados con una sola librería sin dependencias.

---

## 📦 Instalación

```bash
npm install ansimax
```

```bash
yarn add ansimax    # Yarn
pnpm add ansimax    # PNPM
bun add ansimax     # Bun
```

**Requiere Node.js >= 18**

---

## ⚡ Ejemplo de 30 segundos

```ts
import { color } from 'ansimax';

console.log(color.green('Hola mundo'));
```

Eso es todo. Sin config, sin setup. ¿Quieres más? Sigue leyendo.

---

## 🚀 Inicio rápido

```ts
import { color, animate, loader, ascii, components, gradient } from 'ansimax';

// Colores con estilos apilados (un solo reset ANSI, sin anidamiento)
console.log(color.bold(color.cyan('¡Hola, terminal!')));

// Texto con gradiente
console.log(gradient('Flujo de color suave', ['#ff6b6b', '#feca57', '#48dbfb']));

// Typewriter animado
await animate.typewriter('Bienvenido a Ansimax...', { speed: 50 });

// Spinner con estado de éxito
const stop = loader.spin('Construyendo proyecto...', { color: '#00ff88' });
await hacerTrabajo();
stop('Construido con éxito', true);

// Banner ASCII
console.log(ascii.banner('ANSIMAX', { font: 'big', align: 'center' }));

// Tabla como componente
console.log(components.table([
  ['Nombre', 'Estado'],
  ['Build',  '✓ listo'],
], { header: true, borderStyle: 'rounded' }));
```

---

## ✨ Características

| Módulo | Capacidades |
|---|---|
| 🎨 **Colores** | 16 colores · 256 colores · truecolor de 24 bits · hex · RGB · `compose()` para apilar estilos · soporta `NO_COLOR` |
| 🌈 **Gradientes** | Lineales · multi-stop · arcoíris · rectángulos de gradiente (horizontal, vertical, diagonal, radial) |
| ⚡ **Animaciones** | typewriter · fadeIn · fadeOut · slide · pulse · wave · glitch · reveal — todas con `AbortSignal` |
| 🔄 **Loaders** | 11 estilos de spinner · barras de progreso animadas · ejecución de tareas (secuencial y paralela) · countdowns |
| 🖼️ **ASCII Art** | Dos fuentes · `box()` con 6 estilos de borde · separadores ANSI-aware · banners con gradiente |
| 🎬 **Frames** | Motor de frames · render en vivo · barras de carga · pelota rebotando · **morph** (texto→texto) |
| 🧩 **Componentes** | Tablas · mensajes de estado · badges · barras de progreso · timelines · menús interactivos (single/multi-select) |
| 🌃 **Temas** | 8 temas integrados (Dracula, Nord, Monokai, Cyberpunk, Pastel, Matrix, Ocean, Sunset) · temas personalizados |
| 🖌️ **Pixel Art** | Renderizado half-block · librería de sprites · API de canvas · transformaciones (flip, rotate) |
| 🛠️ **Utilidades** | `truncateAnsi` · `wordWrap` (con soft-break) · `repeatVisible` · `stripAnsi` · matemática de colores |

---

## 📸 Galería

### Colores y gradientes
<div align="center">
  <img src="media/colors.png" alt="Colores y gradientes" width="700"/>
</div>

```ts
import { color, gradient, rainbow, compose } from 'ansimax';

// 16, 256 y 24 bits
color.red('básico');                          // 16 colores
color.color256(196)('paleta');                // 256 colores
color.hex('#48dbfb')('truecolor');            // 24 bits
color.rgb(255, 100, 50)('personalizado');     // RGB

// Apila estilos con compose() — un solo reset, sin anidamiento
const errorStyle = compose(color.bold, color.red, color.underline);
console.log(errorStyle('ERROR CRÍTICO'));

// Gradientes con varios stops
gradient('Flujo suave', ['#ff6b6b', '#feca57', '#48dbfb']);
rainbow('¡Texto arcoíris!');
```

---

### ASCII Art
<div align="center">
  <img src="media/ascii_art.png" alt="ASCII art" width="700"/>
</div>

```ts
import { ascii, rainbow } from 'ansimax';

ascii.big('HELLO');                   // fuente grande de 5 líneas
ascii.small('hello');                 // fuente compacta de 3 líneas
ascii.banner('ANSIMAX', {
  font: 'big',
  colorFn: rainbow,
  align: 'center',
});

// Cajas con 6 estilos de borde
ascii.box(rainbow('¡Caja arcoíris!'), {
  borderStyle: 'double',
  padding: 2,
});

// Separadores con conciencia ANSI
ascii.divider({
  label: color.cyan(' SECCIÓN '),
  width: 60,
});
```

---

### Componentes
<div align="center">
  <img src="media/components.png" alt="Componentes UI" width="700"/>
</div>

```ts
import { components } from 'ansimax';

// Tablas con auto-ajuste de columnas
components.table([
  ['Nombre',   'Estado',      'Puntaje'],
  ['Ana',      '✓ activa',    '95'],
  ['Luis',     '⚠ pendiente', '78'],
], { header: true, borderStyle: 'rounded' });

// Mensajes de estado
components.status('success', 'Todos los tests pasaron');
components.status('error',   'Build falló');
components.status('warn',    'Aviso de deprecación');

// Badges
components.badge('VERSION', 'v1.0.0');
components.badge('BUILD', 'passing');

// Menús interactivos (con soporte de AbortSignal)
const choice = await components.menu([
  'Instalar dependencias',
  'Ejecutar tests',
  'Desplegar',
  'Cancelar',
], { multiSelect: false });
```

---

### Timeline
<div align="center">
  <img src="media/timeline.png" alt="Componente timeline" width="700"/>
</div>

```ts
components.timeline([
  { label: 'Inicio del proyecto', done: true,  time: '10:00' },
  { label: 'Pipeline de build',   done: true,  time: '10:15' },
  { label: 'Ejecutar tests',      done: true,  time: '10:32' },
  { label: 'Desplegar a npm',     done: false, time: 'pendiente' },
]);
```

---

### Loaders y progreso
<div align="center">
  <img src="media/loaders.png" alt="Loaders y barras de progreso" width="700"/>
</div>

```ts
import { loader } from 'ansimax';

// Spinner — 11 estilos integrados
const stop = loader.spin('Procesando...', {
  type: 'dots',          // dots, line, arrow, bounce, star, moon, clock...
  color: '#00ff88',
  signal: ctrl.signal,   // Compatible con AbortSignal
});
stop('Completado', true);

// Barra de progreso animada
await loader.progressAnimate(50, 'Instalando', {
  delay: 30,
  color: '#48dbfb',
});

// Ejecutor de tareas — secuencial o paralelo
await loader.tasks([
  { text: 'Obtener deps', fn: async () => fetch() },
  { text: 'Compilar src', fn: async () => compile() },
  { text: 'Run tests',    fn: async () => test() },
], { parallel: false });

// Countdown
await loader.countdown(5, {
  label: 'Lanzamiento en',
  color: '#ffd700',
});
```

---

### Pixel Art y Canvas
<div align="center">
  <img src="media/pixel_art.png" alt="Pixel art y canvas" width="700"/>
</div>

```ts
import { images, createCanvas } from 'ansimax';

// Sprites integrados: heart, star, smiley, pacman
console.log(images.sprite('heart', { scale: 2 }));

// Transformaciones de sprites
const flipped = images.flipHorizontal(images.sprites.heart.pixels);
const rotated = images.rotate90(images.sprites.star.pixels);

// Dibujo en canvas personalizado
const canvas = createCanvas(30, 10);
canvas.drawRect(0, 0, 30, 10, { r: 30, g: 30, b: 50 }, true);
canvas.drawCircle(15, 5, 4, { r: 255, g: 200, b: 0 }, true);
canvas.print();

// Rectángulos con gradiente — horizontal, vertical, diagonal, radial
images.gradientRect({
  width: 50, height: 8,
  colors: ['#ff0080', '#7928ca', '#0070f3'],
  style: 'radial',
});
```

---

### Temas
<div align="center">
  <img src="media/themes.png" alt="Temas integrados" width="700"/>
</div>

```ts
import { themes, color } from 'ansimax';

// 8 temas integrados
themes.use('dracula');    // 'dracula', 'nord', 'monokai', 'cyberpunk',
                          // 'pastel', 'matrix', 'ocean', 'sunset', 'custom'

const t = themes.current();
console.log(color.hex(t.primary)('Texto primario'));
console.log(color.hex(t.error)('Mensaje de error'));
console.log(color.hex(t.success)('¡Éxito!'));

// Define tu propio tema
themes.define('mitema', {
  primary:   '#00ff88',
  secondary: '#0070f3',
  accent:    '#ffd700',
  error:     '#ff4757',
  warning:   '#ffa502',
  success:   '#2ed573',
});
```

---

### Empezar
<div align="center">
  <img src="media/get_started.png" alt="Empezar" width="700"/>
</div>

---

## 📚 Ejemplos completos

La carpeta `examples/` contiene demos ejecutables:

```bash
# Demo en TypeScript (todos los módulos)
npx tsx examples/demo.ts

# Demo en JavaScript (CommonJS)
npm run build
node examples/demo.js

# Showcase visual (ideal para capturas de pantalla)
npx tsx examples/showcase.ts

# Demo de animaciones para grabar
npx tsx examples/animations.ts

# Demo de loaders para grabar
npx tsx examples/loaders.ts
```

---

## 🎯 Casos de uso

- **CLIs profesionales** — herramientas que se sienten pulidas, no básicas
- **Salidas de build** — reemplaza los logs aburridos de `npm run build` por timelines de estado
- **Instaladores interactivos** — menús multi-select con soporte de temas
- **Dashboards en vivo** — motor de frames con auto-refresh y diff rendering
- **Juegos en terminal** — canvas de pixel art + motor de animación
- **Herramientas de desarrollo** — reportes de cobertura, trackers de despliegue, paneles de estado
- **Herramientas educativas** — explicaciones animadas directamente en la terminal

---

## ⚙️ Configuración

```ts
import { configure } from 'ansimax';

configure({
  colorMode: 'truecolor',      // 'basic' | '256' | 'truecolor'
  animationSpeed: 'normal',    // 'slow' | 'normal' | 'fast'
});

// O sobreescribe en runtime
import { setNoColor } from 'ansimax';
setNoColor(true);  // desactiva todos los colores (entornos CI)
```

Ansimax también respeta la variable de entorno estándar `NO_COLOR` y detecta automáticamente cuando stdout no es un TTY (pipes, logs de CI).

---

## 🛣️ Roadmap

Ansimax avanza hacia ser una **plataforma completa de renderizado de terminal**. Esto es lo que ya está hecho y lo que viene:

### ✅ Fase 1 — Fundación del core (actual)

- [x] **Motor de estilos** — ANSI 16 / 256 / truecolor con auto-fallback
- [x] **Helpers de Hex y RGB** con clamping y validación
- [x] **Soporte para `NO_COLOR`** + detección automática de no-TTY
- [x] **Integración con `AbortSignal`** en animaciones y loaders
- [x] **Apilado de estilos con `compose()`** y un solo reset

### ✅ Fase 2 — Motor de gradientes

- [x] Gradientes lineales (multi-stop)
- [x] Presets de arcoíris
- [x] Gradientes radiales (en `gradientRect`)
- [x] Gradientes diagonales
- [ ] **Gradientes animados** (flujo de color a lo largo del tiempo)

### 🟡 Fase 3 — Motor ASCII

- [x] Fuentes en bloque (`big`, `small`)
- [x] Banner con gradiente y alineación
- [x] Dibujo de cajas (6 estilos de borde)
- [ ] **Convertidor imagen → ASCII** (con detección de bordes)
- [ ] **Renderizado ASCII a color** (preserva los colores de la imagen)
- [ ] **Dithering de imágenes** para mejor rango tonal
- [ ] **ASCII optimizado para caras** (modo de alto detalle para retratos)

### ✅ Fase 4 — Primitivos UI de terminal

- [x] Tablas (filas irregulares, datos jagged)
- [x] Cajas con múltiples estilos
- [x] Mensajes de estado + badges
- [x] Timelines con estados done/pending
- [x] Menús interactivos (single + multi-select)
- [ ] **Árboles** (colapsables, lazy-loadable)
- [ ] **Paneles** (layouts divididos)
- [ ] **Layouts** (posicionamiento estilo flexbox)

### ✅ Fase 5 — Control de cursor y pantalla

- [x] Visibilidad del cursor, save/restore, posicionamiento
- [x] Limpieza de pantalla (línea, área, completa)
- [x] Garantías de cleanup con try/finally

### ✅ Fase 6 — Motor de animaciones

- [x] Typewriter, fadeIn, fadeOut, slide, pulse, wave, glitch, reveal
- [x] Todas compatibles con `AbortSignal`
- [x] Modo `reducedMotion` para accesibilidad
- [x] **Morph de frames** (interpolación texto → texto)

### 🟡 Fase 7 — Ecosistema de progreso

- [x] Spinners (11 estilos) con color y AbortSignal
- [x] Barras de progreso animadas
- [x] Ejecutor de tareas (secuencial + paralelo)
- [x] Countdowns
- [ ] **Progreso anidado** (padre + hijos con rollup)
- [ ] **Estimación de ETA** (promedio móvil + proyección)
- [ ] **Refresco en vivo** sin parpadeo (diff renderer)

### 🟡 Fase 8 — Detección de capacidades

- [x] Detección de TTY (auto-desactivar en pipes/CI)
- [x] Soporte de `NO_COLOR`
- [ ] **Detección de profundidad de color** (16 / 256 / truecolor)
- [ ] **Detección de ancho Unicode** (CJK, emojis)
- [ ] **Base de datos de capacidades** (xterm, iTerm, Windows Terminal...)

### 🔴 Fase 9 — Renderizado avanzado

- [ ] **Diff renderer** (solo redibuja regiones modificadas)
- [ ] **Buffer virtual** (componer UI sin escribir a stdout)
- [ ] **Z-index / capas**
- [ ] **Soporte de eventos del mouse**

### 🔴 Fase 10 — Charts en terminal

- [ ] Gráficos de barras (horizontal y vertical)
- [ ] Gráficos de líneas (con braille para resolución sub-carácter)
- [ ] Sparklines
- [ ] Heatmaps
- [ ] Charts en streaming en tiempo real

### 🔴 Fase 11 — Sistema de plugins

- [ ] API de plugins para componentes personalizados
- [ ] Marketplace de temas
- [ ] Registro de fuentes personalizadas
- [ ] Registro comunitario de animaciones

**Leyenda:** ✅ Completo · 🟡 Parcial · 🔴 Planeado

---

## 🧪 Tests

Ansimax incluye **750+ tests** y **100% de cobertura de líneas**:

```bash
npm test                   # Ejecuta todos los tests
npm run test:coverage      # Reporte de cobertura
npm run typecheck          # Check estricto de TypeScript
```

---

## 🛠️ Requisitos

- Node.js **>= 18.0.0**
- Una terminal con soporte de escapes ANSI (cualquier terminal moderno)

---

## 🏗️ Estructura del proyecto

```
ansimax/
├── src/
│   ├── colors/          # Sistema de colores, gradientes, compose, NO_COLOR
│   ├── animations/      # 7 efectos de animación con AbortSignal
│   ├── ascii/           # Fuentes ASCII, cajas, dividers, banners
│   ├── components/      # Tablas, menús, timelines, badges
│   ├── loaders/         # Spinners, progress, tasks, countdowns
│   ├── frames/          # Motor de frames + morph + presets
│   ├── images/          # Pixel art, sprites, API de canvas
│   ├── themes/          # 8 temas integrados + custom
│   ├── utils/           # Helpers ANSI, math de colores, utils de strings
│   └── index.ts         # Barrel del API público
├── examples/            # Demos ejecutables (TS + JS)
├── media/               # Capturas y videos para el README
└── dist/                # Build (CJS + ESM + tipos)
```

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Para empezar:

1. Haz **fork** del repo
2. Crea una rama: `git checkout -b feature/mi-feature`
3. Añade tests para tus cambios (la barra es 100% de cobertura)
4. Commit: `git commit -m 'Add: mi feature'`
5. Push: `git push origin feature/mi-feature`
6. Abre un Pull Request

Asegúrate de que:
- Todos los tests pasan: `npm test`
- TypeScript está contento: `npm run typecheck`
- El código sigue el estilo existente

---

## 🐛 Reportar problemas

¿Encontraste un bug o tienes una idea? Abre un [issue](https://github.com/Brashkie/ansimax/issues) — por favor incluye una reproducción mínima.

---

## ⭐ Apoyar el proyecto

Si te gusta Ansimax:

- ⭐ **Dale una estrella al repo** — ayuda a que otros descubran el proyecto
- 🐛 **Reporta bugs** — abre un [issue](https://github.com/Brashkie/ansimax/issues)
- 🚀 **Úsalo en tus proyectos CLI** — es el mejor apoyo posible
- 📢 **Compártelo** — tweet, blog, menciónalo a un colega que construya CLIs
- 💬 **Difúndelo** — etiqueta tu CLI con `#ansimax` para que otros encuentren inspiración

Esto ayuda al proyecto a crecer y le da impulso para añadir las funcionalidades planeadas más rápido.

---

## 📝 Changelog

Consulta [CHANGELOG.md](CHANGELOG.md) para el historial de versiones.

---

## 👨‍💻 Autor

**Brashkie** · [@Brashkie](https://github.com/Brashkie)

---

## 📜 Licencia

[MIT](LICENSE) © 2026 Brashkie

---

**Keywords:** cli, terminal, ansi, colors, gradients, animation, spinner, ascii, ascii-art, pixel-art, progress-bar, loader, components, table, banner, theme, typescript, nodejs, zero-dependencies

---

<div align="center">
  <p>Hecho con ❤️ y TypeScript</p>
  <p>Si Ansimax te ayuda a crear mejores CLIs, ¡dale una ⭐ en GitHub!</p>
</div>