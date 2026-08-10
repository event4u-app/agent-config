/**
 * Session-role detection — the ONE shared detector (road-to-token-economy-
 * dispatch Phase 2.2: "one detector, two consumers, test-pinned equal").
 *
 * Consumers:
 *   - `hooks/dispatch_hook.ts` — applies the manifest's role axis (a marked
 *     worker session runs a shorter concern chain).
 *   - `hooks/delegation_nudge_hook.ts` — feeds the judgment ladder's
 *     recursive-dispatch guard (`insideSubagentSession`), whose own header
 *     documents the fact as CALLER-SUPPLIED: no verified host discriminator
 *     exists (upstream agent-identity request closed NOT_PLANNED), and
 *     probing for invented host variable names is the hallucinated-field
 *     failure `source-discovery-gate` exists to stop.
 *
 * `AGENT_CONFIG_SESSION_ROLE` is therefore this suite's OWN variable, set
 * only by suite-owned spawn wrappers that launch a separate CLI session
 * (council transports, bench runners, future worker wrappers). Host
 * limitation, pre-registered in the roadmap's `worker-chain-host-delivery`
 * blocker: an in-process Agent-tool subagent shares the host process env
 * and CANNOT be marked per-spawn — on that path the role resolves
 * `orchestrator` and the full chain runs (fail-open, Phase 2.4).
 *
 * Fail-open is the contract: unset, empty, or unknown values resolve to
 * `orchestrator` — the thin path is the opt-in of a marked spawn, never
 * the accident of a missing or typo'd variable.
 */

export const SESSION_ROLE_ENV = 'AGENT_CONFIG_SESSION_ROLE';

/** `reviewer` is enum-reserved for Phase 3.2; until a `roles.reviewer`
 *  manifest entry exists it resolves to the full chain like any role
 *  without a manifest entry. */
export type SessionRole = 'orchestrator' | 'worker' | 'reviewer';

const KNOWN_ROLES: ReadonlySet<string> = new Set(['orchestrator', 'worker', 'reviewer']);

export function resolveSessionRole(
    env: Record<string, string | undefined> = process.env,
): SessionRole {
    const raw = (env[SESSION_ROLE_ENV] ?? '').trim().toLowerCase();
    return (KNOWN_ROLES.has(raw) ? raw : 'orchestrator') as SessionRole;
}
