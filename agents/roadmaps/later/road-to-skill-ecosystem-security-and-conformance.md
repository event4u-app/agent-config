---
complexity: lightweight
status: later
---

# Road to security and conformance surface — make three unenforced rules detectable

> **Parked at queue position 5 of the verification track.** The 2026-08-05 council
> capped concurrently-open verification roadmaps at two. This roadmap is
> verification infrastructure and is eligible under the successor constraint, not
> under the capability arm.
>
> **Resume when** a verification slot frees — a predecessor roadmap reaches zero
> open steps and lands in `agents/roadmaps/archive/`. Verify with
> `./agent-config roadmap:progress`.

> Give three rules that honestly ship unenforced their first deterministic
> instantiation, verify that declared tool grants match what the code does in both
> directions, and review the external domains this package's own text points an
> agent at.

## Context

Source + verdicts:
[`skill-ecosystem-sweep-2026-08`](../../settings/contexts/skill-ecosystem-sweep-2026-08.md)
§ C5.

**The strongest signal in the security half of the sweep is a two-vendor
convergence from opposite directions.** One first-party suite ships an audit of
attacker-controlled input reaching an agent inside continuous integration; another
first-party suite ships the defensive answer as declarative confinement in the
workflow's own frontmatter. Both treat agentic CI as the live attack surface. This
package runs agents unattended over its own workflows and ships two rules covering
that surface, both honestly unenforced.

**The non-obvious mechanism worth recording regardless of adoption order.** An
expression interpolated inside an environment block resolves *before* the step
runs, so the field that consumes it can contain no expression at all and still
receive raw attacker text. Detection is a two-part match: an attacker-valued
environment entry at any scope, and the consuming field naming that variable. This
is the vector reviewers miss most often, and it is checkable.

**The lethal-trifecta rule can be partially bound.** One source implements the
three legs as a deterministic conjunction — a credential source and a transmission
mechanism and a known collector destination must co-occur in one file — and states
that the conjunction *is* the false-positive control, specifically because the
corpus is documentation-heavy. That is exactly this package's situation.

## Gap table

| Item from the sweep | Verdict | Where it lands |
|---|---|---|
| Lethal trifecta as a deterministic three-leg conjunction | KEEP | Phase 1 |
| Agentic-CI audit over this package's own workflows | KEEP | Phase 1 |
| Environment-interpolation two-part detection | KEEP | Phase 1 |
| Declarative confinement block for our own agentic workflows | KEEP | Phase 1 |
| Reasoned opt-down recorded inline with its compensating control | KEEP | Phase 1 |
| Base-branch tooling with the untrusted head in a separate worktree | KEEP | Phase 1 |
| Declared-versus-detected capability parity, both directions | KEEP | Phase 2 |
| Wildcard tool grant flagged | KEEP | Phase 2 |
| Path-and-script-scoped permission block | KEEP | Phase 2 |
| Trigger-abuse, snooping, and anti-refusal checks over our own tree | KEEP | Phase 2 |
| Reviewed external-domain allowlist | KEEP | Phase 3 |
| Script tag without integrity, plain-HTTP, and loopback patterns flagged | KEEP | Phase 3 |
| Outbound integrity: sign the released tree, verify content drift | KEEP | Phase 4 |
| Install ledger with an exact-uninstall contract | KEEP | Phase 4 |
| Host-managed boundary list excluded from the ledger | KEEP | Phase 4 |
| Cross-pack reference check against a consumer's installed subset | KEEP | Phase 5 |
| Host status enum with a required degrade contract | KEEP | Phase 5 |
| Reserved-versus-implemented annotation on schema fields | KEEP | Phase 5 |
| Handoff-chain bound with a visited set | KEEP | Phase 5 |
| Anti-circumvention clause on a fenced step | KEEP | Phase 5 |
| Misuse-resistant API review of our own exported surface | KEEP | Phase 6 |
| Variant sweep after a single finding | KEEP | Phase 6 |
| Signed decision receipts for hard-floor actions | FOLD | Phase 4 as a recorded option only; it collides with the anti-ceremony clause unless a requiring contract is cited, and adds a cryptographic dependency |
| Fail-open defaults framing | FOLD | Phase 6, into the misuse-resistant review rather than as its own artifact |
| Crypto, blockchain, and binary-analysis skills | CUT | No demand signal |
| Regulated medical-device conformity skills | CUT | Domain gate; content rots fastest in that class |
| Per-skill signature at artifact granularity | CUT | Untenable at this artifact count; Phase 4 signs at release granularity |

## Prerequisites

- [ ] **Step 1:** Enumerate this package's own workflows that invoke an agent, so Phase 1 audits a real set.

## Phase 1: Agentic CI, audited and confined

- [ ] **Step 1:** Add a skill that audits a workflow for attacker-controlled input reaching an agent, covering the vector set the sweep enumerated: environment-interpolation intermediary, direct expression injection, data fetched by a command, head checkout on a fork-triggered event, error-log injection, subshell expansion, evaluation of model output, permissive sandbox configuration, and a wildcard actor allowlist.
- [ ] **Step 2:** Record the attacker-controlled leaf-field enumeration in the untrusted-input guideline, and the two-part environment-interpolation match as a concrete detection heuristic rather than a principle.
- [ ] **Step 3:** Run the audit against this package's own workflows and record every finding with a disposition. Auditing others while never auditing ourselves is the failure this step exists to prevent.
- [ ] **Step 4:** Add a declarative confinement block to each of our own agent-invoking workflows: an explicit command allowlist, caps on what the agent may emit, and a network allowlist. This is the lethal-trifecta rule made deterministic for the one surface where we run agents unattended.
- [ ] **Step 5:** Require any weakened default to record its reason and its compensating control inline in the same file. The existing configuration-weakening guard counts allowlist growth and does not require a reason.
- [ ] **Step 6:** Add `src/scripts/lint_lethal_trifecta.ts` flagging only the co-occurrence of a credential source, a transmission mechanism, and an external destination within one file. Land advisory and classify every hit before promoting.
- [ ] **Step 7:** Adopt the base-branch-tooling and untrusted-head-in-a-worktree split in any workflow that runs our tooling over pull-request content.

## Phase 2: Tool grants that match the code

- [ ] **Step 1:** Add `src/scripts/lint_capability_parity.ts` mapping declared tool grants to capability categories and comparing them against content patterns in the artifact's own scripts.
- [ ] **Step 2:** Flag both directions: a capability used but not declared, and a capability declared but never used. The second direction is the novel half and reads as either removed functionality or pre-staging.
- [ ] **Step 3:** Flag a wildcard grant as its own finding class.
- [ ] **Step 4:** Extend the execution block with a path-scoped read and write list plus an explicit script allowlist, so a grant can name which script rather than granting a shell.
- [ ] **Step 5:** Add deterministic checks for the three families this package does not check on itself: an over-broad or sibling-shadowing trigger, an artifact reading another agent's configuration directory or enumerating other artifacts' files, and refusal-suppressing phrasing.
- [ ] **Step 6:** Land each family advisory, classify on the real corpus, then promote.

## Phase 3: The domains our own text points at

- [ ] **Step 1:** Add `src/scripts/lint_external_domains.ts` plus a reviewed domain allowlist. A bare entry matches the domain and its subdomains; an entry carrying a path matches that prefix followed by a delimiter or the end of the URL.
- [ ] **Step 2:** Fail on a URL outside the allowlist. Adding a domain is a reviewed change, because a domain we cite is a domain the agent will fetch.
- [ ] **Step 3:** Flag a script tag with no integrity attribute, a plain-HTTP URL, and loopback or wildcard-listen patterns, with fenced-code tracking so an example is not confused with an instruction.
- [ ] **Step 4:** Land advisory, classify every current external URL, then promote.

## Phase 4: Outbound integrity and exact uninstall

- [ ] **Step 1:** Sign the released tree at release granularity with a manifest listing every signed path and its content hash.
- [ ] **Step 2:** Add a verifier that recomputes each hash on disk. Presence and authenticity prove a signature exists, not that the files still match what was signed — the observed failure is signing one commit and shipping a later one.
- [ ] **Step 3:** Scope the verifier asymmetrically: changed paths on a pull request, the whole tree on a schedule.
- [ ] **Step 4:** Add a verify verb a consumer can run after install. We ship into other people's repositories and currently offer no way to check what arrived.
- [ ] **Step 5:** Write an install ledger recording what we own, what we wrote into host state, and which boundaries are host-managed and therefore not ours to remove.
- [ ] **Step 6:** Make uninstall ledger-first, and refuse rather than guess when an entry cannot be resolved exactly, naming what the user should remove by hand.
- [ ] **Step 7:** Record the signed-receipt option for hard-floor actions as a deliberate non-adoption with its condition, rather than silently dropping it.

## Phase 5: Conformance boundaries

- [ ] **Step 1:** Add a cross-pack reference check that validates a reference against the consumer's plausible installed subset rather than repository presence. Presence in the repository is not presence in the install, and our packs do cross-reference.
- [ ] **Step 2:** Add a host status enum with a required degrade contract per host, including an explicitly not-yet-proven tier. A prose degrade note without a per-host tier cannot be audited.
- [ ] **Step 3:** Add a reserved-versus-implemented annotation to schema fields, with a check that a reserved field is referenced by nothing. We carry honesty at artifact level and none at field level.
- [ ] **Step 4:** Add a handoff-chain bound: carry a visited set, never run the same artifact twice in one chain, and cap automatic handoffs after the originating artifact. The existing budget bounds retries per target and nothing bounds chain depth.
- [ ] **Step 5:** Add an anti-circumvention clause to the fenced-step rule: at a fenced stop, do not perform the equivalent work by hand in the same turn. The existing rule says deliver and hand back and never forbids satisfying the letter of the fence while doing the work anyway, which is the actual failure mode.
- [ ] **Step 6:** Add a circular-acceptance check to the roadmap and ticket authoring paths: an acceptance criterion must be satisfiable before the step that produces the evidence it names.

## Phase 6: Two review lenses we lack

- [ ] **Step 1:** Add a misuse-resistant API review lens over this package's own exported surface — footgun detection on what we expose, folding in the fail-open-defaults framing.
- [ ] **Step 2:** Add a variant sweep: after a single finding, hunt its variants across the tree and build the query that finds them. This is the security-layer twin of the defect-pattern search the authoring-discipline roadmap adds.
- [ ] **Step 3:** Give both lenses the rubric shape the authoring-discipline roadmap specifies — a scope column, a paired do-not-flag list, and explicit deference to the owning deterministic gate.

## Acceptance Criteria

- [ ] The agentic-CI audit has been run against this package's own workflows and every finding carries a disposition.
- [ ] Every agent-invoking workflow carries a declarative confinement block, and every weakened default records a reason and a compensating control.
- [ ] `lint_lethal_trifecta.ts`, `lint_capability_parity.ts`, and `lint_external_domains.ts` exist, each with a paired positive and clean fixture.
- [ ] A capability declared but never used is reported, proven by a fixture.
- [ ] The released tree is signed and a drift verifier recomputes hashes on disk.
- [ ] An install ledger exists and uninstall refuses rather than guesses on an unresolvable entry.
- [ ] The cross-pack reference check validates against an installed subset.
- [ ] The fenced-step rule carries an anti-circumvention clause.
- [ ] Quality gates delegated to remote CI on the pull request.

## Blockers

### blocker: verification-slot
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 — Agentic CI, audited and confined
- **What to do:**
  1. This roadmap holds queue position 5 of the verification track under the 2026-08-05 successor constraint.
  2. When a slot frees, move this file to `agents/roadmaps/` and drop `status: later`.
- **Resolved when:** fewer than two `road-to-skill-ecosystem-*` roadmaps sit outside `archive/` and `later/`.

### blocker: signing-key-custody
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 4 — Outbound integrity and exact uninstall
- **What to do:**
  1. Decide the signing identity and key custody for the released tree. A signature whose key is not durably held is worse than none, because it creates a verification path that will break.
  2. Decide whether the verify verb is a hard post-install gate or an opt-in check.
- **Resolved when:** the identity and custody decision is recorded and the verify verb's severity is named in Phase 4 Step 4.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Auditing our own workflows surfaces findings we cannot fix quickly | product | An audit of an existing agentic CI surface may find a real exposure whose fix requires a workflow-scope change, and this package has recorded that a workflow edit can be blocked from the agent side. | Phase 1 Step 3 requires a disposition per finding, not a fix per finding; a genuine exposure escalates as a safety surface rather than waiting in a queue. | Phase 1: Agentic CI, audited and confined |
| 2 | The trifecta lint false-positives across a documentation-heavy tree | implementation | Our authored corpus discusses credentials, transmission, and destinations constantly, in prose and in negative examples. | The conjunction requirement is itself the false-positive control, exactly as the source states for the same corpus shape; the gate lands advisory and every hit is classified before promotion. | Phase 1: Agentic CI, audited and confined |
| 3 | Signing creates a verification path that later breaks | implementation | A signature is a promise; a rotated or lost key turns a passing verifier into a failing one for every consumer. | Phase 4 is blocked on an explicit custody decision, and the verify verb's severity is named rather than assumed. | blocker: signing-key-custody |
| 4 | The installed-subset reference check is unfalsifiable without a real install matrix | implementation | Deciding what a consumer plausibly installed requires modelling pack and profile combinations, and a wrong model produces confident false findings. | Scope the check to references crossing a declared pack boundary, which is decidable from our own discovery frontmatter, rather than attempting to model every install permutation. | Phase 5: Conformance boundaries |

## Provenance

- Source: one first-party security-firm suite for the agentic-CI audit and the
  vector enumeration, one first-party vendor suite for the declarative confinement
  and the untrusted-head topology, one first-party hardware-vendor catalogue for
  the signing and drift verification, one governed-runtime suite for the install
  ledger and the anti-circumvention clause, and one third-party scanner for the
  trifecta conjunction and the capability parity. Anonymized per
  `source-confidentiality`; per-source links in the sweep record's § Provenance.
- Council: see the sweep record § Council.
