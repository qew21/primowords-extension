/* global chrome */
(() => {
  const i18n = globalThis.primowordsI18n;
  const setText = (node, source, values) => i18n?.setText ? i18n.setText(node, source, values) : (node.textContent = source);
  const setAttribute = (node, name, source, values) => i18n?.setAttribute ? i18n.setAttribute(node, name, source, values) : node.setAttribute(name, source);

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  async function send(type, fields) {
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type, ...fields });
    } catch {
      throw new Error('无法连接PrimoWords 扩展，请刷新网页后重试。');
    }
    if (response?.error) throw new Error(response.error);
    if (!response?.value) throw new Error('未收到PrimoWords 扩展的响应，请重试。');
    return response.value;
  }

  function create({ close, layout = () => {}, onIdentity = () => {} } = {}) {
    const card = element('section', 'word-card');
    card.setAttribute('aria-label', 'PrimoWords 查词');
    const heading = element('div', 'card-heading');
    const headwordRow = element('div', 'headword-row');
    const word = element('h2', 'headword');
    const speak = element('button', 'word-speak');
    speak.type = 'button';
    speak.hidden = true;
    speak.title = '朗读单词';
    speak.setAttribute('aria-label', '朗读单词');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', 'M11 5 6 9H3v6h3l5 4V5Zm4 4a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12');
    svg.append(path);
    speak.append(svg);
    headwordRow.append(word, speak);
    heading.append(headwordRow);
    let headerSettings, nickname;
    if (close) {
      const tools = element('div', 'card-tools');
      nickname = element('span', 'card-nickname');
      nickname.hidden = true;
      headerSettings = element('button', 'card-close card-options', '设置');
      headerSettings.type = 'button';
      const button = element('button', 'card-close', '×');
      button.type = 'button';
      button.setAttribute('aria-label', '关闭查词');
      button.addEventListener('click', close);
      tools.append(nickname, headerSettings, button);
      heading.append(tools);
    }
    const phonetic = element('p', 'phonetic');
    const metadata = element('div', 'word-metadata');
    const level = element('span', 'word-level');
    const frequency = element('span', 'word-frequency');
    metadata.append(level, frequency);
    const definition = element('p', 'definition');
    const senses = element('ul', 'dictionary-senses');
    const examples = element('section', 'dictionary-examples');
    const source = element('p', 'note');
    const note = element('p', 'note');
    const actions = element('div', 'card-actions');
    const favorite = element('button', 'card-button', '收藏到 PrimoWords');
    const settings = element('button', 'card-settings', '前往设置登录');
    const history = element('button', 'card-history', '收藏历史');
    favorite.type = settings.type = history.type = 'button';
    actions.append(favorite, settings, history);
    const status = element('p', 'card-status');
    status.setAttribute('role', 'status');
    const favoriteStatus = element('p', 'card-status is-error');
    favoriteStatus.setAttribute('role', 'status');
    const speechStatus = element('p', 'card-status is-error');
    speechStatus.setAttribute('role', 'status');
    card.append(heading, phonetic, metadata, definition, senses, examples, source, note, actions, favoriteStatus, status, speechStatus);

    let term, account, destination, origin, saved, busy = false, revision = 0, favoriteRevision = 0, identityRevision = 0;
    let lookingUpOnline = false, onlineDefinition = '';
    let sentenceTranslation = '';

    function showStatus(message = '', error = false) {
      setText(status, message);
      status.classList.toggle('is-error', error);
      i18n?.localize(card);
      layout();
    }

    function render() {
      level.textContent = term?.level ?? '';
      const ranks = [];
      if (term?.cocaRank) ranks.push(`COCA #${term.cocaRank}`);
      if (term?.bncRank) ranks.push(`BNC #${term.bncRank}`);
      frequency.textContent = term?.found ? (ranks.join(' · ') || '暂无词频数据') : '';
      note.textContent = '';
      if (destination === 'account' && term?.eligible && term.canonical !== term.word) {
        const targetLevel = term.favoriteLevel === term.level ? '' : i18n?.t('（{level}）', { level: i18n?.t(term.favoriteLevel) ?? term.favoriteLevel }) ?? `（${term.favoriteLevel}）`;
        setText(note, '将收藏词条：{word}{level}', { word: term.canonical, level: targetLevel });
      }
      favorite.hidden = !term || !destination || (destination === 'account' && !account);
      settings.hidden = destination !== 'account' || account !== null;
      history.hidden = !term;
      favorite.disabled = busy || lookingUpOnline || saved !== false;
      const label = destination === 'account' ? 'PrimoWords' : destination === 'eudic' ? '欧路' : '本地';
      const favoriteLabel = busy ? '正在收藏…' : saved && destination === 'account' ? '已收藏' :
        saved ? '已收藏到{destination}' : '收藏到{destination}';
      setText(favorite, favoriteLabel, favoriteLabel.includes('{destination}')
        ? { destination: i18n?.t(label) ?? label } : undefined);
      i18n?.localize(card);
      layout();
    }

    async function refreshAccount() {
      const current = ++favoriteRevision;
      const lookupRevision = revision;
      const identityRequest = ++identityRevision;
      const isCurrent = () => current === favoriteRevision && lookupRevision === revision;
      void send('identity').then(result => renderIdentity(result.label), () => renderIdentity(''));
      function renderIdentity(label) {
        if (identityRequest !== identityRevision || lookupRevision !== revision) return;
        if (nickname) {
          setText(nickname, label);
          setAttribute(nickname, 'title', label);
          nickname.hidden = !label;
          i18n?.localize(card);
          layout();
        }
        onIdentity(label);
      }
      if (!term) return;
      try {
        const { id, target, bookName, saved: alreadySaved } = await send('favorite-state', { word: term.word });
        if (!isCurrent()) return;
        favoriteStatus.textContent = '';
        account = id;
        destination = target;
        if (bookName) setAttribute(favorite, 'title', '欧路词本 · {bookName}', { bookName });
        else favorite.removeAttribute('title');
        saved = alreadySaved;
        render();
      } catch (error) {
        if (!isCurrent()) return;
        account = destination = saved = undefined;
        setText(favoriteStatus, error.message);
        render();
      }
    }

    async function lookup(input, fromPage = null) {
      const current = ++revision;
      origin = fromPage;
      speak.hidden = true;
      speak.disabled = false;
      speak.removeAttribute('aria-busy');
      favoriteStatus.textContent = speechStatus.textContent = '';
      term = account = destination = saved = undefined;
      busy = lookingUpOnline = false;
      onlineDefinition = '';
      sentenceTranslation = '';
      word.textContent = input;
      phonetic.textContent = definition.textContent = source.textContent = '';
      senses.replaceChildren();
      examples.replaceChildren();
      render();
      showStatus('正在查词…');
      try {
        const result = await send('lookup', { word: input });
        if (current !== revision || !card.isConnected) return;
        term = result;
        lookingUpOnline = !term.level;
        word.textContent = term.word;
        speak.hidden = false;
        phonetic.textContent = term.phonetic ? `/${term.phonetic}/` : '';
        definition.textContent = term.definition || (term.level ? '离线词典暂无释义。' : '');
        render();
        void refreshAccount();
        if (term.level) {
          showStatus();
        } else {
          if (term.definition) source.textContent = '离线词典';
          showStatus('正在查必应词典…');
          const entry = await send('bing-lookup', { word: input });
          if (current !== revision || !card.isConnected) return;
          word.textContent = entry.word;
          if (entry.phonetics.length) {
            phonetic.textContent = entry.phonetics.map(item => `${item.label} /${item.value}/`).join(' · ');
          }
          definition.textContent = '';
          onlineDefinition = entry.definitions.map(({ pos, meaning }) => [pos, meaning].filter(Boolean).join(' ')).join('\n');
          for (const { pos, meaning } of entry.definitions) {
            const row = element('li', '', meaning);
            if (pos) row.prepend(element('span', 'dictionary-pos', pos));
            senses.append(row);
          }
          if (entry.examples.length) {
            const comparable = value => value?.trim().replace(/\s+/g, ' ');
            const match = entry.examples.find(({ en }) => comparable(en) === comparable(origin?.sentence));
            sentenceTranslation = match?.zh || '';
            examples.append(element('h3', '', '例句'));
            for (const { en, zh } of entry.examples) {
              const pair = element('div', 'example-pair');
              const english = element('p', '', en);
              english.lang = 'en';
              pair.append(english, element('p', 'example-meaning', zh));
              examples.append(pair);
            }
          }
          source.textContent = '必应词典';
          showStatus();
        }
      } catch (error) {
        if (current === revision) showStatus(error.message, true);
      } finally {
        if (current === revision && lookingUpOnline) {
          lookingUpOnline = false;
          render();
        }
      }
    }

    speak.addEventListener('click', async event => {
      if (!event.isTrusted || speak.hidden || speak.disabled) return;
      const current = revision;
      speak.disabled = true;
      speak.setAttribute('aria-busy', 'true');
      speechStatus.textContent = '';
      layout();
      try {
        await send('speak-word', { word: word.textContent });
      } catch (error) {
        if (current === revision && card.isConnected) {
          setText(speechStatus, error.message);
          i18n?.localize(card);
        }
      } finally {
        if (current === revision && card.isConnected) {
          speak.disabled = false;
          speak.removeAttribute('aria-busy');
          layout();
        }
      }
    });

    favorite.addEventListener('click', async event => {
      if (!event.isTrusted || !term || favorite.hidden || favorite.disabled) return;
      const current = revision;
      const expectedAccount = account;
      const expectedDestination = destination;
      busy = true;
      favoriteStatus.textContent = '';
      render();
      try {
        const response = await send('save', {
          word: term.word, account: expectedAccount, destination: expectedDestination, source: origin, definition: onlineDefinition,
          sentenceTranslation,
        });
        if (current !== revision) return;
        if (response.recheck) {
          await refreshAccount();
          if (current === revision) setText(favoriteStatus, response.error);
        } else if (account === expectedAccount && destination === expectedDestination) {
          ++favoriteRevision;
          saved = true;
          if (response.notice) showStatus(response.notice);
        }
      } catch (error) {
        if (current === revision) setText(favoriteStatus, error.message);
      } finally {
        if (current === revision) {
          busy = false;
          render();
        }
      }
    });
    async function openSettings(event) {
      if (!event.isTrusted) return;
      const workspace = new URL(chrome.runtime.getURL('workspace.html'));
      try {
        const top = new URL(window.top.location.href);
        if (top.origin === workspace.origin && top.pathname === workspace.pathname) {
          window.top.postMessage({ type: 'primowords-workspace-settings' }, workspace.origin);
          return;
        }
      } catch {
        // Content scripts on cross-origin frames keep using the regular settings page.
      }
      try {
        await send('settings');
      } catch (error) {
        showStatus(error.message, true);
      }
    }
    settings.addEventListener('click', openSettings);
    headerSettings?.addEventListener('click', openSettings);
    history.addEventListener('click', async event => {
      if (!event.isTrusted || !term) return;
      const current = revision;
      try {
        await send('favorite-history', { destination });
      } catch (error) {
        if (current === revision) {
          setText(favoriteStatus, error.message);
          i18n?.localize(card);
          layout();
        }
      }
    });
    const unsubscribeLanguage = i18n?.subscribe(() => {
      render();
      i18n.localize(card);
    });
    render();
    return { card, lookup, refreshAccount, dispose: () => unsubscribeLanguage?.() };
  }

  const styles = `
    .word-card {
      box-sizing: border-box; width: 100%; padding: 14px;
      border: 1px solid var(--primowords-border, #cad8d2); border-radius: 13px;
      background: var(--primowords-paper, #fff); color: var(--primowords-text, #142621);
      font: 14px/1.55 system-ui, "Microsoft YaHei", sans-serif; text-align: start;
      overflow-wrap: anywhere;
    }
    .word-card [hidden] { display: none !important; }
    .word-card:focus { outline: none; }
    .card-heading { display: flex; align-items: start; justify-content: space-between; gap: 10px; }
    .card-tools { display: flex; align-items: center; gap: 3px; flex: none; }
    .card-nickname {
      min-width: 0; max-width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      color: var(--primowords-muted, #4e635c); font-size: 12px;
    }
    .headword-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .headword { margin: 0; color: inherit; font: 650 22px/1.25 system-ui, sans-serif; }
    .word-speak {
      display: grid; place-items: center; flex: none; width: 32px; height: 32px;
      padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--primowords-link, #12634e);
    }
    .word-speak svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .word-speak:hover { background: var(--primowords-border, #e5eeea); }
    .word-speak:disabled { opacity: .6; cursor: default; }
    .word-card p { margin: 6px 0 0; font: inherit; }
    .word-card p:empty { display: none; }
    .word-metadata { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin-top: 7px; min-width: 0; }
    .word-metadata:not(:has(span:not(:empty))), .word-metadata span:empty { display: none; }
    .word-level {
      padding: 1px 7px; border: 1px solid var(--primowords-border, #cad8d2); border-radius: 6px;
      color: var(--primowords-link, #12634e); font-size: 12px; font-weight: 650;
    }
    .word-frequency { color: var(--primowords-muted, #4e635c); font-size: 12px; font-variant-numeric: tabular-nums; }
    .definition { white-space: pre-line; }
    .dictionary-senses { margin: 8px 0 0; padding-inline-start: 19px; }
    .dictionary-senses:empty, .dictionary-examples:empty { display: none; }
    .dictionary-senses li + li { margin-top: 4px; }
    .dictionary-pos { color: var(--primowords-muted, #4e635c); margin-inline-end: 5px; }
    .dictionary-examples { margin-top: 10px; border-top: 1px solid var(--primowords-border, #cad8d2); padding-top: 8px; }
    .dictionary-examples h3 { margin: 0; color: inherit; font: 650 13px/1.5 system-ui, sans-serif; }
    .example-pair + .example-pair { margin-top: 9px; }
    .word-card .example-meaning { color: var(--primowords-muted, #4e635c); margin-top: 2px; }
    .phonetic, .note, .card-status { color: var(--primowords-muted, #4e635c); }
    .card-status.is-error { color: var(--primowords-error, #a02534); }
    .card-actions:not(:has(:not([hidden]))) { display: none; }
    .card-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin-top: 11px; }
    .word-card button { appearance: none; font: inherit; cursor: pointer; }
    .card-button, .card-settings {
      padding: 6px 12px; min-height: 35px; border: 1px solid #12634e; border-radius: 7px;
      background: #12634e; color: #fff;
    }
    .card-settings { color: var(--primowords-link, #12634e); background: transparent; border-color: currentColor; }
    .card-history {
      min-height: 35px; padding: 6px 8px; border: 0; border-radius: 7px; background: transparent;
      color: var(--primowords-link, #12634e);
    }
    .card-history:hover { background: var(--primowords-border, #e5eeea); }
    .card-button:disabled { opacity: .65; cursor: default; }
    .card-close {
      display: grid; place-items: center; flex: none; width: 28px; height: 28px;
      border: 0; padding: 0; border-radius: 6px; background: transparent;
      color: var(--primowords-muted, #4e635c); font-size: 21px !important; line-height: 1 !important;
    }
    .card-close:hover { background: var(--primowords-border, #e5eeea); }
    .card-close.card-options { width: auto; padding: 0 5px; font-size: 12px !important; }
    .word-card button:focus-visible { outline: 2px solid var(--primowords-link, #12634e); outline-offset: 2px; }
  `;

  globalThis.primowordsLookupCard = { create, styles };
})();
