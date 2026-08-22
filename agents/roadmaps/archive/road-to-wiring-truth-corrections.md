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
(a `nudge_rank` collision becomes detectable).

> **Outcome: two of the three shipped; publication transferred.** Phase 2 is
> `[~]`, carried to [`stubs/road-to-release-placeholder-guard.md`](../stubs/road-to-release-placeholder-guard.md)
> in this same change — two implementations were refused by gates that were both
> right, and the design that survives is a god-file extraction plus a
> drill-fixture decision. **This discharges Iron Law 3** of
> `roadmap-progress-sync`: the item is not dropped, weakened, or cancelled; it is
> carried, alive, into a named successor created in the same change and outside
> the estate count — the preservation-test disposition that routes to the council
> rather than to the owner. The verdict, its rationale, every option considered,
> the destination and what closes it are recorded at the item in Phase 2. None of the three adds a new
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

## Phase 2 — A release cannot ship an unrewritten placeholder — TRANSFERRED

`src/scripts/_lib/release_highlights.ts:48` exports
`DERIVED_MARKER = '_auto-derived, rewrite before merge:_'`.
`check_release_highlights.ts:187-201` detects a surviving marker and prints
`⚠️ … advisory, not blocking`; the exit code is owned solely by the
`_none_`-vs-evidence check. The job runs on every `release/*` PR and is
structurally incapable of failing on the marker. **`CHANGELOG.md:392-395` — the
published 14.7.0 section carries four unrewritten marker lines**, so the defect
is live, not historical. The review has raised it since v12.1.0.

- [~] **2.1–2.2 Refuse the marker at the publication boundary.** **Transferred
      2026-08-21 to [`stubs/road-to-release-placeholder-guard.md`](../stubs/road-to-release-placeholder-guard.md),
      with the finding, both refused implementations and the council's design
      recorded there.** The finding is verified and unchanged; only the
      implementation moved, and it moved because two attempts were refused and
      the design that survives does not fit a one-PR change.
      verify: the stub exists, carries the invariant, the two refusals and the
      four implementation constraints, and `check_references` resolves it.

> **Why it moved, and what each refusal taught — the useful half of this phase.**
> Attempt 1 guarded three call sites in `release.ts`. Coverage was right,
> including the real `--resume` bypass. `check_source_size_budget` refused it:
> `release.ts` is 2,818 lines against a 1,500-line ceiling, +60 lines is a
> straight regression, and the gate states in as many words that raising the
> baseline is a defect rather than a fix. **Any** net growth there is refused, so
> even a four-line version fails.
>
> Attempt 2 moved the guard into the two renderers, which took `release.ts` back
> to byte-identical with main and looked strictly better — coverage by
> construction instead of by enumeration. CI refused it, and the refusal is the
> finding: four `release_drill.test.ts` scenarios that assert step **sequencing**
> broke, because the drill feeds the real `execute()` the live `CHANGELOG.md` and
> the guard correctly refused the live 14.7.0 section. **A guard on a pure
> formatter has no notion of whether it is actually publishing.** Decoupling the
> drill is blocked by the same ratchet.
>
> The second council session (2/2 present) converged on extraction: move
> publication orchestration out of `release.ts` so the file **shrinks**, and
> enforce the check at each independently resumable irreversible transition
> there. One seat then refuted the framing of the question itself — the
> conjunction this phase was chasing (ratchet-clean · fires only on real
> publication · no call-site enumeration) has **no** solution, because the state
> machine has no single dominating checkpoint. That is worth more than the option
> it rejected, and it is why this is a refactor of a god-file plus a drill-fixture
> decision rather than a step in this roadmap.
>
> **Curating the four live 14.7.0 lines is NOT carried either**, and both
> sessions agree: it is maintainer editorial work, it cannot repair the
> already-published annotated tag message, and an agent paraphrasing the
> generator's own derivation reason into prose to satisfy a gate is the
> *"truthfully documented uselessness"* failure one seat named in the first
> session about a different artefact.

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
- [~] AC-2 — TRANSFERRED. The publication-boundary refusal is specified,
      twice-refused-with-reasons, and carried to
      [`stubs/road-to-release-placeholder-guard.md`](../stubs/road-to-release-placeholder-guard.md)
      together with the council's extraction design and its four implementation
      constraints. Nothing about the finding was weakened: `CHANGELOG.md:392-395`
      still carries four marker lines and the stub says so.
- [x] AC-3 — The release-PR advisory posture is unchanged, and now demonstrably
      so: `check_release_highlights.ts` is byte-identical with `main`, so the
      recorded guaranteed-red decision was neither reversed nor leaned on. Both
      council sessions declined to touch it.
- [x] AC-4 — `lint_hook_manifest` rejects a manifest in which two concerns
      declare the same `nudge_rank`, naming the rank and every declaring
      concern, and stays green on the real manifest. `injection_budget.ts` no
      longer states that the check does not exist.
- [x] AC-5 — Estate-neutral: this roadmap reaches `count_open == 0` and is
      archived in the same PR, so `check_estate_count` sees no growth in
      `active_roadmaps`.
