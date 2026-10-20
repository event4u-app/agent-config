/**
 * Tie a published version's provenance attestation to THIS package's OIDC
 * publish workflow.
 *
 * The gate this replaces read `dist.attestations.provenance.predicateType` out
 * of the packument and accepted anything starting with the SLSA provenance
 * URL. That is a presence check wearing a verification's clothes: any workflow
 * in any repository with `id-token: write` produces a document that passes it,
 * so an attacker who can publish from their own CI already satisfies it. The
 * step that opened this file (`road-to-an-update-that-installs-itself-only-when-it-is-safe`
 * 2.1) named exactly that gap — *"does not verify the attestation's signature
 * or tie it to `publish-npm.yml`"* — and this module closes the second half.
 *
 * **The first half is NOT closed here, and the distinction is load-bearing.**
 * Everything below parses an UNSIGNED reading of the DSSE payload: the base64
 * body is decoded and inspected, the envelope's signature is never checked.
 * On its own that stops an attestation produced by the wrong workflow and
 * stops nothing produced by someone who can forge the document. The signature
 * half is `npm audit signatures`, which verifies against npm's own trusted
 * keys and is run by the caller as a separate step; this function is only
 * meaningful WITH it, and the caller says so where it composes the two.
 *
 * Why not verify the signature in-process: it needs a sigstore/cosign
 * verification path, which is a dependency this package does not carry and
 * which the hook and pack byte budgets would both have to absorb. Shelling out
 * to the npm client — already a hard dependency of an upgrade — buys the same
 * property for nothing.
 */

/**
 * The workflow path every legitimate release of this package is built by.
 *
 * A literal rather than a read of `.github/workflows/`: the question is which
 * workflow the REGISTRY says produced the tarball, and answering it from the
 * local tree would let a checkout vouch for itself.
 */
export const EXPECTED_WORKFLOW_REF = '.github/workflows/publish-npm.yml';

/** The repository every legitimate release of this package is built from. */
export const EXPECTED_REPOSITORY = 'https://github.com/event4u-app/agent-config';

function asRecord(v: unknown): Record<string, unknown> | null {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Decode the DSSE payload of the first attestation; `null` when unreadable. */
function decode_payload(doc: unknown): Record<string, unknown> | null {
    const list = asRecord(doc)?.['attestations'];
    if (!Array.isArray(list) || list.length === 0) return null;
    for (const entry of list) {
        const payload = asRecord(asRecord(asRecord(entry)?.['bundle'])?.['dsseEnvelope'])?.['payload'];
        if (typeof payload !== 'string' || payload === '') continue;
        try {
            const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
            const rec = asRecord(parsed);
            if (rec !== null) return rec;
        } catch {
            // A payload that is not base64 JSON is not evidence of anything.
            // Keep looking: npm may serve several attestations and only one of
            // them has to be the provenance statement.
        }
    }
    return null;
}

function external_workflow(doc: unknown): Record<string, unknown> | null {
    const payload = decode_payload(doc);
    if (payload === null) return null;
    const predicate = asRecord(payload['predicate']);
    const external = asRecord(asRecord(predicate?.['buildDefinition'])?.['externalParameters']);
    return asRecord(external?.['workflow']);
}

/**
 * The workflow path named by the attestation, or `null` when the document
 * carries none that can be read.
 */
export function attestation_workflow_ref(doc: unknown): string | null {
    const path_value = external_workflow(doc)?.['path'];
    return typeof path_value === 'string' && path_value !== '' ? path_value : null;
}

/** The repository named by the attestation, or `null`. */
export function attestation_repository(doc: unknown): string | null {
    const repo = external_workflow(doc)?.['repository'];
    return typeof repo === 'string' && repo !== '' ? repo : null;
}

/**
 * Does this attestation say the tarball was built by this package's publish
 * workflow, in this package's repository?
 *
 * Both halves are required and both reject on absence: a document that names
 * no workflow is not a document that names the right one. Repository is
 * compared with the trailing `.git` and any trailing slash removed, because
 * the same remote is written both ways and neither spelling is an attacker
 * signal.
 */
export function provenance_matches_publish(doc: unknown): boolean {
    const ref = attestation_workflow_ref(doc);
    if (ref !== EXPECTED_WORKFLOW_REF) return false;
    const repo = attestation_repository(doc);
    if (repo === null) return false;
    return repo.replace(/\.git$/, '').replace(/\/$/, '') === EXPECTED_REPOSITORY;
}

// --- the signature half -------------------------------------------------------

/**
 * ## What the clauses below do and do not establish
 *
 * The header above says the signature half is not closed here. It is now
 * HALF-closed, and the half that is missing is stated first so nothing below
 * reads as more than it is.
 *
 * **Closed:** the DSSE envelope's signature is verified against the public key
 * of the certificate the bundle itself carries, over the DSSE
 * pre-authentication encoding — so a payload edited after signing is caught,
 * and a bundle whose signature does not belong to its own certificate is
 * caught. And the certificate's own SAN is required to name the expected
 * workflow, so a bundle whose PAYLOAD claims `publish-npm.yml` while its
 * certificate was issued to some other identity is caught. Before this, both
 * were a base64 decode and a string compare.
 *
 * **Not closed, and this is the residue:** there is no trust root. Nothing
 * here checks that the certificate was issued by Fulcio, and nothing checks a
 * Rekor inclusion proof. An attacker who can serve a registry response can mint
 * a self-signed certificate carrying the expected SAN, sign their own payload
 * with it, and pass every check in this file. Closing that needs a sigstore
 * verification path with pinned roots — a dependency decision, not a line in
 * this function, and it is registered as the `dsse-trust-root` blocker on
 * `road-to-an-update-that-installs-itself-only-when-it-is-safe`.
 *
 * So the honest statement of what the provenance gate is worth today: it
 * defeats a partial compromise — a mis-scoped workflow, an edited payload, a
 * bundle reused from another build — and it does not defeat a forged bundle
 * from someone who already controls what the install reads.
 */

/** Why the signature does not verify, or `null` when it does. */
export type SignatureVerdict = string | null;

/** The SAN extension OID the Fulcio leaf carries the workflow identity in. */
const SAN_WORKFLOW_MARKER = `${EXPECTED_REPOSITORY}/${EXPECTED_WORKFLOW_REF}`;

/**
 * The DSSE pre-authentication encoding — the exact bytes a DSSE signature is
 * taken over.
 *
 * `DSSEv1 SP len(payloadType) SP payloadType SP len(payload) SP payload`, with
 * both lengths in BYTES rather than characters. Built as a Buffer throughout
 * because the payload is arbitrary bytes and a string round-trip would mangle
 * any that are not valid UTF-8.
 */
export function dssePae(payloadType: string, payload: Buffer): Buffer {
    const type = Buffer.from(payloadType, 'utf8');
    return Buffer.concat([
        Buffer.from(`DSSEv1 ${String(type.length)} `, 'utf8'),
        type,
        Buffer.from(` ${String(payload.length)} `, 'utf8'),
        payload,
    ]);
}

interface Envelope {
    readonly payloadType: string;
    readonly payload: Buffer;
    readonly sig: Buffer;
    readonly certDer: Buffer;
}

function readEnvelope(entry: unknown): Envelope | null {
    const bundle = asRecord(asRecord(entry)?.['bundle']);
    const dsse = asRecord(bundle?.['dsseEnvelope']);
    if (dsse === null) return null;
    const payloadB64 = dsse['payload'];
    const payloadType = dsse['payloadType'];
    const sigs = dsse['signatures'];
    if (typeof payloadB64 !== 'string' || typeof payloadType !== 'string' || !Array.isArray(sigs) || sigs.length === 0) return null;
    const sigB64 = asRecord(sigs[0])?.['sig'];
    if (typeof sigB64 !== 'string' || sigB64 === '') return null;

    const material = asRecord(bundle?.['verificationMaterial']);
    // Both shapes sigstore has used: a single certificate, and a chain.
    const single = asRecord(material?.['certificate'])?.['rawBytes'];
    const chain = asRecord(material?.['x509CertificateChain'])?.['certificates'];
    const first = Array.isArray(chain) ? asRecord(chain[0])?.['rawBytes'] : undefined;
    const certB64 = typeof single === 'string' ? single : typeof first === 'string' ? first : null;
    if (certB64 === null || certB64 === '') return null;

    return {
        payloadType,
        payload: Buffer.from(payloadB64, 'base64'),
        sig: Buffer.from(sigB64, 'base64'),
        certDer: Buffer.from(certB64, 'base64'),
    };
}

/**
 * Verify the first readable attestation's DSSE signature against its own
 * certificate, and require that certificate to name this package's workflow.
 *
 * Returns a reason on every failure rather than a boolean, because the caller
 * prints it: a refusal a user cannot act on is a refusal they route around.
 * `crypto` is imported lazily so a caller that never verifies a signature does
 * not pay for the module — this runs on an install path, never in a hook.
 */
export async function verify_attestation_signature(doc: unknown): Promise<SignatureVerdict> {
    const list = asRecord(doc)?.['attestations'];
    if (!Array.isArray(list) || list.length === 0) return 'the attestation bundle carries no attestations';
    const crypto = await import('node:crypto');

    let lastReason = 'no attestation carried a readable DSSE envelope';
    for (const entry of list) {
        const env = readEnvelope(entry);
        if (env === null) continue;
        let cert: InstanceType<typeof crypto.X509Certificate>;
        try {
            cert = new crypto.X509Certificate(env.certDer);
        } catch {
            lastReason = 'the signing certificate could not be parsed';
            continue;
        }
        // The certificate's own identity, not the payload's claim about it.
        const san = cert.subjectAltName ?? '';
        if (!san.includes(SAN_WORKFLOW_MARKER)) {
            lastReason = `the signing certificate names ${san === '' ? 'no identity' : san}, not ${SAN_WORKFLOW_MARKER}`;
            continue;
        }
        let ok = false;
        try {
            ok = crypto.verify(null, dssePae(env.payloadType, env.payload), cert.publicKey, env.sig);
        } catch {
            ok = false;
        }
        if (!ok) {
            lastReason = 'the DSSE signature does not verify against the certificate in the bundle';
            continue;
        }
        return null;
    }
    return lastReason;
}
