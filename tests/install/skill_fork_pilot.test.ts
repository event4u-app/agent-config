/**
 * road-to-skills-that-arrive-when-called 3.2 — the fork pilot's mechanism.
 *
 * The pilot's RESULT lives in its pre-registration and result documents; this
 * file pins the parts a test can hold: the set is legal under D2, the render
 * writes the host's key without rewriting a value already there, and no
 * install path calls it.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    hasForkContext,
    outputShapeOf,
    pilotProblems,
    readForkPilot,
    readOutputShape,
    renderForkContext,
} from '../../src/scripts/_lib/skill_fork_pilot.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

describe('the pilot set is legal', () => {
    it('is at most five report skills on the one host that documents the key', () => {
        const cfg = readForkPilot(REPO_ROOT);
        const shape = readOutputShape(REPO_ROOT);
        expect(pilotProblems(cfg, shape)).toEqual([]);
        expect(cfg.names).toHaveLength(5);
        expect(cfg.hosts).toEqual(['claude-code']);
        for (const n of cfg.names) expect(outputShapeOf(shape, n)).toBe('report');
    });

    it('holds the sixth sibling out, so the pilot has an untouched comparison', () => {
        const cfg = readForkPilot(REPO_ROOT);
        expect(cfg.names).not.toContain('universal-project-analysis');
        expect(outputShapeOf(readOutputShape(REPO_ROOT), 'universal-project-analysis')).toBe('report');
    });

    it('rejects a standing skill, an oversized set and a host without the key', () => {
        const shape = readOutputShape(REPO_ROOT);
        const standing = Object.keys(shape).find((k) => shape[k] === 'standing')!;
        expect(pilotProblems({ status: 'pilot', max_names: 5, names: [standing], hosts: [] }, shape))
            .toEqual([{ name: standing, message: 'not classified `report` — D2 allows only report skills to fork' }]);
        expect(pilotProblems({ status: 'pilot', max_names: 1, names: ['a', 'b'], hosts: [] }, shape)
            .some((p) => p.message.includes('exceeds max_names'))).toBe(true);
        expect(pilotProblems({ status: 'pilot', max_names: 5, names: [], hosts: ['codex'] }, shape))
            .toEqual([{ name: 'codex', message: 'host does not document a `context` key' }]);
    });

    it('a missing or non-integer cap is a problem, never a pass', () => {
        for (const cap of [Number.NaN, 1.5, -1]) {
            expect(pilotProblems({ status: 'pilot', max_names: cap, names: [], hosts: [] }, {})
                .some((p) => p.message.includes('max_names is not'))).toBe(true);
        }
    });

    it('treats a name the shape file does not carry as standing', () => {
        expect(outputShapeOf({}, 'no-such-skill')).toBe('standing');
    });
});

describe('the render writes the host key, once', () => {
    const md = '---\nname: x\ndescription: d\n---\n\nbody\n';

    it('adds `context: fork` to the frontmatter and leaves the body alone', () => {
        const out = renderForkContext(md);
        expect(hasForkContext(out)).toBe(true);
        expect(out).toContain('name: x');
        expect(out.split('---\n')[2]).toBe('\nbody\n');
    });

    it('is idempotent', () => {
        expect(renderForkContext(renderForkContext(md))).toBe(renderForkContext(md));
    });

    it('never rewrites a `context:` the document already carries', () => {
        const existing = '---\nname: x\ncontext: something-else\n---\n\nbody\n';
        expect(renderForkContext(existing)).toBe(existing);
    });

    it('does not end the frontmatter at a `----` or `--- x` line inside it', () => {
        const tricky = '---\nname: x\nnote: |\n----\n--- x\ndescription: d\n---\n\nbody\n';
        const out = renderForkContext(tricky);
        expect(out).toBe('---\nname: x\nnote: |\n----\n--- x\ndescription: d\ncontext: fork\n---\n\nbody\n');
    });

    it('leaves a document without frontmatter untouched', () => {
        expect(renderForkContext('no frontmatter here\n')).toBe('no frontmatter here\n');
    });

    it('does not claim a fork on a document that has none', () => {
        expect(hasForkContext(md)).toBe(false);
    });
});

describe('the pilot ships to nobody yet', () => {
    it('is called by no install path — 3.3 poses widening, it does not take it', () => {
        const callers: string[] = [];
        const walk = (dir: string): void => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) {
                    walk(p);
                } else if (e.isFile() && p.endsWith('.ts') && !p.endsWith('skill_fork_pilot.ts')) {
                    if (fs.readFileSync(p, 'utf-8').includes('renderForkContext')) callers.push(p);
                }
            }
        };
        walk(path.join(REPO_ROOT, 'src'));
        expect(callers).toEqual([]);
    });

    it('writes no `context:` into any authored SKILL.md — 1.2 forbids the collision', () => {
        const skills = path.join(REPO_ROOT, 'src', 'skills');
        const offenders: string[] = [];
        for (const name of fs.readdirSync(skills)) {
            const md = path.join(skills, name, 'SKILL.md');
            if (!fs.existsSync(md)) continue;
            const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(md, 'utf-8'));
            if (fm && /^context:[ \t]/m.test(fm[1]!)) offenders.push(name);
        }
        expect(offenders).toEqual([]);
    });
});
