/* global chrome */
import { restrictStorage } from './session.js';

export const COLLECTION_SETTINGS_KEY = 'primowordsCollectionSettings';
export const eudicHistoryKey = id => `primowordsEudic:${id}`;

export async function readCollectionSettings() {
  await restrictStorage();
  const stored = (await chrome.storage.local.get(COLLECTION_SETTINGS_KEY))[COLLECTION_SETTINGS_KEY];
  if (stored === undefined) return { preferred: 'auto', anki: 'basic', eudic: null, books: [] };
  if (!stored || !['auto', 'local', 'eudic'].includes(stored.preferred) ||
      !['basic', 'fields'].includes(stored.anki) || !Array.isArray(stored.books)) {
    throw new Error('收藏配置无效，请重新打开扩展设置。');
  }
  return stored;
}

export async function updateCollectionSettings(update) {
  return navigator.locks.request(COLLECTION_SETTINGS_KEY, async () => {
    const current = await readCollectionSettings();
    const next = { ...current, ...update(current) };
    await chrome.storage.local.set({ [COLLECTION_SETTINGS_KEY]: next });
    return next;
  });
}
