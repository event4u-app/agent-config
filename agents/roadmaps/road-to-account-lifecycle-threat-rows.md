---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-infra-threat-floor
    relation: extends
    note: "Archived. Added the infrastructure surface class and five rows to the same corpus; this follows its shape — one surface row, class-level rows, the `Decided by:` literal in the Negative Tests cell, no eighth column."
  - slug: road-to-consumer-security-guidance
    relation: disjoint
    note: "Archived; executed ADR-238. Nothing here reopens it: every row is a failure class with controls and tests, and every numeric value stays with the external authority."
estate_offset_exempt: "Adds one active roadmap with nothing to offset: none of the seven active roadmaps touches the threat corpus, the security skill or the PHP auth guidance, so folding it into one of them is not honest, and parking an unrelated roadmap would misstate it as blocked. The corpus gap is reproduced, not asserted: a registration request grounds to the file-upload class today."
---
# Road to account lifecycle threat rows

> **Source:** `agents/tmp.old/inbox-2026-10-j/` — a maintainer transcript
> (three user turns) asking how the suite can prevent, detect and fix the most
> common login and account-lifecycle mistakes, plus four agent-drafted plans
> from two hosts (a master, two revisions of one plan, a three-loop deep dive).
> Re-verified against `main@d41121927`; the plans were pinned 471 commits earlier (`main@5700678`).

## Goal

A request to build or change any account flow — sign-up, email verification,
login, password reset, a credential or email change, MFA, federated sign-in,
sessions — grounds into threat rows that name the failure class, its controls
and its negative tests; and the suite stops teaching the three account-flow
anti-patterns it teaches today. Every numeric security value stays with the
external authority, as ADR-238 decided.

## Context

Reproduced at `main@d41121927` with
`./scripts-run src/skills/corpus-grounding/scripts/ground ground --manifest src/skills/threat-modeling/data/manifest.json "<prompt>"`:

| Prompt | Surface class returned | Top threat |
|---|---|---|
| build user registration with email verification | **file-upload** (0.201) | IDOR / missing object-level check |
| login error message says the password for this email is wrong | authentication (0.386) | Session fixation / insufficient invalidation |
| add login with Google OAuth | authentication (0.249) | an infrastructure row |
| add passkey sign in | none — "no corpus rows matched" (0.0) | — |
| password reset flow | authentication (0.389) | an authentication row |

The corpus holds 20 threat rows, three of them `authentication`
(`threats.csv:2-4`); `surfaces.csv:2` keys the class on
`login password session jwt token oauth sso 2fa mfa reset` and nothing else.
Account enumeration, email ownership, credential change, MFA enforcement,
federated linking, token validation and login CSRF have no row.

Three places teach the opposite of the controls those rows would carry:

- `src/skills/form-handler/SKILL.md:57,60` recommends on-change
  username-availability checks as "the canonical exception", with no caveat —
  for an identity field that is an enumeration oracle.
- `docs/guidelines/php/api-design.md:83-85` registers the `auth` rate limiter
  keyed `->by($request->ip())` only — the limiter a credential-stuffing botnet
  spreads around and a shared NAT trips for everyone behind it.
- `src/skills/ai-code-blindspots/SKILL.md:55` says "never MD5/SHA" for password
  columns, but its backstop grep at `:95` matches only `md5\(|sha1\(`, and
  `src/skills/judge-security-auditor/SKILL.md:70` names only "MD5/SHA1". A
  SHA-256-with-salt password scheme passes both.

Two stale authority pins remain after the 2026-09-27 corpus re-derivation
(`6991eeab9` fixed threat-modeling's own references):
`src/skills/authz-review/SKILL.md:250` and
`src/skills/data-flow-mapper/SKILL.md:159` still cite ASVS 4.0.3. Neither
threat-modeling nor any skill cites ASVS 5.0's authentication chapter (V6) or
NIST SP 800-63B (0 hits for `\bNIST\b.*800-63`).

## Phase 1 — Stop teaching the anti-patterns

- [ ] **1.1 Qualify the availability check in `form-handler`.** Rewrite
      `SKILL.md:57,60`: an on-change availability check is an enumeration
      oracle for any field that identifies an account (email, phone, login
      handle) and is never the default there; it is acceptable only for a
      public handle that is not a login identifier, rate-limited, and as an
      explicit project decision. Point at the enumeration row from 2.2.
      verify: `grep -c 'canonical exception' src/skills/form-handler/SKILL.md` -> /^0$/
      and the rewritten lines name the enumeration row.
- [ ] **1.2 Repin the authorities.** `authz-review/SKILL.md:250` → ASVS 5.0.0
      V8 Authorization; `data-flow-mapper/SKILL.md:159` → ASVS 5.0.0 V1 Encoding
      and Sanitization + V2 Validation and Business Logic, using the same
      migration-guide mapping `threat-modeling/SKILL.md:218-224` already
      records. Add V6 Authentication and NIST SP 800-63B (current revision,
      read live at execution) to threat-modeling's References as the authority
      the authentication rows defer to — names and chapters only, no values.
      verify: `grep -rl '4\.0\.3' src/skills src/rules docs/guidelines` -> /^src\/skills\/threat-modeling\/SKILL\.md\s*$/
      — only the provenance sentence in threat-modeling remains.
- [ ] **1.3 Key the PHP `auth` limiter on the account, not only the IP.**
      Change the example at `docs/guidelines/php/api-design.md:83-85` to limit
      on the normalised account identifier together with the IP (a composite
      key or two limiters), and say in one sentence why IP-only fails in both
      directions. Keep the example's existing per-minute value — this step
      changes the key, not the threshold.
      verify: no `RateLimiter::for('auth'` block in `docs/guidelines/` is keyed
      by `$request->ip()` alone.
- [ ] **1.4 Close the fast-hash and raw-compare gap in the two checklists.**
      `judge-security-auditor/SKILL.md:69` — the information-disclosure row
      covers observable differences between known and unknown accounts
      (status, redirect, an early return before verification), not only the
      error text. `:70` — cryptography misuse names a general-purpose fast
      hash (MD5, SHA-1, SHA-2) or a hand-rolled salt scheme for passwords, and
      `==` on a token, OTP or MAC. `ai-code-blindspots/SKILL.md:95` gains a
      password-scoped fast-hash pattern and a raw-secret-equality pattern in
      the file's existing `rg -n` shape.
      verify: a scratch fixture in `agents/runtime/tmp/` with four planted
      lines (`sha256($salt.$password)`, `hash('sha512', $password)`,
      `md5($password)`, `$token === $request->token`) and three clean twins
      (`hash_file('sha256', $path)`, `password_verify(...)`,
      `hash_equals($a, $b)`) — the extended greps hit all four and none of the
      three.

## Phase 2 — The rows the corpus does not have

- [ ] **2.1 Give account flows their own surface row.** Add a second
      `authentication` row to `surfaces.csv` — registration, email
      verification, account and credential change, MFA and recovery,
      federated sign-in — keyed on `register registration signup sign-up
      verify verification email-change passkey webauthn otp totp recovery
      magic-link oidc logout remember`; extend `manifest.json` `detect.surfaces`
      with `register signup passkey verify`. Choose keywords that no other
      class already owns (`token` and `policy` are taken; `verify` collides
      with webhook signature verification — probe it, drop it if it steals).
      verify: the five Context prompts return `authentication`, and one probe
      per existing class (nine) returns that class unchanged, before and after.
- [ ] **2.2 Add the account-lifecycle threat rows.** All in class
      `authentication`, existing seven columns, Source Refs as CWE plus the
      ASVS 5.0 chapter, every Negative Tests cell ending with the `Decided by:`
      literal the infrastructure rows use. One row each:
      account enumeration through any observable difference (message, status,
      redirect, cookie, an early return before the verifier — CWE-204/203/208),
      sign-up for an existing address included: the same response, and a
      notice mailed to the owner instead;
      unverified email ownership granting privilege, including a verification
      or magic link consumed by a mail scanner's GET, and a verification token
      that is not single-use under concurrent requests (CWE-287/640);
      password acceptance weaknesses — composition rules, forced rotation, a
      low maximum, blocked paste, no breached/common blocklist (CWE-521);
      fast or home-made password storage — a general-purpose hash even
      salted, a hand-rolled salt scheme, no rehash on login, an input beyond
      the algorithm's own length limit silently truncated, a pepper as a
      literal or beside the hash (CWE-916/759);
      unsafe secret comparison and home-made credential primitives — `==` on
      a token, OTP or MAC, an own token or OTP generator (CWE-208/338);
      reset beyond the token — a Host-derived link, Referrer leak, auto-login,
      sessions left alive, MFA bypassed, non-atomic single use under
      concurrent requests (CWE-640/362);
      identity mutation without fresh re-authentication at the required
      assurance or without notifying the old channel — email, phone,
      password, MFA factor, passkey, recovery codes, linked identity — and a
      sign-in from a new device that notifies nobody, with each event logged
      without the secret (CWE-620/778);
      MFA enforced only in the UI, recovery weaker than the factor it
      replaces, a TOTP secret stored in plaintext, backup codes stored
      unhashed or usable twice (CWE-308);
      persistent login and logout — remember-me reaching a sensitive action,
      logout that clears only the client (CWE-613/539);
      federated sign-in takeover — linking on email equality, an unverified
      email claim, missing transaction binding, issuer mix-up (CWE-287/352);
      self-contained token validation bypass — `alg: none`, key taken from the
      token, unchecked issuer/audience/expiry, an ID token used as an access
      token (CWE-347);
      login CSRF (CWE-352);
      signup abuse and disposable addresses as a **policy** row — allow, warn,
      challenge or block by product type, any list a consumer dependency,
      never a synchronous third-party call per request (CWE-799).
      Amend the existing row 2 (credential stuffing) rather than duplicating
      it: spraying alongside stuffing, an OTP resend that must not reset the
      counter, resend, MFA-challenge and invite endpoints throttled like login,
      recovery that stays open during throttling, verification cost admitted
      before the hash runs. The parameter grep for this roadmap is
      `grep -nE '4096|65536|cost=|rounds|memory_cost|time_cost|[0-9]+ (characters|chars|attempts)'`.
      verify: one frozen prompt per added row returns that row among the top
      four `threats` results, each original authentication row still returns
      for its own prompt, and the parameter grep over the added and amended
      rows prints nothing.
- [ ] **2.3 Give the authentication reasoning row its decisions.** Fill the
      empty Severity cell at `reasoning.csv:2` (every other class carries
      one) and add decision rules: `if_registration` verify-before-privilege;
      `if_federated_signin` identity-is-issuer-plus-subject;
      `if_sensitive_mutation` fresh-reauth-at-required-assurance;
      `if_unknown_identity` same-verifier-path-same-outcome;
      `if_pepper` outside-the-credential-store-with-rotation-plan;
      `if_email_canonicalization` one-project-function-no-provider-alias-stripping-by-default;
      `if_provider_managed` verify-configuration-not-rebuild.
      verify: `./scripts-run src/skills/corpus-grounding/scripts/ground ground --manifest src/skills/threat-modeling/data/manifest.json "build user registration with email verification"` -> /authentication/
      — the new rules appear under its reasoning block, with no `no reasoning rule matched` gap.
- [ ] **2.4 Record the re-derivation in the manifest.** Update
      `manifest.json` `upstream.sha` to name the added rows and their
      authorities.
      verify: `./scripts-run src/scripts/check_corpus_staleness` -> 0

## Phase 3 — Reach the rows from the skills a consumer asks through

- [ ] **3.1 Give `security` its triggers and evals.** Add `triggers:` to
      `src/skills/security/SKILL.md` (login, registration, sign-up, password
      reset, email verification, MFA, passkey, OAuth or social login, session)
      and an `evals/triggers.json` with at least eight should-trigger and four
      should-not prompts. "add login with Google" — a should-not for
      `authz-review` (`evals/triggers.json:20-21`) and a should for no skill
      today — becomes a should here. The `description:` field is not touched.
      verify: the trigger eval for `security` passes, and `authz-review`'s
      eval still passes unchanged.
- [ ] **3.2 Add an account-flow block to `security`.** At most fifteen lines
      under Conventions: public auth responses are an observable contract,
      not an error string; compare secrets with the library's constant-time
      primitive and respect its length precondition; never a fast hash, never
      an invented credential primitive; an identity mutation needs fresh
      re-authentication; trace input → lookup → verification → secret →
      state change → session → response before judging a flow. Point at the
      rows and at the ADR-238 boundary block already in the file.
      verify: the parameter grep from 2.2 over the added lines returns
      nothing, and the skill linter passes.
- [ ] **3.3 Add the equivalence case to `test-case-discovery`.** In the
      procedure at `SKILL.md:150` (not the Iron Law fence above it): on an
      identity path, one case asserts that two security-equivalent identities
      — known and unknown, verified and unverified — produce the same public
      outcome. Name it like a test.
      verify: the procedure names the case, and `git diff` shows no change
      inside the skill's Iron Law fence.
- [ ] **3.4 Give the review-routing example an account pattern.** One entry
      in `src/agent-src/templates/scripts/historical-bug-patterns.example.yml`
      for an auth response disclosing account existence, paths on auth
      controllers and routes, `required_test` the equivalence case from 3.3.
      verify: the template parses as YAML and `pr_review_routing.ts`'s own
      tests pass.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| E1 | reversible-technical | agent | Own roadmap with `estate_offset_exempt`; the detector is a second roadmap that depends on this one | no active roadmap touches the threat corpus or the security skill | a roadmap owning the threat corpus appears and this folds into it |
| E2 | reversible-technical | evidence | A second `authentication` surface row (2.1) rather than more keywords on the login row | the registration prompt grounds to `file-upload` today; the login row's keywords cannot carry sign-up, verification or MFA | the nine-class probe in 2.1 shows a second row cannot avoid keyword theft |
| E4 | critical-technical | evidence | No ADR-238 amendment. Mechanism-match: ADR-238 bounds parameters and keeps vulnerability classes (`ADR-238:86-90`); lengths and attempt ceilings stay with the authority, enforced by the parameter grep in 2.2 | `ADR-238:51-59` accepts a family prohibition as class-level | a row cannot state its control without a number, which would be ADR-238's Trigger A and an owner question |
| E13 | reversible-technical | evidence | No new `identity-boundary` rule, so there is no auto-rule prose to retire; the Iron Law content lands as rows and the `security` block | `auto-rule-budget.json` may only move down | the rows and the skill block are measured as not reaching the agent before an edit | <!-- ref-ignore -->
| E14 | reversible-technical | evidence | No separate transitions CSV; the state vocabulary rides in the MFA and identity-mutation rows | the manifest plans one surface row and four threat rows per query | rows exceed what four retrieval slots can surface |
| D-tier | critical-technical | evidence | No algorithm preference order (Argon2id, scrypt, bcrypt, PBKDF2 for FIPS) in any artefact; rows prohibit fast and home-made schemes and route preference to the authority | ADR-238's bright line names "cryptographic algorithm tier" | ADR-238 is reopened under its own triggers |

## Non-goals

No new skill, rule, command, hook concern or verb. No disposable-domain list in
the package, no network call (breach lookups and disposable lists are consumer
runtime). No CAPTCHA, security questions or SMS as a default recommendation. No
pepper requirement — absence is not a finding. No algorithm tier, work factor,
length or attempt number in any row. No generator from rows to test files: the
Negative Tests cells already reach the agent through `ground`, and turning them
into failing tests is `test-first` and `test-case-discovery`'s job — revisit if
a measured run shows rows retrieved and the tests still not written.

## Source crosswalk

The source argues in its own ids; each lands here, in the detector roadmap, or
in a one-line decline.

- **Adopted here.** V2–V5 · T1–T9, T11–T22 (T18 as 2.3's `if_provider_managed`,
  T19 as 3.3, T20 as 2.1 and 3.1) · D1–D6, D8–D15, D25–D27, D31–D33 · A1–A18,
  consolidated into 2.2's rows · C01–C10, C12–C21, and C22's assurance
  attributes inside the MFA and identity-mutation rows · W0.1–W0.3, W0.5,
  W1.1, W1.3, W2.3, W2.4, W4.5, W4.6 (as a Required Control, not a codemod) ·
  R0, R1 (without an ID column) · G1, G2, G8, G9, G13 as verify lines ·
  F1–F11 as 2.2's frozen prompts · D17 for PHP only, as 1.3.
- **In `road-to-account-surface-detector`.** D20 · W3.1–W3.3 in part · W6.1 ·
  G4, G5, G11, G12 · E5, E7, E8, E11 · R4 · F12 · the evidence states and
  remediation classes of the deep dive's Loop 2 · the extended false-positive
  questions (observable, reachable, existing mitigation, framework default)
  as the line between `violated` and `suspected`.
- **Declined.** D7, T10 and C11 passkeys — keyword and MFA row only, no
  failure class distinct from factor enforcement · D18, W2.1, R3 and G3
  generator and plan bench — see Non-goals · D19 and W2.2 flow mount —
  `security-sensitive-stop` already dispatches `threat-modeling` before the
  edit · D21, W3.4, R2, E9 and E10′ route extraction — held in
  `later/road-to-a-graph-that-wins` step 1.2 · R5 graph-backed missing-control
  checks — need that route relation first · D22, W3.5, E10 and R10's registry
  row — added when the detector's claim is backed · D23, D24, W5.1, W5.2,
  W5.5, R8, R9 and G7 baseline, session-start line, advisory concern,
  accepted-risk-as-incident — the prelaunch AUTH area is the existing
  cross-session surface, the concern budget allows no new concern, an accepted
  risk is not an incident · D28–D30 are budget facts this plan obeys · W0.6,
  W7.4, W7.5, E13, E14 — nothing new to pay for · W2.5 completion contract,
  W6.3, R6, E11′, G14 runtime and timing probes — no probe capability exists
  (`runtime-probe` is `unknown`) · W4.1–W4.4, R7, G6, G10 codemod engine —
  the detector's remediation class feeds `active-remediation` instead ·
  monitoring hooks for attack spikes, normalisation fuzzing and property-based
  tests — no generator and no observability surface owns them here · W5.4,
  E6 and E3 — no new command or concern · W5.6 — no grader dimension · W1.2 —
  see E14 · W1.4 stacks other than PHP — added when the detector measures them ·
  W0.0, E12 and V1 — the video was unreachable on every fetch path the source
  tried, and V1 is a frequency claim nobody can verify here · E9′ provider
  register — vendor capabilities are dated third-party facts · the deep dive's
  §2.1 stable ID column — the infrastructure rows rejected an eighth column
  for the same corpus · P0–P3 are honoured as this file's phase order ·
  K1–K18 are carried as Non-goals · S1–S23 and every annex stay out of the
  tree.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Retrieval dilution | implementation | Thirteen new authentication rows compete for four `threats` slots; the three original rows, or another class, stop surfacing for the prompts that found them before | 2.2's verify runs one prompt per new row **and** one per original row; 2.1's verify probes every other class before and after | Phase 2 — The rows the corpus does not have |
| 2 | Keyword theft | implementation | A new surface keyword (`verify`, `recovery`) is already the natural word for another class, so webhook or backup prompts start grounding as authentication | Keywords chosen against the existing rows, and the nine-class probe in 2.1 fails the step on any changed class | Phase 2 — The rows the corpus does not have |
| 3 | A number creeps into a row | product | Writing a helpful row pulls a length, attempt ceiling or work factor into the corpus, which ADR-238 forbids and which goes stale silently | Rows defer every value to the named authority; the parameter grep in 2.2 and 3.2 is mechanical, not a reading judgement | Phase 2 — The rows the corpus does not have |
| 4 | Rows read as mandates | product | A project that deliberately discloses "email already registered" for UX gets every grounding call flagging it as a defect | The enumeration row's Required Controls state that a disclosed exception is a written project decision, not a defect | Phase 2 — The rows the corpus does not have |
| 5 | Trigger overlap | implementation | `security` triggers on `login` and `session` overlap `broken-access-control` and `threat-modeling`, and the route check flags the collision | 3.1's verify runs both skills' evals; overlapping phrases are kept only where the two skills answer different questions | Phase 3 — Reach the rows from the skills a consumer asks through |

## Acceptance Criteria

- [ ] AC-1 — The five Context prompts ground to `authentication` and each
      returns at least one row added in 2.2 among its top four threats; the
      other nine surface classes ground as they did before.
- [ ] AC-2 — `threats.csv` carries a populated row for every failure class
      listed in 2.2, and no added or amended row carries a length, attempt
      count, iteration count, work factor or algorithm preference order.
- [ ] AC-3 — The enumeration row's Negative Tests require known and unknown
      identities to produce the same public outcome — status, body category,
      redirect, cookies — not only the same sentence (the source's own
      "never say the password for user X is wrong", stated as a test).
- [ ] AC-4 — The storage row prohibits every general-purpose fast hash,
      SHA-2 included and salted or not, and states that a pepper, when used,
      lives outside the credential store and is never a literal; its absence
      is not a finding.
- [ ] AC-5 — No file under `src/skills`, `src/rules` or `docs/guidelines`
      presents an identity-field availability check as a default, keys the
      `auth` limiter on the IP alone, or cites ASVS 4.0.3 as current.
