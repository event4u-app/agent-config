#!/usr/bin/env node
/**
 * Every hook concern added from here on carries a recorded answer — or fails.
 *
 * The sibling of `check_skill_admissions.ts`, same shape and same reasons, with
 * one structural difference that changes the mechanism rather than the policy.
 *
 * ## Forward-only, and why the scope is computed differently
 *
 * A skill is a FILE, so its gate reads `git diff --diff-filter=A` and the 299
 * already in the tree are grandfathered by construction. A concern is a KEY
 * INSIDE ONE FILE — `src/scripts/hook_manifest.yaml` — so a file-level diff
 * says only "the manifest changed", which is true of every concern edit and
 * discriminates nothing.
 *
 * The scope here is therefore a SET DIFFERENCE over the parsed ids: the
 * concerns at HEAD minus the concerns at the base ref. Both sides go through
 * the same scoped parser (`_lib/concern_estate.ts`), for the reason that module
 * exists — two readings of one corpus is how a gate comes to compare a number
 * against a differently-derived number.
 *
 * The grandfathering is identical in effect: the 55 already in the tree need no
 * ledger row and cannot be forgotten off one.
 *
 * ## The questions are NOT the skill questions
 *
 * They are derived from `docs/contracts/hook-architecture-v1.md`, because what
 * makes a concern risky is different from what makes a skill risky. A concern
 * binds to a slot, on hosts that may or may not honour a deny, inside a
 * per-event budget — and none of that has a skill analogue.
 *
 * ## A rejected row is first-class
 *
 * `decision: rejected` records a visible "no", and a rejected row naming a
 * concern that EXISTS is itself a failure: it means the refusal was recorded
 * and then overridden without the row being updated, which is worse than no
 * record at all.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

import { CONCERN_MANIFEST_POSIX, concernIds } from './_lib/concern_estate.js';

const REPO_ROOT = process.cwd();

export const LEDGER_REL = 'agents/decisions/concern-admissions.jsonl';

/**
 * The five answers, each a non-empty sentence.
 *
 * Every one is a question `hook-architecture-v1.md` makes answerable and a
 * reviewer would otherwise have to reconstruct from the manifest by hand.
 */
export const REQUIRED_ANSWERS = [
    /** Which lifecycle slot it binds — `pre_tool_use`, `stop`, and so on. */
    'slot',
    /** Which hosts actually BIND it, as opposed to which declare the slot. */
    'binding_hosts',
    /** What it does where the host ignores a deny — the honest-coverage answer. */
    'behaviour_where_deny_ignored',
    /** Why an existing concern cannot carry this. */
    'why_not_extend',
    /** What it costs against the per-(platform,event) budget. */
    'per_event_budget_impact',
] as const;

export const DECISIONS = ['admitted', 'rejected'] as const;
export type Decision = (typeof DECISIONS)[number];

export interface AdmissionRow {
    concern: string;
    decision: Decision;
    date: string;
    slot?: string;
    binding_hosts?: string;
    behaviour_where_deny_ignored?: string;
    why_not_extend?: string;
    per_event_budget_impact?: string;
    /** Free-form; only meaningful on a `rejected` row. */
    instead?: string;
}

export interface Finding {
    concern: string;
    kind: 'missing_row' | 'incomplete_row' | 'rejected_but_present' | 'bad_decision' | 'duplicate_row';
    message: string;
}

function isRow(v: unknown): v is AdmissionRow {
    return typeof v === 'object' && v !== null && typeof (v as AdmissionRow).concern === 'string';
}

export function readLedger(root = REPO_ROOT): AdmissionRow[] {
    const p = path.join(root, LEDGER_REL);
    if (!fs.existsSync(p)) {
        // An absent ledger is not an empty corpus: it is a gate with nothing to
        // read, and the forward-only scope means an absent ledger only matters
        // once something has been added.
        return [];
    }
    const out: AdmissionRow[] = [];
    let n = 0;
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
        n += 1;
        const t = line.trim();
        if (t === '') continue;
        let parsed: unknown;
        try {
            parsed = JSON.parse(t);
        } catch {
            throw new Error(
                `${LEDGER_REL}:${String(n)} is not valid JSON. A malformed ledger is a hard ` +
                    'failure, never a skipped line — a gate that silently drops rows admits by accident.',
            );
        }
        if (isRow(parsed)) out.push(parsed);
    }
    return out;
}

/** Concern ids declared at a git ref, or `null` when the manifest is unreadable there. */
export function concernsAt(root: string, ref: string): Set<string> | null {
    const res = spawnSync('git', ['show', `${ref}:${CONCERN_MANIFEST_POSIX}`], {
        cwd: root,
        encoding: 'utf-8',
        maxBuffer: 32 * 1024 * 1024,
    });
    if (res.status !== 0) return null;
    return new Set(concernIds(res.stdout ?? ''));
}

/** Concern ids in the working tree. */
export function liveConcerns(root = REPO_ROOT): Set<string> {
    const p = path.join(root, CONCERN_MANIFEST_POSIX);
    if (!fs.existsSync(p)) return new Set();
    return new Set(concernIds(fs.readFileSync(p, 'utf-8')));
}

/**
 * Concerns ADDED since `baseRef` — the forward-only scope.
 *
 * A set difference rather than a file diff, because a concern is a key inside
 * one file. `null` from `concernsAt` means the manifest could not be read at
 * the base, in which case NOTHING is treated as added: a ref that predates the
 * file must not retroactively demand a row for all 55.
 */
export function addedConcerns(root: string, baseRef: string): string[] {
    const base = concernsAt(root, baseRef);
    if (base === null) return [];
    return [...liveConcerns(root)].filter((id) => !base.has(id)).sort();
}

export function evaluate(root = REPO_ROOT, baseRef: string | null): Finding[] {
    const findings: Finding[] = [];
    const rows = readLedger(root);
    const live = liveConcerns(root);

    const seen = new Map<string, number>();
    for (const r of rows) {
        seen.set(r.concern, (seen.get(r.concern) ?? 0) + 1);
        if (!(DECISIONS as readonly string[]).includes(r.decision)) {
            findings.push({
                concern: r.concern,
                kind: 'bad_decision',
                message: `decision must be one of ${DECISIONS.join(' | ')}, got ${JSON.stringify(r.decision)}`,
            });
            continue;
        }
        if (r.decision === 'rejected' && live.has(r.concern)) {
            findings.push({
                concern: r.concern,
                kind: 'rejected_but_present',
                message:
                    'the ledger records a REJECTION and the concern exists in the manifest. A refusal that ' +
                    'was later overridden without updating its row is worse than no record at all.',
            });
        }
    }
    for (const [id, n] of seen) {
        if (n > 1) {
            findings.push({
                concern: id,
                kind: 'duplicate_row',
                message: `${String(n)} rows name this concern; one decision per concern, amended in place`,
            });
        }
    }

    if (baseRef === null) return findings;

    const admitted = new Map(rows.filter((r) => r.decision === 'admitted').map((r) => [r.concern, r]));
    for (const id of addedConcerns(root, baseRef)) {
        const row = admitted.get(id);
        if (row === undefined) {
            findings.push({
                concern: id,
                kind: 'missing_row',
                message: `added since ${baseRef} with no \`admitted\` row in ${LEDGER_REL}`,
            });
            continue;
        }
        const blank = REQUIRED_ANSWERS.filter((k) => {
            const v = row[k];
            return typeof v !== 'string' || v.trim() === '';
        });
        if (blank.length > 0) {
            findings.push({
                concern: id,
                kind: 'incomplete_row',
                message: `row is missing a real answer for: ${blank.join(', ')}`,
            });
        }
    }
    return findings;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

import { reportScanned } from './_lib/scan_scope.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import * as os from 'node:os';

function resolveBase(root: string): string | null {
    for (const ref of ['origin/main', 'main']) {
        const r = spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: root, encoding: 'utf-8' });
        if (r.status === 0) return ref;
    }
    return null;
}

const MANIFEST = (ids: readonly string[]): string =>
    ['concerns:', ...ids.map((i) => `  ${i}:\n    severity: advisory`), 'roles:', '  dev:', ''].join('\n');

const ROW = (concern: string, decision: Decision, blank?: string): string =>
    JSON.stringify({
        concern,
        decision,
        date: '2026-08-30',
        ...Object.fromEntries(REQUIRED_ANSWERS.map((k) => [k, k === blank ? '' : `a real answer for ${k}`])),
    });

function selfTest(): number {
    const roots: string[] = [];
    const script = path.join('src', 'scripts', 'check_concern_admissions.ts');

    /** A throwaway repo with a base commit and a working-tree change on top. */
    const fixture = (opts: { base: readonly string[]; head: readonly string[]; ledger?: string }): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-selftest-'));
        roots.push(dir);
        const g = (...a: string[]): void => {
            spawnSync('git', a, { cwd: dir, encoding: 'utf-8' });
        };
        const put = (rel: string, body: string): void => {
            fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(dir, rel), body, 'utf-8');
        };
        g('init', '-q', '-b', 'main');
        g('config', 'user.email', 'selftest@local');
        g('config', 'user.name', 'selftest');
        put(CONCERN_MANIFEST_POSIX, MANIFEST(opts.base));
        put(LEDGER_REL, '');
        g('add', '-A');
        g('commit', '-q', '-m', 'base');
        put(CONCERN_MANIFEST_POSIX, MANIFEST(opts.head));
        if (opts.ledger !== undefined) put(LEDGER_REL, `${opts.ledger}\n`);
        // repoRoot locates tsx AND resolves the relative script path, so it is
        // THIS checkout; cwd and --root are the fixture.
        return runGateCli(REPO_ROOT, script, ['--base', 'main', '--root', dir], dir);
    };

    const cases: SelfTestCase[] = [
        {
            name: 'no concern added → accept',
            expect: 'accept',
            run: () => fixture({ base: ['one'], head: ['one'] }),
        },
        {
            name: 'a concern added with no ledger row → reject',
            expect: 'reject',
            run: () => fixture({ base: ['one'], head: ['one', 'two'] }),
        },
        {
            name: 'a concern added WITH a complete admitted row → accept',
            expect: 'accept',
            run: () => fixture({ base: ['one'], head: ['one', 'two'], ledger: ROW('two', 'admitted') }),
        },
        {
            // A row that exists but answers nothing is the shape a gate is
            // easiest to satisfy dishonestly, so it is tested explicitly.
            name: 'an admitted row with a blank answer → reject',
            expect: 'reject',
            run: () =>
                fixture({ base: ['one'], head: ['one', 'two'], ledger: ROW('two', 'admitted', 'why_not_extend') }),
        },
        {
            name: 'a rejected row naming a LIVE concern → reject',
            expect: 'reject',
            run: () => fixture({ base: ['one', 'two'], head: ['one', 'two'], ledger: ROW('two', 'rejected') }),
        },
        {
            // The grandfathering, asserted rather than assumed: pre-existing
            // concerns must never demand a row.
            name: 'the pre-existing set needs no rows → accept',
            expect: 'accept',
            run: () => fixture({ base: ['a', 'b', 'c'], head: ['a', 'b', 'c'] }),
        },
    ];

    try {
        return runSelfTest({ gate: 'check_concern_admissions', cases, minCases: 5, minRejectCases: 3 });
    } finally {
        for (const d of roots) fs.rmSync(d, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2), rootIn = REPO_ROOT): number {
    if (argv.includes('--self-test')) return selfTest();
    const i = argv.indexOf('--base');
    const j = argv.indexOf('--root');
    const root = j >= 0 && argv[j + 1] !== undefined ? path.resolve(argv[j + 1] as string) : rootIn;
    const baseRef = i >= 0 ? (argv[i + 1] as string) : resolveBase(root);

    const rows = readLedger(root);
    const added = baseRef === null ? [] : addedConcerns(root, baseRef);
    reportScanned({
        gate: 'check_concern_admissions',
        scanned: rows.length + added.length,
        units: 'admission row(s) + added concern(s)',
        roots: [LEDGER_REL, CONCERN_MANIFEST_POSIX],
        // The state this ships in: 55 concerns are grandfathered by the
        // forward-only set-difference scope, so the first row arrives with the
        // first new concern. `readLedger` throws on a MALFORMED ledger, so
        // "moved" and "empty" stay different verdicts.
        allowEmpty:
            'EMPTY_VALID: no concern has been admitted or refused through this ledger yet — the ' +
            'pre-existing 55 are grandfathered by the forward-only set-difference scope, and a ' +
            'malformed ledger is a separate hard error in readLedger()',
    });

    const findings = evaluate(root, baseRef);
    if (baseRef === null) {
        process.stdout.write(
            '  ⏭️  no base ref resolved — the added-concern scope could not be computed; ' +
                'ledger consistency was still checked\n',
        );
    }
    if (findings.length === 0) {
        process.stdout.write(
            `✅  check_concern_admissions: ${String(added.length)} concern(s) added since ` +
                `${baseRef ?? '<no base>'}, each carrying a recorded answer.\n`,
        );
        return 0;
    }
    process.stderr.write(`❌  check_concern_admissions: ${String(findings.length)} finding(s):\n`);
    for (const f of findings) process.stderr.write(`  🔴 ${f.concern} [${f.kind}] — ${f.message}\n`);
    return 1;
}

if (process.argv[1] !== undefined && process.argv[1].includes('check_concern_admissions')) {
    process.exit(main());
}
