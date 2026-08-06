#!/usr/bin/env tsx
/**
 * lint_rule_migration_ledger — hold the rule-body migration ledger honest.
 *
 * ## What the ledger is
 *
 * 44 of this package's 111 rules carry a line saying their body was migrated to
 * a skill, guideline, context or contract. That transform is **lossy** and was
 * never recorded: `check_condensation` guarantees byte-exactness for
 * source→projection, and nothing at all covered rule→target. A reader who wants
 * to know what a rule used to say, and where each part of it went, had only
 * `git log` — and for 24 of the 44 even that fails, because `git log --follow`
 * terminates their lineage at a 2026-05-18 merge where the file first appears
 * already carrying the migration line.
 *
 * One ledger per migrated rule, at `agents/decisions/rule-migrations/<rule>.yml`.
 *
 * ## Why the ledger carries its own `source_headings`
 *
 * The obvious design has the gate re-derive the pre-migration headings from git
 * at lint time. It cannot: the two commits holding the pre-migration bodies for
 * 20 of these rules — `d4fe80e1c` and `2a11c70b2` — are **not ancestors of
 * HEAD**. They survive only because 31 and 2 `origin/*` branches respectively
 * still contain them, CI clones do not fetch those refs, and a routine remote
 * branch prune destroys them permanently.
 *
 * So the ledger records `source_headings` verbatim, captured once from git while
 * the objects still existed. That is not redundancy — it IS the harvest. After
 * this lands, the ledger's basis survives a branch prune, and the gate needs no
 * git at all, which is also why it runs in a shallow CI clone.
 *
 * ## What the gate asserts
 *
 * 1. Every rule carrying a migration line has a ledger, and every ledger names a
 *    rule that exists.
 * 2. Every recorded `source_heading` has **exactly one** row — the completeness
 *    property, keyed on heading TEXT rather than level, because `##` → `###`
 *    demotion is the norm in these targets and a level-keyed check misses every
 *    demoted section.
 * 3. Every `target` anchor resolves: the file exists AND carries a heading whose
 *    text matches.
 * 4. `carried` and `merged` name a target; `dropped` must not.
 * 5. Every reason is present and is not one of the known-empty phrasings.
 *
 * ## What the gate deliberately does NOT assert
 *
 * Naming this is more important here than usual, because the ledger records
 * history and a gate that demanded history be *reproduced* would push an author
 * to invent rows:
 *
 * - **Not the semantic quality of a reason.** The check is a denylist of
 *   known-empty phrasings plus a length floor — mechanical, not editorial. A
 *   reason can be wrong; that is a review problem, not a lint problem.
 * - **Not that `unrecoverable` is truly unrecoverable.** The label claims "we
 *   do not have it", never "it could not be found by anyone".
 * - **Not that a heading SHOULD have been carried.** A `dropped` row with a
 *   real reason is a complete answer. The ledger's job is that the loss is
 *   recorded, not that it is undone.
 * - **Not headings added after the migration.** `## See also` was appended to
 *   nearly every rule by a later batch; requiring pre-migration provenance for
 *   post-migration headings would false-positive across the whole set.
 *
 * Exit codes: 0 = clean, 1 = violations, 2 = usage / unreadable ledger.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO_ROOT = path.dirname(path.dirname(SCRIPTS_DIR));

export const LEDGER_DIR = 'agents/decisions/rule-migrations';

/** Rule-level provenance of the pre-migration body. */
export const SOURCE_KINDS = ['recoverable', 'born_thin', 'unrecoverable'] as const;
/** Row-level outcome for one pre-migration heading. */
export const DISPOSITIONS = ['carried', 'merged', 'dropped'] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];
export type Disposition = (typeof DISPOSITIONS)[number];

/**
 * Phrasings that look like a reason and record nothing.
 *
 * This list is the whole of the "forbid a vague reason" requirement, and it is
 * deliberately a closed denylist rather than a judgement: a gate that scored
 * reason quality would be unfalsifiable and would invite writing to the scorer.
 */
export const VAGUE_REASONS = [
    'secondary', 'lower-yield', 'lower yield', 'redundant', 'not needed',
    'unnecessary', 'consolidated', 'cleanup', 'obsolete', 'n/a', 'none',
    'tbd', 'todo', 'see above', 'as above', 'misc', 'other',
];

/** A reason must carry content a reviewer can check: five words, and not a denylisted phrase. */
export function reasonIsAcceptable(reason: unknown): { ok: boolean; why?: string } {
    if (typeof reason !== 'string' || reason.trim() === '') {
        return { ok: false, why: 'reason is missing or empty' };
    }
    const norm = reason.trim().toLowerCase().replace(/[.!]$/, '');
    if (VAGUE_REASONS.includes(norm)) {
        return { ok: false, why: `reason "${reason.trim()}" is a known-empty phrasing` };
    }
    const words = norm.split(/\s+/).filter((w) => w.length > 1);
    if (words.length < 5) {
        return { ok: false, why: `reason "${reason.trim()}" is too short to review (needs ≥ 5 words)` };
    }
    return { ok: true };
}

/** Heading text, normalized for comparison — level, emphasis and spacing are not identity. */
export function normHeading(h: string): string {
    return h.replace(/[`*_]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Every heading in a markdown body, ignoring fenced blocks.
 *
 * `#` is included on purpose. Three of the migrated rules are pointer stubs
 * whose entire surviving body sits under the H1 with no `##` beneath it, and a
 * row saying "this stayed in the rule" has nowhere else to point. Excluding H1
 * would force those rows to invent a subsection that does not exist — the
 * anchor-fabrication this gate exists to prevent.
 */
export function headingsOf(text: string): string[] {
    const out: string[] = [];
    let inFence = false;
    for (const line of text.split(/\r\n|\r|\n/)) {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }
        const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
        if (m?.[2] !== undefined) {
            out.push(m[2].trim());
        }
    }
    return out;
}

export interface LedgerRow {
    heading?: unknown;
    disposition?: unknown;
    target?: unknown;
    reason?: unknown;
}
export interface LedgerFile {
    rule?: unknown;
    source?: unknown;
    source_commit?: unknown;
    source_path?: unknown;
    migrated_to?: unknown;
    source_headings?: unknown;
    rows?: unknown;
}

/** Rules whose body carries a migration pointer, in any of its five phrasings. */
export function migratedRules(root: string): string[] {
    const dir = path.join(root, 'src', 'rules');
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const n of names.sort()) {
        const text = fs.readFileSync(path.join(dir, n), 'utf-8');
        // Five phrasings, one of them mid-paragraph and one soft-wrapped across
        // two lines — so this matches on the joined body, not per line, and
        // anchors on the verb rather than on a line start.
        const joined = text.replace(/\s*\n\s*/g, ' ');
        if (/\b(?:migrated to|merged into)\b/i.test(joined)) {
            out.push(n.slice(0, -3));
        }
    }
    return out;
}

export function checkLedger(
    root: string,
    file: string,
    doc: LedgerFile,
): string[] {
    const errs: string[] = [];
    const id = path.basename(file);
    const rule = typeof doc.rule === 'string' ? doc.rule : null;
    if (rule === null) {
        return [`${id}: missing \`rule:\``];
    }
    if (!fs.existsSync(path.join(root, 'src', 'rules', `${rule}.md`))) {
        errs.push(`${id}: \`rule: ${rule}\` has no file at src/rules/${rule}.md`);
    }
    if (path.basename(file, '.yml') !== rule) {
        errs.push(`${id}: filename must match \`rule: ${rule}\``);
    }

    const source = doc.source;
    if (typeof source !== 'string' || !(SOURCE_KINDS as readonly string[]).includes(source)) {
        errs.push(`${id}: \`source:\` must be one of ${SOURCE_KINDS.join(' | ')}`);
        return errs;
    }

    const headings = Array.isArray(doc.source_headings) ? (doc.source_headings as unknown[]) : [];
    const rows = Array.isArray(doc.rows) ? (doc.rows as LedgerRow[]) : [];

    if (source === 'born_thin') {
        // No source content ever existed. This is a different fact from
        // "existed and is lost", and a ledger that spelled them the same way
        // could not be audited — so the shapes are enforced apart.
        if (headings.length > 0 || rows.length > 0) {
            errs.push(
                `${id}: \`source: born_thin\` means no pre-migration body ever existed, so it ` +
                    'carries no headings and no rows — use `unrecoverable` if a body existed and is lost',
            );
        }
        return errs;
    }

    if (source === 'unrecoverable') {
        if (rows.length > 0) {
            errs.push(`${id}: \`source: unrecoverable\` records that the body is gone; it carries no rows`);
        }
        return errs;
    }

    if (headings.length === 0) {
        errs.push(`${id}: \`source: recoverable\` requires the harvested \`source_headings:\``);
    }

    const rowByHeading = new Map<string, number>();
    for (const row of rows) {
        const h = typeof row.heading === 'string' ? normHeading(row.heading) : null;
        if (h === null) {
            errs.push(`${id}: a row has no \`heading:\``);
            continue;
        }
        rowByHeading.set(h, (rowByHeading.get(h) ?? 0) + 1);

        const disp = row.disposition;
        if (typeof disp !== 'string' || !(DISPOSITIONS as readonly string[]).includes(disp)) {
            errs.push(`${id}: row "${String(row.heading)}" disposition must be one of ${DISPOSITIONS.join(' | ')}`);
            continue;
        }
        const verdict = reasonIsAcceptable(row.reason);
        if (!verdict.ok) {
            errs.push(`${id}: row "${String(row.heading)}" — ${verdict.why ?? 'bad reason'}`);
        }
        const target = typeof row.target === 'string' ? row.target : null;
        if (disp === 'dropped') {
            if (target !== null) {
                errs.push(`${id}: row "${String(row.heading)}" is \`dropped\` but names a target`);
            }
            continue;
        }
        if (target === null) {
            errs.push(`${id}: row "${String(row.heading)}" is \`${disp}\` and must name a target`);
            continue;
        }
        const [fileP, anchor] = target.split('#');
        const abs = path.join(root, fileP ?? '');
        if (!fs.existsSync(abs)) {
            errs.push(`${id}: row "${String(row.heading)}" target file does not exist: ${String(fileP)}`);
            continue;
        }
        if (anchor === undefined || anchor.trim() === '') {
            errs.push(`${id}: row "${String(row.heading)}" target needs a \`#<heading>\` anchor`);
            continue;
        }
        const want = normHeading(anchor);
        const have = new Set(headingsOf(fs.readFileSync(abs, 'utf-8')).map(normHeading));
        if (!have.has(want)) {
            errs.push(
                `${id}: row "${String(row.heading)}" target anchor does not resolve — ` +
                    `${String(fileP)} has no heading "${anchor}"`,
            );
        }
    }

    for (const h of headings) {
        if (typeof h !== 'string') {
            errs.push(`${id}: \`source_headings\` entry is not a string`);
            continue;
        }
        const count = rowByHeading.get(normHeading(h)) ?? 0;
        if (count === 0) {
            errs.push(`${id}: pre-migration heading "${h}" has no ledger row — every heading gets exactly one`);
        } else if (count > 1) {
            errs.push(`${id}: pre-migration heading "${h}" has ${String(count)} rows — exactly one disposition per heading`);
        }
    }
    return errs;
}

interface Args {
    readonly quiet: boolean;
    readonly json: boolean;
}

function parseArgs(argv: readonly string[]): Args {
    let quiet = false;
    let json = false;
    for (const a of argv) {
        if (a === '--quiet') { quiet = true; }
        else if (a === '--json') { json = true; }
        else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_rule_migration_ledger [--quiet] [--json]\n');
            process.exit(0);
        } else {
            process.stderr.write(`lint_rule_migration_ledger: unrecognized argument: ${a}\n`);
            process.exit(2);
        }
    }
    return { quiet, json };
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrml-'));
    const mk = (files: Record<string, string>): string => {
        const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
        for (const [rel, body] of Object.entries(files)) {
            const p = path.join(root, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, body, 'utf-8');
        }
        return root;
    };
    const RULE = '# R\n\nBody migrated to `skill:x`.\n';
    const TARGET = '# X\n\n## Kept Section\n\ntext\n';
    const ok = mk({
        'src/rules/r.md': RULE,
        'src/skills/x/SKILL.md': TARGET,
        [`${LEDGER_DIR}/r.yml`]:
            'rule: r\nsource: recoverable\nsource_headings:\n  - Kept Section\nrows:\n  - heading: Kept Section\n    disposition: carried\n    target: src/skills/x/SKILL.md#Kept Section\n    reason: the whole section moved verbatim into the skill body\n',
    });
    const missingRow = mk({
        'src/rules/r.md': RULE,
        'src/skills/x/SKILL.md': TARGET,
        [`${LEDGER_DIR}/r.yml`]:
            'rule: r\nsource: recoverable\nsource_headings:\n  - Kept Section\n  - Lost Section\nrows:\n  - heading: Kept Section\n    disposition: carried\n    target: src/skills/x/SKILL.md#Kept Section\n    reason: the whole section moved verbatim into the skill body\n',
    });
    const badAnchor = mk({
        'src/rules/r.md': RULE,
        'src/skills/x/SKILL.md': TARGET,
        [`${LEDGER_DIR}/r.yml`]:
            'rule: r\nsource: recoverable\nsource_headings:\n  - Kept Section\nrows:\n  - heading: Kept Section\n    disposition: carried\n    target: src/skills/x/SKILL.md#No Such Heading\n    reason: the whole section moved verbatim into the skill body\n',
    });
    const vague = mk({
        'src/rules/r.md': RULE,
        'src/skills/x/SKILL.md': TARGET,
        [`${LEDGER_DIR}/r.yml`]:
            'rule: r\nsource: recoverable\nsource_headings:\n  - Kept Section\nrows:\n  - heading: Kept Section\n    disposition: dropped\n    reason: secondary\n',
    });
    const noLedger = mk({ 'src/rules/r.md': RULE, 'src/skills/x/SKILL.md': TARGET });
    const run = (root: string): number => {
        process.env['LINT_MIGRATION_LEDGER_ROOT'] = root;
        try {
            return runGateCli(REAL_REPO_ROOT, 'src/scripts/lint_rule_migration_ledger.ts', ['--quiet'], root);
        } finally {
            delete process.env['LINT_MIGRATION_LEDGER_ROOT'];
        }
    };
    try {
        return runSelfTest({
            gate: 'lint_rule_migration_ledger',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                { name: 'a complete ledger passes', expect: 'accept', run: () => run(ok) },
                { name: 'a pre-migration heading with no row is rejected', expect: 'reject', run: () => run(missingRow) },
                { name: 'a target anchor that does not resolve is rejected', expect: 'reject', run: () => run(badAnchor) },
                { name: 'a known-empty reason ("secondary") is rejected', expect: 'reject', run: () => run(vague) },
                { name: 'a migrated rule with no ledger at all is rejected', expect: 'reject', run: () => run(noLedger) },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv?: readonly string[]): number {
    const raw = argv ?? process.argv.slice(2);
    if (raw.includes('--self-test')) {
        return selfTest();
    }
    const args = parseArgs(raw);
    const root = process.env['LINT_MIGRATION_LEDGER_ROOT'] ?? REAL_REPO_ROOT;

    const rules = migratedRules(root);
    const dir = path.join(root, LEDGER_DIR);
    const ledgerFiles = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((n) => n.endsWith('.yml')).sort()
        : [];

    const ledger = new GateLedger('lint_rule_migration_ledger');
    ledger.plan(rules.map((r) => `src/rules/${r}.md`));

    const errors: string[] = [];
    const haveLedger = new Set(ledgerFiles.map((n) => n.slice(0, -4)));
    for (const r of rules) {
        if (!haveLedger.has(r)) {
            errors.push(
                `src/rules/${r}.md carries a migration line but has no ledger at ${LEDGER_DIR}/${r}.yml — ` +
                    'a lossy transform with no record is the gap this ledger exists to close',
            );
            ledger.fail(`src/rules/${r}.md`, 'no ledger');
        } else {
            ledger.complete(`src/rules/${r}.md`);
        }
    }
    for (const name of ledgerFiles) {
        const file = path.join(dir, name);
        let doc: LedgerFile;
        try {
            doc = parseYaml(fs.readFileSync(file, 'utf-8')) as LedgerFile;
        } catch (e) {
            errors.push(`${name}: unreadable YAML — ${String(e)}`);
            continue;
        }
        errors.push(...checkLedger(root, file, doc));
    }

    const tally = ledger.finalize();

    if (args.json) {
        process.stdout.write(`${JSON.stringify({ version: 1, errors, ledger: tally }, null, 2)}\n`);
        return errors.length > 0 ? 1 : 0;
    }

    if (errors.length > 0) {
        process.stderr.write(`❌  lint_rule_migration_ledger: ${String(errors.length)} issue(s):\n`);
        for (const e of errors) {
            process.stderr.write(`  • ${e}\n`);
        }
    } else if (!args.quiet) {
        process.stdout.write(
            `✅  rule-migration ledger clean — ${String(rules.length)} migrated rule(s), ` +
                `${String(ledgerFiles.length)} ledger(s).\n`,
        );
    }

    reportScanned({
        gate: 'lint_rule_migration_ledger',
        scanned: rules.length,
        units: 'migrated rule(s)',
        roots: ['src/rules', LEDGER_DIR],
    });
    return errors.length > 0 ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
        return true;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
