import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { applyCodexResidentSet } from '../../src/scripts/_lib/codex_resident_set.js';
import { recordDeployedSkills } from '../_lib/codex_inventory.js';
import { FINDER_NAME } from '../../src/scripts/_lib/codex_skill_finder.js';
import {
    checkSkillReach,
    classifySkillReach,
    frontmatterKeys,
    loadHostKeys,
    reachCensus,
    renderReach,
} from '../../src/scripts/_lib/skill_reach.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOST_KEYS = loadHostKeys(REPO_ROOT);

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function scratch(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-reach-'));
    tmp.push(d);
    return d;
}

function skill(root: string, name: string, extra = ''): void {
    fs.mkdirSync(path.join(root, name), { recursive: true });
    fs.writeFileSync(
        path.join(root, name, 'SKILL.md'),
        `---\nname: ${name}\ndescription: fixture ${name}\n${extra}---\n\n# ${name}\n`,
    );
}

/** Six skills, one per bucket the fixture can reach with the shell path on. */
function fixture(): { projection: string; home: string } {
    const base = scratch();
    const projection = path.join(base, 'dist', 'agent-src', 'skills');
    const home = path.join(base, 'home');
    const hostRoot = path.join(home, '.claude', 'skills');
    skill(projection, 'plain');
    skill(projection, 'with-effort', 'effort: high\n');
    skill(projection, 'command-and-flow', 'execution:\n  type: assisted\nrequires_skills:\n  - plain\n');
    for (const n of ['listed', 'named', 'hidden']) {
        skill(projection, n);
        skill(hostRoot, n);
    }
    fs.writeFileSync(
        path.join(home, '.claude', 'settings.json'),
        JSON.stringify({ skillOverrides: { named: 'name-only', hidden: 'off' } }),
    );
    return { projection, home };
}

describe('skill reach (road-to-skills-that-arrive-when-called 2.2)', () => {
    it('partitions a fixture into six buckets that sum to the authored count', () => {
        const { projection, home } = fixture();
        const c = reachCensus({
            projectionRoot: projection,
            hostRoot: path.join(home, '.claude', 'skills'),
            settingsPath: path.join(home, '.claude', 'settings.json'),
            hostKeys: HOST_KEYS,
            mcp: false,
        });
        expect(c.counts).toEqual({
            described: 1,
            'name-only': 1,
            unlisted: 1,
            'reachable-not-installed': 2,
            degraded: 1,
            unreachable: 0,
        });
        expect(c.installed).toBe(3);
        expect(c.sums).toBe(true);
        expect(renderReach(c, '~/.claude/skills')).toMatchInlineSnapshot(
            `"claude-code (~/.claude/skills): installed 3 (described 1 · name-only 1 · unlisted 1) · reachable-not-installed 2 · degraded 1 · unreachable 0 — of 6 authored"`,
        );
    });

    it('on the real projection with an empty home, every bucket sums to the authored count', () => {
        const home = scratch();
        const check = checkSkillReach({ home, packageRoot: REPO_ROOT });
        const authored = fs
            .readdirSync(path.join(REPO_ROOT, 'dist', 'agent-src', 'skills'))
            .filter((n) => fs.existsSync(path.join(REPO_ROOT, 'dist', 'agent-src', 'skills', n, 'SKILL.md'))).length;
        expect(check.status).toBe('ok');
        expect(check.message).toContain(`installed 0 (`);
        expect(check.message).toContain(`of ${authored} authored`);
        const nums = [...check.message.matchAll(/(?:reachable-not-installed|degraded|unreachable) (\d+)/g)].map((m) =>
            Number(m[1]),
        );
        expect(nums.reduce((a, b) => a + b, 0)).toBe(authored);
    });

    it('skips when the package carries no projection', () => {
        expect(checkSkillReach({ home: scratch(), packageRoot: scratch() }).status).toBe('skipped');
    });

    it('a host with no key-list row is an error, never an empty set that reads as reach', () => {
        expect(() => loadHostKeys(REPO_ROOT, 'no-such-host')).toThrow(/no row for host no-such-host/);
        const pkg = scratch();
        fs.mkdirSync(path.join(pkg, 'dist', 'agent-src', 'skills', 'a'), { recursive: true });
        fs.writeFileSync(path.join(pkg, 'dist', 'agent-src', 'skills', 'a', 'SKILL.md'), '---\nname: a\n---\n');
        const check = checkSkillReach({ home: scratch(), packageRoot: pkg });
        expect(check.status).toBe('skipped');
        expect(check.message).toContain('host skill-key list unusable');
    });
});

describe('degraded is never called reach (2.3)', () => {
    const cmdAndFlow = frontmatterKeys(
        '---\nname: x\ndescription: y\nexecution:\n  type: assisted\nrequires_skills:\n  - z\n---\n',
    );

    it('a skill with a command and a flow, read through MCP only, is degraded', () => {
        expect(classifySkillReach({ keys: cmdAndFlow, installed: false }, { shell: false, mcp: true }, HOST_KEYS)).toBe(
            'degraded',
        );
    });

    it('a skill MCP carries whole is reachable through MCP', () => {
        expect(
            classifySkillReach({ keys: ['name', 'description'], installed: false }, { shell: false, mcp: true }, HOST_KEYS),
        ).toBe('reachable-not-installed');
    });

    it('a host-applied key makes the text read degraded, a package key does not', () => {
        const paths = { shell: true, mcp: false };
        expect(classifySkillReach({ keys: ['name', 'effort'], installed: false }, paths, HOST_KEYS)).toBe('degraded');
        expect(classifySkillReach({ keys: cmdAndFlow, installed: false }, paths, HOST_KEYS)).toBe(
            'reachable-not-installed',
        );
    });

    it('no path is unreachable, never reachable', () => {
        expect(classifySkillReach({ keys: ['name'], installed: false }, { shell: false, mcp: false }, HOST_KEYS)).toBe(
            'unreachable',
        );
    });
});

describe('second host: an unlisted skill is reached only through the finder (second-host-unlisted-reachability)', () => {
    const paths = { shell: true, mcp: false };
    const SPEC_KEYS = loadHostKeys(REPO_ROOT, 'agent-skills-spec');

    it('unlisted with no route stays unlisted; routed, it is classified by the path rule', () => {
        const base = { keys: ['name', 'description'], installed: true, override: 'off' };
        expect(classifySkillReach(base, paths, SPEC_KEYS)).toBe('unlisted');
        expect(classifySkillReach({ ...base, routed: true }, paths, SPEC_KEYS)).toBe('reachable-not-installed');
        expect(classifySkillReach({ ...base, keys: ['name', 'allowed-tools'], routed: true }, paths, SPEC_KEYS)).toBe(
            'degraded',
        );
    });

    it('a routed skill whose declared dependency is missing is degraded, never reach', () => {
        expect(
            classifySkillReach(
                { keys: ['name'], installed: true, override: 'off', routed: true, missingDeps: true },
                paths,
                SPEC_KEYS,
            ),
        ).toBe('degraded');
    });

    it('the doctor row counts zero unlisted when the finder routes every one, and warns when it does not', () => {
        const base = scratch();
        const pkg = path.join(base, 'pkg');
        const projection = path.join(pkg, 'dist', 'agent-src', 'skills');
        const home = path.join(base, 'home');
        const codex = path.join(home, '.codex', 'skills');
        fs.mkdirSync(path.join(pkg, 'src', 'config'), { recursive: true });
        fs.copyFileSync(
            path.join(REPO_ROOT, 'src', 'config', 'host-skill-frontmatter-keys.json'),
            path.join(pkg, 'src', 'config', 'host-skill-frontmatter-keys.json'),
        );
        for (let i = 0; i < 80; i++) {
            const n = `s-${String(i).padStart(3, '0')}`;
            for (const root of [projection, codex]) {
                fs.mkdirSync(path.join(root, n), { recursive: true });
                fs.writeFileSync(
                    path.join(root, n, 'SKILL.md'),
                    `---\nname: ${n}\ndescription: ${'d'.repeat(150)}\n---\n\nbody\n`,
                );
            }
        }
        const saved = process.env['EVENT4U_CONFIG_HOME'];
        process.env['EVENT4U_CONFIG_HOME'] = path.join(home, '.event4u', 'agent-config');
        try {
            recordDeployedSkills(
                home,
                'codex',
                '~/.codex/',
                Array.from({ length: 80 }, (_, i) => `s-${String(i).padStart(3, '0')}`),
            );
            applyCodexResidentSet(home, () => undefined);
            const ok = checkSkillReach({ home, packageRoot: pkg });
            expect(ok.message).toMatch(/codex \(~\/\.codex\/skills\): installed \d+ \(described \d+ · name-only 0 · unlisted 0\)/);
            expect(ok.status).toBe('ok');

            fs.rmSync(path.join(codex, FINDER_NAME), { recursive: true, force: true });
            const bad = checkSkillReach({ home, packageRoot: pkg });
            expect(bad.status).toBe('warn');
            expect(bad.message).toContain('unreachable skills on codex');
        } finally {
            if (saved === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
            else process.env['EVENT4U_CONFIG_HOME'] = saved;
        }
    });
});
