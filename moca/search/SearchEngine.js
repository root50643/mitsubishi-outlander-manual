/**
 * SearchEngine — 搜尋引擎主模組（整合 Index / Ranking / Synonym）
 * v4.0.0
 */
(function (window) {
  'use strict';

  var NORMALIZER = window.MocaSearchNormalizer;
  var SYNONYM = window.MocaSynonymDictionary;
  var RANKING = window.MocaSearchRanking;
  var INDEX = window.MocaSearchIndex;
  var HIGHLIGHT = window.MocaHighlightRenderer;
  var SUGGESTION = window.MocaSearchSuggestion;

  function createEngine(rawItems, section) {
    var filtered = INDEX.filterBySection(rawItems, section);
    var index = INDEX.buildIndex(filtered, section);

    function search(query, options) {
      var opts = options || {};
      var minChars = typeof opts.minChars === 'number' ? opts.minChars : 1;
      var maxResults = typeof opts.maxResults === 'number' ? opts.maxResults : 200;
      var tokens = NORMALIZER.tokenize(query);
      var queryNorm = NORMALIZER.normalizeSearchText(query);

      if (!tokens.length || NORMALIZER.getCharCount(query) < minChars) {
        return { tokens: tokens, tokenInfo: null, queryNorm: queryNorm, results: [], ready: false };
      }

      var tokenInfo = SYNONYM.expandTokens(tokens);
      var results = [];
      var i;
      var ranked;

      for (i = 0; i < index.length; i++) {
        ranked = RANKING.rankItem(index[i].item, tokenInfo, queryNorm);
        if (ranked) {
          ranked.excerpt = SUGGESTION.makeExcerpt(index[i].item.text, tokenInfo.expanded);
          results.push(ranked);
        }
      }

      RANKING.sortResults(results);
      if (results.length > maxResults) results = results.slice(0, maxResults);

      return {
        tokens: tokens,
        tokenInfo: tokenInfo,
        queryNorm: queryNorm,
        results: results,
        ready: true
      };
    }

    return {
      section: section,
      itemCount: index.length,
      search: search
    };
  }

  window.MocaSearchEngine = {
    VERSION: '4.0.0',
    createEngine: createEngine,
    normalizeSearchText: NORMALIZER.normalizeSearchText,
    tokenize: NORMALIZER.tokenize,
    getCharCount: NORMALIZER.getCharCount,
    normalizeItem: INDEX.normalizeItem,
    highlightTokens: HIGHLIGHT.highlight,
    makeExcerpt: SUGGESTION.makeExcerpt,
    buildSuggestionDisplay: function (result, tokens, tokenInfo) {
      return SUGGESTION.buildDisplay(result, tokens, tokenInfo || { expanded: tokens });
    },
    search: function (items, query, options) {
      var engine = createEngine(items, '');
      return engine.search(query, options);
    }
  };
})(window);
