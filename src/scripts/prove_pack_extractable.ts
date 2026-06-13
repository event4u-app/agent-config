#!/usr/bin/env node
/**
 * Prove a pack + its declared dependency closure is self-contained.
 *
 * TypeScript twin of `prove_pack_extractable.py` (Phase 8 / Wave 8g).
 *
 * road-to-6.0.0-D Phase 1 Step 6 — the *extraction proof*. It de-risks the
 * monorepo collapse (Phase 3) by proving that a pack moved into the flat
 * `src/` library can still be lifted back out into a standalone package:
 * every artefact the pack references must live inside the pack's own
 * `requires` closure (plus the always-available foundation packs). A
 * reference that points OUTSIDE the closure is a dangling edge — the slice
 * would not build standalone, so re-split is no longer possible.
 *
 * What "its own tests pass" means for a markdown artefact library: the
 * isolated slice has (1) zero dangling skill/rule references in frontmatter,
 * (2) zero dangling markdown links into the artefact library, and (3) a
 * `pack.yaml` whose `requires` graph stays acyclic within the closure.
 * Those are the structural invariants the per-pack CI gates assert; proving
 * them on the isolated closure is the standalone-build proof.
 *
 * Usage:
 *   node prove_pack_extractable.js <pack-id> [--json]
 *
 * Exit codes: 0 = extractable · 1 = dangling reference(s) · 3 = unknown pack.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import * as agent_src from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);

const ROOT = agent_src.ROOT();
const PACKS_VOCAB = path.join(ROOT, 'src', 'config', 'discovery', 'packs.yml');
// Always-available foundation packs: every pack may reference these without
// declaring them in `requires` (the 6.0.0-D council's resolution of the
// ambiguous "core" in the boundary rule — engineering-base + meta are the
// implicit foundation, alongside the legacy physical `core`).
const FOUNDATION = new Set<string>(['core', 'engineering-base', 'meta']);
const _LINK_RE = /\]\(([^)#?]+\.md)(?:[#?][^)]*)?\)/g;

function _frontmatter(p: string): Record<string, unknown> {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        // Python read_text(errors="replace") never raises on decode; a missing
        // file would raise, but callers only pass existing paths.
        return {};
    }
    if (!text.startsWith('---')) {
        return {};
    }
    const end = text.indexOf('\n---', 4);
    if (end === -1) {
        return {};
    }
    let data: unknown;
    try {
        data = parseYaml(text.slice(4, end), { version: '1.1' });
    } catch {
        return {};
    }
    return data !== null && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
}

/** Map pack id -> direct `requires` set, from the discovery vocab. */
function _pack_requires(): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    const vocab = (parseYaml(fs.readFileSync(PACKS_VOCAB, 'utf-8'), { version: '1.1' }) ??
        []) as unknown;
    const entries = Array.isArray(vocab) ? vocab : [];
    for (const entry of entries) {
        if (
            entry !== null &&
            typeof entry === 'object' &&
            !Array.isArray(entry) &&
            typeof (entry as Record<string, unknown>)['id'] === 'string'
        ) {
            const e = entry as Record<string, unknown>;
            const requires = e['requires'];
            const reqList = Array.isArray(requires) ? (requires as unknown[]) : [];
            graph.set(e['id'] as string, new Set(reqList.map((x) => String(x))));
        }
    }
    return graph;
}

/** Transitive `requires` closure of `pack` (inclusive) + foundation. */
function _closure(pack: string, graph: Map<string, Set<string>>): Set<string> {
    const seen = new Set<string>();
    const stack: string[] = [pack];
    while (stack.length > 0) {
        const p = stack.pop() as string;
        if (seen.has(p)) {
            continue;
        }
        seen.add(p);
        for (const dep of graph.get(p) ?? new Set<string>()) {
            if (!seen.has(dep)) {
                stack.push(dep);
            }
        }
    }
    return new Set<string>([...seen, ...FOUNDATION]);
}

/** Build [slug_to_packs, logicalpath_to_packs] over the flat library. */
function _library_index(): [Map<string, Set<string>>, Map<string, Set<string>>] {
    const slugPacks = new Map<string, Set<string>>();
    const pathPacks = new Map<string, Set<string>>();
    for (const [phys, logical] of agent_src.iter_all_sources()) {
        if (!logical.endsWith('.md')) {
            continue;
        }
        const fm = _frontmatter(phys);
        const rawPacks = fm['packs'];
        const packsList = Array.isArray(rawPacks) ? (rawPacks as unknown[]) : [];
        const packs = new Set<string>(
            packsList.filter((x): x is string => typeof x === 'string'),
        );
        if (packs.size === 0) {
            continue;
        }
        pathPacks.set(logical, packs);
        if (logical.startsWith('skills/') && logical.endsWith('/SKILL.md')) {
            slugPacks.set(logical.split('/')[1] as string, packs);
        } else if (logical.startsWith('rules/')) {
            slugPacks.set(logical.slice('rules/'.length, logical.length - '.md'.length), packs);
        }
    }
    return [slugPacks, pathPacks];
}

export interface ProveResult {
    extractable: boolean;
    hard: string[];
    advisory: string[];
    closure: Set<string>;
}

/**
 * Return {extractable, hard, advisory, closure}.
 *
 * The dependency axis is frontmatter (6.0.0-D council convergence): a HARD
 * edge is a `skills:` / `rules:` include — it must resolve inside the
 * closure or the standalone slice fails to build. A markdown link into
 * another pack is an ADVISORY cross-reference (a "route to" / "see also") —
 * it is reported as a warning but does NOT block extraction, because the
 * skill still functions when the linked alternative is simply not installed.
 */
export function prove(pack: string): ProveResult {
    const graph = _pack_requires();
    if (!graph.has(pack)) {
        return {
            extractable: false,
            hard: [`unknown pack id '${pack}' (not in ${PACKS_VOCAB})`],
            advisory: [],
            closure: new Set<string>(),
        };
    }
    const closure = _closure(pack, graph);
    const [slugPacks, pathPacks] = _library_index();

    const inClosure = (packs: Set<string>): boolean => {
        for (const p of packs) {
            if (closure.has(p)) {
                return true;
            }
        }
        return false;
    };

    const hard: string[] = [];
    const advisory: string[] = [];
    const members: Array<[string, string]> = [];
    for (const [phys, logical] of agent_src.iter_all_sources()) {
        if (logical.endsWith('.md') && (pathPacks.get(logical) ?? new Set<string>()).has(pack)) {
            members.push([logical, phys]);
        }
    }
    for (const [logical, phys] of members) {
        const fm = _frontmatter(phys);
        // (1) HARD: frontmatter skill/rule includes — the build-dependency axis
        const rawSkills = Array.isArray(fm['skills']) ? (fm['skills'] as unknown[]) : [];
        const rawRules = Array.isArray(fm['rules']) ? (fm['rules'] as unknown[]) : [];
        for (const slug of [...rawSkills, ...rawRules]) {
            if (typeof slug !== 'string') {
                continue;
            }
            const target = slugPacks.get(slug);
            if (target === undefined) {
                continue; // command-routing target / non-library slug — not a pack edge
            }
            if (!inClosure(target)) {
                hard.push(
                    `${logical}: include '${slug}' lives in ${_sortedRepr(target)} — outside closure`,
                );
            }
        }
        // (2) ADVISORY: markdown links into the artefact library
        const physText = fs.readFileSync(phys, 'utf-8');
        for (const m of physText.matchAll(_LINK_RE)) {
            const raw = m[1] as string;
            // Python `strip_source_prefix(raw) or _resolve_rel(...)` — falls
            // through on None AND on an empty-string strip result.
            const stripped = agent_src.strip_source_prefix(raw);
            const tgt = stripped ? stripped : _resolve_rel(phys, raw);
            if (tgt === null || !pathPacks.has(tgt)) {
                continue;
            }
            if (!inClosure(pathPacks.get(tgt)!)) {
                advisory.push(
                    `${logical}: advisory link → ${tgt} (${_sortedRepr(pathPacks.get(tgt)!)}) — ` +
                        `not installed when '${pack}' is extracted alone`,
                );
            }
        }
    }
    return { extractable: hard.length === 0, hard, advisory, closure };
}

/** Mirror Python `sorted(set)` -> `repr(list)` formatting: ['a', 'b']. */
function _sortedRepr(items: Set<string>): string {
    const sorted = [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return '[' + sorted.map((s) => `'${s}'`).join(', ') + ']';
}

function _resolve_rel(source: string, raw: string): string | null {
    let rel: string;
    try {
        const resolved = fs.realpathSync(path.resolve(path.dirname(source), raw));
        const relPath = path.relative(ROOT, resolved);
        if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
            return null; // not under ROOT — mirrors relative_to ValueError
        }
        rel = relPath.split(path.sep).join('/');
    } catch {
        return null;
    }
    return agent_src.strip_source_prefix(rel);
}

/**
 * Mirror `json.dumps(obj, indent=2)` (ensure_ascii default True) for the
 * limited value shapes this script emits.
 */
function _pyJsonDumpsIndent2(obj: unknown): string {
    return _dumpValue(obj, 0);
}

function _dumpValue(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return _dumpString(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => padInner + _dumpValue(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const items = entries.map(
        ([k, v]) => padInner + _dumpString(k) + ': ' + _dumpValue(v, depth + 1),
    );
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
}

function _dumpString(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
        else if (code < 0x7f) out += ch;
        else if (code <= 0xffff) out += '\\u' + code.toString(16).padStart(4, '0');
        else {
            const v = code - 0x10000;
            const hi = 0xd800 + (v >> 10);
            const lo = 0xdc00 + (v & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

class ArgError extends Error {}

interface ParsedArgs {
    pack: string;
    json: boolean;
}

function _parseArgs(argv: string[]): ParsedArgs {
    let pack: string | null = null;
    let json = false;
    for (const a of argv) {
        if (a === '--json') {
            json = true;
        } else if (a.startsWith('-') && a !== '-') {
            throw new ArgError(`unrecognized arguments: ${a}`);
        } else if (pack === null) {
            pack = a;
        } else {
            throw new ArgError(`unrecognized arguments: ${a}`);
        }
    }
    if (pack === null) {
        throw new ArgError('the following arguments are required: pack');
    }
    return { pack, json };
}

export function main(argv: string[] | null = null): number {
    let args: ParsedArgs;
    try {
        args = _parseArgs(argv ?? process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgError) {
            process.stderr.write(`prove_pack_extractable: ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    const { extractable: ok, hard, advisory, closure } = prove(args.pack);
    if (closure.size === 0) {
        process.stderr.write(`❌  ${hard[0]}\n`);
        return 3;
    }
    const sortedClosure = [...closure].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (args.json) {
        process.stdout.write(
            _pyJsonDumpsIndent2({
                pack: args.pack,
                extractable: ok,
                closure: sortedClosure,
                hard_dangling: hard,
                advisory,
            }),
        );
        process.stdout.write('\n');
    } else if (ok) {
        process.stdout.write(
            `✅  '${args.pack}' is extractable — closure ${_sortedReprList(sortedClosure)}, ` +
                '0 hard dangling references.\n',
        );
        for (const a of advisory) {
            process.stdout.write(`   ⚠️  ${a}\n`);
        }
    } else {
        for (const d of hard) {
            process.stderr.write(`❌  ${d}\n`);
        }
        process.stderr.write(
            `\n${hard.length} hard dangling reference(s) — '${args.pack}' is NOT ` +
                'standalone-extractable.\n',
        );
    }
    return ok ? 0 : 1;
}

/** repr() of an already-sorted list of strings. */
function _sortedReprList(items: string[]): string {
    return '[' + items.map((s) => `'${s}'`).join(', ') + ']';
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
