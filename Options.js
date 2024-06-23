/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";
    
    const PreferencesManager = brackets.getModule("preferences/PreferencesManager");
    const CommandManager = brackets.getModule("command/CommandManager");
    const Dialogs = brackets.getModule("widgets/Dialogs");
    const { FULL_TITLE, COMMAND, OPTIONS, CONFIG, PREF_NS, NS } = require("CONSTANTS");
    const prefs = PreferencesManager.getExtensionPrefs(PREF_NS);
    
    const ID = {
        icon: NS + "__icon",
        getId: ((counter) => () => (NS + "__id-" + counter++))(1)
    };
    
    const REGISTERED_OPTIONS = [];
    
    function getOptionsContent() {
        return `<form onsubmit="event.preventDefault();">${
            REGISTERED_OPTIONS
                .map(item => item.template())
                .join(`<div style="height: 15px"></div>`)
        }</form>`;
    }
    
    function registerDivider() {
        REGISTERED_OPTIONS.push({
            template: () => `<hr style="margin: 0; border-bottom: none; opacity: 0.25;">`
        });
    }
    
    function registerTitle(content) {
        REGISTERED_OPTIONS.push({
            template: () => `<h3 style="margin: 0; line-height: normal;">${content}</h3>`
        });
    }
    
    function registerSelect(prefName, options = {}) {
        const pref = prefs.getPreference(prefName);
        const id = ID.getId();
        const noteId = ID.getId();
     
        REGISTERED_OPTIONS.push({
            prefName,
            template: () => {
                const currentValue = prefs.get(prefName);
                return `
                    <div data-pref-name="${prefName}">
                        <label for="${id}">${pref.description}${options.restartRequired ? " <em>(Requires restart.)</em>": ""}</label>
                        <select style="margin: 0px" id="${id}" name="${prefName}">
                            ${pref.values.map(item => `
                                <option ${item === currentValue ? "selected": ""} value="${item}">
                                    ${item}
                                </option>
                            `)}
                        </select>
                        <small id="${noteId}" style="display: block; margin-top: 2px; font-style: italic; opacity: 0.7;" hidden></small>   
                    </div>
                `;
            },
            onInit(element) {
                this.onChange(element.querySelector("select"));
            },
            onChange(select) {
                if (options.notes) {
                    const noteEl = document.getElementById(noteId);
                    noteEl.hidden = (typeof options.notes[select.value] !== "string");
                    noteEl.innerHTML = options.notes[select.value] ?? "";
                }
            },
            onSave(formData) {
                const value = formData.get(prefName);
                if (value !== prefs.get(prefName)) {
                    prefs.set(prefName, value);
                }
            }
        });
    }
    
    function registerCheckboxList(prefName, options = {}) {
        const pref = prefs.getPreference(prefName);
        const id = ID.getId();
     
        REGISTERED_OPTIONS.push({
            prefName,
            template: () => {
                const labels = typeof options.labels === "function" ? options.labels(): options.labels ?? null;
                const currentValue = prefs.get(prefName);
                return `
                    <div data-pref-name="${prefName}">
                        <label style="cursor: default;">${pref.description}${options.restartRequired ? " <em>(Requires restart.)</em>": ""}</label>
                        <div style="column-width: 200px; column-gap: 10px;">
                            ${pref.values.map(item => `
                                <div style="padding-top: 5px;">
                                    <label style="margin-bottom: 0px;">
                                        <input style="display: inline-block; vertical-align: bottom;" 
                                            type="checkbox" name="${prefName}" value="${item}"
                                            ${currentValue.includes(item) ? "checked": ""}>
                                        ${labels ? labels[item] ?? item: item}
                                    </label>
                                </div>
                            `).join("")}
                        </div>
                    </div>`;
            },
            onSave(formData) {
                const current = prefs.get(prefName);
                const values = formData.getAll(prefName);
                const diffs = current.length !== values.length || values.some(value => !current.includes(value));
                if (diffs) {
                    prefs.set(prefName, values);
                }
            }
        });
    }
    
    function registerMultiText(prefName, options = {}) {
        const pref = prefs.getPreference(prefName);
        const prefKeys = Object.keys(pref.keys);
        const prefInit = pref.initial;
        const id = ID.getId();
     
        REGISTERED_OPTIONS.push({
            prefName,
            template: () => {
                const currentValue = prefs.get(prefName);
                return `
                    <div data-pref-name="${prefName}">
                        <label style="cursor: default;">${pref.description}${options.restartRequired ? " <em>(Requires restart.)</em>": ""}</label>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(${options.type === "number" ? "120px": "160px"}, 1fr)); grid-column-gap: 10px;">
                            ${prefKeys.map(item => `
                                <div style="display: grid; padding-top: 5px;">
                                    <label for="${id}">${item[0].toLocaleUpperCase() + item.substring(1)}</label>
                                    <input style="justify-self: stretch; width: auto; min-width: 0;"
                                        id="${id}" name="${prefName}.${item}" value="${currentValue[item]}"
                                        type="${options.type || "text"}" min="${options.min || ""}"
                                        autocomplete="off">
                                </div>
                            `).join("")}
                        </div>
                    </div>`;
            },
            onSave(formData) {
                const current = prefs.get(prefName);
                let newValue = current;
                prefKeys.forEach(key => {
                    const value = parseFloat(formData.get(`${prefName}.${key}`));
                    if (value !== current[key]) {
                        newValue = { ...newValue, [key]: value };
                    }
                    if (prefInit[key] === value) {
                        delete newValue[key];
                    }
                });
                
                if (newValue !== current) {
                    prefs.set(prefName, newValue);
                }
            }
        });
    }
    
    function registerPredefinedStrings() {
        const prefName = CONFIG.PREDEFINED_STRINGS;
        const pref = prefs.getPreference(prefName);
        const id = ID.getId();
        const rowsId = ID.getId();
        const addId = ID.getId();
        const setSelectionId = ID.getId();

        const removeTemplate = `
            <button class="btn" type="button" style="padding: 4px 6px; margin: 0;" title="Remove">
                <i class="fa-solid fa-xmark" style="width: 1lh"></i>
            </button>`;
        const rowTemplate = (item = {}) => `
            <div style="display: grid; padding: 0; padding-top: 2px; margin: 0;">
                <input style="justify-self: stretch; width: auto; min-width: 0; margin: 0;"
                    name="${prefName}[]" value="${item.label ?? ""}" type="text"
                    autocomplete="off">
            </div>
            <code style="display: grid; padding: 0; padding-top: 2px; margin: 0;">
                <input style="justify-self: stretch; width: auto; min-width: 0; margin: 0; font-family: inherit;"
                    name="${prefName}[]" value="${item.value ?? ""}" type="text"
                    autocomplete="off">
            </code>
            <div style="display: grid; padding: 0; padding-top: 2px; margin: 0; margin-right: -2px">
                <input style="justify-self: stretch; width: auto; min-width: 0; padding-right: 4px; margin: 0;"
                    name="${prefName}[]" value="${item.selection?.at(0) ?? ""}" min="0" step="1" type="number"
                    autocomplete="off">
            </div>
            <div style="display: grid; padding: 0; padding-top: 2px; margin: 0; margin-left: -2px">
                <input style="justify-self: stretch; width: auto; min-width: 0; padding-right: 4px; margin: 0;"
                    name="${prefName}[]" value="${item.selection?.at(1) ?? ""}" min="0" step="1" type="number"
                    autocomplete="off">
            </div>
            <div style="padding-top: 2px;">${removeTemplate}</div>
        `;
     
        REGISTERED_OPTIONS.push({
            prefName,
            template: () => {
                const currentValue = prefs.get(prefName) || [];
                return `
                    <div data-pref-name="${prefName}">
                        <label style="cursor: default;">List of predefined strings or regular expressions.</label>
                        <div id="${rowsId}" style="display: grid; grid-template-columns: minmax(auto, 1fr) minmax(auto, 1.3333fr) repeat(2, 45px) min-content; grid-column-gap: 5px; align-items: end;">
                            <div style="padding-top: 5px;">Label</div>
                            <div style="padding-top: 5px;">String / RegExp</div>
                            <div style="grid-column: span 2; display: flex; justify-content: space-between; padding-top: 5px;">
                                Selection
                                <button id="${setSelectionId}" class="btn btn-mini primary" style="display: none; margin: 0" type="button">
                                    Set
                                </button>
                            </div>
                            <div style="padding-top: 5px; visibility: hidden;">${removeTemplate}</div>
                            ${currentValue.map(rowTemplate).join("")}
                        </div>
                        <button class="btn primary" type="button" id="${addId}" style="margin: 0; margin-top: 10px;">
                            Add
                        </button>
                    </div>`;
            },
            onInit(element) {
                const setSelectionBtn = document.getElementById(setSelectionId);
                
                const onPointerdown = event => {
                    if (event.target.id !== setSelectionId) return;
                    const value = document.activeElement?.closest("code");
                    if (!value) return;
                    event.preventDefault();
                    
                    const input = document.activeElement;
                    const from = value.nextElementSibling.querySelector("input");
                    const to = value.nextElementSibling.nextElementSibling.querySelector("input");
                    
                    const reversed = input.selectionDirection === "backward";
                    from.value = !reversed ? input.selectionStart: input.selectionEnd;
                    to.value = !reversed ? input.selectionEnd: input.selectionStart;
                };
                
                const onFocusChange = event => {
                    if (!event.target.closest("code")) return;
                    setSelectionBtn.style.display = event.type === "focusin" ? "": "none";
                };
                
                element.addEventListener("pointerdown", onPointerdown);
                element.addEventListener("focusin", onFocusChange);
                element.addEventListener("focusout", onFocusChange);
                return () => {
                    element.removeEventListener("pointerdown", onPointerdown);
                    element.removeEventListener("focusin", onFocusChange);
                    element.removeEventListener("focusout", onFocusChange);
                };
            },
            onButton(button) {
                if (button.id === setSelectionId) return;
                
                if (button.id === addId) {
                    const rows = document.getElementById(rowsId);
                    rows.insertAdjacentHTML("beforeEnd", rowTemplate());
                    [...rows.querySelectorAll("input")].at(-4)?.focus();
                    return;
                }
                
                const toRemove = [button.closest("div")];
                for (let i = 0; i < 4; i++) {
                    toRemove.push(toRemove[i].previousElementSibling);
                }
                toRemove.forEach(el => el.remove());
            },
            onSave(formData) {
                const current = prefs.get(prefName) || [];
                const data = formData.getAll(prefName + "[]");
                let newValue = [];
                
                for (let i = 0; i < data.length; i += 4) {
                    if (!data[i].length || !data[i + 1].length) continue;
                    const newItem = {
                        label: data[i],
                        value: data[i + 1]
                    };
                    if (!isNaN(parseInt(data[i + 2], 10)) && !isNaN(parseInt(data[i + 3], 10))) {
                        newItem.selection = [parseInt(data[i + 2], 10), parseInt(data[i + 3], 10)];
                    }
                    newValue.push(newItem);
                }
                
                const diffs = JSON.stringify(current) !== JSON.stringify(newValue);
                if (diffs) {
                    prefs.set(prefName, newValue);
                }
            }
        });
    }
    
    exports.open = function open() {
        if (!prefs) return null;
        const content = getOptionsContent();
        const btns = [
            {
                className: Dialogs.DIALOG_BTN_CLASS_PRIMARY,
                id: Dialogs.DIALOG_BTN_OK,
                text: "Save"
            },
            {
                className: Dialogs.DIALOG_BTN_CLASS_LEFT,
                id: Dialogs.DIALOG_BTN_CANCEL,
                text: "Cancel"
            }
        ];

        const dialog = Dialogs.showModalDialog(NS, FULL_TITLE + " Options", content, btns);
        const $dialog = dialog.getElement();
        const form = $dialog.find("form")[0];
        const onDestroyFns = [];
        
        $dialog.on("change." + NS, function (event) {
            REGISTERED_OPTIONS.forEach(item => {
                if (item.onChange && event.target.closest(`[data-pref-name="${item.prefName}"]`)) {
                    item.onChange(event.target);
                } 
            });
        });
        
        REGISTERED_OPTIONS.forEach(item => {
            if (item.onInit) {
                const onDestroyFn = item.onInit($dialog.find(`[data-pref-name="${item.prefName}"]`)[0]);
                if (typeof onDestroyFn === "function") {
                    onDestroyFns.push(onDestroyFn);
                }
            }
        });
        
        $dialog.on("click." + NS, "button", function (event) {
            REGISTERED_OPTIONS.forEach(item => {
                if (item.onButton && event.target.closest(`[data-pref-name="${item.prefName}"]`)) {
                    item.onButton(event.currentTarget);
                } 
            });
        });
        
        $dialog.on("keyup." + NS, "input", function (event) {
            if (event.key === "Enter") {
                $dialog.find(`[data-button-id="${Dialogs.DIALOG_BTN_OK}"]`).click();
            }
        });

        dialog.done(function (btnId) {
            $dialog.off("." + NS);
            onDestroyFns.forEach(onDestroyFn => onDestroyFn());

            if (btnId === Dialogs.DIALOG_BTN_OK) {
                const formData = new FormData(form);
                REGISTERED_OPTIONS.forEach(item => {
                    if (item.onSave) {
                        item.onSave(formData);
                    }
                });
            }
        });
        
        return dialog;
    };

    registerTitle("Delete / Select");
    
    prefs.definePreference(CONFIG.DELETE_LEFT_STOP_AT_INDENT, "string", OPTIONS.ROUND_TO_STEP, {
        description: "When deleting everything left, stop at indentation?",
        values: [OPTIONS.ROUND_TO_STEP, OPTIONS.YES, OPTIONS.NO]
    });
    
    registerSelect(CONFIG.DELETE_LEFT_STOP_AT_INDENT);

    prefs.definePreference(CONFIG.MULTILINE_DELETE_LEFT_ON_INDENT, "string", OPTIONS.YES, {
        description: "When deleting / selecting indentation, move to the previous line?",
        values: [OPTIONS.YES, OPTIONS.NO]
    });
    
    registerSelect(CONFIG.MULTILINE_DELETE_LEFT_ON_INDENT);

    prefs.definePreference(CONFIG.MULTILINE_DELETE_LEFT_PRESERVE_LINE_SPACES, "string", OPTIONS.YES, {
        description: "Preserve spaces at the end of the previous line?",
        values: [OPTIONS.YES, OPTIONS.NO]
    });
    
    registerSelect(CONFIG.MULTILINE_DELETE_LEFT_PRESERVE_LINE_SPACES);

    prefs.definePreference(CONFIG.MULTILINE_DELETE_RIGHT_PRESERVE_LINE_SPACES, "string", OPTIONS.NO, {
        description: "Preserve spaces from the start of the next line?",
        values: [OPTIONS.NO, OPTIONS.YES]
    });
    
    registerSelect(CONFIG.MULTILINE_DELETE_RIGHT_PRESERVE_LINE_SPACES);

    prefs.definePreference(CONFIG.MULTILINE_PROCESS_COLLECT_EMPTY_LINES, "string", OPTIONS.YES, {
        description: "Delete / Select all empty lines?",
        values: [OPTIONS.YES, OPTIONS.NO]
    });
    
    registerSelect(CONFIG.MULTILINE_PROCESS_COLLECT_EMPTY_LINES);
    
    prefs.definePreference(CONFIG.MULTILINE_STRING_SEARCH_MODE, "string", OPTIONS.LINE_BY_LINE, {
        description: "Search the string line by line or in the whole block before or after selection.",
        values: [OPTIONS.LINE_BY_LINE, OPTIONS.IN_BLOCK]
    });
    
    registerSelect(CONFIG.MULTILINE_STRING_SEARCH_MODE, {
        notes: {
            [OPTIONS.IN_BLOCK]: "Note: Can be slow for large documents."
        }
    });

    prefs.definePreference(CONFIG.STRING_NOT_FOUND, "string", OPTIONS.ASK_PER_EXECUTION, {
        description: "If string is not found then:",
        values: [OPTIONS.ASK_PER_EXECUTION, OPTIONS.ASK_PER_SELECTION, OPTIONS.PROCESS_EVERYTHING, OPTIONS.SKIP_SELECTION]
    });
    
    registerSelect(CONFIG.STRING_NOT_FOUND);
    
    prefs.definePreference(CONFIG.STRING_NOT_FOUND_MULTILINE, "string", OPTIONS.ASK_PER_EXECUTION, {
        description: "If string is not found with multiline mode then:",
        values: [OPTIONS.ASK_PER_EXECUTION, OPTIONS.ASK_PER_SELECTION, OPTIONS.PROCESS_EVERYTHING, OPTIONS.SKIP_SELECTION]
    });
    
    registerSelect(CONFIG.STRING_NOT_FOUND_MULTILINE);
    
    prefs.definePreference(CONFIG.REPLACE_WITH_SPACES_AT_END, "string", OPTIONS.NO, {
        description: "Replace with spaces at the end of lines? (For replace to string mode.)",
        values: [OPTIONS.NO, OPTIONS.YES, OPTIONS.ASK_PER_EXECUTION, OPTIONS.ASK_PER_SELECTION]
    });
    
    registerSelect(CONFIG.REPLACE_WITH_SPACES_AT_END);

    registerDivider();
    registerTitle("Predefined strings");
    
    prefs.definePreference(CONFIG.PREDEFINED_STRINGS, "array", OPTIONS.PREDEFINDED_STRINGS, {
        description: "List of predefined strings or regular expressions. Example: [{ \"label\": \"Number\", \"value\": \"/[0-9.]+/\", \"selection?\": [5, 6] }].",
        valueType: "object",
        validator(value) { 
            for (let i = value.length - 1; i >= 0; i--) {
                const item = value[i];
                if (item && typeof item === "object" && 
                    typeof item.label === "string" && 
                    typeof item.value === "string" &&
                    (!item.selection || (
                        Array.isArray(item.selection) &&
                        !isNaN(parseInt(item.selection.at(0)), 10) &&
                        !isNaN(parseInt(item.selection.at(1)), 10)
                    ))
                ) {
                    continue;
                }
                value.splice(i, 1);
            }
            return value;
        }
    });
    
    registerPredefinedStrings();
    
    registerDivider();
    registerTitle("Selections");
    
    prefs.definePreference(CONFIG.SELECTION_AUTO_FLIP, "string", OPTIONS.YES, {
        description: "If all selections have the same direction, immediately change to the opposite.",
        values: [OPTIONS.YES, OPTIONS.NO]
    });
    
    registerSelect(CONFIG.SELECTION_AUTO_FLIP);
    
    registerDivider();
    registerTitle("UI");
            
    prefs.definePreference(CONFIG.PREDEFINED_STRINGS_SELECT_BEHAVIOR, "string", OPTIONS.YES, {
        description: "When selecting a predefined string, use <kbd>Enter</kbd> to confirm and <kbd>Shift</kbd>+<kbd>Enter</kbd> to insert.",
        values: [OPTIONS.YES, OPTIONS.FLIP]
    });
    
    registerSelect(CONFIG.PREDEFINED_STRINGS_SELECT_BEHAVIOR);
            
    prefs.definePreference(CONFIG.PRESERVE_OPTIONS_ORDER, "string", OPTIONS.NO, {
        description: "Preserve the same order for options when deleting / selecting.",
        values: [OPTIONS.NO, OPTIONS.YES]
    });
    
    registerSelect(CONFIG.PRESERVE_OPTIONS_ORDER);

    prefs.definePreference(CONFIG.SELECTION_OPPOSITE_FIRST, "string", OPTIONS.YES, {
        description: "If all selections have the same direction, show the opposite direction option first.",
        values: [OPTIONS.YES, OPTIONS.NO]
    });
    
    registerSelect(CONFIG.SELECTION_OPPOSITE_FIRST);

    prefs.definePreference(CONFIG.SHOW_NOTIFICATIONS, "string", OPTIONS.ALL, {
        description: "Show errors, warnings (e. g. cancelled execution) and other notifications.",
        values: [OPTIONS.ALL, OPTIONS.ERRORS_WARNINGS, OPTIONS.ERRORS_ONLY]
    });
    
    registerSelect(CONFIG.SHOW_NOTIFICATIONS);
    
    prefs.definePreference(CONFIG.NOTIFICATION_DURATION, "object", OPTIONS.DEFAULT.NOTIFICATION_DURATION(), {
        description: "Time in seconds to hide a notification for each type.",
        keys: OPTIONS.DEFAULT.NOTIFICATION_DURATION()
    });
    
    registerMultiText(CONFIG.NOTIFICATION_DURATION, {
        type: "number",
        min: 1
    });
    
    prefs.definePreference(CONFIG.OPTIONS_PLACE, "string", OPTIONS.TOOLBAR, {
        description: "Where to show Options for this extension.",
        values: [OPTIONS.TOOLBAR, OPTIONS.EDIT_MENU, OPTIONS.EDIT_MENU_TOOLBAR]
    });
    
    registerSelect(CONFIG.OPTIONS_PLACE, { restartRequired: true });
    
    prefs.definePreference(CONFIG.MENU_APPEARANCE, "string", OPTIONS.MENU_APPEARANCE_SUBMENU, {
        description: "How to show delete / select commands in the Edit menu.",
        values: [OPTIONS.MENU_APPEARANCE_SUBMENU, OPTIONS.MENU_APPEARANCE_ITEMS, OPTIONS.MENU_APPEARANCE_NONE]
    });
    
    registerSelect(CONFIG.MENU_APPEARANCE, { restartRequired: true });

    prefs.definePreference(CONFIG.MENU_COMMANDS, "array", OPTIONS.DEFAULT.MENU_COMMANDS(), {
        description: "List of commands to show in the Edit menu.",
        valueType: "string",
        values: OPTIONS.MENU_COMMANDS
    });
    
    registerCheckboxList(CONFIG.MENU_COMMANDS, { 
        restartRequired: true,
        labels: () => {
            const commands = Object.keys(COMMAND)
                .filter(command => typeof COMMAND[command] === "string");
            return commands.reduce((map, command) => {
                const commandId = COMMAND[command];
                map[COMMAND.getName(commandId)] = CommandManager.get(commandId)?.getName() ?? command;
                return map;
            }, {});
        }
    });

    exports.get = function get(name) {
        return prefs?.get(name);
    };
    
    exports.set = function set(name, value) {
        return prefs?.set(name, value);
    };
    
    const optionsPlacePref = exports.get(CONFIG.OPTIONS_PLACE);
    
    if (optionsPlacePref === OPTIONS.TOOLBAR || optionsPlacePref === OPTIONS.EDIT_MENU_TOOLBAR) {
        const $icon = $(`<a><code><b>2</b>|</code></a>`)
            .attr({
                id: ID.icon,
                href: "#",
                title: FULL_TITLE + " Options"
            })
            .css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none"
            })
            .appendTo($("#plugin-icons-bar .buttons"));

        $icon.find("code").css({
            flexBasis: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: "2px",
            paddingRight: "0px",
            fontSize: "14px",
            fontWeight: 700,
            lineHeight: "18px",
            color: $("#plugin-icons-bar").css("background-color"),
            background: "#bbb",
            borderRadius: "3px"
        });

        $icon.find("b").css({
            marginRight: "-2px",
            fontSize: "16px",
            fontWeight: "inherit",
            color: "inherit"
        });

        $icon.on("click." + NS, function (event) {
            event.preventDefault();
            exports.open();
        });
    }
});
