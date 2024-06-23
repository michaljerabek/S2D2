/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";

    const EditorManager = brackets.getModule("editor/EditorManager");
    const Editor = brackets.getModule("editor/Editor");

    const { COMMAND, REGEXP, OPTIONS, TEXTS, CONFIG, NS } = require("CONSTANTS");
    const Options = require("Options");
    const Commands = require("Commands");
    const UI = require("UI");
    const { Position } = require("Position");
    const { Range } = require("Range");
    
    let currentCommand = null;
    let isSelectToCommand = false;
    let shouldCancelExec = false;
    let currentStringNotFoundAnswer = null;
    let currentReplaceWithSpacesAtEndAnswer = null;
    
    function stepRound(number, step = 1, type = "round") {
        return Math[type](number / step) * step;
    }
    
    function execCancelled() {
        return currentStringNotFoundAnswer === undefined || currentReplaceWithSpacesAtEndAnswer === undefined || shouldCancelExec;
    }
    
    function resetExecCancelled() {
        currentStringNotFoundAnswer = null;
        currentReplaceWithSpacesAtEndAnswer = null;
        shouldCancelExec = false;
    }
    
    function applyEdits(editor, edits, origin) {
        if (!editor || !edits?.length) return;
        origin = origin || (NS + Date.now());
        editor.document.doMultipleEdits(edits, origin);
    }
    
    function setSelections(editor, selections, origin) {
        if (!editor || !selections?.length) return;
        origin = origin || (NS + Date.now());
        editor.setSelections(selections.map(
            (selection, index) => {
                selection.primary = selection.primary ?? index === 0;
                return selection;
            }
        ), undefined, undefined, origin);
    }
        
    function shouldRoundToIndent() {
        return Options.get(CONFIG.ROUND_TO_STEP) === OPTIONS.YES;
    }
        
    function shouldMoveOnIndent() { 
        return Options.get(CONFIG.MULTILINE_DELETE_LEFT_ON_INDENT) === OPTIONS.YES;
    }

    function shouldCollectEmptyLines() {
        return Options.get(CONFIG.MULTILINE_PROCESS_COLLECT_EMPTY_LINES) === OPTIONS.YES;
    }
    
    function preserveLineSpaces(deleteLeft) {
        return Options.get(
            deleteLeft ? 
                CONFIG.MULTILINE_DELETE_LEFT_PRESERVE_LINE_SPACES:
                CONFIG.MULTILINE_DELETE_RIGHT_PRESERVE_LINE_SPACES
        ) === OPTIONS.YES;
    }
    
    function useInBlockSearch() { 
        return Options.get(CONFIG.MULTILINE_STRING_SEARCH_MODE) === OPTIONS.IN_BLOCK;
    }

    function shouldMoveToNextLine(editor, deleteLeft) {    
        if (!deleteLeft) {
            const allAtEnd = !editor.getSelections().some(selection => {
                const textAtLine = editor.document.getLine(selection.end.line);
                return !textAtLine.substring(selection.end.ch).match(/^\s*$/);
            });
            return allAtEnd; 
        }
        
        if (shouldMoveOnIndent()) {
            const allOnIndent = !editor.getSelections().some(selection => {
                const textAtLine = editor.document.getLine(selection.start.line);
                return !textAtLine.substring(0, selection.start.ch).match(/^\s+$/);
            });
            if (allOnIndent) return true; 
        }
        return !editor.getSelections().some(selection => selection.start.ch !== 0);
    }

    async function shouldReplaceWithSpacesAtEnd(editor, toString, editRange, allEditRanges) {
        if (toString === undefined) return true;
        
        const replaceWithSpacesAtEndConfig = Options.get(CONFIG.REPLACE_WITH_SPACES_AT_END);
        switch (replaceWithSpacesAtEndConfig) {
            case OPTIONS.ASK_PER_SELECTION: 
                currentReplaceWithSpacesAtEndAnswer = await UI.askForReplaceWithSpacesAtEnd(editor, toString, [editRange], true);
                break;

            case OPTIONS.ASK_PER_EXECUTION: 
                if (currentReplaceWithSpacesAtEndAnswer === null) {
                    currentReplaceWithSpacesAtEndAnswer = await UI.askForReplaceWithSpacesAtEnd(editor, toString, allEditRanges, false);
                }
                break;

            default: 
                currentReplaceWithSpacesAtEndAnswer = replaceWithSpacesAtEndConfig;
        }
        return currentReplaceWithSpacesAtEndAnswer === OPTIONS.YES;
    }

    async function shouldSkipSelection(editor, deleteLeft, toString, selection, allSelections, multiline) {
        const stringNotFoundConfig = Options.get(multiline ? CONFIG.STRING_NOT_FOUND_MULTILINE: CONFIG.STRING_NOT_FOUND);

        switch (stringNotFoundConfig) {
            case OPTIONS.ASK_PER_SELECTION: 
                currentStringNotFoundAnswer = await UI.askForStringNotFound(editor, deleteLeft, toString, [selection], true, multiline, isSelectToCommand);
                break;

            case OPTIONS.ASK_PER_EXECUTION: 
                if (currentStringNotFoundAnswer === null) {
                    currentStringNotFoundAnswer = await UI.askForStringNotFound(editor, deleteLeft, toString, allSelections, false, multiline, isSelectToCommand);
                }
                break;

            default: 
                currentStringNotFoundAnswer = stringNotFoundConfig;
        }
        return currentStringNotFoundAnswer === OPTIONS.SKIP_SELECTION;
    }

    function mergeOverlappingRanges(ranges, deleteLeft) {
        if (ranges.length <= 1) {
            return ranges;
        }

        ranges.sort((a, b) => a.start.line - b.start.line || a.start.ch - b.start.ch);
        if (deleteLeft) {
            ranges.reverse();
        }
        
        return ranges.reduce((merged, range) => {
            const lastRange = merged[merged.length - 1];
            if (lastRange?.contains(range.start) || lastRange?.contains(range.end)) {
                merged[merged.length - 1] = lastRange.union(range);
                return merged;
            }
            merged.push(range);
            return merged;
        }, []);
    }

    function setSelectionsToStart(editor, textEdits, deleteLeft) {
        editor.setSelections(textEdits.map(
            (edit, index) => {
                const selection = new Range(
                    edit.edit.start.line, 
                    edit.edit.start.ch, 
                    edit.edit.start.line, 
                    edit.edit.start.ch
                );
                selection.primary = index === 0;
                return selection;
            }
        ));
    }
    
    function getToStringAsRegExp(toString) {
        try {
            if (toString instanceof RegExp) {
                return toString;
            }

            const toStringRegExp = toString.match(REGEXP.TO_STRING_REGEXP);
            if (toStringRegExp) {
                return new RegExp(toStringRegExp[1], toStringRegExp[2].replace("g", "") + "g");
            }

            let escapedToString = toString.replace(REGEXP.STRING_FOR_REGEXP, "\\$&");
            escapedToString = escapedToString.match(REGEXP.ESCAPED_TO_STRING_REGEXP) ? 
                escapedToString.replace(REGEXP.REPLACE_ESCAPED_TO_STRING_REGEXP, "/$1"): escapedToString;
            return new RegExp(escapedToString, "g");
        } catch (e) {
           	shouldCancelExec = true;
            UI.showError(TEXTS.INVALID_TO_STRING_REGEXP);
            return REGEXP.INVALID;
        }
    }
    
    function isCharacterAtEdgeOfLine(textAtLine, charPosition, atStart) {
        if (atStart && Options.get(CONFIG.MULTILINE_DELETE_LEFT_ON_INDENT) === OPTIONS.YES) {
            return !!textAtLine.substring(0, charPosition).match(/^\s*$/);
        }
        return (
            (atStart && charPosition === 0) || 
            (!atStart && (
                    charPosition === textAtLine.length ||
                    !!textAtLine.substring(charPosition).match(/^\s*$/)
                )
            )
        );
    }

    function getAtLineEverythingLeftChar(editor, selection, textAtLine, searchFromChar, deleteLeft = true) {
        const indentOption = Options.get(CONFIG.DELETE_LEFT_STOP_AT_INDENT);
        const stopAtIndent = isSelectToCommand || [OPTIONS.YES, OPTIONS.ROUND_TO_STEP].includes(indentOption);
        const roundToStep = !isSelectToCommand && indentOption === OPTIONS.ROUND_TO_STEP;
        
        if (stopAtIndent || !deleteLeft) {
            let firstNonSpaceChar = (/[^\s]/.exec(textAtLine)?.index || 0);
            firstNonSpaceChar = firstNonSpaceChar > searchFromChar ? searchFromChar: firstNonSpaceChar;
            let deleteToChar = firstNonSpaceChar === searchFromChar ? 0: firstNonSpaceChar;
            
            if (deleteLeft && roundToStep) {
                const tabSize = editor._codeMirror.options.indentUnit;
                deleteToChar = stepRound(deleteToChar, tabSize, "floor"); 
            }
            return deleteToChar;
        }
        return 0;
    }

    function getAtLineStringIndex(textAtLine, toString, searchFromChar, includeString, deleteLeft) {
        searchFromChar = Number.isInteger(searchFromChar) ? searchFromChar: deleteLeft ? textAtLine.length: 0;
        let toStringRegExp = getToStringAsRegExp(toString); 
        toStringRegExp.lastIndex = 0;
        let linePartToSearch = textAtLine.slice(deleteLeft ? 0: searchFromChar, deleteLeft ? searchFromChar: textAtLine.length);
        let searchResult = toStringRegExp.exec(linePartToSearch);
        let searchResultIndex = searchResult?.index || -1; 
        let nextSearchResult = searchResult;

        while (deleteLeft && nextSearchResult) {
            nextSearchResult = toStringRegExp.exec(linePartToSearch);
            searchResult = nextSearchResult || searchResult;
            if (searchResultIndex === searchResult.index) { break; }
            searchResultIndex = searchResult.index;
        }
        
        if (searchResult) {
            let toStringIndex = deleteLeft ? searchResult.index: searchResult.index + searchFromChar;
            let stringOffset = (deleteLeft && !includeString) || (!deleteLeft && includeString) ? searchResult[0].length: 0;
            return toStringIndex + stringOffset;
        }

        return -1;
    }

    function getDeleteToPositionDataForDelete(editor, selection, deleteLeft) {
        const tabSize = editor._codeMirror.options.indentUnit;
        const lineCount = editor._codeMirror.doc.size;
        const deleteLeftByCommand = deleteLeft;
        let deleteToLine = selection[deleteLeft ? "start": "end"].line;
        let searchFromChar = selection[deleteLeft ? "start": "end"].ch;
        let deleteToChar = -1;
        let verifySelection = false;
        let textAtLine = editor.document.getLine(deleteToLine);
        let emptyLineFound = false;
        
        const moveToNextLine = shouldMoveToNextLine(editor, deleteLeft) && 
            isCharacterAtEdgeOfLine(textAtLine, searchFromChar, deleteLeft);

        if (moveToNextLine) { 
            deleteToLine += deleteLeft ? -1: 1;
            textAtLine = editor.document.getLine(deleteToLine);
            
            if (shouldCollectEmptyLines()) {    
                while (textAtLine?.match(/^\s*$/)) {  
                    emptyLineFound = true;
                    deleteToLine += deleteLeft ? -1: 1;
                    if (deleteToLine >= 0 && deleteToLine <= lineCount - 1) {
                        textAtLine = editor.document.getLine(deleteToLine);
                    } else break;
                }   
                if (emptyLineFound) {
                    deleteToLine -= deleteLeft ? -1: 1;     
                    textAtLine = editor.document.getLine(deleteToLine);
                }
            } else {
                if (textAtLine?.match(/^\s*$/)) {
                    emptyLineFound = true;   
                }
            }
            deleteLeft = !deleteLeft;
        }

        if (deleteToLine >= 0 && deleteToLine <= lineCount - 1) {
            
            if (deleteLeft) {
                if (emptyLineFound && moveToNextLine) {
                    deleteToChar = textAtLine.length;
                } else {   
                    if (moveToNextLine) { 
                        searchFromChar = deleteLeft ? textAtLine.length: 0;
                    }
                    if (isSelectToCommand) {
                        deleteToChar = getAtLineEverythingLeftChar(editor, selection, textAtLine, searchFromChar, deleteLeftByCommand);
                    } else {
                        deleteToChar = moveToNextLine && preserveLineSpaces(deleteLeftByCommand) ? 
                            0: 
                            getAtLineEverythingLeftChar(editor, selection, textAtLine, searchFromChar, deleteLeftByCommand);
                    }
                }
            } else {    
                if (isSelectToCommand) {
                    deleteToChar = textAtLine.match(/\s*$/)?.index;
                    if (!moveToNextLine && deleteToChar === searchFromChar) {
                        deleteToChar = textAtLine.length;
                    }
                } else {
                     deleteToChar = moveToNextLine && !preserveLineSpaces(deleteLeftByCommand) ?
                        textAtLine.match(/\s*$/)?.index || textAtLine.length:
                        textAtLine.length;
                }
            }
        }
        
        return { deleteToLine, deleteToChar, verifySelection };
    }
    
    function getDeleteToPositionDataForDeleteToString(editor, selection, deleteLeft, toString, includeString) {
        let deleteToLine = selection[deleteLeft ? "start": "end"].line;
        let searchFromChar = selection[deleteLeft ? "start": "end"].ch;
        let deleteToChar = -1;
        let textAtLine = editor.document.getLine(deleteToLine);
        deleteToChar = toString === "" ? -1: getAtLineStringIndex(textAtLine, toString, searchFromChar, includeString, deleteLeft);
        
        const verifySelection = deleteToChar === -1 && toString !== "";
        
        if (deleteToChar === -1) {
            deleteToChar = deleteLeft ? getAtLineEverythingLeftChar(editor, selection, textAtLine, searchFromChar): textAtLine.length;
        }        
        
        return { deleteToLine, deleteToChar, verifySelection };
    }
    
    function getTextFromSelectionToEdge(editor, selection, deleteLeft) {
        const lastLineIndex = editor._codeMirror.doc.size - 1;
        const { start, end } = new Range(
            selection[deleteLeft ? "start": "end"].line,
            selection[deleteLeft ? "start": "end"].ch,
            deleteLeft ? 0: lastLineIndex,
            deleteLeft ? 0: editor.document.getLine(lastLineIndex).length
        );
        return editor.document.getRange(start, end);
    }
    
    function getInBlockStringPosition(editor, selection, toString, includeString, deleteLeft) {
        let searchFromChar = selection[deleteLeft ? "start": "end"].ch;
        let textInBlock = getTextFromSelectionToEdge(editor, selection, deleteLeft);
        let toStringRegExp = getToStringAsRegExp(toString); 
        let searchResult = toStringRegExp.exec(textInBlock);
        let searchResultIndex = searchResult?.index || -1;
        let nextSearchResult = searchResult;
        let line = selection[deleteLeft ? "start": "end"].line;
        let character = -1;

        while (deleteLeft && nextSearchResult) {
            nextSearchResult = toStringRegExp.exec(textInBlock);
            searchResult = nextSearchResult || searchResult;
            if (searchResultIndex === searchResult.index) { break; }
            searchResultIndex = searchResult.index;
        }

        if (searchResult && deleteLeft) {
            let textResultFromChar = searchResult.index + (includeString ? 0: searchResult[0].length);
            let textResult = textInBlock.slice(textResultFromChar, textInBlock.length);
            let textResultLines = textResult.split(/\r?\n/);
            let textBeforeResultToChar = searchResult.index + (includeString ? 0: searchResult[0].length);
            let textBeforeResult = textInBlock.slice(0, textBeforeResultToChar);
            let textBeforeResultLines = textBeforeResult.split(/\r?\n/);
            character = textBeforeResultLines[textBeforeResultLines.length - 1].length;
            line += (textResultLines.length - 1) * -1;
        }

        if (searchResult && !deleteLeft) {
            let textResultToChar = searchResult.index + (includeString ? searchResult[0].length: 0);
            let textResult = textInBlock.slice(0, textResultToChar);
            let textResultLines = textResult.split(/\r?\n/);
            character = textResultLines[textResultLines.length - 1].length;
            character += textResultLines.length === 1 ? searchFromChar: 0;
            line += textResultLines.length - 1;
        }

        return new Position(line, character);
    }

    function getLineByLineStringPosition(editor, selection, toString, includeString, deleteLeft) {
        let lastLineIndex = editor._codeMirror.doc.size - 1;
        let searchFromChar = selection[deleteLeft ? "start": "end"].ch;
        let line = selection[deleteLeft ? "start": "end"].line;
        let character = -1;

        while (line >= 0 && line <= lastLineIndex) {
            let textAtLine = editor.document.getLine(line);
            character = getAtLineStringIndex(textAtLine, toString, searchFromChar, includeString, deleteLeft);
            if (character > -1) { break; }
            line += deleteLeft ? -1: 1;
            searchFromChar = null;
        }

        return new Position(line, character);
    }

    function getDeleteToPositionDataForDeleteToStringMultiline(editor, selection, deleteLeft, toString, includeString) {
        let searchFromLine = selection[deleteLeft ? "start": "end"].line;
        let deleteToLine = searchFromLine;
        let deleteToChar = -1;

        if (toString !== "") {
            let deleteToPosition = useInBlockSearch() ?
                getInBlockStringPosition(editor, selection, toString, includeString, deleteLeft):
                getLineByLineStringPosition(editor, selection, toString, includeString, deleteLeft);

            if (deleteToPosition.ch > -1) {
                deleteToLine = deleteToPosition.line;
                deleteToChar = deleteToPosition.ch;
            }
        }

        const verifySelection = deleteToChar === -1 && toString !== "";

        if (deleteToChar === -1) {
            deleteToLine = deleteLeft ? 0: editor._codeMirror.doc.size - 1;
            let textAtLine = deleteLeft ? undefined: editor.document.getLine(deleteToLine);
            deleteToChar = deleteLeft ? 0: textAtLine.length;
        }
        
        return { deleteToLine, deleteToChar, verifySelection };
    }

    function getDeleteToPositionData(editor, selection, deleteLeft, toString, includeString, multiline) {
        switch (currentCommand) {
            case COMMAND.DELETE_TO_STRING_LEFT:
            case COMMAND.DELETE_TO_STRING_RIGHT:
            case COMMAND.SELECT_TO_STRING_LEFT:
            case COMMAND.SELECT_TO_STRING_RIGHT:
                return getDeleteToPositionDataForDeleteToString(editor, selection, deleteLeft, toString, includeString);
                
            case COMMAND.DELETE_TO_STRING_LEFT_MULTILINE:
            case COMMAND.DELETE_TO_STRING_RIGHT_MULTILINE:
            case COMMAND.SELECT_TO_STRING_LEFT_MULTILINE:
            case COMMAND.SELECT_TO_STRING_RIGHT_MULTILINE:
                return getDeleteToPositionDataForDeleteToStringMultiline(editor, selection, deleteLeft, toString, includeString);
                
            default: 
                return getDeleteToPositionDataForDelete(editor, selection, deleteLeft);
        }
    }

    function getEditRangesData(editor, deleteLeft, toString, includeString, multiline) {
        const editRangesData = editor.getSelections().map(selection => {
            const searchFromLine = selection[deleteLeft ? "end": "start"].line;
            const deleteFromChar = selection[deleteLeft ? "end": "start"].ch;
            const { deleteToLine, deleteToChar, verifySelection } = getDeleteToPositionData(editor, selection, deleteLeft, toString, includeString, multiline);
            
            if (deleteToChar === -1 || (deleteToLine === searchFromLine && deleteToChar === deleteFromChar)) {
                return null;
            }
            const editRange = new Range(searchFromLine, deleteFromChar, deleteToLine, deleteToChar);
            return { editRange, selection, verifySelection };
        });

        return editRangesData.filter(editRangeData => editRangeData !== null);
    }

    function getDeleteTextEdits(editRanges) {
        return editRanges.map(function (change) {
            change.text = "";
            return { edit: change };
        });
    }

    function getReplaceTextEditsData(editor, editRanges) {
        return editRanges.map(editRange => {
            const textAtRange = editor.document.getRange(editRange.start, editRange.end);
            const textAfterEnd = editor.document.getLine(editRange.end.line).substring(editRange.end.ch);
            const textAfterEndHasContent = textAfterEnd.trim().length > 0;
            return {
                editRange, 
                replaceWith: textAtRange.replace(/[^\n\r\t]/g, " "),
                verifyReplacement: !textAfterEndHasContent
            };
        });
    }

    function getReplaceTextEdits(editor, editRanges, toString) {
        const textEditsData = getReplaceTextEditsData(editor, editRanges);
        const editRangesToVerify = textEditsData.filter(({ verifyReplacement }) => verifyReplacement).map(({editRange}) => editRange);

        return textEditsData.reduce(async (textEdits, { verifyReplacement, editRange, replaceWith }) => {
            textEdits = await textEdits;
            if (execCancelled()) { return null; }

            const replace = !verifyReplacement || (await shouldReplaceWithSpacesAtEnd(editor, toString, editRange, editRangesToVerify));
            if (execCancelled()) { return null; }

            editRange.text = replace ? replaceWith: "";
            const textEdit = { edit: editRange };
            textEdits.push(textEdit);
            return textEdits;
        }, []);
    }

    async function getTextEdits(editor, editRanges, replaceWithSpaces, toString) {
        return replaceWithSpaces ? getReplaceTextEdits(editor, editRanges, toString): getDeleteTextEdits(editRanges);
    }

    async function getEditRanges(editor, deleteLeft, toString, includeString, multiline) {
        const editRangesData = getEditRangesData(editor, deleteLeft, toString, includeString, multiline);
        const selectionsToVerify = editRangesData.filter(({ verifySelection }) => verifySelection).map(({ selection }) => selection);

        return editRangesData.reduce(async (editRanges, { verifySelection, selection, editRange }) => {
            editRanges = await editRanges;
            if (execCancelled()) { return null; }

            const skipSelection = verifySelection && (await shouldSkipSelection(editor, deleteLeft, toString, selection, selectionsToVerify, multiline));
            if (execCancelled()) { return null; }

            if (!skipSelection) {
                if (isSelectToCommand && editRange.equals(selection)) {
                    editRange.noChange = true;
                }
                editRanges.push(editRange);
            }
            if (skipSelection && isSelectToCommand) {
                const range = new Range(
                    selection.start.line,
                    selection.start.ch,
                    selection.end.line,
                    selection.end.ch
                );
                range.noChange = true;
                editRanges.push(range);
            }
            return editRanges;
        }, []);
    }

    async function execDeleteToString(deleteLeft = false, multiline = false) {
        const toString = await UI.askForToString(false, deleteLeft, multiline);
        if (toString === undefined) { 
            return UI.showWarning(TEXTS.EXEC_CANCELLED); 
        }
        
        const includeString = toString ? await UI.askForIncludeString(toString): undefined;
        if (toString && includeString === undefined) { 
            UI.preserveLastUsedToString(toString);
            return UI.showWarning(TEXTS.EXEC_CANCELLED); 
        }

        await execDelete(deleteLeft, toString, includeString === OPTIONS.YES, multiline);
    }

    async function execSelectToString(selectLeft = false, multiline = false) {
        const toString = await UI.askForToString(true, selectLeft, multiline);
        if (toString === undefined) { 
            return UI.showWarning(TEXTS.EXEC_CANCELLED); 
        }
        
        const includeString = toString ? await UI.askForIncludeString(toString): undefined;
        if (toString && includeString === undefined) { 
            UI.preserveLastUsedToString(toString);
            return UI.showWarning(TEXTS.EXEC_CANCELLED); 
        }

        await execSelect(selectLeft, toString, includeString === OPTIONS.YES, multiline);
    }

    async function execDelete(deleteLeft = false, toString = undefined, includeString = false, multiline = false) {
        resetExecCancelled();
        const editor = EditorManager.getFocusedEditor();
        if (!editor) return;

        const replaceWithSpaces = editor._codeMirror.state.overwrite;
        const editRanges = await getEditRanges(editor, deleteLeft, toString, includeString, multiline);        

		if (editRanges?.length) {
			const mergedEditRanges = mergeOverlappingRanges(editRanges, deleteLeft);
			const textEdits = await getTextEdits(editor, mergedEditRanges, replaceWithSpaces, toString);
            
			if (!execCancelled() && textEdits?.length) {
				applyEdits(editor, textEdits);
                if (replaceWithSpaces) {
                    setSelectionsToStart(editor, textEdits, deleteLeft);
                }
	
                if (mergedEditRanges.length !== editRanges.length) {
					UI.showInfo(TEXTS.SELECTIONS_MERGED(editRanges.length - mergedEditRanges.length));
				}
			}
		}
        if (!execCancelled() && !editRanges?.length) {
            UI.showInfo(TEXTS.NO_DELETE);
        }
        
        if (toString !== undefined) {
            UI.preserveLastUsedToString(toString);
        }
    }

    async function execSelect(selectLeft = false, toString = undefined, includeString = false, multiline = false) {
        resetExecCancelled();
        const editor = EditorManager.getFocusedEditor();
        if (!editor) return;

        const selectRanges = await getEditRanges(editor, selectLeft, toString, includeString, multiline);        

        if (selectRanges?.length) {
			const mergedSelectRanges = mergeOverlappingRanges(selectRanges, selectLeft);
            
			if (!execCancelled() && mergedSelectRanges?.length) {
                setSelections(editor, mergedSelectRanges);
	
                if (mergedSelectRanges.length !== selectRanges.length) {
					UI.showInfo(TEXTS.SELECTIONS_MERGED(selectRanges.length - mergedSelectRanges.length));
				}
			}
		}
        
        if (!execCancelled() && (!selectRanges?.length || selectRanges.every(range => range.noChange))) {
            UI.showInfo(TEXTS.NO_SELECTION_CHANGED);
        }
        
        if (toString !== undefined) {
            UI.preserveLastUsedToString(toString);
        }
    }
    
    function setSelectionsDirection(editor, selections, toLeft = false) {
        return setSelections(editor, selections.map(
            selection => {
                selection.reversed = toLeft;
                return selection;
            })
        );
    }
    
    async function execChangeSelectionDirection() {
        resetExecCancelled();
        const editor = EditorManager.getFocusedEditor();
        if (!editor) return;

        const selections = editor.getSelections();
        const reversed = selections.filter(selection => selection.reversed);
        const allHaveSameDir = reversed.length === 0 || reversed.length === selections.length;
        
        if (allHaveSameDir && Options.get(CONFIG.SELECTION_AUTO_FLIP) === OPTIONS.YES) {
            return setSelectionsDirection(editor, selections, reversed.length === 0);
        }
        
        const direction = await UI.askForSelectionDirection(editor, selections, allHaveSameDir, reversed.length !== 0);
        if (direction === undefined) {
            return UI.showWarning(TEXTS.EXEC_CANCELLED); 
        }
        
        if (allHaveSameDir) {
            if (reversed.length && direction === OPTIONS.RIGHT_TO_LEFT) {
                return UI.showInfo(TEXTS.NO_SELECTION_CHANGED);
            } 
            if (!reversed.length && direction === OPTIONS.LEFT_TO_RIGHT) {
                return UI.showInfo(TEXTS.NO_SELECTION_CHANGED);
            }
        }

        return setSelectionsDirection(editor, selections, direction === OPTIONS.RIGHT_TO_LEFT);
    }
    
    async function execTrimSelection() {
        resetExecCancelled();
        const editor = EditorManager.getFocusedEditor();
        if (!editor) return;

        const selections = editor.getSelections();
        let changedSelections = 0;
        const trimmed = selections.map(selection => {
            const { start, end } = selection;
            const text = editor.document.getRange(start, end);
            let deleteFromStart = text.match(/[^\s]/)?.index;
            let deleteFromEnd = text.match(/(?<=[^\s])\s*$/)?.index;
            if (deleteFromStart || deleteFromEnd) {
                deleteFromStart = deleteFromStart ?? 0;
                deleteFromEnd = text.length - (deleteFromEnd ?? text.length);
                const trimmedStart = editor._codeMirror.findPosH(start, deleteFromStart, "char");
                const trimmedEnd = editor._codeMirror.findPosH(end, -deleteFromEnd, "char");
                if (trimmedStart.line !== start.line || trimmedEnd.line !== end.line || trimmedStart.ch !== start.ch || trimmedEnd.ch !== end.ch) {
                    selection.start.line = trimmedStart.line;
                    selection.start.ch = trimmedStart.ch;
                    selection.end.line = trimmedEnd.line;
                    selection.end.ch = trimmedEnd.ch;
                    changedSelections++;
                }
            }
            return selection;
        });
        
        if (!changedSelections) {
            return UI.showInfo(TEXTS.NO_SELECTION_CHANGED);
        } 

        setSelections(editor, trimmed);
    }
    
    Commands.init(async function exec(command, ...args) {
        currentCommand = command;

        switch (command) {
            case COMMAND.CHANGE_SELECTION_DIRECTION:
                isSelectToCommand = false;
                await execChangeSelectionDirection(...args);
                break;
                
            case COMMAND.TRIM_SELECTION:
                isSelectToCommand = false;
                await execTrimSelection(...args);
                break;
                
            case COMMAND.DELETE_TO_STRING_LEFT:
            case COMMAND.DELETE_TO_STRING_RIGHT:
            case COMMAND.DELETE_TO_STRING_LEFT_MULTILINE:
            case COMMAND.DELETE_TO_STRING_RIGHT_MULTILINE:
                isSelectToCommand = false;
                await execDeleteToString(...args);
                break;
                
            case COMMAND.SELECT_TO_STRING_LEFT:
            case COMMAND.SELECT_TO_STRING_RIGHT:
            case COMMAND.SELECT_TO_STRING_LEFT_MULTILINE:
            case COMMAND.SELECT_TO_STRING_RIGHT_MULTILINE:
                isSelectToCommand = true;
                await execSelectToString(...args);
                break;
                
            case COMMAND.SELECT_LEFT:
            case COMMAND.SELECT_RIGHT:
                isSelectToCommand = true;
                await execSelect(...args);
                break;
                
            case COMMAND.DELETE_LEFT:
            case COMMAND.DELETE_RIGHT:
                isSelectToCommand = false;
                await execDelete(...args);
                break;
        }
    });
});