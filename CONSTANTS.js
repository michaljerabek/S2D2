/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";
    
    exports.NS = "mjerabek_cz_S2D2";
    exports.CMD_NS = "mjerabek.cz.S2D2";
    exports.PREF_NS = "mjerabek.cz.S2D2";
    exports.TITLE = "S2D2";
    exports.FULL_TITLE = exports.TITLE + ": Select To / Delete To";

    exports.COMMAND = {
        DELETE_LEFT: exports.CMD_NS + ".deleteLeft",
        DELETE_RIGHT: exports.CMD_NS + ".deleteRight",
        DELETE_TO_STRING_LEFT: exports.CMD_NS + ".deleteToStringLeft",
        DELETE_TO_STRING_RIGHT: exports.CMD_NS + ".deleteToStringRight",
        DELETE_TO_STRING_LEFT_MULTILINE: exports.CMD_NS + ".deleteToStringLeftMultiline",
        DELETE_TO_STRING_RIGHT_MULTILINE: exports.CMD_NS + ".deleteToStringRightMultiline",
        SELECT_LEFT: exports.CMD_NS + ".selectLeft",
        SELECT_RIGHT: exports.CMD_NS + ".selectRight",
        SELECT_TO_STRING_LEFT: exports.CMD_NS + ".selectToStringLeft",
        SELECT_TO_STRING_RIGHT: exports.CMD_NS + ".selectToStringRight",
        SELECT_TO_STRING_LEFT_MULTILINE: exports.CMD_NS + ".selectToStringLeftMultiline",
        SELECT_TO_STRING_RIGHT_MULTILINE: exports.CMD_NS + ".selectToStringRightMultiline",
        CHANGE_SELECTION_DIRECTION: exports.CMD_NS + ".changeSelectionDirection",
        TRIM_SELECTION: exports.CMD_NS + ".trimSelection",
        OPEN_OPTIONS: exports.CMD_NS + ".openOptions",
        getName: command => command.replace(exports.CMD_NS + ".", "")
    };
    
    exports.OPTIONS = {
        NO: "No",
        YES: "Yes",
        SKIP_SELECTION: "Skip selection",
        PROCESS_EVERYTHING: "Delete / Select everything left or right",
        ASK_PER_SELECTION: "Ask per selection",
        ASK_PER_EXECUTION: "Ask per execution",
        ALL: "All",
        FLIP: "Flip",
        ERRORS_ONLY: "Errors only",
        ERRORS_WARNINGS: "Errors and warnings",
        LINE_BY_LINE: "Line by line",
        IN_BLOCK: "Block before or after selection",
        ROUND_TO_STEP: "Yes, closest step",
        LEFT_TO_RIGHT: "Right",
        RIGHT_TO_LEFT: "Left",
        PREDEFINDED_STRINGS: [
            { 
                label: "Comment",
                value: "/\\/\\/|\\/\\*|\\*\\//"
            },
            { 
                label: "End of block at indent",
                value: "/(?<=^(\\s{4}){1})(?:[\\)\\]\\}]|\<\\/[a-z-]+\\>)/",
                selection: [14, 15]
            },
            { 
                label: "Comma or end",
                value: "/,\\s*$|$/"
            }
        ],
        EDIT_MENU_TOOLBAR: "Edit menu and toolbar",
        EDIT_MENU: "Edit menu",
        TOOLBAR: "Toolbar",
        MENU_COMMANDS: Object.values(exports.COMMAND)
            .filter(command => 
                typeof command === "string" && 
                command !== exports.COMMAND.OPEN_OPTIONS
            )
            .map(command => exports.COMMAND.getName(command)),
        MENU_APPEARANCE_ITEMS: "Items",
        MENU_APPEARANCE_NONE: "None",
        MENU_APPEARANCE_SUBMENU: "Submenu",
        DEFAULT: {
            NOTIFICATION_DURATION: () => ({
                [exports.CONFIG.NOTIFICATION_ERROR]: 12,
                [exports.CONFIG.NOTIFICATION_WARNING]: 9,
                [exports.CONFIG.NOTIFICATION_INFO]: 6
            }),
            MENU_COMMANDS: () => exports.OPTIONS.MENU_COMMANDS.filter(
                command => command.includes("Selection") || command.includes("ToString")
            )
        }
    };

    exports.TEXTS = {
        SELECTION_TEXT: selectionOrRange => {
            const { start, end } = selectionOrRange;
            let selectionText = `Ln: ${start.line + 1}, Col: ${start.ch + 1}`;
            if (start.line !== end.line || start.ch !== end.ch) {
                selectionText += " \u2192 ";
                selectionText += start.line !== end.line ? `Ln: ${end.line + 1}, ` : "";
                selectionText += `Col: ${end.ch + 1}`;
            }
            return selectionText;
        },
        PROCESS_LEFT(isSelectToCommand) { 
            return `${isSelectToCommand ? "Select": "Delete"} everything left`;
        },
        PROCESS_RIGHT(isSelectToCommand) { 
            return `${isSelectToCommand ? "Select": "Delete"} everything right`;
        },
        SKIP_SELECTION(count) {
            return `Skip selection${count > 1 ? "s": ""}`;
        },
        STRING_NOT_FOUND_ASK_PER_EXECUTION(count) {
            return `String was not found for ${count} selection${count > 1 ? "s": ""}...`;
        },
        STRING_NOT_FOUND_ASK_PER_SELECTION(selection) { 
            return `String was not found for selection: ${this.SELECTION_TEXT(selection)}...`; 
        },
        SET_STRING(isSelectToCommand) {
            return `S2D2: Set the string / regular expression to ${isSelectToCommand ? "select": "delete"} up to:`;
        },
        SET_STRING_PLACEHOLDER: "E.g.: //, let, });, /\\w/, /Abc/i",
        INVALID_TO_STRING_REGEXP: "Invalid regular expression!",
        INCLUDE_STRING: "Include the string?",
        CHANGE_SELECTION_DIRECTION(count) {
            return `Set direction of selection${count > 1 ? "s": ""} to:`;
        },
        REPLACE_WITH_SPACES_AT_END_ASK_PER_EXECUTION: "Replace with spaces at the end of lines?",
        REPLACE_WITH_SPACES_AT_END_ASK_PER_SELECTION(selection) { 
            return `No more content at the end for edit: ${this.SELECTION_TEXT(selection)}. Replace with spaces?`;
        },
        SELECTIONS_SKIPPED(count) {
            return `${count} selection${count > 1 ? "s": ""} skipped!`;
        },
        SELECTIONS_MERGED(count) {
            return `${count} selection${count > 1 ? "s": ""} merged!`;
        },
        NO_SELECTION_CHANGED: "No selection changed.",
        NO_DELETE: "Nothing was deleted.",
        EXEC_CANCELLED: "Execution cancelled!"
    };

    exports.REGEXP = {
        INVALID: /^iNVaLiDrEGeXp$/,
        TO_STRING_REGEXP: /^\/([^]+)\/([^]*)$/,
        STRING_FOR_REGEXP: /[.*+?^${}()|[\]\\]/g,
        ESCAPED_TO_STRING_REGEXP: /^\\\\\/[^]+\\\\\/[^]*$/,
        REPLACE_ESCAPED_TO_STRING_REGEXP: /^\\\\\/|\\\\\/([^]*)$/g
    };

    exports.CONFIG = {
        STRING_NOT_FOUND: "stringNotFound",
        STRING_NOT_FOUND_MULTILINE: "stringNotFoundMultiline",
        REPLACE_WITH_SPACES_AT_END: "replaceWithSpacesAtEnd",
        MULTILINE_STRING_SEARCH_MODE: "multilineStringSearchMode",
        MULTILINE_DELETE_LEFT_ON_INDENT: "multilineDeleteLeftOnIndent",
        MULTILINE_PROCESS_COLLECT_EMPTY_LINES: "multilineProcessCollectEmptyLines",
        MULTILINE_DELETE_LEFT_PRESERVE_LINE_SPACES: "multilineDeleteLeftPreserveLineSpaces",
        MULTILINE_DELETE_RIGHT_PRESERVE_LINE_SPACES: "multilineDeleteRightPreserveLineSpaces",
        DELETE_LEFT_STOP_AT_INDENT: "deleteLeftStopAtIndent",
        PREDEFINED_STRINGS: "predefinedStrings",
        PREDEFINED_STRINGS_SELECT_BEHAVIOR: "predefinedStringsSelectBehavior",
        SHOW_NOTIFICATIONS: "showNotifications",
        NOTIFICATION_DURATION: "notificationDuration",
        NOTIFICATION_ERROR: "error",
        NOTIFICATION_WARNING: "warning",
        NOTIFICATION_INFO: "info",
        PRESERVE_OPTIONS_ORDER: "preserveOptionsOrder",
        OPTIONS_PLACE: "optionsPlace",
        MENU_COMMANDS: "menuCommands",
        MENU_APPEARANCE: "menuAppearance",
        SELECTION_AUTO_FLIP: "changeSelectionAutoFlip",
        SELECTION_OPPOSITE_FIRST: "changeSelectionOppositeFirst"
    };    
});
