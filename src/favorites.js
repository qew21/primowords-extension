/* global chrome */
import { restrictStorage } from './session.js';

export const LOCAL_HISTORY_KEY = 'primowordsLocalFavorites';
export const historyKey = userId => `primowordsFavorites:${userId}`;
const databaseName = 'primowords-favorites';
const recordsStore = 'records';
const migrationsStore = 'migrations';
const dateIndex = 'by-collection-date';
const initialized = new Map();
let databaseRequest;

function result(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function database() {
  databaseRequest ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const records = request.result.createObjectStore(recordsStore, { keyPath: ['collection', 'word'] });
      records.createIndex(dateIndex, ['collection', 'savedAt', 'word']);
      request.result.createObjectStore(migrationsStore);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databaseRequest = undefined;
        initialized.clear();
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  }).catch(error => {
    databaseRequest = undefined;
    throw error;
  });
  return databaseRequest;
}

async function transact(stores, mode, work) {
  const db = await database();
  const tx = db.transaction(stores, mode);
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error('收藏数据库事务已中止，请重试。'));
  });
  try {
    const [value] = await Promise.all([Promise.resolve().then(() => work(tx)), done]);
    return value;
  } catch (error) {
    try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
    throw error;
  }
}

function storedRecordIsValid(word, record) {
  return /^[a-z]+(?:[.'-][a-z]+)*$/.test(word) && word.length <= 120 &&
    record?.word === word && Number.isFinite(record.savedAt) && Number.isFinite(new Date(record.savedAt).getTime()) &&
    ['definition', 'phonetic', 'url', 'title', 'sentence', 'sentenceTranslation', 'sentenceSource']
      .every(field => record[field] === undefined || typeof record[field] === 'string');
}

async function migrate(collection) {
  const readMarker = () => transact([migrationsStore], 'readonly', tx =>
    result(tx.objectStore(migrationsStore).get(collection)));
  let marker = await readMarker();
  if (marker === undefined) {
    await restrictStorage();
    const legacy = (await chrome.storage.local.get(collection))[collection];
    if (legacy !== undefined && (!legacy || typeof legacy !== 'object' || Array.isArray(legacy))) {
      throw new Error('旧版收藏格式无效，原记录已保留。');
    }
    const rows = Object.entries(legacy ?? {});
    if (rows.some(([word, record]) => !storedRecordIsValid(word, record))) {
      throw new Error('旧版收藏中存在无效记录，原记录已保留。');
    }
    marker = await transact([recordsStore, migrationsStore], 'readwrite', async tx => {
      const markers = tx.objectStore(migrationsStore);
      const alreadyMigrated = await result(markers.get(collection));
      if (alreadyMigrated !== undefined) return alreadyMigrated;
      const records = tx.objectStore(recordsStore);
      for (const [, record] of rows) records.add({ ...record, collection });
      const next = legacy === undefined ? 'done' : 'copied';
      markers.add(next, collection);
      return next;
    });
  }
  if (marker === 'copied') {
    // The new records and migration marker are committed before touching old storage.
    await restrictStorage();
    await chrome.storage.local.remove(collection);
    await transact([migrationsStore], 'readwrite', tx => result(tx.objectStore(migrationsStore).put('done', collection)));
  }
}

function ready(collection) {
  if (!initialized.has(collection)) {
    initialized.set(collection, migrate(collection).catch(error => {
      initialized.delete(collection);
      throw new Error(`无法准备本机收藏数据库，请刷新后重试。 ${error.message}`);
    }));
  }
  return initialized.get(collection);
}

function notify(collection) {
  const channel = new BroadcastChannel('primowords-favorites-changes');
  channel.postMessage(collection);
  channel.close();
}

export function observeHistory(listener) {
  const channel = new BroadcastChannel('primowords-favorites-changes');
  channel.onmessage = event => listener(event.data);
}

export function pageUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.username = url.password = url.search = url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

export async function hasFavorite(collection, word) {
  await ready(collection);
  return transact([recordsStore], 'readonly', async tx =>
    (await result(tx.objectStore(recordsStore).getKey([collection, word]))) !== undefined);
}

export async function addHistory(collection, word, source) {
  await ready(collection);
  const added = await transact([recordsStore], 'readwrite', async tx => {
    const records = tx.objectStore(recordsStore);
    if ((await result(records.getKey([collection, word]))) !== undefined) return false;
    await result(records.add({ ...source, collection, word, savedAt: Date.now() }));
    return true;
  });
  if (added) notify(collection);
}

export async function removeHistory(collection, word) {
  await ready(collection);
  await transact([recordsStore], 'readwrite', tx => result(tx.objectStore(recordsStore).delete([collection, word])));
  notify(collection);
}

export async function updateHistorySentence(collection, original, fields) {
  await ready(collection);
  await transact([recordsStore], 'readwrite', async tx => {
    const records = tx.objectStore(recordsStore);
    const current = await result(records.get([collection, original.word]));
    if (!current || current.savedAt !== original.savedAt ||
        ['sentence', 'sentenceTranslation', 'sentenceSource'].some(field => current[field] !== original[field])) {
      throw new Error('该收藏已在其他页面变更，请关闭窗口后重新打开。');
    }
    const updated = { ...current, ...fields };
    if (!storedRecordIsValid(original.word, updated)) throw new Error('例句或译文格式无效。');
    await result(records.put(updated));
  });
  notify(collection);
}

function newestFirst(a, b) {
  return b.savedAt - a.savedAt || (a.word < b.word ? 1 : a.word > b.word ? -1 : 0);
}

function readNewest(index, range, offset, limit) {
  return new Promise((resolve, reject) => {
    const request = index.openCursor(range, 'prev');
    const rows = [];
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(rows);
      } else if (offset) {
        cursor.advance(offset);
        offset = 0;
      } else {
        rows.push(cursor.value);
        if (rows.length === limit) resolve(rows);
        else cursor.continue();
      }
    };
  });
}

export async function queryHistory(collection, { prefix, from, to }, { page = 1, size = 20, all = false } = {}) {
  await ready(collection);
  return transact([recordsStore], 'readonly', async tx => {
    const records = tx.objectStore(recordsStore);
    const index = records.index(dateIndex);
    const dates = IDBKeyRange.bound([collection, from], [collection, to], false, true);
    let total, rows;
    if (prefix) {
      const range = IDBKeyRange.bound([collection, prefix], [collection, prefix + '\uffff'], false, true);
      const candidates = await result(records.getAll(range));
      rows = candidates.filter(record => record.savedAt >= from && record.savedAt < to).sort(newestFirst);
      total = rows.length;
    } else {
      total = await result(index.count(dates));
    }
    const pages = Math.max(1, Math.ceil(total / size));
    const current = Math.min(page, pages);
    const offset = (current - 1) * size;
    if (rows) {
      if (!all) rows = rows.slice(offset, offset + size);
    } else {
      rows = all ? (await result(index.getAll(dates))).reverse() : await readNewest(index, dates, offset, size);
    }
    return { rows, total, pages, page: current };
  });
}

function localKeys(records) {
  return result(records.getAllKeys(IDBKeyRange.bound([LOCAL_HISTORY_KEY], [LOCAL_HISTORY_KEY, []], false, true)));
}

async function newLocalRecords(records, candidates) {
  const existing = new Set((await localKeys(records)).map(([, word]) => word));
  return candidates.filter(record => !existing.has(record.word));
}

export async function previewImport(candidates) {
  await ready(LOCAL_HISTORY_KEY);
  return transact([recordsStore], 'readonly', tx => newLocalRecords(tx.objectStore(recordsStore), candidates));
}

export async function importFavorites(candidates) {
  await ready(LOCAL_HISTORY_KEY);
  const added = await transact([recordsStore], 'readwrite', async tx => {
    const records = tx.objectStore(recordsStore);
    const incoming = await newLocalRecords(records, candidates);
    for (const record of incoming) records.add({ ...record, collection: LOCAL_HISTORY_KEY });
    return incoming.length;
  });
  if (added) notify(LOCAL_HISTORY_KEY);
  return added;
}

export function parseImport(data) {
  if (!Array.isArray(data)) throw new Error('请选择由PrimoWords 扩展导出的 JSON 收藏文件。');
  const unique = new Map();
  for (const [index, item] of data.entries()) {
    if (['primowords', 'eudic'].includes(item?.category)) throw new Error('此文件包含其他收藏目标的记录。请选择「仅本机收藏」导出的文件。');
    const word = typeof item?.word === 'string' ? item.word.trim().toLowerCase() : '';
    const savedAt = typeof item?.savedAt === 'string' ? Date.parse(item.savedAt) : NaN;
    const record = { ...item, word, savedAt };
    if (item?.category !== 'local' || !storedRecordIsValid(word, record) ||
      new Date(savedAt).toISOString() !== item.savedAt || (record.url && !pageUrl(record.url))) {
      throw new Error(`第 ${index + 1} 条收藏格式无效，请检查文件后重试。`);
    }
    if (!unique.has(word)) unique.set(word, {
      word, savedAt, definition: record.definition || '', phonetic: record.phonetic || '', url: pageUrl(record.url),
      title: record.title || '', sentence: record.sentence || '',
      sentenceTranslation: record.sentenceTranslation || '', sentenceSource: record.sentenceSource || '',
    });
  }
  return { total: data.length, candidates: [...unique.values()] };
}
