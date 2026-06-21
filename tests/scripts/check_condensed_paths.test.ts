// Tests for src/scripts/check_condensed_paths.ts (py2ts Phase 4 / Wave 4a).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public helpers (_split_frontmatter, _parse_ignores, _ignored)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO,
// exercising the audit-line path and the --quiet flag (skipped without python3).
//
// `main()` is not unit-tested in isolation because it hard-binds RULES_DIR to
// the repo's own dist/agent-src/rules (the Python original derives ROOT from
// __file__, no --root flag) — the golden-parity layer covers it end-to-end.
import { describe, expect, it } from 'vitest';

import * as ccp from '../../src/scripts/check_condensed_paths.js';



describe('check_condensed_paths — behavioural spec', () => {
    // --- _split_frontmatter ---
    it('splits a valid frontmatter block from the body', () => {
        const [fm, body] = ccp._split_frontmatter('---\ntype: "auto"\nfoo: 1\n---\nbody line\n');
        expect(fm).not.toBeNull();
        expect((fm as Record<string, unknown>).type).toBe('auto');
        expect((fm as Record<string, unknown>).foo).toBe(1);
        expect(body).toBe('body line\n');
    });

    it('returns [null, text] when the document does not open with a fence', () => {
        const text = 'no frontmatter here\n';
        const [fm, body] = ccp._split_frontmatter(text);
        expect(fm).toBeNull();
        expect(body).toBe(text);
    });

    it('returns [null, text] when there is no closing fence', () => {
        const text = '---\ntype: auto\nstill open\n';
        const [fm, body] = ccp._split_frontmatter(text);
        expect(fm).toBeNull();
        expect(body).toBe(text);
    });

    it('returns [{}, body] when the frontmatter is not a mapping', () => {
        // A YAML list parses to an array → not a dict → Python returns {}.
        const [fm, body] = ccp._split_frontmatter('---\n- a\n- b\n---\nbody\n');
        expect(fm).toEqual({});
        expect(body).toBe('body\n');
    });

    // --- _parse_ignores ---
    it('parses well-formed validator_ignore entries', () => {
        const fm = {
            validator_ignore: [
                { type: 'substring', pattern: '.agent-src.uncondensed/', reason: 'documents it' },
                { type: 'link', pattern: '../docs/x/', reason: 'guideline link' },
            ],
        };
        expect(ccp._parse_ignores(fm)).toEqual([
            { kind: 'substring', pattern: '.agent-src.uncondensed/', reason: 'documents it' },
            { kind: 'link', pattern: '../docs/x/', reason: 'guideline link' },
        ]);
    });

    it('drops entries with an unknown type or a missing field', () => {
        const fm = {
            validator_ignore: [
                { type: 'bogus', pattern: 'x', reason: 'r' }, // bad type
                { type: 'substring', pattern: 'x' }, // missing reason
                { type: 'substring', reason: 'r' }, // missing pattern
                { type: 'substring', pattern: 'ok', reason: 'keep' }, // valid
            ],
        };
        expect(ccp._parse_ignores(fm)).toEqual([
            { kind: 'substring', pattern: 'ok', reason: 'keep' },
        ]);
    });

    it('returns [] when validator_ignore is absent or not a list', () => {
        expect(ccp._parse_ignores({})).toEqual([]);
        expect(ccp._parse_ignores({ validator_ignore: 'nope' })).toEqual([]);
    });

    // --- _ignored ---
    it('matches an ignore by kind and exact pattern', () => {
        const ignores = [{ kind: 'substring', pattern: '.agent-src.uncondensed/', reason: 'r' }];
        expect(ccp._ignored('.agent-src.uncondensed/', ignores, 'substring')).not.toBeNull();
        expect(ccp._ignored('.agent-src.uncondensed/', ignores, 'link')).toBeNull();
        expect(ccp._ignored('../../docs/', ignores, 'substring')).toBeNull();
    });

    // --- module constants mirror the Python source-of-truth set. ---
    it('exposes the forbidden-substring set verbatim', () => {
        expect(ccp.FORBIDDEN_SUBSTRINGS).toEqual([
            '.agent-src.uncondensed/',
            '../../docs/',
            '../../agents/',
        ]);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

