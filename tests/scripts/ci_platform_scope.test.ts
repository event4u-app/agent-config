import { describe, expect, it } from 'vitest';

import { scopeFor } from '../../src/scripts/ci_platform_scope.js';

describe('scopeFor — narrow only when the diff provably cannot reach platform behaviour', () => {
    it('keeps a docs-only diff on the macOS tier', () => {
        expect(scopeFor(['docs/contracts/ci-cost-budget.md', 'agents/roadmaps/x.md'])).toBe('tier');
    });

    it('escalates an installer diff to the full macOS set', () => {
        expect(scopeFor(['README.md', 'src/install/install.ts'])).toBe('full');
    });

    it('escalates a hook, collector, workflow or dependency change', () => {
        for (const p of ['src/scripts/hooks/x.ts', 'src/scripts/collector_daemon.ts', '.github/workflows/tests.yml', 'package-lock.json']) {
            expect(scopeFor([p]), p).toBe('full');
        }
    });

    it('treats an empty diff as undecidable, not as nothing to test', () => {
        expect(scopeFor([])).toBe('full');
    });

    it('treats an unreadable diff as full', () => {
        expect(scopeFor(null)).toBe('full');
    });
});
