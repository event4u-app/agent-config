#!/usr/bin/env tsx
/**
 * check_enforcement_matrix.ts — generate the per-slot enforcement table in
 * `docs/enforcement-by-host.md` from `src/scripts/hooks/host_lowering.yaml`,
 * and fail when the committed table and the configuration disagree.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT
 * --------------------------------------
 * It proves the published table agrees with the YAML. It proves NOTHING about
 * any host's runtime behavior. A mistaken lowering rule produces a perfectly
 * synchronised and perfectly false document, and this gate would be green over
 * it. That is why the generated region is titled CONFIGURED behavior rather
 * than ENFORCED behavior, even though the file it lives in is called
 * `enforcement-by-host.md` — the honest claim is a claim about a configuration
 * file, and the region says so in its own first line rather than leaving the
 * distinction to this docstring. Establishing the other half needs a runtime
 * conformance test against a real host, which this tree does not have for any
 * host and does not pretend to.
 *
 * WHY THE TABLE IS GENERATED AT ALL
 * ---------------------------------
 * A host-level binary cell has to summarise a column of slot values, and no
 * binary value is faithful when the column disagrees with itself — `claude`
 * blocks on 3 of its 9 lowerable slots. Generating the projection at slot
 * granularity removes the summary step rather than correcting it once.
 *
 * ONE PROJECTION, IMPORTED
 * ------------------------
 * The YAML-to-per-slot reading is `report_enforcement_drift.readSlots`, and it
 * is imported rather than reimplemented. Two copies of a projection are what
 * this document already suffered from at the prose layer; writing a second copy
 * in the gate that fixes it would be the same defect one level down.
 *
 * THE CLOSED VOCABULARY, AND THE ONE VALUE NOTHING EMITS
 * -----------------------------------------------------
 * A cell carries one of `refusal` · `halt-by-state` · `warning` · `unenforced`.
 * {@link outcomeFor} can return three of those four. `halt-by-state` has no
 * backing field in the lowering configuration and therefore no cell can
 * legitimately carry it today — it is defined in the document's hand-written
 * taxonomy and marked unused so that a reader who meets it later does not meet
 * an unexplained category. {@link unbackedOutcomes} is what keeps the
 * definition from becoming a claim: a committed cell carrying a value the
 * configuration cannot produce is a finding with its own message, which is the
 * check the dissenting council seat asked for when it argued the value should
 * not exist at all.
 *
 * That guard is honest about its own reach. It catches a value the derivation
 * can never return, which is exactly the phantom-value case. It cannot catch a
 * value that is reachable but wrong for the row — that is the drift comparison
 * above, and behind that, the configured-not-enforced caveat.
 *
 * Exit codes: 0 in sync · 1 drift or an unbacked cell · 2 a source is missing,
 * unreadable, or has lost its markers.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import * as yaml from 'js-yaml';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { splitMarkdownRow } from './_lib/md_table.js';
import { reportScanned } from './_lib/scan_scope.js';
import { DEFAULT_SURFACE, type HostLowering, parseHostLowering } from './hooks/host_lowering.js';
import { type SlotReading, deriveDeny, readSlots } from './report_enforcement_drift.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE = 'check_enforcement_matrix';
export const DOC_REL = path.join('docs', 'enforcement-by-host.md');
export const LOWERING_REL = path.join('src', 'scripts', 'hooks', 'host_lowering.yaml');

export const BEGIN_MARKER = '<!-- BEGIN GENERATED: enforcement-configured-by-slot -->';
export const END_MARKER = '<!-- END GENERATED: enforcement-configured-by-slot -->';

/**
 * The second generated region: every `blocking` concern, with the enforcement
 * the host it is bound on can actually carry.
 *
 * road-to-blocking-severities 1.2. Its own marker pair rather than an extra
 * column in the first region, because the two tables have different units — the
 * first is one row per host-SLOT, this is one row per host-slot-CONCERN — and
 * merging them would make every host-slot row repeat once per concern bound to
 * it.
 */
export const SEVERITY_BEGIN_MARKER = '<!-- BEGIN GENERATED: blocking-severity-by-binding -->';
export const SEVERITY_END_MARKER = '<!-- END GENERATED: blocking-severity-by-binding -->';

/** The command a drift failure tells the reader to run. Printed, never guessed at. */
export const REGEN_COMMAND = `./scripts-run src/scripts/${GATE} --write`;

/**
 * The closed set a configured-outcome cell may carry.
 *
 * Order is the ladder's own, strongest first, and the document's hand-written
 * taxonomy lists them in the same order so the two read together.
 */
export const CONFIGURED_OUTCOMES = ['refusal', 'halt-by-state', 'warning', 'unenforced'] as const;

export type ConfiguredOutcome = (typeof CONFIGURED_OUTCOMES)[number];

/**
 * What the `Answered` column prints for a pair the configuration never dated.
 *
 * A word rather than an empty cell, because an empty cell in a rendered table
 * is indistinguishable from a rendering bug, and this one is the finding.
 * `lint_hook_manifest._check_slot_answers` is what actually refuses it; this
 * gate's job is to make sure the published document cannot hide it.
 */
export const UNDATED = '`undated`';

export interface MatrixRow {
    host: string;
    slot: string;
    outcome: ConfiguredOutcome;
    /** The configuration values the outcome was read off, quoted for the table. */
    backing: string;
    /**
     * `answered_at` for this pair, or `undated` when the configuration carries
     * none. Printed LAST so the outcome stays in column three and
     * {@link committedCells} keeps reading the same index it always did.
     */
    answered: string;
}

export interface BuildResult {
    rows: MatrixRow[];
    /** Hosts the configuration models with no lowerable slot at all. */
    slotlessHosts: string[];
    /**
     * Rows whose configuration cannot be projected into the vocabulary — a
     * `fail_policy` this mapping does not know, or a blocking exit under a
     * policy that discards it. Reported, never resolved by picking a side.
     */
    contradictions: string[];
}

/**
 * The configured outcome for one slot reading.
 *
 * REFUSAL IS READ OFF `effective`, NOT `literal`, which is the same rule
 * `report_enforcement_drift` applies and the reason the two cannot disagree: a
 * row whose `verified` block has expired carries no blocking binding whatever
 * its slot literals say.
 *
 * `fail_policy` only splits the non-refusal case. `propagate` means the
 * dispatcher's exit code reaches the host, so a concern bound there can report
 * and the run continues — `warning`. `discard` means the trampoline exits 0
 * regardless, so the verdict reaches nothing — `unenforced`.
 *
 * Returns `null` for a `fail_policy` this mapping does not know. A gate that
 * guessed at an unknown input would publish the guess in a table, which is the
 * class of defect this whole file exists to remove.
 */
export function outcomeFor(reading: SlotReading, failPolicy: string): ConfiguredOutcome | null {
    if (reading.effective !== null) return 'refusal';
    if (failPolicy === 'propagate') return 'warning';
    if (failPolicy === 'discard') return 'unenforced';
    return null;
}

/** The configuration values a cell was read off, as the table prints them. */
export function backingFor(reading: SlotReading, failPolicy: string): string {
    const parts: string[] = [];
    if (reading.effective !== null) {
        parts.push(`\`block_exit: ${String(reading.effective)}\``);
    } else if (reading.literal !== null) {
        // The expiry case. Printing the literal beside the effective null is
        // what makes a silently disarmed host visible as a difference rather
        // than as a value that quietly turned into `null`.
        parts.push(`\`block_exit: ${String(reading.literal)}\` disarmed by an expired \`verified\``);
    } else {
        parts.push('`block_exit: null`');
    }
    parts.push(`\`fail_policy: ${failPolicy}\``);
    return parts.join(' · ');
}

/**
 * Every (host, slot) pair the configuration models, in the file's own order.
 *
 * NOT SORTED, DELIBERATELY. `host_lowering.yaml` states that its `slots:` order
 * is part of the generated bridge output and must not be sorted; keeping the
 * same order here means a diff of this table corresponds line for line to a
 * diff of the YAML, which is the review property the table is for.
 */
export function buildRows(lowering: HostLowering): BuildResult {
    const rows: MatrixRow[] = [];
    const slotlessHosts: string[] = [];
    const contradictions: string[] = [];
    for (const [host, surfaces] of lowering) {
        const surface = surfaces.get(DEFAULT_SURFACE);
        if (surface === undefined) continue;
        const { slots } = readSlots(lowering, host);
        if (slots.length === 0) {
            slotlessHosts.push(host);
            continue;
        }
        for (const reading of slots) {
            const outcome = outcomeFor(reading, surface.fail_policy);
            if (outcome === null) {
                contradictions.push(
                    `${host}/${reading.slot}: \`fail_policy: ${surface.fail_policy}\` has no ` +
                        'outcome in the closed vocabulary. Extend the mapping deliberately, in ' +
                        `\`src/scripts/${GATE}.ts\`, rather than letting a cell be guessed.`,
                );
                continue;
            }
            if (reading.effective !== null && surface.fail_policy === 'discard') {
                contradictions.push(
                    `${host}/${reading.slot}: a blocking \`block_exit\` under ` +
                        '`fail_policy: discard`. The configuration says both that the host ' +
                        'honours a refusal here and that the trampoline drops it. Fix the YAML; ' +
                        'this gate will not pick one.',
                );
            }
            rows.push({
                host,
                slot: reading.slot,
                outcome,
                backing: backingFor(reading, surface.fail_policy),
                answered: surface.slots.get(reading.slot)?.answered_at ?? UNDATED,
            });
        }
    }
    return { rows, slotlessHosts, contradictions };
}

/**
 * The outcome values the configuration can express on this tree.
 *
 * DERIVED FROM THE RAW CONFIGURATION FIELDS, NOT FROM {@link outcomeFor}'s
 * output, and the distinction is the whole value of this function. The first
 * version of it read the generated rows and collected the outcomes it found —
 * which made a broken mapping self-backing: sabotaging `outcomeFor` to return
 * `halt-by-state` for every propagating slot produced a region full of a value
 * nothing emits, and the check passed, because the check's idea of "backed"
 * was the same broken output. Measured, on this gate, before it shipped.
 *
 * So this is a deliberate SECOND expression of what the configuration carries,
 * written against the fields themselves. `refusal` is backed when some slot
 * carries an unexpired blocking exit; `warning` and `unenforced` are backed by
 * the presence of the two `fail_policy` values. `halt-by-state` has no field to
 * be backed by, on purpose — no schema element expresses it — so it can never
 * enter this set while that stays true.
 *
 * The residual, stated rather than implied: a bug in BOTH this function and
 * the mapping would agree, and this cannot catch a value that is reachable but
 * wrong for its row. The drift comparison covers the second; nothing covers
 * the first except that the two are written against different inputs.
 */
export function backedOutcomes(lowering: HostLowering): Set<ConfiguredOutcome> {
    const backed = new Set<ConfiguredOutcome>();
    for (const [host, surfaces] of lowering) {
        const surface = surfaces.get(DEFAULT_SURFACE);
        if (surface === undefined) continue;
        const { slots } = readSlots(lowering, host);
        if (slots.length === 0) continue;
        if (slots.some((s) => s.effective !== null)) backed.add('refusal');
        if (surface.fail_policy === 'propagate') backed.add('warning');
        if (surface.fail_policy === 'discard') backed.add('unenforced');
    }
    return backed;
}

/**
 * The derived one-line summary.
 *
 * Generated from the same rows as the table so the short answer a reader takes
 * away is derived rather than remembered. `deriveDeny` is the host-level fold
 * `report_enforcement_drift` already owns, reused here rather than recounted.
 */
export function summaryLine(lowering: HostLowering, rows: readonly MatrixRow[]): string {
    const count = (o: ConfiguredOutcome): number => rows.filter((r) => r.outcome === o).length;
    const refusals = rows.filter((r) => r.outcome === 'refusal');
    const refusalHosts = [...new Set(refusals.map((r) => r.host))];
    let hostsAll = 0;
    let hostsAny = 0;
    let modelled = 0;
    for (const [host, surfaces] of lowering) {
        if (surfaces.get(DEFAULT_SURFACE) === undefined) continue;
        modelled += 1;
        const derived = deriveDeny(readSlots(lowering, host).slots, true);
        if (derived === 'all') hostsAll += 1;
        if (derived === 'all' || derived === 'partial') hostsAny += 1;
    }
    const where =
        refusalHosts.length === 0
            ? 'nowhere'
            : refusalHosts
                  .map((h) => {
                      const slots = refusals
                          .filter((r) => r.host === h)
                          .map((r) => `\`${r.slot}\``)
                          .join(', ');
                      const total = rows.filter((r) => r.host === h).length;
                      const n = refusals.filter((r) => r.host === h).length;
                      return `\`${h}\` on ${String(n)} of its ${String(total)} (${slots})`;
                  })
                  .join('; ');
    return (
        `**Configured: ${String(count('refusal'))} of ${String(rows.length)} host-slot pairs ` +
        `configure a refusal — ${where}. ` +
        `${String(count('warning'))} are \`warning\`, ${String(count('unenforced'))} are ` +
        `\`unenforced\`, ${String(count('halt-by-state'))} are \`halt-by-state\`. ` +
        `${String(hostsAny)} of ${String(modelled)} modelled hosts ` +
        `${hostsAny === 1 ? 'configures' : 'configure'} a refusal on any slot; ` +
        `${String(hostsAll)} ${hostsAll === 1 ? 'configures' : 'configure'} one on every slot ` +
        'it binds.**'
    );
}

/** The whole region body, between the markers and excluding them. */
export function renderRegion(lowering: HostLowering): string {
    const { rows, slotlessHosts } = buildRows(lowering);
    const out: string[] = [];
    out.push(
        `Projected from \`${LOWERING_REL}\` — **configured behavior, not observed behavior.**`,
    );
    out.push(
        'A cell says what this package has written down about a host, never what the host does.',
    );
    out.push('');
    out.push(summaryLine(lowering, rows));
    out.push('');
    out.push('| Host | Slot | Configured outcome | Backing | Answered |');
    out.push('|---|---|---|---|---|');
    for (const r of rows) {
        out.push(
            `| \`${r.host}\` | \`${r.slot}\` | \`${r.outcome}\` | ${r.backing} | ${r.answered} |`,
        );
    }
    out.push('');
    if (slotlessHosts.length === 0) {
        out.push('Every modelled host carries at least one lowerable slot.');
    } else {
        out.push(
            `**No row above for ${slotlessHosts.map((h) => `\`${h}\``).join(', ')}** — ` +
                'modelled in the configuration with an empty `slots:` map, so there is no ' +
                'host-slot pair to carry an outcome. That is an absence of bindings, not an ' +
                'outcome of `unenforced`.',
        );
    }
    return out.join('\n');
}

/**
 * How each {@link VerifiedEnforcement} is worded in the published table.
 *
 * `unverified` and `warning-only` are worded so a reader cannot slide between
 * them. Only `warning-only` says "cannot"; `unverified` says what is missing.
 */
export const ENFORCEMENT_TEXT: Readonly<Record<VerifiedEnforcement, string>> = {
    refusal: 'the slot denies — the concern does what it declares',
    'proof-expired': 'the slot can deny; this package’s `verified` citation has lapsed',
    'warning-only': 'the slot is bound and `block_exit` is null — it runs and warns, it cannot refuse',
    unverified: 'no lowering row for this slot — nothing is bound natively, and nothing is established',
};

/**
 * The 1.2 region body: one row per `blocking` binding, two independent columns.
 *
 * Grouped by host and ordered as `concernSlotAudit` sorted it, so a
 * regeneration is a no-op whenever nothing moved.
 */
export function renderSeverityRegion(audit: readonly HostConcernAudit[]): string {
    const all = audit.flatMap((h) => h.blocking.map((b) => b));
    const out: string[] = [];
    out.push(
        `Projected from \`${MANIFEST_REL}\` (declared severity) and \`${LOWERING_REL}\` ` +
            '(verified enforcement). **Two independent facts, never folded into one.**',
    );
    out.push('');
    out.push(
        'The manifest declares what a concern is *meant* to do; the lowering table records ' +
            'what the host slot it is bound on *can* do. A `blocking` concern on a slot that ' +
            'cannot refuse still runs and still warns — it is not silent, and it is not a ' +
            'refusal either. These columns say which.',
    );
    out.push('');
    const byEnforcement = (e: VerifiedEnforcement): number =>
        all.filter((b) => b.enforcement === e).length;
    out.push(
        `**${String(all.length)} binding(s) declare \`blocking\`: ` +
            `${String(byEnforcement('refusal'))} refuse, ` +
            `${String(byEnforcement('warning-only'))} run and warn on a slot verified unable to ` +
            `refuse, ${String(byEnforcement('unverified'))} sit on a slot with no lowering row, ` +
            `${String(byEnforcement('proof-expired'))} sit on a slot whose proof has lapsed.**`,
    );
    out.push('');
    out.push('| Host | Slot | Concern | Declared severity | Verified enforcement | What that means |');
    out.push('|---|---|---|---|---|---|');
    for (const b of all) {
        out.push(
            `| \`${b.host}\` | \`${b.slot}\` | \`${b.concern}\` | \`${b.declared}\` | ` +
                `\`${b.enforcement}\` | ${ENFORCEMENT_TEXT[b.enforcement]} |`,
        );
    }
    if (all.length === 0) {
        out.push('');
        out.push('No concern in the manifest declares `blocking`.');
    }
    return out.join('\n');
}

/** Replace the block between one marker pair. Idempotent by construction. */
function _splice(text: string, region: string, begin: string, end: string): string {
    const b = text.indexOf(begin);
    const e = text.indexOf(end);
    if (b === -1 || e === -1 || e < b) {
        throw new Error(
            `${GATE}: ${DOC_REL} is missing the generated-region markers ` +
                `(${begin} … ${end}). Restore them rather than hand-writing the ` +
                'table — the markers are what makes the region regenerable.',
        );
    }
    return `${text.slice(0, b + begin.length)}\n${region}\n${text.slice(e)}`;
}

/** Replace the block between the markers. Idempotent by construction. */
export function spliceDoc(text: string, region: string): string {
    return _splice(text, region, BEGIN_MARKER, END_MARKER);
}

/** Replace the blocking-severity region. Same contract as {@link spliceDoc}. */
export function spliceSeverityDoc(text: string, region: string): string {
    return _splice(text, region, SEVERITY_BEGIN_MARKER, SEVERITY_END_MARKER);
}

function _extract(text: string, begin: string, end: string): string | null {
    const b = text.indexOf(begin);
    const e = text.indexOf(end);
    if (b === -1 || e === -1 || e < b) return null;
    return text
        .slice(b + begin.length, e)
        .replace(/^\n/, '')
        .replace(/\n$/, '');
}

/** The region body a committed document carries, or null when the markers are gone. */
export function extractRegion(text: string): string | null {
    return _extract(text, BEGIN_MARKER, END_MARKER);
}

/** The blocking-severity region a committed document carries, or null. */
export function extractSeverityRegion(text: string): string | null {
    return _extract(text, SEVERITY_BEGIN_MARKER, SEVERITY_END_MARKER);
}

/** One published blocking-severity row, read off the committed region. */
export interface CommittedSeverityCell {
    readonly host: string;
    readonly slot: string;
    readonly concern: string;
    readonly declared: string;
    readonly enforcement: string;
}

/** Blocking-severity rows a committed region carries, in document order. */
export function committedSeverityCells(region: string): CommittedSeverityCell[] {
    const out: CommittedSeverityCell[] = [];
    for (const line of region.split('\n')) {
        if (!line.trim().startsWith('|')) continue;
        const cells = splitMarkdownRow(line);
        if (cells.length < 5) continue;
        if (cells[0] === 'Host' || /^-+$/.test((cells[0] ?? '').trim())) continue;
        const strip = (s: string): string => s.trim().replace(/^`|`$/g, '');
        out.push({
            host: strip(cells[0] ?? ''),
            slot: strip(cells[1] ?? ''),
            concern: strip(cells[2] ?? ''),
            declared: strip(cells[3] ?? ''),
            enforcement: strip(cells[4] ?? ''),
        });
    }
    return out;
}

/**
 * The 1.2 HARD gate: published enforcement claims the configuration refutes.
 *
 * This is the half the council asked to fail rather than report, and the
 * distinction from the audit above is the reason it may. `concernSlotAudit`
 * counts BINDINGS, a population with a legacy backlog this package did not
 * create in one diff — failing on it would red the tree on history. These
 * findings compare a GENERATED DOCUMENT against the configuration it is
 * generated from, which has no backlog by construction: every row was written
 * by the generator one command ago, so a disagreement is a hand edit or a
 * generator bug and neither should ship.
 *
 * Both seats named the same two dishonesty classes, and both directions are
 * checked because they fail in opposite ways:
 *
 *   - A row claiming `refusal` where the slot's `block_exit` is null, or where
 *     there is no row at all, OVERSTATES the guarantee. A reader takes it as a
 *     deterministic block and gets a warning.
 *   - A row claiming `warning-only` where the lowering table has NO row for the
 *     slot UNDERSTATES what is known: it asserts the host cannot refuse, which
 *     is a host fact this package has not established and which
 *     `host_lowering.yaml` explicitly disclaims. `unverified` is the honest
 *     value there, and collapsing the two is how an absence of measurement
 *     becomes a measurement.
 *
 * A value outside {@link VERIFIED_ENFORCEMENTS} is its own finding, for the
 * same reason `unbackedOutcomes` rejects one: an invented category in a
 * generated table looks exactly as authoritative as a real one.
 */
export function severityFindings(region: string, lowering: HostLowering): string[] {
    const findings: string[] = [];
    for (const cell of committedSeverityCells(region)) {
        const label = `${cell.host}/${cell.slot}/${cell.concern}`;
        if (!(VERIFIED_ENFORCEMENTS as readonly string[]).includes(cell.enforcement)) {
            findings.push(
                `${label}: \`${cell.enforcement}\` is not in the closed enforcement vocabulary ` +
                    `(${VERIFIED_ENFORCEMENTS.map((e) => `\`${e}\``).join(' · ')}).`,
            );
            continue;
        }
        const row = readSlots(lowering, cell.host).slots.find(
            (s: SlotReading) => s.slot === cell.slot,
        );
        if (cell.enforcement === 'refusal' && (row === undefined || row.literal === null)) {
            findings.push(
                `${label}: published \`refusal\`, but ${LOWERING_REL} carries ` +
                    `${row === undefined ? 'no row for this slot' : '`block_exit: null`'} — a ` +
                    'refusal has nowhere to go, so the published row overstates the guarantee.',
            );
            continue;
        }
        if (cell.enforcement === 'warning-only' && row === undefined) {
            findings.push(
                `${label}: published \`warning-only\`, which asserts this slot CANNOT refuse, ` +
                    `but ${LOWERING_REL} carries no row for it at all. An absent row is ` +
                    '`unverified`, never a host fact — the table says so in its own header.',
            );
        }
    }
    return findings;
}

/** Outcome cells a committed region carries, with their row label. */
export function committedCells(region: string): { label: string; value: string }[] {
    const out: { label: string; value: string }[] = [];
    for (const line of region.split('\n')) {
        if (!line.trim().startsWith('|')) continue;
        const cells = splitMarkdownRow(line);
        if (cells.length < 4) continue;
        if (cells[0] === 'Host' || /^-+$/.test((cells[0] ?? '').trim())) continue;
        const strip = (s: string): string => s.trim().replace(/^`|`$/g, '');
        out.push({
            label: `${strip(cells[0] ?? '')}/${strip(cells[1] ?? '')}`,
            value: strip(cells[2] ?? ''),
        });
    }
    return out;
}

/**
 * Committed cells carrying a value the configuration cannot produce.
 *
 * Two ways to fail, reported apart because they need different fixes: a value
 * outside the closed set is a typo or an invented category, and a value inside
 * the set that nothing on this tree emits is the phantom `halt-by-state` case.
 */
export function unbackedOutcomes(region: string, backed: ReadonlySet<ConfiguredOutcome>): string[] {
    const findings: string[] = [];
    for (const cell of committedCells(region)) {
        const known = (CONFIGURED_OUTCOMES as readonly string[]).includes(cell.value);
        if (!known) {
            findings.push(
                `${cell.label}: \`${cell.value}\` is not in the closed vocabulary ` +
                    `(${CONFIGURED_OUTCOMES.map((o) => `\`${o}\``).join(' · ')}).`,
            );
            continue;
        }
        if (!backed.has(cell.value as ConfiguredOutcome)) {
            findings.push(
                `${cell.label}: \`${cell.value}\` is in the vocabulary but NO line in ` +
                    `\`${LOWERING_REL}\` produces it on this tree. The value is defined so a ` +
                    'reader who meets it has a definition; it may appear in a cell only once ' +
                    'the configuration carries it.',
            );
        }
    }
    return findings;
}

function _read(root: string, rel: string): string | null {
    const abs = path.join(root, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf-8') : null;
}

/** Flags this gate understands. `--root` is the only one taking a value. */
const KNOWN_FLAGS: ReadonlySet<string> = new Set(['--self-test', '--root', '--write', '--quiet']);

/** Where the concern→slot bindings and per-concern severities live. */
export const MANIFEST_REL = path.join('src', 'scripts', 'hook_manifest.yaml');

/**
 * Why a bound concern's verdict cannot leave its slot.
 *
 * Three states, not two, and the third is the one an earlier version of this
 * audit got wrong by skipping it. They are ordered worst-first:
 *
 *   - `unlowerable`  — the lowering table carries NO row for this slot on this
 *                      host, so the installer writes no native binding at all.
 *                      `cowork` is the worked case: `slots: {}` against sixty-odd
 *                      declared bindings. Skipping it printed `0/0 · 0 blocking`,
 *                      byte-identical to a host that binds nothing — a false
 *                      green on the host with the largest gap.
 *   - `null-block`   — a row exists and its literal `block_exit` is null. The
 *                      slot is wired and a refusal has nowhere to go.
 *   - `stale-proof`  — the literal `block_exit` CAN deny, but the row's
 *                      `verified` block has expired, so `effective` reads null.
 *                      This is a statement about this package's provenance, NOT
 *                      about the host: `host_lowering.yaml` says in its own
 *                      header that an absent `verified` "does NOT mean the host
 *                      cannot enforce". Printing "cannot deny" here would
 *                      assert exactly the host fact that file disclaims, so it
 *                      is reported as its own class and worded differently.
 */
export type NoDenyReason = 'unlowerable' | 'null-block' | 'stale-proof';

/** One concern bound where its verdict cannot produce a refusal. */
export interface NullBlockBinding {
    readonly host: string;
    readonly slot: string;
    readonly concern: string;
    /** The concern's declared `severity`, or `(undeclared)`. */
    readonly severity: string;
    readonly reason: NoDenyReason;
}

/** What {@link concernSlotAudit} establishes for one host. */
export interface HostConcernAudit {
    readonly host: string;
    /** Lowerable slots whose literal `block_exit` can deny. */
    readonly denySlots: number;
    /** Lowerable slots in total. */
    readonly lowerableSlots: number;
    /** Distinct slots this host binds a concern to, whether lowerable or not. */
    readonly boundSlots: number;
    /**
     * Bindings whose verdict cannot become a refusal, worst reason first and
     * `blocking` severity ahead of the rest within a reason.
     *
     * An `advisory` concern here is CONSISTENT, not a defect — most concerns are
     * advisory and belong on a reporting slot. The row that matters is a
     * `blocking` severity: a concern declared to refuse, bound where a refusal
     * has nowhere to go.
     */
    readonly noDeny: readonly NullBlockBinding[];
    /**
     * EVERY binding on this host whose declared severity is `blocking`, with
     * the enforcement its slot carries — including the ones that CAN refuse,
     * which `noDeny` by construction never holds.
     *
     * Separate from `noDeny` rather than a filter over it, because the
     * published table needs the complete picture: a reader who sees only the
     * gaps cannot tell a host that refuses nowhere from a host with no blocking
     * concerns at all, and those are the two readings the 1.2 table exists to
     * keep apart.
     */
    readonly blocking: readonly BlockingBinding[];
}

/** Slots that carry a dispatcher verdict. `ask` is a UI affordance, not one. */
const NON_VERDICT_SLOTS: ReadonlySet<string> = new Set(['ask']);

/**
 * Cross-reference the manifest's concern bindings against the lowering table's
 * per-slot `block_exit`.
 *
 * road-to-a-content-scanner-on-a-slot-that-can-refuse 2.1. The gate above
 * compares published host-SLOT rows against the configuration and is green
 * whenever those agree — it never asks whether a CONCERN is bound to a slot
 * that can carry its severity. That question was answered once, by an external
 * reader comparing two files by hand, which is why it drifted back: a hand
 * comparison leaves no number behind. This makes it a printed count.
 *
 * DELIBERATELY NOT A FAILURE. It prints; the exit code is unchanged. Failing
 * would red the tree on bindings that predate this check — the same reason the
 * continuity and estate ratchets report distance-to-target instead of gating on
 * it. What a reader gets is a number that moves when a binding or a slot moves.
 *
 * NOTHING BOUND IS SILENTLY DROPPED. Every bound slot lands in exactly one of
 * {can deny, one of the three {@link NoDenyReason} classes, non-verdict}, and
 * `boundSlots` publishes the denominator so a reader can check the arithmetic
 * rather than trust it. That is the correction the first version needed: it
 * skipped any slot missing from the lowering table, which is precisely the
 * largest gap in the tree.
 */
export function concernSlotAudit(root: string, lowering: HostLowering): HostConcernAudit[] {
    const manifestText = _read(root, MANIFEST_REL);
    if (manifestText === null) return [];
    let manifest: unknown;
    try {
        manifest = yaml.load(manifestText);
    } catch {
        return [];
    }
    if (manifest === null || typeof manifest !== 'object') return [];
    const m = manifest as Record<string, unknown>;

    const severities = new Map<string, string>();
    const concerns = m['concerns'];
    if (concerns !== null && typeof concerns === 'object') {
        for (const [name, spec] of Object.entries(concerns as Record<string, unknown>)) {
            const sev =
                spec !== null && typeof spec === 'object'
                    ? (spec as Record<string, unknown>)['severity']
                    : undefined;
            severities.set(name, typeof sev === 'string' ? sev : '(undeclared)');
        }
    }

    const platforms = m['platforms'];
    if (platforms === null || typeof platforms !== 'object') return [];

    const out: HostConcernAudit[] = [];
    for (const [host, blockRaw] of Object.entries(platforms as Record<string, unknown>)) {
        const reading = readSlots(lowering, host);
        const rows = new Map<string, SlotReading>(reading.slots.map((s: SlotReading) => [s.slot, s]));
        const denySlots = reading.slots.filter((s: SlotReading) => s.literal !== null).length;

        const noDeny: NullBlockBinding[] = [];
        const blocking: BlockingBinding[] = [];
        let boundSlots = 0;
        if (blockRaw !== null && typeof blockRaw === 'object') {
            for (const [slot, value] of Object.entries(blockRaw as Record<string, unknown>)) {
                if (!Array.isArray(value)) continue;
                if (NON_VERDICT_SLOTS.has(slot)) continue;
                boundSlots += 1;
                const row = rows.get(slot);
                // The literal decides whether a refusal can leave the slot; the
                // `verified` currency decides only whether this package has
                // cited its proof. Reading `effective` here would turn an
                // expired citation into a claim that the host cannot enforce.
                const reason: NoDenyReason | null =
                    row === undefined
                        ? 'unlowerable'
                        : row.literal === null
                          ? 'null-block'
                          : row.effective === null
                            ? 'stale-proof'
                            : null;
                // The 1.2 roster runs BEFORE the `reason === null` return, so a
                // binding on a slot that CAN refuse is recorded here and
                // nowhere else.
                for (const concern of value) {
                    if (typeof concern !== 'string') continue;
                    const declared = severities.get(concern) ?? '(unknown concern)';
                    if (declared !== 'blocking') continue;
                    blocking.push({
                        host,
                        slot,
                        concern,
                        declared,
                        enforcement: enforcementFor(reason),
                    });
                }
                if (reason === null) continue;
                for (const concern of value) {
                    if (typeof concern !== 'string') continue;
                    noDeny.push({
                        host,
                        slot,
                        concern,
                        severity: severities.get(concern) ?? '(unknown concern)',
                        reason,
                    });
                }
            }
        }
        blocking.sort(
            (a, b) => a.slot.localeCompare(b.slot) || a.concern.localeCompare(b.concern),
        );
        const reasonRank = (r: NoDenyReason): number =>
            r === 'unlowerable' ? 0 : r === 'null-block' ? 1 : 2;
        const sevRank = (s: string): number => (s === 'blocking' ? 0 : s === 'advisory' ? 2 : 1);
        noDeny.sort(
            (a, b) =>
                reasonRank(a.reason) - reasonRank(b.reason) ||
                sevRank(a.severity) - sevRank(b.severity) ||
                a.slot.localeCompare(b.slot) ||
                a.concern.localeCompare(b.concern),
        );
        out.push({
            host,
            denySlots,
            lowerableSlots: reading.slots.length,
            boundSlots,
            noDeny,
            blocking,
        });
    }
    return out;
}

/**
 * What a binding's host slot can actually carry, as a closed vocabulary.
 *
 * road-to-blocking-severities 1.2, option (a) as the council revised it on
 * 2026-10-01 (2/2, both seats). The revision is in the NAMES and it is the
 * whole point: the first draft called this the "effective severity", and the
 * second seat refused that term — severity has not changed, enforcement
 * strength has, and a generated document that silently redefines the
 * manifest's own word is worse than one that says nothing. So a binding
 * carries two independent facts, published side by side and never folded into
 * one: the DECLARED severity, which is the concern's policy intent and belongs
 * to `hook_manifest.yaml`, and the VERIFIED ENFORCEMENT below, which is the
 * host slot's measured capability and belongs to `host_lowering.yaml`.
 *
 *   - `refusal`      — the slot's `block_exit` can deny and its `verified`
 *                      proof is current. A `blocking` concern here does what
 *                      it says.
 *   - `warning-only` — a lowering row exists and its `block_exit` is null. The
 *                      slot is wired, the concern runs, and its verdict cannot
 *                      become a refusal. This is the only value that asserts
 *                      the host CANNOT refuse, and it is backed by a row.
 *   - `unverified`   — no lowering row for this slot on this host. Nothing is
 *                      bound natively and nothing has been established.
 *                      Deliberately NOT `warning-only`: `host_lowering.yaml`
 *                      says in its own header that an absence "does NOT mean
 *                      the host cannot enforce", and both council seats named
 *                      collapsing the two the defect to avoid. The gate below
 *                      fails a published row that collapses them.
 *   - `proof-expired` — the literal `block_exit` can deny but this package's
 *                      `verified` citation has lapsed. A statement about our
 *                      provenance, never about the host.
 *
 * Order is strongest-first, matching {@link CONFIGURED_OUTCOMES}'s convention.
 */
export const VERIFIED_ENFORCEMENTS = [
    'refusal',
    'proof-expired',
    'warning-only',
    'unverified',
] as const;

export type VerifiedEnforcement = (typeof VERIFIED_ENFORCEMENTS)[number];

/**
 * The enforcement a {@link NoDenyReason} corresponds to; `null` means the slot
 * can deny, which is the one case `concernSlotAudit` does not record a reason
 * for.
 */
export function enforcementFor(reason: NoDenyReason | null): VerifiedEnforcement {
    if (reason === null) return 'refusal';
    if (reason === 'unlowerable') return 'unverified';
    if (reason === 'null-block') return 'warning-only';
    return 'proof-expired';
}

/** One concern declared `blocking`, with the enforcement its host slot carries. */
export interface BlockingBinding {
    readonly host: string;
    readonly slot: string;
    readonly concern: string;
    /** Always `blocking` here — kept explicit so the published row carries both facts. */
    readonly declared: string;
    readonly enforcement: VerifiedEnforcement;
}

/** How each {@link NoDenyReason} is worded. `stale-proof` never says "cannot". */
const REASON_TEXT: Readonly<Record<NoDenyReason, string>> = {
    unlowerable: 'no lowering row for this slot — nothing is bound natively at all',
    'null-block': 'block_exit is null — a refusal has nowhere to go',
    'stale-proof': 'block_exit can deny, but this row’s `verified` proof has expired',
};

/** Render the audit as the lines the reporter prints. */
export function renderConcernAudit(audit: readonly HostConcernAudit[]): string[] {
    const lines: string[] = [];
    lines.push('');
    lines.push(`${GATE} · concerns bound where a verdict cannot become a refusal`);
    lines.push(
        '  A blocking severity here is a concern declared to refuse, bound where a refusal',
    );
    lines.push('  cannot happen. An advisory one is consistent and is counted, not flagged.');
    lines.push('  `stale-proof` is a statement about this package’s citation, never about the host.');
    for (const h of audit) {
        const blocking = h.noDeny.filter((b) => b.severity === 'blocking');
        const others = h.noDeny.length - blocking.length;
        lines.push(
            `  ${h.host.padEnd(10)} ${String(h.denySlots)}/${String(h.lowerableSlots)} lowerable slot(s) can deny · ` +
                `${String(h.boundSlots)} verdict-bearing slot(s) bound · ` +
                `${String(blocking.length)} blocking + ${String(others)} non-blocking binding(s) cannot refuse`,
        );
        // One line per (reason, slot) rather than per concern: a host with an
        // empty `slots:` map has sixty-odd bindings and the reason is the fact,
        // not the roster.
        const seen = new Set<string>();
        for (const b of h.noDeny) {
            if (b.severity !== 'blocking') continue;
            const key = `${b.reason}/${b.slot}`;
            if (!seen.has(key)) {
                seen.add(key);
                lines.push(`    ⚠️  ${b.slot} — ${REASON_TEXT[b.reason]}`);
            }
            lines.push(`        ${b.concern} (${b.severity})`);
        }
    }
    return lines;
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    // An unrecognised flag is refused rather than ignored. Both ratification
    // seats named the silent-ignore form a fail-open interface defect: this
    // gate is registered in a required CI job, and a mistyped flag that still
    // exits 0 hands back a green nobody earned. Refusing costs a typo its own
    // error message instead of a false pass.
    const unknown = args.filter(
        (a, i) => a.startsWith('-') && !KNOWN_FLAGS.has(a) && args[i - 1] !== '--root',
    );
    if (unknown.length > 0) {
        process.stderr.write(
            `${GATE}: unrecognised flag(s): ${unknown.join(', ')}\n` +
                `    known: ${[...KNOWN_FLAGS].join(', ')}\n`,
        );
        return 2;
    }
    if (args.includes('--self-test')) return selfTest();
    const rootIdx = args.indexOf('--root');
    const root = rootIdx === -1 ? ROOT : (args[rootIdx + 1] ?? ROOT);
    const write = args.includes('--write');

    const loweringText = _read(root, LOWERING_REL);
    const docText = _read(root, DOC_REL);
    if (loweringText === null || docText === null) {
        process.stderr.write(
            `❌  ${GATE}: ${loweringText === null ? LOWERING_REL : DOC_REL} not found under ${root}\n`,
        );
        return 2;
    }

    let lowering: HostLowering;
    try {
        lowering = parseHostLowering(loweringText);
    } catch (exc) {
        process.stderr.write(`❌  ${GATE}: ${LOWERING_REL} did not parse — ${String(exc)}\n`);
        return 2;
    }

    const built = buildRows(lowering);
    const ledger = new GateLedger(GATE);
    ledger.plan(built.rows.map((r) => `${r.host}/${r.slot}`));
    const region = renderRegion(lowering);
    const audit = concernSlotAudit(root, lowering);
    const severityRegion = renderSeverityRegion(audit);

    if (write) {
        let next: string;
        try {
            next = spliceSeverityDoc(spliceDoc(docText, region), severityRegion);
        } catch (exc) {
            process.stderr.write(`❌  ${String(exc)}\n`);
            return 2;
        }
        // The backing check runs BEFORE the write, so a generator bug cannot
        // put a phantom value into the document and then be caught by the
        // check that same generator's output feeds. The 1.2 severity check
        // rides in the same position and for the same reason: a generator that
        // could write `refusal` onto a null `block_exit` must be stopped at the
        // write, not discovered by the next read-only run.
        const phantom = [
            ...unbackedOutcomes(region, backedOutcomes(lowering)),
            ...severityFindings(severityRegion, lowering),
        ];
        if (phantom.length > 0) {
            for (const f of phantom) process.stderr.write(`❌  ${GATE}: ${f}\n`);
            process.stderr.write(
                `${GATE}: refusing to write a region the configuration does not back.\n`,
            );
            return 1;
        }
        for (const r of built.rows) ledger.complete(`${r.host}/${r.slot}`);
        if (next !== docText) fs.writeFileSync(path.join(root, DOC_REL), next, 'utf-8');
        reportScanned({
            gate: GATE,
            scanned: built.rows.length,
            units: 'host-slot pair(s)',
            roots: [LOWERING_REL],
        });
        ledger.report();
        process.stdout.write(
            `✅  ${GATE}: wrote ${String(built.rows.length)} host-slot row(s) into ${DOC_REL}` +
                `${next === docText ? ' (already current)' : ''}.\n`,
        );
        return 0;
    }

    const committed = extractRegion(docText);
    if (committed === null) {
        process.stderr.write(
            `❌  ${GATE}: ${DOC_REL} has no generated region. The markers ` +
                `${BEGIN_MARKER} … ${END_MARKER} are what make the table regenerable; restore ` +
                `them and run \`${REGEN_COMMAND}\`.\n`,
        );
        return 2;
    }

    const committedSeverity = extractSeverityRegion(docText);
    if (committedSeverity === null) {
        process.stderr.write(
            `❌  ${GATE}: ${DOC_REL} has no blocking-severity region. The markers ` +
                `${SEVERITY_BEGIN_MARKER} … ${SEVERITY_END_MARKER} are what make that table ` +
                `regenerable; restore them and run \`${REGEN_COMMAND}\`.\n`,
        );
        return 2;
    }

    const findings: string[] = [];
    findings.push(...unbackedOutcomes(committed, backedOutcomes(lowering)));
    findings.push(...built.contradictions);
    findings.push(...severityFindings(committedSeverity, lowering));
    if (committed !== region) {
        findings.push(
            `${DOC_REL} § the generated region differs from what \`${LOWERING_REL}\` produces.`,
        );
    }
    if (committedSeverity !== severityRegion) {
        findings.push(
            `${DOC_REL} § the blocking-severity region differs from what \`${MANIFEST_REL}\` ` +
                `and \`${LOWERING_REL}\` produce.`,
        );
    }

    // A pair is `fail`ed when the committed cell for it is absent or carries a
    // different outcome, and `complete`d otherwise. The denominator is the
    // configuration's pairs, not the document's — a pair the document dropped
    // must count as unchecked work rather than vanish from the accounting.
    const byLabel = new Map(committedCells(committed).map((c) => [c.label, c.value]));
    for (const r of built.rows) {
        const label = `${r.host}/${r.slot}`;
        const got = byLabel.get(label);
        if (got === r.outcome) ledger.complete(label);
        else {
            ledger.fail(
                label,
                `published \`${got ?? '(absent)'}\`, configuration says \`${r.outcome}\``,
            );
        }
    }

    reportScanned({
        gate: GATE,
        scanned: built.rows.length,
        units: 'host-slot pair(s)',
        roots: [LOWERING_REL],
    });
    ledger.report();

    // The concern-vs-slot audit prints on every read-only run, before the
    // verdict, so it is visible whether the row comparison passed or failed.
    // It never changes the exit code — see `concernSlotAudit`.
    for (const line of renderConcernAudit(audit)) {
        process.stdout.write(`${line}\n`);
    }

    if (findings.length > 0) {
        for (const f of findings) process.stdout.write(`❌  ${GATE}: ${f}\n`);
        process.stdout.write(
            `\n${String(findings.length)} finding(s). Regenerate with:\n` +
                `    ${REGEN_COMMAND}\n` +
                `Corrections belong in \`${LOWERING_REL}\` or in the generator, never in the ` +
                'table — a cell edited by hand is overwritten by the next regeneration, and ' +
                'reported by this gate in between.\n',
        );
        return 1;
    }
    process.stdout.write(
        `✅  ${GATE}: ${String(built.rows.length)} host-slot row(s) in ${DOC_REL} match ` +
            `${LOWERING_REL}.\n`,
    );
    return 0;
}

/**
 * One rejecting case per way the region and the configuration can part company.
 *
 * The `halt-by-state` case is the one that matters most: a cell claiming a
 * value the configuration does not carry must red the gate. Its fixture is
 * built by hand rather than generated, because a fixture the generator produced
 * could not demonstrate a value the generator cannot emit.
 */
function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'enforcement-matrix-'));
    const lowering = _read(ROOT, LOWERING_REL) ?? '';
    const plant = (name: string, mutate: (region: string) => string): string => {
        const dir = path.join(tmp, name);
        fs.mkdirSync(path.join(dir, path.dirname(LOWERING_REL)), { recursive: true });
        fs.mkdirSync(path.join(dir, path.dirname(DOC_REL)), { recursive: true });
        fs.writeFileSync(path.join(dir, LOWERING_REL), lowering, 'utf-8');
        const region = renderRegion(parseHostLowering(lowering));
        fs.writeFileSync(
            path.join(dir, DOC_REL),
            `# fixture\n\n${BEGIN_MARKER}\n${mutate(region)}\n${END_MARKER}\n`,
            'utf-8',
        );
        return dir;
    };
    const run = (root: string): number =>
        runGateCli(ROOT, `src/scripts/${GATE}.ts`, ['--root', root], root);

    try {
        return runSelfTest({
            gate: GATE,
            minCases: 5,
            minRejectCases: 4,
            cases: [
                {
                    name: 'a cell claiming `halt-by-state`, which nothing emits, is rejected',
                    expect: 'reject',
                    run: () =>
                        run(plant('phantom', (r) => r.replace('| `warning` |', '| `halt-by-state` |'))),
                },
                {
                    name: 'a cell outside the closed vocabulary is rejected',
                    expect: 'reject',
                    run: () => run(plant('vocab', (r) => r.replace('| `refusal` |', '| `blocked` |'))),
                },
                {
                    name: 'a hand-flipped outcome is rejected',
                    expect: 'reject',
                    run: () => run(plant('flip', (r) => r.replace('| `refusal` |', '| `unenforced` |'))),
                },
                {
                    name: 'a deleted row is rejected',
                    expect: 'reject',
                    run: () =>
                        run(
                            plant('deleted', (r) =>
                                r
                                    .split('\n')
                                    .filter((l) => !l.includes('| `refusal` |'))
                                    .join('\n'),
                            ),
                        ),
                },
                {
                    name: 'the regenerated region passes',
                    expect: 'accept',
                    run: () => run(plant('good', (r) => r)),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
