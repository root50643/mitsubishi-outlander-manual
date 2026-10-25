/**
 * SearchRanking — 相關性排序（標題優先、完全符合優先、同義詞次之）
 * v4.0.0
 */
(function (window) {
  'use strict';

  var NORMALIZER = window.MocaSearchNormalizer;

  var PRIORITY = {
    EXACT_TITLE: 600,
    CONTAINS_TITLE: 500,
    SYNONYM_TITLE: 400,
    EXACT_BODY: 300,
    CONTAINS_BODY: 200,
    SYNONYM_BODY: 100
  };

  function containsAll(haystack, tokens) {
    var hay = NORMALIZER.normalizeField(haystack);
    var i;
    for (i = 0; i < tokens.length; i++) {
      if (hay.indexOf(tokens[i]) === -1) return false;
    }
    return true;
  }

  function containsAny(haystack, tokens) {
    var hay = NORMALIZER.normalizeField(haystack);
    var i;
    for (i = 0; i < tokens.length; i++) {
      if (hay.indexOf(tokens[i]) !== -1) return true;
    }
    return false;
  }

  function getTitleText(item) {
    var outline = String(item.outlineTitle || '').trim();
    var title = String(item.title || '').trim();
    return outline || title;
  }

  function classifyMatch(titleNorm, bodyNorm, originalTokens, synonymTokens, queryNorm) {
    var usedSynonym = false;
    var i;

    if (titleNorm === queryNorm) {
      return { priority: PRIORITY.EXACT_TITLE, matchType: 'title', viaSynonym: false };
    }
    if (containsAll(titleNorm, originalTokens)) {
      return { priority: PRIORITY.CONTAINS_TITLE, matchType: 'title', viaSynonym: false };
    }
    if (synonymTokens.length && containsAll(titleNorm, synonymTokens)) {
      return { priority: PRIORITY.SYNONYM_TITLE, matchType: 'title', viaSynonym: true };
    }
    if (synonymTokens.length) {
      for (i = 0; i < synonymTokens.length; i++) {
        if (titleNorm.indexOf(synonymTokens[i]) !== -1) {
          return { priority: PRIORITY.SYNONYM_TITLE, matchType: 'title', viaSynonym: true };
        }
      }
    }

    if (bodyNorm === queryNorm) {
      return { priority: PRIORITY.EXACT_BODY, matchType: 'body', viaSynonym: false };
    }
    if (containsAll(bodyNorm, originalTokens)) {
      return { priority: PRIORITY.CONTAINS_BODY, matchType: 'body', viaSynonym: false };
    }
    if (synonymTokens.length && containsAll(bodyNorm, synonymTokens)) {
      return { priority: PRIORITY.SYNONYM_BODY, matchType: 'body', viaSynonym: true };
    }
    if (synonymTokens.length) {
      for (i = 0; i < synonymTokens.length; i++) {
        if (bodyNorm.indexOf(synonymTokens[i]) !== -1) {
          return { priority: PRIORITY.SYNONYM_BODY, matchType: 'body', viaSynonym: true };
        }
      }
    }

    var combined = titleNorm + ' ' + bodyNorm;
    if (containsAll(combined, originalTokens)) {
      return { priority: PRIORITY.CONTAINS_BODY, matchType: 'body', viaSynonym: false };
    }
    if (synonymTokens.length && containsAny(combined, synonymTokens)) {
      return { priority: PRIORITY.SYNONYM_BODY, matchType: 'body', viaSynonym: true };
    }

    return null;
  }

  function bonusScore(titleNorm, bodyNorm, originalTokens) {
    var bonus = 0;
    var q = originalTokens.join(' ');
    var i;
    var token;
    if (titleNorm.indexOf(q) === 0) bonus += 30;
    else if (titleNorm.indexOf(q) !== -1) bonus += 15;
    for (i = 0; i < originalTokens.length; i++) {
      token = originalTokens[i];
      if (titleNorm.indexOf(token) === 0) bonus += 8;
      else if (titleNorm.indexOf(token) !== -1) bonus += 4;
      else if (bodyNorm.indexOf(token) !== -1) bonus += 1;
    }
    return bonus;
  }

  function rankItem(item, tokenInfo, queryNorm) {
    var titleNorm = NORMALIZER.normalizeField(getTitleText(item));
    var bodyNorm = NORMALIZER.normalizeField(item.text || '');
    var originalTokens = tokenInfo.original;
    var synonymTokens = tokenInfo.synonymOnly;

    var match = classifyMatch(titleNorm, bodyNorm, originalTokens, synonymTokens, queryNorm);
    if (!match) return null;

    return {
      item: item,
      score: match.priority + bonusScore(titleNorm, bodyNorm, originalTokens),
      matchType: match.matchType,
      viaSynonym: match.viaSynonym,
      label: match.matchType === 'title' ? '【標題】' : '【內文】'
    };
  }

  function sortResults(results) {
    results.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.matchType !== b.matchType) {
        return a.matchType === 'title' ? -1 : 1;
      }
      if (a.viaSynonym !== b.viaSynonym) {
        return a.viaSynonym ? 1 : -1;
      }
      var aLabel = getTitleText(a.item);
      var bLabel = getTitleText(b.item);
      return aLabel.localeCompare(bLabel);
    });
    return results;
  }

  window.MocaSearchRanking = {
    PRIORITY: PRIORITY,
    rankItem: rankItem,
    sortResults: sortResults,
    getTitleText: getTitleText,
    containsAll: containsAll,
    containsAny: containsAny
  };
})(window);
