// Tests for src/scripts/lint_featured_skills.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Focused differential coverage of the public helpers
// (slug_from_path, manifest_names, the LINK_RE / PACK_HINT_RE patterns) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO across the
// real CI args (default + --quiet), asserting byte-identical
// stdout/stderr/exit. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_featured_skills.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_featured_skills.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_featured_skills.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('lint_featured_skills — behavioural spec (helpers)', () => {
    // slug_from_path(category, raw): skills/<slug>/SKILL → <slug>;
    // commands/<group>/<leaf> → <group>:<leaf>; commands/<leaf> → <leaf>.
    it('slug_from_path maps a skills link to its slug', () => {
        expect(mod.slug_from_path('skills', 'demo-skill/SKILL')).toBe('demo-skill');
    });

    it('slug_from_path maps a nested command to a colon name', () => {
        expect(mod.slug_from_path('commands', 'council/default')).toBe('council:default');
    });

    it('slug_from_path maps a flat command to its leaf', () => {
        expect(mod.slug_from_path('commands', 'commit')).toBe('commit');
    });

    it('manifest_names splits skill / command / pack names from a manifest object', () => {
        const [skills, commands] = mod.manifest_names({
            artefacts: [
                { category: 'skill', name: 'demo-skill' },
                { category: 'command', name: 'council:default', replaces: ['council:old'] },
            ],
        } as mod.Manifest);
        expect(skills.has('demo-skill')).toBe(true);
        expect(commands.has('council:default')).toBe(true);
        expect(commands.has('council:old')).toBe(true); // deprecation alias
    });

    // The discovery manifest is a gitignored generated artifact (built by
    // build_discovery_manifest). Jobs that only run `npm ci` + vitest (e.g. the
    // migration-gate workflow) don't build it, so skip when it's absent —
    // asserting on a missing generated file is an environment artifact, not a
    // behavior check.
    it.skipIf(!fs.existsSync(mod.MANIFEST))(
        'the real-repo discovery manifest loads as valid JSON with artefacts',
        () => {
            const raw = fs.readFileSync(mod.MANIFEST, 'utf-8');
            const data = JSON.parse(raw) as mod.Manifest;
            const [skills] = mod.manifest_names(data);
            expect(skills.size).toBeGreaterThan(0);
        },
    );

    it('LINK_RE captures (category, raw) pairs from a discovery-doc link', () => {
        // Pattern: [`/?<text>`](../dist/agent-src/(skills|commands)/<raw>.md)
        const re = new RegExp(mod.LINK_RE.source, mod.LINK_RE.flags || 'g');
        const m = re.exec('[`code-refactoring`](../dist/agent-src/skills/code-refactoring.md)');
        expect(m).not.toBeNull();
        expect(m![1]).toBe('skills');
        expect(m![2]).toBe('code-refactoring');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('lint_featured_skills — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    for (const args of [[], ['--quiet']]) {
        it(`matches \`${args.join(' ') || '(default)'}\` byte-for-byte`, () => {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.status).toBe(py.status);
        });
    }
});
