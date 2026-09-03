#!/usr/bin/env tsx
/**
 * Artefact-count messaging gate (road-to-truth-and-reference-hygiene Phase 1).
 *
 * Generalises `check_command_count_messaging.ts` (which stays wired as
 * `task check-command-count` — its badge/browse anchors are required-check
 * contract surface and are NOT removed here) from commands-only to every
 * artefact kind: any count-shaped prose mention of skills / commands /
 * governed rules / guidelines / personas on a flagship public surface must
 * equal the canonical source count, and no surface may carry two DIFFERENT
 * numbers for the same kind (the 150-vs-162-vs-166 failure mode that
 * motivated this gate).
 *
 * Ownership split:
 *   - `update_counts.ts` GENERATES the numbers into anchored positions
 *     (badges + prose) and `--check`s those exact anchors.
 *   - THIS gate SCANS the flagship surfaces for any count-shaped phrase —
 *     anchored or not — so a hand-typed new sentence with a stale number
 *     fails CI even though no anchor covers it yet.
 *   - `check_command_count_messaging.ts` keeps the command-specific
 *     active-vs-shim split checks.
 *
 * Scope: flagship surfaces (SURFACES below) PLUS every governed rule under
 * `src/rules/` (RULE_SURFACE_DIR). Rules were the largest hole this gate had:
 * they are the most-delivered surface this package ships — a wrong self-count
 * there reaches every consumer session — and the list below named sixteen doc
 * paths and no rule path. Dated census / analysis snapshots (SKILL_CENSUS,
 * skills-taxonomy, positioning-evidence, …) carry point-in-time counts by
 * design and are deliberately out of scope — the gate's charter is the surfaces
 * a fresh reader treats as current.
 *
 * Exit codes: 0 clean · 1 drift or internal inconsistency.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';
import { canonical_counts } from './check_command_count_messaging.js';
import { count, TARGETS } from './update_counts.js';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Flagship public prose surfaces (repo-relative). Missing files are skipped
 * with a warning so a doc rename does not hard-break the gate. */
export const SURFACES: readonly string[] = [
    'README.md',
    'AGENTS.md',
    'llms.txt',
    'docs/CLAIMS.md',
    'docs/getting-started.md',
    'docs/getting-started-by-role.md',
    'docs/architecture.md',
    'docs/command-flows.md',
    'docs/governance-advantage.md',
    'docs/featured-skills.md',
    'docs/featured-commands.md',
    'docs/proof.md',
    // Public submission text: the block here described version 3.2.0 with a
    // "4929 tests" figure while the package reached 9.7.0, because nothing
    // watched this file. Added 2026-07-25 so a hand-typed count here fails CI.
    'docs/distribution/registries.md',
    'site/src/content/docs/index.mdx',
    // NOT site/src/content/docs/claims.md — it is gitignored generated output
    // (site/sync-docs.mjs copies docs/CLAIMS.md into it), and docs/CLAIMS.md is
    // already checked above. Watching the copy added no coverage and turned a
    // stale LOCAL artefact into a red gate, while CI passed because the file is
    // absent there. A gate must judge repo content, not untracked local state.
];

/**
 * Governed rules, enumerated rather than listed.
 *
 * A hand-maintained list of 120 rule paths would go stale on the first rule
 * added, which is the drift class this gate exists to catch — so the rule
 * surface is a directory, walked at run time.
 */
export const RULE_SURFACE_DIR = 'src/rules';

export function rule_surfaces(root: string = ROOT): string[] {
    const dir = path.join(root, RULE_SURFACE_DIR);
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort()
        .map((f) => `${RULE_SURFACE_DIR}/${f}`);
}

/**
 * A count that belongs to a dated measurement, not to this package's live
 * totals.
 *
 * The gate's charter already excludes point-in-time snapshots; until now it
 * could only express that by leaving a whole FILE out. A rule may carry a dated
 * host measurement inside a paragraph of live prose, and neither excluding the
 * rule nor rewriting the measurement to today's total is correct — the second
 * falsifies recorded evidence. The marker is per line, and it is a claim a
 * reviewer can falsify: the line must name the date or the artefact the figure
 * was measured against.
 */
export const DATED_MEASUREMENT_MARKER = '<!-- artefact-count: dated-measurement -->';

/** kind → canonical-count resolver. "governed rules" is the canonical total
 * phrasing for rules; bare "N rules" is NOT matched (too many legitimate
 * subset scopes: kernel rules, router rules, maintainer-only rules …). */
const KIND_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['skills', /(~?)(\d+)\+?\s+skills\b/g],
    ['commands', /(~?)(\d+)\+?\s+commands\b/g],
    ['rules', /(~?)(\d+)\+?\s+governed rules\b/g],
    ['guidelines', /(~?)(\d+)\+?\s+guidelines\b/g],
    ['personas', /(~?)(\d+)\+?\s+personas\b/g],
];

export interface Finding {
    file: string;
    line: number;
    kind: string;
    found: number;
    expected: number;
    approx: boolean;
}

export function canonical_for(kind: string): number {
    if (kind === 'commands') {
        // Prose command mentions carry the ACTIVE count (total − shims),
        // matching the hero badge owned by check_command_count_messaging.
        const [, , active] = canonical_counts();
        return active;
    }
    return count(kind);
}

/** Scan one text body; returns findings + the per-kind numbers seen. */
export function scan_text(
    rel: string,
    text: string,
    expected: Readonly<Record<string, number>>,
): { findings: Finding[]; seen: Record<string, Set<number>> } {
    const findings: Finding[] = [];
    const seen: Record<string, Set<number>> = {};
    const lines = text.split('\n');
    for (const [kind, pattern] of KIND_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
            const re = new RegExp(pattern.source, pattern.flags);
            if (lines[i]!.includes(DATED_MEASUREMENT_MARKER)) {
                continue;
            }
            for (const m of lines[i]!.matchAll(re)) {
                const found = Number.parseInt(m[2]!, 10);
                (seen[kind] ??= new Set()).add(found);
                const exp = expected[kind]!;
                const approx = m[1] === '~';
                if (found !== exp || approx) {
                    findings.push({ file: rel, line: i + 1, kind, found, expected: exp, approx });
                }
            }
        }
    }
    return { findings, seen };
}

/** Structured-surface totals — generated files whose counts are YAML fields,
 * not prose, so the KIND_PATTERNS prose scan cannot see them. CAPABILITIES.yaml
 * proved this gap: it drifted to 268/177 while every prose surface said
 * 271/178, because only its own `--check` guarded it and a stale commit can
 * land through parallel merges. This scan makes the messaging gate a second,
 * independent net over the same canonical counts. */
export const STRUCTURED_SURFACES: ReadonlyArray<{
    file: string;
    fields: ReadonlyArray<[kind: string, pattern: RegExp]>;
}> = [
    {
        file: 'CAPABILITIES.yaml',
        fields: [
            ['skills', /^\s*skills_total:\s*(\d+)\s*$/m],
            ['commands', /^\s*commands_total:\s*(\d+)\s*$/m],
        ],
    },
];

export function scan_structured(
    rel: string,
    text: string,
    fields: ReadonlyArray<[string, RegExp]>,
    expected: Record<string, number>,
): { findings: Finding[]; seen: Record<string, Set<number>> } {
    const findings: Finding[] = [];
    const seen: Record<string, Set<number>> = {};
    for (const [kind, pattern] of fields) {
        const m = text.match(pattern);
        if (m === null) {
            continue; // absent field is the generator's own --check's problem
        }
        const found = Number.parseInt(m[1]!, 10);
        (seen[kind] ??= new Set()).add(found);
        const exp = expected[kind]!;
        if (found !== exp) {
            const line = text.slice(0, m.index ?? 0).split('\n').length;
            findings.push({ file: rel, line, kind, found, expected: exp, approx: false });
        }
    }
    return { findings, seen };
}

// --- Anchor-coverage pass (road-to-reproducible-artefact-counts) ----------
//
// The two gates used to overlap only by accident. This scanner flags any
// count-shaped prose; `update_counts` rewrites a hand-written list of
// anchors. Nothing asserted the second list covered the first, so positions
// existed that the scanner could turn red and the generator could not fix —
// the README Commands badge and the getting-started browse line drifted to
// 191 against a canonical 192 exactly there, each explicitly left unanchored
// to "avoid double-ownership". The reconciliation was a human's job, and the
// gate's own advice said so ("run update_counts … OR correct the prose").
//
// This pass removes the human: every position this scanner can flag must be
// rewritable by the generator, or be a generated file whose source is. A new
// count-shaped sentence with no anchor now fails CI as a coverage gap.

/**
 * Scanner kind → the generator kinds that legitimately write it.
 *
 * One prose kind can have several canonical numbers and they are NOT
 * interchangeable: "N commands" in prose means ACTIVE commands (total minus
 * deprecation shims), and a scoped-projection sentence carries the projected
 * skill count beside the catalog total. Anchoring an active-count position
 * to the raw `commands` total would silently write the wrong number the day
 * a command is superseded — which is why this is a mapping and not equality.
 */
const ANCHOR_KINDS: Readonly<Record<string, readonly string[]>> = {
    skills: ['skills', 'skills_scoped'],
    commands: ['commands', 'commands_active'],
    rules: ['rules'],
    guidelines: ['guidelines'],
    personas: ['personas'],
};

/**
 * Surfaces regenerated from an anchored source — exempt because fixing the
 * source fixes them. Each entry names the generator, so the exemption stays
 * falsifiable rather than becoming a place to hide drift.
 */
export const GENERATED_DOWNSTREAM: Readonly<Record<string, string>> = {
    'docs/proof.md': 'generated from docs/CLAIMS.md by src/scripts/build_proof.ts',
};

export interface CoverageGap {
    file: string;
    line: number;
    kind: string;
    text: string;
}

/**
 * Positions this scanner can flag that `update_counts` cannot rewrite.
 *
 * A position counts as anchored when some `TARGETS` pattern for the same
 * file, bound to a compatible kind, matches the same line.
 *
 * `src/rules/**` is scanned for VALUE drift but is deliberately excluded from
 * this pass, and the reason is mechanical rather than stylistic: satisfying it
 * would require `update_counts` to become a writer into `src/rules/`, where the
 * kernel rules live behind `block_kernel_rule_writes`. A generator that must
 * never touch part of its own target directory is a generator waiting to be
 * disarmed by a path move. So a stale count in a rule fails on value and a human
 * fixes it — the coverage claim this pass makes stays true of the surfaces it
 * actually covers, instead of being widened into a claim it cannot keep.
 */
export function anchor_coverage_gaps(root: string = ROOT): CoverageGap[] {
    const anchorsByFile = new Map<string, ReadonlyArray<[string, string]>>();
    for (const [rel, patterns] of TARGETS) {
        anchorsByFile.set(rel, patterns);
    }

    const gaps: CoverageGap[] = [];
    for (const rel of SURFACES) {
        if (rel in GENERATED_DOWNSTREAM) continue;
        const p = path.join(root, rel);
        if (!fs.existsSync(p)) continue;
        const lines = fs.readFileSync(p, 'utf-8').split('\n');
        const anchors = anchorsByFile.get(rel) ?? [];
        for (const [kind, pattern] of KIND_PATTERNS) {
            const allowed = ANCHOR_KINDS[kind] ?? [kind];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i]!;
                const re = new RegExp(pattern.source, pattern.flags);
                if (!re.test(line)) continue;
                const anchored = anchors.some(
                    ([raw, anchorKind]) =>
                        allowed.includes(anchorKind) && new RegExp(raw).test(line),
                );
                if (!anchored) {
                    gaps.push({ file: rel, line: i + 1, kind, text: line.trim().slice(0, 100) });
                }
            }
        }
    }
    return gaps;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const QUIET = argv.includes('--quiet');
    // Enumerated, not listed. An empty walk means the rule tree moved and this
    // gate is watching nothing — a dead scope, never a clean run.
    const rules = rule_surfaces();
    if (rules.length === 0) {
        process.stderr.write(
            `❌  check_artefact_count_messaging: ${RULE_SURFACE_DIR}/ resolved to no .md file — ` +
                'the rule surface moved and this gate would pass by blindness.\n',
        );
        return 1;
    }
    // This gate walks no tree — it guards a hand-maintained surface list, and
    // every missing entry is skipped with a warning so nothing hard-breaks on a
    // doc rename. That tolerance is also the failure mode: a repo-wide docs
    // move leaves every surface "skipped" and the gate reporting all counts in
    // sync. Deleting these paths must fail, never quieten, the gate.
    try {
        assertWatchlistResolves({
            gate: 'check_artefact_count_messaging',
            candidates: [...SURFACES, ...STRUCTURED_SURFACES.map((s) => s.file), ...rules],
            repoRoot: ROOT,
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 1 is this gate's only non-zero code.
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    const expected: Record<string, number> = {};
    for (const [kind] of KIND_PATTERNS) {
        expected[kind] = canonical_for(kind);
    }
    process.stdout.write(
        `Canonical: skills=${expected['skills']} commands=${expected['commands']} ` +
            `rules=${expected['rules']} guidelines=${expected['guidelines']} ` +
            `personas=${expected['personas']}\n`,
    );

    const allFindings: Finding[] = [];
    const global_seen: Record<string, Set<number>> = {};
    for (const rel of [...SURFACES, ...rules]) {
        const p = path.join(ROOT, rel);
        if (!fs.existsSync(p)) {
            process.stderr.write(`  ⚠️  surface missing (skipped): ${rel}\n`);
            continue;
        }
        const { findings, seen } = scan_text(rel, fs.readFileSync(p, 'utf-8'), expected);
        allFindings.push(...findings);
        for (const [kind, nums] of Object.entries(seen)) {
            for (const n of nums) (global_seen[kind] ??= new Set()).add(n);
        }
    }

    for (const { file, fields } of STRUCTURED_SURFACES) {
        const p = path.join(ROOT, file);
        if (!fs.existsSync(p)) {
            process.stderr.write(`  ⚠️  surface missing (skipped): ${file}\n`);
            continue;
        }
        const { findings, seen } = scan_structured(file, fs.readFileSync(p, 'utf-8'), fields, expected);
        allFindings.push(...findings);
        for (const [kind, nums] of Object.entries(seen)) {
            for (const n of nums) (global_seen[kind] ??= new Set()).add(n);
        }
    }

    // Internal-inconsistency check — the regression case this gate exists
    // for: multiple DIFFERENT numbers for one kind across the surfaces.
    const inconsistent: string[] = [];
    for (const [kind, nums] of Object.entries(global_seen)) {
        if (nums.size > 1) {
            inconsistent.push(`${kind}: {${[...nums].sort((a, b) => a - b).join(', ')}}`);
        }
    }

    // Anchor coverage — every position this gate can flag must be a position
    // `update_counts` can rewrite, so the two never need a human to reconcile.
    const gaps = anchor_coverage_gaps();

    if (allFindings.length === 0 && inconsistent.length === 0 && gaps.length === 0) {
        if (!QUIET) {
            process.stdout.write(
                '✅  All artefact-count prose in sync with source, every position anchored.\n',
            );
        }
        return 0;
    }

    if (allFindings.length > 0 || inconsistent.length > 0) {
        process.stdout.write(
            `❌  Artefact-count messaging drift — ${allFindings.length} mismatch(es):\n`,
        );
        for (const f of allFindings) {
            const tag = f.approx ? ' (approximation "~" not allowed on flagship surfaces)' : '';
            process.stdout.write(
                `    ${f.file}:${f.line}: ${f.kind} says ${f.found}, expected ${f.expected}${tag}\n`,
            );
        }
        for (const line of inconsistent) {
            process.stdout.write(`    internal inconsistency — ${line}\n`);
        }
        process.stdout.write(
            '\nFix: on a flagship surface, run `./scripts-run src/scripts/update_counts` —\n' +
                'every anchored position is generator-written, so never hand-type one there.\n' +
                `Under ${RULE_SURFACE_DIR}/ the generator does not write (the kernel rules live\n` +
                'there behind block_kernel_rule_writes), so a rule count is a hand edit: correct\n' +
                'the number, or — if the figure is a dated measurement rather than a live\n' +
                `self-count — mark that line \`${DATED_MEASUREMENT_MARKER}\` and say what it was\n` +
                'measured against.\n',
        );
    }

    if (gaps.length > 0) {
        process.stdout.write(
            `❌  Anchor-coverage gap — ${gaps.length} position(s) this gate checks but\n` +
                '    `update_counts` cannot rewrite:\n',
        );
        for (const g of gaps) {
            process.stdout.write(`    ${g.file}:${g.line}: ${g.kind} — ${g.text}\n`);
        }
        process.stdout.write(
            '\nFix: add an anchor for each position to `TARGETS` in\n' +
                '`src/scripts/update_counts.ts`, bound to the kind that position\n' +
                'actually carries (`commands_active` for active-command mentions,\n' +
                '`skills_scoped` for the projected-skill figure). If the file is\n' +
                'generated from an anchored source, register it in\n' +
                '`GENERATED_DOWNSTREAM` with the generator that produces it.\n',
        );
    }
    return 1;
}

function _isCliEntry(): boolean {
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

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
