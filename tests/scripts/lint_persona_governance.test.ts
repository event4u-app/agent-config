// Tests for src/scripts/lint_persona_governance.ts (py2ts Phase 4 / Wave 4b).
//
// No tests/test_lint_persona_governance.py exists. This is a focused
// differential suite over the exported pure helpers (parse_frontmatter,
// DOMAIN_MAP, PER_DOMAIN_CAP) plus a golden-parity layer running python3 vs
// tsx on the REAL REPO (the linter's real CI invocation), skipped without
// python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as pg from '../../src/scripts/lint_persona_governance.js';



describe('lint_persona_governance — domain map', () => {
    it('keeps the per-domain cap at 2', () => {
        expect(pg.PER_DOMAIN_CAP).toBe(2);
    });
    it('maps the two ai-video specialists to ai-video', () => {
        expect(pg.DOMAIN_MAP['hollywood-director']).toBe('ai-video');
        expect(pg.DOMAIN_MAP['ai-video-technical-director']).toBe('ai-video');
    });
    it('leaves cross-cutting personas out of the map', () => {
        expect(pg.DOMAIN_MAP['qa']).toBeUndefined();
    });
});

describe('lint_persona_governance.parse_frontmatter', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('parses scalar keys, stripping quotes', () => {
        const p = path.join(tmp, 'persona.md');
        fs.writeFileSync(p, '---\nid: "cmo"\ntier: \'specialist\'\nstatus: active\n---\nbody\n');
        expect(pg.parse_frontmatter(p)).toEqual({ id: 'cmo', tier: 'specialist', status: 'active' });
    });
    it('returns {} when there is no frontmatter', () => {
        const p = path.join(tmp, 'persona.md');
        fs.writeFileSync(p, 'no frontmatter\n');
        expect(pg.parse_frontmatter(p)).toEqual({});
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

