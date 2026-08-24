#!/usr/bin/env tsx
/**
 * `check_skill_admissions` — the skill-growth gate's answers, in a record.
 *
 * `skill-writing/references/procedure.md` § 0b already asks the five questions a
 * new skill must answer (family · capability · why-not-extend · why-not-a-guideline
 * · visibility tier). It says to answer them **in the PR body**, and
 * `check_finding_dispositions.ts:11` rejects that exact surface for findings in
 * its own words — a comment is *"mutable and unaudited; it is transport, not a
 * record"*. So the right questions were being kept where this repository has
 * already ruled answers may not be kept, and there was consequently no ledger of
 * refusals: +8 skills landed in one release with no visible "no".
 *
 * This gate reads the ledger instead. FORWARD-ONLY on the `command-verbs.yml`
 * precedent: only skills ADDED since the base ref are required to carry a row,
 * so the 299 already in the tree are grandfathered by construction rather than by
 * a list someone has to maintain.
 *
 * WHY REFUSALS ARE IN THE SAME FILE. A ledger of what shipped is a changelog.
 * The reviewer's ask was a visible "no", so `decision: rejected` is a first-class
 * state and a rejected row must NOT name a skill that exists — otherwise the
 * record says a capability was refused while the capability ships.
 *
 * Exit codes: 0 clean · 1 findings · 2 dead scope or malformed ledger.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { type SelfTestCase, runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { SKILLS_POSIX } from './_lib/skill_estate.js';

const HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..');

export const LEDGER_REL = 'agents/decisions/skill-admissions.jsonl';

/** The five § 0b answers, each a non-empty sentence. */
export const REQUIRED_ANSWERS = [
    'family',
    'capability',
    'why_not_extend',
    'why_not_a_guideline',
    'visibility',
] as const;

export const DECISIONS = ['admitted', 'rejected'] as const;
export type Decision = (typeof DECISIONS)[number];

export interface AdmissionRow {
    skill: string;
    decision: Decision;
    date: string;
    family?: string;
    capability?: string;
    why_not_extend?: string;
    why_not_a_guideline?: string;
    visibility?: string;
    /** Free-form; only meaningful on a `rejected` row. */
    instead?: string;
}

export interface Finding {
    skill: string;
    kind: 'missing_row' | 'incomplete_row' | 'rejected_but_present' | 'bad_decision' | 'duplicate_row';
    message: string;
}

/** A `_comment` / `_note` bookkeeping line is not an admission row. */
function isRow(v: unknown): v is AdmissionRow {
    return typeof v === 'object' && v !== null && typeof (v as AdmissionRow).skill === 'string';
}

export function readLedger(root = REPO_ROOT): AdmissionRow[] {
    const p = path.join(root, LEDGER_REL);
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        throw new DeadScopeError(
            'check_skill_admissions',
            `${LEDGER_REL} is missing — the ledger IS this gate's corpus, and an absent ` +
                'one cannot be read as "no admissions to check".',
        );
    }
    const rows: AdmissionRow[] = [];
    let n = 0;
    for (const line of text.split('\n')) {
        n += 1;
        if (line.trim() === '') continue;
        let parsed: unknown;
        try {
            parsed = JSON.parse(line);
        } catch {
            throw new DeadScopeError(
                'check_skill_admissions',
                `${LEDGER_REL}:${String(n)} is not valid JSON. A malformed ledger is a hard ` +
                    'error, never a neutral skip.',
            );
        }
        if (isRow(parsed)) rows.push(parsed);
    }
    return rows;
}

/** Skill directories present under `root`. */
export function liveSkills(root = REPO_ROOT): Set<string> {
    const base = path.join(root, ...SKILLS_POSIX.split('/'));
    const out = new Set<string>();
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries) {
        if (e.isDirectory() && fs.existsSync(path.join(base, e.name, 'SKILL.md'))) out.add(e.name);
    }
    return out;
}

/**
 * Skills ADDED since `baseRef` — the forward-only scope.
 *
 * Read from `git diff --name-status` rather than from a list, so the 299 skills
 * already in the tree need no grandfather entry and cannot be forgotten off one.
 */
export function addedSkills(root: string, baseRef: string): string[] {
    const out = new Set<string>();
    const skillOf = (file: string): void => {
        const m = new RegExp(`^${SKILLS_POSIX}/([^/]+)/SKILL\\.md$`).exec(file.trim());
        if (m !== null) out.add(m[1]!);
    };

    // Committed additions against the base ref.
    const diff = spawnSync(
        'git',
        ['diff', '--name-status', '--diff-filter=A', `${baseRef}...HEAD`, '--', SKILLS_POSIX],
        { cwd: root, encoding: 'utf-8' },
    );
    if (diff.status === 0) {
        for (const line of (diff.stdout ?? '').split('\n')) skillOf(line.split('\t')[1] ?? '');
    }

    // UNTRACKED additions, and this half is not a nicety. Without it the gate
    // only sees a skill after it is committed, so `check_gate_coverage --canary`
    // plants a skill, the gate stays green, and the canary correctly reports the
    // gate dead — which is how this was found. It is also the wrong direction for
    // a contributor: the point of a shift-left gate is to fail before the commit,
    // which is the same reason `check_secret_leak` scans "changed vs origin/main
    // + untracked".
    const untracked = spawnSync(
        'git',
        ['ls-files', '--others', '--exclude-standard', '--', SKILLS_POSIX],
        { cwd: root, encoding: 'utf-8' },
    );
    if (untracked.status === 0) {
        for (const line of (untracked.stdout ?? '').split('\n')) skillOf(line);
    }
    return [...out].sort();
}

export function validate(rows: AdmissionRow[], live: Set<string>, added: readonly string[]): Finding[] {
    const out: Finding[] = [];
    const byName = new Map<string, AdmissionRow[]>();
    for (const r of rows) {
        const list = byName.get(r.skill) ?? [];
        list.push(r);
        byName.set(r.skill, list);
    }

    for (const [skill, list] of byName) {
        if (list.length > 1) {
            out.push({
                skill,
                kind: 'duplicate_row',
                message: `${String(list.length)} rows for one skill — a ledger with two answers has none.`,
            });
        }
        for (const r of list) {
            if (!(DECISIONS as readonly string[]).includes(r.decision)) {
                out.push({
                    skill,
                    kind: 'bad_decision',
                    message: `decision "${String(r.decision)}" is not one of ${DECISIONS.join(' | ')}.`,
                });
                continue;
            }
            if (r.decision === 'rejected' && live.has(skill)) {
                out.push({
                    skill,
                    kind: 'rejected_but_present',
                    message:
                        'recorded as REJECTED but the skill exists. A record that says a capability ' +
                        'was refused while it ships is worse than no record.',
                });
            }
        }
    }

    for (const skill of added) {
        const list = byName.get(skill) ?? [];
        if (list.length === 0) {
            out.push({
                skill,
                kind: 'missing_row',
                message:
                    `added since the base ref with no row in ${LEDGER_REL}. ` +
                    'Answer the five skill-growth questions there, not in the PR body.',
            });
            continue;
        }
        const row = list[0]!;
        if (row.decision !== 'admitted') continue; // a rejected row is caught above
        const blank = REQUIRED_ANSWERS.filter((k) => {
            const v = row[k];
            return typeof v !== 'string' || v.trim().length < 12;
        });
        if (blank.length > 0) {
            out.push({
                skill,
                kind: 'incomplete_row',
                message:
                    `row present but ${blank.join(', ')} ${blank.length === 1 ? 'is' : 'are'} ` +
                    'missing or under 12 characters. A one-word answer is the boilerplate this ' +
                    'gate exists to reject, not an answer.',
            });
        }
    }
    return out;
}

export interface Verdict {
    findings: Finding[];
    rows: number;
    added: string[];
    baseRef: string | null;
    /** Per-target accounting: "clean" and "read almost nothing" must differ. */
    ledger: GateLedger;
}

/** `origin/main`, or a merge parent, or null. Mirrors the estate gate's resolution. */
function resolveBase(root: string): string | null {
    for (const ref of ['origin/main', 'main']) {
        const r = spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], {
            cwd: root,
            encoding: 'utf-8',
        });
        if (r.status === 0) return ref;
    }
    return null;
}

export function evaluate(root = REPO_ROOT, baseRefIn?: string): Verdict {
    const rows = readLedger(root);
    const live = liveSkills(root);
    const baseRef = baseRefIn ?? resolveBase(root);
    const added = baseRef === null ? [] : addedSkills(root, baseRef);
    const findings = validate(rows, live, added);

    // Per-target accounting over BOTH halves of the corpus, because the two fail
    // differently: a ledger row can contradict itself while no skill was added,
    // and a skill can be added while the ledger is untouched. Counting only one
    // would report a denominator that hides the other.
    const ledger = new GateLedger('check_skill_admissions');
    const failed = new Set(findings.map((f) => f.skill));
    const seen = new Set<string>();
    for (const r of rows) {
        const target = `row:${r.skill}`;
        if (seen.has(target)) continue; // a duplicate row is one target, already planned
        seen.add(target);
        ledger.plan(target);
        if (failed.has(r.skill)) {
            ledger.fail(target, 'see findings');
        } else {
            ledger.complete(target);
        }
    }
    for (const s of added) {
        const target = `added:${s}`;
        ledger.plan(target);
        if (failed.has(s)) {
            ledger.fail(target, 'see findings');
        } else {
            ledger.complete(target);
        }
    }
    if (baseRef === null) {
        // Stated, never assumed empty: without a base ref the added-skill half
        // did not run, and a silent zero there is a pass over an unread corpus.
        ledger.plan('added-scope');
        ledger.skip('added-scope', 'precondition_unmet');
    }
    return { findings, rows: rows.length, added, baseRef, ledger };
}

const ANSWERS = {
    family: 'engineering-base, alongside the other build-time skills',
    capability: 'reads a lockfile shape no existing skill parses',
    why_not_extend: 'the nearest is supply-chain-intake and it owns intake, not parsing',
    why_not_a_guideline: 'an executable workflow with a verification step, not reference prose',
    visibility: 'core, in the engineering-base pack',
} as const;

/**
 * A throwaway git repo: one committed skill and a bookkeeping-only ledger on
 * `main`, checked out on a branch.
 *
 * Real git, because the forward-only scope IS a `git diff` — a fixture without
 * history would exercise a different code path than the one that runs.
 */
function selfTestRepo(tmp: string): string {
    const dir = fs.mkdtempSync(path.join(tmp, 'repo-'));
    const g = (...a: string[]): void => {
        const r = spawnSync('git', a, { cwd: dir, encoding: 'utf-8' });
        if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr ?? ''}`);
    };
    const w = (rel: string, body: string): void => {
        const q = path.join(dir, rel);
        fs.mkdirSync(path.dirname(q), { recursive: true });
        fs.writeFileSync(q, body);
    };
    g('init', '-q', '-b', 'main');
    g('config', 'user.email', 'a@b.c');
    g('config', 'user.name', 'selftest');
    g('config', 'commit.gpgsign', 'false');
    w('src/skills/existing/SKILL.md', '---\nname: existing\ndescription: Pre-existing.\n---\n');
    w(LEDGER_REL, '{"_comment":"self-test fixture"}\n');
    g('add', '-A');
    g('commit', '-qm', 'base');
    g('checkout', '-qb', 'feat/change');
    return dir;
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skadm-st-'));
    const run = (dir: string): number =>
        runGateCli(REPO_ROOT, 'src/scripts/check_skill_admissions.ts', ['--root', dir, '--base', 'main'], dir);
    const commit = (dir: string): void => {
        spawnSync('git', ['add', '-A'], { cwd: dir });
        spawnSync('git', ['commit', '-qm', 'probe'], { cwd: dir });
    };
    const addSkill = (dir: string, name: string): void => {
        const q = path.join(dir, 'src', 'skills', name);
        fs.mkdirSync(q, { recursive: true });
        fs.writeFileSync(path.join(q, 'SKILL.md'), `---\nname: ${name}\ndescription: New.\n---\n`);
    };
    const append = (dir: string, row: Record<string, unknown>): void => {
        fs.appendFileSync(path.join(dir, LEDGER_REL), `${JSON.stringify(row)}\n`);
    };
    const cases: SelfTestCase[] = [
        {
            name: 'nothing added, empty ledger → accept (the shipped state)',
            expect: 'accept',
            run: () => run(selfTestRepo(tmp)),
        },
        {
            name: 'an added skill with a complete row → accept',
            expect: 'accept',
            run: () => {
                const d = selfTestRepo(tmp);
                addSkill(d, 'fresh');
                append(d, { skill: 'fresh', decision: 'admitted', date: '2026-08-24', ...ANSWERS });
                commit(d);
                return run(d);
            },
        },
        {
            name: 'an added skill with NO row → reject',
            expect: 'reject',
            run: () => {
                const d = selfTestRepo(tmp);
                addSkill(d, 'fresh');
                commit(d);
                return run(d);
            },
        },
        {
            name: 'a one-word answer → reject (boilerplate is not an answer)',
            expect: 'reject',
            run: () => {
                const d = selfTestRepo(tmp);
                addSkill(d, 'fresh');
                append(d, { skill: 'fresh', decision: 'admitted', date: '2026-08-24', ...ANSWERS, family: 'eng' });
                commit(d);
                return run(d);
            },
        },
        {
            name: 'a rejected row naming a skill that EXISTS → reject',
            expect: 'reject',
            run: () => {
                const d = selfTestRepo(tmp);
                append(d, { skill: 'existing', decision: 'rejected', date: '2026-08-24', instead: 'folded in' });
                commit(d);
                return run(d);
            },
        },
        {
            name: 'an unknown decision value → reject',
            expect: 'reject',
            run: () => {
                const d = selfTestRepo(tmp);
                append(d, { skill: 'whatever', decision: 'maybe', date: '2026-08-24' });
                commit(d);
                return run(d);
            },
        },
        {
            name: 'a missing ledger → reject (dead scope, never a clean run)',
            expect: 'reject',
            run: () => {
                const d = selfTestRepo(tmp);
                fs.rmSync(path.join(d, LEDGER_REL));
                commit(d);
                return run(d);
            },
        },
        {
            name: 'a malformed ledger line → reject',
            expect: 'reject',
            run: () => {
                const d = selfTestRepo(tmp);
                fs.appendFileSync(path.join(d, LEDGER_REL), 'not json\n');
                commit(d);
                return run(d);
            },
        },
    ];
    try {
        return runSelfTest({
            gate: 'check_skill_admissions',
            cases,
            minCases: 8,
            minRejectCases: 6,
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2), rootIn = REPO_ROOT): number {
    if (argv.includes('--self-test')) return selfTest();
    const i = argv.indexOf('--base');
    const baseRef = i >= 0 ? argv[i + 1] : undefined;
    // `--root` exists for the tests, which drive the REAL binary over throwaway
    // git repos. Without it the entry point would always read this checkout no
    // matter the cwd, and every fixture case would silently assert against the
    // live tree instead of the tree it built — the shape that makes a test look
    // green while testing nothing.
    const j = argv.indexOf('--root');
    const root = j >= 0 && argv[j + 1] !== undefined ? path.resolve(argv[j + 1]!) : rootIn;
    let v: Verdict;
    try {
        v = evaluate(root, baseRef);
        // The corpus is the ledger's rows PLUS the added-skill set: a gate that
        // reports only the second would print `scanned: 0` on every change that
        // adds no skill, which is indistinguishable from a dead scope.
        reportScanned({
            gate: 'check_skill_admissions',
            scanned: v.rows,
            units: 'admission row(s)',
            roots: [LEDGER_REL],
            // A ledger that exists and carries no admission row yet is a REAL
            // state, and it is the state this file ships in: the 299 skills
            // already in the tree are grandfathered by the forward-only diff
            // scope, so the first row arrives with the first new skill.
            //
            // The dead-scope risk this normally guards against is covered one
            // layer up rather than waived: `readLedger` THROWS a DeadScopeError
            // when the file is missing or malformed, so "the ledger moved" and
            // "the ledger is empty" are different verdicts. Without that, this
            // allowEmpty would be the hole.
            allowEmpty:
                'EMPTY_VALID: no skill has been admitted or refused through this ledger yet — ' +
                'the pre-existing 299 are grandfathered by the forward-only diff scope, and a ' +
                'missing or malformed ledger is a separate hard error in readLedger()',
        });
        v.ledger.report(argv.includes('--quiet') ? () => undefined : process.stdout.write.bind(process.stdout));
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    if (v.baseRef === null) {
        process.stdout.write(
            '  ⏭️  no base ref resolved — the added-skill scope could not be computed; ' +
                'ledger consistency was still checked\n',
        );
    }
    if (v.findings.length === 0) {
        process.stdout.write(
            `✅  skill admissions: ${String(v.rows)} row(s), ` +
                `${String(v.added.length)} skill(s) added since ${v.baseRef ?? 'the base ref'}, all accounted for.\n`,
        );
        return 0;
    }
    for (const f of v.findings) {
        process.stderr.write(`❌  ${f.skill} [${f.kind}] ${f.message}\n`);
    }
    process.stderr.write(`\n${String(v.findings.length)} finding(s) in ${LEDGER_REL}.\n`);
    return 1;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE)) {
    process.exit(main());
}
