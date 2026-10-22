<!-- evidence-type: analysis -->

# Resolved blockers of the self-installing update — the reasoning they were resolved on

Moved verbatim on 2026-10-20 out of `road-to-an-update-that-installs-itself-only-when-it-is-safe`,
whose lightweight cap it exceeded. Both blockers are resolved (ADR-290, ADR-291);
this is the record of the recommendation and the council readings they carried
before resolution.

## blocker: node-floor-raise

- **Recommendation:** (a), **and an AI council of 2026-10-16 agrees while
  confirming this reaches the owner.** Both seats (`anthropic`, `openai`, prompt
  mode, two rounds, 2/2, no split) returned **ESCALATE** — dropping Node 20
  *removes a compatibility commitment*, whatever the runtime's own support
  status — and both picked **(a)**. Record:
  `agents/evidence/council/owner-blocker-routing-20261016.md`.

  **The framing `anthropic` added changes what is being asked.** Cut as a
  **semver-major**, the question is no longer *"may we break Node 20 in a
  minor?"* but *"may we cut a major now?"* — a documented contract point rather
  than an unannounced removal. Both seats require the `engines.node` change and
  the CI pins to move **atomically**, and both require migration notes naming
  the last Node-20-compatible version and stating plainly that it receives no
  security, bug or compatibility backports.

  `openai`'s decisive reading: CI pins Node 20 while `SECURITY.md:21` backports
  nothing to it, so the repository already emits *"a compatibility signal the
  project will not actually honor"*.

  **Re-measured 2026-10-16, because this entry quotes a count.** `engines.node`
  is `>=20.11.0`; the workflows carry **38** literal `node-version: '20'` pins
  across **20** files plus **3** matrix lists `node: ['20', '22']` in 2 more —
  41 sites in 21 files, not the 45 below. The figure does not change the
  decision.

  > **Correction, 2026-10-22 (release finding `0313f57807fe`).** "In 2 more"
  > overstates by one file: the matrix lists sit in `consumer-matrix.yml`
  > (two, a file already among the 20) and `smoke-public-install.yml` (one).
  > The total of 21 files is right. Re-derived with
  > `git grep "node: \[" b30932a787d4 -- .github/workflows`.

  *Original reasoning:* Node 20 passed its support window on 2026-04-30,
  `SECURITY.md:21` backports nothing, and the raise is the only consumer-facing
  `action` release in sight — which makes it the honest first test of the ask
  path rather than a fixture standing in for one.

## blocker: auto-default-for-existing-installs

- **Recommendation:** (b) until the ring-0 record exists, then reconsider.
  `non-destructive-by-default` treats a silent change to an install the user
  already has as the thing a default flip must not be, and nothing measured so
  far argues the other way.

  **An AI council split on this one, 2026-10-16 — the only split in ten rounds —
  so it escalates on the escalation condition rather than on a reading.** Record:
  `agents/evidence/council/owner-blocker-routing-20261016.md`.

  `anthropic` — **DECIDE, (b)**: the reserved list names *externally binding,
  liability-creating* commitments, and an internal policy about how
  conservatively defaults evolve is none of those. Its sharpest point:
  **neither (a) nor (b) weakens the floor** — both ask before changing — so the
  choice is how conservative to be, not whether to preserve the user's agency.
  Only (c), which neither seat picked, would weaken it.

  `openai` — **ESCALATE, (a)**: whether an existing install may acquire
  materially different update behaviour is a public behavioural commitment. (a)
  preserves the consent state of existing installs without freezing the product
  forever: new installs may default to `auto`, existing ones keep `notify`
  unless they accept a one-time invitation carrying a durable "never".

  **Worth stating for whoever answers: the seats are one step apart, not
  opposed.** (a) and (b) differ only in whether a single invitation may ever be
  shown to an existing install. Both forbid a silent flip, and both leave (c)
  refused.

