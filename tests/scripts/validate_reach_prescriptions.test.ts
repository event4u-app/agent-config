// Tests for src/scripts/validate_reach_prescriptions.ts — the mechanized
// supply-chain gate (road-to-internet-reach Phase 3, Step 4).
//
// The assertions pin the finding KIND and its LOCATOR, never merely a non-zero
// exit. A fixture that went red because an unrelated required field broke would
// otherwise be scored as a pass, which is exactly the honour system this gate
// replaces.
//
// Four layers:
//   1. The real registry + real intake record pass (the gate in `task ci`).
//   2. Each negative fixture fails for its own declared reason, and the control
//      fixture passes — without the control, red fixtures prove only that the
//      validator can say "no".
//   3. The intake record's own integrity checks fail closed on a half-filled
//      entry (a record that is not evidence must not satisfy the cross-checks).
//   4. The grep gate: scope selection over a temp tree, and the pipe-to-shell
//      rejection the roadmap names explicitly.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RegistryLoadError } from '../../src/scripts/check_reach_channels.js';
import {
    INTAKE_PATH,
    REGISTRY_PATH,
    check_intake_record,
    collect_surfaces,
    excerpt_for_finding,
    has_version_pin,
    is_os_baseline,
    load_intake,
    main,
    moving_targets,
    reach_scope_lines,
    run_checks,
    scan_surface_text,
    type Finding,
    type IntakeRecord,
} from '../../src/scripts/validate_reach_prescriptions.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'reach-prescriptions');

/** Every negative fixture with the single finding it is built to provoke. */
const NEGATIVE_FIXTURES = [
    {
        file: 'unpinned-install.yml',
        kind: 'unpinned-install',
        locator: 'channels[github].backends[gh].install.darwin',
        why: 'rule (a) — an install command with no version specifier',
        messageIncludes: 'no version specifier',
    },
    {
        file: 'archive-source.yml',
        kind: 'moving-target-source',
        locator: 'channels[github].backends[gh].install.darwin',
        why: 'rule (b) — an archive/tarball install source',
        messageIncludes: 'archive/ path',
    },
    {
        file: 'unrecorded-package.yml',
        kind: 'unrecorded-package',
        locator: 'channels[grep-search].backends[rg].install.default',
        why: 'rule (c) — a package absent from the intake record',
        messageIncludes: 'no entry in the intake record',
    },
    {
        file: 'pin-drift.yml',
        kind: 'pin-drift',
        locator: 'channels[youtube].backends[yt-dlp].install.default',
        why: 'traceability — the registry pin is not the verified pin',
        messageIncludes: 'the intake record did not verify',
    },
    {
        file: 'pipe-to-shell.yml',
        kind: 'pipe-to-shell',
        locator: 'tests/fixtures/reach-prescriptions/pipe-to-shell.yml:24',
        why: 'grep gate — a remote fetch piped into a shell',
        messageIncludes: 'straight into an interpreter',
    },
] as const;

/** Findings for one fixture, with the real intake record as the evidence base. */
function findingsForFixture(file: string): Finding[] {
    return run_checks({
        registryPath: path.join(FIXTURE_DIR, file),
        intakePath: INTAKE_PATH,
        surfaceRoot: null,
    });
}

function describeFindings(findings: readonly Finding[]): string {
    return findings.map((finding) => `${finding.kind}@${finding.locator}`).join(' | ') || '(none)';
}

/** Silence the script's stdout/stderr writes (no-console is an eslint error). */
function muteOutput(): void {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
}

describe('reach prescriptions — the real tree', () => {
    it('passes: every install prescription is pinned and intake-recorded', () => {
        expect(
            describeFindings(
                run_checks({ registryPath: REGISTRY_PATH, intakePath: INTAKE_PATH }),
            ),
        ).toBe('(none)');
    });

    it('exits 0 through the CLI entry point', () => {
        muteOutput();
        expect(main(['--quiet'])).toBe(0);
        vi.restoreAllMocks();
    });

    it('records an intake entry for every backend that prescribes an external install', () => {
        // The invariant behind rule (c), asserted on the real content: the two
        // externally installed tools are recorded, and the OS baselines are
        // declared as baselines rather than dressed up as intake entries.
        const intake = load_intake(INTAKE_PATH);
        expect(intake.tools.map((tool) => tool.backend).sort()).toEqual(['gh', 'yt-dlp']);
        expect(intake.os_baseline.map((entry) => entry.tool).sort()).toEqual([
            'curl',
            'jq',
            'node',
        ]);
    });

    it('records a verification command and a pinned version per tool', () => {
        const intake = load_intake(INTAKE_PATH);
        for (const tool of intake.tools) {
            expect(tool.pinned_version, tool.backend).toMatch(/^\d/);
            expect(tool.verification.length, tool.backend).toBeGreaterThan(0);
            for (const entry of tool.verification) {
                expect(entry.command, tool.backend).toBeTruthy();
                expect(entry.observed, `${tool.backend}: ${entry.command}`).toBeTruthy();
            }
        }
    });
});

describe('reach prescriptions — negative fixtures fail for the right reason', () => {
    for (const fixture of NEGATIVE_FIXTURES) {
        it(`${fixture.file}: ${fixture.kind} at ${fixture.locator} (${fixture.why})`, () => {
            const findings = findingsForFixture(fixture.file);
            const match = findings.find(
                (finding) =>
                    finding.kind === fixture.kind && finding.locator === fixture.locator,
            );
            expect(
                match,
                `expected ${fixture.kind} at ${fixture.locator}, got: ${describeFindings(findings)}`,
            ).toBeDefined();
            expect(match?.message).toContain(fixture.messageIncludes);
        });

        it(`${fixture.file}: exits non-zero through the CLI`, () => {
            muteOutput();
            expect(
                main([path.join(FIXTURE_DIR, fixture.file), '--intake', INTAKE_PATH]),
            ).toBe(1);
            vi.restoreAllMocks();
        });
    }

    it('archive-source.yml also catches the @main git reference', () => {
        const findings = findingsForFixture('archive-source.yml');
        const match = findings.find(
            (finding) =>
                finding.kind === 'moving-target-source' &&
                finding.locator === 'channels[github].backends[gh].install.default',
        );
        expect(match, describeFindings(findings)).toBeDefined();
        expect(match?.message).toContain('main');
    });

    it('valid-control.yml passes — the gate is not a blanket reject', () => {
        expect(describeFindings(findingsForFixture('valid-control.yml'))).toBe('(none)');
    });

    it('valid-control.yml exits 0 through the CLI', () => {
        muteOutput();
        expect(
            main([path.join(FIXTURE_DIR, 'valid-control.yml'), '--intake', INTAKE_PATH, '--quiet']),
        ).toBe(0);
        vi.restoreAllMocks();
    });
});

describe('pin classification — the supply-chain floor', () => {
    const PINNED = [
        'pipx install yt-dlp==2026.7.4',
        'brew install node@22',
        'winget install --id GitHub.cli --version 2.96.0',
        'asdf install github-cli 2.96.0',
    ];
    for (const command of PINNED) {
        it(`treats as pinned: ${command}`, () => {
            expect(has_version_pin(command)).toBe(true);
            expect(moving_targets(command)).toEqual([]);
        });
    }

    const UNPINNED = ['brew install gh', 'pipx install yt-dlp', 'cargo install ripgrep'];
    for (const command of UNPINNED) {
        it(`treats as unpinned: ${command}`, () => {
            expect(has_version_pin(command)).toBe(false);
        });
    }

    const MOVING: readonly (readonly [string, string])[] = [
        ['pipx install yt-dlp@latest', 'latest'],
        ['pipx install git+https://example.test/x@main', 'main'],
        ['pipx install git+https://example.test/x@master', 'master'],
        ['pipx install git+https://example.test/x@HEAD', 'HEAD'],
        ['curl -O https://example.test/archive/refs/tags/v1.2.3.tar.gz', 'archive/ path'],
        ['curl -O https://example.test/x-1.2.3.zip', '.zip archive'],
    ];
    for (const [command, token] of MOVING) {
        it(`flags moving target (${token}): ${command}`, () => {
            expect(moving_targets(command)).toContain(token);
        });
    }

    it('recognises the os-baseline sentinel and only the sentinel', () => {
        expect(is_os_baseline('os-baseline: macOS ships curl at /usr/bin/curl')).toBe(true);
        expect(is_os_baseline('brew install gh # os-baseline: nope')).toBe(false);
    });
});

describe('intake record integrity — a half-filled record is not evidence', () => {
    function record(overrides: Partial<IntakeRecord['tools'][number]>): IntakeRecord {
        return {
            tools: [
                {
                    backend: 'gh',
                    pinned_version: '2.96.0',
                    packages: [{ registry: 'asdf', package: 'github-cli' }],
                    intake: {
                        existence_verified: 'checked',
                        pinned: 'checked',
                        lockfile_note: 'checked',
                        cve_note: 'checked',
                    },
                    verified_on: '2026-07-24',
                    verification: [{ command: 'gh --version', observed: '2.96.0' }],
                    ...overrides,
                },
            ],
            os_baseline: [{ tool: 'curl' }],
        };
    }

    it('accepts a complete entry', () => {
        expect(check_intake_record(record({}))).toEqual([]);
    });

    it('rejects a missing checklist outcome', () => {
        const findings = check_intake_record(
            record({
                intake: {
                    existence_verified: 'checked',
                    pinned: 'checked',
                    lockfile_note: 'checked',
                    cve_note: '   ',
                },
            }),
        );
        expect(findings.map((finding) => finding.locator)).toContain('tools[gh].intake.cve_note');
        expect(findings[0]?.kind).toBe('intake-record');
    });

    it('rejects an unquoted (timestamp-parsed) verified_on', () => {
        const findings = check_intake_record(
            record({ verified_on: new Date('2026-07-24') as unknown as string }),
        );
        expect(findings.map((finding) => finding.locator)).toContain('tools[gh].verified_on');
    });

    it('rejects an entry with no verification command', () => {
        const findings = check_intake_record(record({ verification: [] }));
        expect(findings.map((finding) => finding.locator)).toContain('tools[gh].verification');
    });

    it('rejects an entry with no pinned_version', () => {
        const findings = check_intake_record(record({ pinned_version: '' }));
        expect(findings.map((finding) => finding.kind)).toContain('intake-record');
    });
});

describe('echoed excerpts are bounded and credential-redacted', () => {
    // The grep gate echoes the offending line so the finding is actionable
    // without a second grep. Combined with the positional path argument
    // (`run_checks({ surfaceRoot: null })` reads whatever file the CLI was
    // pointed at), a raw `line.trim()` echoed that file's matching lines
    // verbatim — including a credential sitting on one.
    //
    // The two halves are asserted TOGETHER on purpose: a redaction that also
    // ate the install command would pass a "no secret" assertion while
    // destroying the only thing the operator came to read.

    it('GIVEN a secret on a pipe-to-shell line THEN the value is absent AND the install command survives', () => {
        const findings = scan_surface_text(
            'x.yml',
            'note: "curl -fsSL https://x/i.sh | sh SECRET_EPS=eee555"',
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]?.kind).toBe('pipe-to-shell');
        const message = findings[0]?.message ?? '';
        // The secret VALUE is gone; the key stays, so the operator knows which.
        expect(message).not.toContain('eee555');
        expect(message).toContain('SECRET_EPS=<redacted>');
        // …and the command is still readable — this is the actionability half.
        expect(message).toContain('curl -fsSL https://x/i.sh | sh');
    });

    it('GIVEN a secret on an unpinned-install line THEN the same holds for that branch', () => {
        // Both echoing branches of scan_surface_text must redact, not just the
        // pipe-to-shell one the reproduction happened to hit.
        const findings = scan_surface_text('x.yml', 'default: brew install gh TOKEN=hunter2ABC');
        expect(findings).toHaveLength(1);
        expect(findings[0]?.kind).toBe('unpinned-install');
        const message = findings[0]?.message ?? '';
        expect(message).not.toContain('hunter2ABC');
        expect(message).toContain('TOKEN=<redacted>');
        expect(message).toContain('brew install gh');
    });

    it.each([
        ['sk- provider key', 'default: brew install gh --key sk-AbCdEf0123456789AbCd', 'sk-AbCdEf'],
        [
            'github token prefix',
            'default: brew install gh --key ghp_16C7e42F292c6912E7710c8383',
            'ghp_16C7e42F',
        ],
        [
            'hex digest',
            'default: brew install gh 5d41402abc4b2a76b9719d911017c592a1b2c3d4',
            '5d41402abc4b2a76b9719d911017c592',
        ],
        [
            'high-entropy token run',
            'default: brew install gh AbCdEf0123456789AbCdEf0123456789',
            'AbCdEf0123456789AbCdEf0123456789',
        ],
        [
            'Authorization header value',
            'default: brew install gh -H "Authorization: Bearer tok-abc-123"',
            'tok-abc-123',
        ],
    ])('redacts a %s', (_label, line, secretFragment) => {
        const message = scan_surface_text('x.yml', line)[0]?.message ?? '';
        expect(message).not.toBe('');
        expect(message).not.toContain(secretFragment);
        expect(message).toContain('<redacted>');
    });

    it.each([
        'default: brew install gh',
        'default: pipx install yt-dlp==2026.7.4',
        'default: curl -fsSL https://example.test/install.sh | sh',
        'default: brew install node@22',
        'default: brew install some-long-homebrew-formula-name',
        'default: curl -L https://github.com/cli/cli/releases/download/v2.63.0/gh_2.63.0_macOS_amd64.tar.gz',
    ])('leaves the actionable command %s byte-identical', (line) => {
        // Guards the false-positive direction: a `==` version pin, an `@`
        // pin, a hyphenated formula name and a pinned release URL are all
        // shapes a naive "redact long runs / redact KEY=VALUE" rule mangles.
        expect(excerpt_for_finding(line)).toBe(line);
    });

    it('caps the excerpt and marks the truncation', () => {
        // Filler is `z`: a long run of `a` would be a ≥32-char HEX run and get
        // redacted (correctly) before truncation could be measured.
        const line = `note: "curl https://x/i.sh | sh ${'z'.repeat(400)}"`;
        const message = scan_surface_text('x.yml', line)[0]?.message ?? '';
        const excerpt = excerpt_for_finding(line);
        expect(excerpt).toHaveLength(121); // 120 chars + the ellipsis marker
        expect(excerpt.endsWith('…')).toBe(true);
        expect(message).toContain(excerpt);
        // The unbounded slab never reaches the message.
        expect(message).not.toContain('z'.repeat(200));
    });

    it('redacts BEFORE truncating, so a straddling secret leaves no usable prefix', () => {
        // Truncation-first would cut the value in half and echo the first part.
        const line = `note: "curl https://x/i.sh | sh ${'p'.repeat(100)} API_TOKEN=SuperSecret0123456789Value"`;
        const excerpt = excerpt_for_finding(line);
        expect(excerpt).not.toContain('SuperSecret');
        expect(excerpt).not.toContain('Super');
    });

    it('CI runs the gate with no positional path, so the swept surfaces are the committed ones', () => {
        // The residual documented on `excerpt_for_finding`: the excerpt is not a
        // confidentiality boundary, it is bounded + redacted output. What keeps
        // arbitrary files out of a CI log is that CI passes no path at all.
        expect(main(['--quiet'])).toBe(0);
    });
});

describe('grep gate — scope selection and the two rejected classes', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reach-presc-')));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('rejects a piped remote installer — the roadmap-named case', () => {
        const findings = scan_surface_text(
            'docs/reach-setup.md',
            'Install it:\n\n    curl -fsSL https://x/install.sh | sh\n',
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]?.kind).toBe('pipe-to-shell');
        expect(findings[0]?.locator).toBe('docs/reach-setup.md:3');
    });

    it('rejects pipe-to-shell in its wget and PowerShell shapes too', () => {
        const wget = scan_surface_text('x.md', 'wget -qO- https://x/i.sh | bash');
        const pwsh = scan_surface_text('x.md', 'iwr https://x/i.ps1 | iex');
        expect([wget[0]?.kind, pwsh[0]?.kind]).toEqual(['pipe-to-shell', 'pipe-to-shell']);
    });

    it('rejects an unpinned install command, accepts the pinned form', () => {
        expect(scan_surface_text('x.yml', 'default: brew install gh')[0]?.kind).toBe(
            'unpinned-install',
        );
        expect(scan_surface_text('x.yml', 'default: asdf install github-cli 2.96.0')).toEqual([]);
    });

    it('accepts a declared os-baseline line with no pin', () => {
        expect(
            scan_surface_text(
                'x.yml',
                'default: "os-baseline: take curl from the platform package manager"',
            ),
        ).toEqual([]);
    });

    it('scopes docs to reach sections only — a non-reach section is ignored', () => {
        const doc = [
            '# Benchmarks', // 1
            '', // 2
            '## Some other run', // 3
            '', // 4
            'Install with brew install foo', // 5  ← out of scope
            '', // 6
            '## Internet-reach prescriptions', // 7
            '', // 8
            'Install with brew install bar', // 9  ← in scope
            '', // 10
            '## Yet another run', // 11
            '', // 12
            'Install with brew install baz', // 13 ← out of scope again
        ].join('\n');
        const scope = reach_scope_lines('docs/benchmark.md', doc);
        expect(scope.has(5)).toBe(false);
        expect(scope.has(9)).toBe(true);
        expect(scope.has(13)).toBe(false);

        const findings = scan_surface_text('docs/benchmark.md', doc, scope);
        expect(findings.map((finding) => finding.locator)).toEqual(['docs/benchmark.md:9']);
    });

    it('scopes a reach-named docs file in full', () => {
        const scope = reach_scope_lines('docs/decisions/ADR-126-internet-reach.md', 'a\nb\nc');
        expect([...scope].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    });

    it('collects exactly src/config/reach-*.yml plus docs markdown', () => {
        fs.mkdirSync(path.join(tmp, 'src', 'config'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'docs', 'nested'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'src', 'config', 'reach-channels.yml'), 'a: 1');
        fs.writeFileSync(path.join(tmp, 'src', 'config', 'other-config.yml'), 'a: 1');
        fs.writeFileSync(path.join(tmp, 'docs', 'nested', 'guide.md'), '# x');
        fs.writeFileSync(path.join(tmp, 'docs', 'not-markdown.txt'), 'x');

        expect(collect_surfaces(tmp).map((surface) => surface.rel)).toEqual([
            path.join('src', 'config', 'reach-channels.yml'),
            path.join('docs', 'nested', 'guide.md'),
        ]);
    });

    it('sweeps the real repo scope, which is non-empty and includes both configs', () => {
        // Guards the failure mode a green gate cannot distinguish from a
        // correct one: scanning nothing at all.
        const rels = collect_surfaces(REPO_ROOT).map((surface) => surface.rel);
        expect(rels).toContain(path.join('src', 'config', 'reach-channels.yml'));
        expect(rels).toContain(path.join('src', 'config', 'reach-prescriptions-intake.yml'));
        expect(rels.filter((rel) => rel.startsWith('docs')).length).toBeGreaterThan(10);
    });
});

describe('unusable input is exit 3, never "0 violations"', () => {
    beforeEach(muteOutput);
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('throws RegistryLoadError for a missing intake record', () => {
        expect(() =>
            run_checks({
                registryPath: REGISTRY_PATH,
                intakePath: path.join(os.tmpdir(), 'no-such-reach-intake.yml'),
            }),
        ).toThrow(RegistryLoadError);
    });

    it('returns 3 from the CLI for a missing registry', () => {
        expect(main([path.join(os.tmpdir(), 'no-such-reach-registry.yml')])).toBe(3);
    });

    it('returns 3 for a missing intake record', () => {
        expect(
            main([REGISTRY_PATH, '--intake', path.join(os.tmpdir(), 'no-such-intake.yml')]),
        ).toBe(3);
    });

    it('returns 3 for more than one positional path', () => {
        expect(main([REGISTRY_PATH, REGISTRY_PATH])).toBe(3);
    });

    it('returns 3 for --intake with no value', () => {
        expect(main([REGISTRY_PATH, '--intake'])).toBe(3);
    });

    it('GIVEN --intake pointed at a secrets-shaped file THEN the parse error never echoes its content', () => {
        // `--intake <path>` reads an arbitrary file, so a `String(err)` on a
        // YAMLParseError (which appends the offending source line and a caret)
        // turned this flag into an arbitrary-file-read oracle.
        const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reach-intake-oracle-')));
        const secret = path.join(tmp, 'secrets.env');
        fs.writeFileSync(secret, 'SECRET_LINE_ONE=abc\n\tbad: [indent\n', 'utf-8');
        try {
            let message = '';
            try {
                load_intake(secret);
            } catch (err) {
                expect(err).toBeInstanceOf(RegistryLoadError);
                message = (err as Error).message;
            }
            expect(message).toContain('intake record is not parseable YAML');
            expect(message).not.toContain('SECRET_LINE_ONE');
            expect(message).not.toContain('abc');
            expect(message.split('\n')).toHaveLength(1);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('prints the documented grep-gate scope in --help', () => {
        const written: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
            written.push(String(chunk));
            return true;
        });
        expect(main(['--help'])).toBe(0);
        const help = written.join('');
        expect(help).toContain('src/config/reach-*.yml');
        expect(help).toContain('docs/**/*.md');
        expect(help).toContain('pipe-to-shell');
        vi.restoreAllMocks();
    });
});
