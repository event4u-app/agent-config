<!-- evidence-type: analysis -->

# Self-installing update — dated step notes

Moved verbatim on 2026-10-25 out of `road-to-an-update-that-installs-itself-only-when-it-is-safe`,
whose lightweight cap (600 lines, 150 words a step) they exceeded. Each section is the
continuation block of the step it names, unedited but de-indented.

## Step 2.1 — `upgrade --unattended`, no new verb

*Open on one gate (2026-10-18).* The flag, the age, `deprecated`,
`engines` and impact-map gates landed with a refusal fixture each. The
provenance gate checks that an attestation is present and carries an
SLSA provenance predicate; it does **not** verify the attestation's
signature or tie it to `publish-npm.yml`. That verification is what
keeps this step open. Harmless today: the production wiring swaps
nothing until 1.4.
*The `running_origin` half is fixed (2026-10-19).* Both of
`_is_source_repo`'s positive signals ship in every tarball, so every
installed package read as a source checkout; the `.git`-at-package-root
test is now the one shared definition. Measured on a real packaged
install, before and after:
`agents/evidence/analysis/running-origin-source-checkout-2026-10-19.md`.
*The signature half landed half-closed (2026-10-20), and the half that
did not is now a blocker rather than a sentence.* `provenance_verify`
gained `verify_attestation_signature`: the DSSE envelope's signature is
verified against the public key of the certificate the bundle carries,
over a real pre-authentication encoding, and that certificate's own SAN
must name `publish-npm.yml` in this repository — so a payload edited
after signing, a signature that does not belong to its own certificate,
and a bundle whose payload claims one identity while its certificate
carries another are all refused. Fixtures are real: an EC P-256 key and
a certificate minted with `openssl`, a genuine signature, both
directions asserted
(`tests/lib/provenance_signature.test.ts`).
**What is NOT closed:** there is no trust root — no Fulcio issuer check,
no Rekor inclusion proof — so a self-signed certificate carrying the
expected SAN passes, and that is asserted as a known limitation in the
same test file rather than left to be discovered. Closing it is a
dependency decision, registered as `### blocker: dsse-trust-root`.
A sentence this step used to rest on was also false and is retracted
rather than quietly dropped: `upgrade_unattended.ts` claimed the
signature half was `npm audit signatures` "in the install step", and
`install_steps` never ran an audit.

## Step 4.3 — Ask once, at a moment that earned it

Since 2026-10-21 the "never" is the setting: any mode but `ask` stops it.
**Reopened 2026-10-21:** the registration was withdrawn after rounds 5
and 6 refused it — the one global claim is finalised on workspace-written
evidence without confirmed delivery. It closes when the claim is.
Done note: `agents/evidence/analysis/update-concerns-lifecycle-2026-10-21.md` § 4.3.
**Still open 2026-10-25, and now on a blocker rather than a sentence:**
`### blocker: ring-0-exit-pending`. Re-read at `origin/main@ac7348134`:
the ring-0 record carries zero rows and `ring-0-exit: no`, and the
registry has no `next` dist-tag at all (`npm view @event4u/agent-config
dist-tags` → `{ latest: '17.4.0' }`), so no maintainer machine can have
installed even one release unattended on the ring-0 channel. The
invitation's code and tests stand; registering it now would be the
unbound surface round 11 refused, gated shut by the same record.
