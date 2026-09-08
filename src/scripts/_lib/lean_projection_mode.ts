/**
 * `lean_projection.mode` — ONE definition of what the three modes mean.
 *
 * The projector (`condense.ts`) resolves the value with a real YAML parse; the
 * delivery concern (`hooks/rule_inject_hook.ts`) resolves it with an
 * indentation-shaped read, because a hook must never fail a tool call because a
 * parser could not load. Two readers is unavoidable. Two *normalisations* is
 * not, and would be the defect worth preventing: a projector that writes thin
 * files while the concern believes the mode is off delivers pointers and no
 * bodies, which is exactly the 36.2 % arm the delivery mode exists to replace.
 *
 * So each side supplies the raw string from its own reader and this module
 * decides what it means. Anything unrecognised — absent key, typo, `null`,
 * a non-string — is `eager-all`, today's shipped behaviour: a mode nobody can
 * spell must never silently thin the standing corpus.
 */

/** The three projection shapes. `eager-all` is the shipped default. */
export type LeanProjectionMode = 'eager-all' | 'thin' | 'delivery';

export const DEFAULT_LEAN_PROJECTION_MODE: LeanProjectionMode = 'eager-all';

/** Map a raw settings value onto a mode. Unrecognised → `eager-all`. */
export function normalizeLeanProjectionMode(raw: unknown): LeanProjectionMode {
    const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (v === 'thin') return 'thin';
    if (v === 'delivery') return 'delivery';
    return DEFAULT_LEAN_PROJECTION_MODE;
}

/**
 * True when the projector writes pointer stubs instead of bodies.
 *
 * `delivery` is a superset of `thin`: it writes the same thin files AND binds
 * the concern that delivers the bodies back on a trigger.
 */
export function writesThinFiles(mode: LeanProjectionMode): boolean {
    return mode === 'thin' || mode === 'delivery';
}

/** True only in the mode where a hook delivers rule bodies at runtime. */
export function deliversBodies(mode: LeanProjectionMode): boolean {
    return mode === 'delivery';
}

/**
 * The hosts a thinning mode may actually thin.
 *
 * Deliberately NOT "every host id the package knows". `condense`'s `TOOL_DIRS`
 * writes a per-rule tree for exactly three hosts, so those are the only ids for
 * which `lean_projection.hosts` can mean anything: naming `windsurf` there would
 * be a request to thin a single concatenated file that has no per-rule stub
 * shape, and naming `codex` a request to thin a tree the installer writes and
 * `condense` never touches. Accepting such an id silently would leave the
 * operator believing a host was scoped when nothing reads the entry.
 */
export const THINNABLE_HOSTS: readonly string[] = ['claude-code', 'cursor', 'cline'];

/**
 * The shipped default host set for a thinning mode.
 *
 * One host, and it is the one host that both binds `pre_tool_use` and honours a
 * deny (`docs/enforcement-by-host.md:18-28`) — i.e. the only host where the
 * delivery concern's verdict is acted on. Widening this is a decision, never a
 * default: see `resolveLeanProjectionHosts`, which never widens implicitly.
 */
export const DEFAULT_LEAN_PROJECTION_HOSTS: readonly string[] = ['claude-code'];

/** Why an id in a configured `hosts:` list was not kept. */
export type DroppedHostReason = 'unknown' | 'not-thinnable';

export interface LeanProjectionHosts {
    /** The ids that survived, sorted and de-duplicated. */
    readonly hosts: readonly string[];
    /** Ids that were dropped, with the reason — reported, never silently discarded. */
    readonly dropped: ReadonlyArray<{ readonly id: string; readonly reason: DroppedHostReason }>;
    /** True when nothing was configured and the default was applied. */
    readonly usedDefault: boolean;
}

/**
 * Resolve a configured `lean_projection.hosts` list.
 *
 * Three properties, each of which is a failure this repository has seen in a
 * neighbouring config surface:
 *
 * 1. **Absent means the default, never "all".** An empty or missing list
 *    resolves to `DEFAULT_LEAN_PROJECTION_HOSTS`. A key nobody set must not
 *    thin every host — that is D1, the defect this axis exists to repair.
 * 2. **The set never widens implicitly.** Every id is checked against
 *    `THINNABLE_HOSTS`; anything else is dropped. A typo cannot enrol a host,
 *    and neither can a real host id that has no per-rule tree.
 * 3. **A drop is reported, not swallowed.** The caller gets the ids and the
 *    reason so it can print them. Silently ignoring an entry an operator wrote
 *    is how a setting comes to mean nothing while looking configured.
 *
 * A configured list that resolves to NOTHING keeps `usedDefault: false` and an
 * empty `hosts` — that is "thin no host", which is a legitimate and safe answer
 * and must not fall back to the default. Falling back there would turn a
 * fully-typo'd list into a Claude Code flip the operator never asked for.
 *
 * WHICH FILES REACH THIS AT ALL, stated because R2 finding 6 read the drop path
 * as unreachable: `agent-settings.schema.json` and the wizard's Zod schema both
 * constrain the items to an `enum`, so an out-of-vocabulary id written through
 * either surface is a hard validation FAILURE and never arrives here. What
 * arrives here is a HAND-EDITED `.agent-settings.yml` — the file
 * `condense._lean_projection_settings` and `hooks/rule_inject_hook.gateOpen`
 * both read directly, with no validation step in between. The two layers are
 * defence in depth, not one contract stated twice: the schema is the authoring
 * gate, this function is the read-time gate, and the drop wording below exists
 * for the file the schema never saw.
 */
export function resolveLeanProjectionHosts(raw: unknown): LeanProjectionHosts {
    const known = new Set(THINNABLE_HOSTS);
    if (!Array.isArray(raw) || raw.length === 0) {
        return { hosts: [...DEFAULT_LEAN_PROJECTION_HOSTS], dropped: [], usedDefault: true };
    }
    const hosts: string[] = [];
    const dropped: Array<{ id: string; reason: DroppedHostReason }> = [];
    for (const entry of raw) {
        const id = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
        if (id === '') {
            dropped.push({ id: String(entry), reason: 'unknown' });
            continue;
        }
        if (!known.has(id)) {
            // `not-thinnable` is reserved for an id this package genuinely knows
            // as a host but which owns no per-rule tree. Everything else is a
            // typo or an invention, and the two deserve different wording
            // because the operator's next action differs: fix the spelling, or
            // learn that the host cannot be thinned at all.
            dropped.push({ id, reason: KNOWN_NON_THINNABLE_HOSTS.has(id) ? 'not-thinnable' : 'unknown' });
            continue;
        }
        if (!hosts.includes(id)) hosts.push(id);
    }
    hosts.sort();
    return { hosts, dropped, usedDefault: false };
}

/**
 * Host ids the package ships surfaces for that own no per-rule rule tree.
 *
 * Only used to word a drop precisely; it grants nothing. Sourced from
 * `condense._ALL_TOOLS` plus the two hosts outside it that the host table
 * carries (`codex`, `cowork`).
 */
const KNOWN_NON_THINNABLE_HOSTS: ReadonlySet<string> = new Set([
    'claude-desktop', 'augment', 'copilot', 'windsurf', 'gemini', 'codex', 'cowork',
]);

/** One line per dropped id, for a caller that prints warnings. Empty when nothing was dropped. */
export function describeDroppedHosts(res: LeanProjectionHosts): string[] {
    return res.dropped.map(({ id, reason }) =>
        reason === 'not-thinnable'
            ? `lean_projection.hosts: "${id}" is a known host but has no per-rule rule tree — dropped`
            : `lean_projection.hosts: "${id}" is not a thinnable host id — dropped`,
    );
}

/**
 * Does the projector write stubs for this host, under this mode and host set?
 *
 * The single predicate `condense` calls. Mode is checked FIRST and on purpose:
 * with `mode` unset the answer is `false` for every host regardless of what
 * `hosts` says, so a `hosts:` list left behind after a rollback to `eager-all`
 * thins nothing.
 */
export function thinsHost(mode: LeanProjectionMode, hosts: readonly string[], hostId: string): boolean {
    return writesThinFiles(mode) && hosts.includes(hostId);
}
