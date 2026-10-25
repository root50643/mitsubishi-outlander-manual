/**
 * SearchIndex — 預先正規化搜尋索引，避免重複計算
 * v4.0.0
 */
(function (window) {
  'use strict';

  var NORMALIZER = window.MocaSearchNormalizer;
  var RANKING = window.MocaSearchRanking;

  function normalizeItem(raw, fallbackSection) {
    var outlineTitle = String(raw.outlineTitle || raw.OutlineTitle || '').trim();
    var pageTitle = String(raw.title || raw.Title || '').trim();
    return {
      section: String(raw.section || raw.Section || fallbackSection || '').toUpperCase(),
      outlineTitle: outlineTitle,
      title: pageTitle || outlineTitle,
      text: String(raw.text || raw.Text || raw.body || '').trim(),
      url: String(raw.url || raw.Url || raw.href || '').trim()
    };
  }

  function buildIndex(rawItems, section) {
    var items = [];
    var i;
    var item;
    var titleText;
    for (i = 0; i < rawItems.length; i++) {
      item = normalizeItem(rawItems[i], section);
      titleText = RANKING.getTitleText(item);
      items.push({
        item: item,
        titleNorm: NORMALIZER.normalizeField(titleText),
        bodyNorm: NORMALIZER.normalizeField(item.text)
      });
    }
    return items;
  }

  function filterBySection(rawItems, section) {
    var all = rawItems || [];
    var filtered = [];
    var i;
    var item;
    var sec;
    for (i = 0; i < all.length; i++) {
      item = all[i];
      if (!item) continue;
      sec = (item.section || item.Section || '').toUpperCase();
      if (!sec || sec === section) {
        filtered.push(item);
      }
    }
    return filtered;
  }

  window.MocaSearchIndex = {
    normalizeItem: normalizeItem,
    buildIndex: buildIndex,
    filterBySection: filterBySection
  };
})(window);
