/**
 * Tests for `src/scripts/_lib/user_memory_gate_counters.ts` — the
 * road-to-global-user-memory Phase 5 promotion-behaviour gate counters.
 *
 * Every test injects `EVENT4U_CONFIG_HOME` at a temp dir so the real
 * `~/.event4u/agent-config/` on the machine running this suite is never
 * touched (mirrors `tests/lib/user_global_observations.test.ts`).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as gate from '../../src/scripts/_lib/user_memory_gate_counters';

const tmp_dirs: string[] = [];
const saved_env: Array<[string, string | undefined]> = [];

function make_tmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmp_dirs.push(dir);
    return dir;
}

function isolate_home(): void {
    const fake_home = make_tmp('gate-fakehome-');
    saved_env.push(['HOME', process.env.HOME]);
    process.env.HOME = fake_home;
}

beforeEach(() => {
    isolate_home();
});

afterEach(() => {
    while (saved_env.length > 0) {
        const [key, value] = saved_env.pop() as [string, string | undefined];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

describe('PromotionGateCounters — shape (allowlisted scalars only)', () => {
    it('zeroCounters() has exactly the four documented fields, all numbers', () => {
        const zero = gate.zeroCounters();
        expect(Object.keys(zero).sort()).toEqual([...gate.GATE_COUNTER_FIELDS].sort());
        for (const field of gate.GATE_COUNTER_FIELDS) {
            expect(typeof zero[field]).toBe('number');
        }
    });

    it('coerceCounters DROPS an unknown key rather than passing it through', () => {
        const poisoned = {
            observations_proposed: 3,
            // A field capable of holding free-form content — must never survive.
            note: 'user said their SSN is 123-45-6789',
        };
        const out = gate.coerceCounters(poisoned);
        expect(Object.keys(out).sort()).toEqual([...gate.GATE_COUNTER_FIELDS].sort());
        expect((out as unknown as Record<string, unknown>)['note']).toBeUndefined();
        expect(out.observations_proposed).toBe(3);
    });

    it('coerceCounters rejects a string masquerading as a count and falls back to 0', () => {
        const poisoned = {
            observations_proposed: 'user prefers short replies', // free-form content, not a count
            observations_accepted: 2,
        };
        const out = gate.coerceCounters(poisoned);
        expect(out.observations_proposed).toBe(0);
        expect(out.observations_accepted).toBe(2);
    });

    it('coerceCounters rejects negative and non-integer values', () => {
        const poisoned = {
            projects_with_ge_10_sessions: -5,
            projects_with_promoted_observation: 1.5,
        };
        const out = gate.coerceCounters(poisoned);
        expect(out.projects_with_ge_10_sessions).toBe(0);
        expect(out.projects_with_promoted_observation).toBe(0);
    });

    it('coerceCounters tolerates null, an array, and a bare scalar as input', () => {
        expect(gate.coerceCounters(null)).toEqual(gate.zeroCounters());
        expect(gate.coerceCounters([1, 2, 3])).toEqual(gate.zeroCounters());
        expect(gate.coerceCounters('not an object')).toEqual(gate.zeroCounters());
    });
});

describe('readGateCounters — tolerant read, never throws', () => {
    it('returns zeroCounters() when no file exists yet', () => {
        const home = make_tmp('gate-config-');
        const env = { EVENT4U_CONFIG_HOME: home };
        expect(gate.readGateCounters({ env })).toEqual(gate.zeroCounters());
    });

    it('returns zeroCounters() on malformed JSON rather than throwing', () => {
        const home = make_tmp('gate-config-');
        const env = { EVENT4U_CONFIG_HOME: home };
        const target = gate.gateCountersWriteTarget(env);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, '{ not valid json', 'utf-8');
        expect(gate.readGateCounters({ env })).toEqual(gate.zeroCounters());
    });

    it('falls back to the legacy XDG root when the new namespace has nothing', () => {
        const home = make_tmp('gate-legacyhome-');
        saved_env.push(['HOME', process.env.HOME]);
        process.env.HOME = home;
        const legacy_dir = path.join(home, '.config', 'agent-config', 'user');
        fs.mkdirSync(legacy_dir, { recursive: true });
        fs.writeFileSync(
            path.join(legacy_dir, 'promotion-gate-counters.json'),
            JSON.stringify({ ...gate.zeroCounters(), observations_proposed: 7 }),
            'utf-8',
        );
        const empty_new_home = make_tmp('gate-neverwritten-');
        const env = { EVENT4U_CONFIG_HOME: empty_new_home };
        expect(gate.readGateCounters({ env }).observations_proposed).toBe(7);
    });
});

describe('increment on propose/accept — counts only, no content ever touches the struct', () => {
    it('recordObservationProposed increments observations_proposed and persists it', () => {
        const home = make_tmp('gate-config-');
        const env = { EVENT4U_CONFIG_HOME: home };
        const first = gate.recordObservationProposed({ env });
        expect(first.observations_proposed).toBe(1);
        expect(first.observations_accepted).toBe(0);

        const second = gate.recordObservationProposed({ env });
        expect(second.observations_proposed).toBe(2);

        // Persisted, not just returned in-memory — a fresh read sees it too.
        expect(gate.readGateCounters({ env }).observations_proposed).toBe(2);
    });

    it('recordObservationAccepted increments observations_accepted independently of proposed', () => {
        const home = make_tmp('gate-config-');
        const env = { EVENT4U_CONFIG_HOME: home };
        gate.recordObservationProposed({ env });
        gate.recordObservationProposed({ env });
        const accepted = gate.recordObservationAccepted({ env });

        expect(accepted.observations_proposed).toBe(2);
        expect(accepted.observations_accepted).toBe(1);
    });

    it('recordProjectReachedTenSessions and recordProjectPromotedFirstObservation increment their own fields only', () => {
        const home = make_tmp('gate-config-');
        const env = { EVENT4U_CONFIG_HOME: home };
        gate.recordProjectReachedTenSessions({ env });
        gate.recordProjectReachedTenSessions({ env });
        const after_promotion = gate.recordProjectPromotedFirstObservation({ env });

        expect(after_promotion.projects_with_ge_10_sessions).toBe(2);
        expect(after_promotion.projects_with_promoted_observation).toBe(1);
        expect(after_promotion.observations_proposed).toBe(0);
        expect(after_promotion.observations_accepted).toBe(0);
    });

    it('the persisted counters file NEVER contains a value that is not one of the four numeric fields', () => {
        const home = make_tmp('gate-config-');
        const env = { EVENT4U_CONFIG_HOME: home };
        gate.recordObservationProposed({ env });
        gate.recordObservationAccepted({ env });
        gate.recordProjectReachedTenSessions({ env });
        gate.recordProjectPromotedFirstObservation({ env });

        const target = gate.gateCountersWriteTarget(env);
        const on_disk: unknown = JSON.parse(fs.readFileSync(target, 'utf-8'));
        expect(Object.keys(on_disk as Record<string, unknown>).sort()).toEqual(
            [...gate.GATE_COUNTER_FIELDS].sort(),
        );
        for (const value of Object.values(on_disk as Record<string, unknown>)) {
            expect(typeof value).toBe('number');
        }
    });
});

describe('evaluateKillCriterion — ADR-138 § Promotion-behaviour gate', () => {
    it('reports both ratios as null (undefined, not zero) when the gate has never been exercised', () => {
        const result = gate.evaluateKillCriterion(gate.zeroCounters());
        expect(result.project_promotion_share).toBeNull();
        expect(result.review_accept_rate).toBeNull();
        expect(result.teardown_review_required).toBe(false);
    });

    it('flags teardown_review_required when the project-promotion share is below 40%', () => {
        const counters: gate.PromotionGateCounters = {
            projects_with_ge_10_sessions: 10,
            projects_with_promoted_observation: 3, // 30% < 40% floor
            observations_proposed: 0,
            observations_accepted: 0,
        };
        const result = gate.evaluateKillCriterion(counters);
        expect(result.project_promotion_share).toBeCloseTo(0.3);
        expect(result.teardown_review_required).toBe(true);
    });

    it('flags teardown_review_required when the review-accept rate is below 30%', () => {
        const counters: gate.PromotionGateCounters = {
            projects_with_ge_10_sessions: 0,
            projects_with_promoted_observation: 0,
            observations_proposed: 100,
            observations_accepted: 20, // 20% < 30% floor
        };
        const result = gate.evaluateKillCriterion(counters);
        expect(result.review_accept_rate).toBeCloseTo(0.2);
        expect(result.teardown_review_required).toBe(true);
    });

    it('does NOT flag teardown when both floors are cleared', () => {
        const counters: gate.PromotionGateCounters = {
            projects_with_ge_10_sessions: 10,
            projects_with_promoted_observation: 5, // 50% >= 40%
            observations_proposed: 100,
            observations_accepted: 40, // 40% >= 30%
        };
        const result = gate.evaluateKillCriterion(counters);
        expect(result.teardown_review_required).toBe(false);
    });
});
