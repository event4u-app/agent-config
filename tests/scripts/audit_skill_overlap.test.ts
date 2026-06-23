
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { _cosine, _keyword_vector } from '../../src/scripts/audit_skill_overlap.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_skill_overlap.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
const OUT_JSON = path.join(REPORT_DIR, 'skill-overlap.json');
const OUT_MD = path.join(REPORT_DIR, 'skill-overlap.md');
const SKILLS_LINK = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');

describe('audit_skill_overlap — unit helpers', () => {
    it('_keyword_vector counts non-stopword tokens', () => {
        const v = _keyword_vector('router router fires and the for');
        expect(v.get('router')).toBe(2);
        expect(v.get('fires')).toBe(1);
        expect(v.has('and')).toBe(false);
        expect(v.has('the')).toBe(false);
    });
    it('_cosine of identical vectors is 1, disjoint is 0', () => {
        const a = _keyword_vector('alpha beta gamma delta');
        expect(_cosine(a, a)).toBeCloseTo(1.0, 10);
        const b = _keyword_vector('omega sigma kappa lambda');
        expect(_cosine(a, b)).toBe(0.0);
    });
});
