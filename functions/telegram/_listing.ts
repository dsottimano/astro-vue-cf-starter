/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';
import { readFile } from '../api/_github';
import { emptyListing, slugify, type ListingFormModel } from '../../src/admin/model';
import { buildListingFile, type EntryFile } from '../../src/admin/serialize';

// Find a collision-free slug for (locale, title). `exists` is injected so the
// core loop is unit-testable without network; production passes a GitHub probe.
export async function resolveSlug(
  exists: (path: string) => Promise<boolean>,
  locale: string,
  title: string,
): Promise<string> {
  const base = slugify(title) || 'listing';
  let candidate = base;
  for (let n = 2; n <= 50; n++) {
    if (!(await exists(`src/content/listings/${locale}/${candidate}.md`))) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

// Production probe backed by the GitHub Contents API.
export function ghExists(env: Env): (path: string) => Promise<boolean> {
  return async (path) => (await readFile(env, path)) !== null;
}

// Merge a partial wizard draft onto a complete, schema-valid model.
export function finalizeListing(draft: Partial<ListingFormModel>): ListingFormModel {
  const model = { ...emptyListing(draft.locale ?? 'en'), ...draft };
  model.translationKey = model.translationKey || model.slug;
  return model;
}

export function buildListingEntry(draft: Partial<ListingFormModel>): EntryFile {
  return buildListingFile(finalizeListing(draft));
}
