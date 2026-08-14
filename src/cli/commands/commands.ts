/**
 * `agent-config commands` — native CLI discovery surface (6.0.0-C Phase 2 Step 5b).
 *
 *   agent-config commands [ls] [--pack <id>] [--visible] [--json]
 *       List the command surface from the discovery manifest. `--visible`
 *       restricts to visibility `visible`/`advanced`; `--pack` restricts to one
 *       owning pack.
 *
 *   agent-config commands explain <name> [--json]
 *       Print one command's intent, routes_to, owning pack, and visibility.
 *
 *   agent-config commands ls --candidates [--json]
 *       Structural report over the WHOLE command estate. Report-only: it ranks
 *       nothing for deletion and decides nothing. Cannot be combined with the
 *       narrowing flags (`--pack`, `--visible`, `--profile`, `--expanded`) —
 *       those are refused, not ignored.
 *
 * Reads `dist/discovery/discovery-manifest.json` — the single source of
 * truth, NOT a parallel catalog. Exits 0 on success, 1 on a missing/malformed
 * manifest or an unknown command name.
 *
 * WHY `--candidates` reads only the manifest, and why it is not named
 * `--prune` (roadmap `-release-integrity` step 3.4):
 *
 *   - `prune` is ALREADY a registered verb (`registry.ts`, `delegate`) and
 *     means "remove orphaned bridge markers against installed-tools.lock".
 *     A `--prune` flag here would read as "delete commands", which is the
 *     one thing this report must not do — the reduction targets belong to
 *     `road-to-surface-consolidation`, `road-to-solution-minimalism` and
 *     `road-to-tier-removal` (step 3.5).
 *   - The step's original wording pointed at `docs/SKILL_CENSUS.md` and
 *     `docs/artefact-census.md`. Both are DATED point-in-time snapshots,
 *     deliberately outside `check_artefact_count_messaging`'s scope, and
 *     `SKILL_CENSUS` states that no usage evidence backs its Keep/Prune
 *     calls. Rendering them as current would ship the unbacked claim this
 *     roadmap exists to remove.
 *   - The usage-backed signal (`utilization_report`'s D1/REAP) is NOT
 *     imported. That module's entry guard is an argv comparison with no
 *     `__AGENT_CONFIG_BUNDLE__` guard, and this file reaches the CLI bundle
 *     through `main.ts` — the precondition step 3.1 hit on
 *     `preamble_byte_census`. The report names it as the evidence owner
 *     instead of half-importing it.
 *
 * Every row therefore traces to a manifest field a reader can grep.
 */

import { loadManifest, ManifestNotFoundError, ManifestParseError } from '../discovery/loadManifest.js';
import type { DiscoveryArtefact, DiscoveryManifest } from '../discovery/loadManifest.js';
import { logger } from '../log/logger.js';
import { loadProfile, resolveProfileView } from './profiles.js';

export interface CommandsLsOptions {
    pack?: string;
    visible?: boolean;
    json?: boolean;
    profile?: string;
    expanded?: boolean;
    candidates?: boolean;
}

/** One command carrying a manifest-backed structural signal. */
export interface CandidateRow {
    readonly slug: string;
    readonly pack: string;
    readonly visibility: string;
    /** Prior names this command ABSORBED. Non-empty only for `absorbedNames`. */
    readonly replaces: readonly string[];
}

export interface CandidatesReport {
    readonly total: number;
    readonly byVisibility: Readonly<Record<string, number>>;
    /**
     * Commands declaring `replaces` — i.e. commands that ABSORBED prior names.
     *
     * NOT a retirement class, and the first version of this report got that
     * exactly backwards. `command.schema.json` is explicit: "`replaces` is set
     * on the NEW canonical command pointing back", and the retirement marker is
     * `superseded_by`, "set on the OLD shim pointing forward". Labelling this
     * bucket "deprecation shims" named `git-commit`, `git-pr-create` and
     * `fix-quality` — `visible` daily drivers — as the one evidenced cut class.
     *
     * The real shim population is **zero** and is NOT computable here:
     * `superseded_by` appears in no command file and is not emitted into the
     * discovery manifest, and `check_command_count_messaging` publishes the
     * CI-enforced canonical count "196 files · 0 shims · 196 active". The
     * report states that rather than substituting the inverse field for it.
     */
    readonly absorbedNames: readonly CandidateRow[];
    /** No `intent` in the manifest — undocumented surface, not a prune call. */
    readonly noIntent: readonly CandidateRow[];
    /** Owning-pack distribution, heaviest first. */
    readonly byPack: readonly (readonly [string, number])[];
}

export interface CommandsExplainOptions {
    json?: boolean;
}

function loadOrReport(): DiscoveryManifest | null {
    try {
        return loadManifest();
    } catch (err) {
        if (err instanceof ManifestNotFoundError) {
            logger.error(
                `discovery manifest not found at ${err.path} — run ` +
                    "'./scripts-run src/scripts/build_discovery_manifest --write' " +
                    'or install a published release.',
            );
            return null;
        }
        if (err instanceof ManifestParseError) {
            logger.error(err.message);
            return null;
        }
        logger.error(err instanceof Error ? err.message : String(err));
        return null;
    }
}

function commandArtefacts(manifest: DiscoveryManifest): DiscoveryArtefact[] {
    return manifest.artefacts.filter((a) => a.category === 'command' && a.name);
}

// `visibility` is the sole classifier since manifest v3 dropped the integer
// `tier` alias (road-to-tier-removal Phase 4). The default is the hidden one,
// which is what the retired `tier ?? 2` fallback also resolved to — an entry
// that names no visibility is never treated as a daily driver.
function visibilityOf(a: DiscoveryArtefact): string {
    return a.visibility ?? 'internal';
}

function renderTable(cmds: readonly DiscoveryArtefact[]): string {
    const header = ['command', 'pack', 'visibility', 'intent'];
    const rows: string[][] = cmds.map((c) => [
        // Canonical invocation slug (ADR-044) when present, else the name.
        c.slug ?? c.name ?? '',
        c.pack ?? (c.packs[0] ?? '—'),
        visibilityOf(c),
        c.intent ?? '—',
    ]);
    const widths = header.map((h, i) =>
        Math.max(h.length, rows.reduce((acc, r) => Math.max(acc, (r[i] ?? '').length), 0)),
    );
    const fmt = (cells: string[]): string =>
        cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
    const lines = [fmt(header), fmt(widths.map((w) => '-'.repeat(w)))];
    for (const row of rows) lines.push(fmt(row));
    return lines.join('\n');
}

/** Visibility buckets in a fixed order, so the report is byte-stable. */
const VISIBILITY_ORDER: readonly string[] = ['visible', 'advanced', 'internal'];

/** Text-mode enumeration cap. Measured on the real manifest, the undocumented
 * set is 166 of 196 commands — dumping it buries the counts that make the
 * report readable. The cap is NAMED in the output whenever it bites (a silent
 * truncation reads as "that is the whole set"), and `--json` is never capped. */
export const TEXT_LIST_CAP = 12;

function candidateRow(c: DiscoveryArtefact): CandidateRow {
    return {
        slug: c.slug ?? c.name ?? '',
        pack: c.pack ?? (c.packs[0] ?? '—'),
        visibility: visibilityOf(c),
        replaces: c.replaces ?? [],
    };
}

export function buildCandidatesReport(cmds: readonly DiscoveryArtefact[]): CandidatesReport {
    const byVisibility: Record<string, number> = {};
    for (const label of VISIBILITY_ORDER) byVisibility[label] = 0;
    const packCounts = new Map<string, number>();
    const absorbedNames: CandidateRow[] = [];
    const noIntent: CandidateRow[] = [];

    for (const c of cmds) {
        const row = candidateRow(c);
        byVisibility[row.visibility] = (byVisibility[row.visibility] ?? 0) + 1;
        packCounts.set(row.pack, (packCounts.get(row.pack) ?? 0) + 1);
        if (row.replaces.length > 0) absorbedNames.push(row);
        // An empty-string intent is as undocumented as an absent one.
        if ((c.intent ?? '').trim() === '') noIntent.push(row);
    }

    const bySlug = (a: CandidateRow, b: CandidateRow): number => a.slug.localeCompare(b.slug);
    absorbedNames.sort(bySlug);
    noIntent.sort(bySlug);
    // Heaviest pack first; ties by name so the ordering is total, not arbitrary.
    const byPack = [...packCounts.entries()]
        .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
        .map(([pack, n]) => [pack, n] as const);

    // Rebuild the visibility record in a deterministic key order: the known
    // labels first, then any unrecognised ones sorted. Insertion order is
    // observable to a --json consumer, and seeding-then-appending made the
    // payload depend on which command happened to be read first.
    const stableVisibility: Record<string, number> = {};
    for (const label of VISIBILITY_ORDER) stableVisibility[label] = byVisibility[label] ?? 0;
    for (const label of Object.keys(byVisibility).filter((l) => !VISIBILITY_ORDER.includes(l)).sort()) {
        stableVisibility[label] = byVisibility[label] ?? 0;
    }

    return { total: cmds.length, byVisibility: stableVisibility, absorbedNames, noIntent, byPack };
}

/** The disclaimer is a contract, not decoration: `prune` is a destructive verb
 * elsewhere in this CLI, so the report says in its first line that it is not
 * one. Exported so a test asserts the constant rather than pinning prose. */
export const REPORT_ONLY_NOTICE =
    'report-only. Nothing here is a prune decision.';

/** Named here rather than inlined so the test can assert the pointers survive. */
export const REDUCTION_OWNERS: readonly string[] = [
    'road-to-surface-consolidation',
    'road-to-solution-minimalism',
    'road-to-tier-removal',
];

export function renderCandidates(report: CandidatesReport): string {
    const lines: string[] = [];
    lines.push(`Command-surface reduction report — ${REPORT_ONLY_NOTICE}`);
    lines.push('');
    lines.push(`surface                    ${report.total} commands`);
    // Render EVERY bucket, not just the three known labels. `visibility` is a
    // free string in the manifest (ADR-092 named the field, nothing pins its
    // domain), so a fourth value is reachable — and rendering only the known
    // three made the printed breakdown silently fail to sum to the total, with
    // the unknown-visibility commands vanishing from the report entirely.
    // Known labels keep their fixed order so the output stays byte-stable;
    // anything else follows, sorted, and is therefore impossible to miss.
    const known = VISIBILITY_ORDER.filter((l) => l in report.byVisibility);
    const unknown = Object.keys(report.byVisibility)
        .filter((l) => !VISIBILITY_ORDER.includes(l))
        .sort();
    for (const label of [...known, ...unknown]) {
        lines.push(`  ${label.padEnd(24)} ${report.byVisibility[label] ?? 0}`);
    }

    lines.push('');
    lines.push(`absorbed prior names       ${report.absorbedNames.length}  (declare 'replaces')`);
    lines.push('  NOT a retirement class: `replaces` is set on the NEW canonical command,');
    lines.push('  pointing back at the names it absorbed. These are survivors.');
    if (report.absorbedNames.length === 0) {
        lines.push('  none — a measured zero, not a missing check.');
    } else {
        for (const r of report.absorbedNames) {
            lines.push(`  ${r.slug}  <-  absorbed: ${r.replaces.join(', ')}`);
        }
    }

    lines.push('');
    lines.push('deprecation shims          not computable from this data');
    lines.push('  The retirement marker is `superseded_by` (set on the OLD shim, pointing');
    lines.push('  forward). It appears in no command file and is not emitted into the');
    lines.push('  discovery manifest, so this report cannot count it. The CI-enforced');
    lines.push('  canonical figure is check_command_count_messaging: 0 shims of 196.');

    lines.push('');
    lines.push(`no stated intent           ${report.noIntent.length}  (undocumented, not a prune call)`);
    if (report.noIntent.length === 0) {
        lines.push('  none — a measured zero, not a missing check.');
    } else {
        for (const r of report.noIntent.slice(0, TEXT_LIST_CAP)) {
            lines.push(`  ${r.slug}  (${r.pack})`);
        }
        const hidden = report.noIntent.length - TEXT_LIST_CAP;
        if (hidden > 0) {
            lines.push(`  … and ${hidden} more — the full set is in --json, never capped.`);
        }
    }

    lines.push('');
    lines.push('owning packs, heaviest first');
    for (const [pack, n] of report.byPack) lines.push(`  ${pack.padEnd(24)} ${n}`);

    lines.push('');
    lines.push('Usage evidence is NOT in this report.');
    lines.push("  The loaded-vs-fired retirement signal (D1/REAP) lives in");
    lines.push('  src/scripts/utilization_report.ts — local-only, report-only, and');
    lines.push('  deliberately not wired into `task ci`. Below its window floor it emits an');
    lines.push('  honest null and no verdict, so nothing above claims a usage-backed prune.');
    lines.push('  docs/SKILL_CENSUS.md and docs/artefact-census.md carry point-in-time counts');
    lines.push("  by design and sit outside check_artefact_count_messaging's scope — do not");
    lines.push('  read their numbers as current.');
    lines.push('');
    lines.push('Reduction targets are owned elsewhere:');
    for (const owner of REDUCTION_OWNERS) lines.push(`  ${owner}`);

    return lines.join('\n');
}

export interface CommandsCandidatesOptions {
    // `boolean | undefined` on purpose: commander hands through an absent flag
    // as `undefined`, and `exactOptionalPropertyTypes` rejects forwarding it
    // into a plain optional.
    json?: boolean | undefined;
}

export function runCommandsCandidates(opts: CommandsCandidatesOptions = {}): number {
    const manifest = loadOrReport();
    if (manifest === null) return 1;
    const report = buildCandidatesReport(commandArtefacts(manifest));
    if (opts.json) {
        process.stdout.write(`${JSON.stringify({ candidates: report, reduction_owners: REDUCTION_OWNERS }, null, 2)}\n`);
        return 0;
    }
    logger.info(renderCandidates(report));
    return 0;
}

/** Flags that narrow `ls` and therefore cannot combine with the whole-estate
 * report. Refused rather than ignored: silently dropping `--pack git` printed a
 * 196-command report a reader would have read as 4, and a typo'd `--profile`
 * exited 0 with a full report where plain `ls` exits 1. */
export const CANDIDATES_INCOMPATIBLE: readonly string[] = ['--pack', '--visible', '--profile', '--expanded'];

export function runCommandsLs(opts: CommandsLsOptions = {}): number {
    // Render mode, checked before the filters: the report covers the whole
    // command estate, so a narrowing flag would change what "the surface"
    // means without saying so.
    if (opts.candidates) {
        const given: string[] = [];
        if (opts.pack !== undefined) given.push('--pack');
        if (opts.visible) given.push('--visible');
        if (opts.profile !== undefined) given.push('--profile');
        if (opts.expanded) given.push('--expanded');
        if (given.length > 0) {
            logger.error(
                `--candidates reports the whole command estate and cannot be narrowed: ` +
                    `drop ${given.join(', ')}. Run 'commands ls ${given[0]} …' without ` +
                    '--candidates for a filtered listing.',
            );
            return 1;
        }
        return runCommandsCandidates({ json: opts.json });
    }

    const manifest = loadOrReport();
    if (manifest === null) return 1;

    let cmds = commandArtefacts(manifest);

    // --profile <id>: render the profile's curated command view (Step 14/15).
    // Default = the focused `view`; --expanded adds the active packs' full set.
    // The view ordering is meaningful, so a profile branch does NOT name-sort.
    if (opts.profile) {
        const profile = loadProfile(opts.profile);
        if (profile === null) {
            logger.error(
                `unknown profile '${opts.profile}'. Built-in profiles: developer, ` +
                    'founder, content_creator, agency, finance, ops.',
            );
            return 1;
        }
        cmds = resolveProfileView(profile, cmds, { expanded: Boolean(opts.expanded) });
        if (opts.visible) cmds = cmds.filter((c) => visibilityOf(c) !== 'internal');
        if (opts.json) {
            process.stdout.write(`${JSON.stringify({ profile: profile.id, expanded: Boolean(opts.expanded), commands: cmds }, null, 2)}\n`);
            return 0;
        }
        if (cmds.length === 0) {
            logger.info(`Profile '${profile.id}' surfaces no commands in the current manifest.`);
            return 0;
        }
        logger.info(renderTable(cmds));
        return 0;
    }

    if (opts.visible) cmds = cmds.filter((c) => visibilityOf(c) !== 'internal');
    // Filter on the canonical OWNER pack (`pack`), the budget/surfacing unit —
    // not the additive `packs` discovery tags.
    if (opts.pack) cmds = cmds.filter((c) => (c.pack ?? '') === opts.pack);
    cmds.sort((a, b) => (a.slug ?? a.name ?? '').localeCompare(b.slug ?? b.name ?? ''));

    if (opts.json) {
        process.stdout.write(`${JSON.stringify({ commands: cmds }, null, 2)}\n`);
        return 0;
    }
    if (cmds.length === 0) {
        logger.info('No commands match the given filters.');
        return 0;
    }
    logger.info(renderTable(cmds));
    return 0;
}

export function runCommandsExplain(name: string, opts: CommandsExplainOptions = {}): number {
    const manifest = loadOrReport();
    if (manifest === null) return 1;

    const cmds = commandArtefacts(manifest);
    const match = cmds.find((c) => c.name === name);
    if (!match) {
        logger.error(
            `unknown command '${name}'. Run 'agent-config commands ls' to list the surface.`,
        );
        return 1;
    }

    if (opts.json) {
        process.stdout.write(`${JSON.stringify(match, null, 2)}\n`);
        return 0;
    }

    const lines = [
        `/${match.name}`,
        `  pack:        ${match.pack ?? (match.packs[0] ?? '—')}`,
        `  visibility:  ${visibilityOf(match)}`,
        `  intent:      ${match.intent ?? '—'}`,
        `  routes_to:   ${(match.routes_to ?? []).join(', ') || '—'}`,
    ];
    if ((match.replaces ?? []).length > 0) {
        lines.push(`  replaces:    ${(match.replaces ?? []).join(', ')}`);
    }
    lines.push(`  path:        ${match.path}`);
    logger.info(lines.join('\n'));
    return 0;
}

/**
 * Heuristic: does `arg` look like a command target for `explain` (a bare
 * command name or a `cluster:sub` form), as opposed to the decision-trace
 * `explain config|rule|route` keywords handled by the legacy dispatcher?
 */
export function looksLikeCommandTarget(arg: string | undefined): boolean {
    if (!arg) return false;
    if (['config', 'rule', 'route'].includes(arg)) return false;
    return /^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)?$/.test(arg);
}
