// Pack loader (6.0.0-B Phase 3) — deterministic build/install-time resolver.
//
// Given a selected pack set, resolves:
//
//   1. the full ACTIVE PACK set — seed the `always_on` packs + the selected
//      packs, then expand the `requires` closure (capability-packs.md;
//      `suggests` is advisory and is NOT expanded);
//   2. the ACTIVE ARTEFACT set — commands by their canonical `pack` OWNER,
//      skills by `packs` membership. Rules are excluded: they stay
//      router-driven (ADR-040). `legacy_all=True` returns the full set —
//      the 6.0.0 default, byte-for-byte the pre-6.0.0 projection.
//
// This is the resolver ADR-040 scopes as build/install-time — NOT a runtime
// daemon. The projector (`scripts/condense.py`) and `agent-config use`
// (`scripts/profile_use.py`) consult it; it never runs per host-tool request.
//
// CLI (debugging):
//   tsx src/scripts/config/packs.ts --packs laravel,finance-basic
//   tsx src/scripts/config/packs.ts --legacy-all
//
// Twin of `src/scripts/config/packs.py`.
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Reuse the vocab / closure / manifest loaders — single source of truth.
import {
    expand_closure,
    load_manifest as load_manifest_default,
    load_packs_vocab as load_packs_vocab_default,
} from './session_profiles.js';

// `any` mirrors Python's `dict[str, Any]` heterogeneous vocab / manifest.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Dict = Record<string, Any>;

// `REPO_ROOT = Path(__file__).resolve().parents[3]` — config → scripts → src
// → repo root.
export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

const _PROJECTED_CATEGORIES: readonly string[] = ['command', 'skill']; // rules stay router-driven

// Re-export the loaders so callers and tests reach them via this module,
// mirroring `scripts.config.packs.load_packs_vocab` in Python.
export { expand_closure } from './session_profiles.js';
export const load_packs_vocab = load_packs_vocab_default;
export const load_manifest = load_manifest_default;

// Test seam — mirrors `monkeypatch.setattr(packs, "load_packs_vocab", …)` and
// `monkeypatch.setattr(packs, "load_manifest", …)`. `resolve_active_set`
// dispatches through `_cfg`, so a test override is honoured exactly like the
// pytest monkeypatch.
const _cfg = {
    load_packs_vocab: load_packs_vocab_default as (repo_root: string) => Record<string, Dict>,
    load_manifest: load_manifest_default as (repo_root: string) => Dict[],
};

export function _setConfigForTest(overrides: Partial<typeof _cfg>): void {
    Object.assign(_cfg, overrides);
}

/** Resolved active pack + artefact set for one projection. */
export class ActiveSet {
    readonly packs: string[];
    readonly commands: string[];
    readonly skills: string[];
    readonly legacy_all: boolean;

    constructor(params: {
        packs: string[];
        commands: string[];
        skills: string[];
        legacy_all?: boolean;
    }) {
        this.packs = params.packs;
        this.commands = params.commands;
        this.skills = params.skills;
        this.legacy_all = params.legacy_all ?? false;
    }

    to_dict(): Dict {
        return {
            legacy_all: this.legacy_all,
            packs: this.packs,
            commands: this.commands,
            skills: this.skills,
            counts: {
                packs: this.packs.length,
                commands: this.commands.length,
                skills: this.skills.length,
            },
        };
    }
}

/** Default packs the resolver seeds into every scoped projection. */
export function always_on_packs(vocab: Record<string, Dict>): Set<string> {
    const out = new Set<string>();
    for (const pid of Object.keys(vocab)) {
        const p = vocab[pid] ?? {};
        if (p && p['always_on']) {
            out.add(pid);
        }
    }
    return out;
}

/**
 * Full active pack set: always-on ∪ selected, expanded over `requires`.
 *
 * `legacy_all` short-circuits to the entire declared vocabulary. `suggests`
 * edges are advisory and intentionally not expanded.
 */
export function resolve_active_packs(
    vocab: Record<string, Dict>,
    selected: Iterable<string> | null,
    options: { legacy_all?: boolean } = {},
): string[] {
    if (options.legacy_all) {
        return _sorted(Object.keys(vocab));
    }
    const seeds = new Set<string>([...(selected ?? []), ...always_on_packs(vocab)]);
    // Drop unknown ids defensively — a typo'd pack must not crash projection.
    const known = new Set(Object.keys(vocab));
    for (const s of [...seeds]) {
        if (!known.has(s)) {
            seeds.delete(s);
        }
    }
    return expand_closure(seeds, vocab);
}

/**
 * Resolve the active pack + artefact set for a projection.
 *
 * Command membership is OWNER-based (`pack`); skill membership is
 * discovery-based (`packs` ∩ active). Rules are never returned.
 */
export function resolve_active_set(
    repo_root: string,
    selected: Iterable<string> | null = null,
    options: { legacy_all?: boolean } = {},
): ActiveSet {
    const legacy_all = options.legacy_all ?? false;
    const vocab = _cfg.load_packs_vocab(repo_root);
    const active = new Set(resolve_active_packs(vocab, selected, { legacy_all }));
    const commands: string[] = [];
    const skills: string[] = [];
    for (const art of _cfg.load_manifest(repo_root)) {
        const cat = art['category'];
        if (!_PROJECTED_CATEGORIES.includes(cat)) {
            continue;
        }
        const p = art['path'];
        if (!p) {
            continue;
        }
        if (legacy_all) {
            (cat === 'command' ? commands : skills).push(p);
            continue;
        }
        if (cat === 'command') {
            if (active.has(art['pack'])) {
                commands.push(p);
            }
        } else {
            // skill
            const artPacks = Array.isArray(art['packs']) ? art['packs'] : [];
            if (artPacks.some((x: Any) => active.has(x))) {
                skills.push(p);
            }
        }
    }
    return new ActiveSet({
        packs: _sorted([...active]),
        commands: _sorted(commands),
        skills: _sorted(skills),
        legacy_all,
    });
}

// --- CLI -------------------------------------------------------------------

interface ParsedArgs {
    packs: string;
    legacy_all: boolean;
    json: boolean;
}

function _parse_args(argv: string[]): ParsedArgs {
    const parsed: ParsedArgs = { packs: '', legacy_all: false, json: false };
    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '--packs') {
            parsed.packs = argv[i + 1] ?? '';
            i += 2;
            continue;
        }
        if (tok.startsWith('--packs=')) {
            parsed.packs = tok.slice('--packs='.length);
            i += 1;
            continue;
        }
        if (tok === '--legacy-all') {
            parsed.legacy_all = true;
            i += 1;
            continue;
        }
        if (tok === '--json') {
            parsed.json = true;
            i += 1;
            continue;
        }
        i += 1;
    }
    return parsed;
}

export function main(argv: string[] | null = null): number {
    const args = _parse_args(argv ?? process.argv.slice(2));
    const selected = args.packs
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    const result = resolve_active_set(REPO_ROOT, selected, { legacy_all: args.legacy_all });
    if (args.json) {
        process.stdout.write(_jsonDumps(result.to_dict(), 2) + '\n');
    } else {
        const mode = result.legacy_all
            ? 'legacy-all'
            : `scoped(${selected.join(',') || 'always-on only'})`;
        process.stdout.write(`Active set [${mode}]:\n`);
        process.stdout.write(
            `  packs (${result.packs.length}): ${result.packs.join(', ')}\n`,
        );
        process.stdout.write(`  commands: ${result.commands.length}\n`);
        process.stdout.write(`  skills:   ${result.skills.length}\n`);
    }
    return 0;
}

// --- parity primitives -----------------------------------------------------

/** Python `sorted()` — code-point comparison for strings. */
function _sorted(items: string[]): string[] {
    return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** json.dumps(obj, indent=indent) — sort_keys False, ensure_ascii True. */
function _jsonDumps(obj: Any, indent: number): string {
    const pad = ' '.repeat(indent);

    function enc(value: Any, depth: number): string {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return _encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Dict;
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + _encStr(k) + ': ' + enc(o[k], depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }

    return enc(obj, 0);
}

function _encStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const cp = ch.codePointAt(0) as number;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
        else if (cp < 0x7f) out += ch;
        else if (cp > 0xffff) {
            const v = cp - 0x10000;
            const hi = 0xd800 + (v >> 10);
            const lo = 0xdc00 + (v & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        } else {
            out += '\\u' + cp.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

// --- entrypoint ------------------------------------------------------------

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
