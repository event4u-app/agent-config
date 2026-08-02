/** Smoke + contract for lint_originality_shingles (P1.3):
 *  report-only mode always exits 0 on the real corpus; the report names the
 *  corpus size; an absurd threshold of 101% can never fail. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { main } from '../../src/scripts/lint_originality_shingles.js';

describe('lint_originality_shingles', () => {
    it('report-only mode exits 0 on the real corpus', () => {
        expect(main(['--quiet'])).toBe(0);
    });

    it('an unreachable threshold never fails', () => {
        expect(main(['--quiet', '--threshold', '101'])).toBe(0);
    });

    // The header promises "every pair of skills / personas / subagents". The
    // personas root was `src/personas`, which has not existed since ADR-051, and
    // an `existsSync` guard turned that into a silent drop rather than an error —
    // the gate compared skills only while claiming to compare three families.
    // Assert the corpus SIZE reflects all three, so a future container move shows
    // up as a failing count instead of a quietly smaller comparison.
    it('the corpus includes personas, not skills alone', () => {
        const repo = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
        const count = (rel: string, isDir: boolean): number => {
            const dir = path.join(repo, rel);
            if (!fs.existsSync(dir)) return 0;
            return fs
                .readdirSync(dir, { withFileTypes: true })
                .filter((d) => (isDir ? d.isDirectory() : d.isFile() && d.name.endsWith('.md') && d.name !== 'README.md'))
                .length;
        };
        const skills = count('src/skills', true);
        const personas = count('src/agent-src/personas', false);
        expect(personas, 'personas root resolved to nothing — the dead-root bug is back').toBeGreaterThan(0);

        const lines: string[] = [];
        const write = process.stdout.write.bind(process.stdout);
        (process.stdout as { write: unknown }).write = (chunk: string): boolean => {
            lines.push(String(chunk));
            return true;
        };
        try {
            main([]);
        } finally {
            (process.stdout as { write: unknown }).write = write;
        }
        const m = /originality-shingles: (\d+) docs/.exec(lines.join(''));
        expect(m, 'the report no longer states its corpus size').not.toBeNull();
        expect(Number(m?.[1]), 'corpus is skills-only — personas were dropped again').toBeGreaterThan(
            skills + personas - 1,
        );
    });
});
