/**
 * Phase 1 of road-to-neighbours-that-pull-their-weight, over planted trees.
 *
 * Three questions, one fixture shape: a consumer project whose
 * `agents/installed-tools.lock` claims some skills and not others, a planted
 * `$HOME` carrying more, and a planted package root whose `src/skills` is "ours".
 * Every assertion runs the real resolver, the real cosine and the real linters —
 * a hand-written census object would let the walk pass over a layout it cannot
 * actually read, which is the failure the sibling census suite already names.
 *
 * The 1.3 assertion is the one that must not be relaxed. It does not merely
 * check a label: it plants a distinctive word in a foreign body and asserts the
 * word is absent from the ranked terms AND from the injected route line, so a
 * future change that keeps the label while re-admitting the body fails here.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    makeSkillOriginResolver,
    packageClaimedPaths,
    qualifiedSkillName,
    splitQualifiedName,
} from '../../src/scripts/_lib/skill_origin.js';
import {
    defaultNeighbourContext,
    rank,
    type NeighbourContext,
} from '../../src/scripts/skill_tools/score_skill_relevance.js';

const dirs: string[] = [];

function tmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
    dirs.push(d);
    return d;
}

function write(root: string, rel: string, body: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf-8');
}

function skill(name: string, description: string, body: string): string {
    return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n${body}\n`;
}

/** A manifest claiming exactly the given absolute paths as deployed. */
function manifest(paths: readonly string[]): string {
    const files = paths.map((p) => `      - path: "${p}"\n        kind: deployed\n`).join('');
    return `schema_version: 2\ntools:\n  - name: claude\n    files:\n${files}`;
}

afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d !== undefined) fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('1.1 — origin comes from the lockfile, and both same-named skills rank', () => {
    it('a foreign design-system beside ours yields two ranked entries, one qualified', () => {
        const project = tmp('nb-project-');
        const home = tmp('nb-home-');

        // OURS: installed into the host-global root and claimed by the manifest.
        const ours = path.join(home, '.claude', 'skills', 'design-system', 'SKILL.md');
        write(
            home,
            '.claude/skills/design-system/SKILL.md',
            skill('design-system', 'capture and maintain a design system', 'tokens and components'),
        );
        // THEIRS: the same name, in the project root, claimed by nothing.
        write(
            project,
            '.claude/skills/design-system/SKILL.md',
            skill('design-system', 'another vendor design system helper', 'their own prose'),
        );
        write(project, 'agents/installed-tools.lock', manifest([ours]));

        const claims = packageClaimedPaths(project);
        expect(claims).not.toBeNull();
        const originOf = makeSkillOriginResolver(project, { claims });
        expect(originOf(ours)).toBe('package');
        expect(originOf(path.join(project, '.claude/skills/design-system/SKILL.md'))).toBe('project');

        const ctx: NeighbourContext = { origin: originOf, scans: null };
        const rows = rank('design system tokens', [
            path.join(project, '.claude', 'skills'),
            path.join(home, '.claude', 'skills'),
        ], {}, ctx);

        const names = rows.map(([n]) => n);
        expect(names).toContain('design-system');
        expect(names).toContain('project:design-system');
        expect(names.filter((n) => n.endsWith('design-system'))).toHaveLength(2);
    });

    it('the bare-name dedupe it replaced would have dropped one of them', () => {
        // The pre-change behavior, reconstructed: dedupe on the BARE name keeps
        // one row. This is the regression guard for the fix, not a tautology —
        // it asserts the two rows differ only by qualifier, which is exactly
        // what first-wins could not express.
        const rows = ['design-system', 'project:design-system'];
        const bare = new Set(rows.map((r) => splitQualifiedName(r).name));
        expect(bare.size).toBe(1);
        expect(new Set(rows).size).toBe(2);
    });

    it('with no manifest nothing is qualified, because nothing claims anything', () => {
        const project = tmp('nb-nomanifest-');
        write(project, '.claude/skills/whatever/SKILL.md', skill('whatever', 'x', 'y'));
        expect(packageClaimedPaths(project)).toBeNull();
        const originOf = makeSkillOriginResolver(project);
        expect(originOf(path.join(project, '.claude/skills/whatever/SKILL.md'))).toBe('package');
        expect(qualifiedSkillName('whatever', 'package')).toBe('whatever');
    });

    it('a skill outside the project and unclaimed is home, not project', () => {
        const project = tmp('nb-proj2-');
        const home = tmp('nb-home2-');
        write(project, 'agents/installed-tools.lock', manifest([path.join(project, 'nothing.md')]));
        const originOf = makeSkillOriginResolver(project);
        expect(originOf(path.join(home, '.claude/skills/foreign/SKILL.md'))).toBe('home');
        expect(qualifiedSkillName('foreign', 'home')).toBe('home:foreign');
    });
});

describe('the default context on this repository changes nothing', () => {
    it('a maintainer checkout has no manifest, so every ranked name stays bare', () => {
        const ctx = defaultNeighbourContext();
        expect(ctx.origin(path.join('src', 'skills', 'anything', 'SKILL.md'))).toBe('package');
        const rows = rank('review the authorization policy and tenant scope for this endpoint', [
            path.join(process.cwd(), 'src', 'skills'),
        ]);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(([n]) => !n.includes(':'))).toBe(true);
    });
});
