/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";
    
    const ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
    const { NS } = require("CONSTANTS");
    const { Range } = require("Range");
    
    const CLASS = {
        self: NS + "__text-marker",
        selfWidget: NS + "__text-marker--widget",
        searching: "CodeMirror-searching searching-current-match",
        startStyle: "searching-first",
        endStyle: "searching-last"
    };
        
    ExtensionUtils.addEmbeddedStyleSheet(`
        .${CLASS.selfWidget} { 
            display: inline-block;
            vertical-align: bottom;
            height: 1lh;
            width: 2px;
            margin-inline: -1px;
        }
    `);

    let activeMarkers = [];

    function createBookmarkWidget() {
        const widget = document.createElement("span");
        widget.className = CLASS.searching + " " + CLASS.self + " " + CLASS.selfWidget;
        widget.animate([{ opacity: 1 }, { opacity: 0, offset: 0.5 }], {
            duration: 1000,
            iterations: Infinity,
            easing: "steps(2)",
            delay: 300
        });
        return widget;
    }
    
    exports.clearAll = function clearAll() {
        activeMarkers.forEach(marker => marker.clear());
    };

    exports.create = function create(editor, range, clearActive, reveal) {
        if (clearActive) {
            exports.clearAll();
        }
        if (range instanceof Array) {
            return range.map((range, r) => exports.create(editor, range, false, !r && reveal));
        }
        
        range = new Range(range.start.line, range.start.ch, range.end.line, range.end.ch);
        let marker = null;
        
        if (range.isEmpty()){
            const widget = createBookmarkWidget();
            marker = editor._codeMirror.doc.setBookmark(range.start, { widget });
        } else {
            marker = editor._codeMirror.doc.markText(range.start, range.end, {
                className: CLASS.searching + " " + CLASS.self,
                readOnly: true,
                startStyle: CLASS.startStyle,
                endStyle: CLASS.endStyle
            });
        }
        
        if (marker) {
            activeMarkers.push(marker);
            marker.on("clear", function () {
                activeMarkers = activeMarkers.filter(active => active !== marker);
            });
            
            if (reveal) {
                editor._codeMirror.scrollIntoView(
                    range.start, 
                    editor.$el.outerHeight() / 2
                );
            }
        }

        return marker;
    };
});
