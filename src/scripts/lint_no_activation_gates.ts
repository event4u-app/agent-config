#!/usr/bin/env node
/**
 * `no-activation-gates` — CI backstop for the always-on-orchestration
 * doctrine (road-to-always-on-orchestration Phase 1).
 *
 * The doctrine deletes every per-layer on/off setting for subagents,
 * council, and team: `subagents.enabled`, `subagents.auto`,
 * `subagents.host_capabilities`, and (Step 1.3) `ai_team.enabled` are gone
 * from the shipped template, and there is exactly ONE surviving switch —
 * `emergency.orchestration_halt`, the audited incident-only kill switch (see
 * `docs/contracts/settings-classes.md` § "The one exception").
 *
 * This gate fails the build if the template ever reintroduces a settings
 * boolean whose only semantics is "is this orchestration layer on": any leaf
 * matching `(subagents|ai_team|council)\.(enabled|auto)$`, except the one
 * allowlisted exception.
 *
 * `ai_team.enabled` WAS allowlisted here in an earlier phase (a distinct,
 * still-opt-in feature) and has since joined the deletion in Step 1.3:
 * `/team`'s availability is now resolved from a codex-CLI/auth probe
 * (`src/scripts/ai_team/availability.ts`), matching the doctrine already
 * applied to `subagents.*`. The allowlist below now carries only the one
 * emergency switch; the pattern stays live so a reintroduced
 * `ai_team.enabled`, a future `ai_team.auto`-shaped key, or any
 * `subagents.*` / `council.*` activation flag still fails the build.
 *
 * CLI contract: exit 0 = clean, 1 = a forbidden key exists (or the scan root
 * is dead). `--quiet` suppresses the per-key listing on the clean path.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { load as parseYaml } from 'js-yaml';

import { settingsLeafPaths } from '../shared/settingsClasses.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const GATE = 'lint_no_activation_gates';

const QUIET = process.argv.slice(2).includes('--quiet');

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const TEMPLATE_RELATIVE = 'src/config/agent-settings.template.yml';

/**
 * The one settings boolean the always-on doctrine keeps — never activation.
 *
 * `emergency.orchestration_halt` is listed here as DOCUMENTATION OF INTENT,
 * not as a live exemption: `ACTIVATION_GATE_RE` below is scoped to
 * `(subagents|ai_team|council).(enabled|auto)`, so this key — wrong prefix
 * (`emergency`, not one of those three) AND wrong suffix
 * (`orchestration_halt`, not `enabled`/`auto`) — never matches it and is
 * filtered out at the `not_applicable_kind` branch in the scan loop below,
 * before the `ALLOWLIST.has(...)` check is ever reached for it (independent
 * review, road-to-always-on-orchestration). Removing this line would change
 * nothing observable; it stays so a reader asking "where is the one
 * surviving switch accounted for in this gate" finds an answer, honestly
 * labelled as inert rather than implied to be doing enforcement work.
 */
const ALLOWLIST: ReadonlySet<string> = new Set([
    'emergency.orchestration_halt',
    // `ai_team.enabled` was allowlisted here in an earlier phase (it gated
    // a DIFFERENT, then still-opt-in feature — the cross-model `/team`
    // review family — and its replacement was deferred pending a decision
    // on whether to conflate it with Claude Code's experimental native
    // Agent Teams flag). Step 1.3 resolved that: `/team`'s availability is
    // now a codex-CLI/auth probe (`src/scripts/ai_team/availability.ts`),
    // NOT the native Agent Teams flag and NOT a settings flag at all — so
    // the key is deleted, not allowlisted. Do not re-add it here.
]);

/** `(subagents|ai_team|council).(enabled|auto)` — the activation-gate shape. */
const ACTIVATION_GATE_RE = /^(subagents|ai_team|council)\.(enabled|auto)$/;

type Yaml = string | number | boolean | null | Yaml[] | { [k: string]: Yaml };

function _rootOverride(argv: readonly string[]): string | null {
    const i = argv.indexOf('--root');
    const value = i === -1 ? undefined : argv[i + 1];
    return value === undefined ? null : path.resolve(value);
}

function _readFile(p: string): string | null {
    try {
        return fs.readFileSync(p, 'utf-8');
    } catch {
        return null;
    }
}

/**
 * Prove, against the real CLI, that this gate still rejects what it must.
 *
 * The accept case is a two-key clean template; each reject case adds exactly
 * one forbidden key, so a pass proves the specific detection and not merely
 * that the fixture is broken.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lnag-selftest-'));
    const seed = (name: string, template: string): string => {
        const root = path.join(tmp, name);
        fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
        fs.writeFileSync(path.join(root, TEMPLATE_RELATIVE), template, 'utf-8');
        return root;
    };
    const run = (cwd: string): number =>
        runGateCli(REPO_ROOT, `src/scripts/${GATE}.ts`, ['--quiet', '--root', cwd], REPO_ROOT);

    const clean = 'subagents:\n  downshift: true\nemergency:\n  orchestration_halt: false\n';

    try {
        return runSelfTest({
            gate: GATE,
            minCases: 6,
            minRejectCases: 4,
            cases: [
                {
                    // "allowlisted" here would overstate it — the emergency
                    // switch passes because its shape falls outside
                    // `ACTIVATION_GATE_RE` entirely (`not_applicable_kind`),
                    // never because `ALLOWLIST.has(...)` fires for it. See
                    // the `ALLOWLIST` comment above for why the entry is
                    // documentation of intent rather than a live exemption.
                    name: 'a clean template with only the (structurally out-of-scope) emergency switch passes',
                    expect: 'accept',
                    run: () => run(seed('clean', clean)),
                },
                {
                    name: 'a leftover ai_team.enabled key is rejected — the allowlist no longer covers it (Step 1.3)',
                    expect: 'reject',
                    run: () => run(seed('ai-team-enabled', `${clean}ai_team:\n  enabled: false\n`)),
                },
                {
                    name: 'subagents.enabled is rejected',
                    expect: 'reject',
                    run: () => run(seed('subagents-enabled', `${clean}subagents:\n  enabled: true\n`)),
                },
                {
                    name: 'subagents.auto is rejected',
                    expect: 'reject',
                    run: () => run(seed('subagents-auto', `${clean}subagents:\n  auto: "on"\n`)),
                },
                {
                    name: 'council.enabled is rejected (future-key protection)',
                    expect: 'reject',
                    run: () => run(seed('council-enabled', `${clean}council:\n  enabled: true\n`)),
                },
                {
                    name: 'a NEW ai_team.auto key is rejected — no ai_team.* key is allowlisted anymore',
                    expect: 'reject',
                    run: () => run(seed('ai-team-auto', `${clean}ai_team:\n  auto: "on"\n`)),
                },
                {
                    name: 'a missing template — a dead scan root — is rejected, not passed as "nothing to check"',
                    expect: 'reject',
                    run: () => run(path.join(tmp, 'dead-root-does-not-exist')),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function main(): number {
    if (process.argv.slice(2).includes('--self-test')) {
        return selfTest();
    }
    const root = _rootOverride(process.argv.slice(2)) ?? REPO_ROOT;
    const templatePath = path.join(root, TEMPLATE_RELATIVE);

    const templateText = _readFile(templatePath);
    if (templateText === null) {
        process.stderr.write(`❌  ${GATE}: settings template not found at ${TEMPLATE_RELATIVE} — the scan root is dead.\n`);
        return 1;
    }

    let parsed: Yaml;
    try {
        parsed = parseYaml(templateText) as Yaml;
    } catch (e) {
        process.stderr.write(`❌  ${GATE}: ${TEMPLATE_RELATIVE} did not parse: ${String(e)}\n`);
        return 1;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        process.stderr.write(`❌  ${GATE}: ${TEMPLATE_RELATIVE} did not parse to a map.\n`);
        return 1;
    }

    const leaves = settingsLeafPaths(parsed);
    try {
        reportScanned({ gate: GATE, scanned: leaves.length, units: 'settings leaf key(s)', roots: [TEMPLATE_RELATIVE] });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 1;
        }
        throw e;
    }

    const ledger = new GateLedger(GATE);
    ledger.plan(leaves);

    const findings: string[] = [];
    for (const leaf of leaves) {
        if (!ACTIVATION_GATE_RE.test(leaf)) {
            ledger.outOfScope(leaf, 'not_applicable_kind');
            continue;
        }
        if (ALLOWLIST.has(leaf)) {
            ledger.outOfScope(leaf, 'declared_exemption');
            continue;
        }
        const finding =
            `${TEMPLATE_RELATIVE}  \`${leaf}\` is an activation-gate-shaped setting — the ` +
            'always-on-orchestration doctrine forbids a per-layer on/off switch. Delete it ' +
            'and resolve the layer from a host-capability probe/registry, or add it to the ' +
            `${GATE} allowlist with a stated reason if it is genuinely not one.`;
        findings.push(finding);
        ledger.fail(leaf, finding);
    }

    // Unconditional, per `GateLedger.report`'s own contract — `--quiet` mutes
    // the verbose per-key lines this gate prints below, never the ledger's own
    // scanned/planned/skipped summary.
    ledger.report();

    if (findings.length > 0) {
        for (const f of findings) {
            process.stderr.write(`❌  ${f}\n`);
        }
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(`✅  ${GATE}: no activation-gate-shaped settings key found.\n`);
    }
    return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}

export { GATE, REPO_ROOT, TEMPLATE_RELATIVE, main };
