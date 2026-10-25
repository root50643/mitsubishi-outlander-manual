/**
 * SearchSuggestion — 建議列與摘要擷取
 * v4.0.0
 */
(function (window) {
  'use strict';

  var NORMALIZER = window.MocaSearchNormalizer;
  var RANKING = window.MocaSearchRanking;
  var HIGHLIGHT = window.MocaHighlightRenderer;

  function makeExcerpt(text, tokens) {
    var source = String(text || '');
    if (!source) return '';
    var lower = NORMALIZER.normalizeField(source);
    var pos = -1;
    var i;
    for (i = 0; i < tokens.length; i++) {
      pos = lower.indexOf(tokens[i]);
      if (pos !== -1) break;
    }
    if (pos === -1) return source.slice(0, 120) + (source.length > 120 ? '…' : '');
    var start = Math.max(0, pos - 40);
    var end = Math.min(source.length, pos + 80);
    var excerpt = source.slice(start, end);
    if (start > 0) excerpt = '…' + excerpt;
    if (end < source.length) excerpt += '…';
    return excerpt;
  }

  function buildDisplay(result, tokens, tokenInfo) {
    var item = result.item;
    var titleText = RANKING.getTitleText(item);
    var allTokens = tokenInfo.expanded;
    var excerpt = '';

    if (result.matchType === 'title') {
      return {
        text: titleText,
        label: '【標題】',
        excerpt: ''
      };
    }

    excerpt = makeExcerpt(item.text, allTokens);
    return {
      text: excerpt,
      label: '【內文】',
      excerpt: excerpt
    };
  }

  function buildSuggestionRows(results, tokens, tokenInfo, maxCount) {
    var rows = [];
    var used = {};
    var limit = maxCount || 10;
    var i;
    var display;
    var key;
    for (i = 0; i < results.length && rows.length < limit; i++) {
      display = buildDisplay(results[i], tokens, tokenInfo);
      key = results[i].item.url + '|' + display.text;
      if (used[key]) continue;
      used[key] = true;
      rows.push({
        result: results[i],
        displayText: display.text,
        label: display.label,
        excerpt: display.excerpt
      });
    }
    return rows;
  }

  function buildHistoryRows(history) {
    var rows = [];
    var i;
    for (i = 0; i < history.length; i++) {
      rows.push({
        type: 'history',
        query: history[i],
        displayText: history[i],
        label: '最近搜尋'
      });
    }
    return rows;
  }

  window.MocaSearchSuggestion = {
    makeExcerpt: makeExcerpt,
    buildDisplay: buildDisplay,
    buildSuggestionRows: buildSuggestionRows,
    buildHistoryRows: buildHistoryRows,
    highlight: HIGHLIGHT.highlight
  };
})(window);
