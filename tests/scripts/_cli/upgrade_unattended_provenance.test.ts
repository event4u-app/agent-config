/**
 * Step 2.1 — the provenance gate as the unattended run actually reaches it.
 *
 * `provenance_verify` is tested as a pure decision; this asserts the WIRING,
 * which is the half that can silently not exist: a gate whose verdict nothing
 * consults is indistinguishable from no gate. Both directions are here, and
 * the refusing one is the point — the shared `deps()` helper in the sibling
 * suite stubs provenance to always pass so the other gates can be exercised,
 * so without this file the refusal path would be asserted nowhere.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    EXIT_REFUSED,
    type UnattendedDeps,
    run_unattended,
    verify_provenance_default,
} from '../../../src/scripts/_cli/upgrade_unattended.js';
import { EXPECTED_WORKFLOW_REF } from '../../../src/scripts/_lib/provenance_verify.js';
import type { RegistryCandidate } from '../../../src/scripts/_lib/unattended_gates.js';

let tmp: string;
let out: string;
let err: string;

const NOW = new Date('2026-10-20T00:00:00Z');

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unattended-provenance-'));
    out = '';
    err = '';
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function packument() {
    return {
        'dist-tags': { latest: '16.6.0' },
        time: { '16.6.0': new Date(NOW.getTime() - 100 * 3600 * 1000).toISOString() },
        versions: {
            '16.5.0': { version: '16.5.0' },
            '16.6.0': {
                version: '16.6.0',
                dist: {
                    attestations: {
                        url: 'https://registry.npmjs.org/-/npm/v1/attestations/x',
                        provenance: { predicateType: 'https://slsa.dev/provenance/v1' },
                    },
                },
                engines: { node: '>=20.11.0' },
                agentConfig: { impact: { '16.6.0': { impact: 'automatic' } } },
            },
        },
    };
}

function deps(over: Partial<UnattendedDeps> = {}): UnattendedDeps {
    const cmds: string[][] = [];
    return {
        fetchPackument: async () => ({ ok: true, doc: packument() }) as never,
        verifyProvenance: async () => null,
        run: (cmd: string[]) => {
            cmds.push(cmd);
            return { rc: 0, stderr: '' };
        },
        readInstalled: () => '16.5.0',
        readBinary: () => '16.5.0',
        interrupted: () => false,
        origin: 'global',
        agentConfigBin: '/global/bin/agent-config',
        globalSettings: [path.join(tmp, '.agent-settings.yml')],
        lockPath: path.join(tmp, 'upgrade-unattended.lock'),
        skipPath: path.join(tmp, 'upgrade-skip.json'),
        env: { ci: false, noUpdateCheck: false, nodeVersion: 'v22.11.0' },
        now: () => NOW,
        pid: 4242,
        isAlive: () => true,
        dryRun: false,
        activationBlocked: null,
        out: { write: (t: string) => (out += t) },
        err: { write: (t: string) => (err += t) },
        ...over,
    } as UnattendedDeps;
}

function candidate(url: string | null): RegistryCandidate {
    return {
        version: '16.6.0',
        publishedAt: '2026-10-01T00:00:00Z',
        deprecated: undefined,
        engines: { node: '>=22' },
        provenance: true,
        impactMap: null,
        attestationsUrl: url,
    };
}

function bundle(workflowPath: string, repository = 'https://github.com/event4u-app/agent-config') {
    return {
        attestations: [
            {
                bundle: {
                    dsseEnvelope: {
                        payload: Buffer.from(
                            JSON.stringify({
                                predicate: {
                                    buildDefinition: {
                                        externalParameters: {
                                            workflow: { path: workflowPath, repository },
                                        },
                                    },
                                },
                            }),
                        ).toString('base64'),
                    },
                },
            },
        ],
    };
}

function fetcher(body: unknown, ok = true, status = 200): typeof fetch {
    return (async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;
}

describe('verify_provenance_default', () => {
    it('passes for an attestation naming this package publish workflow', async () => {
        const reason = await verify_provenance_default(
            candidate('https://example.test/att'),
            fetcher(bundle(EXPECTED_WORKFLOW_REF)),
        );
        expect(reason).toBeNull();
    });

    it('refuses an attestation produced by a different workflow, and names it', async () => {
        const reason = await verify_provenance_default(
            candidate('https://example.test/att'),
            fetcher(bundle('.github/workflows/attacker.yml')),
        );
        expect(reason).toContain('.github/workflows/attacker.yml');
        expect(reason).toContain(EXPECTED_WORKFLOW_REF);
    });

    it('refuses an attestation from a different repository', async () => {
        const reason = await verify_provenance_default(
            candidate('https://example.test/att'),
            fetcher(bundle(EXPECTED_WORKFLOW_REF, 'https://github.com/someone-else/agent-config')),
        );
        expect(reason).not.toBeNull();
    });

    it('refuses when the packument carries no attestation url at all', async () => {
        const reason = await verify_provenance_default(candidate(null), fetcher({}));
        expect(reason).toContain('no attestation bundle');
    });

    it('refuses — never passes — when the bundle cannot be fetched', async () => {
        const reason = await verify_provenance_default(
            candidate('https://example.test/att'),
            fetcher({}, false, 503),
        );
        expect(reason).toContain('503');
    });
});

describe('the unattended run consults the provenance gate', () => {
    it('refuses and installs nothing when provenance does not tie to the publish workflow', async () => {
        const cmds: string[][] = [];
        const code = await run_unattended(
            deps({
                verifyProvenance: async () => '16.6.0 was built by .github/workflows/attacker.yml',
                run: (cmd: string[]) => {
                    cmds.push(cmd);
                    return { rc: 0, stderr: '' };
                },
            }),
        );
        expect(code).toBe(EXIT_REFUSED);
        expect(cmds).toEqual([]);
        expect(out + err).toContain('attacker.yml');
    });
});
