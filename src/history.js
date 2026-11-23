/* global chrome */
import { readSession, SESSION_KEY } from './session.js';
import { COLLECTION_SETTINGS_KEY, eudicHistoryKey, readCollectionSettings } from './collection-settings.js';
import { openSentenceEditor } from './history-sentence.js';
import {
  historyKey, importFavorites, LOCAL_HISTORY_KEY, observeHistory, pageUrl, parseImport, previewImport, queryHistory, updateHistorySentence,
} from './favorites.js';

const byId = id => document.getElementById(id);
const i18n = globalThis.primowordsI18n;
const setText = (element, source, values) => i18n?.setText ? i18n.setText(element, source, values) : (element.textContent = source);
const setAttribute = (element, name, source, values) => i18n?.setAttribute ? i18n.setAttribute(element, name, source, values) : element.setAttribute(name, source);
let historyRevision = 0;
let queryRevision = 0;
let rowsOnPage = [];
let matchedCount = 0;
let pageCount = 1;
let currentKey;
let currentAccount;
const requestedView = new URLSearchParams(location.search).get('view');
let historyView = ['account', 'eudic'].includes(requestedView) ? requestedView : 'local';
let activeBook;
let historyPage = 1;
const pageSize = 20;
const historyList = byId('history-list');
const historyStatus = byId('history-status');
const historyFilters = byId('history-filters');
const historyPagination = byId('history-pagination');
const topPagination = byId('history-pagination-top');
const exportBar = byId('history-export');
const exportStatus = byId('export-status');
const feedback = byId('history-feedback');
const dialog = byId('delete-dialog');
const deleteConfirm = byId('delete-confirm');
const deleteCancel = byId('delete-cancel');
const deleteError = byId('delete-error');
let deleting;
const from = byId('history-from');
const to = byId('history-to');
const search = byId('history-search');
const clear = byId('history-clear');
const prev = byId('history-prev');
const next = byId('history-next');
const prevTop = byId('history-prev-top');
const nextTop = byId('history-next-top');
let dateFormat = new Intl.DateTimeFormat(i18n?.getLocale() ?? 'zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

async function send(type, fields) {
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type, ...fields });
  } catch {
    throw new Error('无法连接PrimoWords 扩展，请刷新后重试。');
  }
  if (response?.error) throw new Error(response.error);
  if (!response?.value) throw new Error('未收到PrimoWords 扩展的响应，请重试。');
  return response.value;
}

async function fillDefinitions(rows) {
  if (!rows.length) return;
  try {
    const { definitions } = await send('history-definitions', { words: rows.map(({ word }) => word) });
    rows.forEach(({ label }, index) => {
      if (label.isConnected) label.textContent = definitions[index] || '暂无释义';
    });
  } catch (error) {
    for (const { label } of rows) {
      if (label.isConnected) {
        setText(label, error.message);
        label.dataset.error = 'true';
      }
    }
  }
}

function currentFilters() {
  const startOfDay = from.valueAsDate ? new Date(from.value + 'T00:00:00').getTime() : -Infinity;
  const endDay = to.valueAsDate ? new Date(to.value + 'T00:00:00') : null;
  if (endDay) endDay.setDate(endDay.getDate() + 1);
  const endOfDay = endDay ? endDay.getTime() : Infinity;
  return { prefix: search.value.trim().toLowerCase().replaceAll('’', "'"), from: startOfDay, to: endOfDay };
}

function hideResults() {
  exportBar.hidden = historyPagination.hidden = topPagination.hidden = true;
  matchedCount = 0;
  historyList.replaceChildren();
}

async function updateMatches() {
  const revision = ++queryRevision;
  const key = currentKey;
  if (!key) return;
  const filters = currentFilters();
  const filtered = filters.prefix || from.value || to.value;
  clear.disabled = !filtered;
  if (filters.from >= filters.to) {
    hideResults();
    historyStatus.dataset.error = 'true';
    setText(historyStatus, '开始日期不能晚于结束日期。');
    return;
  }
  historyStatus.dataset.error = 'false';
  try {
    const result = await queryHistory(key, filters, { page: historyPage, size: pageSize });
    if (revision !== queryRevision) return;
    ({ rows: rowsOnPage, total: matchedCount, pages: pageCount, page: historyPage } = result);
    setText(historyStatus, matchedCount ? '' : filtered ? '没有符合筛选条件的收藏。' : '这里还没有收藏记录。');
    exportBar.hidden = !matchedCount;
    setText(byId('export-scope'), '导出本栏 {count} 条', { count: matchedCount, itemWord: matchedCount === 1 ? 'item' : 'items' });
    renderHistory();
    return true;
  } catch (error) {
    if (revision !== queryRevision) return;
    hideResults();
    historyStatus.dataset.error = 'true';
    setText(historyStatus, '无法显示本机收藏历史。请刷新后重试。 {error}', { error: i18n?.t(error.message) ?? error.message });
  }
}

function renderHistory() {
  historyList.replaceChildren();
  const missingDefinitions = [];
  for (const record of rowsOnPage) {
    const row = document.createElement('li');
    row.className = 'history-record';
    const header = document.createElement('div');
    header.className = 'history-entry';
    const word = document.createElement('strong');
    word.textContent = record.word;
    word.lang = 'en';
    const speak = byId('history-speak').content.firstElementChild.cloneNode(true);
    setAttribute(speak, 'title', '朗读 {word}', { word: record.word });
    setAttribute(speak, 'aria-label', '朗读 {word}', { word: record.word });
    const headword = document.createElement('div');
    headword.className = 'history-headword';
    headword.append(word, speak);
    const time = document.createElement('time');
    time.dateTime = new Date(record.savedAt).toISOString();
    time.textContent = dateFormat.format(record.savedAt);
    const remove = document.createElement('button');
    remove.className = 'history-remove';
    remove.type = 'button';
    remove.textContent = '删除';
    setAttribute(remove, 'aria-label', '删除收藏 {word}', { word: record.word });
    remove.addEventListener('click', () => beginDelete(record.word));
    const tools = document.createElement('div');
    tools.className = 'history-row-tools';
    tools.append(time, remove);
    header.append(headword, tools);
    const definition = document.createElement('p');
    definition.className = 'history-definition';
    definition.textContent = record.definition || '正在读取释义…';
    if (!record.definition) missingDefinitions.push({ word: record.word, label: definition });
    const speechError = document.createElement('p');
    speechError.setAttribute('role', 'status');
    speechError.dataset.error = 'true';
    speak.addEventListener('click', async () => {
      speak.disabled = true;
      speak.setAttribute('aria-busy', 'true');
      speechError.textContent = '';
      try {
        await send('speak-word', { word: record.word });
      } catch (error) {
        setText(speechError, error.message);
      } finally {
        speak.disabled = false;
        speak.removeAttribute('aria-busy');
      }
    });
    row.append(header, definition, speechError);
    const url = pageUrl(record.url);
    if (url) {
      const link = document.createElement('a');
      link.className = 'history-source-title';
      link.href = url;
      link.textContent = record.title || new URL(url).hostname;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      row.append(link);
    }
    if (record.sentence) {
      const quote = document.createElement('blockquote');
      const english = document.createElement('p');
      english.lang = 'en';
      english.textContent = record.sentence;
      quote.append(english);
      if (record.sentenceTranslation) {
        const chinese = document.createElement('p');
        chinese.className = 'sentence-translation';
        chinese.textContent = record.sentenceTranslation;
        quote.append(chinese);
      }
      if (record.sentenceSource === 'bing') {
        const attribution = document.createElement('p');
        attribution.className = 'sentence-attribution';
        setText(attribution, '必应词典例句');
        quote.append(attribution);
      }
      row.append(quote);
    }
    const editSentence = document.createElement('button');
    editSentence.className = 'history-sentence-action';
    editSentence.type = 'button';
    editSentence.textContent = record.sentence ? (record.sentenceTranslation ? '编辑译文' : '翻译原句') : '添加例句';
    setAttribute(editSentence, 'aria-label', '{word} · {action}', { word: record.word, action: i18n?.t(editSentence.textContent) ?? editSentence.textContent });
    editSentence.addEventListener('click', () => {
      const key = currentKey;
      const account = currentAccount;
      openSentenceEditor(record, {
        async loadExamples() {
          const { examples } = await send('history-examples', { word: record.word });
          return examples;
        },
        async saveSentence(fields) {
          const liveAccount = account ? await readSession() : null;
          if (key !== currentKey || (account && liveAccount?.id !== account)) {
            throw new Error('收藏分类或账号已变更，请关闭后重新打开。');
          }
          await updateHistorySentence(key, record, fields);
          await updateMatches();
          setText(feedback, '已保存「{word}」的例句和译文。', { word: record.word });
        },
      });
    });
    row.append(editSentence);
    historyList.append(row);
  }
  historyPagination.hidden = !matchedCount;
  topPagination.hidden = pageCount <= 1;
  prev.disabled = prevTop.disabled = historyPage <= 1;
  next.disabled = nextTop.disabled = historyPage >= pageCount;
  const pageSummary = { page: historyPage, pages: pageCount, count: matchedCount };
  setText(byId('history-page'), '{page} / {pages} 页 · {count} 条', pageSummary);
  setText(byId('history-page-top'), '{page} / {pages} 页 · {count} 条', pageSummary);
  void fillDefinitions(missingDefinitions);
}

async function refreshHistory() {
  const version = ++historyRevision;
  ++queryRevision;
  const view = historyView;
  currentKey = undefined;
  currentAccount = undefined;
  hideResults();
  exportStatus.textContent = '';
  historyFilters.hidden = true;
  byId('import-open').hidden = view !== 'local';
  byId('eudic-history-picker').hidden = true;
  for (const target of ['account', 'local', 'eudic']) {
    byId(`history-${target}`).setAttribute('aria-pressed', String(view === target));
  }
  setText(byId('history-info'), historyView === 'local'
    ? '显示保存在当前浏览器的词，登录后也不会上传。'
    : view === 'eudic' ? '显示从这台设备收藏到欧路的本机记录。'
      : '显示当前账号从这台设备收藏到 PrimoWords 的词。网页和句子来源只保存在本机。');
  historyStatus.dataset.error = 'false';
  setText(historyStatus, '正在读取本机历史…');
  try {
    const account = view === 'account' ? await readSession() : null;
    const collections = await readCollectionSettings();
    if (version !== historyRevision) return;
    byId('history-eudic').hidden = !collections.books.length && view !== 'eudic';
    if (view === 'account' && !account) {
      setText(historyStatus, '登录后可查看此账号在本机的收藏记录。');
      return;
    }
    if (view === 'eudic') {
      if (!collections.books.length) {
        setText(historyStatus, '可在设置中连接欧路词本。');
        return;
      }
      activeBook = collections.books.find(book => book.id === activeBook)?.id ??
        collections.eudic?.bookId ?? collections.books[0].id;
      const select = byId('eudic-history-book');
      select.replaceChildren(...collections.books.map(book => new Option(book.name, book.id)));
      select.value = activeBook;
      byId('eudic-history-picker').hidden = false;
      currentKey = eudicHistoryKey(activeBook);
    } else {
      currentKey = view === 'local' ? LOCAL_HISTORY_KEY : historyKey(account.userId);
    }
    currentAccount = account?.id;
    historyFilters.hidden = false;
    await updateMatches();
  } catch (error) {
    if (version !== historyRevision) return;
    historyStatus.dataset.error = 'true';
    setText(historyStatus, '无法显示本机收藏历史。请刷新后重试。 {error}', { error: i18n?.t(error.message) ?? error.message });
  }
}

function switchHistory(view) {
  if (view === historyView) return;
  historyView = view;
  historyPage = 1;
  feedback.textContent = '';
  void refreshHistory();
}

function applyFilters() {
  historyPage = 1;
  exportStatus.textContent = '';
  void updateMatches();
}

function beginDelete(word) {
  const destination = historyView;
  deleting = { word, destination, account: currentAccount, key: currentKey, book: activeBook };
  deleteError.textContent = '';
  setText(byId('delete-description'), destination === 'account'
    ? '将取消PrimoWords App 中「{word}」的收藏，并移除本机记录。'
    : destination === 'eudic' ? '只删除「{word}」的本机记录，欧路词本仍保留该词。'
      : '将在此浏览器中移除「{word}」的收藏记录。', { word });
  dialog.showModal();
}

deleteCancel.addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', event => {
  if (deleteConfirm.disabled) event.preventDefault();
});
deleteConfirm.addEventListener('click', async () => {
  if (!deleting || deleteConfirm.disabled) return;
  const { word, destination, account, key, book } = deleting;
  deleteConfirm.disabled = deleteCancel.disabled = true;
  deleteError.textContent = '';
  try {
    await send('delete-favorite', { word, local: destination === 'local', account, destination, book });
    dialog.close();
    if (historyView === destination) {
      await refreshHistory();
      if (key === currentKey) {
        setText(feedback, '已删除「{word}」的收藏。', { word });
        historyList.focus({ preventScroll: true });
      }
    }
  } catch (error) {
    setText(deleteError, error.message);
  } finally {
    deleteConfirm.disabled = deleteCancel.disabled = false;
  }
});

function csvCell(value) {
  // Page titles and quotations can begin with spreadsheet formula operators.
  const safe = /^[\s\uFEFF]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(value) ? "'" + value : value;
  return quoteCell(safe);
}

function quoteCell(value) {
  return '"' + value.replaceAll('"', '""') + '"';
}

function ankiTsv(rows, layout) {
  const basic = layout === 'basic';
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replace(/\r\n|\r|\n/g, '<br>');
  const fields = basic ? ['正面', '背面'] : ['单词', '释义', '原句', '中文译文', '网页链接', '例句来源'];
  const lines = rows.map(record => {
    const { word, definition, sentence, sentenceTranslation, url, sentenceSource } = record;
    const attribution = sentenceSource === 'bing' ? '必应词典例句' : '';
    const values = basic
      ? [escape(word), [definition, [sentence, sentenceTranslation, attribution].filter(Boolean).join('\n'), url]
        .filter(Boolean).map(escape).join('<br><br>')]
      : [word, definition, sentence, sentenceTranslation, url, attribution || (sentence ? '网页原句' : '')];
    return values.map(quoteCell).join('\t');
  });
  return [`#separator:Tab`, `#html:${basic}`, `#columns:${fields.join('\t')}`, ...lines].join('\n') + '\n';
}

async function exportHistory(format) {
  const view = historyView;
  const key = currentKey;
  const filters = currentFilters();
  if (!key || !matchedCount || filters.from >= filters.to) return;
  const stillSelected = () => {
    const active = currentFilters();
    return key === currentKey && active.prefix === filters.prefix && active.from === filters.from && active.to === filters.to;
  };
  exportStatus.dataset.error = 'false';
  setText(exportStatus, '正在准备导出…');
  try {
    if (view === 'account') {
      const account = await readSession();
      if (!stillSelected()) return;
      if (!account || historyKey(account.userId) !== key) {
        await refreshHistory();
        return;
      }
    }
    const { rows: selected } = await queryHistory(key, filters, { all: true });
    if (!stillSelected()) return;
    if (!selected.length) {
      setText(exportStatus, '没有可导出的收藏，请刷新后重试。');
      return;
    }
    const definitionsByWord = new Map();
    const missing = selected.filter(record => !record.definition).map(record => record.word);
    for (let start = 0; start < missing.length; start += 500) {
      const words = missing.slice(start, start + 500);
      const { definitions } = await send('history-definitions', { words });
      if (!stillSelected()) return;
      words.forEach((word, index) => definitionsByWord.set(word, definitions[index]));
    }
    const rows = selected.map(record => ({
      word: record.word,
      savedAt: new Date(record.savedAt).toISOString(),
      category: view === 'account' ? 'primowords' : view,
      url: pageUrl(record.url),
      title: record.title ?? '',
      sentence: record.sentence ?? '',
      sentenceTranslation: record.sentenceTranslation ?? '',
      sentenceSource: record.sentenceSource ?? '',
      definition: record.definition || definitionsByWord.get(record.word) || '',
    }));
    const csv = format === 'csv';
    const tsv = format === 'tsv';
    const output = tsv ? ankiTsv(rows, (await readCollectionSettings()).anki) : csv
      ? '\uFEFF' + [Object.keys(rows[0]), ...rows.map(row => Object.values(row))].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
      : JSON.stringify(rows, null, 2) + '\n';
    if (!stillSelected()) return;
    const type = tsv ? 'text/tab-separated-values' : csv ? 'text/csv' : 'application/json';
    const blob = new Blob([output], { type: `${type};charset=utf-8` });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Intl.DateTimeFormat('sv-SE').format(new Date());
    link.download = `primowords-${view}-${tsv ? 'anki' : 'favorites'}-${date}.${format}`;
    link.href = href;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
    const untranslated = tsv ? rows.filter(row => row.sentence && !row.sentenceTranslation).length : 0;
    setText(exportStatus, untranslated
      ? '已发起 {count} 条收藏的 {format} 下载。其中 {untranslated} 条已有原句，尚无译文。'
      : '已发起 {count} 条收藏的 {format} 下载。',
    { count: rows.length, format: format.toUpperCase(), untranslated, itemWord: rows.length === 1 ? 'item' : 'items' });
  } catch (error) {
    if (!stillSelected()) return;
    exportStatus.dataset.error = 'true';
    setText(exportStatus, '无法导出收藏，请重试。 {error}', { error: i18n?.t(error.message) ?? error.message });
  }
}

const importDialog = byId('import-dialog');
const importFile = byId('import-file');
const importSummary = byId('import-summary');
const importPreview = byId('import-preview');
const importConfirm = byId('import-confirm');
const importCancel = byId('import-cancel');
let importRevision = 0;
let importCandidates = [];

byId('import-open').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;
  const revision = ++importRevision;
  importCandidates = [];
  importConfirm.disabled = true;
  importPreview.replaceChildren();
  importSummary.dataset.error = 'false';
  setText(importSummary, '正在读取文件…');
  importDialog.showModal();
  try {
    const { total, candidates } = parseImport(JSON.parse(await file.text()));
    const additions = await previewImport(candidates);
    if (revision !== importRevision || !importDialog.open) return;
    importCandidates = additions;
    setText(importSummary, '文件有 {total} 条，预计新增 {additions} 条，跳过重复记录 {duplicates} 条。',
      { total, additions: additions.length, duplicates: total - additions.length });
    for (const record of additions.slice(0, 8)) {
      const item = document.createElement('li');
      item.textContent = record.definition ? `${record.word} · ${record.definition}` : record.word;
      importPreview.append(item);
    }
    if (additions.length > 8) {
      const more = document.createElement('li');
      setText(more, '另有 {count} 条', { count: additions.length - 8 });
      importPreview.append(more);
    }
    importConfirm.disabled = !additions.length;
  } catch (error) {
    if (revision !== importRevision || !importDialog.open) return;
    importSummary.dataset.error = 'true';
    setText(importSummary, error instanceof SyntaxError ? '文件不是有效的 JSON，请重新选择。' : error.message);
  }
});
importCancel.addEventListener('click', () => importDialog.close());
importDialog.addEventListener('cancel', event => {
  if (importCancel.disabled) event.preventDefault();
});
importConfirm.addEventListener('click', async () => {
  if (importConfirm.disabled || !importCandidates.length) return;
  importConfirm.disabled = importCancel.disabled = true;
  importSummary.dataset.error = 'false';
  setText(importSummary, '正在导入本机收藏…');
  try {
    const count = await importFavorites(importCandidates);
    importDialog.close();
    historyPage = 1;
    await updateMatches();
    if (count) setText(feedback, '已导入 {count} 条本机收藏。', { count, itemWord: count === 1 ? 'item' : 'items' });
    else setText(feedback, '这些单词已存在，未新增记录。');
  } catch (error) {
    importSummary.dataset.error = 'true';
    setText(importSummary, '导入失败，请重试。 {error}', { error: i18n?.t(error.message) ?? error.message });
  } finally {
    importConfirm.disabled = importCancel.disabled = false;
  }
});

byId('history-account').addEventListener('click', () => switchHistory('account'));
byId('history-local').addEventListener('click', () => switchHistory('local'));
byId('history-eudic').addEventListener('click', () => switchHistory('eudic'));
byId('eudic-history-book').addEventListener('change', event => {
  activeBook = event.target.value;
  historyPage = 1;
  void refreshHistory();
});
search.addEventListener('input', applyFilters);
from.addEventListener('change', applyFilters);
to.addEventListener('change', applyFilters);
byId('export-json').addEventListener('click', () => void exportHistory('json'));
byId('export-csv').addEventListener('click', () => void exportHistory('csv'));
byId('export-anki').addEventListener('click', () => void exportHistory('tsv'));
clear.addEventListener('click', () => {
  search.value = from.value = to.value = '';
  applyFilters();
});
async function changePage(delta, scroll) {
  historyPage = Math.max(1, Math.min(historyPage + delta, pageCount));
  if (await updateMatches() && scroll) {
    historyList.focus({ preventScroll: true });
    historyList.scrollIntoView({ block: 'start' });
  }
}
prev.addEventListener('click', () => void changePage(-1, true));
next.addEventListener('click', () => void changePage(1, true));
prevTop.addEventListener('click', () => void changePage(-1, false));
nextTop.addEventListener('click', () => void changePage(1, false));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && ((historyView === 'account' && Object.hasOwn(changes, SESSION_KEY)) ||
    Object.hasOwn(changes, COLLECTION_SETTINGS_KEY))) void refreshHistory();
});
observeHistory(collection => {
  if (collection === currentKey && !deleteConfirm.disabled) void updateMatches();
});

i18n?.subscribe(({ locale }) => {
  dateFormat = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  if (rowsOnPage.length) renderHistory();
});

await refreshHistory();
if (location.hash === '#history-export' && !exportBar.hidden) byId('export-anki').focus();
