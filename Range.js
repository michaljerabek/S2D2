/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";
    
    const { Position } = require("Position");
       
    exports.Range = class Range {
        constructor(startLine, startCh, endLine, endCh) {
            const start = new Position(startLine, startCh);
            const end = new Position(endLine, endCh);
            this.reversed = start.isBefore(end) === false;
            this.start = this.reversed ? end: start;
            this.end = this.reversed ? start: end;
        }
        
        isEmpty() {
            return this.start.line === this.end.line && this.start.ch === this.end.ch;
        }
        
        equals(range) {
            return !(
                this.start.line !== range.start.line ||
                this.start.ch !== range.start.ch ||
                this.end.line !== range.end.line ||
                this.end.ch !== range.end.ch
            );
        } 
        
        contains(positionOrRange) {
            if (positionOrRange instanceof Range) {
                return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
            } 
            if (positionOrRange instanceof Position) {
                if (positionOrRange.line < this.start.line || positionOrRange.line > this.end.line) {
                    return false;
                }
                if (positionOrRange.line === this.start.line && positionOrRange.ch < this.start.ch) {
                    return false;
                }
                if (positionOrRange.line === this.end.line && positionOrRange.ch > this.end.ch) {
                    return false;
                }
                return true;
            }
            return false;
        }

        union(range) {
            let startLine, startCh, endLine, endCh;

            if (range.start.line < this.start.line) {
                startLine = range.start.line;
                startCh = range.start.ch;
            } else if (range.start.line === this.start.line) {
                startLine = range.start.line;
                startCh = Math.min(range.start.ch, this.start.ch);
            } else {
                startLine = this.start.line;
                startCh = this.start.ch;
            }

            if (range.end.line > this.end.line) {
                endLine = range.end.line;
                endCh = range.end.ch;
            } else if (range.end.line === this.end.line) {
                endLine = range.end.line;
                endCh = Math.max(range.end.ch, this.end.ch);
            } else {
                endLine = this.end.line;
                endCh = this.end.ch;
            }

            return new Range(startLine, startCh, endLine, endCh);
        }
    };
});
