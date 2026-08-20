// Emission side of the single-delivery partition — ADR-236 step 2.1.
//
// The unit tests in `single_delivery_partition.test.ts` pin the predicate. This
// file pins what the generators actually leave ON DISK, because the two came
// apart once and the gap was invisible from the counters:
//
// A partitioned run reported `skills=0 commands=0` while **eight symlinks were
// still in `.claude/skills/`** — `brand`, `brand-identity`, `brand-strategy`,
// `design-system-capture`, `estimate-ticket`, `refine-ticket`, `review-routing`,
// `upstream-contribute`. Every one of them is a skill whose name is also a
// command slug, and each prune declined to touch it for a different reason: the
// skill prune protects command slugs (so the command generator, which runs after
// it into the same directory, does not lose entries it is about to write), and
// the command prune skips symlinks by construction. Under a partition both
// generators write nothing, so the protection protects nothing and the symlinks
// were unreachable from both sides.
//
// The counters said zero. The directory said eight. That is why this file asserts
// the directory.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fingerprintLayers } from '../../src/install/hostLayerFingerprint.js';
import { write_lockfile } from '../../src/scripts/_lib/installed_lock.js';
import {
    MODULE_STATE,
    _getStateForTest,
    _resetStateForTest,
    _resetPartitionVerdictForTest,
    generate_claude_commands,
    generate_claude_skills,
} from '../../src/scripts/condense.js';

const SKILL_WITH_COMMAND_NAME = 'estimate-ticket';
/**
 * The tmp project's own version. Not read from the real `package.json`: the
 * predicate resolves the building version from `MODULE_STATE.PROJECT_ROOT`, so a
 * fixture that borrowed the repo's version would silently compare 14.6.0 against
 * `0.0.0` and land in `standalone/full` for the wrong reason — which is exactly
 * how this test first failed.
 */
const FIXTURE_VERSION = '9.9.9';
const PLAIN_SKILL = 'plain-skill';

let tmp: string;
let saved: ReturnType<typeof _getStateForTest>;
let savedHome: string | undefined;
let savedLock: string | undefined;

/** A tmp project root carrying one plain skill, one skill that shadows a command slug, and that command. */
function seedProject(root: string): void {
    for (const name of [PLAIN_SKILL, SKILL_WITH_COMMAND_NAME]) {
        const dir = path.join(root, 'dist', 'agent-src', 'skills', name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\nbody\n`, 'utf-8');
    }
    fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ name: 'fixture', version: FIXTURE_VERSION }),
        'utf-8',
    );
    const cmdDir = path.join(root, 'src', 'domains', 'core', SKILL_WITH_COMMAND_NAME);
    fs.mkdirSync(cmdDir, { recursive: true });
    fs.writeFileSync(path.join(cmdDir, 'command.md'), '---\nname: x\n---\nbody\n', 'utf-8');
    fs.mkdirSync(path.join(root, '.claude', 'skills'), { recursive: true });
}

/** Point HOME at a host layer whose fingerprint the lockfile records — or does not. */
function seedHost(home: string, verified: boolean): void {
    const layers = ['rules', 'skills', 'commands'].map((label) => ({
        label,
        root: path.join(home, '.claude', label),
    }));
    if (!verified) {
        return; // no host layer at all → standalone/full
    }
    for (const l of layers) {
        fs.mkdirSync(l.root, { recursive: true });
    }
    fs.writeFileSync(path.join(layers[0]!.root, 'demo.md'), 'demo\n', 'utf-8');
    write_lockfile(FIXTURE_VERSION, ['claude-code'], {
        path: process.env['AGENT_CONFIG_INSTALLED_LOCK'] as string,
        host_layer_fingerprint: fingerprintLayers(layers),
    });
}

function projectSkillDirEntries(): string[] {
    const dir = MODULE_STATE.CLAUDE_SKILLS_DIR;
    return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
}

beforeEach(() => {
    saved = _getStateForTest();
    savedHome = process.env['HOME'];
    savedLock = process.env['AGENT_CONFIG_INSTALLED_LOCK'];
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-emit-'));
    _resetPartitionVerdictForTest();
});

afterEach(() => {
    _resetStateForTest(saved.PROJECT_ROOT);
    _resetPartitionVerdictForTest();
    if (savedHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = savedHome;
    if (savedLock === undefined) delete process.env['AGENT_CONFIG_INSTALLED_LOCK'];
    else process.env['AGENT_CONFIG_INSTALLED_LOCK'] = savedLock;
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('project-layer emission under the partition', () => {
    /**
     * One project root, generated repeatedly. The shared root is the whole
     * point: the leak this file exists for is a **transition** failure — a
     * symlink written by a full run that a later partitioned run fails to
     * remove. A fixture that re-seeded a fresh root per mode had nothing left
     * over to fail on, so it passed with the fix reverted and proved nothing.
     */
    let projectRoot: string;
    let home: string;

    beforeEach(() => {
        projectRoot = path.join(tmp, 'project');
        home = path.join(tmp, 'home');
        fs.mkdirSync(home, { recursive: true });
        seedProject(projectRoot);
        _resetStateForTest(projectRoot);
        process.env['HOME'] = home;
        process.env['AGENT_CONFIG_INSTALLED_LOCK'] = path.join(home, 'installed.lock');
    });

    function generate(verified: boolean): { skills: number; commands: number; onDisk: string[] } {
        // The host layer is (re)built per generation so the same root can move
        // between modes, which is what a machine does when it installs.
        fs.rmSync(path.join(home, '.claude'), { recursive: true, force: true });
        fs.rmSync(path.join(home, 'installed.lock'), { force: true });
        seedHost(home, verified);
        _resetPartitionVerdictForTest();
        const skills = generate_claude_skills(null);
        const commands = generate_claude_commands(null);
        return { skills, commands, onDisk: projectSkillDirEntries() };
    }

    it('standalone/full emits both skills and the command entry', () => {
        const r = generate(false);
        expect(r.skills).toBe(2);
        expect(r.onDisk).toContain(PLAIN_SKILL);
        expect(r.onDisk).toContain(SKILL_WITH_COMMAND_NAME);
    });

    it('a fresh partitioned run leaves the directory EMPTY, not merely the counters at zero', () => {
        const r = generate(true);
        expect(r.skills).toBe(0);
        expect(r.commands).toBe(0);
        expect(r.onDisk).toEqual([]);
    });

    it('full → partitioned CLEARS what the full run wrote, including a skill that shadows a command slug', () => {
        const full = generate(false);
        expect(full.onDisk).toContain(SKILL_WITH_COMMAND_NAME);

        const partitioned = generate(true);
        expect(partitioned.skills).toBe(0);
        expect(partitioned.commands).toBe(0);
        // This is the assertion the counters could not make. With the
        // command-slug protection left unconditional, `estimate-ticket` survived
        // here while both counters read zero.
        expect(partitioned.onDisk).toEqual([]);
    });

    it('partitioned → full restores the full set, so the partition is not a one-way door', () => {
        generate(true);
        const back = generate(false);
        expect(back.skills).toBe(2);
        expect(back.onDisk).toContain(PLAIN_SKILL);
        expect(back.onDisk).toContain(SKILL_WITH_COMMAND_NAME);
    });
});
