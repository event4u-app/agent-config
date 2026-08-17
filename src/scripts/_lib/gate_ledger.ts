/**
 * Completeness accounting — "planned work reaches exactly one terminal outcome".
 *
 * WHY THIS EXISTS. `_lib/scan_scope.ts` closed one half of the false-green
 * class: a gate whose *root* is dead now fails instead of printing a green
 * checkmark over zero files. It cannot close the other half. A gate with a live
 * root that enumerates 300 targets, `continue`s past 280 of them on assorted
 * unwritten conditions, and checks 20, still exits 0 — and its output is
 * indistinguishable from a gate that checked all 300. Absence of findings and
 * absence of scanning look alike, which is the exact failure this repository
 * has recorded four separate times from its own history.
 *
 * The ledger makes the per-target accounting explicit and mechanical:
 *
 * 1. The gate **plans** every target it intends to consider.
 * 2. Every planned target must reach exactly ONE terminal outcome —
 *    {@link GateLedger.complete}, {@link GateLedger.fail},
 *    {@link GateLedger.skip}, or {@link GateLedger.outOfScope}.
 * 3. {@link GateLedger.finalize} throws when any planned target reached none.
 *
 * A planned target with no terminal outcome is a silent `continue` — the defect
 * this module exists to catch. Naming it costs one call at the top of the loop
 * body and one at each exit.
 *
 * **Why skip reasons are a closed union rather than a free string.** Every gate
 * in this tree already skips targets, and every one of them explains itself in
 * prose that no reader can aggregate: "excluded dir", "too big", "binary?",
 * "(no creds)". A closed vocabulary makes the skips countable and comparable
 * across the estate, and — the load-bearing part — makes an unlisted reason a
 * *typecheck* failure rather than a code review someone has to notice. Adding a
 * genuinely new reason is a visible one-line diff to {@link SKIP_REASON_MESSAGE},
 * which is the review surface a free string never gets.
 *
 * Scope note: this is deliberately not a scan-root guard. Use
 * {@link import('./scan_scope.js').assertScanned} for the root, and this for
 * the items under it. The two are complementary and a gate wants both.
 */
import process from 'node:process';

/**
 * The closed vocabulary of reasons a planned target may go unchecked.
 *
 * Seeded from the reasons this repository's own gates already emit in prose, so
 * the first adopters translate rather than invent. Every code carries a
 * one-sentence message in {@link SKIP_REASON_MESSAGE}; a code without one does
 * not typecheck, because the record type is keyed on this union.
 */
export type GateSkipReason =
    | 'excluded_directory'
    | 'size_limit'
    | 'binary_content'
    | 'missing_credentials'
    | 'rules_unavailable'
    | 'manifest_absent'
    | 'no_applicable_files'
    | 'disabled_by_configuration'
    | 'generated_artifact'
    | 'dead_scan_root'
    | 'declared_exemption'
    | 'not_applicable_kind'
    | 'precondition_unmet'
    | 'check_did_not_run';

/**
 * One sentence per skip code, printed verbatim in the ledger's own output.
 *
 * The sentence is the audit surface: a reader who sees `size_limit ×41` in a
 * gate's report should be able to decide, without opening the gate, whether 41
 * unchecked targets is expected.
 */
export const SKIP_REASON_MESSAGE: Record<GateSkipReason, string> = {
    excluded_directory: 'the target sits under a directory this gate deliberately does not walk',
    size_limit: 'the target exceeds the size ceiling this gate reads within',
    binary_content: 'the target is not decodable text, so the check does not apply to it',
    missing_credentials: 'the check needs a credential that is not present in this environment',
    rules_unavailable: 'the rule or policy corpus this check compares against could not be loaded',
    manifest_absent: 'the manifest that declares what to check for this target does not exist',
    no_applicable_files: 'the target resolved to zero files the check applies to',
    disabled_by_configuration: 'a setting in this repository turns this check off for the target',
    generated_artifact: 'the target is generated output whose source is checked instead',
    dead_scan_root: 'the root this target was enumerated from no longer exists',
    declared_exemption: 'the target carries an explicit, reviewable exemption from this check',
    not_applicable_kind: 'the target is a kind of artifact this check does not apply to',
    precondition_unmet: 'a precondition of this run settled the verdict before the target could be inspected',
    check_did_not_run: 'the check itself could not be executed, so the target was never read',
};

/** Terminal outcomes a planned target can reach. Exactly one, exactly once. */
export type GateOutcomeKind = 'completed' | 'failed' | 'skipped' | 'out_of_scope';

/** What {@link GateLedger.finalize} returns once every planned target is accounted for. */
export interface GateLedgerTally {
    planned: number;
    completed: number;
    skipped: number;
    failed: number;
    out_of_scope: number;
    /** Planned targets that reached no terminal outcome. Non-zero means `finalize` threw. */
    unaccounted: number;
    /** Skip counts per code, for the report line and for downstream auditing. */
    skips_by_reason: Partial<Record<GateSkipReason, number>>;
}

/** Raised when planned work did not reach a terminal outcome. */
export class UnaccountedTargetsError extends Error {
    readonly gate: string;
    readonly targets: readonly string[];

    constructor(gate: string, targets: readonly string[]) {
        const shown = targets.slice(0, 20);
        const more = targets.length - shown.length;
        super(
            `${gate}: ${String(targets.length)} planned target(s) reached no terminal outcome — ` +
                'the gate enumerated them and then neither checked, failed, skipped, nor ' +
                'excluded them, so its green result covers less than it appears to. ' +
                `Unaccounted: ${shown.join(', ')}${more > 0 ? ` … and ${String(more)} more` : ''}`,
        );
        this.name = 'UnaccountedTargetsError';
        this.gate = gate;
        this.targets = targets;
    }
}

/**
 * Raised when the ledger is used incorrectly.
 *
 * A double terminal outcome, or an outcome for a target that was never planned,
 * means the accounting itself is wrong — and an accounting bug that passes
 * quietly would restore exactly the blind spot this module removes. So these
 * throw rather than warn.
 */
export class LedgerUsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LedgerUsageError';
    }
}

interface Resolution {
    kind: GateOutcomeKind;
    reason: string;
}

/**
 * Per-target completeness ledger for one gate run.
 *
 * ```ts
 * const ledger = new GateLedger('lint_example');
 * ledger.plan(files);
 * for (const file of files) {
 *     if (isGenerated(file)) { ledger.outOfScope(file, 'generated_artifact'); continue; }
 *     if (tooBig(file)) { ledger.skip(file, 'size_limit'); continue; }
 *     const finding = check(file);
 *     if (finding) ledger.fail(file, finding); else ledger.complete(file);
 * }
 * ledger.report();          // throws if anything was left unaccounted
 * ```
 */
export class GateLedger {
    readonly gate: string;
    /** Insertion-ordered so the unaccounted list reads in enumeration order. */
    private readonly planned = new Map<string, Resolution | undefined>();

    constructor(gate: string) {
        this.gate = gate;
    }

    /** Declare one or more targets this run intends to consider. */
    plan(target: string | readonly string[]): void {
        const targets = typeof target === 'string' ? [target] : target;
        for (const t of targets) {
            if (this.planned.has(t)) {
                throw new LedgerUsageError(
                    `${this.gate}: target planned twice: ${t}. A duplicate plan makes the ` +
                        'denominator wrong in the direction that hides work.',
                );
            }
            this.planned.set(t, undefined);
        }
    }

    /** The target was checked and satisfied the gate. */
    complete(target: string): void {
        this.resolve(target, { kind: 'completed', reason: '' });
    }

    /** The target was checked and violated the gate. `reason` is the finding text. */
    fail(target: string, reason: string): void {
        this.resolve(target, { kind: 'failed', reason });
    }

    /** The target was NOT checked; `reason` names why, from the closed vocabulary. */
    skip(target: string, reason: GateSkipReason): void {
        this.resolve(target, { kind: 'skipped', reason });
    }

    /** The target does not belong to this gate's corpus; `reason` names why. */
    outOfScope(target: string, reason: GateSkipReason): void {
        this.resolve(target, { kind: 'out_of_scope', reason });
    }

    private resolve(target: string, resolution: Resolution): void {
        if (!this.planned.has(target)) {
            throw new LedgerUsageError(
                `${this.gate}: ${resolution.kind} recorded for an unplanned target: ${target}. ` +
                    'Every target reaching an outcome must first be planned, or the ' +
                    'denominator understates the work.',
            );
        }
        const existing = this.planned.get(target);
        if (existing !== undefined) {
            throw new LedgerUsageError(
                `${this.gate}: target resolved twice (${existing.kind} then ${resolution.kind}): ${target}.`,
            );
        }
        this.planned.set(target, resolution);
    }

    /** Planned targets that have not yet reached a terminal outcome, in enumeration order. */
    unaccountedTargets(): string[] {
        const out: string[] = [];
        for (const [target, resolution] of this.planned) {
            if (resolution === undefined) {
                out.push(target);
            }
        }
        return out;
    }

    /**
     * Close the ledger and return the tally.
     *
     * @throws {UnaccountedTargetsError} when any planned target reached no outcome.
     */
    finalize(): GateLedgerTally {
        const unaccounted = this.unaccountedTargets();
        if (unaccounted.length > 0) {
            throw new UnaccountedTargetsError(this.gate, unaccounted);
        }
        const tally: GateLedgerTally = {
            planned: this.planned.size,
            completed: 0,
            skipped: 0,
            failed: 0,
            out_of_scope: 0,
            unaccounted: 0,
            skips_by_reason: {},
        };
        for (const resolution of this.planned.values()) {
            if (resolution === undefined) {
                continue;
            }
            if (resolution.kind === 'completed') {
                tally.completed += 1;
            } else if (resolution.kind === 'failed') {
                tally.failed += 1;
            } else {
                if (resolution.kind === 'skipped') {
                    tally.skipped += 1;
                } else {
                    tally.out_of_scope += 1;
                }
                const code = resolution.reason as GateSkipReason;
                tally.skips_by_reason[code] = (tally.skips_by_reason[code] ?? 0) + 1;
            }
        }
        return tally;
    }

    /**
     * Finalize and print the denominator on the success path.
     *
     * The line goes to stdout unconditionally, exactly as
     * {@link import('./scan_scope.js').reportScanned} does and for the same
     * recorded reason: CI passes `--quiet`, and a count only visible without it
     * is not a count. It is deliberately NOT the `scanned: <N>` line
     * `check_gate_coverage` parses — that stays the single machine-read
     * coverage signal, and this is the human-auditable completeness breakdown
     * beside it.
     *
     * @throws {UnaccountedTargetsError} via {@link finalize}.
     */
    report(write: (chunk: string) => unknown = process.stdout.write.bind(process.stdout)): GateLedgerTally {
        const tally = this.finalize();
        const checked = tally.completed + tally.failed;
        const parts = [
            `scanned=${String(checked)}`,
            `planned=${String(tally.planned)}`,
            `skipped=${String(tally.skipped + tally.out_of_scope)}`,
        ];
        write(`${this.gate} ledger: ${parts.join(' ')}\n`);
        const codes = Object.keys(tally.skips_by_reason).sort() as GateSkipReason[];
        for (const code of codes) {
            const n = tally.skips_by_reason[code] ?? 0;
            write(`  ${code} ×${String(n)} — ${SKIP_REASON_MESSAGE[code]}\n`);
        }
        return tally;
    }
}
