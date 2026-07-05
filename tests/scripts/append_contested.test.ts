// Tests for src/scripts/append_contested.ts (road-to-knowledge-system,
// Phase 5 — the writer half of the contested-annotation contract; the
// reader/lint half already lives in check_knowledge_pages.ts, Phase 2).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { appendContestedEntry, main } from '../../src/scripts/append_contested.ts';

const ENTRY = { timestamp: '2026-07-15T14:23:11Z', trigger: 'context_stale', evidence: 'test.ts:45', session: 'sess-1' };

describe('appendContestedEntry', () => {
    it('creates frontmatter + contested array on a page with none', () => {
        const result = appendContestedEntry('# X\n\nbody\n', ENTRY);
        expect(result).toMatch(/^---\n/);
        const fm = YAML.parse(/^---\n([\s\S]*?)\n---\n/.exec(result)![1]);
        expect(fm.contested).toEqual([ENTRY]);
        expect(result).toContain('# X\n\nbody\n');
    });

    it('appends to an existing contested array without dropping prior entries', () => {
        const content = '---\ntype: concept\ncontested:\n  - timestamp: "2026-01-01T00:00:00Z"\n    trigger: old\n    evidence: e\n    session: s0\n---\n\n# X\n';
        const result = appendContestedEntry(content, ENTRY);
        const fm = YAML.parse(/^---\n([\s\S]*?)\n---\n/.exec(result)![1]);
        expect(fm.contested).toHaveLength(2);
        expect(fm.contested[0].session).toBe('s0');
        expect(fm.contested[1]).toEqual(ENTRY);
        expect(fm.type).toBe('concept'); // other frontmatter fields preserved
    });

    it('never touches the page body', () => {
        const content = '---\ntype: concept\n---\n\n# X\n\nImportant body content.\n\nMore paragraphs.\n';
        const result = appendContestedEntry(content, ENTRY);
        expect(result).toContain('# X\n\nImportant body content.\n\nMore paragraphs.\n');
    });

    it('a page with no frontmatter at all still ends up parseable after appending', () => {
        const result = appendContestedEntry('just prose, no frontmatter\n', ENTRY);
        const fm = YAML.parse(/^---\n([\s\S]*?)\n---\n/.exec(result)![1]);
        expect(fm.contested).toEqual([ENTRY]);
    });
});

describe('append_contested CLI', () => {
    function mkPage(content: string): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contested-'));
        const p = path.join(dir, 'page.md');
        fs.writeFileSync(p, content, 'utf8');
        return p;
    }

    it('appends via the real file and reports success', () => {
        const page = mkPage('---\ntype: concept\n---\n\n# X\n\nbody\n');
        const rc = main([
            '--page',
            page,
            '--trigger',
            'context_stale',
            '--evidence',
            'test.ts:45',
            '--session',
            'sess-1',
            '--timestamp',
            '2026-07-15T14:23:11Z',
        ]);
        expect(rc).toBe(0);
        const updated = fs.readFileSync(page, 'utf8');
        expect(updated).toContain('contested:');
        expect(updated).toContain('context_stale');
    });

    it('missing page exits 1', () => {
        expect(
            main([
                '--page',
                '/nonexistent/x.md',
                '--trigger',
                't',
                '--evidence',
                'e',
                '--session',
                's',
                '--timestamp',
                '2026-07-15T14:23:11Z',
            ]),
        ).toBe(1);
    });

    it('usage errors exit 1', () => {
        expect(main(['--page', 'x.md'])).toBe(1);
        expect(main(['--bogus'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
