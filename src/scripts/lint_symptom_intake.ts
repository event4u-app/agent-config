#!/usr/bin/env node
/**
 * Warn-only gate: operator symptom entries under `agents/tickets/symptoms/`
 * must be resolved within 30 days of the reported date.
 *
 * "Resolved" means the entry carries exactly one of the two blocks the
 * directory's `README.md` defines — `## confirmed:` (a defect with `file:line`
 * at a pinned commit) or `## null:` (checked, not reproducible, with evidence).
 * A `null:` is a first-class outcome: the point of the gate is that somebody
 * looked, not that a defect was found.
 *
 * **Warn-only by design, and the design is the load-bearing part.** Intake has
 * to stay cheaper than the work it triggers, so an unresolved report is a
 * reminder, never a build failure — a gate that reds CI because a human has not
 * yet investigated a symptom would train people to stop filing symptoms, which
 * is the exact opposite of what the surface is for
 * (`agents/roadmaps/archive/road-to-symptom-driven-harvest-loop.md` Phase 1 Step 2).
 * The only exit-1 path is a dead scan scope.
 *
 * Scope: `agents/tickets/symptoms/*.md`, one level, no recursion.
 * `README.md` and `_`-prefixed files (the template) are counted as scanned but
 * never evaluated — so the gate keeps a non-zero denominator while the surface
 * exists, and does not red the moment the last entry is resolved away.
 *
 * Exit codes: 0 = clean or warnings only, 1 = dead scan scope.
 * `--quiet` is a bare argv membership check, matching the sibling roadmap gates.
 * `--now=YYYY-MM-DD` overrides today (tests and reproducible runs only).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { asOf } from './_lib/as_of.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const QUIET = process.argv.slice(2).includes('--quiet');

const SYMPTOM_DIR = path.join('agents', 'tickets', 'symptoms');

/** Days after `reported:` at which an unresolved entry starts warning. */
export const STALE_AFTER_DAYS = 30;

const _HERE = path.resolve(fileURLToPath(import.meta.url));

const REPORTED_RE = /^reported:\s*(\d{4}-\d{2}-\d{2})\s*$/m;
const CONFIRMED_RE = /^##\s+confirmed:\s*$/m;
const NULL_RE = /^##\s+null:\s*$/m;

export interface SymptomFinding {
    readonly file: string;
    readonly kind: 'unresolved' | 'no-reported-date';
    readonly ageDays: number | null;
}

/** Walk up from CWD until a dir containing `agents/tickets` is found. */
function _repoRoot(): string {
    let cur = process.cwd();
    const chain = [cur];
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) break;
        chain.push(parent);
        cur = parent;
    }
    for (const candidate of chain) {
        try {
            if (fs.statSync(path.join(candidate, 'agents', 'tickets')).isDirectory()) {
                return candidate;
            }
        } catch {
            // keep walking
        }
    }
    return process.cwd();
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Every `*.md` directly under the symptoms dir, sorted. */
export function listMarkdown(base: string): string[] {
    if (!_isDir(base)) return [];
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => e.name)
        .sort();
}

/** An entry is a report; `README.md` and `_`-prefixed files are not. */
export function isEntry(name: string): boolean {
    return name.endsWith('.md') && name !== 'README.md' && !name.startsWith('_');
}

function _daysBetween(fromIso: string, now: Date): number | null {
    const parsed = Date.parse(`${fromIso}T00:00:00Z`);
    if (Number.isNaN(parsed)) return null;
    return Math.floor((now.getTime() - parsed) / 86_400_000);
}

export function evaluate(text: string, name: string, now: Date): SymptomFinding | null {
    const reported = REPORTED_RE.exec(text);
    if (reported === null) {
        return { file: name, kind: 'no-reported-date', ageDays: null };
    }
    if (CONFIRMED_RE.test(text) || NULL_RE.test(text)) {
        return null;
    }
    const age = _daysBetween(reported[1] as string, now);
    if (age === null) {
        return { file: name, kind: 'no-reported-date', ageDays: null };
    }
    if (age <= STALE_AFTER_DAYS) {
        return null;
    }
    return { file: name, kind: 'unresolved', ageDays: age };
}

function _now(): Date {
    const flag = process.argv.slice(2).find((a) => a.startsWith('--now='));
    if (flag !== undefined) {
        const parsed = Date.parse(`${flag.slice('--now='.length)}T00:00:00Z`);
        if (!Number.isNaN(parsed)) return new Date(parsed);
    }
    return asOf();
}

function main(): number {
    const root = _repoRoot();
    const base = path.join(root, SYMPTOM_DIR);
    const names = listMarkdown(base);

    try {
        // The scanned unit counts README + template too, deliberately: this gate
        // must not go dead the moment the last open entry is resolved, and the
        // directory always carries its convention file while the surface exists.
        assertScanned({
            gate: 'lint_symptom_intake',
            scanned: names.length,
            units: 'symptom file(s)',
            roots: [SYMPTOM_DIR],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const now = _now();
    const findings: SymptomFinding[] = [];
    let entryCount = 0;

    // Per-target accounting: README.md and the template are planned too, so the
    // ledger states out loud that they were seen and deliberately not evaluated
    // — an unaccounted `continue` is the silent-skip defect this module catches.
    const ledger = new GateLedger('lint_symptom_intake');
    ledger.plan(names);

    for (const name of names) {
        if (!isEntry(name)) {
            ledger.outOfScope(name, 'not_applicable_kind');
            continue;
        }
        entryCount += 1;
        let text: string;
        try {
            text = fs.readFileSync(path.join(base, name), 'utf-8');
        } catch {
            ledger.skip(name, 'binary_content');
            continue;
        }
        const finding = evaluate(text, name, now);
        if (finding !== null) {
            findings.push(finding);
            ledger.fail(name, finding.kind);
        } else {
            ledger.complete(name);
        }
    }

    if (findings.length === 0) {
        ledger.report();
        if (!QUIET) {
            process.stdout.write(
                `✅  lint-symptom-intake: ${entryCount} entry(ies) resolved or within ` +
                    `${STALE_AFTER_DAYS} days.\n`,
            );
        }
        return 0;
    }

    ledger.report();
    process.stdout.write(`⚠️  lint-symptom-intake: ${findings.length} unresolved symptom entry(ies):\n`);
    for (const f of findings) {
        if (f.kind === 'no-reported-date') {
            process.stdout.write(`      ${SYMPTOM_DIR}/${f.file} — no valid \`reported: YYYY-MM-DD\` in frontmatter\n`);
        } else {
            process.stdout.write(
                `      ${SYMPTOM_DIR}/${f.file} — reported ${String(f.ageDays)} days ago, ` +
                    'no `## confirmed:` or `## null:` block\n',
            );
        }
    }
    process.stdout.write('\n');
    process.stdout.write('   Add whichever block is true (see agents/tickets/symptoms/README.md):\n');
    process.stdout.write('     • `## confirmed:` — defect + file:line at a pinned commit + owning roadmap\n');
    process.stdout.write('     • `## null:` — what was checked, and why it does not reproduce\n');
    process.stdout.write('   A null is a result, not a failure to act. This gate never fails the build.\n');
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export { QUIET, SYMPTOM_DIR, main };
