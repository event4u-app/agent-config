/**
 * road-to-consistent-rule-scoping Phase 2 — pin the CLI global deploy path.
 *
 * `tests/install/rule_scoping_plan.test.ts` covers `expandWizardSources` — the
 * PLAN path the browser wizard uses. Nothing covered `_deploy_global_content`,
 * the path `agent-config init --global` actually takes, which is exactly why the
 * two shipped different rule sets for the same settings without any test going
 * red.
 *
 * The assertion here is deliberately the EQUALITY OF THE TWO PATHS, never a
 * hardcoded count: a count rots the next time a rule is added, and it would not
 * have caught this bug anyway (both numbers were individually plausible).
 *
 * Hermetic: `HOME` (so `~`-anchored deploy targets land in a temp tree),
 * `EVENT4U_CONFIG_HOME` (the global settings doc the scope is read from) and
 * `AGENT_CONFIG_DEPLOY_INVENTORY` (the reaper's record) are all redirected.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    _deploy_global_content,
    _resolve_global_rule_scope,
} from '../../src/scripts/install.js';
import { expandWizardSources, RULE_SOURCE_REL } from '../../src/install/wizard-plan.js';
import { buildInstallPlan, type ConflictPolicy } from '../../src/install/plan.js';
import {
    COMPAT_ALWAYS_EXCLUDED,
    LEGACY_ALL,
    ruleScopeFromSettings,
    type RuleScope,
} from '../../src/install/rule_scope.js';

const REPO = path.resolve(__dirname, '..', '..');
const RULES_DIR = path.join(REPO, RULE_SOURCE_REL);

/** A scoped settings doc — the shape a wizard-written global file carries. */
const SCOPED_SETTINGS = { projection: { rule_workspaces: ['engineering'] } };

const POLICY: ConflictPolicy = {
    force: false,
    interactive: false,
    knownPaths: new Set<string>(),
    knownPointers: new Set<string>(),
    defaultStrategy: 'skip',
};

/**
 * `windsurf` is the tool under test: its deploy plan is the rules tree ALONE
 * (`[['dist/agent-src/rules', 'rules']]`), so the assertion is about rule
 * scoping and nothing else, and the test does not copy the skills tree.
 */
const TOOL = 'windsurf';
const TOOL_ANCHOR_REL = path.join('.codeium', 'windsurf');
const DEPLOYED_RULES_SUB = path.join(TOOL_ANCHOR_REL, 'rules');

const ENV_KEYS = ['HOME', 'EVENT4U_CONFIG_HOME', 'AGENT_CONFIG_DEPLOY_INVENTORY'] as const;

let tmp: string;
let saved: Record<string, string | undefined>;

function setEnv(): void {
    process.env['HOME'] = tmp;
    process.env['EVENT4U_CONFIG_HOME'] = path.join(tmp, 'e4u');
    process.env['AGENT_CONFIG_DEPLOY_INVENTORY'] = path.join(tmp, 'inventory.json');
}

/** Write the global settings doc the deploy resolves its scope from. */
function writeGlobalSettings(doc: unknown): void {
    const dir = path.join(tmp, 'e4u', 'settings');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, '.agent-settings.yml'),
        JSON.stringify(doc), // YAML is a JSON superset — the loader parses this
        'utf-8',
    );
}

function removeGlobalSettings(): void {
    fs.rmSync(path.join(tmp, 'e4u'), { recursive: true, force: true });
}

/** Rule basenames actually written into the deploy anchor. */
function deployedRuleBasenames(): string[] {
    const dir = path.join(tmp, DEPLOYED_RULES_SUB);
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return names.filter((n) => n.endsWith('.md')).sort();
}

/** Rule basenames the WIZARD plan path would write for the same scope. */
function plannedRuleBasenames(scope: RuleScope | undefined): string[] {
    const sources = expandWizardSources({
        toolIds: [TOOL],
        packageRoot: REPO,
        home: tmp,
        ...(scope === undefined ? {} : { ruleScope: scope }),
    });
    const plan = buildInstallPlan({ target: 'global', root: tmp, sources, policy: POLICY });
    const names: string[] = [];
    for (const entries of Object.values(plan.filesByTool)) {
        for (const e of entries) {
            if (e.path.includes(`${path.sep}rules${path.sep}`) && e.path.endsWith('.md')) {
                names.push(path.basename(e.path));
            }
        }
    }
    return names.sort();
}

function runDeploy(force = true): void {
    _deploy_global_content(
        new Set([TOOL]),
        force,
        REPO,
        path.join(tmp, 'installed.lock'),
    );
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-scope-deploy-'));
    saved = {};
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    setEnv();
});

afterEach(() => {
    for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k] as string;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('CLI global deploy — rule set equals the wizard plan', () => {
    it('ships the same rules as the wizard under a SCOPED settings doc', () => {
        writeGlobalSettings(SCOPED_SETTINGS);
        runDeploy();

        const deployed = deployedRuleBasenames();
        const planned = plannedRuleBasenames(ruleScopeFromSettings(SCOPED_SETTINGS));

        expect(deployed.length).toBeGreaterThan(0);
        // The equality IS the contract. Pre-fix this failed because the deploy
        // shipped every rule while the plan filtered.
        expect(deployed).toEqual(planned);
    });

    it('ships the same rules as the wizard with NO settings doc (legacy-all)', () => {
        removeGlobalSettings();
        runDeploy();

        const deployed = deployedRuleBasenames();
        // No global doc → the packaged template decides, exactly as the deploy
        // resolves it; compare against that same resolved scope.
        const planned = plannedRuleBasenames(_resolve_global_rule_scope(REPO));

        expect(deployed.length).toBeGreaterThan(0);
        expect(deployed).toEqual(planned);
    });

    it('never ships the compat-excluded rule, on any scope', () => {
        for (const doc of [SCOPED_SETTINGS, { projection: {} }]) {
            fs.rmSync(path.join(tmp, TOOL_ANCHOR_REL), { recursive: true, force: true });
            writeGlobalSettings(doc);
            runDeploy();
            for (const excluded of COMPAT_ALWAYS_EXCLUDED) {
                expect(deployedRuleBasenames(), JSON.stringify(doc)).not.toContain(excluded);
            }
        }
    });

    it('ships strictly fewer rules scoped than unscoped', () => {
        writeGlobalSettings({ projection: {} });
        runDeploy();
        const unscoped = deployedRuleBasenames();

        fs.rmSync(path.join(tmp, TOOL_ANCHOR_REL), { recursive: true, force: true });
        writeGlobalSettings(SCOPED_SETTINGS);
        runDeploy();
        const scoped = deployedRuleBasenames();

        expect(scoped.length).toBeGreaterThan(0);
        expect(scoped.length).toBeLessThan(unscoped.length);
        // Scoping only ever removes — it must never introduce a rule.
        expect(scoped.every((n) => unscoped.includes(n))).toBe(true);
    });
});

describe('CLI global deploy — upgrade reaps newly-excluded rules', () => {
    it('deletes maintainer-only rules on an unscoped → scoped re-install', () => {
        // 1. Unscoped install: everything except the compat exclusion arrives.
        writeGlobalSettings({ projection: {} });
        runDeploy();
        const unscoped = deployedRuleBasenames();
        expect(unscoped.length).toBeGreaterThan(0);

        // 2. Re-install with a scoped doc, against the SAME anchor — no manual
        //    cleanup. This is the upgrade path.
        writeGlobalSettings(SCOPED_SETTINGS);
        runDeploy();
        const scoped = deployedRuleBasenames();

        const nowExcluded = unscoped.filter((n) => !scoped.includes(n));
        expect(nowExcluded.length).toBeGreaterThan(0);

        // The point of the test: GONE from disk, not merely un-refreshed.
        // Filtering the copy without filtering the inventory would leave every
        // one of these behind, which is worse than shipping them in the first
        // place — the user would carry them forever with no way to notice.
        for (const name of nowExcluded) {
            expect(
                fs.existsSync(path.join(tmp, DEPLOYED_RULES_SUB, name)),
                `${name} survived the scoped re-install`,
            ).toBe(false);
        }
        expect(scoped).toEqual(plannedRuleBasenames(ruleScopeFromSettings(SCOPED_SETTINGS)));
    });

    it('is idempotent — a second scoped install changes nothing', () => {
        writeGlobalSettings(SCOPED_SETTINGS);
        runDeploy();
        const first = deployedRuleBasenames();
        runDeploy();
        expect(deployedRuleBasenames()).toEqual(first);
    });
});

describe('scope resolution fails safe', () => {
    it('falls back to legacy-all on an unreadable settings doc', () => {
        const dir = path.join(tmp, 'e4u', 'settings');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.agent-settings.yml'), ':\n  - [unclosed', 'utf-8');
        // Over-shipping is the safe direction; the compat exclusion still holds.
        const scope = _resolve_global_rule_scope(REPO);
        expect(scope.workspaces).toBeNull();
        expect(scope.packs).toBeNull();
    });

    it('treats a settings doc without a projection block as legacy-all', () => {
        writeGlobalSettings({ personal: { autonomy: 'on' } });
        expect(_resolve_global_rule_scope(REPO)).toEqual(
            expect.objectContaining({ workspaces: null, packs: null }),
        );
    });

    it('reads the same keys ruleScopeFromSettings reads', () => {
        writeGlobalSettings(SCOPED_SETTINGS);
        expect(_resolve_global_rule_scope(REPO)).toEqual(
            ruleScopeFromSettings(SCOPED_SETTINGS),
        );
    });
});

describe('the rules source key cannot drift between the two paths', () => {
    it('points at a real directory in the shipped tree', () => {
        expect(fs.statSync(RULES_DIR).isDirectory()).toBe(true);
    });

    it('is the key the wizard expander filters on', () => {
        // Both paths must agree on WHICH source is scoped, not only on the
        // predicate — hence the shared constant rather than two literals.
        const sources = expandWizardSources({
            toolIds: [TOOL],
            packageRoot: REPO,
            home: tmp,
            ruleScope: LEGACY_ALL,
        });
        const ruleSource = sources.find((s) => s.srcDir === path.join(REPO, RULE_SOURCE_REL));
        expect(ruleSource, 'no plan source matched RULE_SOURCE_REL').toBeDefined();
        expect(ruleSource?.fileFilter).toBeTypeOf('function');
    });
});
