/**
 * Loss classes — names for what the tree already does, before they constrain
 * what comes next (`road-to-runtime-context-floors` Phase 3).
 *
 * The tree already practises loss classes implicitly and has for a while:
 * `fold_intake` folds intake batches into an ADDITIVE archive page with
 * per-child link-backs and never mutates the children, and `hot_context_hook`
 * deliberately DROPS lines the low-impact redactor refuses, unrecoverably, for
 * privacy. Those are two different guarantees wearing the same word
 * "compression", and nothing distinguished them.
 *
 * So the vocabulary is written AGAINST those two first, and checked against
 * their own source docblocks, before any lint exists to fail on anything.
 *
 * THE FIVE CLASSES, each defined by the recovery it guarantees:
 *
 *   exact              output is byte-identical to input; nothing is lost
 *   lossless           output differs but the input is fully reconstructible
 *                      from the output alone
 *   recoverable-lossy  output is smaller and the original is retrievable via a
 *                      declared RECOVERY LOCATOR (a path, a range, an id)
 *   ephemeral-lossy    output is smaller and the dropped content is gone —
 *                      deliberately, and the deliberateness is the point
 *   forbidden          this transform must not run on this path at all
 *
 * `recoverable-lossy` is the only class that owes a locator, and it owes one
 * because without it the class is indistinguishable from `ephemeral-lossy` by
 * anything except its author's intention.
 */

export const LOSS_CLASSES = ['exact', 'lossless', 'recoverable-lossy', 'ephemeral-lossy', 'forbidden'] as const;
export type LossClass = (typeof LOSS_CLASSES)[number];

export function isLossClass(v: unknown): v is LossClass {
    return typeof v === 'string' && (LOSS_CLASSES as readonly string[]).includes(v);
}

export interface LossDeclaration {
    lossClass: LossClass;
    /** Where the original is retrievable. Required for `recoverable-lossy`. */
    recovery: string | null;
}

export type DeclarationProblem =
    | { kind: 'missing' }
    | { kind: 'unknown-class'; value: string }
    | { kind: 'missing-recovery' };

/**
 * Read a declaration out of a module's own source.
 *
 * The declaration lives in a docblock, not in a sidecar registry, deliberately:
 * a class describes what THIS code does to its input, and a registry entry
 * beside it is a second statement that can drift from the first. Shape:
 *
 *     loss_class: recoverable-lossy
 *     loss_recovery: agents/knowledge/intake/<file>:<first-line>-<last-line>
 */
export function parseLossDeclaration(source: string): LossDeclaration | DeclarationProblem {
    // `[A-Za-z_-]+`, not `[A-Za-z-]+`: an underscore misspelling
    // (`recoverable_lossy`) must be reported as `unknown-class`, not fall
    // through to `missing`. Both reject, so the exit code is the same — but
    // "declares no loss_class" sends an author who declared one hunting the
    // wrong defect, which is the failure a diagnostic exists to prevent.
    const cls = /^[\s*/]*loss_class:\s*([A-Za-z_-]+)\s*$/m.exec(source);
    if (cls === null) return { kind: 'missing' };
    const value = (cls[1] ?? '').trim();
    if (!isLossClass(value)) return { kind: 'unknown-class', value };

    const rec = /^[\s*/]*loss_recovery:\s*(\S.*?)\s*$/m.exec(source);
    const recovery = rec === null ? null : (rec[1] ?? '').trim();
    if (value === 'recoverable-lossy' && (recovery === null || recovery.length === 0)) {
        return { kind: 'missing-recovery' };
    }
    return { lossClass: value, recovery };
}

export function isProblem(v: LossDeclaration | DeclarationProblem): v is DeclarationProblem {
    return 'kind' in v;
}

// -------------------------------------------------------- passthrough (3.3)

/** Why a transform declined to transform. Never `null` on a passthrough. */
export type PassthroughReason = 'unparseable-input' | 'recovery-unavailable' | 'not-smaller';

export interface TransformOutcome {
    output: string;
    /** `null` when the transform actually ran. */
    passthrough: PassthroughReason | null;
}

export interface TransformHooks {
    /** Returns the shortened form, or `null` when the input cannot be parsed. */
    transform: (input: string) => string | null;
    /**
     * Persist the recovery for `recoverable-lossy`. Returns `false` when the
     * recovery cannot be stored. Omit for classes that owe no recovery.
     */
    storeRecovery?: (input: string) => boolean;
}

/**
 * The passthrough invariant.
 *
 * > A transform that cannot parse its input, cannot store the recovery, or does
 * > not make the input smaller returns the input unchanged.
 *
 * Degradation is never silent and never lossy. The two halves matter equally and
 * are easy to get half-right: returning a partial parse is lossy degradation;
 * returning the input while reporting success is silent degradation. This helper
 * returns the input bytes AND the reason, so a caller cannot have one without the
 * other.
 *
 * The `not-smaller` branch is the one that looks pedantic and is not. A
 * "compression" that grew the input has paid the cost of the transform, lost
 * whatever the transform dropped, and bought nothing — keeping the original is
 * strictly better on every axis, so there is no case in which emitting the
 * larger output is right.
 */
export function applyTransform(input: string, hooks: TransformHooks): TransformOutcome {
    const out = hooks.transform(input);
    if (out === null) return { output: input, passthrough: 'unparseable-input' };
    if (hooks.storeRecovery !== undefined && !hooks.storeRecovery(input)) {
        return { output: input, passthrough: 'recovery-unavailable' };
    }
    if (out.length >= input.length) return { output: input, passthrough: 'not-smaller' };
    return { output: out, passthrough: null };
}
