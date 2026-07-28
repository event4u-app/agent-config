/**
 * CI guard for the subagent role-scoping axis on rule projection
 * (road-to-lean-agent-init Phase 4 step 1).
 *
 * `roles:` is a third, additive, optional frontmatter list — parallel to
 * `workspaces:`/`packs:` — consumed by `rule_in_scope` (condense.ts) and
 * `ruleFileArrives`/`RuleScope` (install/rule_scope.ts). Untagged rules and
 * kernel rules (`type: always`) fail safe / always ship, exactly like the
 * existing workspace/pack axes.
 *
 * Two layers, mirroring tests/scripts/rule_workspace_scoping.test.ts:
 *   1. Fixture-precise unit tests (tmp files) pin the exact axis semantics
 *      in isolation — tagged/untagged/kernel/null-scope.
 *   2. A real-tree demonstration against src/rules/*.md proves the
 *      acceptance criterion: the reviewer-scoped and planner-scoped
 *      projections are each strictly smaller than the unscoped set, while
 *      still containing every rule their own role needs.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { rule_in_scope } from '../../src/scripts/condense.js';
import { LEGACY_ALL, ruleFileArrives } from '../../src/install/rule_scope.js';
import type { RuleScope } from '../../src/install/rule_scope.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC_RULES = path.join(REPO_ROOT, 'src', 'rules');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'roles-axis-'));
afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeFixture(name: string, opts: { type: 'auto' | 'always'; roles?: string[] }): string {
    const p = path.join(TMP_DIR, name);
    const alwaysApply = opts.type === 'always' ? 'alwaysApply: true\n' : '';
    const rolesLine = opts.roles ? `roles: [${opts.roles.join(', ')}]\n` : '';
    fs.writeFileSync(
        p,
        `---\ntype: "${opts.type}"\ndescription: "fixture rule"\n${alwaysApply}${rolesLine}---\n\n# Fixture\n`,
    );
    return p;
}

// ---------------------------------------------------------------------------
// 1. Fixture-precise unit tests
// ---------------------------------------------------------------------------

describe('rule_in_scope — roles axis (fixture-precise)', () => {
    it('a role-tagged rule arrives for its own role', () => {
        const p = writeFixture('reviewer-only-a.md', { type: 'auto', roles: ['reviewer'] });
        expect(rule_in_scope(p, null, null, ['reviewer'])).toBe(true);
    });

    it('a role-tagged rule is filtered out for a different role', () => {
        const p = writeFixture('reviewer-only-b.md', { type: 'auto', roles: ['reviewer'] });
        expect(rule_in_scope(p, null, null, ['tester'])).toBe(false);
    });

    it('an untagged rule ships to every role (fail-safe)', () => {
        const p = writeFixture('untagged-a.md', { type: 'auto' });
        expect(rule_in_scope(p, null, null, ['reviewer'])).toBe(true);
        expect(rule_in_scope(p, null, null, ['tester'])).toBe(true);
    });

    it('a kernel rule (type: always) always arrives, even tagged with a role that would otherwise exclude it', () => {
        const p = writeFixture('kernel-a.md', { type: 'always', roles: ['tester'] });
        expect(rule_in_scope(p, null, null, ['reviewer'])).toBe(true);
    });

    it('a null role_scope applies no role filtering — 2- and 3-arg call sites keep compiling and behaving unchanged', () => {
        const p = writeFixture('reviewer-only-c.md', { type: 'auto', roles: ['reviewer'] });
        expect(rule_in_scope(p, null, null, null)).toBe(true);
        expect(rule_in_scope(p, null, null)).toBe(true);
        expect(rule_in_scope(p, null)).toBe(true);
    });

    it('ruleFileArrives applies the same roles axis via an optional RuleScope.roles field', () => {
        const p = writeFixture('reviewer-only-d.md', { type: 'auto', roles: ['reviewer'] });
        const reviewerScope: RuleScope = { workspaces: null, packs: null, roles: ['reviewer'] };
        const testerScope: RuleScope = { workspaces: null, packs: null, roles: ['tester'] };
        expect(ruleFileArrives(p, reviewerScope)).toBe(true);
        expect(ruleFileArrives(p, testerScope)).toBe(false);
    });

    it('a RuleScope literal without `roles` (pre-existing shape) still compiles and applies no role filtering', () => {
        const p = writeFixture('reviewer-only-e.md', { type: 'auto', roles: ['reviewer'] });
        expect(ruleFileArrives(p, LEGACY_ALL)).toBe(true);
        const workspaceOnlyScope: RuleScope = { workspaces: ['engineering'], packs: null };
        expect(ruleFileArrives(p, workspaceOnlyScope)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 2. Real-tree demonstration — measurably smaller for ≥2 roles
// ---------------------------------------------------------------------------

function allRuleFiles(): string[] {
    return fs
        .readdirSync(SRC_RULES)
        .filter((n) => n.endsWith('.md'))
        .map((n) => path.join(SRC_RULES, n));
}

function scopedFor(role: string): string[] {
    return allRuleFiles().filter((p) => rule_in_scope(p, null, null, [role]));
}

function basenames(paths: string[]): Set<string> {
    return new Set(paths.map((p) => path.basename(p)));
}

describe('roles axis on the real src/rules tree — measurably smaller projection (≥2 roles)', () => {
    const all = allRuleFiles();

    // Tagged this step, per role: reviewer-awareness.md is a pure reviewer
    // rule (anchors reviewer choice in paths/risk); php-coding.md is tagged
    // [developer, reviewer] (its own description says "Writing/reviewing
    // PHP"); roadmap-progress-sync.md + roadmap-ci-steps-policy.md are pure
    // planner rules (roadmap execution discipline). No standalone
    // tester-primary RULE exists in src/rules/ today — see the roadmap-step
    // report for the deviation note; reviewer + planner are the two roles
    // demonstrated here, satisfying the "≥2 roles" acceptance bar.
    const REVIEWER_OWN = ['reviewer-awareness.md', 'php-coding.md'];
    const PLANNER_OWN = ['roadmap-progress-sync.md', 'roadmap-ci-steps-policy.md'];
    const KERNEL_IDS = ['commit-policy.md', 'verify-before-complete.md', 'non-destructive-by-default.md'];
    // An untagged, non-kernel rule with no `roles:` key — must ship to every role.
    const UNTAGGED_SAMPLE = 'icon-consistency.md';

    it('reviewer-scoped projection is strictly smaller than the unscoped set', () => {
        expect(scopedFor('reviewer').length).toBeLessThan(all.length);
    });

    it('planner-scoped projection is strictly smaller than the unscoped set', () => {
        expect(scopedFor('planner').length).toBeLessThan(all.length);
    });

    it('reviewer-scoped projection keeps every rule reviewer needs', () => {
        const scoped = basenames(scopedFor('reviewer'));
        for (const id of [...REVIEWER_OWN, ...KERNEL_IDS, UNTAGGED_SAMPLE]) {
            expect(scoped.has(id), id).toBe(true);
        }
    });

    it('reviewer-scoped projection drops planner-only-tagged rules', () => {
        const scoped = basenames(scopedFor('reviewer'));
        for (const id of PLANNER_OWN) {
            expect(scoped.has(id), id).toBe(false);
        }
    });

    it('planner-scoped projection keeps every rule planner needs', () => {
        const scoped = basenames(scopedFor('planner'));
        for (const id of [...PLANNER_OWN, ...KERNEL_IDS, UNTAGGED_SAMPLE]) {
            expect(scoped.has(id), id).toBe(true);
        }
    });

    it('planner-scoped projection drops reviewer-only-tagged rules', () => {
        const scoped = basenames(scopedFor('planner'));
        expect(scoped.has('reviewer-awareness.md')).toBe(false);
        // php-coding.md is tagged [developer, reviewer] — also absent from planner scope.
        expect(scoped.has('php-coding.md')).toBe(false);
    });

    it('the unscoped (role_scope=null) projection still keeps every rule (legacy-all, unchanged)', () => {
        for (const p of all) {
            expect(rule_in_scope(p, null, null, null), path.basename(p)).toBe(true);
        }
    });
});
