// road-to-a-cold-start-paid-once 6.2: the worker-resume bench scores a reply as
// the cited line's exact text after trimming, so a planted wrong answer fails.
import { describe, expect, it } from 'vitest';

import { parseOrchestratorAnswers, scoreSession } from '../../internal/bench/worker-resume/score.js';
import { extractCitations, sampleTasks, type CitationTask } from '../../internal/bench/worker-resume/tasks.js';

const tasks: CitationTask[] = [
    { id: 'a.ts:3', path: 'a.ts', line: 3, expected: 'const x = 1;' },
    { id: 'b.md:9', path: 'b.md', line: 9, expected: '## Heading' },
];

describe('worker-resume score', () => {
    it('accepts the exact line text, trimming surrounding whitespace only', () => {
        const s = scoreSession(tasks, ['  const x = 1;\n', '## Heading']);
        expect(s.map((r) => r.pass)).toEqual([true, true]);
    });

    it('rejects a planted wrong answer, a near miss and a missing answer', () => {
        const s = scoreSession(tasks, ['const x = 2;', '##  Heading']);
        expect(s.map((r) => r.pass)).toEqual([false, false]);
        expect(scoreSession(tasks, ['const x = 1;']).map((r) => r.pass)).toEqual([true, false]);
    });

    it('reads the answers array from the orchestrator result, last JSON object wins', () => {
        expect(parseOrchestratorAnswers('done\n{"answers":["x","y"]}')).toEqual(['x', 'y']);
        expect(parseOrchestratorAnswers('no json here')).toBeNull();
    });
});

describe('worker-resume tasks', () => {
    it('extracts path:line citations, taking the first line of a range', () => {
        const c = extractCitations('see `src/a.ts:12` and `docs/b.md:40-55`, not `foo`');
        expect(c).toEqual([{ path: 'src/a.ts', line: 12 }, { path: 'docs/b.md', line: 40 }]);
    });

    it('samples deterministically by seed, distinct tasks per session', () => {
        const pool = Array.from({ length: 20 }, (_, i) => ({ id: `f:${i}`, path: 'f', line: i + 1, expected: `l${i}` }));
        const a = sampleTasks(pool, 7, 9);
        expect(a).toEqual(sampleTasks(pool, 7, 9));
        expect(new Set(a.map((t) => t.id)).size).toBe(9);
        expect(sampleTasks(pool, 8, 9)).not.toEqual(a);
    });
});
