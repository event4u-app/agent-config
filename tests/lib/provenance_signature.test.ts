/**
 * Step 2.1's signature half — the DSSE envelope is checked, not just decoded.
 *
 * The fixtures are real: an EC P-256 key and a self-signed certificate minted
 * with `openssl`, a genuine DSSE pre-authentication encoding, and a genuine
 * ECDSA signature over it. A fixture that stubbed the crypto would assert that
 * this file's own branches run, not that a signature verifies.
 *
 * And a self-signed certificate is exactly the right fixture, because it is
 * also the residue: nothing here checks WHO issued the certificate, so a
 * self-signed one passes. The last test in this file pins that as a known
 * limitation rather than leaving it to be discovered as a hole.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    PROVENANCE_TRUST_ROOT_PINNED,
    TRUST_ROOT_BLOCKED,
    activation_blocked_reason,
} from '../../src/scripts/_cli/upgrade_unattended.js';

import {
    EXPECTED_REPOSITORY,
    EXPECTED_WORKFLOW_REF,
    dssePae,
    verify_attestation_signature,
} from '../../src/scripts/_lib/provenance_verify.js';

const IDENTITY = `${EXPECTED_REPOSITORY}/${EXPECTED_WORKFLOW_REF}@refs/heads/main`;
const PAYLOAD_TYPE = 'application/vnd.in-toto+json';

/** A statement naming this package's publish workflow — what a real release signs. */
function statement(workflowPath = EXPECTED_WORKFLOW_REF): string {
    return JSON.stringify({
        _type: 'https://in-toto.io/Statement/v1',
        predicate: { buildDefinition: { externalParameters: { workflow: { path: workflowPath, repository: EXPECTED_REPOSITORY } } } },
    });
}

// A generous hook timeout, because these fixtures are `mkdtempSync` and
// nothing else: measured on a machine running several parallel lanes, the
// default 30 s hook budget expired inside `beforeEach` itself while every one
// of these tests passed in isolation. The number is about the host's load, not
// about the work, so raising it removes a flake rather than hiding a slow test.
const HOOK_TIMEOUT_MS = 120_000;

let tmp: string;
// Read at collection time, so a machine without openssl reports the signing
// cases as SKIPPED rather than green with nothing verified.
const HAVE_OPENSSL = spawnSync('openssl', ['version'], { encoding: 'utf-8' }).status === 0;
const NO_CERT = 'openssl is present but could not mint a certificate';

/** A self-signed P-256 certificate carrying `san` as a URI SAN, plus its key. */
function mintCert(name: string, san: string): { keyPem: string; certDer: Buffer } | null {
    const keyPath = path.join(tmp, `${name}.key`);
    const certPath = path.join(tmp, `${name}.der`);
    const cnfPath = path.join(tmp, `${name}.cnf`);
    fs.writeFileSync(cnfPath, `[req]\ndistinguished_name=dn\nx509_extensions=v3\nprompt=no\n[dn]\nCN=${name}\n[v3]\nsubjectAltName=URI:${san}\n`);
    const r = spawnSync(
        'openssl',
        ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', keyPath, '-out', certPath, '-outform', 'DER', '-days', '1', '-config', cnfPath],
        { encoding: 'utf-8' },
    );
    if (r.status !== 0) return null;
    return { keyPem: fs.readFileSync(keyPath, 'utf-8'), certDer: fs.readFileSync(certPath) };
}

function bundle(payload: Buffer, sig: Buffer, certDer: Buffer): unknown {
    return {
        attestations: [
            {
                predicateType: 'https://slsa.dev/provenance/v1',
                bundle: {
                    verificationMaterial: { certificate: { rawBytes: certDer.toString('base64') } },
                    dsseEnvelope: {
                        payloadType: PAYLOAD_TYPE,
                        payload: payload.toString('base64'),
                        signatures: [{ sig: sig.toString('base64'), keyid: '' }],
                    },
                },
            },
        ],
    };
}

function signed(payloadText: string, identity = IDENTITY, name = 'good'): unknown | null {
    const minted = mintCert(name, identity);
    if (minted === null) return null;
    const payload = Buffer.from(payloadText, 'utf8');
    const sig = crypto.sign(null, dssePae(PAYLOAD_TYPE, payload), crypto.createPrivateKey(minted.keyPem));
    return bundle(payload, sig, minted.certDer);
}

beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsse-'));
}, HOOK_TIMEOUT_MS);
afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
}, HOOK_TIMEOUT_MS);

describe('dssePae', () => {
    it('is the DSSEv1 encoding, with BYTE lengths', () => {
        // 'ü' is two bytes, one character — the case a string-length
        // implementation gets wrong and a Buffer one does not.
        const pae = dssePae('t', Buffer.from('ü', 'utf8')).toString('utf8');
        expect(pae).toBe('DSSEv1 1 t 2 ü');
    });
});

describe('verify_attestation_signature', () => {
    it('refuses a document with no attestations', async () => {
        expect(await verify_attestation_signature({})).toMatch(/no attestations/);
        expect(await verify_attestation_signature({ attestations: [] })).toMatch(/no attestations/);
    });

    it('refuses an attestation with no readable envelope', async () => {
        expect(await verify_attestation_signature({ attestations: [{ bundle: {} }] })).toMatch(/readable DSSE envelope/);
    });

    // skip-reason: openssl is absent, so no certificate can be minted.
    it.skipIf(!HAVE_OPENSSL)('accepts a genuine signature over a payload naming the publish workflow', async () => {
        const doc = signed(statement());
        if (doc === null) return expect.unreachable(NO_CERT);
        expect(await verify_attestation_signature(doc)).toBeNull();
    });

    // skip-reason: openssl is absent, so no certificate can be minted.
    it.skipIf(!HAVE_OPENSSL)('refuses a genuine signature over a payload that names another workflow', async () => {
        const doc = signed(statement('.github/workflows/other.yml'), IDENTITY, 'mismatch');
        if (doc === null) return expect.unreachable(NO_CERT);
        expect(await verify_attestation_signature(doc)).toMatch(/signed payload does not name/);
    });

    // skip-reason: openssl is absent, so no certificate can be minted.
    it.skipIf(!HAVE_OPENSSL)('refuses a SAN that only contains the workflow identity as a substring', async () => {
        const doc = signed(statement(), `https://evil.example/?x=${IDENTITY}`, 'substring');
        if (doc === null) return expect.unreachable(NO_CERT);
        expect(await verify_attestation_signature(doc)).toMatch(/signing certificate names/);
    });

    // skip-reason: openssl is absent, so no certificate can be minted.
    it.skipIf(!HAVE_OPENSSL)('refuses when the payload was edited after signing', async () => {
        const doc = signed('{"_type":"https://in-toto.io/Statement/v1"}') as { attestations: Array<Record<string, never>> } | null;
        if (doc === null) return expect.unreachable(NO_CERT);
        const env = (doc.attestations[0] as unknown as { bundle: { dsseEnvelope: { payload: string } } }).bundle.dsseEnvelope;
        env.payload = Buffer.from('{"_type":"tampered"}', 'utf8').toString('base64');
        expect(await verify_attestation_signature(doc)).toMatch(/does not verify/);
    });

    // skip-reason: openssl is absent, so no certificate can be minted.
    it.skipIf(!HAVE_OPENSSL)('refuses a certificate issued to another identity, however well it signs', async () => {
        const doc = signed('{"ok":true}', 'https://github.com/someone-else/their-repo/.github/workflows/publish.yml@refs/heads/main', 'other');
        if (doc === null) return expect.unreachable(NO_CERT);
        expect(await verify_attestation_signature(doc)).toMatch(/names .*someone-else/);
    });

    it('refuses an unparseable certificate', async () => {
        const doc = bundle(Buffer.from('{}'), Buffer.from('x'), Buffer.from('not a certificate'));
        expect(await verify_attestation_signature(doc)).toMatch(/could not be parsed/);
    });

    // skip-reason: openssl is absent, so no certificate can be minted.
    it.skipIf(!HAVE_OPENSSL)('KNOWN LIMITATION — a self-signed certificate passes, because no trust root is checked', async () => {
        const doc = signed(statement(), IDENTITY, 'selfsigned');
        if (doc === null) return expect.unreachable(NO_CERT);
        // This is not a bug in the function; it is the `dsse-trust-root`
        // blocker, asserted so the limit cannot be forgotten and so the test
        // flips the day a Fulcio root is pinned.
        expect(await verify_attestation_signature(doc)).toBeNull();
    });
});

describe('the known limitation keeps unattended activation off', () => {
    // While a self-signed certificate passes the signature check above, the
    // provenance gate proves only internal consistency, so the production
    // wiring of `upgrade --unattended` must refuse every swap.
    it('refuses activation for as long as no trust root is pinned', () => {
        expect(PROVENANCE_TRUST_ROOT_PINNED).toBe(false);
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'trust-root-block-'));
        try {
            expect(activation_blocked_reason({ EVENT4U_CONFIG_HOME: home })).toBe(TRUST_ROOT_BLOCKED);
        } finally {
            fs.rmSync(home, { recursive: true, force: true });
        }
    });
});
