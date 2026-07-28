// Tests for src/scripts/check_reach_staleness.ts — the offline staleness gate
// (road-to-internet-reach Phase 7, Step 3).
//
// The assertions pin the finding KIND and its LOCATOR, never merely a non-zero
// exit. A fixture that went red because an unrelated field broke would otherwise
// be scored as a pass — the exact false green this lint exists to prevent.
//
// TIME IS INJECTED, NEVER READ. Every fixture assertion passes an explicit
// `--today` (FIXTURE_TODAY, matching the reference date documented in each
// fixture header). A test that passes today and fails in 91 days is a broken
// test; the only clock-reading path (`today_iso`) is tested against a fixed
// Date instead.
//
// Four layers:
//   1. The real registry passes against a pinned reference date (the gate in
//      `task ci`).
//   2. Each negative fixture fails for its own declared reason, and the control
//      fixture passes — without the control, red fixtures prove only that the
//      lint can say "no".
//   3. Date arithmetic: the 90-day boundary from both sides, and the ISO/YAML
//      timestamp distinction that makes an unquoted date loud instead of fresh.
//   4. CLI contract: exit codes 0 / 1 / 3, `--today` parsing, `--help`.
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { RegistryLoadError, load_registry } from '../../src/scripts/check_reach_channels.js';
import {
    REGISTRY_PATH,
    STALE_AFTER_DAYS,
    check_channels,
    days_between,
    extract_channels,
    main,
    parse_iso_date,
    run_checks,
    today_iso,
    type StalenessFinding,
} from '../../src/scripts/check_reach_staleness.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'reach-staleness');

/**
 * The reference date every fixture header documents. Pinned on purpose: the
 * fixtures encode ages relative to THIS date, not to the wall clock.
 */
const FIXTURE_TODAY = '2026-07-24';

/** Every negative fixture with the single finding it is built to provoke. */
const NEGATIVE_FIXTURES = [
    {
        file: 'stale-last-verified.yml',
        kind: 'stale-verification',
        locator: 'channels[github]',
        why: 'rule (a) — last_verified older than 90 days',
        messageIncludes: '200 days old',
    },
    {
        file: 'deprecated-no-replacement.yml',
        kind: 'deprecated-without-replacement',
        locator: 'channels[legacy-feed]',
        why: 'rule (b) — a deprecated channel with no migration target',
        messageIncludes: 'declares no `replacement:`',
    },
    {
        file: 'removal-overdue.yml',
        kind: 'removal-overdue',
        locator: 'channels[legacy-feed]',
        why: 'rule (c) — past removal_after and still in the registry',
        messageIncludes: 'past its `removal_after` date',
    },
] as const;

function findingsForFixture(file: string): StalenessFinding[] {
    return run_checks({ registryPath: path.join(FIXTURE_DIR, file), today: FIXTURE_TODAY });
}

function describeFindings(findings: readonly StalenessFinding[]): string {
    return findings.map((finding) => `${finding.kind}@${finding.locator}`).join(' | ') || '(none)';
}

/** Silence the script's stdout/stderr writes (no-console is an eslint error). */
function muteOutput(): void {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('reach staleness — the real registry', () => {
    it('passes against the pinned reference date', () => {
        expect(
            describeFindings(run_checks({ registryPath: REGISTRY_PATH, today: FIXTURE_TODAY })),
        ).toBe('(none)');
    });

    it('exits 0 through the CLI entry point', () => {
        muteOutput();
        expect(main(['--today', FIXTURE_TODAY, '--quiet'])).toBe(0);
    });

    it('reads every shipped channel — a gate that scans nothing is not green', () => {
        // Guards the failure mode a green gate cannot distinguish from a correct
        // one: reading zero channels. Uses the shared loader, not a second parser.
        const channels = extract_channels(load_registry(REGISTRY_PATH));
        expect(channels.length).toBeGreaterThan(0);
        expect(channels.map((channel) => channel.id)).toContain('github');
        for (const channel of channels) {
            expect(parse_iso_date(channel.last_verified), channel.id).not.toBeNull();
        }
    });
});

describe('reach staleness — negative fixtures fail for the right reason', () => {
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

        it(`${fixture.file}: that finding is the ONLY one — no collateral rule fired`, () => {
            // Each negative fixture isolates one rule on purpose. If a second
            // finding appears, the fixture stopped proving what it claims.
            expect(describeFindings(findingsForFixture(fixture.file))).toBe(
                `${fixture.kind}@${fixture.locator}`,
            );
        });

        it(`${fixture.file}: exits 1 through the CLI`, () => {
            muteOutput();
            expect(
                main([path.join(FIXTURE_DIR, fixture.file), '--today', FIXTURE_TODAY]),
            ).toBe(1);
        });

        it(`${fixture.file}: the CLI prints the kind and the channel id`, () => {
            const written: string[] = [];
            vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
                written.push(String(chunk));
                return true;
            });
            expect(
                main([path.join(FIXTURE_DIR, fixture.file), '--today', FIXTURE_TODAY]),
            ).toBe(1);
            const output = written.join('');
            expect(output).toContain(`[${fixture.kind}]`);
            expect(output).toContain(fixture.locator);
            expect(output).toContain(fixture.messageIncludes);
        });
    }

    it('fresh-control.yml passes — deprecation alone is not a violation', () => {
        expect(describeFindings(findingsForFixture('fresh-control.yml'))).toBe('(none)');
    });

    it('fresh-control.yml exits 0 through the CLI', () => {
        muteOutput();
        expect(
            main([
                path.join(FIXTURE_DIR, 'fresh-control.yml'),
                '--today',
                FIXTURE_TODAY,
                '--quiet',
            ]),
        ).toBe(0);
    });

    it('fresh-control.yml goes stale once the reference date moves past the floor', () => {
        // Proves the control passes because of the DATE MATH, not because the
        // staleness rule is inert on it.
        const findings = run_checks({
            registryPath: path.join(FIXTURE_DIR, 'fresh-control.yml'),
            today: '2027-07-24',
        });
        expect(findings.map((finding) => finding.kind)).toContain('stale-verification');
    });
});

describe('the three rules, evaluated directly', () => {
    function registry(channel: Record<string, unknown>): unknown {
        return { schema_version: 'reach-channels-v1', channels: [{ id: 'x', ...channel }] };
    }
    const stamp = (iso: string): number => {
        const value = parse_iso_date(iso);
        if (value === null) {
            throw new Error(`bad test date: ${iso}`);
        }
        return value;
    };

    it(`accepts exactly ${STALE_AFTER_DAYS} days of age (the boundary is inclusive)`, () => {
        const findings = check_channels(
            registry({ lifecycle: 'stable', last_verified: '2026-04-25' }),
            stamp('2026-07-24'),
        );
        expect(days_between(stamp('2026-04-25'), stamp('2026-07-24'))).toBe(90);
        expect(describeFindings(findings)).toBe('(none)');
    });

    it(`rejects ${STALE_AFTER_DAYS + 1} days of age`, () => {
        const findings = check_channels(
            registry({ lifecycle: 'stable', last_verified: '2026-04-24' }),
            stamp('2026-07-24'),
        );
        expect(findings[0]?.kind).toBe('stale-verification');
        expect(findings[0]?.message).toContain('91 days old');
    });

    it('accepts a removal date that is exactly today — the window has not closed', () => {
        const findings = check_channels(
            registry({
                lifecycle: 'deprecated',
                last_verified: '2026-07-10',
                removal_after: '2026-07-24',
                replacement: 'rss',
            }),
            stamp('2026-07-24'),
        );
        expect(describeFindings(findings)).toBe('(none)');
    });

    it('rejects a removal date one day in the past', () => {
        const findings = check_channels(
            registry({
                lifecycle: 'deprecated',
                last_verified: '2026-07-10',
                removal_after: '2026-07-23',
                replacement: 'rss',
            }),
            stamp('2026-07-24'),
        );
        expect(findings[0]?.kind).toBe('removal-overdue');
        expect(findings[0]?.message).toContain('1 day(s) past');
    });

    it('reports all three rules independently when a channel breaks all three', () => {
        const findings = check_channels(
            registry({
                lifecycle: 'deprecated',
                last_verified: '2026-01-05',
                removal_after: '2026-06-01',
            }),
            stamp('2026-07-24'),
        );
        expect(findings.map((finding) => finding.kind).sort()).toEqual([
            'deprecated-without-replacement',
            'removal-overdue',
            'stale-verification',
        ]);
    });

    it('does not require a replacement for a non-deprecated channel', () => {
        for (const lifecycle of ['experimental', 'stable', 'community']) {
            expect(
                describeFindings(
                    check_channels(
                        registry({ lifecycle, last_verified: '2026-07-10' }),
                        stamp('2026-07-24'),
                    ),
                ),
                lifecycle,
            ).toBe('(none)');
        }
    });

    it('treats a blank replacement as no replacement', () => {
        const findings = check_channels(
            registry({ lifecycle: 'deprecated', last_verified: '2026-07-10', replacement: '   ' }),
            stamp('2026-07-24'),
        );
        expect(findings[0]?.kind).toBe('deprecated-without-replacement');
    });

    it('flags a missing or unquoted date instead of scoring it fresh', () => {
        expect(
            check_channels(registry({ lifecycle: 'stable' }), stamp('2026-07-24'))[0]?.kind,
        ).toBe('unparseable-date');
        expect(
            check_channels(
                registry({ lifecycle: 'stable', last_verified: new Date('2026-07-10') }),
                stamp('2026-07-24'),
            )[0]?.kind,
        ).toBe('unparseable-date');
        expect(
            check_channels(
                registry({
                    lifecycle: 'stable',
                    last_verified: '2026-07-10',
                    removal_after: '01/06/2026',
                }),
                stamp('2026-07-24'),
            )[0]?.locator,
        ).toBe('channels[x].removal_after');
    });

    it('skips malformed channel entries rather than throwing', () => {
        expect(
            extract_channels({ channels: ['not-a-mapping', null, { id: 'ok' }] }).map(
                (channel) => channel.id,
            ),
        ).toEqual(['ok']);
        expect(extract_channels({}).length).toBe(0);
        expect(extract_channels(null).length).toBe(0);
    });
});

describe('date parsing — ISO strings only', () => {
    it('accepts a real calendar date', () => {
        expect(parse_iso_date('2026-07-24')).toBe(Date.parse('2026-07-24T00:00:00Z'));
    });

    for (const bad of [
        '2026-02-31',
        '2026-13-01',
        '26-07-24',
        '2026-7-4',
        '2026-07-24T00:00:00Z',
        '',
        undefined,
        null,
        20260724,
    ]) {
        it(`rejects ${JSON.stringify(bad)}`, () => {
            expect(parse_iso_date(bad)).toBeNull();
        });
    }

    it('reads the clock in exactly one place, in UTC', () => {
        expect(today_iso(new Date('2026-07-24T23:59:59Z'))).toBe('2026-07-24');
        expect(today_iso(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
    });
});

describe('unusable input is exit 3, never "0 violations"', () => {
    it('throws RegistryLoadError for a missing registry', () => {
        expect(() =>
            run_checks({
                registryPath: path.join(os.tmpdir(), 'no-such-reach-registry.yml'),
                today: FIXTURE_TODAY,
            }),
        ).toThrow(RegistryLoadError);
    });

    it('throws RegistryLoadError for a bad --today value', () => {
        expect(() => run_checks({ registryPath: REGISTRY_PATH, today: 'yesterday' })).toThrow(
            RegistryLoadError,
        );
    });

    it('returns 3 from the CLI for a missing registry', () => {
        muteOutput();
        expect(main([path.join(os.tmpdir(), 'no-such-reach-registry.yml')])).toBe(3);
    });

    it('returns 3 for a malformed --today', () => {
        muteOutput();
        expect(main(['--today', 'not-a-date'])).toBe(3);
    });

    it('returns 3 for --today with no value', () => {
        muteOutput();
        expect(main(['--today'])).toBe(3);
    });

    it('returns 3 for more than one positional path', () => {
        muteOutput();
        expect(main([REGISTRY_PATH, REGISTRY_PATH])).toBe(3);
    });

    it('accepts the --today=<date> form', () => {
        muteOutput();
        expect(main([`--today=${FIXTURE_TODAY}`, '--quiet'])).toBe(0);
        expect(main([path.join(FIXTURE_DIR, 'stale-last-verified.yml'), '--today=2026-07-24'])).toBe(
            1,
        );
    });

    it('documents the three rules and the injected clock in --help', () => {
        const written: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
            written.push(String(chunk));
            return true;
        });
        expect(main(['--help'])).toBe(0);
        const help = written.join('');
        expect(help).toContain('stale-verification');
        expect(help).toContain('deprecated-without-replacement');
        expect(help).toContain('removal-overdue');
        expect(help).toContain('--today');
        expect(help).toContain(String(STALE_AFTER_DAYS));
    });
});
