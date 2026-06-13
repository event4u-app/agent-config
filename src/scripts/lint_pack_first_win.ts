#!/usr/bin/env tsx
/**
 * Pack first-win linter.
 *
 * TypeScript twin of `src/scripts/lint_pack_first_win.py` (ADR-094,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `main()`
 * IGNORES argv entirely (any flag, including the `--quiet` the Taskfile
 * passes, is silently accepted), exit codes (0 clean, 1 violations),
 * stdout/stderr split, byte-identical finding messages.
 *
 * Every featured pack MUST ship `FIRST_WIN.md` (> 0 bytes) and a
 * `pack.yaml` with an `onboarding:` block carrying the three required
 * keys. Pack home resolution mirrors the 6.0.x (ADR-052) precedence:
 * `src/packs/<id>/` → `src/domains/<id>/` → `packages/pack-<id>/`.
 *
 * No behaviour changes — Python list `repr()` of the missing-keys list
 * is replicated byte-for-byte.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/lint_pack_first_win.ts → parents[2] is the repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const PACKAGES = path.join(REPO_ROOT, 'packages');
const SRC_PACKS = path.join(REPO_ROOT, 'src', 'packs');
const SRC_DOMAINS = path.join(REPO_ROOT, 'src', 'domains');

const FEATURED_PACK_IDS: ReadonlySet<string> = new Set([
    'founder-strategy',
    'finance-basic',
    'gtm-sales',
    'ops-people',
    'ai-video',
]);

const REQUIRED_ONBOARDING_KEYS = [
    'first_win_doc',
    'example_workflow',
    'time_to_first_value_minutes',
] as const;

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Mirror Python `repr()` for a single string. */
function _pyReprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const code = ch.codePointAt(0)!;
        if (ch === '\\') {
            out += '\\\\';
        } else if (ch === quote) {
            out += '\\' + quote;
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (code < 0x20 || code === 0x7f) {
            out += '\\x' + code.toString(16).padStart(2, '0');
        } else {
            out += ch;
        }
    }
    out += quote;
    return out;
}

/** Mirror Python `repr()` for a list of strings. */
function _pyReprStrList(items: readonly string[]): string {
    return '[' + items.map(_pyReprStr).join(', ') + ']';
}

/** POSIX relative path of `target` under `root` (str(Path.relative_to)). */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _pack_home(pid: string): string | null {
    for (const cand of [
        path.join(SRC_PACKS, pid),
        path.join(SRC_DOMAINS, pid),
        path.join(PACKAGES, `pack-${pid}`),
    ]) {
        if (_isDir(cand)) {
            return cand;
        }
    }
    return null;
}

function _has_onboarding_block(packYaml: string): [boolean, string[]] {
    if (!_isFile(packYaml)) {
        return [false, [...REQUIRED_ONBOARDING_KEYS]];
    }
    const lines = fs.readFileSync(packYaml, 'utf-8').split('\n');
    let inBlock = false;
    const found = new Set<string>();
    for (const raw of lines) {
        if (raw.startsWith('onboarding:')) {
            inBlock = true;
            continue;
        }
        if (inBlock) {
            if (raw && !(raw.startsWith(' ') || raw.startsWith('\t'))) {
                break;
            }
            const stripped = raw.trim();
            for (const key of REQUIRED_ONBOARDING_KEYS) {
                if (stripped.startsWith(`${key}:`)) {
                    found.add(key);
                }
            }
        }
    }
    if (!inBlock) {
        return [false, [...REQUIRED_ONBOARDING_KEYS]];
    }
    const missing = REQUIRED_ONBOARDING_KEYS.filter((k) => !found.has(k));
    return [missing.length === 0, missing];
}

function main(): number {
    const errors: string[] = [];
    for (const pid of [...FEATURED_PACK_IDS].sort()) {
        const packDir = _pack_home(pid);
        if (packDir === null) {
            errors.push(
                `missing pack home: neither packages/pack-${pid}/ nor ` +
                    `src/domains/${pid}/ exists`,
            );
            continue;
        }
        const firstWin = path.join(packDir, 'FIRST_WIN.md');
        let firstWinOk = false;
        try {
            firstWinOk = fs.statSync(firstWin).size > 0;
        } catch {
            firstWinOk = false;
        }
        if (!firstWinOk) {
            errors.push(`missing or empty: ${_relTo(firstWin, REPO_ROOT)}`);
        }
        const [ok, missing] = _has_onboarding_block(path.join(packDir, 'pack.yaml'));
        if (!ok) {
            errors.push(
                `${path.basename(packDir)}/pack.yaml: onboarding block missing ` +
                    `key(s) ${_pyReprStrList(missing)}`,
            );
        }
    }
    if (errors.length > 0) {
        process.stderr.write('❌ pack first-win lint failed:\n');
        for (const e of errors) {
            process.stderr.write(`  - ${e}\n`);
        }
        process.stderr.write(
            '  fix: add FIRST_WIN.md to the pack root and the onboarding ' +
                'block to src/config/discovery/packs.yml, then re-run ' +
                '`task generate-pack-manifests`\n',
        );
        return 1;
    }
    process.stdout.write(
        `✅ pack first-win lint OK — ${FEATURED_PACK_IDS.size} featured packs\n`,
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    FEATURED_PACK_IDS,
    REQUIRED_ONBOARDING_KEYS,
    main,
};
