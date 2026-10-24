<!-- evidence-type: analysis -->

# Independent test review — removing `tests/lib/provenance_signature.test.ts`

You are an independent reviewer for a change in the `event4u/agent-config` repository. A gate (`check_test_weakening`) flagged that the change deletes a test file with 18 assertions. The repository's rule is that an implementer may not weaken a test on their own say-so; an independent reviewer decides whether the removal is legitimate.

## Context

`agent-config upgrade --unattended` verifies a release's provenance before installing it. Before this change, `src/scripts/_lib/provenance_verify.ts` exported `verify_attestation_signature`, which verified a DSSE envelope's signature against the certificate carried in the attestation bundle and required that certificate's SAN to name the expected workflow. It did not check who issued the certificate, so a self-signed certificate with the expected SAN passed. The deleted test file tested exactly that function (and `dssePae`), including one case asserting that known limitation.

This change replaces that path. `verify_attestation_signature`, `dssePae` and the related helpers are deleted from `provenance_verify.ts` (only the workflow/repository payload check `payload_names_publish` and two constants remain). Verification now happens in a new module, `src/scripts/_lib/sigstore_provenance.ts`, using `@sigstore/verify` against a pinned trust root (Fulcio chain, Rekor, SCT, identity policy) plus npm's pinned keys, and binds both attestations' subject digest to the tarball bytes that are installed. Nothing in the tree calls the deleted functions.

The replacement tests are below: `tests/lib/sigstore_provenance.test.ts` (against the real published 17.3.0 attestation) and `tests/scripts/_lib/provenance_verify.test.ts` (the remaining payload check). `tests/scripts/_cli/upgrade_unattended_provenance.test.ts` additionally covers download, integrity and the install wiring (titles listed).

## What to answer

1. For each property the deleted file asserted, is it (a) still a property of the code and covered by a remaining or new test, (b) still a property of the code and now uncovered, or (c) no longer a property of the code because the code it tested is gone? Name the case.
2. Is any (b) case a reason to refuse the removal, or to require a specific new test (name it)?
3. Does the change weaken what the test suite verifies about release provenance overall?

End with exactly one verdict line: `VERDICT: removal-justified`, `VERDICT: removal-justified-with-conditions — <conditions>`, or `VERDICT: refused — <reason>`.

## The deleted file (`git show origin/main:tests/lib/provenance_signature.test.ts`)

```ts
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
```

## The new test file `tests/lib/sigstore_provenance.test.ts`

```ts
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

/** The fields of a bundle the forging cases rewrite; the rest is carried through untouched. */
interface Bundle {
    dsseEnvelope: { payload: string; payloadType: string; signatures: Array<{ sig: string }> };
    verificationMaterial: { certificate: { rawBytes: string } };
}
type Doc = { attestations: Array<{ predicateType: string; bundle: Bundle }> };
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
        const env = slsa(doc).bundle.dsseEnvelope;
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
        const payload = Buffer.from(b.dsseEnvelope.payload, 'base64');
        const type = b.dsseEnvelope.payloadType as string;
        const pae = Buffer.concat([
            Buffer.from(`DSSEv1 ${Buffer.byteLength(type)} ${type} ${payload.length} `),
            payload,
        ]);
        b.dsseEnvelope.signatures[0]!.sig = crypto.sign('sha256', pae, crypto.createPrivateKey(forged.keyPem)).toString('base64');
        b.verificationMaterial.certificate.rawBytes = forged.certDer.toString('base64');
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
```

## The rewritten `tests/scripts/_lib/provenance_verify.test.ts`

```ts
/**
 * The workflow tie read out of a verified provenance payload.
 *
 * Written around the rejecting direction: a well-formed, correctly-typed SLSA
 * payload naming the wrong workflow or the wrong repository must fail, because
 * any workflow in any repository with `id-token: write` can produce one.
 */
import { describe, expect, it } from 'vitest';

import { EXPECTED_REPOSITORY, EXPECTED_WORKFLOW_REF, payload_names_publish } from '../../../src/scripts/_lib/provenance_verify.js';

function payload(path: string, repository: string = EXPECTED_REPOSITORY): Record<string, unknown> {
    return {
        predicateType: 'https://slsa.dev/provenance/v1',
        predicate: { buildDefinition: { externalParameters: { workflow: { ref: 'refs/tags/1.0.0', repository, path } } } },
    };
}

describe('payload_names_publish', () => {
    it('accepts the workflow this package actually publishes from', () => {
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF))).toBe(true);
    });

    it('accepts the repository written with .git or a trailing slash', () => {
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF, `${EXPECTED_REPOSITORY}.git`))).toBe(true);
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF, `${EXPECTED_REPOSITORY}/`))).toBe(true);
    });

    it('REJECTS a payload produced by a different workflow', () => {
        expect(payload_names_publish(payload('.github/workflows/attacker.yml'))).toBe(false);
    });

    it('REJECTS a payload naming a different repository', () => {
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF, 'https://github.com/someone-else/agent-config'))).toBe(false);
    });

    it('REJECTS an absent or empty payload — presence is not optional', () => {
        expect(payload_names_publish(null)).toBe(false);
        expect(payload_names_publish({})).toBe(false);
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF, ''))).toBe(false);
    });
});
```

## Test titles in `tests/scripts/_cli/upgrade_unattended_provenance.test.ts`

- hands back a private file holding exactly the bytes whose digest was verified
- refuses bytes that do not match the integrity the registry records, before verifying anything
- refuses — and writes no file — when the attestations do not verify
- refuses a url on another host, before fetching anything
- refuses when the registry names no attestation, no tarball, or no sha512 integrity
- refuses — never passes — when a download fails
- refuses and installs nothing when provenance does not verify

## The new verifier `src/scripts/_lib/sigstore_provenance.ts`

```ts
/**
 * Verify a release's two attestations against pinned sigstore trust material,
 * and bind both to the exact tarball bytes that will be installed.
 *
 * WHY THIS REPLACES THE CERTIFICATE-BOUND CHECK. `provenance_verify.ts` checked
 * the DSSE signature against the certificate a bundle carries and that
 * certificate's SAN — and nothing about who issued it, so anyone who could
 * serve the registry answer could mint a self-signed certificate with the
 * expected SAN and pass. Pinned roots close that; a root fetched at run time
 * would let the same attacker choose what the bundle is checked against.
 *
 * WHAT IS VERIFIED, both attestations required:
 * - the SLSA provenance bundle: Fulcio chain to the pinned root, the signing
 *   certificate's validity at the time the transparency log recorded it, a
 *   Rekor entry and an SCT checked against the pinned logs, the DSSE signature,
 *   and an identity policy — issuer `token.actions.githubusercontent.com` and a
 *   SAN that is exactly this repository's `publish-npm.yml` at the tag of the
 *   version being installed;
 * - the npm publish attestation: its signature against npm's pinned
 *   `npm:attestations` keys, and its Rekor entry — a second trust domain,
 *   verified separately;
 * - in both payloads, exactly one subject naming this package at this version,
 *   whose sha512 equals the sha512 of the bytes about to be installed.
 *
 * WHAT IT NEVER DOES: fetch trust material (the files are read from the
 * installed package and their digests checked against the recorded ones), fall
 * back to the old check or to `npm audit signatures`, or pass anything it could
 * not verify. Every failure is a reason string, because the caller prints it.
 *
 * The sigstore modules are imported lazily: this runs on the unattended upgrade
 * path only, and nothing else should pay for loading them.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { resolvePackageRoot } from './package_root.js';
import { EXPECTED_REPOSITORY, EXPECTED_WORKFLOW_REF, payload_names_publish } from './provenance_verify.js';

export const SLSA_PROVENANCE_V1 = 'https://slsa.dev/provenance/v1';
export const NPM_PUBLISH_V01 = 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1';
export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
export const PACKAGE_PURL_BASE = 'pkg:npm/%40event4u/agent-config';

/** Why verification refused, or `null` when everything held. */
export type ProvenanceVerdict = string | null;

function asRecord(v: unknown): Record<string, unknown> | null {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * The only SAN accepted: this repository's publish workflow at the release tag
 * of exactly the version being installed. Anchored at both ends — the library
 * treats the policy as a pattern, and an unanchored one would accept any SAN
 * that merely contains it.
 */
export function expectedSan(version: string): RegExp {
    return new RegExp(`^${escapeRegExp(`${EXPECTED_REPOSITORY}/${EXPECTED_WORKFLOW_REF}@refs/tags/${version}`)}$`);
}

export interface TrustFiles {
    readonly trustedRoot: unknown;
    readonly npmKeys: unknown;
}

/**
 * Read the pinned trust material and refuse when a file's digest differs from
 * the recorded one — a release can only be checked against the material it
 * shipped with, as it shipped.
 */
export function readTrustFiles(packageRoot: string = resolvePackageRoot(import.meta.url)): TrustFiles | string {
    const dir = path.join(packageRoot, 'src', 'config', 'sigstore');
    try {
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'trust-material.json'), 'utf-8')) as {
            files?: Record<string, string>;
        };
        const read = (name: string): unknown => {
            const bytes = fs.readFileSync(path.join(dir, name));
            const want = manifest.files?.[name];
            const got = createHash('sha256').update(bytes).digest('hex');
            if (want !== got) throw new Error(`${name} has sha256 ${got}, the recorded one is ${String(want)}`);
            return JSON.parse(bytes.toString('utf-8')) as unknown;
        };
        return { trustedRoot: read('trusted_root.json'), npmKeys: read('npm_keys.json') };
    } catch (err) {
        return `the pinned sigstore trust material is unusable: ${err instanceof Error ? err.message : String(err)}`;
    }
}

/** Exactly one subject, naming this package at this version, with this sha512. */
function subjectMatches(payload: Record<string, unknown> | null, version: string, sha512Hex: string): string | null {
    const subjects = payload?.['subject'];
    if (!Array.isArray(subjects) || subjects.length !== 1) return 'it does not name exactly one subject';
    const subject = asRecord(subjects[0]);
    if (subject?.['name'] !== `${PACKAGE_PURL_BASE}@${version}`) return `its subject is ${String(subject?.['name'])}, not ${version}`;
    const digest = asRecord(subject['digest'])?.['sha512'];
    if (typeof digest !== 'string' || digest.toLowerCase() !== sha512Hex.toLowerCase()) {
        return 'its subject digest does not match the tarball about to be installed';
    }
    return null;
}

export interface ReleaseToVerify {
    readonly version: string;
    /** sha512 of the exact tarball bytes that will be installed, lower-case hex. */
    readonly tarballSha512Hex: string;
    /** The registry's attestation document for this version. */
    readonly attestations: unknown;
}

export async function verify_release_provenance(
    release: ReleaseToVerify,
    trust: TrustFiles | string = readTrustFiles(),
): Promise<ProvenanceVerdict> {
    if (typeof trust === 'string') return trust;
    const list = asRecord(release.attestations)?.['attestations'];
    if (!Array.isArray(list)) return 'the attestation document carries no attestations';
    const byType = new Map<string, unknown>();
    for (const entry of list) {
        const type = asRecord(entry)?.['predicateType'];
        if (typeof type === 'string' && !byType.has(type)) byType.set(type, asRecord(entry)?.['bundle']);
    }
    for (const type of [SLSA_PROVENANCE_V1, NPM_PUBLISH_V01]) {
        if (!byType.has(type)) return `the release carries no ${type} attestation`;
    }

    const { Verifier, toSignedEntity, toTrustMaterial } = await import('@sigstore/verify');
    const { bundleFromJSON } = await import('@sigstore/bundle');
    const { PublicKey, TrustedRoot } = await import('@sigstore/protobuf-specs');

    let material: ReturnType<typeof toTrustMaterial>;
    try {
        const keys: Record<string, ReturnType<typeof PublicKey.fromJSON>> = {};
        const listed = asRecord(trust.npmKeys)?.['keys'];
        for (const k of Array.isArray(listed) ? listed : []) {
            const key = asRecord(k);
            if (key?.['keyUsage'] === 'npm:attestations' && typeof key['keyId'] === 'string') {
                keys[key['keyId']] = PublicKey.fromJSON(key['publicKey']);
            }
        }
        material = toTrustMaterial(TrustedRoot.fromJSON(trust.trustedRoot), keys);
    } catch (err) {
        return `the pinned sigstore trust material could not be loaded: ${err instanceof Error ? err.message : String(err)}`;
    }

    for (const type of [SLSA_PROVENANCE_V1, NPM_PUBLISH_V01]) {
        let payload: Record<string, unknown> | null;
        try {
            const bundle = bundleFromJSON(byType.get(type));
            const verifier = new Verifier(material, { tlogThreshold: 1, ctlogThreshold: 1, timestampThreshold: 1 });
            const policy =
                type === SLSA_PROVENANCE_V1
                    ? { subjectAlternativeName: expectedSan(release.version), extensions: { issuer: GITHUB_OIDC_ISSUER } }
                    : undefined;
            verifier.verify(toSignedEntity(bundle), policy);
            if (bundle.content.$case !== 'dsseEnvelope') return `the ${type} attestation is not a DSSE envelope`;
            payload = asRecord(JSON.parse(bundle.content.dsseEnvelope.payload.toString('utf-8')));
        } catch (err) {
            const code = asRecord(err)?.['code'];
            return `the ${type} attestation does not verify${typeof code === 'string' ? ` (${code})` : ''}: ${
                err instanceof Error ? err.message : String(err)
            }`;
        }
        if (payload?.['predicateType'] !== type) return `the ${type} attestation's statement names another predicate type`;
        const subject = subjectMatches(payload, release.version, release.tarballSha512Hex);
        if (subject !== null) return `the ${type} attestation is not for this tarball: ${subject}`;
        if (type === SLSA_PROVENANCE_V1 && !payload_names_publish(payload)) {
            return `the signed provenance does not name ${EXPECTED_WORKFLOW_REF} in ${EXPECTED_REPOSITORY}`;
        }
    }
    return null;
}
```
