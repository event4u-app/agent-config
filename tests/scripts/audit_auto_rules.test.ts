
import { describe, expect, it } from 'vitest';

import { _split_frontmatter, _trigger_summary } from '../../src/scripts/audit_auto_rules.js';

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
    it('_trigger_summary buckets path/keyword/phrase', () => {
        const t = _trigger_summary([
            { path_prefix: 'src/' },
            { keyword: 'foo' },
            { phrase: 'bar baz' },
            { keyword: 'baz' },
            'not-a-dict',
        ]);
        expect(t.path_prefixes).toEqual(['src/']);
        expect(t.keywords).toEqual(['foo', 'baz']);
        expect(t.phrases).toEqual(['bar baz']);
    });
    it('_trigger_summary ignores a removed trigger type (intent)', () => {
        const t = _trigger_summary([{ intent: 'bar' }]);
        expect(t).toEqual({ path_prefixes: [], keywords: [], phrases: [] });
    });
    it('_trigger_summary tolerates non-list input', () => {
        expect(_trigger_summary(null)).toEqual({ path_prefixes: [], keywords: [], phrases: [] });
    });
});
