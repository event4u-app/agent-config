/**
 * CI assertion for the memory tier split (road-to-reachable-code-memory
 * Phase 5): `agents/runtime/` is gitignored/ephemeral and must never be
 * tracked; no SQLite/db artefact may be tracked anywhere (the substrate
 * decision — ADR memory-tripwire — stays file-backed, no committed
 * database); the curated flat-layout memory files ARE tracked (they are the
 * shared, reviewable project-context corpus these merge attributes protect).
 *
 * Uses `git ls-files` against the real repo — a tracked file appearing where
 * it shouldn't (or a curated file going missing/untracked) is exactly the
 * defect this assertion catches before it reaches CI.
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

function gitLsFiles(...args: string[]): string[] {
    const out = execSync(`git ls-files ${args.join(' ')}`, {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
    });
    return out.split('\n').filter((l) => l.trim() !== '');
}

describe('memory tier split — tracked-file discipline', () => {
    it('has zero tracked files under agents/runtime/', () => {
        const tracked = gitLsFiles('--', 'agents/runtime/');
        expect(tracked).toEqual([]);
    });

    it('has zero tracked *.sqlite3 / *.db files anywhere', () => {
        const all = gitLsFiles();
        const dbFiles = all.filter((f) => /\.(sqlite3?|db)$/i.test(f));
        expect(dbFiles).toEqual([]);
    });

    it('keeps the curated flat-layout memory files tracked', () => {
        const required = [
            'agents/memory/historical-patterns.yml',
            'agents/memory/incident-learnings.yml',
            'agents/memory/product-rules.yml',
        ];
        const tracked = new Set(gitLsFiles('--', 'agents/memory/'));
        for (const rel of required) {
            expect(tracked.has(rel), `expected ${rel} to be tracked`).toBe(true);
        }
    });
});
