#!/usr/bin/env tsx
/**
 * Debt ratchet for rule backstops that are red on arrival.
 *
 * Wiring the `enforced_by:` validators into CI (`rule-backstops.yml`) surfaced
 * something the coverage number could not: **five of them were already failing**,
 * and had been, invisibly, because no workflow ran them. A rule declared a
 * backstop; the backstop existed; the backstop was red; nothing said so.
 *
 * So the established pattern applies — the one the decision-homing work already
 * uses and the council endorsed: **baseline the legacy, enforce the boundary.**
 * Each gate's current finding count is committed. The count may fall freely; it
 * may not rise. New violations fail, existing debt is visible and counted, and
 * nothing is silently tolerated.
 *
 * **The baseline is now 0 across all five gates.** The 37 findings were cleared
 * in a follow-up pass, so this file no longer records debt — it holds the line at
 * zero. Keeping the ratchet after the cleanup is the point: it is what stops the
 * counts creeping back, and the mechanism is identical whether the baseline is 37
 * or 0.
 *
 * Worth recording, because it changes how the next such number should be read:
 * roughly two thirds of the 37 were never violations. `CREDITS.md` was flagged
 * for the license-required attribution that `source-confidentiality` explicitly
 * exempts. A checklist row naming five ecosystems on ONE line read as
 * PHP-specific because only the PHP family carried a plain-language window hint.
 * An archived acceptance criterion was flagged for the source names it quotes in
 * order to assert their absence. Wiring a gate proves that it runs; it does not
 * prove its findings are real. That takes reading them one at a time.
 *
 * What this deliberately is NOT: a `continue-on-error` step. That is a WARN
 * wearing a gate's clothes, and removing exactly that confusion is why this
 * workflow exists.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_backstop_debt            # ratchet (CI)
 *   ./scripts-run src/scripts/check_backstop_debt --write-baseline
 *   ./scripts-run src/scripts/check_backstop_debt --json
 *
 * Exit codes: 0 held or improved · 1 a count rose · 2 usage/env error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');
const BASELINE = path.join(REPO_ROOT, 'internal', 'reports', 'rule-backstop-debt.json');

export interface Gate {
    /** Script stem under `src/scripts/`. */
    script: string;
    /** The rule whose `enforced_by:` names it — so a reader knows what is unguarded. */
    rule: string;
    /**
     * Extracts the finding count from the gate's own output.
     *
     * Explicit per gate rather than a shared heuristic: these five print their
     * totals in five different shapes, and a regex that guesses would silently
     * read 0 the day a gate changes its wording — turning a rising count into a
     * passing build, which is the failure mode this file exists to prevent.
     */
    count: RegExp;
}

export const GATES: readonly Gate[] = [
    { script: 'lint_framework_leakage', rule: 'framework-neutrality-in-generic-skills', count: /^(\d+) hits across \d+ files/m },
    { script: 'check_no_roadmap_refs', rule: 'no-roadmap-references', count: /Found (\d+) roadmap reference\(s\)/ },
    { script: 'check_council_references', rule: 'no-roadmap-references', count: /(\d+) forbidden council reference\(s\)/ },
    { script: 'check_no_external_sources', rule: 'source-confidentiality', count: /(\d+) external-source reference\(s\)/ },
    { script: 'check_token_optimizer_freshness', rule: 'token-optimizer-maintenance', count: /(\d+) drift signal\(s\)/ },
];

export interface Measured {
    script: string;
    rule: string;
    findings: number;
    exit_code: number;
    /** True when the gate ran but its count pattern did not match — never read as 0. */
    unparsed: boolean;
}

export function measure(gate: Gate, repo: string = REPO_ROOT): Measured {
    const r = spawnSync('./scripts-run', [`src/scripts/${gate.script}`], {
        cwd: repo,
        encoding: 'utf-8',
        env: { ...process.env, NO_COLOR: '1' },
    });
    const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    const m = gate.count.exec(out);
    // A clean gate legitimately prints no total. Only treat a MISSING count as
    // unparsed when the gate actually failed — otherwise a green run reads as
    // broken instrumentation.
    const failed = (r.status ?? 0) !== 0;
    return {
        script: gate.script,
        rule: gate.rule,
        findings: m ? Number(m[1]) : 0,
        exit_code: r.status ?? 0,
        unparsed: failed && m === null,
    };
}

function main(argv: string[]): number {
    const as_json = argv.includes('--json');
    const write = argv.includes('--write-baseline');

    const measured = GATES.map((g) => measure(g));

    if (as_json) {
        process.stdout.write(JSON.stringify({ gates: measured }, null, 2) + '\n');
        return 0;
    }

    if (write) {
        fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
        fs.writeFileSync(
            BASELINE,
            JSON.stringify(
                {
                    _doc:
                        'Per-gate finding counts for the rule backstops wired into CI by ' +
                        'rule-backstops.yml. Counts may FALL freely; a rise fails the build. These ' +
                        'gates were red on arrival (37 findings) because no workflow had ever run ' +
                        'them; that debt is now cleared and the baseline holds the line at 0. A ' +
                        'non-zero number here is a rule whose declared backstop is not currently ' +
                        'clean. Regenerate with --write-baseline only when the change is deliberate.',
                    gates: Object.fromEntries(measured.map((m) => [m.script, { rule: m.rule, findings: m.findings }])),
                    total: measured.reduce((a, m) => a + m.findings, 0),
                },
                null,
                2,
            ) + '\n',
        );
        process.stdout.write(`✅  wrote baseline → ${path.relative(REPO_ROOT, BASELINE)}\n`);
        return 0;
    }

    if (!fs.existsSync(BASELINE)) {
        process.stderr.write(
            `❌  check_backstop_debt: no baseline at ${path.relative(REPO_ROOT, BASELINE)}; run --write-baseline\n`,
        );
        return 2;
    }
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf-8')).gates as Record<string, { findings: number }>;

    const regressions: string[] = [];
    const improvements: string[] = [];
    for (const m of measured) {
        if (m.unparsed) {
            regressions.push(
                `${m.script}: failed (exit ${m.exit_code}) but its finding count could not be read — ` +
                    `the count pattern no longer matches its output. Fix the pattern; do not assume 0.`,
            );
            continue;
        }
        const was = base[m.script]?.findings;
        if (was === undefined) {
            regressions.push(`${m.script}: not in the baseline — add it with --write-baseline`);
            continue;
        }
        if (m.findings > was) {
            regressions.push(`${m.script} (${m.rule}): findings rose ${was} → ${m.findings}`);
        } else if (m.findings < was) {
            improvements.push(`${m.script} (${m.rule}): ${was} → ${m.findings}`);
        }
    }

    const total = measured.reduce((a, m) => a + m.findings, 0);
    process.stdout.write(
        `rule-backstop debt · ${total} finding(s) across ${measured.filter((m) => m.findings > 0).length} red gate(s)\n`,
    );
    for (const m of measured) {
        if (m.findings > 0) process.stdout.write(`  · ${m.script} (${m.rule}): ${m.findings}\n`);
    }
    for (const i of improvements) process.stdout.write(`  ✅ improved — ${i}\n`);

    if (regressions.length > 0) {
        process.stderr.write('❌  rule-backstop debt ratchet:\n');
        for (const r of regressions) process.stderr.write(`    · ${r}\n`);
        process.stderr.write(
            '    The baseline is 0 — these gates are clean, so a rise is a NEW violation, not inherited debt.\n' +
                '    Fix the finding, or re-baseline with --write-baseline if the change is deliberate.\n',
        );
        return 1;
    }
    if (improvements.length > 0) {
        process.stdout.write('    Baseline is now loose — regenerate with --write-baseline to lock the improvement.\n');
    }
    process.stdout.write('✅  rule-backstop debt ratchet holds\n');
    return 0;
}

// Main-guard (realpath-compared, mirrors the repo convention).
if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main(process.argv.slice(2)));
        }
    } catch {
        const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
        if (import.meta.url === argvUrl) {
            process.exit(main(process.argv.slice(2)));
        }
    }
}
