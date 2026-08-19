// Tests for src/scripts/report_memory_pointers.ts (road-to-context-fidelity
// Phase 2).
//
// The grammar is the whole instrument: every narrowing below was made because
// the un-narrowed version put all 107 store entries in the report (cf04). Each
// test pins one of those narrowings, so re-widening the grammar has to break a
// test that says why it was narrowed.
import { describe, expect, it } from 'vitest';

import { extractPointers, isCommitish, isFlagged, rankOf } from '../../src/scripts/report_memory_pointers.js';

const kinds = (body: string): string[] => extractPointers(body).map((p) => `${p.kind}:${p.raw}`);

describe('extractPointers — what counts as a citation', () => {
    it('recognises the four resolvable classes', () => {
        expect(kinds('see `src/scripts/foo.ts:12`')).toContain('path-line:src/scripts/foo.ts:12');
        expect(kinds('see `src/rules/bar.md`')).toContain('path:src/rules/bar.md');
        expect(kinds('under `agents/memory/`')).toContain('dir:agents/memory/');
        expect(kinds('per ADR-201 and [[other-entry]]')).toEqual(
            expect.arrayContaining(['adr:ADR-201', 'wiki-link:other-entry']),
        );
    });

    it('never parses prose outside backticks', () => {
        // A sentence naming a file is not a citation. Treating it as one is
        // how a report starts manufacturing findings.
        expect(kinds('the file src/scripts/foo.ts was renamed')).toEqual([]);
    });
});

describe('extractPointers — the three dropped shapes', () => {
    it('drops templates, globs, home paths and slash-commands', () => {
        expect(kinds('`src/domains/<pack>/command.md`')).toEqual([]); // a schema, not a file
        expect(kinds('`src/domains/**/pack.yaml`')).toEqual([]); // a set, not a file
        expect(kinds('`~/.claude/settings.json`')).toEqual([]); // outside the repo
        expect(kinds('`/optimize-project`')).toEqual([]); // a command name
    });

    it('reports a path-ish token it cannot classify rather than resolving it', () => {
        // Silence here would mean "live", which is the failure mode the
        // council named: ambiguity must be visible as ambiguity.
        expect(kinds('`GEMINI.md`')).toContain('unparseable:GEMINI.md');
    });

    it('does not treat flags, calls or commands as paths', () => {
        expect(kinds('`--append-only` and `jaccardSimilarity()`')).toEqual([]);
    });
});

describe('isCommitish', () => {
    it('accepts 7-40 lowercase hex and nothing else', () => {
        expect(isCommitish('9beeb0662')).toBe(true);
        expect(isCommitish('9beeb06')).toBe(true);
        expect(isCommitish('9BEEB0662')).toBe(false); // uppercase is not what git prints
        expect(isCommitish('9beeb0')).toBe(false); // too short to be unambiguous
        expect(isCommitish('HEAD')).toBe(false);
        expect(isCommitish(42)).toBe(false);
    });
});

describe('rankOf / isFlagged', () => {
    const base = { dead: 0, moved: 0, live: 0, unparseable: 0, drifted: [] as string[], anchor_state: 'present' as const };

    it('ranks a dead citation far above drift, relocation and a missing anchor', () => {
        expect(rankOf({ ...base, dead: 1 } as never)).toBeGreaterThan(rankOf({ ...base, drifted: ['a', 'b'] } as never));
        expect(rankOf({ ...base, drifted: ['a'] } as never)).toBeGreaterThan(rankOf({ ...base, moved: 1 } as never));
    });

    it('gives parser coverage zero weight', () => {
        // Counting `unparseable` put 107 of 107 entries in the report.
        expect(rankOf({ ...base, unparseable: 40 } as never)).toBe(rankOf(base as never));
    });

    it('flags on structural defect only — never on a relocated file', () => {
        expect(isFlagged({ dead: 1, drifted: [] })).toBe(true);
        expect(isFlagged({ dead: 0, drifted: ['x'] })).toBe(true);
        expect(isFlagged({ dead: 0, drifted: [] })).toBe(false);
    });
});
