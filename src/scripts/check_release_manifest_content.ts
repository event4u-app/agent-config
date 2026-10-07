#!/usr/bin/env tsx
/**
 * Release-manifest content check — the content half beside
 * `check_release_pr_shape`.
 *
 * The shape check lets a release PR carry `package.json`, `package-lock.json`
 * and the three plugin manifests, and it reads only their NAMES. Smoke is
 * skipped on release heads (`docs/contracts/release-pr-gating.md`), so an added
 * script, a new dependency or a changed `bin` path could ride a release PR with
 * no gate reading it. This compares each manifest against the base and fails on
 * any difference outside the version fields the release writes.
 *
 * Version fields are named per file, never matched by key name anywhere: in
 * `package-lock.json` every dependency also has a `version`, and a key-name
 * rule would wave a dependency bump through as a version bump.
 *
 * Usage: check_release_manifest_content [--base REF] [--root DIR]
 *   --base REF   ref the head is compared against (default: origin/main)
 *   --root DIR   repository root to read the head and run git in (testing)
 *
 * Exit codes: 0 = only version fields differ · 1 = other difference · 2 = usage/env.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

type Segment = string;
/** A JSON path pattern; `*` matches any array index. */
type Pattern = readonly Segment[];

/** The manifests a release PR may carry, and the fields the release writes in each. */
export const VERSION_FIELDS: Readonly<Record<string, readonly Pattern[]>> = {
    'package.json': [['version']],
    'package-lock.json': [['version'], ['packages', '', 'version']],
    '.claude-plugin/marketplace.json': [['version'], ['metadata', 'version'], ['plugins', '*', 'version']],
    '.augment-plugin/plugin.json': [['version']],
    '.augment-plugin/marketplace.json': [['version'], ['metadata', 'version'], ['plugins', '*', 'version']],
};

function _matches(p: readonly Segment[], pat: Pattern): boolean {
    if (p.length !== pat.length) return false;
    return pat.every((seg, i) => seg === p[i] || (seg === '*' && /^\d+$/u.test(p[i] ?? '')));
}

function _render(p: readonly Segment[]): string {
    return p.length === 0 ? '(root)' : p.map((s) => (/^\d+$/u.test(s) ? `[${s}]` : JSON.stringify(s))).join('.');
}

function _isObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Every JSON path at which `a` and `b` differ, leaf-first where both are containers. */
function _diffPaths(a: unknown, b: unknown, at: Segment[] = []): Segment[][] {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return [at];
        return a.flatMap((v, i) => _diffPaths(v, b[i], [...at, String(i)]));
    }
    if (_isObject(a) && _isObject(b)) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        const out: Segment[][] = [];
        for (const k of keys) {
            if (!(k in a) || !(k in b)) {
                out.push([...at, k]);
                continue;
            }
            out.push(..._diffPaths(a[k], b[k], [...at, k]));
        }
        return out;
    }
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [at];
}

/**
 * The differences between `base` and `head` text of one manifest that are NOT a
 * version-string change in a declared version field. Empty means in shape.
 */
export function manifestDifferences(file: string, base: string | null, head: string | null): string[] {
    if (base === null && head === null) return [];
    if (base === null) return [`${file}: added — absent at the base`];
    if (head === null) return [`${file}: removed — present at the base`];
    let a: unknown;
    let b: unknown;
    try {
        a = JSON.parse(base);
        b = JSON.parse(head);
    } catch (err) {
        return [`${file}: not parseable JSON (${(err as Error).message})`];
    }
    const allowed = VERSION_FIELDS[file] ?? [];
    const out: string[] = [];
    for (const p of _diffPaths(a, b)) {
        const atVersion = allowed.some((pat) => _matches(p, pat));
        let before: unknown = a;
        let after: unknown = b;
        for (const s of p) {
            before = (before as Record<string, unknown> | undefined)?.[s];
            after = (after as Record<string, unknown> | undefined)?.[s];
        }
        if (atVersion && typeof before === 'string' && typeof after === 'string') continue;
        out.push(`${file}: ${_render(p)} differs outside the version fields`);
    }
    return out;
}

function _git(args: readonly string[], cwd: string): { status: number; stdout: string } {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    return { status: r.status ?? 1, stdout: r.stdout ?? '' };
}

function _readHead(root: string, file: string): string | null {
    const abs = path.join(root, file);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let base = 'origin/main';
    let root = REPO_ROOT;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--base' || a === '--root') {
            const v = argv[i + 1];
            if (v === undefined || v === '') {
                process.stderr.write(`error: ${a} needs a value\n`);
                return 2;
            }
            if (a === '--base') base = v;
            else root = path.resolve(v);
            i += 1;
            continue;
        }
        process.stderr.write(`error: unknown argument ${String(a)}\n`);
        return 2;
    }
    if (_git(['rev-parse', '--verify', `${base}^{commit}`], root).status !== 0) {
        process.stderr.write(`error: base \`${base}\` does not resolve to a commit in ${root}\n`);
        return 2;
    }

    const findings: string[] = [];
    let scanned = 0;
    for (const file of Object.keys(VERSION_FIELDS)) {
        const shown = _git(['show', `${base}:${file}`], root);
        const before = shown.status === 0 ? shown.stdout : null;
        const after = _readHead(root, file);
        if (before !== null || after !== null) scanned += 1;
        findings.push(...manifestDifferences(file, before, after));
    }
    try {
        reportScanned({ gate: 'check_release_manifest_content', scanned, units: 'manifests', roots: [root] });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`${err.message}\n`);
            return 2;
        }
        throw err;
    }
    if (findings.length > 0) {
        process.stdout.write(
            `❌  release manifests differ from ${base} outside their version fields:\n` +
                findings.map((f) => `  · ${f}`).join('\n') +
                '\n  A release PR carries version bumps only. Land the other change on main via its own PR.\n',
        );
        return 1;
    }
    process.stdout.write(`✅  release manifests differ from ${base} in version fields only (${String(scanned)} read)\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
