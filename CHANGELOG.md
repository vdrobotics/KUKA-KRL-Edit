# Changelog

All notable changes to this project will be documented in this file.

---

## [1.8.9] - 2026-11-28
### Added
- The routines of the KSS system modules `$OPERATE` and `$OPERATE_2` (KSS 9.2 to 9.3.4), such as `SET_POSITION_CTRL`, `GET_SYSTEM_DATA`, `ROUND` or `SET_CART_IMPEDANCE_CTRL` or `SET_ADDITIONAL_LOAD`, are known without any file in the workspace: 124 names were added to the built-in list. Calls are no longer reported as undeclared, and the names are offered as completions.
- Declarations of external routines (`EXT`, `EXTFCT`, and `EXTP`/`EXTFCTP` as written in the system modules `$OPERATE`/`$OPERATE_2`) count as known routines. Calls of such routines are no longer reported as undeclared, and go to definition and hover use the declaration when no `DEF`/`DEFFCT` of that name exists. A real definition always wins over an `EXT` declaration. In other files only `GLOBAL` declarations and declarations in system files (names starting with `$`) are considered.

---

## [1.8.8] - 2026-11-28
### Fixed
- Go to definition and hover find the main routine of another module, such as `BAS` in `bas.src` or `IR_STOPM` in `ir_stopm.src`. The first routine of a `.src`/`.sub` file, named like the module, can be called from everywhere without `GLOBAL`; only `GLOBAL` routines of other files were considered before. Other routines without `GLOBAL` stay local to their module.
- Files created, changed or deleted outside the editor, for example by a sync tool or git, are picked up right away. Their declarations were only seen after some document had been opened or edited, so go to definition found nothing for a new file and open documents kept stale "not declared" reports.

---

## [1.8.7] - 2026-11-24
### Fixed
- The approximation criterion `C_SPL` is no longer reported as an undeclared identifier. The same applies to `PTP_SPLINE`, `SPTP_REL`, `SLIN_REL`, `SCIRC_REL`, `CONST_VEL` and `ONSTART`. These keywords are now also offered as completions.
- `SPTP`, `C_SPL` and the other spline keywords above are highlighted as motion keywords.

---

## [1.8.6] - 2026-11-23
### Fixed
- Declarations whose type name contains `$`, such as `DECL TYP$MSG_DLG ST$MSG_DLG` in `$config.dat`, reach the index. The type was matched as a plain word before, so the declared variable was reported as "not declared" everywhere and go to definition found nothing.
- The KRL string functions `StrCopy`, `StrFind`, `StrDeclLen`, `SREAD`, `CREAD` and the `StrTo…` conversions (`StrToBool`, `StrToInt`, `StrToReal`, `StrToString`, `StrToFrame`, `StrToPos`, `StrToE3Pos`, `StrToE6Pos`, `StrToAxis`, `StrToE3Axis`, `StrToE6Axis`) are no longer reported as undeclared identifiers and are offered as completions.
- The editor treats a name with `$` inside, such as `ST$MSG_DLG` or `$VEL_AXIS`, as one word. Ctrl+click, double-click and word highlighting stopped at the `$` before, so a click on `ST$MSG_DLG` underlined only `MSG_DLG`.
- A `$` inside a name no longer starts a system variable. Hovering `i$ACC` showed the description of `$ACC`, and typing `ST$` offered the whole list of system variables.
- The hover of a system variable shows a dash between name and type again instead of the garbled characters `â€”`.

---

## [1.8.5] - 2026-10-01
### Fixed
- Go to definition and hover now follow KRL scoping rules. For a variable the enclosing routine is searched first, then the `.dat` file of the same module, and finally only `GLOBAL` declarations in other `.dat` files. For a routine the current file wins, and only `GLOBAL DEF`/`GLOBAL DEFFCT` routines of other files are considered afterwards. Variables and routines declared in another `.src`/`.sub` file are local to their module and are no longer offered as a target, so a call to a local `Helper()` no longer jumps into a different module that happens to have a routine of the same name.
- Declarations in KUKA system data lists count as global even without the `GLOBAL` keyword. This covers files starting with `$` (`$config.dat`, `$machine.dat`, `$custom.dat`, `$robcor.dat`) and the same names inside a `System` or `Mada` folder.
- Identifiers containing `$`, such as the customer naming scheme `i$VarName`, are parsed as a single name. They were split at the `$` before, which broke go to definition and find all references, and produced a false "not declared" report on the leading fragment as well as a false "Invalid KRL variable name" error.
- Declarations written without `DECL` are found as definitions. `.dat` files commonly declare as `INT counter=5` or `GLOBAL INT counter=3`, and the definition lookup previously required `DECL` or `SIGNAL` on the line.
- Variables declared in `.src` and `.sub` files that are not open, in files created while the editor is running, and in unsaved edits of other files are found as well. Only `.dat` files read at startup and currently open documents were considered before.
- The local scope of a routine is no longer cut short. It ended at the first line containing `END` anywhere, which includes `ENDIF`, `ENDFOR` and the KUKA `;ENDFOLD` markers, and it started at any line containing `DEF`, including comments.
- An unreadable folder or a directory junction in the project no longer breaks the search. A single one of them made every go to definition request fail silently; junctions pointing at a parent folder are no longer followed forever.
- Variable lists are split correctly on `{}`, so the second and following points of a line like `DECL POS P1={X 1,…},P2={…}` reach the index.

### Changed
- Workspace validation reads the KRL files instead of opening each one as a document. Opening them handed every file to the language server at once, which could keep the extension host busy for minutes in large robot projects.
- The language server caches parsed files by timestamp and size and rebuilds its index on demand instead of re-reading the whole project on every keystroke. In a 400 file test project this took a burst of five edits from 1196 ms down to 116 ms, and opening 150 files from 68 s down to 6.4 s.
- An unexpected error in the language server is logged instead of ending the server process, so VS Code no longer restarts it until it gives up.

---

## [1.8.4] - 2026-09-11
### Fixed
- `LOOP`, `ENDLOOP` and `STEP` are no longer reported as undeclared identifiers.
- The undeclared-identifier allow-list now covers every keyword highlighted by the KRL grammar, adding `CHAR`, `POS`, `ENUM`, `CONST`, `SIGNAL`, `EXTFCT`, `B_EXOR`, `CIRC_REL`, `ASYPTP`, `ASYSTOP`, `ASYCONT`, `ASYCANCEL`, `C_ORI`, `CA`, `TIME_BLOCK`, `START`, `PART`, `ENABLE`, `DISABLE` and `PATH`. These keywords are now also offered as completions.
- `GLOBAL CHAR …` and `GLOBAL POS …` declarations are now indexed as variables, while the values of a `GLOBAL ENUM` declaration are not mistaken for variables.

---

## [1.8.3] - 2026-08-12
### Added
- Fold/unfold actions are now bundled in a single "Folding" submenu in the editor context menu of KRL files: fold/unfold at cursor (also recursively), fold/unfold all blocks, and "Fold All ;FOLD Blocks" / "Unfold All ;FOLD Blocks" for the KUKA `;FOLD … ;ENDFOLD` regions. The commands are also available in the Command Palette under the "KUKA KRL" category while a KRL file is active.
- The folding commands carry the standard VS Code folding shortcuts (`Ctrl+Shift+[` / `Ctrl+Shift+]`, `Ctrl+K Ctrl+0` / `Ctrl+K Ctrl+J`, `Ctrl+K Ctrl+8` / `Ctrl+K Ctrl+9`, …) scoped to KRL files, so the context menu shows the matching shortcut next to every entry.

---

## [1.8.2] - 2026-05-31
### Added
- Bundled index of KUKA `$`-system variables (`server/data/system_vars.json`, ~445 entries). Typing `$` now offers system-variable completions (with data type and description), and hovering over a `$`-variable shows its type and description.

### Changed
- `kukaKrl.validation.undeclaredIdentifiers` is now enabled by default and no longer marked experimental. It still emits Information-severity diagnostics for identifiers not found in the current KRL workspace index. (`$`-system variables, `#`-enums and `.`-subvariables remain exempt, so an incomplete system-variable index never causes false "undeclared" warnings.)
- Renamed the settings category title from "KUKA KRL Assistant" to "KUKA KRL Edit".
- Normalized the system-variable index: consistent data types (`Integer`, `Real`, `Boolean`, `Structure`, `Frame`, `Enum`, `Signal`, `Array`, `Character`) and cleaned-up descriptions (OCR artefacts, stray quotes and split compound words).
- Migrated the TypeScript build to `module`/`moduleResolution` `node16` (the deprecated `node`/`node10` resolution is removed in TypeScript 7.0). CommonJS output is unchanged.

### Fixed
- Resolved the deprecation error reported for `"moduleResolution": "node"` in `client/tsconfig.json` / `server/tsconfig.json`.

---

## [1.8.1] - 2026-05-28
### Fixed
- Function-name lookup now compares names case-insensitively and ignores whitespace during matching, so `DEF`/`DEFFCT` declarations, hover, go-to-definition, and undeclared-identifier validation use the same KRL-style lookup behavior.
- Escaped symbol names in reference and declaration lookups before building regular expressions.
- Multi-root VS Code workspaces now keep function and declaration indexes scoped per workspace folder, preventing similarly structured KRL projects from interfering with each other.

---

## [1.8.0] - 2026-05-27
### Added
- New `kukaKrl.validation.variableNameSyntax` diagnostic. It reports invalid KRL variable identifiers in declarations, including names that do not start with a letter, names containing unsupported characters, and names that reuse reserved KRL keywords or predefined types.
- New experimental `kukaKrl.validation.undeclaredIdentifiers` diagnostic. It reports identifiers that are not declared in the current KRL workspace index as Information and is disabled by default.

### Fixed
- Variable-name validation now respects array brackets when splitting declaration lists, so declarations like `DECL INT arr[2,3], nextVar` are parsed correctly.
- Variable-name validation no longer reports valid machine-data system variable declarations like `DECL ADAP_ACC $ADAP_ACC=#STEP2`.
- Variable-name validation now treats `CONST` as a declaration modifier, so declarations like `DECL CONST CHAR MASREF_Modulname[6]` validate the actual variable name.
- Variable-name validation no longer treats KRL keywords/types as invalid variable names, because valid machine data can use names like `LOAD_DATA`, `OUT`, or `ERR`.
- `&` metadata lines such as `&COMMENT global points` are ignored by diagnostics.
- Experimental undeclared-identifier validation was hardened against real KUKA project data: direct `.dat` type declarations, common KRL system commands/functions, structure initializers, and single-quoted bit literals now avoid false positives.
- Added more KRL system commands/functions to the undeclared-identifier allow-list, including `REPEAT`, `UNTIL`, `PTP_REL`, `SWRITE`, and `ERR_RAISE`.
- Undeclared-identifier validation now builds a workspace-wide declaration index from `.src`, `.dat`, and `.sub` files, so cross-file array declarations such as `DECL KORREKTUR Korr_GT3_RS_16818_Dross[3]` are resolved in function calls.
- Added `IntToStrWithPrefix()` and `GET_COLLMON_SET()` to the undeclared-identifier allow-list.

---

## [1.7.1] - 2026-05-08
### Added
- Four `kukaKrl.validation.*` settings to toggle individual diagnostics on or off, all defaulting to `true`:
  - `variableNameLength` — 24-character variable name limit (Error)
  - `globalUsage` — `GLOBAL` keyword usage check (Warning)
  - `defdatPublicGlobalRequired` — `DEFDAT … PUBLIC` requires `GLOBAL` declarations (Warning)
  - `defdatNonPublicGlobalForbidden` — non-PUBLIC `DEFDAT` forbids `GLOBAL` declarations (Error)

  Toggling a setting clears stale diagnostics across open files immediately, no reload required. The two server-side toggles (`defdat*`) are pushed to the language server via a `custom/setValidationConfig` notification.

---

## [1.7.0] - 2026-05-07
### Added
- Folding ranges for KRL block constructs: `DEF`/`DEFFCT`/`DEFDAT`, `IF`, `LOOP`, `FOR`, `WHILE`, `SWITCH`, `STRUC` and `REPEAT`. Also folds the KUKA-style `;FOLD … ;ENDFOLD` editor blocks that appear in machine-generated code.
- Recognize uppercase file extensions `.SRC`, `.DAT` and `.SUB` in addition to the lowercase variants — KUKA controllers commonly produce uppercase filenames.

---

## [1.6.0] - 2026-05-07
### Added
- Find All References (`Shift+F12`, right-click → "Find All References" / "Go to References", peek view via `Alt+Shift+F12`). Case-insensitive workspace-wide search across `.src`, `.dat` and `.sub` files. Skips line comments, subvariable accesses (`foo.bar`) and system variables (`$foo`, `#foo`). Honors the LSP `includeDeclaration` flag.

---

## [1.5.0] - 2026-05-07
### Added
- Document Symbols / Outline support for `DEF`, `DEFFCT` and `DEFDAT` blocks. Functions and data modules now appear in the Outline view, in Breadcrumbs, and via the symbol picker (Ctrl+Shift+O).

### Fixed
- `Go to Definition` failed when the symbol was written with a different case than its declaration. KRL is case-insensitive, but variable, struct and function lookups compared names strictly. Now all lookups are case-insensitive, and the jump position is computed correctly even when the file uses a different casing than the call site.

---

## [1.4.6] - 2025-08-24
### Fixed
- Fix issue with variables that could contain the string "Global" and trigger the PUBLIC DEFDAT error.

---

## [1.4.5] - 2025-08-24
### Fixed
- Fix issue with global variables inside a DEDFAT error

---

## [1.4.4] - 2025-07-28
### Fixed
- Fix warning for DECL variable with GLOBAL if a predefined type is used

------

## [1.4.3] - 2025-07-28
### Fixed
- Autocompletion via Intellisense didn't show Keywords when written

---

## [1.4.2] - 2025-07-28
### Fixed
- `Go to Definition` didn't work properly for variable or custom variable type
- `Go to Definition` will first check inside the same DEF, DEFCT if the variable is declare, then will check globally

---

## [1.4.1] - 2025-07-25
### Fixed
- Autocompletion with variables only shows now subvariables with '.', not declared functions

---

## [1.4.0] - 2025-07-25
### Added
- Autocompletion via Intellisense for functions with respectives params

### Removed
- Warning for GLOBAL ENUM that don't required DECL

---

## [1.3.1] - 2025-07-25
### Other
- Update ReadMe and Changelog

---

## [1.3.0] - 2025-07-25
### Added
- Extract variables from DECL, STRUC, and ENUM.
- Autocompletion for variables after typing the variable name followed by '.'.

### Fixed
- Errors and warnings were displayed multiple times; now they appear only once until cleared by the user.

### Other
- Refactored and cleaned up server and client code.

---

## [1.2.0] - 2025-07-24
### Added
- Error if a variable length is more than 24 characters
- Error if a GLOBAL is used without DECL, SIGNAL, STRUC
- Check all files for errors when opening a workspace or at VS Code startup.

---

## [1.1.1] - 2025-07-23
### Added
- No action if the clicked function is already on the DECL line.

### Fixed
- `Go to Definition` sometimes didn't work with function
- `Go to Definition` sometimes performed a peek instead of a go-to on variables.

---

## [1.1.0] - 2025-07-23
### Added
- Basic cross-file support for variable declarations using `DECL`, `SIGNAL`, and `STRUC`.
- `Go to Definition` now supports variables across multiple files.

---

## [1.0.0] - 2025-07-22
### Added
- Initial release.
- Syntax highlighting for KUKA KRL.
- Basic `Go to Definition` support for function only.
- Snippet support for KRL keywords.

