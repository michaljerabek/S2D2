/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";
    
    const Menus = brackets.getModule("command/Menus");
    const CommandManager = brackets.getModule("command/CommandManager");
    const KeyBindingManager = brackets.getModule("command/KeyBindingManager");
    const { CMD_NS, COMMAND, CONFIG, OPTIONS, TEXTS } = require("CONSTANTS");
    const Options = require("Options");
    
    const editMenu = Menus.getMenu(Menus.AppMenuBar.EDIT_MENU);
    const menuAppearancePref = Options.get(CONFIG.MENU_APPEARANCE);
    const optionsPlacePref = Options.get(CONFIG.OPTIONS_PLACE);
    const menuCommandsPref = menuAppearancePref === OPTIONS.MENU_APPEARANCE_NONE ? []: [...Options.get(CONFIG.MENU_COMMANDS)];
    if (optionsPlacePref === OPTIONS.EDIT_MENU || optionsPlacePref === OPTIONS.EDIT_MENU_TOOLBAR) {
        menuCommandsPref.push(COMMAND.getName(COMMAND.OPEN_OPTIONS));
    }
    
    exports.init = function (exec) {
        let targetMenu = editMenu;
        
        if (menuCommandsPref.length) {
            editMenu.addMenuDivider();
        }
        
        if (menuAppearancePref === OPTIONS.MENU_APPEARANCE_SUBMENU) {
            targetMenu = editMenu.addSubMenu("Select to / Delete to", "S2D2");
        }

        CommandManager.register(
            "Delete everything left", 
            COMMAND.DELETE_LEFT, 
            () => exec(COMMAND.DELETE_LEFT, true)
        );
        KeyBindingManager.addBinding(
            COMMAND.DELETE_LEFT, 
            { key: "Alt-Backspace" }
        );
               
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.DELETE_LEFT))) {
            targetMenu.addMenuItem(COMMAND.DELETE_LEFT);
        }

        CommandManager.register(
            "Delete everything right", 
            COMMAND.DELETE_RIGHT, 
            () => exec(COMMAND.DELETE_RIGHT, false)
        );
        KeyBindingManager.addBinding(
            COMMAND.DELETE_RIGHT, 
            { key: "Alt-Delete" }
        );
                
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.DELETE_RIGHT))) {
            targetMenu.addMenuItem(COMMAND.DELETE_RIGHT);
        }

        CommandManager.register(
            "Delete to string left", 
            COMMAND.DELETE_TO_STRING_LEFT, 
            () => exec(COMMAND.DELETE_TO_STRING_LEFT, true)
        );
        KeyBindingManager.addBinding(
            COMMAND.DELETE_TO_STRING_LEFT, 
            { key: "Ctrl-Shift-Backspace" }
        );
            
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.DELETE_TO_STRING_LEFT))) {
            targetMenu.addMenuItem(COMMAND.DELETE_TO_STRING_LEFT);
        }

        CommandManager.register(
            "Delete to string right", 
            COMMAND.DELETE_TO_STRING_RIGHT, 
            () => exec(COMMAND.DELETE_TO_STRING_RIGHT, false)
        );
        KeyBindingManager.addBinding(
            COMMAND.DELETE_TO_STRING_RIGHT, 
            { key: "Ctrl-Shift-Delete" }
        );
                
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.DELETE_TO_STRING_RIGHT))) {
            targetMenu.addMenuItem(COMMAND.DELETE_TO_STRING_RIGHT);
        }

        CommandManager.register(
            "Delete to string left multiline", 
            COMMAND.DELETE_TO_STRING_LEFT_MULTILINE, 
            () => exec(COMMAND.DELETE_TO_STRING_LEFT_MULTILINE, true, true)
        );
        KeyBindingManager.addBinding(
            COMMAND.DELETE_TO_STRING_LEFT_MULTILINE, 
            { key: "Ctrl-Alt-Shift-Backspace" }
        );
                
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.DELETE_TO_STRING_LEFT_MULTILINE))) {
            targetMenu.addMenuItem(COMMAND.DELETE_TO_STRING_LEFT_MULTILINE);
        }

        CommandManager.register(
            "Delete to string right multiline", 
            COMMAND.DELETE_TO_STRING_RIGHT_MULTILINE, 
            () => exec(COMMAND.DELETE_TO_STRING_RIGHT_MULTILINE, false, true)
        );
        KeyBindingManager.addBinding(
            COMMAND.DELETE_TO_STRING_RIGHT_MULTILINE, 
            { key: "Ctrl-Alt-Shift-Delete" }
        );
                
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.DELETE_TO_STRING_RIGHT_MULTILINE))) {
            targetMenu.addMenuItem(COMMAND.DELETE_TO_STRING_RIGHT_MULTILINE);
        }

        CommandManager.register(
            "Select everything left", 
            COMMAND.SELECT_LEFT, 
            () => exec(COMMAND.SELECT_LEFT, true)
        );
        KeyBindingManager.addBinding(
            COMMAND.SELECT_LEFT, 
            { key: "Alt-F8" }
        );
               
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.SELECT_LEFT))) {
            targetMenu.addMenuItem(COMMAND.SELECT_LEFT);
        }

        CommandManager.register(
            "Select everything right", 
            COMMAND.SELECT_RIGHT, 
            () => exec(COMMAND.SELECT_RIGHT, false)
        );
        KeyBindingManager.addBinding(
            COMMAND.SELECT_RIGHT, 
            { key: "Alt-F10" }
        );
                
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.SELECT_RIGHT))) {
            targetMenu.addMenuItem(COMMAND.SELECT_RIGHT);
        }

        CommandManager.register(
            "Select to string left", 
            COMMAND.SELECT_TO_STRING_LEFT, 
            () => exec(COMMAND.SELECT_TO_STRING_LEFT, true)
        );
        KeyBindingManager.addBinding(
            COMMAND.SELECT_TO_STRING_LEFT, 
            { key: "Ctrl-Shift-F8" }
        );
            
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.SELECT_TO_STRING_LEFT))) {
            targetMenu.addMenuItem(COMMAND.SELECT_TO_STRING_LEFT);
        }

        CommandManager.register(
            "Select to string right", 
            COMMAND.SELECT_TO_STRING_RIGHT, 
            () => exec(COMMAND.SELECT_TO_STRING_RIGHT, false)
        );
        KeyBindingManager.addBinding(
            COMMAND.SELECT_TO_STRING_RIGHT, 
            { key: "Ctrl-Shift-F10" }
        );
                
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.SELECT_TO_STRING_RIGHT))) {
            targetMenu.addMenuItem(COMMAND.SELECT_TO_STRING_RIGHT);
        }

        CommandManager.register(
            "Select to string left multiline", 
            COMMAND.SELECT_TO_STRING_LEFT_MULTILINE, 
            () => exec(COMMAND.SELECT_TO_STRING_LEFT_MULTILINE, true, true)
        );
        KeyBindingManager.addBinding(
            COMMAND.SELECT_TO_STRING_LEFT_MULTILINE, 
            { key: "Ctrl-Alt-Shift-F8" }
        );
                
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.SELECT_TO_STRING_LEFT_MULTILINE))) {
            targetMenu.addMenuItem(COMMAND.SELECT_TO_STRING_LEFT_MULTILINE);
        }

        CommandManager.register(
            "Select to string right multiline", 
            COMMAND.SELECT_TO_STRING_RIGHT_MULTILINE, 
            () => exec(COMMAND.SELECT_TO_STRING_RIGHT_MULTILINE, false, true)
        );
        KeyBindingManager.addBinding(
            COMMAND.SELECT_TO_STRING_RIGHT_MULTILINE, 
            { key: "Ctrl-Alt-Shift-F10" }
        );
                
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.SELECT_TO_STRING_RIGHT_MULTILINE))) {
            targetMenu.addMenuItem(COMMAND.SELECT_TO_STRING_RIGHT_MULTILINE);
        }
        
        CommandManager.register(
            "Change selection direction", 
            COMMAND.CHANGE_SELECTION_DIRECTION, 
            () => exec(COMMAND.CHANGE_SELECTION_DIRECTION)
        );
        KeyBindingManager.addBinding(
            COMMAND.CHANGE_SELECTION_DIRECTION, 
            { key: "Ctrl-Alt-Backspace" }
        );
        
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.CHANGE_SELECTION_DIRECTION))) {
            editMenu.addMenuItem(COMMAND.CHANGE_SELECTION_DIRECTION);
        }
        
        CommandManager.register(
            "Trim selection", 
            COMMAND.TRIM_SELECTION, 
            () => exec(COMMAND.TRIM_SELECTION)
        );
        KeyBindingManager.addBinding(
            COMMAND.TRIM_SELECTION, 
            { key: "Alt-Shift-Backspace" }
        );
        
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.TRIM_SELECTION))) {
            editMenu.addMenuItem(COMMAND.TRIM_SELECTION);
        }

        CommandManager.register(
            "S2D2: Open options",
            COMMAND.OPEN_OPTIONS, 
            () => Options.open()
        );
        
        if (menuCommandsPref.includes(COMMAND.getName(COMMAND.OPEN_OPTIONS))) {
            editMenu.addMenuItem(COMMAND.OPEN_OPTIONS);
        }

        if (menuCommandsPref.length) {
            editMenu.addMenuDivider();
        }
    };
});
