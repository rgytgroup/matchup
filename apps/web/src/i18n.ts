import { DEFAULT_LOCALE, messages, type Locale, type Messages } from '@matchup/shared';

/** Hook de i18n. v1 en inglés; el idioma se parametriza para ES/PT futuros. */
export function useI18n(locale: Locale = DEFAULT_LOCALE): Messages {
  return messages[locale];
}
