// road-to-security-fixes-carried-to-the-merge — fixtures G1–G9 and the
// decidable half of the fix path. Nothing here runs a package manager.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readInventory } from '../../src/scripts/_lib/advisory_inventory.js';
import type { Finding } from '../../src/scripts/_lib/advisory_verdicts.js';
import {
    advance,
    branchName,
    claimRemediation,
    fixPlan,
    isFixFresh,
    mergedNotDeployed,
    prBody,
    proveFixed,
    prTitle,
    releaseDraft,
    type Remediations,
    reopenMitigations,
    routeSecurityFix,
    type RoutingContext,
    suspiciousPaths,
    track,
} from '../../src/scripts/_lib/security_fix.js';
import { readRoutingContext } from '../../src/scripts/_lib/security_fix_context.js';

const FIX = path.join(__dirname, '..', 'fixtures', 'security-fixes');
let tmp = '';
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'secfix-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

function finding(over: Partial<Finding> = {}): Finding {
    return {
        key: 'CVE-2026-0001|fastify|5.12.4',
        id: 'CVE-2026-0001',
        aliases: ['GHSA-f1aa-f1aa-f1aa'],
        verdict: 'fix-available',
        tier: 'T1',
        ecosystem: 'npm',
        package: 'fastify',
        version: '5.12.4',
        fixed: '5.12.5',
        severity: 'high',
        score: null,
        kev: false,
        date: null,
        scope: 'runtime',
        sources: ['osv'],
        modified: null,
        file: 'package-lock.json',
        line: 10,
        note: null,
        ...over,
    };
}

function git(cwd: string, args: string[]): string {
    return execFileSync('git', ['-C', cwd, ...args], {
        encoding: 'utf-8',
        env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
    });
}

describe('routing table — fixtures G1–G9 (2.1)', () => {
    const dirs = fs.readdirSync(FIX).filter((d) => /^G\d-/.test(d)).sort();

    it('every fixture is a directory with a context and an expected outcome', () => {
        expect(dirs.length).toBe(9);
    });

    for (const d of dirs) {
        it(`${d} routes as the table says`, () => {
            const ctx = JSON.parse(fs.readFileSync(path.join(FIX, d, 'context.json'), 'utf-8')) as RoutingContext;
            const exp = JSON.parse(fs.readFileSync(path.join(FIX, d, 'expected.json'), 'utf-8')) as Record<string, unknown>;
            const r = routeSecurityFix(ctx);
            expect(r.route).toBe(exp['route']);
            for (const k of ['releaseDraft', 'opsChecklist', 'rebaseOfferAfterMerge'] as const) {
                if (k in exp) expect(r[k]).toBe(exp[k]);
            }
            expect(r.reason.length).toBeGreaterThan(10);
        });
    }
});

describe('the fix itself (Phase 1)', () => {
    it('G1 — a transitive npm fix updates within the ranges and never forces', () => {
        const p = fixPlan(finding(), []);
        expect(p.commands.join(' ')).toContain('npm update fastify');
        expect(p.commands.join(' ')).not.toMatch(/--force|audit fix/);
        expect(p.note).toContain('overrides');
    });

    it('a new major is never planned silently', () => {
        expect(fixPlan(finding({ fixed: '6.0.0' }), []).note).toMatch(/new major/);
    });

    it('G6 — a PHP runtime fix edits every pinning file and lists what no file controls', () => {
        const dir = path.join(tmp, 'g6');
        fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM php:8.3.12-fpm\n');
        fs.writeFileSync(path.join(dir, 'composer.json'), JSON.stringify({ require: { php: '^8.3' }, config: { platform: { php: '8.3.12' } } }, null, 2));
        fs.writeFileSync(path.join(dir, '.github', 'workflows', 'ci.yml'), 'jobs:\n  t:\n    steps:\n      - uses: shivammathur/setup-php@v2\n        with:\n          php-version: 8.3.12\n');
        const inv = readInventory(dir).entries;
        const p = fixPlan(finding({ ecosystem: 'runtime', package: 'php', version: '8.3.12', fixed: '8.3.27', file: 'Dockerfile' }), inv);
        expect(p.edits.map((e) => e.file).sort()).toEqual(['.github/workflows/ci.yml', 'Dockerfile', 'composer.json']);
        expect(p.edits.every((e) => e.to === '8.3.27')).toBe(true);
        expect(p.opsChecklist.length).toBeGreaterThanOrEqual(2);
    });

    it('G8 — no fixing version exists: no commands, a mitigation instead; it reopens when a fix appears (1.5)', () => {
        expect(fixPlan(finding({ fixed: null, verdict: 'no-fix' }), []).note).toMatch(/mitigation/);
        const all: Remediations = {};
        const { remediation } = claimRemediation(all, 'K', 's1');
        advance(remediation, 'mitigated', new Date(), { note: 'feature disabled behind a flag' });
        expect(reopenMitigations(all, [finding({ key: 'K', fixed: null })])).toEqual([]);
        expect(reopenMitigations(all, [finding({ key: 'K', fixed: '5.12.5' })])).toEqual(['K']);
        expect(all['K']).toBeUndefined();
    });

    it('G9 — a fixing release younger than the cooldown is fix-fresh; agent-config paths in the diff stop it (1.3)', () => {
        const now = new Date('2026-10-21T12:00:00Z');
        expect(isFixFresh('2026-10-20T12:00:00Z', now)).toBe(true);
        expect(isFixFresh('2026-10-10T12:00:00Z', now)).toBe(false);
        expect(suspiciousPaths(['package-lock.json', '.claude/settings.json'])).toEqual(['.claude/settings.json']);
        expect(suspiciousPaths(['package-lock.json'], { before: { test: 'x' }, after: { test: 'x', postinstall: 'curl …' } })).toEqual(['package.json scripts.postinstall']);
    });

    it('proof is the reporting source’s own answer, never the attempt (1.4)', () => {
        const f = finding();
        expect(proveFixed(f.key, ['osv'], { findings: [], okSources: ['osv'] })).toBe('fixed-in-branch');
        expect(proveFixed(f.key, ['osv'], { findings: [f], okSources: ['osv'] })).toBe('fix-failed');
        expect(proveFixed(f.key, ['osv'], { findings: [], okSources: [] })).toBe('unverifiable');
    });
});

describe('the PR and the release (2.3, 2.4)', () => {
    it('the PR carries all seven evidence fields, under a security/ branch and a fix(security) title', () => {
        const f = finding();
        expect(branchName(f)).toBe('security/fastify-cve-2026-0001');
        expect(prTitle(f)).toBe('fix(security): fastify 5.12.4 → 5.12.5 (CVE-2026-0001, GHSA-f1aa-f1aa-f1aa)');
        const body = prBody(f, { before: 'osv reported fastify 5.12.4', after: 'fixed-in-branch', tests: 'passed', cooldown: 'outside', deploy: 'next deploy' });
        for (const field of ['Finding', 'Tier', 'Before', 'After', 'Tests', 'Cooldown / provenance', 'Deploy']) expect(body).toContain(`**${field}:**`);
    });

    it('G5 — a library gets a patch-release draft and no tag', () => {
        const d = releaseDraft('2.4.1', [finding()])!;
        expect(d.version).toBe('2.4.2');
        expect(d.changelog).toContain('### Security');
        expect(d.changelog).toContain('CVE-2026-0001');
    });
});

describe('following the fix (Phase 3)', () => {
    it('trunk → released → deployed only on observed signals', () => {
        const all: Remediations = {};
        const { remediation: r } = claimRemediation(all, 'K', 's1');
        track(r, { mergedSha: null, releaseContains: false, deployed: false });
        expect(r.state).toBe('fix-in-progress');
        track(r, { mergedSha: 'abc1234def', releaseContains: false, deployed: false });
        expect(r.state).toBe('fixed-in-trunk');
        track(r, { mergedSha: 'abc1234def', releaseContains: true, deployed: false });
        expect(r.state).toBe('fixed-released');
        track(r, { mergedSha: 'abc1234def', releaseContains: true, deployed: true });
        expect(r.state).toBe('fixed-deployed');
    });

    it('merged but not deployed after 24 h stays in the notice (3.2)', () => {
        const all: Remediations = {};
        const { remediation: r } = claimRemediation(all, 'K', 's1', new Date('2026-10-20T00:00:00Z'));
        advance(r, 'fixed-in-trunk', new Date('2026-10-20T00:00:00Z'), { merge_sha: 'abc1234def' });
        expect(mergedNotDeployed(all, [finding({ key: 'K' })], new Date('2026-10-20T20:00:00Z'))).toEqual([]);
        expect(mergedNotDeployed(all, [finding({ key: 'K' })], new Date('2026-10-21T01:00:00Z'))).toEqual([{ id: 'K', mergeSha: 'abc1234def', hours: 25 }]);
    });

    it('two sessions on one finding produce one fix (3.3)', () => {
        const all: Remediations = {};
        expect(claimRemediation(all, 'K', 's1').joined).toBe(false);
        const second = claimRemediation(all, 'K', 's2');
        expect(second.joined).toBe(true);
        expect(second.remediation.owner_session).toBe('s1');
    });
});

describe('routing context from a real repository', () => {
    it('a feature branch that changes the same lockfile, and one that introduced the dependency', () => {
        const repo = path.join(tmp, 'repo');
        fs.mkdirSync(repo);
        git(repo, ['init', '-q', '-b', 'main']);
        fs.writeFileSync(path.join(repo, 'package-lock.json'), '{"packages":{"node_modules/lodash":{"version":"4.17.21"}}}\n');
        git(repo, ['add', '.']);
        git(repo, ['commit', '-qm', 'init']);
        expect(readRoutingContext(repo, finding({ package: 'lodash' }), { exec: realGitOnly }).onTrunk).toBe(true);

        git(repo, ['checkout', '-qb', 'feat/x']);
        fs.writeFileSync(path.join(repo, 'package-lock.json'), '{"packages":{"node_modules/lodash":{"version":"4.17.21"},"node_modules/fastify":{"version":"5.12.4"}}}\n');
        git(repo, ['commit', '-qam', 'add fastify']);
        const c = readRoutingContext(repo, finding(), { exec: realGitOnly });
        expect(c.onTrunk).toBe(false);
        expect(c.branchTouchesFile).toBe(true);
        expect(c.branchIntroducedDependency).toBe(true);
        expect(routeSecurityFix(c).route).toBe('current-branch');

        const lodash = readRoutingContext(repo, finding({ package: 'lodash' }), { exec: realGitOnly });
        expect(lodash.branchIntroducedDependency).toBe(false);
        expect(routeSecurityFix(lodash).route).toBe('worktree');
    });
});

/** git runs for real; gh is never reached from a test. */
function realGitOnly(cmd: string, args: string[], cwd: string): string | null {
    if (cmd !== 'git') return null;
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
        return null;
    }
}

describe('R2 review fixes (2026-10-21)', () => {
    it('#7 — a direct dependency gets a range bump, not the transitive plan', () => {
        const dir = path.join(tmp, 'direct');
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dependencies: { fastify: '^5.11.0' } }));
        const p = fixPlan(finding(), readInventory(dir).entries);
        expect(p.commands[0]).toBe('npm install fastify@^5.12.5 --save-exact=false');
    });

    it('#8 — a pin on another release line is named, never moved', () => {
        const dir = path.join(tmp, 'lines');
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM node:18.20.4-alpine\n');
        fs.writeFileSync(path.join(dir, '.nvmrc'), '22.11.0\n');
        const p = fixPlan(finding({ ecosystem: 'runtime', package: 'node', version: '22.11.0', fixed: '22.11.1' }), readInventory(dir).entries);
        expect(p.edits.map((e) => `${e.file} ${e.from}`)).toEqual(['.nvmrc 22.11.0']);
        expect(p.note).toMatch(/another release line.*Dockerfile/);
    });
});
