/* global chrome */
import './privacy-consent.js';
import './ui-language.js';
import { API_ENDPOINTS, post, PRIVACY_POLICY_URL } from './api.js';
import { readSession, removeSession } from './session.js';
import { addHistory, hasFavorite, historyKey, LOCAL_HISTORY_KEY, pageUrl, removeHistory } from './favorites.js';
import { eudicHistoryKey, readCollectionSettings } from './collection-settings.js';
import { addEudicWord } from './eudic.js';

const lookupMenu = 'primowords-lookup';
const i18n = globalThis.primowordsI18n;
let dictionaryRequest;
const bingEntries = new Map();
const bingDocument = 'bing-dictionary.html';
let openingDictionary;
let saveQueue = Promise.resolve();
let localSaveQueue = Promise.resolve();
let eudicSaveQueue = Promise.resolve();

async function syncLookupMenu() {
  let accepted = false;
  try {
    accepted = await globalThis.primowordsPrivacyConsent.hasConsent();
  } catch {
    accepted = false;
  }
  await new Promise(resolve => chrome.contextMenus.remove(lookupMenu, () => {
    void chrome.runtime.lastError;
    resolve();
  }));
  if (!accepted) return;
  chrome.contextMenus.create({
    id: lookupMenu,
    title: i18n?.t('用PrimoWords 查词') ?? '用PrimoWords 查词',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  }, () => {
    if (chrome.runtime.lastError) console.error(chrome.runtime.lastError.message);
  });
}

function wordKey(value) {
  if (typeof value !== 'string' || value.length > 120) return null;
  const word = value.trim().toLowerCase().replace(/’/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, '');
  return /^[a-z]+(?:[.'-][a-z]+)*$/.test(word) ? word : null;
}

async function speakWord(value) {
  if (!wordKey(value)) throw new Error('只能朗读一个英文单词。');
  if (!chrome.tts?.speak) throw new Error('当前浏览器不支持 Chrome 英文朗读。');
  const word = value.trim().replace(/’/g, "'").replace(/^[^a-z]+|[^a-z]+$/gi, '');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('朗读未完成，请检查系统英文语音后重试。')), 8000);
    const fail = () => {
      clearTimeout(timer);
      reject(new Error('无法播放单词，请检查系统英文语音后重试。'));
    };
    chrome.tts.speak(word, {
      lang: 'en-US',
      enqueue: false,
      onEvent(event) {
        if (event.type === 'error') fail();
        if (['end', 'interrupted', 'cancelled'].includes(event.type)) {
          clearTimeout(timer);
          resolve();
        }
      },
    }).catch(fail);
  });
  return {};
}

function dictionary() {
  dictionaryRequest ??= (async () => {
    const data = await (await fetch(chrome.runtime.getURL('dictionary.json'))).json();
    if (data?.version !== 3 || !data.entries || !Object.keys(data.entries).length) throw new Error();
    return data.entries;
  })().catch(() => {
    dictionaryRequest = undefined;
    throw new Error('无法读取离线词典，请重新加载PrimoWords 扩展。');
  });
  return dictionaryRequest;
}

// Start as soon as Chrome loads the worker, including install and browser startup.
function preload() {
  void dictionary().catch(error => console.warn(error.message));
}

function ensureBingDocument() {
  openingDictionary ??= (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL(bingDocument)],
    });
    if (contexts.length) return;
    await chrome.offscreen.createDocument({
      url: bingDocument,
      reasons: ['DOM_PARSER'],
      justification: 'Extract plain-text dictionary definitions, pronunciations, and examples from Bing.',
    });
  })().finally(() => { openingDictionary = undefined; });
  return openingDictionary;
}

async function bingDictionary(value) {
  const term = await lookup(value);
  if (term.level) throw new Error('该词已有PrimoWords 词卡或可查的原形词卡。');
  return fetchBingEntry(value);
}

function fetchBingEntry(value) {
  // Keep the selected capitalization so Bing can show the corresponding headword.
  const word = value.trim().replace(/’/g, "'").replace(/^[^a-z]+|[^a-z]+$/gi, '');
  if (bingEntries.has(word)) return bingEntries.get(word);
  const request = (async () => {
    let response;
    try {
      await ensureBingDocument();
      response = await chrome.runtime.sendMessage({ target: 'bing-dictionary', word });
    } catch {
      throw new Error('无法启动必应词典查询，请重新加载扩展后重试。');
    }
    if (response?.error) throw new Error(response.error);
    if (!response?.value) throw new Error('必应词典未返回查询结果，请重试。');
    return response.value;
  })().catch(error => {
    if (bingEntries.get(word) === request) bingEntries.delete(word);
    throw error;
  });
  if (bingEntries.size >= 100) bingEntries.delete(bingEntries.keys().next().value);
  bingEntries.set(word, request);
  return request;
}

async function lookup(value, useBase = true) {
  const selected = wordKey(value);
  if (!selected) throw new Error('请输入或选中一个英文单词。');
  const entries = await dictionary();
  if (!Object.hasOwn(entries, selected)) return { word: selected, found: false, level: null };
  const word = (useBase && entries[selected][6]) || selected;
  if (!Object.hasOwn(entries, word) || (word !== selected && !entries[word][3])) {
    throw new Error('离线词典缺少对应的原形词卡，请重新加载或更新扩展。');
  }
  const entry = entries[word];
  const [definition, phonetic, canonical, level, cocaRank, bncRank] = entry;
  const base = canonical && Object.hasOwn(entries, canonical) ? entries[canonical] : undefined;
  const favoriteLevel = canonical ? base?.[3] ?? null : level;
  return {
    word, found: true, phonetic, level, cocaRank, bncRank,
    eligible: Boolean(level && favoriteLevel), canonical: canonical || word, favoriteLevel,
    definition: definition || (base?.[0] ? `${canonical}：${base[0]}` : ''),
  };
}

function favoriteSource(message, sender) {
  const senderPage = sender.url?.split('#')[0];
  const popup = [chrome.runtime.getURL('popup.html'), chrome.runtime.getURL('quick-lookup.html')].includes(senderPage);
  const url = pageUrl(popup ? message.source?.url : sender.url);
  const title = url && typeof message.source?.title === 'string' ? message.source.title.trim().slice(0, 250) : '';
  const sentence = url && typeof message.source?.sentence === 'string' ? message.source.sentence.trim().slice(0, 600) : '';
  const sentenceTranslation = sentence && typeof message.sentenceTranslation === 'string'
    ? message.sentenceTranslation.trim().slice(0, 2000) : '';
  const phonetic = typeof message.phonetic === 'string' ? message.phonetic.trim().replace(/\s+/g, ' ').slice(0, 300) : '';
  return { url, title, sentence, sentenceTranslation, phonetic };
}

async function saveLocal(term, source) {
  try {
    await addHistory(LOCAL_HISTORY_KEY, term.word, source);
  } catch (error) {
    throw new Error(`无法写入本机收藏，请重试。 ${error.message}`);
  }
  return { word: term.word };
}

async function saveToAccount(term, accountId, source) {
  const current = await readSession();
  if (!current?.token || current.id !== accountId) {
    return { recheck: true, error: '登录状态已变化，请重新确认。' };
  }
  const key = historyKey(current.userId);
  if (await hasFavorite(key, term.canonical)) return { word: term.canonical };
  let response;
  try {
    response = await post(API_ENDPOINTS.wordStudy, { word: term.word, source: 'dictionary', action: 'add' }, current.token);
  } catch (error) {
    if (error.code !== 401) throw error;
    if ((await readSession())?.id === current.id) await removeSession();
    return { recheck: true, error: '登录已失效，请前往设置重新登录。' };
  }
  if (response.ignored === true) throw new Error('服务端暂不支持收藏这个词，请更新扩展词表后重试。');
  if (response.status !== 'queued' || response.word !== term.canonical) {
    throw new Error('未收到预期的收藏确认，请在PrimoWords App 中核对。');
  }
  try {
    await addHistory(key, term.canonical, source);
  } catch {
    throw new Error('词已收藏到 PrimoWords，但本机历史写入失败。请重试补记。');
  }
  if ((await readSession())?.id !== current.id) return { recheck: true, error: '账号已切换，收藏已记在原账号。' };
  return { word: response.word };
}

function favoriteTarget(term, settings) {
  if (settings.preferred === 'eudic') return 'eudic';
  if (settings.preferred === 'local' || !term.eligible) return 'local';
  return 'account';
}

async function saveToEudic(word, expectedBook, source) {
  const { eudic } = await readCollectionSettings();
  if (!eudic || eudic.bookId !== expectedBook) {
    return { recheck: true, error: '欧路词本已切换，请重新确认。' };
  }
  const key = eudicHistoryKey(eudic.bookId);
  if (await hasFavorite(key, word)) return { word };
  const notice = await addEudicWord(eudic, word, source.sentence);
  try {
    await addHistory(key, word, source);
  } catch {
    throw new Error('已收藏到欧路，但本机历史写入失败，请重试补记。');
  }
  return { word, notice };
}

async function deleteEudicHistory({ word, book }) {
  const { books } = await readCollectionSettings();
  if (wordKey(word) !== word || !word || !books.some(item => item.id === book)) {
    throw new Error('该欧路词本或词条已变更，请刷新后重试。');
  }
  await removeHistory(eudicHistoryKey(book), word);
  return {};
}

async function deleteFavorite(message) {
  const word = wordKey(message.word);
  if (!word || word !== message.word) throw new Error('收藏词条无效，请刷新历史。');
  const current = message.local === true ? null : await readSession();
  if (message.local !== true && (!current || current.id !== message.account)) {
    throw new Error('登录状态已变化，请重新登录后重试。');
  }
  const key = current ? historyKey(current.userId) : LOCAL_HISTORY_KEY;
  if (!await hasFavorite(key, word)) return {};
  if (current) {
    let response;
    try {
      response = await post(API_ENDPOINTS.wordStudy, { word, source: 'dictionary', action: 'remove' }, current.token);
    } catch (error) {
      if (error.code !== 401) throw error;
      if ((await readSession())?.id === current.id) await removeSession();
      throw new Error('登录已失效，请前往设置重新登录。');
    }
    if (response.status !== null || response.word !== word) {
      throw new Error('未收到PrimoWords 的取消收藏确认，请重试。');
    }
  }
  try {
    await removeHistory(key, word);
  } catch {
    throw new Error(current ? '已从PrimoWords 取消收藏，本机记录移除失败，请重试。' : '无法删除本机收藏，请重试。');
  }
  return {};
}

async function handleMessage(message, sender) {
  if (message?.type === 'content-ui-state') {
    return i18n.getContentState();
  }
  if (message?.type === 'privacy-consent-status') {
    return { accepted: await globalThis.primowordsPrivacyConsent.hasConsent() };
  }
  if (message?.type === 'privacy-policy-url') return { url: PRIVACY_POLICY_URL };
  if (message?.type === 'privacy-consent-accept') {
    const senderPage = sender.url?.split(/[?#]/, 1)[0];
    if (senderPage !== chrome.runtime.getURL('workspace.html')) throw new Error('请在PrimoWords 隐私说明页面确认。');
    await globalThis.primowordsPrivacyConsent.accept();
    await syncLookupMenu();
    return { accepted: true };
  }
  if (message?.type === 'privacy-consent-open') {
    await chrome.runtime.openOptionsPage();
    return {};
  }
  if (!await globalThis.primowordsPrivacyConsent.hasConsent()) {
    throw new Error('请先阅读并同意PrimoWords 的数据处理说明。');
  }
  switch (message?.type) {
    case 'warmup': await dictionary(); return {};
    case 'lookup': return lookup(message.word);
    case 'bing-lookup': return bingDictionary(message.word);
    case 'speak-word': return speakWord(message.word);
    case 'history-definitions': {
      if (!Array.isArray(message.words) || message.words.length > 500) throw new Error('释义查询超出批量范围。');
      const terms = await Promise.all(message.words.map(word => lookup(word, false)));
      return { definitions: terms.map(term => term.definition || '') };
    }
    case 'history-examples': {
      if (sender.url?.split(/[?#]/, 1)[0] !== chrome.runtime.getURL('history.html') ||
          !wordKey(message.word)) throw new Error('请在收藏历史页面选择例句。');
      const { examples } = await fetchBingEntry(message.word);
      return { examples: examples.filter(({ en, zh }) => en && zh && en.length <= 1500 && zh.length <= 2000) };
    }
    case 'identity': {
      const account = await readSession();
      if (!account) return { label: '' };
      const nickname = account.nickname ?? account.label;
      // Older sessions used the login identifier when the account had no nickname.
      const label = typeof nickname === 'string' ? nickname.trim() : '';
      return { label: label && !label.includes('@') && !/^\+?[\d\s()-]+$/.test(label) ? label.slice(0, 100) : '已登录' };
    }
    case 'favorite-state': {
      const term = await lookup(message.word);
      const settings = await readCollectionSettings();
      const target = favoriteTarget(term, settings);
      if (target === 'local') {
        return { target, saved: await hasFavorite(LOCAL_HISTORY_KEY, term.word) };
      }
      if (target === 'eudic') {
        const { eudic } = settings;
        if (!eudic) throw new Error('请先在设置中连接欧路词本。');
        return {
          target, id: eudic.bookId, bookName: eudic.bookName,
          saved: await hasFavorite(eudicHistoryKey(eudic.bookId), term.word),
        };
      }
      const account = await readSession();
      if (!account) return { target, id: null, saved: false };
      return { target, id: account.id, saved: await hasFavorite(historyKey(account.userId), term.canonical) };
    }
    case 'save': {
      const term = await lookup(message.word);
      const settings = await readCollectionSettings();
      const target = favoriteTarget(term, settings);
      if (message.destination !== target) return { recheck: true, error: '默认收藏目标已变化，请重新确认。' };
      const source = favoriteSource(message, sender);
      if (target !== 'account') {
        const online = typeof message.definition === 'string' ? message.definition.trim().slice(0, 1500) : '';
        source.definition = online || term.definition || '';
        if (target === 'eudic') {
          const pending = eudicSaveQueue.then(() => saveToEudic(term.word, message.account, source));
          eudicSaveQueue = pending.catch(() => {});
          return pending;
        }
        const pending = localSaveQueue.then(() => saveLocal(term, source));
        localSaveQueue = pending.catch(() => {});
        return pending;
      }
      source.definition = term.canonical === term.word ? term.definition : (await lookup(term.canonical, false)).definition;
      const pending = saveQueue.then(() => saveToAccount(term, message.account, source));
      saveQueue = pending.catch(() => {});
      return pending;
    }
    case 'delete-favorite': {
      if (sender.url?.split(/[?#]/, 1)[0] !== chrome.runtime.getURL('history.html')) {
        throw new Error('请在收藏历史页面删除。');
      }
      if (message.destination === 'eudic') {
        const pending = eudicSaveQueue.then(() => deleteEudicHistory(message));
        eudicSaveQueue = pending.catch(() => {});
        return pending;
      }
      if (message.local === true) {
        const pending = localSaveQueue.then(() => deleteFavorite(message));
        localSaveQueue = pending.catch(() => {});
        return pending;
      }
      const pending = saveQueue.then(() => deleteFavorite(message));
      saveQueue = pending.catch(() => {});
      return pending;
    }
    case 'favorite-history': {
      const view = message.destination;
      const route = ['local', 'account', 'eudic'].includes(view) ? `history-${view}` : 'history';
      const url = new URL(chrome.runtime.getURL('workspace.html'));
      url.hash = route;
      await chrome.tabs.create({ url: url.href });
      return {};
    }
    case 'settings': await chrome.runtime.openOptionsPage(); return {};
    default: throw new Error('无法识别的PrimoWords操作。');
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message?.target === 'bing-dictionary') return false;
  handleMessage(message, sender).then(value => respond({ value }), error => respond({ error: error.message }));
  return true;
});

chrome.runtime.onStartup.addListener(() => {
  preload();
  void syncLookupMenu();
});
preload();

function updateExtensionLabels() {
  const menuTitle = i18n?.t('用PrimoWords 查词') ?? '用PrimoWords 查词';
  void chrome.action.setTitle({ title: i18n?.t('PrimoWords 设置') ?? 'PrimoWords 设置' });
  void chrome.contextMenus.update(lookupMenu, { title: menuTitle }, () => {
    if (chrome.runtime.lastError) return;
  });
}

i18n?.subscribe(updateExtensionLabels);

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage().catch(error => console.error('无法打开PrimoWords 设置', error));
});

chrome.runtime.onInstalled.addListener(() => {
  void syncLookupMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== lookupMenu) return;
  let accepted;
  try {
    accepted = await globalThis.primowordsPrivacyConsent.hasConsent();
  } catch {
    accepted = false;
  }
  if (!accepted) {
    await chrome.runtime.openOptionsPage();
    return;
  }
  if (!info.selectionText) return;
  const url = new URL(chrome.runtime.getURL('quick-lookup.html'));
  url.hash = new URLSearchParams({
    word: info.selectionText.trim().slice(0, 121),
    url: pageUrl(info.frameUrl || info.pageUrl),
    title: tab?.title?.slice(0, 250) || '',
  }).toString();
  chrome.windows.create({ url: url.href, type: 'popup', width: 440, height: 480 })
    .catch(error => console.error('无法打开PrimoWords 查词窗口', error));
});
