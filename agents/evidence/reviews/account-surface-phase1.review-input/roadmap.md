<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
depends: [road-to-account-lifecycle-threat-rows]
relates:
  - slug: road-to-account-lifecycle-threat-rows
    relation: depends
    note: "Every finding cites a threat row by its Threat cell. Phase 1 here (fixtures and claim) may start at once; Phase 2 may not land before that roadmap's step 2.2 has merged."
  - slug: road-to-a-graph-that-wins
    relation: disjoint
    note: "Parked in later/. Its step 1.2 route relation is what graph-backed missing-control checks would need; this roadmap is lexical only and waits for nothing there."
estate_offset_exempt: "Adds one active roadmap with nothing to offset: no active roadmap reads consumer application code for account-flow defects, and folding this into the threat-rows roadmap would put a measured instrument and a content change behind one acceptance gate. Parking it would be false — Phase 1 is workable today."
---
# Road to an account surface detector

> **Source:** `agents/tmp.old/inbox-2026-10-j/` — the detect-and-fix half of a
> maintainer request: the suite should recognise login and account-lifecycle
> defects in a consumer's code and fix them or offer the fix. Re-verified
> against `main@d41121927`.

## Goal

A deterministic, offline, read-only audit reads a consumer repository's
account-flow code and reports the defects that a local pattern proves — each
finding naming its threat row, its location, an evidence state and a
remediation class that `active-remediation` already knows how to act on. Its
recall and false-positive rate on frozen fixtures are pre-registered before the
first line of detector code and published after; until they are backed, every
finding it prints is labelled unmeasured.

## Context

Nothing in the tree reads a consumer's login code. The scanners under
`src/scripts/` check the package itself, the consumer's agent configuration,
tool output or secrets; `grade_target_readiness.ts` grades thirteen
dimensions, none of them authentication (`:330-508`); the prelaunch area
`AUTH` is filled by the model with `unknown` as its honest default
(`src/skills/launch-readiness/SKILL.md:79-82`). The suite's own guidance even
teaches one of the defects — an `auth` limiter keyed on the IP alone
(`docs/guidelines/php/api-design.md:83-85`), fixed by the sibling roadmap.

The precedent for the shape is `check_web_launch_readiness.ts`: a consumer
audit invoked by `production-validator`, honest about what it cannot decide,
and gated on a claim pre-registered before its code (`docs/CLAIMS.md:259-264`).
Graph-backed checks ("a limiter exists but is not wired to `/login`") need a
route relation the code graph does not emit (`code_graph/verbs.ts:671-674`
reports `routes: empty`), so they are out of scope here.

## Phase 1 — Fixtures and claim before code

- [x] **1.1 Build the frozen fixture set.** Under
      `tests/fixtures/account-surface/`, two stacks (a PHP framework shape and
      a Node/TypeScript shape), one unsafe file and one safe twin per class in
      2.1, plus decoys that must stay silent: a login page that only changes
      CSS, documentation that mentions passwords, `sha256` over a file, a
      `salt` field unrelated to passwords, a `token` variable unrelated to
      authentication, and a `pepper` read from the environment. A
      ground-truth list beside them names every expected finding.
      verify: the ground-truth list has an entry for every unsafe file and
      none for a twin or decoy; no fixture file name ends in `.test.ts`.
- [x] **1.2 Pre-register the claim.** Add `account-surface-finds-planted` to
      `docs/CLAIMS.md` as `unbacked`, before any detector code: per class,
      recall on the planted defects and false positives across twins and
      decoys; a flagged decoy is a classification failure that fails the
      class regardless of recall. Bars are set in the claim text, the
      source's own proposal being recall ≥ 0.90 and false positives ≤ 0.03
      per class.
      verify: the claim exists with status `unbacked` in a commit that
      contains no `check_account_surface` code, and `build_proof` runs clean
      in the same change.

## Phase 2 — The detector

Still gated on the sibling roadmap, re-checked against the tree on 2026-10-13
rather than read off this file: `src/skills/threat-modeling/data/threats.csv`
carries three `authentication` rows (credential stuffing, session fixation,
password-reset token abuse), and six of the Threat cells Phase 1's ground truth
cites are not among them. They arrive with `road-to-account-lifecycle-threat-rows`
step 2.2, which is unmerged. Until then a finding citing one of those cells
would name a row that does not exist, so Phase 2 stays open; the pending cells
are declared under `pending_threat_rows` in
`tests/fixtures/account-surface/ground-truth.json` rather than assumed.

- [ ] **2.1 Write `src/scripts/check_account_surface.ts`.** A path predicate
      first (route, controller, handler and config files whose names carry
      login, register, signup, password, reset, verify, session, oauth,
      callback, mfa, otp, passkey), then lexical classes inside it only:
      fast or home-made password hashing; `==` or `===` on a secret
      (token, OTP, MAC, signature); a pepper as a literal or a credential-table
      column used as one; a reset link built from the request Host; email-based
      account linking switched on in a sign-in library's configuration; token
      verification disabled or `alg: none`; an auth token written to
      `localStorage`; an auth response string that discloses account existence,
      reported `suspected` because the string alone does not prove the route
      is public. Each finding carries `threat_row`, `file:line`, `evidence`
      (`violated` · `suspected` · `unknown` · `not-applicable` — a missing
      pattern is never reported as a pass, and a hit is `violated` only when
      the file is reachable on the account surface and no framework default
      or existing mitigation in the same file covers it) and `remediation`
      (`mechanical` · `policy` · `migration` · `informational`). Offline,
      read-only, no subprocess.
      verify: the script's tests over the Phase 1 fixtures pass under a
      `vitest` filter, and a run over `src/` of this repository writes
      nothing and exits with a scanned-files count.
- [ ] **2.2 Bind remediation classes to the existing ladder.** `mechanical`
      means a fix that uses a primitive the project already has (its own
      safe-compare helper, its configured app URL) and invents no policy;
      `policy` and `migration` are never applied — they become the
      note-and-ask candidates `active-remediation` already prescribes, with a
      "leave it" option. A hash migration, a new rate-limit threshold, a
      cookie mode or an MFA rollout is never `mechanical`.
      verify: every class in 2.1 has exactly one remediation value, and the
      fixtures for hash storage and token verification map to `migration`
      and `policy`.

## Phase 3 — Measure, then let the existing callers use it

- [ ] **3.1 Measure against the claim.** Run the detector over the frozen
      fixtures and record per-class recall and false positives in
      `account-surface-finds-planted`. A class below its bar stays
      `suspected`-only in the detector's own output.
      verify: the claim's evidence names the commit measured and one figure
      per class; its status is `backed` only if every class it keeps
      `violated` met the bar.
- [ ] **3.2 Wire it where web-launch readiness is already wired.** One step in
      `src/subagents/production-validator.md` and one sentence in
      `launch-readiness`'s AUTH area: run the detector on account-flow
      changes, read `unknown` as unknown, and carry `violated` findings into
      the prelaunch report as `AC-AUTH-NNN` ids. While the claim is
      `unbacked`, both say the output is unmeasured.
      verify: both files name the command and the unmeasured label, and
      `prelaunch_diagnostics.ts validate` accepts a report carrying one
      detector-sourced `AC-AUTH` finding.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| E5 | reversible-technical | evidence | No advisory hook; the detector is invoked by its callers in 3.2 | the concern budget has no allowance (`estate-count-budget.json:27`), and the source's own Loop 3 forbids activation before measured quality | the claim is backed and a hook-borne caller is proposed with its own budget claim |
| E7 | reversible-technical | agent | Bars are pre-registered in the claim (1.2), starting from the source's proposal | a bar written after the measurement is not a bar | the first measurement shows a bar no lexical class can meet |
| E8 | reversible-technical | agent | Two stacks in the fixtures (PHP framework, Node/TypeScript) | the suite's PHP auth guidance and the web-launch precedent cover these two | a consumer asks for a third stack |
| D-enable | product-owned | owner | Turning the detector on by default for consumers is not taken here; this roadmap ends with the claim measured and the output labelled | a consumer-facing default flip is outside an agent's authority | the claim is `backed` — the owner decides then |

## Non-goals

No hook concern, no session-start line, no baseline file in the consumer, no
grader dimension and no capability-registry row before the claim is backed. No
codemod engine and no automatic application of a `policy` or `migration`
finding. No graph-backed "defined but not wired" checks, no runtime or timing
probes, no network, no LLM verdict as a finding. No new command or verb.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Fixtures trip the secret guard | implementation | A planted pepper literal or token is exactly what `check_secret_leak` and the secret-in-VCS guard exist to stop, so the fixture commit is blocked or a real-looking value lands in the tree | Every planted value is an obvious placeholder (`changeme-pepper`), and the fixture directory carries the audited allow-marker rather than a weakened detector | Phase 1 — Fixtures and claim before code |
| 2 | A regex certifies safety | product | The detector finds no pattern and a reader takes that as "login is safe" — the false green the source names as the failure | Absence is never a finding state; the report states what was scanned and which classes it cannot decide, and 3.2 tells callers to read `unknown` as unknown | Phase 2 — The detector |
| 3 | Fixtures written to fit the detector | implementation | The fixture set and ground truth drift towards what the detector already catches, so the claim measures the authors | 1.1 and 1.2 land before any detector code, in a commit 1.2's verify checks for its absence | Phase 1 — Fixtures and claim before code |
| 4 | Decoy noise on unrelated code | implementation | `token`, `hash` and `salt` are everywhere; without the path predicate the detector flags CSRF tokens and file checksums | Classes run only inside the path predicate, and three decoys target exactly these words | Phase 2 — The detector |
| 5 | Package size | implementation | A new shipped script grows the published package against its size budget | The script is single-file with no dependency; the pack-size check runs before the PR | Phase 2 — The detector |

## Acceptance Criteria

- [ ] AC-1 — `account-surface-finds-planted` exists in `docs/CLAIMS.md`,
      registered in a commit without detector code, and after Phase 3 carries
      one measured recall and false-positive figure per class.
- [ ] AC-2 — The detector flags no decoy and no safe twin in the frozen set,
      and every class it reports as `violated` met its pre-registered bar.
- [ ] AC-3 — No finding is ever printed as a pass from the absence of a
      pattern; a run states the files scanned and the classes it could not
      decide.
- [ ] AC-4 — No remediation class the detector emits can apply a hash
      migration, a threshold, a cookie mode or an MFA rollout without the
      note-and-ask step of `active-remediation`.
