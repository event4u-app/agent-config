/**
 * Phase 1 of `road-to-zero-ceremony-detection` — the detector's fixture suite.
 *
 * Five synthetic machines (bare · cli-only · keys-only · mixed ·
 * unreadable-credential-file), the static no-network property, and the
 * version-shape table, plus the macOS Keychain rung for the anthropic
 * subscription. Every case injects `home` / `pathEnv` / `env`, a stub version
 * probe AND a stub Keychain probe, so nothing here touches the developer's real
 * machine — the Keychain probe in particular defaults to shelling out to
 * `security`, which would otherwise let a subscribed laptop decide outcomes.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    PROVIDER_CLI_META,
    classifyBilling,
    codexHome,
    detectEnvironment,
    isCommunityCli,
    knownProviders,
    resetEnvironmentCache,
    strongestAuth,
    type DetectEnvironmentOptions,
    type EnvironmentReport,
} from '../../../src/scripts/_lib/environment_detector.js';

const DETECTOR_SRC = path.join(
    process.cwd(),
    'src',
    'scripts',
    '_lib',
    'environment_detector.ts',
);

let root: string;

/** Absolute path inside the synthetic machine, parents created. */
function put(rel: string, contents = '{}'): string {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
    return full;
}

/** A fake executable on the synthetic machine's `$PATH`. */
function putBin(name: string): string {
    const full = path.join(root, 'bin', name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '#!/bin/sh\n');
    fs.chmodSync(full, 0o755);
    return full;
}

/** Options for a synthetic machine: injected home, PATH, env, stub probe. */
function machine(extraEnv: Record<string, string> = {}): DetectEnvironmentOptions {
    return {
        home: root,
        pathEnv: path.join(root, 'bin'),
        env: {
            HOME: root,
            // Keeps key-file resolution inside the fixture.
            EVENT4U_CONFIG_HOME: path.join(root, '.event4u', 'agent-config'),
            ...extraEnv,
        },
        probeVersion: () => 'stub 1.2.3\n',
        // This suite's whole contract is that no case touches the developer's
        // real machine. The Keychain probe defaults to shelling out to
        // `security`, so a macOS machine holding a Claude subscription would
        // otherwise inject a `cli-subscription` auth into the `bare` and
        // `keys-only` fixtures and make their outcome depend on who ran them.
        probeKeychain: () => false,
    };
}

function sourcesFor(report: EnvironmentReport, provider: string): string[] {
    return report.auth.filter((a) => a.provider === provider).map((a) => a.source).sort();
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'envdet-'));
    resetEnvironmentCache();
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resetEnvironmentCache();
});

/**
 * Hosts whose signal table uses only `homePaths` / `bins` — fully suppressible
 * by an injected `home` + `pathEnv`. The remaining ids also carry `absPaths`
 * (macOS `/Applications/*.app` bundles), which are machine-absolute by design
 * and therefore outside a fixture's control: on a developer's own laptop a
 * "bare" machine can still legitimately report `cursor` installed. Asserting
 * those false would make this suite pass or fail on the runner's app list.
 */
const HOME_AND_PATH_ONLY_HOSTS: readonly string[] = [
    'claude-code',
    'cline',
    'gemini-cli',
    'copilot',
    'augment',
    'aider',
    'codex',
    'roocode',
    'continue',
    'kilocode',
    'jetbrains',
    'opencode',
    'codebuddy',
    'droid',
];

describe('synthetic machine: bare', () => {
    it('reports every host and finds no auth and no keys', () => {
        const report = detectEnvironment(machine());

        expect(report.auth).toEqual([]);
        expect(report.keys).toEqual([]);
        // Every known host is still present in the report — absence is
        // reported as installed:false, never as a missing row.
        expect(report.hosts).toHaveLength(23);
        for (const id of HOME_AND_PATH_ONLY_HOSTS) {
            expect(report.hosts.find((h) => h.id === id)?.installed).toBe(false);
        }
        // `$PATH` IS injected, so binary resolution is fully controlled: no
        // host may resolve a binary, and therefore none may carry a version.
        expect(report.hosts.every((h) => h.binary === null)).toBe(true);
        expect(report.hosts.every((h) => h.version === null)).toBe(true);
    });

    it('covers every known host id across the two signal classes', () => {
        const report = detectEnvironment(machine());
        const ids = report.hosts.map((h) => h.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of HOME_AND_PATH_ONLY_HOSTS) expect(ids).toContain(id);
    });
});

describe('synthetic machine: cli-only', () => {
    it('classifies a vendor CLI login as cli-subscription and unmetered', () => {
        putBin('claude');
        put(path.join('.claude', '.credentials.json'));
        const report = detectEnvironment(machine());

        expect(sourcesFor(report, 'anthropic')).toEqual(['cli-subscription']);
        expect(report.keys).toEqual([]);
        const strongest = strongestAuth(report, 'anthropic');
        expect(strongest?.source).toBe('cli-subscription');
        expect(classifyBilling('anthropic', strongest?.source ?? null)).toBe('subscription');

        const claudeCode = report.hosts.find((h) => h.id === 'claude-code');
        expect(claudeCode?.installed).toBe(true);
        expect(claudeCode?.binary).toBe(path.join(root, 'bin', 'claude'));
        expect(claudeCode?.version).toBe('1.2.3');
    });

    it('reads a codex auth.json with OAuth tokens as cli-subscription', () => {
        put(path.join('.codex', 'auth.json'), JSON.stringify({ tokens: { id_token: 'x' } }));
        const report = detectEnvironment(machine());

        expect(sourcesFor(report, 'openai')).toEqual(['cli-subscription']);
        expect(classifyBilling('openai', 'cli-subscription')).toBe('subscription');
    });

    it('reads a codex auth.json holding an api key as cli-api-key — metered', () => {
        put(path.join('.codex', 'auth.json'), JSON.stringify({ OPENAI_API_KEY: 'sk-x' }));
        const report = detectEnvironment(machine());

        expect(sourcesFor(report, 'openai')).toEqual(['cli-api-key']);
        expect(classifyBilling('openai', 'cli-api-key')).toBe('per-token');
    });

    it('honours CODEX_HOME over the default ~/.codex', () => {
        const alt = path.join(root, 'alt-codex');
        put(path.join('alt-codex', 'auth.json'), JSON.stringify({ tokens: { a: 1 } }));
        const report = detectEnvironment(machine({ CODEX_HOME: alt }));

        expect(report.auth.find((a) => a.provider === 'openai')?.evidence).toBe(
            path.join(alt, 'auth.json'),
        );
        expect(codexHome({ CODEX_HOME: alt })).toBe(alt);
    });

    it('does not credit a community CLI with a subscription', () => {
        putBin('grok');
        const report = detectEnvironment(machine());

        // A community wrapper has no subscription login to detect at all.
        expect(sourcesFor(report, 'xai')).toEqual([]);
        expect(classifyBilling('xai', 'cli-subscription')).toBe('per-token');
    });
});

describe('synthetic machine: keys-only', () => {
    it('reports a key file with an api_key_ref-shaped ref', () => {
        put(path.join('.event4u', 'agent-config', 'anthropic.key'), 'sk-ant-x');
        const report = detectEnvironment(machine());

        expect(sourcesFor(report, 'anthropic')).toEqual(['key-file']);
        expect(report.keys).toEqual([{ provider: 'anthropic', ref: 'file:anthropic.key' }]);
        expect(classifyBilling('anthropic', 'key-file')).toBe('per-token');
    });

    it('reports an env key with an env: ref and ignores an empty value', () => {
        const report = detectEnvironment(
            machine({ OPENAI_API_KEY: 'sk-x', GEMINI_API_KEY: '   ' }),
        );

        expect(sourcesFor(report, 'openai')).toEqual(['env-key']);
        expect(sourcesFor(report, 'gemini')).toEqual([]);
        expect(report.keys).toEqual([{ provider: 'openai', ref: 'env:OPENAI_API_KEY' }]);
    });
});

describe('synthetic machine: mixed', () => {
    it('records every source and ranks the vendor CLI login strongest', () => {
        putBin('claude');
        put(path.join('.claude', '.credentials.json'));
        put(path.join('.event4u', 'agent-config', 'anthropic.key'), 'sk-ant-x');
        const report = detectEnvironment(machine({ ANTHROPIC_API_KEY: 'sk-ant-env' }));

        expect(sourcesFor(report, 'anthropic')).toEqual([
            'cli-subscription',
            'env-key',
            'key-file',
        ]);
        expect(strongestAuth(report, 'anthropic')?.source).toBe('cli-subscription');
        // Both key shapes are still offered as refs — detection reports, it
        // does not choose for the user.
        expect(report.keys).toEqual([
            { provider: 'anthropic', ref: 'file:anthropic.key' },
            { provider: 'anthropic', ref: 'env:ANTHROPIC_API_KEY' },
        ]);
    });
});

describe('synthetic machine: unreadable-credential-file', () => {
    it('over-gates malformed codex auth.json to cli-api-key instead of throwing', () => {
        put(path.join('.codex', 'auth.json'), 'not json at all {{{');
        const report = detectEnvironment(machine());

        expect(sourcesFor(report, 'openai')).toEqual(['cli-api-key']);
        expect(classifyBilling('openai', 'cli-api-key')).toBe('per-token');
    });

    it('treats an empty-object auth.json as metered, not as a plan', () => {
        put(path.join('.codex', 'auth.json'), '{}');
        expect(sourcesFor(detectEnvironment(machine()), 'openai')).toEqual(['cli-api-key']);
    });

    it('survives an auth.json whose tokens field is the wrong type', () => {
        put(path.join('.codex', 'auth.json'), JSON.stringify({ tokens: 'nope' }));
        expect(sourcesFor(detectEnvironment(machine()), 'openai')).toEqual(['cli-api-key']);
    });

    it('survives a key path that exists as a directory, not a file', () => {
        fs.mkdirSync(path.join(root, '.event4u', 'agent-config', 'openai.key'), {
            recursive: true,
        });
        expect(() => detectEnvironment(machine())).not.toThrow();
    });
});

describe('billing classification never depends on transport', () => {
    it('takes exactly (provider, source) — there is no transport parameter', () => {
        expect(classifyBilling.length).toBe(2);
    });

    it('is fully determined by (provider, source) across every combination', () => {
        const sources = ['cli-subscription', 'cli-api-key', 'key-file', 'env-key'] as const;
        for (const provider of knownProviders()) {
            for (const source of sources) {
                const first = classifyBilling(provider, source);
                // Same inputs, same answer — no ambient transport state can
                // move it between calls.
                expect(classifyBilling(provider, source)).toBe(first);
                const expected =
                    source === 'cli-subscription' && !isCommunityCli(provider)
                        ? 'subscription'
                        : 'per-token';
                expect(first).toBe(expected);
            }
        }
    });

    it('over-gates an unknown source to per-token', () => {
        for (const provider of knownProviders()) {
            expect(classifyBilling(provider, null)).toBe('per-token');
        }
    });

    it('keeps the vendor-official vs community split the billing rules depend on', () => {
        expect(PROVIDER_CLI_META['anthropic']).toEqual(['claude', false]);
        expect(PROVIDER_CLI_META['openai']).toEqual(['codex', false]);
        expect(PROVIDER_CLI_META['gemini']).toEqual(['gemini', false]);
        expect(PROVIDER_CLI_META['xai']).toEqual(['grok', true]);
        expect(PROVIDER_CLI_META['perplexity']).toEqual(['perplexity', true]);
        // Community CLIs stay metered even on their own CLI transport.
        expect(classifyBilling('xai', 'cli-subscription')).toBe('per-token');
        expect(classifyBilling('perplexity', 'cli-subscription')).toBe('per-token');
    });

    it('does not mention a transport or mode term in the billing section', () => {
        const src = fs.readFileSync(DETECTOR_SRC, 'utf-8');
        const start = src.indexOf('export function classifyBilling');
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, src.indexOf('\n}', start));
        expect(body).not.toMatch(/\btransport\b/);
        expect(body).not.toMatch(/\bmode\b/);
    });
});

describe('static property: read-only and spend-free', () => {
    /** Modules that would make the detector capable of network I/O. */
    const FORBIDDEN_IMPORTS = [
        'node:http',
        'node:https',
        'node:net',
        'node:tls',
        'node:dgram',
        'node:http2',
        'undici',
        'axios',
        'node-fetch',
        // The council client layer is the billable path — importing it here
        // would put a spend-capable call one function away from a "read-only"
        // module.
        'ai_council/clients',
        'ai_council/orchestrator',
    ];

    function importSpecifiers(src: string): string[] {
        const out: string[] = [];
        const re = /(?:^|\n)\s*import[^;]*?from\s+['"]([^'"]+)['"]/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) out.push(m[1] as string);
        const dyn = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((m = dyn.exec(src)) !== null) out.push(m[1] as string);
        const req = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((m = req.exec(src)) !== null) out.push(m[1] as string);
        return out;
    }

    it('imports nothing that performs network I/O or reaches a billable call', () => {
        const specifiers = importSpecifiers(fs.readFileSync(DETECTOR_SRC, 'utf-8'));
        expect(specifiers.length).toBeGreaterThan(0);
        for (const spec of specifiers) {
            for (const forbidden of FORBIDDEN_IMPORTS) {
                expect(spec).not.toContain(forbidden);
            }
        }
    });

    it('fails when a network import is added', () => {
        // The check above is only meaningful if it can go red. Prove it does.
        const poisoned = "import * as https from 'node:https';\n";
        const specifiers = importSpecifiers(poisoned);
        expect(specifiers).toContain('node:https');
        const violations = specifiers.filter((s) =>
            FORBIDDEN_IMPORTS.some((f) => s.includes(f)),
        );
        expect(violations).toEqual(['node:https']);
    });

    it('never calls fetch, and every spawn site is a read-only probe', () => {
        const src = fs.readFileSync(DETECTOR_SRC, 'utf-8');
        expect(src).not.toMatch(/\bfetch\s*\(/);
        expect(src).not.toMatch(/\bexecSync\s*\(/);
        // TWO spawn call sites, both read-only: the version probe and the
        // macOS Keychain presence probe. The count is pinned deliberately —
        // a third one appearing should force a reviewer to justify it here.
        expect(src.match(/spawnSync\(/g)).toHaveLength(2);
        expect(src).toContain("['--version']");
        expect(src).toContain("'find-generic-password'");
    });

    it('the Keychain probe never asks for the secret itself', () => {
        const src = fs.readFileSync(DETECTOR_SRC, 'utf-8');
        // `security find-generic-password -w` PRINTS the password to stdout.
        // Without `-w` it prints attributes only, so presence is read from the
        // exit code and the credential cannot reach a log, a detection report,
        // or a crash dump. This is the security property of the probe, so it
        // gets its own witness rather than riding along in the argv check.
        expect(src).not.toMatch(/'find-generic-password',\s*'-w'/);
        expect(src).not.toMatch(/'-w',\s*'-s'/);
    });
});

describe('version extraction', () => {
    const SHAPES: ReadonlyArray<readonly [string, string, string]> = [
        ['bare semver', '1.2.3', '1.2.3'],
        ['claude-style suffix', '1.0.60 (Claude Code)', '1.0.60'],
        ['v-prefixed', 'v2.14.0\n', '2.14.0'],
        ['name then version', 'codex-cli 0.9\n', '0.9'],
        ['stderr-only output', '\ngemini 3.11.4', '3.11.4'],
    ];

    for (const [label, output, expected] of SHAPES) {
        it(`parses ${label}`, () => {
            putBin('claude');
            const report = detectEnvironment({ ...machine(), probeVersion: () => output });
            expect(report.hosts.find((h) => h.id === 'claude-code')?.version).toBe(expected);
        });
    }

    it("degrades an unparseable version to 'unknown' instead of throwing", () => {
        putBin('claude');
        const report = detectEnvironment({
            ...machine(),
            probeVersion: () => 'no digits here',
        });
        expect(report.hosts.find((h) => h.id === 'claude-code')?.version).toBe('unknown');
    });

    it("degrades a failed probe to 'unknown'", () => {
        putBin('claude');
        const report = detectEnvironment({ ...machine(), probeVersion: () => null });
        expect(report.hosts.find((h) => h.id === 'claude-code')?.version).toBe('unknown');
    });

    it("degrades a throwing probe to 'unknown' rather than propagating", () => {
        putBin('claude');
        const report = detectEnvironment({
            ...machine(),
            probeVersion: () => {
                throw new Error('wedged binary');
            },
        });
        expect(report.hosts.find((h) => h.id === 'claude-code')?.version).toBe('unknown');
    });

    it('leaves version null for a host detected without a binary on PATH', () => {
        fs.mkdirSync(path.join(root, '.cursor'), { recursive: true });
        const report = detectEnvironment(machine());
        const cursor = report.hosts.find((h) => h.id === 'cursor');
        expect(cursor?.installed).toBe(true);
        expect(cursor?.binary).toBeNull();
        expect(cursor?.version).toBeNull();
    });
});

describe('per-process cache', () => {
    it('reuses one snapshot for the no-argument call', () => {
        expect(detectEnvironment()).toBe(detectEnvironment());
    });

    it('bypasses the cache when options are injected', () => {
        const a = detectEnvironment(machine());
        const b = detectEnvironment(machine());
        expect(a).not.toBe(b);
        expect(a).toEqual(b);
    });

    it('drops the snapshot on reset', () => {
        const first = detectEnvironment();
        resetEnvironmentCache();
        expect(detectEnvironment()).not.toBe(first);
    });
});

// === the macOS Keychain rung for the anthropic subscription ===============

describe('anthropic cli-subscription — Keychain vs credential file', () => {
    it('a Keychain hit is a cli-subscription, and its evidence is a locator not a secret', () => {
        const report = detectEnvironment({ ...machine(), probeKeychain: () => true });
        expect(sourcesFor(report, 'anthropic')).toEqual(['cli-subscription']);
        const strongest = strongestAuth(report, 'anthropic');
        expect(strongest?.evidence).toBe('keychain:Claude Code-credentials');
        // The whole point of the rung: this member costs the subscription, not
        // per-token billing.
        expect(classifyBilling('anthropic', strongest?.source ?? null)).toBe('subscription');
    });

    it('the Keychain outranks a stored API key — otherwise the paid rung wins on a subscribed machine', () => {
        put(path.join('.event4u', 'agent-config', 'anthropic.key'), 'sk-ant-x');
        const report = detectEnvironment({ ...machine(), probeKeychain: () => true });
        expect(strongestAuth(report, 'anthropic')?.source).toBe('cli-subscription');
    });

    it('no Keychain and no credential file leaves the key file as the only auth', () => {
        put(path.join('.event4u', 'agent-config', 'anthropic.key'), 'sk-ant-x');
        const report = detectEnvironment({ ...machine(), probeKeychain: () => false });
        expect(sourcesFor(report, 'anthropic')).toEqual(['key-file']);
        expect(classifyBilling('anthropic', 'key-file')).toBe('per-token');
    });

    it('the credential FILE still wins when present — the Keychain is an additional rung, not a replacement', () => {
        put(path.join('.claude', '.credentials.json'));
        const report = detectEnvironment({ ...machine(), probeKeychain: () => true });
        const strongest = strongestAuth(report, 'anthropic');
        expect(strongest?.source).toBe('cli-subscription');
        expect(strongest?.evidence).toContain('.credentials.json');
    });
});
