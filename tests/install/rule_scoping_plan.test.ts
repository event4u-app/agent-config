/**
 * Global-path rule scoping (road-to-request-scoped-rule-load Phase 1b).
 *
 * The GLOBAL install payload shipped every rule with no exclude at all —
 * including `source-of-truth.md`, contradicting the project path. These
 * tests count what the wizard PLAN actually carries per scope, against the
 * REAL `dist/agent-src/rules` tree + `dist/router.json` v2, so tag drift is
 * caught rather than fixtured away (same discipline as
 * rule_workspace_scoping.test.ts on the projection path).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { expandWizardSources } from '../../src/install/wizard-plan.js';
import { buildInstallPlan } from '../../src/install/plan.js';
import {
    COMPAT_ALWAYS_EXCLUDED,
    LEGACY_ALL,
    excludedRuleBasenames,
    ruleScopeFromSettings,
} from '../../src/install/rule_scope.js';
import type { ConflictPolicy } from '../../src/install/types.js';

const REPO = path.resolve(__dirname, '..', '..');
const RULES_DIR = path.join(REPO, 'dist', 'agent-src', 'rules');
const ROUTER = JSON.parse(
    fs.readFileSync(path.join(REPO, 'dist', 'router.json'), 'utf-8'),
) as {
    kernel: string[];
    tier_1: Array<{ id: string; workspaces?: string[] }>;
    tier_2: Array<{ id: string; workspaces?: string[] }>;
};

const POLICY: ConflictPolicy = {
    force: false,
    interactive: false,
    knownPaths: new Set(),
    knownPointers: new Set(),
    defaultStrategy: 'skip',
};

function maintainerOnly(): string[] {
    const out: string[] = [];
    for (const tier of [ROUTER.tier_1, ROUTER.tier_2]) {
        for (const e of tier) {
            const ws = e.workspaces ?? [];
            if (ws.length === 1 && ws[0] === 'agent-config-maintainer') {
                out.push(`${e.id}.md`);
            }
        }
    }
    return out.sort();
}

function planRuleBasenames(ruleScope: Parameters<typeof expandWizardSources>[0]['ruleScope']): string[] {
    const home = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'rule-scope-home-'));
    try {
        const sources = expandWizardSources({
            toolIds: ['augment'],
            packageRoot: REPO,
            home,
            ...(ruleScope === undefined ? {} : { ruleScope }),
        });
        const plan = buildInstallPlan({
            target: 'global',
            root: home,
            sources,
            policy: POLICY,
        });
        const names: string[] = [];
        for (const entries of Object.values(plan.filesByTool)) {
            for (const e of entries) {
                if (e.path.includes(`${path.sep}rules${path.sep}`) && e.path.endsWith('.md')) {
                    names.push(path.basename(e.path));
                }
            }
        }
        return names.sort();
    } finally {
        fs.rmSync(home, { recursive: true, force: true });
    }
}

describe('global install plan — legacy-all default', () => {
    it('excludes source-of-truth.md (contradiction fix: same treatment as project path)', () => {
        const names = planRuleBasenames(undefined);
        for (const compat of COMPAT_ALWAYS_EXCLUDED) {
            expect(names).not.toContain(compat);
        }
    });

    it('ships src−compat rules (over-ship default, nothing else dropped)', () => {
        const srcCount = fs
            .readdirSync(RULES_DIR)
            .filter((n) => n.endsWith('.md')).length;
        const names = planRuleBasenames(undefined);
        expect(names.length).toBe(srcCount - COMPAT_ALWAYS_EXCLUDED.length);
    });
});

describe('global install plan — scoped', () => {
    const scope = ruleScopeFromSettings({
        projection: { rule_workspaces: ['engineering'] },
    });

    it('ships ZERO exclusively-maintainer rules', () => {
        const names = new Set(planRuleBasenames(scope));
        const offenders = maintainerOnly().filter((r) => names.has(r));
        expect(offenders).toEqual([]);
        expect(maintainerOnly().length).toBeGreaterThan(5); // sanity: non-trivial set
    });

    it('always keeps the kernel', () => {
        const names = new Set(planRuleBasenames(scope));
        for (const k of ROUTER.kernel) {
            expect(names.has(`${k}.md`)).toBe(true);
        }
    });

    it('ships strictly fewer rules than legacy-all', () => {
        expect(planRuleBasenames(scope).length).toBeLessThan(
            planRuleBasenames(undefined).length,
        );
    });
});

describe('excludedRuleBasenames — bash CLI surface', () => {
    it('legacy-all excludes exactly the compat set', () => {
        expect(excludedRuleBasenames(RULES_DIR, LEGACY_ALL)).toEqual([
            ...COMPAT_ALWAYS_EXCLUDED,
        ]);
    });
});
