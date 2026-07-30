// Tests for src/scripts/lint_no_python_twin_rationale.ts.
//
// The gate had no test, which is how its `twin-of` pattern stayed a bare
// /\btwin of\b/ — banning an English word instead of a claim shape. It produced 6
// false positives out of 7 findings and was in no CI workflow, so nothing surfaced
// it. These cases pin BOTH edges: the shapes that must still fail, and the ordinary
// uses of "twin" that must not.

import { describe, expect, it } from 'vitest';

import { BANNED } from '../../src/scripts/lint_no_python_twin_rationale.js';

/** Names of the patterns a line trips, in declaration order. */
function tripped(line: string): string[] {
    return BANNED.filter(([, re]) => re.test(line)).map(([name]) => name);
}

describe('BANNED — rationale shapes that must still fail', () => {
    // Each of these rationalises behaviour by fidelity to a deleted Python original,
    // which is the whole point of the gate.
    const cases: ReadonlyArray<[string, string]> = [
        ['twin-of', ' * TypeScript twin of the Python original — byte-for-byte.'],
        ['twin-of', ' * twin of the retired script.py, quirks preserved'],
        ['twin-of', ' // Python twin of this helper; keep them in lockstep'],
        ['latent-quirks', ' * latent python quirks replicated for parity'],
        ['byte-identical-python', ' * byte-identical to the Python implementation'],
        ['python-original', ' * the Python original had no such field'],
    ];

    for (const [expected, line] of cases) {
        it(`flags ${expected}: ${line.trim().slice(0, 46)}…`, () => {
            expect(tripped(line)).toContain(expected);
        });
    }

    it('catches the qualifier on either side of "twin of"', () => {
        // The pattern is a two-way alternation on purpose — the Python signal can
        // precede or follow the phrase.
        expect(tripped(' * Python twin of the loader')).toContain('twin-of');
        expect(tripped(' * twin of the loader in condense.py')).toContain('twin-of');
    });
});

describe('BANNED — ordinary uses of "twin" that must pass', () => {
    // Every one of these is a real comment from src/scripts that the bare pattern
    // flagged. None mentions Python; none claims fidelity to a deleted original.
    const allowed = [
        ' * `agent-config memory:get` — CLI twin of the `memory_get` MCP tool',
        ' /** Sync twin of {@link probeFts5} — see "Synchronous variants" above. */',
        ' /** Debate twin of `_critique_suffix` — the volatile block only (A3). */',
        ' * Derived SQLite twin of the code-graph JSON cache (ADR-129, Phase 6)',
        ' * A self-contained twin of the append-only reader',
        ' * the deterministic twin of the resolved-target probe',
    ];

    for (const line of allowed) {
        it(`allows: ${line.trim().slice(0, 46)}…`, () => {
            expect(tripped(line)).toEqual([]);
        });
    }

    it('allows a historical provenance mention', () => {
        // The gate's own header carves this out: stating history is fine, claiming a
        // live contract against a deleted file is not.
        expect(tripped(' * Ported from the retired Python `src/scripts/condense.py` (ADR-200)')).toEqual([]);
    });
});
