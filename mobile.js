(function () {
  'use strict';
  var mobile = window.matchMedia('(max-width: 767px)');
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function button(text, label) { var b = document.createElement('button'); b.type = 'button'; b.textContent = text; if (label) b.setAttribute('aria-label', label); return b; }
  function shell() { try { return window.parent !== window && window.parent.ManualUI ? window.parent.ManualUI : null; } catch (_) { return null; } }
  function focus(el) { if (el && typeof el.focus === 'function') { try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); } } }

  // Called from the published common.js print branch after it selects large images.
  var printJob;
  window.ManualPrintReady = function () {
    if (printJob) return printJob;
    printJob = Promise.all(Array.prototype.map.call(document.images, function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (resolve) { var timer = setTimeout(done, 15000); function done() { clearTimeout(timer); img.removeEventListener('load', done); img.removeEventListener('error', done); resolve(); } img.addEventListener('load', done); img.addEventListener('error', done); });
    })).then(function () { return document.fonts ? Promise.race([document.fonts.ready, new Promise(function (resolve) { setTimeout(resolve, 5000); })]) : null; }).then(function () {
      return new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); });
    }).then(function () {
      if (window.opener && new URLSearchParams(location.search).get('print') === 'true') window.addEventListener('afterprint', function () { window.close(); }, { once: true });
      window.print();
    });
    return printJob;
  };
  if (typeof window.printSIE === 'function') window.printSIE = function () { var url = new URL(location.href); url.searchParams.set('print', 'true'); window.open(url.href, '_blank'); };

  function imageDialog(url, opener) {
    var existing = document.querySelector('.manual-image-dialog');
    if (existing) existing.close();
    var dialog = document.createElement('dialog');
    dialog.className = 'manual-image-dialog';
    dialog.setAttribute('aria-label', '圖片放大檢視');
    var head = document.createElement('div'); head.className = 'manual-image-head';
    var title = document.createElement('strong'); title.textContent = '圖片放大檢視';
    var close = button('關閉 ✕', '關閉圖片，回到文章');
    var frame = document.createElement('iframe'); frame.title = '圖片放大檢視與縮放工具';
    head.append(title, close); dialog.append(head, frame); document.body.appendChild(dialog);
    document.body.classList.add('manual-viewer-open');
    close.addEventListener('click', function () { dialog.close(); });
    var onMessage = function (event) { if (event.origin === location.origin && event.source === frame.contentWindow && event.data && event.data.type === 'manual-viewer-close') dialog.close(); };
    window.addEventListener('message', onMessage);
    dialog.addEventListener('close', function () { window.removeEventListener('message', onMessage); dialog.remove(); var another = document.querySelector('.manual-image-dialog[open]'); document.body.classList.toggle('manual-viewer-open', Boolean(another)); if (!another) focus(opener); }, { once: true });
    frame.src = url;
    dialog.showModal(); focus(close);
  }

  function setupShell() {
    var body = document.body, panel = document.querySelector('.mainLeftFrame'), content = document.querySelector('iframe[name="content"]');
    if (!panel || !content) return;
    var toolbar = document.createElement('div'); toolbar.className = 'manual-toolbar';
    var toggle = button('目錄 / 搜尋', '開啟目錄與搜尋'); toggle.id = 'manual-menu-toggle'; toggle.setAttribute('aria-expanded', 'false');
    panel.id = 'manual-navigation'; toggle.setAttribute('aria-controls', panel.id);
    var title = document.createElement('div'); title.className = 'manual-title';
    var logo = document.createElement('img'); logo.src = new URL('../icon/MMC_Corporate_Vertical_Mark_RGB.webp', location.href).href; logo.alt = 'MITSUBISHI'; logo.width = 26; logo.height = 30;
    var titleText = document.createElement('span'); titleText.textContent = '三菱服務手冊'; title.append(logo, titleText);
    var actions = document.createElement('div'); actions.className = 'manual-secondary';
    var back = button('返回', '回到上一個閱讀頁面');
    var bookmarks = button('書籤', '開啟書籤清單'); actions.append(back, bookmarks);
    var pwa = document.createElement('div'); pwa.className = 'pwa-controls';
    toolbar.append(toggle, title, actions, pwa); body.insertBefore(toolbar, body.firstChild);
    var drawerHead = document.createElement('div'); drawerHead.className = 'manual-drawer-head';
    var drawerTitle = document.createElement('strong'); drawerTitle.id = 'manual-navigation-title'; drawerTitle.textContent = '目錄與搜尋';
    var close = button('✕', '關閉目錄與搜尋'); drawerHead.append(drawerTitle, close);
    var drawerActions = document.createElement('div'); drawerActions.className = 'manual-drawer-actions';
    var mobileBack = button('← 返回上一頁'), mobileBookmarks = button('書籤清單'); drawerActions.append(mobileBack, mobileBookmarks);
    panel.insertBefore(drawerActions, panel.firstChild); panel.insertBefore(drawerHead, panel.firstChild);
    var mask = document.createElement('div'); mask.className = 'manual-drawer-mask'; mask.setAttribute('aria-hidden', 'true'); body.appendChild(mask);
    var savedFocus = toggle;
    function blockBackground(block) { document.querySelectorAll('.contentFrame,.headersFrame,.footerFrame,.manual-toolbar .pwa-controls').forEach(function (e) { e.inert = block; }); }
    function closeMenu(navigated) {
      var wasOpen = body.classList.contains('manual-menu-open');
      body.classList.remove('manual-menu-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', '開啟目錄與搜尋');
      panel.removeAttribute('aria-modal'); panel.setAttribute('role', 'navigation'); panel.inert = mobile.matches;
      blockBackground(false);
      var resultClose = document.querySelector('.moca-search-results.is-open .moca-search-results__close'); if (resultClose) resultClose.click();
      var input = document.querySelector('.moca-search-input'); if (input) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      if (wasOpen) focus(navigated ? content : savedFocus);
    }
    function openMenu() {
      if (!mobile.matches) { focus(document.querySelector('.moca-search-input')); return; }
      savedFocus = document.activeElement;
      panel.inert = false; body.classList.add('manual-menu-open'); toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', '關閉目錄與搜尋');
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', drawerTitle.id);
      blockBackground(true); focus(close);
    }
    toggle.addEventListener('click', function () { if (body.classList.contains('manual-menu-open')) closeMenu(false); else openMenu(); });
    close.addEventListener('click', function () { closeMenu(false); }); mask.addEventListener('click', function () { closeMenu(false); });
    function goBack() { closeMenu(true); try { content.contentWindow.history.back(); } catch (_) {} }
    function showBookmarks() { closeMenu(true); content.src = new URL('../html/bookmark.html', location.href).href; }
    back.addEventListener('click', goBack); mobileBack.addEventListener('click', goBack); bookmarks.addEventListener('click', showBookmarks); mobileBookmarks.addEventListener('click', showBookmarks);
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && body.classList.contains('manual-menu-open')) { event.preventDefault(); closeMenu(false); } });
    document.addEventListener('focusin', function (event) {
      if (body.classList.contains('manual-menu-open') && !panel.contains(event.target) && event.target !== toggle && !event.target.closest('.moca-search-results,.moca-search-suggestions')) focus(close);
    });
    content.addEventListener('load', function () { if (body.classList.contains('manual-menu-open')) closeMenu(true); });
    function applyBreakpoint() { closeMenu(false); panel.inert = mobile.matches; }
    if (mobile.addEventListener) mobile.addEventListener('change', applyBreakpoint); else mobile.addListener(applyBreakpoint);
    applyBreakpoint();
    document.querySelectorAll('iframe').forEach(function (f) { if (!f.title) f.title = ({ header: '手冊工具', subheader: '車型與年式', doctype: '手冊類型', outline: '章節目錄', content: '手冊文章' })[f.name] || '手冊頁尾'; });
    window.ManualUI = { openMenu: openMenu, closeMenu: closeMenu, openImage: function (url, opener) { closeMenu(false); imageDialog(url, opener || content); }, isMenuOpen: function () { return body.classList.contains('manual-menu-open'); } };
    window.dispatchEvent(new Event('manual-toolbar-ready'));
  }

  function setupOutline() {
    var outline = document.getElementById('outline'); if (!outline) return;
    document.body.classList.add('manual-outline-page');
    function syncBranch(li) {
      if (!li || li.nodeType !== 1 || li.tagName !== 'LI' || li.classList.contains('link')) return;
      Array.prototype.forEach.call(li.children, function (child) { if (child.tagName === 'SPAN') child.setAttribute('aria-expanded', String(li.classList.contains('opened'))); });
    }
    outline.querySelectorAll('li:not(.link) > span').forEach(function (span) {
      var li = span.parentElement; if (!li) return;
      span.tabIndex = 0; span.setAttribute('role', 'button');
      syncBranch(li);
      span.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); span.click(); } });
    });
    // One observer for the real local outline node, including search-driven opens.
    if (outline.nodeType === 1 && outline.ownerDocument === document && outline instanceof window.Node) {
      var observer = new window.MutationObserver(function (records) { records.forEach(function (record) { syncBranch(record.target); }); });
      observer.observe(outline, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('click', function (event) { var a = event.target.closest('a[target="content"]'); if (a && shell()) setTimeout(function () { shell().closeMenu(true); }, 0); }, true);
  }

  function setupDoctype() {
    var select = document.querySelector('select[name="doctype"]'); if (!select) return;
    // A new named popup leaves installed mobile PWAs. Switch the complete manual instead.
    window.opendoc = function () {
      var value = select.value.split(',')[0]; if (!value) return;
      var target = new URL(value, location.href);
      try { if (window.parent !== window && window.parent.document.body.classList.contains('indexFrame')) { window.parent.location.href = target.href; return; } } catch (_) {}
      location.href = target.href;
    };
  }

  function setupArticle() {
    var article = document.querySelector('.servinfo'); if (!article) return;
    document.body.classList.add('manual-content-page');
    document.querySelectorAll('.siePrint').forEach(function (b) { b.setAttribute('aria-label', '列印本篇文章'); b.title = '列印本篇文章'; });
    document.querySelectorAll('.sieBookmark').forEach(function (b) { b.setAttribute('aria-label', '將本篇文章加入書籤'); b.title = '加入書籤'; });
    document.querySelectorAll('.prevsie a').forEach(function (a) { a.setAttribute('aria-label', '上一篇文章'); });
    document.querySelectorAll('.nextsie a').forEach(function (a) { a.setAttribute('aria-label', '下一篇文章'); });
    article.querySelectorAll('table').forEach(function (table) {
      if (table.parentElement.closest('table') || table.parentElement.classList.contains('manual-table-scroll')) return;
      var wrap = document.createElement('div'); wrap.className = 'manual-table-scroll';
      var wide = Array.prototype.some.call(table.rows, function (row) { return Array.prototype.reduce.call(row.cells, function (n, cell) { return n + cell.colSpan; }, 0) >= 4; });
      if (wide) { table.classList.add('manual-wide-table'); wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', '表格，可左右捲動'); }
      table.parentNode.insertBefore(wrap, table); wrap.appendChild(table);
    });
    var oldView = window.ViewLargeIllust;
    function view(src, name, rotate, opener) {
      if (!mobile.matches && oldView) return oldView(src, name, rotate);
      var url = new URL('large.html', location.href); url.searchParams.set('src', new URL(src, location.href).href); if (rotate && String(rotate) === '1') url.searchParams.set('rotate', '1');
      var parentShell = shell(); if (parentShell) parentShell.openImage(url.href, opener); else imageDialog(url.href, opener);
    }
    window.ViewLargeIllust = view;
    function pictureInfo(img) {
      if (!img || !img.closest('.servinfo') || img.classList.contains('attentionIcon')) return null;
      var a = img.closest('a[href]'), match = a && /ViewLargeIllust\(\s*(['"])(.*?)\1(?:\s*,\s*(['"])(.*?)\3)?(?:\s*,\s*([01]))?/i.exec(a.getAttribute('href'));
      var src = img.getAttribute('large') || (match && match[2]);
      if (!src && /\/img\//i.test(img.src) && Math.max(img.naturalWidth, img.width) > 100) src = img.getAttribute('src');
      return src ? { src: src, name: match && match[4], rotate: match && match[5], opener: a || img } : null;
    }
    article.querySelectorAll('img').forEach(function (img) {
      img.decoding = 'async';
      if (pictureInfo(img)) { img.classList.add('manual-zoomable'); if (!img.closest('a')) { img.tabIndex = 0; img.setAttribute('role', 'button'); img.setAttribute('aria-label', '放大圖片'); } }
    });
    article.addEventListener('click', function (event) { if (!mobile.matches) return; var info = pictureInfo(event.target.closest('img')); if (!info) return; event.preventDefault(); event.stopImmediatePropagation(); view(info.src, info.name, info.rotate, info.opener); }, true);
    article.addEventListener('keydown', function (event) { if (!mobile.matches || (event.key !== 'Enter' && event.key !== ' ')) return; var info = pictureInfo(event.target.closest('img')); if (info) { event.preventDefault(); view(info.src, info.name, info.rotate, info.opener); } });
    if (typeof window.bookmarkSIE === 'function') {
      var oldBookmark = window.bookmarkSIE;
      window.bookmarkSIE = function () {
        try { if (window.parent.subheader && window.parent.subheader.document) return oldBookmark(); } catch (_) {}
        if (typeof window.addBookmarkCookie !== 'function') return;
        var isN8 = /\/N8\//.test(location.pathname), path = (document.querySelector('.pathlist') || {}).textContent || '', title = (article.querySelector('.title > span') || {}).textContent || document.title, id = (article.querySelector('.sieid') || {}).textContent || article.id;
        var ok = window.addBookmarkCookie(isN8 ? '交車前檢查與定期保養' : '維修手冊', isN8 ? 'nd1101_01' : 'nd1025_01', 'OUTLANDER', '25-26MY', id, path.split(' - ')[0], title);
        document.querySelectorAll('.balloonOK').forEach(function (e) { e.style.display = ok ? 'inline' : 'none'; }); document.querySelectorAll('.balloonNG').forEach(function (e) { e.style.display = ok ? 'none' : 'inline'; }); var balloon = document.getElementById('balloon'); if (balloon) balloon.style.display = 'block';
      };
    }
    if (!shell() && window.parent === window && !new URLSearchParams(location.search).has('print')) {
      var home = document.createElement('a'); home.className = 'manual-root-link'; home.href = '../index/index.html'; home.textContent = '← 開啟手冊目錄與搜尋'; article.parentNode.insertBefore(home, article);
    }
    // The original header height changes when its breadcrumb wraps on a narrow phone.
    var header = document.querySelector('.sieHeader'); if (header && typeof window.adjustHeaderPadding === 'function') { new ResizeObserver(function () { window.adjustHeaderPadding(false); }).observe(header); window.adjustHeaderPadding(false); }
  }

  ready(function () {
    document.documentElement.lang = 'zh-Hant';
    if (document.body.classList.contains('indexFrame')) setupShell();
    setupOutline(); setupArticle(); setupDoctype();
    document.addEventListener('keydown', function (event) { var parentShell = shell(); if (event.key === 'Escape' && parentShell && parentShell.isMenuOpen()) { event.preventDefault(); parentShell.closeMenu(false); } });
    if (document.body.classList.contains('bookmarkBody') && typeof window.openBookmarkSIE === 'function') {
      window.openBookmarkSIE = function (url) {
        var target = new URL(url, location.href), section = /\/moca\/(N5|N8)\//i.exec(location.pathname), targetSection = /\/moca\/(N5|N8)\//i.exec(target.pathname);
        // Shared bookmark cookies include both manuals. Keep the parent manual's label accurate.
        if (shell() && section && targetSection && section[1] !== targetSection[1]) window.open(target.href, '_blank', 'noopener');
        else location.href = target.href;
      };
    }
  });
})();
