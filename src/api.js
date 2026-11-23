import { API_ENDPOINTS, API_ORIGIN, PRIVACY_POLICY_URL } from './config.js';

export { API_ENDPOINTS, PRIVACY_POLICY_URL };

class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function post(path, body, token) {
  let response;
  try {
    response = await fetch(new URL(path, API_ORIGIN), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('无法连接PrimoWords 服务，请检查网络后重试。');
  }
  if (!response.ok) {
    const messages = {
      400: 'PrimoWords 服务拒绝了请求，请检查输入后重试。',
      401: token ? '登录已失效，请重新登录。' : '邮箱、手机号或密码有误。',
      403: '此账号没有收藏权限，请在PrimoWords App 中查看。',
      429: '操作过于频繁，请稍后重试。',
    };
    throw new ApiError(response.status, messages[response.status] ?? `PrimoWords 服务暂不可用（HTTP ${response.status}），请稍后重试。`);
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('PrimoWords 服务返回了无法识别的响应。');
  return data;
}
