/**
 * `discipline_profile` selects which rules a consumer install writes.
 *
 * Before this, the key was rendered into the settings file and read by nothing,
 * so `essential` and `full` installed the same rule set. An explicit `essential`
 * or `off` now narrows the rules tree to the profile's set from
 * `dist/router.json`; `full`, `auto`, `custom` and an absent key keep shipping
 * everything until the default is re-measured.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { LEGACY_ALL, ruleFileArrives, ruleScopeFromSettings } from '../../src/install/rule_scope.js';
import { DISCIPLINE_PROFILE_RULES } from '../../src/shared/disciplineProfiles.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIST_RULES = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');
const ROUTER = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'dist', 'router.json'), 'utf-8')) as {
    kernel: string[];
    profiles: Record<string, string[]>;
};

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'discipline-profile-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

function fixture(name: string, type: 'always' | 'auto'): string {
    const p = path.join(TMP, name);
    fs.writeFileSync(p, `---\ntype: "${type}"\ndescription: "fixture"\n---\n\n# Fixture\n`);
    return p;
}

function arrivingRuleIds(scopeSettings: Record<string, unknown>): string[] {
    const scope = { ...LEGACY_ALL, profileRules: ruleScopeFromSettings(scopeSettings).profileRules ?? null };
    return fs
        .readdirSync(DIST_RULES)
        .filter((n) => n.endsWith('.md'))
        .filter((n) => ruleFileArrives(path.join(DIST_RULES, n), scope))
        .map((n) => n.replace(/\.md$/, ''))
        .sort();
}

describe('ruleScopeFromSettings — discipline_profile axis', () => {
    it('explicit essential selects the essential rule set', () => {
        expect(ruleScopeFromSettings({ discipline_profile: 'essential' }).profileRules).toEqual(
            DISCIPLINE_PROFILE_RULES.essential,
        );
    });

    it('explicit off selects the kernel alone', () => {
        expect(ruleScopeFromSettings({ discipline_profile: 'off' }).profileRules).toEqual([]);
    });

    it.each([['full'], ['auto'], ['custom'], ['__DISCIPLINE_PROFILE__'], [undefined], [42]])(
        '%s applies no profile filter',
        (value) => {
            const settings = value === undefined ? {} : { discipline_profile: value };
            expect(ruleScopeFromSettings(settings).profileRules ?? null).toBeNull();
        },
    );
});

describe('ruleFileArrives — profile filter (fixture-precise)', () => {
    const essential = { ...LEGACY_ALL, profileRules: ['downstream-changes'] };

    it('a kernel rule arrives under every profile', () => {
        const p = fixture('kernel-x.md', 'always');
        expect(ruleFileArrives(p, essential)).toBe(true);
        expect(ruleFileArrives(p, { ...LEGACY_ALL, profileRules: [] })).toBe(true);
    });

    it('a profile-listed rule arrives', () => {
        expect(ruleFileArrives(fixture('downstream-changes.md', 'auto'), essential)).toBe(true);
    });

    it('an unlisted routed rule does not arrive', () => {
        expect(ruleFileArrives(fixture('some-auto-rule.md', 'auto'), essential)).toBe(false);
    });

    it('a null profile filter ships the routed rule', () => {
        expect(ruleFileArrives(fixture('other-auto-rule.md', 'auto'), LEGACY_ALL)).toBe(true);
    });
});

describe('real tree — the install equals the measured profile', () => {
    it('essential installs exactly the kernel plus the router essential set', () => {
        const expected = [...ROUTER.kernel, ...ROUTER.profiles['essential']!.filter((r) => !r.startsWith('__'))].sort();
        expect(arrivingRuleIds({ discipline_profile: 'essential' })).toEqual(expected);
    });

    it('off installs exactly the kernel', () => {
        expect(arrivingRuleIds({ discipline_profile: 'off' })).toEqual([...ROUTER.kernel].sort());
    });

    it('full installs strictly more than essential', () => {
        expect(arrivingRuleIds({ discipline_profile: 'full' }).length).toBeGreaterThan(
            arrivingRuleIds({ discipline_profile: 'essential' }).length,
        );
    });

    it('the router profiles are compiled from the same constant the installer reads', () => {
        expect(ROUTER.profiles['essential']).toEqual(['__kernel__', ...DISCIPLINE_PROFILE_RULES.essential]);
        expect(ROUTER.profiles['minimal']).toEqual(['__kernel__', ...DISCIPLINE_PROFILE_RULES.off]);
    });
});
