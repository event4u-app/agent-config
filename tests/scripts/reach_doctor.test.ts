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
    buildChannelRow,
    collect,
    errorRow,
    finalExitCode,
    main,
    renderTable,
    runDeepProbe,
    type ReachDoctorPayload,
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
