#!/usr/bin/env tsx
/**
 * reach:doctor — read-only health report over the reach channel registry
 * (road-to-internet-reach Phase 2, steps 4-7; `--deep` from Phase 7 step 4).
 *
 * WHAT THIS ANSWERS. One operator question, nothing more: *is the upstream
 * tool I already chose to install healthy, and is its install command
 * pinned?* Per channel it reports the health of the ordered backend
 * candidates, which one is currently active, and — when the first candidate
 * is `missing` or `broken` — the exact pinned command **a human** runs for
 * the current platform, echoed verbatim from `src/config/reach-channels.yml`.
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
    load_registry,
    sanitizeParseError,
    validate_file,
} from './check_reach_channels.js';

const _HERE = fileURLToPath(import.meta.url);
/** Repo root — two dirs up from src/scripts, mirroring the sibling scripts. */
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Payload format version. Bumped only on a breaking payload shape change. */
export const SCHEMA_VERSION = 1;

/** `removed` extends the probe taxonomy: past `removal_after`, never probed. */
export type ChannelStatus = ToolProbeStatus | 'removed';

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
    options: { deep: boolean; now: Date },
): ChannelRow {
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

        backends.push({
            id: backendId,
            probe_cmd: probeCmd,
            status: probed.status,
            path: probed.path,
            exit_code: probed.exit_code,
            diagnostic: probed.diagnostic,
            fix: probed.fix,
            deep: options.deep ? runDeepProbe(probeCmd, probed.status) : null,
        });
    }

    // Backend order is the switch: the first candidate that probes ok wins.
    const active = backends.find((backend) => backend.status === 'ok') ?? null;
    // With no healthy candidate the channel takes the FIRST candidate's
    // verdict — that is the one whose fix the operator is expected to run.
    const first = backends[0] as BackendRow;
    const status: ChannelStatus = active !== null ? 'ok' : first.status;
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
        const detail = findings
            .slice(0, 10)
            .map((finding) => `${finding.path}: ${finding.rule}: ${finding.message}`)
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
            channels.push(buildChannelRow(raw, { deep, now }));
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

Answers one operator question per channel: is the upstream backend I already
chose to install healthy, and is its install command pinned? It is NOT a
router and NOT an agent-facing recommendation — no channel it prints is
routed, preferred, or suggested to an agent.

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
