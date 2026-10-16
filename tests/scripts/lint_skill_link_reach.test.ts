/**
 * `lint_skill_link_reach` — a relative link in a delivered skill resolves
 * against the file that carries it.
 *
 * The defect it closes (road-to-steps-the-skill-cannot-skip 1.1): the gate read
 * only `SKILL.md` and only the `](../<slug>/SKILL.md` shape, so a link inside
 * `references/a.md` that is one `../` short, and a `SKILL.md` link to a deleted
 * `references/` file, both passed. Both directions are pinned: the broken
 * fixture must FAIL, and the same fixture with its links repaired must PASS.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DELIVERED_SKILLS_ROOT, main, run, SIBLING_LINK_CEILING } from '../../src/scripts/lint_skill_link_reach.js';

let tmp: string;

function write(rel: string, body: string): void {
    const file = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, 'utf-8');
}

function skill(slug: string, rel: string, body: string): void {
    write(path.join(DELIVERED_SKILLS_ROOT, slug, rel), body);
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'link-reach-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('lint_skill_link_reach', () => {
    it('reference-depth: a reference link one ../ short and a SKILL.md link to a missing reference both fail', () => {
        skill('a', 'SKILL.md', 'see [gone](references/missing.md)\n');
        skill('a', 'references/a.md', 'see [b](../b/SKILL.md)\n');
        skill('b', 'SKILL.md', 'body\n');

        expect(main(['--root', tmp, '--quiet'])).toBe(1);
        const report = run(tmp);
        const targets = report.unresolvedFiles.map((u) => `${u.file} → ${u.target}`).sort();
        expect(targets).toEqual(['a/SKILL.md → references/missing.md', 'a/references/a.md → ../b/SKILL.md']);
    });

    it('reference-depth: the same fixture with its links repaired passes', () => {
        skill('a', 'SKILL.md', 'see [present](references/a.md)\n');
        skill('a', 'references/a.md', 'see [b](../../b/SKILL.md#anchor) and [rule](../../../rules/r.md)\n');
        skill('b', 'SKILL.md', 'body\n');
        write('dist/agent-src/rules/r.md', 'rule\n');

        expect(main(['--root', tmp, '--quiet'])).toBe(0);
    });

    it('reference-depth: docs links are a reported class, and fenced, inline-code and placeholder links are not links', () => {
        skill(
            'a',
            'references/a.md',
            [
                'contract: [c](../../../docs/contracts/c.md)',
                'template: [p](archive/<parent-slug>.md)',
                'inline: `[x](../nowhere.md)`',
                '```',
                '[y](../nowhere.md)',
                '```',
                '',
            ].join('\n'),
        );
        skill('a', 'SKILL.md', 'body\n');

        expect(main(['--root', tmp, '--quiet'])).toBe(0);
        const report = run(tmp);
        expect(report.unresolvedFiles).toEqual([]);
        expect(report.docsLinks).toBe(1);
    });

    it('sibling-ratchet: a reference linking a sibling reference counts, and a count above the ceiling fails', () => {
        skill('a', 'SKILL.md', 'see [one](references/one.md) and [two](references/two.md)\n');
        skill('a', 'references/one.md', 'see [two](two.md#part) and [self](one.md#top) and [b](../../b/SKILL.md)\n');
        skill('a', 'references/two.md', 'body\n');
        skill('b', 'SKILL.md', 'body\n');

        const report = run(tmp);
        expect(report.siblingLinks).toEqual([{ file: 'a/references/one.md', target: 'two.md#part' }]);
        expect(main(['--root', tmp, '--quiet', '--sibling-ceiling', '1'])).toBe(0);
        expect(main(['--root', tmp, '--quiet', '--sibling-ceiling', '0'])).toBe(1);
    });

    it('sibling-ratchet: the real tree sits exactly at the recorded ceiling', () => {
        const report = run(path.resolve(import.meta.dirname, '..', '..'));
        expect(report.siblingLinks.length).toBe(SIBLING_LINK_CEILING);
    });
});
