import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

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
