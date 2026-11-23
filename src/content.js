/* global chrome */
(() => {
  const { create, styles } = globalThis.primowordsLookupCard;
  const i18n = globalThis.primowordsI18n;
  const setAttribute = (node, name, source, values) => i18n?.setAttribute ? i18n.setAttribute(node, name, source, values) : node.setAttribute(name, source);
  const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  let overlay;

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styles + `
    :host { color-scheme: light dark; }
    .trigger {
      display: grid; place-items: center; width: 34px; height: 34px; padding: 4px;
      border: 1px solid var(--primowords-border, #cad8d2); border-radius: 50%;
      box-sizing: border-box; background: var(--primowords-paper, #fff); cursor: pointer;
      box-shadow: 0 3px 12px #14262138;
    }
    .trigger img { grid-area: 1 / 1; display: block; width: 24px; height: 24px; }
    .trigger b { grid-area: 1 / 1; color: var(--primowords-link, #12634e); font: 650 15px system-ui; }
    .trigger:focus-visible { outline: 2px solid var(--primowords-link, #12634e); outline-offset: 2px; }
    .word-card { max-height: var(--primowords-max-height); overflow: auto; overscroll-behavior: contain; box-shadow: 0 8px 26px #14262138; }
    @media (prefers-color-scheme: dark) {
      :host {
        --primowords-paper: #23302c; --primowords-text: #edf4f0; --primowords-muted: #c1d2cb;
        --primowords-link: #91dbbc; --primowords-border: #52665e; --primowords-error: #ffb4bf;
      }
    }
  `);

  function dismiss(restoreFocus = false) {
    const previous = overlay;
    if (!previous) return;
    overlay = undefined;
    previous.view?.dispose();
    previous.host.remove();
    if (restoreFocus && previous.focusBefore?.isConnected) previous.focusBefore.focus({ preventScroll: true });
  }

  function place() {
    if (!overlay?.host.isConnected) return;
    const { host, x, y } = overlay;
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? innerWidth;
    const height = viewport?.height ?? innerHeight;
    const margin = 8;
    const gap = 10;
    const style = (key, value) => host.style.setProperty(key, value, 'important');
    style('width', overlay.card ? `${Math.min(320, Math.max(0, width - margin * 2))}px` : '34px');
    style('--primowords-max-height', `${Math.max(0, height - margin * 2)}px`);
    const box = host.getBoundingClientRect();
    const preferredTop = y + gap + box.height <= top + height - margin ? y + gap : y - gap - box.height;
    style('left', `${Math.max(left + margin, Math.min(x + gap, left + width - box.width - margin))}px`);
    style('top', `${Math.max(top + margin, Math.min(preferredTop, top + height - box.height - margin))}px`);
  }

  function selectedSentence(selection) {
    if (selection.rangeCount !== 1) return '';
    const selected = selection.getRangeAt(0);
    const anchor = selected.startContainer.parentElement;
    const block = anchor?.closest('p, li, blockquote, pre, h1, h2, h3, h4, h5, h6, td, th, figcaption, div') || anchor;
    if (!block || !block.contains(selected.endContainer)) return '';
    const prefix = document.createRange();
    prefix.selectNodeContents(block);
    prefix.setEnd(selected.startContainer, selected.startOffset);
    const offset = prefix.toString().length;
    const start = Math.max(0, offset - 1200);
    const text = block.textContent.slice(start, offset + 1200);
    const index = offset - start;
    const sentence = sentenceSegmenter.segment(text).containing(index);
    if (!sentence) return '';
    const snippetStart = Math.max(0, index - sentence.index - 240);
    const snippet = sentence.segment.slice(snippetStart, snippetStart + 580).trim().replace(/\s+/g, ' ');
    return snippet;
  }

  function showTrigger(selected, x, y, source) {
    dismiss();
    // The worker may have gone idle since Chrome started. Warm it before lookup begins.
    void chrome.runtime.sendMessage({ type: 'warmup' }).catch(() => {});
    const host = document.createElement('div');
    host.style.cssText = 'all:initial!important;position:fixed!important;display:block!important;z-index:2147483647!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.adoptedStyleSheets = [sheet];
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'trigger';
    setAttribute(trigger, 'title', '用PrimoWords 查词');
    setAttribute(trigger, 'aria-label', '用PrimoWords 查词：{word}', { word: selected });
    const fallback = document.createElement('b');
    fallback.textContent = '原';
    fallback.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icon.png');
    icon.alt = '';
    icon.addEventListener('error', () => icon.remove(), { once: true });
    trigger.append(fallback, icon);
    shadow.append(trigger);
    const current = { host, shadow, x, y, selected, focusBefore: document.activeElement, card: null, view: null, trigger };
    overlay = current;
    document.documentElement.append(host);
    place();

    trigger.addEventListener('pointerdown', event => event.preventDefault());
    trigger.addEventListener('click', event => {
      if (!event.isTrusted || overlay !== current) return;
      openLookup(current, selected, source);
    });
  }

  function openLookup(current, selected, source) {
    if (overlay !== current) return;
    const view = create({ close: () => dismiss(true), layout: place });
    current.card = view;
    current.view = view;
    view.card.tabIndex = -1;
    current.shadow.replaceChildren(view.card);
    void view.lookup(selected, source);
    view.card.focus({ preventScroll: true });
  }

  document.addEventListener('dblclick', event => {
    if (!event.isTrusted || event.button !== 0 || event.composedPath().includes(overlay?.host)) return;
    const target = event.composedPath()[0];
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))) return;
    const isLink = target instanceof Element && Boolean(target.closest('a'));
    if (event.ctrlKey && isLink) return;
    const selection = window.getSelection();
    const selected = selection?.toString().trim();
    if (!selected || selected.length > 120 || !/^[a-z]+(?:[.'’-][a-z]+)*$/i.test(selected)) return;
    const source = {
      title: document.title.slice(0, 250),
      sentence: selectedSentence(selection),
    };
    showTrigger(selected, event.clientX, event.clientY, source);
    if (event.ctrlKey) openLookup(overlay, selected, source);
  }, true);

  document.addEventListener('pointerdown', event => {
    if (overlay && !event.composedPath().includes(overlay.host)) dismiss();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay) dismiss(Boolean(overlay.card));
  }, true);
  window.addEventListener('scroll', event => {
    if (overlay && !event.composedPath().includes(overlay.host)) dismiss();
  }, { capture: true, passive: true });
  window.addEventListener('resize', place);
  window.visualViewport?.addEventListener('resize', place);
  window.addEventListener('focus', () => void overlay?.card?.refreshAccount());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void overlay?.card?.refreshAccount();
  });
  i18n?.subscribe(() => {
    if (!overlay?.trigger) return;
    setAttribute(overlay.trigger, 'title', '用PrimoWords 查词');
    setAttribute(overlay.trigger, 'aria-label', '用PrimoWords 查词：{word}', { word: overlay.selected });
  });
})();
