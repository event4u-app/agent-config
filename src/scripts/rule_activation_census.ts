#!/usr/bin/env node
/**
 * Rule-activation census — which rules the Claude host projection scopes, and why.
 *
 * `road-to-mixed-trigger-activation-cost` step 1.0. It exists because the field
 * check that roadmap inherited from its source analysis is **refuted as a
 * discriminator**:
 *
 *     grep -l '^paths:' .claude/rules/*.md | wc -l
 *
 * The source predicted ~25 for a pre-guard projection and ~6 for a post-guard
 * one, so a colleague could decide in one minute whether the mixed-trigger flip
 * was live on their machine. Run on a maintainer checkout it returns **0** —
 * neither number — because `.claude/rules/` is a generated, gitignored artefact
 * whose scope and freshness are unknown at read time. A reading of 0 is
 * consistent with "the flip is live", with "this projection was generated at a
 * different `--scope`", and with "this projection is simply stale", and the
 * grep cannot tell those apart. A probe whose three possible causes are
 * indistinguishable is not a probe.
 *
 * This census reads the **source** instead, and reads it through the emitter's
 * own exported functions rather than a reimplementation: `_parse_frontmatter`
 * for the frontmatter, `_has_non_path_trigger` for the mixed test, and
 * `_claude_paths_plan` for the verdict. So "would this rule be scoped" is
 * answered by the code that actually decides it — the method the source
 * analysis used across two tags, applied to one tree.
 *
 * `_parse_frontmatter` is exported from `condense.ts` for exactly this, and it is
 * the reason the export carries only a one-line pointer there: `condense.ts` sits
 * far above the 1,500-line source ceiling, so every line added to it counts
 * against the `check_source_size_budget` ratchet. The rationale lives here, in a
 * file the ratchet does not charge, rather than in the file it does.
 * A reimplemented parse is the divergence class that made the shipped
 * `.claude/rules/` count unreadable as evidence in the first place.
 *
 * What it does NOT do, stated because the distinction is the whole point: it
 * does not tell you what a given machine's `.claude/rules/` currently holds.
 * That is a property of an install, not of the repo. `--projection` reads the
 * host projection alongside the source and reports the two side by side,
 * labelled, so a divergence is visible as a divergence instead of being averaged
 * into one misleading number.
 *
 * CLI contract: exit 0 always on a successful scan — this is an instrument, not
 * a gate. `--json` emits the machine-readable record, `--projection <dir>` adds
 * the host-projection column, `--quiet` suppresses the human table.
 * The gate that ratchets these numbers is `check_rule_activation_census.ts`
 * (step 4.1); keeping measurement and enforcement in separate files is why this
 * one has no failure exit.
 *
 * The filename is deliberately NOT `check_`/`lint_`-prefixed. That prefix set is
 * what `_lib/gate_population.ts` treats as gate-shaped, and a file in the gate
 * population owes the ledger a per-target accounting — which an instrument that
 * cannot fail has nothing honest to report. The name carries the distinction so
 * no `// ledger-exempt:` marker is needed here; a marker would assert an
 * exemption from an obligation this file never incurs.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isExclusivelyPackageOnly } from '../install/partitionEligibility.js';
import { _claude_paths_plan, _has_non_path_trigger, _parse_frontmatter } from './condense.js';

const RULES_DIR = path.join('src', 'rules');

/** Trigger keys that describe a file path rather than prompt text. */
const PATH_TRIGGER_KEYS = ['file_pattern', 'path_prefix'] as const;

/** Trigger keys that describe prompt text rather than a file path. */
const TEXT_TRIGGER_KEYS = ['keyword', 'phrase'] as const;

export interface RuleActivation {
    /** Rule id — the basename without `.md`. */
    id: string;
    /** `always` / `auto` / `manual`, or `unknown` when the field is absent. */
    type: string;
    /** Declares at least one `file_pattern` or `path_prefix` trigger. */
    has_path_trigger: boolean;
    /** Declares at least one `keyword` or `phrase` trigger. */
    has_text_trigger: boolean;
    /** Both of the above — the class the mixed-triggers guard governs. */
    mixed: boolean;
    /** Globs the emitter would write under `paths:`. Empty means unconditional. */
    emitted_globs: string[];
    /** Patterns the emitter deliberately drops, with the reason it records. */
    dropped: { pattern: string; reason: string }[];
    /**
     * Scoped to this package alone, so ADR-236 withholds it from every global
     * host layer. Load-bearing for the projection comparison: a package-only
     * rule is counted by the source verdict and is absent from a delivered
     * tree by design, not by drift.
     */
    package_only: boolean;
    /**
     * The emitter's verdict in one word.
     * `scoped` — loads on a path match · `unconditional` — loads every session ·
     * `always` — an Iron-Law rule, unconditional by design and never a candidate.
     */
    verdict: 'scoped' | 'unconditional' | 'always';
}

function _trigger_list(meta: Record<string, unknown>): Record<string, unknown>[] {
    const raw = meta['triggers'];
    if (!Array.isArray(raw)) return [];
    return raw.filter(
        (t): t is Record<string, unknown> =>
            t !== null && typeof t === 'object' && !Array.isArray(t),
    );
}

function _declares(meta: Record<string, unknown>, keys: readonly string[]): boolean {
    for (const t of _trigger_list(meta)) {
        for (const k of keys) {
            const v = t[k];
            if (typeof v === 'string' && v) return true;
        }
    }
    return false;
}

/** Classify one rule file through the emitter's own exported decision path. */
export function classify_rule(
    id: string,
    content: string,
    package_only = false,
): RuleActivation {
    const [meta] = _parse_frontmatter(content);
    const plan = _claude_paths_plan(meta);
    const has_path_trigger = _declares(meta, PATH_TRIGGER_KEYS);
    const has_text_trigger = _declares(meta, TEXT_TRIGGER_KEYS);
    const type = typeof meta['type'] === 'string' ? (meta['type'] as string) : 'unknown';
    const always = Boolean(meta['alwaysApply'] || type === 'always');

    // `_has_non_path_trigger` is the guard's own predicate and is deliberately
    // narrower than `has_text_trigger` looks: it ignores `command:` triggers.
    // Reported separately rather than conflated, because a rule that is mixed by
    // the guard's definition is the one that flipped.
    const mixed = has_path_trigger && _has_non_path_trigger(meta);

    let verdict: RuleActivation['verdict'];
    if (always) verdict = 'always';
    else if (plan.globs.length > 0) verdict = 'scoped';
    else verdict = 'unconditional';

    return {
        id,
        type,
        has_path_trigger,
        has_text_trigger,
        mixed,
        emitted_globs: plan.globs,
        dropped: plan.dropped.map((d) => ({ pattern: d.pattern, reason: d.reason })),
        verdict,
        package_only,
    };
}

export function census(root: string): RuleActivation[] {
    const dir = path.join(root, RULES_DIR);
    const files = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.isDirectory() && e.name.endsWith('.md'))
        .map((e) => e.name)
        .sort();
    return files.map((f) =>
        classify_rule(
            f.replace(/\.md$/, ''),
            fs.readFileSync(path.join(dir, f), 'utf8'),
            isExclusivelyPackageOnly(path.join(dir, f)),
        ),
    );
}

/**
 * Read a host projection's own `paths:` count.
 *
 * Reported beside the source census, never merged into it. The two answer
 * different questions — "what would the emitter do with this tree" versus "what
 * does this directory currently contain" — and the second carries no record of
 * the scope or the commit it was generated at, which is exactly why the grep it
 * replaces could not be read as evidence.
 */
export function projection_reading(dir: string): { files: number; with_paths: number } | null {
    if (!fs.existsSync(dir)) return null;
    const files = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.isDirectory() && e.name.endsWith('.md'))
        .map((e) => e.name);
    let with_paths = 0;
    for (const f of files) {
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        if (/^paths:/m.test(text)) with_paths += 1;
    }
    return { files: files.length, with_paths };
}

export interface CensusSummary {
    total: number;
    path_shaped: number;
    mixed: number;
    path_only: number;
    scoped: number;
    unconditional: number;
    always: number;
    mixed_ids: string[];
    path_only_ids: string[];
    scoped_ids: string[];
}

export function summarize(rows: RuleActivation[]): CensusSummary {
    const path_shaped = rows.filter((r) => r.has_path_trigger);
    const mixed = path_shaped.filter((r) => r.mixed);
    const path_only = path_shaped.filter((r) => !r.mixed);
    return {
        total: rows.length,
        path_shaped: path_shaped.length,
        mixed: mixed.length,
        path_only: path_only.length,
        scoped: rows.filter((r) => r.verdict === 'scoped').length,
        unconditional: rows.filter((r) => r.verdict === 'unconditional').length,
        always: rows.filter((r) => r.verdict === 'always').length,
        mixed_ids: mixed.map((r) => r.id),
        path_only_ids: path_only.map((r) => r.id),
        scoped_ids: rows.filter((r) => r.verdict === 'scoped').map((r) => r.id),
    };
}

function _arg(flag: string): string | null {
    const argv = process.argv.slice(2);
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

export function main(): number {
    const argv = process.argv.slice(2);
    const as_json = argv.includes('--json');
    const quiet = argv.includes('--quiet');
    const root = _arg('--root') ?? process.cwd();
    const projection_dir = _arg('--projection');

    const rows = census(root);
    const sum = summarize(rows);
    const resolved_projection_dir =
        projection_dir === undefined || projection_dir === null || projection_dir === ''
            ? ''
            : path.isAbsolute(projection_dir)
              ? projection_dir
              : path.join(root, projection_dir);
    const projection = projection_dir
        ? projection_reading(resolved_projection_dir)
        : null;

    if (as_json) {
        process.stdout.write(
            `${JSON.stringify({ summary: sum, projection, rules: rows }, null, 2)}\n`,
        );
        return 0;
    }
    if (quiet) return 0;

    process.stdout.write('Rule-activation census — source of truth is src/rules/\n\n');
    process.stdout.write(`  rule files                     ${sum.total}\n`);
    process.stdout.write(`  declaring a path-shaped trigger ${sum.path_shaped}\n`);
    process.stdout.write(`    …of those, MIXED (also keyword/phrase) ${sum.mixed}\n`);
    process.stdout.write(`    …of those, path-only                   ${sum.path_only}\n`);
    process.stdout.write('\n  emitter verdict:\n');
    process.stdout.write(`    scoped (loads on a path match) ${sum.scoped}\n`);
    process.stdout.write(`    unconditional (every session)  ${sum.unconditional}\n`);
    process.stdout.write(`    always (Iron Law, by design)   ${sum.always}\n`);

    if (sum.mixed > 0) {
        process.stdout.write(
            `\n  the mixed set — these load every session and are the flip's cost:\n`,
        );
        for (const id of sum.mixed_ids) process.stdout.write(`    - ${id}\n`);
    }

    if (projection) {
        process.stdout.write(
            `\n  host projection at ${projection_dir} — reported SEPARATELY, not merged:\n` +
                `    files ${projection.files} · declaring paths: ${projection.with_paths}\n`,
        );
        // The source verdict counts EVERY rule in `src/rules/`. A GLOBAL host
        // layer does not carry the package-only ones: ADR-236 partitions them to
        // the project layer, so such a tree is expected to be short by exactly
        // that many. Comparing the raw counts reported a divergence on every
        // partitioned install forever — the emitter was right and the
        // comparator was not subtracting.
        //
        // But the subtraction is NOT unconditional, and making it so was its own
        // regression (completion review, 2026-08-30): a full or project-layer
        // projection — which is also the fail-safe default `partitionEligibility`
        // returns on a fresh checkout, an absent install record, or a version or
        // fingerprint mismatch — DOES carry those rules, and for this repo's own
        // project layer `source-of-truth` is the one rule delivered there and the
        // only one declaring `paths:`. Subtracting it there inverts the line.
        //
        // So the partition is DETECTED from the projection rather than assumed:
        // if a package-only rule's file is present, this is not a global layer.
        const pkg_only_ids = rows.filter((r) => r.package_only).map((r) => r.id);
        const partitioned = !pkg_only_ids.some((id) =>
            fs.existsSync(path.join(resolved_projection_dir, `${id}.md`)),
        );
        const scoped_pkg_only = partitioned
            ? rows.filter((r) => r.verdict === 'scoped' && r.package_only)
            : [];
        const expected = sum.scoped - scoped_pkg_only.length;
        if (scoped_pkg_only.length > 0) {
            process.stdout.write(
                `    source scopes ${sum.scoped}; ${scoped_pkg_only.length} of those ` +
                    `${scoped_pkg_only.length === 1 ? 'is' : 'are'} package-only and never\n` +
                    `      delivered (${scoped_pkg_only.map((r) => r.id).join(', ')}), so a ` +
                    `partitioned projection is\n      expected to declare ${expected}.\n`,
            );
        }
        if (projection.with_paths !== expected) {
            process.stdout.write(
                `    ⚠️  diverges from the source verdict (${expected} expected` +
                    `${scoped_pkg_only.length > 0 ? `, ${sum.scoped} before the package-only partition` : ''}).\n` +
                    `        A projection carries no record of the scope or commit it was generated\n` +
                    `        at, so this is a reason to regenerate it — never a reading of the\n` +
                    `        emitter.\n`,
            );
        } else {
            process.stdout.write(
                `    ✅  consistent with the source verdict (${expected} expected, ` +
                    `${projection.with_paths} found).\n`,
            );
        }
    } else if (projection_dir) {
        // Three states, kept apart on purpose. Collapsing "you asked and the
        // directory is not there" into "you did not ask" would reproduce, in this
        // script's own output, the exact conflation it was written to end — and a
        // fresh worktree has no `.claude/` at all, so this is the common case.
        process.stdout.write(
            `\n  host projection at ${projection_dir}: DIRECTORY ABSENT.\n` +
                '  Not a reading of zero — there is nothing to read. A generated projection is\n' +
                '  absent in a fresh worktree until `task generate-tools` has run.\n',
        );
    } else {
        process.stdout.write(
            '\n  no --projection given: this census describes the SOURCE only.\n' +
                '  It deliberately makes no claim about any machine\'s .claude/rules/.\n',
        );
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href) {
    const invoked = path.resolve(process.argv[1]);
    const self = path.resolve(fileURLToPath(import.meta.url));
    if (invoked === self) process.exit(main());
}
