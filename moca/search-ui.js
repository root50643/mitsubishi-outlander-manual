/**
 * 手冊離線搜尋 UI（Vanilla JS，相容 IE10+）
 * v4.0.5 — 支援 file:// 本機開啟，避免 iframe 跨域錯誤
 */
(function (window, document) {
  'use strict';

  var ENGINE = window.MocaSearchEngine;
  var SUGGESTION = window.MocaSearchSuggestion;
  var HISTORY = window.MocaSearchHistory;
  var HIGHLIGHT = window.MocaHighlightRenderer;
  var NORMALIZER = window.MocaSearchNormalizer;
  var MOCA_SEARCH_UI_VERSION = '4.0.5';
  window.MOCA_SEARCH_UI_VERSION = MOCA_SEARCH_UI_VERSION;

  var SECTION_LABELS = {
    N1: '技術資訊手冊',
    N5: '車間手冊',
    N7: '車體維修手冊',
    N8: '交車前檢查與定期保養'
  };

  var MAX_SUGGESTIONS = 10;
  var MAX_RESULTS = 200;
  var DIRECT_OPEN_SCORE = 400;
  var MIN_QUERY_CHARS = 1;
  var SUGGEST_DEBOUNCE_MS = 50;

  var state = {
    section: '',
    engine: null,
    query: '',
    activeIndex: -1,
    rows: [],
    mode: 'idle',
    suggestTimer: null,
    lastNavigatedUrl: '',
    lastNavigatedSection: ''
  };

  var ui = {};
  var lastSuggestionActivateAt = 0;
  var lastSuggestionActivateIndex = -1;

  function detectSection() {
    if (window.MOCA_SEARCH_SECTION) {
      return String(window.MOCA_SEARCH_SECTION).toUpperCase();
    }
    var host = document.getElementById('moca-search-host');
    if (host && host.getAttribute('data-section')) {
      return String(host.getAttribute('data-section')).toUpperCase();
    }
    var sources = [window.location.pathname, window.location.href];
    var baseEl = document.getElementsByTagName('base')[0];
    if (baseEl && baseEl.href) sources.push(baseEl.href);
    var i;
    for (i = 0; i < sources.length; i++) {
      var source = sources[i] || '';
      var match = source.match(/[/\\]moca[/\\](N[1578])[/\\]/i);
      if (match) return match[1].toUpperCase();
      match = source.match(/[/\\](N[1578])[/\\]index[/\\]/i);
      if (match) return match[1].toUpperCase();
      match = source.match(/[/\\](N[1578])[/\\]/i);
      if (match) return match[1].toUpperCase();
    }
    return '';
  }

  function normalizeData(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw.items && Array.isArray(raw.items)) return raw.items;
    if (raw.SEARCH_DATA && Array.isArray(raw.SEARCH_DATA)) return raw.SEARCH_DATA;
    return [];
  }

  function sectionLabel(section) {
    return SECTION_LABELS[section] || section;
  }

  function escapeHtml(text) {
    return HIGHLIGHT.escapeHtml(text);
  }

  function getFileNameFromUrl(relativeUrl) {
    return String(relativeUrl || '').replace(/^.*[/\\]/, '');
  }

  function getContentFrameElement() {
    var el = document.getElementById('content');
    if (el) return el;
    var named = document.getElementsByName('content');
    return named.length ? named[0] : null;
  }

  function isFileProtocol() {
    try {
      return window.location && window.location.protocol === 'file:';
    } catch (ignore) {
      return false;
    }
  }

  function getParentPageHref() {
    try {
      return String(window.location.href || '').replace(/[#?].*$/, '');
    } catch (ignore) {
      return '';
    }
  }

  function safeGetFrameDocument(frame) {
    if (!frame) return null;
    try {
      if (frame.document) return frame.document;
    } catch (ignore) {}
    return null;
  }

  function getContentFrame() {
    if (window.frames && window.frames.content) return window.frames.content;
    if (window.frames && window.frames['content']) return window.frames['content'];
    return null;
  }

  function getOutlineFrame() {
    if (window.frames && window.frames.outline) return window.frames.outline;
    if (window.frames && window.frames['outline']) return window.frames['outline'];
    return null;
  }

  function getOutlineFrameElement() {
    var frames = document.getElementsByTagName('iframe');
    var i;
    for (i = 0; i < frames.length; i++) {
      if (frames[i].name === 'outline') return frames[i];
    }
    return null;
  }

  function positionSuggestionsDropdown() {
    if (!ui.input || !ui.suggestions) return;
    var rect = ui.input.getBoundingClientRect();
    ui.suggestions.style.position = 'fixed';
    ui.suggestions.style.left = Math.round(rect.left) + 'px';
    ui.suggestions.style.top = Math.round(rect.bottom + 4) + 'px';
    ui.suggestions.style.width = Math.round(rect.width) + 'px';
    ui.suggestions.style.right = 'auto';
    ui.suggestions.style.zIndex = '100000';
  }

  function mountSuggestionsToBody() {
    if (!ui.suggestions) return;
    if (ui.suggestions.parentNode !== document.body) {
      document.body.appendChild(ui.suggestions);
    }
    positionSuggestionsDropdown();
  }

  function unmountSuggestionsFromBody() {
    if (!ui.suggestions || !ui.field) return;
    if (ui.suggestions.parentNode === document.body) {
      ui.field.appendChild(ui.suggestions);
    }
    ui.suggestions.style.position = '';
    ui.suggestions.style.left = '';
    ui.suggestions.style.top = '';
    ui.suggestions.style.width = '';
    ui.suggestions.style.right = '';
    ui.suggestions.style.zIndex = '';
  }

  function blockOutlineFrames(blocked) {
    var outlineWrap = document.querySelector('.outlineFrame');
    if (outlineWrap) outlineWrap.style.pointerEvents = blocked ? 'none' : '';
    var outlineIframe = getOutlineFrameElement();
    if (outlineIframe) outlineIframe.style.pointerEvents = blocked ? 'none' : '';
    var contentIframe = document.getElementById('content') || document.getElementsByName('content')[0];
    if (contentIframe) contentIframe.style.pointerEvents = blocked ? 'none' : '';
  }

  function setSuggestionsDropdownOpen(isOpen) {
    if (ui.host) {
      if (isOpen) ui.host.className = 'moca-search-host is-dropdown-open';
      else ui.host.className = 'moca-search-host';
    }
    if (isOpen) {
      mountSuggestionsToBody();
      blockOutlineFrames(true);
    } else {
      blockOutlineFrames(false);
      unmountSuggestionsFromBody();
    }
  }

  function isSuggestionsOpen() {
    return !!(ui.suggestions && ui.suggestions.className.indexOf('is-open') !== -1);
  }

  function isInsideSearchUi(target) {
    if (!target) return false;
    if (ui.host && ui.host.contains(target)) return true;
    if (ui.suggestions && ui.suggestions.contains(target)) return true;
    return false;
  }

  function isNonActionSuggestionTarget(target) {
    var node = target;
    while (node && node !== ui.suggestions) {
      if (node.className) {
        if (node.className.indexOf('moca-search-suggestion--empty') !== -1) return true;
        if (node.className.indexOf('moca-search-suggestion--header') !== -1) return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  function resolveEventTarget(e) {
    var target = e.target;
    if (!target) return target;
    if (ui.suggestions && ui.suggestions.contains(target)) return target;
    if (ui.host && ui.host.contains(target)) return target;
    if (typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return target;
    if (typeof document.elementFromPoint !== 'function') return target;
    var hit = document.elementFromPoint(e.clientX, e.clientY);
    if (hit) return hit;
    return target;
  }

  function onDocumentPointerDown(e) {
    if (!isSuggestionsOpen()) return;
    if (isInsideSearchUi(resolveEventTarget(e))) return;
    closeSuggestions();
  }

  function onWindowSuggestionPointerCapture(e) {
    if (!isSuggestionsOpen() || !ui.suggestions) return;
    var target = resolveEventTarget(e);
    if (!ui.suggestions.contains(target)) return;
    if (isNonActionSuggestionTarget(target)) return;
    var index = resolveSuggestionIndex(target);
    if (index < 0) return;
    e.preventDefault();
    e.stopPropagation();
    activateSuggestion(index);
  }

  function resolveRelativePath(baseDir, relative) {
    var parts = String(baseDir || '').replace(/\\/g, '/').split('/');
    var clean = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i]) clean.push(parts[i]);
    }
    var segments = String(relative || '').replace(/\\/g, '/').split('/');
    for (i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (seg === '..') clean.pop();
      else if (seg !== '.' && seg !== '') clean.push(seg);
    }
    return clean.join('/');
  }

  function joinUrlDir(dir, fileName) {
    if (!dir) return fileName;
    return dir.charAt(dir.length - 1) === '/' ? dir + fileName : dir + '/' + fileName;
  }

  function ensureTrailingSlash(url) {
    if (!url) return url;
    return url.charAt(url.length - 1) === '/' ? url : url + '/';
  }

  function stripUrlFileName(url) {
    var value = String(url || '').replace(/[#?].*$/, '');
    if (/^https?:\/\//i.test(value) || /^file:\/\//i.test(value)) {
      return /\/$/.test(value) ? value : value.replace(/\/[^/]*$/, '/');
    }
    return value.replace(/\/[^/]*$/, '/');
  }

  function toHtmlDirFromIndexBase(parentHref) {
    var parentPath = String(parentHref || '').replace(/[#?].*$/, '');
    parentPath = parentPath.replace(/\/index\/index\.html?$/i, '/html/');
    parentPath = parentPath.replace(/\/index\/?$/i, '/html/');
    return ensureTrailingSlash(parentPath);
  }

  function getEditorResourceBase() {
    var baseEl = document.getElementsByTagName('base')[0];
    if (!baseEl || !baseEl.href || baseEl.href.indexOf('/resources/') === -1) return null;
    var parentHref = baseEl.href.replace(/[#?].*$/, '');
    var match = parentHref.match(/^(.*\/resources\/)(.+)$/);
    if (!match) return null;
    var mocaMatch = match[2].match(/^(.*\/moca\/)(?:N[1578]\/)(.*)$/i);
    if (!mocaMatch) return null;
    return { resourceBase: match[1], mocaPrefix: mocaMatch[1] };
  }

  function buildEditorResourceUrlForSection(section, relativeUrl) {
    var base = getEditorResourceBase();
    if (!base || !section) return null;
    var fileName = getFileNameFromUrl(relativeUrl);
    if (!fileName) return null;
    return base.resourceBase + base.mocaPrefix + String(section).toUpperCase() + '/html/' + fileName;
  }

  function getEditorIndexUrlForSection(section) {
    var base = getEditorResourceBase();
    if (!base || !section) return '';
    return base.resourceBase + base.mocaPrefix + String(section).toUpperCase() + '/index/index.html';
  }

  function getContentHtmlBaseDir(frame) {
    var href = '';
    var parentHref = getParentPageHref();
    if (isFileProtocol()) {
      if (parentHref) return toHtmlDirFromIndexBase(parentHref);
      return null;
    }
    var frameDoc = safeGetFrameDocument(frame);
    if (frameDoc) {
      var baseEl = frameDoc.getElementsByTagName('base')[0];
      if (baseEl && baseEl.href) href = baseEl.href;
    }
    if (!href && frame) {
      try { href = frame.location.href; } catch (ignore) {}
    }
    if (href && href.indexOf('about:') !== 0 && href.indexOf('blob:') !== 0) {
      var frameDir = stripUrlFileName(href);
      if (frameDir.indexOf('/html/') !== -1) return ensureTrailingSlash(frameDir);
    }
    if (parentHref) {
      var parentPath = parentHref.replace(/[#?].*$/, '');
      if (/\/index(\/index\.html?)?\/?$/i.test(parentPath)) return toHtmlDirFromIndexBase(parentHref);
      if (/^https?:\/\//i.test(parentHref) || /^file:\/\//i.test(parentHref)) {
        return ensureTrailingSlash(stripUrlFileName(parentHref));
      }
      return ensureTrailingSlash(resolveRelativePath(parentPath, '../html'));
    }
    return null;
  }

  function resolveContentUrl(relativeUrl, section) {
    var raw = String(relativeUrl || '').trim();
    if (!raw) return raw;
    if (/^(https?:|file:|\/\/)/i.test(raw)) return raw;
    var editorUrl = buildEditorResourceUrlForSection(section, raw);
    if (editorUrl) return editorUrl;
    var fileName = getFileNameFromUrl(raw);
    var frame = getContentFrame();
    var baseDir = getContentHtmlBaseDir(frame);
    if (!baseDir) return raw;
    return joinUrlDir(baseDir, fileName);
  }

  function appendCacheBust(url) {
    if (!url) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + '_t=' + Date.now();
  }

  function isProjectEditorPreview() {
    var baseEl = document.getElementsByTagName('base')[0];
    return !!(baseEl && baseEl.href && baseEl.href.indexOf('/resources/') !== -1);
  }

  function tryEditorFreshNavigation(parentUrl, href, section) {
    try {
      if (!isProjectEditorPreview() || !href || window.top === window) return false;
      var trimmed = String(href).trim();
      if (/^(https?:|file:|\/\/|#|mailto:|tel:)/i.test(trimmed)) return false;
      var baseEl = document.getElementsByTagName('base')[0];
      var parentHref = parentUrl || getEditorIndexUrlForSection(section) ||
        (baseEl && baseEl.href ? baseEl.href.replace(/[#?].*$/, '') : '');
      if (!parentHref) return false;
      window.top.postMessage({ type: 'editor-navigate-content-fresh', parentUrl: parentHref, href: trimmed }, '*');
      return true;
    } catch (ignore) {
      return false;
    }
  }

  function revealOutlineNode(li) {
    if (!li) return;
    li.style.display = '';
    li.removeAttribute('data-moca-search-match');
    var parent = li.parentNode;
    while (parent) {
      if (parent.tagName === 'LI') {
        parent.style.display = '';
        if (parent.className.indexOf('opened') === -1) {
          parent.className = (parent.className + ' opened').replace(/^\s+/, '');
        }
        var lists = parent.getElementsByTagName('ul');
        var i;
        for (i = 0; i < lists.length; i++) lists[i].style.display = '';
      }
      parent = parent.parentNode;
    }
  }

  function clickOutlineAnchor(anchor, section) {
    if (!anchor) return false;
    var rawHref = anchor.getAttribute('href') || anchor.href;
    if (tryEditorFreshNavigation(null, rawHref, section)) return true;
    try {
      if (typeof anchor.click === 'function') { anchor.click(); return true; }
    } catch (ignore) {}
    try {
      var href = anchor.href || anchor.getAttribute('href');
      if (href) return setContentFrameUrl(href);
    } catch (ignore2) {}
    return false;
  }

  function setContentFrameUrl(targetUrl) {
    if (!targetUrl) return false;
    var bustUrl = appendCacheBust(targetUrl);
    var iframeEl = getContentFrameElement();
    if (iframeEl) {
      try {
        iframeEl.src = bustUrl;
        return true;
      } catch (ignore) {}
    }
    var frame = getContentFrame();
    if (frame) {
      try {
        frame.location.href = bustUrl;
        return true;
      } catch (ignore2) {}
    }
    return false;
  }

  function navigateViaOutline(relativeUrl, section) {
    if (isFileProtocol()) return false;
    var outlineWin = getOutlineFrame();
    var doc = safeGetFrameDocument(outlineWin);
    if (!doc) return false;
    var fileName = getFileNameFromUrl(relativeUrl);
    if (!fileName) return false;
    var topicId = fileName.replace(/\.html?$/i, '');
    var byId = doc.getElementById(topicId);
    if (byId) {
      revealOutlineNode(byId);
      if (clickOutlineAnchor(byId.getElementsByTagName('a')[0], section)) return true;
    }
    var links = doc.getElementsByTagName('a');
    var i;
    for (i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (href.indexOf(fileName) !== -1 || (topicId && href.indexOf(topicId) !== -1)) {
        var node = links[i].parentNode;
        while (node) {
          if (node.tagName === 'LI') { revealOutlineNode(node); break; }
          node = node.parentNode;
        }
        if (clickOutlineAnchor(links[i], section)) return true;
      }
    }
    return false;
  }

  function navigateContentTo(relativeUrl, section) {
    if (tryEditorFreshNavigation(getEditorIndexUrlForSection(section), relativeUrl, section)) return;
    if (!isFileProtocol() && navigateViaOutline(relativeUrl, section)) return;
    var targetUrl = resolveContentUrl(relativeUrl, section);
    if (!targetUrl) return;
    if (setContentFrameUrl(targetUrl)) return;
    var fileName = getFileNameFromUrl(relativeUrl);
    if (fileName) setContentFrameUrl(resolveContentUrl(fileName, section));
  }

  function openResult(item) {
    if (!item || !item.url) return;
    state.lastNavigatedUrl = item.url;
    state.lastNavigatedSection = item.section || state.section;
    navigateContentTo(item.url, item.section);
    closeResultsPanel();
    closeSuggestions();
  }

  function shouldOpenDirectly(results) {
    if (!results || !results.length) return false;
    if (results.length === 1) return true;
    if (results[0].score >= DIRECT_OPEN_SCORE) {
      if (!results[1] || results[0].score >= results[1].score + 20) return true;
    }
    return false;
  }

  function runSearch(query, options) {
    if (!state.engine) return { tokens: [], tokenInfo: null, results: [], ready: false };
    return state.engine.search(query, options || { minChars: MIN_QUERY_CHARS });
  }

  function bindUi() {
    ui.host = document.getElementById('moca-search-host');
    if (!ui.host) return false;

    ui.host.innerHTML =
      '<div class="moca-search-bar" role="search">' +
        '<div class="moca-search-field">' +
          '<span class="moca-search-icon" aria-hidden="true"></span>' +
          '<input type="text" class="moca-search-input" id="moca-search-input" autocomplete="off" ' +
            'placeholder="搜尋標題或內文（多關鍵字以空白分隔）" aria-label="搜尋本手冊" role="searchbox" />' +
          '<ul class="moca-search-suggestions" id="moca-search-suggestions" role="listbox"></ul>' +
        '</div>' +
        '<button type="button" class="moca-search-btn" id="moca-search-submit">搜尋</button>' +
      '</div>' +
      '<div class="moca-search-status" id="moca-search-status" aria-live="polite"></div>';

    ui.input = document.getElementById('moca-search-input');
    ui.submit = document.getElementById('moca-search-submit');
    ui.field = ui.host.querySelector('.moca-search-field');
    ui.suggestions = document.getElementById('moca-search-suggestions');
    ui.status = document.getElementById('moca-search-status');

    ui.results = document.createElement('div');
    ui.results.className = 'moca-search-results';
    ui.results.id = 'moca-search-results';
    ui.results.innerHTML =
      '<div class="moca-search-results__panel" role="dialog" aria-modal="true" aria-labelledby="moca-search-results-title">' +
        '<div class="moca-search-results__header">' +
          '<h2 class="moca-search-results__title" id="moca-search-results-title">搜尋結果</h2>' +
          '<button type="button" class="moca-search-results__close" id="moca-search-results-close" aria-label="關閉">×</button>' +
        '</div>' +
        '<div class="moca-search-results__meta" id="moca-search-results-meta"></div>' +
        '<div class="moca-search-results__body" id="moca-search-results-body"></div>' +
      '</div>';
    document.body.appendChild(ui.results);

    ui.resultsBody = document.getElementById('moca-search-results-body');
    ui.resultsMeta = document.getElementById('moca-search-results-meta');
    ui.resultsClose = document.getElementById('moca-search-results-close');

    var composing = false;
    ui.input.addEventListener('compositionstart', function () { composing = true; });
    ui.input.addEventListener('compositionend', function () { composing = false; scheduleSuggest(); });
    ui.input.addEventListener('input', function () { if (!composing) scheduleSuggest(); });
    ui.input.addEventListener('change', function () { if (!composing) scheduleSuggest(); });
    ui.input.addEventListener('paste', function () { setTimeout(scheduleSuggest, 0); });
    ui.input.addEventListener('focus', onInputFocus);
    ui.input.addEventListener('keydown', onInputKeydown);
    ui.submit.addEventListener('click', onSubmitClick);
    ui.suggestions.addEventListener('mousedown', onSuggestionMouseDown);
    ui.suggestions.addEventListener('click', onSuggestionClick);
    ui.resultsClose.addEventListener('click', closeResultsPanel);
    ui.results.addEventListener('click', function (e) {
      if (e.target === ui.results) closeResultsPanel();
    });
    window.addEventListener('mousedown', onWindowSuggestionPointerCapture, true);
    window.addEventListener('pointerdown', onWindowSuggestionPointerCapture, true);
    document.addEventListener('mousedown', onDocumentPointerDown, false);
    window.addEventListener('resize', function () {
      if (isSuggestionsOpen()) positionSuggestionsDropdown();
    });
    window.addEventListener('scroll', function () {
      if (isSuggestionsOpen()) positionSuggestionsDropdown();
    }, true);
    document.addEventListener('keydown', function (e) {
      var key = e.key || e.keyCode;
      var isEsc = key === 'Escape' || key === 'Esc' || key === 27;
      if (!isEsc) return;
      if (ui.results && ui.results.className.indexOf('is-open') !== -1) {
        closeResultsPanel();
        e.preventDefault();
      } else if (ui.suggestions && ui.suggestions.className.indexOf('is-open') !== -1) {
        closeSuggestions();
        e.preventDefault();
      }
    });
    return true;
  }

  function setStatus(message) {
    if (ui.status) ui.status.textContent = message || '';
  }

  function onInputFocus() {
    if (!NORMALIZER.normalizeSearchText(ui.input.value)) {
      showHistorySuggestions();
    } else {
      scheduleSuggest();
    }
  }

  function showHistorySuggestions() {
    var history = HISTORY.getHistory();
    state.mode = 'history';
    state.rows = SUGGESTION.buildHistoryRows(history);
    state.activeIndex = -1;
    renderSuggestionPanel();
  }

  function scheduleSuggest() {
    state.query = ui.input.value;
    if (state.suggestTimer) clearTimeout(state.suggestTimer);
    state.suggestTimer = setTimeout(refreshSuggestions, SUGGEST_DEBOUNCE_MS);
    if (NORMALIZER.getCharCount(state.query) >= MIN_QUERY_CHARS) {
      if (!isFileProtocol()) filterOutline(state.query);
    } else restoreOutlineFromFrame();
  }

  function restoreOutlineFromFrame() {
    if (isFileProtocol()) return;
    var doc = safeGetFrameDocument(getOutlineFrame());
    if (!doc) return;
    restoreOutline(doc);
  }

  function onSubmitClick() {
    executeSearch(ui.input.value, state.activeIndex);
  }

  function onInputKeydown(e) {
    var key = e.key || e.keyCode;
    var isEnter = key === 'Enter' || key === 13;
    var isEsc = key === 'Escape' || key === 'Esc' || key === 27;
    var isUp = key === 'ArrowUp' || key === 38;
    var isDown = key === 'ArrowDown' || key === 40;
    var isTab = key === 'Tab' || key === 9;

    if (isEsc) {
      closeSuggestions();
      closeResultsPanel();
      e.preventDefault();
      return;
    }
    if (isTab) {
      closeSuggestions();
      return;
    }
    if (isUp || isDown) {
      if (!state.rows.length) return;
      e.preventDefault();
      state.activeIndex = isDown
        ? Math.min(state.activeIndex + 1, state.rows.length - 1)
        : Math.max(state.activeIndex - 1, 0);
      renderSuggestionPanel();
      return;
    }
    if (isEnter) {
      e.preventDefault();
      if (state.mode === 'history' && state.activeIndex >= 0 && state.rows[state.activeIndex]) {
        ui.input.value = state.rows[state.activeIndex].query;
        closeSuggestions();
        executeSearch(ui.input.value, -1);
        return;
      }
      executeSearch(ui.input.value, state.activeIndex);
    }
  }

  function resolveSuggestionIndex(target) {
    var node = target;
    while (node) {
      if (node.hasAttribute && node.hasAttribute('data-index')) {
        return parseInt(node.getAttribute('data-index'), 10);
      }
      if (node === ui.suggestions) break;
      node = node.parentNode;
    }
    return -1;
  }

  function activateSuggestion(index) {
    if (isNaN(index) || index < 0) return;
    var now = Date.now();
    if (index === lastSuggestionActivateIndex && now - lastSuggestionActivateAt < 400) return;

    var row = state.rows[index];
    if (!row) return;

    lastSuggestionActivateAt = now;
    lastSuggestionActivateIndex = index;

    if (state.mode === 'history' && row.query) {
      ui.input.value = row.query;
      closeSuggestions();
      executeSearch(row.query, -1);
      return;
    }

    if (row.result && row.result.item) {
      HISTORY.addQuery(ui.input.value);
      openResult(row.result.item);
    }
  }

  function onSuggestionPointer(e) {
    if (isNonActionSuggestionTarget(e.target)) return;
    var index = resolveSuggestionIndex(e.target);
    if (index < 0) return;
    e.preventDefault();
    e.stopPropagation();
    activateSuggestion(index);
  }

  function onSuggestionMouseDown(e) {
    if (e.button !== 0) return;
    onSuggestionPointer(e);
  }

  function onSuggestionClick(e) {
    onSuggestionPointer(e);
  }

  function refreshSuggestions() {
    var query = state.query;
    if (!NORMALIZER.normalizeSearchText(query)) {
      showHistorySuggestions();
      setStatus(state.section ? sectionLabel(state.section) : '');
      return;
    }
    if (NORMALIZER.getCharCount(query) < MIN_QUERY_CHARS) {
      closeSuggestions();
      return;
    }

    var searched = runSearch(query, { minChars: MIN_QUERY_CHARS });
    state.mode = 'search';
    state.rows = SUGGESTION.buildSuggestionRows(
      searched.results,
      searched.tokens,
      searched.tokenInfo,
      MAX_SUGGESTIONS
    );
    state.lastSearch = searched;
    if (state.activeIndex >= state.rows.length) state.activeIndex = state.rows.length - 1;
    renderSuggestionPanel();

    if (!state.rows.length) setStatus('');
    else setStatus('找到 ' + searched.results.length + ' 筆');
  }

  function renderSuggestionPanel() {
    if (!ui.suggestions) return;

    if (!state.rows.length) {
      if (state.mode === 'history') {
        ui.suggestions.innerHTML =
          '<li class="moca-search-suggestion moca-search-suggestion--header" role="presentation">' +
            '<span class="moca-search-suggestion__title">最近搜尋</span></li>' +
          '<li class="moca-search-suggestion moca-search-suggestion--empty" role="option">' +
            '<span class="moca-search-suggestion__title">尚無搜尋紀錄</span></li>';
        ui.suggestions.className = 'moca-search-suggestions is-open is-portal';
        setSuggestionsDropdownOpen(true);
        return;
      }
      if (state.mode === 'search' && NORMALIZER.getCharCount(state.query) >= MIN_QUERY_CHARS) {
        ui.suggestions.innerHTML =
          '<li class="moca-search-suggestion moca-search-suggestion--empty" role="option">' +
            '<span class="moca-search-suggestion__title">查無相關資料</span>' +
          '</li>';
        ui.suggestions.className = 'moca-search-suggestions is-open is-portal';
        setSuggestionsDropdownOpen(true);
        return;
      }
      closeSuggestions();
      return;
    }

    var html = '';
    var i;
    var row;
    var cls;
    var meta;
    var titleHtml;

    if (state.mode === 'history') {
      html += '<li class="moca-search-suggestion moca-search-suggestion--header" role="presentation">' +
        '<span class="moca-search-suggestion__title">最近搜尋</span></li>';
    }

    var highlightTokens = [];
    if (state.mode === 'search' && state.lastSearch && state.lastSearch.tokenInfo) {
      highlightTokens = state.lastSearch.tokenInfo.expanded;
    }

    for (i = 0; i < state.rows.length; i++) {
      row = state.rows[i];
      cls = 'moca-search-suggestion' + (i === state.activeIndex ? ' is-active' : '');
      if (row.type === 'history') cls += ' moca-search-suggestion--history';
      meta = row.label ? '<span class="moca-search-suggestion__meta">' + escapeHtml(row.label) + '</span>' : '';
      titleHtml = state.mode === 'search'
        ? SUGGESTION.highlight(row.displayText, highlightTokens)
        : escapeHtml(row.displayText);
      html +=
        '<li role="presentation">' +
          '<button type="button" class="' + cls + '" role="option" data-index="' + i + '">' +
            '<span class="moca-search-suggestion__title">' + titleHtml + '</span>' +
            meta +
          '</button>' +
        '</li>';
    }

    ui.suggestions.innerHTML = html;
    ui.suggestions.className = 'moca-search-suggestions is-open is-portal';
    setSuggestionsDropdownOpen(true);
  }

  function closeSuggestions() {
    if (!ui.suggestions) return;
    ui.suggestions.className = 'moca-search-suggestions';
    ui.suggestions.innerHTML = '';
    state.activeIndex = -1;
    state.mode = 'idle';
    state.rows = [];
    lastSuggestionActivateAt = 0;
    lastSuggestionActivateIndex = -1;
    setSuggestionsDropdownOpen(false);
  }

  function executeSearch(query, suggestionIndex) {
    if (NORMALIZER.getCharCount(query) < MIN_QUERY_CHARS) {
      closeSuggestions();
      return;
    }

    HISTORY.addQuery(query);

    var searched = runSearch(query, { minChars: MIN_QUERY_CHARS, maxResults: MAX_RESULTS });
    var results = searched.results;

    if (!results.length) {
      setStatus('');
      showResultsPanel(query, results, 0, searched);
      return;
    }

    if (typeof suggestionIndex === 'number' && suggestionIndex >= 0 && suggestionIndex < state.rows.length) {
      var row = state.rows[suggestionIndex];
      if (row.type === 'history') {
        executeSearch(row.query, -1);
        return;
      }
      if (row.result) {
        openResult(row.result.item);
        return;
      }
    }

    if (shouldOpenDirectly(results)) {
      openResult(results[0].item);
      return;
    }

    showResultsPanel(query, results, results.length, searched);
  }

  function showResultsPanel(query, results, totalCount, searched) {
    if (!ui.resultsBody) return;
    var tokenInfo = searched.tokenInfo || { expanded: searched.tokens };
    var highlightTokens = tokenInfo.expanded || searched.tokens;

    var html = '';
    if (!results.length) {
      html = '<div class="moca-search-results__empty">查無相關資料</div>';
      if (ui.resultsMeta) ui.resultsMeta.textContent = '';
    } else {
      if (ui.resultsMeta) {
        ui.resultsMeta.textContent = '共 ' + (totalCount || results.length) + ' 筆符合';
      }
      var i;
      for (i = 0; i < results.length; i++) {
        var row = results[i];
        var display = SUGGESTION.buildDisplay(row, searched.tokens, tokenInfo);
        var displayText = display.text;
        var label = row.label || display.label;
        html +=
          '<button type="button" class="moca-search-result-card" data-url="' + escapeHtml(row.item.url) + '">' +
            '<div class="moca-search-result-card__title">' + SUGGESTION.highlight(displayText, highlightTokens) + '</div>' +
            '<div class="moca-search-result-card__section">' +
              escapeHtml(sectionLabel(row.item.section)) +
              (label ? ' · ' + escapeHtml(label) : '') +
            '</div>' +
            (display.excerpt ? '<p class="moca-search-result-card__excerpt">' + SUGGESTION.highlight(display.excerpt, highlightTokens) + '</p>' : '') +
          '</button>';
      }
    }

    ui.resultsBody.innerHTML = html;
    var cards = ui.resultsBody.getElementsByClassName('moca-search-result-card');
    var j;
    for (j = 0; j < cards.length; j++) {
      (function (card) {
        card.addEventListener('click', function () {
          var url = card.getAttribute('data-url');
          var k;
          var engineResults = runSearch(query, { maxResults: MAX_RESULTS }).results;
          for (k = 0; k < engineResults.length; k++) {
            if (engineResults[k].item.url === url) {
              openResult(engineResults[k].item);
              return;
            }
          }
          navigateContentTo(url, state.section);
          closeResultsPanel();
        });
      })(cards[j]);
    }

    ui.results.className = 'moca-search-results is-open';
    closeSuggestions();
  }

  function closeResultsPanel() {
    if (ui.results) ui.results.className = 'moca-search-results';
  }

  function filterOutline(query) {
    if (isFileProtocol()) return;
    var doc = safeGetFrameDocument(getOutlineFrame());
    if (!doc) return;
    var root = doc.getElementById('outline');
    if (!root) return;

    var tokenInfo = window.MocaSynonymDictionary.expandTokens(NORMALIZER.tokenize(query));
    var tokens = tokenInfo.expanded;
    var nodes = root.getElementsByTagName('li');
    var i;
    var j;

    for (i = 0; i < nodes.length; i++) nodes[i].removeAttribute('data-moca-search-match');

    for (i = 0; i < nodes.length; i++) {
      var li = nodes[i];
      if (li.className.indexOf('link') === -1) continue;
      var anchor = li.getElementsByTagName('a')[0];
      var text = anchor ? (anchor.textContent || anchor.innerText || '') : '';
      if (window.MocaSearchRanking.containsAll(text, tokens)) {
        li.setAttribute('data-moca-search-match', '1');
        markAncestorsVisible(li);
      }
    }

    for (j = 0; j < nodes.length; j++) {
      var node = nodes[j];
      if (node.getAttribute('data-moca-search-match') === '1') {
        node.style.display = '';
        continue;
      }
      if (node.className.indexOf('link') !== -1) {
        node.style.display = 'none';
        continue;
      }
      node.style.display = hasVisibleDescendant(node) ? '' : 'none';
    }
  }

  function markAncestorsVisible(li) {
    var parent = li.parentNode;
    while (parent) {
      if (parent.tagName === 'LI') {
        parent.setAttribute('data-moca-search-match', '1');
        parent.style.display = '';
        if (parent.className.indexOf('opened') === -1 && parent.getElementsByTagName('ul').length > 0) {
          parent.className = (parent.className + ' opened').replace(/^\s+/, '');
        }
        var childNodes = parent.children || parent.childNodes;
        var i;
        for (i = 0; i < childNodes.length; i++) {
          if (childNodes[i].tagName === 'UL' || childNodes[i].tagName === 'LI') {
            childNodes[i].style.display = '';
          }
        }
      }
      parent = parent.parentNode;
    }
  }

  function hasVisibleDescendant(li) {
    var children = li.getElementsByTagName('li');
    var i;
    for (i = 0; i < children.length; i++) {
      if (children[i] === li) continue;
      if (children[i].getAttribute('data-moca-search-match') === '1') return true;
    }
    return false;
  }

  function restoreOutline(doc) {
    var nodes = doc.getElementsByTagName('li');
    var i;
    for (i = 0; i < nodes.length; i++) {
      nodes[i].style.display = '';
      nodes[i].removeAttribute('data-moca-search-match');
    }
  }

  function init() {
    if (!ENGINE || !SUGGESTION || !HISTORY) {
      console.error('搜尋模組未完整載入');
      return;
    }
    state.section = detectSection();
    if (!bindUi()) return;

    window.MocaSearchUiReady = true;
    try {
      var rawData = normalizeData(window.SEARCH_DATA);
      state.engine = ENGINE.createEngine(rawData, state.section);
    } catch (err) {
      console.error('搜尋索引建立失敗', err);
      state.engine = null;
    }
    window.MocaSearchReady = true;

    if (!state.section) setStatus('無法判斷章節，搜尋功能可能受限');
    else if (!state.engine || !state.engine.itemCount) setStatus('尚無搜尋資料，請先執行搜尋重構');
    else setStatus(sectionLabel(state.section));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MocaSearchUI = {
    detectSection: detectSection,
    searchItems: function (query) { return runSearch(query).results; },
    showHistory: showHistorySuggestions,
    filterOutline: filterOutline,
    openResult: openResult,
    getLastNavigatedUrl: function () { return state.lastNavigatedUrl || ''; },
    resetLastNavigatedUrl: function () { state.lastNavigatedUrl = ''; state.lastNavigatedSection = ''; },
    getVersion: function () { return MOCA_SEARCH_UI_VERSION; }
  };
})(window, document);
