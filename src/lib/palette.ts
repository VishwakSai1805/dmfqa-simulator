import type { ProcessInput } from '../engine/types';

/**
 * Categorical series slots, in fixed order, validated against the app's dark
 * surface (#1a1a19): worst adjacent CVD ΔE 8.4, worst adjacent normal-vision
 * ΔE 19.3, every slot ≥ 3:1 contrast.
 *
 * The order is the colour-vision-safety mechanism, not decoration — hues are
 * assigned by slot index and never cycled into a generated hue.
 */
export const SERIES = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
] as const;

/** The two engines, as a two-series comparison. Fixed everywhere in the UI. */
export const ENGINE_COLOR = { baseline: SERIES[0], dmfqa: SERIES[1] } as const;

export interface Style {
  color: string;
  /** Slot 9 onward reuses a hue and adds a hatch, rather than inventing a colour.
   *  Every mark also carries its process ID as a direct label, so identity never
   *  rests on colour alone. */
  textured: boolean;
}

export const styleAt = (index: number): Style => ({
  color: SERIES[index % SERIES.length],
  textured: index >= SERIES.length,
});

export const colorAt = (index: number): string => styleAt(index).color;

/** id -> style, derived from position in the active process list. */
export function styleMap(processes: ProcessInput[]): Map<string, Style> {
  return new Map(processes.map((p, i) => [p.id, styleAt(i)]));
}

/** CSS background for a legend swatch or queue pill, hatched when textured. */
export function swatchBackground({ color, textured }: Style): string {
  if (!textured) return color;
  return `repeating-linear-gradient(45deg, ${color} 0 3px, color-mix(in srgb, ${color} 55%, #000) 3px 6px)`;
}
