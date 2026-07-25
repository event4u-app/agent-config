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

/** `**Mode:** \`extend\`` — the header form the override contract specifies. */
export function parse_mode(text: string): 'extend' | 'replace' | 'unknown' {
    const m = /^\s*\*\*Mode:\*\*\s*`?(extend|replace)`?\s*$/im.exec(text);
    return m ? (m[1] as 'extend' | 'replace') : 'unknown';
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

export function audit(): OverrideRow[] {
    if (!fs.existsSync(OVERRIDES_RULES)) return [];
    const floor = safety_floor_ids(RULES_DIR);
    const registered = fs.existsSync(REGISTRY)
        ? registered_rules(fs.readFileSync(REGISTRY, 'utf-8'))
        : new Set<string>();

    const rows: OverrideRow[] = [];
    for (const name of fs.readdirSync(OVERRIDES_RULES).sort()) {
        if (!name.endsWith('.md')) continue;
        const rule = name.replace(/\.md$/, '');
        const kernel = is_kernel_rule(rule);
        const is_floor = floor.has(rule);
        if (!kernel && !is_floor) continue; // ordinary override — not this gate's business

        const text = fs.readFileSync(path.join(OVERRIDES_RULES, name), 'utf-8');
        const mode = parse_mode(text);
        const cited = has_citation(text);
        const is_registered = registered.has(rule);

        const violations: string[] = [];
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

        rows.push({
            rule,
            file: path.relative(REPO_ROOT, path.join(OVERRIDES_RULES, name)),
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

function main(argv: string[]): number {
    const as_json = argv.includes('--json');
    const strict = argv.includes('--strict');
    const rows = audit();

    if (as_json) {
        process.stdout.write(JSON.stringify({ kernel_overrides: rows }, null, 2) + '\n');
        return 0;
    }

    const bad = rows.filter((r) => r.violations.length > 0);

    if (rows.length === 0) {
        process.stdout.write(
            `✅  override audit: 0 kernel / safety-floor overrides present ` +
                `(${KERNEL_RULE_IDS.length} kernel rules, none overridden)\n`,
        );
        return 0;
    }

    const lines: string[] = [];
    lines.push(
        `override audit: ${rows.length} kernel / safety-floor override(s) · ` +
            `${rows.filter((r) => r.registered).length} registered · ${bad.length} with findings`,
    );
    for (const r of rows) {
        const tag = r.kernel ? 'kernel' : 'safety-floor';
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
            `❌  lint_override_kernel_guard: ${bad.length} override(s) violate the non-overridable class\n`,
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
