/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";
       
    exports.Position = class Position {
        constructor(line, ch) {
            this.line = line;
            this.ch = ch;
        }
        
        isBefore(position) {
            if (position.line < this.line) {
                return false;
            }
            if (position.line === this.line && position.ch < this.ch) {
                return false;
            }
            return true;
        }
    };
});
