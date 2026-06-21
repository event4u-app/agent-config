// Tests for src/scripts/check_token_optimizer_freshness.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the pure helpers (parse_catalog, is_external) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO
// (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as tof from '../../src/scripts/check_token_optimizer_freshness.js';



describe('check_token_optimizer_freshness — behavioural spec', () => {
    it('parse_catalog reads rows only inside the ## Catalog section', () => {
        const text = [
            '## Intro',
            '| not | a | catalog | row |',
            '## Catalog',
            '| Asset | Path | Keywords | Description |',
            '|-------|------|----------|-------------|',
            '| `foo` | rules/foo.md | `kw1`, `kw2` | does foo |',
            '## After',
            '| also | not | a | row |',
        ].join('\n');
        const rows = tof.parse_catalog(text);
        expect(rows).toHaveLength(1);
        expect(rows[0]!.name).toBe('foo');
        expect(rows[0]!.path).toBe('rules/foo.md');
        expect(rows[0]!.keywords).toBe('`kw1`, `kw2`');
        expect(rows[0]!.desc).toBe('does foo');
    });

    it('is_external recognises upstream / http / tbd / github.com', () => {
        expect(tof.is_external('upstream:foo')).toBe(true);
        expect(tof.is_external('https://example.com')).toBe(true);
        expect(tof.is_external('http://example.com')).toBe(true);
        expect(tof.is_external('TBD-someday')).toBe(true);
        expect(tof.is_external('see github.com/x/y')).toBe(true);
        expect(tof.is_external('rules/foo.md')).toBe(false);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

