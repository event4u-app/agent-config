/**
 * Review-Gate governance tests — road-to-team-mode Phase 4.
 *
 * Covers: first-line ALLOW/BLOCK/UNKNOWN parsing, the consecutive-BLOCK
 * state machine on fixture transcripts (incl. ALLOW reset + UNKNOWN never
 * counted), the circuit breaker rendered exactly once, dedupe of the same
 * gate run, ledger line shape + read helper, unmanaged no-op, upstream
 * plugin-state detection, and the doctor sub-signal WARN states.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { build_ai_team_config } from '../../../src/scripts/ai_team/config';
import {
    circuit_breaker_notice,
    find_latest_gate_transcript,
    format_gate_ledger_line,
    GATE_LEDGER_KIND,
    gate_ledger_path,
    gate_state_path,
    parse_gate_verdict,
    read_gate_ledger,
    record_gate_verdict,
    review_gate_doctor_signal,
    UPSTREAM_GATE_COST_WARNING,
    UPSTREAM_GATE_JOB_TITLE,
    upstream_gate_enabled,
} from '../../../src/scripts/ai_team/review_gate';

const tmp_dirs: string[] = [];
const ENV_KEYS = ['CLAUDE_CONFIG_DIR', 'CLAUDE_PLUGIN_DATA', 'AGENT_CONFIG_NO_EVENTS_LOG'] as const;
const env_prev: Record<string, string | undefined> = {};

function make_tmp(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ai-team-gate-')));
    tmp_dirs.push(dir);
    return dir;
}

beforeEach(() => {
    for (const k of ENV_KEYS) {
        env_prev[k] = process.env[k];
        delete process.env[k];
    }
    // Point the config-dir candidate at an empty tmp dir so a REAL local
    // plugin install can never leak into these tests.
    process.env['CLAUDE_CONFIG_DIR'] = make_tmp();
});

afterEach(() => {
    for (const k of ENV_KEYS) {
        if (env_prev[k] === undefined) delete process.env[k];
        else process.env[k] = env_prev[k] as string;
    }
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

const MANAGED = build_ai_team_config({
    enabled: true,
    review_gate: { managed: true, max_consecutive_blocks: 3 },
});
const UNMANAGED = build_ai_team_config({ enabled: true });

interface Paths {
    root: string;
    state: string;
    ledger: string;
}

function paths(): Paths {
    const root = make_tmp();
    return { root, state: gate_state_path(root), ledger: gate_ledger_path(root) };
}

function record(p: Paths, transcript: string, extra: Record<string, unknown> = {}) {
    return record_gate_verdict({
        session_id: 'sess-1',
        transcript_text: transcript,
        config: MANAGED,
        project_root: p.root,
        state_path: p.state,
        ledger_path: p.ledger,
        now: new Date('2026-07-12T10:00:00Z'),
        ...extra,
    });
}

// === first-line contract ===================================================

describe('parse_gate_verdict — first-line ALLOW/BLOCK contract', () => {
    it('upstream shapes: `ALLOW: <reason>` / `BLOCK: <reason>`', () => {
        expect(parse_gate_verdict('ALLOW: no code changes this turn\ndetails…')).toBe('ALLOW');
        expect(parse_gate_verdict('BLOCK: missing empty-state handling')).toBe('BLOCK');
    });

    it('bare ALLOW / BLOCK first lines are accepted', () => {
        expect(parse_gate_verdict('ALLOW')).toBe('ALLOW');
        expect(parse_gate_verdict('BLOCK\nreason on line 2')).toBe('BLOCK');
    });

    it('unknown first lines are honestly UNKNOWN — never counted as BLOCK', () => {
        expect(parse_gate_verdict('')).toBe('UNKNOWN');
        expect(parse_gate_verdict(null)).toBe('UNKNOWN');
        expect(parse_gate_verdict(undefined)).toBe('UNKNOWN');
        expect(parse_gate_verdict('The review found some issues.')).toBe('UNKNOWN');
        expect(parse_gate_verdict('allow: lowercase is not the contract')).toBe('UNKNOWN');
        expect(parse_gate_verdict('BLOCKED: near-miss token')).toBe('UNKNOWN');
        expect(parse_gate_verdict('ALLOWANCE granted')).toBe('UNKNOWN');
        expect(parse_gate_verdict('prose first\nBLOCK: buried on line 2')).toBe('UNKNOWN');
    });
});

// === state machine =========================================================

describe('record_gate_verdict — consecutive-BLOCK state machine', () => {
    it('counts consecutive BLOCKs and trips the circuit breaker at the bound', () => {
        const p = paths();
        const r1 = record(p, 'BLOCK: issue 1');
        expect(r1).toMatchObject({
            verdict: 'BLOCK',
            consecutive_blocks: 1,
            counted: true,
            circuit_open: false,
            notice: null,
        });
        const r2 = record(p, 'BLOCK: issue 2');
        expect(r2.consecutive_blocks).toBe(2);
        expect(r2.circuit_open).toBe(false);
        expect(r2.notice).toBeNull();
        const r3 = record(p, 'BLOCK: issue 3');
        expect(r3.consecutive_blocks).toBe(3);
        expect(r3.circuit_open).toBe(true);
        expect(r3.notice).toBe(circuit_breaker_notice(3));
    });

    it('circuit-breaker notice is rendered EXACTLY once — later BLOCKs stay open, no re-notice', () => {
        const p = paths();
        record(p, 'BLOCK: 1');
        record(p, 'BLOCK: 2');
        const trip = record(p, 'BLOCK: 3');
        expect(trip.notice).not.toBeNull();
        const r4 = record(p, 'BLOCK: 4');
        expect(r4.consecutive_blocks).toBe(4);
        expect(r4.circuit_open).toBe(true);
        expect(r4.notice).toBeNull();
        const r5 = record(p, 'BLOCK: 5');
        expect(r5.notice).toBeNull();
    });

    it('ALLOW resets the counter AND re-arms the notice', () => {
        const p = paths();
        record(p, 'BLOCK: 1');
        record(p, 'BLOCK: 2');
        const reset = record(p, 'ALLOW: fixed');
        expect(reset).toMatchObject({
            verdict: 'ALLOW',
            consecutive_blocks: 0,
            circuit_open: false,
            notice: null,
        });
        // A fresh run of BLOCKs can trip (and notify) again.
        record(p, 'BLOCK: a');
        record(p, 'BLOCK: b');
        const trip = record(p, 'BLOCK: c');
        expect(trip.notice).toBe(circuit_breaker_notice(3));
    });

    it('UNKNOWN leaves the counter untouched and is never counted', () => {
        const p = paths();
        record(p, 'BLOCK: 1');
        record(p, 'BLOCK: 2');
        const u = record(p, 'no contract line here');
        expect(u).toMatchObject({
            verdict: 'UNKNOWN',
            consecutive_blocks: 2,
            counted: false,
            circuit_open: false,
            notice: null,
        });
        // Next BLOCK continues from 2 → 3 → trips.
        expect(record(p, 'BLOCK: 3').notice).toBe(circuit_breaker_notice(3));
    });

    it('same dedupe_key twice = same gate run — never recounted', () => {
        const p = paths();
        const r1 = record(p, 'BLOCK: 1', { dedupe_key: 'task-abc' });
        expect(r1.consecutive_blocks).toBe(1);
        const r2 = record(p, 'BLOCK: 1', { dedupe_key: 'task-abc' });
        expect(r2.counted).toBe(false);
        expect(r2.consecutive_blocks).toBe(1);
        expect(r2.ledger_line).toBeNull();
        const r3 = record(p, 'BLOCK: 2', { dedupe_key: 'task-def' });
        expect(r3.consecutive_blocks).toBe(2);
    });

    it('sessions are independent', () => {
        const p = paths();
        record(p, 'BLOCK: 1');
        const other = record_gate_verdict({
            session_id: 'sess-2',
            transcript_text: 'BLOCK: other session',
            config: MANAGED,
            project_root: p.root,
            state_path: p.state,
            ledger_path: p.ledger,
        });
        expect(other.consecutive_blocks).toBe(1);
        expect(record(p, 'BLOCK: 2').consecutive_blocks).toBe(2);
    });

    it('managed: false is a strict no-op — no state file, no ledger, no notice', () => {
        const p = paths();
        const r = record_gate_verdict({
            session_id: 'sess-1',
            transcript_text: 'BLOCK: would count if managed',
            config: UNMANAGED,
            project_root: p.root,
            state_path: p.state,
            ledger_path: p.ledger,
        });
        expect(r).toMatchObject({
            verdict: 'BLOCK',
            consecutive_blocks: 0,
            counted: false,
            circuit_open: false,
            notice: null,
            ledger_line: null,
        });
        expect(fs.existsSync(p.state)).toBe(false);
        expect(fs.existsSync(p.ledger)).toBe(false);
    });

    it('bound 1 trips on the first BLOCK', () => {
        const p = paths();
        const cfg = build_ai_team_config({
            enabled: true,
            review_gate: { managed: true, max_consecutive_blocks: 1 },
        });
        const r = record(p, 'BLOCK: instant', { config: cfg });
        expect(r.circuit_open).toBe(true);
        expect(r.notice).toBe(circuit_breaker_notice(1));
    });
});

// === ledger ================================================================

describe('gate ledger — one events-log line per verdict', () => {
    it('line shape: schema_version + ts_utc + kind + session + verdict + counter', () => {
        const p = paths();
        record(p, 'BLOCK: 1');
        record(p, 'BLOCK: 2');
        record(p, 'ALLOW: fixed');
        const lines = fs
            .readFileSync(p.ledger, 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l));
        expect(lines).toHaveLength(3);
        expect(lines[0]).toEqual({
            schema_version: 1,
            ts_utc: '2026-07-12T10:00:00Z',
            kind: GATE_LEDGER_KIND,
            session_id: 'sess-1',
            verdict: 'BLOCK',
            counter: '1/3',
        });
        expect(lines[1]).toMatchObject({ verdict: 'BLOCK', counter: '2/3' });
        expect(lines[2]).toMatchObject({ verdict: 'ALLOW', counter: 'reset' });
    });

    it('formatted line matches the roadmap shape: `team.gate: BLOCK 2/3`', () => {
        const p = paths();
        record(p, 'BLOCK: 1');
        const r2 = record(p, 'BLOCK: 2');
        expect(r2.ledger_line).toBe('team.gate: BLOCK 2/3');
        const reset = record(p, 'ALLOW: done');
        expect(reset.ledger_line).toBe('team.gate: ALLOW reset');
        expect(format_gate_ledger_line({ verdict: 'UNKNOWN', counter: '2/3' })).toBe(
            'team.gate: UNKNOWN 2/3',
        );
    });

    it('UNKNOWN verdicts are ledgered honestly with the unchanged counter', () => {
        const p = paths();
        record(p, 'BLOCK: 1');
        const u = record(p, 'garbled output');
        expect(u.ledger_line).toBe('team.gate: UNKNOWN 1/3');
    });

    it('read_gate_ledger filters by session and honours limit', () => {
        const p = paths();
        record(p, 'BLOCK: 1');
        record(p, 'BLOCK: 2');
        record_gate_verdict({
            session_id: 'sess-2',
            transcript_text: 'ALLOW: other',
            config: MANAGED,
            project_root: p.root,
            state_path: p.state,
            ledger_path: p.ledger,
        });
        const all = read_gate_ledger({ ledger_path: p.ledger });
        expect(all).toHaveLength(3);
        const s1 = read_gate_ledger({ ledger_path: p.ledger, session_id: 'sess-1' });
        expect(s1.map((e) => e.counter)).toEqual(['1/3', '2/3']);
        const last = read_gate_ledger({ ledger_path: p.ledger, session_id: 'sess-1', limit: 1 });
        expect(last).toHaveLength(1);
        expect(last[0]?.counter).toBe('2/3');
        // Missing file → empty, never a throw.
        expect(read_gate_ledger({ ledger_path: path.join(p.root, 'nope.log') })).toEqual([]);
    });

    it('honours the AGENT_CONFIG_NO_EVENTS_LOG kill-switch (counter still runs)', () => {
        const p = paths();
        process.env['AGENT_CONFIG_NO_EVENTS_LOG'] = '1';
        const r = record(p, 'BLOCK: 1');
        expect(r.consecutive_blocks).toBe(1);
        expect(r.ledger_line).toBeNull();
        expect(fs.existsSync(p.ledger)).toBe(false);
    });
});

// === upstream plugin-state detection =======================================

/** Write an upstream-shaped plugin state dir for `workspace_root`. */
function seed_upstream_state(
    workspace_root: string,
    stop_review_gate: boolean,
): string {
    // Mirror upstream resolveStateDir: <sanitized basename>-<sha16>.
    const canonical = fs.realpathSync.native(workspace_root);
    const slug =
        (path.basename(workspace_root) || 'workspace')
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'workspace';
    const hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
    const dir = path.join(
        process.env['CLAUDE_CONFIG_DIR'] as string,
        'plugins',
        'data',
        'codex-openai-codex',
        'state',
        `${slug}-${hash}`,
    );
    fs.mkdirSync(path.join(dir, 'jobs'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'state.json'),
        JSON.stringify({ version: 1, config: { stopReviewGate: stop_review_gate }, jobs: [] }),
    );
    return dir;
}

describe('upstream_gate_enabled / find_latest_gate_transcript', () => {
    it('reads stopReviewGate from the plugin state for this workspace', () => {
        const root = make_tmp();
        expect(upstream_gate_enabled(root)).toBe(false);
        seed_upstream_state(root, false);
        expect(upstream_gate_enabled(root)).toBe(false);
        seed_upstream_state(root, true);
        expect(upstream_gate_enabled(root)).toBe(true);
    });

    it('finds the newest stop-gate job for the session and returns its rawOutput', () => {
        const root = make_tmp();
        const dir = seed_upstream_state(root, true);
        const job = (
            id: string,
            title: string,
            completedAt: string,
            rawOutput: string,
            sessionId?: string,
        ) =>
            fs.writeFileSync(
                path.join(dir, 'jobs', `${id}.json`),
                JSON.stringify({
                    id,
                    title,
                    status: 'completed',
                    completedAt,
                    ...(sessionId ? { sessionId } : {}),
                    result: { rawOutput },
                }),
            );
        job('task-1', UPSTREAM_GATE_JOB_TITLE, '2026-07-12T09:00:00Z', 'BLOCK: old', 's1');
        job('task-2', UPSTREAM_GATE_JOB_TITLE, '2026-07-12T10:00:00Z', 'ALLOW: newest', 's1');
        job('task-3', 'Codex Review', '2026-07-12T11:00:00Z', 'BLOCK: not a gate job', 's1');
        job('task-4', UPSTREAM_GATE_JOB_TITLE, '2026-07-12T12:00:00Z', 'BLOCK: other session', 's2');

        const hit = find_latest_gate_transcript(root, 's1');
        expect(hit).not.toBeNull();
        expect(hit?.job_id).toBe('task-2');
        expect(hit?.transcript).toBe('ALLOW: newest');
        // No gate jobs at all → null.
        expect(find_latest_gate_transcript(make_tmp(), 's1')).toBeNull();
    });
});

// === doctor sub-signal (c) =================================================

describe('review_gate_doctor_signal', () => {
    it('unmanaged + plugin gate off → `review-gate off`, no remedies', () => {
        const root = make_tmp();
        const sig = review_gate_doctor_signal(root, {});
        expect(sig.gate_str).toBe('review-gate off');
        expect(sig.remedies).toEqual([]);
    });

    it('plugin gate ON while managed:false → WARN with enable hint + quoted upstream cost warning', () => {
        const root = make_tmp();
        seed_upstream_state(root, true);
        const sig = review_gate_doctor_signal(root, {});
        expect(sig.gate_str).toContain('plugin gate on, unmanaged');
        expect(sig.remedies).toHaveLength(1);
        expect(sig.remedies[0]).toContain('ai_team.review_gate.managed: true');
        expect(sig.remedies[0]).toContain(`"${UPSTREAM_GATE_COST_WARNING}"`);
        expect(sig.remedies[0]).toContain('/codex:setup --disable-review-gate');
    });

    it('managed:true → ok string with the effective bound (default 3)', () => {
        const root = make_tmp();
        const sig = review_gate_doctor_signal(root, { managed: true });
        expect(sig.gate_str).toContain('review-gate on');
        expect(sig.gate_str).toContain('bound 3');
        expect(sig.remedies).toEqual([]);
        const explicit = review_gate_doctor_signal(root, {
            managed: true,
            max_consecutive_blocks: 5,
        });
        expect(explicit.gate_str).toContain('bound 5');
    });

    it('managed:true with an invalid bound in raw settings → WARN', () => {
        const root = make_tmp();
        const sig = review_gate_doctor_signal(root, { managed: true, max_consecutive_blocks: 0 });
        expect(sig.gate_str).toContain('loop bound invalid');
        expect(sig.remedies[0]).toContain('positive');
    });
});
