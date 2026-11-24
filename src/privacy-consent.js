/* global chrome */
(() => {
  const STORAGE_KEY = 'privacyDisclosureConsentVersion';
  const VERSION = '1';

  async function hasConsent() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] === VERSION;
  }

  async function accept() {
    await chrome.storage.local.set({ [STORAGE_KEY]: VERSION });
  }

  async function requireAccepted() {
    try {
      if (await hasConsent()) return true;
    } catch {
      // The consent workspace presents a visible storage error and retry action.
    }
    const target = chrome.runtime.getURL('workspace.html#consent');
    if (location.href !== target) location.replace(target);
    return false;
  }

  globalThis.primowordsPrivacyConsent = Object.freeze({ STORAGE_KEY, VERSION, hasConsent, accept, requireAccepted });
})();
