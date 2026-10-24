/**
 * Which workflow, in which repository, a legitimate release of this package is
 * built by — and the check that a SIGNED provenance payload names them.
 *
 * Signatures, trust roots and the tie to the tarball are verified in
 * `sigstore_provenance.ts`; this module only reads a payload that has already
 * been verified there. It used to carry a certificate-bound signature check of
 * its own, which checked no issuer and so passed a self-signed certificate
 * carrying the expected SAN; that check is gone rather than kept as a fallback.
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

/**
 * Does this provenance payload say the tarball was built by this package's
 * publish workflow, in this package's repository?
 *
 * Both halves are required and both reject on absence: a payload that names no
 * workflow is not one that names the right one. Repository is compared with
 * the trailing `.git` and any trailing slash removed, because the same remote
 * is written both ways and neither spelling is an attacker signal.
 */
export function payload_names_publish(payload: Record<string, unknown> | null): boolean {
    const predicate = asRecord(payload?.['predicate']);
    const workflow = asRecord(asRecord(asRecord(predicate?.['buildDefinition'])?.['externalParameters'])?.['workflow']);
    if (workflow?.['path'] !== EXPECTED_WORKFLOW_REF) return false;
    const repo = workflow['repository'];
    if (typeof repo !== 'string' || repo === '') return false;
    return repo.replace(/\.git$/, '').replace(/\/$/, '') === EXPECTED_REPOSITORY;
}
