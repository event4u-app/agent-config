/**
 * The one-question budget, as a function rather than as a promise.
 *
 * Phase 5 of `road-to-zero-ceremony-settings`. The rule
 * `src/rules/settings-ask-protocol.md` states the budget — at most ONE settings
 * question per command execution, every further undecided key taking its
 * conservative default silently and being named in the end-summary. Prose is
 * where that obligation has to live, because no gate can count the questions in
 * a chat turn.
 *
 * But the *split* is not a judgement call: given the keys an execution needs
 * decided, which one is asked and what the others resolve to is fully
 * determined. Leaving that determined part in prose too would mean the roadmap's
 * own exit criterion — "a planted fixture needing three B decisions asks once,
 * assumes two conservatively, and lists both in the summary" — had nothing to
 * run against. So the split is computed here and the rule points at it.
 *
 * What this module does NOT do, stated so nobody mistakes it for the fence:
 * it does not ask, it does not write, and it cannot stop an agent that ignores
 * it. The write fence is one layer down and is real —
 * `src/scripts/_cli/cmd_settings_set.ts` and the Fastify settings route both
 * refuse every C-class key and fail closed on an unreadable class contract.
 *
 * Pure — no I/O, no clock, no environment.
 *
 * @see src/rules/settings-ask-protocol.md
 * @see docs/contracts/settings-classes.md
 */

import { classOfPath, isConservativeDefault, type SettingsClass } from './settingsClasses.js';

/** A key this execution resolved without asking, and how to change it later. */
export interface SilentDefault {
    key: string;
    /** The value taken — the template default, which for B is conservative. */
    value: unknown;
    /** The exact command that changes it, for the end-summary line. */
    command: string;
}

/** A key that never reaches the ask path, and the reason it does not. */
export interface SkippedKey {
    key: string;
    reason:
        | 'class-a-never-asked'
        | 'class-c-guarded'
        | 'unclassified'
        | 'already-decided'
        | 'non-conservative-default';
}

export interface AskPlan {
    /** The single key that gets this execution's question, or `null` for none. */
    ask: string | null;
    /** Undecided keys that took their default silently, in the order given. */
    silent: SilentDefault[];
    /** Keys excluded from the ask path entirely, with the reason. */
    skipped: SkippedKey[];
}

/**
 * The end-summary line for a silently defaulted key.
 *
 * `--source manual` and not `jit-answer`: the user did not answer a question, so
 * stamping the write as a just-in-time answer would record a consent nobody
 * gave. The provenance vocabulary exists to keep exactly that distinction.
 */
export function changeCommand(key: string): string {
    return `agent-config settings:set ${key} <value> --source manual`;
}

/**
 * Plan one execution's settings asks.
 *
 * `needed` is the keys this execution genuinely cannot proceed without, in the
 * order they became needed — the caller's own ordering is respected because the
 * first key to actually block the run is the one that earned the question.
 *
 * `decided` is every key already settled on any resolution layer. A decided key
 * is not a candidate: re-asking a settled question is the cheap question the
 * ask-discipline rules forbid, and it is the single most likely way this budget
 * gets spent on nothing.
 *
 * `defaultOf` supplies the template default. It returns `undefined` for a key
 * the template does not carry, which is treated as unclassified rather than as
 * a default of `undefined` — a missing template entry is a defect, not a value.
 */
export function planSettingsAsks(
    needed: readonly string[],
    classes: ReadonlyMap<string, SettingsClass>,
    defaultOf: (key: string) => unknown,
    decided: ReadonlySet<string> = new Set(),
    options: { interactive?: boolean } = {},
): AskPlan {
    const plan: AskPlan = { ask: null, silent: [], skipped: [] };
    const seen = new Set<string>();
    // Non-TTY / CI / headless: nobody can answer, so the budget is ZERO rather
    // than one. Every candidate takes its conservative default and the plan
    // carries no ask — "no questions, ever", as a computed fact rather than as a
    // promise the caller has to remember. Nothing is written either: this
    // function never persists, and with no ask there is no `jit-answer` write.
    const interactive = options.interactive ?? true;

    for (const key of needed) {
        // A duplicate in the caller's list must not consume the budget twice.
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        if (decided.has(key)) {
            plan.skipped.push({ key, reason: 'already-decided' });
            continue;
        }

        const cls = classOfPath(classes, key);
        if (cls === undefined) {
            // Unclassified is guarded everywhere else in this system; it is
            // guarded here too. Never fall back to "probably fine".
            plan.skipped.push({ key, reason: 'unclassified' });
            continue;
        }
        if (cls === 'A') {
            plan.skipped.push({ key, reason: 'class-a-never-asked' });
            continue;
        }
        if (cls === 'C') {
            // A C key set to `ask` still produces a RUNTIME question, but that
            // answer lasts one run and is never persisted, so it is not this
            // budget's business. Persisting it stays on the human path.
            plan.skipped.push({ key, reason: 'class-c-guarded' });
            continue;
        }

        const fallback = defaultOf(key);
        if (fallback === undefined) {
            plan.skipped.push({ key, reason: 'unclassified' });
            continue;
        }

        if (interactive && plan.ask === null) {
            plan.ask = key;
            continue;
        }

        if (!isConservativeDefault(fallback)) {
            // Taking a permissive value silently would be a decision made in
            // the user's name — the one outcome the Iron Law names outright.
            // Surfacing it as skipped forces the caller to deal with it instead
            // of inheriting a permission nobody granted.
            plan.skipped.push({ key, reason: 'non-conservative-default' });
            continue;
        }

        plan.silent.push({ key, value: fallback, command: changeCommand(key) });
    }

    return plan;
}

/**
 * The end-summary block for a plan, or `null` when nothing was defaulted.
 *
 * `null` rather than an empty string so a caller cannot append a heading with no
 * rows under it. This text rides INSIDE the single end-summary that
 * `direct-answers` already requires — it is never a second summary.
 */
export function silentDefaultsSummary(plan: AskPlan): string | null {
    if (plan.silent.length === 0) {
        return null;
    }
    const lines = plan.silent.map(
        (s) => `- \`${s.key}\` → ${JSON.stringify(s.value)} (default) · change: \`${s.command}\``,
    );
    return `Settings resolved without asking this run:\n${lines.join('\n')}`;
}
