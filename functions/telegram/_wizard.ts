/// <reference types="@cloudflare/workers-types" />
import type { Env } from '../api/_env';
import type { ListingFormModel, PropertyType, Status, AreaUnit } from '../../src/admin/model';
import { type WizardSession, type WizardStep, saveSession, clearSession } from './_session';
import {
  sendMessage,
  answerCallback,
  downloadFile,
  inlineKeyboard,
  locationKeyboard,
  removeKeyboard,
} from './_telegram';
import { buildKey, putMedia } from '../api/_media';
import { commitFile } from '../api/_github';
import { resolveSlug, ghExists, buildListingEntry, finalizeListing } from './_listing';

// Normalized input the webhook hands to the wizard.
export type WizardInput =
  | { kind: 'text'; text: string }
  | { kind: 'callback'; data: string; callbackId: string }
  | { kind: 'location'; lat: number; lng: number }
  | { kind: 'photo'; fileId: string };

export const STEP_ORDER: WizardStep[] = [
  'locale',
  'title',
  'propertyType',
  'price',
  'currency',
  'beds',
  'baths',
  'area',
  'areaUnit',
  'lotSize',
  'street',
  'city',
  'region',
  'country',
  'coords',
  'features',
  'photos',
  'description',
  'status',
  'confirm',
];

export function parsePositiveNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function stepApplies(step: WizardStep, draft: Partial<ListingFormModel>): boolean {
  const pt = draft.propertyType;
  if (step === 'beds' || step === 'baths' || step === 'area' || step === 'areaUnit') {
    return pt === 'house' || pt === 'condo';
  }
  if (step === 'lotSize') return pt === 'lot' || pt === 'commercial';
  return true;
}

export function nextStep(current: WizardStep, draft: Partial<ListingFormModel>): WizardStep {
  const i = STEP_ORDER.indexOf(current);
  for (let j = i + 1; j < STEP_ORDER.length; j++) {
    if (stepApplies(STEP_ORDER[j], draft)) return STEP_ORDER[j];
  }
  return 'confirm';
}

type Markup = ReturnType<typeof inlineKeyboard> | ReturnType<typeof locationKeyboard>;

// What to send when entering a step.
function prompt(step: WizardStep): { text: string; markup?: Markup } {
  switch (step) {
    case 'locale':
      return { text: '🌐 Language for this listing?', markup: inlineKeyboard([[['English', 'loc:en'], ['Español', 'loc:es']]]) };
    case 'title':
      return { text: '🏷️ Listing title?' };
    case 'propertyType':
      return {
        text: '🏠 Property type?',
        markup: inlineKeyboard([
          [['House', 'pt:house'], ['Condo', 'pt:condo']],
          [['Lot', 'pt:lot'], ['Commercial', 'pt:commercial']],
        ]),
      };
    case 'price':
      return { text: '💲 Price? (numbers only, e.g. 875000)' };
    case 'currency':
      return { text: 'Currency?', markup: inlineKeyboard([[['USD', 'cur:USD'], ['MXN', 'cur:MXN'], ['EUR', 'cur:EUR']]]) };
    case 'beds':
      return { text: '🛏️ Bedrooms?', markup: numberPad('beds') };
    case 'baths':
      return { text: '🛁 Bathrooms?', markup: numberPad('baths') };
    case 'area':
      return { text: '📐 Living area? (number, or Skip)', markup: inlineKeyboard([[['Skip', 'skip']]]) };
    case 'areaUnit':
      return { text: 'Area unit?', markup: inlineKeyboard([[['sqft', 'au:sqft'], ['sqm', 'au:sqm']]]) };
    case 'lotSize':
      return { text: '🗺️ Lot size? (number, or Skip)', markup: inlineKeyboard([[['Skip', 'skip']]]) };
    case 'street':
      return { text: '📫 Street address?' };
    case 'city':
      return { text: 'City?' };
    case 'region':
      return { text: 'Region / state?' };
    case 'country':
      return { text: 'Country? (2-letter code, e.g. US)' };
    case 'coords':
      return { text: '📍 Share the property location, or Skip.', markup: locationKeyboard() };
    case 'features':
      return { text: '✨ Features? (comma-separated, or Skip)', markup: inlineKeyboard([[['Skip', 'skip']]]) };
    case 'photos':
      return { text: '📷 Send photos now. Tap Done when finished.', markup: inlineKeyboard([[['Done', 'done']]]) };
    case 'description':
      return { text: '📝 Description? (or Skip)', markup: inlineKeyboard([[['Skip', 'skip']]]) };
    case 'status':
      return {
        text: 'Status?',
        markup: inlineKeyboard([
          [['Draft', 'st:draft'], ['For sale', 'st:for-sale']],
          [['Pending', 'st:pending'], ['Sold', 'st:sold']],
        ]),
      };
    case 'confirm':
      return { text: '', markup: inlineKeyboard([[['✅ Confirm', 'confirm'], ['✖️ Cancel', 'cancel']]]) };
  }
}

function numberPad(field: 'beds' | 'baths') {
  return inlineKeyboard([
    [['0', `${field}:0`], ['1', `${field}:1`], ['2', `${field}:2`], ['3', `${field}:3`]],
    [['4', `${field}:4`], ['5', `${field}:5`], ['6', `${field}:6`], ['Skip', 'skip']],
  ]);
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function previewText(draft: Partial<ListingFormModel>): string {
  const m = finalizeListing(draft);
  const lines = [
    `<b>${esc(m.title)}</b>`,
    `${m.propertyType} · ${m.status}`,
    `${m.price} ${m.currency}`,
    [
      m.beds != null && `${m.beds} bd`,
      m.baths != null && `${m.baths} ba`,
      m.area != null && `${m.area} ${m.areaUnit}`,
      m.lotSize != null && `lot ${m.lotSize}`,
    ]
      .filter(Boolean)
      .join(' · '),
    `${esc(m.address.street)}, ${esc(m.address.city)}, ${esc(m.address.region)}, ${esc(m.address.country)}`,
    `coords: ${m.coords.lat}, ${m.coords.lng}`,
    m.features.length ? `features: ${m.features.map(esc).join(', ')}` : '',
    `photos: ${m.photos.length}`,
    '',
    'Create this listing?',
  ];
  return lines.filter((l) => l !== '').join('\n');
}

async function enter(env: Env, chatId: number, session: WizardSession): Promise<void> {
  const p = prompt(session.step);
  const text = session.step === 'confirm' ? previewText(session.draft) : p.text;
  await sendMessage(env, chatId, text, p.markup);
  await saveSession(env, chatId, session);
}

async function advance(env: Env, chatId: number, session: WizardSession): Promise<void> {
  session.step = nextStep(session.step, session.draft);
  await enter(env, chatId, session);
}

// Main entry: apply one input to the wizard, performing side effects.
export async function handleWizard(
  env: Env,
  chatId: number,
  session: WizardSession,
  input: WizardInput,
): Promise<void> {
  if (input.kind === 'callback') await answerCallback(env, input.callbackId);

  // Global cancel from the confirm step.
  if (input.kind === 'callback' && input.data === 'cancel') {
    await clearSession(env, chatId);
    await sendMessage(env, chatId, 'Cancelled.', removeKeyboard);
    return;
  }

  const d = session.draft;
  const step = session.step;
  const cb = input.kind === 'callback' ? input.data : null;
  const txt = input.kind === 'text' ? input.text.trim() : null;
  const skipped = cb === 'skip';

  switch (step) {
    case 'locale':
      if (cb?.startsWith('loc:')) {
        d.locale = cb.slice(4);
        return advance(env, chatId, session);
      }
      break;
    case 'title':
      if (txt) {
        d.title = txt;
        d.slug = await resolveSlug(ghExists(env), d.locale ?? 'en', txt);
        return advance(env, chatId, session);
      }
      break;
    case 'propertyType':
      if (cb?.startsWith('pt:')) {
        d.propertyType = cb.slice(3) as PropertyType;
        return advance(env, chatId, session);
      }
      break;
    case 'price':
      if (txt) {
        const n = parsePositiveNumber(txt);
        if (n === null) {
          await sendMessage(env, chatId, 'Please send a number, e.g. 875000.');
          return;
        }
        d.price = n;
        return advance(env, chatId, session);
      }
      break;
    case 'currency':
      if (cb?.startsWith('cur:')) {
        d.currency = cb.slice(4);
        return advance(env, chatId, session);
      }
      break;
    case 'beds':
    case 'baths':
      if (skipped) return advance(env, chatId, session);
      if (cb?.startsWith(`${step}:`)) {
        d[step] = Number(cb.split(':')[1]);
        return advance(env, chatId, session);
      }
      break;
    case 'area':
      if (skipped) return advance(env, chatId, session);
      if (txt) {
        const n = parsePositiveNumber(txt);
        if (n === null) {
          await sendMessage(env, chatId, 'Send a number or tap Skip.');
          return;
        }
        d.area = n;
        return advance(env, chatId, session);
      }
      break;
    case 'areaUnit':
      if (cb?.startsWith('au:')) {
        d.areaUnit = cb.slice(3) as AreaUnit;
        return advance(env, chatId, session);
      }
      break;
    case 'lotSize':
      if (skipped) return advance(env, chatId, session);
      if (txt) {
        const n = parsePositiveNumber(txt);
        if (n === null) {
          await sendMessage(env, chatId, 'Send a number or tap Skip.');
          return;
        }
        d.lotSize = n;
        return advance(env, chatId, session);
      }
      break;
    case 'street':
    case 'city':
    case 'region':
    case 'country':
      if (txt) {
        d.address = { ...emptyAddress(d), [step]: txt };
        return advance(env, chatId, session);
      }
      break;
    case 'coords':
      if (skipped) return advance(env, chatId, session);
      if (input.kind === 'location') {
        d.coords = { lat: input.lat, lng: input.lng };
        return advance(env, chatId, session);
      }
      break;
    case 'features':
      if (skipped) {
        d.features = [];
        return advance(env, chatId, session);
      }
      if (txt) {
        d.features = txt.split(',').map((f) => f.trim()).filter(Boolean);
        return advance(env, chatId, session);
      }
      break;
    case 'photos':
      if (cb === 'done') return advance(env, chatId, session);
      if (input.kind === 'photo') {
        await addPhoto(env, chatId, session, input.fileId);
        return;
      }
      break;
    case 'description':
      if (skipped) {
        d.description = '';
        return advance(env, chatId, session);
      }
      if (txt) {
        d.description = txt;
        return advance(env, chatId, session);
      }
      break;
    case 'status':
      if (cb?.startsWith('st:')) {
        d.status = cb.slice(3) as Status;
        return advance(env, chatId, session);
      }
      break;
    case 'confirm':
      if (cb === 'confirm') return commit(env, chatId, session);
      break;
  }

  // Unrecognized input for this step — re-show the prompt.
  await enter(env, chatId, session);
}

function emptyAddress(d: Partial<ListingFormModel>) {
  return d.address ?? { street: '', city: '', region: '', country: '' };
}

async function addPhoto(
  env: Env,
  chatId: number,
  session: WizardSession,
  fileId: string,
): Promise<void> {
  try {
    const bytes = await downloadFile(env, fileId);
    const key = buildKey('listings/photos', `${fileId}.jpg`);
    await putMedia(env, bytes, 'image/jpeg', key);
    session.draft.photos = [...(session.draft.photos ?? []), key];
    await saveSession(env, chatId, session);
    await sendMessage(
      env,
      chatId,
      `📷 Added (${session.draft.photos.length}). Send more or tap Done.`,
      inlineKeyboard([[['Done', 'done']]]),
    );
  } catch {
    await sendMessage(env, chatId, 'Could not save that photo — try again or tap Done.');
  }
}

async function commit(env: Env, chatId: number, session: WizardSession): Promise<void> {
  try {
    const entry = buildListingEntry(session.draft);
    await commitFile(env, entry.path, entry.content, `listing: add ${entry.path}`);
    await clearSession(env, chatId);
    await sendMessage(env, chatId, `✅ Created <code>${entry.path}</code>. Publishing…`, removeKeyboard);
  } catch {
    await sendMessage(env, chatId, '❌ Commit failed. Tap Confirm to retry, or /cancel.');
  }
}

// Start a fresh wizard at the first step.
export async function startWizard(env: Env, chatId: number): Promise<void> {
  const session: WizardSession = { step: 'locale', draft: {}, updatedAt: 0 };
  await enter(env, chatId, session);
}
