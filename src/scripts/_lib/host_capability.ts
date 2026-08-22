/**
 * Host-capability manifest normalizer + committed capability registry.
 *
 * Pure, no-I/O helper that takes a partial / unknown object (an explicit
 * caller-supplied override, or the agent's own host-knowledge object) and
 * returns a fully-populated manifest.
 *
 * Contract — see `src/agent-src/contexts/execution/host-capability-manifest.md`:
 *
 * - Safe default is ALL boolean fields `false` — an unknown host is assumed to
 *   have no subagent primitive.
 * - A missing or non-boolean field resolves to `false`, never `true`.
 * - `schema_version` is always forced to `1`.
 *
 * `resolveHostCapabilities` (F5, road-to-orchestrator-discipline-carriers)
 * adds a resolution order in front of the safe default so a fresh install on
 * a KNOWN host does not ship delegation dead by default:
 *
 *   explicit override (wins, whole-object, unchanged semantics) → committed
 *   registry row for the detected host (`HOST_CAPABILITY_REGISTRY`) →
 *   `SAFE_DEFAULT` (all false).
 *
 * The registry lists only OBSERVED capabilities for a host this repo has
 * actually measured (see the roadmap's transcript evidence) — never a
 * speculative entry for a host nobody has verified.
 *
 * `probeHostCapabilities` (road-to-always-on-orchestration Phase 1) is the
 * production entry point as of this change: capability is a FACT about the
 * host, never a settings decision, so the former `subagents.host_capabilities`
 * settings override was deleted. `resolveHostCapabilities`'s `override`
 * parameter stays for back-compat (tests, and any caller that genuinely has a
 * host-knowledge object of its own) — no production caller passes a
 * settings-derived value into it any more.
 *
 * `describeHostCapabilities` (road-to-capability-answerability Phase 1.2) is
 * the same resolution plus per-field provenance, because five of the six
 * fields come from a committed table rather than from any live check and the
 * `probe*` name says otherwise.
 */
import process from 'node:process';

/** Resolved host-capability manifest. All booleans, `schema_version` fixed at 1. */
export interface HostCapabilityManifest {
    schema_version: 1;
    subagent_spawn: boolean;
    parallel_spawn: boolean;
    status_polling: boolean;
    separate_quota_pool: boolean;
    /**
     * Claude Code's experimental multi-instance Agent Teams primitive
     * (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`). Resolved ONLY by
     * {@link probeHostCapabilities}'s live environment probe — the registry
     * and `normalizeHostManifest` never infer it from a host id, because
     * this repo has not observed the flag's shape on any host, only its
     * documented existence.
     */
    agent_teams: boolean;
    /**
     * The host can kill a running worker and spawn a fresh one that continues
     * the SAME task mid-flight — the primitive worker-generation recycling
     * needs (road-to-worker-generation-recycling, `blocker: host-worker-respawn`).
     *
     * `false` on every host today, deliberately: like `status_polling` and
     * `separate_quota_pool`, this field is set `true` only once the capability
     * is OBSERVED on a host, never by inference from the fact that spawning and
     * killing both exist separately. A host without it degrades to today's
     * stop-loss behaviour — loudly, never silently.
     */
    worker_respawn: boolean;
}

/** Safe default — unknown host assumes no subagent primitive. */
const SAFE_DEFAULT: HostCapabilityManifest = {
    schema_version: 1,
    subagent_spawn: false,
    parallel_spawn: false,
    status_polling: false,
    separate_quota_pool: false,
    agent_teams: false,
    worker_respawn: false,
};

/** Coerce one field: only a strict boolean `true` survives; everything else is `false`. */
function asBool(value: unknown): boolean {
    return value === true;
}

/**
 * Normalize a partial / unknown object into a full {@link HostCapabilityManifest}.
 *
 * Any missing or invalidly-typed field falls back to the all-`false` safe
 * default; `schema_version` is always forced to `1`.
 */
export function normalizeHostManifest(input: unknown): HostCapabilityManifest {
    if (input === null || typeof input !== 'object') {
        return { ...SAFE_DEFAULT };
    }

    const src = input as Record<string, unknown>;

    return {
        schema_version: 1,
        subagent_spawn: asBool(src.subagent_spawn),
        parallel_spawn: asBool(src.parallel_spawn),
        status_polling: asBool(src.status_polling),
        separate_quota_pool: asBool(src.separate_quota_pool),
        agent_teams: asBool(src.agent_teams),
        worker_respawn: asBool(src.worker_respawn),
    };
}

/**
 * Committed registry — known host identifiers → OBSERVED capability sets.
 *
 * Keyed by the platform identifier this repo already uses for the same host
 * across the hook/dispatch layer (`--platform claude`, `platforms['claude']`
 * in `claude_settings_hooks.ts`, `TOOL_IDS` in `probe_skill_registration.ts`)
 * — NOT the separate `toolDetection.ts` binary-detection id (`'claude-code'`),
 * which names a different namespace (installed-CLI presence, not the running
 * host identity a hook/dispatch envelope carries).
 *
 * Each row is partial: an omitted field stays at the `SAFE_DEFAULT` `false`
 * when the row is applied — and an ABSENT field is the record for "never
 * looked", which is a different state from a field written as `false`
 * deliberately. Add a field only once it is itself observed, never by
 * inference.
 *
 * ## Rows are written under the observation protocol
 *
 * `contexts/execution/host-capability-manifest.md` § Observation protocol states
 * the per-field criterion and the four-part citation (host · host version ·
 * transcript or artefact reference · date). A row without all four is not
 * admissible, and no row may be filled from a host's documentation.
 *
 * ## REACHABILITY, 2026-08-22 — one of eight, and the other seven are recorded
 *
 * `hook_manifest.yaml` declares eight platform keys. Reachable means a real
 * session can be started on the host, not that it is installable in principle.
 *
 *   - `claude`   — REACHABLE. Row below, re-cited under the protocol.
 *   - `augment`  — not reachable from this session: a different editor host, no
 *                  session available to the running agent.
 *   - `cowork`   — not reachable from this session, same reason.
 *   - `cursor`   — not reachable from this session, same reason.
 *   - `cline`    — not reachable from this session, same reason.
 *   - `windsurf` — not reachable from this session, same reason.
 *   - `gemini`   — not reachable from this session, same reason.
 *   - `copilot`  — not reachable from this session, same reason; additionally
 *                  `fallback_only` in the manifest.
 *
 * The seven have **no row**, so every field resolves to the safe default and
 * `describeHostCapabilities` reports its source as `default`. That is the
 * "never looked" state, and it is the honest one — a recorded silence rather
 * than a table with gaps that reads as a table of negatives.
 *
 * ## The `claude` row, RE-CITED rather than grandfathered
 *
 * The row predated the protocol. Both its fields are now carried on transcript
 * evidence, so it is brought up to the new shape rather than marked
 * grandfathered — which was the other permitted disposition and would have left
 * it looking like it passed a protocol it never ran.
 *
 * `subagent_spawn: true` — OBSERVED. claude (Claude Code, Opus 5 1M session,
 *   2026-08-22). `agents/runtime/state/subagent-ledger/2026-08.jsonl`: **445**
 *   `subagent_start` records, and **420** stops carrying a measured
 *   `duration_ms` — i.e. 420 child legs whose start and stop pair, which is the
 *   criterion (a measurable child duration, not an inferred one).
 *
 * `parallel_spawn: true` — OBSERVED. Same host, session and artefact.
 *   **6,168** of 6,388 stop records carry `concurrent_open >= 2`, with a
 *   maximum of **30** concurrently open children. Overlapping intervals at one
 *   instant, which is the criterion — not two children in sequence.
 *
 * `status_polling`, `separate_quota_pool`, `worker_respawn` — **absent from the
 *   row, and that is deliberate.** The ledger does not instrument any of the
 *   three, so this is "never looked", NOT "observed absent". They stay at the
 *   safe default and report `default` provenance. Writing any of them as an
 *   explicit `false` would claim a measurement nobody took.
 *
 * `agent_teams` — out of scope for a row by construction; see its own field
 *   doc comment and the protocol section.
 */
const HOST_CAPABILITY_REGISTRY: Readonly<Record<string, Partial<HostCapabilityManifest>>> = {
    claude: { subagent_spawn: true, parallel_spawn: true },
};

/**
 * Resolve the effective host-capability manifest for `hostId`.
 *
 * Resolution order (highest wins), per
 * `host-capability-manifest.md § Resolution`:
 *
 * 1. `override` — the `subagents.host_capabilities` settings value, when
 *    present as a non-null object. Normalized exactly as {@link normalizeHostManifest}
 *    always has: a WHOLE-OBJECT override, each field independently coerced,
 *    a field absent from the override object resolves to `false`. This is
 *    the pre-existing, unchanged behavior — a present override still wins
 *    outright over the registry row, it does not merge field-by-field with it.
 * 2. The committed {@link HOST_CAPABILITY_REGISTRY} row for `hostId`, when no
 *    override is present and the host is known.
 * 3. `SAFE_DEFAULT` — unknown `hostId`, or no override and no registry row.
 *
 * `hostId` is a caller-supplied identifier (e.g. the same string a hook
 * envelope's `platform` field carries) — this function does no environment
 * probing of its own; see `host-capability-manifest.md` for why resolution
 * stays a per-session, agent/caller-supplied fact rather than a live probe.
 *
 * An array override does NOT count as present (F8, review): `typeof [] ===
 * 'object'` in JS, so a bare `typeof override === 'object'` check let a
 * stray array reach `normalizeHostManifest`, which reads named properties
 * off it (`.subagent_spawn`, …) that an array never has — every field
 * silently coerces to `false`, exactly like an explicit empty-object
 * override, even though nobody supplied one. An array is not a manifest
 * shape at all, so it is treated the same as `null`/non-object: fall
 * through to the registry row.
 */
export function resolveHostCapabilities(
    hostId: string | null | undefined,
    override?: unknown,
): HostCapabilityManifest {
    if (
        override !== undefined &&
        override !== null &&
        typeof override === 'object' &&
        !Array.isArray(override)
    ) {
        return normalizeHostManifest(override);
    }
    const row =
        hostId !== null && hostId !== undefined ? HOST_CAPABILITY_REGISTRY[hostId] : undefined;
    if (row === undefined) {
        return { ...SAFE_DEFAULT };
    }
    return { ...SAFE_DEFAULT, ...row, schema_version: 1 };
}

/**
 * Probe the effective host-capability manifest for `hostId` from OBSERVABLE
 * FACTS ONLY (road-to-always-on-orchestration Phase 1) — the committed
 * registry row for the host, merged with a live environment probe. This is
 * the production entry point: capability is a fact about the host, never a
 * settings decision, so there is no override parameter here (that stays on
 * {@link resolveHostCapabilities} for back-compat callers only).
 *
 * The one probed fact today: `agent_teams` resolves `true` when
 * `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set (any non-empty value) in the
 * process environment — the one host fact this repo can observe about Claude
 * Code's documented-but-unshipped-by-default multi-instance Agent Teams
 * primitive. A registry row can also carry `agent_teams: true` directly for a
 * host where it is unconditionally available; the two sources OR together —
 * a probe never turns a registry-granted capability back off.
 */
export function probeHostCapabilities(hostId: string | null | undefined): HostCapabilityManifest {
    const base = resolveHostCapabilities(hostId);
    const flag = process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    const probedAgentTeams = typeof flag === 'string' && flag !== '';
    return { ...base, agent_teams: base.agent_teams || probedAgentTeams };
}

/** Every manifest field that carries a capability answer (i.e. not `schema_version`). */
export type CapabilityField = Exclude<keyof HostCapabilityManifest, 'schema_version'>;

/**
 * Where one field's resolved value came from.
 *
 * `registry` is deliberately NOT called "detected": a registry row is a
 * capability this repo OBSERVED on that host once and then committed to a
 * hardcoded table. It is an assertion about the host, checked at authoring
 * time and never re-checked at run time. `live-probe` is the only value that
 * was established in THIS process, from the environment. `default` means
 * nothing answered and the all-false safe default applied.
 */
export type CapabilitySource = 'registry' | 'live-probe' | 'default';

/** Per-field provenance for a resolved manifest. */
export type HostCapabilitySources = Record<CapabilityField, CapabilitySource>;

export interface HostCapabilityDescription {
    manifest: HostCapabilityManifest;
    sources: HostCapabilitySources;
}

const CAPABILITY_FIELDS: readonly CapabilityField[] = [
    'subagent_spawn',
    'parallel_spawn',
    'status_polling',
    'separate_quota_pool',
    'agent_teams',
    'worker_respawn',
];

/**
 * Resolve the manifest AND say, per field, what answered it.
 *
 * `probeHostCapabilities` returns six booleans that look alike and are not:
 * on the one host with a registry row, two of them come from a committed
 * table, one can come from a live environment read, and the rest are the
 * safe default — i.e. "we have no answer", rendered as `false`, which is
 * indistinguishable from "we checked and it is absent". A caller deciding
 * whether to trust `subagent_spawn: false` needs that difference, and the
 * function name `probe*` actively suggests the wrong one.
 *
 * The manifest half delegates to {@link probeHostCapabilities} rather than
 * re-deriving it, so a provenance readout can never disagree with the value
 * the delegation layer actually gated on — the same
 * two-readers-of-one-fact failure `routing_doctor` already records against
 * its own pre-registry bug.
 */
export function describeHostCapabilities(
    hostId: string | null | undefined,
): HostCapabilityDescription {
    const manifest = probeHostCapabilities(hostId);
    const row =
        hostId !== null && hostId !== undefined ? HOST_CAPABILITY_REGISTRY[hostId] : undefined;
    const flag = process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    const probedAgentTeams = typeof flag === 'string' && flag !== '';

    const sources = {} as HostCapabilitySources;
    for (const field of CAPABILITY_FIELDS) {
        // A row entry claims the field whatever its value: an explicit
        // `false` in the table is an observation ("checked, absent"), which is
        // a different fact from the default's "nobody answered".
        if (row !== undefined && typeof row[field] === 'boolean') {
            sources[field] = 'registry';
        } else if (field === 'agent_teams' && probedAgentTeams) {
            sources[field] = 'live-probe';
        } else {
            sources[field] = 'default';
        }
    }
    return { manifest, sources };
}
