import { en, type Messages } from './en';

export const SUPPORTED_LOCALES = ['en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Diccionarios por idioma. ES/PT se agregan aquí cuando lleguen. */
export const messages: Record<Locale, Messages> = { en };

export { en };
export type { Messages };
