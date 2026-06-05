import { siteConfig, type Locale } from '../../config/site.config';

type Localizable = { data: { locale: string; translationKey: string } };

/**
 * Resolve one entry per translationKey for the given locale, falling back to
 * the default locale when a translation is missing. Shared by listings + posts.
 */
export function resolveLocalized<T extends Localizable>(entries: T[], locale: Locale): T[] {
  const byKey = new Map<string, T[]>();
  for (const entry of entries) {
    const group = byKey.get(entry.data.translationKey) ?? [];
    group.push(entry);
    byKey.set(entry.data.translationKey, group);
  }

  const resolved: T[] = [];
  for (const group of byKey.values()) {
    const match =
      group.find((e) => e.data.locale === locale) ??
      group.find((e) => e.data.locale === siteConfig.defaultLocale);
    if (match) resolved.push(match);
  }
  return resolved;
}
