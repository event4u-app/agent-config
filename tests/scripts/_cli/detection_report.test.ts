/**
 * Phases 3 + 4 of `road-to-zero-ceremony-detection` — the detection report.
 *
 * Fixture-pins the `--json` shape (the agent + GUI contract), asserts that the
 * spend disclosure is rendered from the SAME rows as the table, and pins the
 * consent-gap reporting: detected-but-not-enabled is surfaced, never closed.
 */

import { describe, expect, it } from 'vitest';

import {
    DETECTION_SCHEMA_VERSION,
    absentCouncilFacts,
    buildDetectionReport,
    detectionJson,
    enableInstruction,
    renderDetectionLines,
    renderProviderLine,
    renderSpendDisclosure,
    type CouncilFacts,
    type DetectionReport,
} from '../../../src/scripts/_cli/detection_report.js';
import {
    knownProviders,
    type AuthSource,
    type DetectedAuth,
    type DetectedHost,
    type EnvironmentReport,
} from '../../../src/scripts/_lib/environment_detector.js';

const CONFIG_PATH = '/home/u/.event4u/agent-config/settings/.ai-council.yml';

function host(id: string, binary: string | null, version: string | null = '1.0.0'): DetectedHost {
    return { id, installed: binary !== null, binary, version: binary === null ? null : version };
}

function auth(provider: string, source: AuthSource): DetectedAuth {
    return { provider, source, evidence: `/fixture/${provider}` };
}

function env(opts: { hosts?: DetectedHost[]; auth?: DetectedAuth[] } = {}): EnvironmentReport {
    return { hosts: opts.hosts ?? [], auth: opts.auth ?? [], keys: [] };
}

function council(over: Partial<CouncilFacts> = {}): CouncilFacts {
    return {
        configPath: CONFIG_PATH,
        configPresent: true,
        enabled: true,
        defaultsMode: 'api',
        members: {},
        cliCaps: {},
        costBudgetMaxUsd: 20,
        ...over,
    };
}

function member(enabled: boolean, over: Record<string, unknown> = {}) {
    return { enabled, mode: null, binary: null, apiKeyRef: null, ...over };
}

function rowFor(report: DetectionReport, provider: string) {
    const row = report.providers.find((r) => r.provider === provider);
    if (row === undefined) throw new Error(`no row for ${provider}`);
    return row;
}

describe('report shape', () => {
    it('emits one row per known provider, in a stable order', () => {
        const report = buildDetectionReport({ environment: env(), council: council() });
        expect(report.providers.map((r) => r.provider)).toEqual([...knownProviders()]);
    });

    it('pins the json field set — the agent and GUI contract', () => {
        const report = buildDetectionReport({
            environment: env({
                hosts: [host('claude-code', '/bin/claude', '2.1.0')],
                auth: [auth('anthropic', 'cli-subscription')],
            }),
            council: council({
                members: { anthropic: member(true) },
                cliCaps: { anthropic: 24 },
            }),
            cliCallsUsed: { anthropic: 3 },
        });
        const json = detectionJson(report);

        expect(Object.keys(json)).toEqual([
            'schema_version',
            'council_config_path',
            'council_config_present',
            'council_enabled',
            'defaults_mode',
            'hosts',
            'providers',
            'budgets',
            'spend_disclosure',
        ]);
        expect(json['schema_version']).toBe(DETECTION_SCHEMA_VERSION);

        const providers = json['providers'] as Record<string, unknown>[];
        expect(Object.keys(providers[0] as Record<string, unknown>)).toEqual([
            'provider',
            'detected',
            'authenticated',
            'auth_source',
            'billing',
            'transport',
            'configured_mode',
            'available',
            'enabled_in_config',
            'reason',
            'fix',
            'cli_cap',
            'cli_used',
        ]);

        const hosts = json['hosts'] as Record<string, unknown>[];
        expect(Object.keys(hosts[0] as Record<string, unknown>)).toEqual([
            'id',
            'installed',
            'binary',
            'version',
        ]);

        expect(Object.keys(json['budgets'] as Record<string, unknown>)).toEqual([
            'cost_budget_max_total_usd',
            'cli_call_budget',
        ]);
    });

    it('carries the cli quota counters when the caller supplies them', () => {
        const report = buildDetectionReport({
            environment: env(),
            council: council({ cliCaps: { anthropic: 24 } }),
            cliCallsUsed: { anthropic: 7 },
        });
        expect(rowFor(report, 'anthropic').cliCap).toBe(24);
        expect(rowFor(report, 'anthropic').cliUsed).toBe(7);
        // No cap configured → null, not 0: "unset" and "unused" are different.
        expect(rowFor(report, 'openai').cliCap).toBeNull();
        expect(rowFor(report, 'openai').cliUsed).toBeNull();
    });
});

describe('every unavailable capability carries a non-empty fix', () => {
    const MACHINES: ReadonlyArray<readonly [string, EnvironmentReport, CouncilFacts]> = [
        ['bare / no config', env(), absentCouncilFacts(CONFIG_PATH)],
        ['bare / council disabled', env(), council({ enabled: false })],
        ['bare / council enabled', env(), council()],
        [
            'cli-only, not permitted',
            env({
                hosts: [host('claude-code', '/bin/claude')],
                auth: [auth('anthropic', 'cli-subscription')],
            }),
            council({ members: { anthropic: member(false) } }),
        ],
        [
            'permitted but no transport',
            env(),
            council({ members: { anthropic: member(true) } }),
        ],
        [
            'keys-only, permitted',
            env({ auth: [auth('anthropic', 'key-file')] }),
            council({ members: { anthropic: member(true) } }),
        ],
    ];

    for (const [label, environment, facts] of MACHINES) {
        it(`fixes are present and non-empty — ${label}`, () => {
            const report = buildDetectionReport({ environment, council: facts });
            for (const row of report.providers) {
                const usable = row.available && row.enabledInConfig;
                if (usable) {
                    expect(row.fix, `${label}/${row.provider}`).toBeNull();
                } else {
                    expect((row.fix ?? '').length, `${label}/${row.provider}`).toBeGreaterThan(0);
                }
            }
        });
    }

    it('names the most-blocking cause first — missing config beats everything', () => {
        const report = buildDetectionReport({
            environment: env({
                hosts: [host('claude-code', '/bin/claude')],
                auth: [auth('anthropic', 'cli-subscription')],
            }),
            council: absentCouncilFacts(CONFIG_PATH),
        });
        expect(rowFor(report, 'anthropic').fix).toContain('no council config');
    });

    it('falls to the master switch once a config exists', () => {
        const report = buildDetectionReport({
            environment: env({ auth: [auth('anthropic', 'key-file')] }),
            council: council({ enabled: false, members: { anthropic: member(true) } }),
        });
        expect(rowFor(report, 'anthropic').fix).toBe(`set \`enabled: true\` in ${CONFIG_PATH}`);
    });

    it('names the enable instruction for a detected but unpermitted provider', () => {
        const report = buildDetectionReport({
            environment: env({
                hosts: [host('claude-code', '/bin/claude')],
                auth: [auth('anthropic', 'cli-subscription')],
            }),
            council: council({ members: { anthropic: member(false) } }),
        });
        expect(rowFor(report, 'anthropic').fix).toBe(
            enableInstruction('anthropic', CONFIG_PATH),
        );
        expect(rowFor(report, 'anthropic').fix).toContain('members.anthropic.enabled: true');
    });

    it('prefers the nothing-detected fix over the raw transport reason', () => {
        // Both apply on a bare machine; the install-and-log-in line is the more
        // actionable of the two, so the ladder stops there.
        const report = buildDetectionReport({
            environment: env(),
            council: council({ members: { anthropic: member(true) } }),
        });
        const row = rowFor(report, 'anthropic');
        expect(row.available).toBe(false);
        expect(row.reason).toBeTruthy();
        expect(row.fix).toContain('nothing detected');
        expect(row.fix).toContain('claude');
    });

    it('falls through to the transport reason once something IS detected', () => {
        // Binary present, no credential: "nothing detected" would be false, so
        // the resolver's reason is the only honest fix.
        const report = buildDetectionReport({
            environment: env({ hosts: [host('claude-code', '/bin/claude')] }),
            council: council({ members: { anthropic: member(true) } }),
        });
        const row = rowFor(report, 'anthropic');
        expect(row.detected).toBe(true);
        expect(row.authenticated).toBe(false);
        expect(row.available).toBe(false);
        expect(row.fix).toBe(row.reason);
        expect(row.fix).toContain('not authenticated');
    });
});

describe('detection reports the consent gap — it never closes it', () => {
    const DETECTED_UNPERMITTED = {
        environment: env({
            hosts: [host('claude-code', '/bin/claude')],
            auth: [auth('anthropic', 'cli-subscription')],
        }),
        council: council({ members: { anthropic: member(false) } }),
    };

    it('keeps enabledInConfig false even when everything else is green', () => {
        const row = rowFor(buildDetectionReport(DETECTED_UNPERMITTED), 'anthropic');
        expect(row.detected).toBe(true);
        expect(row.authenticated).toBe(true);
        expect(row.available).toBe(true);
        // Availability is not permission. This is the whole point.
        expect(row.enabledInConfig).toBe(false);
    });

    it('names the gap in the rendered line', () => {
        const row = rowFor(buildDetectionReport(DETECTED_UNPERMITTED), 'anthropic');
        const line = renderProviderLine(row, CONFIG_PATH);
        expect(line).toContain('enabled-in-config ❌');
        expect(line).toContain('not allowed to spend');
        expect(line).toContain('members.anthropic.enabled: true');
    });

    it('excludes an unpermitted provider from the spend disclosure', () => {
        const disclosure = renderSpendDisclosure(buildDetectionReport(DETECTED_UNPERMITTED));
        expect(disclosure).toContain('no member is both enabled and available');
        expect(disclosure).toContain('detected but not allowed to spend: anthropic');
    });

    it('a configured api_key_ref alone is not a resolved key', () => {
        // Every member in the shipped template carries an env: ref whether or
        // not the variable is set — configuration must not read as presence.
        const report = buildDetectionReport({
            environment: env(),
            council: council({
                members: { xai: member(true, { apiKeyRef: 'env:XAI_API_KEY' }) },
            }),
            env: {},
        });
        const row = rowFor(report, 'xai');
        expect(row.detected).toBe(false);
        expect(row.available).toBe(false);
        expect(row.transport).toBeNull();
    });

    it('an env: ref whose variable holds a value DOES resolve', () => {
        const report = buildDetectionReport({
            environment: env(),
            council: council({
                members: { xai: member(true, { apiKeyRef: 'env:XAI_API_KEY' }) },
            }),
            env: { XAI_API_KEY: 'xai-secret' },
        });
        expect(rowFor(report, 'xai').transport).toBe('api');
    });
});

describe('spend disclosure renders from the same rows as the table', () => {
    const MIXED = buildDetectionReport({
        environment: env({
            hosts: [host('claude-code', '/bin/claude'), host('codex', '/bin/codex')],
            auth: [auth('anthropic', 'key-file'), auth('openai', 'cli-subscription')],
        }),
        council: council({
            members: { anthropic: member(true), openai: member(true), gemini: member(false) },
            cliCaps: { openai: 24 },
        }),
        cliCallsUsed: { openai: 5 },
    });

    it('splits metered from subscription exactly as the rows classify them', () => {
        const disclosure = renderSpendDisclosure(MIXED);
        expect(disclosure).toContain('1 metered (per-token): anthropic→api');
        expect(disclosure).toContain('1 on subscription quota: openai→cli (5/24 today)');
    });

    it('names only members that are both enabled and available', () => {
        const disclosure = renderSpendDisclosure(MIXED);
        const spending = MIXED.providers.filter((r) => r.enabledInConfig && r.available);
        for (const r of spending) expect(disclosure).toContain(r.provider);
        for (const r of MIXED.providers.filter((r) => !r.enabledInConfig || !r.available)) {
            // A non-spending provider may still appear in the excluded tail, but
            // never inside a spend segment.
            const segments = disclosure.split('· detected but not allowed to spend:')[0] ?? '';
            expect(segments).not.toContain(`${r.provider}→`);
        }
    });

    it('agrees with the table on every billing class', () => {
        // One report, one classification — the disclosure cannot drift because
        // it reads the same rows the table renders.
        const json = detectionJson(MIXED);
        expect(json['spend_disclosure']).toBe(renderSpendDisclosure(MIXED));
    });

    it('says plainly that nothing will be called when nothing can', () => {
        const none = buildDetectionReport({
            environment: env(),
            council: absentCouncilFacts(CONFIG_PATH),
        });
        expect(renderSpendDisclosure(none)).toContain('no call will be made');
    });

    it('buckets an explicitly manual member as making no provider call', () => {
        const manual = buildDetectionReport({
            environment: env({ auth: [auth('anthropic', 'key-file')] }),
            council: council({ members: { anthropic: member(true, { mode: 'manual' }) } }),
        });
        const row = rowFor(manual, 'anthropic');
        // `auto` never selects manual, so `transport` still reports the rung
        // that COULD work — but `configuredMode` is what will actually run, and
        // the disclosure must bucket by that or it claims an API call that never
        // happens.
        expect(row.transport).toBe('api');
        expect(row.configuredMode).toBe('manual');
        const disclosure = renderSpendDisclosure(manual);
        expect(disclosure).toContain('1 manual (no provider call): anthropic');
        expect(disclosure).not.toContain('metered');
    });

    it('reports a manual member even when no transport could resolve', () => {
        // Nothing installed, no key: `auto` is unavailable, but a manual member
        // is still perfectly usable — the human is the transport.
        const manual = buildDetectionReport({
            environment: env(),
            council: council({ members: { anthropic: member(true, { mode: 'manual' }) } }),
        });
        expect(rowFor(manual, 'anthropic').available).toBe(false);
        expect(renderSpendDisclosure(manual)).toContain('1 manual (no provider call)');
    });

    it('inherits defaults.mode as the configured mode when the member is silent', () => {
        const report = buildDetectionReport({
            environment: env({ auth: [auth('anthropic', 'key-file')] }),
            council: council({ defaultsMode: 'api', members: { anthropic: member(true) } }),
        });
        expect(rowFor(report, 'anthropic').configuredMode).toBe('api');
    });
});

describe('rendered section', () => {
    const REPORT = buildDetectionReport({
        environment: env({
            hosts: [host('claude-code', '/bin/claude', '2.1.0'), host('cursor', null)],
            auth: [auth('anthropic', 'cli-subscription')],
        }),
        council: council({ members: { anthropic: member(true) }, cliCaps: { anthropic: 24 } }),
        cliCallsUsed: { anthropic: 1 },
    });

    it('opens with the section header and the host count', () => {
        const lines = renderDetectionLines(REPORT);
        expect(lines[0]).toBe('detection:');
        expect(lines[1]).toBe('  hosts: 1/2 installed');
    });

    it('lists installed hosts with their version and path', () => {
        expect(renderDetectionLines(REPORT).join('\n')).toContain(
            'claude-code: 2.1.0 (/bin/claude)',
        );
    });

    it('renders budgets, naming an unset cli budget as unset', () => {
        expect(renderDetectionLines(REPORT).join('\n')).toContain(
            'budgets: cost_budget.max_total_usd 20 · cli_call_budget anthropic=24',
        );
        const noBudget = buildDetectionReport({ environment: env(), council: council() });
        expect(renderDetectionLines(noBudget).join('\n')).toContain('cli_call_budget unset');
    });

    it('marks an absent council config as absent rather than omitting it', () => {
        const absent = buildDetectionReport({
            environment: env(),
            council: absentCouncilFacts(CONFIG_PATH),
        });
        expect(renderDetectionLines(absent).join('\n')).toContain(`absent (${CONFIG_PATH})`);
    });

    it('flags an exhausted cli quota', () => {
        const exhausted = buildDetectionReport({
            environment: env({
                hosts: [host('claude-code', '/bin/claude')],
                auth: [auth('anthropic', 'cli-subscription')],
            }),
            council: council({ members: { anthropic: member(true) }, cliCaps: { anthropic: 4 } }),
            cliCallsUsed: { anthropic: 4 },
        });
        expect(renderProviderLine(rowFor(exhausted, 'anthropic'), CONFIG_PATH)).toContain(
            'cli-quota 4/4 ⚠️',
        );
    });
});

describe('a manual member is not told to install a CLI', () => {
    it('needs no binary and no key — the human is the transport', () => {
        const report = buildDetectionReport({
            environment: env(),
            council: council({ members: { anthropic: member(true, { mode: 'manual' }) } }),
        });
        const row = rowFor(report, 'anthropic');
        expect(row.detected).toBe(false);
        // Advice for a transport they explicitly opted out of would be wrong.
        expect(row.fix).toBeNull();
    });

    it('still asks for the enable edit when a manual member is not permitted', () => {
        const report = buildDetectionReport({
            environment: env(),
            council: council({ members: { anthropic: member(false, { mode: 'manual' }) } }),
        });
        expect(rowFor(report, 'anthropic').fix).toBe(
            enableInstruction('anthropic', CONFIG_PATH),
        );
    });
});
