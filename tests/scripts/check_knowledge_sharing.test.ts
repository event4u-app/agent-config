// Tests for src/scripts/check_knowledge_sharing.ts (road-to-knowledge-system,
// Phase 3 — team-sharing gate). Exercises the pure logic via dependency
// injection (a fake staged-file list + content reader) — never touches a
// real git index or filesystem.
import { describe, expect, it } from 'vitest';

import { checkSharing, parseNameStatus, type StagedFile } from '../../src/scripts/check_knowledge_sharing.ts';

describe('parseNameStatus', () => {
    it('parses added/modified/deleted lines', () => {
        const raw = 'A\tagents/knowledge/concepts/a.md\nM\tagents/knowledge/b.md\nD\tagents/knowledge/c.md\n';
        expect(parseNameStatus(raw)).toEqual([
            { path: 'agents/knowledge/concepts/a.md', status: 'A' },
            { path: 'agents/knowledge/b.md', status: 'M' },
            { path: 'agents/knowledge/c.md', status: 'D' },
        ]);
    });

    it('renames keep the NEW path (last tab-separated field)', () => {
        const raw = 'R100\tagents/knowledge/old.md\tagents/knowledge/new.md\n';
        expect(parseNameStatus(raw)).toEqual([{ path: 'agents/knowledge/new.md', status: 'R' }]);
    });

    it('ignores blank lines', () => {
        expect(parseNameStatus('\n\n')).toEqual([]);
    });
});

describe('checkSharing — gitignored intake staged (BLOCK)', () => {
    it('blocks a staged file under agents/memory/intake/', () => {
        const staged: StagedFile[] = [{ path: 'agents/memory/intake/signals-2026-07.jsonl', status: 'A' }];
        const report = checkSharing(staged, () => null);
        expect(report.blocked).toHaveLength(1);
        expect(report.blocked[0]).toContain('intake');
        expect(report.warnings).toEqual([]);
    });
});

describe('checkSharing — visibility: private staged (BLOCK)', () => {
    it('blocks a knowledge page with visibility: private', () => {
        const staged: StagedFile[] = [{ path: 'agents/knowledge/concepts/x.md', status: 'A' }];
        const content = '---\nvisibility: private\n---\n\n# X\n';
        const report = checkSharing(staged, () => content);
        expect(report.blocked).toHaveLength(1);
        expect(report.blocked[0]).toContain('visibility: private');
    });

    it('does not block visibility: team or visibility: project', () => {
        for (const visibility of ['team', 'project']) {
            const staged: StagedFile[] = [{ path: 'agents/knowledge/concepts/x.md', status: 'A' }];
            const content = `---\nvisibility: ${visibility}\n---\n\n# X\n`;
            expect(checkSharing(staged, () => content).blocked).toEqual([]);
        }
    });

    it('a page with no frontmatter at all is not blocked', () => {
        const staged: StagedFile[] = [{ path: 'agents/knowledge/concepts/x.md', status: 'A' }];
        expect(checkSharing(staged, () => '# X\n\nbody\n').blocked).toEqual([]);
    });
});

describe('checkSharing — creation budget (WARN, never block)', () => {
    it('4 new knowledge files does not warn', () => {
        const staged: StagedFile[] = Array.from({ length: 4 }, (_, i) => ({
            path: `agents/knowledge/concepts/f${i}.md`,
            status: 'A' as const,
        }));
        const report = checkSharing(staged, () => '# X\n');
        expect(report.warnings).toEqual([]);
        expect(report.blocked).toEqual([]);
    });

    it('6 new knowledge files warns but does not block', () => {
        const staged: StagedFile[] = Array.from({ length: 6 }, (_, i) => ({
            path: `agents/knowledge/concepts/f${i}.md`,
            status: 'A' as const,
        }));
        const report = checkSharing(staged, () => '# X\n');
        expect(report.warnings).toHaveLength(1);
        expect(report.warnings[0]).toContain('6 new files');
        expect(report.blocked).toEqual([]);
    });

    it('modified (not added) knowledge files never count toward the creation budget', () => {
        const staged: StagedFile[] = Array.from({ length: 6 }, (_, i) => ({
            path: `agents/knowledge/concepts/f${i}.md`,
            status: 'M' as const,
        }));
        expect(checkSharing(staged, () => '# X\n').warnings).toEqual([]);
    });
});

describe('checkSharing — normal card edit (pass clean)', () => {
    it('a modified knowledge-card with no violations produces neither block nor warning', () => {
        const staged: StagedFile[] = [{ path: 'agents/knowledge/stripe.md', status: 'M' }];
        const content = '---\ntrust: durable\n---\n\n# Stripe\n';
        const report = checkSharing(staged, () => content);
        expect(report.blocked).toEqual([]);
        expect(report.warnings).toEqual([]);
    });

    it('files outside agents/knowledge and agents/memory/intake are ignored entirely', () => {
        const staged: StagedFile[] = [{ path: 'src/scripts/unrelated.ts', status: 'A' }];
        expect(checkSharing(staged, () => 'irrelevant')).toEqual({ blocked: [], warnings: [] });
    });
});
