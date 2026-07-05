// Tests for src/scripts/degrade_to_pointer.ts (road-to-knowledge-system,
// Phase 4 — staging → promotion → pointer lifecycle).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { degradeSection, degradeWholeFile, main, pointerLine } from '../../src/scripts/degrade_to_pointer.ts';

describe('pointerLine', () => {
    it('renders the fixed pointer format', () => {
        expect(pointerLine('src/skills/retry-with-backoff/SKILL.md', '2026-07-05')).toBe(
            '> Promoted to `src/skills/retry-with-backoff/SKILL.md` on 2026-07-05; see that artifact for current guidance.',
        );
    });
});

describe('degradeWholeFile', () => {
    it('preserves frontmatter verbatim and replaces the body with a pointer', () => {
        const content = '---\ntype: concept\ntrust: durable\n---\n\n# API Response Shape\n\nSome long body text\nmore body\n';
        const result = degradeWholeFile(content, 'src/skills/api-shapes/SKILL.md', '2026-07-05');
        expect(result).toContain('---\ntype: concept\ntrust: durable\n---\n');
        expect(result).toContain('# API Response Shape');
        expect(result).toContain('> Promoted to `src/skills/api-shapes/SKILL.md` on 2026-07-05');
        expect(result).not.toContain('Some long body text');
    });

    it('handles a page with no frontmatter', () => {
        const content = '# Bare Page\n\nbody\n';
        const result = degradeWholeFile(content, 'x.md', '2026-07-05');
        expect(result).toContain('# Bare Page');
        expect(result).toContain('Promoted to');
        expect(result).not.toContain('body\n\n');
    });

    it('handles a page with no heading at all', () => {
        const content = 'just some prose, no heading\n';
        const result = degradeWholeFile(content, 'x.md', '2026-07-05');
        expect(result.trim()).toBe('> Promoted to `x.md` on 2026-07-05; see that artifact for current guidance.');
    });
});

describe('degradeSection', () => {
    const skillCandidates = [
        '# Skill Candidates',
        '',
        '## alpha-topic',
        '',
        '- Mentions: 3',
        '- First seen: 2026-06-01',
        '',
        '## zeta-topic',
        '',
        '- Mentions: 1',
        '',
    ].join('\n');

    it('replaces only the matching section body, leaves siblings untouched', () => {
        const result = degradeSection(skillCandidates, 'alpha-topic', 'src/skills/alpha/SKILL.md', '2026-07-05');
        expect(result).toContain('## alpha-topic');
        expect(result).toContain('Promoted to `src/skills/alpha/SKILL.md`');
        expect(result).not.toContain('Mentions: 3');
        // Sibling section survives untouched.
        expect(result).toContain('## zeta-topic');
        expect(result).toContain('- Mentions: 1');
    });

    it('degrading the LAST section in the file works (no trailing sibling heading)', () => {
        const result = degradeSection(skillCandidates, 'zeta-topic', 'src/skills/zeta/SKILL.md', '2026-07-05');
        expect(result).toContain('Promoted to `src/skills/zeta/SKILL.md`');
        expect(result).not.toContain('Mentions: 1');
        expect(result).toContain('## alpha-topic'); // untouched sibling before it
    });

    it('throws when the anchor does not exist', () => {
        expect(() => degradeSection(skillCandidates, 'does-not-exist', 'x.md', '2026-07-05')).toThrow(/not found/);
    });
});

describe('degrade_to_pointer CLI', () => {
    function mkRepo(): string {
        return fs.mkdtempSync(path.join(os.tmpdir(), 'degrade-'));
    }

    it('degrades a whole-file source and regenerates the index', () => {
        const root = mkRepo();
        const pagePath = path.join(root, 'agents', 'knowledge', 'concepts', 'x.md');
        fs.mkdirSync(path.dirname(pagePath), { recursive: true });
        fs.writeFileSync(pagePath, '---\ntrust: durable\n---\n\n# X\n\nold body\n', 'utf8');

        const cwd = process.cwd();
        process.chdir(root);
        try {
            const rc = main(['--source', pagePath, '--artifact', 'src/skills/x/SKILL.md', '--date', '2026-07-05']);
            expect(rc).toBe(0);
        } finally {
            process.chdir(cwd);
        }

        const updated = fs.readFileSync(pagePath, 'utf8');
        expect(updated).toContain('Promoted to `src/skills/x/SKILL.md`');
        expect(updated).not.toContain('old body');

        const index = fs.readFileSync(path.join(root, 'agents', 'knowledge', 'INDEX.md'), 'utf8');
        expect(index).toContain('x.md');
    });

    it('degrades a #anchor section source', () => {
        const root = mkRepo();
        const candidatesPath = path.join(root, 'agents', 'knowledge', 'procedures', 'skill-candidates.md');
        fs.mkdirSync(path.dirname(candidatesPath), { recursive: true });
        fs.writeFileSync(candidatesPath, '# Skill Candidates\n\n## retry-with-backoff\n\n- Mentions: 3\n', 'utf8');

        const cwd = process.cwd();
        process.chdir(root);
        try {
            const rc = main([
                '--source',
                `${candidatesPath}#retry-with-backoff`,
                '--artifact',
                'src/skills/retry/SKILL.md',
                '--date',
                '2026-07-05',
            ]);
            expect(rc).toBe(0);
        } finally {
            process.chdir(cwd);
        }

        const updated = fs.readFileSync(candidatesPath, 'utf8');
        expect(updated).toContain('Promoted to `src/skills/retry/SKILL.md`');
        expect(updated).not.toContain('Mentions: 3');
    });

    it('missing source file exits 1', () => {
        expect(main(['--source', '/nonexistent/x.md', '--artifact', 'a.md', '--date', '2026-07-05'])).toBe(1);
    });

    it('usage errors exit 1', () => {
        expect(main(['--source', 'x.md'])).toBe(1);
        expect(main(['--bogus'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
