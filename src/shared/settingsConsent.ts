/**
 * Is a permissive B-class value a RECORDED CONSENT, or just a value?
 *
 * Phase 5 of `road-to-zero-ceremony-settings`, and the answer to that
 * roadmap's Risk 3 — *"the provenance stamp becomes decoration; an unread stamp
 * is cost with no return"*. Before this module the sidecar
 * `settings/.agent-settings.provenance.json` was written by `settings:set` and
 * read by exactly one caller, the GUI, to **display** it. Nothing decided
 * anything on it. This is the reader that makes it load-bearing.
 *
 * The distinction it draws, which a bare value cannot: `true` that a human chose
 * and `true` that the machine inferred are the same byte and are not the same
 * permission. `auto-detected` is the provenance a machine writes about itself —
 * a locale, an installed binary, a detected host. Letting it grant a consent
 * would mean the agent could arrive at its own permission by observing the
 * world, which is the confused-deputy shape in miniature.
 *
 * Modelled on `src/scripts/hooks/git_command_classifier.ts`: answer from a
 * recorded fact rather than from the model's recollection, and treat a missing
 * record as NOT granted rather than as probably-fine.
 *
 * WHAT THIS IS NOT. It is not a hook and it does not intercept anything. No
 * B-class key currently gates an action through a guard — the two that gate
 * behaviour at all (`personal.open_edited_files`, `memory.learn_on_session_end`)
 * are read as values by the installer, the wizard and one session_end concern,
 * and the *action* they govern is prose. So the enforcement gradient is honest
 * and steep: this function is deterministic, the obligation to call it is
 * model-carried, and on a prose-only host ask-once can degrade to ask-never.
 *
 * Pure — no I/O. Callers supply the value and the sidecar entry.
 *
 * @see src/rules/settings-ask-protocol.md
 * @see docs/contracts/settings-classes.md
 */

import { isConservativeDefault, type SettingsClass } from './settingsClasses.js';

/**
 * The provenance vocabulary this READER understands.
 *
 * Deliberately one value wider than what `settings:set` can write: `org-pack`
 * is readable here and absent from `ProvenanceSource` in
 * `src/scripts/_cli/cmd_settings_set.ts`. That asymmetry is ADR-233 § D3 and
 * it is the whole safety property — a value no agent-reachable path can write
 * is a value the agent cannot stamp on its own permission. It is a type
 * difference rather than a runtime check on purpose: there is no branch to
 * forget and none to bypass.
 */
export type ConsentSource = 'auto-detected' | 'jit-answer' | 'manual' | 'gui' | 'org-pack';

/** Keys `org-pack` provenance may grant. ADR-233 § D2. */
const ORG_PACK_KEY_PREFIX = 'telemetry.remote.';

/**
 * The sources that can carry a human decision.
 *
 * `jit-answer` is a question the user answered. `gui` is a human at the settings
 * editor. `manual` is a hand-edit or an explicit CLI write on the user's
 * instruction. `auto-detected` is excluded on purpose — see the module header.
 *
 * `org-pack` is NOT in this list, and its absence is not an oversight: it
 * grants, but only for one namespace, so it is handled by its own branch in
 * `consentVerdict` rather than by membership here. Putting it in this list
 * would make it grant everywhere, which is the erosion ADR-233 § D2 refuses.
 */
const HUMAN_SOURCES: readonly ConsentSource[] = ['jit-answer', 'gui', 'manual'];

export type ConsentVerdict =
    /** A human decided, and the value permits the action. */
    | 'granted'
    /** The value is the conservative default — absent and no are the same thing. */
    | 'withheld-default'
    /** Permissive, but nothing records who decided it. Fail closed. */
    | 'withheld-unrecorded'
    /** Permissive and recorded, but recorded as a machine inference. */
    | 'withheld-machine-inferred'
    /**
     * An org administrator consented, but for a key outside the namespace
     * that grant covers (ADR-233 § D2).
     */
    | 'withheld-org-pack-out-of-scope'
    /** Not a consent question at all: A needs none, C is human-only. */
    | 'not-a-consent-key';

export interface ConsentQuery {
    /** The key's class, from the contract — `undefined` means unclassified. */
    cls: SettingsClass | undefined;
    /**
     * The dotted key. Required only to evaluate an `org-pack` grant, which is
     * namespace-scoped; every other source decides without it, so it stays
     * optional rather than breaking existing callers.
     */
    key?: string | undefined;
    /** The effective value after normal resolution. */
    value: unknown;
    /**
     * The sidecar entry for this key, or `undefined` when none exists.
     *
     * `undefined` covers both "the sidecar has no row" and "there is no sidecar",
     * which are the same fact from here: nothing records a decision.
     */
    source?: ConsentSource | undefined;
    /**
     * `true` when the value came from a file only a human can write — a
     * project-local `.agent-settings.yml` or a hand-edited user file.
     *
     * The class contract is explicit that *"the user may edit anything in their
     * own file with an editor"*, so a hand-edit IS the consent even though it
     * carries no stamp. Without this the check would refuse the one path the
     * contract guarantees, which is how a fence becomes a bug.
     */
    handEdited?: boolean;
}

/**
 * The verdict for one consent-gated action.
 *
 * Order matters: class first (a C key never reaches a consent question at all),
 * then the value (conservative means no, regardless of provenance), then the
 * record.
 */
export function consentVerdict(query: ConsentQuery): ConsentVerdict {
    if (query.cls !== 'B') {
        return 'not-a-consent-key';
    }
    if (isConservativeDefault(query.value)) {
        return 'withheld-default';
    }
    // The org-pack branch runs BEFORE the hand-edit branch, and the order is
    // the fix rather than a style choice. `handEdited` is true for a
    // project-local `.agent-settings.yml` — which is precisely the file an org
    // pack ships — so with hand-edit first, a recorded `org-pack` provenance
    // on an out-of-scope key would be granted by the wrong branch and ADR-233
    // § D2's namespace scope would hold for no real deployment. A recorded
    // source is the more specific fact and decides first.
    if (query.source === 'org-pack') {
        // A human decided, but not the human this value binds — so the grant
        // is real and narrow. An absent key cannot be shown to be in scope,
        // and unproven is withheld here as everywhere else in this function.
        return query.key !== undefined && query.key.startsWith(ORG_PACK_KEY_PREFIX)
            ? 'granted'
            : 'withheld-org-pack-out-of-scope';
    }
    if (query.handEdited === true) {
        return 'granted';
    }
    if (query.source === undefined) {
        return 'withheld-unrecorded';
    }
    if (!HUMAN_SOURCES.includes(query.source)) {
        return 'withheld-machine-inferred';
    }
    return 'granted';
}

/** `true` only for `granted` — every other verdict withholds. */
export function consentGranted(query: ConsentQuery): boolean {
    return consentVerdict(query) === 'granted';
}

/**
 * One line explaining a withheld verdict, for the surface that refused.
 *
 * `null` for `granted`, so a caller cannot accidentally print a refusal reason
 * on the allow path.
 */
export function withheldReason(verdict: ConsentVerdict, key: string): string | null {
    switch (verdict) {
        case 'granted':
            return null;
        case 'withheld-default':
            return `${key} is at its conservative default — absent and no are the same answer.`;
        case 'withheld-unrecorded':
            return `${key} permits this, but nothing records who decided it. Ask, or set it via the GUI.`;
        case 'withheld-machine-inferred':
            return `${key} was auto-detected, not decided. A machine inference is not a consent.`;
        case 'withheld-org-pack-out-of-scope':
            return `${key} carries an org-pack consent, which grants only under `
                + `${ORG_PACK_KEY_PREFIX}* (ADR-233). Ask this user directly.`;
        case 'not-a-consent-key':
            return `${key} is not a class-B consent key — this gate does not apply to it.`;
    }
}
