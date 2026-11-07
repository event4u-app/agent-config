/**
 * Per-event hook merging that keeps a neighbour package's entries.
 *
 * The defect this closes:
 * `install.ts` wrote every host hook file through `deep_merge`, which REPLACES
 * an array wholesale. Seven call sites write a `hooks.<event>` array — augment
 * user, cursor project + user, windsurf project + user, gemini project + user —
 * so any hook another agent package had registered on those events was silently
 * destroyed at install time. Only the Claude path was safe, because
 * `_lib/claude_settings_hooks.ts` already merges per event by signature; that
 * module's contract is the one generalised here.
 *
 * The rule, for each event present in the patch:
 *
 * 1. keep, in order and byte-identical, every existing entry that does NOT
 *    carry this package's signature;
 * 2. drop every existing entry that DOES carry it (ours, possibly from an older
 *    version with a different command string);
 * 3. append the patch's entries for that event.
 *
 * Events the patch does not mention are left exactly as they are — a host file
 * may legitimately carry foreign events this package never binds. The one
 * exception is an event listed in `WITHDRAWN_EVENTS` for the writer: there an
 * entry made only of commands we generated, unmodified, is removed; everything
 * else stays byte-identical, and the key is deleted only when nothing is left.
 *
 * Step 2 is what keeps an upgrade idempotent: a migration that changes our own
 * command string replaces the old entry rather than leaving a stale duplicate
 * beside it. That is risk 1 of this lane's register, and the lifecycle fixture
 * asserts exactly one managed entry per event after install → upgrade.
 *
 * Identity is content-derived, never an added field.
 * An entry is ours when its command string contains the caller's `signature`.
 * No marker key is written into the host's file: a host that dedupes identical
 * command strings (Claude Code does) must keep seeing a byte-identical command,
 * and a marker field would also be a key the host did not ask for. The
 * signature a call site passes is the stable fragment of the command it writes —
 * `dispatch:hook --platform <host>` for the project-level bridges, the
 * dispatcher trampoline's filename for the user-level ones, which is the part
 * that survives a change of home directory or binary path.
 *
 * Shape awareness:
 * hosts disagree about what an entry looks like, so the command extractor
 * covers all three shapes this package writes and reads:
 *
 * - `{ command: "…" }`                       — cursor, windsurf
 * - `{ hooks: [{ type, command }] }`          — augment
 * - `{ matcher, hooks: [{ type, command }] }` — gemini, claude
 *
 * An entry of none of those shapes is foreign by construction: it carries no
 * command we can read, so it cannot be ours, so it is kept. Unreadable means
 * kept, never deleted — the asymmetry is deliberate.
 */

import { deepcopy, isPlainObject } from './json_merge.js';

/**
 * The stable command fragment that identifies this package's entry, per writer.
 *
 * Keyed by the label `merge_json_file` already prints, so a call site names its
 * signature with the string it is holding anyway. Two families, for one reason:
 * a project-level bridge invokes the repo-local binary, so the verb and platform
 * flag are the stable part; a user-level writer invokes an absolute trampoline
 * path, where the only fragment that survives a different `$HOME`, a renamed
 * checkout or a reinstall is the script's filename.
 *
 * A signature MUST NOT change between releases. If it does, entries written by
 * the previous version stop being recognised as ours and accumulate beside the
 * new one instead of being replaced — the stale-duplicate failure this module's
 * step 2 exists to prevent. A new command shape is therefore a new entry under
 * an unchanged signature, never a new signature.
 */
export const HOOK_SIGNATURES: Readonly<Record<string, string>> = {
    '~/.augment/settings.json': 'augment-dispatcher.sh',
    '.cursor/hooks.json': 'dispatch:hook --platform cursor',
    '~/.cursor/hooks.json': 'cursor-dispatcher.sh',
    '.windsurf/hooks.json': 'dispatch:hook --platform windsurf',
    '~/.codeium/windsurf/hooks.json': 'windsurf-dispatcher.sh',
    '.gemini/settings.json': 'dispatch:hook --platform gemini',
    '~/.gemini/settings.json': 'gemini-dispatcher.sh',
};

/** Every command string reachable inside one hook entry, in document order. */
export function entryCommands(entry: unknown): string[] {
    if (!isPlainObject(entry)) return [];
    const out: string[] = [];
    if (typeof entry['command'] === 'string') out.push(entry['command']);
    const nested = entry['hooks'];
    if (Array.isArray(nested)) {
        for (const inner of nested) {
            if (isPlainObject(inner) && typeof inner['command'] === 'string') {
                out.push(inner['command']);
            }
        }
    }
    return out;
}

/** True when `entry` was written by this package, per the content signature. */
export function isManagedEntry(entry: unknown, signature: string): boolean {
    if (signature === '') return false;
    return entryCommands(entry).some((cmd) => cmd.includes(signature));
}

/**
 * Merge one event's entry list: foreign entries kept in order, ours replaced.
 *
 * Exported for the fixture, which asserts the foreign entry is byte-identical
 * and that exactly one managed entry survives a repeated install.
 */
export function mergeEventEntries(
    existing: readonly unknown[],
    incoming: readonly unknown[],
    signature: string,
): unknown[] {
    const kept = existing.filter((entry) => !isManagedEntry(entry, signature));
    return [...kept.map((e) => deepcopy(e)), ...incoming.map((e) => deepcopy(e))];
}

/**
 * Merge the `hooks` object of a host config.
 *
 * `existingHooks` may be absent or a non-object (a corrupt or foreign-shaped
 * file) — then the patch is returned on its own, which is what `deep_merge`
 * did and is the only answer available: there is no array to preserve.
 */
export function mergeHookEvents(
    existingHooks: unknown,
    patchHooks: Record<string, unknown>,
    signature: string,
    withdrawn?: WithdrawnBindings,
): Record<string, unknown> {
    if (!isPlainObject(existingHooks)) return deepcopy(patchHooks);
    const out: Record<string, unknown> = deepcopy(existingHooks);
    for (const event of Object.keys(patchHooks)) {
        const incoming = patchHooks[event];
        const current = out[event];
        if (!Array.isArray(incoming)) {
            // Not an entry list — nothing array-shaped to preserve, overlay wins.
            out[event] = deepcopy(incoming);
            continue;
        }
        out[event] = mergeEventEntries(Array.isArray(current) ? current : [], incoming, signature);
    }
    for (const event of withdrawn?.events ?? []) {
        if (event in patchHooks) continue;
        const current = out[event];
        if (!Array.isArray(current)) continue;
        const kept = current.filter((e) => !isUnmodifiedGeneratedEntry(e, withdrawn!.generated));
        if (kept.length === current.length) continue;
        if (kept.length === 0) delete out[event];
        else out[event] = kept;
    }
    return out;
}

/** Events a release stopped binding, and the exact command forms it generated for them. */
export interface WithdrawnBindings {
    readonly events: readonly string[];
    readonly generated: RegExp;
}

/**
 * Bindings a release withdrew, per writer label — removed from an existing file
 * on the next install so a withdrawn slot stops firing. Listed explicitly rather
 * than inferred from what a patch omits, so cleanup reaches only the events a
 * ratified change withdrew. `generated` is anchored on both ends: a command a
 * user edited or appended to no longer matches and is kept, because a stale
 * entry of ours is a cheaper failure than a deleted user command.
 *
 * windsurf (2026-11-07, issue #2805): `pre_user_prompt` / `post_cascade_response`
 * are documented on no live vendor page; `host_lowering.yaml` withdrew them.
 */
export const WITHDRAWN_EVENTS: Readonly<Record<string, WithdrawnBindings>> = {
    '.windsurf/hooks.json': {
        events: ['pre_user_prompt', 'post_cascade_response'],
        generated:
            /^\[ -x \.\/agent-config \] \|\| exit 0; \.\/agent-config dispatch:hook --platform windsurf --event (?:user_prompt_submit --native-event pre_user_prompt|stop --native-event post_cascade_response)$/,
    },
    '~/.codeium/windsurf/hooks.json': {
        events: ['pre_user_prompt', 'post_cascade_response'],
        generated: /^\/\S*\/windsurf-dispatcher\.sh (?:user_prompt_submit pre_user_prompt|stop post_cascade_response)$/,
    },
};

/** True when every command in `entry` is one this package generated, unmodified. */
function isUnmodifiedGeneratedEntry(entry: unknown, generated: RegExp): boolean {
    const cmds = entryCommands(entry);
    return cmds.length > 0 && cmds.every((cmd) => generated.test(cmd));
}

/**
 * Apply a host-config patch, routing the `hooks` key through per-event merging.
 *
 * Every other key keeps `deepMerge` semantics — only the shared hook lists need
 * coexistence, and widening array-append to all keys would corrupt, for example,
 * an `enabledPlugins` list or a settings array the host expects to own.
 *
 * `deepMergeFn` is injected rather than imported so the installer keeps passing
 * its own function and this module stays independent of that file's internals.
 */
export function mergeHostConfig(
    existing: Record<string, unknown>,
    patch: Record<string, unknown>,
    signature: string,
    deepMergeFn: (a: Record<string, unknown>, b: Record<string, unknown>) => Record<string, unknown>,
    withdrawn?: WithdrawnBindings,
): Record<string, unknown> {
    const merged = deepMergeFn(existing, patch);
    const patchHooks = patch['hooks'];
    if (signature === '' || !isPlainObject(patchHooks)) return merged;
    merged['hooks'] = mergeHookEvents(existing['hooks'], patchHooks, signature, withdrawn);
    return merged;
}
