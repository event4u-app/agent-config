/**
 * Fleet rollout — road-to-flow-learnings Phase 1.
 *
 * Exit-gate fixture: ≥3 repos with one seeded failure — the failing repo
 * is reported red with its finding, siblings stay green, and the
 * aggregate JSON is schema-valid.
 */

import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    FleetConfigError,
    parseFleetSpec,
    runFleet,
    validateFleetReport,
    type FleetCommands,
} from '../../../src/scripts/_cli/cmd_fleet.js';

let tmp: string;

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fleet-'));
});

afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

/** Stub install/conformance: tiny scripts so no real installer ever runs. */
function stubCommands(opts: { installExit?: number; conformanceExit?: number } = {}): FleetCommands {
    const mk = (name: string, exit: number): string => {
        const p = join(tmp, `${name}-${exit}.cjs`);
        writeFileSync(p, `console.log('${name} ran; note line'); process.exit(${exit});`);
        return p;
    };
    const install = mk('install', opts.installExit ?? 0);
    const conformance = mk('conformance', opts.conformanceExit ?? 0);
    return {
        installArgv: () => [process.execPath, install],
        conformanceArgv: () => [process.execPath, conformance],
    };
}

function mkRepo(name: string): string {
    const p = join(tmp, name);
    mkdirSync(p, { recursive: true });
    return p;
}

describe('parseFleetSpec', () => {
    it('parses path strings and {path, tools} mappings, defaults concurrency to 3', () => {
        const spec = parseFleetSpec(
            ['repos:', '  - repo-a', '  - path: repo-b', '    tools: claude-code,cursor'].join('\n'),
            tmp,
        );
        expect(spec.maxConcurrency).toBe(3);
        expect(spec.repos).toHaveLength(2);
        expect(spec.repos[0]?.path).toBe(join(tmp, 'repo-a'));
        expect(spec.repos[1]?.tools).toBe('claude-code,cursor');
    });

    it('honors max_concurrency', () => {
        const spec = parseFleetSpec('repos:\n  - a\nmax_concurrency: 1\n', tmp);
        expect(spec.maxConcurrency).toBe(1);
    });

    it.each([
        ['not yaml mapping', '- just\n- a list\n'],
        ['empty repos', 'repos: []\n'],
        ['missing path', 'repos:\n  - tools: x\n'],
        ['bad concurrency', 'repos:\n  - a\nmax_concurrency: 0\n'],
    ])('rejects malformed config: %s', (_name, text) => {
        expect(() => parseFleetSpec(text, tmp)).toThrow(FleetConfigError);
    });
});

describe('runFleet — exit-gate fixture', () => {
    it('isolates one seeded failure across ≥3 repos; aggregate is schema-valid', async () => {
        const good1 = mkRepo('good-1');
        const good2 = mkRepo('good-2');
        // Seeded failure: the repo path does not exist at all.
        const missing = join(tmp, 'seeded-missing');

        const report = await runFleet(
            {
                repos: [{ path: good1 }, { path: missing }, { path: good2 }],
                maxConcurrency: 3,
            },
            { commands: stubCommands(), timeoutMs: 30_000 },
        );

        expect(validateFleetReport(report)).toEqual([]);
        expect(report.status).toBe('fail');
        expect(report.repos).toHaveLength(3);

        const byPath = new Map(report.repos.map((r) => [r.path, r]));
        const failed = byPath.get(missing);
        expect(failed?.status).toBe('preflight-failed');
        expect(failed?.findings.some((f) => f.severity === 'blocking')).toBe(true);
        expect(byPath.get(good1)?.status).toBe('ok');
        expect(byPath.get(good2)?.status).toBe('ok');
        // Green repos carried a conformance result; the failed one never ran it.
        expect(byPath.get(good1)?.conformance?.exit).toBe(0);
        expect(failed?.conformance).toBeNull();
    });

    it('reports install failures without aborting siblings', async () => {
        const a = mkRepo('a');
        const b = mkRepo('b');
        const failingInstall = stubCommands({ installExit: 3 });
        const okCommands = stubCommands();
        // Per-repo command switch: repo `a` gets the failing installer.
        const commands: FleetCommands = {
            installArgv: (repo) =>
                repo.path === a ? failingInstall.installArgv(repo) : okCommands.installArgv(repo),
            conformanceArgv: (repo) => okCommands.conformanceArgv(repo),
        };
        const report = await runFleet(
            { repos: [{ path: a }, { path: b }], maxConcurrency: 2 },
            { commands, timeoutMs: 30_000 },
        );
        expect(report.repos.find((r) => r.path === a)?.status).toBe('install-failed');
        expect(report.repos.find((r) => r.path === b)?.status).toBe('ok');
    });

    it('flags conformance-red repos distinctly', async () => {
        const a = mkRepo('conf-red');
        const report = await runFleet(
            { repos: [{ path: a }], maxConcurrency: 1 },
            { commands: stubCommands({ conformanceExit: 1 }), timeoutMs: 30_000 },
        );
        const r = report.repos[0];
        expect(r?.status).toBe('conformance-failed');
        expect(r?.conformance?.exit).toBe(1);
        expect(r?.conformance?.note).toContain('conformance ran');
    });

    it('respects the concurrency bound (serial run with cap 1 still completes all)', async () => {
        const repos = ['r1', 'r2', 'r3', 'r4'].map((n) => ({ path: mkRepo(n) }));
        const report = await runFleet(
            { repos, maxConcurrency: 1 },
            { commands: stubCommands(), timeoutMs: 30_000 },
        );
        expect(report.repos).toHaveLength(4);
        expect(report.status).toBe('ok');
    });

    it('treats an unwritable repo as a blocking pre-flight finding', async () => {
        const locked = mkRepo('locked');
        chmodSync(locked, 0o555);
        try {
            const report = await runFleet(
                { repos: [{ path: locked }], maxConcurrency: 1 },
                { commands: stubCommands(), timeoutMs: 30_000 },
            );
            expect(report.repos[0]?.status).toBe('preflight-failed');
        } finally {
            chmodSync(locked, 0o755);
        }
    });
});

describe('validateFleetReport', () => {
    it('rejects wrong shapes with named problems', () => {
        expect(validateFleetReport(null)).toContain('report is not an object');
        expect(validateFleetReport({ schema_version: 2, ts: 'x', repos: 'nope' }).length)
            .toBeGreaterThan(0);
    });
});
