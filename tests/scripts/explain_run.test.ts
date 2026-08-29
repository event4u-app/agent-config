// Tests for src/scripts/explain_run.ts (road-to-feedback-8.11.md, Phase 7 —
// Explainability v0). Every fixture path is injectable via CLI-equivalent
// options so no test touches the real repo's dist/router.json, engagement
// log, audit dir, or hygiene state.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    buildReport,
    dispatchLines,
    filterAuditLines,
    filterEngagement,
    type Options,
    readEngagementEvents,
    readHygieneState,
    readRouter,
    summarizeEngagement,
    tallyRulesApplied,
    type ExplainAuditLine,
} from '../../src/scripts/explain_run.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'explain-run-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function p(...segments: string[]): string {
    return path.join(tmp, ...segments);
}

function writeJson(file: string, data: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf8');
}

function writeLines(file: string, lines: string[]): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
}

function baseOpts(overrides: Partial<Options> = {}): Options {
    return {
        task: null,
        since: null,
        router: p('router.json'),
        auditDir: p('audit'),
        engagement: p('.agent-engagement.jsonl'),
        // Fixture-scoped like every sibling option. `null` fell back to
        // DEFAULT_HYGIENE_CANDIDATES, which resolve against process.cwd() —
        // so a gitignored `agents/state/context-hygiene.json` left in the repo
        // by any other test in the suite made the "every source is absent"
        // case read REAL session state and go red. Invisible in CI, where that
        // file does not exist; reproducible locally after a full run.
        hygiene: p('context-hygiene.json'),
        output: null,
        ...overrides,
    };
}

const SAMPLE_ROUTER = {
    schema_version: 2,
    kernel: ['commit-policy', 'agent-authority'],
    tier_1: [
        {
            id: 'architecture',
            triggers: [{ keyword: 'controller' }, { phrase: 'structural decision' }],
            routes_to: [],
            workspaces: ['engineering'],
            packs: ['meta'],
        },
    ],
    tier_2: [
        {
            id: 'active-remediation',
            triggers: [{ keyword: 'refactor' }],
            routes_to: [],
            workspaces: ['engineering'],
            packs: ['engineering-base'],
        },
    ],
    profiles: { minimal: ['__kernel__'] },
};

describe('readRouter', () => {
    it('missing file → null', () => {
        expect(readRouter(p('nope.json'))).toBeNull();
    });

    it('malformed JSON → null', () => {
        fs.writeFileSync(p('bad.json'), 'not-json', 'utf8');
        expect(readRouter(p('bad.json'))).toBeNull();
    });

    it('valid file → parses kernel/tier_1/tier_2', () => {
        writeJson(p('router.json'), SAMPLE_ROUTER);
        const r = readRouter(p('router.json'));
        expect(r?.kernel).toEqual(['commit-policy', 'agent-authority']);
        expect(r?.tier_1[0]?.id).toBe('architecture');
        expect(r?.tier_2[0]?.id).toBe('active-remediation');
    });
});

describe('audit-log-v1 helpers', () => {
    const lines: ExplainAuditLine[] = [
        { ts: '2026-07-01T00:00:00Z', work_id: 'TASK-1-run', rules_applied: ['verify-before-complete'] },
        { ts: '2026-07-02T00:00:00Z', work_id: 'TASK-2-run', rules_applied: ['commit-policy', 'verify-before-complete'] },
        { ts: '2026-07-03T00:00:00Z', work_id: 'TASK-1-run', orchestration: { spawn_count: 2, dispatch_mode: 'do-in-parallel', tiers: ['lite'], token_delta: -500 } },
        { ts: '2026-07-04T00:00:00Z', work_id: 'TASK-1-run', orchestration: { spawn_count: 0 } }, // in-session, not a dispatch
    ];

    it('filterAuditLines matches on work_id substring', () => {
        const filtered = filterAuditLines(lines, 'TASK-1', null);
        expect(filtered).toHaveLength(3);
        expect(filtered.every((l) => l.work_id?.includes('TASK-1'))).toBe(true);
    });

    it('filterAuditLines matches on since', () => {
        const since = Date.parse('2026-07-03T00:00:00Z');
        const filtered = filterAuditLines(lines, null, since);
        expect(filtered).toHaveLength(2);
    });

    it('tallyRulesApplied counts rule ids across matching lines', () => {
        const tally = tallyRulesApplied(lines);
        expect(tally.get('verify-before-complete')).toBe(2);
        expect(tally.get('commit-policy')).toBe(1);
    });

    it('dispatchLines drops spawn_count 0 / absent orchestration', () => {
        const d = dispatchLines(lines);
        expect(d).toHaveLength(1);
        expect(d[0]?.orchestration?.dispatch_mode).toBe('do-in-parallel');
    });
});

describe('engagement helpers', () => {
    function line(task_id: string, ts: string, consulted: Record<string, string[]>, applied: Record<string, string[]> = {}): string {
        return JSON.stringify({ schema_version: 1, ts, task_id, boundary_kind: 'task', consulted, applied });
    }

    it('missing file → exists:false', () => {
        const r = readEngagementEvents(p('nope.jsonl'));
        expect(r.exists).toBe(false);
        expect(r.events).toHaveLength(0);
    });

    it('parses valid lines, counts malformed lines without throwing', () => {
        writeLines(p('.agent-engagement.jsonl'), [
            line('TASK-1', '2026-07-01T00:00:00Z', { skills: ['laravel'] }, { skills: ['laravel'] }),
            'not json at all',
            line('TASK-2', '2026-07-02T00:00:00Z', { rules: ['commit-policy'] }),
        ]);
        const r = readEngagementEvents(p('.agent-engagement.jsonl'));
        expect(r.exists).toBe(true);
        expect(r.totalLines).toBe(3);
        expect(r.skippedLines).toBe(1);
        expect(r.events).toHaveLength(2);
    });

    it('filterEngagement + summarizeEngagement aggregate per kind', () => {
        const events = readEngagementEvents(
            (() => {
                writeLines(p('eng.jsonl'), [
                    line('TASK-1', '2026-07-01T00:00:00Z', { skills: ['laravel', 'php-coder'] }, { skills: ['laravel'] }),
                    line('TASK-2', '2026-07-02T00:00:00Z', { skills: ['laravel'] }),
                ]);
                return p('eng.jsonl');
            })(),
        ).events;
        const filtered = filterEngagement(events, 'TASK-1', null);
        expect(filtered).toHaveLength(1);
        const summary = summarizeEngagement(filtered);
        expect(summary['skills']?.consulted).toBe(2);
        expect(summary['skills']?.applied).toBe(1);
        expect(summary['skills']?.consultedIds.has('laravel')).toBe(true);
        expect(summary['skills']?.consultedIds.has('php-coder')).toBe(true);
    });
});

describe('readHygieneState', () => {
    it('neither candidate exists → null state', () => {
        const r = readHygieneState([p('a.json'), p('b.json')]);
        expect(r.state).toBeNull();
        expect(r.path).toBeNull();
    });

    it('falls back to the second candidate when the first is absent', () => {
        writeJson(p('b.json'), { tool_calls: 5, loop_detected: false });
        const r = readHygieneState([p('a.json'), p('b.json')]);
        expect(r.path).toBe(p('b.json'));
        expect(r.state?.['tool_calls']).toBe(5);
    });

    it('prefers the first candidate when both exist', () => {
        writeJson(p('a.json'), { tool_calls: 1 });
        writeJson(p('b.json'), { tool_calls: 2 });
        const r = readHygieneState([p('a.json'), p('b.json')]);
        expect(r.path).toBe(p('a.json'));
        expect(r.state?.['tool_calls']).toBe(1);
    });
});

describe('buildReport — end to end', () => {
    it('every section reports honest "no data" over an empty directory', () => {
        const report = buildReport(baseOpts());
        expect(report).toMatch(/no data — .*router\.json.* absent/);
        expect(report).toMatch(/no data — .*\.agent-engagement\.jsonl.* absent/);
        expect(report).toMatch(/no data — .*audit.* absent/);
        expect(report).toMatch(/no data — none of the candidate paths exist/);
        expect(report).toMatch(/Not answerable today \(parked/);
    });

    it('renders populated sections when every fixture is present', () => {
        writeJson(p('router.json'), SAMPLE_ROUTER);
        writeLines(p('.agent-engagement.jsonl'), [
            JSON.stringify({
                schema_version: 1,
                ts: '2026-07-01T00:00:00Z',
                task_id: 'TASK-1',
                boundary_kind: 'task',
                consulted: { skills: ['laravel'] },
                applied: { skills: ['laravel'] },
            }),
        ]);
        writeLines(p('audit', '2026-07.jsonl'), [
            JSON.stringify({ ts: '2026-07-01T00:00:00Z', work_id: 'TASK-1-run', rules_applied: ['commit-policy'] }),
            JSON.stringify({
                ts: '2026-07-01T00:05:00Z',
                work_id: 'TASK-1-run',
                orchestration: { spawn_count: 1, dispatch_mode: 'do-and-judge', tiers: ['lite'], token_delta: -1200, first_pass_success: true, escalated: false },
            }),
        ]);
        writeJson(p('agents', 'state', 'context-hygiene.json'), { tool_calls: 12, loop_detected: false, checked_at: '2026-07-01T00:10:00Z' });

        const report = buildReport(
            baseOpts({
                task: 'TASK-1',
                hygiene: null,
            }),
        );

        expect(report).toContain('architecture');
        expect(report).toContain('keyword:controller');
        expect(report).toContain('active-remediation');
        expect(report).toContain('commit-policy (1 phase-line(s))');
        expect(report).toContain('laravel');
        expect(report).toContain('do-and-judge');
        expect(report).toContain('-1200 (estimated)');
        expect(report).toContain('true');
        expect(report).toMatch(/Not answerable today \(parked/);
    });

    it('--task filters out non-matching engagement + audit rows', () => {
        writeJson(p('router.json'), SAMPLE_ROUTER);
        writeLines(p('.agent-engagement.jsonl'), [
            JSON.stringify({ schema_version: 1, ts: '2026-07-01T00:00:00Z', task_id: 'OTHER-TASK', boundary_kind: 'task', consulted: { skills: ['laravel'] } }),
        ]);
        writeLines(p('audit', '2026-07.jsonl'), [
            JSON.stringify({ ts: '2026-07-01T00:00:00Z', work_id: 'OTHER-TASK-run', orchestration: { spawn_count: 1, dispatch_mode: 'do-in-steps', tiers: ['lite'], token_delta: 100 } }),
        ]);

        const report = buildReport(baseOpts({ task: 'TASK-1' }));
        expect(report).toMatch(/no data — 0 event\(s\) match task=TASK-1/);
        expect(report).toMatch(/no data — 0 dispatch\(es\) match task=TASK-1/);
    });

    it('summary renders honest no-data one-liners when every source is absent', () => {
        const report = buildReport(baseOpts());
        const summary = report.split('## Resolved rule set')[0] ?? '';
        expect(summary).toContain('## Summary');
        expect(summary).toContain('- Rules: no rule data (router file absent or malformed).');
        expect(summary).toContain('- Skill usage: no engagement data recorded in this window (telemetry off or no boundaries logged).');
        expect(summary).toContain('- Subagent dispatches: none in window.');
        expect(summary).toContain('- Session health: no state recorded.');
    });

    it('summary counts match the fixtures when every source is present', () => {
        writeJson(p('router.json'), SAMPLE_ROUTER);
        writeLines(p('.agent-engagement.jsonl'), [
            JSON.stringify({
                schema_version: 1,
                ts: '2026-07-01T00:00:00Z',
                task_id: 'TASK-1',
                boundary_kind: 'task',
                consulted: { skills: ['laravel', 'php-coder'] },
                applied: { skills: ['laravel'] },
            }),
        ]);
        writeLines(p('audit', '2026-07.jsonl'), [
            JSON.stringify({
                ts: '2026-07-01T00:05:00Z',
                work_id: 'TASK-1-run',
                orchestration: { spawn_count: 1, dispatch_mode: 'do-and-judge', tiers: ['lite'], token_delta: -1200 },
            }),
        ]);
        const hygienePath = p('agents', 'state', 'context-hygiene.json');
        writeJson(hygienePath, { tool_calls: 12, loop_detected: false });

        const report = buildReport(baseOpts({ task: 'TASK-1', hygiene: hygienePath }));
        const summary = report.split('## Resolved rule set')[0] ?? '';
        expect(summary).toContain('- Rules: 2 always-on (kernel), 2 available on triggers.');
        expect(summary).toContain('- Skill usage: 2 artifact(s) consulted, 1 applied across 1 task boundary(ies).');
        expect(summary).toContain('- Subagent dispatches: 1 dispatch(es), total token delta -1200.');
        expect(summary).toContain('- Session health: 12 tool call(s) recorded, loop detected: false.');
    });

    it('--since filters out earlier rows', () => {
        writeLines(p('.agent-engagement.jsonl'), [
            JSON.stringify({ schema_version: 1, ts: '2026-01-01T00:00:00Z', task_id: 'T', boundary_kind: 'task', consulted: { skills: ['old-skill'] } }),
        ]);
        const report = buildReport(baseOpts({ since: '2026-06-01T00:00:00Z' }));
        expect(report).toMatch(/no data — 0 event\(s\) match/);
        expect(report).not.toContain('old-skill');
    });
});
