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

export interface MatrixRow {
    host: string;
    slot: string;
    outcome: ConfiguredOutcome;
    /** The configuration values the outcome was read off, quoted for the table. */
    backing: string;
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
    out.push('| Host | Slot | Configured outcome | Backing |');
    out.push('|---|---|---|---|');
    for (const r of rows) {
        out.push(`| \`${r.host}\` | \`${r.slot}\` | \`${r.outcome}\` | ${r.backing} |`);
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

/** Replace the block between the markers. Idempotent by construction. */
export function spliceDoc(text: string, region: string): string {
    const b = text.indexOf(BEGIN_MARKER);
    const e = text.indexOf(END_MARKER);
    if (b === -1 || e === -1 || e < b) {
        throw new Error(
            `${GATE}: ${DOC_REL} is missing the generated-region markers ` +
                `(${BEGIN_MARKER} … ${END_MARKER}). Restore them rather than hand-writing the ` +
                'table — the markers are what makes the region regenerable.',
        );
    }
    return `${text.slice(0, b + BEGIN_MARKER.length)}\n${region}\n${text.slice(e)}`;
}

/** The region body a committed document carries, or null when the markers are gone. */
export function extractRegion(text: string): string | null {
    const b = text.indexOf(BEGIN_MARKER);
    const e = text.indexOf(END_MARKER);
    if (b === -1 || e === -1 || e < b) return null;
    return text
        .slice(b + BEGIN_MARKER.length, e)
        .replace(/^\n/, '')
        .replace(/\n$/, '');
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

    if (write) {
        let next: string;
        try {
            next = spliceDoc(docText, region);
        } catch (exc) {
            process.stderr.write(`❌  ${String(exc)}\n`);
            return 2;
        }
        // The backing check runs BEFORE the write, so a generator bug cannot
        // put a phantom value into the document and then be caught by the
        // check that same generator's output feeds.
        const phantom = unbackedOutcomes(region, backedOutcomes(lowering));
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

    const findings: string[] = [];
    findings.push(...unbackedOutcomes(committed, backedOutcomes(lowering)));
    findings.push(...built.contradictions);
    if (committed !== region) {
        findings.push(
            `${DOC_REL} § the generated region differs from what \`${LOWERING_REL}\` produces.`,
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
