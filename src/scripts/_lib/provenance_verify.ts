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
