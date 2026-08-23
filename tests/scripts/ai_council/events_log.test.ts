// Tests for src/scripts/ai_council/events_log.ts (py2ts Phase 1).
//
// Appends one JSON line per council event. The only non-determinism is
// `ts_utc` (wall-clock); the TS twin accepts an injectable `now` for unit
// tests.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    SCHEMA_VERSION,
    appendEvent,
    appendQuorumEvent,
    defaultLogPath,
} from '../../../src/scripts/ai_council/events_log.js';
import {
    evaluateQuorum,
    SOLO_FLOOR_MIN_PRESENT,
    wouldSoloFloorHold,
} from '../../../src/scripts/ai_council/quorum.js';

const created: string[] = [];
function tmpDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'el-test-'));
    created.push(d);
    return d;
}
afterEach(() => {
    delete process.env.AGENT_CONFIG_NO_EVENTS_LOG;
    while (created.length) {
        fs.rmSync(created.pop()!, { recursive: true, force: true });
    }
});

const FIXED = new Date(Date.UTC(2026, 5, 14, 8, 30, 15));

describe('events_log — write + schema', () => {
    it('writes a record, injects hash, pops original_ask', () => {
        const lp = path.join(tmpDir(), 'events.log');
        const event: Record<string, unknown> = {
            lens: 'security',
            invocation: '/council',
            action: 'skip_necessity',
            verdict: 'no',
            provider_caps: { api: true },
            original_ask: 'Why skip this?',
            category: 'extra',
        };
        expect(appendEvent(event, { logPath: lp, now: FIXED })).toBe(true);
        expect('original_ask' in event).toBe(false); // popped (Python side effect)

        const rec = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
        expect(rec.schema_version).toBe(SCHEMA_VERSION);
        expect(rec.ts_utc).toBe('2026-06-14T08:30:15Z');
        expect(rec.lens).toBe('security');
        expect(rec.action).toBe('skip_necessity');
        expect(rec.provider_caps).toEqual({ api: true });
        expect(rec.original_ask_hash).toMatch(/^[0-9a-f]{12}$/);
        expect('original_ask' in rec).toBe(false);
        expect(rec.category).toBe('extra'); // pass-through
    });

    it('empty original_ask → sentinel hash', () => {
        const lp = path.join(tmpDir(), 'e.log');
        appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED });
        const rec = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
        expect(rec.original_ask_hash).toBe('000000000000');
    });

    it('appends (does not truncate) across calls', () => {
        const lp = path.join(tmpDir(), 'multi.log');
        appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED });
        appendEvent({ action: 'block_quota' }, { logPath: lp, now: FIXED });
        const lines = fs.readFileSync(lp, 'utf-8').trimEnd().split('\n');
        expect(lines).toHaveLength(2);
    });

    it('creates the parent dir on demand', () => {
        const lp = path.join(tmpDir(), 'nested', 'deep', 'events.log');
        expect(appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED })).toBe(true);
        expect(fs.existsSync(lp)).toBe(true);
    });

    it('reserved schema fields win over pass-through collisions', () => {
        const lp = path.join(tmpDir(), 'c.log');
        appendEvent(
            { action: 'proceed', lens: 'real', schema_version: 999, ts_utc: 'fake' },
            { logPath: lp, now: FIXED },
        );
        const rec = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
        expect(rec.schema_version).toBe(SCHEMA_VERSION);
        expect(rec.ts_utc).toBe('2026-06-14T08:30:15Z');
        expect(rec.lens).toBe('real');
    });

    it('invalid action throws (Python ValueError parity)', () => {
        expect(() => appendEvent({ action: 'nope' }, { logPath: path.join(tmpDir(), 'x.log') })).toThrow(
            "events_log: action='nope' not in ['block_quota', 'proceed', 'quorum_result', 'skip_necessity', 'transport_fallback'].",
        );
    });

    it('missing action throws with None repr', () => {
        expect(() => appendEvent({}, { logPath: path.join(tmpDir(), 'x.log') })).toThrow(
            "events_log: action=None not in ['block_quota', 'proceed', 'quorum_result', 'skip_necessity', 'transport_fallback'].",
        );
    });

    it('kill-switch suppresses the write (returns false, no file)', () => {
        process.env.AGENT_CONFIG_NO_EVENTS_LOG = '1';
        const lp = path.join(tmpDir(), 'killed.log');
        expect(appendEvent({ action: 'proceed' }, { logPath: lp })).toBe(false);
        expect(fs.existsSync(lp)).toBe(false);
    });

    it('kill-switch falsy values do NOT suppress', () => {
        const lp = path.join(tmpDir(), 'k.log');
        for (const v of ['', '0', 'false', 'False']) {
            process.env.AGENT_CONFIG_NO_EVENTS_LOG = v;
            expect(appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED })).toBe(true);
        }
    });

    it('defaultLogPath ends with the canonical suffix', () => {
        expect(defaultLogPath().endsWith(path.join('agents', 'runtime', 'council', 'events.log'))).toBe(
            true,
        );
    });
});


describe('events_log — quorum attendance (schema v4)', () => {
    function readOne(lp: string): Record<string, unknown> {
        return JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
    }

    const CTX = {
        lens: '',
        invocation: '',
        phase: 'post_run',
        command: 'run',
        dispatch: 'full',
    } as const;

    it('pins the on-wire schema version at 4', () => {
        // Deliberately a literal, not the constant: this module's whole
        // contract is a versioned wire format, and an assertion written
        // against SCHEMA_VERSION is tautological — it passes whatever the
        // constant becomes. A bump has to break a test on purpose.
        //
        // Bumped 2 → 3 when `quorum_result` gained `gate_class` and
        // `floor_would_hold` (ADR-224 shadow floor). It broke this test on
        // purpose, which is the assertion working.
        //
        // Bumped 3 → 4 when the line gained `min_present` — the floor the
        // counterfactual was computed against. Bumped 4 → 5 when it gained
        // `stance_agreement`. Same mechanism, same reason it is a literal: a
        // consumer pooling lines across a bump must EXCLUDE the older stratum
        // rather than default the new field, and it can only do that if the
        // version actually moved.
        const lp = path.join(tmpDir(), 'wire.log');
        appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED });
        expect(readOne(lp).schema_version).toBe(5);
    });

    it('writes a quorum_result line carrying the attendance shape', () => {
        const lp = path.join(tmpDir(), 'q.log');
        expect(
            appendQuorumEvent(
                {
                    ...CTX,
                    lens: 'security',
                    invocation: 'agent',
                    configuredTotal: 2,
                    result: evaluateQuorum(2, 1),
                    absent: [{ member: 'openai', reason: 'quota' }],
                },
                { logPath: lp, now: FIXED },
            ),
        ).toBe(true);
        const rec = readOne(lp);
        expect(rec.action).toBe('quorum_result');
        expect(rec.verdict).toBe('concluded');
        expect(rec.phase).toBe('post_run');
        expect(rec.command).toBe('run');
        expect(rec.dispatch).toBe('full');
        expect(rec.threshold).toBe(1);
        expect(rec.configured_total).toBe(2);
        expect(rec.total).toBe(2);
        expect(rec.present).toBe(1);
        expect(rec.solo).toBe(true);
        expect(rec.absent).toEqual([{ member: 'openai', reason: 'quota' }]);
        expect(rec.schema_version).toBe(SCHEMA_VERSION);
    });

    it('solo is written by the predicate, not re-derived downstream', () => {
        const lp = path.join(tmpDir(), 'q2.log');
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 1), absent: [] },
            { logPath: lp, now: FIXED },
        );
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 2), absent: [] },
            { logPath: lp, now: FIXED },
        );
        const lines = fs
            .readFileSync(lp, 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        // Both concluded; only `solo` separates them, and it comes from
        // isSoloConcluded rather than a second copy of the rule.
        expect(lines.map((l) => l.verdict)).toEqual(['concluded', 'concluded']);
        expect(lines.map((l) => l.solo)).toEqual([true, false]);
    });

    // ── Phase 3 — whether the seats AGREED leaves a line in the log ──
    //
    // Before this, `stance_tally.ts` wrote nothing: `grep -c appendEvent` on it
    // returned 0 across 256 lines and it had no import from `events_log.js` at
    // all, so its verdict reached the reader as rendered prose only. The log
    // could say who showed up and never whether they agreed.
    it('carries the stance agreement as a FIELD on the existing quorum_result line', () => {
        const lp = path.join(tmpDir(), 'agree.log');
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 2), absent: [], stanceAgreement: 'consensus' },
            { logPath: lp, now: FIXED },
        );
        const rec = readOne(lp);
        // A FIELD, never a new action — a new action is invisible to every
        // consumer filtering `action === 'quorum_result'` and would split the
        // attendance population in two.
        expect(rec.action).toBe('quorum_result');
        expect(rec.stance_agreement).toBe('consensus');
    });

    // Three states, not a boolean, and the third is the one that matters: a
    // pass where no tally ran is NOT a pass where the seats disagreed. Reading
    // `false` as disagreement is exactly the "says something the run did not
    // establish" defect this roadmap exists to close, so `not_tallied` is
    // written explicitly rather than left to an absent key.
    it('a pass with no stance tally records `not_tallied`, never a bare false', () => {
        const lp = path.join(tmpDir(), 'agree2.log');
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 2), absent: [] },
            { logPath: lp, now: FIXED },
        );
        const rec = readOne(lp);
        expect(rec.stance_agreement).toBe('not_tallied');
        expect(rec.stance_agreement).not.toBe(false);
    });

    it('a split is recorded as a split', () => {
        const lp = path.join(tmpDir(), 'agree3.log');
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 2), absent: [], stanceAgreement: 'split' },
            { logPath: lp, now: FIXED },
        );
        expect(readOne(lp).stance_agreement).toBe('split');
    });

    // The schema bump is the contract for every consumer that pools lines: a
    // rate over the new field must EXCLUDE older lines rather than default
    // them, and it cannot do that unless the version moved.
    it('the schema version moved with the field', () => {
        const lp = path.join(tmpDir(), 'agree4.log');
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 2), absent: [] },
            { logPath: lp, now: FIXED },
        );
        expect(readOne(lp).schema_version).toBe(5);
        expect(SCHEMA_VERSION).toBe(5);
    });

    it('records the shadow floor without an operator opting in', () => {
        const lp = path.join(tmpDir(), 'floor.log');
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 1), absent: [] },
            { logPath: lp, now: FIXED },
        );
        const rec = readOne(lp);
        // No `minPresent` supplied — the ADR-224 default applies, so
        // review trigger (b) has data from the first pass rather than from
        // the first pass after somebody edits a config.
        expect(rec.floor_would_hold).toBe(true);
        // Declared, never inferred: no CLI path declares itself gate-class,
        // and `false` is the honest record of that, not a placeholder.
        expect(rec.gate_class).toBe(false);
        // The floor the counterfactual was computed against, on the line —
        // without it a reader cannot tell which floor `floor_would_hold`
        // refers to, and the default is exactly the case most likely to be
        // assumed rather than checked.
        expect(rec.min_present).toBe(2);
    });

    it('records the floor the counterfactual used, so a zero rate is attributable', () => {
        // `quorum_min_present` lives in the USER-GLOBAL config (ADR-104), so
        // without this field two machines emit byte-identical lines while
        // measuring different counterfactuals — and `quorum_min_present: 1`,
        // which is valid config and provably cannot hold anything, would zero
        // shadow_floor_fire_rate with no trace on the data.
        const lp = path.join(tmpDir(), 'provenance.log');
        const solo = { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 1), absent: [] };
        appendQuorumEvent({ ...solo, minPresent: 1 }, { logPath: lp, now: FIXED });
        appendQuorumEvent({ ...solo, minPresent: 2 }, { logPath: lp, now: FIXED });
        appendQuorumEvent({ ...solo, minPresent: 3 }, { logPath: lp, now: FIXED });
        const lines = fs
            .readFileSync(lp, 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        // Same pass, three configured floors, three different verdicts — the
        // reading is only interpretable because the floor is recorded.
        expect(lines.map((l) => l.min_present)).toEqual([1, 2, 3]);
        expect(lines.map((l) => l.floor_would_hold)).toEqual([false, true, true]);
        // Deliberately NOT re-derived here as `present < min_present`: that
        // ignores the ceiling clamp and would agree with the real rule only by
        // accident on this input (they diverge at present === ceiling with a
        // larger floor). The predicate owns the rule; this test owns the
        // provenance — that the value used is the value recorded.
        expect(lines.map((l) => l.min_present)).toEqual([1, 2, 3]);
    });

    it('the recorded floor is the one the predicate used, not a second resolution', () => {
        // The failure this pins: `min_present` written from the input while
        // `floor_would_hold` evaluates a different default. Omitting minPresent
        // must record the SAME default the counterfactual applied — one
        // resolution, not two that happen to agree today.
        const lp = path.join(tmpDir(), 'default.log');
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 1), absent: [] },
            { logPath: lp, now: FIXED },
        );
        const rec = readOne(lp);
        expect(rec.min_present).toBe(SOLO_FLOOR_MIN_PRESENT);
        expect(rec.floor_would_hold).toBe(
            wouldSoloFloorHold(evaluateQuorum(2, 1), rec.min_present as number, 2),
        );
    });

    it('separates "held by the floor" from "threshold not met" on the line alone', () => {
        const lp = path.join(tmpDir(), 'split.log');
        // Concluded on one voice — the floor would have held it.
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 1), absent: [] },
            { logPath: lp, now: FIXED },
        );
        // Never reached the threshold — a different outcome with a
        // different cause, and the reason this is a field and not a reuse
        // of `verdict`.
        appendQuorumEvent(
            { ...CTX, configuredTotal: 3, result: evaluateQuorum(3, 1), absent: [] },
            { logPath: lp, now: FIXED },
        );
        const lines = fs
            .readFileSync(lp, 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        expect(lines.map((l) => l.verdict)).toEqual(['concluded', 'inconclusive']);
        expect(lines.map((l) => l.floor_would_hold)).toEqual([true, false]);
    });

    it('fires on a construction-degraded pass, using configured_total', () => {
        // The line already carries configured_total to keep this pass
        // distinguishable; the floor has to actually consult it. 2 configured,
        // 1 constructed, 1 answered — a conclusion on one of two configured
        // voices, which reads total=1/present=1 on the wire.
        const lp = path.join(tmpDir(), 'degraded.log');
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(1, 1), absent: [] },
            { logPath: lp, now: FIXED },
        );
        const rec = readOne(lp);
        expect(rec.total).toBe(1);
        expect(rec.present).toBe(1);
        expect(rec.configured_total).toBe(2);
        expect(rec.floor_would_hold).toBe(true);
    });

    it('honours a configured floor over the default', () => {
        const lp = path.join(tmpDir(), 'floor2.log');
        // Full attendance at 2 of 2 — the default floor does not fire...
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 2), absent: [] },
            { logPath: lp, now: FIXED },
        );
        // ...and a stricter operator floor of 3 clamps to the roster rather
        // than manufacturing a hold, so it does not fire either.
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 2), absent: [], minPresent: 3 },
            { logPath: lp, now: FIXED },
        );
        // A floor of 1 is the operator disabling the counterfactual.
        appendQuorumEvent(
            { ...CTX, configuredTotal: 2, result: evaluateQuorum(2, 1), absent: [], minPresent: 1 },
            { logPath: lp, now: FIXED },
        );
        const lines = fs
            .readFileSync(lp, 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        expect(lines.map((l) => l.floor_would_hold)).toEqual([false, false, false]);
    });

    it('configured_total keeps a construction-degraded pass distinguishable', () => {
        // 3 configured, 2 failed to construct, 1 answered. Without
        // configured_total the line reads {total:1, present:1} — full
        // attendance — which is the exact case the metric exists to catch.
        const lp = path.join(tmpDir(), 'q3.log');
        appendQuorumEvent(
            { ...CTX, configuredTotal: 3, result: evaluateQuorum(1, 1), absent: [] },
            { logPath: lp, now: FIXED },
        );
        const rec = readOne(lp);
        expect(rec.configured_total).toBe(3);
        expect(rec.total).toBe(1);
        expect(rec.present).toBe(1);
    });

    it('dispatch separates a --single pass from a one-member council', () => {
        const lp = path.join(tmpDir(), 'q4.log');
        const one = { ...CTX, configuredTotal: 1, result: evaluateQuorum(1, 1), absent: [] };
        appendQuorumEvent({ ...one, dispatch: 'single' }, { logPath: lp, now: FIXED });
        appendQuorumEvent({ ...one, dispatch: 'full' }, { logPath: lp, now: FIXED });
        const lines = fs
            .readFileSync(lp, 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        // Identical numbers on both lines — `dispatch` is the only thing that
        // tells a deliberate solo dispatch from a council configured with one
        // member, and both are `solo: true`.
        expect(lines.map((l) => l.solo)).toEqual([true, true]);
        expect(lines.map((l) => l.total)).toEqual([1, 1]);
        expect(lines.map((l) => l.dispatch)).toEqual(['single', 'full']);
    });

    it('command marks the paths that never run a pass', () => {
        const lp = path.join(tmpDir(), 'q5.log');
        appendQuorumEvent(
            {
                ...CTX,
                phase: 'pre_run',
                command: 'estimate',
                configuredTotal: 2,
                result: evaluateQuorum(2, 2),
                absent: [],
            },
            { logPath: lp, now: FIXED },
        );
        expect(readOne(lp).command).toBe('estimate');
    });

    it('carries no free-form field a detail string could land in', () => {
        const lp = path.join(tmpDir(), 'q6.log');
        appendQuorumEvent(
            {
                ...CTX,
                configuredTotal: 2,
                result: evaluateQuorum(2, 0),
                // A caller handing over the CLI's own richer dict must not be
                // able to smuggle `detail` (provider error text, which can embed
                // paths and prompt fragments) through the typed surface.
                absent: [{ member: 'anthropic', reason: 'timeout', detail: '/Users/me/secret' } as never],
            },
            { logPath: lp, now: FIXED },
        );
        const rec = readOne(lp);
        expect(rec.absent).toEqual([{ member: 'anthropic', reason: 'timeout' }]);
        expect(JSON.stringify(rec)).not.toContain('secret');
    });

    it('fails open — an unwritable target returns false instead of throwing', () => {
        const dir = tmpDir();
        const blocker = path.join(dir, 'blocked');
        fs.writeFileSync(blocker, 'not a directory');
        // `blocker` is a file, so mkdir of `blocker/x` raises ENOTDIR inside
        // appendEvent — attendance telemetry must swallow it.
        expect(
            appendQuorumEvent(
                { ...CTX, configuredTotal: 1, result: evaluateQuorum(1, 1), absent: [] },
                { logPath: path.join(blocker, 'x', 'q.log'), now: FIXED },
            ),
        ).toBe(false);
    });

    it('honours the kill-switch like every other event', () => {
        process.env.AGENT_CONFIG_NO_EVENTS_LOG = '1';
        const lp = path.join(tmpDir(), 'q7.log');
        expect(
            appendQuorumEvent(
                { ...CTX, configuredTotal: 1, result: evaluateQuorum(1, 1), absent: [] },
                { logPath: lp },
            ),
        ).toBe(false);
        expect(fs.existsSync(lp)).toBe(false);
    });
});
