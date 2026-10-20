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
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
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
import { EXPECTED_REPOSITORY, EXPECTED_WORKFLOW_REF, dssePae } from '../../../src/scripts/_lib/provenance_verify.js';
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

/**
 * An attestation bundle whose DSSE envelope is genuinely signed.
 *
 * It did not used to be: the payload was base64 and the envelope carried no
 * signature at all, which was enough while the gate only decoded it. Since the
 * signature half of step 2.1 landed, an unsigned bundle is refused — correctly
 * — so the fixture has to carry a real EC P-256 key, a real certificate with
 * the expected SAN, and a real signature over the DSSE pre-authentication
 * encoding. Signature-specific cases, including the self-signed limitation,
 * live in `tests/lib/provenance_signature.test.ts`; these tests are about the
 * WORKFLOW tie, so the signature here is only ever the valid one.
 */
function bundle(workflowPath: string, repository = 'https://github.com/event4u-app/agent-config') {
    const payload = Buffer.from(
        JSON.stringify({
            predicate: {
                buildDefinition: {
                    externalParameters: {
                        workflow: { path: workflowPath, repository },
                    },
                },
            },
        }),
    );
    const signed = signPayload(payload);
    return {
        attestations: [
            {
                bundle: {
                    verificationMaterial: { certificate: { rawBytes: signed.certDer.toString('base64') } },
                    dsseEnvelope: {
                        payloadType: PAYLOAD_TYPE,
                        payload: payload.toString('base64'),
                        signatures: [{ sig: signed.sig.toString('base64'), keyid: '' }],
                    },
                },
            },
        ],
    };
}

const PAYLOAD_TYPE = 'application/vnd.in-toto+json';
const SAN = `${EXPECTED_REPOSITORY}/${EXPECTED_WORKFLOW_REF}@refs/heads/main`;
let _signer: { keyPem: string; certDer: Buffer } | null = null;

/** One key and certificate for the whole file — minting is the slow part. */
function signer(): { keyPem: string; certDer: Buffer } {
    if (_signer !== null) return _signer;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prov-fixture-'));
    const cnf = path.join(dir, 'c.cnf');
    fs.writeFileSync(cnf, `[req]\ndistinguished_name=dn\nx509_extensions=v3\nprompt=no\n[dn]\nCN=fixture\n[v3]\nsubjectAltName=URI:${SAN}\n`);
    const key = path.join(dir, 'k.pem');
    const cert = path.join(dir, 'c.der');
    const r = spawnSync(
        'openssl',
        ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', key, '-out', cert, '-outform', 'DER', '-days', '1', '-config', cnf],
        { encoding: 'utf-8' },
    );
    if (r.status !== 0) throw new Error(`openssl could not mint the fixture certificate: ${r.stderr}`);
    _signer = { keyPem: fs.readFileSync(key, 'utf-8'), certDer: fs.readFileSync(cert) };
    return _signer;
}

function signPayload(payload: Buffer): { sig: Buffer; certDer: Buffer } {
    const s = signer();
    return { sig: crypto.sign(null, dssePae(PAYLOAD_TYPE, payload), crypto.createPrivateKey(s.keyPem)), certDer: s.certDer };
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
