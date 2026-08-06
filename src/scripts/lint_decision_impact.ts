#!/usr/bin/env tsx
/**
 * lint_decision_impact — the evidence bar on the one classification that permits removal.
 *
 * `rule.schema.json` gained a `decision_impact` class: what is at stake when a
 * rule fires, as distinct from `type`, which is a *delivery* class (how the rule
 * reaches the model). Kernel-membership and always-loaded-budget arguments were
 * being made with no stated impact class at all — a rule was argued into the
 * always-set on prose.
 *
 * The schema can express the enum. It cannot express the part that matters:
 * **`already-complied-with` is the value that permits deleting a rule**, and a
 * classification that cheap needs something behind it. "The model probably does
 * this anyway" is the least effortful possible way to remove a floor that was
 * working precisely because nothing had crossed it — the failure
 * `active-remediation` names as removing a rule that is merely quiet.
 *
 * So this gate enforces the pairing the schema cannot:
 *
 * - `decision_impact: already-complied-with` REQUIRES `decision_impact_evidence`
 *   — a pointer a reviewer can follow to the observation.
 * - Any other value FORBIDS it, so the field cannot become decoration attached
 *   to classifications it says nothing about.
 *
 * ## Why it currently finds nothing, and why that is the intended state
 *
 * The field is OPTIONAL and backfill is opportunistic, because a batch edit
 * across the rule set trips `check_kernel_prefix_stability` and that gate is
 * right to fire. So today every rule is unclassified and this gate is
 * verified-empty over 111 rules: it reads a real corpus, finds no violation
 * because there is no adopter yet, and fires the moment the first
 * removal-permitting classification lands without evidence. That is a gate
 * waiting at the right door, not a gate scanning nothing — the distinction this
 * repository pays for elsewhere.
 *
 * Exit codes: 0 = clean, 1 = violations, 2 = usage.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REAL_REPO_ROOT = path.dirname(path.dirname(SCRIPTS_DIR));

/** The one value that permits removal, and therefore the one carrying a bar. */
export const REMOVAL_PERMITTING = 'already-complied-with';

export interface Violation {
    readonly rule: string;
    readonly message: string;
}

export function frontmatterOf(text: string): Record<string, unknown> | null {
    const m = /^---[ \t]*\n([\s\S]*?)\n---/.exec(text);
    if (!m?.[1]) {
        return null;
    }
    try {
        const doc = parseYaml(m[1]) as unknown;
        return typeof doc === 'object' && doc !== null ? (doc as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

export function checkRule(rule: string, fm: Record<string, unknown>): Violation[] {
    const impact = fm['decision_impact'];
    const evidence = fm['decision_impact_evidence'];
    if (impact === undefined) {
        if (evidence !== undefined) {
            return [{
                rule,
                message:
                    '`decision_impact_evidence` is set with no `decision_impact` — evidence for a ' +
                    'classification that was never made says nothing a reviewer can use',
            }];
        }
        return [];
    }
    if (impact === REMOVAL_PERMITTING) {
        if (typeof evidence !== 'string' || evidence.trim() === '') {
            return [{
                rule,
                message:
                    `\`decision_impact: ${REMOVAL_PERMITTING}\` is the classification that permits ` +
                    'deleting this rule, so it requires `decision_impact_evidence` — a pointer a ' +
                    'reviewer can follow to the observation that the model complies without it',
            }];
        }
        return [];
    }
    if (evidence !== undefined) {
        return [{
            rule,
            message:
                `\`decision_impact_evidence\` is only meaningful for \`${REMOVAL_PERMITTING}\`; ` +
                `this rule is \`${String(impact)}\`, so the evidence field is decoration`,
        }];
    }
    return [];
}

function parseArgs(argv: readonly string[]): { quiet: boolean } {
    let quiet = false;
    for (const a of argv) {
        if (a === '--quiet') { quiet = true; }
        else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_decision_impact [--quiet]\n');
            process.exit(0);
        } else {
            process.stderr.write(`lint_decision_impact: unrecognized argument: ${a}\n`);
            process.exit(2);
        }
    }
    return { quiet };
}

export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ldi-'));
    const mk = (fmLines: string): string => {
        const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
        const p = path.join(root, 'src', 'rules', 'r.md');
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, `---\ntype: "auto"\n${fmLines}---\n\n# R\n`, 'utf-8');
        return root;
    };
    const run = (root: string): number => {
        process.env['LINT_DECISION_IMPACT_ROOT'] = root;
        try {
            return runGateCli(REAL_REPO_ROOT, 'src/scripts/lint_decision_impact.ts', ['--quiet'], root);
        } finally {
            delete process.env['LINT_DECISION_IMPACT_ROOT'];
        }
    };
    try {
        return runSelfTest({
            gate: 'lint_decision_impact',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                {
                    name: 'a rule with no classification passes — the field is optional by design',
                    expect: 'accept',
                    run: () => run(mk('')),
                },
                {
                    name: 'the removal-permitting class without evidence is rejected',
                    expect: 'reject',
                    run: () => run(mk('decision_impact: already-complied-with\n')),
                },
                {
                    name: 'the removal-permitting class with evidence passes',
                    expect: 'accept',
                    run: () =>
                        run(mk('decision_impact: already-complied-with\ndecision_impact_evidence: "PR #123 — 20 trajectories with the rule removed, no regression"\n')),
                },
                {
                    name: 'evidence attached to a non-removal class is rejected as decoration',
                    expect: 'reject',
                    run: () =>
                        run(mk('decision_impact: overrides-model-default\ndecision_impact_evidence: "PR #123"\n')),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv?: readonly string[]): number {
    const raw = argv ?? process.argv.slice(2);
    if (raw.includes('--self-test')) {
        return selfTest();
    }
    const args = parseArgs(raw);
    const root = process.env['LINT_DECISION_IMPACT_ROOT'] ?? REAL_REPO_ROOT;
    const dir = path.join(root, 'src', 'rules');

    let names: string[] = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort();
    } catch {
        names = [];
    }

    const violations: Violation[] = [];
    let scanned = 0;
    for (const n of names) {
        const fm = frontmatterOf(fs.readFileSync(path.join(dir, n), 'utf-8'));
        if (fm === null) {
            continue;
        }
        scanned += 1;
        violations.push(...checkRule(n.slice(0, -3), fm));
    }

    if (violations.length > 0) {
        process.stderr.write(`❌  lint_decision_impact: ${String(violations.length)} issue(s):\n`);
        for (const v of violations) {
            process.stderr.write(`  • ${v.rule}: ${v.message}\n`);
        }
    } else if (!args.quiet) {
        const classified = names.filter((n) => {
            const fm = frontmatterOf(fs.readFileSync(path.join(dir, n), 'utf-8'));
            return fm !== null && fm['decision_impact'] !== undefined;
        }).length;
        process.stdout.write(
            `✅  decision-impact clean — ${String(scanned)} rule(s), ${String(classified)} classified.\n`,
        );
    }

    reportScanned({
        gate: 'lint_decision_impact',
        scanned,
        units: 'rule(s)',
        roots: ['src/rules'],
    });
    return violations.length > 0 ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
        return true;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
