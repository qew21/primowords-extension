const origin = 'https://api.frdic.com';
export const EUDIC_PERMISSION = { origins: [`${origin}/*`] };

async function request(path, token, options = {}, allowMissing = false) {
  let response;
  try {
    response = await fetch(`${origin}/api/open/v1/studylist/${path}`, {
      ...options, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { Authorization: token, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch {
    throw new Error('无法连接欧路，请检查网络和扩展授权后重试。');
  }
  if (allowMissing && response.status === 404) return null;
  if (response.status === 401) throw new Error('欧路授权无效，请在设置中重新连接。');
  if (response.status === 403 || response.status === 429) throw new Error('欧路暂时拒绝请求，请稍后重试。');
  if (!response.ok) throw new Error(`欧路请求失败（HTTP ${response.status}），请重试。`);
  return response;
}

export async function eudicBooks(token) {
  const response = await request('category?language=en', token);
  const { data } = await response.json().catch(() => ({}));
  if (!Array.isArray(data) || !data.every(book => typeof book?.id === 'string' && book.id && typeof book.name === 'string')) {
    throw new Error('欧路未返回有效的词本列表，请重试。');
  }
  return data.map(({ id, name }) => ({ id, name }));
}

export async function addEudicWord({ token, bookId, syncSentence }, word, sentence) {
  const sendSentence = syncSentence !== false && Boolean(sentence);
  if (sendSentence) {
    const response = await request(`word?language=en&word=${encodeURIComponent(word)}`, token, {}, true);
    let existing = false;
    if (response) {
      const payload = await response.json();
      if (Array.isArray(payload?.data)) existing = payload.data.length > 0;
      else if (typeof (payload?.data ?? payload)?.word === 'string') existing = true;
      else throw new Error('欧路未返回有效的词条状态，请重试。');
    }
    if (!existing) {
      if (!/^(0|[1-9]\d{0,18})$/.test(bookId)) throw new Error('欧路词本编号无效，请在设置中重新连接。');
      // The context endpoint expects numeric IDs, some larger than JavaScript's safe integer range.
      const fields = JSON.stringify({ language: 'en', word, context_line: sentence });
      await request('word', token, {
        method: 'POST',
        body: fields.slice(0, -1) + `,"category_ids":[${bookId}]}`,
      });
      return '';
    }
  }
  await request('words', token, {
    method: 'POST',
    body: JSON.stringify({ id: bookId, language: 'en', words: [word] }),
  });
  return sendSentence ? '该词已在欧路收藏，保留了欧路已有的语境。' : '';
}
