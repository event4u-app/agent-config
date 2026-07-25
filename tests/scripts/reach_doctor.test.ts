/**
 * reach:doctor behaviour matrix (road-to-internet-reach Phase 2, steps 4-6;
 * the credential case is Phase 5 step 2, which survives the `band: stop`
 * verdict because it depends on no skill).
 *
 * Every case is driven by a REAL registry file in a real temp dir and REAL
 * binaries on PATH — nothing mocks `node:child_process`, the probe layer, or
 * the filesystem. The schema case validates the ACTUAL `--format json` bytes
 * the CLI emits, so "the JSON is clean" is falsifiable rather than asserted.
 *
 * Fixtures live in `os.tmpdir()` on purpose: this suite must not create a
 * single file inside the repo, or the read-only witness test next door would
 * be measuring the test harness instead of the command.
 *
 * Every fixture backend declares `id` == `probe_cmd`, because that binding is
 * now enforced: `collect()` validates its registry (including one supplied via
 * `--registry`) before spawning anything, so a fixture that mislabelled the
 * executed binary would be refused rather than probed. The per-channel
 * isolation layer that used to be reached through malformed registries is
 * therefore exercised directly against `buildChannelRow` / `errorRow` below.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
    JS_RUNTIME_FLAG,
    READINESS_CONFIG_MAX_BYTES,
    assessJsRuntimeReadiness,
    buildChannelRow,
    collect,
    confineCredentialPath,
    errorRow,
    finalExitCode,
    jsRuntimeFixCommand,
    liveReadinessRow,
    main,
    parseYtDlpVersion,
    probeJsRuntimes,
    readConfigFlag,
    renderTable,
    resolveYtDlpConfigPath,
    runDeepProbe,
    type BackendRow,
    type ReachDoctorPayload,
    type ReadinessRow,
} from '../../src/scripts/reach_doctor.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA_PATH = path.join(
    REPO,
    'src',
    'scripts',
    'schemas',
    'reach-doctor-payload.schema.json',
);
const DOCTOR = path.join(REPO, 'src', 'scripts', 'reach_doctor.ts');
const TSX_CLI = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');

/** POSIX mode bits carry no meaning on win32 — that case is skipped, not re-read. */
const POSIX = process.platform !== 'win32';

/** A binary guaranteed present: the test itself is running under it. */
const PRESENT_CMD = 'node';
/** A binary guaranteed absent — no package of this name exists anywhere. */
const ABSENT_CMD = 'agent-config-absent-reach-backend-xyz';

let TMP = '';

function makeValidator(): (data: unknown) => boolean {
    const ajv = new Ajv({ allErrors: true });
    const schema: unknown = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
    const validate = ajv.compile(schema as object);
    return (data: unknown) => {
        const ok = validate(data) as boolean;
        if (!ok) {
            throw new Error(`payload failed schema: ${JSON.stringify(validate.errors)}`);
        }
        return ok;
    };
}

/** Write a registry fixture and return its path. */
function registry(name: string, body: string): string {
    const target = path.join(TMP, `${name}.yml`);
    fs.writeFileSync(target, body, 'utf-8');
    return target;
}

/** Run `main()` in-process with stdout/stderr muted; returns the exit code. */
function runMain(argv: string[]): number {
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
        return main(argv);
    } finally {
        out.mockRestore();
        err.mockRestore();
    }
}

const OK_CHANNEL = `  - id: healthy
    description: A channel whose first candidate is present on this machine.
    tier: zero-config
    lifecycle: stable
    override_key: reach.channels.healthy.backend
    last_verified: "2026-07-24"
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`;

beforeAll(() => {
    TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-doctor-'));
});

afterAll(() => {
    if (TMP !== '') fs.rmSync(TMP, { recursive: true, force: true });
});

describe('reach:doctor — JSON payload contract', () => {
    it('GIVEN the shipped registry WHEN the CLI emits --format json THEN the real bytes parse AND validate against reach-doctor-payload.schema.json', () => {
        expect(fs.existsSync(TSX_CLI)).toBe(true);
        const run = spawnSync(process.execPath, [TSX_CLI, DOCTOR, '--format', 'json'], {
            cwd: REPO,
            encoding: 'utf-8',
        });

        expect(run.error).toBeUndefined();
        // Exit 0 without --strict even though a backend is missing on this box.
        expect(run.status).toBe(0);
        const payload: unknown = JSON.parse(run.stdout);
        expect(makeValidator()(payload)).toBe(true);

        const typed = payload as ReachDoctorPayload;
        expect(typed.schema_version).toBe(1);
        expect(typed.platform).toBe(process.platform);
        expect(typed.deep).toBe(false);
        // No network happened, so nothing may be suggested for commit.
        expect(typed.last_verified_suggestions).toEqual([]);
        expect(typed.channels.length).toBeGreaterThan(0);
    });

    it('GIVEN a fixture exercising every row shape WHEN collected THEN the payload still validates (removed / error / credential rows included)', () => {
        const credential = path.join(TMP, 'shapes-token');
        fs.writeFileSync(credential, 'not-a-real-secret\n', 'utf-8');
        if (POSIX) fs.chmodSync(credential, 0o600);
        const file = registry(
            'shapes',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}  - id: absent
    description: A channel whose only candidate is not installed.
    tier: zero-config
    lifecycle: deprecated
    override_key: reach.channels.absent.backend
    last_verified: "2026-07-24"
    replacement: healthy
    credential_path: ${credential}
    backends:
      - id: ${ABSENT_CMD}
        probe_cmd: ${ABSENT_CMD}
        probe_args: ["--version"]
        install:
          default: pipx install fixture-tool==1.2.3
  - id: expired
    description: A channel whose migration window closed long ago.
    tier: zero-config
    lifecycle: deprecated
    override_key: reach.channels.expired.backend
    last_verified: "2020-01-01"
    removal_after: "2020-06-01"
    backends:
      - id: ${ABSENT_CMD}
        probe_cmd: ${ABSENT_CMD}
        probe_args: ["--version"]
        install:
          default: pipx install fixture-tool==1.2.3
`,
        );

        const payload = collect({ registryPath: file });
        // The `error` row can no longer come from a malformed registry (the
        // schema gate refuses the file), so it is appended from the isolation
        // helper that still produces it — the shape under test is the payload's.
        payload.channels.push(errorRow('malformed', new Error('channel could not be read')));
        // Round-trip through JSON: the schema describes the serialised bytes.
        const serialised: unknown = JSON.parse(JSON.stringify(payload));
        expect(makeValidator()(serialised)).toBe(true);
        expect(payload.channels.map((channel) => channel.status)).toEqual([
            'ok',
            'missing',
            'removed',
            'error',
        ]);
    });
});

describe('reach:doctor — missing backend and the pinned fix', () => {
    it('GIVEN a channel whose backend is absent WHEN collected THEN status is missing AND the platform-correct pinned fix is in the payload', () => {
        const platformFix = 'pipx install fixture-tool==9.9.9-thisplatform';
        const defaultFix = 'pipx install fixture-tool==1.1.1-default';
        const file = registry(
            'missing',
            `schema_version: reach-channels-v1
channels:
  - id: absent
    description: A channel whose only candidate is not installed.
    tier: zero-config
    lifecycle: experimental
    override_key: reach.channels.absent.backend
    last_verified: "2026-07-24"
    backends:
      - id: ${ABSENT_CMD}
        probe_cmd: ${ABSENT_CMD}
        probe_args: ["--version"]
        install:
          ${process.platform}: ${platformFix}
          default: ${defaultFix}
`,
        );

        const payload = collect({ registryPath: file });
        const channel = payload.channels[0];

        expect(channel?.status).toBe('missing');
        expect(channel?.active_backend).toBeNull();
        // The CURRENT platform's string wins over `default`, verbatim.
        expect(channel?.fix).toBe(platformFix);
        expect(channel?.backends[0]?.fix).toBe(platformFix);
        expect(channel?.backends[0]?.diagnostic).toContain('does not resolve on PATH');
    });

    it('GIVEN only a default prescription WHEN the platform has no entry THEN the default string is echoed rather than invented', () => {
        const file = registry(
            'missing-default-only',
            `schema_version: reach-channels-v1
channels:
  - id: absent
    description: A channel whose only candidate is not installed.
    tier: zero-config
    lifecycle: experimental
    override_key: reach.channels.absent.backend
    last_verified: "2026-07-24"
    backends:
      - id: ${ABSENT_CMD}
        probe_cmd: ${ABSENT_CMD}
        probe_args: ["--version"]
        install:
          default: pipx install fixture-tool==2.0.0
`,
        );

        expect(collect({ registryPath: file }).channels[0]?.fix).toBe(
            'pipx install fixture-tool==2.0.0',
        );
    });

    it('GIVEN a channel whose FIRST candidate is absent but a later one is healthy THEN the healthy candidate is active and no fix is prescribed', () => {
        const file = registry(
            'fallback',
            `schema_version: reach-channels-v1
channels:
  - id: ordered
    description: Two independent candidates; the first is not installed.
    tier: zero-config
    lifecycle: stable
    override_key: reach.channels.ordered.backend
    last_verified: "2026-07-24"
    backends:
      - id: ${ABSENT_CMD}
        probe_cmd: ${ABSENT_CMD}
        probe_args: ["--version"]
        install:
          default: pipx install fixture-tool==1.2.3
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );

        const channel = collect({ registryPath: file }).channels[0];
        expect(channel?.status).toBe('ok');
        expect(channel?.active_backend).toBe(PRESENT_CMD);
        expect(channel?.fix).toBeNull();
    });
});

describe('reach:doctor — a malformed registry is refused, not partially probed', () => {
    // The schema gate in `collect()` runs BEFORE any child process, so a file
    // with a malformed channel is now refused wholesale (exit 2) instead of
    // being probed with one `error` row. That is the security trade: a registry
    // we cannot vouch for is not worth a report, because its `probe_cmd` /
    // `probe_args` are about to become a child process.
    it('GIVEN one unreadable channel among healthy ones WHEN collected THEN the whole run refuses and names the violation', () => {
        const file = registry(
            'isolation',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}  - id: malformed
    description: backends is a scalar, so this channel cannot be read.
    tier: zero-config
    lifecycle: stable
    override_key: reach.channels.malformed.backend
    last_verified: "2026-07-24"
    backends: not-a-list
  - id: second-healthy
    description: A channel after the malformed one, which must still appear.
    tier: zero-config
    lifecycle: stable
    override_key: reach.channels.second-healthy.backend
    last_verified: "2026-07-24"
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );

        expect(() => collect({ registryPath: file })).toThrow(/refusing to probe it/);
        expect(() => collect({ registryPath: file })).toThrow(
            /\$\.channels\[1\]\.backends: type/,
        );
        expect(runMain(['--registry', file])).toBe(2);
    });

    it('GIVEN a channel entry with no id at all THEN the run refuses rather than reporting it by index', () => {
        const file = registry(
            'anonymous',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}  - description: no id, so this entry cannot be named.
    tier: zero-config
    lifecycle: stable
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );

        expect(() => collect({ registryPath: file })).toThrow(/refusing to probe it/);
        expect(runMain(['--registry', file])).toBe(2);
    });

    // The isolation layer itself still exists as defense in depth — reached
    // directly, since no registry can get past the gate to reach it.
    it('buildChannelRow still throws per channel, and errorRow turns that into one attributed row', () => {
        const shapes: [string, unknown, RegExp][] = [
            ['not a mapping', 'scalar', /not a mapping/],
            ['no id', { backends: [] }, /carries no id/],
            ['backends not a list', { id: 'x', backends: 'nope' }, /non-empty list/],
            ['backend not a mapping', { id: 'x', backends: ['scalar'] }, /not a mapping/],
            [
                'backend without probe_cmd',
                { id: 'x', backends: [{ id: 'gh' }] },
                /needs id \+ probe_cmd/,
            ],
        ];
        for (const [label, raw, expected] of shapes) {
            expect(
                () => buildChannelRow(raw, { deep: false, now: new Date() }),
                label,
            ).toThrow(expected);
        }

        const row = errorRow('(channel #7)', new Error('backends must be a non-empty list'));
        expect(row.status).toBe('error');
        expect(row.id).toBe('(channel #7)');
        expect(row.backends).toEqual([]);
        expect(row.warnings.join(' ')).toContain('backends must be a non-empty list');
    });

    it('buildChannelRow refuses a backend whose probe_cmd is not its own id — a healthy row may never name a different binary', () => {
        expect(() =>
            buildChannelRow(
                {
                    id: 'github',
                    backends: [
                        { id: 'gh', probe_cmd: 'sh', probe_args: ['--version'], install: {} },
                    ],
                },
                { deep: false, now: new Date() },
            ),
        ).toThrow(/may only probe its own id/);
    });
});

describe('reach:doctor — --strict exit contract', () => {
    it('GIVEN every channel ok WHEN --strict runs THEN the exit code is 0', () => {
        const file = registry(
            'strict-clean',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}`,
        );

        expect(runMain(['--strict', '--registry', file])).toBe(0);
        expect(runMain(['--registry', file])).toBe(0);
    });

    it('GIVEN a channel that is not ok WHEN --strict runs THEN the exit code is 1, while the same run without --strict is 0', () => {
        const file = registry(
            'strict-dirty',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}  - id: absent
    description: A channel whose only candidate is not installed.
    tier: zero-config
    lifecycle: experimental
    override_key: reach.channels.absent.backend
    last_verified: "2026-07-24"
    backends:
      - id: ${ABSENT_CMD}
        probe_cmd: ${ABSENT_CMD}
        probe_args: ["--version"]
        install:
          default: pipx install fixture-tool==1.2.3
`,
        );

        expect(runMain(['--strict', '--registry', file])).toBe(1);
        expect(runMain(['--registry', file])).toBe(0);
    });

    it('GIVEN a removed channel as the only defect WHEN --strict runs THEN the exit code is 0 — a closed migration window is not a failure', () => {
        const file = registry(
            'strict-removed',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}  - id: expired
    description: A channel whose migration window closed long ago.
    tier: zero-config
    lifecycle: deprecated
    override_key: reach.channels.expired.backend
    last_verified: "2020-01-01"
    removal_after: "2020-06-01"
    backends:
      - id: ${ABSENT_CMD}
        probe_cmd: ${ABSENT_CMD}
        probe_args: ["--version"]
        install:
          default: pipx install fixture-tool==1.2.3
`,
        );

        expect(runMain(['--strict', '--registry', file])).toBe(0);
    });

    it('GIVEN an unknown --channel or a bad flag THEN the exit code is 2 (usage), never a silently empty report', () => {
        const file = registry(
            'usage',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}`,
        );

        expect(runMain(['--channel', 'no-such-channel', '--registry', file])).toBe(2);
        expect(runMain(['--format', 'yaml', '--registry', file])).toBe(2);
        expect(runMain(['--registry', path.join(TMP, 'does-not-exist.yml')])).toBe(2);
    });

    it('GIVEN --channel with a real id THEN only that channel is reported', () => {
        const file = registry(
            'filter',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}  - id: second-healthy
    description: A second channel that must be filtered out.
    tier: zero-config
    lifecycle: stable
    override_key: reach.channels.second-healthy.backend
    last_verified: "2026-07-24"
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );

        const payload = collect({ registryPath: file, channel: 'second-healthy' });
        expect(payload.channels.map((channel) => channel.id)).toEqual(['second-healthy']);
    });

    it('finalExitCode is a pure function of the payload + the flag', () => {
        const payload = collect({
            registryPath: registry(
                'pure',
                `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}`,
            ),
        });
        expect(finalExitCode(payload, false)).toBe(0);
        expect(finalExitCode(payload, true)).toBe(0);
    });
});

describe('reach:doctor — lifecycle handling', () => {
    it('GIVEN a deprecated channel still inside its window WHEN collected THEN a deprecation warning is emitted AND the backend is still probed', () => {
        const file = registry(
            'deprecated',
            `schema_version: reach-channels-v1
channels:
  - id: sunsetting
    description: Deprecated but still inside its migration window.
    tier: zero-config
    lifecycle: deprecated
    override_key: reach.channels.sunsetting.backend
    last_verified: "2026-07-24"
    removal_after: "2099-01-01"
    replacement: healthy
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );

        const channel = collect({ registryPath: file }).channels[0];

        expect(channel?.status).toBe('ok');
        // Probed, not skipped: a real result is present.
        expect(channel?.backends).toHaveLength(1);
        expect(channel?.backends[0]?.status).toBe('ok');
        expect(channel?.warnings.join(' ')).toContain('deprecated');
        expect(channel?.warnings.join(' ')).toContain("superseded by channel 'healthy'");
    });

    it('GIVEN a channel past removal_after WHEN collected THEN the probe is SKIPPED, the channel is removed, and the replacement is named', () => {
        const file = registry(
            'removed',
            `schema_version: reach-channels-v1
channels:
  - id: expired
    description: Its migration window closed; nothing should be probed.
    tier: zero-config
    lifecycle: deprecated
    override_key: reach.channels.expired.backend
    last_verified: "2020-01-01"
    removal_after: "2020-06-01"
    replacement: healthy
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );

        const channel = collect({ registryPath: file }).channels[0];

        expect(channel?.status).toBe('removed');
        // The proof the probe never ran: a healthy binary produced no row.
        expect(channel?.backends).toEqual([]);
        expect(channel?.active_backend).toBeNull();
        expect(channel?.warnings.join(' ')).toContain('past removal_after 2020-06-01');
        expect(channel?.warnings.join(' ')).toContain("superseded by channel 'healthy'");
    });

    it('GIVEN removal_after in the future WHEN the clock is moved past it THEN the same channel flips to removed', () => {
        const file = registry(
            'clock',
            `schema_version: reach-channels-v1
channels:
  - id: sunsetting
    description: Deprecated but still inside its migration window.
    tier: zero-config
    lifecycle: deprecated
    override_key: reach.channels.sunsetting.backend
    last_verified: "2026-07-24"
    removal_after: "2099-01-01"
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );

        expect(collect({ registryPath: file }).channels[0]?.status).toBe('ok');
        expect(
            collect({ registryPath: file, now: new Date('2099-06-01T12:00:00Z') }).channels[0]
                ?.status,
        ).toBe('removed');
    });
});

describe.skipIf(!POSIX)('reach:doctor — credential permission check', () => {
    function withCredential(name: string, mode: number): ReachDoctorPayload {
        const credential = path.join(TMP, `${name}-token`);
        fs.writeFileSync(credential, 'not-a-real-secret\n', 'utf-8');
        fs.chmodSync(credential, mode);
        const file = registry(
            name,
            `schema_version: reach-channels-v1
channels:
  - id: credentialed
    description: A channel that declares a credential file path.
    tier: login
    lifecycle: stable
    override_key: reach.channels.credentialed.backend
    last_verified: "2026-07-24"
    credential_path: ${credential}
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );
        return collect({ registryPath: file });
    }

    it('GIVEN a 0644 credential file WHEN collected THEN a permission warning fires with the mode and the chmod fix, and never the contents', () => {
        const channel = withCredential('cred-0644', 0o644).channels[0];

        expect(channel?.credential?.group_or_world_readable).toBe(true);
        expect(channel?.credential?.mode).toBe('0644');
        expect(channel?.credential?.present).toBe(true);
        const warning = channel?.warnings.join(' ') ?? '';
        expect(warning).toContain('group- or world-readable');
        expect(warning).toContain('chmod 600');
        // The secret never appears — not verbatim, and not as a digest.
        expect(JSON.stringify(channel)).not.toContain('not-a-real-secret');
    });

    it('GIVEN a 0600 credential file WHEN collected THEN no permission warning fires', () => {
        const channel = withCredential('cred-0600', 0o600).channels[0];

        expect(channel?.credential?.group_or_world_readable).toBe(false);
        expect(channel?.credential?.mode).toBe('0600');
        expect(channel?.warnings).toEqual([]);
    });

    it('GIVEN a group-readable (0640) credential file THEN the warning still fires — group counts, not just world', () => {
        const channel = withCredential('cred-0640', 0o640).channels[0];

        expect(channel?.credential?.group_or_world_readable).toBe(true);
        expect(channel?.credential?.mode).toBe('0640');
    });

    it('GIVEN a declared credential path that does not exist THEN it is reported absent without a permission warning', () => {
        const missing = path.join(TMP, 'no-such-token');
        const file = registry(
            'cred-absent',
            `schema_version: reach-channels-v1
channels:
  - id: credentialed
    description: A channel declaring a credential file that is not there.
    tier: login
    lifecycle: stable
    override_key: reach.channels.credentialed.backend
    last_verified: "2026-07-24"
    credential_path: ${missing}
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );

        const channel = collect({ registryPath: file }).channels[0];
        expect(channel?.credential?.present).toBe(false);
        expect(channel?.credential?.group_or_world_readable).toBe(false);
        expect(channel?.warnings).toEqual([]);
    });

    it('GIVEN the shipped registry THEN no channel declares a credential path (the check is inert there, by design)', () => {
        const payload = collect();
        expect(payload.channels.every((channel) => channel.credential === null)).toBe(true);
    });
});

/**
 * The registry is UNTRUSTED input, so `credential_path` was an arbitrary-path
 * primitive until it was bounded. Reproduced before it was believed: a
 * `--registry` file declaring `credential_path: ../../../../../../../etc/passwd`
 * made the doctor `stat` that path and report, inside a normal-looking health row
 * at exit 0,
 * `{"path":"/etc/passwd","present":true,"mode":"0644","group_or_world_readable":true,"checked":true}`
 * — an existence-and-permission oracle over the whole filesystem wearing the
 * costume of a credential warning.
 *
 * These cases drive the REAL CLI (`--registry <fixture> --format json`), because
 * the bytes an operator — or a CI job, or an agent surface with a path parameter —
 * actually receives are what has to be free of it. The refusal is asserted as a
 * SHAPE (`checked: false` plus a named warning), never as silence: an operator
 * whose credential really does live outside the roots must be able to tell an
 * unevaluated check from a passing one.
 *
 * POSIX-gated for the same reason the permission block above is: the mode bits the
 * legitimate cases assert do not exist on win32, and `buildChannelRow` withholds
 * the refusal warning there because the whole check is already reported as skipped.
 */
describe.skipIf(!POSIX)('reach:doctor — credential_path confinement (the arbitrary-path oracle is refused)', () => {
    /** Substring of the refusal warning — the operator-facing half of the fix. */
    const REFUSED = 'outside the permitted roots';
    /** The exact string from the reported exploit, kept verbatim as the repro. */
    const TRAVERSAL = '../../../../../../../etc/passwd';

    function confinementRegistry(name: string, declared: string): string {
        return registry(
            name,
            `schema_version: reach-channels-v1
channels:
  - id: credentialed
    description: A channel that declares a credential file path.
    tier: login
    lifecycle: stable
    override_key: reach.channels.credentialed.backend
    last_verified: "2026-07-24"
    credential_path: ${declared}
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );
    }

    /**
     * Real CLI, real registry file, real stdout bytes. `cwd` is the repo, so a
     * relative `credential_path` resolves exactly as it did in the report.
     */
    function runCliJson(
        name: string,
        declared: string,
    ): { status: number | null; payload: ReachDoctorPayload } {
        const file = confinementRegistry(name, declared);
        const run = spawnSync(
            process.execPath,
            [TSX_CLI, DOCTOR, '--registry', file, '--format', 'json'],
            { cwd: REPO, encoding: 'utf-8' },
        );
        expect(run.error).toBeUndefined();
        return { status: run.status, payload: JSON.parse(run.stdout) as ReachDoctorPayload };
    }

    it('GIVEN a ../.. traversal to /etc/passwd THEN nothing is stat`ed — present/mode/checked all report the refusal, a warning names it, and the payload still validates', () => {
        // Premise of the repro, asserted rather than assumed: from this checkout the
        // fixture really does land outside the permitted roots.
        const escaped = path.resolve(REPO, TRAVERSAL);
        expect(confineCredentialPath(escaped)).toBe(false);

        const { status, payload } = runCliJson('confine-traversal', TRAVERSAL);
        // A credential finding never changes the exit code — the oracle hid at 0.
        expect(status).toBe(0);
        const channel = payload.channels[0];
        const cred = channel?.credential;

        expect(cred?.path).toBe(escaped);
        // `present: false` for a file that DOES exist: existence never leaked.
        expect(cred?.present).toBe(false);
        expect(cred?.mode).toBeNull();
        expect(cred?.group_or_world_readable).toBe(false);
        expect(cred?.checked).toBe(false);
        expect(channel?.warnings.join(' ')).toContain(REFUSED);

        // The refusal shape is not a schema escape hatch either.
        expect(makeValidator()(payload)).toBe(true);
    });

    it('GIVEN an absolute out-of-bounds path (/etc/passwd, no traversal needed) THEN the same refusal shape and warning', () => {
        const { status, payload } = runCliJson('confine-absolute', '/etc/passwd');
        expect(status).toBe(0);
        const channel = payload.channels[0];
        const cred = channel?.credential;

        expect(cred?.path).toBe(path.resolve(path.sep, 'etc', 'passwd'));
        expect(cred?.present).toBe(false);
        expect(cred?.mode).toBeNull();
        expect(cred?.group_or_world_readable).toBe(false);
        expect(cred?.checked).toBe(false);
        expect(channel?.warnings.join(' ')).toContain(REFUSED);
    });

    it('GIVEN a symlink INSIDE the temp root pointing at /etc/passwd THEN it is refused — the realpath check, which a prefix test alone would miss', () => {
        const link = path.join(TMP, 'confine-symlink-token');
        fs.symlinkSync(path.resolve(path.sep, 'etc', 'passwd'), link);
        // What makes this case load-bearing: the DECLARED path is genuinely inside a
        // permitted root, so only resolving the target can catch the escape.
        expect(link.startsWith(`${path.resolve(TMP)}${path.sep}`)).toBe(true);

        const { status, payload } = runCliJson('confine-symlink', link);
        expect(status).toBe(0);
        const channel = payload.channels[0];
        const cred = channel?.credential;

        expect(cred?.path).toBe(link);
        expect(cred?.present).toBe(false);
        expect(cred?.mode).toBeNull();
        expect(cred?.group_or_world_readable).toBe(false);
        expect(cred?.checked).toBe(false);
        expect(channel?.warnings.join(' ')).toContain(REFUSED);
    });

    it('GIVEN a legitimate 0644 file inside the temp root THEN the check RUNS and the original chmod-600 finding still fires (the bound did not silence it)', () => {
        const credential = path.join(TMP, 'confine-inbounds-0644-token');
        fs.writeFileSync(credential, 'not-a-real-secret\n', 'utf-8');
        fs.chmodSync(credential, 0o644);

        const { status, payload } = runCliJson('confine-inbounds-0644', credential);
        expect(status).toBe(0);
        const channel = payload.channels[0];
        const cred = channel?.credential;

        expect(cred?.checked).toBe(true);
        expect(cred?.present).toBe(true);
        expect(cred?.mode).toBe('0644');
        expect(cred?.group_or_world_readable).toBe(true);
        const warning = channel?.warnings.join(' ') ?? '';
        expect(warning).toContain('group- or world-readable');
        expect(warning).toContain(`chmod 600 ${credential}`);
        // An in-bounds path is never reported as refused.
        expect(warning).not.toContain(REFUSED);
        // And the contents still never travel.
        expect(JSON.stringify(payload)).not.toContain('not-a-real-secret');
    });

    it('GIVEN a legitimate 0600 file inside the temp root THEN the check RUNS and reports it unexposed, with no warning at all', () => {
        const credential = path.join(TMP, 'confine-inbounds-0600-token');
        fs.writeFileSync(credential, 'not-a-real-secret\n', 'utf-8');
        fs.chmodSync(credential, 0o600);

        const { status, payload } = runCliJson('confine-inbounds-0600', credential);
        expect(status).toBe(0);
        const channel = payload.channels[0];
        const cred = channel?.credential;

        expect(cred?.checked).toBe(true);
        expect(cred?.present).toBe(true);
        expect(cred?.mode).toBe('0600');
        expect(cred?.group_or_world_readable).toBe(false);
        expect(channel?.warnings).toEqual([]);
    });

    it('GIVEN a DIRECTORY as credential_path THEN present:true with mode null / checked false, and NO group-readable warning (its 0755 is normal, not a finding)', () => {
        const directory = path.join(TMP, 'confine-a-directory');
        fs.mkdirSync(directory, { recursive: true });
        // The mode a naive read would have reported as an exposure.
        expect((fs.statSync(directory).mode & 0o044) !== 0).toBe(true);

        const { status, payload } = runCliJson('confine-directory', directory);
        expect(status).toBe(0);
        const channel = payload.channels[0];
        const cred = channel?.credential;

        expect(cred?.present).toBe(true);
        expect(cred?.mode).toBeNull();
        expect(cred?.group_or_world_readable).toBe(false);
        expect(cred?.checked).toBe(false);
        // In bounds, so not a refusal either — no warning an operator cannot act on.
        expect(channel?.warnings).toEqual([]);
    });
});

describe('reach_doctor — confineCredentialPath bounds (unit)', () => {
    /**
     * `..` kept LITERAL in the string handed to the helper: this is what separates
     * resolve-then-compare from a naive `startsWith(root)`, which would accept it —
     * the string does begin with the temp root.
     */
    const ESCAPING_VIA_DOTDOT = [
        path.resolve(os.tmpdir()),
        '..',
        '..',
        '..',
        'etc',
        'passwd',
    ].join(path.sep);

    const CASES: ReadonlyArray<readonly [string, string, boolean]> = [
        ['a token under the operator home', path.join(os.homedir(), '.reach-fixture-token'), true],
        ['a file under this repo root', path.join(REPO, 'agents', 'reach-fixture-token'), true],
        ['a file under the system temp dir', path.join(os.tmpdir(), 'reach-fixture-token'), true],
        ['/etc/passwd — the reported exploit target', path.resolve(path.sep, 'etc', 'passwd'), false],
        ['the filesystem root itself', path.resolve(path.sep), false],
        ['a path that escapes the temp root via ..', ESCAPING_VIA_DOTDOT, false],
    ];

    it.each(CASES)('GIVEN %s THEN confineCredentialPath returns %s', (_label, target, allowed) => {
        expect(confineCredentialPath(target)).toBe(allowed);
    });

    it('accepts a path under BOTH root forms — macOS hands out /var/folders/… from os.tmpdir() while its realpath is /private/var/folders/…, and comparing only one form refused the legitimate fixture case', () => {
        const literal = path.resolve(os.tmpdir());
        const real = path.resolve(fs.realpathSync(literal));

        expect(confineCredentialPath(path.join(literal, 'reach-fixture-token'))).toBe(true);
        expect(confineCredentialPath(path.join(real, 'reach-fixture-token'))).toBe(true);
    });
});

describe('reach:doctor — errorRow sanitizes the message it puts in the payload', () => {
    // Every other error→output path in the reach scripts goes through
    // `sanitizeParseError`; this one used a raw `err.message`. A YAMLParseError
    // stringifies with the offending SOURCE LINE and a caret, so an unsanitized
    // message could carry a line of the registry into the payload warning.
    it('GIVEN a parse-error-shaped multi-line message THEN only the first line reaches the warning', () => {
        const err = new Error(
            'Nested mappings are not allowed at line 3\n\n' +
                'SECRET_LINE=abc123\n' +
                '^^^^^^^^^^^^^^^^^^',
        );
        err.name = 'YAMLParseError';
        const row = errorRow('github', err);

        const warning = row.warnings.join(' ');
        expect(warning).not.toContain('SECRET_LINE');
        expect(warning).not.toContain('abc123');
        expect(warning).not.toContain('^^^');
        // The actionable first line, and the error class, both survive.
        expect(warning).toContain('Nested mappings are not allowed at line 3');
        expect(warning).toContain('YAMLParseError');
        expect(row.warnings).toHaveLength(1);
        expect(row.warnings[0]?.includes('\n')).toBe(false);
    });

    it('GIVEN a non-Error throw THEN it is still stringified into exactly one line', () => {
        const row = errorRow('github', { toString: () => 'weird\nmultiline' });
        expect(row.status).toBe('error');
        expect(row.warnings).toHaveLength(1);
        expect(row.warnings[0]?.includes('\n')).toBe(false);
    });
});

describe('reach:doctor — buildChannelRow entry gate (defense in depth behind collect())', () => {
    // `collect()` is the schema gate; these exports are test-facing. The gate
    // below is what keeps a DIRECT caller from getting a row whose id or
    // backends had to be guessed.
    it.each([
        ['a non-mapping entry', 'scalar', /not a mapping/],
        ['an entry with no id', { backends: [{ id: 'node', probe_cmd: 'node' }] }, /carries no id/],
        ['an entry whose backends is not a list', { id: 'x', backends: 'nope' }, /non-empty list/],
        ['an entry whose backends list is EMPTY', { id: 'x', backends: [] }, /non-empty list/],
        ['an entry with no backends key at all', { id: 'x' }, /non-empty list/],
    ])('refuses %s with a named reason rather than reading it speculatively', (_label, raw, re) => {
        expect(() => buildChannelRow(raw, { deep: false, now: new Date() })).toThrow(re);
    });
});

describe('reach:doctor — the win32 credential gap is surfaced, not reported as a pass', () => {
    // FIX 5's claim under test: POSIX mode bits do not exist on Windows (ACLs
    // do), reading them would need a native call or an `icacls` spawn this
    // read-only doctor refuses, so the check reports `checked: false`. That
    // value must actually REACH the payload — a skipped check silently
    // rendered as a clean one is the failure mode.
    const originalPlatform = process.platform;

    function withPlatform<T>(value: string, fn: () => T): T {
        Object.defineProperty(process, 'platform', { value, configurable: true });
        try {
            return fn();
        } finally {
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                configurable: true,
            });
        }
    }

    function credentialRegistry(name: string): string {
        const credential = path.join(TMP, `${name}-token`);
        fs.writeFileSync(credential, 'not-a-real-secret\n', 'utf-8');
        if (POSIX) fs.chmodSync(credential, 0o644); // world-readable ON PURPOSE
        return registry(
            name,
            `schema_version: reach-channels-v1
channels:
  - id: credentialed
    description: A channel that declares a credential file path.
    tier: login
    lifecycle: stable
    override_key: reach.channels.credentialed.backend
    last_verified: "2026-07-24"
    credential_path: ${credential}
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install node@22
`,
        );
    }

    it('GIVEN win32 THEN checked:false reaches the payload AND the row still validates against the schema', () => {
        const file = credentialRegistry('win32-cred');
        const payload = withPlatform('win32', () => collect({ registryPath: file }));

        const cred = payload.channels[0]?.credential;
        expect(cred).not.toBeNull();
        expect(cred?.checked).toBe(false);
        expect(cred?.mode).toBeNull();
        // A 0644 file: `false` here means "not determined", never "determined
        // safe" — and because the check did not run, no warning is invented.
        expect(cred?.group_or_world_readable).toBe(false);
        expect(payload.channels[0]?.warnings).toEqual([]);
        // The file is still reported as present — that part needs no mode bits.
        expect(cred?.present).toBe(true);

        // `checked` is a required field of the payload schema; the whole payload
        // must remain valid with the skipped-check shape in it.
        expect(makeValidator()(payload)).toBe(true);
    });

    it('GIVEN win32 THEN the table names the gap in words the operator can read', () => {
        const file = credentialRegistry('win32-cred-table');
        const table = withPlatform('win32', () =>
            renderTable(collect({ registryPath: file })),
        );
        expect(table).toContain('not checked on this platform');
    });

    it.skipIf(!POSIX)('GIVEN this POSIX host THEN the same registry IS checked (the gap is win32-only)', () => {
        // Control: without it, `checked: false` above could be the normal
        // outcome everywhere rather than a platform-specific gap.
        const file = credentialRegistry('posix-cred-control');
        const cred = collect({ registryPath: file }).channels[0]?.credential;
        expect(cred?.checked).toBe(true);
        expect(cred?.mode).toBe('0644');
        expect(cred?.group_or_world_readable).toBe(true);
    });
});

describe('reach:doctor — --deep is opt-in and refuses CI', () => {
    it('GIVEN CI is set WHEN --deep is requested THEN the exit code is 2 and no network is attempted', () => {
        const file = registry(
            'deep-ci',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}`,
        );
        const run = spawnSync(
            process.execPath,
            [TSX_CLI, DOCTOR, '--deep', '--registry', file],
            { cwd: REPO, encoding: 'utf-8', env: { ...process.env, CI: 'true' } },
        );

        expect(run.status).toBe(2);
        expect(run.stderr).toContain('never runs in CI');
    });

    it('GIVEN --help THEN the network cost of --deep is unmistakable', () => {
        const run = spawnSync(process.execPath, [TSX_CLI, DOCTOR, '--help'], {
            cwd: REPO,
            encoding: 'utf-8',
        });

        expect(run.status).toBe(0);
        expect(run.stdout).toContain('--deep');
        expect(run.stdout).toContain('NETWORK');
        expect(run.stdout).toContain('Refuses to');
    });

    it('GIVEN the default shallow mode THEN every backend row carries deep: null (no request was made)', () => {
        const file = registry(
            'shallow',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}`,
        );

        const payload = collect({ registryPath: file });
        expect(payload.deep).toBe(false);
        expect(payload.channels[0]?.backends[0]?.deep).toBeNull();
    });

    it('GIVEN a CI marker WHEN collect({ deep: true }) is called directly THEN it refuses — the gate is not only in the CLI layer', () => {
        const file = registry(
            'deep-collect-ci',
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}`,
        );

        // An importer or a test bypassing main() must not be able to fire real
        // network requests inside CI: the refusal lives in collect() itself.
        vi.stubEnv('CI', 'true');
        try {
            expect(() => collect({ registryPath: file, deep: true })).toThrow(
                /never runs in CI \(CI is set\)/,
            );
            expect(runMain(['--deep', '--registry', file])).toBe(2);
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it('GIVEN a prototype-chain name as probe_cmd THEN the deep row is not-declared with a null endpoint (never a schema-invalid block)', () => {
        // `DEEP_PROBES[probeCmd]` used to walk the prototype chain, so
        // `constructor` resolved to `Object`, skipped the not-declared branch,
        // and emitted a `deep` block with no `endpoint` — invalid against
        // reach-doctor-payload.schema.json. No network: nothing is spawned on
        // the not-declared path.
        for (const inherited of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
            const row = runDeepProbe(inherited, 'ok');
            expect(row.status, inherited).toBe('not-declared');
            expect(row.endpoint, inherited).toBeNull();
            expect(row.exit_code, inherited).toBeNull();
            expect(row.detail, inherited).toContain('no deep probe is declared');
        }
    });

    it('GIVEN a declared backend whose local probe failed THEN the deep row is skipped WITH its endpoint (the declared-probe path still works)', () => {
        const row = runDeepProbe('curl', 'missing');
        expect(row.status).toBe('skipped');
        expect(row.endpoint).toBe('https://example.com');
    });
});

describe('reach:doctor — the registry is validated before anything is spawned', () => {
    const FIXTURES = path.resolve(REPO, 'tests', 'fixtures', 'reach-channels');

    it('GIVEN the hostile shell-payload registry THEN collect refuses with exit 2 AND the payload never runs', () => {
        const marker = path.join(TMP, 'poc-marker');
        // The fixture's payload targets /tmp/agent-config-reach-poc-marker; this
        // local copy retargets it into the suite's temp dir so the assertion is
        // about THIS run and cannot pass on a stale absence.
        const hostile = registry(
            'hostile-shell-payload',
            fs
                .readFileSync(path.join(FIXTURES, 'hostile-shell-payload.yml'), 'utf-8')
                .replace('/tmp/agent-config-reach-poc-marker', marker),
        );

        expect(fs.existsSync(marker)).toBe(false);
        expect(() => collect({ registryPath: hostile })).toThrow(/refusing to probe it/);
        expect(runMain(['--registry', hostile])).toBe(2);
        expect(runMain(['--registry', hostile, '--format', 'json'])).toBe(2);
        // The whole point: no child process ran, so no side effect landed.
        expect(fs.existsSync(marker)).toBe(false);
    });

    it('GIVEN a schema-invalid registry whose offending VALUE carries a secret THEN the refusal message redacts it', () => {
        // The schema validator quotes the offending value in its message, and
        // `collect()` composes that message into the refusal it throws. That was
        // the FOURTH echo site of the content-leak class and the last one found:
        // three others were already redacted while this one still printed a
        // caller-supplied file's values back through `--registry`.
        const file = registry(
            'secret-in-unpinned-install',
            `schema_version: reach-channels-v1

channels:
  - id: rss
    description: A fixture whose unpinned install string carries a secret value.
    tier: zero-config
    lifecycle: stable
    override_key: reach.channels.rss.backend
    last_verified: "2026-07-24"
    backends:
      - id: ${PRESENT_CMD}
        probe_cmd: ${PRESENT_CMD}
        probe_args: ["--version"]
        install:
          default: brew install curl AWS_SECRET_ACCESS_KEY=zzz999topsecret
`,
        );

        let message = '';
        try {
            collect({ registryPath: file });
        } catch (err) {
            message = err instanceof Error ? err.message : String(err);
        }

        expect(message).toMatch(/refusing to probe it/);
        // The secret is gone; the key, the rule and the JSON path survive, so the
        // finding stays actionable.
        expect(message).not.toContain('zzz999topsecret');
        expect(message).toContain('<redacted>');
        expect(message).toContain('AWS_SECRET_ACCESS_KEY');
        expect(message).toMatch(/pattern/);
        expect(message).toMatch(/\$\.channels\[0\]\.backends\[0\]\.install\.default/);
    });

    it('GIVEN a URL-bearing probe argument THEN collect refuses — a shallow run promises zero network', () => {
        const hostile = path.join(FIXTURES, 'hostile-url-arg.yml');
        expect(() => collect({ registryPath: hostile })).toThrow(/refusing to probe it/);
        expect(runMain(['--registry', hostile])).toBe(2);
    });

    it('GIVEN a backend whose probe_cmd is not its id THEN collect refuses, so no row can mislabel the executed binary', () => {
        const hostile = path.join(FIXTURES, 'probe-cmd-mislabel.yml');
        expect(() => collect({ registryPath: hostile })).toThrow(/probe_cmd-binding/);
        expect(runMain(['--registry', hostile])).toBe(2);
    });

    it('GIVEN the SHIPPED registry THEN it still passes the runtime gate (the fix is not a blanket reject)', () => {
        const payload = collect();
        expect(payload.channels.length).toBeGreaterThan(0);
        for (const channel of payload.channels) {
            for (const backend of channel.backends) {
                expect(backend.probe_cmd, `${channel.id}/${backend.id}`).toBe(backend.id);
            }
        }
    });
});

/**
 * READINESS — "installed" is not "able to retrieve"
 * (road-to-gated-reach Phase 2, steps 2/3/6).
 *
 * The blind spot under test: `yt-dlp --version` exits 0 as soon as the binary
 * exists, while YouTube extraction additionally needs an external JavaScript
 * runtime. Only Deno is enabled by default; with Node the user config must
 * carry `--js-runtimes`. So the doctor could report a healthy `youtube` channel
 * while a transcript pull failed — a false green.
 *
 * NOTHING HERE NEEDS yt-dlp INSTALLED, and that is deliberate: installs are
 * human-performed by contract, so this suite drives the real resolution, the
 * real bounded config read and the real verdict against REAL files in a temp
 * XDG root, injecting only the three facts a fixture cannot supply (whether the
 * backend answered, what version it printed, which runtimes are on PATH). The
 * one thing that IS exercised live is `probeJsRuntimes()`, which really walks
 * PATH through the shared probe machinery.
 *
 * `assessJsRuntimeReadiness` takes its env explicitly, so the XDG cases assert
 * the resolved path directly instead of mutating the process — and one case
 * still goes through the `process.env` default, because that is the path the
 * CLI actually takes.
 */
describe('reach:doctor — YouTube readiness is config-semantic, local, and read-only', () => {
    /** A release comfortably newer than the `--js-runtimes` gate (2025.11.12). */
    const NEW_ENOUGH = '2026.7.4';
    /** One day older than the gate — the flag would be rejected by this build. */
    const TOO_OLD = '2025.11.11';

    /**
     * A temp XDG root, optionally containing a real `yt-dlp/config`.
     * `body === null` leaves the directory absent too, which is the ordinary
     * "operator never wrote a config" case.
     */
    function xdgRoot(name: string, body: string | null): string {
        const root = path.join(TMP, `xdg-${name}`);
        fs.mkdirSync(root, { recursive: true });
        if (body !== null) {
            fs.mkdirSync(path.join(root, 'yt-dlp'), { recursive: true });
            fs.writeFileSync(path.join(root, 'yt-dlp', 'config'), body, 'utf-8');
        }
        return root;
    }

    function assess(
        root: string,
        overrides: {
            backend_status?: BackendRow['status'];
            version_raw?: string | null;
            runtimes?: string[];
        } = {},
    ): ReadinessRow {
        return assessJsRuntimeReadiness(
            {
                backend_status: overrides.backend_status ?? 'ok',
                version_raw:
                    overrides.version_raw === undefined ? NEW_ENOUGH : overrides.version_raw,
                runtimes: overrides.runtimes ?? ['node'],
            },
            { XDG_CONFIG_HOME: root },
        );
    }

    // ── 1 ─────────────────────────────────────────────────────────────────
    it('GIVEN a config carrying --js-runtimes node on a Node-only host THEN readiness is ready and no fix is prescribed', () => {
        const row = assess(xdgRoot('flag-present', '--js-runtimes node\n'));

        expect(row.kind).toBe('js-runtime');
        expect(row.status).toBe('ready');
        expect(row.config_present).toBe(true);
        expect(row.config_flag).toBe(true);
        expect(row.version).toBe(NEW_ENOUGH);
        expect(row.fix).toBeNull();
        expect(row.detail).toContain(JS_RUNTIME_FLAG);
    });

    it('GIVEN the flag with ANY runtime value (a list, an = form, extra options) THEN presence alone is the signal', () => {
        for (const body of [
            '--js-runtimes deno,node\n',
            '--js-runtimes=node\n',
            '# a comment\n--no-check-certificates\n--js-runtimes node\n',
        ]) {
            expect(assess(xdgRoot(`flag-shape-${body.length}`, body)).status, body).toBe('ready');
        }
    });

    // ── 2 ─────────────────────────────────────────────────────────────────
    it('GIVEN a config present WITHOUT the flag on a Node-only host THEN readiness is not-ready AND an idempotent fix command is prescribed', () => {
        const root = xdgRoot('flag-absent', '--no-check-certificates\n');
        const row = assess(root);
        const configPath = path.join(root, 'yt-dlp', 'config');

        expect(row.status).toBe('not-ready');
        expect(row.config_present).toBe(true);
        expect(row.config_flag).toBe(false);
        expect(row.fix).not.toBeNull();

        const fix = row.fix ?? '';
        // The remedy targets the SAME path the check read — a fix pointing at a
        // different file than the check inspected is the failure mode this
        // whole layer exists to prevent.
        expect(fix).toContain(configPath);
        // Idempotent SHAPE: create the dir, then append only when the exact
        // line is absent. The grouping matters — `A && B || C` would append
        // after a failed mkdir.
        expect(fix).toContain('mkdir -p');
        expect(fix).toContain('grep -qxF');
        expect(fix).toContain('|| printf');
        expect(fix).toContain('>>');
        expect(fix).toMatch(/&& \{ .* \|\| .*; \}/);
        // The text it greps for is byte-identical to the text it appends, which
        // is what makes the second run a no-op.
        expect(fix).toContain(`'${JS_RUNTIME_FLAG} node'`);
    });

    it.skipIf(!POSIX)('GIVEN the emitted POSIX fix WHEN it is really run TWICE THEN the flag lands exactly once and the verdict flips to ready', () => {
        // Idempotence measured, not asserted: the command is executed for real
        // in a temp XDG root, twice, and the resulting file is counted.
        const root = xdgRoot('fix-executed', null);
        const configPath = path.join(root, 'yt-dlp', 'config');
        const before = assess(root);
        expect(before.status).toBe('not-ready');
        expect(before.config_present).toBe(false);
        const fix = before.fix ?? '';

        for (const pass of [1, 2]) {
            const run = spawnSync('/bin/sh', ['-c', fix], { encoding: 'utf-8' });
            expect(run.status, `pass ${pass}: ${run.stderr}`).toBe(0);
        }

        const lines = fs
            .readFileSync(configPath, 'utf-8')
            .split('\n')
            .filter((line) => line.trim() !== '');
        expect(lines).toEqual([`${JS_RUNTIME_FLAG} node`]);
        // And the doctor now agrees the channel can extract.
        expect(assess(root).status).toBe('ready');
    });

    it('GIVEN win32 THEN the fix is the PowerShell equivalent, guarded by Select-String -Quiet', () => {
        const configPath = path.join('C:\\Users\\op\\.config', 'yt-dlp', 'config');
        const fix = jsRuntimeFixCommand(configPath, 'win32');

        expect(fix).toContain('New-Item -ItemType Directory -Force');
        expect(fix).toContain('Select-String');
        expect(fix).toContain('-Quiet');
        expect(fix).toContain('Add-Content');
        expect(fix).toContain(configPath);
        // No POSIX shell fragment leaks into the Windows form.
        expect(fix).not.toContain('mkdir -p');
        expect(fix).not.toContain('grep');
    });

    // ── 3 ─────────────────────────────────────────────────────────────────
    it('GIVEN no config file at all on a Node-only host THEN readiness is not-ready AND the fix creates it', () => {
        const root = xdgRoot('no-config', null);
        const row = assess(root);

        expect(row.status).toBe('not-ready');
        expect(row.config_present).toBe(false);
        expect(row.config_flag).toBe(false);
        expect(row.detail).toContain('does not exist');
        expect(row.fix ?? '').toContain(path.join(root, 'yt-dlp', 'config'));
    });

    // ── 4 ─────────────────────────────────────────────────────────────────
    it('GIVEN deno on PATH THEN readiness is ready even with NO config — yt-dlp enables Deno by default', () => {
        const row = assess(xdgRoot('deno-no-config', null), { runtimes: ['deno'] });

        expect(row.status).toBe('ready');
        expect(row.config_present).toBe(false);
        expect(row.config_flag).toBe(false);
        expect(row.fix).toBeNull();
        expect(row.detail).toContain('deno');
    });

    it('GIVEN deno present but a version far too old THEN it is STILL ready — the gate only governs the Node flag', () => {
        const row = assess(xdgRoot('deno-old', null), {
            runtimes: ['deno', 'node'],
            version_raw: '2019.1.1',
        });
        expect(row.status).toBe('ready');
    });

    it('GIVEN NO JavaScript runtime at all THEN readiness is not-ready and NO config fix is invented — a config edit cannot conjure a runtime', () => {
        const row = assess(xdgRoot('no-runtime', '--js-runtimes node\n'), { runtimes: [] });

        expect(row.status).toBe('not-ready');
        expect(row.fix).toBeNull();
        expect(row.detail).toContain('no external JavaScript runtime');
    });

    // ── 5 ─────────────────────────────────────────────────────────────────
    it('GIVEN a yt-dlp older than the flag gate THEN the remedy is "upgrade first", never the flag', () => {
        const row = assess(xdgRoot('too-old', null), { version_raw: TOO_OLD });

        expect(row.status).toBe('not-ready');
        expect(row.version).toBe(TOO_OLD);
        expect(row.fix).toBeNull();
        expect(row.detail).toContain('2025.11.12');
        expect(row.detail).toContain('upgrade first');
        // The build would REJECT the flag, so it must not be prescribed at all.
        expect(row.detail).not.toContain('mkdir -p');
    });

    it('GIVEN an old yt-dlp whose config ALREADY carries the flag THEN it is still not-ready — the flag does not exist in that build', () => {
        const row = assess(xdgRoot('too-old-with-flag', '--js-runtimes node\n'), {
            version_raw: TOO_OLD,
        });
        expect(row.status).toBe('not-ready');
        expect(row.config_flag).toBe(true);
        expect(row.detail).toContain('upgrade first');
    });

    it('GIVEN the exact gate release THEN the flag path is allowed (the boundary is inclusive)', () => {
        expect(assess(xdgRoot('at-gate', '--js-runtimes node\n'), { version_raw: '2025.11.12' }).status).toBe(
            'ready',
        );
        expect(assess(xdgRoot('at-gate-noflag', null), { version_raw: '2025.11.12' }).fix).not.toBeNull();
    });

    // ── 6 ─────────────────────────────────────────────────────────────────
    it('GIVEN a version that cannot be parsed THEN readiness is unknown with a cannot-confirm message — NEVER a false ready', () => {
        for (const raw of ['nightly', 'v24.3.0', '', 'yt-dlp 2026.7.4', '2026.7', 'unknown']) {
            const row = assess(xdgRoot(`unparsed-${raw.length}-${raw.slice(0, 3)}`, null), {
                version_raw: raw,
            });
            expect(row.status, raw).toBe('unknown');
            expect(row.version, raw).toBeNull();
            expect(row.detail, raw).toContain('cannot confirm');
            expect(row.detail, raw).toContain('upgrade first');
            expect(row.fix, raw).toBeNull();
        }
    });

    it('GIVEN an unparseable version WHOSE config already carries the flag THEN it is STILL unknown, not ready', () => {
        const row = assess(xdgRoot('unparsed-with-flag', '--js-runtimes node\n'), {
            version_raw: 'nightly-2026',
        });
        expect(row.status).toBe('unknown');
        expect(row.config_flag).toBe(true);
    });

    it('parseYtDlpVersion accepts the release shape (including the nightly 4th component) and nothing else', () => {
        expect(parseYtDlpVersion('2026.7.4')).toEqual([2026, 7, 4]);
        expect(parseYtDlpVersion('  2025.11.12  ')).toEqual([2025, 11, 12]);
        // A nightly build: the release triple decides, the suffix is dropped.
        expect(parseYtDlpVersion('2025.11.12.232946')).toEqual([2025, 11, 12]);
        for (const bad of [null, '', 'nightly', 'v2026.7.4', '2026.7', '26.7.4', '2026-07-04']) {
            expect(parseYtDlpVersion(bad), String(bad)).toBeNull();
        }
    });

    // ── 7 ─────────────────────────────────────────────────────────────────
    it('GIVEN XDG_CONFIG_HOME set THEN the config is looked for THERE, exactly as yt-dlp resolves it — not under ~/.config', () => {
        // THE failure worth preventing: if the doctor read ~/.config while the
        // tool read $XDG_CONFIG_HOME, doctor and operator would agree with each
        // other while yt-dlp read a third file. So the resolved path is asserted
        // literally, in both directions.
        const root = xdgRoot('xdg-explicit', '--js-runtimes node\n');
        const expected = path.join(root, 'yt-dlp', 'config');

        expect(resolveYtDlpConfigPath({ XDG_CONFIG_HOME: root })).toBe(expected);
        expect(resolveYtDlpConfigPath({ XDG_CONFIG_HOME: root })).not.toBe(
            path.join(os.homedir(), '.config', 'yt-dlp', 'config'),
        );
        // And the verdict really came from that file: the flag is only there.
        const row = assess(root);
        expect(row.config_path).toBe(expected);
        expect(row.config_flag).toBe(true);
    });

    it('GIVEN XDG_CONFIG_HOME unset or empty THEN it falls back to ~/.config/yt-dlp/config', () => {
        const fallback = path.join(os.homedir(), '.config', 'yt-dlp', 'config');
        expect(resolveYtDlpConfigPath({})).toBe(fallback);
        expect(resolveYtDlpConfigPath({ XDG_CONFIG_HOME: '' })).toBe(fallback);
        expect(resolveYtDlpConfigPath({ XDG_CONFIG_HOME: '   ' })).toBe(fallback);
    });

    it('GIVEN a ~-prefixed XDG_CONFIG_HOME THEN it is expanded rather than taken literally', () => {
        expect(resolveYtDlpConfigPath({ XDG_CONFIG_HOME: '~/xdg-home' })).toBe(
            path.join(os.homedir(), 'xdg-home', 'yt-dlp', 'config'),
        );
    });

    it('GIVEN the process env itself carries XDG_CONFIG_HOME THEN the DEFAULT (no-argument) resolution honours it — the path the CLI actually takes', () => {
        const root = xdgRoot('xdg-live', '--js-runtimes node\n');
        vi.stubEnv('XDG_CONFIG_HOME', root);
        try {
            expect(resolveYtDlpConfigPath()).toBe(path.join(root, 'yt-dlp', 'config'));
            const row = assessJsRuntimeReadiness({
                backend_status: 'ok',
                version_raw: NEW_ENOUGH,
                runtimes: ['node'],
            });
            expect(row.config_path).toBe(path.join(root, 'yt-dlp', 'config'));
            expect(row.status).toBe('ready');
        } finally {
            vi.unstubAllEnvs();
        }
    });

    // ── 8 ─────────────────────────────────────────────────────────────────
    it.skipIf(!POSIX)('GIVEN a SYMLINKED config path THEN it is refused rather than followed — the link target never answers for the file', () => {
        const target = path.join(TMP, 'symlink-target-config');
        fs.writeFileSync(target, `${JS_RUNTIME_FLAG} node\n`, 'utf-8');
        const root = xdgRoot('symlink', null);
        fs.mkdirSync(path.join(root, 'yt-dlp'), { recursive: true });
        fs.symlinkSync(target, path.join(root, 'yt-dlp', 'config'));

        const row = assess(root);

        // The load-bearing assertion: the TARGET carries the flag, so a followed
        // link would have reported `ready`. Refusing means not-ready.
        expect(row.config_flag).toBe(false);
        expect(row.config_present).toBe(false);
        expect(row.status).toBe('not-ready');
        expect(row.detail).toContain('symlink');
        expect(row.detail).toContain('refused');
    });

    it.skipIf(!POSIX)('readConfigFlag refuses a symlink and a directory, and names why in both cases', () => {
        const file = path.join(TMP, 'rcf-real-config');
        fs.writeFileSync(file, `${JS_RUNTIME_FLAG} node\n`, 'utf-8');
        const link = path.join(TMP, 'rcf-link-config');
        fs.symlinkSync(file, link);
        const directory = path.join(TMP, 'rcf-directory-config');
        fs.mkdirSync(directory, { recursive: true });

        const viaLink = readConfigFlag(link);
        expect(viaLink).toMatchObject({ present: false, flag: false });
        expect(viaLink.refused).toContain('symlink');

        const viaDirectory = readConfigFlag(directory);
        expect(viaDirectory).toMatchObject({ present: false, flag: false });
        expect(viaDirectory.refused).toContain('not a regular file');

        // The control: the real file IS read, so the refusals above are about
        // the path shape and not about the reader being broken.
        expect(readConfigFlag(file)).toEqual({ present: true, flag: true, refused: null });
        // An absent path is simply absent — not a refusal.
        expect(readConfigFlag(path.join(TMP, 'rcf-nope'))).toEqual({
            present: false,
            flag: false,
            refused: null,
        });
    });

    it('readConfigFlag is BOUNDED — a flag beyond the byte cap is not seen, so a huge file cannot be slurped', () => {
        const file = path.join(TMP, 'rcf-bounded-config');
        const padding = `# ${'x'.repeat(200)}\n`;
        fs.writeFileSync(file, `${padding}${JS_RUNTIME_FLAG} node\n`, 'utf-8');

        // Read capped below the flag's offset: not found.
        expect(readConfigFlag(file, 32)).toMatchObject({ present: true, flag: false });
        // Read with the real cap: found. Same file, so the cap is what differed.
        expect(readConfigFlag(file, READINESS_CONFIG_MAX_BYTES)).toMatchObject({
            present: true,
            flag: true,
        });
        expect(READINESS_CONFIG_MAX_BYTES).toBeGreaterThan(1024);
    });

    // ── the not-evaluated combination, which must not contradict itself ────
    it('GIVEN the backend itself is missing THEN readiness is unknown and says so — never not-ready, never ready', () => {
        for (const status of ['missing', 'broken', 'timeout', 'error'] as const) {
            const row = assess(xdgRoot(`backend-${status}`, `${JS_RUNTIME_FLAG} node\n`), {
                backend_status: status,
                version_raw: null,
            });
            expect(row.status, status).toBe('unknown');
            expect(row.version, status).toBeNull();
            expect(row.fix, status).toBeNull();
            expect(row.detail, status).toContain(status);
            expect(row.detail, status).toContain('not evaluated');
            // The config observation is still reported truthfully — the flag IS
            // there — and the detail explains why that does not settle anything.
            expect(row.config_flag, status).toBe(true);
        }
    });

    // ── the live runtime detection ─────────────────────────────────────────
    it('probeJsRuntimes uses the shared probe machinery and finds the runtime this suite is running under', () => {
        const runtimes = probeJsRuntimes();
        // `node` is guaranteed: vitest is executing inside it.
        expect(runtimes).toContain('node');
        // Nothing outside the declared candidate set can appear.
        for (const runtime of runtimes) expect(['deno', 'node']).toContain(runtime);
    });

    it('liveReadinessRow returns null for every backend that declares no requirement — including prototype-chain names', () => {
        for (const backendId of [
            'curl',
            'node',
            'gh',
            'constructor',
            'toString',
            'hasOwnProperty',
            '__proto__',
        ]) {
            expect(liveReadinessRow(backendId, 'ok'), backendId).toBeNull();
        }
    });

    it('liveReadinessRow DOES fire for yt-dlp on this machine, and reports the not-evaluated ceiling rather than a green', () => {
        // yt-dlp is not installed here (installs are human-performed), so this
        // is the honest live shape: a real probe verdict plus a readiness row
        // that refuses to guess.
        const row = liveReadinessRow('yt-dlp', 'missing');
        expect(row).not.toBeNull();
        expect(row?.kind).toBe('js-runtime');
        expect(row?.status).toBe('unknown');
        expect(row?.config_path).toBe(resolveYtDlpConfigPath());
    });
});

describe('reach:doctor — the readiness verdict reaches the channel status, both output formats, and the schema', () => {
    /**
     * The seam: `collect({ readiness })` swaps the live observer, exactly as
     * `now` swaps the clock. It is the only way to exercise an INSTALLED
     * backend's readiness on a machine where the backend is not installed —
     * and the rows fed through it are REAL rows from
     * `assessJsRuntimeReadiness` over real temp config files, not hand-written
     * literals.
     */
    function rowFor(name: string, body: string | null, runtimes: string[]): ReadinessRow {
        const root = path.join(TMP, `seam-${name}`);
        fs.mkdirSync(root, { recursive: true });
        if (body !== null) {
            fs.mkdirSync(path.join(root, 'yt-dlp'), { recursive: true });
            fs.writeFileSync(path.join(root, 'yt-dlp', 'config'), body, 'utf-8');
        }
        return assessJsRuntimeReadiness(
            { backend_status: 'ok', version_raw: '2026.7.4', runtimes },
            { XDG_CONFIG_HOME: root },
        );
    }

    function collectWith(row: ReadinessRow | null): ReachDoctorPayload {
        const file = registry(
            `readiness-${row?.status ?? 'none'}`,
            `schema_version: reach-channels-v1
channels:
${OK_CHANNEL}`,
        );
        return collect({
            registryPath: file,
            readiness: (backendId) => (backendId === PRESENT_CMD ? row : null),
        });
    }

    it('GIVEN an installed backend whose readiness is NOT satisfied THEN the channel is not-ready (not ok, not missing) and --strict fails', () => {
        const row = rowFor('not-ready', null, ['node']);
        expect(row.status).toBe('not-ready');

        const payload = collectWith(row);
        const channel = payload.channels[0];

        // The distinction an operator needs: the binary is fine…
        expect(channel?.backends[0]?.status).toBe('ok');
        // …and the channel still cannot retrieve.
        expect(channel?.status).toBe('not-ready');
        expect(channel?.active_backend).toBeNull();
        expect(channel?.backends[0]?.readiness?.status).toBe('not-ready');
        expect(finalExitCode(payload, true)).toBe(1);
        expect(finalExitCode(payload, false)).toBe(0);
    });

    it('GIVEN readiness UNKNOWN on an installed backend THEN the channel is still not-ready — an "installed, unverified" ceiling, never a green', () => {
        const unknown = assessJsRuntimeReadiness(
            { backend_status: 'ok', version_raw: 'nightly', runtimes: ['node'] },
            { XDG_CONFIG_HOME: path.join(TMP, 'seam-unknown-root') },
        );
        expect(unknown.status).toBe('unknown');

        const payload = collectWith(unknown);
        expect(payload.channels[0]?.status).toBe('not-ready');
        expect(payload.channels[0]?.active_backend).toBeNull();
        expect(finalExitCode(payload, true)).toBe(1);
    });

    it('GIVEN readiness satisfied THEN the channel is ok and the backend is active again', () => {
        const row = rowFor('ready', `${JS_RUNTIME_FLAG} node\n`, ['node']);
        expect(row.status).toBe('ready');

        const payload = collectWith(row);
        expect(payload.channels[0]?.status).toBe('ok');
        expect(payload.channels[0]?.active_backend).toBe(PRESENT_CMD);
        expect(finalExitCode(payload, true)).toBe(0);
    });

    it('GIVEN a not-ready backend THEN the TABLE names the state, the resolved config path, and the fix command', () => {
        const row = rowFor('table', null, ['node']);
        const table = renderTable(collectWith(row));

        expect(table).toContain('readiness (js-runtime): not-ready');
        expect(table).toContain(row.config_path);
        expect(table).toContain('readiness fix');
        expect(table).toContain('mkdir -p');
        expect(table).toContain('runtimes on PATH: node');
        expect(table).toContain(`${JS_RUNTIME_FLAG}: no`);
    });

    it('GIVEN a ready backend THEN the table STILL shows the readiness line — a silent pass would be indistinguishable from a check that never ran', () => {
        const table = renderTable(collectWith(rowFor('table-ready', `${JS_RUNTIME_FLAG} node\n`, ['node'])));
        expect(table).toContain('readiness (js-runtime): ready');
        expect(table).toContain(`${JS_RUNTIME_FLAG}: yes`);
        expect(table).not.toContain('readiness fix');
    });

    it('GIVEN every readiness state THEN the serialised JSON payload still validates against reach-doctor-payload.schema.json', () => {
        const validate = makeValidator();
        const rows: ReadinessRow[] = [
            rowFor('schema-ready', `${JS_RUNTIME_FLAG} node\n`, ['node']),
            rowFor('schema-not-ready', null, ['node']),
            rowFor('schema-no-runtime', null, []),
            rowFor('schema-deno', null, ['deno']),
            assessJsRuntimeReadiness(
                { backend_status: 'ok', version_raw: '2025.11.11', runtimes: ['node'] },
                { XDG_CONFIG_HOME: path.join(TMP, 'schema-too-old') },
            ),
            assessJsRuntimeReadiness(
                { backend_status: 'ok', version_raw: 'nightly', runtimes: ['node'] },
                { XDG_CONFIG_HOME: path.join(TMP, 'schema-unparsed') },
            ),
            assessJsRuntimeReadiness(
                { backend_status: 'missing', version_raw: null, runtimes: ['node'] },
                { XDG_CONFIG_HOME: path.join(TMP, 'schema-missing-backend') },
            ),
        ];
        expect(new Set(rows.map((row) => row.status))).toEqual(
            new Set(['ready', 'not-ready', 'unknown']),
        );

        for (const row of rows) {
            const payload = collectWith(row);
            // Round-trip through JSON: the schema describes the serialised bytes.
            const serialised: unknown = JSON.parse(JSON.stringify(payload));
            expect(validate(serialised), row.status).toBe(true);
            // The `not-ready` channel status is in the enum too.
            expect(
                (serialised as ReachDoctorPayload).channels[0]?.backends[0]?.readiness?.status,
                row.status,
            ).toBe(row.status);
        }
    });

    it('GIVEN a not-ready readiness row THEN nothing in the payload carries the config file contents', () => {
        const root = path.join(TMP, 'seam-secretive');
        fs.mkdirSync(path.join(root, 'yt-dlp'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'yt-dlp', 'config'),
            '--cookies /home/op/cookies.txt\n--proxy http://user:not-a-real-secret@127.0.0.1:8080\n',
            'utf-8',
        );
        const row = assessJsRuntimeReadiness(
            { backend_status: 'ok', version_raw: '2026.7.4', runtimes: ['node'] },
            { XDG_CONFIG_HOME: root },
        );

        expect(row.status).toBe('not-ready');
        const serialised = JSON.stringify(collectWith(row));
        expect(serialised).not.toContain('not-a-real-secret');
        expect(serialised).not.toContain('cookies.txt');
        expect(serialised).not.toContain('--proxy');
    });

    // ── 10 · regression guard for the channels with no such requirement ────
    it('GIVEN a backend that declares NO readiness requirement THEN no field and no warning appear — the other channels are untouched', () => {
        const payload = collectWith(null);
        const channel = payload.channels[0];

        expect(channel?.status).toBe('ok');
        expect(channel?.active_backend).toBe(PRESENT_CMD);
        expect(channel?.warnings).toEqual([]);
        expect(channel?.backends[0]?.readiness).toBeUndefined();
        // Absence, not a null: the key must not exist in the serialised channel
        // rows. (Scoped to `channels` on purpose — the payload's `registry`
        // field carries the fixture's own filename.)
        expect(JSON.stringify(payload.channels)).not.toContain('readiness');
        expect(makeValidator()(JSON.parse(JSON.stringify(payload)))).toBe(true);
        expect(renderTable(payload)).not.toContain('readiness (');
    });

    it('GIVEN the SHIPPED registry THEN only the youtube channel carries a readiness row, and every other channel is byte-for-byte unaffected', () => {
        const payload = collect();
        const withReadiness = payload.channels.filter((channel) =>
            channel.backends.some((backend) => backend.readiness !== undefined),
        );

        expect(withReadiness.map((channel) => channel.id)).toEqual(['youtube']);
        for (const channel of payload.channels) {
            if (channel.id === 'youtube') continue;
            expect(JSON.stringify(channel), channel.id).not.toContain('readiness');
            expect(channel.status, channel.id).not.toBe('not-ready');
        }
        expect(makeValidator()(JSON.parse(JSON.stringify(payload)))).toBe(true);
    });

    it('GIVEN the shipped youtube channel on THIS machine (yt-dlp absent) THEN missing + readiness-unknown read as one coherent report, not a contradiction', () => {
        const payload = collect({ channel: 'youtube' });
        const channel = payload.channels[0];
        const readiness = channel?.backends[0]?.readiness;

        // `missing` is the channel verdict (there is a binary to install) …
        expect(channel?.status).toBe('missing');
        expect(channel?.fix).toContain('pipx install yt-dlp==');
        // … and readiness explicitly declines to judge, naming the reason.
        expect(readiness?.status).toBe('unknown');
        expect(readiness?.detail).toContain('missing');
        expect(readiness?.detail).toContain('install it first');
        expect(readiness?.fix).toBeNull();

        // The table says both things in words, in that order.
        const table = renderTable(payload);
        expect(table).toContain('readiness (js-runtime): unknown');
        expect(table).toContain('pipx install yt-dlp==');
        // No flag remedy is offered for a tool that is not installed.
        expect(table).not.toContain('readiness fix');
    });
});
