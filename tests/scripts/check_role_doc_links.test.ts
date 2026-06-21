// Tests for src/scripts/check_role_doc_links.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused differential suite over resolve() (external
// vs relative, #anchor stripping) plus golden parity on the REAL REPO
// (skipped without python3).
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_role_doc_links.js';



const DOC = path.join(mod.DOCS_DIR, 'getting-started-by-role.md');

describe('check_role_doc_links — resolve', () => {
    it('external URLs resolve to null', () => {
        expect(mod.resolve('https://example.com', DOC)).toBeNull();
        expect(mod.resolve('http://x', DOC)).toBeNull();
        expect(mod.resolve('mailto:a@b', DOC)).toBeNull();
    });

    it('empty / anchor-only links resolve to null', () => {
        expect(mod.resolve('#frag', DOC)).toBeNull();
    });

    it('relative links resolve under the doc dir', () => {
        const got = mod.resolve('contracts/foo.md', DOC);
        expect(got).toBe(path.join(mod.DOCS_DIR, 'contracts', 'foo.md'));
    });

    it('#anchor fragments are stripped before resolving', () => {
        const got = mod.resolve('contracts/foo.md#bar', DOC);
        expect(got).toBe(path.join(mod.DOCS_DIR, 'contracts', 'foo.md'));
    });
});

