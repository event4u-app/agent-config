#!/usr/bin/env tsx
/**
 * The `## Decisions` contract — ownership vocabulary and section shape.
 *
 * Two check families:
 *
 *   A. **Ownership vocabulary.** `decision_resolution`'s axis is
 *      ownership, not impact (ADR-268 § 10). A `## Decisions` table's
 *      `ownership` column accepts exactly the eight class names and nothing
 *      else — `high impact`, `P1`, `critical` and friends are the old axis
 *      leaking back in, and the whole point of the ruling is that a technical
 *      decision does not become owner-owned because it is hard.
 *
 *   B. **Section shape.** A `status: ready` roadmap that still
 *      carries an unresolved decision marker (`TBD`, *decide later*, *to be
 *      decided*, …) outside a `## Decisions` row is a plan that enters
 *      execution with an open question in it. The same marker resolved into a
 *      `## Decisions` row is green: the section IS the discharge.
 *
 * Corpus: top-level `agents/roadmaps/*.md`  code-comment-allow provenance-comment -- the path is this script's operand, not where the code came from
 * (`archive/`, `skipped/`, `later/`,
 * `stubs/` excluded, as are `template.md` and `dashboard*`) — the same corpus
 * `lint_plan_risk_register` reads, and for the same reason: a parked or
 * archived plan is not entering execution. Archived roadmaps carry freeform
 * `## Decisions (locked …)` prose from before this contract existed; they are
 * out of scope rather than grandfathered by a special case.
 *
 * Exit codes: 0 clean · 1 violations · 2 internal error / bad argv.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'lint_decision_classes';

/**
 * The eight ownership classes (ADR-268 § 10). Kept as a literal here rather
 * than imported from `ai_council/config.ts`: that module is the COUNCIL
 * config loader and pulling it in would make a roadmap lint depend on the
 * council's whole schema. The duplication is pinned by a test that reads both.
 */
export const OWNERSHIP_CLASSES: readonly string[] = [
    'deterministic',
    'reversible-technical',
    'contested-technical',
    'critical-technical',
    'product-owned',
    'business-owned',
    'destructive-owned',
    'spend-exhaustion',
];

/** `resolved by` vocabulary — the third column's contract. */
export const RESOLVER_FORMS: readonly string[] = [
    'evidence',
    'agent',
    'independent:',
    'council:',
    'team:',
    'owner',
];

/**
 * Unresolved-decision markers. Deliberately narrow: every pattern is a phrase
 * an author writes when they KNOW a decision is open, never a word that shows
 * up in ordinary plan prose. A detector that fires on normal writing gets
 * weakened until it finds nothing, which is how a
 * closure detector gets neutered.
 */
const UNRESOLVED_PATTERNS: readonly { readonly re: RegExp; readonly label: string }[] = [
    { re: /\bTBD\b/, label: 'TBD' },
    { re: /\bto be decided\b/i, label: 'to be decided' },
    { re: /\bdecide later\b/i, label: 'decide later' },
    { re: /\bdecided later\b/i, label: 'decided later' },
    { re: /\bopen question\b/i, label: 'open question' },
    { re: /\bwe(?:'| a)re not sure (?:yet|which|whether)\b/i, label: 'not sure yet' },
];

const DECISIONS_HEADING_RE = /^##\s+Decisions\s*$/;
const DISCHARGE_HEADING_RE = /^##\s+(Decisions|Blockers)\s*$/;
const ANY_H2_RE = /^##\s+/;
const FRONTMATTER_STATUS_RE = /^status:\s*(\S+)/m;
const EXCLUDED_NAMES_RE = /^(template\.md|dashboard.*)$/;

export interface Violation {
    readonly file: string;
    readonly line: number;
    readonly reason: string;
}

/** Split a markdown table row into trimmed cells (leading/trailing pipe dropped). */
export function tableCells(line: string): string[] {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return [];
    const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
    return inner.split('|').map((c) => c.trim());
}

function isSeparatorRow(cells: readonly string[]): boolean {
    return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

/** Frontmatter `status:` (lower-cased), or `ready` when absent — status is binary. */
export function readStatus(text: string): string {
    if (!text.startsWith('---')) return 'ready';
    const end = text.indexOf('\n---', 3);
    if (end < 0) return 'ready';
    const fm = text.slice(0, end);
    const m = FRONTMATTER_STATUS_RE.exec(fm);
    return m ? (m[1] as string).toLowerCase() : 'ready';
}

interface DecisionsSection {
    /** 0-based index of the heading line, or -1 when there is no section. */
    readonly headingIdx: number;
    /** 0-based [start, end) line range of the section body. */
    readonly start: number;
    readonly end: number;
}

export function findDecisionsSection(lines: readonly string[]): DecisionsSection {
    for (let i = 0; i < lines.length; i += 1) {
        if (DECISIONS_HEADING_RE.test(lines[i] as string)) {
            let j = i + 1;
            while (j < lines.length && !ANY_H2_RE.test(lines[j] as string)) j += 1;
            return { headingIdx: i, start: i + 1, end: j };
        }
    }
    return { headingIdx: -1, start: 0, end: 0 };
}

/**
 * Check family A — the ownership column of a `## Decisions` table.
 *
 * The header row names the columns; `ownership` is located by name rather than
 * by position so a plan may add a column without silently moving the one the
 * gate reads.
 */
export function checkOwnershipColumn(rel: string, lines: readonly string[]): Violation[] {
    const out: Violation[] = [];
    const sec = findDecisionsSection(lines);
    if (sec.headingIdx < 0) return out;

    let ownershipCol = -1;
    let resolvedCol = -1;
    let headerSeen = false;
    for (let i = sec.start; i < sec.end; i += 1) {
        const cells = tableCells(lines[i] as string);
        if (cells.length === 0) continue;
        if (isSeparatorRow(cells)) continue;
        if (!headerSeen) {
            headerSeen = true;
            ownershipCol = cells.findIndex((c) => /^ownership$/i.test(c));
            resolvedCol = cells.findIndex((c) => /^resolved[ _]by$/i.test(c));
            if (ownershipCol < 0) {
                out.push({
                    file: rel,
                    line: i + 1,
                    reason:
                        'the `## Decisions` table has no `ownership` column — the contract is ' +
                        '`| ID | ownership | resolved by | decision | evidence | revisit if |`',
                });
                return out;
            }
            if (resolvedCol < 0) {
                out.push({
                    file: rel,
                    line: i + 1,
                    reason:
                        'the `## Decisions` table has no `resolved by` column — a decision with ' +
                        'no recorded resolver is not a closed decision',
                });
            }
            continue;
        }
        const owner = (cells[ownershipCol] ?? '').replace(/`/g, '').trim();
        if (owner === '') {
            out.push({ file: rel, line: i + 1, reason: 'empty `ownership` cell' });
        } else if (!OWNERSHIP_CLASSES.includes(owner)) {
            out.push({
                file: rel,
                line: i + 1,
                reason:
                    `ownership=\`${owner}\` is not one of the eight ownership classes ` +
                    `(${OWNERSHIP_CLASSES.join(', ')}). The axis is ownership, not impact ` +
                    `(ADR-268 § 10).`,
            });
        }
        if (resolvedCol >= 0) {
            const resolved = (cells[resolvedCol] ?? '').replace(/`/g, '').trim();
            const ok = RESOLVER_FORMS.some((f) =>
                f.endsWith(':') ? resolved.startsWith(f) && resolved.length > f.length : resolved === f,
            );
            if (!ok) {
                out.push({
                    file: rel,
                    line: i + 1,
                    reason:
                        `resolved by=\`${resolved}\` is not one of ` +
                        `evidence, agent, independent:<session or model>, council:<record>, ` +
                        `team:<record>, owner`,
                });
            }
        }
    }
    return out;
}

/**
 * The two sections where an open item is already DISCHARGED by a contract of
 * its own, so the marker there is the record rather than the defect:
 *
 *   - `## Decisions` — the closure record this gate exists to require.
 *   - `## Blockers` — the structured five-field blocker contract, which owns
 *     open items a human must decide. Firing here would demand a roadmap close
 *     a decision it has correctly recorded as not-the-agent's to close.
 */
export function dischargeRanges(lines: readonly string[]): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < lines.length; i += 1) {
        if (!DISCHARGE_HEADING_RE.test(lines[i] as string)) continue;
        let j = i + 1;
        while (j < lines.length && !ANY_H2_RE.test(lines[j] as string)) j += 1;
        out.push([i, j]);
    }
    return out;
}

/**
 * Check family B — an unresolved marker outside the `## Decisions` section.
 *
 * Fenced code, HTML comments and the roadmap's own prose ABOUT the gate would
 * all produce false positives, so: code fences are skipped, and a marker on a
 * line inside the `## Decisions` section is by definition the discharge, not
 * the defect.
 */
export function checkUnresolvedMarkers(rel: string, lines: readonly string[]): Violation[] {
    const out: Violation[] = [];
    const discharge = dischargeRanges(lines);
    let inFence = false;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        if (discharge.some(([a, b]) => i >= a && i < b)) continue;
        if (/<!--\s*decision-marker:\s*ignore\s*-->/.test(line)) continue;
        for (const { re, label } of UNRESOLVED_PATTERNS) {
            if (re.test(line)) {
                out.push({
                    file: rel,
                    line: i + 1,
                    reason:
                        `unresolved decision marker \`${label}\` in a \`ready\` roadmap — ` +
                        `close it and record the answer as a \`## Decisions\` row`,
                });
                break;
            }
        }
    }
    return out;
}

export function checkFile(rel: string, text: string): Violation[] {
    const lines = text.split('\n');
    const status = readStatus(text);
    const out: Violation[] = [...checkOwnershipColumn(rel, lines)];
    if (status === 'ready') {
        out.push(...checkUnresolvedMarkers(rel, lines));
    }
    return out;
}

// --------------------------------------------------------------------------
// CLI.
// --------------------------------------------------------------------------

function _repoRoot(): string {
    return path.resolve(path.dirname(_HERE), '..', '..');
}

export function listCorpus(root: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isFile() && e.name.endsWith('.md') && !EXCLUDED_NAMES_RE.test(e.name))
        .map((e) => path.join(root, e.name))
        .sort();
}

function _usage(): string {
    return (
        `usage: ${_PROG} [-h] [--quiet] [--json] [--self-test]\n\n` +
        `Validate the \`## Decisions\` contract on top-level agents/roadmaps/*.md.\n`
    );
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let quiet = false;
    let json = false;
    let selfTest = false;
    const unknown: string[] = [];
    for (const a of args) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(_usage());
            return 0;
        } else if (a === '--quiet') quiet = true;
        else if (a === '--json') json = true;
        else if (a === '--self-test') selfTest = true;
        else unknown.push(a);
    }
    if (unknown.length) {
        process.stderr.write(`${_usage()}${_PROG}: error: unrecognized arguments: ${unknown.join(' ')}\n`);
        return 2;
    }

    if (selfTest) return _selfTest();

    const repo = _repoRoot();
    const root = path.join(repo, 'agents', 'roadmaps');
    const files = listCorpus(root);
    try {
        assertScanned({
            gate: _PROG,
            scanned: files.length,
            units: 'roadmap file(s)',
            roots: ['agents/roadmaps'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    const violations: Violation[] = [];
    for (const f of files) {
        const rel = path.relative(repo, f);
        violations.push(...checkFile(rel, fs.readFileSync(f, 'utf-8')));
    }

    if (json) {
        process.stdout.write(JSON.stringify(violations, null, 2) + '\n');
        return violations.length ? 1 : 0;
    }
    if (violations.length) {
        process.stderr.write(`❌  ${_PROG}: ${violations.length} violation(s)\n`);
        for (const v of violations) {
            process.stderr.write(`   ${v.file}:${v.line} — ${v.reason}\n`);
        }
        return 1;
    }
    if (!quiet) {
        process.stdout.write(`✅  ${_PROG}: ${files.length} roadmap file(s) scanned, 0 violations\n`);
    }
    return 0;
}

/** Both directions, in-process: a bad table must red, a good one must not. */
function _selfTest(): number {
    const bad = [
        '## Decisions',
        '',
        '| ID | ownership | resolved by | decision | evidence | revisit if |',
        '|---|---|---|---|---|---|',
        '| D1 | high impact | owner | x | y | z |',
        '',
    ].join('\n');
    const good = [
        '## Decisions',
        '',
        '| ID | ownership | resolved by | decision | evidence | revisit if |',
        '|---|---|---|---|---|---|',
        '| D1 | critical-technical | council:rec-1 | x | y | z |',
        '',
    ].join('\n');
    const failures: string[] = [];
    if (checkFile('bad.md', bad).length === 0) failures.push('an impact-axis class did not red');
    if (checkFile('good.md', good).length !== 0) failures.push('a valid ownership row red');
    if (checkFile('m.md', 'status: ready\n\nPick the codec: TBD\n').length === 0) {
        failures.push('an unresolved marker did not red');
    }
    if (failures.length) {
        for (const f of failures) process.stderr.write(`❌  ${_PROG} --self-test: ${f}\n`);
        return 1;
    }
    process.stdout.write(`✅  ${_PROG} --self-test: both directions hold\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}
