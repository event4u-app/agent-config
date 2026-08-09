/**
 * `/team` availability — CLI-first, not settings-gated
 * (road-to-always-on-orchestration Phase 1, Step 1.3).
 *
 * `ai_team.enabled` — the former master switch — was DELETED. `/team`'s
 * on/off state is now a FACT resolved from the machine, the same doctrine
 * already applied to the subagent and council layers (Phase 1): the codex
 * CLI binary must resolve on `$PATH`, AND some auth for the `openai`
 * provider must be detectable (subscription login, API key, key file, or
 * env key — the same transport-preference order `auto` walks via
 * `strongestAuth`). Reuses the existing, read-only, zero-spend,
 * per-process-cached detector (`_lib/environment_detector.ts`); this module
 * adds NO new probing and NO new cache of its own.
 *
 * `ai_team.allow_delegate` is UNCHANGED by this module: a distinct,
 * write-access authorization gate that stacks ON TOP of availability, never
 * a replacement for it (`assert_delegate_allowed` in `team_dispatch.ts`
 * still checks it separately, after availability).
 */
import { detectEnvironment, strongestAuth } from '../_lib/environment_detector.js';
import { load_agent_settings, type SettingsDict } from '../_lib/agent_settings.js';
import { _team_codex_binary_name, shutilWhich } from '../_cli/cmd_doctor.js';

/** Tool id `environment_detector` uses for the codex CLI (`install/toolDetection.ts`). */
const CODEX_HOST_ID = 'codex';

/** Provider id `environment_detector` / `PROVIDER_CLI_META` uses for the codex CLI. */
const CODEX_PROVIDER = 'openai';

/** The provider default `_team_codex_binary_name` falls back to with no override configured. */
const DEFAULT_CODEX_BINARY = 'codex';

export interface TeamAvailability {
    readonly available: boolean;
    /** One clear line for the user — populated only when `available` is false. */
    readonly reason: string | null;
}

/**
 * codex CLI binary + auth presence — the availability half of the `/team`
 * gate. Cached per process via `detectEnvironment()`'s own no-argument memo
 * (`resetEnvironmentCache()` in tests); this function adds no caching of
 * its own.
 *
 * m5 fix (independent-review finding) — `detectEnvironment()`'s host probe
 * is hardcoded to the literal binary name `codex`; it has no way to be told
 * "check this other name/path instead". So an operator who set
 * `members.openai.binary:` in `.ai-council.yml` (honoured under an
 * effective mode of `cli` OR `auto` — `cmd_doctor.ts::_mayRunOverCli`) was
 * invisible to this check: `/team` could report "codex CLI not available"
 * even with a working, custom-named/pathed binary configured and
 * functional. `_team_codex_binary_name` (shared with `cmd_doctor.ts`'s own
 * `council-cli` / `team` checks, so the override-resolution logic has one
 * source) resolves the SAME name `cmd_doctor` would use; when it differs
 * from the provider default, this probes that name directly instead of
 * trusting the fixed-name host detector.
 */
export function checkCodexAvailability(project_root: string = process.cwd()): TeamAvailability {
    const report = detectEnvironment();
    const configuredBinary = _team_codex_binary_name(project_root);
    const installed =
        configuredBinary !== DEFAULT_CODEX_BINARY
            ? shutilWhich(configuredBinary) !== null
            : (report.hosts.find((h) => h.id === CODEX_HOST_ID)?.installed ?? false);
    if (!installed) {
        return {
            available: false,
            reason:
                'codex CLI not available — /team needs the codex CLI installed and ' +
                'authenticated. Install: `npm install -g @openai/codex`, then run ' +
                '`codex login`. Verify with `agent-config doctor --check team`.',
        };
    }
    if (strongestAuth(report, CODEX_PROVIDER) === null) {
        return {
            available: false,
            reason:
                'codex CLI not available — no auth detected for it. Run `codex login` ' +
                '(or set `OPENAI_API_KEY`). Verify with `agent-config doctor --check team`.',
        };
    }
    return { available: true, reason: null };
}

/**
 * `emergency.orchestration_halt` — the one audited incident switch over the
 * always-on orchestration stack (subagents, council, TEAM). Reads the
 * project settings cascade fresh (or an injected dict for tests) on every
 * call — no cache of its own, so an armed halt takes effect on the very
 * next read, same as every other `orchestration_halt` reader in the tree
 * (`routing_doctor.ts`, `delegation_nudge_hook.ts`).
 */
export function isOrchestrationHalted(
    settings?: SettingsDict | null,
    cwd?: string | null,
): boolean {
    const merged = settings ?? load_agent_settings({ cwd: cwd ?? process.cwd() });
    const emergency = (merged as Record<string, unknown>)['emergency'];
    if (typeof emergency !== 'object' || emergency === null || Array.isArray(emergency)) {
        return false;
    }
    return (emergency as Record<string, unknown>)['orchestration_halt'] === true;
}

/** The one-line halt notice — `/team` prints this verbatim when halted. */
export const ORCHESTRATION_HALT_MESSAGE =
    '/team is halted (`emergency.orchestration_halt: true`) — the always-on ' +
    'orchestration stack (subagents, council, team) is paused for incident ' +
    'response. Resume: set `orchestration_halt: false` with a non-empty ' +
    '`orchestration_halt_justification` in `.agent-settings.yml`.';
