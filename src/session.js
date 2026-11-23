/* global chrome */
export const SESSION_KEY = 'primowordsSession';

let access;
export function restrictStorage() {
  access ??= chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(error => {
    access = undefined;
    throw error;
  });
  return access;
}

export async function readSession() {
  await restrictStorage();
  const account = (await chrome.storage.local.get(SESSION_KEY))[SESSION_KEY];
  if (account === undefined) return null;
  try {
    if (typeof account.id !== 'string' || typeof account.token !== 'string') throw new Error();
    const [, segment] = account.token.split('.');
    const { exp, sub } = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')));
    if (!Number.isFinite(exp) || typeof sub !== 'string' || !sub) throw new Error();
    return Date.now() < exp * 1000 ? { ...account, userId: sub } : null;
  } catch {
    throw new Error('PrimoWords 登录记录格式无效，请在设置中清除后重新登录。');
  }
}

export async function writeSession(account) {
  await restrictStorage();
  await chrome.storage.local.set({ [SESSION_KEY]: account });
}

export async function removeSession() {
  await restrictStorage();
  await chrome.storage.local.remove(SESSION_KEY);
}
