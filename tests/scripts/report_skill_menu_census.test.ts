// Unit tests for the skill-menu census (`src/scripts/report_skill_menu_census.ts`
// — road-to-skill-menu-economy step 1.1). Every expectation is derived from the
// fixture constants below rather than copied from a real run, so a change in the
// live corpus cannot make a stale number pass.
//
// The classifier is the whole content of that report, and two of its properties
// are the ones a reviewer would doubt: that a bare skill name in ordinary prose
// is NOT read as a command reference, and that a flow's YAML `skills:` list IS
// read as a flow reference. Both are asserted in the failing direction as well
// as the passing one — the flow parser exists because the first pass returned a
// false zero, and a test that only proves the fix works cannot notice it
// regressing to that zero.
import { describe, expect, it } from 'vitest';

import {
    classify,
    flowSkillNames,
    menuFlags,
    referenceRe,
    tally,
    type SkillRow,
} from '../../src/scripts/report_skill_menu_census.js';

describe('referenceRe — disambiguating shapes only', () => {
    it('matches the three declared shapes', () => {
        const re = referenceRe('code-review');
        expect(re.test('route through skill:code-review here')).toBe(true);
        expect(re.test('see src/skills/code-review/SKILL.md')).toBe(true);
        expect(re.test('the `code-review` skill')).toBe(true);
    });

    it('does NOT match a bare name in prose — the reason a word-boundary match was rejected', () => {
        // `security`, `database` and `docker` are real skill names AND ordinary
        // English. A word-boundary matcher would count every prose mention as an
        // entry path and report near-100% command coverage.
        expect(referenceRe('security').test('run a security pass over the diff')).toBe(false);
        expect(referenceRe('database').test('the database is migrated first')).toBe(false);
        expect(referenceRe('docker').test('start docker before the suite')).toBe(false);
    });

    it('does not let one skill name match a longer sibling, in ANY of the three shapes', () => {
        // `skill:<name>\b` was the first form and it was wrong: the word boundary
        // between `w` and `-` made `skill:code-review-lens` a hit for `code-review`,
        // so a skill would have inherited its longer sibling's references. Found by
        // probing the regex directly rather than by a run, and pinned here in all
        // three shapes so the narrow fix cannot be undone by widening one of them.
        expect(referenceRe('code-review').test('the `code-review-lens` skill')).toBe(false);
        expect(referenceRe('code-review').test('route to skill:code-review-lens now')).toBe(false);
        expect(referenceRe('code-review').test('see src/skills/code-review-lens/SKILL.md')).toBe(false);
    });
});

describe('flowSkillNames — YAML lists, not the command shapes', () => {
    it('reads an inline list', () => {
        const names = flowSkillNames('  - title: x\n    skills: [code-review, adversarial-review]\n');
        expect([...names].sort()).toEqual(['adversarial-review', 'code-review']);
    });

    it('reads a block sequence', () => {
        const names = flowSkillNames('skills:\n  - alpha\n  - beta\nother: 1\n');
        expect([...names].sort()).toEqual(['alpha', 'beta']);
    });

    it('stops at the end of the block and ignores unrelated lists', () => {
        const names = flowSkillNames('commands:\n  - not-a-skill\nskills:\n  - alpha\n');
        expect(names.has('not-a-skill')).toBe(false);
        expect(names.has('alpha')).toBe(true);
    });

    it('the command regex would have found nothing here — the false zero, pinned', () => {
        const flow = '    skills: [code-review, adversarial-review]\n';
        expect(referenceRe('code-review').test(flow)).toBe(false);
        expect(flowSkillNames(flow).has('code-review')).toBe(true);
    });
});

describe('menuFlags', () => {
    it('reads both menu-economy keys, and defaults to absent', () => {
        expect(menuFlags('---\nname: x\n---\n')).toEqual({ userInvocable: null, disableModel: null });
        expect(menuFlags('---\nuser-invocable: false\n---\n').userInvocable).toBe(false);
        expect(menuFlags('---\ndisable-model-invocation: true\n---\n').disableModel).toBe(true);
    });
});

describe('classify — total, and orphan only when nothing reaches the skill', () => {
    it('assigns one label per signal combination', () => {
        expect(classify(1, 1, true)).toBe('both');
        expect(classify(2, 0, true)).toBe('command-only');
        expect(classify(0, 3, true)).toBe('flow-only');
        expect(classify(0, 0, true)).toBe('model-routed');
        expect(classify(0, 0, false)).toBe('orphan');
    });

    it('a referenced skill is never an orphan even when it is off the menu', () => {
        expect(classify(1, 0, false)).toBe('command-only');
        expect(classify(0, 1, false)).toBe('flow-only');
    });
});

describe('tally reconciles to the row count', () => {
    it('sums to the number of rows', () => {
        const row = (name: string, c: number, f: number, menu: boolean): SkillRow => ({
            name,
            commandRefs: c,
            flowRefs: f,
            menuPresent: menu,
            hasTriggerCorpus: false,
            entryPath: classify(c, f, menu),
            firstRef: '',
        });
        const rows = [row('a', 1, 1, true), row('b', 1, 0, true), row('c', 0, 1, true), row('d', 0, 0, true), row('e', 0, 0, false)];
        const t = tally(rows);
        expect(t.both + t['command-only'] + t['flow-only'] + t['model-routed'] + t.orphan).toBe(rows.length);
        expect(t).toEqual({ both: 1, 'command-only': 1, 'flow-only': 1, 'model-routed': 1, orphan: 1 });
    });
});

// The per-profile menu arm. Its answer is that all three profiles are equal, and
// an equal number is exactly the shape that could also be produced by a stub —
// so the tests below pin the computation rather than the result: a preset whose
// keys differ still reads its own file, a skill off the menu contributes nothing,
// and the equality note appears only when the numbers are in fact equal.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach } from 'vitest';

import {
    PROFILES,
    frontmatterDescription,
    menuForProfile,
    readProfileIni,
    renderProfileMenus,
    type ProfileMenu,
} from '../../src/scripts/report_skill_menu_census.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let profRoot: string;

function put(rel: string, body: string): void {
    const p = path.join(profRoot, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

beforeEach(() => {
    profRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-prof-'));
    for (const p of PROFILES) put(`src/config/profiles/${p}.ini`, `; comment\n\nrule_loading_tier=${p}\n`);
});
afterEach(() => {
    fs.rmSync(profRoot, { recursive: true, force: true });
});

describe('readProfileIni', () => {
    it('drops comments, blanks and section headers, keeps key=value', () => {
        put('src/config/profiles/minimal.ini', '; note\n# hash\n[section]\n\na=1\nb = two \nnoequals\n');
        expect(readProfileIni(profRoot, 'minimal')).toEqual({ a: '1', b: 'two' });
    });

    it('reads each profile its OWN file — a shared answer must not come from a shared read', () => {
        // If the three numbers below are ever equal, this is the test that says
        // they were computed three times rather than once and copied.
        expect(readProfileIni(profRoot, 'minimal')['rule_loading_tier']).toBe('minimal');
        expect(readProfileIni(profRoot, 'full')['rule_loading_tier']).toBe('full');
    });
});

describe('frontmatterDescription', () => {
    it('joins a folded multi-line description', () => {
        const text = '---\nname: x\ndescription: first part\n  second part\npacks:\n  - meta\n---\n\nbody\n';
        expect(frontmatterDescription(text)).toBe('first part second part');
    });

    it('stops at the next top-level key, so a following key is never absorbed', () => {
        const text = '---\ndescription: only this\nname: x\n---\n';
        expect(frontmatterDescription(text)).toBe('only this');
    });

    it('returns empty for a file with no frontmatter at all', () => {
        expect(frontmatterDescription('# just a heading\n')).toBe('');
    });
});

describe('menuForProfile', () => {
    const skill = (name: string, extra: string, description = 'A description.'): void =>
        put(`src/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${description}\n${extra}---\n`);

    it('counts the catalogue line shape, name and description included', () => {
        skill('alpha', '');
        const m = menuForProfile(profRoot, 'minimal');
        expect(m.menuSkills).toBe(1);
        expect(m.menuBytes).toBe('- alpha: A description.\n'.length);
        expect(m.tokensEstimate).toBe(Math.round(m.menuBytes / 4));
    });

    it('drops a skill the model may not pick — both flags, and only those', () => {
        skill('alpha', '');
        skill('hidden-a', 'user-invocable: false\n');
        skill('hidden-b', 'disable-model-invocation: true\n');
        expect(menuForProfile(profRoot, 'minimal').menuSkills).toBe(1);
    });

    it('reports a declared catalogue-token figure when the preset carries one, else null', () => {
        skill('alpha', '');
        expect(menuForProfile(profRoot, 'minimal').declaredCatalogueTokens).toBeNull();
        put('src/config/profiles/minimal.ini', 'declared_skill_catalogue_tokens=4242\n');
        expect(menuForProfile(profRoot, 'minimal').declaredCatalogueTokens).toBe(4242);
    });

    it('names a declared skill-selecting key rather than swallowing it', () => {
        // The tripwire's only job. It cannot change the byte count — nothing
        // here knows what such a key would mean — so what it must do is make
        // the key visible and withhold the equality note. A version that
        // computed `selectingKeys` and never read it would pass a test that
        // only asserted the empty case.
        skill('alpha', '');
        put('src/config/profiles/minimal.ini', 'pretend_selector=packs\n');
        const withKey: ProfileMenu = { ...menuForProfile(profRoot, 'minimal'), selectingKeys: ['pretend_selector'] };
        const lines = renderProfileMenus([withKey, menuForProfile(profRoot, 'full')]);
        expect(lines.join('\n')).toContain('pretend_selector');
        expect(lines.join('\n')).not.toContain('SAME menu_bytes');
    });
});

describe('the SHIPPED presets, not a fixture', () => {
    it('PROFILES names every preset file that exists — a fourth would be uncovered in silence', () => {
        const dir = path.join(REPO_ROOT, 'src', 'config', 'profiles');
        const onDisk = fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.ini'))
            .map((f) => f.replace(/\.ini$/u, ''))
            .sort();
        expect(onDisk).toEqual([...PROFILES].sort());
    });

    it('no shipped preset declares a skill-selecting key — this is what the fixture test cannot say', () => {
        for (const p of PROFILES) expect(menuForProfile(REPO_ROOT, p).selectingKeys).toEqual([]);
    });

    it('decodes an escaped quote in a description instead of counting the backslash', () => {
        expect(frontmatterDescription('---\ndescription: "say \\"hi\\" now"\n---\n')).toBe('say "hi" now');
    });
});

describe('renderProfileMenus', () => {
    const menu = (profile: ProfileMenu['profile'], menuBytes: number): ProfileMenu => ({
        profile,
        menuSkills: 1,
        menuBytes,
        tokensEstimate: Math.round(menuBytes / 4),
        declaredCatalogueTokens: null,
        selectingKeys: [],
    });

    it('explains the equality when every profile reports the same bytes', () => {
        const lines = renderProfileMenus([menu('minimal', 100), menu('balanced', 100), menu('full', 100)]);
        expect(lines.join('\n')).toContain('SAME menu_bytes');
    });

    it('stays silent about equality when the numbers differ — the note is a finding, not a fixture', () => {
        const lines = renderProfileMenus([menu('minimal', 100), menu('balanced', 101), menu('full', 100)]);
        expect(lines.join('\n')).not.toContain('SAME menu_bytes');
    });

    it('says nothing about equality for a single profile, where there is nothing to compare', () => {
        expect(renderProfileMenus([menu('minimal', 100)]).join('\n')).not.toContain('SAME menu_bytes');
    });
});

describe('the profile CLI', () => {
    const run = (args: string[]): { status: number; out: string } => {
        try {
            const out = execFileSync('./scripts-run', ['src/scripts/report_skill_menu_census', ...args], {
                cwd: REPO_ROOT,
                encoding: 'utf-8',
            });
            return { status: 0, out };
        } catch (e) {
            const err = e as { status?: number; stdout?: string; stderr?: string };
            return { status: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
        }
    };

    it('refuses --profile together with --emit rather than skipping the write', () => {
        const r = run(['--profile', 'all', '--emit']);
        expect(r.status).toBe(2);
        expect(r.out).toContain('separate runs');
    });

    it('refuses an unknown profile rather than falling back to all', () => {
        const r = run(['--profile', 'enterprise']);
        expect(r.status).toBe(2);
        expect(r.out).toContain('--profile expects');
    });

    it('prints one row per shipped profile under --profile all', () => {
        const r = run(['--profile', 'all']);
        expect(r.status).toBe(0);
        for (const p of PROFILES) expect(r.out).toContain(p);
    });
});
