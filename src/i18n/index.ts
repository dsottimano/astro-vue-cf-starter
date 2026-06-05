import { siteConfig, type Locale } from '../../config/site.config';
import en from './en.json';
import es from './es.json';

const dictionaries: Record<Locale, Record<string, string>> = { en, es };

/**
 * Returns a translator bound to `locale`. Missing keys fall back to the
 * default locale, then to the key itself (so nothing renders blank).
 */
export function useTranslations(locale: Locale) {
  const dict = dictionaries[locale] ?? dictionaries[siteConfig.defaultLocale];
  const fallback = dictionaries[siteConfig.defaultLocale];
  return (key: string): string => dict[key] ?? fallback[key] ?? key;
}
