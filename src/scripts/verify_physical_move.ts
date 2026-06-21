#!/usr/bin/env tsx
/**
 * Verify the post-move state matches the pre-move snapshot byte-for-byte.
 *
 * TypeScript twin of `src/scripts/verify_physical_move.py` (ADR-200, Phase 8 /
 * Wave 8b). Mirrors the CLI contract EXACTLY — the `--snapshot`, `--json`
 * flags, exit codes (0 OK / 1 regression / 2 snapshot-missing), the
 * stdout/stderr split, byte-identical human + JSON output.
 *
 * Re-runs `task sync` + `task build-discovery` (caller invokes them ahead of
 * this script), then loads the fresh outputs and compares them against
 * `dist/migration/pre-move-snapshot.json`.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    _build_snapshot,
    _logical_path,
    _SKIP_DIRS,
    _SKIP_NAMES,
    type Snapshot,
} from './snapshot_agent_outputs.js';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/verify_physical_move.ts → parents[2] of the .py file is repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_SNAPSHOT = path.join(ROOT, 'dist', 'migration', 'pre-move-snapshot.json');

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _asObj(v: Json | undefined): Obj | null {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _str(v: Json | undefined): string {
    return typeof v === 'string' ? v : '';
}

/** Mirror Python tuple-comparison sort key on two string keys. */
function _tupleCompare(a: [string, string], b: [string, string]): number {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    if (a[1] < b[1]) return -1;
    if (a[1] > b[1]) return 1;
    return 0;
}

/**
 * Re-apply current snapshot filters to a previously-captured snapshot. Mutates
 * the passed object in place, mirroring `_normalise_loaded_snapshot`.
 */
export function _normalise_loaded_snapshot(snap: Obj): void {
    const trees = _asObj(snap['trees']);
    if (trees) {
        for (const [key, treeRaw] of Object.entries(trees)) {
            const tree = _asObj(treeRaw);
            if (!tree) {
                continue;
            }
            const keep: Obj = {};
            for (const [p, sha] of Object.entries(tree)) {
                const name = p.includes('/') ? (p.split('/').pop() as string) : p;
                if (_SKIP_NAMES.has(name)) {
                    continue;
                }
                if (p.split('/').some((part) => _SKIP_DIRS.has(part))) {
                    continue;
                }
                keep[p] = sha;
            }
            trees[key] = keep;
        }
    }
    const m = _asObj(snap['manifest_path_stripped']);
    if (m) {
        for (const k of ['unassigned', 'documented_unassigned']) {
            const entriesRaw = m[k];
            const entries = Array.isArray(entriesRaw) ? entriesRaw : [];
            const normalised: Json[] = [];
            for (const e of entries) {
                const o = _asObj(e);
                if (!o) {
                    normalised.push(e);
                    continue;
                }
                if ('path' in o) {
                    o['path'] = _logical_path(_str(o['path']));
                }
                const pathStr = _str(o['path']);
                const name = pathStr.includes('/')
                    ? (pathStr.split('/').pop() as string)
                    : pathStr;
                if (_SKIP_NAMES.has(name)) {
                    continue;
                }
                if (pathStr.split('/').some((part) => _SKIP_DIRS.has(part))) {
                    continue;
                }
                normalised.push(o);
            }
            normalised.sort((a, b) => {
                const oa = _asObj(a);
                const ob = _asObj(b);
                return _tupleCompare(
                    [oa ? _str(oa['path']) : '', oa ? _str(oa['category']) : ''],
                    [ob ? _str(ob['path']) : '', ob ? _str(ob['category']) : ''],
                );
            });
            m[k] = normalised;
        }
        const stats = _asObj(m['stats']);
        if (stats) {
            const du = m['documented_unassigned'];
            const un = m['unassigned'];
            stats['documented_unassigned_count'] = Array.isArray(du) ? du.length : 0;
            stats['unassigned_count'] = Array.isArray(un) ? un.length : 0;
        }
        const artsRaw = m['artefacts'];
        const arts = Array.isArray(artsRaw) ? artsRaw : [];
        for (const a of arts) {
            const o = _asObj(a);
            if (o) {
                delete o['path'];
            }
        }
        arts.sort((a, b) => {
            const oa = _asObj(a);
            const ob = _asObj(b);
            return _tupleCompare(
                [oa ? _str(oa['category']) : '', oa ? _str(oa['checksum']) : ''],
                [ob ? _str(ob['category']) : '', ob ? _str(ob['checksum']) : ''],
            );
        });
        m['artefacts'] = arts;
        delete m['checksum'];
        delete m['scanner_version'];
    }
}

export function _diff_tree(
    name: string,
    before: Record<string, string>,
    after: Record<string, string>,
): string[] {
    const issues: string[] = [];
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
    );
    for (const k of keys) {
        const b = Object.prototype.hasOwnProperty.call(before, k) ? before[k] : undefined;
        const a = Object.prototype.hasOwnProperty.call(after, k) ? after[k] : undefined;
        if (b === undefined) {
            issues.push(`  ${name}: added   ${k}`);
        } else if (a === undefined) {
            issues.push(`  ${name}: removed ${k}`);
        } else if (a !== b) {
            issues.push(`  ${name}: changed ${k}  (${b.slice(0, 12)}… → ${a.slice(0, 12)}…)`);
        }
    }
    return issues;
}

export function _diff_manifest(before: Obj | null, after: Obj | null): string[] {
    if (before === null && after === null) {
        return [];
    }
    if (before === null) {
        return ['  manifest: pre-move snapshot missing'];
    }
    if (after === null) {
        return ['  manifest: post-move manifest missing'];
    }
    const beforeStr = _jsonDumpsSorted(before);
    const afterStr = _jsonDumpsSorted(after);
    if (beforeStr === afterStr) {
        return [];
    }
    const issues = ['  manifest: path-stripped content differs'];
    const bArts = _artefactsByName(before);
    const aArts = _artefactsByName(after);
    const onlyB = [...bArts.keys()].filter((n) => !aArts.has(n)).sort(_strCmp);
    const onlyA = [...aArts.keys()].filter((n) => !bArts.has(n)).sort(_strCmp);
    for (const n of onlyB.slice(0, 10)) {
        issues.push(`    artefact removed: ${n}`);
    }
    for (const n of onlyA.slice(0, 10)) {
        issues.push(`    artefact added:   ${n}`);
    }
    const commonChanged: string[] = [];
    const common = [...bArts.keys()].filter((n) => aArts.has(n)).sort(_strCmp);
    for (const n of common) {
        if (_jsonDumpsSorted(bArts.get(n) as Json) !== _jsonDumpsSorted(aArts.get(n) as Json)) {
            commonChanged.push(n);
        }
    }
    for (const n of commonChanged.slice(0, 10)) {
        issues.push(`    artefact changed: ${n}`);
    }
    return issues;
}

function _strCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function _artefactsByName(o: Obj): Map<string, Json> {
    const out = new Map<string, Json>();
    const arts = o['artefacts'];
    if (Array.isArray(arts)) {
        for (const a of arts) {
            const ao = _asObj(a);
            const name = ao && ao['name'] !== undefined ? _str(ao['name']) : '?';
            out.set(name, a);
        }
    }
    return out;
}

// --- json.dumps(sort_keys=True, ensure_ascii=False) replica (compact) -------

function _jsonDumpsSorted(obj: unknown): string {
    const enc = (value: unknown): string => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            return '[' + value.map((v) => enc(v)).join(', ') + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const inner = keys.map((k) => encStr(k) + ': ' + enc(o[k]));
        return '{' + inner.join(', ') + '}';
    };
    const encStr = (s: string): string => {
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
            else out += ch;
        }
        return out + '"';
    };
    return enc(obj);
}

// --- json.dumps(indent=2) replica for --json (ensure_ascii default) ---------

function _jsonDumpsIndent2(obj: unknown): string {
    const pad = '  ';
    const enc = (value: unknown, depth: number): string => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    };
    const encStr = (s: string): string => {
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
    };
    return enc(obj, 0);
}

interface ParsedArgs {
    snapshot: string;
    json: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { snapshot: DEFAULT_SNAPSHOT, json: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--snapshot' || a.startsWith('--snapshot=')) {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                out.snapshot = a.slice(eq + 1);
            } else {
                const next = argv[i + 1];
                if (next === undefined) {
                    process.stderr.write(
                        'verify_physical_move: error: argument --snapshot: expected one argument\n',
                    );
                    process.exit(2);
                }
                out.snapshot = next;
                i += 1;
            }
        } else if (a === '--json') {
            out.json = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: verify_physical_move [-h] [--snapshot SNAPSHOT] [--json]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (!_exists(args.snapshot)) {
        process.stderr.write(`ERROR: snapshot missing: ${args.snapshot}\n`);
        return 2;
    }

    const before = JSON.parse(fs.readFileSync(args.snapshot, 'utf-8')) as Obj;
    const after: Snapshot = _build_snapshot();

    _normalise_loaded_snapshot(before);

    const beforeTrees = _asObj(before['trees']) ?? {};
    const issues: string[] = [];
    for (const key of ['dist/agent-src', '.augment']) {
        const beforeTree = (_asObj(beforeTrees[key]) ?? {}) as Record<string, string>;
        const afterTree = after.trees[key] ?? {};
        issues.push(..._diff_tree(key, beforeTree, afterTree));
    }
    const beforeManifest = _asObj(before['manifest_path_stripped']);
    const afterManifest = after.manifest_path_stripped;
    issues.push(..._diff_manifest(beforeManifest, afterManifest));

    const ok = issues.length === 0;
    if (args.json) {
        process.stdout.write(
            _jsonDumpsIndent2({ ok, issue_count: issues.length, issues }) + '\n',
        );
    } else {
        if (ok) {
            process.stdout.write('verify_physical_move: byte-identity OK\n');
            process.stdout.write(
                `  dist/agent-src/ files: ${Object.keys(after.trees['dist/agent-src'] ?? {}).length}\n`,
            );
            process.stdout.write(
                `  .augment/   files: ${Object.keys(after.trees['.augment'] ?? {}).length}\n`,
            );
            process.stdout.write('  manifest: path-stripped content matches\n');
        } else {
            process.stdout.write(`verify_physical_move: FAIL (${issues.length} issue(s))\n`);
            for (const line of issues.slice(0, 50)) {
                process.stdout.write(`${line}\n`);
            }
            if (issues.length > 50) {
                process.stdout.write(`  … and ${issues.length - 50} more\n`);
            }
        }
    }
    return ok ? 0 : 1;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
