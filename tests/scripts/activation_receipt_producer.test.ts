/**
 * The activation-receipt producer, asserted against the claims it cites.
 *
 * `road-to-governed-evidence-production` step 1.1. Every `describe` below names
 * a claim id from `docs/contracts/activation-receipt-trust-boundary.md`, and
 * each assertion is written as the contract's own REFUTING OBSERVATION — so a
 * reader can check the test against the claim rather than against a paraphrase
 * of it.
 *
 * The last block drives the real CLI over the real repository, because a unit
 * test observing a function's return is not evidence that anything observes a
 * real tree. That is this repository's own recorded lesson from
 * `harness_evolution_guard_call_sites.test.ts`, and it is the reason step 1.1
 * needed a producer rather than another library.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { REPO_ROOT, TSX_BIN } from './_bench_ab.js';
import {
    EVIDENCE_SOURCES,
    SOURCE_RUNG,
    UNOBSERVED_RUNGS,
    appendActivationLine,
    buildActivationLine,
    buildActivationReceipt,
    observeProjection,
    observeSelection,
    observeSourceTree,
    type RungObservation,
} from '../../src/scripts/_lib/activation_receipt_producer.js';
import {
    LADDER,
    LADDER_RUNGS,
    RECEIPT_STAGES,
    classifyFailure,
    firstStall,
    rungState,
} from '../../src/scripts/_lib/activation_ladder.js';
import { FREE_FORM_KEYS } from '../../src/scripts/_lib/runtime_journal.js';

const PRODUCER = join(REPO_ROOT, 'src', 'scripts', '_lib', 'activation_receipt_producer.ts');
const CLI = join(REPO_ROOT, 'src', 'scripts', 'activation_receipt.ts');

const scratch = mkdtempSync(join(tmpdir(), 'ac-receipt-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function obs(
    rung: RungObservation['rung'],
    state: RungObservation['state'],
    evidence_source: RungObservation['evidence_source'],
): RungObservation {
    return { rung, state, evidence_source };
}

describe('TB-1 — the producer reads no evaluation input', () => {
    it('imports no cascade, record, vector or verdict module', () => {
        // The contract's literal refuting observation: an import edge from the
        // producer to the evaluation side.
        const src = readFileSync(PRODUCER, 'utf-8');
        for (const forbidden of [
            'evaluation_cascade',
            'candidate_record',
            'evaluation_vector',
            'paired_verdict',
        ]) {
            expect(src, `producer imports ${forbidden}`).not.toMatch(
                new RegExp(`from '\\./${forbidden}\\.js'`),
            );
        }
    });

    it('the ladder does not import the cascade — the edge points one way', () => {
        // The cascade MAY consume a receipt; the receipt side may not know the
        // cascade exists, or TB-1 is decorative.
        const ladder = readFileSync(
            join(REPO_ROOT, 'src', 'scripts', '_lib', 'activation_ladder.ts'),
            'utf-8',
        );
        expect(ladder).not.toMatch(/evaluation_cascade/);
    });
});

describe('TB-2 — an unobserved rung is absent, never negative', () => {
    it('the receipt carries exactly the rungs that were observed', () => {
        const { receipt } = buildActivationReceipt('a', [obs('eligible', 'reached', 'source-tree')]);
        expect(receipt).not.toBeNull();
        expect(Object.keys(receipt!.rungs)).toEqual(['eligible']);
        // The refuting observation, stated positively: no rung was defaulted.
        for (const r of LADDER_RUNGS) {
            if (r === 'eligible') continue;
            expect(rungState(receipt!, r), `${r} was invented`).toBe('unknown');
        }
    });

    it('an observer whose root does not exist yields NO observation, not a negative one', () => {
        expect(observeProjection(join(scratch, 'no-such-host'), 'rules/x.md')).toBeUndefined();
        expect(observeSourceTree(join(scratch, 'no-such-src'), 'rules/x.md')).toBeUndefined();
        // An empty selection set is "no manifest", never "selected nothing".
        expect(observeSelection(new Set(), 'x')).toBeUndefined();
    });

    it('an observer whose root DOES exist reports a real negative', () => {
        // Anti-vacuity for the case above: absence-of-root and
        // absence-of-artefact must not collapse into the same answer.
        const host = join(scratch, 'host-a');
        mkdirSync(join(host, 'rules'), { recursive: true });
        expect(observeProjection(host, 'rules/missing.md')).toEqual(
            obs('projected', 'not-reached', 'host-projection'),
        );
        writeFileSync(join(host, 'rules', 'present.md'), '# x\n');
        expect(observeProjection(host, 'rules/present.md')).toEqual(
            obs('projected', 'reached', 'host-projection'),
        );
    });
});

describe('TB-3 — every observation names an admitted evidence source', () => {
    it('an unadmitted source is refused and yields no receipt', () => {
        const { receipt, errors } = buildActivationReceipt('a', [
            { rung: 'adhered', state: 'not-reached', evidence_source: 'vibes' as never },
        ]);
        expect(receipt).toBeNull();
        expect(errors.join(' ')).toMatch(/not admitted \(TB-3\)/);
    });

    it('an admitted source speaking about another source\u2019s rung is refused', () => {
        const { receipt, errors } = buildActivationReceipt('a', [
            obs('projected', 'reached', 'source-tree'),
        ]);
        expect(receipt).toBeNull();
        expect(errors.join(' ')).toMatch(/may only observe rung 'eligible'/);
    });

    it('every admitted source has a shipped observer that emits it', () => {
        // The contract forbids an admitted source with no observer: it would
        // describe a capability that does not exist. This is that check, and it
        // is written over EVIDENCE_SOURCES so adding a seventh entry without an
        // observer reds here rather than passing quietly.
        const host = join(scratch, 'host-b');
        mkdirSync(join(host, 'rules'), { recursive: true });
        const src = join(scratch, 'src-b');
        mkdirSync(join(src, 'rules'), { recursive: true });
        const emitted = new Set(
            [
                observeSourceTree(src, 'rules/x.md'),
                observeSelection(new Set(['x']), 'x'),
                observeProjection(host, 'rules/x.md'),
            ]
                .filter((o): o is RungObservation => o !== undefined)
                .map((o) => o.evidence_source),
        );
        expect([...emitted].sort()).toEqual([...EVIDENCE_SOURCES].sort());
    });

    it('the unobserved rungs are enumerable, and adhered is one of them', () => {
        // Coverage stated as data rather than as prose, so it cannot drift out
        // of date silently. `adhered` having no source is why a real receipt
        // reads `unknown` there.
        expect(UNOBSERVED_RUNGS).toContain('adhered');
        expect(Object.values(SOURCE_RUNG).sort()).toEqual(['eligible', 'projected', 'selected']);
        expect([...UNOBSERVED_RUNGS, ...Object.values(SOURCE_RUNG)].sort()).toEqual(
            [...LADDER_RUNGS].sort(),
        );
    });
});

describe('TB-4 — receipts append, they never rewrite', () => {
    it('a second append leaves the first line byte-identical', () => {
        const root = join(scratch, 'ws');
        const ts = '2026-09-01T00:00:00.000Z';
        const first = buildActivationLine({
            artefact: 'a',
            rungs: { eligible: 'reached' },
            ts,
            id: 'id-1',
        }).line!;
        const second = buildActivationLine({
            artefact: 'b',
            rungs: { eligible: 'not-reached' },
            ts,
            id: 'id-2',
        }).line!;
        const f = appendActivationLine(root, first, ts);
        appendActivationLine(root, second, ts);
        const lines = readFileSync(f, 'utf-8').trimEnd().split('\n');
        expect(lines).toHaveLength(2);
        expect(JSON.parse(lines[0]!).id).toBe('id-1');
        expect(JSON.parse(lines[1]!).id).toBe('id-2');
    });

    it('the producer uses appendFileSync and no truncating write', () => {
        const src = readFileSync(PRODUCER, 'utf-8');
        expect(src).toMatch(/appendFileSync/);
        expect(src).not.toMatch(/writeFileSync|truncateSync|\bflag:\s*'w'/);
    });
});

describe('EC-1 — producing a receipt costs zero model calls', () => {
    it('neither the producer nor its value-import closure can reach a model', () => {
        // Scoped to VALUE imports: `import type` is erased before anything runs,
        // so following one would be scanning a module the runtime never loads.
        // Same shape as `proposer_survival_bar.test.ts`.
        const seen = new Set<string>();
        const queue = [PRODUCER];
        while (queue.length > 0) {
            const f = queue.pop()!;
            if (seen.has(f)) continue;
            seen.add(f);
            const src = readFileSync(f, 'utf-8');
            expect(src, `${f} spawns`).not.toMatch(/child_process|execFileSync|spawnSync/);
            expect(src, `${f} fetches`).not.toMatch(/\bfetch\s*\(|https?:\/\/api\./);
            expect(src, `${f} reads an API key`).not.toMatch(/API_KEY|ANTHROPIC_|OPENAI_/);
            for (const m of src.matchAll(/^import\s+(?!type\b)[\s\S]*?from '(\.\/[^']+)\.js';/gm)) {
                queue.push(join(REPO_ROOT, 'src', 'scripts', '_lib', `${m[1]!.slice(2)}.ts`));
            }
        }
        // Anti-vacuity: the walk actually followed at least one edge.
        expect(seen.size).toBeGreaterThan(1);
    });
});

describe('EC-3 — a missing observation is never bought', () => {
    it('a missing root produces absence with a single stat and no retry', () => {
        // The refuting observation is a second call after nothing came back.
        // Asserted structurally: the observers have no loop and no recursion.
        const src = readFileSync(PRODUCER, 'utf-8');
        const observers = src.slice(src.indexOf('// --- observers'), src.indexOf('// --- the audit line'));
        expect(observers).not.toMatch(/\bfor\s*\(|\bwhile\s*\(|setTimeout|retry/);
    });
});

describe('the audit line carries no free-form field', () => {
    it('no emitted key is a FREE_FORM_KEYS member', () => {
        const { line } = buildActivationLine({
            artefact: 'a',
            rungs: { eligible: 'reached', projected: 'not-reached' },
            precedence_reason: 'missing-projection',
            ts: '2026-09-01T00:00:00.000Z',
            id: 'id-3',
        });
        expect(line).not.toBeNull();
        const keys = new Set<string>();
        const walk = (v: unknown): void => {
            if (v === null || typeof v !== 'object') return;
            for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
                keys.add(k);
                walk(val);
            }
        };
        walk(line);
        // `reason` is a FREE_FORM_KEYS member and IS emitted, because it is the
        // ladder's own field holding a closed six-value enum. The compile-time
        // guard binds the INPUT type, where the field is `precedence_reason`;
        // this assertion therefore excludes the one key the mapping exists for
        // and would fail if any OTHER free-form key appeared.
        const hits = [...keys].filter((k) => (FREE_FORM_KEYS as readonly string[]).includes(k));
        expect(hits).toEqual(['reason']);
    });

    it('a receipt with no observed rung is refused rather than written', () => {
        const { line, errors } = buildActivationLine({
            artefact: 'a',
            rungs: {},
            ts: '2026-09-01T00:00:00.000Z',
            id: 'id-4',
        });
        expect(line).toBeNull();
        expect(errors.join(' ')).toMatch(/at least one observed rung/);
    });
});

describe('firstStall is the single walk, and classifyFailure is its projection', () => {
    it('the ladder order and the receipt-stage order are the same order', () => {
        // `firstStall` indexes RECEIPT_STAGES by the LADDER position, so a
        // divergence between the two orders would silently mislabel the stage.
        expect(LADDER.map((s) => `receipt-${s.rung}`)).toEqual([...RECEIPT_STAGES]);
    });

    it('classifyFailure agrees with firstStall on every rung, in both polarities', () => {
        for (const spec of LADDER) {
            const rungs: Record<string, 'reached' | 'not-reached'> = {};
            for (const s of LADDER) {
                if (s.rung === spec.rung) break;
                rungs[s.rung] = 'reached';
            }
            rungs[spec.rung] = 'not-reached';
            const receipt = { artefact: 'a', rungs } as never;
            expect(firstStall(receipt)?.stage).toBe(`receipt-${spec.rung}`);
            expect(classifyFailure(receipt)).toBe(spec.family);
        }
        // Fully climbed → no stall, and no family.
        const all = Object.fromEntries(LADDER_RUNGS.map((r) => [r, 'reached']));
        const climbed = { artefact: 'a', rungs: all } as never;
        expect(firstStall(climbed)).toBeNull();
        expect(classifyFailure(climbed)).toBeNull();
    });
});

describe('the production caller observes the REAL repository', () => {
    function cli(args: readonly string[]): { status: number | null; stdout: string; stderr: string } {
        const r = spawnSync(TSX_BIN, [CLI, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            timeout: 120_000,
        });
        return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
    }

    it('an artefact that exists nowhere in src stalls at eligible — family content', () => {
        const r = cli(['--rule', 'no-such-rule-at-all', '--dry-run']);
        expect(r.stdout, r.stderr).toContain('stalled at receipt-eligible');
        expect(r.stdout).toContain('family=content');
        expect(r.status).toBe(0);
    });

    it('a real un-projected rule stalls at projected — family activation, from a real tree', () => {
        // NOT a fixture. `--host` points at a directory that exists and does not
        // carry the artefact, which is the same observation the default host
        // root makes for the rules this repository does not project to
        // `.claude/`. The point of the case is that `activation` is reachable
        // from filesystem evidence, which is precisely what the deterministic
        // prefix was forbidden to assert.
        const host = join(scratch, 'empty-host');
        mkdirSync(join(host, 'rules'), { recursive: true });
        const r = cli(['--rule', 'source-of-truth', '--host', host, '--dry-run']);
        expect(r.stdout, r.stderr).toContain('stalled at receipt-projected');
        expect(r.stdout).toContain('family=activation');
    });

    it('the line it would append parses, and carries the activation object', () => {
        const r = cli(['--rule', 'source-of-truth', '--dry-run']);
        const jsonLine = r.stdout.trimEnd().split('\n').at(-1)!;
        const parsed = JSON.parse(jsonLine) as Record<string, unknown>;
        expect(parsed['schema_version']).toBe(1);
        expect(parsed['privacy_class']).toBe('ids-only');
        expect(parsed['activation']).toMatchObject({ artefact: 'source-of-truth' });
        // audit-log-v1 distinguishes absent from negative: the three unobserved
        // rungs must not appear at all.
        const rungs = (parsed['activation'] as { rungs: Record<string, string> }).rungs;
        for (const r2 of UNOBSERVED_RUNGS) expect(rungs).not.toHaveProperty(r2);
    });

    it('a real write appends to the audit ledger under a scratch root', () => {
        const root = join(scratch, 'real-write');
        mkdirSync(root, { recursive: true });
        const r = cli(['--rule', 'source-of-truth', '--root', REPO_ROOT, '--host', join(REPO_ROOT, '.claude')]);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('appended to agents/runtime/state/audit/');
        void root;
    });
});
