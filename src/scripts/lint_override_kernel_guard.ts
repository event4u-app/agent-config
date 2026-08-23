#!/usr/bin/env tsx
/**
 * Override audit — kernel-rule overrides, reported rather than policed.
 *
 * The obvious design for this file was a build-failing lint on any kernel-named
 * file under `agents/overrides/rules/`. The council talked us out of it, and the
 * argument holds: the override layer is resolved by the *agent reading the
 * instructions*, not by a loader, so a consumer who wants a kernel rule relaxed
 * has other routes — a persona file, host-level agent config, a line in the
 * prompt. Failing the build on route one does not shrink that surface; it moves
 * the override to a route with no visibility at all, while the red X reads as
 * coverage. That is the exact "claims enforcement it does not have" defect this
 * whole roadmap exists to remove, pointed at ourselves.
 *
 * So the default output is a REPORT. A consumer reading "0 kernel overrides" or
 * "2 kernel overrides, both registered" learns something true.
 *
 * Two things do hard-fail, because on our own authoring surface the coverage
 * claim IS true:
 *   1. a `Mode: replace` override on a kernel / safety-floor rule — the class is
 *      non-replaceable, and this is mechanically decidable from the header;
 *   2. an `extend` on one with no entry in `agents/overrides/kernel-exceptions.yml`
 *      — tightening is allowed, going unrecorded is not.
 *
 * Honest limit, stated in-band: an `extend` block whose prose says "ignore
 * everything above" passes this check. No linter reads intent. The registry
 * entry is where a human records it, and the report is what makes it reviewable.
 *
 * The citation obligation (override-system.md § Citation obligation) binds
 * every override file, not only kernel/safety-floor ones — until now that was
 * doc-contract-only for ordinary overrides. This guard now also scans ordinary
 * (non-kernel, non-safety-floor) override files and raises a `missing-citation`
 * finding when the `> Overrides: <rule> §<section> — <reason>` line is absent.
 * The non-overridable-class checks (replace-on-kernel, unregistered-extend)
 * still apply only to kernel/safety-floor files, unchanged.
 *
 * Usage:
 *   ./scripts-run src/scripts/lint_override_kernel_guard            # report
 *   ./scripts-run src/scripts/lint_override_kernel_guard --json
 *   ./scripts-run src/scripts/lint_override_kernel_guard --strict   # + hard-fails
 *
 * Exit codes: 0 clean · 1 violation (--strict) · 2 usage/env error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { KERNEL_RULE_IDS, is_kernel_rule } from './_lib/kernel_rules.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');
const OVERRIDES_RULES = path.join(REPO_ROOT, 'agents', 'overrides', 'rules');
const REGISTRY = path.join(REPO_ROOT, 'agents', 'overrides', 'kernel-exceptions.yml');
const RULES_DIR = path.join(REPO_ROOT, 'src', 'rules');

export interface OverrideRow {
    rule: string;
    file: string;
    mode: 'extend' | 'replace' | 'unknown';
    kernel: boolean;
    safety_floor: boolean;
    registered: boolean;
    cited: boolean;
    violations: string[];
}

/**
 * `**Mode:** \`extend\`` — the header form the override contract specifies.
 *
 * Reads EVERY `**Mode:**` line, not the first. A non-global `exec` took
 * whichever declaration appeared earliest, and the override contract doc itself
 * carries two example `**Mode:**` lines — so a file whose real declaration is
 * `replace` could be read as `extend` from an example sitting above it. On a
 * safety-floor rule that is the difference between a blocked override and a
 * silently permitted one, which makes first-match-wins a bypass rather than a
 * parsing nit (road-to-gates-that-can-fail Phase 6.2, finding 5).
 *
 * Disagreeing declarations resolve to `unknown`, which the caller already
 * treats as a violation — fail closed. A guard that cannot tell which mode a
 * file declares must say so, never pick one.
 */
export function parse_mode(text: string): 'extend' | 'replace' | 'unknown' {
    const found = new Set<string>();
    const re = /^\s*\*\*Mode:\*\*\s*`?(extend|replace)`?\s*$/gim;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) found.add(m[1] as string);
    if (found.size !== 1) return 'unknown';
    return [...found][0] as 'extend' | 'replace';
}

/** `> Overrides: <rule> §<section> — <reason>` — the citation obligation. */
export function has_citation(text: string): boolean {
    return /^>\s*Overrides:\s*\S+.*—.+$/im.test(text);
}

/** Rule ids carrying `tier: safety-floor`, read from the rule sources. */
export function safety_floor_ids(rules_dir: string): Set<string> {
    const out = new Set<string>();
    if (!fs.existsSync(rules_dir)) return out;
    for (const name of fs.readdirSync(rules_dir)) {
        if (!name.endsWith('.md')) continue;
        const head = fs.readFileSync(path.join(rules_dir, name), 'utf-8').slice(0, 2000);
        if (/^tier:\s*"?safety-floor"?\s*$/im.test(head)) out.add(name.replace(/\.md$/, ''));
    }
    return out;
}

/**
 * Rule ids with a registered exception.
 *
 * Narrow reader, not a YAML dependency: the registry is a fixed two-level shape
 * and the only fact needed is which rules appear under `exceptions:`. Anything
 * more permissive would let a malformed registry read as coverage.
 */
export function registered_rules(text: string): Set<string> {
    const out = new Set<string>();
    let in_exceptions = false;
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (/^exceptions:\s*$/.test(line)) { in_exceptions = true; continue; }
        if (!in_exceptions) continue;
        if (/^\S/.test(line)) break;
        const rule_name = /^\s*-?\s*rule:\s*"?([a-z0-9-]+)"?\s*$/i.exec(line)?.[1];
        if (rule_name !== undefined) out.add(rule_name);
    }
    return out;
}

/**
 * Violations for one override file.
 *
 * Kernel / safety-floor files get the full non-overridable-class check
 * (unchanged from before this file gained an ordinary-override path): a
 * `replace` is refused, an undeclared mode is refused, and an unregistered
 * `extend` is refused — each in addition to the citation check every override
 * carries.
 *
 * An ordinary override gets only the citation check — the non-overridable
 * class does not apply to it — surfaced as the `missing-citation` finding
 * class per override-system.md § Citation obligation.
 */
export function classify_violations(input: {
    kernel: boolean;
    is_floor: boolean;
    mode: 'extend' | 'replace' | 'unknown';
    cited: boolean;
    is_registered: boolean;
}): string[] {
    const { kernel, is_floor, mode, cited, is_registered } = input;
    const violations: string[] = [];

    if (kernel || is_floor) {
        if (mode === 'replace') {
            violations.push(
                `\`replace\` on a ${kernel ? 'kernel' : 'safety-floor'} rule — this class may be tightened, never replaced`,
            );
        }
        if (mode === 'unknown') {
            violations.push(
                'no readable `**Mode:**` header — an override on this class must declare its mode',
            );
        }
        if (mode === 'extend' && !is_registered) {
            violations.push(
                `\`extend\` on a ${kernel ? 'kernel' : 'safety-floor'} rule with no entry in agents/overrides/kernel-exceptions.yml`,
            );
        }
        if (!cited) {
            violations.push('missing `> Overrides: <rule> §<section> — <reason>` citation');
        }
        return violations;
    }

    // Ordinary override — not the non-overridable class, but the citation
    // obligation binds it too (override-system.md § Citation obligation).
    if (!cited) {
        violations.push(
            'missing-citation: no `> Overrides: <rule> §<section> — <reason>` line ' +
                '(override-system.md § Citation obligation)',
        );
    }
    return violations;
}

/**
 * @param overridesDir  Directory of override files to audit. Defaults to the real
 *   `agents/overrides/rules/`; a caller passes a fixture directory so the
 *   reachability of the audit itself can be tested against a KNOWN pair rather
 *   than against whatever the tree happens to contain. Added by step 1.2 of
 *   `road-to-override-efficacy-proof`: with the path hardcoded, a test could only
 *   assert against the one real override, so a regression that stopped
 *   discovering files would still read clean on an empty directory.
 *
 *   Additive, with a default, so no existing caller changes.
 */
export function audit(overridesDir: string = OVERRIDES_RULES): OverrideRow[] {
    if (!fs.existsSync(overridesDir)) return [];
    const floor = safety_floor_ids(RULES_DIR);
    const registered = fs.existsSync(REGISTRY)
        ? registered_rules(fs.readFileSync(REGISTRY, 'utf-8'))
        : new Set<string>();

    const rows: OverrideRow[] = [];
    for (const name of fs.readdirSync(overridesDir).sort()) {
        if (!name.endsWith('.md')) continue;
        const rule = name.replace(/\.md$/, '');
        const kernel = is_kernel_rule(rule);
        const is_floor = floor.has(rule);

        const text = fs.readFileSync(path.join(overridesDir, name), 'utf-8');
        const mode = parse_mode(text);
        const cited = has_citation(text);
        const is_registered = registered.has(rule);
        const violations = classify_violations({ kernel, is_floor, mode, cited, is_registered });

        rows.push({
            rule,
            file: path.relative(REPO_ROOT, path.join(overridesDir, name)),
            mode,
            kernel,
            safety_floor: is_floor,
            registered: is_registered,
            cited,
            violations,
        });
    }
    return rows;
}

/**
 * Render the precedence table — step 1.4 of `road-to-override-efficacy-proof`.
 *
 * The audit's answer already existed as JSON nobody runs. This is the same answer
 * in a form a reviewer reads, and it is GENERATED rather than written: regenerating
 * it on an unchanged tree must produce no diff, so the table is a fact about the
 * tree rather than a snapshot of when someone last looked.
 *
 * Rows are sorted by `rule` (the audit already reads its directory sorted), and no
 * timestamp is emitted. A generated file carrying "last updated" changes on every
 * run and makes `git diff --exit-code` useless as a freshness check — the check the
 * step's verify actually performs.
 */
export function render_precedence_table(rows: readonly OverrideRow[]): string {
    const L: string[] = [];
    L.push('<!-- evidence-type: analysis -->');
    L.push('');
    L.push('<!-- GENERATED by `lint_override_kernel_guard --write-table`. Do not hand-edit. -->');
    L.push('');
    L.push('# Override precedence table');
    L.push('');
    L.push(
        'Every override in the tree, with the rule it overrides and its audit state. ' +
            'Generated from the same `audit()` the strict gate runs, so the table and the ' +
            'gate cannot disagree.',
    );
    L.push('');
    L.push(
        '**This is a DELIVERY table, not an efficacy claim.** It says an override file ' +
            'is discovered, resolves to a rule, and carries its citation. Whether the agent ' +
            'then behaves differently is a separate question, and it is measured nowhere in ' +
            'this table — see `road-to-override-efficacy-proof` Phase 2, deferred on ' +
            'population validity.',
    );
    L.push('');
    if (rows.length === 0) {
        L.push('No override files are present. That is a real and common state, not a fault.');
        L.push('');
        return L.join('\n');
    }
    L.push('| rule | mode | kernel | safety floor | registered | cited | violations |');
    L.push('|---|---|---|---|---|---|---|');
    for (const r of rows) {
        L.push(
            `| \`${r.rule}\` | \`${r.mode}\` | ${r.kernel ? 'yes' : 'no'} | ` +
                `${r.safety_floor ? 'yes' : 'no'} | ${r.registered ? 'yes' : 'no'} | ` +
                `${r.cited ? 'yes' : 'no'} | ${r.violations.length === 0 ? '—' : r.violations.join('; ')} |`,
        );
    }
    L.push('');
    L.push(`${String(rows.length)} override(s).`);
    L.push('');
    return L.join('\n');
}

function main(argv: string[]): number {
    const as_json = argv.includes('--json');
    const strict = argv.includes('--strict');
    const tableIdx = argv.indexOf('--write-table');

    // Not the override corpus: an empty `agents/overrides/rules/` is a real and
    // common state (the report says so in words). The scope that cannot be
    // allowed to die is `safety_floor_ids`' input — with src/rules gone the
    // floor set is empty, every safety-floor override downgrades to "ordinary",
    // and the replace/registration checks stop firing while the audit still
    // reads clean. Exit 2 is this CLI's env-error slot; 1 stays "contract
    // violated".
    let rule_sources = 0;
    try {
        rule_sources = fs.readdirSync(RULES_DIR).filter((n) => n.endsWith('.md')).length;
    } catch {
        rule_sources = 0;
    }
    try {
        assertScanned({
            gate: 'lint_override_kernel_guard',
            scanned: rule_sources,
            units: 'rule source(s)',
            roots: ['src/rules'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    const rows = audit();

    if (tableIdx >= 0) {
        const rel = argv[tableIdx + 1];
        if (rel === undefined || rel.startsWith('--')) {
            process.stderr.write('--write-table needs a path\n');
            return 2;
        }
        const out = path.join(REPO_ROOT, rel);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, render_precedence_table(rows), 'utf-8');
        process.stdout.write(
            `override precedence table: ${String(rows.length)} row(s) → ${rel}\n`,
        );
        return 0;
    }

    if (as_json) {
        process.stdout.write(JSON.stringify({ overrides: rows }, null, 2) + '\n');
        return 0;
    }

    const bad = rows.filter((r) => r.violations.length > 0);

    if (rows.length === 0) {
        process.stdout.write(
            `✅  override audit: 0 overrides present ` +
                `(${KERNEL_RULE_IDS.length} kernel rules, none overridden)\n`,
        );
        return 0;
    }

    const kernel_floor_rows = rows.filter((r) => r.kernel || r.safety_floor);
    const ordinary_rows = rows.filter((r) => !r.kernel && !r.safety_floor);

    const lines: string[] = [];
    lines.push(
        `override audit: ${rows.length} override(s) — ${kernel_floor_rows.length} kernel/safety-floor ` +
            `(${rows.filter((r) => r.registered).length} registered), ${ordinary_rows.length} ordinary · ` +
            `${bad.length} with findings`,
    );
    for (const r of rows) {
        const tag = r.kernel ? 'kernel' : r.safety_floor ? 'safety-floor' : 'ordinary';
        lines.push(`  · ${r.rule} [${tag}] mode=${r.mode} registered=${r.registered ? 'yes' : 'NO'}`);
        for (const v of r.violations) lines.push(`      ❌ ${v}`);
    }
    lines.push('');
    lines.push(
        '  Limit: this audits files under agents/overrides/. A rule can also be ' +
            'relaxed through a persona, host config, or a direct instruction — ' +
            'those routes are not visible here and are not claimed to be covered.',
    );
    process.stdout.write(lines.join('\n') + '\n');

    if (strict && bad.length > 0) {
        process.stderr.write(
            `❌  lint_override_kernel_guard: ${bad.length} override(s) violate the override contract\n`,
        );
        return 1;
    }
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
