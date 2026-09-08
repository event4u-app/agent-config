import { describe, expect, it } from 'vitest';

import {
    RETIRED_STATUS_VALUES,
    declaresRetiredStatus,
    frontmatterBlock,
    frontmatterStatus,
    retiredStatusDiagnostic,
} from '../../src/scripts/_lib/retired_status.js';

/**
 * A roadmap that DOCUMENTS the retired syntax inside a fence rather than
 * declaring it. This is the regression the deleted `carrier_status.ts` module
 * recorded against itself — a body-wide match turned a file documenting the
 * vocabulary into a hard failure — and it has to survive the module that
 * replaced it, so it is the first case here rather than an afterthought.
 */
const FENCE_DOC =
    '---\ncomplexity: bounded\n---\n# R\n\n```markdown\n---\nstatus: carrier\n---\n```\n';

describe('the retired set', () => {
    it('names carrier and the record that retired it', () => {
        expect(RETIRED_STATUS_VALUES.get('carrier')).toBe('ADR-262');
    });
});

describe('frontmatterStatus is frontmatter-scoped', () => {
    it('reads a declaration in the leading block', () => {
        expect(frontmatterStatus('---\nstatus: carrier\n---\n# R\n')).toBe('carrier');
        expect(frontmatterStatus('---\ncomplexity: bounded\nstatus: Ready\n---\n# R\n')).toBe('ready');
    });

    it('does not read a fenced example in the body as a declaration', () => {
        expect(frontmatterBlock(FENCE_DOC)).toBe('complexity: bounded');
        expect(frontmatterStatus(FENCE_DOC)).toBeNull();
        expect(declaresRetiredStatus(FENCE_DOC)).toBeNull();
    });

    it('does not read a bare body line as a declaration', () => {
        expect(frontmatterStatus('---\nstatus: ready\n---\n# R\n\nstatus: carrier\n')).toBe('ready');
        expect(declaresRetiredStatus('---\nstatus: ready\n---\n# R\n\nstatus: carrier\n')).toBeNull();
        // No frontmatter block at all — the value is prose wherever it sits.
        expect(frontmatterStatus('status: carrier\n# R\n')).toBeNull();
    });

    it('returns null for an absent status, an absent block, and no text', () => {
        expect(frontmatterStatus('---\ncomplexity: bounded\n---\n# R\n')).toBeNull();
        expect(frontmatterStatus('# R\n')).toBeNull();
        expect(frontmatterStatus(null)).toBeNull();
        expect(frontmatterStatus(undefined)).toBeNull();
    });
});

describe('declaresRetiredStatus returns the value, not a boolean', () => {
    it('names carrier so the caller can put it in the diagnostic', () => {
        expect(declaresRetiredStatus('---\nstatus: carrier\n---\n# R\n')).toBe('carrier');
    });

    it('returns null for a live status and for one nobody retired', () => {
        expect(declaresRetiredStatus('---\nstatus: ready\n---\n# R\n')).toBeNull();
        expect(declaresRetiredStatus('---\nstatus: draft\n---\n# R\n')).toBeNull();
        expect(declaresRetiredStatus('---\nstatus: not-a-status\n---\n# R\n')).toBeNull();
    });
});

describe('the migration diagnostic', () => {
    it('names the retired value, the record, and both replacements', () => {
        const d = retiredStatusDiagnostic('carrier');
        expect(d).toContain('status: carrier');
        expect(d).toContain('ADR-262');
        expect(d).toContain('## Blockers');
        expect(d).toContain('agents/roadmaps/later/');
    });

    it('degrades honestly for a value the map does not hold', () => {
        expect(retiredStatusDiagnostic('made-up')).toContain('a decision record');
    });
});
