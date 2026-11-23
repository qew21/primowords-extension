const frames = Object.fromEntries([...document.querySelectorAll('[data-workspace-frame]')]
  .map(frame => [frame.dataset.workspaceFrame, frame]));
const links = [...document.querySelectorAll('.primary-nav [data-workspace-route]')];
const loading = document.getElementById('workspace-loading');
const loadingMessage = document.getElementById('workspace-loading-message');
const retry = document.getElementById('workspace-retry');
const pages = { lookup: 'popup.html', history: 'history.html', settings: 'options.html' };
const pageRoutes = Object.fromEntries(Object.entries(pages).map(([route, page]) => [page, route]));
const lastSettingsHash = { value: '#account' };
const i18n = globalThis.primowordsI18n;
const setText = (element, source, values) => i18n?.setText ? i18n.setText(element, source, values) : (element.textContent = source);
let activeRoute;
let requestedFrameHash;
let loadingState = 'opening';

function readRoute() {
  const value = decodeURIComponent(location.hash.slice(1).split('?')[0]);
  const historyMatch = value.match(/^history(?:-(local|account|eudic))?$/);
  if (historyMatch) return { route: 'history', view: historyMatch[1] };
  return { route: value === 'lookup' ? 'lookup' : 'settings' };
}

function frameUrl(route, view, settingsHash) {
  const url = new URL(pages[route], location.href);
  url.searchParams.set('embed', '1');
  if (route === 'history' && view) url.searchParams.set('view', view);
  if (route === 'settings') url.hash = settingsHash || lastSettingsHash.value;
  return url.href;
}

function renderOpeningMessage(route) {
  const page = route === 'lookup' ? '查词' : route === 'history' ? '收藏历史' : '设置';
  setText(loadingMessage, '正在打开{page}…', { page: i18n?.t(page) ?? page });
}

function setFrameSource(route, url) {
  const frame = frames[route];
  frame.dataset.loaded = '';
  delete frame.dataset.failed;
  frame.dataset.source = url;
  loadingState = 'opening';
  renderOpeningMessage(route);
  retry.hidden = true;
  loading.hidden = false;
  frame.src = url;
}

function updateNav(route) {
  for (const link of links) {
    if (link.dataset.workspaceRoute === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function activate(state) {
  const { route, view } = state;
  activeRoute = route;
  updateNav(route);
  for (const [name, frame] of Object.entries(frames)) frame.hidden = name !== route;

  const frame = frames[route];
  if (!frame.dataset.loaded) {
    const url = frameUrl(route, view, requestedFrameHash);
    if (frame.dataset.source !== url) setFrameSource(route, url);
    else if (frame.dataset.failed) {
      loadingState = 'failed';
      loading.hidden = false;
    } else {
      loadingState = 'opening';
      renderOpeningMessage(route);
      loading.hidden = false;
    }
    requestedFrameHash = undefined;
    return;
  }

  loading.hidden = true;
  if (route === 'history' && view) {
    const tab = frame.contentDocument?.getElementById(`history-${view}`);
    if (tab && !tab.hidden && tab.getAttribute('aria-pressed') !== 'true') tab.click();
  }
  if (route === 'settings' && requestedFrameHash) {
    frame.contentWindow.location.hash = requestedFrameHash;
    lastSettingsHash.value = requestedFrameHash;
    requestedFrameHash = undefined;
  }
}

function requestRoute(route, { view, hash } = {}) {
  if (route === 'settings' && hash !== undefined) {
    requestedFrameHash = hash || '#account';
    lastSettingsHash.value = requestedFrameHash;
  } else if (route === 'settings') {
    requestedFrameHash = '#account';
    lastSettingsHash.value = '#account';
  }
  const key = route === 'history' && view ? `history-${view}` : route;
  if (location.hash === `#${key}`) activate({ route, view });
  else location.hash = key;
}

function routeFromFrame(frame) {
  const childDocument = frame.contentDocument;
  const childWindow = frame.contentWindow;
  if (!childDocument || !childWindow) return;
  const route = frame.dataset.workspaceFrame;

  childDocument.addEventListener('click', clickEvent => {
    if (clickEvent.defaultPrevented || !(clickEvent.target instanceof childWindow.Element)) return;
    const anchor = clickEvent.target.closest('a[href]');
    if (!anchor || (anchor.target && anchor.target !== '_self')) return;
    const target = new URL(anchor.href);
    if (target.origin !== location.origin) return;

    const current = new URL(childWindow.location.href);
    const targetPage = target.pathname.split('/').pop();
    if (targetPage === current.pathname.split('/').pop()) {
      clickEvent.preventDefault();
      if (target.hash && target.hash !== current.hash) childWindow.location.hash = target.hash;
      return;
    }

    const targetRoute = pageRoutes[targetPage];
    if (!targetRoute) return;
    clickEvent.preventDefault();
    const view = targetRoute === 'history' ? target.searchParams.get('view') : undefined;
    requestRoute(targetRoute, { view: ['local', 'account', 'eudic'].includes(view) ? view : undefined, hash: targetRoute === 'settings' ? target.hash : undefined });
  }, true);

  if (route === 'settings') {
    childWindow.addEventListener('hashchange', () => {
      lastSettingsHash.value = childWindow.location.hash || '#account';
    });
  }

  if (route === 'history') {
    childDocument.addEventListener('click', clickEvent => {
      if (!(clickEvent.target instanceof childWindow.Element)) return;
      const tab = clickEvent.target.closest('#history-account, #history-local, #history-eudic');
      if (!tab || tab.hidden) return;
      const view = tab.id.replace('history-', '');
      history.replaceState(null, '', `#history-${view}`);
    }, true);
  }

}

for (const [route, frame] of Object.entries(frames)) {
  frame.addEventListener('load', () => {
    if (!frame.dataset.source) return;
    let actualUrl;
    try {
      actualUrl = frame.contentWindow.location.href;
    } catch {
      actualUrl = '';
    }
    if (actualUrl === 'about:blank') return;
    if (actualUrl !== frame.dataset.source) {
      frame.dataset.loaded = '';
      if (activeRoute === route) {
        frame.dataset.failed = 'true';
        loadingState = 'failed';
        setText(loadingMessage, '页面未能打开，请重新加载扩展后重试。');
        retry.hidden = false;
        loading.hidden = false;
      }
      return;
    }
    frame.dataset.loaded = 'true';
    routeFromFrame(frame);
    if (activeRoute === route) {
      loading.hidden = true;
      loadingState = 'ready';
    }
  });
}

retry.addEventListener('click', () => {
  const frame = frames[activeRoute];
  const url = frame.dataset.source || frameUrl(activeRoute, readRoute().view, lastSettingsHash.value);
  frame.dataset.source = '';
  frame.src = 'about:blank';
  setTimeout(() => setFrameSource(activeRoute, url), 0);
});

document.querySelector('.primary-nav').addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('[data-workspace-route]');
  if (!link) return;
  event.preventDefault();
  requestRoute(link.dataset.workspaceRoute);
});

document.querySelector('.brand-lockup').addEventListener('click', event => {
  event.preventDefault();
  requestRoute(event.currentTarget.dataset.workspaceRoute);
});

window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.type !== 'primowords-workspace-settings') return;
  if (!Object.values(frames).some(frame => frame.contentWindow === event.source)) return;
  requestRoute('settings');
});

window.addEventListener('hashchange', () => {
  const state = readRoute();
  activate(state);
});

i18n?.subscribe(() => {
  if (loadingState === 'opening' && activeRoute) renderOpeningMessage(activeRoute);
});

const initial = readRoute();
activate(initial);
