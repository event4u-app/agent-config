#!/usr/bin/env tsx
/**
 * Provenance ledger linter (road-to-provenance-and-license-governance S1.3).
 *
 * `provenance/borrows.jsonl` is the machine record of every conscious
 * external-code borrow this repo has taken (per the `code-provenance` rule,
 * S1.1). This linter checks OUR OWN RECORDS, not fuzzy similarity — it is
 * strict from day one, no warn-only phase, because a malformed or
 * policy-violating ledger entry is a defect in the record itself, not a
 * probabilistic detector call. It also keeps `docs/THIRD-PARTY-NOTICES.md`
 * (the human-facing notices file) in sync with the jsonl — that file is
 * GENERATED and must never be hand-edited.
 *
 * Checks per record:
 *   1. Schema — the closed 7-field shape (source_url, license, source_sha,
 *      borrowed_at, files, transformation_note, cleared_by); every field
 *      format-checked (URL/SPDX-or-unknown/hex/ISO-date/existing-repo-paths/
 *      enum).
 *   2. License policy — a deny-class license fails, and license `"unknown"`
 *      fails (roadmap Design principle #1: unknown escalates, never
 *      down-guessed — an unresolved license must never land in the ledger).
 *   3. Transformation note — missing, too short, or rename-only phrasing
 *      fails (roadmap Design principle #6: rename-only is not
 *      transformation; clearing requires structural re-derivation or an
 *      attributed ledger entry).
 *   4. Notices sync — `docs/THIRD-PARTY-NOTICES.md` must equal the
 *      deterministic render of the ledger, or `--regenerate-notices` must be
 *      run.
 *
 * License-class derivation. S1.2 (`detect_target_license.ts` + its `_lib`
 * module + `license-policy.yaml`) is being authored concurrently and is not
 * wired here — this linter never imports from that surface. Instead:
 *   - if `license-policy.yaml` exists at the repo root and has a usable
 *     top-level `deny: [<SPDX id>, ...]` array, that array is the deny set;
 *   - otherwise this linter uses a documented, deterministic built-in
 *     fallback: the GPL/AGPL/SSPL family (the conservative deny set for a
 *     permissive target, per the roadmap's compatibility matrix) plus the
 *     literal `unknown`. This is an intentional, self-contained default —
 *     not a stand-in for the real S1.2 derivation — so the gate has teeth
 *     before that surface lands, and degrades to it gracefully once it does.
 *
 * Usage:
 *     ./scripts-run src/scripts/lint_provenance
 *     ./scripts-run src/scripts/lint_provenance --regenerate-notices
 *     ./scripts-run src/scripts/lint_provenance --quiet
 *
 * Exit codes: 0 = clean · 2 = any schema/policy/sync finding OR usage error
 * (mirrors check_claims.ts — a ledger linter's finding and its usage error
 * are both "this run produced nothing trustworthy").
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _FILE = fileURLToPath(import.meta.url);
const _HERE = path.dirname(_FILE);
// src/scripts/lint_provenance.ts → two levels up is the repo root.
const REPO = path.resolve(_HERE, '..', '..');
const LEDGER_REL = 'provenance/borrows.jsonl';
const NOTICES_REL = 'docs/THIRD-PARTY-NOTICES.md';

// ─── SPDX id catalog ─────────────────────────────────────────────────────────

const PERMISSIVE_SPDX_IDS = [
    'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'BSD-3-Clause-Clear',
    'ISC', '0BSD', 'CC0-1.0', 'Unlicense', 'WTFPL', 'Zlib', 'BSL-1.0',
    'PostgreSQL', 'Python-2.0',
];
const WEAK_COPYLEFT_SPDX_IDS = [
    'MPL-1.1', 'MPL-2.0',
    'LGPL-2.0-only', 'LGPL-2.0-or-later',
    'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-2.1',
    'LGPL-3.0-only', 'LGPL-3.0-or-later', 'LGPL-3.0',
    'EPL-1.0', 'EPL-2.0', 'CDDL-1.0', 'CDDL-1.1',
];
// The conservative fallback deny set (GPL/AGPL/SSPL family) — see the header
// comment. Also part of the known-SPDX-id catalog, so a real GPL/AGPL/SSPL
// license still passes the *format* check and fails the *policy* check with
// a specific message, rather than being rejected as an unrecognized id.
const STRONG_COPYLEFT_SPDX_IDS = [
    'GPL-1.0-only', 'GPL-1.0-or-later',
    'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-2.0',
    'GPL-3.0-only', 'GPL-3.0-or-later', 'GPL-3.0',
    'AGPL-1.0-only', 'AGPL-1.0-or-later',
    'AGPL-3.0-only', 'AGPL-3.0-or-later', 'AGPL-3.0',
    'SSPL-1.0',
];

export const KNOWN_SPDX_IDS: ReadonlySet<string> = new Set([
    ...PERMISSIVE_SPDX_IDS,
    ...WEAK_COPYLEFT_SPDX_IDS,
    ...STRONG_COPYLEFT_SPDX_IDS,
]);

const FALLBACK_DENY_SPDX_IDS: ReadonlySet<string> = new Set(STRONG_COPYLEFT_SPDX_IDS);

// ─── field formats ───────────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
    'source_url', 'license', 'source_sha', 'borrowed_at', 'files',
    'transformation_note', 'cleared_by',
] as const;
const CLEARED_BY_VALUES: ReadonlySet<string> = new Set(['rescan', 'ledger', 'human']);
const SOURCE_URL_RE = /^(https?:\/\/\S+|git@\S+)$/;
const HEX_SHA_RE = /^[0-9a-fA-F]{7,64}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_MIN_LENGTH = 20;

// Rename-only phrase list (principle #6) — a substring hit (case-insensitive)
// rejects the note regardless of its overall length. Documented here AND in
// provenance/README.md; keep both in sync on edit.
export const RENAME_ONLY_PHRASES: readonly string[] = [
    'renamed variable',
    'renamed variables',
    'renamed identifier',
    'renamed identifiers',
    'rename only',
    'only renamed',
    'just renamed',
    'variable rename',
    'identifier rename',
    'renaming variables',
    'renaming identifiers',
    'cosmetic rename',
    'whitespace only',
    'formatting only',
    'reformatted only',
];

function isValidCalendarDate(s: string): boolean {
    const m = ISO_DATE_RE.exec(s);
    if (!m) return false;
    const [y, mo, d] = s.split('-').map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// ─── types ───────────────────────────────────────────────────────────────────

export interface BorrowRecord {
    readonly source_url: string;
    readonly license: string;
    readonly source_sha: string;
    readonly borrowed_at: string;
    readonly files: readonly string[];
    readonly transformation_note: string;
    readonly cleared_by: 'rescan' | 'ledger' | 'human';
}

export interface Finding {
    readonly line: number;
    readonly rule: 'schema' | 'license-policy' | 'transformation-note' | 'notices-sync';
    readonly message: string;
}

export interface DenyPolicy {
    readonly denyIds: ReadonlySet<string>;
    readonly source: 'license-policy.yaml' | 'built-in-fallback';
}

export type LicenseClass = 'allow' | 'deny' | 'unknown';

// ─── license-policy resolution ──────────────────────────────────────────────

/**
 * Resolve the deny set for license-class derivation.
 *
 * `license-policy.yaml` is S1.2's override surface (in progress, concurrent
 * with this ticket — see the header comment). If it exists and carries a
 * usable top-level `deny: [<SPDX id>, ...]` array, that array wins. Any other
 * shape (missing, unparsable, no array) degrades to the built-in fallback
 * with a visible stderr warning — never a silent guess at an unlanded schema.
 */
export function resolveDenyPolicy(repoRoot: string): DenyPolicy {
    const policyPath = path.join(repoRoot, 'license-policy.yaml');
    if (fs.existsSync(policyPath)) {
        try {
            const doc = parseYaml(fs.readFileSync(policyPath, 'utf-8')) as unknown;
            const deny = (doc as { deny?: unknown } | null)?.deny;
            if (Array.isArray(deny) && deny.length > 0 && deny.every((x) => typeof x === 'string')) {
                return { denyIds: new Set(deny as string[]), source: 'license-policy.yaml' };
            }
            process.stderr.write(
                '⚠️  lint_provenance: license-policy.yaml exists but has no usable top-level ' +
                "'deny' array of strings — using the built-in conservative fallback (GPL/AGPL/SSPL family + unknown)\n",
            );
        } catch (err) {
            process.stderr.write(
                `⚠️  lint_provenance: license-policy.yaml failed to parse (${(err as Error).message}) — using the built-in conservative fallback\n`,
            );
        }
    }
    return { denyIds: FALLBACK_DENY_SPDX_IDS, source: 'built-in-fallback' };
}

/** Classify a schema-valid license value against the resolved deny policy. */
export function licenseClass(license: string, policy: DenyPolicy): LicenseClass {
    if (license === 'unknown') return 'unknown';
    if (policy.denyIds.has(license)) return 'deny';
    return 'allow';
}

// ─── transformation-note check ──────────────────────────────────────────────

/** Returns a finding message, or null when the note is acceptable. */
export function transformationNoteFinding(note: unknown): string | null {
    if (typeof note !== 'string' || note.trim().length === 0) {
        return 'transformation_note is missing (empty or not a string)';
    }
    const trimmed = note.trim();
    if (trimmed.length < NOTE_MIN_LENGTH) {
        return `transformation_note is missing (${trimmed.length} chars — minimum ${NOTE_MIN_LENGTH}; a real transformation is describable in at least a sentence)`;
    }
    const lower = trimmed.toLowerCase();
    const hit = RENAME_ONLY_PHRASES.find((p) => lower.includes(p));
    if (hit) {
        return (
            `transformation_note reads as rename-only ("${hit}") — rename-only is not transformation ` +
            '(principle #6); clearing requires structural re-derivation (the hit disappears on rescan) ' +
            'or an attributed ledger entry describing an actual structural change'
        );
    }
    return null;
}

// ─── record validation ───────────────────────────────────────────────────────

/** Validate one parsed ledger line against the closed schema + license policy. */
export function validateRecord(
    raw: unknown,
    line: number,
    repoRoot: string,
    deny: DenyPolicy,
): Finding[] {
    const findings: Finding[] = [];

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        findings.push({ line, rule: 'schema', message: 'record is not a JSON object' });
        return findings;
    }
    const rec = raw as Record<string, unknown>;

    for (const k of Object.keys(rec)) {
        if (!(REQUIRED_FIELDS as readonly string[]).includes(k)) {
            findings.push({
                line,
                rule: 'schema',
                message: `unexpected field '${k}' — the ledger schema is closed to exactly [${REQUIRED_FIELDS.join(', ')}]`,
            });
        }
    }
    for (const k of REQUIRED_FIELDS) {
        if (!(k in rec)) {
            findings.push({ line, rule: 'schema', message: `missing required field '${k}'` });
        }
    }

    if ('source_url' in rec && (typeof rec.source_url !== 'string' || !SOURCE_URL_RE.test(rec.source_url))) {
        findings.push({
            line,
            rule: 'schema',
            message: `source_url must be an http(s):// or git@ URL, got ${JSON.stringify(rec.source_url)}`,
        });
    }

    let licenseIsSchemaValid = false;
    if ('license' in rec) {
        if (typeof rec.license === 'string' && (rec.license === 'unknown' || KNOWN_SPDX_IDS.has(rec.license))) {
            licenseIsSchemaValid = true;
        } else {
            findings.push({
                line,
                rule: 'schema',
                message: `license must be a recognized SPDX id or the literal 'unknown', got ${JSON.stringify(rec.license)}`,
            });
        }
    }

    if ('source_sha' in rec && (typeof rec.source_sha !== 'string' || !HEX_SHA_RE.test(rec.source_sha))) {
        findings.push({
            line,
            rule: 'schema',
            message: `source_sha must be a 7-64 char hex string, got ${JSON.stringify(rec.source_sha)}`,
        });
    }

    if ('borrowed_at' in rec) {
        const ok = typeof rec.borrowed_at === 'string' && isValidCalendarDate(rec.borrowed_at);
        if (!ok) {
            findings.push({
                line,
                rule: 'schema',
                message: `borrowed_at must be an ISO-8601 date (YYYY-MM-DD), got ${JSON.stringify(rec.borrowed_at)}`,
            });
        }
    }

    if ('files' in rec) {
        const files = rec.files;
        if (!Array.isArray(files) || files.length === 0 || !files.every((f) => typeof f === 'string')) {
            findings.push({
                line,
                rule: 'schema',
                message: 'files must be a non-empty array of repo-relative path strings',
            });
        } else {
            for (const f of files as string[]) {
                const resolved = path.resolve(repoRoot, f);
                const withinRepo = resolved === repoRoot || resolved.startsWith(repoRoot + path.sep);
                if (path.isAbsolute(f) || !withinRepo) {
                    findings.push({
                        line,
                        rule: 'schema',
                        message: `files entry '${f}' escapes the repo root — must be a repo-relative path`,
                    });
                } else if (!fs.existsSync(resolved)) {
                    findings.push({
                        line,
                        rule: 'schema',
                        message: `files entry '${f}' does not exist in the repo`,
                    });
                }
            }
        }
    }

    if ('transformation_note' in rec) {
        const noteFinding = transformationNoteFinding(rec.transformation_note);
        if (noteFinding) findings.push({ line, rule: 'transformation-note', message: noteFinding });
    }

    if ('cleared_by' in rec) {
        if (typeof rec.cleared_by !== 'string' || !CLEARED_BY_VALUES.has(rec.cleared_by)) {
            findings.push({
                line,
                rule: 'schema',
                message: `cleared_by must be one of rescan|ledger|human, got ${JSON.stringify(rec.cleared_by)}`,
            });
        }
    }

    // Policy check only fires on a schema-valid license — an unrecognized id
    // is already reported above and re-classifying it would be noise.
    if (licenseIsSchemaValid) {
        const license = rec.license as string;
        const cls = licenseClass(license, deny);
        if (cls === 'unknown') {
            findings.push({
                line,
                rule: 'license-policy',
                message:
                    "license is 'unknown' — principle #1 (unknown escalates, never down-guessed): an " +
                    'unknown-license borrow must not land in the ledger unresolved; escalate to a human ' +
                    'and resolve the license before recording',
            });
        } else if (cls === 'deny') {
            findings.push({
                line,
                rule: 'license-policy',
                message: `license '${license}' is deny-class under the license policy (${deny.source}) — a deny-class borrow may not land in the ledger`,
            });
        }
    }

    return findings;
}

// ─── ledger parsing ──────────────────────────────────────────────────────────

export interface ParsedLine {
    readonly line: number;
    readonly value: unknown;
}

/** Split jsonl text into non-blank lines, parsing each as JSON. */
export function parseLedgerText(text: string): { readonly parsed: ParsedLine[]; readonly findings: Finding[] } {
    const parsed: ParsedLine[] = [];
    const findings: Finding[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = (lines[i] ?? '').trim();
        if (raw.length === 0) continue;
        try {
            parsed.push({ line: i + 1, value: JSON.parse(raw) });
        } catch (err) {
            findings.push({ line: i + 1, rule: 'schema', message: `invalid JSON: ${(err as Error).message}` });
        }
    }
    return { parsed, findings };
}

/** Parse + validate every line. Only fully-clean records feed NOTICES rendering. */
export function lintLedgerText(
    text: string,
    repoRoot: string,
    deny: DenyPolicy,
): { readonly records: BorrowRecord[]; readonly findings: Finding[] } {
    const { parsed, findings } = parseLedgerText(text);
    const records: BorrowRecord[] = [];
    for (const { line, value } of parsed) {
        const recordFindings = validateRecord(value, line, repoRoot, deny);
        findings.push(...recordFindings);
        if (recordFindings.length === 0) records.push(value as BorrowRecord);
    }
    return { records, findings };
}

// ─── NOTICES generation ──────────────────────────────────────────────────────

const NOTICES_BANNER = [
    '# Third-Party Notices',
    '',
    '> **Generated** by `lint_provenance.ts --regenerate-notices` — do NOT',
    '> hand-edit. Source of truth: `provenance/borrows.jsonl`. Drift-checked in',
    '> CI (`task lint-provenance`); run',
    '> `./scripts-run src/scripts/lint_provenance --regenerate-notices` after',
    '> any ledger change.',
    '',
].join('\n');

/** Deterministic (stable ledger-line order) render of the notices file. */
export function renderNotices(records: readonly BorrowRecord[]): string {
    if (records.length === 0) {
        return `${NOTICES_BANNER}\nNo third-party code borrows are currently recorded in \`provenance/borrows.jsonl\`.\n`;
    }
    const sections = records.map((r) => {
        const files = r.files.map((f) => `\`${f}\``).join(', ');
        return [
            `## ${r.source_url}`,
            '',
            `- **License:** ${r.license}`,
            `- **Source SHA:** ${r.source_sha}`,
            `- **Borrowed:** ${r.borrowed_at}`,
            `- **Files:** ${files}`,
            `- **Transformation:** ${r.transformation_note}`,
            `- **Cleared by:** ${r.cleared_by}`,
            '',
        ].join('\n');
    });
    return `${NOTICES_BANNER}\n${sections.join('\n')}`;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

class ExitCode extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

interface Args {
    readonly quiet: boolean;
    readonly regenerate: boolean;
}

function parseArgs(argv: string[]): Args {
    let quiet = false;
    let regenerate = false;
    for (const a of argv) {
        if (a === '--quiet') {
            quiet = true;
        } else if (a === '--regenerate-notices') {
            regenerate = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_provenance [--quiet] [--regenerate-notices]\n');
            throw new ExitCode(0);
        } else {
            process.stderr.write(`❌  lint_provenance: unrecognized argument: ${a}\n`);
            throw new ExitCode(2);
        }
    }
    return { quiet, regenerate };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const args = parseArgs(argv);
    const ledgerPath = path.join(REPO, LEDGER_REL);
    const noticesPath = path.join(REPO, NOTICES_REL);
    // The ledger is the record this gate audits. Record COUNT is not the scope
    // signal — an empty ledger is a legitimate "no borrows yet" state (it is
    // empty today) — but an absent ledger file is not: the `existsSync ? … : ''`
    // fallback below would read a moved ledger as zero borrows and re-render the
    // notices to match, laundering the loss into a clean sync. Exit 2 is this
    // linter's single failure code ("this run produced nothing trustworthy").
    try {
        assertWatchlistResolves({
            gate: 'lint_provenance',
            candidates: [LEDGER_REL],
            repoRoot: REPO,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
    const text = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf-8') : '';
    const deny = resolveDenyPolicy(REPO);
    const { records, findings } = lintLedgerText(text, REPO, deny);

    if (findings.length > 0) {
        for (const f of findings) {
            process.stderr.write(`❌  ${LEDGER_REL}:${f.line}: [${f.rule}] ${f.message}\n`);
        }
        process.stderr.write(
            `❌  lint_provenance: ${findings.length} finding(s) — checks our own records, strict from day one\n`,
        );
        return 2;
    }

    const expectedNotices = renderNotices(records);

    if (args.regenerate) {
        fs.writeFileSync(noticesPath, expectedNotices, 'utf-8');
        if (!args.quiet) {
            process.stdout.write(
                `✅  lint_provenance: regenerated ${NOTICES_REL} from ${records.length} ledger record(s)\n`,
            );
        }
        return 0;
    }

    const actualNotices = fs.existsSync(noticesPath) ? fs.readFileSync(noticesPath, 'utf-8') : null;
    if (actualNotices !== expectedNotices) {
        process.stderr.write(
            `❌  ${NOTICES_REL} is out of sync with ${LEDGER_REL} — run: ./scripts-run src/scripts/lint_provenance --regenerate-notices\n`,
        );
        return 2;
    }

    if (!args.quiet) {
        process.stdout.write(
            `✅  lint_provenance: ${records.length} ledger record(s) OK · ${NOTICES_REL} in sync (deny-policy source: ${deny.source})\n`,
        );
    }
    return 0;
}

/** Robust "am I the entry script?" — realpath-compares argv[1] to this file. */
function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (a === _FILE || pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(_FILE);
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    try {
        process.exit(main());
    } catch (exc) {
        if (exc instanceof ExitCode) {
            process.exit(exc.code);
        }
        throw exc;
    }
}

export { REPO, LEDGER_REL, NOTICES_REL, ExitCode };
