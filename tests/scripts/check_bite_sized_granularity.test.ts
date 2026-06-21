// Tests for src/scripts/check_bite_sized_granularity.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_bite_sized_granularity.py. This module is a pure
// library (no CLI), so there is no golden-parity subprocess layer; the
// behaviour contract is the public API (read_complexity / scan_placeholders /
// check_granularity). The Python parametrized cases map to test.each.
import { describe, expect, it } from 'vitest';

import * as bsg from '../../src/scripts/check_bite_sized_granularity.js';

const STRUCTURAL_CLEAN = `\
---
complexity: structural
---

# Roadmap — Structural Clean

## Phase 1
- [ ] Edit \`app/Http/Controllers/AuthController.php\`: add \`logout()\` method that calls \`Auth::logout()\` and returns \`redirect('/')\`. Run \`php artisan route:list | grep logout\`.
- [x] Add migration \`database/migrations/2026_05_09_add_last_seen.php\` with \`$table->timestamp('last_seen')->nullable()\`. Run \`php artisan migrate\`. Expect \`Migrated: 2026_05_09_add_last_seen\`.
`;

const STRUCTURAL_WITH_PLACEHOLDERS = `\
---
complexity: structural
---

# Roadmap — Structural Dirty

## Phase 1
- [ ] Edit \`<file>\` and add the new method.
- [ ] TODO: write the migration.
- [ ] Run the tests???
`;

const LIGHTWEIGHT_WITH_PLACEHOLDERS = `\
---
complexity: lightweight
---

# Roadmap — Lightweight

## Phase 1
- [ ] Add login endpoint
- [ ] TODO: write tests later
- [ ] Update <docs>
`;

const UNTAGGED_WITH_PLACEHOLDERS = `\
# Roadmap — Untagged

## Phase 1
- [ ] TODO: do the thing
`;

describe('check_bite_sized_granularity (ported pytest)', () => {
    it('read_complexity structural', () => {
        expect(bsg.read_complexity(STRUCTURAL_CLEAN)).toBe('structural');
    });

    it('read_complexity lightweight', () => {
        expect(bsg.read_complexity(LIGHTWEIGHT_WITH_PLACEHOLDERS)).toBe('lightweight');
    });

    it('read_complexity untagged', () => {
        expect(bsg.read_complexity(UNTAGGED_WITH_PLACEHOLDERS)).toBeNull();
    });

    it('structural clean passes', () => {
        const result = bsg.check_granularity(STRUCTURAL_CLEAN);
        expect(result.complexity).toBe('structural');
        expect(result.gated).toBe(true);
        expect(result.violations).toEqual([]);
    });

    it('structural with placeholders fails', () => {
        const result = bsg.check_granularity(STRUCTURAL_WITH_PLACEHOLDERS);
        expect(result.complexity).toBe('structural');
        expect(result.gated).toBe(true);
        const kinds = new Set(result.violations.map((v) => v.kind));
        expect(kinds.has('angle-placeholder')).toBe(true);
        expect(kinds.has('todo')).toBe(true);
        expect(kinds.has('triple-question')).toBe(true);
        expect(result.violations.length).toBeGreaterThanOrEqual(3);
    });

    it('lightweight skips gate', () => {
        const result = bsg.check_granularity(LIGHTWEIGHT_WITH_PLACEHOLDERS);
        expect(result.complexity).toBe('lightweight');
        expect(result.gated).toBe(false);
        expect(result.violations).toEqual([]);
    });

    it('untagged skips gate', () => {
        const result = bsg.check_granularity(UNTAGGED_WITH_PLACEHOLDERS);
        expect(result.complexity).toBeNull();
        expect(result.gated).toBe(false);
        expect(result.violations).toEqual([]);
    });

    it('scan only inspects task bullets', () => {
        const text = `\
---
complexity: structural
---

# Roadmap

Prose with <placeholder> and TODO and ???.

## Phase 1
- [ ] Clean task on \`path/to/file.py\` — no placeholders here.
`;
        const result = bsg.check_granularity(text);
        expect(result.gated).toBe(true);
        expect(result.violations).toEqual([]);
    });

    it('violation carries line and kind', () => {
        const result = bsg.check_granularity(STRUCTURAL_WITH_PLACEHOLDERS);
        const todoHits = result.violations.filter((v) => v.kind === 'todo');
        expect(todoHits).toHaveLength(1);
        expect(todoHits[0]!.line).toBeGreaterThan(1);
        expect(todoHits[0]!.text).toContain('TODO');
    });

    it.each([
        ['FIXME: refactor this', 'fixme'],
        ['XXX something', 'xxx'],
        ['TBD later', 'tbd'],
        ['tbd later', 'tbd'],
    ])('other placeholder kind: %s → %s', (needle, kind) => {
        const text = `---\ncomplexity: structural\n---\n- [ ] task — ${needle}\n`;
        const result = bsg.check_granularity(text);
        expect(result.gated).toBe(true);
        expect(result.violations.some((v) => v.kind === kind)).toBe(true);
    });
});
