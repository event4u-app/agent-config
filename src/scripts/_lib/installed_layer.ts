/**
 * What a host actually loads, measured in the host's own unit (step 0.1 of
 * `road-to-a-rule-carrier-that-works-outside-the-repo`).
 *
 * THE QUESTION NOTHING IN THIS TREE COULD ANSWER. Every existing figure for the
 * installed layer counts raw bytes of whole files: `censusRuleDir` sums
 * `statSync().size`, `charsAtRoot` does the same for a directory, and
 * `check_preamble_payload_budget` reads both. A host does not load frontmatter
 * as instruction — it is the routing surface, which the router has already
 * read — and it does not render HTML comments, which are authoring scaffolding.
 * So the number a reader wants when they ask "how much instruction is this
 * consumer under" has never been computed here.
 *
 * THE NUMBER IS THEREFORE NOT COMPARABLE WITH ANY PUBLISHED BASELINE, and that
 * is stated here rather than discovered by someone holding the two side by
 * side. `chars` below is strictly smaller than the byte figures in
 * `budgets.yml`, `rule-activation-census.json` or the payload ratchet, and the
 * gap is not a constant — it is whatever that particular corpus spends on
 * frontmatter and comments.
 *
 * ONE LIBRARY, FOUR CONSUMERS. The report CLI is the only one wired in this
 * change (Phase 0 makes no behavior change), and the shape is the reason the
 * other three named in step 0.1 — CI, `doctor`, the upgrade receipt — can use
 * it without a second reader: every input is a PARAMETER. `home`, `projectRoot`
 * and `manifestPath` are supplied by the caller, never read off the process, so
 * a test, a temporary `HOME` and a real machine are the same call with
 * different arguments. That is also what makes the step's "install into a
 * temporary HOME" reachable at all, and it is the fact that refutes
 * `check_standing_rule_delivery`'s header: a user-scope install IS observable
 * from CI, because the installer takes `HOME` from the environment.
 *
 * WHAT `package_owned` AND `foreign` MEAN, because the honest answer is three
 * valued and the report has two columns. `recordedOwnership` distinguishes
 * `recorded-unchanged`, `recorded-modified` and `unknown`, where `unknown` is
 * explicitly "this tree cannot say" rather than "foreign". The report folds the
 * first two into `package_owned` — both are files the manifest claims — and
 * reports the third as `foreign`, which therefore reads "not claimed by this
 * install", never "written by someone else". A machine with no manifest reports
 * every file foreign, which is the correct reading of no evidence and is why
 * {@link InstalledLayerReport.manifest_present} is in the output.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    GLOBAL_RULE_DIRS,
    PROJECT_RULE_DIRS,
    globalRuleLayerPath,
} from '../../install/globalRuleLayers.js';
import { NO_RECORDED_HASHES, readRecordedHashes } from '../../install/recordedOwnership.js';
import { ruleBody } from './rule_law_section.js';

/** How many files the per-directory ranking carries. Step 0.1 fixes it at 20. */
export const TOP_FILES = 20;

/** Which layer a directory belongs to — the two the host unions when it loads. */
export type LayerScope = 'global' | 'project';

/** One rule file, measured the way the host loads it. */
export interface RuleFileReading {
    /** Basename, which is what a reader opening the directory sees. */
    readonly file: string;
    /** Characters AFTER the frontmatter and block-comment strip. */
    readonly chars: number;
    /** False when the file carries a `paths:` key — then the host loads it on a path match. */
    readonly unconditional: boolean;
    /** True when the installed-tools manifest records this path, in either state. */
    readonly package_owned: boolean;
}

/** One host rule directory, which is the unit step 0.1 asks the report to be in. */
export interface LayerReading {
    /** Tool id, as `GLOBAL_RULE_DIRS` spells it. */
    readonly host: string;
    readonly scope: LayerScope;
    readonly dir: string;
    /** False when the directory does not exist — a real answer, never an error. */
    readonly present: boolean;
    readonly files: number;
    readonly unconditional: number;
    readonly chars: number;
    readonly package_owned: number;
    readonly foreign: number;
    /** The {@link TOP_FILES} largest, by the SAME measure as `chars`. */
    readonly top: readonly RuleFileReading[];
}

export interface InstalledLayerReport {
    readonly home: string;
    readonly project_root: string;
    /** `claude --version`, or `unknown`. Never fabricated. */
    readonly host_version: string;
    /** False when no installed-tools manifest resolved — then every file reads foreign. */
    readonly manifest_present: boolean;
    readonly layers: readonly LayerReading[];
    /** Every layer summed, which is what the host loads when it unions the two scopes. */
    readonly totals: {
        readonly files: number;
        readonly unconditional: number;
        readonly chars: number;
        readonly package_owned: number;
        readonly foreign: number;
    };
}

/**
 * Whether the host loads this file on every session rather than on a path match.
 *
 * `paths:` at the start of a line is the whole test, and it is the host's own
 * convention rather than this package's: `claudeRuleRewrite.ts` states it from
 * the emitting side — "with it a rule loads on a path match, without it the
 * rule loads unconditionally". `rule_activation_census.projection_reading` asks
 * the installed tree the same question with the same regex, so a file counted
 * unconditional here is counted unconditional there.
 *
 * SOURCE-SIDE CLASSIFICATION IS A DIFFERENT QUESTION and deliberately not used.
 * `classify_rule` reads `alwaysApply` and `type: always` to tell `always` from
 * `unconditional`, which matters when you are deciding what to emit. This
 * reads what WAS emitted, where the distinction has already been spent: an
 * Iron-Law rule and an untriggered tier-2 rule both arrive without `paths:` and
 * both load every session, which is the only property the host acts on.
 */
export function isUnconditional(text: string): boolean {
    return !/^paths:/m.test(text);
}

/**
 * Measure one directory.
 *
 * `.md` only, matching `censusRuleDir` and `topRulesByCost`, so the FILE count
 * is comparable with the existing byte censuses even though the character count
 * is not. Cursor's `.mdc` tree is therefore read as zero files, which is the
 * same blind spot every other census in this tree has and is not fixed here —
 * fixing it in one reader and not the others would make two counts that
 * disagree, which is worse than one that is openly partial.
 */
export function readLayer(
    host: string,
    scope: LayerScope,
    dir: string,
    recorded: ReadonlyMap<string, string | null>,
): LayerReading {
    const empty = { files: 0, unconditional: 0, chars: 0, package_owned: 0, foreign: 0, top: [] };
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return { host, scope, dir, present: false, ...empty };
    }
    const readings: RuleFileReading[] = [];
    for (const name of names.sort()) {
        if (!name.endsWith('.md')) continue;
        const abs = path.join(dir, name);
        let text: string;
        try {
            const st = fs.statSync(abs);
            if (!st.isFile()) continue;
            text = fs.readFileSync(abs, 'utf-8');
        } catch {
            continue; // a file that cannot be read is not a file the host loads
        }
        // RECORDED-BUT-MODIFIED IS STILL RECORDED. The report's two columns
        // answer "does this install claim the file"; `classifyOwnership` answers
        // the finer question the upgrade path needs — whether the bytes still
        // match — and folding that in here would give a column three meanings.
        const owned = recorded.has(abs);
        readings.push({
            file: name,
            // THE STRIP IS THE PROJECTOR'S OWN. `ruleBody` is what
            // `project_thin_rules` and the delivery carrier both call, so "what
            // a host loads" and "what a delivery carries" cannot drift into two
            // spellings of the same measurement.
            chars: ruleBody(text).length,
            unconditional: isUnconditional(text),
            package_owned: owned,
        });
    }
    const top = [...readings]
        // RANKED BY THE SAME MEASURE AS THE TOTAL, which is why
        // `preamble_byte_census.topRulesByCost` is not reused here: it ranks by
        // `statSync().size`, so its list and this total would be in different
        // units and the largest file by one could be absent from the other.
        .sort((a, b) => b.chars - a.chars || a.file.localeCompare(b.file))
        .slice(0, TOP_FILES);
    return {
        host,
        scope,
        dir,
        present: true,
        files: readings.length,
        unconditional: readings.filter((r) => r.unconditional).length,
        chars: readings.reduce((n, r) => n + r.chars, 0),
        package_owned: readings.filter((r) => r.package_owned).length,
        foreign: readings.filter((r) => !r.package_owned).length,
        top,
    };
}

export interface ReportOptions {
    readonly home: string;
    readonly projectRoot: string;
    /** The installed-tools manifest. Absent or unreadable means no ownership evidence. */
    readonly manifestPath?: string | null;
    /** Supplied rather than shelled, so a fixture is not at the mercy of a CLI being on PATH. */
    readonly hostVersion?: string;
}

/**
 * Read every host rule directory in both scopes.
 *
 * BOTH SCOPES, BECAUSE THE HOST UNIONS THEM. A reading of the global layer
 * alone would understate a consumer whose project carries its own rules, and
 * the carrier's own scope filter reads the union for the same reason
 * (`rule_layer_overlap.hostRuleLayerIds`).
 */
export function buildInstalledLayerReport(opts: ReportOptions): InstalledLayerReport {
    const manifestPath = opts.manifestPath ?? null;
    const recorded =
        manifestPath === null
            ? NO_RECORDED_HASHES
            : readRecordedHashes(manifestPath, opts.projectRoot);
    const layers: LayerReading[] = [];
    for (const host of Object.keys(GLOBAL_RULE_DIRS).sort()) {
        const dir = globalRuleLayerPath(host, opts.home);
        if (dir === null) continue;
        layers.push(readLayer(host, 'global', dir, recorded));
    }
    for (const rel of Object.keys(PROJECT_RULE_DIRS).sort()) {
        const host = PROJECT_RULE_DIRS[rel] as string;
        layers.push(readLayer(host, 'project', path.join(opts.projectRoot, rel), recorded));
    }
    const totals = layers.reduce(
        (acc, l) => ({
            files: acc.files + l.files,
            unconditional: acc.unconditional + l.unconditional,
            chars: acc.chars + l.chars,
            package_owned: acc.package_owned + l.package_owned,
            foreign: acc.foreign + l.foreign,
        }),
        { files: 0, unconditional: 0, chars: 0, package_owned: 0, foreign: 0 },
    );
    return {
        home: opts.home,
        project_root: opts.projectRoot,
        host_version: opts.hostVersion ?? 'unknown',
        manifest_present: manifestPath !== null && fs.existsSync(manifestPath),
        layers,
        totals,
    };
}

/** The report as lines, for a terminal. One directory per block. */
export function renderInstalledLayerReport(report: InstalledLayerReport): string[] {
    const out: string[] = [];
    out.push(`installed layer — host ${report.host_version}, HOME ${report.home}`);
    out.push(`project ${report.project_root}`);
    out.push(
        report.manifest_present
            ? 'ownership: read from the installed-tools manifest'
            : 'ownership: NO manifest resolved — every file reads foreign, which is no evidence rather than a finding',
    );
    for (const l of report.layers) {
        if (!l.present) {
            out.push(`  ${l.host} (${l.scope}) — absent: ${l.dir}`);
            continue;
        }
        out.push(
            `  ${l.host} (${l.scope}) — ${String(l.files)} files, ` +
                `${String(l.unconditional)} unconditional, ${String(l.chars)} chars, ` +
                `${String(l.package_owned)} package-owned / ${String(l.foreign)} foreign`,
        );
        for (const f of l.top) {
            out.push(
                `      ${String(f.chars).padStart(7)}  ${f.unconditional ? 'uncond' : 'scoped'}  ${f.file}`,
            );
        }
    }
    const t = report.totals;
    out.push(
        `  TOTAL — ${String(t.files)} files, ${String(t.unconditional)} unconditional, ` +
            `${String(t.chars)} chars, ${String(t.package_owned)} package-owned / ${String(t.foreign)} foreign`,
    );
    return out;
}
