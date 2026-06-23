
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { _split_frontmatter, _trigger_summary } from '../../src/scripts/audit_auto_rules.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'audit_auto_rules.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
const JSON_OUT = path.join(REPORT_DIR, 'auto-rules-audit.json');
const MD_OUT = path.join(REPORT_DIR, 'auto-rules-audit.md');

describe('audit_auto_rules — unit helpers', () => {
    it('_split_frontmatter splits a leading block', () => {
        const text = '---\ntype: auto\ndescription: hi\n---\n\nbody here\n';
        const [fm, body] = _split_frontmatter(text);
        expect(fm['type']).toBe('auto');
        expect(fm['description']).toBe('hi');
        expect(body).toBe('body here\n');
    });
    it('_split_frontmatter returns empty + full text when absent', () => {
        const [fm, body] = _split_frontmatter('no frontmatter here');
        expect(fm).toEqual({});
        expect(body).toBe('no frontmatter here');
    });
    it('_trigger_summary buckets path/keyword/intent', () => {
        const t = _trigger_summary([
            { path_prefix: 'src/' },
            { keyword: 'foo' },
            { intent: 'bar' },
            { keyword: 'baz' },
            'not-a-dict',
        ]);
        expect(t.path_prefixes).toEqual(['src/']);
        expect(t.keywords).toEqual(['foo', 'baz']);
        expect(t.intents).toEqual(['bar']);
    });
    it('_trigger_summary tolerates non-list input', () => {
        expect(_trigger_summary(null)).toEqual({ path_prefixes: [], keywords: [], intents: [] });
    });
});
