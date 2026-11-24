/* global chrome */
import { API_ENDPOINTS, post, PRIVACY_POLICY_URL } from './api.js';
import { readSession, writeSession, removeSession, SESSION_KEY } from './session.js';
import { readCollectionSettings, updateCollectionSettings } from './collection-settings.js';
import { eudicBooks, EUDIC_PERMISSION } from './eudic.js';

const byId = id => document.getElementById(id);
byId('privacy-policy').href = PRIVACY_POLICY_URL;
const i18n = globalThis.primowordsI18n;
const setText = (element, source, values) => i18n?.setText ? i18n.setText(element, source, values) : (element.textContent = source);
const settingsPages = [...document.querySelectorAll('[data-settings-page]')];
const settingsLinks = [...document.querySelectorAll('[data-settings-link]')];

function renderSettingsRoute() {
  if (!settingsPages.length) return;
  const requested = location.hash.slice(1).split('&')[0];
  const active = settingsPages.find(page => page.dataset.settingsPage === requested) || settingsPages[0];
  for (const page of settingsPages) page.hidden = page !== active;
  for (const link of settingsLinks) {
    if (link.dataset.settingsLink === active.dataset.settingsPage) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const title = active.dataset.settingsPage === 'lookup-guide' ? '查词方式' : '收藏去向';
  setText(document.querySelector('title'), '{title} · PrimoWords', { title: i18n?.t(title) ?? title });
}

window.addEventListener('hashchange', renderSettingsRoute);
i18n?.subscribe(() => renderSettingsRoute());
renderSettingsRoute();

const languageSelect = byId('ui-language');
const languageStatus = byId('language-status');
i18n?.subscribe(({ preference, error }) => {
  if (document.activeElement !== languageSelect) languageSelect.value = preference;
  if (error) {
    languageStatus.dataset.error = 'true';
    setText(languageStatus, error);
  } else if (languageStatus.dataset.error === 'true') {
    languageStatus.dataset.error = 'false';
    setText(languageStatus, '');
  }
});
languageSelect.addEventListener('change', async () => {
  languageSelect.disabled = true;
  try {
    await i18n.setPreference(languageSelect.value);
    languageStatus.dataset.error = 'false';
    setText(languageStatus, '界面语言已保存。');
  } catch (error) {
    languageStatus.dataset.error = 'true';
    setText(languageStatus, error.message);
  } finally {
    languageSelect.disabled = false;
  }
});

const form = byId('sign-in');
let account, busy = false, ready = false, accountError = false;
let accountRevision = 0;
function showStatus(message, error = false) {
  setText(byId('account-status'), message);
  byId('account-status').dataset.error = String(error);
}

function render() {
  form.hidden = !ready || Boolean(account);
  byId('signed-in').hidden = !account;
  byId('identity').textContent = account?.label ?? '';
  form.querySelector('button').disabled = busy;
  byId('sign-out').disabled = busy;
  byId('reset-session').disabled = busy;
  const state = byId('account-state');
  state.dataset.state = accountError ? 'error' : busy || !ready ? 'loading' : account ? 'connected' : 'idle';
  setText(state, accountError ? '状态读取失败' : busy ? (account ? '正在退出' : '正在登录') :
    !ready ? '正在读取状态' : account ? '已登录' : '未登录');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || account) return;
  const login = byId('login').value.trim();
  if (!login) {
    showStatus('请输入邮箱或手机号。', true);
    return;
  }
  const passwordInput = byId('password');
  const password = passwordInput.value;
  passwordInput.value = '';
  busy = true;
  showStatus('正在登录…');
  render();
  try {
    const data = await post(API_ENDPOINTS.authToken, { email: login, password });
    if (typeof data.token !== 'string' || !data.token || typeof data.user?.id !== 'string') {
      throw new Error('登录响应缺少账号或会话信息。');
    }
    const nickname = typeof data.user.name === 'string' ? data.user.name.trim() : '';
    const next = { token: data.token, label: nickname || login, nickname, id: crypto.randomUUID() };
    await writeSession(next);
    account = { ...next, userId: data.user.id };
    accountError = false;
    showStatus('已登录。返回网页即可收藏。');
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    busy = false;
    render();
  }
});

async function signOut() {
  if (busy) return;
  busy = true;
  render();
  try {
    await removeSession();
    account = null;
    ready = true;
    accountError = false;
    byId('reset-session').hidden = true;
    showStatus('已退出登录。');
  } catch {
    showStatus('无法清除登录状态，请重试。', true);
  } finally {
    busy = false;
    render();
  }
}

byId('sign-out').addEventListener('click', signOut);
byId('reset-session').addEventListener('click', signOut);

async function refreshAccount() {
  const version = ++accountRevision;
  try {
    const current = await readSession();
    if (version !== accountRevision) return;
    account = current;
    ready = true;
    accountError = false;
    byId('reset-session').hidden = true;
    if (!busy) showStatus('');
  } catch (error) {
    if (version !== accountRevision) return;
    account = null;
    ready = false;
    accountError = true;
    byId('reset-session').hidden = false;
    showStatus(error.message || '无法读取登录状态，请重新打开设置。', true);
  }
  render();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (Object.hasOwn(changes, SESSION_KEY) && !busy) void refreshAccount();
});

await refreshAccount();

const preferred = byId('preferred-collection');
const anki = byId('anki-layout');
const tokenInput = byId('eudic-token');
const loadBooks = byId('eudic-load');
const bookSelect = byId('eudic-book');
const picker = byId('eudic-picker');
const saveBook = byId('eudic-save');
const disconnect = byId('eudic-disconnect');
const eudicContext = byId('eudic-context');
let collections, pendingToken, books = [], configuring = false;

function collectionStatus(message, error = false, element = 'eudic-status') {
  const status = byId(element);
  setText(status, message);
  status.dataset.error = String(error);
}

function renderCollections() {
  preferred.disabled = anki.disabled = loadBooks.disabled = configuring || !collections;
  tokenInput.disabled = configuring;
  preferred.querySelector('[value="eudic"]').disabled = !collections?.eudic;
  preferred.value = collections?.preferred ?? 'auto';
  anki.value = collections?.anki ?? 'basic';
  const view = collections?.preferred === 'eudic' ? '?view=eudic' : '';
  byId('anki-history').href = `history.html${view}#history-export`;
  const eudic = collections?.eudic;
  if (eudic) setText(byId('eudic-connected'), '已连接 · {bookName}', { bookName: eudic.bookName });
  else setText(byId('eudic-connected'), '尚未连接');
  picker.hidden = !pendingToken || !books.length;
  bookSelect.disabled = saveBook.disabled = configuring;
  disconnect.hidden = !eudic;
  disconnect.disabled = configuring;
  byId('eudic-context-option').hidden = !eudic;
  eudicContext.checked = eudic?.syncSentence !== false;
  eudicContext.disabled = configuring;
}

async function savePreference(select, field) {
  const value = select.value;
  configuring = true;
  renderCollections();
  try {
    collections = await updateCollectionSettings(current => {
      if (field === 'preferred' && value === 'eudic' && !current.eudic) throw new Error('请先连接欧路词典。');
      return { [field]: value };
    });
    collectionStatus('已保存设置。', false, 'collection-status');
  } catch (error) {
    collectionStatus(error.message, true, 'collection-status');
  } finally {
    configuring = false;
    renderCollections();
  }
}

preferred.addEventListener('change', () => void savePreference(preferred, 'preferred'));
anki.addEventListener('change', () => void savePreference(anki, 'anki'));
eudicContext.addEventListener('change', async () => {
  const syncSentence = eudicContext.checked;
  configuring = true;
  renderCollections();
  try {
    collections = await updateCollectionSettings(current => {
      if (!current.eudic) throw new Error('请先连接欧路词典。');
      return { eudic: { ...current.eudic, syncSentence } };
    });
    collectionStatus('已保存欧路语境设置。');
  } catch (error) {
    collectionStatus(error.message, true);
  } finally {
    configuring = false;
    renderCollections();
  }
});
tokenInput.addEventListener('input', () => {
  pendingToken = undefined;
  collectionStatus('');
  renderCollections();
});

loadBooks.addEventListener('click', async () => {
  const raw = tokenInput.value.trim();
  const value = raw.replace(/^NIS\s+/i, '');
  if (raw && !/^[A-Za-z0-9._~+\/=-]+$/.test(value)) {
    collectionStatus('请粘贴欧路 OpenAPI 授权页的 NIS 授权串。', true);
    return;
  }
  const token = raw ? `NIS ${value}` : collections?.eudic?.token;
  if (!token) {
    collectionStatus('请先填写欧路授权串。', true);
    return;
  }
  configuring = true;
  pendingToken = undefined;
  collectionStatus('正在读取欧路词本…');
  renderCollections();
  try {
    if (!await chrome.permissions.request(EUDIC_PERMISSION)) throw new Error('请允许扩展访问欧路后重试。');
    books = await eudicBooks(token);
    if (!books.length) throw new Error('欧路没有返回英文词本，请先在欧路创建词本。');
    pendingToken = token;
    bookSelect.replaceChildren(...books.map(book => new Option(book.name, book.id)));
    if (books.some(book => book.id === collections?.eudic?.bookId)) bookSelect.value = collections.eudic.bookId;
    collectionStatus('请选择要收藏到的词本。');
  } catch (error) {
    collectionStatus(error.message, true);
  } finally {
    configuring = false;
    renderCollections();
  }
});

saveBook.addEventListener('click', async () => {
  const book = books.find(item => item.id === bookSelect.value);
  if (!book || !pendingToken) return;
  configuring = true;
  renderCollections();
  try {
    const eudic = { token: pendingToken, bookId: book.id, bookName: book.name };
    collections = await updateCollectionSettings(current => ({
      preferred: 'eudic', eudic: { ...eudic, syncSentence: current.eudic?.syncSentence !== false },
      books: [book, ...current.books.filter(item => item.id !== book.id)],
    }));
    pendingToken = undefined;
    tokenInput.value = '';
    collectionStatus('欧路已连接并设为默认收藏目标。');
  } catch (error) {
    collectionStatus(error.message, true);
  } finally {
    configuring = false;
    renderCollections();
  }
});

disconnect.addEventListener('click', async () => {
  configuring = true;
  renderCollections();
  try {
    collections = await updateCollectionSettings(current => ({
      eudic: null, preferred: current.preferred === 'eudic' ? 'auto' : current.preferred,
    }));
    pendingToken = undefined;
    tokenInput.value = '';
    collectionStatus('已断开欧路连接。');
  } catch (error) {
    collectionStatus(error.message, true);
  } finally {
    configuring = false;
    renderCollections();
  }
});

try {
  collections = await readCollectionSettings();
} catch (error) {
  collectionStatus(error.message, true, 'collection-status');
}
renderCollections();
