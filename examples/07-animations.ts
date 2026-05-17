/**
 * 07 — Animations
 *
 * Tests typewriter, fadeIn, fadeOut, slide, pulse, wave, glitch, reveal.
 *
 * Run: npx tsx examples/07-animations.ts
 */

import { animate, gradient, color } from '../src/index.js';

console.log();
console.log(color.bold('━━━ Animations Demo ━━━'));
console.log();

// Helper to add pause between animations
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// 1. Typewriter
console.log(color.dim('// 1. Typewriter'));
await animate.typewriter('Welcome to the ansimax demo...', { speed: 30 });
await pause(300);

// 2. Typewriter with gradient
console.log(color.dim('\n// 2. Typewriter + gradient'));
await animate.typewriter('Colorful typewriter effect!', {
  speed: 35,
  colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9', '#8be9fd']),
});
await pause(300);

// 3. FadeIn
console.log(color.dim('\n// 3. FadeIn'));
await animate.fadeIn('Fading in smoothly', { duration: 600 });
await pause(300);

// 4. FadeOut
console.log(color.dim('\n// 4. FadeOut'));
await animate.fadeOut('Fading out now...', { duration: 600 });
await pause(300);

// 5. Slide
console.log(color.dim('\n// 5. Slide from left'));
await animate.slide('Sliding into view', { duration: 400, direction: 'left' });
await pause(300);

// 6. Pulse
console.log(color.dim('\n// 6. Pulse'));
await animate.pulse('Pulsing text...', { cycles: 3, duration: 1500 });
await pause(300);

// 7. Wave
console.log(color.dim('\n// 7. Wave'));
await animate.wave('Wave animation!', { duration: 1500 });
await pause(300);

// 8. Glitch
console.log(color.dim('\n// 8. Glitch'));
await animate.glitch('GLITCHED TEXT', { duration: 1000 });
await pause(300);

// 9. Reveal
console.log(color.dim('\n// 9. Reveal'));
await animate.reveal('Revealing secret message', { duration: 1000 });
await pause(300);

console.log();
console.log(color.bold(color.green('✓ Animations test complete')));
console.log();
