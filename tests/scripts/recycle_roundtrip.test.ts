/**
 * Recycle round-trip — the correctness gate for the envelope schema
 * (road-to-token-economy-recycling Phase 2.4; verify: `npx vitest run
 * recycle_roundtrip`).
 *
 * Scripted session A executes half of a deterministic task and recycles
 * through the REAL pipeline — `runSessionRecycle` writes the envelope file,
 * `consume_recycle_envelope` validates/injects/consumes it — and scripted
 * session B resumes FROM THE INJECTED ENVELOPE ALONE (it never sees A's
 * in-memory state). The deliverable must equal an uninterrupted control
 * run's, byte for byte.
 *
 * The degradation arm is the point of the design: dropping a `decisions`
 * entry makes B's deliverable DIVERGE from control — proving the field is
 * load-bearing, i.e. "a field whose absence changes the outcome is a
 * missing field, found here and not in production."
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runSessionRecycle } from '../../src/scripts/_cli/cmd_session_recycle.js';
import { consume_recycle_envelope } from '../../src/scripts/handoff_context_hook.js';

// ── The deterministic task ──────────────────────────────────────────────
// Build a report from a fixed record set. Steps are data; one early
// DECISION (the field delimiter) parameterizes every later step.

const RECORDS = [
    ['alpha', '3'],
    ['beta', '7'],
    ['gamma', '5'],
] as const;

const ALL_STEPS = ['header', 'rows', 'total', 'footer'] as const;
type Step = (typeof ALL_STEPS)[number];

interface TaskState {
    delimiter: string;
    lines: string[];
}

function applyStep(state: TaskState, step: Step): TaskState {
    const d = state.delimiter;
    switch (step) {
        case 'header':
            return { ...state, lines: [...state.lines, `name${d}count`] };
        case 'rows':
            return { ...state, lines: [...state.lines, ...RECORDS.map((r) => r.join(d))] };
        case 'total':
            return {
                ...state,
                lines: [...state.lines, `total${d}${RECORDS.reduce((s, r) => s + Number(r[1]), 0)}`],
            };
        case 'footer':
            return { ...state, lines: [...state.lines, `generated${d}fixture`] };
    }
}

function runSteps(state: TaskState, steps: readonly Step[]): TaskState {
    return steps.reduce(applyStep, state);
}

function deliverable(state: TaskState): string {
    return state.lines.join('\n') + '\n';
}

// ── Session scripts ─────────────────────────────────────────────────────

/** Session A: decide the delimiter, run the first half, recycle mid-task. */
function sessionA(root: string): void {
    const decided: TaskState = { delimiter: '|', lines: [] };
    const midTask = runSteps(decided, ALL_STEPS.slice(0, 2));

    const envelope = {
        summary: 'report half-built; totals and footer open',
        task: 'build the fixture report into report.txt',
        acceptance_criteria: ['report.txt equals the control deliverable'],
        remaining: ALL_STEPS.slice(2).map((s) => `step:${s}`),
        not_carried_forward: ['the raw records — re-read from the fixture, not from memory'],
        decisions: ['delimiter=| — pipe keeps the report grep-safe'],
        artifact_paths: ['work/partial.txt'],
    };
    // Persist the partial deliverable as a real artifact (pointer, not body).
    fs.mkdirSync(path.join(root, 'work'), { recursive: true });
    fs.writeFileSync(path.join(root, 'work', 'partial.txt'), deliverable(midTask));

    const result = runSessionRecycle(JSON.stringify(envelope), { cwd: root });
    if (result.code !== 0) {
        throw new Error(`session A could not recycle: ${result.err.join(' / ')}`);
    }
}

/** Session B: bootstraps from the INJECTED envelope alone and completes. */
function sessionB(root: string): string {
    const decision = consume_recycle_envelope(root);
    if (decision.action !== 'inject' || !decision.context) {
        throw new Error(`session B received no envelope: ${decision.reason}`);
    }
    // Parse the envelope back out of the injected DATA block.
    const jsonStart = decision.context.indexOf('{');
    const jsonEnd = decision.context.lastIndexOf('}');
    const envelope = JSON.parse(decision.context.slice(jsonStart, jsonEnd + 1)) as {
        remaining: string[];
        decisions?: string[];
        artifact_paths?: string[];
    };

    // Everything B knows comes from the envelope: the partial artifact by
    // path, the delimiter from the decision line, the open steps.
    const partialPath = envelope.artifact_paths?.[0];
    const partial = partialPath
        ? fs.readFileSync(path.join(root, partialPath), 'utf-8').trimEnd().split('\n')
        : [];
    const delimiterDecision = (envelope.decisions ?? [])
        .map((d) => /^delimiter=(\S+)/.exec(d)?.[1])
        .find((v) => v !== undefined);
    const delimiter = delimiterDecision ?? ','; // no decision carried → B picks the default
    const remainingSteps = envelope.remaining
        .map((r) => /^step:(\w+)$/.exec(r)?.[1])
        .filter((s): s is Step => (ALL_STEPS as readonly string[]).includes(s ?? ''));

    const final = runSteps({ delimiter, lines: partial }, remainingSteps);
    return deliverable(final);
}

function scratchRoot(): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'recycle-roundtrip-')));
}

// ── The gate ────────────────────────────────────────────────────────────

describe('recycle round-trip (Phase 2.4)', () => {
    const control = deliverable(runSteps({ delimiter: '|', lines: [] }, ALL_STEPS));

    it('A recycles mid-task, B resumes from the envelope alone, deliverables are EQUAL', () => {
        const root = scratchRoot();
        sessionA(root);
        expect(sessionB(root)).toBe(control);
    });

    it('degradation arm: dropping the decision changes the outcome — the field is load-bearing', () => {
        const root = scratchRoot();
        sessionA(root);
        // Corrupt the pending envelope: remove the decisions list (legal —
        // decisions is optional — but semantically lossy).
        const target = path.join(root, 'agents', 'runtime', 'state', 'recycle-envelope.json');
        const envelope = JSON.parse(fs.readFileSync(target, 'utf-8')) as Record<string, unknown>;
        delete envelope['decisions'];
        fs.writeFileSync(target, JSON.stringify(envelope, null, 2));

        expect(sessionB(root)).not.toBe(control);
    });

    it('the recycle consumes the envelope — a third session finds nothing', () => {
        const root = scratchRoot();
        sessionA(root);
        sessionB(root);
        expect(consume_recycle_envelope(root).action).toBe('absent');
    });
});
