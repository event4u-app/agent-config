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
