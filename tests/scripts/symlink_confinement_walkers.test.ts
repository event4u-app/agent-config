/**
 * Symlink-confinement battery for the catalog/count walkers
 * (release-truth Phase 3).
 *
 * The 9.14.0 release-PR review reported an unconfined symlink traversal in
 * the skill-catalog walk. The adjudicated shape: `iter_skills`' walker did
 * not follow directory symlinks but yielded symlinked leaves unchecked, and
 * the sibling `_rglobSorted` walk behind `iter_commands` / `iter_artefacts`
 * deliberately followed directory symlinks with no package-root confinement
 * and no cycle guard. These four cases pin the confinement contract for BOTH
 * walkers; removing the confinement check turns them red (the loop case by
 * stack exhaustion, the others by asserting on the yielded set):
 *
 *   1. internal symlink target → allowed (still counted)
 *   2. external symlink target → ignored safely
 *   3. symlink loop → terminates
 *   4. broken symlink → handled explicitly (ignored, no throw)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _getRootsForTest,
    _setRootsForTest,
    iter_commands,
} from '../../src/scripts/_lib/agent_src.js';
import { iter_skills } from '../../src/scripts/update_counts.js';

let tmp: string;
let savedRoots: ReturnType<typeof _getRootsForTest>;

function write(rel: string, content = 'x\n'): string {
    const p = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    return p;
}

/** Point every source root at the throwaway repo; absent dirs stay inert. */
function useTmpRepo(): void {
    const repo = path.join(tmp, 'repo');
    _setRootsForTest({
        ROOT: repo,
        LEGACY_SRC: path.join(repo, '.agent-src.uncondensed'),
        PACKAGES: path.join(repo, 'packages'),
        PACKAGE_CORE: path.join(repo, 'packages', 'core'),
        SRC: path.join(repo, 'src'),
        SRC_SKILLS: path.join(repo, 'src', 'skills'),
        SRC_RULES: path.join(repo, 'src', 'rules'),
        SRC_AGENT: path.join(repo, 'src', 'agent-src'),
        SRC_DOMAINS: path.join(repo, 'src', 'domains'),
    });
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'symlink-battery-'));
    savedRoots = _getRootsForTest();
    useTmpRepo();
});

afterEach(() => {
    _setRootsForTest(savedRoots);
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('iter_skills — skills-catalog walk (update_counts._rglob)', () => {
    it('follows a symlink only when it resolves inside the walk root', () => {
        // 1. internal targets — allowed
        write('repo/src/skills/real/SKILL.md');
        fs.symlinkSync(
            path.join(tmp, 'repo/src/skills/real'),
            path.join(tmp, 'repo/src/skills/linked-dir'),
        );
        fs.mkdirSync(path.join(tmp, 'repo/src/skills/linked-leaf'));
        fs.symlinkSync(
            path.join(tmp, 'repo/src/skills/real/SKILL.md'),
            path.join(tmp, 'repo/src/skills/linked-leaf/SKILL.md'),
        );

        // 2. external targets — ignored safely
        write('outside/evil/SKILL.md');
        fs.symlinkSync(path.join(tmp, 'outside/evil'), path.join(tmp, 'repo/src/skills/ext-dir'));
        fs.mkdirSync(path.join(tmp, 'repo/src/skills/ext-leaf'));
        fs.symlinkSync(
            path.join(tmp, 'outside/evil/SKILL.md'),
            path.join(tmp, 'repo/src/skills/ext-leaf/SKILL.md'),
        );

        const found = [...iter_skills()].map((p) => path.relative(path.join(tmp, 'repo'), p));
        expect(found).toContain(path.join('src', 'skills', 'real', 'SKILL.md'));
        expect(found).toContain(path.join('src', 'skills', 'linked-dir', 'SKILL.md'));
        expect(found).toContain(path.join('src', 'skills', 'linked-leaf', 'SKILL.md'));
        expect(found.filter((p) => p.includes('ext-dir') || p.includes('ext-leaf'))).toEqual([]);
    });

    it('terminates on a symlink loop', () => {
        write('repo/src/skills/loop/SKILL.md');
        fs.symlinkSync(
            path.join(tmp, 'repo/src/skills/loop'),
            path.join(tmp, 'repo/src/skills/loop/self'),
        );
        const found = [...iter_skills()];
        expect(found.some((p) => p.endsWith(path.join('loop', 'SKILL.md')))).toBe(true);
    });

    it('ignores a broken symlink without throwing', () => {
        write('repo/src/skills/ok/SKILL.md');
        fs.mkdirSync(path.join(tmp, 'repo/src/skills/dangling'));
        fs.symlinkSync(
            path.join(tmp, 'repo/src/skills/does-not-exist'),
            path.join(tmp, 'repo/src/skills/dangling/SKILL.md'),
        );
        const found = [...iter_skills()];
        expect(found.some((p) => p.endsWith(path.join('ok', 'SKILL.md')))).toBe(true);
        expect(found.some((p) => p.includes('dangling'))).toBe(false);
    });
});

describe('iter_commands — commands walk (_lib/agent_src._rglobSorted)', () => {
    it('follows a symlink only when it resolves inside the walk root', () => {
        write('repo/src/agent-src/commands/real/cmd.md');
        fs.symlinkSync(
            path.join(tmp, 'repo/src/agent-src/commands/real'),
            path.join(tmp, 'repo/src/agent-src/commands/linked-dir'),
        );
        fs.mkdirSync(path.join(tmp, 'repo/src/agent-src/commands/linked-leaf'));
        fs.symlinkSync(
            path.join(tmp, 'repo/src/agent-src/commands/real/cmd.md'),
            path.join(tmp, 'repo/src/agent-src/commands/linked-leaf/cmd.md'),
        );

        write('outside/evil/cmd.md');
        fs.symlinkSync(
            path.join(tmp, 'outside/evil'),
            path.join(tmp, 'repo/src/agent-src/commands/ext-dir'),
        );
        fs.mkdirSync(path.join(tmp, 'repo/src/agent-src/commands/ext-leaf'));
        fs.symlinkSync(
            path.join(tmp, 'outside/evil/cmd.md'),
            path.join(tmp, 'repo/src/agent-src/commands/ext-leaf/cmd.md'),
        );

        const found = [...iter_commands()].map((p) => path.relative(path.join(tmp, 'repo'), p));
        expect(found).toContain(path.join('src', 'agent-src', 'commands', 'real', 'cmd.md'));
        expect(found).toContain(path.join('src', 'agent-src', 'commands', 'linked-dir', 'cmd.md'));
        expect(found).toContain(path.join('src', 'agent-src', 'commands', 'linked-leaf', 'cmd.md'));
        expect(found.filter((p) => p.includes('ext-dir') || p.includes('ext-leaf'))).toEqual([]);
    });

    it('terminates on a symlink loop', () => {
        write('repo/src/agent-src/commands/loop/cmd.md');
        fs.symlinkSync(
            path.join(tmp, 'repo/src/agent-src/commands/loop'),
            path.join(tmp, 'repo/src/agent-src/commands/loop/self'),
        );
        const found = [...iter_commands()];
        expect(found.some((p) => p.endsWith(path.join('loop', 'cmd.md')))).toBe(true);
    });

    it('ignores a broken symlink without throwing', () => {
        write('repo/src/agent-src/commands/ok/cmd.md');
        fs.mkdirSync(path.join(tmp, 'repo/src/agent-src/commands/dangling'));
        fs.symlinkSync(
            path.join(tmp, 'repo/src/agent-src/commands/does-not-exist'),
            path.join(tmp, 'repo/src/agent-src/commands/dangling/cmd.md'),
        );
        const found = [...iter_commands()];
        expect(found.some((p) => p.endsWith(path.join('ok', 'cmd.md')))).toBe(true);
        expect(found.some((p) => p.includes('dangling'))).toBe(false);
    });
});

describe('_iter_domains_commands — `__`-prefixed scratch packs are not artefacts', () => {
    /**
     * REGRESSION PIN for a measured cross-test contamination, 2026-08-20.
     *
     * `check_artefact_count_messaging`'s live-tree gate passed in isolation and
     * failed in a full suite run with `commands says 200, expected 207`. The +7
     * came from `lint_originality.test.ts`, which writes seven `command.md`
     * files into the REAL tree under `src/domains/__origtest_batch/` because
     * that gate classifies an artefact by its path. Vitest runs files in
     * parallel workers, so a concurrent counter saw them.
     *
     * Hermetic here by construction: the roots are pointed at a tmpdir, so this
     * test cannot become the thing it is pinning.
     */
    it('a scratch pack contributes no commands, while real packs still do', () => {
        write('repo/src/domains/realpack/ship/command.md');
        write('repo/src/domains/__origtest_batch/c1/command.md');
        write('repo/src/domains/__origtest_batch/c2/command.md');
        write('repo/src/domains/__scratch/deep/nested/command.md');

        const found = [...iter_commands()].map((p) => path.relative(path.join(tmp, 'repo'), p));
        expect(found).toEqual(['src/domains/realpack/ship/command.md']);
    });

    it('the prefix is checked on the PACK segment, not anywhere in the path', () => {
        // A real pack containing a `__`-named subpath is still a real command —
        // the scratch marker is a pack-level convention, and widening it to any
        // path segment would silently drop shippable artefacts.
        write('repo/src/domains/realpack/__weird/command.md');
        const found = [...iter_commands()].map((p) => path.relative(path.join(tmp, 'repo'), p));
        expect(found).toEqual(['src/domains/realpack/__weird/command.md']);
    });
});
