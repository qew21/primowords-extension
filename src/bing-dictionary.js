/* global chrome */
(() => {
  function clean(node) {
    return node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function extract(html) {
    // A detached template keeps the provider's markup inert. Only plain text leaves this page.
    const template = document.createElement('template');
    template.innerHTML = html;
    const page = template.content;
    const word = clean(page.querySelector('#headword h1'));
    if (!word) throw new Error('必应词典未返回可用词条。');

    const definitions = [...page.querySelectorAll('.qdef > ul > li')].flatMap(row => {
      const meaning = clean(row.querySelector('.def'));
      return meaning ? [{ pos: clean(row.querySelector('.pos')), meaning }] : [];
    }).slice(0, 6);
    if (!definitions.length) {
      for (const group of page.querySelectorAll('.each_seg > .li_pos')) {
        const pos = clean(group.querySelector('.pos_lin > .pos'));
        for (const sense of group.querySelectorAll('.de_seg > .se_lis .de_co')) {
          const meaning = clean(sense);
          if (meaning) definitions.push({ pos, meaning });
          if (definitions.length >= 6) break;
        }
        if (definitions.length >= 6) break;
      }
    }
    if (!definitions.length) throw new Error('必应词典未返回可用释义。');

    const examples = [];
    for (const row of page.querySelectorAll('#sentenceSeg .se_li')) {
      const en = clean(row.querySelector('.sen_en'));
      const zh = clean(row.querySelector('.sen_cn'));
      if (en && zh) examples.push({ en, zh });
      if (examples.length === 2) break;
    }
    const phonetics = [
      ['英', '#bigaud_uk', '.hd_pr'],
      ['美', '#bigaud_us', '.hd_prUS'],
    ].flatMap(([label, audio, selector]) => {
      const sibling = page.querySelector(audio)?.parentElement?.previousElementSibling;
      const value = clean(sibling).match(/\[([^\]]+)\]/)?.[1]
        ?? clean(page.querySelector(selector)).match(/\[([^\]]+)\]/)?.[1];
      return value ? [{ label, value }] : [];
    });
    return { word, definitions, examples, phonetics };
  }

  async function fetchWord(word) {
    if (typeof word !== 'string' || word.length > 120 || !/^[a-z]+(?:[.'-][a-z]+)*$/i.test(word)) {
      throw new Error('请输入或选中一个英文单词。');
    }
    const url = new URL('https://www.bing.com/dict/search');
    url.search = new URLSearchParams({ q: word, FORM: 'BDVSP6', cc: 'cn' }).toString();
    let response, html;
    try {
      response = await fetch(url, {
        credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(6500),
      });
      if (response.ok) html = await response.text();
    } catch {
      throw new Error('暂时无法连接必应词典，请检查网络后重试。');
    }
    if (!response.ok) throw new Error(`必应词典暂不可用（HTTP ${response.status}），请稍后重试。`);
    return extract(html);
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.target !== 'bing-dictionary' || sender.id !== chrome.runtime.id
      || (sender.url && !sender.url.startsWith(chrome.runtime.getURL('')))) return false;
    fetchWord(message.word).then(value => respond({ value }), error => respond({ error: error.message }));
    return true;
  });
})();
