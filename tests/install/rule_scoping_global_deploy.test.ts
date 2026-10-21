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
import { consumerRuleWorkspaces } from '../../src/scripts/_lib/scoped_projection.js';
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
        const planned = plannedRuleBasenames(ruleScopeFromSettings(SCOPED_SETTINGS, REPO));

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

    it('ships the derived scope whatever the settings say, and it is strictly smaller', () => {
        // ADR-293 step 4.6: the workspace axis is DERIVED from the pack
        // vocabulary, so "unscoped" is no longer a state a settings doc can
        // ask for. Both docs therefore deploy the same set — which is the
        // assertion, and the sensitive one: a difference here would mean a
        // settings value had regained control of what a consumer receives.
        writeGlobalSettings({ projection: {} });
        runDeploy();
        const empty = deployedRuleBasenames();

        fs.rmSync(path.join(tmp, TOOL_ANCHOR_REL), { recursive: true, force: true });
        writeGlobalSettings(SCOPED_SETTINGS);
        runDeploy();
        const scoped = deployedRuleBasenames();

        expect(scoped.length).toBeGreaterThan(0);
        expect(scoped).toEqual(empty);
        // And the derived scope still REMOVES: it is strictly smaller than the
        // rule set the package ships, or the derivation is doing nothing.
        const everyRule = plannedRuleBasenames({ workspaces: null, packs: null });
        expect(scoped.length).toBeLessThan(everyRule.length);
        expect(scoped.every((n) => everyRule.includes(n))).toBe(true);
    });
});

describe('CLI global deploy — upgrade reaps newly-excluded rules', () => {
    it('deletes rules a narrower re-install newly excludes', () => {
        // The upgrade path. ADR-293 step 4.6 took the WORKSPACE axis out of
        // settings, so the two states are produced on the PACK axis instead —
        // the axis that is still a setting, and the same reap code path. The
        // point is unchanged: the newly-excluded rules are GONE from disk, not
        // merely un-refreshed. Filtering the copy without filtering the
        // inventory would leave every one behind, which is worse than shipping
        // them — the user would carry them forever with no way to notice.
        writeGlobalSettings(SCOPED_SETTINGS);
        runDeploy();
        const wider = deployedRuleBasenames();
        expect(wider.length).toBeGreaterThan(0);

        writeGlobalSettings({ projection: { rule_packs: ['engineering-base'] } });
        runDeploy();
        const narrower = deployedRuleBasenames();

        const nowExcluded = wider.filter((n) => !narrower.includes(n));
        expect(nowExcluded.length).toBeGreaterThan(0);
        for (const name of nowExcluded) {
            expect(
                fs.existsSync(path.join(tmp, DEPLOYED_RULES_SUB, name)),
                `${name} survived the narrower re-install`,
            ).toBe(false);
        }
        expect(narrower).toEqual(
            plannedRuleBasenames(ruleScopeFromSettings({ projection: { rule_packs: ['engineering-base'] } }, REPO)),
        );
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
    it('falls back to legacy-all on an unreadable settings doc — LOUDLY', () => {
        const dir = path.join(tmp, 'e4u', 'settings');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.agent-settings.yml'), ':\n  - [unclosed', 'utf-8');

        const warnings: string[] = [];
        const origErr = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk: string | Uint8Array): boolean => {
            warnings.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
            return true;
        }) as typeof process.stderr.write;
        let scope: ReturnType<typeof _resolve_global_rule_scope>;
        try {
            scope = _resolve_global_rule_scope(REPO);
        } finally {
            process.stderr.write = origErr;
        }

        // Over-shipping stays the safe direction; the compat exclusion holds.
        expect(scope.workspaces).toBeNull();
        expect(scope.packs).toBeNull();
        // But it must NOT be silent: a YAML typo otherwise defeats a scoping
        // decision the user made, and `_load_yaml_doc` reports that as an
        // indistinguishable `{}` (PR #1076 review-gate finding).
        const text = warnings.join('');
        expect(text).toContain('.agent-settings.yml');
        expect(text.toLowerCase()).toContain('legacy-all');
    });

    it('stays SILENT when no settings doc exists at all', () => {
        removeGlobalSettings();
        const warnings: string[] = [];
        const origErr = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk: string | Uint8Array): boolean => {
            warnings.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
            return true;
        }) as typeof process.stderr.write;
        try {
            _resolve_global_rule_scope(REPO);
        } finally {
            process.stderr.write = origErr;
        }
        // A fresh machine has no user decision to contradict — the packaged
        // template is the documented path, and warning there would be noise.
        expect(warnings.join('')).not.toContain('legacy-all');
    });

    it('derives the workspace axis even with no projection block, and leaves packs inactive', () => {
        // Before ADR-293 step 4.6 this read `workspaces: null`. A rule is not a
        // setting, so a settings file that happens to omit a section cannot
        // switch the workspace scope off; the pack axis is still a setting and
        // stays inactive, which is the half that did not change.
        writeGlobalSettings({ personal: { autonomy: 'on' } });
        const scope = _resolve_global_rule_scope(REPO);
        expect(scope.packs).toBeNull();
        expect(scope.workspaces).toEqual(consumerRuleWorkspaces(REPO));
        expect(scope.workspaces?.length).toBeGreaterThan(0);
    });

    it('reads the same keys ruleScopeFromSettings reads', () => {
        writeGlobalSettings(SCOPED_SETTINGS);
        expect(_resolve_global_rule_scope(REPO)).toEqual(
            ruleScopeFromSettings(SCOPED_SETTINGS, REPO),
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

describe('one scope snapshot per run — the TOCTOU pin', () => {
    const INSTALL_SRC = path.join(REPO, 'src', 'scripts', 'install.ts');

    /** Body of a top-level `function <name>(` up to the next top-level `}`. */
    function functionBody(src: string, name: string): string {
        const start = src.indexOf(`function ${name}(`);
        expect(start, `${name} not found`).toBeGreaterThan(-1);
        const end = src.indexOf('\n}', start);
        return src.slice(start, end);
    }

    it('resolves the rule scope exactly once per deploy, before the tool loop', () => {
        // PR #1076 review-gate finding: the settings doc could in principle change
        // between the copy and the reap. It cannot here, because ONE snapshot is
        // taken before the loop and handed to both the copy filter and
        // `expected_deploy_files` (whose output the reaper consumes). Resolving
        // per-tool, or a second time for the reap, would reopen that window — so
        // pin the shape rather than trusting a comment.
        const body = functionBody(fs.readFileSync(INSTALL_SRC, 'utf-8'), '_deploy_global_content');
        const resolveAt = body.indexOf('_resolve_global_rule_scope(');
        const loopAt = body.indexOf('for (const tool_id');

        expect(body.match(/_resolve_global_rule_scope\(/g)).toHaveLength(1);
        expect(resolveAt).toBeGreaterThan(-1);
        expect(loopAt).toBeGreaterThan(-1);
        expect(resolveAt, 'scope must be resolved BEFORE the per-tool loop').toBeLessThan(loopAt);
    });

    it('derives the copy filter and the inventory filter from the same snapshot', () => {
        const body = functionBody(fs.readFileSync(INSTALL_SRC, 'utf-8'), '_deploy_global_content');
        // One filter variable, used twice — not two independent derivations.
        expect(body.match(/_rule_filter_for_source\(/g)).toHaveLength(1);
        expect(body).toContain('rule_filter,');
    });

    it('the dry-run preview takes its own snapshot — it is a separate invocation', () => {
        const body = functionBody(fs.readFileSync(INSTALL_SRC, 'utf-8'), '_preview_global_reap');
        expect(body.match(/_resolve_global_rule_scope\(/g)).toHaveLength(1);
        // Deliberate: `--dry-run` and the real run are separate commands, so the
        // real run MUST read current settings rather than reuse a stale preview.
        // A prediction diverging after the user edits settings is correct
        // behaviour, not a race.
    });
});
