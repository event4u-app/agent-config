#!/usr/bin/env tsx
/**
 * report_enforcement_drift.ts — the published enforcement claim, per host,
 * beside the per-slot blocking values the runtime resolver actually reads.
 *
 * READ-ONLY AND OFFLINE. It opens two files for reading, prints, and exits. It
 * creates no directory, opens no socket, and has no code path that puts a byte
 * on disk. That is a property a reader can check with one grep rather than
 * trust, and it is the reason this is a report and not a generator: deciding
 * whether the published document may become partly build output is a
 * documentation-policy call that has not been made.
 *
 * WHY IT EXISTS
 * -------------
 * `docs/enforcement-by-host.md` states, per HOST, whether a deny is honoured.
 * `src/scripts/hooks/host_lowering.yaml` records, per (host, surface, SLOT),
 * the exit code the host honours as a refusal there — `null` meaning this tree
 * has established nothing. Those are different shapes. A host-level cell has to
 * summarise a column of slot values, and nothing checked that the summary was
 * faithful. This prints both, side by side, and names the rows where they
 * disagree.
 *
 * THE COMPARISON RULE, AND WHY THE COUNT DEPENDS ON IT
 * ---------------------------------------------------
 * Two readings of a host-level cell are defensible, and they do not return the
 * same number, so the rule is a flag rather than a hidden constant.
 *
 *   strict (default)  A binary host-level cell is accurate only when the slot
 *                     values under it are UNANIMOUS. `honoured` requires every
 *                     lowerable slot to carry a block exit; `not-honoured`
 *                     requires every one to carry none.
 *   lenient           `honoured` requires only that SOME slot carries a block
 *                     exit.
 *
 * Strict is the default because an unqualified host-level "refuses on a deny"
 * is what a reader reconstructs as "a guard bound on this host is honoured",
 * and a guard bound to a non-blocking slot on that same host runs and is
 * ignored. The lenient rule cannot distinguish those two states — it reports a
 * host with one blocking slot out of nine exactly as it reports a host with
 * nine out of nine — so choosing it would make the drift this report exists to
 * measure invisible by construction. Both counts are printed either way; the
 * flag only chooses which one is the headline.
 *
 * WHAT IS NOT COUNTED AS A MISMATCH, AND WHY
 * ------------------------------------------
 *   Hosts absent from the lowering table. A published row for a host the
 *   lowering configuration does not model has no second value to compare
 *   against. It is reported as unverifiable-from-this-file, never as a
 *   disagreement — a missing row is silence, not a contradiction, and counting
 *   it would inflate the finding with a claim sourced from a different file.
 *
 *   The bound-slot count column. The published column counts DECLARED bindings
 *   (`hook_manifest.yaml`); the lowering table records what an install can
 *   actually emit. Those are two senses the published document itself keeps
 *   apart, and it already records one disagreement between them in prose. The
 *   lowerable count is printed beside the published number as context and has
 *   no effect on the mismatch count, because comparing the two columns would
 *   be comparing two different questions.
 *
 * VERIFICATION CURRENCY IS APPLIED, NOT IGNORED. The effective blocking value
 * is `blockExitFor`'s: a row whose `verified` block is absent or expired cannot
 * carry a blocking binding, whatever its slot literals say. The raw literal is
 * printed too, so an expiry that has silently disarmed a host is visible as a
 * difference between the two columns rather than as a value that quietly turned
 * into `null`.
 *
 * Exit: 0 always. A usage error is 1. It gates on nothing and must not acquire
 * a threshold — the drift it measures is a documentation defect whose fix is a
 * human edit or a generator, and a report that fails a build before either
 * exists would only teach people to skip it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { splitMarkdownRow } from './_lib/md_table.js';
import {
    DEFAULT_SURFACE,
    type HostLowering,
    isVerifiedNow,
    parseHostLowering,
} from './hooks/host_lowering.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const DEFAULT_LOWERING = path.join('src', 'scripts', 'hooks', 'host_lowering.yaml');
export const DEFAULT_DOC = path.join('docs', 'enforcement-by-host.md');

/**
 * The header that identifies the enforcement matrix inside the published
 * document.
 *
 * Matched on its cells rather than on position, because the document carries
 * more than one table and gained another one recently. A positional read would
 * have silently retargeted onto whichever table happened to come first.
 */
const MATRIX_HEADER = ['Host', 'Compile-time rules', 'Lifecycle slots bound', 'Deny honoured'];

/** What the published cell asserts. */
export type ClaimedDeny = 'honoured' | 'not-honoured' | 'not-applicable' | 'unparsed';

/** What the lowering configuration says about a host's slot column. */
export type DerivedDeny = 'all' | 'partial' | 'none' | 'no-slots' | 'unmodelled';

export type ComparisonRule = 'strict' | 'lenient';

export interface SlotReading {
    slot: string;
    /** The literal in the table. */
    literal: number | null;
    /** The literal after the row's verification currency is applied. */
    effective: number | null;
}

export interface PublishedRow {
    /** The label exactly as the document writes it. */
    label: string;
    /** The lowering key it resolves to. */
    host: string;
    /** The bound-slot count the document publishes, or null when unparsable. */
    publishedSlots: number | null;
    claimed: ClaimedDeny;
    /** The whole cell, so a reason clause is quotable in the output. */
    claimCell: string;
}

export interface HostComparison extends PublishedRow {
    derived: DerivedDeny;
    slots: SlotReading[];
    /** Lowerable slots, which is not the published count's sense. */
    lowerableSlots: number;
    blockingSlots: string[];
    nonBlockingSlots: string[];
    /** Present in the lowering table with an unexpired `verified` block. */
    verifiedNow: boolean;
    mismatchStrict: boolean;
    mismatchLenient: boolean;
    /** No lowering row, so nothing to compare — never a mismatch. */
    unverifiable: boolean;
}

export interface DriftReport {
    loweringPath: string;
    docPath: string;
    rule: ComparisonRule;
    rows: HostComparison[];
    /** Rows under the chosen rule. */
    mismatches: HostComparison[];
    /** Rows the other rule would have flagged, so the choice is visible. */
    mismatchesStrict: HostComparison[];
    mismatchesLenient: HostComparison[];
    unverifiable: HostComparison[];
}

/**
 * The lowering key a published label names.
 *
 * The first word, lower-cased, resolves every row the document carries today
 * (`Claude Code (plugin)` to `claude`, and eight one-word labels to themselves).
 * A label that does not resolve is reported as unmodelled rather than guessed
 * at, which is the same treatment a host genuinely absent from the table gets —
 * both mean "no value to compare", and inventing a mapping would turn a naming
 * change into a false agreement.
 */
export function loweringKeyFor(label: string): string {
    const first = label.trim().split(/\s+/)[0] ?? '';
    return first.toLowerCase().replace(/[^a-z]/g, '');
}

/** Read the published deny cell without inferring anything from its prose. */
export function parseClaim(cell: string): ClaimedDeny {
    const c = cell.trim();
    if (c.startsWith('✅')) return 'honoured';
    if (c.startsWith('❌')) return 'not-honoured';
    if (c.startsWith('—') || c.startsWith('-')) return 'not-applicable';
    return 'unparsed';
}

/**
 * Rows of the enforcement matrix, in document order.
 *
 * Returns an empty list when the header is absent. An empty list is reported as
 * such by the renderer and never silently treated as "no drift" — a report that
 * cannot find its subject must not read as a clean bill of health.
 */
export function parsePublishedMatrix(markdown: string): PublishedRow[] {
    const lines = markdown.split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        if (!line.trim().startsWith('|')) continue;
        const cells = splitMarkdownRow(line);
        if (cells.length === MATRIX_HEADER.length && MATRIX_HEADER.every((h, j) => cells[j] === h)) {
            start = i + 2;
            break;
        }
    }
    if (start < 0) return [];
    const out: PublishedRow[] = [];
    for (let i = start; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        if (!line.trim().startsWith('|')) break;
        const cells = splitMarkdownRow(line);
        if (cells.length < MATRIX_HEADER.length) break;
        const label = cells[0] ?? '';
        const slotCell = cells[2] ?? '';
        const m = /^(\d+)$/.exec(slotCell.trim());
        out.push({
            label,
            host: loweringKeyFor(label),
            publishedSlots: m === null ? null : Number(m[1]),
            claimed: parseClaim(cells[3] ?? ''),
            claimCell: (cells[3] ?? '').trim(),
        });
    }
    return out;
}

/** Fold a host's slot column into the vocabulary a host-level cell can carry. */
export function deriveDeny(slots: SlotReading[], present: boolean): DerivedDeny {
    if (!present) return 'unmodelled';
    if (slots.length === 0) return 'no-slots';
    const blocking = slots.filter((s) => s.effective !== null).length;
    if (blocking === 0) return 'none';
    return blocking === slots.length ? 'all' : 'partial';
}

/**
 * Does the published cell agree with the derived value under `rule`?
 *
 * `not-applicable` is accepted against `no-slots` and `unmodelled` only: a
 * dash means the question does not arise, which is true exactly when there is
 * nothing bound to ask it of.
 */
export function agrees(claimed: ClaimedDeny, derived: DerivedDeny, rule: ComparisonRule): boolean {
    if (derived === 'unmodelled') return true;
    switch (claimed) {
        case 'honoured':
            return rule === 'strict' ? derived === 'all' : derived === 'all' || derived === 'partial';
        case 'not-honoured':
            return derived === 'none' || derived === 'no-slots';
        case 'not-applicable':
            return derived === 'no-slots';
        case 'unparsed':
            return false;
    }
}

export function compareEnforcement(
    lowering: HostLowering,
    markdown: string,
    rule: ComparisonRule,
    loweringPath: string,
    docPath: string,
): DriftReport {
    const rows: HostComparison[] = [];
    for (const published of parsePublishedMatrix(markdown)) {
        const surfaces = lowering.get(published.host);
        const row = surfaces?.get(DEFAULT_SURFACE) ?? null;
        const verifiedNow = isVerifiedNow(row);
        const slots: SlotReading[] = [];
        if (row) {
            for (const [slot, sr] of row.slots) {
                slots.push({
                    slot,
                    literal: sr.block_exit,
                    effective: verifiedNow ? sr.block_exit : null,
                });
            }
        }
        const derived = deriveDeny(slots, row !== null);
        rows.push({
            ...published,
            derived,
            slots,
            lowerableSlots: slots.length,
            blockingSlots: slots.filter((s) => s.effective !== null).map((s) => s.slot),
            nonBlockingSlots: slots.filter((s) => s.effective === null).map((s) => s.slot),
            verifiedNow,
            mismatchStrict: !agrees(published.claimed, derived, 'strict'),
            mismatchLenient: !agrees(published.claimed, derived, 'lenient'),
            unverifiable: derived === 'unmodelled',
        });
    }
    const mismatchesStrict = rows.filter((r) => r.mismatchStrict);
    const mismatchesLenient = rows.filter((r) => r.mismatchLenient);
    return {
        loweringPath,
        docPath,
        rule,
        rows,
        mismatches: rule === 'strict' ? mismatchesStrict : mismatchesLenient,
        mismatchesStrict,
        mismatchesLenient,
        unverifiable: rows.filter((r) => r.unverifiable),
    };
}

function _derivedLabel(r: HostComparison): string {
    switch (r.derived) {
        case 'all':
            return `all ${String(r.lowerableSlots)} lowerable slot(s) block`;
        case 'partial':
            return `${String(r.blockingSlots.length)} of ${String(r.lowerableSlots)} lowerable slots block`;
        case 'none':
            return `0 of ${String(r.lowerableSlots)} lowerable slots block`;
        case 'no-slots':
            return 'no lowerable slots';
        case 'unmodelled':
            return 'no row in the lowering configuration';
    }
}

export function render(d: DriftReport): string {
    const lines: string[] = [];
    lines.push('enforcement drift — published host claim vs per-slot lowering values');
    lines.push(`  lowering: ${d.loweringPath}`);
    lines.push(`  document: ${d.docPath}`);
    lines.push(`  rule:     ${d.rule}`);
    lines.push('');

    if (d.rows.length === 0) {
        lines.push('  The enforcement matrix header was not found in the document. Nothing was');
        lines.push('  compared. This is a parse failure, NOT an empty mismatch list — do not read');
        lines.push('  it as the table being accurate. Check that the header still reads:');
        lines.push(`    | ${MATRIX_HEADER.join(' | ')} |`);
        return lines.join('\n');
    }

    lines.push('  PER HOST, PER SLOT');
    for (const r of d.rows) {
        const mark = r.unverifiable ? '--' : d.mismatches.includes(r) ? '❌' : '✅';
        lines.push(`  ${mark} ${r.label}  [${r.host}]`);
        lines.push(`       published: ${r.claimCell || '(empty)'}`);
        lines.push(`       derived:   ${_derivedLabel(r)}`);
        // Only when currency actually CHANGED a value. A host whose literals are
        // all null already has nothing for an expiry to disarm, and printing the
        // note there would read as a host that used to block and quietly stopped.
        if (!r.verifiedNow && r.slots.some((s) => s.literal !== null)) {
            lines.push('       note:      no unexpired `verified` block, so every effective value');
            lines.push('                  is null whatever the slot literals say');
        }
        for (const s of r.slots) {
            const eff = s.effective === null ? 'null' : String(s.effective);
            const lit = s.literal === null ? 'null' : String(s.literal);
            const drift = lit === eff ? '' : `   (literal ${lit}, disarmed by expiry)`;
            lines.push(`         ${s.slot.padEnd(20)} block_exit ${eff}${drift}`);
        }
        if (r.lowerableSlots === 0) {
            lines.push('         (none)');
        }
        lines.push(
            `       slot count: published ${r.publishedSlots === null ? '?' : String(r.publishedSlots)}` +
                ` · lowerable ${String(r.lowerableSlots)}` +
                (r.publishedSlots !== null && r.publishedSlots !== r.lowerableSlots
                    ? '   (different senses — see the note below; not a mismatch here)'
                    : ''),
        );
        lines.push('');
    }

    lines.push(`  MISMATCHES under the ${d.rule} rule: ${String(d.mismatches.length)}`);
    if (d.mismatches.length === 0) {
        lines.push('    None. Every published host cell agrees with the slot values under it at');
        lines.push('    slot granularity. That is a finding, not a skipped check — the table was');
        lines.push('    measured against its data source and matched.');
    }
    for (const r of d.mismatches) {
        lines.push(`    - ${r.label} [${r.host}]`);
        lines.push(`        published claims ${r.claimed}, configuration says ${_derivedLabel(r)}`);
        if (r.blockingSlots.length > 0) {
            lines.push(`        blocking:     ${r.blockingSlots.join(', ')}`);
        }
        if (r.nonBlockingSlots.length > 0) {
            lines.push(`        NOT blocking: ${r.nonBlockingSlots.join(', ')}`);
        }
    }
    lines.push('');

    const other: ComparisonRule = d.rule === 'strict' ? 'lenient' : 'strict';
    const otherCount = other === 'strict' ? d.mismatchesStrict.length : d.mismatchesLenient.length;
    lines.push(`  Under the ${other} rule the count would be ${String(otherCount)}.`);
    if (otherCount !== d.mismatches.length) {
        lines.push('  The two rules disagree, so the headline number is a consequence of the rule');
        lines.push('  and not of the data alone. The strict rule reads a binary host-level cell as');
        lines.push('  a claim about every slot under it; the lenient rule reads it as a claim about');
        lines.push('  at least one. Re-run with --rule to see the other reading rather than');
        lines.push('  taking this sentence for it.');
    }
    lines.push('');

    if (d.unverifiable.length > 0) {
        lines.push(`  NOT COMPARED (${String(d.unverifiable.length)}) — published, but absent from the lowering`);
        lines.push('  configuration, so there is no second value. Reported rather than counted: a');
        lines.push('  missing row is silence, and a claim sourced from another file is not this');
        lines.push("  file's to contradict.");
        for (const r of d.unverifiable) {
            lines.push(`    - ${r.label} [${r.host}]: ${r.claimCell || '(empty)'}`);
        }
        lines.push('');
    }

    const countGap = d.rows.filter(
        (r) => !r.unverifiable && r.publishedSlots !== null && r.publishedSlots !== r.lowerableSlots,
    );
    if (countGap.length > 0) {
        lines.push(`  SLOT-COUNT COLUMN (${String(countGap.length)} row(s) differ) — advisory, deliberately not a`);
        lines.push('  mismatch. The published column counts DECLARED bindings; this file records');
        lines.push('  what an install can emit. Two senses the document itself keeps apart, so a');
        lines.push('  difference here is an axis difference and not necessarily an error.');
        for (const r of countGap) {
            lines.push(
                `    - ${r.label}: published ${String(r.publishedSlots)} · lowerable ${String(r.lowerableSlots)}`,
            );
        }
        lines.push('');
    }

    lines.push(`scanned: ${String(d.rows.length)}`);
    return lines.join('\n');
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let loweringPath = path.join(REPO_ROOT, DEFAULT_LOWERING);
    let docPath = path.join(REPO_ROOT, DEFAULT_DOC);
    let rule: ComparisonRule = 'strict';
    let asJson = false;
    // A value must not itself be a flag: `--doc --rule strict` would otherwise
    // resolve a file literally named `--rule` and silently drop `strict`.
    const value = (i: number): string | null => {
        const v = args[i + 1];
        return v === undefined || v.startsWith('-') ? null : v;
    };
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        if (a === '--lowering' || a === '--doc' || a === '--rule') {
            const v = value(i);
            if (v === null) {
                process.stderr.write(`report_enforcement_drift: ${a} needs a value\n`);
                return 1;
            }
            if (a === '--rule') {
                if (v !== 'strict' && v !== 'lenient') {
                    process.stderr.write(`report_enforcement_drift: --rule must be strict or lenient\n`);
                    return 1;
                }
                rule = v;
            } else if (a === '--lowering') loweringPath = path.resolve(v);
            else docPath = path.resolve(v);
            i += 1;
        } else if (a === '--json') {
            asJson = true;
        } else if (a === '--help' || a === '-h') {
            process.stdout.write(
                'usage: report_enforcement_drift [--lowering FILE] [--doc FILE] ' +
                    '[--rule strict|lenient] [--json]\n',
            );
            return 0;
        } else if (a !== undefined && a.startsWith('-')) {
            process.stderr.write(`report_enforcement_drift: unknown flag ${a}\n`);
            return 1;
        }
    }

    let lowering: HostLowering;
    let markdown: string;
    try {
        lowering = parseHostLowering(fs.readFileSync(loweringPath, 'utf-8'));
        markdown = fs.readFileSync(docPath, 'utf-8');
    } catch (exc) {
        process.stderr.write(`❌  report_enforcement_drift: ${String(exc)}\n`);
        return 1;
    }

    const report = compareEnforcement(lowering, markdown, rule, loweringPath, docPath);
    if (asJson) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return 0;
    }
    process.stdout.write(`${render(report)}\n`);
    return 0;
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
