<!-- evidence-type: analysis -->

# Council question — `dsse-trust-root`: which trust root does `upgrade --unattended` verify against?

You are one seat of a two-provider council deciding a recorded blocker of the
roadmap `road-to-an-update-that-installs-itself-only-when-it-is-safe` in the
npm package `@event4u/agent-config`. The blocker is Class 2 (council-decidable):
every option is a reversible internal engineering trade-off, and none lowers a
check that exists today.

## What exists today

`upgrade --unattended` refuses unless several gates pass (72 h release age,
`deprecated`, `engines`, an impact map, and provenance). The provenance gate,
`src/scripts/_lib/provenance_verify.ts` (`verify_attestation_signature`), uses
`node:crypto` only. It verifies the DSSE envelope signature against the public
key of the certificate the attestation bundle carries, over a real
pre-authentication encoding, and requires that certificate's SAN to name this
repository's `.github/workflows/publish-npm.yml`.

Nothing checks who ISSUED that certificate: no Fulcio chain, no Rekor
inclusion proof. An attacker who can serve the registry response an install
reads can mint a self-signed certificate with the expected SAN, sign a payload,
and pass. `tests/lib/provenance_signature.test.ts` asserts that limit as a test.

The unattended path does not install anything today in production, independent
of this gate: it refuses while another session is live, and no hook starts it.

## The three options, as the blocker states them

- **(a)** Take a sigstore verification dependency, pin the trusted roots,
  verify the Fulcio chain and the Rekor inclusion proof in process.
- **(b)** Shell out to `npm audit signatures` against a throwaway install of the
  candidate before the global swap.
- **(c)** Record the certificate-bound check as the floor this package
  verifies, state the residue in `SECURITY.md`, and close the step on that.

## Measurements (2026-10-24, npm 11.19.0, node 26.7.0, macOS; against the real `@event4u/agent-config@17.3.0` attestation)

| | (a) `@sigstore/verify` in process | (b) `npm audit signatures` on a throwaway install |
|---|---|---|
| Installed bytes added | 948 KB (`@sigstore/verify@4.1.2`, 4 packages) · 2,300 KB with `@sigstore/tuf@5.0.0` (14 packages) · 11,804 KB for the full `sigstore@5.0.0` (52) | 0 B of dependencies; a 125 MB scratch install (the candidate plus its 200 packages) |
| Pack budget | none: runtime `dependencies` are installed, not packed; the pack gate measures the `npm pack` tarball (16.036 MB against 17.640 MB) | none |
| Extra download per upgrade | none | the 16.18 MB tarball again (2.05 s by curl), about 61 MB of npm cache on a cold install |
| Wall-clock | 0.3–9 ms with pinned roots or a warm cache; 444–803 ms when TUF refreshes online; the verify step itself 7–14 ms | cold install 5.75 s; `npm audit signatures` 1.29 / 1.05 / 1.08 s |
| Offline (network denied by sandbox) | pinned roots: OK in 0.07 s; cold cache online-only: `TUF_REFRESH_METADATA_ERROR` after 3.08 s | fails with an npm network error after 70.2 s |
| What it verifies | Fulcio chain, Rekor tlog/SET, the DSSE signature, and a SAN identity policy the caller passes | registry signatures and attestations against sigstore's TUF roots, plus subject PURL and sha512 against the tarball; it passes **no identity policy**, so it does not tie the attestation to this repository or `publish-npm.yml` |
| Observed on 17.3.0 | the SLSA provenance bundle verified; a wrong SAN gave `UNTRUSTED_SIGNER_ERROR`; a tampered payload gave `TLOG_BODY_ERROR`. The npm publish attestation needs npm's `keys.json` key passed separately (`PUBLIC_KEY_ERROR` without it) | 17.3.0 reported verified |

Notes from the measurement: `@sigstore/tuf`'s bundled `seeds.json` already
contains `trusted_root.json`, so roots can be pinned with no TUF fetch at
runtime. The sha512 subject check against the tarball would remain this
package's own code under (a). Current runtime dependencies are
`@fastify/static, @modelcontextprotocol/sdk, @preact/signals, commander, execa,
fastify, graphology (+2), js-yaml, open, preact, web-tree-sitter, yaml, zod`;
none is sigstore.

## The question

Which of (a), (b) or (c) should this package adopt for step 2.1, and on what
conditions? If you choose (a), say whether roots should be pinned from the
bundled seeds or refreshed online, and what happens when verification cannot
run. If none of the three is acceptable, say what would be, concretely.

Answer with: your choice, the conditions you attach, and whether any part of
this is a decision only the repository owner may take (it is recorded as
council-decidable; say so if you disagree, and why).
