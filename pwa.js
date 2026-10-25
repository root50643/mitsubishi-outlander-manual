/* PWA controls run only in the two manual index documents. */
(function () {
  'use strict';
  if (!document.body || !document.body.classList.contains('indexFrame')) return;
  const script = document.currentScript;
  const root = new URL('./', script ? script.src : new URL('../../../', location.href));
  let registration;
  let installPrompt;
  let reloadForUpdate = false;
  let ready = false;
  let stateMessage = '離線功能準備中…';
  const isIOS = /iP(?:ad|hone|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  const style = document.createElement('style');
  style.textContent = `
    .pwa-button{min-height:44px;padding:8px 11px;border:1px solid #ccd3d9;border-radius:8px;background:#fff;color:#26333e;font:600 13px/1.2 system-ui,"Microsoft JhengHei",sans-serif;cursor:pointer;white-space:nowrap}
    .pwa-button:hover{background:#edf1f4}.pwa-button:focus-visible,.pwa-dialog button:focus-visible{outline:3px solid #be343a;outline-offset:2px}
    .pwa-button[data-online="false"]{border-color:#ac6920;color:#744300;background:#fff3df}
    .pwa-fallback-host{position:fixed;right:12px;bottom:calc(20px + env(safe-area-inset-bottom));z-index:25000;display:flex}
    .pwa-dialog{position:fixed;inset:0;z-index:70000;width:min(440px,calc(100% - 28px));max-height:calc(100dvh - 36px);margin:auto;padding:0;border:1px solid #d0d6dc;border-radius:14px;background:#fff;color:#26333e;box-shadow:0 18px 80px #0005;font:15px/1.65 system-ui,"Microsoft JhengHei",sans-serif;overflow:auto}
    .pwa-dialog::backdrop{background:#18232c88}.pwa-dialog:not([open]){display:none}.pwa-dialog h2{margin:0;font-size:19px}.pwa-dialog p{margin:12px 0}.pwa-dialog strong{font-weight:650}
    .pwa-dialog-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid #e3e6e9;z-index:1}
    .pwa-dialog-close{min-width:44px;min-height:44px;border:0;border-radius:8px;background:#eef1f3;color:#26333e;font:inherit;cursor:pointer}
    .pwa-dialog-content{padding:4px 20px 20px}.pwa-status{padding:10px 12px;border-radius:8px;background:#f1f4f6}.pwa-storage{font-variant-numeric:tabular-nums;color:#4f606e}
    .pwa-actions{display:flex;flex-direction:column;gap:10px;margin:16px 0}.pwa-actions button{width:100%;min-height:44px;padding:10px 14px;border:1px solid #cbd3da;border-radius:8px;background:#fff;color:#26333e;font:inherit;cursor:pointer;text-align:center}.pwa-actions button[data-primary]{border-color:#303b45;background:#303b45;color:#fff}.pwa-actions button:disabled{opacity:.55;cursor:wait}.pwa-actions [hidden]{display:none!important}
    .pwa-small{font-size:13px;color:#62717c}.pwa-dialog[open]{display:block}
    @media(max-width:420px){.pwa-button{font-size:12px;padding:7px 9px}.pwa-dialog-content{padding-left:16px;padding-right:16px}}
  `;
  document.head.append(style);

  const button = document.createElement('button');
  button.className = 'pwa-button';
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'pwa-dialog');
  button.title = '查看離線狀態、安裝與更新';
  const dialog = document.createElement('dialog');
  dialog.id = 'pwa-dialog';
  dialog.className = 'pwa-dialog';
  dialog.setAttribute('aria-labelledby', 'pwa-dialog-title');
  dialog.innerHTML = '<div class="pwa-dialog-head"><h2 id="pwa-dialog-title">離線與安裝</h2><button class="pwa-dialog-close" type="button" aria-label="關閉離線與安裝">關閉</button></div>'
    + '<div class="pwa-dialog-content"><p class="pwa-status" id="pwa-status" role="status" aria-live="polite"></p>'
    + '<p>已瀏覽的文章與圖片會儲存在這台裝置，離線時可再次閱讀。未儲存的章節仍需要連網。</p>'
    + '<p class="pwa-storage" id="pwa-storage"></p><div class="pwa-actions">'
    + '<button type="button" data-primary id="pwa-install" hidden>加入主畫面</button>'
    + '<button type="button" data-primary id="pwa-update" hidden>更新並重新載入</button>'
    + '<button type="button" id="pwa-clear" disabled>清除已瀏覽內容的離線快取</button>'
    + '</div><p id="pwa-install-help" class="pwa-small"></p>'
    + '<p class="pwa-small">最近瀏覽內容最多儲存 200 MiB，滿額時移除較舊內容。清除快取會保留目錄、搜尋介面、書籤與搜尋紀錄。</p>'
    + '<p id="pwa-version" class="pwa-small"></p></div>';
  document.body.append(dialog);
  const statusElement = dialog.querySelector('#pwa-status');
  const storageElement = dialog.querySelector('#pwa-storage');
  const installButton = dialog.querySelector('#pwa-install');
  const updateButton = dialog.querySelector('#pwa-update');
  const clearButton = dialog.querySelector('#pwa-clear');
  const helpElement = dialog.querySelector('#pwa-install-help');

  function mountButton() {
    let host = document.querySelector('.manual-toolbar .pwa-controls') || document.querySelector('.pwa-controls');
    const fallback = document.querySelector('.pwa-fallback-host');
    if (!host) {
      host = fallback || document.createElement('div');
      if (!fallback) { host.className = 'pwa-fallback-host'; document.body.append(host); }
    }
    host.append(button);
    if (fallback && fallback !== host) fallback.remove();
    host.dataset.pwaState = ready ? 'ready' : 'preparing';
  }

  function render() {
    button.dataset.online = String(navigator.onLine);
    button.textContent = navigator.onLine ? '離線／安裝' : '目前離線';
    button.setAttribute('aria-label', navigator.onLine ? '離線與安裝設定' : '目前離線，查看已儲存內容狀態');
    statusElement.textContent = (navigator.onLine ? '目前已連網。' : '目前離線。') + stateMessage;
    installButton.hidden = !installPrompt || standalone();
    updateButton.hidden = !(registration && registration.waiting);
    clearButton.disabled = !ready;
    document.documentElement.dataset.pwaReady = String(ready);
    const host = button.parentElement;
    if (host) host.dataset.pwaState = ready ? 'ready' : 'preparing';
    if (standalone()) {
      helpElement.textContent = '已在獨立應用程式視窗中開啟。';
    } else if (isIOS) {
      helpElement.textContent = 'iPhone／iPad：在 Safari 點選「分享」，再選擇「加入主畫面」。';
    } else if (!installPrompt) {
      helpElement.textContent = '可從瀏覽器選單選擇「安裝應用程式」或「加入主畫面」。安裝選項依瀏覽器而異。';
    } else {
      helpElement.textContent = '加入主畫面後，可用獨立視窗開啟手冊。';
    }
  }

  function workerMessage(type) {
    return new Promise((resolve, reject) => {
      const worker = navigator.serviceWorker && (navigator.serviceWorker.controller || (registration && registration.active));
      if (!worker) { reject(new Error('離線功能尚未就緒。')); return; }
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('讀取離線狀態逾時，請稍後重試。')); }, 15000);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
      worker.postMessage({ type }, [channel.port2]);
    });
  }

  async function refreshStatus() {
    if (!ready) { render(); return; }
    try {
      const result = await workerMessage('GET_STATUS');
      if (!result.ok) throw new Error(result.message || '無法讀取離線狀態。');
      ready = result.ready;
      stateMessage = result.ready ? '離線功能已就緒。' : '離線介面尚未完整儲存，請連網後重新載入。';
      storageElement.textContent = '已儲存 ' + result.entries + ' 個內容資源，使用 '
        + (result.bytes / 1024 / 1024).toFixed(1) + ' / 200 MiB。';
      dialog.querySelector('#pwa-version').textContent = '網站版本：' + result.version;
    } catch (error) {
      storageElement.textContent = error.message;
    }
    render();
  }

  button.addEventListener('click', () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    refreshStatus();
  });
  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    button.focus();
  }
  dialog.querySelector('.pwa-dialog-close').addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
  } });
  dialog.addEventListener('cancel', () => { setTimeout(() => button.focus(), 0); });
  clearButton.addEventListener('click', async () => {
    clearButton.disabled = true;
    try {
      const result = await workerMessage('CLEAR_RUNTIME');
      if (!result.ok) throw new Error('無法清除快取，請稍後重試。');
      await refreshStatus();
      stateMessage = '已清除文章與圖片快取，離線介面已保留。';
    } catch (error) { stateMessage = error.message; }
    render();
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    installButton.disabled = true;
    try { await installPrompt.prompt(); await installPrompt.userChoice; } finally {
      installPrompt = null; installButton.disabled = false; render();
    }
  });
  updateButton.addEventListener('click', () => {
    if (!registration || !registration.waiting) return;
    updateButton.disabled = true;
    reloadForUpdate = true;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  });
  window.addEventListener('manual-toolbar-ready', mountButton);
  window.addEventListener('online', () => { render(); refreshStatus(); });
  window.addEventListener('offline', () => { render(); refreshStatus(); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; render(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; render(); });
  mountButton();
  render();

  if (!('serviceWorker' in navigator) || !window.isSecureContext || !/^https?:$/.test(location.protocol)) {
    stateMessage = '離線與安裝功能需要 HTTPS 或本機預覽伺服器。';
    render();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadForUpdate) { location.reload(); return; }
    ready = true; refreshStatus();
  });
  navigator.serviceWorker.register(new URL('sw.js', root).href, { scope: root.href, updateViaCache: 'none' })
    .then(async value => {
      registration = value;
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            stateMessage = '有新版本可用，可在方便時更新。'; render();
          }
        });
      });
      render();
      await navigator.serviceWorker.ready;
      ready = true;
      await refreshStatus();
    }).catch(error => {
      stateMessage = '離線功能尚未準備完成，連網閱讀仍可使用。';
      storageElement.textContent = error.message;
      render();
    });
  window.manualPwa = { refreshStatus, root: root.href };
})();
