// Tests for src/scripts/lint_agents_md.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. This is a light behavioural spec over the exported
// pure helper plus the golden-parity layer that runs python3 vs tsx on the
// REAL REPO (skipped without python3). Golden parity is the binding contract.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as lam from '../../src/scripts/lint_agents_md.js';



describe('lint_agents_md — behavioural spec', () => {
    it('exposes the path-enumeration threshold constant', () => {
        expect(lam.PATH_ENUM_THRESHOLD).toBe(3);
    });

    it('_is_path_enumeration: bullet + backtick path, no link → true', () => {
        expect(lam._is_path_enumeration('- `src/scripts/foo.ts`')).toBe(true);
    });

    it('_is_path_enumeration: a markdown link line → false', () => {
        // A bullet whose backtick span is a link is a pointer, not enumeration.
        expect(lam._is_path_enumeration('- [foo](src/foo.md) — why')).toBe(false);
    });

    it('_is_path_enumeration: a non-bullet line → false', () => {
        expect(lam._is_path_enumeration('plain `path/here.md` prose')).toBe(false);
    });
});

describe('lint_agents_md — --target lints a consumer file', () => {
    const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
    const SCRIPT = path.join(REPO, 'src', 'scripts', 'lint_agents_md.ts');
    const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

    it('reports the fixture with template thresholds, not the package root', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-agents-md-'));
        const fixture = path.join(dir, 'AGENTS.md');
        fs.writeFileSync(fixture, `# Consumer\n\n${'padding prose line. '.repeat(140)}\n`);
        const r = spawnSync(TSX, [SCRIPT, '--target', fixture], { encoding: 'utf8', cwd: dir });
        expect(r.stdout).toContain('AGENTS.md');
        expect(r.stdout).not.toMatch(/package-root|consumer-template/);
        expect(r.stdout).toMatch(/> FAIL cap 2500/);
        expect(r.status).toBe(1);
    });

    it('errors when --target has no file argument', () => {
        const r = spawnSync(TSX, [SCRIPT, '--target'], { encoding: 'utf8' });
        expect(r.status).toBe(1);
        expect(r.stdout).toMatch(/--target needs a file/);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

