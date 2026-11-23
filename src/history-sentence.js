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
  translate.disabled = busy;
  save.disabled = busy || !draft.sentence;
  cancel.disabled = draft.saving === true;
  for (const button of choices.querySelectorAll('button')) button.disabled = busy;
  i18n?.localize(dialog);
}

export function openSentenceEditor(record, { loadExamples, saveSentence }) {
  draft = {
    sentence: record.sentence || '',
    source: record.sentenceSource || '',
    loadExamples,
    saveSentence,
  };
  setText(byId('sentence-title'), '{word} 的例句和译文', { word: record.word });
  translation.value = record.sentenceTranslation || '';
  choices.replaceChildren();
  showStatus('');
  render();
  dialog.showModal();
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
  if (!globalThis.Translator?.create) {
    showStatus('当前浏览器不支持 Chrome 本地翻译，可直接填写译文。', true);
    return;
  }
  const controller = new AbortController();
  current.controller = controller;
  current.operation = 'translate';
  showStatus('正在准备 Chrome 本地翻译…');
  render();
  let translator;
  try {
    translator = await globalThis.Translator.create({
      sourceLanguage: 'en', targetLanguage: 'zh', signal: controller.signal,
      monitor(progress) {
        progress.addEventListener('downloadprogress', event => {
          if (isCurrent(current)) setText(status, '正在准备英中语言包 · {percent}%', { percent: Math.round(event.loaded * 100) });
        });
      },
    });
    if (!isCurrent(current)) return;
    showStatus('正在翻译…');
    const text = (await translator.translate(current.sentence, { signal: controller.signal })).trim();
    if (!isCurrent(current)) return;
    if (!text || text.length > translation.maxLength) throw new Error();
    translation.value = text;
    showStatus('可核对译文后保存。');
  } catch {
    if (isCurrent(current)) showStatus('Chrome 本地翻译暂不可用，可重试或直接填写译文。', true);
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
