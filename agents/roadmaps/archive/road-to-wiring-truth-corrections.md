---
complexity: lightweight
execution:
  mode: phase-checkpoints
---
# Road to wiring truth corrections — three places where declared and effective diverge

> **Source:** `agents/tmp.old/feedback-14.4.0.txt`, an external release review of
> v14.4.0 drafted 2026-08-19 against pinned baseline `2cc8fd9`. Triaged by
> `/analyze:inbox` on 2026-08-21 at HEAD (v14.7.0, 503 commits past the pin).
> Every actionable claim was re-verified against the tree; **five came back
> already-fixed or never-true and were dropped** (see § Prevented below). The
> three items here are the survivors that are verified still-true AND closable
> in one PR. Scope chosen by the AI council (2/2 present, 2026-08-21,
> `agents/runtime/council/responses/r-wiring-truth-scope.md`) out of a
> four-candidate set; item 4 (a four-dimensional dispatcher safety matrix) was
> dropped by both seats as test-hardening rather than wiring truth.

## Goal

Three tracked statements that claim a mechanism is effective are made honest,
each at the layer that actually owns the claim: **documentation** (an evidence
record asserting an unwired module is implemented), **publication** (a release
cannot ship an unrewritten auto-derived placeholder), and **manifest linting**
(a `nudge_rank` collision becomes detectable). None of the three adds a new
rule, a new hook concern, a new settings axis, or a new governance surface —
each closes a gap that the tree itself already names in prose.

> **What this roadmap deliberately is NOT.** The review's #1 P0 asks for a
> unified `Mechanism Truth Registry` spanning `registered → reachable →
> observed`. That is refused here, and the refusal is the review's own: the same
> document warns against building a new large governance engine. Three
> reachability checkers already exist and are CI-wired
> (`check_enforcement_coverage.ts`, `check_gate_coverage.ts`, `hooks_doctor.ts`);
> consolidating them is a multi-PR schema change and is out of scope. This
> roadmap fixes three instances, not the class.

## Phase 1 — Correct the record on `untrusted_content.ts`

`agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md:86-87` lists, under
the literal heading **Implemented**:

> "untrusted-content boundary and trust propagation
> (`src/scripts/_lib/untrusted_content.ts` plus four ingress sites)"

Re-measured at HEAD: every export of that module (`wrapUntrusted`,
`checkCredentialFilePermissions`, `MIN_NONCE_LENGTH`, `WrapOptions`,
`PermissionVerdict`, `PermissionFinding`) has **zero consumers** outside the
module and its own test file, and there are **zero** occurrences of an
`<untrusted_content>` tag anywhere in `src/` or `dist/`. The phrase "four
ingress sites" occurs exactly once in the tracked tree — in that line. No
document corrects it. The claim has stood through six releases.

- [x] **1.1 Restate the claim as measured, not as implemented.** Move the
      untrusted-content entry out of the **Implemented** bullet into a measured
      statement: the module exists, has zero production consumers, and has zero
      ingress sites; the count "four" was never true at any commit this triage
      could have been written against. Keep the sentence in place rather than
      deleting it — a deleted false claim leaves a reader who remembers it with
      nothing to find.
      verify: `grep -c 'four ingress sites' agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md`
      returns 0, and `grep -n 'untrusted_content' agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md`
      shows the corrected wording under a non-Implemented heading.
- [x] **1.2 Name the integrate-or-delete decision as open and owner-reserved.**
      The corrected text states in one sentence that whether the module is wired
      or removed is undecided and is the maintainer's call, with the reason it
      cannot be settled here: wiring an untrusted-content boundary adds live
      behaviour to a security surface and needs its own threat pass
      (`security-sensitive-stop`), and deleting a module is a scope decision no
      documentation pass owns.
      verify: the corrected paragraph contains an explicit undecided-and-owned
      statement; `./scripts-run src/scripts/check_references` passes.

> **Why the sentence is not simply deleted, and why no follow-up roadmap is
> created.** The council split exactly here and both halves are load-bearing.
> One seat argued that correcting the record without deciding the module's fate
> produces *"truthfully documented uselessness"* — the pressure to resolve
> disappears while the maintenance burden stays — and required that the
> corrected claim state whether the module will be integrated or deleted. The
> other seat argued that a two-line correction of a demonstrably false tracked
> claim is the most literal wiring-truth fix available and that deferring it to
> "another doc PR" contradicts the one-PR scope. Step 1.2 satisfies both: the
> integrate-or-delete question is recorded as open **in the corrected text**,
> which preserves the pressure without creating a roadmap the estate ratchet
> would have to absorb.

## Phase 2 — A release cannot ship an unrewritten placeholder

`src/scripts/_lib/release_highlights.ts:48` exports
`DERIVED_MARKER = '_auto-derived, rewrite before merge:_'`.
`check_release_highlights.ts:187-201` detects a surviving marker and prints
`⚠️ … advisory, not blocking`; the exit code is owned solely by the
`_none_`-vs-evidence check. The job runs on every `release/*` PR
(`.github/workflows/release-validation.yml:259`) and is structurally incapable
of failing on the marker. The marker has shipped into published changelogs.
The review has raised this since v12.1.0 — it is recurring, not new.

> **A recorded decision governs the PR gate, and this phase does not touch it.**
> `check_release_highlights.ts:203-206` states the rationale for the advisory
> posture: *"keep the exit code owned solely by the `_none_` check — a warning
> that reds the build is the guaranteed-red failure mode this whole change
> exists to remove."* Highlights are auto-derived first and curated later, so a
> blocking check on the release PR would be red on the first run of every
> release branch by construction. **Mechanism-match: that lock governs the
> release-PR gate. The publication boundary is a different mechanism.** Both
> council seats reached the same distinction independently and both declined to
> make the PR gate blocking. The advisory warning stays exactly as it is.

- [x] **2.1 Refuse to tag when the changelog section still carries the marker.**
      In `release.ts` step 8, guard the target version's CHANGELOG section
      before `git tag -a` — the first irreversible action, and the one that
      triggers `publish-npm.yml`. Reuse the exported `DERIVED_MARKER`; `die()`
      with the offending label(s) and the file to fix, matching the two existing
      `die()` guards in the same step that already refuse to tag a release whose
      changelog section is missing.
      verify: a unit test over the guard predicate asserts a section containing
      `DERIVED_MARKER` is refused and a curated section passes —
      `npx vitest run tests/scripts/release_placeholder_guard.test.ts`
- [x] **2.2 Close the `--resume` bypass, which is the failure both seats named.**
      Step 8 reads the changelog only in its `else` branch: when the tag already
      exists locally, `_tag_exists_local(plan.target)` short-circuits to
      skip-or-push and the guard is never reached, so `--resume` after a
      created-but-unpushed tag reaches step 9 unguarded. Guard step 9's
      `tagged_section` as well — the content the GitHub Release notes are
      rendered from, read at the tag rather than at plan time. Both insertion
      points share one predicate.
      verify: the same test file covers the resume path — the guard is asserted
      on the step-9 tagged-section input independently of step 8, so neither
      insertion point alone satisfies it.

> **The named net-negative.** Both council seats independently named the same
> way this phase could make the repo worse: *"a nominal publication check
> attached to only one release path while another tag or publish path bypasses
> it — stronger-looking governance without stronger protection, the exact
> declared ≠ effective failure this PR is meant to eliminate."* Step 2.2 exists
> because of that, and the surface was enumerated rather than assumed:
> `release-guard.yml` compares `package.json.version` to the tag and reads no
> changelog; `publish-npm.yml` triggers on the tag, which 2.1 gates; the three
> surfaces that can carry the marker (tag message, GitHub Release notes,
> `CHANGELOG.md` on main) all render from the same changelog section the two
> guards read.

## Phase 3 — A `nudge_rank` collision becomes detectable

`src/scripts/hooks/injection_budget.ts:195-201` says it plainly:

> "a tie is a manifest defect rather than a runtime one, and
> `lint_hook_manifest` is where it should eventually be caught — **that check
> does not exist yet and this comment is the honest statement of the gap**, not
> a claim that it is covered."

`lint_hook_manifest.ts` has zero references to `nudge_rank`. Two concerns
declare one today — `delegation-nudge: 1` (`hook_manifest.yaml:604`) and
`skill-route: 2` (`:627`) — so the defect is latent, not live. `_selectNudge`
keeps the lowest rank and drops every other nudge; on a tie the winner is
whichever concern name sorts first, which is stable and arbitrary.

- [x] **3.1 Reject duplicate non-null `nudge_rank` values in the manifest lint.**
      Add the check inside `_check_concerns` (`lint_hook_manifest.ts:131`),
      which already iterates every concern spec — read `spec["nudge_rank"]`,
      validate it is a positive integer when present, and error on a repeated
      value naming the rank and **every** concern that declares it. No new
      wiring: `lint_hook_manifest` is already a CI target.
      verify: `task lint-hook-manifest` stays green on the real manifest, and
      the collision cases land in the EXISTING
      `tests/scripts/lint_hook_manifest.test.ts` rather than a new file — it
      already carries the `fixtureManifest` helper and a valid skeleton, so a
      second file would duplicate both. `npx vitest run
      tests/scripts/lint_hook_manifest.test.ts`
- [x] **3.2 Cover absent, unique, collided and malformed in the test.** The
      council asked for all four; absent must stay legal (most concerns declare
      no rank) and malformed must be rejected rather than silently coerced,
      because the dispatcher fails toward *running* a concern on a malformed
      key — the same silent-failure argument `_check_concerns` already makes for
      its `tools:` validation.
      verify: `tests/scripts/lint_hook_manifest.test.ts` § nudge_rank carries one
      case per state — absent, distinct, collided, malformed — plus a case
      asserting the real manifest is clean, and all pass. Sensitivity was proven
      by sabotage rather than assumed: neutralising the uniqueness loop reds one
      case and neutralising the malformed-value branch reds a different one, so
      neither check alone carries the file.

> **Scope of the uniqueness rule, stated because a stricter rule is a choice.**
> `_selectNudge` compares candidates within one dispatch, so two concerns on
> disjoint events could share a rank harmlessly, and the accurate invariant is
> per-event. Global uniqueness is enforced instead: it is the strictly-safe
> superset, it costs nothing at n=2, and an author reusing a rank across events
> is exactly the confusion worth refusing. *Revisit-if* a legitimate design
> needs the same rank on two events — then narrow the check to concerns sharing
> at least one bound event, rather than removing it.

## Prevented — five claims that would have become work and are already closed

Recorded so the same items are not re-planned from the same file, and because
the reviewer cannot see any of it: three of the five were closed **before or
within a day of** the review being drafted.

| Claim | Verdict | Evidence |
|---|---|---|
| "later/ parking counts as an artificial estate reduction" | already-fixed **one day before the review** | `check_estate_count.ts:56-58` gates `active_roadmaps` and `later_roadmaps` as two independent ratcheted metrics, with the reviewer's own argument in its docstring; registered 2026-08-18 |
| "no `rule:reach` / activation-explain surface exists" | never-true — shipped **15 days before the review** | `agent-config route:explain "<prompt>"` (`src/scripts/_cli/cmd_route_explain.ts`, 2026-08-04): matched rules, keyword, tier, per-rule token cost, `rejected — no trigger matched: N` |
| "no reachability check exists" | never-true as stated | `check_enforcement_coverage.ts` (rank ladder `validator > hook > unwired > none`, CI ratchet), `check_gate_coverage.ts` (42-gate manifest + canary mutation), `hooks_doctor.ts` |
| "CI enforcement is reachable only via `task ci`" | overtaken | no workflow invokes `task ci` / `ci-fast` / `ci-strict` — 0 hits; the load-bearing gates were re-registered individually, documented in five dated workflow comments |
| embedded draft "Road to Cross-Corpus Parity v5" Phase 3 (frontend roadmap, 9 open steps, six releases dormant) | already-fixed **one day after the pinned baseline** | `agents/roadmaps/archive/road-to-frontend-skill-application.md` — 26 done / 0 open / 0 deferred, *"Closed out 2026-08-20."* |

Two further survivors are real and deliberately **not** scoped here, because
neither is one-PR closable: the subagent-return P0 (nothing writes, reads or
validates `response-envelope.json` — the contract says so itself at
`subagent-response-contract.md:60-68`) is owned by
[`road-to-subagent-lifecycle-integrity`](road-to-subagent-lifecycle-integrity.md)
and its remaining steps are gated on a pre-registered threshold from a
measurement window that does not exist yet; and a measurement-feasibility gate
needs a machine-parseable roadmap frontmatter convention defined first.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Publication guard covers one path only | implementation | The guard lands in step 8's `else` branch, `--resume` with an existing local tag skips it, and step 9 publishes the marker anyway — governance that looks stronger and is not | Step 2.2 guards step 9's tagged section independently; the test asserts each insertion point separately so neither alone passes | Phase 2 — A release cannot ship an unrewritten placeholder |
| 2 | The corrected record becomes zombie debt | product | Phase 1 makes the false claim honest, the pressure to resolve the module disappears, and an unwired security module stays in the tree indefinitely under a truthful label | Step 1.2 records integrate-or-delete as an explicitly open, owner-reserved decision inside the corrected text — a truthful record that raises the question rather than closing it | Phase 1 — Correct the record on `untrusted_content.ts` |
| 3 | Guard fires on a legitimate release and blocks it | implementation | A curated changelog section that legitimately quotes the marker string (a changelog entry about this very change) trips the guard and stops a real release at its most irreversible step | The predicate reads only the target version's own section, and this roadmap's changelog entry is written without reproducing the literal marker; the guard's `die()` names the label and the file so the fix is one edit | Phase 2 — A release cannot ship an unrewritten placeholder |
| 4 | Global `nudge_rank` uniqueness is too strict | implementation | A future design legitimately wants the same rank on two disjoint events and the lint refuses it, so the check gets deleted rather than narrowed | The scope note under Phase 3 pre-registers the narrowing (per-event, keyed on a shared bound event) as the response, so the revisit path is written down before it is needed | Phase 3 — A `nudge_rank` collision becomes detectable |

## Acceptance Criteria

- [x] AC-1 — No tracked document **asserts** that `untrusted_content.ts` is
      implemented or that ingress sites exist. `grep -rn 'four ingress sites'`
      over `agents/evidence/` and `docs/` returns 0 hits; the surviving statement
      about the module is a measured one carrying an explicitly open,
      owner-reserved integrate-or-delete question. This roadmap is the one place
      the phrase may still occur, because it quotes the claim as the evidence of
      what was wrong — an assertion and a citation of an assertion are not the
      same thing, and a criterion that forbade both would forbid this roadmap
      from stating its own finding.
- [x] AC-2 — `release.ts` cannot create a tag, and cannot publish GitHub
      Release notes, for a version whose CHANGELOG section still contains
      `DERIVED_MARKER`. Both refusals hold independently: neither the step-8 nor
      the step-9 guard alone satisfies this, which the test asserts by covering
      each insertion point on its own.
- [x] AC-3 — The release-PR advisory posture is unchanged. The `⚠️ advisory,
      not blocking` path in `check_release_highlights.ts` still runs and still
      does not own the exit code, so the recorded guaranteed-red decision is
      honoured rather than reversed.
- [x] AC-4 — `lint_hook_manifest` rejects a manifest in which two concerns
      declare the same `nudge_rank`, naming the rank and every declaring
      concern, and stays green on the real manifest. `injection_budget.ts` no
      longer states that the check does not exist.
- [x] AC-5 — Estate-neutral: this roadmap reaches `count_open == 0` and is
      archived in the same PR, so `check_estate_count` sees no growth in
      `active_roadmaps`.
