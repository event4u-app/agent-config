// Tests for the operator command surface — road-to-governed-harness-evolution
// Phase 3 step 3.6.
//
// The verify clause has two conjuncts and they are checked differently:
//
//   1. "every phase's exit criterion is reachable through a named verb" — the
//      Phase-3 half is machine-checked against `EXIT_CRITERION_COVERAGE`. The
//      Phases-4-to-7 half is NOT claimed: those phases are unbuilt, so no verb
//      can reach an exit criterion they do not have. That gap is asserted here
//      as a gap rather than papered over, so a later phase landing without a
//      verb fails a test instead of passing silently.
//
//   2. "no verb starts a resident process" — checked twice, statically and
//      dynamically. Statically: the module's bytes carry no timer, watcher,
//      unbounded loop, or `child_process` import, with the scanner exercised
//      against a synthetic daemon-shaped source so its red has been seen.
//      Dynamically: every verb is spawned under a hard timeout, and a verb that
//      left a resident child holding stdio would hold the pipe open and time
//      out — so a timeout is a positive detection, not a flake.
//
// `promote` gets its own block. It must refuse, it must name the blocker, and
// it must contain no expression that constructs a human approval.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    CLONES,
    FIXTURE,
    REPO_ROOT,
    TSX_BIN,
    acquireClonesLock,
    releaseClonesLock,
    removeClones,
} from './_bench_ab.js';
import {
    EXIT_CRITERION_COVERAGE,
    VERBS,
    legalNextStates,
} from '../../src/scripts/evolution_lab.js';
import { CANDIDATE_RECORD_VERSION, LIFECYCLE_SPINE } from '../../src/scripts/_lib/candidate_record.js';
import { PROMOTION_EVIDENCE_FIELDS } from '../../src/scripts/_lib/promotion_evidence.js';

const LAB_TS = join(REPO_ROOT, 'src', 'scripts', 'evolution_lab.ts');
const CLONE_TS = join(REPO_ROOT, 'src', 'scripts', 'bench_ab_clone.ts');
const HAVE_FIXTURE = existsSync(FIXTURE);

const scratch = mkdtempSync(join(tmpdir(), 'ac-lab-'));
afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
});

interface Ran {
    status: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
}

/**
 * Run a verb under a HARD timeout.
 *
 * The timeout is the dynamic no-daemon probe, not a convenience. `spawnSync`
 * waits for the child AND for its stdio pipes to close, so a verb that forked a
 * resident helper inheriting stdio would never let this return — it would be
 * killed at the deadline and come back with a signal. Every assertion below
 * checks `signal === null` for that reason.
 */
function lab(args: readonly string[], timeout = 120_000): Ran {
    const res = spawnSync(TSX_BIN, [LAB_TS, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout,
    });
    return {
        status: res.status,
        signal: res.signal,
        stdout: res.stdout ?? '',
        stderr: res.stderr ?? '',
    };
}

function writeRecord(name: string, over: Record<string, unknown> = {}): string {
    const body = {
        kind: 'candidate',
        version: CANDIDATE_RECORD_VERSION,
        id: name,
        dimension: 'content',
        lifecycle: 'proposed',
        mutations: [{ path: `.claude/rules/${name}.md`, content: `# ${name}\n` }],
        ...over,
    };
    const p = join(scratch, `${name}.json`);
    writeFileSync(p, `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
    return p;
}

// --- § the verb set and the coverage map ------------------------------------

describe('the verb set', () => {
    it('is exactly the seven verbs step 3.6 names', () => {
        expect([...VERBS]).toEqual([
            'inspect',
            'propose',
            'run',
            'compare',
            'explain',
            'promote',
            'clean',
        ]);
    });

    it('every criterion in the coverage map names real verbs, and every verb appears', () => {
        const named = new Set<string>();
        for (const [criterion, verbs] of Object.entries(EXIT_CRITERION_COVERAGE)) {
            expect(verbs.length, `${criterion} names no verb`).toBeGreaterThan(0);
            for (const v of verbs) {
                expect(VERBS, `${criterion} -> ${v}`).toContain(v);
                named.add(v);
            }
        }
        // The direction that catches a dead verb: a verb reaching no criterion
        // is either unnecessary or an uncovered criterion nobody wrote down.
        expect([...named].sort()).toEqual([...VERBS].sort());
    });

    it('the coverage map reaches only phases that EXIST, and says so', () => {
        // The honest half of the verify clause. Phase 0's 0.4 and 0.5 joined
        // the map when their guards got call sites in `propose` and `run`
        // (blocker guard-call-site-integration); Phases 4-7 are still unbuilt,
        // so a verb cannot reach a criterion they do not have. If a later phase
        // ships and its criteria are added here, this assertion fails and
        // forces the claim "every phase" to be re-examined rather than
        // silently inherited.
        for (const key of Object.keys(EXIT_CRITERION_COVERAGE)) {
            expect(key.startsWith('0.') || key.startsWith('3.'), key).toBe(true);
        }
        // Both built phases are actually represented — without this the
        // assertion above would pass on an empty or 3-only map.
        const phases = new Set(Object.keys(EXIT_CRITERION_COVERAGE).map((k) => k.slice(0, 2)));
        expect(phases).toEqual(new Set(['0.', '3.']));
        const out = lab(['explain', '--criteria']);
        expect(out.status, out.stderr).toBe(0);
        expect(out.stdout).toContain('Phases 4-7 are unbuilt');
    });

    it('rejects an unknown verb with the usage exit code', () => {
        const out = lab(['daemonize']);
        expect(out.status).toBe(2);
        expect(out.stderr).toContain("unknown verb 'daemonize'");
    });
});

// --- § no resident process, statically --------------------------------------

/**
 * Constructs that would let a verb outlive its invocation.
 *
 * Block comments are stripped first: this module DOCUMENTS what it refuses to
 * do, and a scanner that failed on the documentation would be a reason to stop
 * documenting it.
 */
export function stripBlockComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function findResidencyConstructs(source: string): string[] {
    const body = stripBlockComments(source);
    const banned: Array<[string, RegExp]> = [
        ['setInterval', /\bsetInterval\b/],
        ['setTimeout', /\bsetTimeout\b/],
        ['setImmediate', /\bsetImmediate\b/],
        ['child_process', /\bchild_process\b/],
        ['spawn', /\bspawn(Sync)?\s*\(/],
        ['fork', /\bfork\s*\(/],
        ['watch', /\bwatch(File)?\s*\(/],
        ['while-true', /\bwhile\s*\(\s*true\s*\)/],
        ['for-ever', /\bfor\s*\(\s*;\s*;\s*\)/],
        ['unref', /\.unref\s*\(/],
        ['detached', /\bdetached\s*:/],
    ];
    return banned.filter(([, re]) => re.test(body)).map(([name]) => name);
}

/** Any expression that would name a human approver the human did not give. */
export function findApproverSynthesis(source: string): string[] {
    const body = stripBlockComments(source);
    const banned: Array<[string, RegExp]> = [
        ['approver-literal', /\bapprover\s*:/],
        ['approvedAt-literal', /\bapprovedAt\s*:/],
        ['HumanApproval', /\bHumanApproval\b/],
        ['assertHumanApproval', /\bassertHumanApproval\b/],
    ];
    return banned.filter(([, re]) => re.test(body)).map(([name]) => name);
}

describe('no verb can start a resident process — static half', () => {
    it('the residency scanner fires on a daemon-shaped source (negative polarity)', () => {
        expect(findResidencyConstructs('setInterval(tick, 1000);')).toEqual(['setInterval']);
        expect(findResidencyConstructs("import cp from 'node:child_process';")).toEqual(['child_process']);
        expect(findResidencyConstructs('while (true) { poll(); }')).toEqual(['while-true']);
        expect(findResidencyConstructs('for (;;) { poll(); }')).toEqual(['for-ever']);
        expect(findResidencyConstructs('const c = spawn("node", []); c.unref();')).toEqual([
            'spawn',
            'unref',
        ]);
        expect(findResidencyConstructs('fs.watch(dir, cb)')).toEqual(['watch']);
        expect(findResidencyConstructs('spawn(cmd, args, { detached: true })')).toEqual([
            'spawn',
            'detached',
        ]);
    });

    it('the residency scanner is silent on a plain source (positive polarity)', () => {
        expect(findResidencyConstructs('export function main(){ return 0; }')).toEqual([]);
    });

    it('the real module carries none of them', () => {
        const source = readFileSync(LAB_TS, 'utf-8');
        // The stripper must not be why it passes: the raw file DOES mention
        // `child_process` in prose, and the stripped body must still be a
        // module rather than an empty string.
        expect(source).toContain('child_process');
        expect(stripBlockComments(source)).not.toContain('child_process');
        expect(stripBlockComments(source).length).toBeGreaterThan(4000);
        expect(findResidencyConstructs(source)).toEqual([]);
    });

    it('the module constructs no human approval (negative polarity first)', () => {
        expect(findApproverSynthesis("assertTransition(s, 'promoted', { approver: 'ci', approvedAt: 'x' })")).toEqual(
            ['approver-literal', 'approvedAt-literal'],
        );
        expect(findApproverSynthesis('const a: HumanApproval = load();')).toEqual(['HumanApproval']);
        expect(findApproverSynthesis("assertTransition(s, 'promoted')")).toEqual([]);
        expect(findApproverSynthesis(readFileSync(LAB_TS, 'utf-8'))).toEqual([]);
    });
});

// --- § no resident process, dynamically -------------------------------------

describe('no verb can start a resident process — dynamic half', () => {
    const invocations: Array<[string, string[], number[]]> = [
        ['--help', ['--help'], [0]],
        // 0 or 1: with no flags this lists candidate clones, and a sibling
        // test file may be creating or removing them concurrently. The
        // assertion this block owns is the SIGNAL, not the code.
        ['inspect', ['inspect'], [0, 1]],
        ['run (no record)', ['run'], [2]],
        ['compare', ['compare'], [0, 1]],
        ['explain --criteria', ['explain', '--criteria'], [0]],
        ['clean (dry run)', ['clean'], [0]],
    ];

    for (const [label, args, allowed] of invocations) {
        it(`${label} returns without a signal and within the deadline`, () => {
            const out = lab(args, 90_000);
            expect(out.signal, `${label} was killed — a resident child held stdio open`).toBeNull();
            expect(out.status, out.stderr).not.toBeNull();
            expect(allowed, `${label} exited ${String(out.status)}: ${out.stderr}`).toContain(out.status);
        });
    }
});

// --- § promote refuses ------------------------------------------------------

describe('promote', () => {
    it('refuses with the governance exit code and names the blocker', () => {
        const file = writeRecord('promo-a', { lifecycle: 'promotion-proposed' });
        const out = lab(['promote', '--record', file]);
        expect(out.signal).toBeNull();
        expect(out.status).toBe(3);
        expect(out.stderr).toContain('promote REFUSED');
        expect(out.stderr).toContain('merge-authority');
        expect(out.stderr).toContain('NAMED human approver');
        expect(out.stdout).toBe('');
    });

    it('refuses identically from EVERY spine state — there is no state that unlocks it', () => {
        // The failure this catches: a promote that refuses from `proposed`
        // because the transition skips stages, and silently succeeds from
        // `promotion-proposed` because the only remaining guard was the spine.
        for (const from of LIFECYCLE_SPINE) {
            if (from === 'promoted') {
                continue;
            }
            const file = writeRecord(`promo-${from}`, { lifecycle: from });
            const out = lab(['promote', '--record', file]);
            expect(out.status, `promote from ${from}`).toBe(3);
            expect(out.stderr, `promote from ${from}`).toContain('merge-authority');
        }
    });

    it('leaves the record file byte-identical (it performs nothing)', () => {
        const file = writeRecord('promo-untouched', { lifecycle: 'promotion-proposed' });
        const before = readFileSync(file, 'utf-8');
        expect(lab(['promote', '--record', file]).status).toBe(3);
        expect(readFileSync(file, 'utf-8')).toBe(before);
    });

    it('has no flag that supplies an approver', () => {
        const file = writeRecord('promo-flag', { lifecycle: 'promotion-proposed' });
        const out = lab(['promote', '--record', file, '--approver', 'Somebody']);
        expect(out.status).toBe(2);
        expect(out.stderr).toContain('unrecognized argument: --approver');
    });

    it('`promoted` is never a legal next state from a bare transition', () => {
        for (const from of LIFECYCLE_SPINE) {
            expect(legalNextStates(from)).not.toContain('promoted');
        }
        // The positive pole: the spine still advances, so the assertion above
        // is not passing because every transition is refused.
        expect(legalNextStates('proposed')).toEqual(['diagnostic-evaluated', 'rejected']);
    });
});

// --- § promote consumes the evidence package --------------------------------

describe('promote --evidence (7.1, 7.3, 7.4, 7.5)', () => {
    const validEvidence = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
        candidate_id: 'promo-ev',
        pathology_cell: 'routing-miss × laravel-migration',
        lineage: [],
        dimension: 'routing',
        selection: { trials: 12, wins: 9, summary: 'won 9 of 12' },
        sealed_result: { held: true, summary: 'held' },
        cost: { trials: 12, spend_cents: 430 },
        scope: { level: 'repo', transfer_evidence: [] },
        governance: {
            authority_basis: 'evidence',
            evidence_strength: 'E3',
            reopen_policy: 'directional',
            protected_dimensions: ['none'],
        },
        rollout: { stage: 'opt-in', bundle: 'b-7', opt_in_completed: false, changes_shipped_default: false },
        material_improvement: {
            baseline_text: 'Every request handler stays thin and delegates its business logic to a service or use case, because a handler that computes is a handler nobody can exercise without standing up the whole transport layer.',
            candidate_text: 'Index every foreign key and every column a query filters or orders on, and ship that index in the same migration that ships the query needing it, because a missing index is a query that works until it does not.',
            delta_percent: 7,
        },
        ...over,
    });

    function writeEvidence(name: string, doc: Record<string, unknown>): string {
        const p = join(scratch, `${name}.evidence.json`);
        writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`, 'utf-8');
        return p;
    }

    it('names the absent package when --evidence is not given', () => {
        const rec = writeRecord('promo-ev', { lifecycle: 'promotion-proposed' });
        const out = lab(['promote', '--record', rec]);
        expect(out.status).toBe(3);
        expect(out.stderr).toContain('evidence package: absent');
        // The governance refusal still fires — the evidence check is additional,
        // never a replacement for it.
        expect(out.stderr).toContain('merge-authority');
    });

    it('refuses EVERY absent field in turn, naming it, through the real CLI', () => {
        const rec = writeRecord('promo-ev', { lifecycle: 'promotion-proposed' });
        for (const field of PROMOTION_EVIDENCE_FIELDS) {
            const doc = validEvidence();
            delete doc[field];
            const out = lab(['promote', '--record', rec, '--evidence', writeEvidence(`miss-${field}`, doc)]);
            expect(out.status, `dropping ${field}`).toBe(3);
            expect(out.stderr, `dropping ${field}`).toContain(`'${field}' is required`);
        }
    });

    it('refuses a scope raise carrying one configuration\'s evidence (7.3)', () => {
        const rec = writeRecord('promo-ev', { lifecycle: 'promotion-proposed' });
        const doc = validEvidence({
            scope: {
                level: 'stack',
                raised_from: 'repo',
                transfer_evidence: [
                    { configuration: 'host-a', solver: 'solver-a', result: 'reproduced' },
                    { configuration: 'host-a', solver: 'solver-a', result: 'reproduced twice' },
                ],
            },
        });
        const out = lab(['promote', '--record', rec, '--evidence', writeEvidence('raise', doc)]);
        expect(out.status).toBe(3);
        expect(out.stderr).toContain('SECOND solver or a SECOND host configuration');
    });

    it('refuses a shipped-default change with no completed opt-in (7.5)', () => {
        const rec = writeRecord('promo-ev', { lifecycle: 'promotion-proposed' });
        const doc = validEvidence({
            rollout: { stage: 'canary', bundle: 'b-7', opt_in_completed: false, changes_shipped_default: true },
        });
        const out = lab(['promote', '--record', rec, '--evidence', writeEvidence('rollout', doc)]);
        expect(out.status).toBe(3);
        expect(out.stderr).toContain('COMPLETED opt-in stage');
    });

    it('refuses a paraphrase-only candidate (7.4)', () => {
        const rec = writeRecord('promo-ev', { lifecycle: 'promotion-proposed' });
        const base = validEvidence().material_improvement as Record<string, unknown>;
        const doc = validEvidence({
            material_improvement: {
                baseline_text: base['baseline_text'],
                candidate_text: (base['baseline_text'] as string).replace('nobody', 'no one'),
                delta_percent: 40,
            },
        });
        const out = lab(['promote', '--record', rec, '--evidence', writeEvidence('noop', doc)]);
        expect(out.status).toBe(3);
        expect(out.stderr).toContain('semantic no-op');
    });

    it('a COMPLETE package still refuses on the blocker, and only on it', () => {
        // The positive pole. Without it every assertion above would pass on a
        // verb that refuses every package for a reason unrelated to its contents.
        const rec = writeRecord('promo-ev', { lifecycle: 'promotion-proposed' });
        const out = lab(['promote', '--record', rec, '--evidence', writeEvidence('good', validEvidence())]);
        expect(out.status).toBe(3);
        expect(out.stderr).not.toContain('evidence package:');
        expect(out.stderr).toContain('merge-authority');
        expect(out.stderr).toContain('NAMED human approver');
    });
});

// --- § inspect and explain --------------------------------------------------

describe('inspect and explain reach the schema and lifecycle criteria', () => {
    it('inspect reports lifecycle and accepted=false, never inferring acceptance', () => {
        const file = writeRecord('insp-a', { lifecycle: 'sealed-evaluated' });
        const out = lab(['inspect', '--record', file]);
        expect(out.status, out.stderr).toBe(0);
        expect(out.stdout).toContain('lifecycle=sealed-evaluated');
        expect(out.stdout).toContain('accepted=false');
    });

    it('inspect rejects a two-dimension candidate (3.2)', () => {
        const file = writeRecord('insp-two', { dimensions: ['routing', 'content'] });
        const out = lab(['inspect', '--record', file]);
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('exactly ONE primary dimension');
    });

    it('inspect rejects a fourth mutation dimension (3.3)', () => {
        const file = writeRecord('insp-four', { dimension: 'verification' });
        const out = lab(['inspect', '--record', file]);
        expect(out.status).toBe(1);
        expect(out.stderr).toContain("'dimension' must be one of activation, routing, content");
    });

    it('inspect rejects a record with no lifecycle (3.4)', () => {
        const file = writeRecord('insp-nolife');
        const raw: Record<string, unknown> = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
        delete raw['lifecycle'];
        writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`, 'utf-8');
        const out = lab(['inspect', '--record', file]);
        expect(out.status).toBe(1);
        expect(out.stderr).toContain('never defaulted');
    });

    it('explain --to reports a legal step and refuses one that skips a stage (3.4)', () => {
        const file = writeRecord('exp-a', { lifecycle: 'proposed' });
        const legal = lab(['explain', '--record', file, '--to', 'diagnostic-evaluated']);
        expect(legal.status, legal.stderr).toBe(0);
        expect(legal.stdout).toContain('LEGAL');

        const skipping = lab(['explain', '--record', file, '--to', 'promotion-eligible']);
        expect(skipping.status).toBe(1);
        expect(skipping.stdout).toContain('REFUSED');
        expect(skipping.stdout).toContain('it skips');
    });

    it('explain --to promoted is refused for want of a named human', () => {
        const file = writeRecord('exp-promo', { lifecycle: 'promotion-proposed' });
        const out = lab(['explain', '--record', file, '--to', 'promoted']);
        expect(out.status).toBe(1);
        expect(out.stdout).toContain('NAMED human approver');
    });
});

// --- § run / compare / clean over real clones -------------------------------

describe.skipIf(!HAVE_FIXTURE)('run, compare and clean over real clones', () => {
    const records: string[] = [];

    beforeAll(() => {
        acquireClonesLock();
        removeClones();
        const built = spawnSync(TSX_BIN, [CLONE_TS, '--variant', 'both'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            timeout: 600_000,
        });
        expect(built.status, built.stderr ?? '').toBe(0);
        for (let i = 0; i < 5; i += 1) {
            records.push(writeRecord(`e2e${String(i)}`));
        }
    });

    afterAll(() => {
        removeClones();
        releaseClonesLock();
    });

    it('run materialises five candidates, compare passes, clean removes exactly them', () => {
        const args = ['run'];
        for (const r of records) {
            args.push('--record', r);
        }
        const ran = lab(args, 600_000);
        expect(ran.status, ran.stderr).toBe(0);
        for (let i = 0; i < 5; i += 1) {
            expect(existsSync(join(CLONES, `candidate-e2e${String(i)}`))).toBe(true);
        }

        const clean = lab(['compare'], 600_000);
        expect(clean.signal).toBeNull();
        expect(clean.status, clean.stderr).toBe(0);

        // Sabotage: a file outside the candidate surface. Criterion 3.1's
        // second conjunct, reached through the `compare` verb.
        const planted = join(CLONES, 'candidate-e2e0', 'leak-marker');
        writeFileSync(planted, 'planted outside the candidate surface\n', 'utf-8');
        const red = lab(['compare'], 600_000);
        expect(red.status, 'sabotaged clones must not compare clean').not.toBe(0);

        // Un-sabotage: a red that survives removal was caused by the setup.
        rmSync(planted, { force: true });
        expect(lab(['compare'], 600_000).status).toBe(0);

        // Dry-run first: `clean` must not delete without --yes.
        const dry = lab(['clean']);
        expect(dry.status, dry.stderr).toBe(0);
        expect(dry.stdout).toContain('would remove');
        expect(existsSync(join(CLONES, 'candidate-e2e0'))).toBe(true);

        const removed = lab(['clean', '--yes'], 600_000);
        expect(removed.status, removed.stderr).toBe(0);
        for (let i = 0; i < 5; i += 1) {
            expect(existsSync(join(CLONES, `candidate-e2e${String(i)}`))).toBe(false);
        }
        // ...and only them. The fixed variants are expensive and belong to the
        // value bench, not to the candidate loop.
        expect(existsSync(join(CLONES, 'with'))).toBe(true);
        expect(existsSync(join(CLONES, 'without'))).toBe(true);
    });
});
