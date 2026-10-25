/**
 * SearchNormalizer — 統一文字正規化與分詞
 * v4.0.0
 */
(function (window) {
  'use strict';

  var FULLWIDTH_ASCII_START = 0xFF01;
  var FULLWIDTH_ASCII_END = 0xFF5E;
  var FULLWIDTH_SPACE = 0x3000;

  function toHalfWidth(ch) {
    var code = ch.charCodeAt(0);
    if (code === FULLWIDTH_SPACE) return ' ';
    if (code >= FULLWIDTH_ASCII_START && code <= FULLWIDTH_ASCII_END) {
      return String.fromCharCode(code - 0xFEE0);
    }
    return ch;
  }

  function normalizeSearchText(text) {
    var source = String(text || '');
    if (source.normalize) source = source.normalize('NFKC');
    var out = '';
    var i;
    for (i = 0; i < source.length; i++) {
      out += toHalfWidth(source.charAt(i));
    }
    return out.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function tokenize(query) {
    var q = normalizeSearchText(query);
    if (!q) return [];
    return q.split(' ').filter(function (t) { return t.length > 0; });
  }

  function getCharCount(query) {
    return normalizeSearchText(query).replace(/\s+/g, '').length;
  }

  function normalizeField(text) {
    return normalizeSearchText(text);
  }

  window.MocaSearchNormalizer = {
    normalizeSearchText: normalizeSearchText,
    tokenize: tokenize,
    getCharCount: getCharCount,
    normalizeField: normalizeField
  };
})(window);
