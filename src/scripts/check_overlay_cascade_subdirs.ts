#!/usr/bin/env tsx
/**
 * Guard: `CASCADE_ELIGIBLE_KINDS` / `USER_GLOBAL_OVERLAY_KINDS` ↔ docs.
 *
 * TypeScript twin of `src/scripts/check_overlay_cascade_subdirs.py` (ADR-088,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — no flags, exit
 * codes (0 clean, 1 drift, 3 internal error), stdout/stderr split,
 * byte-identical finding messages, and the same `docs/customization.md` table
 * parse. The `_lib/agents_overlay` twin supplies the two constant sets. No
 * behaviour changes — latent bugs replicated.
 *
 * Phase 1 of road-to-portable-runtime-and-update-check (P1.6). The
 * overlay resolver in `scripts/_lib/agents_overlay` ships two
 * constants that gate which `agents/<kind>/` subdirs participate in
 * the cascade and which of those may live at the user-global layer.
 * The same lists are restated in
 * `docs/customization.md` § "agents/ overlay cascade" so consumers
 * can see them without reading source.
 *
 * Drift between code and docs is the failure mode this guard catches.
 *
 * Exit codes: 0 = clean, 1 = drift detected, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    CASCADE_ELIGIBLE_KINDS,
    USER_GLOBAL_OVERLAY_KINDS,
} from './_lib/agents_overlay.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/check_overlay_cascade_subdirs.ts → two dirs up is the repo root.
// Mirrors the Python `Path(__file__).resolve().parent.parent.parent`.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DOCS_PATH = path.join(REPO_ROOT, 'docs', 'customization.md');

// Match `agents/<...>/<kind>/` in the first column of the overlay table, plus
// the ✅/❌ markers in columns 2 and 3. Captures only the **final** path
// segment as the kind. Mirrors the Python ROW_RE exactly.
const ROW_RE = new RegExp(
    '^\\|\\s*`agents/(?:[a-z][a-z0-9_-]*/)*([a-z][a-z0-9_-]*)/`\\s*\\|' +
        '\\s*(✅|❌)[^|]*\\|\\s*(✅|❌)[^|]*\\|',
);

function _parse_doc_table(text: string): {
    all_kinds: Set<string>;
    cascade_yes: Set<string>;
    user_global_yes: Set<string>;
} {
    const all_kinds = new Set<string>();
    const cascade_yes = new Set<string>();
    const user_global_yes = new Set<string>();
    for (const line of text.split('\n')) {
        const m = ROW_RE.exec(line);
        if (!m) {
            continue;
        }
        const kind = m[1] as string;
        const cascade_mark = m[2] as string;
        const user_mark = m[3] as string;
        all_kinds.add(kind);
        if (cascade_mark === '✅') {
            cascade_yes.add(kind);
        }
        if (user_mark === '✅') {
            user_global_yes.add(kind);
        }
    }
    return { all_kinds, cascade_yes, user_global_yes };
}

function _sortedDiff(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
    return [...a].filter((x) => !b.has(x)).sort();
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Python repr of a sorted str list, e.g. ['a', 'b'] → "['a', 'b']". */
function _pyList(items: readonly string[]): string {
    return '[' + items.map((s) => `'${s}'`).join(', ') + ']';
}

export function main(): number {
    if (!_isFile(DOCS_PATH)) {
        process.stderr.write(`❌  ${DOCS_PATH} not found\n`);
        return 3;
    }
    const text = fs.readFileSync(DOCS_PATH, 'utf-8');
    const parsed = _parse_doc_table(text);
    const doc_cascade = parsed.cascade_yes;
    const doc_user_global = parsed.user_global_yes;

    const errors: string[] = [];

    const code_cascade = new Set(CASCADE_ELIGIBLE_KINDS);
    if (!_setEq(doc_cascade, code_cascade)) {
        const only_code = _sortedDiff(code_cascade, doc_cascade);
        const only_doc = _sortedDiff(doc_cascade, code_cascade);
        if (only_code.length) {
            errors.push(
                'CASCADE_ELIGIBLE_KINDS has entries missing from ' +
                    `docs/customization.md table: ${_pyList(only_code)}`,
            );
        }
        if (only_doc.length) {
            errors.push(
                'docs/customization.md table marks these as cascade-eligible ' +
                    `but the code list does not: ${_pyList(only_doc)}`,
            );
        }
    }

    const code_user_global = new Set(USER_GLOBAL_OVERLAY_KINDS);
    if (!_setEq(doc_user_global, code_user_global)) {
        const only_code = _sortedDiff(code_user_global, doc_user_global);
        const only_doc = _sortedDiff(doc_user_global, code_user_global);
        if (only_code.length) {
            errors.push(
                'USER_GLOBAL_OVERLAY_KINDS has entries missing from ' +
                    `docs/customization.md table: ${_pyList(only_code)}`,
            );
        }
        if (only_doc.length) {
            errors.push(
                'docs/customization.md table marks these as user-global-eligible ' +
                    `but the code list does not: ${_pyList(only_doc)}`,
            );
        }
    }

    // Sanity: user-global subset of cascade-eligible.
    if (![...code_user_global].every((k) => code_cascade.has(k))) {
        const surplus = _sortedDiff(code_user_global, code_cascade);
        errors.push(
            'USER_GLOBAL_OVERLAY_KINDS must be a subset of ' +
                `CASCADE_ELIGIBLE_KINDS; surplus: ${_pyList(surplus)}`,
        );
    }

    if (errors.length) {
        process.stderr.write('❌  agents/ overlay cascade drift detected:\n');
        for (const err of errors) {
            process.stderr.write(`   - ${err}\n`);
        }
        process.stderr.write(
            '\nFix: update either scripts/_lib/agents_overlay.py ' +
                'or docs/customization.md so they agree.\n',
        );
        return 1;
    }

    process.stdout.write(
        `✅  agents/ overlay cascade in sync · ` +
            `${code_cascade.size} cascade-eligible, ` +
            `${code_user_global.size} user-global-eligible\n`,
    );
    return 0;
}

function _setEq(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
    if (a.size !== b.size) {
        return false;
    }
    for (const x of a) {
        if (!b.has(x)) {
            return false;
        }
    }
    return true;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { REPO_ROOT, DOCS_PATH, ROW_RE, _parse_doc_table };
