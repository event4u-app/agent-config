<!-- evidence-type: analysis -->

# The unattended upgrade verifies provenance against a pinned sigstore root

**Date:** 2026-10-24 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, two rounds · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `dsse-trust-root-20261024.question.md`, beside this file
**Authority:** Class 2, council-decidable as recorded at the blocker; both seats
confirmed that classification, because every option strengthens or records a
floor and none lowers one.

## Verdict — (a), 2/2

| Seat | Choice | Owner-only |
|---|---|---|
| `anthropic` | **(a)** | no — "strengthens a floor" |
| `openai` | **(a)** | no for step 2.1; activating unattended replacement is a separate readiness decision |

Both seats rejected (b) because `npm audit signatures` passes no identity
policy and so never ties an attestation to this repository or
`publish-npm.yml`, and rejected (c) because documenting a demonstrated
publisher-authentication bypass does not mitigate it in an unattended
installer.

## Conditions, merged from both seats

1. **Pinned, not refreshed.** The exact `trusted_root.json` and npm's
   `keys.json` are embedded in each release with their source version and
   digest recorded; verification performs no online TUF refresh. `openai`:
   reading roots out of an installed dependency is not an application-level
   pin unless that content is immutable under the install model.
2. **Full identity policy.** OIDC issuer
   (`https://token.actions.githubusercontent.com`), repository owner and
   repository, workflow path, the accepted workflow reference policy, the
   attestation predicate type, and the package subject — not a workflow
   filename alone.
3. **Chain, time and log.** Fulcio chain; certificate validity evaluated at the
   authenticated signing or integrated time, not at upgrade time; Rekor
   acceptance stated precisely (a signed entry timestamp and a Merkle inclusion
   proof are different guarantees).
4. **Two trust domains.** The SLSA provenance bundle (Fulcio/Rekor) and the npm
   publish attestation (npm's signing keys) are verified and versioned
   separately.
5. **Artifact binding.** The candidate tarball's SHA-512 is the decisive
   binding, and verification consumes the same bytes that are installed, before
   any global swap.
6. **Fail closed, no fallback.** Every unsupported, malformed or unverifiable
   state refuses the unattended install; there is no fallback to the
   certificate-bound check or to (b), and stale trust material is never
   refreshed because a candidate asks for it.
7. **Tested.** The self-signed-certificate fixture in
   `tests/lib/provenance_signature.test.ts` flips to a rejection; negative
   cases for SAN, issuer, payload and digest; an offline run proving no fetch;
   a positive run against a real release.
8. **Recovery.** Root and key rotation, and the manual upgrade path when pinned
   material is stale, are documented and exercised before activation.
9. **Exact dependency pins.** `@sigstore/verify` (and anything it needs) pinned
   exactly, lockfile changes reviewed — it becomes part of the trusted
   computing base.

**Additions one seat asked for and the other did not:** `anthropic` asked for
CI alerting on roots nearing expiry, an ongoing CI verification against the
latest published version rather than one fixture, and telemetry on
verification outcomes. Recorded; not conditions of the verdict.
