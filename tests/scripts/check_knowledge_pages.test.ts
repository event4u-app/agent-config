// Tests for src/scripts/check_knowledge_pages.ts (road-to-knowledge-system,
// Phase 2 — warn-only lint for the typed knowledge pages).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { lintAll, lintPage, main } from '../../src/scripts/check_knowledge_pages.ts';

const TODAY = new Date('2026-07-05T00:00:00Z');

function mkTmpRepo(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-pages-lint-'));
}

function writeFile(root: string, relPath: string, body: string): void {
    const abs = path.join(root, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
}

describe('lintPage — frontmatter shape', () => {
    it('a page with no frontmatter produces no warnings', () => {
        expect(lintPage('concepts/x.md', '# X\n\nbody\n', TODAY)).toEqual([]);
    });

    it('unknown type warns', () => {
        const warnings = lintPage('concepts/x.md', '---\ntype: bogus\n---\n\n# X\n', TODAY);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].rule).toBe('type');
    });

    it('valid type produces no warning', () => {
        expect(lintPage('concepts/x.md', '---\ntype: concept\n---\n\n# X\n', TODAY)).toEqual([]);
    });

    it('unknown scope warns', () => {
        const warnings = lintPage('concepts/x.md', '---\nscope: nonsense\n---\n\n# X\n', TODAY);
        expect(warnings.map((w) => w.rule)).toEqual(['scope']);
    });

    it('unknown visibility warns', () => {
        const warnings = lintPage('concepts/x.md', '---\nvisibility: public\n---\n\n# X\n', TODAY);
        expect(warnings.map((w) => w.rule)).toEqual(['visibility']);
    });
});

describe('lintPage — review_after', () => {
    it('malformed date warns', () => {
        const warnings = lintPage('concepts/x.md', '---\nreview_after: "next tuesday"\n---\n\n# X\n', TODAY);
        expect(warnings.map((w) => w.rule)).toEqual(['review_after']);
    });

    it('past date warns (due for review)', () => {
        const warnings = lintPage('concepts/x.md', '---\nreview_after: "2026-01-01"\n---\n\n# X\n', TODAY);
        expect(warnings.map((w) => w.rule)).toEqual(['review_after']);
        expect(warnings[0].message).toContain('due for review');
    });

    it('future date does not warn', () => {
        expect(lintPage('concepts/x.md', '---\nreview_after: "2027-01-01"\n---\n\n# X\n', TODAY)).toEqual([]);
    });
});

describe('lintPage — contested', () => {
    it('fewer than 2 contested entries does not warn', () => {
        const body = '---\ncontested:\n  - timestamp: "2026-07-01T00:00:00Z"\n---\n\n# X\n';
        expect(lintPage('concepts/x.md', body, TODAY)).toEqual([]);
    });

    it('2+ contested entries warns', () => {
        const body =
            '---\ncontested:\n  - timestamp: "2026-07-01T00:00:00Z"\n  - timestamp: "2026-07-02T00:00:00Z"\n---\n\n# X\n';
        const warnings = lintPage('concepts/x.md', body, TODAY);
        expect(warnings.map((w) => w.rule)).toEqual(['contested']);
    });
});

describe('lintPage — size budget', () => {
    it('a page at or under 200 lines does not warn', () => {
        const body = '# X\n' + 'line\n'.repeat(199);
        expect(lintPage('concepts/x.md', body, TODAY)).toEqual([]);
    });

    it('a page over 200 lines warns', () => {
        const body = '# X\n' + 'line\n'.repeat(201);
        const warnings = lintPage('concepts/x.md', body, TODAY);
        expect(warnings.map((w) => w.rule)).toEqual(['size']);
    });

    it('frontmatter lines do not count toward the budget', () => {
        const body = '---\ntype: concept\nscope: project\n---\n' + 'line\n'.repeat(199);
        expect(lintPage('concepts/x.md', body, TODAY)).toEqual([]);
    });
});

describe('lintAll', () => {
    it('scans all four typed dirs and aggregates warnings with relative paths', () => {
        const root = mkTmpRepo();
        writeFile(root, 'agents/knowledge/concepts/a.md', '---\ntype: bogus\n---\n\n# A\n');
        writeFile(root, 'agents/knowledge/sessions/b.md', '---\nscope: nonsense\n---\n\n# B\n');
        writeFile(root, 'agents/knowledge/procedures/skill-candidates.md', '# Skill Candidates\n');
        writeFile(root, 'agents/knowledge/decisions/c.md', '# Fine\n');

        const warnings = lintAll(path.join(root, 'agents', 'knowledge'), TODAY);
        const files = warnings.map((w) => w.file).sort();
        expect(files).toEqual(['concepts/a.md', 'sessions/b.md']);
    });

    it('missing typed dirs produce zero warnings, no crash', () => {
        const root = mkTmpRepo();
        expect(lintAll(path.join(root, 'agents', 'knowledge'), TODAY)).toEqual([]);
    });

    it('never touches agents/knowledge/*.md cards directly (only the four typed dirs)', () => {
        const root = mkTmpRepo();
        writeFile(root, 'agents/knowledge/some-card.md', '---\ntype: bogus\n---\n\n# Card\n');
        expect(lintAll(path.join(root, 'agents', 'knowledge'), TODAY)).toEqual([]);
    });
});

describe('check_knowledge_pages CLI', () => {
    it('always exits 0 even with warnings present (warn-only)', () => {
        const root = mkTmpRepo();
        writeFile(root, 'agents/knowledge/concepts/a.md', '---\ntype: bogus\n---\n\n# A\n');
        const rc = main(['--dir', root, '--quiet']);
        expect(rc).toBe(0);
    });

    it('--format json exits 0 and emits valid JSON', () => {
        const root = mkTmpRepo();
        writeFile(root, 'agents/knowledge/concepts/a.md', '---\ntype: bogus\n---\n\n# A\n');
        // Redirect stdout capture is out of scope here — just assert exit code.
        expect(main(['--dir', root, '--format', 'json'])).toBe(0);
    });

    it('bad --format value exits 1', () => {
        expect(main(['--format', 'yaml'])).toBe(1);
    });

    it('unknown flag exits 1', () => {
        expect(main(['--bogus'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
