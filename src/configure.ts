// ─────────────────────────────────────────────
//  CONFIGURE  –  global settings
// ─────────────────────────────────────────────

export type ColorMode = 'basic' | '256' | 'truecolor';
export type AnimationSpeed = 'slow' | 'normal' | 'fast';

export interface AnsimaxConfig {
  colorMode?: ColorMode;
  animationSpeed?: AnimationSpeed;
  asciiFont?: 'big' | 'small';
  locale?: string;
  theme?: string;
}

const _config: Required<AnsimaxConfig> = {
  colorMode: 'truecolor',
  animationSpeed: 'normal',
  asciiFont: 'big',
  locale: 'es',
  theme: 'dracula',
};

const SPEED_MAP: Record<AnimationSpeed, number> = {
  slow: 2.0, normal: 1.0, fast: 0.4,
};

export const configure = (opts: AnsimaxConfig = {}): void => {
  Object.assign(_config, opts);
};

export const getConfig = (): Required<AnsimaxConfig> => ({ ..._config });
export const getSpeedMultiplier = (): number => SPEED_MAP[_config.animationSpeed] ?? 1.0;

export default configure;