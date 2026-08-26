// Tests for src/scripts/_lib/runtime_wiring_checks.ts
// (road-to-skill-ecosystem-runtime-enforcement Phase 2 Steps 2-5).
//
// Each check exists because a specific silent failure was recorded, so the
// tests are written around the SILENT case rather than the happy one: a router
// that exists and does not parse, a hook registered against a missing file, a
// git variable inherited from a hook. A check that only proves the good path
// proves nothing about the failure it was built for.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _routerRuleCount,
    checkHookResolution,
    checkInheritedGitEnv,
    checkRouterArtifact,
    checkSettingsResolution,
} from '../../src/scripts/_lib/runtime_wiring_checks.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wiring-')));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('checkSettingsResolution', () => {
    it('reports SKIPPED, not a failure and not a pass, when no layer sets any key', () => {
        // A fresh project legitimately has no settings, so a failure here would
        // train a reader to ignore the check. `ok` would be wrong in the other
        // direction — it reads as "settings resolved fine" on a tree where no
        // setting exists at all. `skipped` says the check had nothing to inspect.
        //
        // It was `info` for one commit. The MCP `doctor_report` tool asserts the
        // four-value union the doctor publishes, so a fifth value failed that
        // tool's shape test in CI rather than reaching any report — a vocabulary
        // a consumer cannot receive is not a vocabulary.
        const r = checkSettingsResolution(() => []);
        expect(r.status).toBe('skipped');
        expect(r.message).toContain('NO layer sets any key');
    });

    it('attributes each key to the LAST file that set it — the resolver rule', () => {
        const r = checkSettingsResolution(() => [
            ['a.b', 1, '/global/.agent-settings.yml'],
            ['a.b', 2, '/project/.agent-settings.yml'],
            ['c.d', 3, '/project/.agent-settings.yml'],
        ]);
        expect(r.status).toBe('ok');
        // Two distinct keys, and BOTH attributed to the project file: `a.b`
        // because the project layer overrode it, `c.d` because only it set it.
        expect(r.message).toContain('2 key(s)');
        expect(r.message).toContain('1 layer(s)');
    });

    it('fails loudly when the cascade itself throws', () => {
        const r = checkSettingsResolution(() => {
            throw new Error('bad yaml');
        });
        expect(r.status).toBe('fail');
        expect(r.message).toContain('bad yaml');
    });
});

describe('checkRouterArtifact', () => {
    it('WARNS when the artifact is absent', () => {
        expect(checkRouterArtifact(tmp).status).toBe('warn');
    });

    it('FAILS when the artifact exists and does not parse — the silent case', () => {
        // The one this check exists for: a host reads no rules and behaves like a
        // tree with none, which looks exactly like a minimal configuration.
        fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'dist', 'router.json'), '{ truncated', 'utf8');
        const r = checkRouterArtifact(tmp);
        expect(r.status).toBe('fail');
        expect(r.message).toContain('does NOT parse');
    });

    it('WARNS when it parses but carries zero rules', () => {
        fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'dist', 'router.json'), '{"rules":[]}', 'utf8');
        expect(checkRouterArtifact(tmp).status).toBe('warn');
    });

    it('reports the rule count when healthy', () => {
        fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'dist', 'router.json'), '{"rules":[1,2,3]}', 'utf8');
        const r = checkRouterArtifact(tmp);
        expect(r.status).toBe('ok');
        expect(r.message).toContain('3 rule(s)');
    });

    it('counts rules in a nested shape too, so a schema change does not read as zero', () => {
        expect(_routerRuleCount({ tier_1: [1, 2], tier_2: { a: [3] } })).toBe(3);
        expect(_routerRuleCount(null)).toBe(0);
    });
});

describe('checkHookResolution', () => {
    const writeManifest = (body: string): string => {
        const rel = path.join('src', 'scripts', 'hook_manifest.yaml');
        fs.mkdirSync(path.join(tmp, 'src', 'scripts'), { recursive: true });
        fs.writeFileSync(path.join(tmp, rel), body, 'utf8');
        return rel;
    };

    it('FAILS on a hook registered against a file that does not exist', () => {
        // A registered hook with no script silently no-ops EVERY session, and
        // nothing in the host's output says so.
        const rel = writeManifest('concerns:\n  ghost:\n    script: src/scripts/nope.ts\n');
        const { check, probes } = checkHookResolution(tmp, rel);
        expect(check.status).toBe('fail');
        expect(check.message).toContain('ghost');
        expect(probes).toHaveLength(1);
        expect(probes[0]!.resolves).toBe(false);
    });

    it('passes when every registered hook resolves', () => {
        const rel = writeManifest('concerns:\n  real:\n    script: src/scripts/real.ts\n');
        fs.writeFileSync(path.join(tmp, 'src', 'scripts', 'real.ts'), '', 'utf8');
        expect(checkHookResolution(tmp, rel).check.status).toBe('ok');
    });

    it('names the SLOWEST hook, because a total is not actionable', () => {
        fs.mkdirSync(path.join(tmp, 'src', 'scripts'), { recursive: true });
        for (const n of ['fast', 'slow']) fs.writeFileSync(path.join(tmp, 'src', 'scripts', `${n}.ts`), '', 'utf8');
        const rel = writeManifest(
            'concerns:\n  fast:\n    script: src/scripts/fast.ts\n  slow:\n    script: src/scripts/slow.ts\n',
        );
        const { check } = checkHookResolution(tmp, rel, (s) => (s.includes('slow') ? 300 : 5));
        expect(check.message).toContain('slowest slow 300ms');
    });

    it('FAILS rather than skipping when the manifest is absent', () => {
        expect(checkHookResolution(tmp, 'src/scripts/hook_manifest.yaml').check.status).toBe('fail');
    });

    it('FAILS when the manifest does not parse', () => {
        const rel = writeManifest('concerns:\n  a: [unclosed\n');
        expect(checkHookResolution(tmp, rel).check.status).toBe('fail');
    });
});

describe('checkInheritedGitEnv', () => {
    it('is ok on a clean environment', () => {
        expect(checkInheritedGitEnv({}).status).toBe('ok');
    });

    it('WARNS on GIT_DIR and names the value', () => {
        const r = checkInheritedGitEnv({ GIT_DIR: '/elsewhere/.git' });
        expect(r.status).toBe('warn');
        expect(r.message).toContain('GIT_DIR=/elsewhere/.git');
        expect(r.remedy).toContain('repo_root');
    });

    it('warns rather than failing — the variable is legitimate where git set it', () => {
        // The point is visibility, not refusal: `doctor` writes nothing and
        // always exits zero, so a `fail` here would be a claim it cannot back.
        expect(checkInheritedGitEnv({ GIT_WORK_TREE: '/x' }).status).toBe('warn');
    });
});
