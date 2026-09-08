/**
 * WASM tree-sitter loader for the code-graph engine.
 *
 * Pinned pair (ABI-verified 2026-07-23): `web-tree-sitter@0.24.7` +
 * grammar ABI 14. The ABI smoke test lives in
 * `tests/scripts/code_graph.test.ts`.
 *
 * SHIPPED TO CONSUMERS (ADR-259, amended 2026-09-07). `web-tree-sitter` is a
 * runtime `dependency`, and the three loadable grammars are vendored at
 * `src/vendor/grammars/` and listed in `package.json` `files`. So a consumer
 * install resolves both halves with no manual step. `tree-sitter-wasms` stays a
 * devDependency — it is the source the vendored copies are refreshed from, and
 * the fallback below keeps this repo's own dev flow (and any consumer holding
 * the full 36-grammar pack) working unchanged.
 *
 * No network, no node-gyp, and no runtime grammar download — Kill register K1:
 * both lookups below are filesystem reads of already-installed bytes.
 *
 * web-tree-sitter 0.24.x is CJS with a single default export (the Parser
 * class) and the classic `Parser.Language.load()` API; we reach it through
 * `createRequire` so this ESM module stays portable under the repo's tsx
 * runner.
 */
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * Reached only when BOTH grammar sources are missing — the vendored set that
 * ships in the tarball and the devDependency pack. That is a broken or
 * partially-extracted install, not the ordinary consumer state, so the message
 * says how to repair rather than how to opt in.
 *
 * It still carries the exact pin because the pair is ABI-coupled and
 * `check_dependency_floors` reads only version ranges, never this string.
 */
const INSTALL_HINT =
    'the code-graph engine could not find its grammars. They ship with this package at ' +
    '`src/vendor/grammars/`, so this usually means an incomplete install — reinstall the ' +
    'package first. To supply them manually, install the ABI-locked pack:\n' +
    '  npm i web-tree-sitter@0.24.7 tree-sitter-wasms@0.1.13\n' +
    'Both versions are exact on purpose — the pair is ABI-coupled (grammar ABI 14) ' +
    'and must move together.';

/**
 * Directory holding the grammars that ship inside the package.
 *
 * `../../..` from `src/scripts/code_graph/` is the package root — the same
 * walk `_lib/agent_settings.ts` uses from `src/scripts/_lib/`. A wrong answer
 * here is not a failure: `grammarWasmPath` only uses this path when the file is
 * actually present, and otherwise falls through to the devDependency pack,
 * which is exactly today's behaviour.
 */
const VENDORED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor', 'grammars');

let _wasmDir: string | null = null;
/** The devDependency grammar pack — the fallback source, and this repo's own. */
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

/**
 * Absolute path to a grammar, vendored set first.
 *
 * Order is load-bearing: the vendored set is what a consumer actually has, and
 * it is ABI-pinned by the same change that wrote it. The devDependency pack is
 * second so this repo keeps working when `src/vendor/grammars/` has not been
 * refreshed, and so a consumer holding the full 36-grammar pack can reach a
 * grammar the vendored three do not cover.
 */
export function grammarWasmPath(lang: Lang): string {
    const vendored = path.join(VENDORED_DIR, GRAMMAR_WASM[lang]);
    if (fs.existsSync(vendored)) return vendored;
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

/**
 * Load an ARBITRARY grammar file through the production loader and report what
 * it actually is.
 *
 * Exists for `check_pack_size`'s binary-eligibility predicate, and the "through
 * the production loader" part is the whole point: the gate must not re-implement
 * grammar loading, because a second implementation could accept bytes the engine
 * rejects — which is precisely the gap that would let a broken grammar ship
 * while the gate reported it valid. Same `_Parser()` instance, same
 * `Language.load`, same ABI reading as `loadLanguage`.
 *
 * `grammar_id` comes from the module's exported `tree_sitter_<id>` symbol rather
 * than from the `Language` object, because web-tree-sitter 0.24's `Language`
 * exposes `version` and no name. `WebAssembly.Module.exports` is the runtime's
 * own parser, so the id is read rather than guessed.
 *
 * Throws on anything it cannot establish — a caller that wants a verdict rather
 * than an exception should catch. Never silently returns a partial answer.
 */
export async function probeGrammarFile(wasmPath: string): Promise<{ abi: number; grammar_id: string }> {
    const bytes = fs.readFileSync(wasmPath);
    const mod = new WebAssembly.Module(bytes);
    // A grammar module exports `tree_sitter_<id>` plus, usually, a family of
    // `tree_sitter_<id>_external_scanner_*` helpers — measured: 6 such exports
    // on php, 7 on typescript and javascript. The language id is the one
    // WITHOUT the scanner suffix, and filtering for it leaves exactly one.
    const ids = WebAssembly.Module.exports(mod)
        .map((e) => e.name)
        .filter((n) => n.startsWith('tree_sitter_') && !n.includes('_external_scanner_'))
        .map((n) => n.slice('tree_sitter_'.length));
    if (ids.length !== 1) {
        throw new Error(
            `grammar probe: expected exactly one tree_sitter_* export in ${wasmPath}, found ${String(ids.length)}`,
        );
    }
    await _init();
    const language = await _Parser().Language.load(wasmPath);
    return { abi: language.version, grammar_id: ids[0] as string };
}
