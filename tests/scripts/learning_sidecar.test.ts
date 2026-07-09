/**
 * Learning sidecar aggregator (road-to-retrieval-substrate-hardening B3).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildSidecar, renderLessonsMd } from '../../src/scripts/learning_sidecar.js';

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
