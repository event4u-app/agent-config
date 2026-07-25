#!/usr/bin/env tsx
/**
 * reach:doctor — read-only health report over the reach channel registry
 * (road-to-internet-reach Phase 2, steps 4-7; `--deep` from Phase 7 step 4).
 *
 * WHAT THIS ANSWERS. Two operator questions, nothing more: *is the upstream
 * tool I already chose to install healthy, and is its install command
 * pinned?* — and, for a backend that declares one, *is it actually able to do
 * the retrieval, or merely installed?* Per channel it reports the health of the
 * ordered backend candidates, which one is currently active, and — when the
 * first candidate is `missing` or `broken` — the exact pinned command **a
 * human** runs for the current platform, echoed verbatim from
 * `src/config/reach-channels.yml`.
 *
 * THE SECOND QUESTION EXISTS BECAUSE A PASSING PROBE CAN LIE. `yt-dlp
 * --version` exits 0 as soon as the binary is on PATH, while YouTube extraction
 * additionally needs an external JavaScript runtime that the tool must be
 * configured to use. A channel reported `ok` on that evidence alone is a false
 * green. The readiness layer (§ READINESS LAYER) closes it locally and
 * read-only, and its verdict is surfaced as the distinct `not-ready` channel
 * status so `missing` (nothing installed) can never be confused with
 * `not-ready` (installed, cannot retrieve).
 *
 * WHAT THIS IS NOT. Not a router, not a recommendation, not an agent-facing
 * surface. The Phase 0 pre-registered benchmark returned `band: stop` (native
 * arm 12/12, reach arm 0 outright wins), so no router skill ships and no
 * channel in the registry is routed, preferred, or suggested to an agent.
 * A channel appearing here means "a recipe an operator wrote needs this
 * backend", never "the agent should reach for this".
 *
 * READ-ONLY BY CONSTRUCTION.
 *   - Zero writes. No file is created, truncated, appended to, or chmod'ed;
 *     `--deep` prints the `last_verified` lines an operator MAY commit and
 *     writes none of them. Asserted mechanically by
 *     `tests/scripts/witness/reach_doctor_readonly.test.ts`.
 *   - Zero installs. Install prescriptions are strings this script selects
 *     and echoes; it never executes one and never invents one.
 *   - Zero network in the default (shallow) mode. The only child processes
 *     are the registry's side-effect-free probes, run through `probeTool()`
 *     (which hardens the child env per ADR-123). `--deep` is the single
 *     opt-in exception and refuses to run in CI.
 *
 * SCHEMA-ENFORCED INPUT — the registry is NOT trusted input. `collect()`
 * validates the file (including `--registry <path>`) against
 * `reach-channels.schema.json` plus the cross-field `probe_cmd === id` rule,
 * and refuses the whole run with exit 2 on any error-severity finding. This is
 * a security boundary, not tidiness: `probe_cmd` + `probe_args` become a child
 * process, so an unvalidated registry was an arbitrary-execution primitive
 * (`probe_cmd: sh`, `probe_args: ['-c', '<payload>']` ran and reported `ok`).
 *
 * PER-CHANNEL ISOLATION. A malformed channel becomes that channel's `error`
 * row; every other channel is still reported. One bad entry can never take
 * the report down — the same guarantee `probeTools()` gives per backend. Since
 * the schema gate above refuses malformed files outright, this layer is now
 * defense in depth: it is exercised directly through `buildChannelRow()` /
 * `errorRow()`, which are exported for exactly that reason.
 *
 * Payload / flag / exit-code conventions follow `hooks_doctor.ts`:
 * `schema_version` on a JSON-serialisable payload, `--format json|table`
 * (table default), `--strict` for CI, exit 2 for an unusable input. The
 * JSON payload validates against
 * `src/scripts/schemas/reach-doctor-payload.schema.json`.
 *
 * Exit codes:
 *   0 — report produced (and, under `--strict`, every admitted channel is ok).
 *   1 — `--strict` and at least one admitted channel is not `ok`.
 *   2 — usage error, unusable OR schema-invalid registry, or `--deep`
 *       requested inside CI.
 *
 * Invocation (from the project root):
 *   ./agent-config reach:doctor [--format json|table] [--strict]
 *                              [--channel <id>] [--registry <path>] [--deep]
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hardenedSpawnEnv } from './_lib/spawn_env.js';
import { probeTool } from './_lib/tool_probe.js';
import type { FixPrescription, ToolProbeStatus } from './_lib/tool_probe.js';
import {
    REGISTRY_PATH,
    RegistryLoadError,
    SCHEMA_MESSAGE_MAX_CHARS,
    excerpt_for_finding,
    load_registry,
    sanitizeParseError,
    validate_file,
} from './check_reach_channels.js';

const _HERE = fileURLToPath(import.meta.url);
/** Repo root — two dirs up from src/scripts, mirroring the sibling scripts. */
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Payload format version. Bumped only on a breaking payload shape change. */
export const SCHEMA_VERSION = 1;

/**
 * `removed` extends the probe taxonomy: past `removal_after`, never probed.
 * `not-ready` extends it the other way: a candidate IS installed and answering
 * its probe, but a declared readiness requirement is not confirmed satisfied —
 * the "installed, unverified" ceiling (see § READINESS LAYER). It exists so an
 * operator can tell `missing` (nothing to run) from `not-ready` (the binary
 * runs, the retrieval still will not work).
 */
export type ChannelStatus = ToolProbeStatus | 'removed' | 'not-ready';

/** Thrown for the exit-2 class: bad flags, unknown channel, `--deep` in CI. */
export class ReachDoctorUsageError extends Error {}

/**
 * Deep probes — the ONLY network in this script, and only under `--deep`.
 *
 * Declared here rather than in the registry on purpose: the registry's schema
 * describes *install pinning and local probes*, and a network endpoint is not
 * derivable from it. A backend with no entry below reports `not-declared`
 * instead of getting an endpoint invented for it — `yt-dlp` is exactly that
 * case (any real video URL would be both an invention and a terms-of-service
 * surface). Every declared probe is read-only: a rate-limit read, or a HEAD
 * against `example.com`, the domain IANA reserves for documentation use.
 */
interface DeepProbeSpec {
    /** Args appended to the backend's own `probe_cmd`. */
    readonly args: readonly string[];
    /** The endpoint actually contacted, surfaced in the report. */
    readonly endpoint: string;
}

const DEEP_PROBES: Readonly<Record<string, DeepProbeSpec>> = {
    // GitHub's own rate-limit read — the canonical "is my token live" call.
    gh: { args: ['api', 'rate_limit'], endpoint: 'https://api.github.com/rate_limit' },
    curl: {
        args: [
            '--silent',
            '--show-error',
            '--max-time',
            '10',
            '--head',
            '--output',
            os.devNull,
            'https://example.com',
        ],
        endpoint: 'https://example.com',
    },
    node: {
        args: [
            '-e',
            "fetch('https://example.com', { method: 'HEAD' }).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))",
        ],
        endpoint: 'https://example.com',
    },
};

/** Per-backend deadline for a deep probe — network, so looser than a probe. */
const DEEP_TIMEOUT_MS = 15_000;

export interface DeepRow {
    status: 'ok' | 'failed' | 'skipped' | 'not-declared';
    endpoint: string | null;
    exit_code: number | null;
    detail: string;
}

export interface BackendRow {
    id: string;
    probe_cmd: string;
    status: ToolProbeStatus;
    path: string | null;
    exit_code: number | null;
    diagnostic: string;
    /** Pinned prescription for the CURRENT platform; `missing`/`broken` only. */
    fix: string | null;
    deep: DeepRow | null;
    /**
     * Config-semantic readiness verdict, present ONLY for a backend that
     * declares a readiness requirement (see `READINESS_REQUIREMENTS`). ABSENT —
     * not `null` — for every other backend, so "this backend has no such
     * requirement" is expressed by the field not existing rather than by a
     * value a reader has to interpret.
     */
    readiness?: ReadinessRow;
}

/**
 * Credential-file permission metadata. Deliberately carries the path and the
 * mode ONLY — never the contents, and never a hash or fingerprint of the
 * secret (a fingerprint is a confirmation oracle, so it is not a safe
 * "redacted" form).
 */
export interface CredentialRow {
    path: string;
    present: boolean;
    /** Octal permission bits, e.g. `0600`. `null` when not checked/absent. */
    mode: string | null;
    group_or_world_readable: boolean;
    /** POSIX modes are not meaningful on win32; the check is skipped there. */
    checked: boolean;
}

export interface ChannelRow {
    id: string;
    status: ChannelStatus;
    /** First backend that probes `ok`; `null` when none does. */
    active_backend: string | null;
    tier: string;
    lifecycle: string;
    last_verified: string;
    /** Pinned fix for the first candidate when it is `missing`/`broken`. */
    fix: string | null;
    warnings: string[];
    credential: CredentialRow | null;
    backends: BackendRow[];
}

export interface ReachDoctorPayload {
    schema_version: number;
    /** `process.platform` — the key the install prescription was chosen by. */
    platform: string;
    /** Registry actually read, repo-relative when it lives inside the repo. */
    registry: string;
    /** True only when `--deep` ran (network was contacted). */
    deep: boolean;
    channels: ChannelRow[];
    /** `--deep` only: `last_verified` lines the operator MAY commit. */
    last_verified_suggestions: string[];
}

export interface CollectOptions {
    registryPath?: string;
    /** Single-channel filter (`--channel`). */
    channel?: string;
    deep?: boolean;
    /** Injectable clock for the `removal_after` comparison. */
    now?: Date;
    /**
     * Injectable readiness observer (defaults to the live one). TEST-FACING,
     * exactly like `now`: no CLI flag reaches it.
     */
    readiness?: ReadinessProbeFn;
}

function toRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string | null {
    const value = record[key];
    return typeof value === 'string' && value !== '' ? value : null;
}

/** `YYYY-MM-DD` in local time — the form `last_verified` / `removal_after` use. */
function isoDate(now: Date): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function expandHome(target: string): string {
    if (target === '~') return os.homedir();
    if (target.startsWith('~/')) return path.join(os.homedir(), target.slice(2));
    return path.resolve(target);
}

/**
 * Roots a declared `credential_path` may point into: the operator's home (where
 * `~/.config`, `~/.netrc` and token files live), this repo, and the system temp
 * dir (the fixture case — a temp path reveals nothing its author does not already
 * control).
 */
function credentialRoots(): string[] {
    const roots = [os.homedir(), ROOT, os.tmpdir()];
    // BOTH the symlinked and the resolved form of every root, because macOS hands
    // out `/var/folders/…` from `os.tmpdir()` while its realpath is
    // `/private/var/folders/…`. Comparing only one form refused the legitimate
    // fixture case — caught by running the check, not by reading it.
    for (const root of [...roots]) {
        try {
            roots.push(fs.realpathSync(root));
        } catch {
            // A root that cannot be resolved simply contributes its literal form.
        }
    }
    return [...new Set(roots.map((root) => path.resolve(root)))];
}

/**
 * PATH CONFINEMENT — the registry is untrusted input, so `credential_path` is an
 * arbitrary-path primitive until it is bounded.
 *
 * Found by an adversarial council pass on this file, and reproduced before being
 * believed: a `--registry` file declaring
 * `credential_path: ../../../../../../../etc/passwd` made the doctor `stat` that
 * path and report, at exit 0 inside a normal-looking health row,
 * `{"path":"/etc/passwd","present":true,"mode":"0644","group_or_world_readable":true,"checked":true}`.
 * That is an existence-and-permission oracle over the whole filesystem wearing the
 * costume of a credential warning. The schema cannot express the bound (it only
 * pins the value to a single line), so the bound lives here.
 *
 * Honest severity: whoever runs this CLI already has a shell and could `stat` the
 * file themselves, so locally it buys an attacker nothing. It matters because this
 * is a *diagnostic others may invoke* — a CI job, an agent surface with a path
 * parameter — and a tool whose whole contract is "read-only and boring" should not
 * ship a primitive that reports arbitrary path metadata.
 *
 * Refusal is reported, never silent: `checked: false` plus a warning naming it, so
 * an operator with a legitimately unusual credential location sees why nothing was
 * checked rather than seeing a pass.
 */
export function confineCredentialPath(resolved: string): boolean {
    const roots = credentialRoots();
    const candidates = [path.resolve(resolved)];
    try {
        // Realpath the target too, so a symlink cannot point out of the roots and
        // so the macOS `/var` → `/private/var` case matches from either side.
        candidates.push(fs.realpathSync(candidates[0] as string));
    } catch {
        // Not resolvable (usually: does not exist) — the literal form decides.
    }
    return candidates.every((candidate) =>
        roots.some((root) => candidate === root || candidate.startsWith(`${root}${path.sep}`)),
    );
}

/**
 * Group- or world-readability check on a declared credential file.
 *
 * No channel in the shipped registry declares `credential_path` — the
 * login-tier channels that would have are cancelled with Phase 5 — so on the
 * real registry this check is inert. It ships anyway (and is covered by
 * fixture tests) because the failure it catches is silent: a `0644` token file
 * is readable by every process on the box, and nothing else in the pipeline
 * looks. Adding the field to the shipped registry requires a
 * `reach-channels.schema.json` addition first; the schema is `additionalProperties: false`.
 */
function inspectCredential(declared: string): CredentialRow {
    const resolved = expandHome(declared);

    // Confinement runs BEFORE any syscall, so an out-of-bounds path is never
    // stat'ed and not even its existence leaks.
    if (!confineCredentialPath(resolved)) {
        return {
            path: resolved,
            present: false,
            mode: null,
            group_or_world_readable: false,
            checked: false,
        };
    }
    // WIN32: NO ALTERNATIVE CONTROL, AND THE GAP IS REPORTED RATHER THAN HIDDEN.
    // Windows does not express file access as a `stat.mode` bitmask at all — it
    // uses ACLs, so there is no POSIX permission triple here to read and no
    // narrower check available. Reading the real ACL would need either a native
    // binding or spawning `icacls`, and this doctor refuses to add a child
    // process for a diagnostic (its read-only contract is asserted by the
    // witness test). So the honest answer is `checked: false`: `present` is
    // still reported, `mode` is `null`, and `group_or_world_readable` is `false`
    // as "not determined" — never as "determined safe". `checked` is a REQUIRED
    // field of the payload schema and both output formats surface it (the table
    // prints "not checked on this platform"), so an operator sees an unevaluated
    // check instead of a passing one.
    if (process.platform === 'win32') {
        return {
            path: resolved,
            present: fs.existsSync(resolved),
            mode: null,
            group_or_world_readable: false,
            checked: false,
        };
    }
    let stat: fs.Stats;
    try {
        stat = fs.statSync(resolved);
    } catch {
        return {
            path: resolved,
            present: false,
            mode: null,
            group_or_world_readable: false,
            checked: true,
        };
    }
    // A directory is not a credential file, and its 0755 is normal rather than a
    // finding — reporting one as group-readable would manufacture a warning an
    // operator cannot act on (council finding: the mode was read without checking
    // the file type). Same for a socket / device / fifo: `checked: false` says the
    // question was not answered, which is the truth.
    if (!stat.isFile()) {
        return {
            path: resolved,
            present: true,
            mode: null,
            group_or_world_readable: false,
            checked: false,
        };
    }
    const bits = stat.mode & 0o777;
    // Group-read (0o040) or other-read (0o004) — write bits are a superset
    // concern the mode string surfaces without needing its own field.
    const exposed = (bits & 0o044) !== 0;
    return {
        path: resolved,
        present: true,
        mode: `0${bits.toString(8).padStart(3, '0')}`,
        group_or_world_readable: exposed,
        checked: true,
    };
}

/**
 * Run the declared deep probe for one backend.
 *
 * Reached from `buildChannelRow`, so the same boundary note applies: the schema
 * gate is `collect()`, which validates the registry before `--deep` can turn any
 * `probe_cmd` into a child process. This export is TEST-FACING; a direct caller
 * is responsible for validating its input first.
 */
export function runDeepProbe(probeCmd: string, localStatus: ToolProbeStatus): DeepRow {
    // `Object.hasOwn`, never a bare index. THE GUARD IS WHAT MAKES A
    // PROTOTYPE-CHAIN KEY IMPOSSIBLE HERE — reviewers have flagged this area
    // twice, so the mechanism is recorded rather than left to be re-derived:
    // `DEEP_PROBES[probeCmd]` walks the prototype chain, so `probe_cmd:
    // constructor` resolved to `Object` and `probe_cmd: __proto__` to
    // `Object.prototype`. Either one skipped the `not-declared` branch and
    // emitted a `deep` block with `endpoint: undefined` — a payload that fails
    // its own schema. `Object.hasOwn` consults only own properties, so every
    // inherited key now takes the `not-declared` path by construction, and no
    // endpoint is ever invented for a backend that declared none.
    const spec = Object.hasOwn(DEEP_PROBES, probeCmd) ? DEEP_PROBES[probeCmd] : undefined;
    if (spec === undefined) {
        return {
            status: 'not-declared',
            endpoint: null,
            exit_code: null,
            detail: `no deep probe is declared for '${probeCmd}' — an endpoint is never invented for a backend`,
        };
    }
    if (localStatus !== 'ok') {
        return {
            status: 'skipped',
            endpoint: spec.endpoint,
            exit_code: null,
            detail: `local probe is ${localStatus} — a real request would only re-report that`,
        };
    }
    const result = spawnSync(probeCmd, [...spec.args], {
        env: hardenedSpawnEnv(),
        timeout: DEEP_TIMEOUT_MS,
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true,
    });
    if (result.error !== undefined) {
        return {
            status: 'failed',
            endpoint: spec.endpoint,
            exit_code: null,
            detail: `deep request failed to run: ${result.error.message}`,
        };
    }
    const code = result.status ?? null;
    if (code === 0) {
        return {
            status: 'ok',
            endpoint: spec.endpoint,
            exit_code: 0,
            detail: `one real read-only request to ${spec.endpoint} succeeded`,
        };
    }
    return {
        status: 'failed',
        endpoint: spec.endpoint,
        exit_code: code,
        detail: `request to ${spec.endpoint} exited ${code === null ? 'without a status' : String(code)}`,
    };
}

/* ====================================================================== *
 * READINESS LAYER — a passing `--version` is not a working backend
 * (road-to-gated-reach Phase 2, steps 2/3/6)
 * ====================================================================== */

/**
 * THE INVARIANT THIS WHOLE LAYER DEPENDS ON (Phase 2 step 6 — recorded here
 * because this is the file that would break it).
 *
 *   1. **Probes stay `--version`-only.** Every argument list this script hands
 *      to a child process is either the registry's schema-constrained,
 *      flag-shaped `probe_args`, or a literal `['--version']` written here. No
 *      registry value ever selects a *subcommand*.
 *   2. **The doctor NEVER runs an upstream tool's own status subcommand when
 *      that subcommand has side effects.** `gh auth status` refreshes and can
 *      rewrite the stored credential; `yt-dlp -U` / `--update-to` replaces the
 *      binary; a `login`/`doctor`/`serve` subcommand can start a daemon or
 *      mint a token. Any of those would make this *diagnostic* mutating — and
 *      the read-only claim is asserted mechanically by
 *      `tests/scripts/witness/reach_doctor_readonly.test.ts`, which fails on the
 *      mere presence of a filesystem write primitive in this file.
 *   3. **Therefore an "installed, unverified" ceiling is preferred to a false
 *      green.** Where readiness cannot be settled without a side-effectful call
 *      or a network round-trip, the honest answer is `unknown` plus the
 *      `not-ready` channel status — never `ok`. The one exception is `--deep`,
 *      which is opt-in, CI-refusing, and limited to the endpoints declared in
 *      `DEEP_PROBES`.
 *
 * The readiness check below stays inside that invariant by construction: it
 * reads a LOCAL config file and consults PATH. It contacts no network, and the
 * only new child process it introduces is one more `--version`.
 */

/**
 * DECISION (Phase 2 step 3): readiness requirements live HERE, in doctor-side
 * logic keyed on the backend id — NOT as an optional per-backend field in
 * `reach-channels.schema.json`.
 *
 * Why this shape:
 *
 *   - **It keeps the schema honest for the backends that have no such
 *     requirement.** With a schema field, the four other channels' backends
 *     would each have to *declare an absence* (omit an optional key that a
 *     reader must then interpret); with a code table they declare nothing at
 *     all, and the payload simply carries no `readiness` object for them.
 *   - **The requirement is a property of the upstream tool, not of the
 *     operator's registry entry.** "yt-dlp needs an external JS runtime" is a
 *     fact about yt-dlp; a registry that could omit it would hand the operator
 *     back the exact false green this layer exists to close.
 *   - **The registry is untrusted input** (see `collect()`), and a schema field
 *     of kind "check this config file" would widen that input's influence into
 *     *which local path the doctor reads*. Keyed here, the resolved path
 *     depends only on the operator's own environment.
 *   - **Precedent in this same file:** `DEEP_PROBES` is declared code-side for
 *     the same reason — the registry's schema describes install pinning and
 *     local probes, and neither a network endpoint nor a config-semantic rule
 *     is derivable from it. A backend absent from the table gets `undefined`,
 *     never an invented requirement.
 *
 * The rejected trade-off, stated: a schema field would make the requirement
 * visible in the registry an operator reads, and would let a *new* backend with
 * the same need be added by editing config instead of code. That is a real
 * cost, and it is paid here — adding a second js-runtime-needing backend means
 * a code edit plus a test, not a YAML line. It was judged the cheaper cost,
 * because the alternative's failure mode (a registry silently declaring no
 * requirement, or declaring one for a backend where it is meaningless) is a
 * wrong *health verdict*, while this one is only extra work for a maintainer.
 * A short form of this reasoning also lives in the `$comment` of
 * `src/scripts/schemas/reach-channels.schema.json`, where a reader looking for
 * the absent field will actually be standing.
 */
export type ReadinessKind = 'js-runtime';

const READINESS_REQUIREMENTS: Readonly<Record<string, ReadinessKind>> = {
    // `yt-dlp --version` exits 0 as soon as the binary exists, but YouTube
    // extraction additionally needs an external JavaScript runtime. Only Deno
    // is enabled by default; with Node the user config must opt in.
    'yt-dlp': 'js-runtime',
};

/** The literal flag whose PRESENCE is the signal — any runtime value counts. */
export const JS_RUNTIME_FLAG = '--js-runtimes';

/** Runtime the flag names when the doctor prescribes it. */
const JS_RUNTIME_PRESCRIBED = 'node';

/**
 * External JavaScript runtimes, in the order checked. `deno` first because
 * yt-dlp enables it with no config at all, so finding it settles the question.
 */
const JS_RUNTIME_CANDIDATES: readonly string[] = ['deno', 'node'];

/**
 * VERSION GATE — `2025.11.12`, the yt-dlp release that introduced
 * `--js-runtimes`. Older builds reject the option outright, so prescribing it
 * there would tell an operator to write a config the tool then errors on: a
 * fix command that breaks a working install is worse than no fix command.
 * Below the gate the remedy is therefore "upgrade first", never the flag.
 *
 * Provenance: taken from the roadmap step that specified this gate, NOT
 * re-derived here — this command reaches no network and must not pretend to
 * have checked a release feed. An unparseable version is treated as
 * *unconfirmed* rather than assumed new enough (see `assessJsRuntimeReadiness`),
 * so a wrong gate value can only make the doctor more conservative.
 */
const JS_RUNTIME_MIN_VERSION: readonly [number, number, number] = [2025, 11, 12];

/** Bounded read: a user config is a handful of lines; 64 KiB is already absurd. */
export const READINESS_CONFIG_MAX_BYTES = 64 * 1024;

/** Deadline for the extra `--version` capture — same order as a probe. */
const VERSION_TIMEOUT_MS = 5_000;

/** `ready` = confirmed usable · `not-ready` = confirmed unusable · `unknown` = not settled. */
export type ReadinessStatus = 'ready' | 'not-ready' | 'unknown';

export interface ReadinessRow {
    kind: ReadinessKind;
    status: ReadinessStatus;
    /** Config path resolved the way the upstream tool itself resolves it. */
    config_path: string;
    /** True only when that path is a real, readable regular file. */
    config_present: boolean;
    /** True when the literal flag was found in it (any runtime value). */
    config_flag: boolean;
    /** Runtimes found on PATH, in `JS_RUNTIME_CANDIDATES` order. */
    runtimes: string[];
    /** Parsed backend version (`YYYY.M.D`), or null when it could not be parsed. */
    version: string | null;
    /** Idempotent, OS-specific remedy the OPERATOR runs. Never executed here. */
    fix: string | null;
    detail: string;
}

/**
 * The three facts about the live machine that a fixture cannot supply. Split
 * out so the whole verdict — path resolution, the bounded config read, the
 * version gate — is exercisable against real files with only these injected.
 */
export interface JsRuntimeObservation {
    /** The backend binary's own probe verdict; readiness is decidable only at `ok`. */
    backend_status: ToolProbeStatus;
    /**
     * First line of the backend's `--version` output, or null when none was
     * read. NEVER reaches the payload: it is parsed against a strict numeric
     * shape and only the parsed form is reported, so raw child output cannot
     * travel into a report (the same discipline `probeTool` keeps by ignoring
     * stdio entirely).
     */
    version_raw: string | null;
    /** JS runtimes found on PATH. */
    runtimes: readonly string[];
}

/**
 * Resolve the yt-dlp USER config path the way yt-dlp itself resolves it:
 * `$XDG_CONFIG_HOME/yt-dlp/config` when `XDG_CONFIG_HOME` is set and non-empty,
 * otherwise `~/.config/yt-dlp/config`.
 *
 * THIS IS THE FAILURE WORTH PREVENTING. If the doctor read `~/.config/...`
 * while the tool read `$XDG_CONFIG_HOME/...`, the doctor and the operator would
 * agree with each other — "the flag is not there", "I added it, still broken" —
 * while the real tool was reading a different file the whole time. A diagnostic
 * that resolves a path differently from the tool it diagnoses is worse than no
 * diagnostic, because it is confidently wrong.
 *
 * KNOWN GAP, not silently absorbed: on Windows yt-dlp ALSO honours
 * `%APPDATA%\yt-dlp\config`. This resolver implements the XDG pair only, so on
 * a win32 host with no `XDG_CONFIG_HOME` it inspects `~/.config/yt-dlp/config`
 * — a location yt-dlp does read, but not the only one. The emitted fix targets
 * the same path this check read, so the two never disagree with each other;
 * they can, on win32, both be looking somewhere the operator's real config is
 * not. Stated rather than papered over.
 */
export function resolveYtDlpConfigPath(env: NodeJS.ProcessEnv = process.env): string {
    const xdg = env['XDG_CONFIG_HOME'];
    const base =
        typeof xdg === 'string' && xdg.trim() !== ''
            ? expandHome(xdg)
            : path.join(os.homedir(), '.config');
    return path.join(base, 'yt-dlp', 'config');
}

export interface ConfigFlagRead {
    present: boolean;
    flag: boolean;
    /** Non-null when the path exists but was deliberately NOT read. */
    refused: string | null;
}

/**
 * Bounded, symlink-refusing read for the literal flag.
 *
 * - `lstatSync`, never `statSync`: a symlink is REFUSED rather than followed.
 *   The doctor is asked to inspect a config file, and following a link would
 *   let something other than that file answer for it (the same reasoning as
 *   `confineCredentialPath` above, applied to a read instead of a stat).
 *   Non-regular files (directory, fifo, socket, device) are refused for the
 *   same reason — reading one can block forever.
 * - The read is CAPPED at `READINESS_CONFIG_MAX_BYTES` via
 *   `openSync(path, 'r')` + `readSync`, not `readFileSync`: a config path that
 *   is really a 5 GB file must not become an OOM in a health report.
 * - Only the flag's PRESENCE is extracted. The file's contents never reach the
 *   payload, so an operator's config (which can legitimately carry cookies
 *   paths, proxies, credentials) cannot leak through a diagnostic.
 */
export function readConfigFlag(
    configPath: string,
    maxBytes: number = READINESS_CONFIG_MAX_BYTES,
): ConfigFlagRead {
    let stat: fs.Stats;
    try {
        stat = fs.lstatSync(configPath);
    } catch {
        return { present: false, flag: false, refused: null };
    }
    if (stat.isSymbolicLink()) {
        return {
            present: false,
            flag: false,
            refused: `${configPath} is a symlink — refused rather than followed, so nothing but that file itself can answer for it`,
        };
    }
    if (!stat.isFile()) {
        return {
            present: false,
            flag: false,
            refused: `${configPath} is not a regular file — not read`,
        };
    }
    let descriptor: number | null = null;
    try {
        descriptor = fs.openSync(configPath, 'r');
        const buffer = Buffer.alloc(Math.min(maxBytes, Math.max(stat.size, 1)));
        const read = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
        const text = buffer.subarray(0, read).toString('utf-8');
        return { present: true, flag: text.includes(JS_RUNTIME_FLAG), refused: null };
    } catch {
        return {
            present: true,
            flag: false,
            refused: `${configPath} exists but could not be read`,
        };
    } finally {
        if (descriptor !== null) {
            try {
                fs.closeSync(descriptor);
            } catch {
                // A descriptor that cannot be closed changes no verdict.
            }
        }
    }
}

/**
 * Parse the `YYYY.M.D` release shape yt-dlp reports, tolerating the nightly
 * fourth component (`2025.11.12.232946`). ANYTHING else returns null, which the
 * caller reads as "cannot confirm" — never as "new enough". The nightly suffix
 * is dropped from the reported version on purpose: the gate compares releases.
 */
const YT_DLP_VERSION_RE = /^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\.\d+)?$/;

export function parseYtDlpVersion(raw: string | null): readonly [number, number, number] | null {
    if (raw === null) return null;
    const match = YT_DLP_VERSION_RE.exec(raw.trim());
    if (match === null) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }
    return [year, month, day];
}

function compareVersions(
    left: readonly [number, number, number],
    right: readonly [number, number, number],
): number {
    for (let index = 0; index < 3; index += 1) {
        const delta = (left[index] as number) - (right[index] as number);
        if (delta !== 0) return delta;
    }
    return 0;
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
}

function powershellQuote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The IDEMPOTENT, OS-specific remedy. The doctor prints it; it never runs it
 * (no install, no write — `non-destructive-by-default` plus the read-only
 * witness).
 *
 * Idempotence is the whole design constraint: an operator may paste this twice,
 * or into a provisioning script that runs on every boot, so it must create the
 * directory if needed and append the flag ONLY when the line is not already
 * there. On POSIX the `grep … || printf …` pair is wrapped in `{ …; }` because
 * `A && B || C` would run C when A fails — the grouping is what keeps a failed
 * `mkdir` from silently becoming an append attempt. The appended text is
 * byte-identical to what `grep -qxF` matches, so the second run is a no-op.
 *
 * The path is the SAME one `readConfigFlag` inspected, so the check and the
 * remedy can never point at different files.
 */
export function jsRuntimeFixCommand(
    configPath: string,
    platform: string = process.platform,
): string {
    const line = `${JS_RUNTIME_FLAG} ${JS_RUNTIME_PRESCRIBED}`;
    const directory = path.dirname(configPath);
    if (platform === 'win32') {
        return (
            `New-Item -ItemType Directory -Force -Path ${powershellQuote(directory)} | Out-Null; ` +
            `if (-not (Test-Path -LiteralPath ${powershellQuote(configPath)}) -or ` +
            `-not (Select-String -LiteralPath ${powershellQuote(configPath)} -SimpleMatch ` +
            `-Pattern ${powershellQuote(JS_RUNTIME_FLAG)} -Quiet)) ` +
            `{ Add-Content -LiteralPath ${powershellQuote(configPath)} -Value ${powershellQuote(line)} }`
        );
    }
    return (
        `mkdir -p ${shellQuote(directory)} && ` +
        `{ grep -qxF -- ${shellQuote(line)} ${shellQuote(configPath)} 2>/dev/null || ` +
        `printf '%s\\n' ${shellQuote(line)} >> ${shellQuote(configPath)}; }`
    );
}

/**
 * Settle the js-runtime readiness question from one observation plus the real,
 * locally-resolved config file. Pure with respect to the network; the only I/O
 * is the bounded config read.
 *
 * Order of the branches is the contract:
 *
 *   1. backend not `ok` → `unknown`. Nothing about a runtime can make an
 *      uninstalled extractor work, so no readiness verdict is claimed; the
 *      channel's own `missing` / `broken` status and its pinned install
 *      prescription are the actionable output. The runtime and config
 *      observations are still reported — they were really made, and they tell
 *      the operator what will ALSO be needed after the install.
 *   2. Deno on PATH → `ready`. yt-dlp enables Deno by default, so no config
 *      flag is required and the version gate is irrelevant.
 *   3. No JS runtime at all → `not-ready`. No config edit fixes that, so no fix
 *      command is emitted for it — installing a runtime is the operator's
 *      decision and is not a prescription this registry pins.
 *   4. Node-only: the version gate runs BEFORE the flag is considered, so a
 *      build that cannot support the flag is never told to add it, and an
 *      unparseable version can never read as `ready`.
 */
export function assessJsRuntimeReadiness(
    observation: JsRuntimeObservation,
    env: NodeJS.ProcessEnv = process.env,
): ReadinessRow {
    const configPath = resolveYtDlpConfigPath(env);
    const read = readConfigFlag(configPath);
    const runtimes = [...observation.runtimes];
    const parsed = parseYtDlpVersion(observation.version_raw);
    const version = parsed === null ? null : parsed.join('.');
    const suffix = read.refused === null ? '' : ` (${read.refused})`;

    const base = {
        kind: 'js-runtime' as const,
        config_path: configPath,
        config_present: read.present,
        config_flag: read.flag,
        runtimes,
        version,
    };

    if (observation.backend_status !== 'ok') {
        return {
            ...base,
            status: 'unknown',
            version: null,
            fix: null,
            detail:
                `the backend itself is ${observation.backend_status}, so extraction readiness is not evaluated yet — ` +
                `install it first (the channel's pinned prescription above), then re-run; ` +
                `the runtime and config facts below were still observed and will still apply${suffix}`,
        };
    }

    if (runtimes.includes('deno')) {
        return {
            ...base,
            status: 'ready',
            fix: null,
            detail: `deno is on PATH and yt-dlp enables it by default — no ${JS_RUNTIME_FLAG} entry is required${suffix}`,
        };
    }

    if (runtimes.length === 0) {
        return {
            ...base,
            status: 'not-ready',
            fix: null,
            detail:
                `no external JavaScript runtime is on PATH (checked: ${JS_RUNTIME_CANDIDATES.join(', ')}) — ` +
                `YouTube extraction needs one; installing Deno needs no yt-dlp config change${suffix}`,
        };
    }

    if (parsed === null) {
        return {
            ...base,
            status: 'unknown',
            fix: null,
            detail:
                `cannot confirm this yt-dlp version supports ${JS_RUNTIME_FLAG}: --version reported no ` +
                `YYYY.M.D release, so the ${JS_RUNTIME_MIN_VERSION.join('.')} gate cannot be applied — ` +
                `upgrade first (the channel's pinned prescription above), then re-run${suffix}`,
        };
    }

    if (compareVersions(parsed, JS_RUNTIME_MIN_VERSION) < 0) {
        return {
            ...base,
            status: 'not-ready',
            fix: null,
            detail:
                `yt-dlp ${version} is older than ${JS_RUNTIME_MIN_VERSION.join('.')}, the release that added ` +
                `${JS_RUNTIME_FLAG} — this build would reject the flag, so upgrade first ` +
                `(the channel's pinned prescription above) rather than editing the config${suffix}`,
        };
    }

    if (read.flag) {
        return {
            ...base,
            status: 'ready',
            fix: null,
            detail: `node is on PATH and ${configPath} carries ${JS_RUNTIME_FLAG}${suffix}`,
        };
    }

    return {
        ...base,
        status: 'not-ready',
        fix: jsRuntimeFixCommand(configPath),
        detail:
            `node is the only JavaScript runtime on PATH and ${configPath} ` +
            `${read.present ? `does not carry ${JS_RUNTIME_FLAG}` : `does not exist, so nothing carries ${JS_RUNTIME_FLAG}`} — ` +
            `yt-dlp will not use node until it does${suffix}`,
    };
}

/**
 * Probe the JS runtimes through the EXISTING probe machinery rather than a new
 * spawn path: `probeTool` already hardens the child env, bounds the deadline,
 * ignores stdio and never throws, so presence-on-PATH needs no second
 * implementation.
 */
export function probeJsRuntimes(): string[] {
    return JS_RUNTIME_CANDIDATES.filter(
        (bin) =>
            probeTool({ name: `js-runtime/${bin}`, bin, probe_args: ['--version'] }).status ===
            'ok',
    );
}

/**
 * Capture a backend's `--version` line.
 *
 * This is the ONE place readiness cannot reuse `probeTool`: that function
 * deliberately ignores child stdio (its verdict is the exit status), and the
 * version gate needs the string. So it is a separate `spawnSync` — routed
 * through `hardenedSpawnEnv()` like every other spawn in this file (ADR-123),
 * with the same bounded deadline, `stdio` piped for stdout ONLY, and a capped
 * buffer. The argument list is the literal `['--version']` written here, never a
 * registry value, so this cannot become a channel for a chosen subcommand.
 */
export function probeBackendVersion(probeCmd: string): string | null {
    const result = spawnSync(probeCmd, ['--version'], {
        env: hardenedSpawnEnv(),
        timeout: VERSION_TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8',
        maxBuffer: 64 * 1024,
        windowsHide: true,
    });
    if (result.error !== undefined || result.status !== 0) return null;
    const first = (result.stdout ?? '').split('\n')[0]?.trim() ?? '';
    return first === '' ? null : first;
}

/**
 * Readiness verdict for one backend, or `null` when that backend declares no
 * requirement. `Object.hasOwn`, never a bare index — same prototype-chain
 * reasoning as `runDeepProbe`: `backendId: 'constructor'` must take the
 * no-requirement path rather than resolving to an inherited value.
 */
export function liveReadinessRow(
    backendId: string,
    probedStatus: ToolProbeStatus,
): ReadinessRow | null {
    const kind = Object.hasOwn(READINESS_REQUIREMENTS, backendId)
        ? READINESS_REQUIREMENTS[backendId]
        : undefined;
    if (kind === undefined) return null;
    return assessJsRuntimeReadiness({
        backend_status: probedStatus,
        // Only worth a spawn when the binary answered its own probe.
        version_raw: probedStatus === 'ok' ? probeBackendVersion(backendId) : null,
        runtimes: probeJsRuntimes(),
    });
}

/**
 * Injectable readiness observer. The default is `liveReadinessRow`; the option
 * exists for the same reason `now` does — a fixture cannot install yt-dlp, and
 * a machine without it could otherwise only ever exercise the `unknown` branch.
 * TEST-FACING: nothing on the CLI surface can set it.
 */
export type ReadinessProbeFn = (
    backendId: string,
    probedStatus: ToolProbeStatus,
) => ReadinessRow | null;

/**
 * Build one channel row. Throws on a malformed channel — the caller turns
 * that into this channel's `error` row so the rest of the report survives.
 *
 * THE SCHEMA GATE IS `collect()`, NOT THIS FUNCTION. `collect()` runs
 * `validate_file` (schema + the cross-field `probe_cmd === id` rule) and refuses
 * the whole run before `load_registry`, this function, or any probe is reached.
 * This export exists for the tests that exercise the per-channel isolation layer
 * directly — no registry can get past that gate to reach it otherwise — so it is
 * TEST-FACING, not a public API. A direct caller is responsible for validating
 * its own input first; the entry gate and the `probe_cmd` check below are
 * defense in depth for exactly that case, not a substitute for the schema.
 */
export function buildChannelRow(
    raw: unknown,
    options: { deep: boolean; now: Date; readiness?: ReadinessProbeFn },
): ChannelRow {
    const readinessProbe = options.readiness ?? liveReadinessRow;
    // Entry gate — defense in depth behind `collect()`'s schema validation. Each
    // shape a validated registry cannot produce is refused with a named reason
    // rather than read speculatively: a row built from an entry whose `id` or
    // `backends` had to be guessed would attribute probe results to a channel
    // nobody declared, which is worse than no row at all.
    const record = toRecord(raw);
    if (record === null) {
        throw new Error('channel entry is not a mapping');
    }
    const id = readString(record, 'id');
    if (id === null) {
        throw new Error('channel entry carries no id — a row can only be attributed by id');
    }
    const backendsRaw = record['backends'];
    if (!Array.isArray(backendsRaw)) {
        throw new Error(`channel '${id}': backends must be a non-empty list, got a non-list`);
    }
    if (backendsRaw.length === 0) {
        throw new Error(`channel '${id}': backends must be a non-empty list, got an empty one`);
    }

    const tier = readString(record, 'tier') ?? '(unset)';
    const lifecycle = readString(record, 'lifecycle') ?? '(unset)';
    const lastVerified = readString(record, 'last_verified') ?? '(unset)';
    const removalAfter = readString(record, 'removal_after');
    const replacement = readString(record, 'replacement');
    const credentialPath = readString(record, 'credential_path');

    const warnings: string[] = [];
    const credential = credentialPath === null ? null : inspectCredential(credentialPath);
    if (credential !== null && credential.group_or_world_readable) {
        warnings.push(
            `credential file ${credential.path} is mode ${credential.mode ?? '?'} ` +
                `(group- or world-readable) — run: chmod 600 ${credential.path}`,
        );
    }
    // A refusal is louder than a silent skip: an operator whose credential really
    // does live outside the permitted roots must see WHY nothing was checked,
    // instead of reading an unevaluated check as a passing one.
    if (
        credential !== null &&
        !credential.checked &&
        process.platform !== 'win32' &&
        !confineCredentialPath(credential.path)
    ) {
        warnings.push(
            `credential_path ${credential.path} is outside the permitted roots ` +
                `(your home directory, this repo, or the system temp dir) — not inspected. ` +
                `Move the credential, or drop the field.`,
        );
    }

    // Past `removal_after` the channel is not probed at all: the migration
    // window closed, so its backends' health is no longer a question.
    //
    // This comparison IS string-wise, and that is sound rather than a shortcut:
    // `reach-channels.schema.json` pins `removal_after` (line 57) to
    // `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` and `collect()` refuses the registry before
    // this line on any schema error, so both operands are fixed-width
    // zero-padded ISO dates — a form whose lexicographic order IS its
    // chronological order. `isoDate()` emits the same shape. (The staleness lint
    // takes the other route for the same field, parsing to epoch numbers; see
    // the note at `check_reach_staleness.ts` § (c).)
    const today = isoDate(options.now);
    const removed = removalAfter !== null && today > removalAfter;
    if (removed) {
        warnings.push(
            `removed: past removal_after ${removalAfter} — probe skipped` +
                (replacement === null
                    ? ' (no replacement declared)'
                    : `; superseded by channel '${replacement}'`),
        );
        return {
            id,
            status: 'removed',
            active_backend: null,
            tier,
            lifecycle,
            last_verified: lastVerified,
            fix: null,
            warnings,
            credential,
            backends: [],
        };
    }
    if (lifecycle === 'deprecated') {
        warnings.push(
            'deprecated: still probed for one migration window' +
                (replacement === null
                    ? ' (no replacement declared)'
                    : `; superseded by channel '${replacement}'`) +
                (removalAfter === null ? '' : `, removal_after ${removalAfter}`),
        );
    }

    const backends: BackendRow[] = [];
    for (const backendRaw of backendsRaw) {
        const backend = toRecord(backendRaw);
        if (backend === null) {
            throw new Error(`channel '${id}': backend entry is not a mapping`);
        }
        const backendId = readString(backend, 'id');
        const probeCmd = readString(backend, 'probe_cmd');
        if (backendId === null || probeCmd === null) {
            throw new Error(`channel '${id}': backend entry needs id + probe_cmd`);
        }
        // Defense in depth behind the schema gate in `collect()`: even if a
        // registry reached here unvalidated, a row labelled `backendId` may
        // never carry the health of a different executable. Refusing is the
        // only safe answer — relabelling would hide which binary ran.
        if (backendId !== probeCmd) {
            throw new Error(
                `channel '${id}': backend '${backendId}' declares probe_cmd '${probeCmd}' — ` +
                    `a backend may only probe its own id`,
            );
        }
        const probeArgsRaw = backend['probe_args'];
        const probeArgs = Array.isArray(probeArgsRaw)
            ? probeArgsRaw.filter((arg): arg is string => typeof arg === 'string')
            : [];
        // The `install` map IS the prescription: `probeTool` selects the
        // current platform's string (falling back to `default`) and echoes it.
        // Nothing here composes or edits an install command.
        const install = toRecord(backend['install']);
        const fixPrescription: FixPrescription | undefined =
            install === null ? undefined : (install as Record<string, string>);

        const probed = probeTool({
            name: `${id}/${backendId}`,
            bin: probeCmd,
            probe_args: probeArgs,
            ...(fixPrescription === undefined ? {} : { fix: fixPrescription }),
        });

        const readiness = readinessProbe(backendId, probed.status);

        backends.push({
            id: backendId,
            probe_cmd: probeCmd,
            status: probed.status,
            path: probed.path,
            exit_code: probed.exit_code,
            diagnostic: probed.diagnostic,
            fix: probed.fix,
            deep: options.deep ? runDeepProbe(probeCmd, probed.status) : null,
            // Omitted entirely (not null) when the backend declares no
            // requirement — the four other channels gain no field at all.
            ...(readiness === null ? {} : { readiness }),
        });
    }

    // Backend order is the switch: the first USABLE candidate wins. A backend
    // whose probe is `ok` but whose declared readiness requirement is not
    // confirmed satisfied is NOT usable — that is the whole point of the
    // readiness layer, and treating it as active would reintroduce the false
    // green (`yt-dlp --version` exits 0, the transcript pull still fails).
    const usable = (backend: BackendRow): boolean =>
        backend.status === 'ok' &&
        (backend.readiness === undefined || backend.readiness.status === 'ready');
    const active = backends.find(usable) ?? null;
    // With no healthy candidate the channel takes the FIRST candidate's
    // verdict — that is the one whose fix the operator is expected to run.
    const first = backends[0] as BackendRow;
    // `not-ready` = "installed and answering, but not confirmed able to satisfy
    // this channel". It covers BOTH readiness verdicts that are not `ready`:
    // `not-ready` (confirmed unusable) and `unknown` (not settled). One enum
    // value, because the distinction between them is already carried precisely
    // by `backends[].readiness.status` — and because reporting `ok` for an
    // unsettled readiness is exactly the false green this layer closes (see the
    // invariant block: an "installed, unverified" ceiling over a false green).
    const unready = backends.some(
        (backend) =>
            backend.status === 'ok' &&
            backend.readiness !== undefined &&
            backend.readiness.status !== 'ready',
    );
    const status: ChannelStatus =
        active !== null ? 'ok' : unready ? 'not-ready' : first.status;
    // Unchanged meaning: `fix` is the pinned INSTALL prescription. A readiness
    // remedy is a different kind of instruction (it edits an operator's config
    // rather than installing a pin) and lives in `backends[].readiness.fix`, so
    // one field never carries two meanings.
    const fix =
        active === null && (first.status === 'missing' || first.status === 'broken')
            ? first.fix
            : null;

    return {
        id,
        status,
        active_backend: active === null ? null : active.id,
        tier,
        lifecycle,
        last_verified: lastVerified,
        fix,
        warnings,
        credential,
        backends,
    };
}

export function errorRow(id: string, err: unknown): ChannelRow {
    // `sanitizeParseError`, not `String(err)`: this was the one error→output path
    // in the reach scripts that did not go through it, and a YAMLParseError
    // stringifies with the offending source line plus a caret — no error message
    // reaching this payload may carry a line of the registry it came from.
    const message = sanitizeParseError(err);
    return {
        id,
        status: 'error',
        active_backend: null,
        tier: '(unknown)',
        lifecycle: '(unknown)',
        last_verified: '(unknown)',
        fix: null,
        warnings: [`channel could not be read: ${message}`],
        credential: null,
        backends: [],
    };
}

/** Build the report payload. Throws only for the exit-2 class. */
export function collect(options: CollectOptions = {}): ReachDoctorPayload {
    const registryPath = path.resolve(options.registryPath ?? REGISTRY_PATH);
    const deep = options.deep ?? false;
    const now = options.now ?? new Date();

    // The CI refusal lives HERE, not only in the CLI: `collect` is exported and
    // takes `deep`, so an importer or a test calling `collect({ deep: true })`
    // would otherwise perform real network requests inside CI. `main()` keeps
    // its own check purely to phrase the operator-facing message.
    if (deep) {
        const ciMarker = detectCi();
        if (ciMarker !== null) {
            throw new ReachDoctorUsageError(
                `--deep performs real network requests and never runs in CI (${ciMarker} is set)`,
            );
        }
    }

    // Enforce the registry schema BEFORE anything is spawned. Without this the
    // `--registry <path>` flag was an arbitrary-execution primitive: an
    // operator-supplied file declaring `probe_cmd: sh` + `probe_args: ['-c',
    // '<payload>']` was loaded straight into `probeTool()` and executed, and
    // the report printed `✅ ok`. Any error-severity finding — including the
    // cross-field `probe_cmd-binding` rule — refuses the whole run (exit 2);
    // a report is not worth producing from a file we cannot vouch for.
    const findings = validate_file(registryPath).filter(
        (finding) => finding.severity === 'error',
    );
    if (findings.length > 0) {
        // Redacted like every other echo of registry content. This was the FOURTH
        // site of the same class and the last one found: the schema validator
        // quotes the offending value in its message, so composing this refusal
        // detail raw meant `--registry <any file>` printed that file's matching
        // values straight back — the exact oracle the other three sites had
        // already closed. Found by re-running the leak probe against EVERY entry
        // point rather than assuming that fixing three had fixed the class.
        const detail = findings
            .slice(0, 10)
            .map(
                (finding) =>
                    `${finding.path}: ${finding.rule}: ` +
                    `${excerpt_for_finding(finding.message, SCHEMA_MESSAGE_MAX_CHARS)}`,
            )
            .join('; ');
        const more = findings.length > 10 ? ` (+${findings.length - 10} more)` : '';
        throw new RegistryLoadError(
            `registry fails its schema, refusing to probe it: ${registryPath}: ` +
                `${findings.length} violation(s): ${detail}${more}`,
        );
    }

    const data = toRecord(load_registry(registryPath));
    if (data === null) {
        throw new RegistryLoadError(`registry is not a mapping: ${registryPath}`);
    }
    const channelsRaw = data['channels'];
    if (!Array.isArray(channelsRaw)) {
        throw new RegistryLoadError(`registry declares no channels list: ${registryPath}`);
    }

    let selected = channelsRaw;
    if (options.channel !== undefined) {
        const wanted = options.channel;
        selected = channelsRaw.filter((entry) => {
            const record = toRecord(entry);
            return record !== null && record['id'] === wanted;
        });
        if (selected.length === 0) {
            const known = channelsRaw
                .map((entry) => toRecord(entry)?.['id'])
                .filter((value): value is string => typeof value === 'string');
            throw new ReachDoctorUsageError(
                `unknown channel '${wanted}' — registry declares: ${known.join(', ')}`,
            );
        }
    }

    const channels: ChannelRow[] = [];
    for (const [index, raw] of selected.entries()) {
        // Attribution before parsing: an unreadable entry still gets a row.
        const declaredId = toRecord(raw)?.['id'];
        const label = typeof declaredId === 'string' && declaredId !== ''
            ? declaredId
            : `(channel #${index})`;
        try {
            channels.push(
                buildChannelRow(raw, {
                    deep,
                    now,
                    ...(options.readiness === undefined ? {} : { readiness: options.readiness }),
                }),
            );
        } catch (err) {
            channels.push(errorRow(label, err));
        }
    }

    const suggestions: string[] = [];
    if (deep) {
        const today = isoDate(now);
        for (const channel of channels) {
            const verified = channel.backends.filter((b) => b.deep?.status === 'ok');
            if (channel.status === 'ok' && verified.length > 0) {
                suggestions.push(
                    `channels[${channel.id}].last_verified: "${today}"  ` +
                        `(deep-verified: ${verified.map((b) => b.id).join(', ')})`,
                );
            }
        }
    }

    const rel = path.relative(ROOT, registryPath);
    return {
        schema_version: SCHEMA_VERSION,
        platform: process.platform,
        registry: rel !== '' && !rel.startsWith('..') ? rel : registryPath,
        deep,
        channels,
        last_verified_suggestions: suggestions,
    };
}

const STATUS_MARKER: Readonly<Record<ChannelStatus, string>> = {
    ok: '✅ ',
    missing: '❌ ',
    broken: '❌ ',
    timeout: '⚠️  ',
    error: '⚠️  ',
    removed: '·  ',
    // Distinct from `missing`'s ❌ on purpose: the binary IS installed, so the
    // operator's next action is a config/upgrade step, not an install.
    'not-ready': '⚠️  ',
};

export function renderTable(payload: ReachDoctorPayload): string {
    const lines: string[] = [];
    lines.push('Reach channels — read-only health report');
    lines.push('-'.repeat(72));
    lines.push(`registry:  ${payload.registry}`);
    lines.push(`platform:  ${payload.platform}`);
    lines.push(
        `mode:      ${payload.deep ? 'deep (one real network request per declared backend)' : 'shallow (local probes only, no network)'}`,
    );
    lines.push('');
    lines.push('Not a routing table: no channel below is routed, preferred, or');
    lines.push('suggested to an agent (Phase 0 benchmark band: stop).');
    lines.push('');
    for (const channel of payload.channels) {
        lines.push(
            `${STATUS_MARKER[channel.status]}${channel.id.padEnd(14)} ${channel.status.padEnd(8)} ` +
                `backend ${(channel.active_backend ?? '—').padEnd(8)} ` +
                `tier ${channel.tier.padEnd(11)} ${channel.lifecycle.padEnd(12)} ` +
                `verified ${channel.last_verified}`,
        );
        for (const backend of channel.backends) {
            const mark = backend.status === 'ok' ? '✅' : '❌';
            lines.push(`    ${mark} ${backend.id.padEnd(10)} ${backend.diagnostic}`);
            if (backend.deep !== null) {
                lines.push(`       deep: ${backend.deep.status} — ${backend.deep.detail}`);
            }
            // Rendered for BOTH the ready and the not-ready case: an operator
            // reading "installed" needs to see that the second question was
            // asked at all, otherwise a silent pass is indistinguishable from
            // a check that never ran.
            if (backend.readiness !== undefined) {
                const readiness = backend.readiness;
                lines.push(
                    `       readiness (${readiness.kind}): ${readiness.status} — ${readiness.detail}`,
                );
                lines.push(
                    `       readiness config: ${readiness.config_path} ` +
                        `(${readiness.config_present ? 'present' : 'not a readable file'}, ` +
                        `${JS_RUNTIME_FLAG}: ${readiness.config_flag ? 'yes' : 'no'}) · ` +
                        `runtimes on PATH: ${readiness.runtimes.length === 0 ? 'none' : readiness.runtimes.join(', ')} · ` +
                        // `null` covers both "never probed" and "unparseable",
                        // so the label claims neither — `detail` says which.
                        `version: ${readiness.version ?? 'not confirmed'}`,
                );
                if (readiness.fix !== null) {
                    lines.push(`       readiness fix (${payload.platform}): ${readiness.fix}`);
                }
            }
        }
        if (channel.fix !== null) {
            lines.push(`    fix (${payload.platform}): ${channel.fix}`);
        }
        if (channel.credential !== null) {
            const cred = channel.credential;
            const state = !cred.checked
                ? 'not checked on this platform'
                : !cred.present
                  ? 'declared but not present'
                  : `mode ${cred.mode ?? '?'}`;
            lines.push(`    credential: ${cred.path} (${state})`);
        }
        for (const warning of channel.warnings) {
            lines.push(`    ⚠️  ${warning}`);
        }
    }
    if (payload.last_verified_suggestions.length > 0) {
        lines.push('');
        lines.push('last_verified lines you MAY commit (nothing was written):');
        lines.push('-'.repeat(72));
        for (const suggestion of payload.last_verified_suggestions) {
            lines.push(`  ${suggestion}`);
        }
    }
    return lines.join('\n');
}

/**
 * `--strict` fails on any **admitted** channel that is not `ok`. A `removed`
 * channel is not admitted — its migration window closed, so it is excluded by
 * design rather than treated as a failure.
 *
 * A credential-permission warning does NOT change the exit code: the flag's
 * contract is "non-zero when a channel is not ok", and widening it silently
 * would make `--strict` mean something the roadmap never specified. The
 * warning is surfaced in both output formats instead.
 */
export function finalExitCode(payload: ReachDoctorPayload, strict: boolean): number {
    if (!strict) return 0;
    const failing = payload.channels.filter(
        (channel) => channel.status !== 'ok' && channel.status !== 'removed',
    );
    return failing.length > 0 ? 1 : 0;
}

const USAGE = `reach:doctor — read-only health report over the reach channel registry

Answers two operator questions per channel: is the upstream backend I already
chose to install healthy and pinned — and, where the backend declares a
readiness requirement, is it actually able to retrieve, or merely installed?
A channel reported not-ready is installed and answering its probe while a
config-semantic requirement is unsatisfied or unconfirmed; the remedy is
printed, never run. It is NOT a router and NOT an agent-facing
recommendation — no channel it prints is routed, preferred, or suggested to
an agent.

Usage:
  agent-config reach:doctor [options]

Options:
  --format json|table   Output shape (default: table). JSON validates against
                        src/scripts/schemas/reach-doctor-payload.schema.json.
  --strict              Exit 1 when any admitted channel is not ok (for CI).
  --channel <id>        Report a single channel.
  --registry <path>     Read an alternate registry file. It is validated
                        against reach-channels.schema.json first (plus
                        probe_cmd === id); any violation refuses the run with
                        exit 2 rather than probing an unvouched-for file.
  --deep                ⚠️  NETWORK. Opt-in only. Sends ONE real, read-only
                        request per backend that declares a deep probe (a
                        rate-limit read, or a HEAD to example.com) to confirm
                        the backend really reaches its endpoint. Refuses to
                        run in CI. Writes NOTHING: it prints the
                        last_verified lines you may choose to commit.
                        WHAT YOU ARE CONSENTING TO: a backend's own rate-limit
                        read authenticates with whatever credential that tool
                        already holds, so running --deep presents your existing
                        token to that third party and appears in their logs.
                        Nothing new is stored and no credential is read by this
                        command — but the request is made on your behalf, which
                        is why it is opt-in and never automatic.
  --help                Show this help.

Without --deep the command touches no network at all: the only child
processes are the registry's side-effect-free local probes. It never installs
anything and never writes a file, in either mode.

Exit codes: 0 ok · 1 --strict violation · 2 usage / unusable or schema-invalid
registry / --deep inside CI.`;

interface ParsedArgs {
    format: 'table' | 'json';
    strict: boolean;
    deep: boolean;
    help: boolean;
    channel: string | undefined;
    registry: string | undefined;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
    const parsed: ParsedArgs = {
        format: 'table',
        strict: false,
        deep: false,
        help: false,
        channel: undefined,
        registry: undefined,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--format') {
            const value = argv[index + 1];
            if (value !== 'json' && value !== 'table') {
                throw new ReachDoctorUsageError('--format expects json|table');
            }
            parsed.format = value;
            index += 1;
        } else if (arg === '--channel') {
            const value = argv[index + 1];
            if (value === undefined || value.startsWith('-')) {
                throw new ReachDoctorUsageError('--channel expects a channel id');
            }
            parsed.channel = value;
            index += 1;
        } else if (arg === '--registry') {
            const value = argv[index + 1];
            if (value === undefined || value.startsWith('-')) {
                throw new ReachDoctorUsageError('--registry expects a path');
            }
            parsed.registry = value;
            index += 1;
        } else if (arg === '--strict') {
            parsed.strict = true;
        } else if (arg === '--deep') {
            parsed.deep = true;
        } else if (arg === '--help' || arg === '-h') {
            parsed.help = true;
        } else {
            throw new ReachDoctorUsageError(`unknown argument '${String(arg)}'`);
        }
    }
    return parsed;
}

/** CI markers that make `--deep` refuse: network in CI is never wanted here. */
export function detectCi(env: NodeJS.ProcessEnv = process.env): string | null {
    for (const key of ['CI', 'GITHUB_ACTIONS', 'AGENT_CONFIG_CI']) {
        const value = env[key];
        if (value !== undefined && value !== '' && value !== '0' && value !== 'false') {
            return key;
        }
    }
    return null;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let args: ParsedArgs;
    try {
        args = parseArgs(argv);
    } catch (err) {
        process.stderr.write(`reach_doctor: ${(err as Error).message}\n\n${USAGE}\n`);
        return 2;
    }
    if (args.help) {
        process.stdout.write(`${USAGE}\n`);
        return 0;
    }
    if (args.deep) {
        const ciMarker = detectCi();
        if (ciMarker !== null) {
            process.stderr.write(
                `reach_doctor: --deep performs real network requests and never runs in CI ` +
                    `(${ciMarker} is set). Run it locally, as an operator.\n`,
            );
            return 2;
        }
    }

    let payload: ReachDoctorPayload;
    try {
        payload = collect({
            deep: args.deep,
            ...(args.channel === undefined ? {} : { channel: args.channel }),
            ...(args.registry === undefined ? {} : { registryPath: args.registry }),
        });
    } catch (err) {
        if (err instanceof RegistryLoadError || err instanceof ReachDoctorUsageError) {
            process.stderr.write(`reach_doctor: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    if (args.format === 'json') {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
        process.stdout.write(`${renderTable(payload)}\n`);
    }
    return finalExitCode(payload, args.strict);
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation makes the raw URLs differ (import.meta.url is the
    // resolved real path while argv[1] keeps the symlink path) — compare
    // realpaths so the CLI still fires when run through a projection symlink.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
