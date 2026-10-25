/**
 * SearchHistory — localStorage 最近搜尋紀錄（含記憶體後備）
 * v4.0.0
 */
(function (window) {
  'use strict';

  var STORAGE_KEY = 'moca_search_history_v4';
  var MAX_ITEMS = 10;
  var memoryStore = null;
  var storageOk = true;

  function readRaw() {
    if (memoryStore) return memoryStore.slice();
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      storageOk = false;
      return memoryStore ? memoryStore.slice() : [];
    }
  }

  function writeRaw(list) {
    memoryStore = list.slice();
    if (!storageOk) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      storageOk = false;
    }
  }

  function getHistory() {
    return readRaw().slice(0, MAX_ITEMS);
  }

  function addQuery(query) {
    var q = String(query || '').trim();
    if (!q) return getHistory();
    var list = readRaw();
    var i;
    var next = [q];
    for (i = 0; i < list.length; i++) {
      if (list[i] !== q && next.length < MAX_ITEMS) next.push(list[i]);
    }
    writeRaw(next);
    return next;
  }

  function clearHistory() {
    memoryStore = [];
    if (!storageOk) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      storageOk = false;
    }
  }

  window.MocaSearchHistory = {
    MAX_ITEMS: MAX_ITEMS,
    getHistory: getHistory,
    addQuery: addQuery,
    clearHistory: clearHistory
  };
})(window);
