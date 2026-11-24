/* global chrome */
void (async () => {
  if (!await globalThis.primowordsPrivacyConsent.requireAccepted()) return;
const { create, styles } = globalThis.primowordsLookupCard;
const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);
document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

const input = document.getElementById('word');
const nickname = document.getElementById('popup-nickname');
const view = create({
  onIdentity(label) {
    if (!nickname) return;
    nickname.textContent = nickname.title = label;
    nickname.hidden = !label;
  },
});
const result = document.getElementById('result');
result.append(view.card);
document.getElementById('lookup').addEventListener('submit', event => {
  event.preventDefault();
  result.hidden = false;
  void view.lookup(input.value.trim());
});

document.getElementById('open-settings')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage().catch(() => {
    document.getElementById('lookup-status').textContent = '无法打开设置，请点击工具栏的PrimoWords 图标。';
  });
});
input.addEventListener('input', () => { result.hidden = true; });
window.addEventListener('focus', () => void view.refreshAccount());

const params = new URLSearchParams(location.hash.slice(1));
const selected = params.get('word');
if (selected) {
  input.value = selected;
  result.hidden = false;
  void view.lookup(selected, { url: params.get('url'), title: params.get('title') });
} else {
  void view.refreshAccount();
}
})();
