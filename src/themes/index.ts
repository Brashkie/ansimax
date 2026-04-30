// ─────────────────────────────────────────────
//  THEMES  –  predefined palettes (Roadmap feature)
// ─────────────────────────────────────────────

import { hexToRgb } from '../utils/helpers.js';
import { fgRgb, sgr, STYLE, reset } from '../utils/ansi.js';
import { gradient } from '../colors/index.js';

export interface Theme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  bg: string;
  surface: string;
  text: string;
  gradient: string[];
}

const THEMES: Record<string, Theme> = {
  dracula:  { name:'Dracula',  primary:'#bd93f9', secondary:'#ff79c6', accent:'#50fa7b', warning:'#f1fa8c', error:'#ff5555', info:'#8be9fd', muted:'#6272a4', bg:'#282a36', surface:'#44475a', text:'#f8f8f2', gradient:['#bd93f9','#ff79c6'] },
  nord:     { name:'Nord',     primary:'#88c0d0', secondary:'#81a1c1', accent:'#a3be8c', warning:'#ebcb8b', error:'#bf616a', info:'#5e81ac', muted:'#4c566a', bg:'#2e3440', surface:'#3b4252', text:'#eceff4', gradient:['#88c0d0','#81a1c1'] },
  monokai:  { name:'Monokai',  primary:'#a6e22e', secondary:'#66d9e8', accent:'#f92672', warning:'#fd971f', error:'#f92672', info:'#66d9e8', muted:'#75715e', bg:'#272822', surface:'#3e3d32', text:'#f8f8f2', gradient:['#a6e22e','#66d9e8'] },
  cyberpunk:{ name:'Cyberpunk',primary:'#ff2d78', secondary:'#00fff5', accent:'#ffe801', warning:'#ff8800', error:'#ff2d78', info:'#00fff5', muted:'#444466', bg:'#0d0d1a', surface:'#1a1a2e', text:'#e0e0ff', gradient:['#ff2d78','#00fff5','#ffe801'] },
  pastel:   { name:'Pastel',   primary:'#a29bfe', secondary:'#fd79a8', accent:'#55efc4', warning:'#ffeaa7', error:'#e17055', info:'#74b9ff', muted:'#b2bec3', bg:'#f8f9fa', surface:'#ffffff', text:'#2d3436', gradient:['#a29bfe','#fd79a8','#74b9ff'] },
  matrix:   { name:'Matrix',   primary:'#00ff41', secondary:'#008f11', accent:'#00ff41', warning:'#aaff00', error:'#ff0000', info:'#00cc33', muted:'#003b00', bg:'#0d0208', surface:'#001a00', text:'#00ff41', gradient:['#00ff41','#003b00'] },
  ocean:    { name:'Ocean',    primary:'#0099ff', secondary:'#00d2d3', accent:'#ffd32a', warning:'#ffa502', error:'#ff4757', info:'#70a1ff', muted:'#57606f', bg:'#0a1628', surface:'#0f2942', text:'#dfe6e9', gradient:['#0099ff','#00d2d3'] },
  sunset:   { name:'Sunset',   primary:'#fd7272', secondary:'#f9ca24', accent:'#6ab04c', warning:'#f0932b', error:'#eb4d4b', info:'#22a6b3', muted:'#95afc0', bg:'#1a1a2e', surface:'#16213e', text:'#f5f6fa', gradient:['#fd7272','#f9ca24','#6ab04c'] },
};

let _active: Theme = THEMES['dracula'] as Theme;

const apply = (colorHex: string) => (text: string): string => {
  const { r, g, b } = hexToRgb(colorHex);
  return fgRgb(r, g, b) + text + reset();
};

export const themes = {
  list:      (): string[] => Object.keys(THEMES),
  get:       (name: string): Theme | null => THEMES[name] ?? null,
  use(name: string) {
    const t = THEMES[name];
    if (!t) throw new Error(`Theme "${name}" not found. Available: ${Object.keys(THEMES).join(', ')}`);
    _active = t;
    return themes;
  },
  current:   (): Theme => _active,
  primary:   (text: string) => apply(_active.primary)(text),
  secondary: (text: string) => apply(_active.secondary)(text),
  accent:    (text: string) => apply(_active.accent)(text),
  warning:   (text: string) => apply(_active.warning)(text),
  error:     (text: string) => apply(_active.error)(text),
  info:      (text: string) => apply(_active.info)(text),
  muted:     (text: string) => apply(_active.muted)(text),
  text:      (text: string) => apply(_active.text)(text),
  bold:      (text: string) => sgr(STYLE.bold) + text + reset(),
  gradient:  (text: string) => gradient(text, _active.gradient),
  register:  (name: string, def: Theme): void => { THEMES[name] = def; },
  preview: (): void => {
    const orig = _active;
    Object.values(THEMES).forEach((t) => {
      _active = t;
      console.log(
        gradient(`  ${t.name}  `, t.gradient) + '  ' +
        themes.primary('primary') + '  ' +
        themes.secondary('secondary') + '  ' +
        themes.accent('accent') + '  ' +
        themes.error('error') + '  ' +
        themes.warning('warning'),
      );
    });
    _active = orig;
  },
};

export default themes;