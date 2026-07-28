// Tests for src/scripts/check_reach_channels.ts + the reach channel registry
// (road-to-internet-reach Phase 1, Step 4).
//
// Two layers:
//
//   1. The REAL registry (src/config/reach-channels.yml) validates clean —
//      the positive gate `task check-reach-channels` runs in CI.
//   2. Each negative fixture under tests/fixtures/reach-channels/ fails for
//      the RIGHT reason. Assertions pin the JSON path AND the schema rule, not
//      merely a non-zero exit: a fixture that failed because someone broke an
//      unrelated required field would otherwise be scored as a pass.
//
// A third layer covers the load-bearing part of the schema — the install
// pinning pattern — over temp registries, because "rejects a moving target"
// is the whole reason the pattern exists and each rejected form (latest /
// main / master / HEAD / archive / tarball) deserves its own case.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    REGISTRY_PATH,
    RegistryLoadError,
    SCHEMA_MESSAGE_MAX_CHARS,
    SCHEMA_PATH,
    check_probe_cmd_binding,
    excerpt_for_finding,
    format_finding,
    load_registry,
    main,
    sanitizeParseError,
    validate_file,
} from '../../src/scripts/check_reach_channels.js';
import { SchemaError } from '../../src/scripts/validate_frontmatter.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'reach-channels');

/** Every negative fixture with the single finding it is built to provoke. */
const NEGATIVE_FIXTURES = [
    {
        file: 'unpinned-install.yml',
        expectedPath: '$.channels[0].backends[0].install.darwin',
        expectedRule: 'pattern',
        why: 'an install command with no version specifier',
    },
    {
        file: 'unknown-lifecycle.yml',
        expectedPath: '$.channels[0].lifecycle',
        expectedRule: 'enum',
        why: 'a fifth lifecycle value outside the provider-lifecycle vocabulary',
    },
    {
        file: 'missing-probe.yml',
        expectedPath: '$.channels[0].backends[0].probe_cmd',
        expectedRule: 'required',
        why: 'a backend whose health can never be probed',
    },
    {
        file: 'extra-key.yml',
        expectedPath: '$.channels[0].probe_timeout_ms',
        expectedRule: 'additionalProperties',
        why: 'an undeclared key that a typo would produce',
    },
    {
        file: 'hostile-shell-payload.yml',
        expectedPath: '$.channels[0].backends[0].probe_args[1]',
        expectedRule: 'pattern',
        why: 'a `-c` shell payload smuggled through probe_args — arbitrary execution',
    },
    {
        file: 'hostile-url-arg.yml',
        expectedPath: '$.channels[0].backends[0].probe_args[1]',
        expectedRule: 'pattern',
        why: 'a URL argument turning a local probe into a network request',
    },
    {
        file: 'probe-cmd-mislabel.yml',
        expectedPath: '$.channels[0].backends[0].probe_cmd',
        expectedRule: 'probe_cmd-binding',
        why: 'a backend reporting the health of a binary that is not its own id',
    },
] as const;

/** A minimal, otherwise-valid registry whose single install string is the variable. */
function registryWithInstall(installString: string): string {
    return [
        'schema_version: reach-channels-v1',
        '',
        'channels:',
        '  - id: github',
        '    description: Repository metadata from the GitHub API (temp registry).',
        '    tier: free-key',
        '    lifecycle: stable',
        '    override_key: reach.channels.github.backend',
        '    last_verified: "2026-07-24"',
        '    backends:',
        '      - id: gh',
        '        probe_cmd: gh',
        '        probe_args: ["--version"]',
        '        install:',
        `          default: ${JSON.stringify(installString)}`,
        '',
    ].join('\n');
}

describe('reach channel registry — the real file', () => {
    it('validates clean against the schema (no error-severity findings)', () => {
        const findings = validate_file(REGISTRY_PATH);
        const errors = findings.filter((finding) => finding.severity === 'error');
        expect(
            errors.map((error) => `${error.path}: ${error.rule}: ${error.message}`),
        ).toEqual([]);
    });

    it('exits 0 through the CLI entry point', () => {
        expect(main([REGISTRY_PATH, '--quiet'])).toBe(0);
    });

    it('declares only channels backed by an ordered candidate list and a pinned default', () => {
        // Guards the two invariants the schema expresses structurally but that
        // are worth asserting on the real content: no channel ships zero
        // backends, and every backend prescribes a `default` install. Loaded
        // through the script's own loader so the test cannot drift from it.
        const registry = load_registry(REGISTRY_PATH) as unknown as {
            channels: { id: string; backends: { install: Record<string, string> }[] }[];
        };

        expect(registry.channels.length).toBeGreaterThan(0);
        for (const channel of registry.channels) {
            expect(channel.backends.length, `channel ${channel.id}`).toBeGreaterThan(0);
            for (const backend of channel.backends) {
                expect(backend.install.default, `channel ${channel.id}`).toBeTruthy();
            }
        }
    });
});

describe('reach channel registry — negative fixtures fail for the right reason', () => {
    beforeEach(() => {
        // The script writes findings to stdout/stderr (house idiom, no-console
        // is an error under eslint) — silence both so the vitest summary stays
        // readable while the exit code is still asserted.
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    for (const fixture of NEGATIVE_FIXTURES) {
        it(`${fixture.file}: ${fixture.expectedRule} at ${fixture.expectedPath} (${fixture.why})`, () => {
            const target = path.join(FIXTURE_DIR, fixture.file);
            const findings = validate_file(target).filter(
                (finding) => finding.severity === 'error',
            );

            expect(findings.length).toBeGreaterThan(0);
            const match = findings.find(
                (finding) =>
                    finding.path === fixture.expectedPath && finding.rule === fixture.expectedRule,
            );
            expect(
                match,
                `expected ${fixture.expectedRule} at ${fixture.expectedPath}, got: ${findings
                    .map((finding) => `${finding.path}: ${finding.rule}`)
                    .join(' | ')}`,
            ).toBeDefined();
            expect(main([target])).toBe(1);
        });
    }
});

describe('install pinning pattern — the supply-chain floor', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reach-chan-')));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    function findingsFor(installString: string) {
        const target = path.join(tmp, 'reach-channels.yml');
        fs.writeFileSync(target, registryWithInstall(installString), 'utf-8');
        return validate_file(target).filter((finding) => finding.severity === 'error');
    }

    const ACCEPTED = [
        ['pip-style exact pin', 'pipx install yt-dlp==2026.7.4'],
        ['versioned formula pin', 'brew install node@22'],
        ['winget --version pin', 'winget install --id GitHub.cli --version 2.96.0'],
        ['whitespace-separated exact triple', 'asdf install github-cli 2.96.0'],
        [
            'declared OS baseline sentinel',
            'os-baseline: macOS ships curl at /usr/bin/curl — no package install prescribed',
        ],
    ] as const;

    for (const [label, installString] of ACCEPTED) {
        it(`accepts ${label}`, () => {
            expect(findingsFor(installString)).toEqual([]);
        });
    }

    const REJECTED = [
        ['an unpinned command', 'brew install gh'],
        ['a `latest` tag', 'pipx install yt-dlp@latest'],
        ['a `main` branch source', 'pipx install git+https://example.test/yt-dlp@main'],
        ['a `master` branch source', 'pipx install git+https://example.test/yt-dlp@master'],
        ['a `HEAD` source', 'pipx install git+https://example.test/yt-dlp@HEAD'],
        ['an archive path', 'pipx install https://example.test/archive/refs/tags/v1.2.3'],
        ['a zip source', 'pipx install https://example.test/yt-dlp-1.2.3.zip'],
        ['a tarball source', 'pipx install https://example.test/yt-dlp-1.2.3.tar.gz'],
        ['a piped remote installer', 'curl -fsSL https://example.test/install.sh | sh'],
    ] as const;

    for (const [label, installString] of REJECTED) {
        it(`rejects ${label}`, () => {
            const findings = findingsFor(installString);
            const match = findings.find(
                (finding) =>
                    finding.path === '$.channels[0].backends[0].install.default' &&
                    finding.rule === 'pattern',
            );
            expect(
                match,
                `expected a pattern finding for ${JSON.stringify(installString)}, got: ${findings
                    .map((finding) => `${finding.path}: ${finding.rule}`)
                    .join(' | ')}`,
            ).toBeDefined();
        });
    }
});

describe('printed schema findings are credential-redacted', () => {
    // `main()` writes every violation straight to stdout via `format_finding`,
    // and the Draft-07 `pattern` / `enum` rules quote the OFFENDING VALUE. With
    // the optional path argument (`check_reach_channels <path>`) that made the
    // printer echo a caller-supplied file's bytes verbatim into stdout and into
    // any CI log capturing it — the same class already closed on the grep gate's
    // line echoes, still open here.
    //
    // Both halves are asserted TOGETHER: a redaction that also ate the rule
    // name, the JSON path or the regex would pass a "no secret" assertion while
    // destroying everything the operator came to read.
    const SECRET = 'zzz999topsecret';
    let tmp: string;
    let written: string[];

    beforeEach(() => {
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reach-chan-echo-')));
        written = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
            written.push(String(chunk));
            return true;
        });
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    function runOn(installString: string): { code: number; out: string } {
        const target = path.join(tmp, 'reach-channels.yml');
        fs.writeFileSync(target, registryWithInstall(installString), 'utf-8');
        const code = main([target]);
        return { code, out: written.join('') };
    }

    it('GIVEN a secret in an install command THEN stdout carries <redacted>, never the value', () => {
        const { code, out } = runOn(`brew install curl AWS_SECRET_ACCESS_KEY=${SECRET}`);
        expect(code).toBe(1);
        expect(out).not.toContain(SECRET);
        expect(out).toContain('<redacted>');
        // …and the finding is still navigable: the schema rule and the JSON path.
        expect(out).toContain('pattern:');
        expect(out).toContain('$.channels[0].backends[0].install.default');
        // The key survives, so the operator knows WHICH value to fix.
        expect(out).toContain('AWS_SECRET_ACCESS_KEY=<redacted>');
    });

    it('GIVEN no secret THEN the command and the whole schema regex print intact', () => {
        const { code, out } = runOn('brew install gh');
        expect(code).toBe(1);
        // The actionable command, byte-identical.
        expect(out).toContain("Value 'brew install gh' does not match");
        // The regex the operator has to satisfy, head AND tail — the tail proves
        // `SCHEMA_MESSAGE_MAX_CHARS` did not truncate the rule away.
        expect(out).toContain('\\blatest\\b');
        expect(out).toContain('--version[ =]v?[0-9]+');
        expect(out).toContain('os-baseline: ');
        expect(out).toContain('[^\\n]+)$/');
    });

    it('leaves the real schema pattern byte-identical through the redactor', () => {
        // Read from the schema itself so this cannot drift when the pattern is
        // edited. The regex body contains `--version[ =]v?[0-9]+` and
        // `(?:==|@|=)v?` — exactly the shapes a naive KEY=VALUE or long-run
        // redaction mangles.
        const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8')) as Record<string, unknown>;
        const walk = (node: unknown): string | null => {
            if (node === null || typeof node !== 'object') {
                return null;
            }
            const record = node as Record<string, unknown>;
            if (typeof record['pattern'] === 'string' && record['pattern'].length > 100) {
                return record['pattern'];
            }
            for (const value of Object.values(record)) {
                const hit = walk(value);
                if (hit !== null) {
                    return hit;
                }
            }
            return null;
        };
        const pattern = walk(schema);
        expect(pattern, 'the install pinning pattern must be findable in the schema').toBeTruthy();

        for (const command of [
            'brew install gh',
            'pipx install yt-dlp==2026.7.4',
            'curl -fsSL https://example.test/install.sh | sh',
            'brew install node@22',
            'winget install --id GitHub.cli --version 2.96.0',
        ]) {
            const message = `Value '${command}' does not match /${pattern ?? ''}/`;
            expect(
                excerpt_for_finding(message, SCHEMA_MESSAGE_MAX_CHARS),
                `mangled for ${command}`,
            ).toBe(message);
        }
    });

    it('redacts the probe_cmd-binding message, which quotes two registry fields', () => {
        // The cross-field rule this module owns builds its own message from
        // `probe_cmd` and `id` — file-derived text on the same printer.
        const raw = format_finding(
            new SchemaError(
                '$.channels[0].backends[0].probe_cmd',
                'probe_cmd-binding',
                `probe_cmd 'gh' must equal the backend id 'gh' TOKEN=${SECRET}`,
            ),
        );
        expect(raw).not.toContain(SECRET);
        expect(raw).toContain('TOKEN=<redacted>');
        expect(raw).toContain('probe_cmd-binding');
        expect(raw).toContain('$.channels[0].backends[0].probe_cmd');
    });

    it('still bounds the message — a pathological value cannot dump a paragraph', () => {
        // Filler is `z`: a long run of `a` would be a ≥32-char HEX run and get
        // redacted (correctly) before truncation could be measured.
        const message = `Value '${'z'.repeat(1000)}' does not match /x/`;
        const excerpt = excerpt_for_finding(message, SCHEMA_MESSAGE_MAX_CHARS);
        expect(excerpt).toHaveLength(SCHEMA_MESSAGE_MAX_CHARS + 1); // + the ellipsis marker
        expect(excerpt.endsWith('…')).toBe(true);
        expect(excerpt).not.toContain('z'.repeat(500));
    });
});

describe('probe_args allowlist — the execution surface', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reach-args-')));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    /** A registry whose single backend's probe_args are the variable. */
    function findingsForArgs(args: readonly string[]) {
        const target = path.join(tmp, 'reach-channels.yml');
        fs.writeFileSync(
            target,
            [
                'schema_version: reach-channels-v1',
                '',
                'channels:',
                '  - id: github',
                '    description: Repository metadata from the GitHub API (temp registry).',
                '    tier: free-key',
                '    lifecycle: stable',
                '    override_key: reach.channels.github.backend',
                '    last_verified: "2026-07-24"',
                '    backends:',
                '      - id: gh',
                '        probe_cmd: gh',
                `        probe_args: ${JSON.stringify(args)}`,
                '        install:',
                '          default: asdf install github-cli 2.96.0',
                '',
            ].join('\n'),
            'utf-8',
        );
        return validate_file(target).filter((finding) => finding.severity === 'error');
    }

    // Flag-shaped arguments and bare subcommands: everything a side-effect-free
    // probe legitimately needs.
    const ACCEPTED: readonly (readonly string[])[] = [
        ['--version'],
        ['-V'],
        ['version'],
        ['--help'],
        ['api', 'rate_limit'],
        ['--dump-json'],
        ['-v', '--no-color'],
    ];
    for (const args of ACCEPTED) {
        it(`accepts ${JSON.stringify(args)}`, () => {
            expect(findingsForArgs(args)).toEqual([]);
        });
    }

    // The denylist this replaced admitted EVERY one of these: none contains a
    // shell metacharacter or one of its listed mutating verbs.
    const REJECTED: readonly (readonly [string, readonly string[]])[] = [
        ['a -c shell payload', ['-c', 'cp /etc/passwd /tmp/pwned']],
        ['a bare copy command', ['cp', '/etc/passwd', '/tmp/pwned']],
        ['a cat of a secret file', ['cat', '/Users/someone/.ssh/id_rsa']],
        ['a URL', ['--silent', 'https://attacker.test/exfil']],
        ['a --data-binary body', ['--data-binary', '@/etc/passwd']],
        ['an absolute path', ['/etc/passwd']],
        ['a relative path', ['../../etc/passwd']],
        ['an output redirect target', ['--output', '/tmp/written-by-a-probe']],
        ['a shell metacharacter', ['--version;', 'id']],
        ['an env-var expansion', ['$HOME']],
        ['an empty argument', ['']],
    ];
    for (const [label, args] of REJECTED) {
        it(`rejects ${label}`, () => {
            const findings = findingsForArgs(args);
            const match = findings.find(
                (finding) =>
                    finding.path.startsWith('$.channels[0].backends[0].probe_args[') &&
                    finding.rule === 'pattern',
            );
            expect(
                match,
                `expected a probe_args pattern finding for ${JSON.stringify(args)}, got: ${findings
                    .map((finding) => `${finding.path}: ${finding.rule}`)
                    .join(' | ')}`,
            ).toBeDefined();
        });
    }
});

describe('probe_cmd must equal the backend id', () => {
    it('flags a mismatch on the real code path, with both names in the message', () => {
        const findings = check_probe_cmd_binding({
            channels: [{ id: 'github', backends: [{ id: 'gh', probe_cmd: 'sh' }] }],
        });
        expect(findings).toHaveLength(1);
        expect(findings[0]?.rule).toBe('probe_cmd-binding');
        expect(findings[0]?.path).toBe('$.channels[0].backends[0].probe_cmd');
        expect(findings[0]?.message).toContain("probe_cmd 'sh'");
        expect(findings[0]?.message).toContain("backend id 'gh'");
        expect(findings[0]?.severity).toBe('error');
    });

    it('is silent when they match, and on shapes the schema already reports', () => {
        expect(
            check_probe_cmd_binding({
                channels: [{ id: 'rss', backends: [{ id: 'curl', probe_cmd: 'curl' }] }],
            }),
        ).toEqual([]);
        // No double-reporting: a missing / non-string field is `required`'s job.
        expect(check_probe_cmd_binding({ channels: [{ id: 'x', backends: [{ id: 'gh' }] }] }))
            .toEqual([]);
        expect(check_probe_cmd_binding({ channels: 'not-a-list' })).toEqual([]);
        expect(check_probe_cmd_binding(null)).toEqual([]);
    });

    it('holds on the shipped registry', () => {
        expect(check_probe_cmd_binding(load_registry(REGISTRY_PATH))).toEqual([]);
    });
});

describe('parse failures never echo the file (arbitrary-file-read oracle)', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reach-oracle-')));
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('GIVEN a secrets-shaped file WHEN it fails to parse THEN the message carries the position, never the line', () => {
        const secret = path.join(tmp, 'secrets.env');
        fs.writeFileSync(secret, 'SECRET_LINE_ONE=abc\n\tbad: [indent\n', 'utf-8');

        let message = '';
        try {
            load_registry(secret);
        } catch (err) {
            expect(err).toBeInstanceOf(RegistryLoadError);
            message = (err as Error).message;
        }

        expect(message).not.toBe('');
        expect(message).not.toContain('SECRET_LINE_ONE');
        expect(message).not.toContain('abc');
        // Still actionable: the error class and its position survive.
        expect(message).toContain('not parseable YAML');
        expect(message).toContain('YAMLParseError');
        expect(message).toContain('line 1');
        // One line only — the caret block is what carried the content.
        expect(message.split('\n')).toHaveLength(1);
    });

    it('sanitizeParseError keeps name + first line and drops the rest', () => {
        const err = new Error('first line: the position\n\nSECRET_LINE_ONE=abc\n^');
        err.name = 'YAMLParseError';
        expect(sanitizeParseError(err)).toBe('YAMLParseError: first line: the position');
        // Non-Error throwables are truncated the same way.
        expect(sanitizeParseError('boom\nSECRET_LINE_ONE=abc')).toBe('Error: boom');
    });
});

describe('check_reach_channels — unusable input is exit 3, never "0 violations"', () => {
    beforeEach(() => {
        // The script writes findings to stdout/stderr (house idiom, no-console
        // is an error under eslint) — silence both so the vitest summary stays
        // readable while the exit code is still asserted.
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('throws RegistryLoadError for a missing target', () => {
        expect(() => validate_file(path.join(os.tmpdir(), 'no-such-reach-registry.yml'))).toThrow(
            RegistryLoadError,
        );
    });

    it('returns 3 from the CLI for a missing target', () => {
        expect(main([path.join(os.tmpdir(), 'no-such-reach-registry.yml')])).toBe(3);
    });

    it('returns 3 for unparseable YAML', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-bad-'));
        const target = path.join(tmp, 'broken.yml');
        fs.writeFileSync(target, 'channels: [\n  - id: github\n', 'utf-8');
        try {
            expect(main([target])).toBe(3);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
