/**
 * WASM tree-sitter loader for the code-graph engine.
 *
 * Pinned pair (ABI-verified 2026-07-23): `web-tree-sitter@0.24.7` +
 * `tree-sitter-wasms@0.1.13` → grammar ABI 14. The ABI smoke test lives in
 * `tests/scripts/code_graph.test.ts`; it runs in this repo because the pair is
 * a devDependency. Consumers install neither (see `INSTALL_HINT` below). No
 * network, no node-gyp — grammars load from `node_modules` via the resolved
 * path.
 *
 * web-tree-sitter 0.24.x is CJS with a single default export (the Parser
 * class) and the classic `Parser.Language.load()` API; we reach it through
 * `createRequire` so this ESM module stays portable under the repo's tsx
 * runner.
 */
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { EXPECTED_GRAMMAR_ABI, GRAMMAR_WASM, type Lang } from './types.js';

const require = createRequire(import.meta.url);

// Minimal structural types for the 0.24.x surface we use (the package ships
// its own .d.ts, but the CJS-default shape is simplest to pin locally).
export interface TsNode {
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    namedChildCount: number;
    childCount: number;
    namedChild(i: number): TsNode | null;
    child(i: number): TsNode | null;
    childForFieldName(field: string): TsNode | null;
    hasError: boolean | (() => boolean);
}
export interface TsTree {
    rootNode: TsNode;
    delete(): void;
}
export interface TsLanguage {
    version: number;
}
export interface TsParser {
    setLanguage(l: TsLanguage): void;
    parse(src: string): TsTree;
    delete(): void;
}
interface ParserStatic {
    init(): Promise<void>;
    new (): TsParser;
    Language: { load(wasmPath: string): Promise<TsLanguage> };
}

/**
 * The parser pair is a devDependency, not a runtime one: this repo's tests still
 * exercise the loader, while a consumer install resolves neither. The engine is
 * permanently `enabled: false` (measured recall 0.365 vs grep 0.797), so
 * shipping ~51 MB of WASM to every consumer for a path none of them can reach
 * was pure install cost. A consumer re-enabling the engine installs the
 * ABI-locked pair themselves — this message carries the pin, because
 * `check_dependency_floors` only scans the `dependencies` block.
 */
const INSTALL_HINT =
    'the code-graph engine needs its parser pair, which this package no longer ships to consumers ' +
    '(the engine is disabled by a recorded null result). Install the ABI-locked pair:\n' +
    '  npm i web-tree-sitter@0.24.7 tree-sitter-wasms@0.1.13\n' +
    'Both versions are exact on purpose — the pair is ABI-coupled (grammar ABI 14) ' +
    'and must move together.';

let _wasmDir: string | null = null;
function wasmDir(): string {
    if (_wasmDir === null) {
        let pkgJson: string;
        try {
            pkgJson = require.resolve('tree-sitter-wasms/package.json');
        } catch {
            throw new Error(`tree-sitter-wasms is not installed — ${INSTALL_HINT}`);
        }
        _wasmDir = path.join(path.dirname(pkgJson), 'out');
    }
    return _wasmDir;
}

let _initialized = false;
const _langCache = new Map<Lang, TsLanguage>();
const _parserCache = new Map<Lang, TsParser>();

export function grammarWasmPath(lang: Lang): string {
    return path.join(wasmDir(), GRAMMAR_WASM[lang]);
}

let _mod: ParserStatic | null = null;
function _Parser(): ParserStatic {
    // Require exactly once and cache the class reference — repeated
    // createRequire calls under tsx can hand back a module view whose static
    // `Language` is not yet populated, which breaks the second grammar load.
    if (_mod === null) {
        try {
            _mod = require('web-tree-sitter') as ParserStatic;
        } catch {
            throw new Error(`web-tree-sitter is not installed — ${INSTALL_HINT}`);
        }
    }
    return _mod;
}

async function _init(): Promise<void> {
    if (!_initialized) {
        await _Parser().init();
        _initialized = true;
    }
}

/** Load (and cache) a grammar; asserts the ABI matches the pinned expectation. */
export async function loadLanguage(lang: Lang): Promise<TsLanguage> {
    const cached = _langCache.get(lang);
    if (cached) return cached;
    await _init();
    const language = await _Parser().Language.load(grammarWasmPath(lang));
    if (language.version !== EXPECTED_GRAMMAR_ABI) {
        throw new Error(
            `code-graph: grammar ABI drift for ${lang} — got ${language.version}, ` +
                `pinned ${EXPECTED_GRAMMAR_ABI}. Re-pin web-tree-sitter/tree-sitter-wasms ` +
                `and re-run the ABI smoke test.`,
        );
    }
    _langCache.set(lang, language);
    return language;
}

/**
 * A parser bound to `lang`, cached per language for the process lifetime.
 * Callers MUST NOT `.delete()` it — emscripten's runtime is torn down on
 * parser deletion, breaking every subsequent `new Parser()`. Delete only the
 * per-parse `tree` (extract.ts does), so the emscripten heap does not balloon.
 */
export async function getParser(lang: Lang): Promise<TsParser> {
    const cached = _parserCache.get(lang);
    if (cached) return cached;
    await _init();
    const language = await loadLanguage(lang);
    const parser = new (_Parser())();
    parser.setLanguage(language);
    _parserCache.set(lang, parser);
    return parser;
}

/** Normalise the 0.24.x `hasError` (property) vs newer (method). */
export function nodeHasError(n: TsNode): boolean {
    return typeof n.hasError === 'function' ? n.hasError() : n.hasError;
}
