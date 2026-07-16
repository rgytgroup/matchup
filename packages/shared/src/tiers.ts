/** Tiers de compra única (SPEC §1, §4, §8). Sin suscripciones — regla de negocio. */

export const TIER_IDS = ['AUDIT', 'AUDIT_PLUS_PHOTOS'] as const;
export type TierId = (typeof TIER_IDS)[number];

export interface TierDef {
  id: TierId;
  priceUsd: number;
  includesPhotos: boolean;
}

export const TIERS: Record<TierId, TierDef> = {
  AUDIT: { id: 'AUDIT', priceUsd: 14.99, includesPhotos: false },
  AUDIT_PLUS_PHOTOS: { id: 'AUDIT_PLUS_PHOTOS', priceUsd: 34.99, includesPhotos: true },
};

export function isTierId(value: string): value is TierId {
  return (TIER_IDS as readonly string[]).includes(value);
}

/** Reglas de upload de fotos del intake (SPEC §4.2). */
export const UPLOAD_RULES = {
  minPhotos: 3,
  maxPhotos: 8,
  maxBytesPerPhoto: 10 * 1024 * 1024,
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;
