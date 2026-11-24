const byId = id => document.getElementById(id);
const i18n = globalThis.primowordsI18n;
const setText = (element, source, values) => i18n?.setText ? i18n.setText(element, source, values) : (element.textContent = source);
const dialog = byId('sentence-dialog');
const original = byId('sentence-original');
const source = byId('sentence-source');
const examples = byId('sentence-examples');
const choices = byId('sentence-choices');
const editor = byId('sentence-translation-editor');
const translation = byId('sentence-translation');
const translate = byId('sentence-translate');
const status = byId('sentence-status');
const save = byId('sentence-save');
const cancel = byId('sentence-cancel');
const translatorOptions = Object.freeze({ sourceLanguage: 'en', targetLanguage: 'zh' });
let draft;

function showStatus(message, error = false) {
  setText(status, message);
  status.dataset.error = String(error);
}

function render() {
  const busy = Boolean(draft.operation);
  original.textContent = draft.sentence;
  source.textContent = draft.source === 'bing' ? '必应词典例句' : draft.sentence ? '网页原句' : '这条收藏没有网页原句。';
  examples.hidden = Boolean(draft.sentence) && draft.source !== 'bing';
  examples.disabled = busy;
  editor.hidden = !draft.sentence;
  translation.readOnly = busy;
  translate.disabled = busy || ['checking', 'unsupported', 'unavailable'].includes(draft.translatorAvailability);
  save.disabled = busy || !draft.sentence;
  cancel.disabled = draft.saving === true;
  for (const button of choices.querySelectorAll('button')) button.disabled = busy;
  i18n?.localize(dialog);
}

export function openSentenceEditor(record, { loadExamples, saveSentence }) {
  const hasTranslator = typeof globalThis.Translator?.create === 'function';
  draft = {
    sentence: record.sentence || '',
    source: record.sentenceSource || '',
    translatorAvailability: hasTranslator ? 'checking' : 'unsupported',
    loadExamples,
    saveSentence,
  };
  setText(byId('sentence-title'), '{word} 的例句和译文', { word: record.word });
  translation.value = record.sentenceTranslation || '';
  choices.replaceChildren();
  showStatus(hasTranslator ? '正在检查英中语言包…' : '当前浏览器不支持 Chrome 本地翻译，可直接填写译文。', !hasTranslator);
  render();
  dialog.showModal();
  const current = draft;
  if (current.translatorAvailability === 'checking') {
    if (typeof globalThis.Translator.availability !== 'function') {
      current.translatorAvailability = 'unknown';
      showStatus('无法检查 Chrome 本地翻译是否可用，仍可重试或直接填写译文。', true);
      render();
      return;
    }
    void globalThis.Translator.availability(translatorOptions).then(availability => {
      if (!isCurrent(current)) return;
      current.translatorAvailability = ['available', 'downloadable', 'downloading', 'unavailable'].includes(availability)
        ? availability : 'unknown';
      if (!current.operation) {
        if (availability === 'available') showStatus('');
        else if (availability === 'downloadable' || availability === 'downloading') {
          showStatus('首次使用需要下载英中语言包，点击翻译开始。');
        } else if (availability === 'unavailable') {
          showStatus('此设备或英中语言对暂不支持 Chrome 本地翻译，可直接填写译文。', true);
        } else showStatus('无法检查 Chrome 本地翻译是否可用，仍可重试或直接填写译文。', true);
      }
      render();
    }).catch(error => {
      if (!isCurrent(current)) return;
      current.translatorAvailability = 'unknown';
      console.warn('PrimoWords Translator availability check failed:', error?.name || 'Error');
      if (!current.operation) showStatus('无法检查 Chrome 本地翻译是否可用，仍可重试或直接填写译文。', true);
      render();
    });
  }
}

function isCurrent(current) {
  return draft === current && dialog.open;
}

examples.addEventListener('click', async () => {
  const current = draft;
  current.operation = 'examples';
  choices.replaceChildren();
  showStatus('正在从必应词典查找双语例句…');
  render();
  try {
    const rows = await current.loadExamples();
    if (!isCurrent(current)) return;
    for (const { en, zh } of rows) {
      const item = document.createElement('li');
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'secondary';
      const english = document.createElement('span');
      english.lang = 'en';
      english.textContent = en;
      const chinese = document.createElement('span');
      chinese.textContent = zh;
      option.append(english, chinese);
      option.addEventListener('click', () => {
        current.sentence = en;
        current.source = 'bing';
        translation.value = zh;
        choices.replaceChildren();
        showStatus('');
        render();
        translation.focus();
      });
      item.append(option);
      choices.append(item);
    }
    showStatus(rows.length ? '选择一条例句。' : '必应词典没有找到可用的双语例句。');
  } catch (error) {
    if (isCurrent(current)) showStatus(error.message, true);
  } finally {
    current.operation = null;
    if (isCurrent(current)) render();
  }
});

translate.addEventListener('click', async () => {
  const current = draft;
  if (!globalThis.Translator?.create || current.translatorAvailability === 'unsupported') {
    showStatus('当前浏览器不支持 Chrome 本地翻译，可直接填写译文。', true);
    return;
  }
  if (current.translatorAvailability === 'checking') return;
  if (current.translatorAvailability === 'unavailable') {
    showStatus('此设备或英中语言对暂不支持 Chrome 本地翻译，可直接填写译文。', true);
    return;
  }
  const controller = new AbortController();
  current.controller = controller;
  current.operation = 'translate';
  showStatus('正在准备 Chrome 本地翻译…');
  render();
  let translator;
  let translating = false;
  try {
    translator = await globalThis.Translator.create({
      ...translatorOptions, signal: controller.signal,
      monitor(progress) {
        progress.addEventListener('downloadprogress', event => {
          if (isCurrent(current)) setText(status, '正在准备英中语言包 · {percent}%', { percent: Math.round(event.loaded * 100) });
        });
      },
    });
    if (!isCurrent(current)) return;
    current.translatorAvailability = 'available';
    showStatus('正在翻译…');
    translating = true;
    const text = (await translator.translate(current.sentence, { signal: controller.signal })).trim();
    if (!isCurrent(current)) return;
    if (!text || text.length > translation.maxLength) throw new Error();
    translation.value = text;
    showStatus('可核对译文后保存。');
  } catch (error) {
    if (!isCurrent(current)) return;
    console.warn('PrimoWords Translator API failed:', error?.name || 'Error');
    current.translatorAvailability = error?.name === 'NotSupportedError' ? 'unavailable' : 'downloadable';
    const message = error?.name === 'NotAllowedError'
      ? 'Chrome 未允许开始下载英中语言包，请重新点击翻译按钮。'
      : error?.name === 'NotSupportedError'
        ? '此设备或英中语言对暂不支持 Chrome 本地翻译，可直接填写译文。'
        : error?.name === 'AbortError'
          ? 'Chrome 本地翻译已取消，可重试或直接填写译文。'
          : translating
            ? 'Chrome 本地翻译执行失败，可重试或直接填写译文。'
            : '英中语言包下载或启动失败，请检查网络后重试，或直接填写译文。';
    showStatus(message, true);
  } finally {
    translator?.destroy?.();
    current.operation = current.controller = null;
    if (isCurrent(current)) render();
  }
});

save.addEventListener('click', async () => {
  const current = draft;
  current.operation = 'save';
  current.saving = true;
  showStatus('正在保存…');
  render();
  try {
    await current.saveSentence({
      sentence: current.sentence,
      sentenceSource: current.source,
      sentenceTranslation: translation.value.trim(),
    });
    if (isCurrent(current)) dialog.close();
  } catch (error) {
    if (isCurrent(current)) showStatus(error.message, true);
  } finally {
    current.operation = null;
    current.saving = false;
    if (isCurrent(current)) render();
  }
});

cancel.addEventListener('click', () => {
  draft.controller?.abort();
  dialog.close();
});
dialog.addEventListener('cancel', event => {
  if (draft.saving) event.preventDefault();
  else draft.controller?.abort();
});
