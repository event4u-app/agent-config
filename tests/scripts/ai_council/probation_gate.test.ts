// Tests for src/scripts/ai_council/probation_gate.ts (py2ts Phase 1).
//
// Mirrors tests/ai_council/test_probation_gate.py plus a corpus-mutation
// byte-parity differential against python3 (the rewritten file is the
// observable artefact). `today` is injected so nothing depends on the wall
// clock.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    GateRun,
    PROMOTION_THRESHOLD,
    WINDOW_DAYS,
    run_gate,
} from '../../../src/scripts/ai_council/probation_gate.js';
import { hasPython3, runPyCode } from './_harness.js';

const py3 = hasPython3();

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'probation-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length) {
        fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    }
});

const BASE = `# Low-Impact Decisions Corpus

## On Probation

{probation}

## Validated

{validated}

## Anti-Examples (Always Ask User)

- "irrelevant" — placeholder

## Security & Privacy Floor

floor text.

## Provenance

last-upstreamed: 0000000000000000000000000000000000000000
`;

function corpus(probation = '', validated = ''): string {
    const text = BASE.replace('{probation}', probation).replace('{validated}', validated);
    const p = path.join(mkTmp(), 'low-impact-decisions.md');
    fs.writeFileSync(p, text, 'utf-8');
    return p;
}

/** today as UTC epoch-millis from a YYYY-MM-DD string. */
function d(s: string): number {
    const [y, m, day] = s.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, day);
}

describe('probation_gate — constants', () => {
    it('mirrors the Python module constants', () => {
        expect(WINDOW_DAYS).toBe(30);
        expect(PROMOTION_THRESHOLD).toBe(3);
    });
});

describe('probation_gate — GateRun', () => {
    it('log_line + is_noop', () => {
        const r = new GateRun(2, 1, 1);
        expect(r.log_line()).toContain('pruned 2');
        expect(r.log_line()).toContain('promoted 1');
        expect(r.log_line()).toContain('dropped 1');
        expect(r.is_noop).toBe(false);
        expect(new GateRun(0, 0, 0).is_noop).toBe(true);
    });
});

describe('probation_gate — run_gate', () => {
    it('no-op on empty sections', () => {
        const p = corpus();
        const r = run_gate(p, { today: d('2026-05-14') });
        expect(r.is_noop).toBe(true);
    });

    it('prunes a stale timestamp, preserves first-seen', () => {
        const p = corpus('- "X?" — first-seen 2026-01-01 · seen [2026-01-01, 2026-05-10]');
        const r = run_gate(p, { today: d('2026-05-14') });
        expect(r.pruned_timestamps).toBe(1);
        expect(r.promoted_entries).toBe(0);
        expect(r.dropped_entries).toBe(0);
        const txt = fs.readFileSync(p, 'utf-8');
        expect(txt).toContain('seen [2026-05-10]');
        expect(txt).not.toContain('seen [2026-01-01');
    });

    it('drops a fully-expired entry', () => {
        const p = corpus('- "X?" — first-seen 2025-01-01 · seen [2025-01-01]');
        const r = run_gate(p, { today: d('2026-05-14') });
        expect(r.dropped_entries).toBe(1);
        expect(fs.readFileSync(p, 'utf-8')).not.toContain('"X?"');
    });

    it('promotes at the threshold', () => {
        const p = corpus(
            '- "X?" — first-seen 2026-05-01 · seen [2026-05-01, 2026-05-05, 2026-05-10]',
        );
        const r = run_gate(p, { today: d('2026-05-14') });
        expect(r.promoted_entries).toBe(1);
        const txt = fs.readFileSync(p, 'utf-8');
        const valSection = (txt.split('## Validated')[1] as string).split('## Anti-Examples')[0] as string;
        expect(valSection).toContain('"X?"');
        expect(valSection).toContain('validated 2026-05-14');
        const probSection = (txt.split('## On Probation')[1] as string).split('## Validated')[0] as string;
        expect(probSection).not.toContain('"X?"');
    });

    it('does not promote below the threshold', () => {
        const p = corpus('- "X?" — first-seen 2026-05-01 · seen [2026-05-01, 2026-05-05]');
        const r = run_gate(p, { today: d('2026-05-14') });
        expect(r.promoted_entries).toBe(0);
    });

    it('stale timestamps do not count toward promotion', () => {
        const p = corpus(
            '- "X?" — first-seen 2026-01-01 · seen [2026-01-01, 2026-02-01, 2026-05-05, 2026-05-10]',
        );
        const r = run_gate(p, { today: d('2026-05-14') });
        expect(r.promoted_entries).toBe(0);
        expect(r.pruned_timestamps).toBe(2);
    });

    it('is idempotent on a second run', () => {
        const p = corpus('- "X?" — first-seen 2026-05-01 · seen [2026-05-05, 2026-05-10]');
        const first = run_gate(p, { today: d('2026-05-14') });
        const second = run_gate(p, { today: d('2026-05-14') });
        expect(first.is_noop || second.is_noop).toBe(true);
        expect(second.is_noop).toBe(true);
    });
});

describe.skipIf(!py3)('probation_gate — corpus byte-parity vs python3', () => {
    const PROBATION = [
        '- "X?" — first-seen 2026-01-01 · seen [2026-01-01, 2026-05-05, 2026-05-10]',
        '- "Y?" — first-seen 2026-05-01 · seen [2026-05-01, 2026-05-05, 2026-05-10]',
        '- "Z?" — first-seen 2025-01-01 · seen [2025-01-01]',
        '- some non-matching prose line',
    ].join('\n');
    const VALIDATED = '- "old" — domain: low-impact · validated 2026-04-01';

    function corpusText(): string {
        return BASE.replace('{probation}', PROBATION).replace('{validated}', VALIDATED);
    }

    it('rewrites the corpus byte-identically (prune + drop + promote)', () => {
        const tsPath = path.join(mkTmp(), 'ts.md');
        fs.writeFileSync(tsPath, corpusText(), 'utf-8');
        const tsRun = run_gate(tsPath, { today: d('2026-05-14') });
        const tsBytes = fs.readFileSync(tsPath, 'utf-8');

        const pyPath = path.join(mkTmp(), 'py.md');
        fs.writeFileSync(pyPath, corpusText(), 'utf-8');
        const code = [
            'import sys',
            'from datetime import datetime, timezone',
            'from pathlib import Path',
            'from scripts.ai_council.probation_gate import run_gate',
            'today = datetime.strptime("2026-05-14","%Y-%m-%d").replace(tzinfo=timezone.utc)',
            'r = run_gate(Path(sys.argv[1]), today=today)',
            'print(f"{r.pruned_timestamps} {r.dropped_entries} {r.promoted_entries}")',
        ].join('\n');
        const res = runPyCode(code, [pyPath]);
        expect(res.status, res.stderr).toBe(0);
        const pyBytes = fs.readFileSync(pyPath, 'utf-8');

        expect(tsBytes).toBe(pyBytes);
        // The Python counts must match the TS GateRun.
        expect(res.stdout.trim()).toBe(
            `${tsRun.pruned_timestamps} ${tsRun.dropped_entries} ${tsRun.promoted_entries}`,
        );
    });
});
