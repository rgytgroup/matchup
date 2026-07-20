/** Plataformas de citas soportadas (detectadas del screenshot o elegidas en modo manual). */
export const PLATFORMS = ['tinder', 'hinge', 'bumble', 'other'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  tinder: 'Tinder',
  hinge: 'Hinge',
  bumble: 'Bumble',
  other: 'Other',
};

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}
