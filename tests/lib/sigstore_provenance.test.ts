/**
 * Release provenance against pinned sigstore trust material.
 *
 * The positive case is the REAL attestation document npm serves for
 * `@event4u/agent-config@17.3.0` (fixture committed verbatim) and the real
 * sha512 of that release's tarball, so the test exercises the Fulcio chain,
 * the Rekor entries, the SCT and npm's own key exactly as production does.
 * Every other case is that document with one thing wrong.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    NPM_PUBLISH_V01,
    SLSA_PROVENANCE_V1,
    expectedSan,
    readTrustFiles,
    verify_release_provenance,
} from '../../src/scripts/_lib/sigstore_provenance.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'provenance', 'agent-config-17.3.0.attestations.json');
const VERSION = '17.3.0';
/** sha512 of the published 17.3.0 tarball, as both attestations' subjects record it. */
const TARBALL_SHA512 =
    '106450d8a0a9a00305694c101ac148fa8c76d9a8b6d3df703518640b1481f8837bdd1fc038bcced6239c7096d2d5cdd3598035b7651c77968bc7450161aaa823';

type Doc = { attestations: Array<{ predicateType: string; bundle: Record<string, any> }> };
const real = (): Doc => JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as Doc;
const slsa = (doc: Doc) => doc.attestations.find((a) => a.predicateType === SLSA_PROVENANCE_V1)!;

const tmpDirs: string[] = [];
afterEach(() => {
    vi.unstubAllGlobals();
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const verify = (attestations: unknown, version = VERSION, sha = TARBALL_SHA512) =>
    verify_release_provenance({ version, tarballSha512Hex: sha, attestations });

describe('verify_release_provenance', () => {
    it('accepts the real 17.3.0 release with its real tarball digest', async () => {
        expect(await verify(real())).toBeNull();
    });

    it('needs no network: the trust material is pinned, never fetched', async () => {
        vi.stubGlobal('fetch', () => {
            throw new Error('network used');
        });
        expect(await verify(real())).toBeNull();
    });

    it('refuses when the tarball about to be installed is not the one attested', async () => {
        expect(await verify(real(), VERSION, '00'.repeat(64))).toContain('subject digest does not match');
    });

    it('refuses a release signed for another tag than the version being installed', async () => {
        expect(await verify(real(), '17.2.1')).toContain('UNTRUSTED_SIGNER_ERROR');
    });

    it('refuses a provenance payload edited after signing', async () => {
        const doc = real();
        const env = slsa(doc).bundle['dsseEnvelope'];
        const text = Buffer.from(env.payload, 'base64').toString('utf-8').replace('publish-npm.yml', 'publish-npx.yml');
        env.payload = Buffer.from(text).toString('base64');
        expect(await verify(doc)).toMatch(/does not verify/);
    });

    // The residue D15 existed to close: a certificate nobody trusted, carrying
    // the expected identity. The old check accepted this; the pinned Fulcio
    // chain must not.
    it('refuses a self-signed certificate carrying the expected identity', async () => {
        const doc = real();
        const b = slsa(doc).bundle;
        const forged = mintSelfSigned(`https://github.com/event4u-app/agent-config/.github/workflows/publish-npm.yml@refs/tags/${VERSION}`);
        const payload = Buffer.from(b['dsseEnvelope'].payload, 'base64');
        const type = b['dsseEnvelope'].payloadType as string;
        const pae = Buffer.concat([
            Buffer.from(`DSSEv1 ${Buffer.byteLength(type)} ${type} ${payload.length} `),
            payload,
        ]);
        b['dsseEnvelope'].signatures[0].sig = crypto.sign('sha256', pae, crypto.createPrivateKey(forged.keyPem)).toString('base64');
        b['verificationMaterial'].certificate.rawBytes = forged.certDer.toString('base64');
        expect(await verify(doc)).toMatch(/does not verify/);
    });

    it('requires both attestations', async () => {
        for (const missing of [SLSA_PROVENANCE_V1, NPM_PUBLISH_V01]) {
            const doc = real();
            doc.attestations = doc.attestations.filter((a) => a.predicateType !== missing);
            expect(await verify(doc)).toContain(`no ${missing} attestation`);
        }
    });

    it('refuses a document that is not an attestation list', async () => {
        expect(await verify({})).toContain('carries no attestations');
        expect(await verify({ attestations: [{ predicateType: SLSA_PROVENANCE_V1, bundle: { junk: true } }, { predicateType: NPM_PUBLISH_V01, bundle: {} }] })).toMatch(
            /does not verify/,
        );
    });
});

describe('expectedSan', () => {
    it('is anchored and escaped, so neither a prefix nor a lookalike passes', () => {
        const san = expectedSan('1.2.3');
        const ok = 'https://github.com/event4u-app/agent-config/.github/workflows/publish-npm.yml@refs/tags/1.2.3';
        expect(san.test(ok)).toBe(true);
        expect(san.test(`${ok}-evil`)).toBe(false);
        expect(san.test(`x${ok}`)).toBe(false);
        expect(san.test(ok.replace('publish-npm.yml', 'publish-npmXyml'))).toBe(false);
        expect(san.test(ok.replace('refs/tags', 'refs/heads'))).toBe(false);
    });
});

describe('readTrustFiles', () => {
    it('reads the shipped material when every digest matches', () => {
        expect(typeof readTrustFiles(REPO_ROOT)).toBe('object');
    });

    it('refuses material whose digest differs from the recorded one', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trust-'));
        tmpDirs.push(root);
        const dir = path.join(root, 'src', 'config', 'sigstore');
        fs.mkdirSync(dir, { recursive: true });
        for (const f of ['trust-material.json', 'trusted_root.json', 'npm_keys.json']) {
            fs.copyFileSync(path.join(REPO_ROOT, 'src', 'config', 'sigstore', f), path.join(dir, f));
        }
        fs.appendFileSync(path.join(dir, 'trusted_root.json'), ' ');
        const result = readTrustFiles(root);
        expect(typeof result).toBe('string');
        expect(result).toContain('trusted_root.json has sha256');
    });
});

function mintSelfSigned(san: string): { keyPem: string; certDer: Buffer } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forged-'));
    tmpDirs.push(dir);
    const cnf = path.join(dir, 'c.cnf');
    fs.writeFileSync(cnf, `[req]\ndistinguished_name=dn\nx509_extensions=v3\nprompt=no\n[dn]\nCN=sigstore-intermediate\n[v3]\nsubjectAltName=URI:${san}\n`);
    const key = path.join(dir, 'k.pem');
    const cert = path.join(dir, 'c.der');
    const r = spawnSync(
        'openssl',
        ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', key, '-out', cert, '-outform', 'DER', '-days', '1', '-config', cnf],
        { encoding: 'utf-8' },
    );
    if (r.status !== 0) throw new Error(`openssl could not mint the forged certificate: ${r.stderr}`);
    return { keyPem: fs.readFileSync(key, 'utf-8'), certDer: fs.readFileSync(cert) };
}
