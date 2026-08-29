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
 * ## Populations
 *
 * Per the unanimous AI-council resolution of `measurement-population-default-off`
 * (option c), two populations are reported and neither is "the" capture rate:
 *
 *   - **default**  — settings as shipped; `hooks.runtime_journal.enabled`
 *                    absent, resolving to false.
 *   - **opted-in** — `hooks.runtime_journal.enabled: true`.
 *
 * The script reports which population the measured machine is actually in,
 * rather than assuming one. A population with no installs is reported as
 * `not-observed` with the reason, never as 0 %.
 *
 * Usage:
 *     measure_host_capture                    # human-readable
 *     measure_host_capture --json             # machine-readable
 *     measure_host_capture --days 30          # window length (default 30 —
 *                                             # the journal's retention TTL)
 *     measure_host_capture --projects-root P  # override ~/.claude/projects
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    accumulate,
    COUNTED_EVENTS,
    countTranscriptFile,
    emptyDenominator,
    findTranscripts,
    type HostDenominator,
    JOURNAL_BOUND_COUNTED_EVENTS,
    RECONSTRUCTION_RULE_VERSION,
    STOP_CANDIDATES,
    totalCountedEvents,
    totalJournalBoundEvents,
} from './_lib/host_denominator.js';
import {
    isJournalAvailable,
    readAllEvents,
    openJournal,
    resolveJournal,
    RETENTION_TTL_DAYS,
} from './_lib/runtime_journal.js';

/** Why a numerator is zero. A blind zero is the failure this enum prevents. */
export type NumeratorStatus =
    | 'counted'
    | 'store-absent'
    | 'sqlite-unavailable'
    | 'store-unreadable';

export interface CaptureMeasurement {
    measured_on: string;
    window_days: number;
    denominator: HostDenominator;
    /** Which population the measured machine is in, read from resolved settings. */
    measured_population: 'default' | 'opted-in';
    /** Settings layers observable here, and how many are opted in. */
    installs: InstallCensus;
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
 * The settings layers a hook on this machine would actually consult for
 * `hooks.runtime_journal.enabled`, and what each one says.
 *
 * Returned as a census rather than a boolean because the AI council of
 * 2026-08-29 required the opted-in half of the measurement to be published as a
 * **measured empty population** — "0 installations observable" — rather than as
 * "unmeasurable in principle". The two read very differently to a later reader,
 * and only the first is what happened.
 */
export interface InstallCensus {
    /** Settings layers present on this machine and readable. */
    observable: number;
    /** Of those, how many set the key `true`. */
    opted_in: number;
    /** Whether the resolved value — first layer that carries the key — is true. */
    resolved_enabled: boolean;
}

function installCensus(root: string): InstallCensus {
    const candidates = [
        path.join(root, '.agent-settings.yml'),
        path.join(os.homedir(), '.event4u', 'agent-config', 'settings', '.agent-settings.yml'),
    ];
    let observable = 0;
    let opted_in = 0;
    let resolved: boolean | null = null;
    for (const file of candidates) {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        observable += 1;
        // Narrow, deliberate parse: the one key, under the one section. A full
        // YAML load here would pull the settings loader's cascade semantics
        // into a measurement script, and this script must report what a hook
        // would see, not re-derive it.
        const match = text.match(/^\s{2}runtime_journal:\s*$\n(?:\s{4}.*\n)*?\s{4}enabled:\s*(\S+)/m);
        if (!match) continue;
        const enabled = (match[1] ?? '').trim() === 'true';
        if (enabled) opted_in += 1;
        if (resolved === null) resolved = enabled;
    }
    return { observable, opted_in, resolved_enabled: resolved ?? false };
}

export async function measure(options: {
    root: string;
    projectsRoot: string;
    days: number;
    now?: Date;
}): Promise<CaptureMeasurement> {
    const now = options.now ?? new Date();
    const windowEnd = isoDay(now);
    const windowStart = isoDay(new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000));

    const denominator = emptyDenominator(windowStart, windowEnd);
    for (const file of findTranscripts(options.projectsRoot)) {
        accumulate(denominator, await countTranscriptFile(file), windowStart, windowEnd);
    }

    const installs = installCensus(options.root);
    const measured_population = installs.resolved_enabled ? 'opted-in' : 'default';

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
                for (const event of readAllEvents(handle)) {
                    const day = event.at.slice(0, 10);
                    if (day < windowStart || day > windowEnd) continue;
                    all += 1;
                    if ((COUNTED_EVENTS as readonly string[]).includes(event.event)) counted += 1;
                    if ((JOURNAL_BOUND_COUNTED_EVENTS as readonly string[]).includes(event.event)) {
                        bound += 1;
                    }
                }
            } finally {
                handle.close();
            }
        } catch {
            numerator_status = 'store-unreadable';
        }
    }

    return {
        measured_on: windowEnd,
        window_days: options.days,
        denominator,
        measured_population,
        installs,
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
        `  window ................. ${d.window_start} .. ${d.window_end} (${m.window_days} days; journal TTL is ${RETENTION_TTL_DAYS})`,
    );
    lines.push(`  reconstruction rules ... v${RECONSTRUCTION_RULE_VERSION}`);
    lines.push(`  platform ............... ${d.platform} (the only cell set with a host denominator)`);
    lines.push('');
    lines.push(`Population of sessions`);
    lines.push(`  transcripts found ...... ${d.transcripts_found}`);
    lines.push(`  in window .............. ${d.sessions_in_window}`);
    lines.push(`  before window .......... ${d.sessions_before_window}`);
    lines.push(`  undatable .............. ${d.sessions_undatable}`);
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
    lines.push('');
    lines.push(`Install census — the opted-in population, measured not assumed`);
    lines.push(`  settings layers here ... ${m.installs.observable}`);
    lines.push(`  of those, opted in ..... ${m.installs.opted_in}`);
    lines.push(
        `  opted-in population .... ${m.installs.opted_in === 0 ? 'EMPTY in measurement scope — a rate has no denominator to be over' : 'non-empty'}`,
    );
    lines.push('');
    lines.push(`Numerator — journal records`);
    lines.push(`  measured population .... ${m.measured_population}`);
    lines.push(`  status ................. ${m.numerator_status}`);
    lines.push(`  on 6 counted cells ..... ${m.numerator_counted_cells}`);
    lines.push(`  on 5 bound cells ....... ${m.numerator_journal_bound_cells}`);
    lines.push(`  on any event ........... ${m.numerator_all_events}`);
    lines.push('');
    lines.push(`Rate — ${m.measured_population} install, ${d.platform}, ${d.window_start}..${d.window_end}`);
    lines.push(
        `  over 6 counted cells ... ${rate(m.numerator_counted_cells, totalCountedEvents(d))}`,
    );
    lines.push(
        `  over 5 bound cells ..... ${rate(m.numerator_journal_bound_cells, totalJournalBoundEvents(d))}`,
    );
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
