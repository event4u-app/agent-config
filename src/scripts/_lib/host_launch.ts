/**
 * host_launch — which host agents exist, which can be driven headlessly, and
 * the exact argv each one is launched with.
 *
 * ## Why this file exists, and why HERE
 *
 * These two facts used to live under `src/cli/python/` — the inventory in
 * `workspace_hosts.ts`, the argv in `workspace_drive.ts`'s `HOST_CONFIGS`.
 * That directory is **not in the package.json `files` whitelist**, so anything
 * under `src/scripts/` (which IS shipped) that imports from it resolves fine in
 * this checkout and crashes a global install with `ERR_MODULE_NOT_FOUND`.
 *
 * `prepack-check` caught exactly that when `_lib/headless_invocation.ts`
 * reached across for both constants. The two available answers were to ship
 * `src/cli/python/` (396 KB, 14 modules including `workspace_secrets` and
 * `workspace_crypto` — a consumer-facing surface nobody asked to widen) or to
 * move the ~40 lines the shipped side actually needs. This is the second.
 *
 * The dependency is therefore INVERTED rather than duplicated: the shipped
 * module owns the facts, and the unshipped drive layer imports them back.
 * Re-deriving them on the shipped side would be a second source of truth for
 * one host's argv — the defect an R2 round found in `headless_invocation`
 * itself, where a hand-built copy modelled codex and gemini as stdin consumers
 * while the real configs pass the prompt in argv.
 *
 * ## What stays behind
 *
 * Everything with a runtime: the spawn, the timeout, the per-host stdout
 * parsers, resume-session handling. Those belong to the driver. What moved is
 * only the declarative part — a table a reader could check against
 * `docs/contracts/host-agent-protocol.md` by eye.
 */

export interface InventoryEntry {
    tier: number;
    cli: string | null;
}

/**
 * Mirrors `docs/contracts/host-agent-protocol.md` § Today's inventory.
 *
 * `cli` is the PATH binary that proves the Tier-1 surface is reachable;
 * Tier-3 hosts have no drivable CLI (`null`). Insertion order matches the
 * table in the contract, and `tests/test_workspace_hosts.ts` asserts the two
 * agree — the assertion imports through `workspace_hosts.ts`, which re-exports
 * this, so the move is invisible to it.
 */
export const HOST_INVENTORY: Record<string, InventoryEntry> = {
    'claude-code': { tier: 1, cli: 'claude' },
    codex: { tier: 1, cli: 'codex' },
    gemini: { tier: 1, cli: 'gemini' },
    augment: { tier: 3, cli: null },
    cursor: { tier: 3, cli: null },
    cline: { tier: 3, cli: null },
    windsurf: { tier: 3, cli: null },
};

/**
 * The launch argv per Tier-1 host — one entry, one source of truth.
 *
 * **Every supported host takes the prompt in ARGV.** None reads it from
 * stdin, and that is worth stating because the contract prose said otherwise
 * for two of the three until 2026-08-19: a consumer that built its own argv
 * off the prose modelled codex and gemini as stdin consumers and would have
 * piped a prompt into a CLI that was not reading one. The contract now
 * describes this table rather than the other way round.
 */
export const LAUNCH_ARGV: Readonly<Record<string, (prompt: string) => string[]>> = Object.freeze({
    'claude-code': (prompt: string) => ['claude', '-p', prompt, '--output-format', 'json'],
    codex: (prompt: string) => ['codex', 'exec', '--json', prompt],
    gemini: (prompt: string) => ['gemini', '-p', prompt, '--output-format', 'json'],
});
