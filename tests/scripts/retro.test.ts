import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SIDECAR_NAME, aggregate, readSignals } from '../../src/scripts/learning_sidecar.js';
import { VALID_TYPES } from '../../src/scripts/memory_signal.js';
import type { PrFacts } from '../../src/scripts/retro_facts.js';
import {
    aggregateSidecar,
    composeRetro,
    intakeSignals,
    triagePr,
    unitKey,
    writeIntakeSignals,
    type Candidate,
} from '../../src/scripts/retro.js';

const tmpDirs: string[] = [];
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const m = <T>(value: T) => ({ status: 'measured' as const, value });
const miss = { status: 'missing' as const, reason: 'not read' };

function prFacts(over: Partial<PrFacts> = {}): PrFacts {
    return {
        unit: 'pr',
        pr: 1,
        merge_sha: m('a'.repeat(40)),
        ci_heads: m(1),
        red_heads: m(0),
        red_to_green: m(0),
        repair_commits: m(0),
        in_pr_reverts: m(0),
        review_threads: m(0),
        later_revert: m(false),
        drain_row: { status: 'not-applicable', reason: 'none' },
        untrusted_text: [],
        ...over,
    };
}

const learning: Candidate = {
    learning: 'A generated baseline drifts when two drain batches land on one day.',
    target: 'intake-signal',
    derivable_from: null,
    would_recur: true,
    counter_hypothesis: 'The drift came from one batch only.',
    falsifier: 'A second same-day drain with no drift.',
    subject: 'drain/baseline-drift',
};

describe('retro — composition', () => {
    it('trivial-pr-yields-none', () => {
        const facts = prFacts();
        const key = unitKey({ repo: 'acme/widget', pr: 1, merge_sha: 'a'.repeat(40) });
        const out = composeRetro({ key, facts, candidate: learning, root: tmp() });
        expect(out.triage.class).toBe('skip:low-signal');
        expect(out.target).toBe('none');
        expect(out.learning).toBeNull();
        expect(out.reason).toMatch(/low-signal/);
    });

    it('a learning readable from the diff is discarded', () => {
        const facts = prFacts({ red_heads: m(2), ci_heads: m(3) });
        const key = unitKey({ repo: 'acme/widget', pr: 1, merge_sha: 'a'.repeat(40) });
        const out = composeRetro({ key, facts, candidate: { ...learning, derivable_from: 'diff' }, root: tmp() });
        expect(out.triage.class).toBe('analyse');
        expect(out.target).toBe('none');
        expect(out.learning).toBeNull();
        expect(out.reason).toMatch(/derivable from the diff/);
    });

    it('a learning that would not recur is discarded', () => {
        const facts = prFacts({ red_heads: m(2) });
        const key = unitKey({ repo: 'acme/widget', pr: 1, merge_sha: 'a'.repeat(40) });
        const out = composeRetro({ key, facts, candidate: { ...learning, would_recur: false }, root: tmp() });
        expect(out.target).toBe('none');
    });

    it('missing facts never lower a score', () => {
        const smooth = triagePr(prFacts({ red_heads: m(2) }));
        const holes = triagePr(prFacts({ red_heads: m(2), review_threads: miss, in_pr_reverts: miss, later_revert: miss }));
        expect(smooth.score).toBeGreaterThan(0);
        expect(holes.score).toBe(smooth.score);
    });

    it('an in-PR revert alone is worth a retro', () => {
        expect(triagePr(prFacts({ in_pr_reverts: m(2), ci_heads: m(2) })).class).toBe('analyse');
    });

    it('two-prs-mint-two-hosts-do-not', () => {
        const now = '2026-10-17T00:00:00Z';
        const keyA = unitKey({ repo: 'acme/widget', pr: 1, merge_sha: 'a'.repeat(40) });
        const keyB = unitKey({ repo: 'acme/widget', pr: 2, merge_sha: 'b'.repeat(40) });
        const facts = prFacts({ red_heads: m(2) });
        const root = tmp();

        const fromA = composeRetro({ key: keyA, facts, candidate: learning, root });
        const fromB = composeRetro({ key: keyB, facts, candidate: learning, root });
        const twoPrs = aggregate([...intakeSignals(fromA, now), ...intakeSignals(fromB, now)], Date.parse(now));
        expect(twoPrs).toHaveLength(1);
        expect(twoPrs[0]!.corroborations).toBe(2);

        // The same PR examined twice — from two hosts — is one unit key, one origin.
        const again = composeRetro({ key: keyA, facts, candidate: learning, root });
        const twoHosts = aggregate([...intakeSignals(fromA, now), ...intakeSignals(again, now)], Date.parse(now));
        expect(twoHosts).toHaveLength(0);
    });

    it('a target outside the closed vocabulary is refused', () => {
        const key = unitKey({ repo: 'acme/widget', pr: 1, merge_sha: 'a'.repeat(40) });
        expect(() =>
            composeRetro({
                key,
                facts: prFacts({ red_heads: m(2) }),
                candidate: { ...learning, target: 'claude-md' as Candidate['target'] },
                root: tmp(),
            }),
        ).toThrow(/closed vocabulary/);
    });

    it('output-carries-falsifier', () => {
        const root = tmp();
        const dir = path.join(root, 'agents', 'runtime', 'self-repair');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'f00d.json'),
            JSON.stringify({
                defect_class: 'model-noticed',
                source: 'model-noticed',
                evidence: 'x',
                suggested_surface: 'y',
                fingerprint: 'f00d',
                first_seen: '2026-10-01T00:00:00Z',
                last_seen: '2026-10-10T00:00:00Z',
                occurrences: 3,
                status: 'actioned',
                target: ['rule:drain-baseline'],
            }),
        );
        const key = unitKey({ repo: 'acme/widget', pr: 1, merge_sha: 'a'.repeat(40) });
        const out = composeRetro({
            key,
            facts: prFacts({ red_heads: m(2) }),
            candidate: { ...learning, asset_target: 'rule:drain-baseline' },
            root,
        });
        expect(out.learning).toBe(learning.learning);
        expect(out.target).toBe('intake-signal');
        expect(out.counter_hypothesis).toBe(learning.counter_hypothesis);
        expect(out.falsifier).toBe(learning.falsifier);
        expect(out.facts.unit).toBe('pr');
        expect(out.recurrence).toEqual({ target: 'rule:drain-baseline', occurrences: 3, records: 1 });
    });

    it('caps intake signals at three per unit', () => {
        const key = unitKey({ repo: 'acme/widget', pr: 1, merge_sha: 'a'.repeat(40) });
        const out = composeRetro({ key, facts: prFacts({ red_heads: m(2) }), candidate: learning, root: tmp() });
        const signals = intakeSignals(out, '2026-10-17T00:00:00Z', ['one', 'two', 'three', 'four']);
        expect(signals.length).toBeLessThanOrEqual(3);
        expect(new Set(signals.map((s) => s.origin))).toEqual(new Set([key]));
    });
});

describe('retro — local effect', () => {
    const now = '2026-10-17T00:00:00Z';

    it('intake-origin-is-unit-key', () => {
        const root = tmp();
        const key = unitKey({ repo: 'acme/widget', pr: 1, merge_sha: 'a'.repeat(40) });
        const out = composeRetro({ key, facts: prFacts({ red_heads: m(2) }), candidate: learning, root });
        expect(writeIntakeSignals(root, intakeSignals(out, now))).toBe(1);

        const signals = readSignals(path.join(root, 'agents', 'memory', 'intake'));
        expect(signals).toHaveLength(1);
        expect(signals[0]!.origin).toBe(key);
        expect(signals[0]!.path).toBe(learning.subject);
        expect(VALID_TYPES.has(signals[0]!.entryType)).toBe(true);
    });

    it('a learning routed to a proposal writes no intake signal', () => {
        const root = tmp();
        const key = unitKey({ repo: 'acme/widget', pr: 1, merge_sha: 'a'.repeat(40) });
        const out = composeRetro({
            key,
            facts: prFacts({ red_heads: m(2) }),
            candidate: { ...learning, target: 'override-proposal' },
            root,
        });
        expect(writeIntakeSignals(root, intakeSignals(out, now))).toBe(0);
        expect(fs.existsSync(path.join(root, 'agents', 'memory', 'intake'))).toBe(false);
    });

    it('retro-aggregates-sidecar', () => {
        const root = tmp();
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), 'memory:\n  learn_on_session_end: false\n');
        for (const pr of [1, 2]) {
            const key = unitKey({ repo: 'acme/widget', pr, merge_sha: String(pr).repeat(40) });
            const out = composeRetro({ key, facts: prFacts({ red_heads: m(2) }), candidate: learning, root });
            writeIntakeSignals(root, intakeSignals(out, now));
        }
        const sidecar = aggregateSidecar(root, now);
        expect(sidecar.lessons).toHaveLength(1);
        expect(sidecar.lessons[0]!.corroborations).toBe(2);
        expect(fs.existsSync(path.join(root, 'agents', 'memory', SIDECAR_NAME))).toBe(true);
    });
});
