/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";
    
    const Dialogs = brackets.getModule("widgets/Dialogs");
    const ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
    const { QuickSearchField } = brackets.getModule("search/QuickSearchField");
    const { ModalBar } = brackets.getModule("widgets/ModalBar");
    const Options = require("Options");
    const TextMarker = require("TextMarker");
    const { NS, TITLE, TEXTS, OPTIONS, REGEXP, CONFIG } = require("CONSTANTS");
    
    const CLASS = {
        toast: NS + "__toast"  
    };
    
    const ID = {
        toStringInput: NS + "__to-string-input"  
    };
    
    ExtensionUtils.addEmbeddedStyleSheet(`
        .${CLASS.toast} { 
            padding: 12px 15px !important;
            line-height: normal !important;
            transition-delay: 0s !important; 
        }
        .${CLASS.toast} p { 
            margin: 0;
        }
        .${CLASS.toast} .notification-dialog-title { 
            padding-right: 20px !important;
            margin-bottom: 0px !important;
        }
        .${CLASS.toast} .notification-dialog-content { 
            margin-bottom: 3px !important;
        }
    `);
    
    const lastUsedStringOptions = JSON.parse(localStorage.getItem(NS + ":lastUsedStringOptions")) ?? {
        toStringValue: "",
        toStringItems: [],
        includeString: OPTIONS.NO,
        stringNotFound: OPTIONS.PROCESS_EVERYTHING,
        stringNotFoundMultiline: OPTIONS.SKIP_SELECTION,
        replaceWithSpacesAtEnd: OPTIONS.NO
    };
    
    function updateLastUsedStringOptions(prop, value) {
        lastUsedStringOptions[prop] = value;
        localStorage.setItem(NS + ":lastUsedStringOptions", JSON.stringify(lastUsedStringOptions));
    }
    
    function preserveOptionsOrder() {
        return Options.get(CONFIG.PRESERVE_OPTIONS_ORDER) === OPTIONS.YES;
    }
    
    function showNotification(content, TYPE = "INFO") {
        const TYPES = NotificationUI.NOTIFICATION_STYLES_CSS_CLASS;
        const autoCloseTime = Options.get(CONFIG.NOTIFICATION_DURATION);
        NotificationUI.createToastFromTemplate(
            TITLE + ": " + content,
            "",
            {
                dismissOnClick: true,
                autoCloseTimeS: autoCloseTime[TYPE.toLowerCase()],
                toastStyle: [CLASS.toast, TYPES[TYPE] || ""].join(" ")
            }
        );
    }
        
    function isSameToStringAsPrev(toString) {
        return toString === lastUsedStringOptions.toStringValue;
    }

    function validateToString(value) {
        const regexp = value?.match(REGEXP.TO_STRING_REGEXP);
        if (regexp) {
            try { new RegExp(regexp[1], regexp[2]); } catch (e) {
                exports.showError(TEXTS.INVALID_TO_STRING_REGEXP);
                return false;
            }
        }
        return true;
    }
    
    function getPredefinedStringsSortedByLastUsage() {
        const predefinedStrings = Options.get(CONFIG.PREDEFINED_STRINGS) || [];
        if (predefinedStrings.length && lastUsedStringOptions.toStringItems?.length) {
            predefinedStrings.sort((a, b) => {
                let aI = lastUsedStringOptions.toStringItems.findIndex(item => item.label === a.label);
                let bI = lastUsedStringOptions.toStringItems.findIndex(item => item.label === b.label);
                if (aI === -1) { aI = Infinity; }
                if (bI === -1) { bI = Infinity; }
                return aI - bI;
            });
        }
        return predefinedStrings;
    }

    function setSelectionFromPredefinedItem(input, item) {
        const selectionStart = item?.selection?.at(0) || 0;
        const selectionEnd = item?.selection?.at(1) ?? item?.value.length;
        const reversed = selectionStart > selectionEnd;
        input.selectionStart = !reversed ? selectionStart: selectionEnd;
        input.selectionEnd = !reversed ? selectionEnd: selectionStart;
        input.selectionDirection = reversed ? "backward": "forward";
    }

    exports.showError = function showError(content) {
        showNotification(content, "ERROR");
    };
    
    exports.showWarning = function showWarning(content) {
        if (![OPTIONS.ALL, OPTIONS.ERRORS_WARNINGS].includes(Options.get(CONFIG.SHOW_NOTIFICATIONS))) return;
        showNotification(content, "WARNING");
    };
    
    exports.showInfo = function showInfo(content) {
        if (Options.get(CONFIG.SHOW_NOTIFICATIONS) !== OPTIONS.ALL) return;
        showNotification(content, "INFO");
    };
    
    async function getModalBarConfirm(title, options) {
        const template = `
            <label style="margin-left: 5px;">${title}</label>
            <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-left: 5px;">
                ${options.map(item => {
                    const itemAsString = typeof item === "string";
                    const label = itemAsString ? item: item.label ?? item.value ?? "";
                    const value = itemAsString ? item: item.value ?? item.label ?? "";
                    let type = itemAsString ? "": item.type;
                    if (!type && itemAsString) {
                        switch (item) {
                            case OPTIONS.YES: type = "primary"; 
                                break;
                            case OPTIONS.NO: type = "danger"; 
                                break;
                        }
                    }
                    return `<button class="btn ${type}" type="button" value="${value}">${label}</button>`;
                }).join("")}
            </div>
        `;
        const modalBar = new ModalBar(template, true);
        const $modalBar = modalBar.getRoot();
        let value;
        
        const $buttons = $modalBar.find("button");
        $buttons.first()[0]?.focus();
        
        $modalBar.on("keydown." + NS, "button", function (event) {
            const { key, shiftKey } = event;
            let change = 0;
            if ((key === "Tab" && shiftKey) || key === "ArrowLeft" || key === "ArrowUp") {
                change = -1;
            }
            if ((key === "Tab" && !shiftKey) || key === "ArrowRight" || key === "ArrowDown") {
                change = 1;
            }
            if (change !== 0) {
                event.preventDefault();
                $buttons.toArray().at(($(this).index() + change) % $buttons.length)?.focus();
            }
        });
        
        return new Promise(function (resolve) {
            $modalBar.on("click." + NS, "button", function (event) {
                value = event.target.value;
                modalBar.close();
            });
            modalBar.one("close", function () {
                $modalBar.off("." + NS);
                resolve(value);
            });
        });
    }
    
    exports.askForIncludeString = async function askForIncludeString(toString) {
        const options = [OPTIONS.NO, OPTIONS.YES];
        if (!preserveOptionsOrder() && isSameToStringAsPrev(toString) && lastUsedStringOptions.includeString === OPTIONS.YES) {
            options.reverse();
        }
        
        const answer = await getModalBarConfirm(TEXTS.INCLUDE_STRING, options);
        if (toString && answer !== undefined) {
            updateLastUsedStringOptions("includeString", answer);
        }
        return answer;
    };
    
    exports.askForToString = async function askForToString(isSelectToCommand, processLeft, multiline) {
        return new Promise(resolve => {
            const selectBehavior = Options.get(CONFIG.PREDEFINED_STRINGS_SELECT_BEHAVIOR);
            const predefinedStrings = getPredefinedStringsSortedByLastUsage();
            const template = `
                <label for="${ID.toStringInput}" style="margin-left: 5px;">${TEXTS.SET_STRING(isSelectToCommand)}</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <code style="margin: 0; padding: 0;">
                        <input id="${ID.toStringInput}" style="font-family: inherit"
                            type="text" autocomplete="off"
                            placeholder="${TEXTS.SET_STRING_PLACEHOLDER}"
                        >
                    </code>
                    <label style="cursor: default;" for="${ID.toStringInput}">
                        ${isSelectToCommand ? "Select": "Delete"}
                        ${processLeft ? " left": " right"}
                        ${multiline ? " | Multiline": ""}
                    </label>
                </div>
            `;
            const modalBar = new ModalBar(template, true);
            const $modalBar = modalBar.getRoot();
            const $input = $modalBar.find("#" + ID.toStringInput);
            let insertedFromList = false;
            let value;

            let shiftKey = false;
            const onKeydown = event => {
                shiftKey = event.shiftKey;
                if (event.key.startsWith("Alt")) {
                    event.stopPropagation();
                } 
            };
            const onKeyup = event => (shiftKey = event.shiftKey);
            window.addEventListener("keydown", onKeydown, true);
            window.addEventListener("keyup", onKeyup, true);

            const quickSearchField = new QuickSearchField($input, { 
                resultProvider(value) {
                    if (insertedFromList) {
                        insertedFromList = false;
                        return { error: null };
                    }
                    if (!value) return predefinedStrings.length ? predefinedStrings: { error: null };
                    let foundItems = [];
                    for (let item of predefinedStrings) {
                        if (item.value === value) {
                            foundItems.push(item);
                            break;
                        }
                    }
                    if (!foundItems.length) {
                        foundItems = predefinedStrings.map(item => {
                            return { 
                                ...item, 
                                index: item.label.toLocaleLowerCase().indexOf(value) 
                            };
                        });
                        foundItems = foundItems.filter(item => item.index > -1);
                    }
                    if (!foundItems.length) return { error: null };
                    return foundItems.sort((a, b) => a.index - b.index);
                },
                formatter(item) {
                    return `<li>${item.label}<br><small><code>${item.value}</code></small></li>`;
                },
                onHighlight() {},
                onCommit(item) {
                    if (item) {
                        const lastUsedToStringItems = lastUsedStringOptions.toStringItems;
                        lastUsedStringOptions.toStringItems.unshift(item);
                        updateLastUsedStringOptions(
                            "toStringItems",
                            [...new Set(lastUsedToStringItems)].slice(0, 5)
                        );
                    }
                    
                    value = item ? item.value: $input.val();
                    if (item && (
                        (selectBehavior !== OPTIONS.FLIP && shiftKey) || 
                        (selectBehavior === OPTIONS.FLIP && !shiftKey)
                    )) {
                        insertedFromList = true;
                        quickSearchField.setText(value);
                        setSelectionFromPredefinedItem($input[0], item);
                        return;
                    }
                    modalBar.close();
                },
                verticalAdjust: $modalBar.outerHeight()
            });
            
            quickSearchField.setText(lastUsedStringOptions.toStringValue || "");
            if (lastUsedStringOptions.toStringValue) {
                const itemFound = predefinedStrings.some(item => {
                    if (item.value === lastUsedStringOptions.toStringValue) {
                        setSelectionFromPredefinedItem($input[0], item);
                        return true;
                    }
                });
                if (!itemFound) {
                    $input[0].select();
                }
            }
            
            modalBar.one("close", function (event, reason) {
                window.removeEventListener("keydown", onKeydown, true);
                window.removeEventListener("keyup", onKeyup, true);
                $modalBar.off("." + NS);
                quickSearchField.destroy();
                if (!["blur", "escape"].includes(reason) && value?.length && validateToString(value)) {
                    return resolve(value);
                }
                return resolve(undefined);
            });
        });
    };

    exports.askForStringNotFound = async function askForStringNotFound(editor, deleteLeft, toString, selections, askPerSelection, multiline, isSelectToCommand) {
        const options = [
            {
                label: deleteLeft ? TEXTS.PROCESS_LEFT(isSelectToCommand): TEXTS.PROCESS_RIGHT(isSelectToCommand),
                value: OPTIONS.PROCESS_EVERYTHING,
                type: "danger"
            },
            {
                label: TEXTS.SKIP_SELECTION(selections.length),
                value: OPTIONS.SKIP_SELECTION,
                type: "primary"
            }
        ];
        if (!preserveOptionsOrder() && (multiline || isSelectToCommand)) {
            options.reverse();
        }
        const lastOption = multiline ? lastUsedStringOptions.stringNotFoundMultiline: lastUsedStringOptions.stringNotFound;
        if (!preserveOptionsOrder() && isSameToStringAsPrev(toString) && lastOption === options[1].value) {
            options.reverse();
        }

        TextMarker.create(editor, selections, true, true);

        const answer = await getModalBarConfirm(
            askPerSelection ? 
                TEXTS.STRING_NOT_FOUND_ASK_PER_SELECTION(selections[0]):
                TEXTS.STRING_NOT_FOUND_ASK_PER_EXECUTION(selections.length), 
            options
        );
        if (answer !== undefined && multiline) {
            updateLastUsedStringOptions("stringNotFoundMultiline", answer);
        }
        if (answer !== undefined && !multiline) {
            updateLastUsedStringOptions("stringNotFound", answer);
        }
        TextMarker.clearAll();
        return answer;
    };
    
    exports.askForReplaceWithSpacesAtEnd = async function askForReplaceWithSpacesAtEnd(editor, toString, editRanges, askPerSelection) {
        const options = [OPTIONS.NO, OPTIONS.YES];
        if (!preserveOptionsOrder() && isSameToStringAsPrev(toString) && lastUsedStringOptions.replaceWithSpacesAtEnd === OPTIONS.YES) {
            options.reverse();
        }

        TextMarker.create(editor, editRanges, true, true);
        
        const answer = await getModalBarConfirm(
            askPerSelection ? 
                TEXTS.REPLACE_WITH_SPACES_AT_END_ASK_PER_SELECTION(editRanges[0]): 
                TEXTS.REPLACE_WITH_SPACES_AT_END_ASK_PER_EXECUTION,
            options
        );
        if (answer !== undefined) {
            updateLastUsedStringOptions("replaceWithSpacesAtEnd", answer);
        }
        TextMarker.clearAll();
        return answer;
    };
    
    exports.askForSelectionDirection = async function askForSelectionDirection(editor, selections, allHaveSameDir, hasReversed) {
        const options = [OPTIONS.RIGHT_TO_LEFT, OPTIONS.LEFT_TO_RIGHT];
        if (allHaveSameDir && hasReversed && Options.get(CONFIG.SELECTION_OPPOSITE_FIRST) === OPTIONS.YES) {
            options.reverse();
        }
        return await getModalBarConfirm(TEXTS.CHANGE_SELECTION_DIRECTION(selections.length), options);
    };
    
    exports.preserveLastUsedToString = function preserveLastUsedToString(toString) {
        updateLastUsedStringOptions("toStringValue", toString);
    };
});
