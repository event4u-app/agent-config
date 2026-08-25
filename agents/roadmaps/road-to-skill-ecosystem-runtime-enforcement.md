---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Un-parking counts as an ADDITION under one-in-one-out (later/X -> X is classified an addition by classifyDiff), and no archive move is available in this change: it closes a slot-cap blocker rather than finishing a roadmap. The offsetting event already happened in an earlier change -- the two predecessors this file queued behind, road-to-skill-ecosystem-gate-integrity and road-to-skill-ecosystem-authoring-discipline, both sit in archive/, which is why lint_roadmap_family_cap measures 0/2 slots used and why this file's own blocker instructs the move."
---

# Road to runtime enforcement — bind the rules that currently only ask

> **RESUMED 2026-08-25 — queue position 3 reached.** This roadmap was parked
> on one condition only: the 2026-08-05 council capped concurrently-open
> verification roadmaps at two. Both predecessors it queued behind —
> `road-to-skill-ecosystem-gate-integrity` and
> `road-to-skill-ecosystem-authoring-discipline` — now sit in
> `agents/roadmaps/archive/`, and `lint_roadmap_family_cap` measures **0/2 slots
> used**. That is the file's own stated resume test, so it is unparked and open.
> Position 5 (`road-to-skill-ecosystem-security-and-conformance`) stays parked:
> positions 4 and 3 fill the cap.

> Convert the cheapest of this package's honestly-unenforced obligations into
> deterministic runtime behaviour — a non-zero exit, a machine-checkable state, a
> named terminal outcome — and verify that the six generated projections actually
> load in the hosts they target.

## Context

Source + verdicts:
[`skill-ecosystem-sweep-2026-08`](../settings/contexts/skill-ecosystem-sweep-2026-08.md)
§ C2, § C4, § C5, and § Gate coverage this sweep exposes.

**The gap.** Several rules here ship `enforced_by: none` and say so honestly. That
honesty is correct and stays. What the sweep supplies is evidence that a subset of
them can be bound cheaply: one source converts a behavioural rule into an
executable shim placed ahead of the real binary, which prints the sanctioned
alternative and exits non-zero — at the cost of one path prepend per session
rather than a process spawn per tool call, which matters given this package's own
measured finding that transport dominates hook cost. A second source drives a
bounded loop from a stop event with re-entrancy detection and a whole-line
completion marker, which is this package's validation budget and read-loop abort
made machine-enforced instead of model-carried.

**A second, separable gap.** Six projection surfaces are generated and verified
byte-exact against source. None is verified to **load**. One source installs its
output into the real host command-line tools in continuous integration and asserts
every artifact is enumerated. That is pure enumeration with no model inference, so
it is safe to automate and is distinct from the live trigger evaluation this
package correctly keeps as a human gate.

**In-tree facts verified before drafting.** `src/scripts/hooks/` holds 15 hooks
registered in `hook_manifest.yaml`. There is no stop-event hook. `docker-commands`
routes to the docker skill and is model-carried. `block_no_verify.ts` already
guards hook-bypass flags as a pre-tool guard, which a shim would strengthen rather
than replace. The recorded trap that an advisory warn exiting 2 reads as a hard
block on this host constrains every new hook's exit contract.

## Gap table

| Item from the sweep | Verdict | Where it lands |
|---|---|---|
| Session-start shim installer ahead of real binaries | KEEP | Phase 1 |
| Argument re-quoting so the suggested alternative stays runnable | KEEP | Phase 1 |
| Per-invocation hook disable flag, surfaced by a diagnostic | KEEP | Phase 1 |
| Hook performance doctrine plus its false-positive classes | KEEP | Phase 1 |
| Runtime-wiring diagnostic separate from artifact gates | KEEP | Phase 2 |
| Sentinel-file working-directory guard | KEEP | Phase 2 |
| Host-loadability assertion in continuous integration | KEEP | Phase 3 |
| Cross-host capability-to-spelling equivalence table | KEEP | Phase 3 |
| Named subagent types resolve to a real definition | KEEP | Phase 3 |
| Wrong-surface tool-restriction key rejected | KEEP | Phase 3 |
| Named terminal-state vocabulary for autonomous runs | KEEP | Phase 4 |
| Retryable and truncated fields in script output | KEEP | Phase 4 |
| Progress-primary stop with the count as backstop | KEEP | Phase 4 |
| Stop-event bounded loop with re-entrancy detection | KEEP | Phase 5 |
| Whole-line completion marker so quoted prose cannot match | KEEP | Phase 5 |
| Missing-dependency detection so a gap does not burn iterations | KEEP | Phase 5 |
| Per-turn re-injection of the active plan into context | FOLD | Phase 5, gated behind the attestation precondition below; the injection half is deferred to a follow-up because the attestation is the load-bearing part |
| Content attestation on any auto-injected tracked artifact | KEEP | Phase 5 |
| Single sanctioned writer for concurrent checkbox mutation | KEEP | Phase 6 |
| Fail-closed on ambiguous plan resolution | KEEP | Phase 6 |
| Append-only run ledger with a cache-stable summary | FOLD | Phase 6, as the stall signal only; the full ledger schema is out of scope |
| Session-transcript catch-up replay | CUT | Recovery primitive with a host-specific path-mangling landmine and no recorded failure here to justify it |
| Marker-hook convention: hooks record, never work | KEEP | Phase 1 |

## Prerequisites

- [x] **Step 1:** Sweep record committed.
- [ ] **Step 2:** Enumerate the current 15 hooks with their events and exit contracts from `hook_manifest.yaml`, so Phase 1 does not duplicate an existing guard.

## Phase 1: Shims and the hook contract

- [x] **Step 1:** Add `src/scripts/hooks/shims/` and a session-start installer that prepends the shim directory to the path for the session only. <!-- verify: bash -n src/scripts/hooks/shims/install.sh -->
      **DONE 2026-08-26.** `bash -n` clean. **Session-only is the whole design, not a limitation:** the installer never writes to a profile or any shell rc, so the entire mechanism is undone by closing the terminal. That reversibility is what let the council scope Phase 1 to a shim at all — the reversible option is the one that ships first. It must be **sourced**, not executed (a child cannot alter its parent's PATH), and it says so rather than appearing to work. Verified: prepends once, **idempotent on a double source** (1 occurrence, not 2), and `--off` removes it (0 occurrences).
- [x] **Step 2:** Ship the first shim for the surface with the clearest recorded need: the container-only tooling rule. The shim prints the sanctioned in-container invocation and exits non-zero; it re-quotes the received arguments so the printed alternative is directly runnable. <!-- verify: bash -n src/scripts/hooks/shims/php -->
      **DONE 2026-08-26** — `src/scripts/hooks/shims/php`, `sh -n` clean, exit **2** on a host invocation.
      **The shim set is exactly this one**, per `blocker: shim-scope-decision` (AI council 2/2, option (a)); the hook-bypass-flag and package-manager candidates are **recorded as out of scope for Phase 1** there, with the reason and a two-part revisit condition.
      Re-quoting is asserted on the two cases that break naive quoting — an argument containing a **space**, and one containing an **embedded single quote** — because a suggestion that does not survive copy-paste silently does something other than what was refused.
- [x] **Step 3:** Dispatch on the invoked basename so one script can serve several names, and give each shim a paired test asserting both the non-zero exit and the runnable suggestion. <!-- verify: npx vitest run tests/scripts/hook_shims.test.ts -->
      **DONE 2026-08-26 — 16 tests.** Dispatch is a basename `case`; today the claimed set is deliberately **one entry wide**, and an invocation under an **unclaimed** basename **refuses** rather than passing through silently — a silent pass-through would make the shim look installed and inert, which is worse than an error because nothing would ever reveal the gap.
- [x] **Step 4:** Add a documented false-positive matrix per shim covering the cases where the binary name appears without being invoked — a which query, a grep for the name, a file whose name contains it — and assert each is a fast pass. <!-- verify: npx vitest run tests/scripts/hook_shims.test.ts -->
      **DONE 2026-08-26.** The matrix is a table in `tests/scripts/hook_shims.test.ts` and **each row is an assertion**, not a comment: `command -v php` **resolves** the shim without invoking it; `grep php <file>` does not fire it; the name as a literal argument does not; a **file** named `php` in a listing does not.
      Asserted rather than assumed because a future shim implemented as a shell **function** or an **alias** would break exactly these four, and this file is where that regression surfaces.
- [x] **Step 5:** Record the hook performance doctrine in `docs/contracts/` alongside the hook manifest: prefer shell over an interpreted runtime because startup dominates, fast-pass non-matching invocations, prefer a regex over a parse and accept rare false positives, and prefer a path prepend over a per-tool-call spawn where both are available.
      **DONE 2026-08-26** — `docs/contracts/hook-architecture-v1.md` § *Performance doctrine*. Extends the existing hook contract rather than adding a file, per `minimal-safe-diff`.
      All four rules are recorded with the reason each is a rule, framed on the cost that actually matters: **not the cost of acting, but the cost of deciding not to act, paid on every event.** The regex rule carries a condition the step's wording leaves implicit — accepting rare false positives is a trade only when they are **enumerated and asserted** (Step 4's matrix); an unenumerated false positive is not an accepted trade but an unmeasured defect. Closed with the limit: none of the four permits a hook to skip work it should do.
- [x] **Step 6:** Record the marker-hook convention in the same contract: a hook that triggers work records a marker and exits zero; it never performs the work and never spends. Cite the recorded trap that an advisory exit code 2 reads as a hard block on this host.
      **DONE 2026-08-26** — same contract, § *Marker-hook convention*, with the trap cited: an **advisory exit code 2 reads as a hard block** on this host, so a hook that merely wanted to say *"something is worth doing"* can stop the turn instead.
      Adds the discriminator the convention needs to be usable, since the boundary is where the mistakes happen: if the output is **information for a later decision** it is a marker hook and exits 0; if the output **is** the decision it may exit non-zero — and the shim shipped in Step 2 is deliberately the second kind.
- [~] **Step 7:** Add a single environment flag that disables every hook for one invocation, and make the Phase 2 diagnostic report it as a warning when set, so a disabled estate is visible rather than silent.
      **HALF DONE — the flag exists; the diagnostic does not.** `AGENT_CONFIG_DISABLE_HOOKS=1` is implemented and tested. Marked `[~]` rather than `[x]` because the step has two clauses and the second names the **Phase 2 diagnostic**, which does not exist yet — checking it would claim a visibility guarantee nothing provides.
      What is built: the flag is checked **first**, so the escape hatch cannot be shadowed; it **re-execs the real binary** rather than merely not refusing, so `AGENT_CONFIG_DISABLE_HOOKS=1 php -v` does what it says; it exits **127**, never 0, when disabled with no real binary to reach, because exiting 0 would report success for a command that never ran; and **only the exact value `1`** disarms it — `0`, `true`, `yes` and empty all leave it armed, since a truthy-ish check would let `=0` disable enforcement.
      **The loop guard is the load-bearing part and was proven by breaking it.** Re-exec strips the shim's own directory from PATH before looking again; removing that strip makes the shim find itself and **recurse until the process dies** — the probe hung and had to be killed, which is the proof.

## Phase 2: A diagnostic for the runtime wiring

- [ ] **Step 1:** Add an `agent-config doctor` verb. It writes nothing and always exits zero, reporting pass, warn, fail, or informational per check. The 466 existing gates check artifacts; nothing checks whether the runtime wiring is live.
- [ ] **Step 2:** Check that the settings resolver returns a project-then-global result and report which file won.
- [ ] **Step 3:** Check that the router artifact exists, parses, and reports its rule count.
- [ ] **Step 4:** Check that each registered hook resolves to an existing executable and report per-hook invocation cost, so a latency regression is visible where it is incurred.
- [ ] **Step 5:** Check for an inherited git-directory environment variable, which overrides discovery and is the recorded cause of a gate resolving against the wrong repository inside a hook.
- [ ] **Step 6:** Add `src/scripts/_lib/repo_root.ts` resolving the repository root only when a sentinel file exists in the resolved directory, and refusing otherwise. Adopt it in the generators and in the Phase 1 installer. This is a one-line fix for a trap class that has cost multiple sessions. <!-- verify: task typecheck-ts -->
- [ ] **Step 7:** Add a test that the resolver refuses a directory with no sentinel. <!-- verify: npx vitest run tests/scripts/repo_root.test.ts -->

## Phase 3: Projection reach

- [ ] **Step 1:** Add `src/scripts/check_host_loadability.ts`. For each host command-line tool present on the runner, install the generated projection into a temporary repository and assert the expected artifact count is enumerated. Skip with a recorded reason when the tool is absent, per the completeness ledger.
- [ ] **Step 2:** Register the loadability check as a continuous-integration-only job and add it to the enumerated local-versus-remote delta list.
- [ ] **Step 3:** Add `docs/contracts/host-tool-vocabulary.md` mapping each capability to its per-host spelling — subagent dispatch, file create, file edit, file read, shell run, search — and record every case where a host has no equivalent, with what to do instead. An absent equivalent documented is worth more than an invented mapping.
- [ ] **Step 4:** Add a portability gate flagging a tool grant declared for one host and absent for another.
- [ ] **Step 5:** Add a gate asserting every subagent type named in an authored artifact resolves to a real definition, with a built-in allowlist for the host's own types. A broken dispatch is invisible until runtime.
- [ ] **Step 6:** Extend the frontmatter safety lint to reject a tool-restriction key on the wrong surface. The loader silently ignores an unrecognised key and the artifact then inherits everything, so a parse success is not a restriction.

## Phase 4: Name the outcome

- [ ] **Step 1:** Add a terminal-state vocabulary to `contexts/execution/` — success, clean no-op, blocked, approval-required, exhausted, stagnated — and state that an error or an exhausted budget is never reported as success.
- [ ] **Step 2:** Map the vocabulary onto the existing roadmap glyphs and record the three states the glyphs cannot express, which are exactly the states the validation budget and the hard-blocker classes produce.
- [ ] **Step 3:** Adopt the vocabulary in the autonomous roadmap run's closing report, so a budget-exhausted stop is distinguishable from a completed one.
- [ ] **Step 4:** Add `retryable` and `suggestion` to the error envelope of scripts that the agent invokes, so the hard-blocker distinction is machine-decidable rather than model-judged. <!-- verify: task typecheck-ts -->
- [ ] **Step 5:** Add a `truncated` boolean wherever a script caps its findings, with per-category caps so one high-volume check cannot fill the budget. A capped list without a flag reads as a complete list.
- [ ] **Step 6:** Record the progress-primary ordering in the validation-budget mechanics: a no-progress or new-minimum signal is primary where the objective is countable, and the iteration cap is the backstop. Do not remove the cap.

## Phase 5: A bounded loop the harness enforces

- [ ] **Step 1:** Add a stop-event hook that reads the host's re-entrancy flag from its input and exits immediately when set, so the loop cannot recurse.
- [ ] **Step 2:** Read the iteration counter and its ceiling from a state file under the gitignored state directory, updating it atomically by temporary file and rename.
- [ ] **Step 3:** Exit the loop on a whole-line completion marker match, never a substring, so a quoted example in a transcript cannot terminate or extend a run.
- [ ] **Step 4:** Detect an unavailable dependency in the transcript and exit rather than consuming iterations against a gap the loop cannot close.
- [ ] **Step 5:** Record the host-capability tier for the stop event: which hosts can genuinely block, which can only re-inject, and which can only notify — and state plainly that enforcement is real only on the first tier.
- [ ] **Step 6:** Add `src/scripts/attest_artifact.ts` storing a content hash beside any tracked artifact that a hook would inject, refusing injection on a hash mismatch or a missing attestation. Auto-injection turns a governed file into a standing injection amplifier, so the attestation is the precondition, not a follow-up. <!-- verify: task typecheck-ts -->
- [ ] **Step 7:** Add a test that a modified artifact fails attestation and that a missing attestation refuses rather than defaults to injecting. <!-- verify: npx vitest run tests/scripts/attest_artifact.test.ts -->

## Phase 6: Concurrent-writer safety

- [ ] **Step 1:** Add an `agent-config roadmap:set-step` verb as the single sanctioned writer of a checkbox glyph, using an advisory lock plus a temporary file and rename so a torn write cannot leave a half-rewritten plan.
- [ ] **Step 2:** Bound the mutation to the addressed step by anchoring on its own line, never a greedy multi-line pattern. A greedy pattern across a multi-entry file is the recorded mechanism by which one substitution overwrites later entries.
- [ ] **Step 3:** Assert a structural invariant — the step count — against the live pre-write file rather than an in-memory snapshot. A snapshot-based invariant confirms what you intended to write while destroying what a parallel writer wrote.
- [ ] **Step 4:** After writing, grep for the mutated step and confirm it appears exactly once. A writer must verify survival, not merely a successful write; in a concurrent overwrite the loser receives no error.
- [ ] **Step 5:** Make plan resolution fail closed on ambiguity: when the working directory carries an active roadmap and a nested directory carries its own, resolve neither and name both, rather than silently choosing.
- [ ] **Step 6:** Emit a stall signal from the run state so Phase 4's progress-primary ordering has a machine-readable input. <!-- verify: npx vitest run tests/scripts/roadmap_set_step.test.ts -->

## Acceptance Criteria

- [ ] A shim for the container-only tooling surface exits non-zero and prints a runnable alternative, proven by a test.
- [ ] Each shim's false-positive matrix passes, proven by a test.
- [ ] `agent-config doctor` reports settings resolution, router presence, per-hook cost, and an inherited git-directory variable, and always exits zero.
- [ ] The repository-root resolver refuses a directory with no sentinel file, proven by a test.
- [ ] The loadability check asserts the expected artifact count in every host tool present on the runner, and records a reason for each absent one.
- [ ] Every subagent type named in an authored artifact resolves, proven by a gate.
- [ ] The terminal-state vocabulary is recorded and used in the autonomous run's closing report.
- [ ] A capped finding list carries an explicit truncation flag.
- [ ] The stop-event hook respects the host re-entrancy flag and terminates on a whole-line marker, proven by a test.
- [ ] A modified injected artifact fails attestation, and a missing attestation refuses rather than injects, proven by a test.
- [ ] The checkbox writer verifies survival after writing, proven by a test.
- [ ] Quality gates delegated to remote CI on the pull request.

## Blockers

### blocker: shim-scope-decision
- **Status:** resolved 2026-08-25 — **(a): ship only the container-only tooling
  shim, `src/scripts/hooks/shims/php`.** The hook-bypass-flag and
  package-manager candidates are recorded as **out of scope for Phase 1**. AI
  council **2/2 unanimous**, inlined convergence:
  `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 3 rounds, blind
  chairman, quorum concluded 2/2, $0.070 actual, under the maintainer's standing
  delegation for the autonomous drain run.

  **Why the narrow set, in the seats' own terms.** A shim alters what a
  developer's shell resolves, so *"unnecessary interception has the greater
  immediate blast radius"* — the asymmetry runs against breadth, not for it.
  Option (b)'s hook-bypass shim would duplicate a guard that already exists and
  is substantial (`src/scripts/hooks/block_no_verify.ts`, verified present at
  29,518 bytes), and option (c) contradicts this roadmap's own recorded-failure
  discipline: no failure is named behind the package-manager candidate.

  **One piece of evidence offered in the question was refused, and the refusal is
  kept.** The question cited *"`src/skills/docker/SKILL.md` mentions containers
  29 times"* as support for the container-only surface. One seat rejected it:
  *"The '29 container mentions' is weak evidence by itself: it shows topic
  prevalence, not interception failures."* Correct, and recorded so a later
  reader does not treat a grep count as a recorded need. The actual basis is
  Phase 1 Step 2's own phrase — *"the surface with the clearest recorded
  need"* — and that phrase is what this decision rests on.

  **Revisit-if:** a provenance-backed failure shows a hook-bypass or
  package-manager command escaped existing enforcement, **and** testing shows the
  proposed shim would have caught it without unacceptable false positives. Both
  halves, not either.
- **Owner:** user
- **Blocks:** Phase 1 — Shims and the hook contract
- **Recommendation:** (a). It is the only candidate the sweep gives a recorded need for — Phase 1 Step 2 calls the container-only tooling rule "the surface with the clearest recorded need" — while this blocker's own text says a shim over the hook-bypass flags would be *additive* to a guard that already exists, and names no failure behind the package-manager candidate. A shim changes what a developer's shell does, so the narrow set is the reversible one.
- **If you do nothing:** Phase 1 Steps 2, 3 and 4 cannot name their subject, so Steps 1, 5, 6 and 7 land a shim directory, a performance doctrine and a global kill switch with no shim inside them, and Step 4's false-positive matrix has nothing to cover. Phases 2, 3, 4 and 6 are unaffected.
- **What to do:** pick exactly one —
  1. (a) Ship only the container-only tooling shim: `src/scripts/hooks/shims/php`, and record the hook-bypass and package-manager candidates as out of scope in Phase 1 Step 2.
  2. (b) Add the hook-bypass-flag shim as well, accepting that it duplicates the existing pre-tool guard, and extend the matrix in `tests/scripts/hook_shims.test.ts` to cover both basenames.
  3. (c) Also shim package-manager invocations, which needs a recorded failure first per this roadmap's own evidence discipline.
- **Resolved when:** the shim set is named in this roadmap's Phase 1 Step 2 and the remaining candidates are recorded as out of scope.

### blocker: plan-injection-decision
- **Status:** resolved 2026-08-25 — **(c): defer the whole injection half, AND
  the attestation with it.** AI council **2/2**, and both seats **overruled this
  blocker's own recommendation of (b)**. Same session as `shim-scope-decision`.

  **Why (b) failed, and it is not the argument the recommendation makes.** (b)
  proposed shipping `src/scripts/attest_artifact.ts` *"on its own merit"* as a
  standalone tamper check. Both seats found the merit unstated: **no protected
  artifact, no threat model, no consumer of the attestation result, and no
  required response to a failure.** One seat: *"attestation is a mechanism
  without a subject."* The other: the proposal *"does not identify the gap this
  new mechanism would fill"*, given that git already detects tampering in
  tracked files. Verified in the tree — neither `src/scripts/attest_artifact.ts`
  nor its test exists, so (b) was a **build**, not a re-labelling of code already
  present, which is what made "commits to nothing" untrue.

  **The recommendation's own argument was also weakened.** *"Standing injection
  amplifier"* is *"a plausible risk hypothesis, not measured evidence"* — it
  supports caution about the injection half and does not independently justify
  building the attestation.

  **Consequence for Phase 5, stated so nothing is left ambiguous:** Steps 1–5
  land as a bounded **non-injecting** loop, and Steps 6 and 7 land nothing. The
  blocker's `If you do nothing` warned that Steps 1–5 would otherwise have
  *"injection behaviour undefined"*; (c) defines it as **none**.

  **Revisit-if:** EITHER a provenance-backed context-rot or artifact-tampering
  incident identifies the missing control; OR a concrete design names the
  protected artifact, the trust boundary, the attacker or failure mode, the
  attestation's consumer, and the required response. One seat noted an incident
  is not the only admissible trigger — a complete threat model would do — and
  that is why the second branch exists.
- **Owner:** user
- **Blocks:** Phase 5 — A bounded loop the harness enforces
- **Recommendation:** (b). The sweep supplies evidence on both sides, and only one side is reversible: `src/scripts/attest_artifact.ts` is useful standalone as a tamper check, whereas per-turn re-injection turns a governed file into a standing injection amplifier — this roadmap's own counter-evidence — and that is hard to withdraw once hosts depend on it. Deciding (b) now unblocks Steps 6 and 7 without foreclosing (a) later.
- **If you do nothing:** Phase 5 Steps 6 and 7 ship an attestation guarding an injection that may never exist, and Steps 1 to 5 land a bounded loop whose injection behaviour is undefined. Nothing outside Phase 5 waits on this.
- **What to do:** pick exactly one —
  1. (a) Approve per-turn re-injection and open a follow-up roadmap for it; Steps 6 and 7 remain its precondition.
  2. (b) Mark the injection half out of scope and ship `src/scripts/attest_artifact.ts` plus `tests/scripts/attest_artifact.test.ts` on their own merit.
  3. (c) Defer the whole of Phase 5's injection half until a context-rot incident is recorded with provenance.
- **Resolved when:** the decision is recorded and either a follow-up roadmap opens for the injection half or it is marked out of scope.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A shim breaks a developer's own shell usage | product | A shim placed ahead of a real binary intercepts every invocation in the session, including ones the developer makes deliberately outside the rule's intent. | Session-scoped path prepend only, never a global install; a documented false-positive matrix per shim; the disable flag from Phase 1 Step 7; and the surface set gated on a maintainer decision. | blocker: shim-scope-decision |
| 2 | The stop-event hook exit contract is misread by the host | implementation | This package has already recorded that an advisory exit code 2 is read as a hard block on this host, so a wrong exit contract turns a bounded loop into a deadlock. | The tier record in Phase 5 Step 5 states which hosts can block; the advisory path always exits zero; the re-entrancy flag is read before any decision. | Phase 5: A bounded loop the harness enforces |
| 3 | Auto-injection becomes an injection amplifier | product | Injecting a tracked artifact on every turn means anything written into that artifact reaches context repeatedly, including content that arrived from an untrusted fetch. | Attestation ships before injection and refuses an unattested body; the injection half itself is blocked on an explicit decision rather than shipped by default. | blocker: plan-injection-decision |
| 4 | The loadability check is flaky or unavailable on the runner | implementation | Host command-line tools may be absent or version-skewed on the runner, and a check that silently skips is exactly the failure the sibling gate-integrity roadmap exists to prevent. | The check records an explicit skip reason through the completeness ledger, so an absent tool is a recorded skip rather than a silent pass. | Phase 3: Projection reach |
| 5 | The single-writer verb is bypassed by direct edits | implementation | Nothing prevents an agent turn from editing a checkbox with a generic file-edit tool instead of the new verb, so the concurrency guarantee holds only where the verb is used. | The verb is the documented path and the survival check runs inside it; a follow-up may add a guard, but the interim state is strictly better than today's unguarded edits. | Phase 6: Concurrent-writer safety |

## Provenance

- Source: one first-party security-firm suite for the shim and stop-event
  mechanisms, one planning-runtime suite for the diagnostic, attestation, and
  concurrent-writer mechanisms, and one first-party vendor suite for the
  cross-host vocabulary. Anonymized per `source-confidentiality`; per-source links
  in the sweep record's § Provenance.
- Sweep record + full verdict set:
  [`skill-ecosystem-sweep-2026-08`](../settings/contexts/skill-ecosystem-sweep-2026-08.md).
- Council: see the sweep record § Council.
