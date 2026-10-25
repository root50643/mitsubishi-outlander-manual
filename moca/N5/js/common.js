var urlParams = getParams();
var _regObject;

$(function () {
    $(document).on('contextmenu', function (e) {
        return false;
    });
    if (urlParams["print"] == "true") {
        $("body").addClass('print');
        $("img").each(function (index, img) {
            var large = $(img).attr("large");
            if (large != null) {
                $(img).attr("src", large);
            }
        });
        var userAgent = window.navigator.userAgent.toLowerCase();
        if (userAgent.indexOf("msie") >= 0 || userAgent.indexOf("trident") >= 0) {
            printPreviewIE11();
        } else {
            if (window.ManualPrintReady) window.ManualPrintReady(); else window.print();
        }
    }
});

$(window).on('load', function () {
    setTimeout(function () {
        adjustHeaderPadding(true);
    }, 10);
});
$(window).on('resize', function () {
    setTimeout(function () {
        adjustHeaderPadding(false);
    }, 10);
});

function adjustHeaderPadding(isload) {
    var header = $('.sieHeader');
    if (header != null) {
        if (urlParams["print"] == "true") {
            $('body').css('padding-top', '0');
        } else {
            $('body').css('padding-top', (header.height() + 10) + 'px');
        }
    }
    if (isload) {
        $(".prevsie").show();
        $(".servinfo").show();
        $(".nextsie").show();
    }
}

function printPreviewIE11() {
    if (document.body.insertAdjacentHTML == null)
        return;

    var sWebBrowserCode = '<object width="0" height="0" classid="CLSID:8856F961-340A-11D0-A96B-00C04FD705A2"></object>';
    document.body.insertAdjacentHTML('beforeEnd', sWebBrowserCode);

    var objWebBrowser = document.body.lastChild;
    if (objWebBrowser == null)
        return;

    objWebBrowser.ExecWB(7, 1);
    document.body.removeChild(objWebBrowser);
    setTimeout(function () {
        window.close();
    }, 500);
}

function printSIE() {
    window.open(location.href + '?print=true');
}

function getParams() {
    var query = location.search.substr(1);

    var params = {};
    query.split("&").forEach(function (item) {
        var s = item.split("=");
        var k = decodeURIComponent(s[0]);
        var v = decodeURIComponent(s[1]);
        (k in params) ? params[k].push(v) : params[k] = [v];
    });

    return params;
}

function ViewLargeIllust(src, name, rotate) {
    var left = parent.window.screenLeft + (parent.window.innerWidth / 2) - (820 / 2);
    var top = parent.window.screenTop + (parent.window.innerHeight / 2) - (642 / 2);
    var url = "large.html?src=" + src;
    if (rotate && rotate == 1) {
        url = url + "&rotate=1";
    }
    window.open(url, name, 'width=820,height=642,top=' + top + ',left=' + left + ',toolbar=no,menubar=no,scrollbars=yes,resizable=yes');
}

function openSIE(sieId) {
    var title = document.title;
    var loc = document.location.href;

    if (parent && parent.content) {
        var item = { "title": title, "location": loc };
        window.parent.linkHistory.push(item);
    }

    document.location.href = sieId + ".html";
}

function getHistoryItem() {
    if (window.parent && window.parent.linkHistory && window.parent.linkHistory.length > 0) {
        return window.parent.linkHistory[window.parent.linkHistory.length - 1];
    }
    return null;
}

function historyBack() {
    if (window.parent && window.parent.linkHistory && window.parent.linkHistory.length > 0) {
        var item = window.parent.linkHistory.pop();
        window.parent.content.document.location.href = item["location"];
    }
}

function clearHistory() {
    if (window.parent && window.parent.linkHistory && window.parent.linkHistory.length > 0) {
        window.parent.linkHistory.length = 0;
    }
}

function showHistoryButton() {
    var his = getHistoryItem();
    if (his != null) {
        var isJPN = $("body.JPN").length > 0;
        var button = '';
        if (isJPN) {
            button = '<input id="btnLinkBack" name="btnLinkBack" onclick="historyBack();" type="button" value="< 「' + his["title"] + '」に戻る"></input>';
        } else {
            button = '<input id="btnLinkBack" name="btnLinkBack" onclick="historyBack();" type="button" value="< 「' + his["title"] + '」Back to"></input>';
        }
        $(".siePrintWrapper").before(button);
    }
}

function search() {
    var title = $("#searchByTitle").val();
    var text = $("#searchByText").val();
    if (text.length > 0) {
        if (title.length > 0) {
            window.parent.content.document.location.href = "searchresult.html?sw=" + encodeURIComponent(text) + "&ttl=" + encodeURIComponent(title);
        }
        else {
            window.parent.content.document.location.href = "searchresult.html?sw=" + encodeURIComponent(text);
        }
    }
    else if (title.length > 0) {
        window.parent.content.document.location.href = "search.html?text=" + encodeURIComponent(title);
    }
    else {
        var message = "";
        $(".errorMessage").children("div").each(function (i, e) {
            if (message.length > 0) {
                message += "\n";
            }
            message += $(e).text();
        });
        if (message.length > 0) {
            alert(message);
        }
    }
}

function gsitm(sieRef, text, shortdesc, tagId) {
    var data = new Array;
    data.SieRef = sieRef;
    data.Text = text;
    data.TagId = tagId;
    return data;
}

function gsttl(siePath, sieTitle) {
    var data = new Array;

    data.SiePath = siePath;
    data.SieTitle = sieTitle;

    return data;
}

function isMatch(innerText, strKey) {
    var regExp = getRegExp(strKey);
    return regExp.test(innerText);
}

function getContenWithColor(innerXml, strKey) {
    if (strKey == "" || strKey == "*") {
        return innerXml;
    }

    var elementsWithTags = innerXml.split(/(<.+?>)/);
    var hitIndexArray = getHitIndexArray(innerXml, strKey);
    var stateSetStyle =
        getStateSetStyleMulti(elementsWithTags, hitIndexArray);

    var i;
    for (i = stateSetStyle.length - 1; i >= 0 ; i--) {
        var state = stateSetStyle[i];
        var content = elementsWithTags[state.ElementIndex];
        var contentBefor = content.substring(0, state.StringStartIndex);
        var HitContent = content.substring(state.StringStartIndex, state.StringEndIndex);
        var contentAfter = content.substring(state.StringEndIndex, content.length);
        var newContent =
            contentBefor +
            "<font style=\"background-color:#FFFF99;\">" +
            HitContent +
            "</font>" +
            contentAfter;

        elementsWithTags[state.ElementIndex] = newContent;
    }

    return getJoinText(elementsWithTags);
}

function getHitIndexArray(innerXml, strKey) {
    var result = new Array();
    var resultArrayCounter = 0;

    var elements = innerXml.split(/<.+?>/);
    var innnerText = getJoinText(elements);
    var totalShift = 0;

    var i;
    while (true) {
        var regObject = getRegExp(strKey).exec(innnerText);

        if (regObject == null) {
            break;
        }

        var startIndex = regObject.index;
        var endIndex = startIndex + regObject[0].length;

        var item = new Array();
        item.StartIndex = startIndex + totalShift;
        item.EndIndex = endIndex + totalShift;
        result[resultArrayCounter] = item;
        resultArrayCounter++;

        innnerText = innnerText.substring(endIndex);
        totalShift += endIndex;
    }
    return result;
}

function getHitIndex(innerXml, strKey) {
    var elements = innerXml.split(/<.+?>/);
    var innnerText = getJoinText(elements);
    var regObject = getRegExp(strKey).exec(innnerText);

    var startIndex = regObject.index;

    var endIndex = startIndex + regObject[0].length;

    var result = new Array();
    result.StartIndex = startIndex;
    result.EndIndex = endIndex;

    return result;
}

function getStateSetStyleMulti(elementsWithTags, hitIndexArray) {
    var result = new Array();

    var i;
    for (i = 0; i < hitIndexArray.length; i++) {
        var item = hitIndexArray[i];
        var stateSetStyle = getStateSetStyle(elementsWithTags, item.StartIndex, item.EndIndex);

        var j;
        for (j = 0; j < stateSetStyle.length; j++) {
            result.push(stateSetStyle[j]);
        }
    }

    return result;
}

function getStateSetStyle(elementsWithTags, startIndex, endIndex) {
    var stateSetStyle = new Array();
    var stateSetStyleCounter = 0;
    var isHitting = false;
    var stringCounter = 0;
    var elementCounter = 0;
    var i;
    for (i = 0; i < elementsWithTags.length; i++) {
        var element = elementsWithTags[i];
        if ((! /<.+?>/.test(element)) && element != "") {
            if (isHitting) {
                stateSetStyle[stateSetStyleCounter] = new Array();
                stateSetStyle[stateSetStyleCounter].ElementIndex = elementCounter;
                stateSetStyle[stateSetStyleCounter].StringStartIndex = 0;
            }

            var j;
            for (j = 0; j < element.length; j++) {
                if (stringCounter == startIndex) {
                    stateSetStyle[stateSetStyleCounter] = new Array();
                    stateSetStyle[stateSetStyleCounter].ElementIndex = elementCounter;
                    stateSetStyle[stateSetStyleCounter].StringStartIndex = j;
                    isHitting = true;
                }

                if (stringCounter == endIndex - 1) {
                    stateSetStyle[stateSetStyleCounter].StringEndIndex = j + 1;
                    stateSetStyleCounter++;
                    isHitting = false;
                }

                stringCounter++;
            }

            if (isHitting) {
                stateSetStyle[stateSetStyleCounter].StringEndIndex = element.length;
                stateSetStyleCounter++;
            }
        }
        elementCounter++;
    }

    return stateSetStyle;
}

function getJoinText(elements) {
    var result = "";

    var i;
    for (i = 0; i < elements.length; i++) {
        result += elements[i];
    }

    return result;
}

function getRegExp(strKey) {
    if (_regObject && _regObject.Key) {
        if (strKey == _regObject.Key) {
            return _regObject.RegExp;
        }
    }

    _regObject = new Array;

    _regObject.Key = strKey;
    _regObject.RegExp = new RegExp(getPattern(strKey), "i");

    return _regObject.RegExp;
}

function getPattern(strKey) {
    var result = strKey;

    result = result.replace("\\", "\\\\");
    result = result.replace("$", "\\$");
    result = result.replace("^", "\\^");
    result = result.replace("[", "\\[");
    result = result.replace("]", "\\]");
    result = result.replace(".", "\\.");
    result = result.replace("+", "\\+");
    result = result.replace("{", "\\{");
    result = result.replace("}", "\\}");

    result = result.replace("*", ".*");

    result = result.replace("?", ".");

    return result;
}

function bookmarkSIE() {
    var pathlist = $(".pathlist").text();
    var index = pathlist.indexOf(" - ");
    var groupName = pathlist.substring(0, index);
    var sieTitle = $(".servinfo > .title > span").text();
    var sieId = $(".sieid").text();

    var subheader = $(parent.subheader.document);
    var manualName = subheader.find(".docType").text();
    var manualId = subheader.find(".subHeaderBody").attr("id");
    var vehicleName = subheader.find(".vTypeLabel").text();
    var yearManalName = subheader.find(".pubDateLabel").text();
    var year = subheader.find(".year").text();

    var result = addBookmarkCookie(manualName, manualId, vehicleName, year, sieId, groupName, sieTitle);
    if (result) {
        $(".balloonNG").hide();
        $(".balloonOK").show();
    }
    else {
        $(".balloonOK").hide();
        $(".balloonNG").show();
    }
    $("#balloon").show();
}

function closeBalloon() {
    $("#balloon").hide();
}

function openBookmark() {
    window.open("bookmark.html", null, 'width=820,height=699,toolbar=no,menubar=no,scrollbars=yes,resizable=yes');
}

var MAX = 10;
var EXPIRE = 999;
var COOKIEMAX = 3000;

var scNameLength = 54;
var configNameLength = 54;
var componentNameLength = 72;
var sieNameLength = 84;
var vehicleNameLength = 66;
var modelYearLength = 18;

var phenix_vehicleNameLength = 40;
var phenix_publishdateLength = 60;
var phenix_level1NameLength = 40;
var phenix_sieNameLength = 40;
var phenix_applicabilityLength = 30;

function setWebManualCookie(name, value, days) {
    var path = $(location).attr("pathname");
    var pathParts = path.split("/");
    path = "";
    for (var i = 0; i < pathParts.length - 3; i++) {
        if (pathParts[i].length > 0) {
            path += "/";
            path += pathParts[i];
        }
    }
    var exp = new Date();
    var month = exp.getMonth() + 1;
    var addDate = exp.getFullYear() + "/" + month + "/" + exp.getDate();
    exp.setTime(exp.getTime() + (days * 24 * 60 * 60 * 1000));
    var item = name + "=" + escape(value + ":" + addDate) + ";";
    var expStr = "path=" + path + "; expires=" + exp.toGMTString() + ";";
    document.cookie = item + expStr;
}

function bookmarkObj(bookmarkId, manualName, manualId, vehicleName, year, sieId, groupName, sieTitle, url, setDate) {
    this.bookmarkId = bookmarkId;
    this.manualName = manualName;
    this.manualId = manualId;
    this.vehicleName = vehicleName;
    this.year = year;
    this.sieId = sieId;
    this.groupName = groupName;
    this.sieTitle = sieTitle;
    this.url = url.replace(/：/g, ":");
    this.setDate = setDate;
}

function getBookmarks() {
    var bm = new Array();
    var bmList = new Array();
    var str = document.cookie;
    var cookies = str.split(";");
    for (var i = 0; i < cookies.length; i++) {
        var param = cookies[i].split("=");
        param[0] = param[0].replace(" ", "");
        if (param[0].indexOf("phenixBookmark") != -1) {
            if (param[1].replace(" ", "") != "") {
                param[1] = unescape(param[1]);
                var values = param[1].split(":");
                bm[bm.length] = new bookmarkObj(param[0], values[0], values[1], values[2], values[3], values[4], values[5], values[6], values[7], values[8]);
            }
        }
    }
    for (var l = 0; l < bm.length; l++) {
        bmList[l] = bm[l];
    }
    return bmList;
}

function getNewNumber(bookmarkArray) {
    var maxNum = 0;
    for (var i = 0; i < bookmarkArray.length; i++) {
        var num = bookmarkArray[i].bookmarkId.substring("phenixBookmark".length);
        if (num > maxNum) {
            maxNum = new Number(num);
        }
    }
    return (maxNum + 1);
}

function addBookmarkCookie(manualName, manualId, vehicleName, year, sieId, groupName, sieTitle) {
    var bookmarks = new Array();
    bookmarks = getBookmarks();

    var count = 0;
    for (var i = 0; i < bookmarks.length; i++) {
        if (bookmarks[i].bookmarkId.indexOf("phenixBookmark") != -1) {
            count++;
        }
    }
    if (count >= MAX) {
        return false;
    }
    var url = document.location.href.toString().replace(/:/g, "：");

    var i = getNewNumber(bookmarks);
    var name = "phenixBookmark" + i;
    var value = manualName + ":" + manualId + ":" + vehicleName + ":" + year + ":" + sieId + ":"
                + viewTitle.cutByteLength(groupName, phenix_level1NameLength) + ":"
				+ viewTitle.cutByteLength(sieTitle, phenix_sieNameLength) + ":" + url;
    setWebManualCookie(name, value, EXPIRE);

    return true;
}

function deleteBookmarkCookie(bookmarkId) {
    var bookmarks = getBookmarks();
    var bookmark = null;
    for (var i = 0; i < bookmarks.length; i++) {
        if (bookmarks[i].bookmarkId == bookmarkId) {
            bookmark = bookmarks[i];
            break;
        }
    }
    if (bookmark != null) {
        setWebManualCookie(bookmark.bookmarkId, "", -1)
    }
}

var viewTitle = {
    cutByteLength: function (s, len) {
        if (s == null || s.length == 0) {
            return "";
        }
        var size = 0;
        var rIndex = s.length;

        for (var i = 0; i < s.length; i++) {
            size += this.charByteSize(s.charAt(i));
            if (size == len) {
                rIndex = i + 1;
                break;
            } else if (size > len) {
                rIndex = i;
                break;
            }
        }
        return s.substring(0, rIndex);

    },
    charByteSize: function (ch) {
        if (ch == null || ch.length == 0) {
            return 0;
        }
        var charCode = ch.charCodeAt(0);
        if (charCode <= 0x00007F) {
            return 1;
        } else if (charCode <= 0x0007FF) {
            return 2;
        } else if (charCode <= 0x00FFFF) {
            return 3;
        } else {
            return 4;
        }
    }
}