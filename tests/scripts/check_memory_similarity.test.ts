// Tests for src/scripts/check_memory_similarity.ts (road-to-knowledge-system,
// Phase 2). Verifies the advisory near-duplicate scan against a fixture
// intake tree — never touches memory_signal.ts's own dedup behaviour.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCandidates, main } from '../../src/scripts/check_memory_similarity.ts';

function mkIntake(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'memory-intake-'));
}

function writeSignals(root: string, filename: string, lines: object[]): void {
    fs.writeFileSync(root + '/' + filename, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
}

describe('loadCandidates', () => {
    it('filters by entry_type and skips malformed / partial lines', () => {
        const root = mkIntake();
        writeSignals(root, 'signals-2026-07.jsonl', [
            { id: 'sig-1', entry_type: 'historical-patterns', path: 'a.ts', body: 'null deref on checkout' },
            { id: 'sig-2', entry_type: 'incident-learnings', path: 'b.ts', body: 'unrelated type' },
            { id: 'sig-3', entry_type: 'historical-patterns', path: 'c.ts' }, // missing body
        ]);
        fs.appendFileSync(root + '/signals-2026-07.jsonl', 'not json\n');

        const candidates = loadCandidates(root, 'historical-patterns');
        expect(candidates).toEqual([{ id: 'sig-1', text: 'null deref on checkout' }]);
    });

    it('returns empty array when the intake root does not exist', () => {
        expect(loadCandidates('/nonexistent/path/xyz', 'historical-patterns')).toEqual([]);
    });
});

describe('check_memory_similarity — main', () => {
    it('exits 0 with no candidates at all', () => {
        const root = mkIntake();
        const rc = main(['--type', 'historical-patterns', '--body', 'anything', '--intake-root', root]);
        expect(rc).toBe(0);
    });

    it('exits 0 (warn) on a partial-similarity match', () => {
        const root = mkIntake();
        writeSignals(root, 'signals-2026-07.jsonl', [
            { id: 'sig-1', entry_type: 'historical-patterns', path: 'a.ts', body: 'null deref checkout page flow' },
        ]);
        const rc = main([
            '--type',
            'historical-patterns',
            '--body',
            'null pointer checkout screen',
            '--intake-root',
            root,
        ]);
        expect(rc).toBe(0);
    });

    it('exits 1 (merge) on a near-identical match', () => {
        const root = mkIntake();
        writeSignals(root, 'signals-2026-07.jsonl', [
            { id: 'sig-1', entry_type: 'historical-patterns', path: 'a.ts', body: 'null deref on checkout page' },
        ]);
        const rc = main([
            '--type',
            'historical-patterns',
            '--body',
            'null deref on checkout page',
            '--intake-root',
            root,
        ]);
        expect(rc).toBe(1);
    });

    it('ignores candidates of a different entry_type', () => {
        const root = mkIntake();
        writeSignals(root, 'signals-2026-07.jsonl', [
            { id: 'sig-1', entry_type: 'incident-learnings', path: 'a.ts', body: 'null deref on checkout page' },
        ]);
        const rc = main([
            '--type',
            'historical-patterns',
            '--body',
            'null deref on checkout page',
            '--intake-root',
            root,
        ]);
        expect(rc).toBe(0);
    });

    it('usage errors exit 2', () => {
        expect(main(['--type', 'historical-patterns'])).toBe(2);
        expect(main(['--bogus'])).toBe(2);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
