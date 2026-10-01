/**
 * Learning sidecar aggregator (road-to-retrieval-substrate-hardening B3).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    buildSidecar,
    HALF_LIFE_DAYS,
    main,
    MIN_CORROBORATIONS,
    renderLessonsMd,
} from '../../src/scripts/learning_sidecar.js';

const NOW = '2026-07-10T00:00:00.000Z';
const nowMs = Date.parse(NOW);
const daysAgo = (d: number): string => new Date(nowMs - d * 86400000).toISOString();

let dir = '';
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-'));
});
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

function writeSignals(lines: Array<Record<string, unknown>>): void {
    fs.writeFileSync(
        path.join(dir, 'signals-2026-07.jsonl'),
        lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
    );
}

/**
 * Run `main()` in-process and capture what it wrote. In-process rather than
 * through a subprocess on purpose: every spawn-bound case in the sibling
 * `memory_learn_hook` suite had to be given a 30 s timeout because a cold
 * `npx tsx` start dominates a contended CI runner, and these cases assert
 * stdout shape — nothing a subprocess would observe differently.
 */
function capture(argv: string[]): { code: number; stdout: string; stderr: string } {
    let stdout = '';
    let stderr = '';
    const realOut = process.stdout.write.bind(process.stdout);
    const realErr = process.stderr.write.bind(process.stderr);
    (process.stdout as { write: unknown }).write = (chunk: string): boolean => {
        stdout += chunk;
        return true;
    };
    (process.stderr as { write: unknown }).write = (chunk: string): boolean => {
        stderr += chunk;
        return true;
    };
    try {
        return { code: main(argv), stdout, stderr };
    } finally {
        (process.stdout as { write: unknown }).write = realOut;
        (process.stderr as { write: unknown }).write = realErr;
    }
}

const sig = (o: Partial<Record<string, unknown>>): Record<string, unknown> => ({
    id: Math.random().toString(36).slice(2),
    ts: NOW,
    origin: 'agent',
    entry_type: 'historical-patterns',
    path: 'src/a.ts',
    body: 'guard against null currency',
    ...o,
});

describe('corroboration gate', () => {
    it('a single-origin signal is NOT promoted (a session cannot mint a lesson)', () => {
        writeSignals([sig({ origin: 'session-1' })]);
        expect(buildSidecar(dir, NOW).lessons).toHaveLength(0);
    });

    it('two distinct origins promote a preferred lesson', () => {
        writeSignals([sig({ origin: 'session-1' }), sig({ origin: 'session-2' })]);
        const lessons = buildSidecar(dir, NOW).lessons;
        expect(lessons).toHaveLength(1);
        expect(lessons[0]?.verdict).toBe('preferred');
        expect(lessons[0]?.corroborations).toBe(2);
    });

    it('two signals from the SAME origin do not corroborate', () => {
        writeSignals([sig({ origin: 'session-1' }), sig({ origin: 'session-1' })]);
        expect(buildSidecar(dir, NOW).lessons).toHaveLength(0);
    });
});

describe('decay', () => {
    it('a fresh corroborated lesson scores higher than an old one', () => {
        writeSignals([
            sig({ origin: 's1', path: 'src/fresh.ts', ts: NOW }),
            sig({ origin: 's2', path: 'src/fresh.ts', ts: NOW }),
            sig({ origin: 's1', path: 'src/old.ts', ts: daysAgo(120) }),
            sig({ origin: 's2', path: 'src/old.ts', ts: daysAgo(120) }),
        ]);
        const lessons = buildSidecar(dir, NOW).lessons;
        const fresh = lessons.find((l) => l.path === 'src/fresh.ts');
        const old = lessons.find((l) => l.path === 'src/old.ts');
        expect(fresh?.score).toBeGreaterThan(old?.score ?? 0);
        // ~4 half-lives at 120 days → ≈ 0.0625 per signal.
        expect(old?.score).toBeLessThan(0.2);
    });
});

describe('polarity + verdicts', () => {
    it('two dead_end origins roll up into a dead_end verdict', () => {
        writeSignals([
            sig({ origin: 's1', polarity: 'dead_end', body: 'tried Kafka — too heavy' }),
            sig({ origin: 's2', polarity: 'dead_end', body: 'tried Kafka — too heavy' }),
        ]);
        expect(buildSidecar(dir, NOW).lessons[0]?.verdict).toBe('dead_end');
    });

    it('two independently-corroborated competing claims are contested', () => {
        writeSignals([
            sig({ origin: 's1', body: 'use REST' }),
            sig({ origin: 's2', body: 'use REST' }),
            sig({ origin: 's3', body: 'use GraphQL', ts: daysAgo(1) }),
            sig({ origin: 's4', body: 'use GraphQL', ts: daysAgo(1) }),
        ]);
        const top = buildSidecar(dir, NOW).lessons[0];
        expect(top?.verdict).toBe('contested');
        // Recency resolves the surfaced body — REST is the most recent claim.
        expect(top?.body).toBe('use REST');
    });
});

describe('determinism + robustness', () => {
    it('is byte-stable for a fixed now', () => {
        writeSignals([sig({ origin: 's1' }), sig({ origin: 's2' })]);
        expect(JSON.stringify(buildSidecar(dir, NOW))).toBe(JSON.stringify(buildSidecar(dir, NOW)));
    });

    it('skips malformed JSONL lines', () => {
        fs.writeFileSync(
            path.join(dir, 'signals-2026-07.jsonl'),
            ['not json', JSON.stringify(sig({ origin: 's1' })), '', JSON.stringify(sig({ origin: 's2' }))].join('\n'),
        );
        expect(buildSidecar(dir, NOW).lessons).toHaveLength(1);
    });

    it('renders a dead-end ledger', () => {
        writeSignals([
            sig({ origin: 's1', polarity: 'dead_end', body: 'no vectors' }),
            sig({ origin: 's2', polarity: 'dead_end', body: 'no vectors' }),
        ]);
        const md = renderLessonsMd(buildSidecar(dir, NOW));
        expect(md).toContain("Known dead ends");
        expect(md).toContain('no vectors');
    });
});

// road-to-learning-you-can-see Phase 2 — `--format status`, the one screen
// that answers "what has this learned?". A third FORMAT, not a new verb
// (decision D2 cites ADR-041): the dispatcher passes argv straight through to
// `main()`, so a format is reachable where a verb would need a registry row.
describe('--format status — one screen, read-only', () => {
    it('prints the three verdict counts', () => {
        writeSignals([
            sig({ origin: 's1' }),
            sig({ origin: 's2' }),
            sig({ origin: 's1', path: 'src/b.ts', polarity: 'dead_end', body: 'no vectors' }),
            sig({ origin: 's2', path: 'src/b.ts', polarity: 'dead_end', body: 'no vectors' }),
        ]);
        const out = capture(['--intake-dir', dir, '--now', NOW, '--format', 'status']);
        expect(out.code).toBe(0);
        // The step's own verify grep is `preferred: <n>`.
        expect(out.stdout).toMatch(/preferred: 1\b/);
        expect(out.stdout).toMatch(/contested: 0\b/);
        expect(out.stdout).toMatch(/dead-end: 1\b/);
    });

    it('lists at most five preferred lessons, each with its origin count and age', () => {
        const lines: Array<Record<string, unknown>> = [];
        for (let i = 0; i < 7; i += 1) {
            for (const origin of ['s1', 's2']) {
                lines.push(
                    sig({ origin, path: `src/p${String(i)}.ts`, body: `lesson ${String(i)}`, ts: daysAgo(i) }),
                );
            }
        }
        writeSignals(lines);
        const out = capture(['--intake-dir', dir, '--now', NOW, '--format', 'status']);
        // Seven preferred lessons exist; the screen shows five.
        expect(out.stdout).toMatch(/preferred: 7\b/);
        const listed = out.stdout.split('\n').filter((l) => /^ {2}[0-9]\./.test(l));
        expect(listed).toHaveLength(5);
        // Origin count and age ride on the same row as the lesson.
        expect(listed[0]).toMatch(/2 origins/);
        expect(listed[0]).toMatch(/[0-9]+d old/);
    });

    it('states what a promotion requires, from the constants rather than from prose', () => {
        writeSignals([sig({ origin: 's1' }), sig({ origin: 's2' })]);
        const out = capture(['--intake-dir', dir, '--now', NOW, '--format', 'status']);
        expect(out.stdout).toContain(`${String(MIN_CORROBORATIONS)} distinct origins`);
        expect(out.stdout).toContain(`${String(HALF_LIFE_DAYS)}-day`);
    });

    it('ends on the human step — the screen never promotes anything itself', () => {
        writeSignals([sig({ origin: 's1' }), sig({ origin: 's2' })]);
        const out = capture(['--intake-dir', dir, '--now', NOW, '--format', 'status']);
        const last = out.stdout.replace(/\n$/, '').split('\n').at(-1) ?? '';
        // The step's own verify greps the LAST line for the skill path.
        expect(last).toMatch(/learning-to-rule-or-skill/);
        expect(last).toContain('/memory:propose');
    });

    it('reads an empty intake without inventing a number', () => {
        const out = capture(['--intake-dir', dir, '--now', NOW, '--format', 'status']);
        expect(out.code).toBe(0);
        expect(out.stdout).toMatch(/preferred: 0\b/);
        // Nothing was written: read-only is the whole point of the format.
        expect(fs.readdirSync(dir)).toEqual([]);
    });

    it('refuses `--write` rather than silently ignoring it', () => {
        // The acceptance criterion is `git status` identical before and after.
        // Ignoring the flag would honour that too; refusing says so out loud.
        const out = capture(['--intake-dir', dir, '--out-dir', dir, '--format', 'status', '--write']);
        expect(out.code).toBe(2);
        expect(out.stderr).toMatch(/--format status is read-only/);
        expect(fs.readdirSync(dir)).toEqual([]);
    });

    it('rejects an unknown --format instead of falling through to text', () => {
        const out = capture(['--intake-dir', dir, '--now', NOW, '--format', 'stats']);
        expect(out.code).toBe(2);
        expect(out.stderr).toMatch(/invalid choice/);
    });
});
