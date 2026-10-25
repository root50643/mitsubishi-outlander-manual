/**
 * HighlightRenderer — 搜尋結果關鍵字高亮
 * v4.0.0
 */
(function (window) {
  'use strict';

  var NORMALIZER = window.MocaSearchNormalizer;

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function collectMarks(text, tokens) {
    var lower = NORMALIZER.normalizeField(text);
    var marks = [];
    var i;
    var t;
    var start;
    var pos;
    var sourceLen = String(text || '').length;
    for (i = 0; i < tokens.length; i++) {
      t = String(tokens[i] || '');
      if (!t) continue;
      start = 0;
      while (start < lower.length) {
        pos = lower.indexOf(t, start);
        if (pos === -1) break;
        marks.push({ start: pos, end: pos + t.length });
        start = pos + t.length;
      }
    }
    if (!marks.length) return [];

    marks.sort(function (a, b) { return a.start - b.start; });
    var merged = [];
    var m;
    for (i = 0; i < marks.length; i++) {
      m = marks[i];
      if (!merged.length || m.start > merged[merged.length - 1].end) {
        merged.push({ start: m.start, end: m.end });
      } else if (m.end > merged[merged.length - 1].end) {
        merged[merged.length - 1].end = m.end;
      }
    }
    return merged;
  }

  function highlight(text, tokens) {
    var source = String(text || '');
    if (!source) return '';
    if (!tokens || !tokens.length) return escapeHtml(source);

    var merged = collectMarks(source, tokens);
    if (!merged.length) return escapeHtml(source);

    var html = '';
    var cursor = 0;
    var i;
    for (i = 0; i < merged.length; i++) {
      html += escapeHtml(source.slice(cursor, merged[i].start));
      html += '<mark class="moca-search-mark">' + escapeHtml(source.slice(merged[i].start, merged[i].end)) + '</mark>';
      cursor = merged[i].end;
    }
    html += escapeHtml(source.slice(cursor));
    return html;
  }

  window.MocaHighlightRenderer = {
    escapeHtml: escapeHtml,
    highlight: highlight
  };
})(window);
