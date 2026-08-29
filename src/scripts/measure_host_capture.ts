#!/usr/bin/env node
/**
 * Measure the runtime event journal's HOST capture rate.
 *
 * `road-to-journal-host-capture-measurement` Phase 2 step 2.1. Produces the
 * number that step, and its parent roadmap's step 1.4, asked for — or the
 * stated reason a given population's rate cannot exist.
 *
 * ## What it measures, and the one thing it is not
 *
 * The DENOMINATOR is host-authored: it is reconstructed from Claude Code's own
 * per-session transcripts by the pinned rules in `_lib/host_denominator.ts`.
 * The NUMERATOR is this package's journal store. Neither is derived from the
 * other, which is the property that makes the ratio a capture rate.
 *
 * It is emphatically **not** the dispatch-path figure published by
 * `agents/evidence/analysis/runtime-journal-capture-2026-08-28.md` (100.00 %,
 * 1,000 envelopes). That measured envelopes handed to the concern by a test —
 * a floor on the writer. This measures events a real host emitted. Reporting
 * either as the other is the category substitution both evidence pages refuse.
 *
 * ## One population, and it is the numerator's — R2 finding 1
 *
 * The journal lives at `<git-common-dir>/agent-journal/journal.sqlite`: one
 * store per REPOSITORY, shared by its worktrees, reaching nothing else. So the
 * denominator defaults to `--scope repository`, which counts only the
 * transcripts of that repository's worktrees. `--scope machine` is available
 * and is a different figure about the host; the rate printed under it is
 * labelled UNMATCHED, because dividing a machine-wide denominator by a
 * repository-scoped numerator is the defect this flag exists to make visible.
 *
 * ## Populations
 *
 * Per the unanimous AI-council resolution of `measurement-population-default-off`
 * (option c), two install populations are reported and neither is "the" capture
 * rate:
 *
 *   - **default**  — settings as shipped; `hooks.runtime_journal.enabled`
 *                    absent, resolving to false.
 *   - **opted-in** — `hooks.runtime_journal.enabled: true`.
 *
 * The script reports which one the measured machine is actually in, and
 * censuses the settings layers rather than assuming. A population with no
 * opted-in layer is reported as measured-empty, never as 0 %.
 *
 * Usage:
 *     measure_host_capture                       # human-readable
 *     measure_host_capture --json                # machine-readable
 *     measure_host_capture --days 30             # window length in CALENDAR
 *                                                # days, inclusive both ends
 *                                                # (default 30 — the journal's
 *                                                # retention TTL)
 *     measure_host_capture --scope machine       # widen the denominator, and
 *                                                # label the rate unmatched
 *     measure_host_capture --projects-root P     # override ~/.claude/projects
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    accumulate,
    COUNTED_EVENTS,
    countTranscriptFile,
    DENOMINATOR_SCOPES,
    type DenominatorScope,
    emptyDenominator,
    findTranscripts,
    type HostDenominator,
    JOURNAL_BOUND_COUNTED_EVENTS,
    RECONSTRUCTION_RULE_VERSION,
    repositoryScopeSlugs,
    STOP_CANDIDATES,
    totalCountedEvents,
    totalJournalBoundEvents,
} from './_lib/host_denominator.js';
import {
    isJournalAvailable,
    openJournal,
    resolveJournal,
    RETENTION_TTL_DAYS,
} from './_lib/runtime_journal.js';

/** Why a numerator is what it is. A blind zero is what this enum prevents. */
export type NumeratorStatus =
    | 'counted'
    | 'store-absent'
    | 'sqlite-unavailable'
    | 'store-unreadable';

/**
 * The settings layers a hook on this machine would consult for
 * `hooks.runtime_journal.enabled`, and what each one says.
 *
 * A census of LAYERS, and the field names say so. v1 called them `observable` /
 * `opted_in` and the evidence page published them as "installs", which is a
 * different unit: one machine carrying both a project and a user-global layer
 * would have reported two installs (R2 finding 7).
 *
 * `parse_failed` exists because a non-match used to be indistinguishable from
 * "key absent", and both resolved silently toward the `default` population
 * label that both published captions rest on (R2 finding 4).
 */
export interface LayerCensus {
    /** Settings files present and readable. */
    layers_present: number;
    /** Of those, how many carry the key at all. */
    layers_with_key: number;
    /** Of those, how many set it `true`. */
    layers_enabled: number;
    /** Files that were readable but whose `hooks:` block could not be parsed. */
    layers_parse_failed: number;
    /** The resolved value — the first layer that carries the key wins. */
    resolved_enabled: boolean;
    /** True when no layer carries the key, so the shipped default applies. */
    resolved_from_default: boolean;
}

export interface CaptureMeasurement {
    measured_on: string;
    window_days: number;
    denominator: HostDenominator;
    /** Worktrees the repository scope resolved to. 0 means an empty scope. */
    scope_worktrees: number;
    denominator_scope: DenominatorScope;
    /** False when the denominator's scope cannot be divided by this numerator. */
    scope_matches_numerator: boolean;
    /** Which install population the measured machine is in. */
    measured_population: 'default' | 'opted-in';
    layers: LayerCensus;
    numerator_status: NumeratorStatus;
    /** Journal records in-window on the six counted cells. */
    numerator_counted_cells: number;
    /** Journal records in-window on the five journal-bound counted cells. */
    numerator_journal_bound_cells: number;
    /** All in-window journal records, on any event. Context, not the numerator. */
    numerator_all_events: number;
}

function isoDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/**
 * Parse one settings file for `hooks.runtime_journal.enabled`.
 *
 * Anchored to the `hooks:` parent and tolerant of any consistent indentation,
 * because v1 hard-coded 2-space / 4-space nesting and matched a
 * `runtime_journal:` under any section at all. Returns `null` when the key is
 * absent and `'parse-failed'` when a `hooks:` block exists but no verdict could
 * be read from it — the two are different facts and v1 reported them the same.
 */
export function readJournalKey(text: string): boolean | null | 'parse-failed' {
    const lines = text.split('\n');
    const hooksAt = lines.findIndex((l) => /^hooks:\s*$/.test(l));
    if (hooksAt === -1) return null;

    let sectionIndent: number | null = null;
    let inSection = false;
    for (let i = hooksAt + 1; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (line.trim().length === 0 || line.trimStart().startsWith('#')) continue;
        const indent = line.length - line.trimStart().length;
        if (indent === 0) break; // out of the `hooks:` block

        if (/^runtime_journal:\s*$/.test(line.trim())) {
            inSection = true;
            sectionIndent = indent;
            continue;
        }
        if (!inSection) continue;
        if (sectionIndent !== null && indent <= sectionIndent) {
            // Left the `runtime_journal:` block without finding the key.
            return 'parse-failed';
        }
        const m = line.trim().match(/^enabled:\s*(\S+)/);
        if (m) return (m[1] ?? '').trim() === 'true';
    }
    return inSection ? 'parse-failed' : null;
}

function layerCensus(root: string): LayerCensus {
    const candidates = [
        path.join(root, '.agent-settings.yml'),
        path.join(os.homedir(), '.event4u', 'agent-config', 'settings', '.agent-settings.yml'),
    ];
    const census: LayerCensus = {
        layers_present: 0,
        layers_with_key: 0,
        layers_enabled: 0,
        layers_parse_failed: 0,
        resolved_enabled: false,
        resolved_from_default: true,
    };
    for (const file of candidates) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        census.layers_present += 1;
        const verdict = readJournalKey(text);
        if (verdict === 'parse-failed') {
            census.layers_parse_failed += 1;
            continue;
        }
        if (verdict === null) continue;
        census.layers_with_key += 1;
        if (verdict) census.layers_enabled += 1;
        if (census.resolved_from_default) {
            census.resolved_enabled = verdict;
            census.resolved_from_default = false;
        }
    }
    return census;
}

export async function measure(options: {
    root: string;
    projectsRoot: string;
    days: number;
    scope?: DenominatorScope;
    now?: Date;
}): Promise<CaptureMeasurement> {
    const scope = options.scope ?? 'repository';
    const now = options.now ?? new Date();
    const windowEnd = isoDay(now);
    // `days - 1`: both comparisons are inclusive, so `--days 30` must span 30
    // calendar days and not 31. v1 spanned 31 while the caption said 30, which
    // gave the denominator one day the numerator's TTL cannot retain (R2
    // finding 3).
    const windowStart = isoDay(new Date(now.getTime() - (options.days - 1) * 86_400_000));

    const repoScope = scope === 'repository' ? repositoryScopeSlugs(options.root) : null;
    const walk = findTranscripts(options.projectsRoot, repoScope?.slugs);

    const denominator = emptyDenominator(windowStart, windowEnd, scope);
    denominator.transcripts_out_of_scope = walk.outOfScope;
    denominator.unreadable_directories = walk.unreadable;
    for (const file of walk.files) {
        accumulate(denominator, await countTranscriptFile(file), windowStart, windowEnd);
    }

    const layers = layerCensus(options.root);
    const measured_population = layers.resolved_enabled ? 'opted-in' : 'default';

    let numerator_status: NumeratorStatus = 'counted';
    let counted = 0;
    let bound = 0;
    let all = 0;

    const location = resolveJournal(options.root);
    if (!fs.existsSync(location.path)) {
        numerator_status = 'store-absent';
    } else if (!isJournalAvailable()) {
        numerator_status = 'sqlite-unavailable';
    } else {
        try {
            const handle = openJournal(options.root);
            try {
                // Windowed in SQL rather than by materialising the whole table
                // and filtering in JS (R2 finding 17). `substr(at, 1, 10)` is
                // the same day-string comparison the denominator uses, so the
                // two sides window identically.
                const rows = handle.db
                    .prepare(
                        `SELECT event, COUNT(*) AS n FROM journal_event
                         WHERE repository_id = ?
                           AND substr(at, 1, 10) >= ?
                           AND substr(at, 1, 10) <= ?
                         GROUP BY event`,
                    )
                    .all(location.repository_id, windowStart, windowEnd) as {
                    event: string;
                    n: number;
                }[];
                for (const row of rows) {
                    all += row.n;
                    if ((COUNTED_EVENTS as readonly string[]).includes(row.event)) counted += row.n;
                    if ((JOURNAL_BOUND_COUNTED_EVENTS as readonly string[]).includes(row.event)) {
                        bound += row.n;
                    }
                }
            } finally {
                handle.close();
            }
        } catch {
            numerator_status = 'store-unreadable';
            // Reset, or a partial count ships as if it were counted while the
            // status says it could not be read (R2 finding 5).
            counted = 0;
            bound = 0;
            all = 0;
        }
    }

    return {
        measured_on: windowEnd,
        window_days: options.days,
        denominator,
        scope_worktrees: repoScope?.worktrees.length ?? 0,
        denominator_scope: scope,
        scope_matches_numerator: scope === 'repository',
        measured_population,
        layers,
        numerator_status,
        numerator_counted_cells: counted,
        numerator_journal_bound_cells: bound,
        numerator_all_events: all,
    };
}

function rate(numerator: number, denominator: number): string {
    if (denominator === 0) return 'undefined (denominator 0)';
    return `${((numerator / denominator) * 100).toFixed(2)} %`;
}

function render(m: CaptureMeasurement): string {
    const d = m.denominator;
    const lines: string[] = [];
    lines.push(`Host capture rate — runtime event journal`);
    lines.push(`  measured on ............ ${m.measured_on}`);
    lines.push(
        `  window ................. ${d.window_start} .. ${d.window_end} (${m.window_days} calendar days, inclusive; journal TTL is ${RETENTION_TTL_DAYS})`,
    );
    lines.push(`  reconstruction rules ... v${RECONSTRUCTION_RULE_VERSION}`);
    lines.push(`  platform ............... ${d.platform} (the only cell set with a host denominator)`);
    lines.push(
        `  denominator scope ...... ${d.scope}${m.scope_matches_numerator ? '' : '  ⚠️  UNMATCHED — a machine-wide denominator may not be divided by this repository-scoped numerator'}`,
    );
    if (d.scope === 'repository') {
        lines.push(`  worktrees in scope ..... ${m.scope_worktrees}`);
    }
    lines.push('');
    lines.push(`Population of sessions`);
    lines.push(`  transcripts in scope ... ${d.transcripts_found}`);
    lines.push(`  project dirs skipped ... ${d.transcripts_out_of_scope} (outside the scope)`);
    lines.push(`  in window .............. ${d.sessions_in_window}`);
    lines.push(`  before window .......... ${d.sessions_before_window}`);
    lines.push(`  after window ........... ${d.sessions_after_window}`);
    lines.push(`  undatable .............. ${d.sessions_undatable}`);
    lines.push(`  unreadable dirs ........ ${d.unreadable_directories}`);
    lines.push(`  unparseable lines ...... ${d.unparseable_lines}`);
    lines.push('');
    lines.push(`Denominator — host events, per counted cell`);
    for (const event of COUNTED_EVENTS) {
        const isBound = (JOURNAL_BOUND_COUNTED_EVENTS as readonly string[]).includes(event);
        lines.push(
            `  ${event.padEnd(20)} ${String(d[event]).padStart(8)}  ${isBound ? 'journal-bound' : 'NOT journal-bound — numerator 0 by construction'}`,
        );
    }
    lines.push(`  ${'TOTAL (6 cells)'.padEnd(20)} ${String(totalCountedEvents(d)).padStart(8)}`);
    lines.push(
        `  ${'TOTAL (5 bound)'.padEnd(20)} ${String(totalJournalBoundEvents(d)).padStart(8)}`,
    );
    lines.push(
        `  of which sidechain ..... ${d.sidechain_tool_use_blocks} tool_use / ${d.sidechain_agent_tool_use_blocks} Agent-or-Task blocks (INCLUDED; subtract to disagree)`,
    );
    lines.push('');
    lines.push(`Settings-layer census — the opted-in population, measured not assumed`);
    lines.push(`  layers present ......... ${m.layers.layers_present}`);
    lines.push(`  carrying the key ....... ${m.layers.layers_with_key}`);
    lines.push(`  set to true ............ ${m.layers.layers_enabled}`);
    lines.push(`  parse failed ........... ${m.layers.layers_parse_failed}`);
    lines.push(
        `  resolved from .......... ${m.layers.resolved_from_default ? 'the shipped default (no layer carries the key)' : 'an explicit layer value'}`,
    );
    lines.push(
        `  opted-in population .... ${m.layers.layers_enabled === 0 ? 'EMPTY in measurement scope — no denominator for a rate to be over' : 'non-empty'}`,
    );
    lines.push('');
    lines.push(`Numerator — journal records`);
    lines.push(`  measured population .... ${m.measured_population}`);
    lines.push(`  status ................. ${m.numerator_status}`);
    lines.push(`  on 6 counted cells ..... ${m.numerator_counted_cells}`);
    lines.push(`  on 5 bound cells ....... ${m.numerator_journal_bound_cells}`);
    lines.push(`  on any event ........... ${m.numerator_all_events}`);
    lines.push(
        `  host-agnostic .......... yes — \`JournalEvent\` carries no platform field, so an event`,
    );
    lines.push(
        `                           written by another bound host on this repository would count`,
    );
    lines.push(
        `                           into the numerator against a claude-only denominator`,
    );
    lines.push('');
    lines.push(
        `Rate — ${m.measured_population} install, ${d.platform}, ${d.scope} scope, ${d.window_start}..${d.window_end}`,
    );
    lines.push(
        `  over 6 counted cells ... ${rate(m.numerator_counted_cells, totalCountedEvents(d))}`,
    );
    lines.push(
        `  over 5 bound cells ..... ${rate(m.numerator_journal_bound_cells, totalJournalBoundEvents(d))}`,
    );
    if (!m.scope_matches_numerator) {
        lines.push(`  ⚠️  UNMATCHED SCOPE — the two rates above are not capture rates.`);
    }
    lines.push('');
    lines.push(`Refused denominators for \`stop\` (journal-bound, not counted)`);
    for (const c of STOP_CANDIDATES) {
        lines.push(`  ${String(c.reading).padStart(5)}  ${c.candidate}`);
    }
    return lines.join('\n');
}

export async function main(argv: readonly string[]): Promise<number> {
    const json = argv.includes('--json');

    const daysAt = argv.indexOf('--days');
    const days = daysAt >= 0 ? Number(argv[daysAt + 1] ?? NaN) : RETENTION_TTL_DAYS;
    if (!Number.isInteger(days) || days <= 0) {
        process.stderr.write('--days must be a positive integer\n');
        return 2;
    }

    const scopeAt = argv.indexOf('--scope');
    const scopeArg = scopeAt >= 0 ? argv[scopeAt + 1] : undefined;
    if (scopeAt >= 0 && !(DENOMINATOR_SCOPES as readonly string[]).includes(scopeArg ?? '')) {
        process.stderr.write(`--scope must be one of ${DENOMINATOR_SCOPES.join(' | ')}\n`);
        return 2;
    }

    const rootAt = argv.indexOf('--projects-root');
    const overrideRoot = rootAt >= 0 ? argv[rootAt + 1] : undefined;
    if (rootAt >= 0 && (overrideRoot === undefined || overrideRoot.startsWith('--'))) {
        process.stderr.write('--projects-root needs a directory\n');
        return 2;
    }
    const projectsRoot = overrideRoot ?? path.join(os.homedir(), '.claude', 'projects');

    const measurement = await measure({
        root: process.cwd(),
        projectsRoot,
        days,
        scope: (scopeArg as DenominatorScope | undefined) ?? 'repository',
    });

    process.stdout.write(
        json ? `${JSON.stringify(measurement, null, 2)}\n` : `${render(measurement)}\n`,
    );
    return 0;
}

function _isCliEntry(): boolean {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1] ?? ''));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = await main(process.argv.slice(2));
}
