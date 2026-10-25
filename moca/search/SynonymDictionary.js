/**
 * SynonymDictionary — 可維護的同義詞字典
 * v4.0.0
 */
(function (window) {
  'use strict';

  var NORMALIZER = window.MocaSearchNormalizer;

  var GROUPS = [
    ['汽車', '車輛'],
    ['感知器', '感測器'],
    ['引擎', '發動機'],
    ['電瓶', '蓄電池'],
    ['煞車', '剎車'],
    ['空調', '冷氣'],
    ['變速箱', '變速器']
  ];

  var synonymMap = {};
  var groupIndex = {};

  function buildIndex() {
    synonymMap = {};
    groupIndex = {};
    var g;
    var i;
    var term;
    var normalized;
    for (g = 0; g < GROUPS.length; g++) {
      for (i = 0; i < GROUPS[g].length; i++) {
        term = GROUPS[g][i];
        normalized = NORMALIZER.normalizeSearchText(term);
        synonymMap[normalized] = GROUPS[g];
        groupIndex[normalized] = g;
      }
    }
  }

  function getSynonyms(term) {
    var key = NORMALIZER.normalizeSearchText(term);
    var group = synonymMap[key];
    if (!group) return [term];
    var result = [];
    var i;
    for (i = 0; i < group.length; i++) {
      if (result.indexOf(group[i]) === -1) result.push(group[i]);
    }
    return result;
  }

  function expandTokens(tokens) {
    var expanded = [];
    var synonymOnly = [];
    var seen = {};
    var i;
    var j;
    var syns;
    var norm;
    for (i = 0; i < tokens.length; i++) {
      syns = getSynonyms(tokens[i]);
      for (j = 0; j < syns.length; j++) {
        norm = NORMALIZER.normalizeSearchText(syns[j]);
        if (!seen[norm]) {
          seen[norm] = true;
          expanded.push(norm);
          if (j > 0 || norm !== NORMALIZER.normalizeSearchText(tokens[i])) {
            synonymOnly.push(norm);
          }
        }
      }
    }
    return {
      original: tokens.map(function (t) { return NORMALIZER.normalizeSearchText(t); }),
      expanded: expanded,
      synonymOnly: synonymOnly
    };
  }

  function addGroup(terms) {
    if (!terms || !terms.length) return;
    GROUPS.push(terms.slice());
    buildIndex();
  }

  function getGroups() {
    return GROUPS.slice();
  }

  buildIndex();

  window.MocaSynonymDictionary = {
    getSynonyms: getSynonyms,
    expandTokens: expandTokens,
    addGroup: addGroup,
    getGroups: getGroups
  };
})(window);
