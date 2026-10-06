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
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    GLOBAL_RULE_DIRS,
    PROJECT_RULE_DIRS,
    globalRuleLayerPath,
} from '../../install/globalRuleLayers.js';
import { NO_RECORDED_HASHES, readRecordedHashes } from '../../install/recordedOwnership.js';
import {
    INVENTORY_BASENAME,
    inventory_path,
    load_inventory,
    recorded_absolute_files,
} from './global_deploy_inventory.js';
import { DEFAULT_EVENT4U_ROOT_RELATIVE } from './user_global_paths.js';
import { ruleBody, splitFrontmatter } from './rule_law_section.js';

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
    /**
     * The same split as `package_owned` / `foreign`, in CHARACTERS.
     *
     * Both axes are kept because they answer different questions and the file
     * counts alone cannot answer the one step 1.4 asks. "How many of the files
     * does this install claim" is a reaping question; "how much of what the
     * host loads does this install account for" is a budget question, and one
     * 30,000-character rule against twenty 200-character ones makes the two
     * readings disagree by an order of magnitude. The limit rows below are
     * built from the character axis for exactly that reason.
     */
    readonly package_owned_chars: number;
    readonly foreign_chars: number;
    /**
     * `chars`, split by WHEN the host loads the file — the second axis.
     *
     * `unconditional` already counts the FILES the host loads every session;
     * these two count their characters, and the pair is what a ceiling can
     * actually be read against. A layer of 100 files can be 90 % path-scoped by
     * file count and 90 % unconditional by character count, so a ceiling stated
     * in characters cannot be answered from the file counts at all — which is
     * the gap step 1.1 closes.
     *
     * `unconditional_chars + scoped_chars === chars` holds by construction:
     * {@link isUnconditional} is a total predicate over the same readings the
     * total sums, so no file lands in both buckets or in neither.
     *
     * NOT the same split as `package_owned_chars` / `foreign_chars`. That pair
     * answers "whose file is this"; this pair answers "when does the host load
     * it". A file can be package-owned and path-scoped at once, and the two
     * splits are therefore independent rather than refinements of each other.
     */
    readonly unconditional_chars: number;
    readonly scoped_chars: number;
    /** The {@link TOP_FILES} largest, by the SAME measure as `chars`. */
    readonly top: readonly RuleFileReading[];
}

/**
 * The fraction of a published limit at which the report warns.
 *
 * 0.8 is step 1.4's number, not a tuned one. It is a WARNING threshold and
 * never a gate: crossing it changes what the report says and nothing else, so
 * no install fails here.
 */
export const LIMIT_WARN_FRACTION = 0.8;

/** What this tree can say about a host's published instruction budget. */
export type HostLimitKind = 'vendor-published' | 'reported' | 'unpublished';

/**
 * One host, measured against its published limit — step 3.5's per-host row.
 *
 * The row is per HOST and not per directory, because the limit applies to what
 * the host loads and the host unions its global and project layers. A host
 * whose two directories are each comfortably under the limit can still be over
 * it together, and a per-directory row would never show that.
 */
export interface HostLimitReading {
    readonly host: string;
    /** `null` when this tree records no limit — which fires no warning. */
    readonly limit: number | null;
    readonly kind: HostLimitKind;
    /** Every scope for this host, summed. */
    readonly chars: number;
    readonly package_owned_chars: number;
    readonly foreign_chars: number;
    /** `chars / limit`, or `null` when there is no limit to be a fraction of. */
    readonly fraction: number | null;
    /**
     * True only when a limit EXISTS and the combined total reaches
     * {@link LIMIT_WARN_FRACTION} of it — 80 %, not 100 %. The field is an
     * early warning, which is the whole point of a fraction below 1.
     *
     * An absent limit never warns. That is the conservative direction and it is
     * deliberate: a warning derived from a limit nobody recorded would be a
     * fabricated finding, which is worse than a silent row a reader can see is
     * unmeasured.
     */
    readonly warn: boolean;
}

export interface InstalledLayerReport {
    readonly home: string;
    readonly project_root: string;
    /** `claude --version`, or `unknown`. Never fabricated. */
    readonly host_version: string;
    /**
     * False when no installed-tools MANIFEST resolved.
     *
     * No longer the same question as "is there ownership evidence" — read
     * {@link ownership_source} for that. A global-only install has no manifest
     * and full evidence; keeping this field answers the narrower question a
     * project-scoped reader still asks.
     */
    readonly manifest_present: boolean;
    /** Which evidence answered ownership. `none` means no evidence, never "not ours". */
    readonly ownership_source: OwnershipSource;
    /** Every contributor, because the layers span two path spaces. See {@link OwnershipResolution.sources}. */
    readonly ownership_sources: readonly OwnershipSource[];
    readonly layers: readonly LayerReading[];
    /** One row per host, against its published limit. Step 3.5. */
    readonly limits: readonly HostLimitReading[];
    /** Every layer summed, which is what the host loads when it unions the two scopes. */
    readonly totals: {
        readonly files: number;
        readonly unconditional: number;
        readonly chars: number;
        readonly package_owned: number;
        readonly foreign: number;
        readonly package_owned_chars: number;
        readonly foreign_chars: number;
        /** The when-loaded split, summed. See {@link LayerReading.unconditional_chars}. */
        readonly unconditional_chars: number;
        readonly scoped_chars: number;
    };
}

/**
 * Whether the host loads this file on every session rather than on a path match.
 *
 * `paths:` at the start of a line IN THE FRONTMATTER is the whole test, and it
 * is the host's own convention rather than this package's: `claudeRuleRewrite`
 * states it from the emitting side — "with it a rule loads on a path match,
 * without it the rule loads unconditionally".
 *
 * SCOPED TO THE FRONTMATTER, which it was not until 2026-10-06. The predicate
 * tested the whole unstripped file while the characters it partitions come
 * from `ruleBody` — predicate and measure read different strings. That was
 * survivable while it only moved a file COUNT; since the when-loaded character
 * split it decides which bucket a whole file's characters land in, and
 * `unconditional_chars` is the figure the ceiling argument is read in. One body
 * line beginning `paths:` — a YAML trigger example quoted inside a kernel or
 * `no_stub` rule, which is ordinary prose — would have moved that rule's entire
 * character count from standing to path-scoped, silently.
 *
 * Measured before the change: of the 105 files on a real opted-in install, two
 * are path-scoped by either reading and none carries a body-only mention, so
 * the fix moves no published figure. It is hardening against a case that does
 * not exist yet rather than a correction of one that does, and it is worth
 * making precisely because the failure would be silent.
 *
 * `check_single_delivery` already slices the frontmatter before this test, so
 * this now AGREES with it. `rule_activation_census.projection_reading` still
 * scans the whole file; that reader counts files rather than characters, so the
 * divergence costs it nothing today, and changing a census's reading belongs to
 * that census rather than here. Named so the next reader finds a known
 * difference instead of discovering an unexplained one.
 *
 * SOURCE-SIDE CLASSIFICATION IS A DIFFERENT QUESTION and deliberately not used.
 * `classify_rule` reads `alwaysApply` and `type: always` to tell `always` from
 * `unconditional`, which matters when you are deciding what to emit. This
 * reads what WAS emitted, where the distinction has already been spent: an
 * Iron-Law rule and an untriggered tier-2 rule both arrive without `paths:` and
 * both load every session, which is the only property the host acts on.
 */
export function isUnconditional(text: string): boolean {
    // THE SAME FUNCTION that produces the characters being partitioned, not the
    // same arithmetic re-implemented. An earlier version scanned for
    // `'\n---'` while `ruleBody` -> `splitFrontmatter` scans for `'\n---\n'`,
    // so the two disagreed about where the frontmatter stops, and the
    // predicate's early stop could hide a later `paths:` key.
    const [frontmatter] = splitFrontmatter(text);
    // AND THE BLIND SPOT THAT SCOPING OPENS, CLOSED HERE. `splitFrontmatter`
    // returns `''` for anything that does not begin exactly `---\n` — a BOM, a
    // leading blank line, CRLF, a block that never closes — and scoping to `''`
    // reads every such file as unconditional even when its frontmatter carries
    // `paths:`. `readLayer` measures every `.md` in a host directory, foreign
    // user-authored rules included, so that would inflate `unconditional_chars`
    // silently, which is the figure the whole ceiling argument is read in.
    //
    // A file that CLAIMS a block `splitFrontmatter` could not parse falls back
    // to the whole-text test, which is the conservative direction: it can only
    // move characters out of the standing bucket, never into it. The claim test
    // is the one `installThinLayer` already uses for the same blind spot, and
    // is a regex rather than `startsWith('---')` for the reason stated there.
    if (frontmatter === '' && /^\uFEFF?[\s]*---/.test(text)) {
        return !/^paths:/m.test(text);
    }
    return !/^paths:/m.test(frontmatter);
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
    const empty = {
        files: 0,
        unconditional: 0,
        chars: 0,
        package_owned: 0,
        foreign: 0,
        package_owned_chars: 0,
        foreign_chars: 0,
        unconditional_chars: 0,
        scoped_chars: 0,
        top: [],
    };
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
        package_owned_chars: readings.reduce((n, r) => n + (r.package_owned ? r.chars : 0), 0),
        foreign_chars: readings.reduce((n, r) => n + (r.package_owned ? 0 : r.chars), 0),
        unconditional_chars: readings.reduce((n, r) => n + (r.unconditional ? r.chars : 0), 0),
        scoped_chars: readings.reduce((n, r) => n + (r.unconditional ? 0 : r.chars), 0),
        top,
    };
}

/** The shape of one entry in `src/config/host-instruction-limits.json`. */
interface RawHostLimit {
    readonly limit?: unknown;
    readonly kind?: unknown;
}

/**
 * Where the limits live, derived from this module rather than from `cwd`.
 *
 * The two `..` hops climb from `src/scripts/_lib` to `src/`, which is where
 * `config/` lives — NOT to the package root, though the comment said so until
 * 2026-10-05. The result is correct and the arithmetic stated for it was not,
 * which is the half a future reader would trust when changing the hops.
 *
 * `fileURLToPath`, NOT `new URL(...).pathname` — the claimed parity with
 * `default_template_path()` was only half true until 2026-10-05. A `pathname`
 * percent-encodes, so a package under a directory with a space resolved to
 * `/Users/x/My%20Projects/...`, and on Windows it yields a leading-slash drive
 * path. Either way the read fails, `loadHostInstructionLimits` swallows it and
 * returns an empty map, and EVERY host then reads `unpublished` with `warn`
 * false — the budget measurement degrading to "not measured" with no signal,
 * which is the one failure mode this file's own limit table was written to
 * avoid.
 */
export function defaultHostLimitsPath(): string {
    return path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'config',
        'host-instruction-limits.json',
    );
}

/**
 * Read the published-limit table.
 *
 * TOLERANT IN ONE DIRECTION ONLY. An unreadable or malformed file yields an
 * EMPTY table, so every host reads `unpublished` and nothing warns — a reading
 * this tree cannot stand behind must never become a warning it can. A present
 * entry whose `limit` is not a positive finite number is treated the same way,
 * because a `0` or a string would otherwise make every install look saturated.
 */
export function loadHostInstructionLimits(
    file: string = defaultHostLimitsPath(),
): ReadonlyMap<string, { limit: number | null; kind: HostLimitKind }> {
    const out = new Map<string, { limit: number | null; kind: HostLimitKind }>();
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        return out; // no table ⇒ no limits ⇒ no warnings
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
    for (const [host, v] of Object.entries(raw as Record<string, unknown>)) {
        if (host.startsWith('_')) continue; // `_comment` and friends are not hosts
        if (typeof v !== 'object' || v === null || Array.isArray(v)) continue;
        const e = v as RawHostLimit;
        const n = e.limit;
        const limit = typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
        const k = e.kind;
        const kind: HostLimitKind =
            limit === null
                ? 'unpublished'
                : k === 'vendor-published' || k === 'reported'
                  ? k
                  : 'reported'; // a cited figure with no stated kind is the weaker one
        out.set(host, { limit, kind });
    }
    return out;
}

/**
 * Fold the per-directory readings into one row per host, against its limit.
 *
 * Exported so a caller holding layers it built itself — the install receipt,
 * which measures before and after — can produce the same rows without
 * re-reading the tree.
 */
export function buildHostLimitRows(
    layers: readonly LayerReading[],
    limits: ReadonlyMap<string, { limit: number | null; kind: HostLimitKind }>,
): HostLimitReading[] {
    const byHost = new Map<string, { chars: number; owned: number; foreign: number }>();
    for (const l of layers) {
        if (!l.present) continue;
        const acc = byHost.get(l.host) ?? { chars: 0, owned: 0, foreign: 0 };
        acc.chars += l.chars;
        acc.owned += l.package_owned_chars;
        acc.foreign += l.foreign_chars;
        byHost.set(l.host, acc);
    }
    // EVERY host that has a directory gets a row, present or not — a host whose
    // layer is absent reads 0 against its limit, which is a real answer and the
    // one step 3.5 asks for ("one row per host with a published limit").
    for (const l of layers) if (!byHost.has(l.host)) byHost.set(l.host, { chars: 0, owned: 0, foreign: 0 });
    // AND every host the LIMITS table knows, whether or not a layer reached it.
    // Rows were layer-driven while the requirement is limit-driven, so a limit
    // recorded for a host the layer map does not list disappeared silently —
    // the two sources agree today, which means they can only diverge in the
    // direction the code did not cover.
    for (const [host, e] of limits) if (e.limit !== null && !byHost.has(host)) {
        byHost.set(host, { chars: 0, owned: 0, foreign: 0 });
    }
    const rows: HostLimitReading[] = [];
    for (const host of [...byHost.keys()].sort()) {
        const a = byHost.get(host) as { chars: number; owned: number; foreign: number };
        const e = limits.get(host) ?? { limit: null, kind: 'unpublished' as HostLimitKind };
        const fraction = e.limit === null ? null : a.chars / e.limit;
        rows.push({
            host,
            limit: e.limit,
            kind: e.kind,
            chars: a.chars,
            package_owned_chars: a.owned,
            foreign_chars: a.foreign,
            fraction,
            warn: fraction !== null && fraction >= LIMIT_WARN_FRACTION,
        });
    }
    return rows;
}

/** Which evidence answered "is this file ours". Never a guess — see {@link resolveLayerOwnership}. */
export type OwnershipSource = 'manifest' | 'global-inventory' | 'this-deploy' | 'none';

/**
 * Where `deployed-files.json` lives FOR A STATED HOME.
 *
 * `global_deploy_inventory.inventory_path()` answers for the process asking,
 * honouring `AGENT_CONFIG_DEPLOY_INVENTORY` and `EVENT4U_CONFIG_HOME`. That is
 * right for the installer, which is running the install it is recording, and
 * WRONG for a reader measuring some other home: a report about a staged install
 * under a temporary HOME would read the maintainer's own inventory and claim
 * ownership of files that install never wrote.
 *
 * SO AN EXPLICITLY SUPPLIED HOME WINS, AND THE ENV OVERRIDES DECIDE ONLY THE
 * HOME-LESS CASE. A caller that says which home it is measuring has already
 * answered the question those variables would answer for it, and letting the
 * asking process's environment override that is exactly the hazard named above.
 * An intermediate draft of this function had the precedence the other way round
 * while this paragraph said what it says now; the code is what changed.
 *
 * THE CONSEQUENCE, STATED RATHER THAN IMPLIED: `ReportOptions.home` is
 * REQUIRED, so every caller of {@link buildInstalledLayerReport} supplies one
 * and neither env override reaches this reader through that path. That is
 * correct — those variables describe the asking process's own install, which is
 * not what a report about another home is measuring — but it means "honours the
 * env override" is not a true sentence about the report, and saying so here is
 * cheaper than leaving the next reader to discover it.
 *
 * The layout is COMPOSED from the modules that own it rather than re-spelled,
 * so a layout change moves this reader with it instead of leaving it looking in
 * a directory nobody writes.
 */
export function defaultInventoryPath(home?: string | null): string {
    // NO HOME STATED — the asking process is the subject, so the env-aware
    // resolver is the right answer.
    if (home === undefined || home === null || home === '') return inventory_path();
    // THE STATED HOME IS THE ASKING PROCESS'S OWN. `ReportOptions.home` is
    // required, so `buildInstalledLayerReport` ALWAYS states one — including
    // when it is simply measuring the machine it is running on. Treating that
    // as "a different home" sent it to the hardcoded layout, found nothing
    // under `EVENT4U_CONFIG_HOME` or `AGENT_CONFIG_DEPLOY_INVENTORY`, and
    // printed "NO manifest and NO deploy inventory resolved" — the
    // `0 package-owned` reading step 1.2 exists to remove, and it put the
    // report and the receipt in disagreement about one install.
    //
    // The precedence argument only ever covered a home that is NOT this
    // process's, so that is the case the branch now tests for.
    try {
        if (path.resolve(home) === path.resolve(os.homedir())) return inventory_path();
    } catch {
        // `homedir()` can throw on an exotic environment; fall through to the
        // layout, which is the answer for a home that is not ours anyway.
    }
    return path.join(home, DEFAULT_EVENT4U_ROOT_RELATIVE, INVENTORY_BASENAME);
}


/** The ownership evidence and the name of where it came from. */
export interface OwnershipResolution {
    /** Absolute path → recorded hash (or `null` when the source records no hash). */
    readonly recorded: ReadonlyMap<string, string | null>;
    /**
     * EVERY source that contributed at least one path, in resolution order.
     *
     * Plural because the sources describe disjoint path spaces — a manifest
     * speaks for a project tree, an inventory for the user's home — so a
     * reading that covers both layers can legitimately have two, and naming
     * only one is wrong about the files the other accounts for.
     */
    readonly sources: readonly OwnershipSource[];
    /** The most specific contributor, for a reader that wants one word. `none` when empty. */
    readonly source: OwnershipSource;
}

/** What {@link resolveLayerOwnership} may read. Every input is a parameter. */
export interface OwnershipOptions {
    /** Where the project manifest would be. Absent file → fall through, never an error. */
    readonly manifestPath?: string | null;
    /** Needed only to resolve the manifest's relative entries. */
    readonly projectRoot: string;
    /**
     * The home the install being measured lives under.
     *
     * The inventory records its anchor tilde-relative (`~/.claude/`), so a
     * reader measuring a staged install under a temporary HOME must say which
     * home, or the recorded paths resolve against the asking process's own and
     * claim nothing. Omitted → `os.homedir()`.
     */
    readonly home?: string | null | undefined;
    /** `deployed-files.json`. `undefined` reads the user-global default; `null` reads none. */
    readonly inventoryPath?: string | null | undefined;
    /**
     * Anchor → anchor-relative paths THIS run just wrote.
     *
     * The first-install case, and the reason it needs its own input: the
     * install receipt prints before `record_deploy`, so on a first install the
     * inventory on disk is still empty and the only evidence that the files are
     * ours is the set the installer is holding. Passing it is counting this
     * deploy's own file set — not a claim about any earlier one.
     *
     * CLOSED FOR ONE ANCHOR OF FIVE, stated rather than implied. The only
     * production caller (`install.ts`, inside the `claude-code` branch) passes
     * a single-entry map for that anchor, while `installReceiptBudgetLines`
     * reads all five `GLOBAL_RULE_DIRS`. So on a genuine first install the
     * cursor, augment, windsurf and cline global layers still read foreign in
     * the receipt. That is narrower than "the first install is covered", which
     * an earlier version of this paragraph said, and it is the honest scope:
     * the receipt is printed from the one branch that has a file set to offer.
     */
    readonly thisDeploy?: ReadonlyMap<string, Iterable<string>> | null | undefined;
}

/**
 * The ONE place that answers "which of these installed files are ours".
 *
 * Two readers ask it — the installed-layer report and the install receipt's
 * budget lines — and until step 1.2 they asked different things. Both called
 * `manifest_path(...)` and read a project-scoped `agents/installed-tools.lock`.
 * A global-only install writes nothing into a project, so on exactly the
 * install shape the thinned-layer roadmap's AC-1 is about, both reported
 * `0 package-owned / N foreign` and AC-1's figure could not be produced at all.
 *
 * The global install DOES record what it wrote: `deployed-files.json` lists,
 * per tool, the anchor and every file the installer maintains there —
 * "the ownership proof that makes reaping safe". This reads it.
 *
 * IT IS A UNION, AND THE PATH SPACES ARE WHY. An earlier shape let the project
 * manifest win OUTRIGHT whenever its file existed, on the reasoning that it
 * carries hashes an inventory does not. That reasoning does not survive the
 * observation that the two sources describe DISJOINT sets of paths: the
 * manifest records project-relative entries resolved against `projectRoot`,
 * the inventory records paths under the user's home. Exclusivity therefore
 * bought nothing and cost everything — any `agents/installed-tools.lock` on
 * disk, a gitignored file a single project-scoped install creates, restored
 * the exact `0 package-owned` reading for the global layer that step 1.2
 * exists to fix, while the report printed "read from the installed-tools
 * manifest" with no evidence behind it for those paths.
 *
 * So every source contributes, and the MANIFEST IS MERGED LAST: on the paths
 * it names its hash overwrites a hashless entry, which preserves the
 * `recorded-unchanged` / `recorded-modified` distinction that motivated the
 * precedence in the first place, without discarding evidence about paths it
 * says nothing about.
 *
 * {@link OwnershipResolution.sources} lists every source that contributed at
 * least one path, because one word cannot describe two path spaces — a report
 * reading global and project layers together may have manifest evidence for
 * one and inventory evidence for the other, and saying only one of them is
 * wrong about half the files it is describing.
 *
 * A FILE THE USER EDITED AND THE INSTALLER PRESERVED STILL COUNTS AS
 * MAINTAINED. The inventory records what the installer MAINTAINS at a path, not
 * what the bytes currently are, so a preserved rule stays package-owned. That
 * is the correct reading — the package is still responsible for the path — and
 * it is why this function returns `null` hashes rather than fabricating one.
 */
export function resolveLayerOwnership(opts: OwnershipOptions): OwnershipResolution {
    const recorded = new Map<string, string | null>();
    const sources: OwnershipSource[] = [];

    // HASHLESS SOURCES FIRST, so the manifest's hashes overwrite a `null` on
    // any path both happen to name rather than the other way round.
    if (opts.inventoryPath !== null) {
        let n = 0;
        try {
            const inv = load_inventory(opts.inventoryPath ?? defaultInventoryPath(opts.home));
            for (const abs of recorded_absolute_files(inv, opts.home ?? null)) {
                // COUNT PATHS NEWLY CONTRIBUTED, not entries read. Counting
                // reads named a source that added nothing — and
                // `recorded_absolute_files` emits two spellings per file, so it
                // also double-counted.
                if (!recorded.has(abs)) n += 1;
                recorded.set(abs, null);
            }
        } catch {
            // Defence in depth, and NOT where the documented behaviour lives.
            // "A corrupt inventory is no evidence, never a failure" is real but
            // is carried one module down: `load_inventory` swallows its own
            // read and parse failures and returns an empty shell, and
            // `recorded_absolute_files` type-guards every field. So this catch
            // is unreachable for that reason and the fixture case named for it
            // exercises `load_inventory`, not this guard. Kept because a future
            // change to either could make it reachable; labelled so it is not
            // mistaken for tested coverage.
        }
        if (n > 0) sources.push('global-inventory');
    }

    let fromDeploy = 0;
    for (const [anchor, rels] of opts.thisDeploy ?? new Map()) {
        for (const rel of rels) {
            const abs = path.resolve(anchor, rel);
            // Same rule as the inventory branch: a source is named only when it
            // contributes a path nothing else had. On every install after the
            // first, `thisDeploy`'s paths are already in the inventory, and
            // naming it there printed "the file set this install just wrote"
            // for a source that added nothing.
            if (!recorded.has(abs)) fromDeploy += 1;
            recorded.set(abs, null);
            // Both spellings, for the reason `recorded_absolute_files` states:
            // the reader compares against a lexically joined path, and a HOME
            // behind a symlink makes the two disagree.
            try {
                recorded.set(fs.realpathSync(abs), null);
            } catch {
                // Not on disk — the lexical spelling is all there is.
            }
        }
    }
    if (fromDeploy > 0) sources.push('this-deploy');

    const manifestPath = opts.manifestPath ?? null;
    if (manifestPath !== null && fs.existsSync(manifestPath)) {
        let n = 0;
        for (const [abs, hash] of readRecordedHashes(manifestPath, opts.projectRoot)) {
            // The manifest contributes whenever it names a path at all: it
            // supplies the HASH even where another source already had the path,
            // which is evidence the others cannot give.
            n += 1;
            recorded.set(abs, hash);
        }
        if (n > 0) sources.push('manifest');
    }

    if (recorded.size === 0) {
        return { recorded: NO_RECORDED_HASHES, sources: [], source: 'none' };
    }
    // `source` keeps a single word for readers that want one. The manifest is
    // the most specific evidence, so it leads when it contributed; otherwise
    // the inventory, otherwise this deploy's own set.
    const primary =
        sources.includes('manifest')
            ? 'manifest'
            : sources.includes('global-inventory')
              ? 'global-inventory'
              : 'this-deploy';
    return { recorded, sources, source: primary };
}

export interface ReportOptions {
    readonly home: string;
    readonly projectRoot: string;
    /** The installed-tools manifest. Absent or unreadable falls through to the global inventory. */
    readonly manifestPath?: string | null;
    /** `deployed-files.json`. `undefined` reads the user-global default; `null` reads none. */
    readonly inventoryPath?: string | null | undefined;
    /** Supplied rather than shelled, so a fixture is not at the mercy of a CLI being on PATH. */
    readonly hostVersion?: string;
    /**
     * The published-limit table. A parameter for the same reason `home` is: a
     * fixture must be able to state the limit it is measuring against instead
     * of inheriting whatever the shipped config happens to say today.
     */
    readonly hostLimitsPath?: string | null;
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
    const { recorded, source: ownership_source, sources: ownership_sources } = resolveLayerOwnership({
        manifestPath,
        projectRoot: opts.projectRoot,
        home: opts.home,
        inventoryPath: opts.inventoryPath,
    });
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
            package_owned_chars: acc.package_owned_chars + l.package_owned_chars,
            foreign_chars: acc.foreign_chars + l.foreign_chars,
            unconditional_chars: acc.unconditional_chars + l.unconditional_chars,
            scoped_chars: acc.scoped_chars + l.scoped_chars,
        }),
        {
            files: 0,
            unconditional: 0,
            chars: 0,
            package_owned: 0,
            foreign: 0,
            package_owned_chars: 0,
            foreign_chars: 0,
            unconditional_chars: 0,
            scoped_chars: 0,
        },
    );
    const limits = buildHostLimitRows(
        layers,
        loadHostInstructionLimits(opts.hostLimitsPath ?? defaultHostLimitsPath()),
    );
    return {
        home: opts.home,
        project_root: opts.projectRoot,
        host_version: opts.hostVersion ?? 'unknown',
        manifest_present: manifestPath !== null && fs.existsSync(manifestPath),
        ownership_source,
        ownership_sources,
        layers,
        limits,
        totals,
    };
}

/**
 * One line naming WHICH evidence answered ownership.
 *
 * Exported so the report and the install receipt say the same sentence about
 * the same source — a consumer comparing a receipt against a later report must
 * not have to decide whether a wording difference means a different reading.
 */
export function ownershipLine(sources: OwnershipSource | readonly OwnershipSource[]): string {
    const list = (Array.isArray(sources) ? sources : [sources as OwnershipSource]).filter(
        (s) => s !== 'none',
    );
    if (list.length === 0) {
        return 'ownership: NO manifest and NO deploy inventory resolved — every file reads foreign, which is no evidence rather than a finding';
    }
    // EVERY contributor is named, never just one. The sources cover disjoint
    // path spaces, so a line naming one of two is a true sentence about half
    // the files and a false one about the rest.
    const phrases: Record<Exclude<OwnershipSource, 'none'>, string> = {
        manifest: 'the installed-tools manifest',
        'global-inventory': 'the global deploy inventory (deployed-files.json)',
        'this-deploy': 'the file set this install just wrote',
    };
    const named = list.map((s) => phrases[s as Exclude<OwnershipSource, 'none'>]);
    const joined =
        named.length === 1
            ? (named[0] as string)
            : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1] as string}`;
    return `ownership: read from ${joined}`;
}

/** The report as lines, for a terminal. One directory per block. */
export function renderInstalledLayerReport(report: InstalledLayerReport): string[] {
    const out: string[] = [];
    out.push(`installed layer — host ${report.host_version}, HOME ${report.home}`);
    out.push(`project ${report.project_root}`);
    out.push(ownershipLine(report.ownership_sources));
    for (const l of report.layers) {
        if (!l.present) {
            out.push(`  ${l.host} (${l.scope}) — absent: ${l.dir}`);
            continue;
        }
        out.push(
            `  ${l.host} (${l.scope}) — ${String(l.files)} files ` +
                `(${String(l.unconditional)} unconditional), ${String(l.chars)} chars ` +
                `(${String(l.unconditional_chars)} standing + ${String(l.scoped_chars)} path-scoped), ` +
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
        `  TOTAL — ${String(t.files)} files (${String(t.unconditional)} unconditional), ` +
            `${String(t.chars)} chars ` +
            `(${String(t.unconditional_chars)} standing + ${String(t.scoped_chars)} path-scoped), ` +
            `${String(t.package_owned)} package-owned / ${String(t.foreign)} foreign`,
    );
    out.push(...renderHostLimitRows(report.limits));
    return out;
}

/**
 * The budget block — one row per host, against its published limit.
 *
 * Extracted so the REPORT and the INSTALL RECEIPT print the same bytes. They
 * answer the same question at two moments, and a consumer comparing a receipt
 * against a later report must not have to decide whether a wording difference
 * means a measurement difference.
 */
export function renderHostLimitRows(rows: readonly HostLimitReading[]): string[] {
    // ONE ROW PER HOST, against its published limit — steps 1.4 and 3.5. The
    // combined figure is what the row is about: a consumer's own instruction
    // files sit in the same budget as this package's, so a package-owned number
    // alone would understate what the host is actually holding.
    const out: string[] = [
        'host instruction budgets — package-owned + foreign against the published limit',
    ];
    for (const r of rows) {
        const split =
            `${String(r.package_owned_chars)} package-owned + ` +
            `${String(r.foreign_chars)} foreign = ${String(r.chars)} chars`;
        if (r.limit === null) {
            out.push(`  ${r.host} — ${split}; no published limit recorded — not measured`);
            continue;
        }
        const pct = ((r.fraction as number) * 100).toFixed(1);
        out.push(
            `  ${r.host} — ${split}; ${pct}% of ${String(r.limit)} (${r.kind})` +
                (r.warn
                    ? ` — WARNING: at or past ${String(Math.round(LIMIT_WARN_FRACTION * 100))}% of the published limit`
                    : ''),
        );
    }
    return out;
}
