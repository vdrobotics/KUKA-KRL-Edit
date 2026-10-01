"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAllDatFiles = void 0;
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode_uri_1 = require("vscode-uri");
// Create LSP connection and document manager
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
// Global state variables
let workspaceRoot = null;
let workspaceRoots = [];
const fileVariablesMap = new Map();
const logFile = path.join(__dirname, 'krl-server.log');
let logMsg = "";
// Variables and struct maps (updated dynamically)
let variableStructTypes = {};
let structDefinitions = {};
let functionsDeclared = [];
let functionsDeclaredByRoot = new Map();
let mergedVariables = [];
let workspaceDeclaredNameCacheByRoot = new Map();
// Server-side validation toggles, pushed by the client via 'custom/setValidationConfig'.
// Defaults match package.json: all checks on.
const serverValidationConfig = {
    defdatPublicGlobalRequired: true,
    defdatNonPublicGlobalForbidden: true,
    undeclaredIdentifiers: true,
};
let systemVariables = [];
// Keyed by uppercased base name (leading '$', trailing array brackets stripped) for case-insensitive lookup.
const systemVariableMap = new Map();
function systemVariableKey(name) {
    return name.replace(/\[.*$/, '').trim().toUpperCase();
}
function loadSystemVariables() {
    const dataPath = path.join(__dirname, '..', 'data', 'system_vars.json');
    try {
        systemVariables = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
    catch (err) {
        systemVariables = [];
        logToFile(`Failed to load system variables from ${dataPath}: ${err}`);
        return;
    }
    systemVariableMap.clear();
    for (const sv of systemVariables) {
        systemVariableMap.set(systemVariableKey(sv.var_name), sv);
    }
}
connection.onNotification('custom/setValidationConfig', (cfg) => {
    if (typeof cfg.defdatPublicGlobalRequired === 'boolean') {
        serverValidationConfig.defdatPublicGlobalRequired = cfg.defdatPublicGlobalRequired;
    }
    if (typeof cfg.defdatNonPublicGlobalForbidden === 'boolean') {
        serverValidationConfig.defdatNonPublicGlobalForbidden = cfg.defdatNonPublicGlobalForbidden;
    }
    if (typeof cfg.undeclaredIdentifiers === 'boolean') {
        serverValidationConfig.undeclaredIdentifiers = cfg.undeclaredIdentifiers;
    }
    // Re-validate all open files so stale diagnostics clear or fresh ones appear immediately.
    documents.all().forEach(doc => {
        if (isKrlDocument(doc))
            validateDocument(doc, connection);
    });
});
const CODE_KEYWORDS = [
    'GLOBAL', 'DEF', 'DEFFCT', 'END', 'ENDFCT', 'RETURN', 'TRIGGER',
    'REAL', 'BOOL', 'DECL', 'IF', 'ELSE', 'ENDIF', 'CONTINUE', 'FOR', 'ENDFOR', 'WHILE',
    'ENDWHILE', 'LOOP', 'ENDLOOP', 'STEP', 'REPEAT', 'UNTIL', 'AND', 'OR', 'NOT', 'TRUE', 'FALSE', 'INT', 'STRING', 'PULSE', 'WAIT', 'SEC', 'NULLFRAME', 'THEN',
    'CASE', 'DEFAULT', 'SWITCH', 'ENDSWITCH', 'BREAK', 'ABS', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN2', 'MAX', 'MIN',
    'DEFDAT', 'ENDDAT', 'PUBLIC', 'STRUC', 'WHEN', 'DISTANCE', 'DO', 'DELAY', 'PRIO', 'LIN', 'PTP', 'DELAY',
    'C_PTP', 'C_LIN', 'C_VEL', 'C_DIS', 'BAS', 'LOAD', 'FRAME', 'IN', 'OUT',
    'X', 'Y', 'Z', 'A', 'B', 'C', 'S', 'T', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
    'SQRT', 'TO', 'Axis', 'E6AXIS', 'E6POS', 'LOAD_DATA', 'BASE', 'TOOL',
    'INVERSE', 'FORWARD', 'B_AND', 'B_OR', 'B_NOT', 'B_XOR', 'B_NAND', 'B_NOR', 'B_XNOR',
    'GOTO', 'HALT', 'INTERRUPT', 'ON', 'OFF', 'RESUME', 'BRAKE', 'ON_ERROR_PROCEED', 'ERR_CLEAR',
    'CIRC', 'SPLINE', 'ENDSPLINE', 'LIN_REL', 'PTP_REL', 'SLIN', 'SPTP', 'SCIRC', 'SPL', 'ENDSPL', 'WAITFOR', 'STRLEN',
    'CWRITE', 'SWRITE', 'STRCOMP', 'IS_KEY_PRESSED', 'CLEAR_KRLMSG', 'SET_KRLMSG', 'ERR_RAISE', 'EXOR', 'EXIT', 'CHANNEL', 'EXT',
    'STRADD', 'STRCLEAR', 'EXISTS_KRLMSG', 'EXISTS_KRLDLG', 'SET_KRLDLG',
    'LK', 'EK', 'EB', 'EO', 'EB_ABS', 'INV_POS',
    'VARSTATE', 'WITH', 'MBX_REC', 'SYNC', 'EB_TEST', 'TEST_BRAKE',
    'INTTOSTRWITHPREFIX', 'GET_COLLMON_SET',
    'CHAR', 'POS', 'ENUM', 'CONST', 'SIGNAL', 'EXTFCT', 'B_EXOR',
    'CIRC_REL', 'ASYPTP', 'ASYSTOP', 'ASYCONT', 'ASYCANCEL', 'C_ORI', 'CA', 'TIME_BLOCK', 'START', 'PART',
    'ENABLE', 'DISABLE', 'PATH',
];
// =======================
// Initialization Handlers
// =======================
connection.onInitialize((params) => {
    var _a, _b, _c;
    workspaceRoots = (_b = (_a = params.workspaceFolders) === null || _a === void 0 ? void 0 : _a.map(folder => vscode_uri_1.URI.parse(folder.uri).fsPath)) !== null && _b !== void 0 ? _b : [];
    if (workspaceRoots.length === 0 && params.rootUri) {
        workspaceRoots = [vscode_uri_1.URI.parse(params.rootUri).fsPath];
    }
    workspaceRoot = (_c = workspaceRoots[0]) !== null && _c !== void 0 ? _c : null;
    // Debug: Delete old log file if exists
    if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
    }
    loadSystemVariables();
    // Return server capabilities
    return {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            definitionProvider: true,
            hoverProvider: true,
            documentSymbolProvider: true,
            referencesProvider: true,
            foldingRangeProvider: true,
            completionProvider: {
                triggerCharacters: [
                    '.', '(', ',', ' ', '=', '+', '-', '*', '/', '<', '>', '!', '$',
                    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'
                ]
            }
        }
    };
});
connection.onInitialized(() => __awaiter(void 0, void 0, void 0, function* () {
    if (workspaceRoots.length === 0)
        return;
    for (const root of workspaceRoots) {
        const files = getAllDatFiles(root);
        for (const filePath of files) {
            const content = readKrlFile(filePath);
            const uri = vscode_uri_1.URI.file(filePath).toString();
            const collector = new DeclaredVariableCollector();
            collector.extractFromText(content);
            fileVariablesMap.set(uri, collector.getVariables());
        }
        functionsDeclaredByRoot.set(root, getAllFunctionDeclarations(root));
    }
    functionsDeclared = Array.from(functionsDeclaredByRoot.values()).flat();
    mergedVariables = mergeAllVariables(fileVariablesMap);
}));
// ==========================
// Document Change Event Hook
// ==========================
documents.onDidChangeContent((change) => __awaiter(void 0, void 0, void 0, function* () {
    const { document } = change;
    try {
        invalidateWorkspaceCachesForDocument(document.uri);
        extractStrucVariables(document.getText());
        const collector = new DeclaredVariableCollector();
        collector.extractFromText(document.getText());
        fileVariablesMap.set(document.uri, collector.getVariables());
        mergedVariables = mergeAllVariables(fileVariablesMap);
        if (isKrlDocument(document)) {
            validateDocument(document, connection);
        }
    }
    catch (error) {
        // An error here must not reject, because that would end the server process
        connection.console.error(`KRL: processing ${document.uri} failed: ${error}`);
    }
}));
documents.onDidOpen(change => {
    const { document } = change;
    try {
        invalidateWorkspaceCachesForDocument(document.uri);
        const collector = new DeclaredVariableCollector();
        collector.extractFromText(document.getText());
        fileVariablesMap.set(document.uri, collector.getVariables());
        mergedVariables = mergeAllVariables(fileVariablesMap);
        if (isKrlDocument(document)) {
            validateDocument(document, connection);
        }
    }
    catch (error) {
        connection.console.error(`KRL: processing ${document.uri} failed: ${error}`);
    }
});
// ===================
// File and Variables Utilities
// ===================
function normalizeFunctionName(name) {
    return name.replace(/\s+/g, '').toLowerCase();
}
function indexOfIdentifierIgnoreCase(text, identifier) {
    return text.toLowerCase().indexOf(identifier.toLowerCase());
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// KRL identifiers may contain '$' â€” system variables like $VEL_ACT start with it,
// and customer naming schemes like i$VarName use it inside the name. Matching with
// '\w' alone splits those names apart, so identifier handling uses these patterns.
const KRL_IDENTIFIER_SOURCE = '[A-Za-z_$][A-Za-z0-9_$]*';
const KRL_IDENTIFIER_NAME = new RegExp(`^${KRL_IDENTIFIER_SOURCE}$`);
/** Predefined KRL data types, used to spot declarations written without DECL. */
const PREDEFINED_TYPE_NAMES = [
    'INT', 'REAL', 'BOOL', 'CHAR', 'FRAME', 'POS', 'E6POS', 'AXIS', 'E6AXIS',
    'LOAD', 'LOAD_DATA', 'CHANNEL', 'FDAT', 'LDAT', 'PDAT'
];
function isKnownTypeName(type) {
    const upperType = type.toUpperCase();
    return PREDEFINED_TYPE_NAMES.includes(upperType) ||
        Object.keys(structDefinitions).some(key => key.toUpperCase() === upperType);
}
/** Extract the declared names from the variable list of a declaration. */
function declaredNamesOf(varList) {
    return splitVarsRespectingBrackets(varList)
        .map(name => name.trim())
        .map(name => name.replace(/\[.*?\]/g, '').trim()) // Remove array brackets
        .map(name => name.replace(/\s*=\s*[^]*$/, '').trim()) // Remove initializations
        .filter(name => KRL_IDENTIFIER_NAME.test(name));
}
/**
 * Check whether a single line declares `name`.
 * With `explicitOnly`, only DECL/SIGNAL declarations count; otherwise declarations
 * written without DECL (common in .dat files, e.g. `INT counter=5`) count too.
 */
function declaresVariable(line, name, explicitOnly) {
    const code = stripLineComment(line);
    const matchesName = (candidate) => candidate.toLowerCase() === name.toLowerCase();
    const declMatch = new RegExp(`^\\s*(?:GLOBAL\\s+)?DECL\\s+(?:GLOBAL\\s+)?(?:CONST\\s+)?${KRL_IDENTIFIER_SOURCE}\\s+(.+)$`, 'i').exec(code);
    if (declMatch)
        return declaredNamesOf(declMatch[1]).some(matchesName);
    const signalMatch = new RegExp(`^\\s*(?:GLOBAL\\s+)?SIGNAL\\s+(${KRL_IDENTIFIER_SOURCE})`, 'i').exec(code);
    if (signalMatch)
        return matchesName(signalMatch[1]);
    if (explicitOnly)
        return false;
    const typedMatch = new RegExp(`^\\s*(?:GLOBAL\\s+)?(?:CONST\\s+)?(${KRL_IDENTIFIER_SOURCE})\\s+(.+)$`, 'i').exec(code);
    if (!typedMatch || !isKnownTypeName(typedMatch[1]))
        return false;
    return declaredNamesOf(typedMatch[2]).some(matchesName);
}
function getWorkspaceRootForUri(uri) {
    var _a;
    let fsPath;
    try {
        fsPath = vscode_uri_1.URI.parse(uri).fsPath;
    }
    catch (_b) {
        fsPath = uri;
    }
    const roots = workspaceRoots.length > 0 ? workspaceRoots : (workspaceRoot ? [workspaceRoot] : []);
    const matchingRoots = roots.filter(root => isPathInsideOrEqual(fsPath, root));
    matchingRoots.sort((a, b) => b.length - a.length);
    return (_a = matchingRoots[0]) !== null && _a !== void 0 ? _a : workspaceRoot;
}
function isPathInsideOrEqual(filePath, rootPath) {
    const resolvedFile = path.resolve(filePath).toLowerCase();
    const resolvedRoot = path.resolve(rootPath).toLowerCase();
    const relative = path.relative(resolvedRoot, resolvedFile);
    return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}
function invalidateWorkspaceCachesForDocument(uri) {
    const root = getWorkspaceRootForUri(uri);
    if (!root) {
        workspaceDeclaredNameCacheByRoot.clear();
        functionsDeclaredByRoot.clear();
        functionsDeclared = [];
        return;
    }
    // Only drop the caches here. They are rebuilt on demand, so a burst of edits
    // does not re-index the whole workspace once per keystroke.
    workspaceDeclaredNameCacheByRoot.delete(root);
    functionsDeclaredByRoot.delete(root);
    functionsDeclared = Array.from(functionsDeclaredByRoot.values()).flat();
}
function getMergedVariablesForRoot(root) {
    const scopedMap = new Map();
    for (const [uri, variables] of fileVariablesMap.entries()) {
        if (getWorkspaceRootForUri(uri) === root) {
            scopedMap.set(uri, variables);
        }
    }
    return mergeAllVariables(scopedMap);
}
function getFunctionsForRoot(root) {
    let declarations = functionsDeclaredByRoot.get(root);
    if (!declarations) {
        declarations = getAllFunctionDeclarations(root);
        functionsDeclaredByRoot.set(root, declarations);
        functionsDeclared = Array.from(functionsDeclaredByRoot.values()).flat();
    }
    return declarations;
}
/**
 * Recursively find all .dat files in the workspace directory.
 */
function getAllDatFiles(dir) {
    return getAllKrlFiles(dir).filter(filePath => filePath.toLowerCase().endsWith('.dat'));
}
function getAllKrlFiles(dir) {
    const result = [];
    const visited = new Set();
    function recurse(currentDir) {
        // Resolving the real path keeps directory junctions that point at a parent
        // folder from being walked forever, and skips links that lead nowhere.
        let realDir;
        try {
            realDir = fs.realpathSync(currentDir).toLowerCase();
        }
        catch (_a) {
            return;
        }
        if (visited.has(realDir))
            return;
        visited.add(realDir);
        let entries;
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        }
        catch (error) {
            // An unreadable folder must never take down the whole workspace scan
            connection.console.warn(`KRL: skipping unreadable folder ${currentDir}: ${error}`);
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory() || entry.isSymbolicLink()) {
                if (entry.name === 'node_modules' || entry.name.startsWith('.'))
                    continue;
                recurse(fullPath);
            }
            else if (entry.isFile() && /\.(src|dat|sub)$/i.test(fullPath)) {
                result.push(fullPath);
            }
        }
    }
    recurse(dir);
    return result;
}
/** Content of a workspace file, preferring unsaved editor content over the disk. */
function krlFileContent(filePath) {
    const uri = filePath.startsWith('file://') ? filePath : vscode_uri_1.URI.file(filePath).toString();
    const openDocument = documents.get(uri);
    if (openDocument)
        return openDocument.getText();
    return readKrlFile(filePath.startsWith('file://') ? vscode_uri_1.URI.parse(filePath).fsPath : filePath);
}
/** Read a KRL file; an unreadable file is treated as empty instead of throwing. */
function readKrlFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    }
    catch (error) {
        connection.console.warn(`KRL: cannot read ${filePath}: ${error}`);
        return '';
    }
}
/**
 * Merge all variables from multiple files into a single map.
 */
function mergeAllVariables(map) {
    const result = [];
    const seen = new Set();
    for (const vars of map.values()) {
        for (const v of vars) {
            if (!seen.has(v.name)) {
                seen.add(v.name);
                result.push({ name: v.name, type: v.type || '' });
            }
        }
    }
    return result;
}
/**
 * Append a timestamped message to the log file.
 */
function logToFile(message) {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
}
// =====================
// Definition Request Handler
// =====================
connection.onDefinition((params) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const doc = documents.get(params.textDocument.uri);
    const documentRoot = doc ? getWorkspaceRootForUri(params.textDocument.uri) : null;
    if (!doc || !documentRoot)
        return;
    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];
    // Ignore certain declarations lines
    if (/^\s*(GLOBAL\s+)?(DEF|DEFFCT|DECL INT|DECL REAL|DECL BOOL|DECL FRAME)\b/i.test(lineText))
        return;
    //Avoid looking for subvariables inside struc    
    if ((_a = getWordAtPosition(lineText, params.position.character)) === null || _a === void 0 ? void 0 : _a.isSubvariable) {
        return;
    }
    const functionName = (_b = getWordAtPosition(lineText, params.position.character)) === null || _b === void 0 ? void 0 : _b.word;
    if (!functionName)
        return;
    //Search for name as function first
    const resultFct = findFunctionDefinition(functionName, params.textDocument.uri, lines, documentRoot);
    if (resultFct != undefined) {
        return node_1.Location.create(resultFct.uri, {
            start: node_1.Position.create(resultFct.line, resultFct.startChar),
            end: node_1.Position.create(resultFct.line, resultFct.endChar)
        });
    }
    //Search for name as custom user variable type
    const isKnownStruct = Object.keys(structDefinitions)
        .some(key => key.toLowerCase() === functionName.toLowerCase());
    if (isKnownStruct) {
        const resultStruc = findStructDefinition(functionName, documentRoot);
        if (resultStruc != undefined) {
            return node_1.Location.create(resultStruc.uri, {
                start: node_1.Position.create(resultStruc.line, resultStruc.startChar),
                end: node_1.Position.create(resultStruc.line, resultStruc.endChar)
            });
        }
    }
    //Search for name as variable.
    // The workspace index is used as the gate, so variables declared in .src and
    // .sub files that are not open are found too.
    const enclosures = findEnclosuresLines(params.position.line, lines);
    const declaredNames = getDeclaredNamesForDocument(doc);
    if (declaredNames.has(functionName.toLowerCase())) {
        const resultVar = findVariableDefinition(functionName, params.textDocument.uri, lines, enclosures, documentRoot);
        if (resultVar) {
            return node_1.Location.create(resultVar.uri, {
                start: node_1.Position.create(resultVar.line, resultVar.startChar),
                end: node_1.Position.create(resultVar.line, resultVar.endChar)
            });
        }
    }
    return;
}));
// ===================
// Hover Request Handler
// ===================
connection.onHover((params) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const doc = documents.get(params.textDocument.uri);
    const documentRoot = doc ? getWorkspaceRootForUri(params.textDocument.uri) : null;
    if (!doc || !documentRoot)
        return;
    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];
    // System variable hover ($...): show type and description from the bundled index.
    const systemVar = getSystemVariableAtPosition(lineText, params.position.character);
    if (systemVar) {
        return {
            contents: {
                kind: 'markdown',
                value: `**${systemVar.var_name}** â€” *${systemVar.var_type}*\n\n${systemVar.var_descr}`
            }
        };
    }
    if (/^\s*(GLOBAL\s+)?(DEF|DEFFCT|DECL|SIGNAL|STRUC)\b/i.test(lineText))
        return;
    const functionName = (_c = getWordAtPosition(lineText, params.position.character)) === null || _c === void 0 ? void 0 : _c.word;
    if (!functionName)
        return;
    const result = findFunctionDefinition(functionName, params.textDocument.uri, lines, documentRoot);
    if (!result)
        return;
    return {
        contents: {
            kind: 'markdown',
            value: `**${functionName}**(${result.params})`
        }
    };
}));
// ==================
// Completion Request Handler
// ==================
connection.onCompletion((params) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    logMsg = `On completion is called`;
    logToFile(logMsg);
    const document = documents.get(params.textDocument.uri);
    const documentRoot = document ? getWorkspaceRootForUri(params.textDocument.uri) : null;
    if (!document || !documentRoot)
        return [];
    const lines = document.getText().split(/\r?\n/);
    // === 1. Struct field completions ===
    const variableStructTypes = {};
    for (const line of lines) {
        const declRegex = /^(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?(\w+)\s+(\w+)/i;
        const match = declRegex.exec(line.trim());
        if (match) {
            const type = match[1];
            const varName = match[2];
            variableStructTypes[varName] = type;
        }
    }
    const line = lines[params.position.line];
    const textBefore = line.substring(0, params.position.character);
    const dotMatch = textBefore.match(/(\w+)\.$/);
    const structItems = [];
    if (dotMatch) {
        const varName = dotMatch[1];
        const structName = variableStructTypes[varName];
        const members = structDefinitions[structName];
        if (members) {
            structItems.push(...members.map(member => ({
                label: member,
                kind: node_1.CompletionItemKind.Field
            })));
        }
        // Only return struct completions after dot
        return structItems;
    }
    // === 1b. System variable completions (after '$') ===
    const dollarMatch = textBefore.match(/\$\w*$/);
    if (dollarMatch) {
        const startChar = params.position.character - dollarMatch[0].length;
        const replaceRange = node_1.Range.create(params.position.line, startChar, params.position.line, params.position.character);
        return systemVariables.map(sv => ({
            label: sv.var_name,
            kind: node_1.CompletionItemKind.Variable,
            detail: sv.var_type,
            documentation: sv.var_descr,
            textEdit: node_1.TextEdit.replace(replaceRange, sv.var_name),
            filterText: sv.var_name,
            sortText: sv.var_name
        }));
    }
    // === 2. Function completions ===
    const functionItems = getFunctionsForRoot(documentRoot).map(fn => {
        const paramList = fn.params.split(',').map(p => p.trim()).filter(Boolean);
        const snippetParams = paramList.map((p, i) => `\${${i + 1}:${p}}`).join(', ');
        return {
            label: fn.name,
            kind: node_1.CompletionItemKind.Function,
            detail: `${fn.name}(${fn.params})`,
            insertText: `${fn.name}(${snippetParams})`,
            insertTextFormat: node_1.InsertTextFormat.Snippet,
            documentation: `User-defined function: ${fn.name}`,
            commitCharacters: ['('],
            filterText: fn.name,
            sortText: fn.name
        };
    });
    const currentWord = ((_d = textBefore.trim().split(/\s+/).pop()) === null || _d === void 0 ? void 0 : _d.toUpperCase()) || '';
    const filtered = CODE_KEYWORDS
        .filter(kw => kw.includes(currentWord))
        .sort((a, b) => {
        const aStarts = a.startsWith(currentWord);
        const bStarts = b.startsWith(currentWord);
        if (aStarts && !bStarts)
            return -1;
        if (!aStarts && bStarts)
            return 1;
        return a.localeCompare(b);
    });
    // Return as CompletionItems
    const keywordsFiltered = filtered.map(kw => ({
        label: kw,
        kind: node_1.CompletionItemKind.Keyword,
        data: kw,
        sortText: kw,
        filterText: kw
    }));
    const uniqueKeywordItems = keywordsFiltered.filter(kwItem => !functionItems.some(fnItem => fnItem.label === kwItem.label));
    // === 3. Return all completions (if not after a dot) ===
    const allItems = [...functionItems, ...structItems, ...uniqueKeywordItems];
    logMsg = `Variable filtrÃ©es: ${JSON.stringify(allItems, null, 2)}`;
    logToFile(logMsg);
    return allItems;
}));
// ==================
// Document Symbol Request Handler (Outline / Strg+Shift+O / Breadcrumbs)
// ==================
connection.onDocumentSymbol((params) => {
    var _a, _b;
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return [];
    const lines = doc.getText().split(/\r?\n/);
    const symbols = [];
    const defRegex = /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT)\s+(?:(\w+)\s+)?(\w+)\s*\(([^)]*)\)/i;
    const defdatRegex = /^\s*(?:GLOBAL\s+)?DEFDAT\s+(\w+)(?:\s+(PUBLIC))?/i;
    const endRegex = /^\s*(END|ENDFCT|ENDDAT)\b/i;
    let open = null;
    const emit = (o, endLine, endChar) => {
        symbols.push({
            name: o.name,
            detail: o.detail,
            kind: o.kind,
            range: node_1.Range.create(o.startLine, 0, endLine, endChar),
            selectionRange: node_1.Range.create(o.startLine, o.nameStart, o.startLine, o.nameEnd),
        });
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Strip line-comments (KRL: ';') for keyword detection
        const code = line.split(';')[0];
        if (open) {
            const endMatch = endRegex.exec(code);
            if (endMatch && endMatch[1].toUpperCase() === open.expectedEnd) {
                emit(open, i, line.length);
                open = null;
            }
            continue;
        }
        let m = defRegex.exec(code);
        if (m) {
            const keyword = m[1].toUpperCase();
            const returnType = m[2] || '';
            const name = m[3];
            const params = m[4].trim();
            const nameStart = line.indexOf(name);
            open = {
                kind: node_1.SymbolKind.Function,
                name,
                detail: keyword === 'DEFFCT' ? `${returnType} (${params})` : `(${params})`,
                startLine: i,
                nameStart,
                nameEnd: nameStart + name.length,
                expectedEnd: keyword === 'DEFFCT' ? 'ENDFCT' : 'END',
            };
            continue;
        }
        m = defdatRegex.exec(code);
        if (m) {
            const name = m[1];
            const isPublic = !!m[2];
            const nameStart = line.indexOf(name);
            open = {
                kind: node_1.SymbolKind.Module,
                name,
                detail: isPublic ? 'PUBLIC' : '',
                startLine: i,
                nameStart,
                nameEnd: nameStart + name.length,
                expectedEnd: 'ENDDAT',
            };
        }
    }
    // Unclosed block: span to end of file so the symbol still appears in the outline.
    if (open) {
        const lastLine = Math.max(0, lines.length - 1);
        emit(open, lastLine, (_b = (_a = lines[lastLine]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0);
    }
    return symbols;
});
// ==================
// References Request Handler (Shift+F12 / Right-click â†’ Find All References)
// ==================
connection.onReferences((params) => __awaiter(void 0, void 0, void 0, function* () {
    const doc = documents.get(params.textDocument.uri);
    const documentRoot = doc ? getWorkspaceRootForUri(params.textDocument.uri) : null;
    if (!doc || !documentRoot)
        return [];
    const lines = doc.getText().split(/\r?\n/);
    const lineText = lines[params.position.line];
    const wordInfo = getWordAtPosition(lineText, params.position.character);
    if (!wordInfo)
        return [];
    const name = wordInfo.word;
    // Skip pure numeric tokens â€” \w+ matches them but they're never identifiers
    if (/^\d/.test(name))
        return [];
    // KRL is case-insensitive; word boundary keeps "Foo" out of "FooBar"
    const wordRegex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
    const declLineRegex = /^\s*(GLOBAL\s+)?(DEF|DEFFCT|DEFDAT|STRUC|ENUM|DECL|SIGNAL)\b/i;
    const includeDeclaration = params.context.includeDeclaration;
    const files = yield findSrcFiles(documentRoot);
    const results = [];
    for (const filePath of files) {
        const uri = vscode_uri_1.URI.file(filePath).toString();
        // Prefer in-memory content so unsaved edits are reflected
        const openDoc = documents.get(uri);
        const content = openDoc ? openDoc.getText() : readKrlFile(filePath);
        const fileLines = content.split(/\r?\n/);
        for (let i = 0; i < fileLines.length; i++) {
            const rawLine = fileLines[i];
            // Strip line comments before matching
            const code = rawLine.split(';')[0];
            const isDeclLine = declLineRegex.test(code);
            if (isDeclLine && !includeDeclaration)
                continue;
            wordRegex.lastIndex = 0;
            let m;
            while ((m = wordRegex.exec(code)) !== null) {
                const start = m.index;
                const prev = start > 0 ? code[start - 1] : '';
                // Skip subvariable accesses (a.foo) and system vars ($foo, #foo)
                if (prev === '.' || prev === '$' || prev === '#')
                    continue;
                results.push(node_1.Location.create(uri, {
                    start: node_1.Position.create(i, start),
                    end: node_1.Position.create(i, start + name.length),
                }));
            }
        }
    }
    return results;
}));
// ==================
// Folding Ranges Request Handler
// ==================
connection.onFoldingRanges((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc)
        return [];
    const lines = doc.getText().split(/\r?\n/);
    const ranges = [];
    // open keyword -> matching close keyword
    const blockOpens = {
        DEF: 'END',
        DEFFCT: 'ENDFCT',
        DEFDAT: 'ENDDAT',
        IF: 'ENDIF',
        LOOP: 'ENDLOOP',
        FOR: 'ENDFOR',
        WHILE: 'ENDWHILE',
        SWITCH: 'ENDSWITCH',
        STRUC: 'ENDSTRUC',
        REPEAT: 'UNTIL',
    };
    // Opens must sit at line start (allow leading GLOBAL for DEF*/STRUC).
    const openRegex = /^\s*(?:GLOBAL\s+)?(DEF|DEFFCT|DEFDAT|IF|LOOP|FOR|WHILE|SWITCH|STRUC|REPEAT)\b/i;
    // Word boundaries keep END out of ENDIF etc. Longer alternatives listed first defensively.
    const closeRegex = /\b(ENDFCT|ENDDAT|ENDIF|ENDLOOP|ENDFOR|ENDWHILE|ENDSWITCH|ENDSTRUC|UNTIL|END)\b/i;
    const blockStack = [];
    const foldStack = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        // ;FOLD / ;ENDFOLD â€” KUKA editor folds. Detect before comment-stripping.
        if (/^\s*;\s*FOLD\b/i.test(raw)) {
            foldStack.push(i);
            continue;
        }
        if (/^\s*;\s*ENDFOLD\b/i.test(raw)) {
            const start = foldStack.pop();
            if (start !== undefined && i > start) {
                ranges.push({ startLine: start, endLine: i, kind: node_1.FoldingRangeKind.Region });
            }
            continue;
        }
        const code = raw.split(';')[0];
        const openMatch = openRegex.exec(code);
        const openKw = openMatch ? openMatch[1].toUpperCase() : null;
        const closeMatch = closeRegex.exec(code);
        const closeKw = closeMatch ? closeMatch[1].toUpperCase() : null;
        // Same-line open + matching close (one-liner IF/STRUC) â€” nothing to fold.
        if (openKw && closeKw && blockOpens[openKw] === closeKw)
            continue;
        if (openKw) {
            blockStack.push({ startLine: i, expectedEnd: blockOpens[openKw] });
        }
        else if (closeKw) {
            const top = blockStack[blockStack.length - 1];
            if (top && top.expectedEnd === closeKw) {
                blockStack.pop();
                if (i > top.startLine) {
                    ranges.push({ startLine: top.startLine, endLine: i });
                }
            }
        }
    }
    return ranges;
});
const FUNCTION_DEF_REGEX = /\b(GLOBAL\s+)?(DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(([^)]*)\)/i;
const parsedFileCache = new Map();
function parseKrlContent(filePath, content) {
    const collector = new DeclaredVariableCollector();
    collector.extractFromText(content);
    const names = collector.getVariables().map(variable => variable.name.toLowerCase());
    const functions = [];
    const uri = vscode_uri_1.URI.file(filePath).toString();
    const fileLines = content.split(/\r?\n/);
    for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i];
        const match = FUNCTION_DEF_REGEX.exec(line);
        if (!match)
            continue;
        const name = match[3];
        const startChar = indexOfIdentifierIgnoreCase(line, name);
        functions.push({
            name,
            uri,
            line: i,
            startChar,
            endChar: startChar + name.length,
            params: match[4].trim(),
        });
    }
    return { names, functions };
}
/**
 * Parse a workspace file, reusing the previous result while the file on disk is
 * unchanged. Without this every keystroke would re-read the whole project.
 */
function getParsedKrlFile(filePath) {
    const openDocument = documents.get(vscode_uri_1.URI.file(filePath).toString());
    if (openDocument) {
        // Unsaved edits must win over whatever is on disk
        return parseKrlContent(filePath, openDocument.getText());
    }
    let stats;
    try {
        stats = fs.statSync(filePath);
    }
    catch (_a) {
        return { names: [], functions: [] };
    }
    const cached = parsedFileCache.get(filePath);
    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
        return cached;
    }
    const parsed = parseKrlContent(filePath, readKrlFile(filePath));
    parsedFileCache.set(filePath, Object.assign(Object.assign({}, parsed), { mtimeMs: stats.mtimeMs, size: stats.size }));
    return parsed;
}
function getAllFunctionDeclarations(rootDir) {
    const searchRoot = rootDir !== null && rootDir !== void 0 ? rootDir : workspaceRoot;
    if (!searchRoot)
        return [];
    const allDeclarations = [];
    for (const filePath of getAllKrlFiles(searchRoot)) {
        allDeclarations.push(...getParsedKrlFile(filePath).functions);
    }
    return allDeclarations;
}
// =========================
// Utility Functions
// =========================
/**
 * Find DEF, DEFCT, DETDAT enclosures lines
 */
const ROUTINE_START_REGEX = /^\s*(?:GLOBAL\s+)?(?:DEFFCT|DEFDAT|DEF)\b/i;
// Only END, ENDFCT and ENDDAT close a routine; ENDIF, ENDFOR, ENDLOOP and the
// KUKA ;ENDFOLD markers must not be mistaken for the end of the scope.
const ROUTINE_END_REGEX = /^\s*(?:ENDFCT|ENDDAT|END)\s*$/i;
function findEnclosuresLines(lineNumber, lines) {
    const result = {
        upperLine: 0,
        bottomLine: lines.length - 1
    };
    for (let row = Math.min(lineNumber, lines.length - 1); row >= 0; row--) {
        if (ROUTINE_START_REGEX.test(stripLineComment(lines[row]))) {
            result.upperLine = row + 1;
            break;
        }
    }
    for (let row = lineNumber; row < lines.length; row++) {
        if (ROUTINE_END_REGEX.test(stripLineComment(lines[row]))) {
            result.bottomLine = row;
            break;
        }
    }
    return result;
}
function declarationLocation(filePath, line, lineNumber, name) {
    const uri = filePath.startsWith('file://') ? filePath : vscode_uri_1.URI.file(filePath).toString();
    const startChar = indexOfIdentifierIgnoreCase(line, name);
    return { uri, line: lineNumber, startChar, endChar: startChar + name.length, params: '', name };
}
/**
 * KUKA system data lists hold machine and configuration data that every program
 * can use, so their declarations count as global even without the GLOBAL keyword.
 * These are the files starting with '$' ($config.dat, $machine.dat, $custom.dat,
 * $robcor.dat) and the same names inside a System or Mada folder.
 */
function isSystemDataList(filePath) {
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName.startsWith('$'))
        return true;
    const folder = path.basename(path.dirname(filePath)).toLowerCase();
    return (folder === 'system' || folder === 'mada') &&
        /^(?:config|machine|custom|robcor)\.dat$/.test(fileName);
}
function findDeclarationInFile(filePath, name, globalOnly) {
    const fileLines = krlFileContent(filePath).split(/\r?\n/);
    // An explicit DECL/SIGNAL declaration wins over one written without DECL
    for (const explicitOnly of [true, false]) {
        for (let i = 0; i < fileLines.length; i++) {
            const line = fileLines[i];
            if (globalOnly && !/\bGLOBAL\b/i.test(stripLineComment(line)))
                continue;
            if (!declaresVariable(line, name, explicitOnly))
                continue;
            return declarationLocation(filePath, line, i, name);
        }
    }
    return undefined;
}
/**
 * Find a variable declaration following KRL scoping: the enclosing routine first,
 * then the .dat file of the same module, and finally GLOBAL declarations in the
 * other .dat files. Variables declared in a .src/.sub file are local to their
 * routine, so a declaration in another program file is never a valid target.
 */
function findVariableDefinition(name, documentUri, documentLines, enclosures, root) {
    for (let i = enclosures.upperLine; i <= enclosures.bottomLine && i < documentLines.length; i++) {
        if (declaresVariable(documentLines[i], name, false)) {
            return declarationLocation(documentUri, documentLines[i], i, name);
        }
    }
    const documentPath = vscode_uri_1.URI.parse(documentUri).fsPath;
    const moduleDat = documentPath.replace(/\.(src|sub)$/i, '.dat');
    if (moduleDat.toLowerCase() !== documentPath.toLowerCase() && fs.existsSync(moduleDat)) {
        const moduleResult = findDeclarationInFile(moduleDat, name, false);
        if (moduleResult)
            return moduleResult;
    }
    for (const filePath of getAllKrlFiles(root)) {
        if (!/\.dat$/i.test(filePath))
            continue;
        if (filePath.toLowerCase() === moduleDat.toLowerCase())
            continue;
        // Everything in a system data list is global; elsewhere only GLOBAL counts
        const globalResult = findDeclarationInFile(filePath, name, !isSystemDataList(filePath));
        if (globalResult)
            return globalResult;
    }
    return undefined;
}
/**
 * Find a routine following KRL scoping: a routine without GLOBAL can only be
 * called inside its own module, so the current file wins and only GLOBAL
 * routines of other files are considered afterwards.
 */
function findFunctionDefinition(name, documentUri, documentLines, root) {
    const normalizedName = normalizeFunctionName(name);
    const ownResult = findFunctionInLines(documentLines, documentUri, normalizedName, false);
    if (ownResult)
        return ownResult;
    const documentPath = vscode_uri_1.URI.parse(documentUri).fsPath.toLowerCase();
    for (const filePath of getAllKrlFiles(root)) {
        if (filePath.toLowerCase() === documentPath)
            continue;
        const fileLines = krlFileContent(filePath).split(/\r?\n/);
        const result = findFunctionInLines(fileLines, vscode_uri_1.URI.file(filePath).toString(), normalizedName, true);
        if (result)
            return result;
    }
    return undefined;
}
function findFunctionInLines(lines, uri, normalizedName, globalOnly) {
    for (let i = 0; i < lines.length; i++) {
        const match = FUNCTION_DEF_REGEX.exec(stripLineComment(lines[i]));
        if (!match)
            continue;
        if (globalOnly && !match[1])
            continue;
        const declaredName = match[3];
        if (normalizeFunctionName(declaredName) !== normalizedName)
            continue;
        const startChar = indexOfIdentifierIgnoreCase(lines[i], declaredName);
        return {
            uri,
            line: i,
            startChar,
            endChar: startChar + declaredName.length,
            params: match[4].trim(),
            name: declaredName
        };
    }
    return undefined;
}
function findStructDefinition(name, root) {
    const structRegex = new RegExp(`\\b(?:GLOBAL\\s+)?STRUC\\s+${escapeRegExp(name)}\\b`, 'i');
    for (const filePath of getAllKrlFiles(root)) {
        const fileLines = krlFileContent(filePath).split(/\r?\n/);
        for (let i = 0; i < fileLines.length; i++) {
            if (!structRegex.test(stripLineComment(fileLines[i])))
                continue;
            return declarationLocation(filePath, fileLines[i], i, name);
        }
    }
    return undefined;
}
/**
 * Extract the word at a given character position in a line.
 */
// Match a $-prefixed system variable token at the cursor, e.g. $POS_ACT, $ACC_AXIS.
function getSystemVariableAtPosition(lineText, character) {
    const tokenRegex = /\$\w+/g;
    let match;
    while ((match = tokenRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (character >= start && character <= end) {
            return systemVariableMap.get(systemVariableKey(match[0]));
        }
    }
    return undefined;
}
function getWordAtPosition(lineText, character) {
    const identifierRegex = new RegExp(KRL_IDENTIFIER_SOURCE, 'g');
    let match;
    while ((match = identifierRegex.exec(lineText)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (character >= start && character <= end) {
            return {
                word: match[0],
                isSubvariable: start > 0 && lineText[start - 1] === '.'
            };
        }
    }
    return;
}
/**
 * Recursively find .src, .dat, and .sub files in workspace.
 */
function findSrcFiles(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        return getAllKrlFiles(dir);
    });
}
// =====================
// Diagnostics & Validation
// =====================
/**
 * Validate all .dat files in currently opened documents.
 */
function validateAllDatFiles(connection) {
    documents.all().forEach(document => {
        if (document.uri.endsWith('.dat')) {
            validateDocument(document, connection);
        }
    });
}
exports.validateAllDatFiles = validateAllDatFiles;
function isKrlDocument(document) {
    return /\.(src|dat|sub)$/i.test(document.uri);
}
function validateDocument(document, connection) {
    const diagnostics = [];
    if (document.uri.toLowerCase().endsWith('.dat')) {
        diagnostics.push(...validateDatFile(document));
    }
    if (serverValidationConfig.undeclaredIdentifiers) {
        diagnostics.push(...validateUndeclaredIdentifiers(document));
    }
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
}
function validateDatFile(document) {
    const diagnostics = [];
    const lines = document.getText().split(/\r?\n/);
    let insideDefdat = false;
    let insidePublicDefdat = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Detect start of DEFDAT
        const defdatMatch = line.match(/^DEFDAT\s+(\w+)(?:\s+PUBLIC)?/i);
        if (defdatMatch) {
            insideDefdat = true;
            insidePublicDefdat = /PUBLIC/i.test(line);
            continue;
        }
        // Detect end of DEFDAT
        if (/^ENDDAT/i.test(line)) {
            insideDefdat = false;
            insidePublicDefdat = false;
            continue;
        }
        if (insideDefdat) {
            const declMatch = line.match(/^(DECL|SIGNAL|STRUC)\b/i);
            if (!declMatch)
                continue;
            if (insidePublicDefdat) {
                if (serverValidationConfig.defdatPublicGlobalRequired && !/^\s*(?:DECL\s+)?GLOBAL\b/i.test(line)) {
                    const newDiagnostic = {
                        severity: node_1.DiagnosticSeverity.Warning,
                        range: {
                            start: { line: i, character: 0 },
                            end: { line: i, character: line.length }
                        },
                        message: `Declaration is not GLOBAL but DEFDAT is PUBLIC.`,
                        source: 'Kuka-krl-assistant'
                    };
                    if (!isDuplicateDiagnostic(newDiagnostic, diagnostics)) {
                        diagnostics.push(newDiagnostic);
                    }
                }
            }
            else {
                if (serverValidationConfig.defdatNonPublicGlobalForbidden && /^\s*(?:DECL\s+)?GLOBAL\b/i.test(line)) {
                    const newDiagnostic = {
                        severity: node_1.DiagnosticSeverity.Error,
                        range: {
                            start: { line: i, character: 0 },
                            end: { line: i, character: line.length }
                        },
                        message: `Declaration  is GLOBAL but DEFDAT is not PUBLIC.`,
                        source: 'Kuka-krl-assistant'
                    };
                    if (!isDuplicateDiagnostic(newDiagnostic, diagnostics)) {
                        diagnostics.push(newDiagnostic);
                    }
                }
            }
        }
    }
    return diagnostics;
}
function validateUndeclaredIdentifiers(document) {
    const diagnostics = [];
    const lines = document.getText().split(/\r?\n/);
    const declaredNames = getDeclaredNamesForDocument(document);
    const documentRoot = getWorkspaceRootForUri(document.uri);
    const knownFunctionNames = getKnownFunctionNames(document.getText(), documentRoot);
    const knownStructNames = new Set(Object.keys(structDefinitions).map(name => name.toLowerCase()));
    const keywordNames = new Set(CODE_KEYWORDS.map(keyword => keyword.toUpperCase()));
    const identifierRegex = new RegExp(KRL_IDENTIFIER_SOURCE, 'g');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const rawLine = lines[lineIndex];
        const code = stripStrings(stripLineComment(rawLine));
        if (shouldSkipUndeclaredIdentifierLine(code))
            continue;
        let match;
        while ((match = identifierRegex.exec(code)) !== null) {
            const name = match[0];
            const lowerName = name.toLowerCase();
            const upperName = name.toUpperCase();
            const prev = match.index > 0 ? code[match.index - 1] : '';
            const next = match.index + name.length < code.length ? code[match.index + name.length] : '';
            if (name.startsWith('$'))
                continue; // System variable
            if (prev === '$' || prev === '#' || prev === '.' || prev === '&')
                continue;
            if (next === ':')
                continue;
            if (isStructInitializerField(code, match.index, name.length))
                continue;
            if (keywordNames.has(upperName))
                continue;
            if (declaredNames.has(lowerName))
                continue;
            if (knownFunctionNames.has(normalizeFunctionName(name)))
                continue;
            if (knownStructNames.has(lowerName))
                continue;
            const newDiagnostic = {
                severity: node_1.DiagnosticSeverity.Information,
                message: `Identifier "${name}" is not declared in the current KRL workspace index.`,
                range: {
                    start: { line: lineIndex, character: match.index },
                    end: { line: lineIndex, character: match.index + name.length }
                },
                source: 'Kuka-krl-assistant'
            };
            if (!isDuplicateDiagnostic(newDiagnostic, diagnostics)) {
                diagnostics.push(newDiagnostic);
            }
        }
    }
    return diagnostics;
}
function getDeclaredNamesForDocument(document) {
    const declaredNames = new Set();
    const documentRoot = getWorkspaceRootForUri(document.uri);
    for (const name of getWorkspaceDeclaredNames(documentRoot)) {
        declaredNames.add(name);
    }
    const rootVariables = documentRoot ? getMergedVariablesForRoot(documentRoot) : mergedVariables;
    for (const variable of rootVariables) {
        declaredNames.add(variable.name.toLowerCase());
    }
    const collector = new DeclaredVariableCollector();
    collector.extractFromText(document.getText());
    for (const variable of collector.getVariables()) {
        declaredNames.add(variable.name.toLowerCase());
    }
    for (const paramName of getFunctionParameterNames(document.getText())) {
        declaredNames.add(paramName.toLowerCase());
    }
    return declaredNames;
}
function getWorkspaceDeclaredNames(root) {
    const cacheKey = root !== null && root !== void 0 ? root : '';
    const cached = workspaceDeclaredNameCacheByRoot.get(cacheKey);
    if (cached) {
        return cached;
    }
    const declaredNames = new Set();
    if (!root) {
        workspaceDeclaredNameCacheByRoot.set(cacheKey, declaredNames);
        return declaredNames;
    }
    for (const filePath of getAllKrlFiles(root)) {
        for (const name of getParsedKrlFile(filePath).names) {
            declaredNames.add(name);
        }
    }
    workspaceDeclaredNameCacheByRoot.set(cacheKey, declaredNames);
    return declaredNames;
}
function getKnownFunctionNames(documentText, root) {
    const rootFunctions = root ? getFunctionsForRoot(root) : functionsDeclared;
    const names = new Set(rootFunctions.map(fn => normalizeFunctionName(fn.name)));
    const functionRegex = /\b(?:GLOBAL\s+)?(?:DEF|DEFFCT)\s+(?:\w+\s+)?(\w+)\s*\(/gi;
    let match;
    while ((match = functionRegex.exec(documentText)) !== null) {
        names.add(normalizeFunctionName(match[1]));
    }
    return names;
}
function getFunctionParameterNames(documentText) {
    const params = [];
    const functionRegex = /\b(?:GLOBAL\s+)?(?:DEF|DEFFCT)\s+(?:\w+\s+)?\w+\s*\(([^)]*)\)/gi;
    let match;
    while ((match = functionRegex.exec(documentText)) !== null) {
        for (const rawParam of splitVarsRespectingBrackets(match[1])) {
            const paramText = rawParam.split(':')[0].trim();
            if (!paramText)
                continue;
            const identifiers = paramText.match(new RegExp(KRL_IDENTIFIER_SOURCE, 'g'));
            if (!identifiers || identifiers.length === 0)
                continue;
            const name = identifiers[identifiers.length - 1];
            if (!CODE_KEYWORDS.includes(name.toUpperCase())) {
                params.push(name);
            }
        }
    }
    return params;
}
function stripLineComment(line) {
    const commentStart = line.indexOf(';');
    return commentStart >= 0 ? line.slice(0, commentStart) : line;
}
function stripStrings(line) {
    return line
        .replace(/"[^"]*"/g, match => ' '.repeat(match.length))
        .replace(/'[^']*'/g, match => ' '.repeat(match.length));
}
function shouldSkipUndeclaredIdentifierLine(code) {
    return /^\s*&/.test(code) ||
        /^\s*(?:GLOBAL\s+)?(?:DEF|DEFFCT|DEFDAT|END|ENDFCT|ENDDAT|DECL|SIGNAL|STRUC|ENUM)\b/i.test(code) ||
        /^\s*(?:GLOBAL\s+)?(?:CONST\s+)?[A-Za-z_][A-Za-z0-9_]*\s+[A-Za-z_$][A-Za-z0-9_$]*(?:\s*(?:\[|=|,|;|$))/i.test(code) ||
        /^\s*(?:GOTO|HALT|INTERRUPT|ON_ERROR_PROCEED|RESUME|BRAKE|CHANNEL|EXT)\b/i.test(code);
}
function isStructInitializerField(code, start, length) {
    const before = code.slice(0, start);
    const openBraces = (before.match(/{/g) || []).length;
    const closeBraces = (before.match(/}/g) || []).length;
    if (openBraces <= closeBraces)
        return false;
    const beforeNonSpace = before.trimEnd().slice(-1);
    if (beforeNonSpace !== '{' && beforeNonSpace !== ',')
        return false;
    const after = code.slice(start + length);
    return /^\s*(?:\[[^\]]*\])?\s*(?:(?:,|})|[-+]?\d|{|#|"|TRUE\b|FALSE\b|[A-Za-z_][A-Za-z0-9_]*\s*(?:,|}))/i.test(after);
}
/**
 * Check if a diagnostic is duplicate in the list.
 */
function isDuplicateDiagnostic(newDiag, existingDiagnostics) {
    return existingDiagnostics.some(diag => diag.range.start.line === newDiag.range.start.line &&
        diag.range.start.character === newDiag.range.start.character &&
        diag.range.end.line === newDiag.range.end.line &&
        diag.range.end.character === newDiag.range.end.character &&
        diag.message === newDiag.message &&
        diag.severity === newDiag.severity);
}
// =====================
// Struct and Variable Extraction
// =====================
/**
 * Extract struct and enum variable members from .dat file content.
 * Updates global structDefinitions map.
 */
function extractStrucVariables(datContent) {
    const structRegex = /^[ \t]*(?:GLOBAL\s+)?(?:DECL\s+)?(?:GLOBAL\s+)?(STRUC|ENUM)\s+(\w+)\s+(.+)$/gm;
    const knownTypes = ['INT', 'REAL', 'BOOL', 'CHAR', 'STRING', 'FRAME', 'ENUM'];
    const tempStructDefinitions = {};
    let match;
    while ((match = structRegex.exec(datContent)) !== null) {
        const structName = match[2];
        let membersRaw = match[3];
        // Remove inline comments (anything after a semicolon)
        membersRaw = membersRaw.split(';')[0].trim();
        const tokens = membersRaw.split(/[,\s]+/).map(v => v.trim()).filter(Boolean);
        const members = tokens.filter(token => !knownTypes.includes(token.toUpperCase()) &&
            !['ENUM', 'STRUC'].includes(token.toUpperCase()));
        tempStructDefinitions[structName] = members;
    }
    // Filter members to exclude other struct names and known types
    for (const [structName, members] of Object.entries(tempStructDefinitions)) {
        const filtered = members.filter(member => !knownTypes.includes(member.toUpperCase()) &&
            !Object.keys(tempStructDefinitions).includes(member));
        structDefinitions[structName] = filtered;
    }
}
// ========================
// Class: DeclaredVariableCollector
// ========================
/**
 * Helper class to extract declared variables from document text.
 */
class DeclaredVariableCollector {
    constructor() {
        this.variables = new Map(); // name -> type
    }
    /**
     * Extract declared variables from the provided text.
     * Removes STRUC blocks before processing.
     */
    extractFromText(documentText) {
        // Remove STRUC blocks (non-greedy match)
        const textWithoutStrucs = documentText.replace(/STRUC\s+\w+[^]*?ENDSTRUC/gi, '');
        // Match DECL statements with optional GLOBAL before or after
        const declRegex = /^\s*(GLOBAL\s+)?DECL\s+(GLOBAL\s+)?(?:CONST\s+)?(\w+)\s+([^\r\n;]+)/gim;
        let match;
        while ((match = declRegex.exec(textWithoutStrucs)) !== null) {
            const type = match[3];
            const varList = match[4];
            const varNames = declaredNamesOf(varList);
            for (const name of varNames) {
                if (!this.variables.has(name)) {
                    this.variables.set(name, type);
                }
            }
        }
        const globalTypeRegex = /^\s*GLOBAL\s+(?:CONST\s+)?(\w+)\s+([^\r\n;]+)/gim;
        while ((match = globalTypeRegex.exec(textWithoutStrucs)) !== null) {
            const type = match[1];
            // ENUM values are not variables
            if (type.toUpperCase() === 'ENUM' || !CODE_KEYWORDS.includes(type.toUpperCase()))
                continue;
            const varNames = declaredNamesOf(match[2]);
            for (const name of varNames) {
                if (!this.variables.has(name)) {
                    this.variables.set(name, type);
                }
            }
        }
        const signalRegex = new RegExp(`^\\s*(GLOBAL\\s+)?SIGNAL\\s+(${KRL_IDENTIFIER_SOURCE})`, 'gim');
        while ((match = signalRegex.exec(textWithoutStrucs)) !== null) {
            const name = match[2];
            if (!this.variables.has(name)) {
                this.variables.set(name, 'SIGNAL');
            }
        }
        const typedDataRegex = /^\s*(?:GLOBAL\s+)?(?:CONST\s+)?([A-Za-z_][A-Za-z0-9_]*)\s+([^\r\n;]+)/gim;
        while ((match = typedDataRegex.exec(textWithoutStrucs)) !== null) {
            const type = match[1];
            const upperType = type.toUpperCase();
            if (['DEF', 'DEFFCT', 'DEFDAT', 'END', 'ENDFCT', 'ENDDAT', 'IF', 'FOR', 'WHILE', 'SWITCH', 'ENUM', 'STRUC', 'SIGNAL', 'INTERRUPT'].includes(upperType)) {
                continue;
            }
            const varNames = declaredNamesOf(match[2]);
            for (const name of varNames) {
                if (!this.variables.has(name)) {
                    this.variables.set(name, type);
                }
            }
        }
    }
    /**
     * Returns all collected variables as an array.
     */
    getVariables() {
        return Array.from(this.variables.entries()).map(([name, type]) => ({ name, type }));
    }
    /**
     * Clears collected variables.
     */
    clear() {
        this.variables.clear();
    }
}
/**
 * Utility function to split variable declarations respecting brackets.
 * Example: "var1, arr[2,3], var2" splits correctly on commas outside brackets.
 */
const splitVarsRespectingBrackets = (input) => {
    const result = [];
    let current = '';
    let bracketDepth = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (char === '[' || char === '{')
            bracketDepth++;
        if (char === ']' || char === '}')
            bracketDepth--;
        if (char === ',' && bracketDepth === 0) {
            result.push(current.trim());
            current = '';
        }
        else {
            current += char;
        }
    }
    if (current)
        result.push(current.trim());
    return result;
};
// =====================
// Start LSP Server
// =====================
// Without these the process would exit on an unexpected error, and VS Code would
// keep restarting the language server until it gives up.
process.on('unhandledRejection', reason => {
    connection.console.error(`KRL: unhandled rejection: ${reason}`);
});
process.on('uncaughtException', error => {
    connection.console.error(`KRL: uncaught exception: ${error instanceof Error ? error.stack : error}`);
});
connection.listen();
documents.listen(connection);
//# sourceMappingURL=server.js.map