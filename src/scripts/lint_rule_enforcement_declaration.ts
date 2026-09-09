#!/usr/bin/env node
/**
 * `enforced_by`-declaration ratchet — a NEW rule states its enforcement, or
 * states the gap; only the legacy set may stay silent.
 *
 * The enforcement-coverage number moved backwards across 9.23→9.29 (13.5% →
 * 12.9%) for exactly one reason: rules were added faster than backstops, and
 * nothing required a new rule to even *declare* where it stands. Coverage
 * itself cannot be gated (whether a backstop is buildable is a per-rule
 * judgment), but the *declaration* can: `enforced_by:` accepts an honest
 * `none`, so requiring the key costs a new rule's author one line of truth,
 * never a mechanism.
 *
 * Ratchet shape (the established baseline-the-legacy pattern):
 *   - The 84 rules that predate this gate are recorded in
 *     `src/config/rule-enforcement-baseline.json`. They stay legal while
 *     undeclared; the list may only shrink.
 *   - A rule NOT in the baseline must carry `enforced_by:` — a validator/
 *     hook/test/observer reference, or the explicit `none`.
 *   - A rule declaring `none` must also state the gap in its body (the
 *     `enforced_by: none` honesty convention the existing none-rules use) —
 *     a frontmatter-only `none` nobody reads is a silent gap again.
 *   - A baseline entry whose rule gained a declaration (or was deleted) must
 *     leave the baseline in the same change — a stale entry is a freed slot
 *     a later silent rule could hide in.
 *
 * Deliberately NOT checked here: whether a declared validator resolves, is
 * wired, or can fail a build — that is `check_enforcement_coverage`'s job
 * (resolution), and `check_backstop_debt`'s (red backstops). This gate owns
 * the declaration boundary only, on `src/rules/` only — gate scripts and
 * their `// ledger-exempt:` markers are a different surface
 * (`check_gate_completeness`) and are not read here.
 *
 * **Where the baseline lives, and why it ships.** `src/config/` is a directory
 * entry in `package.json`'s `files[]`, so `rule-enforcement-baseline.json` is in
 * the published tarball alongside its nine siblings — `gate-violation-baselines`,
 * the four `*-budget` files, and the rest. All ten are repo-internal gate state:
 * this gate is their consumer, it ships too (via `src/scripts/`), and in a
 * consumer checkout it finds no `src/rules/` and does nothing. That is inert, not
 * orphaned, and it is the pre-existing shape rather than something this file
 * introduced — an automated review flagged it as "ships into dist with no
 * consumer", which is doubly wrong: the file is not in `dist/` at all, and the
 * consumer is this script. Whether ten repo-internal baselines belong in the
 * tarball is a real packaging question; it is one decision about ten files, not a
 * carve-out for the tenth.
 *
 * CLI contract: exit 0 = clean, 1 = a finding (or dead scan root), 2 = usage.
 * `--quiet` mutes the clean-path line; `--root <dir>` re-roots for fixtures;
 * `--write-baseline` records the current undeclared set (bootstrap/re-anchor —
 * a deliberate maintainer act, never CI).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { read_frontmatter } from './check_enforcement_coverage.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { is_kernel_rule } from './_lib/kernel_rules.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const GATE = 'lint_rule_enforcement_declaration';

const QUIET = process.argv.slice(2).includes('--quiet');

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const RULES_RELATIVE = path.join('src', 'rules');
const BASELINE_RELATIVE = path.join('src', 'config', 'rule-enforcement-baseline.json');

function _rootOverride(argv: readonly string[]): string | null {
    const i = argv.indexOf('--root');
    const value = i === -1 ? undefined : argv[i + 1];
    return value === undefined ? null : path.resolve(value);
}

/** enforced_by as declared, normalised to a string array; null = absent. */
function _declaration(fm: Record<string, string | string[]>): string[] | null {
    const raw = fm['enforced_by'];
    if (raw === undefined) return null;
    const list = Array.isArray(raw) ? raw : [raw];
    return list.length === 0 ? null : list;
}

/**
 * The body must state the gap in prose — the honesty convention.
 *
 * BOTH spellings are accepted, and that is not leniency. The bare `none` was
 * retired for `instruction-only: <reason>` on 2026-08-23 (one rule still carries
 * it: `non-destructive-by-default`, a kernel rule `block_kernel_rule_writes`
 * denies the agent write to). A body-check that knew only the old word would
 * fail a NEW rule that spelled the declaration the new way and said so in prose —
 * the rename would have made the honesty convention unsatisfiable for exactly
 * the rules adopting it.
 */
function _bodyStatesGap(text: string): boolean {
    const end = text.indexOf('\n---\n', 4);
    const body = end === -1 ? text : text.slice(end + 5);
    return (
        body.includes('enforced_by: none') ||
        body.includes('`enforced_by: none`') ||
        body.includes('instruction-only')
    );
}

function _readBaseline(root: string): string[] | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(path.join(root, BASELINE_RELATIVE), 'utf-8'));
        if (!Array.isArray(parsed) || !parsed.every((e) => typeof e === 'string')) return null;
        return parsed as string[];
    } catch {
        return null;
    }
}

interface Findings {
    findings: string[];
    undeclared: string[];
}

function _scan(root: string, baseline: ReadonlySet<string>, ledger: GateLedger | null): Findings {
    const rulesDir = path.join(root, RULES_RELATIVE);
    const files = fs
        .readdirSync(rulesDir)
        .filter((f) => f.endsWith('.md'))
        .sort();
    ledger?.plan(files);

    const findings: string[] = [];
    const undeclared: string[] = [];
    const seen = new Set<string>();

    for (const file of files) {
        seen.add(file);
        const text = fs.readFileSync(path.join(rulesDir, file), 'utf-8');
        const decl = _declaration(read_frontmatter(text));

        if (decl === null) {
            undeclared.push(file);
            if (baseline.has(file)) {
                ledger?.outOfScope(file, 'declared_exemption');
                continue;
            }
            const f =
                `src/rules/${file}  declares no \`enforced_by:\`. A new rule states its enforcement ` +
                `(validator:/hook:/test:/observer:) or states the gap (\`none\` + a body line saying so). ` +
                `The baseline covers only rules that predate this gate.`;
            findings.push(f);
            ledger?.fail(file, f);
            continue;
        }

        // Kernel rules are exempt from the body-prose convention, derived from
        // _lib/kernel_rules.ts (never a hardcoded list) so the exemption closes
        // itself the moment a rule leaves the kernel — the same self-closing
        // shape validate_frontmatter uses for obligation_frequency. Their
        // projected bytes are stability-gated, so requiring a prose line here
        // would force an un-editable edit.
        const declaresGap =
            decl.includes('none') || decl.some((d) => d.startsWith('instruction-only'));
        if (declaresGap && !_bodyStatesGap(text) && !is_kernel_rule(file)) {
            const f =
                `src/rules/${file}  declares a model-carried gap in frontmatter but never states it ` +
                `in its body — the honesty convention is one prose line naming \`instruction-only\` ` +
                `(or the retired \`enforced_by: none\`), so a reader of the rule sees the gap, not ` +
                `only a machine.`;
            findings.push(f);
            ledger?.fail(file, f);
            continue;
        }

        ledger?.complete(file);
    }

    for (const entry of [...baseline].sort()) {
        if (!seen.has(entry)) {
            findings.push(
                `${BASELINE_RELATIVE}  baseline entry \`${entry}\` names no existing rule — remove it in the ` +
                    `same change that renamed/deleted the rule. A stale entry is a freed slot a later ` +
                    `undeclared rule could silently occupy.`,
            );
            continue;
        }
        if (!undeclared.includes(entry)) {
            findings.push(
                `${BASELINE_RELATIVE}  baseline entry \`${entry}\` now declares \`enforced_by:\` — remove it ` +
                    `from the baseline in the same change. The list may only shrink.`,
            );
        }
    }

    return { findings, undeclared };
}

/** Prove against the real CLI that the ratchet rejects what it must. */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lred-selftest-'));
    const declared = '---\ntype: "auto"\nenforced_by:\n  - "validator:src/scripts/example.ts"\n---\n\n# R\n\nBody.\n';
    const noneHonest =
        '---\ntype: "auto"\nenforced_by:\n  - "none"\n---\n\n# R\n\nThis rule ships `enforced_by: none` — the obligation is model-carried.\n';
    const noneSilent = '---\ntype: "auto"\nenforced_by:\n  - "none"\n---\n\n# R\n\nBody with no gap statement.\n';
    const silent = '---\ntype: "auto"\n---\n\n# R\n\nBody.\n';

    const seed = (name: string, rules: Record<string, string>, baseline: string[]): string => {
        const root = path.join(tmp, name);
        fs.mkdirSync(path.join(root, RULES_RELATIVE), { recursive: true });
        fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
        for (const [file, text] of Object.entries(rules)) {
            fs.writeFileSync(path.join(root, RULES_RELATIVE, file), text, 'utf-8');
        }
        fs.writeFileSync(path.join(root, BASELINE_RELATIVE), `${JSON.stringify(baseline, null, 2)}\n`, 'utf-8');
        return root;
    };
    const run = (cwd: string): number =>
        runGateCli(REPO_ROOT, `src/scripts/${GATE}.ts`, ['--quiet', '--root', cwd], REPO_ROOT);

    try {
        return runSelfTest({
            gate: GATE,
            minCases: 6,
            minRejectCases: 4,
            cases: [
                {
                    name: 'a declared new rule and a baselined legacy rule pass',
                    expect: 'accept',
                    run: () => run(seed('clean', { 'a.md': declared, 'legacy.md': silent }, ['legacy.md'])),
                },
                {
                    name: 'an honest none (frontmatter + body gap line) passes',
                    expect: 'accept',
                    run: () => run(seed('none-honest', { 'a.md': noneHonest }, [])),
                },
                {
                    name: 'a NEW rule without enforced_by is rejected',
                    expect: 'reject',
                    run: () => run(seed('new-silent', { 'a.md': silent }, [])),
                },
                {
                    name: 'a none declaration without the body gap line is rejected',
                    expect: 'reject',
                    run: () => run(seed('none-silent', { 'a.md': noneSilent }, [])),
                },
                {
                    name: 'a stale baseline entry (rule deleted/renamed) is rejected',
                    expect: 'reject',
                    run: () => run(seed('stale', { 'a.md': declared }, ['gone.md'])),
                },
                {
                    name: 'a baseline entry whose rule gained a declaration is rejected until removed',
                    expect: 'reject',
                    run: () => run(seed('shrink', { 'a.md': declared }, ['a.md'])),
                },
                {
                    name: 'a dead scan root is rejected, never passed as nothing-to-check',
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
    const argv = process.argv.slice(2);
    if (argv.includes('--self-test')) {
        return selfTest();
    }
    const root = _rootOverride(argv) ?? REPO_ROOT;

    const rulesDir = path.join(root, RULES_RELATIVE);
    let isDir = false;
    try {
        isDir = fs.statSync(rulesDir).isDirectory();
    } catch {
        isDir = false;
    }
    if (!isDir) {
        process.stderr.write(`❌  ${GATE}: rules dir not found at ${RULES_RELATIVE} — the scan root is dead.\n`);
        return 1;
    }

    if (argv.includes('--write-baseline')) {
        const { undeclared } = _scan(root, new Set(), null);
        fs.writeFileSync(
            path.join(root, BASELINE_RELATIVE),
            `${JSON.stringify(undeclared, null, 2)}\n`,
            'utf-8',
        );
        process.stdout.write(`${GATE}: baseline written — ${undeclared.length} legacy undeclared rule(s).\n`);
        return 0;
    }

    const baseline = _readBaseline(root);
    if (baseline === null) {
        process.stderr.write(
            `❌  ${GATE}: ${BASELINE_RELATIVE} missing or not a string array — run --write-baseline once ` +
                `(a deliberate maintainer act) or restore the committed file.\n`,
        );
        return 1;
    }

    const ledger = new GateLedger(GATE);
    const { findings } = _scan(root, new Set(baseline), ledger);

    try {
        reportScanned({
            gate: GATE,
            scanned: fs.readdirSync(rulesDir).filter((f) => f.endsWith('.md')).length,
            units: 'rule file(s)',
            roots: [RULES_RELATIVE],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 1;
        }
        throw e;
    }
    ledger.report();

    if (findings.length > 0) {
        for (const f of findings) {
            process.stderr.write(`❌  ${f}\n`);
        }
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(
            `✅  ${GATE}: every non-baselined rule declares its enforcement (baseline: ${baseline.length}, shrink-only).\n`,
        );
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
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv1;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}

export { GATE, REPO_ROOT, BASELINE_RELATIVE, main };
