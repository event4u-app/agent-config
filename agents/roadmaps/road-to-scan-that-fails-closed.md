---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Repairs a reproduced fail-open in the one security gate whose exit code `docs/CLAIMS.md:255` cites as evidence — a crashed child linter currently reports clean — and adds zero new gate scripts and zero hook concerns, extending five existing surfaces in place."
estate_offset_exempt: "Offsets nothing: it archives no roadmap and supersedes none. The active estate is one carrier file that shares no path with any surface touched here."
---
# Road to a self-scan that fails closed

> **Source:** `agents/tmp.old/inbox-2026-09-o/` — verified against the tree at `5c539505d` on 2026-09-05.

## Goal

The security umbrella `src/scripts/lint_agent_security.ts` spawns five child linters and
throws away every child's exit code at `:209`, while `:67` turns unparsable child stdout
into zero findings. A child that crashes, fails to spawn, or prints a stack trace is
therefore indistinguishable from a child that ran and found nothing: the umbrella prints
✅ and exits 0. That exit code is what `docs/CLAIMS.md:255` offers as evidence for the
claim that every shipped artifact is machine-scanned for hidden-instruction payloads. The
goal is that no child outcome other than a completed run can produce an aggregate pass,
that the umbrella publishes how much it actually read, and that the prose surfaces stop
asserting things the tree contradicts. Someone else can tell whether this happened by
making a child linter exit non-zero and observing that `lint_agent_security` names it and
exits 1, and by finding the umbrella listed in `src/config/gate-coverage.yml` with a
floor it actually meets.

Substantial parts of the source round were **already built** and are deliberately absent
below, which is why this roadmap is six phases rather than the drafts' seventeen. The
"Inspection Ledger" the round proposes as a new subsystem is `src/config/gate-coverage.yml`
plus `check_gate_coverage.ts` and the `scanned: <N>` convention, shipped since 2026-07-29
against the identical failure — so Phase 3 registers the umbrella in it rather than
building a second one. The host-layer digest comparison the round asks for exists at
`src/install/partitionEligibility.ts:137-145`. `npm audit` and Dependabot exist. The
SARIF **upload** is stub-tracked at `agents/roadmaps/stubs/road-to-sarif-and-stateful-residual-row.md:45-60`
with its own probe and a named producer, and is blocked on a repo-settings surface no
step here can supply, so it appears in no phase. A sink-coincidence detector was dropped
outright: reproduction showed its only worked example cannot fire it.

## Phase 1 — Truth surfaces before any mechanism

Prose and one data row. No behaviour changes, so this phase can land while the rest is
still being designed.

- [x] **1.1 Add a `non_inference` field to the `shipped-artifacts-hidden-instruction-scanned` claim.** `docs/CLAIMS.md:255` offers `exec:lint_agent_security -> 0` as evidence, and until Phase 2 lands that exit code does not establish that all five children ran. State that limitation on the entry rather than withdrawing the claim.
      verify: `./scripts-run src/scripts/check_claims` exits 0 and the entry carries a `non_inference` line naming the child-completion gap.
- [x] **1.2 Correct the two stale assertions in the threat model.** `docs/threat-model.md:3` calls the package "no-runtime", which ADR-249 supersedes by permitting a supervised resident process under governance. Row b at `:14` asserts three things the tree contradicts: no Dependabot automation (`.github/dependabot.yml` exists), no `npm audit` in a CI gate (`.github/workflows/tests.yml:443,447` and `release-validation.yml:393,407-408`), and `requirements.txt` as a pinning control (the file does not exist).
      verify: `grep -n "no-runtime" docs/threat-model.md` returns nothing at `:3`; `grep -c "requirements.txt" docs/threat-model.md` returns 0; Row b's Gap cell names only gaps that survive a `grep` of `.github/`.
- [x] **1.3 Register the umbrella's own state in the assurance registry.** `src/config/assurance-capability-registry.json` carries 19 entries and a `self` axis, but its only `security-scan` entry is `axis: target` (`:148`). Add `self-security-scan` with `axis: self`, `state: degraded`, `owner_surface: src/scripts/lint_agent_security.ts`, `limitations` naming the discarded child exit code (`:209`) and the swallowed parse failure (`:67`), and `revisit_if` pointing at Phase 2.2.
      verify: the registry schema test passes; `grep -c "self-security-scan" src/config/assurance-capability-registry.json` returns 1; the entry's `state` is `degraded` and not `available`.

## Phase 2 — The umbrella fails closed

`corrected-from-reproduction` — the child count in this phase is five, not the four the
source round asserts; `lint_mcp_config_security` is the fifth (`src/scripts/lint_agent_security.ts:45-51`).

- [x] **2.1 Freeze the failure corpus first.** Fixtures for each way a child can fail to answer: exit non-zero with empty stdout, exit 0 with unparsable stdout, failure to spawn (`proc.status === null`), and — as the negative control — exit non-zero with valid findings, which must still be reported as findings and not as a run failure.
      verify: each fixture runs green against today's code, proving it reproduces the current fail-open; the negative control is the one that must stay green afterwards.
- [x] **2.2 Give each child a closed terminal outcome and make a failed one block.** `completed | failed | skipped(reason)`, with the skip reasons a constant in the runner rather than configuration. Stop discarding the return code at `:209`; a child that is missing, unspawnable, exits outside the finding contract, or emits unparsable stdout makes the umbrella print the child's name and exit 1.
      verify: the Phase 2.1 fixtures flip from green to red, each naming its child; `./scripts-run src/scripts/lint_agent_security` still exits 0 on the real tree.
- [x] **2.3 Carry execution state in the SARIF invocation object.** Where `--sarif` is passed, emit one SARIF-native `invocation` per child with `executionSuccessful` and `exitCode`. Do not add a parallel metadata block alongside it.
      verify: a run with a deliberately broken child produces SARIF in which that child's `invocation.executionSuccessful` is `false`, and the existing byte-identical-output tests at `tests/scripts/lint_agent_security.test.ts:41,50` still pass.
- [x] **2.4 Undo the Phase 1 hedges that Phase 2 has now made false.** Remove the `non_inference` line from 1.1 and move the registry entry from `state: degraded` to `available` — and only once 2.2 is merged, since the entry's own `revisit_if` names that step.
      verify: `check_claims` green with the field removed; the registry entry reads `available`; both edits sit in the same change as a passing 2.1 corpus.

## Phase 3 — The umbrella publishes what it read

`src/config/gate-coverage.yml:1-33` exists because gates that scanned an emptied tree
reported success and were believed. `lint_agent_security` is absent from it and emits no
count, so the same failure is open on the security gate specifically.

- [x] **3.1 Emit a machine-readable scan count.** One line `scanned: <N>` on stdout or stderr, N being the artifacts the children actually inspected — not the number of children. The manifest's rule 1 is explicit that the guard never parses human output.
      verify: `./scripts-run src/scripts/lint_agent_security 2>&1 | grep -c '^scanned: [0-9]\+$'` returns 1 and N is greater than the number of children.
- [x] **3.2 Register the gate with a CI-identical invocation and a real floor.** Add the row to `src/config/gate-coverage.yml` with `argv` matching how the Taskfile and CI call it, and `min_scanned` set below the true corpus but far above a collapse, per the manifest's rule 3.
      verify: `./scripts-run src/scripts/check_gate_coverage` exits 0 and reports the umbrella's count above its floor.
- [x] **3.3 Prove the floor can fail.** A new coverage row owes a negative control: point the gate at an empty scope and confirm `check_gate_coverage` fails rather than passing on a zero count.
      verify: a self-test or fixture drives the count below the floor and the guard exits non-zero, naming the gate.

## Phase 4 — The scout's security gate actually reads content

`corrected-from-reproduction` — five children, not four, and the gate keeps its current
name throughout: it is already called `security_licence` (`src/scripts/skill_scout.ts:82,86,401`),
so the source round's rename-then-rename-back is dropped.

- [x] **4.1 Give all five children a bounded root mode.** A `--root` flag that scopes the scan, with each linter's current default root retained when the flag is absent.
      verify: `grep -c -- '--root' src/scripts/lint_{hidden_unicode,confusables,instruction_smuggling,mcp_config_security,skill_frontmatter_safety}.ts` returns a non-zero count for each of the five; a run with no flag scans the same corpus it scans today.
- [x] **4.2 Build the candidate corpus before wiring the scout.** Quarantine fixtures carrying a zero-width injection, a disclosure-suppression imperative, and a dangerous frontmatter key, plus one clean candidate.
      verify: against today's `intake()` all four are accepted, reproducing the gap — `src/scripts/skill_scout.ts:272-299` refuses only on symlink, extension, exec-bit and size.
- [x] **4.3 Make the scout run the rooted scan on the quarantine directory.** The gate refuses a candidate whose content a child linter flags, and the refusal names the linter.
      verify: the three payload fixtures from 4.2 are refused with the linter named; the clean fixture is still accepted; the existing scout rejection tests are unchanged.

## Phase 5 — Suppressions bound to the evidence they accept

`src/scripts/_lib/security_lint.ts:168-170` — `pragma_allows` is a key lookup, so a
pragma suppresses its check for the whole file with no location and no content binding,
as `:16-17` documents.

- [x] **5.1 Extend the pragma grammar with a content fingerprint.** `<!-- security-lint: allow <check> "<reason>" sha256:<hex> -->`, hashing the normalized matched evidence and its location identity rather than incidental whole-file content. A pragma without a hash still works and reports itself as `legacy-pragma`.
      verify: a mutation fixture — accept a benign match, then alter only the matched text into a malicious one, and the suppression stops applying while the reason string stays human-readable.
- [x] **5.2 Migrate the existing population and ratchet it to zero.** There are exactly 8 pragma instances across 8 files under `src/` and `docs/`; bind each by hand and read each reason as you go.
      verify: `grep -rn '<!--\s*security-lint:\s*allow' src/ docs/ | grep -vc 'sha256:'` returns 0.
- [x] **5.3 Add no second suppression system.** No new allowlist file in any change belonging to this roadmap.
      verify: `git diff --stat` across the roadmap's changes introduces no file matching `*_allowlist.json`.

## Phase 6 — The published surface is classified, not just measured

`src/scripts/check_pack_size.ts` already runs `npm pack --json` and parses the file list
(`:60`, `:83`) but classifies nothing by type — greps for `binary`, `archive`, `dotfile`
and `magic` return zero. The plumbing exists; only the classification is missing.

- [x] **6.1 Classify each packed entry by type.** Extend the existing parse to bucket entries as `text | dotfile | no-extension | binary | archive`, deciding binary and archive by magic bytes rather than by extension.
      verify: the check prints a per-class count for the real tarball, and a fixture containing a planted archive is classified `archive` rather than `text`.
- [x] **6.2 Ratchet the classes that should be empty.** `binary` and `archive` at zero, with any dotfile or extensionless entry carried by a path-and-size-bound pragma in the Phase 5 grammar rather than a generic allowlist.
      verify: adding a binary file to the packed surface makes the check fail and name the file; removing it makes the check pass again.

## Blockers

### blocker: capability-inventory-second-consumer

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** none; this is the owner's call — it turns on whether a per-skill capability manifest is worth building before a real non-security consumer exists to read it, which is a scope decision, not a technical one.
- **If you do nothing:** the manifest is never built, and 247 of 299 skills keep declaring no `execution:` block with no inventory surfacing that fact.
- **What to do:**
  1. Find or name a concrete non-security consumer for the manifest and state which fields it reads and what decision they feed.
  2. If none exists, leave `agents/roadmaps/later/road-to-capability-native-execution.md` parked and revisit only when one appears.
- **Resolved when:** a named non-security consumer states which manifest fields it reads and what decision they feed.
- **Resolution (2026-09-07) — outcome state: `narrowed`.** Disposition (b)
  RE-SCOPE: the criterion is answerable by a bounded factual observation, and the
  observation was made rather than the decision taken. **The survey found no such
  consumer, and the dated absence is the resolution.** Absence is not
  authorization: nothing here licenses building the manifest, and
  `agents/roadmaps/later/road-to-capability-native-execution.md` is left parked
  and untouched. Framework of record: AI council 2026-09-06, disposition (b).

  **The survey, run over `src/` at `d08656dfe` on 2026-09-07.** No per-skill
  capability manifest exists to consume: the three `src/config/*capab*` files are
  different artifacts — `assurance-capability-registry.json` inventories assurance
  capabilities by axis, `capability-native-outcome-bars.json` is the parked
  roadmap's own pre-registered bars (and is read by nothing outside its test), and
  `host-capabilities.yml` describes HOSTS, not skills. Of the four field classes
  the source round proposed (component digests, declared tools, observed
  capability classes, script sinks), **exactly one has any reader at all**:

  | Surface reading a per-skill `execution.allowed_tools` | Is it a non-security consumer? |
  |---|---|
  | `lint_skill_frontmatter_safety.ts` | No — this IS the security detector the criterion excludes. |
  | `tool_registry.ts` | No — the tool allowlist, i.e. the same security surface. |
  | `skill_linter.ts`, `lint_host_portability.ts`, `schemas/skill.schema.json`, `schemas/subagent.schema.json` | No — VALIDATORS. They check the declaration's shape; they do not read it to feed a decision, which is what the criterion asks for. |
  | `runtime_registry.ts`, `runtime_dispatcher.ts` | No — the dispatcher's own docstring says it "enforce[s] safety", which puts it on the security side of the line. Both are ADR-200 ports declaring `No behaviour changes`. |
  | `skill_preview.ts` | No — it RENDERS declared intent for a human and explicitly "NOT a sandbox". It feeds no decision. |
  | component digests · observed capability classes · script sinks | **Zero readers.** The middle one is the proposed detector's own output, so it could not have one. |

  Measured at the same commit: **52 of 299** skills declare an `execution:` block,
  so **247 declare none** — the roadmap's figure, re-derived rather than quoted.
  An underdeclaration finding still has no defined meaning for five sixths of the
  corpus, which is the condition that made this blocker exist.

  *Reopening condition, unchanged and observation-based:* a named non-security
  surface states which manifest fields it reads and what decision they feed. Not a
  date, and not "someone proposes a manifest".
- The source round's largest proposal is a generated per-skill manifest carrying component
  digests, declared tools, observed capability classes and script sinks. Its own final
  draft gates promotion on a second, non-security consumer existing — otherwise a security
  detector silently becomes an authorization policy. At HEAD there is no such consumer:
  `agents/roadmaps/later/road-to-capability-native-execution.md` is parked, and 247 of 299
  skills declare no `execution:` block at all, so an underdeclaration finding would have
  no defined meaning for five sixths of the corpus. This blocker exists so a future reader
  does not mistake the omission for an oversight. It resolves when a named non-security
  consumer states which fields it will read and what decision they feed.

### blocker: mcp-fingerprint-slot

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** none; this is the owner's call — pre-use interception changes the tool invocation path in a way that observe-only recording does not, and that trade-off belongs to the owner.
- **If you do nothing:** `src/scripts/mcp_tool_fingerprint.ts` stays complete but unbound, so its protection level stays zero.
- **What to do:**
  1. Choose pre-use interception (a `pre_tool_use` binding) or observe-only recording (a `post_tool_use` binding) for `mcp_tool_fingerprint.ts`.
  2. Wire the chosen slot in `src/scripts/hook_manifest.yaml` and confirm `grep -c mcp_tool_fingerprint src/scripts/hook_manifest.yaml` returns a non-zero count.
- **Resolved when:** the owner picks a slot and `mcp_tool_fingerprint.ts` is bound in `hook_manifest.yaml`.
- **Resolution (2026-09-07) — outcome state: `decision resolved, implementation
  transferred`. The clause above was NOT satisfied as literally written, and this
  entry does not claim it was.** Step 1 (pick the slot) is closed. Step 2 (wire it)
  moved to
  [`agents/roadmaps/stubs/road-to-mcp-fingerprint-slot-binding.md`](stubs/road-to-mcp-fingerprint-slot-binding.md).
  `grep -c mcp_tool_fingerprint src/scripts/hook_manifest.yaml` still returns **0**
  and the store's protection level is still zero; a reader must not infer otherwise
  from `Status: resolved`, which is the only token the archival gate accepts.

  **The decision, closed.** Slot `post_tool_use`, mode observe-only, authorization
  granted **none**, pre-use interception **no**. AI council 2026-09-06, 2 seats,
  unanimous.

  **Why the wiring did not land here — and this is a decision, not an omission.**
  This blocker's own `Blocks:` field says it gates "work deliberately excluded from
  this roadmap", while its `Resolved when:` requires that excluded work to be done.
  Those are mutually unsatisfiable, and AC-8 of this roadmap decides which one
  gives: *"No new gate script, no new hook concern, no new CLI verb … exists in the
  tree as a result of this roadmap."* Binding the store adds a new hook concern to
  the per-host `post_tool_use` lists, so executing the settled decision inside this
  change would make AC-8 false. AI council 2026-09-07 (2 seats, convergent) ruled
  that amending AC-8 inside the roadmap AC-8 governs, solely so the binding may
  land and the roadmap still be called complete, has the shape of goalpost movement
  — and that the honest disposition is to close the decision half, transfer the
  implementation, preserve AC-8, and say plainly that the original condition was
  superseded rather than met. Question and both responses:
  `agents/runtime/council/{questions,responses}/mcp-fingerprint-slot-vs-ac8.md`
  (gitignored and auto-pruned; the substance is carried here and in the stub).

  **This is not a silent downgrade, and the check was run rather than assumed.**
  `road-to-mcp-runtime-integrity` § "The no-silent-downgrade rule" does not forbid
  the post-use variant — *"The variant stays a legitimate option; what is forbidden
  is choosing it without the owner recording that they chose it."* It requires a
  recorded trade-off, which this entry and the stub are. Two measured facts at
  `d08656dfe`: nothing is being substituted, because the store is bound to no slot
  at all, so the move is zero → observation rather than pre-use → post-use; and
  pre-use is unavailable on its own gate independent of this decision, because
  `check_composite_arming` reports "no composite store … NOT the same as armable"
  and `hook-latency-budget.json` carries `observe_only: true` with `p50_ci: null`.
  That rule's own reopening condition has therefore not fired.

  **Observe-only must never be cited as satisfying a preventive runtime-integrity
  guarantee.** It detects a rug-pull after the first call; for a tool with
  irreversible side effects that is a post-mortem, not a control. The prevention
  floor is zero before and zero after.

  *Reopening conditions, two and separate:* the wiring trigger in the stub
  (before any claim or dependent surface assumes fingerprint recording, or before
  the first non-test MCP tool execution relies on the store, or 2026-12-07); and,
  unchanged, the parent lock's own — `check_composite_arming` reports armable AND
  the latency ceiling carries a number, at which point the slot choice is reopened
  on that roadmap's terms and nothing here prejudges it.
- `src/scripts/mcp_tool_fingerprint.ts` is complete and bound to no hook slot —
  `grep -c mcp_tool_fingerprint src/scripts/hook_manifest.yaml` returns 0, and its only
  importer is its own test. Its protection level is therefore zero. Choosing the slot is a
  trade-off between pre-use interception and observe-only recording that changes the tool
  invocation path, which is owner-reserved rather than council-decidable. This roadmap
  carries the decision package and deliberately wires nothing.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Fail-closed turns a flaky child into a blocked pipeline | implementation | Once a non-zero child exit blocks, any transient spawn failure — a busy runner, a tsx resolution hiccup — reddens CI on a change that touched nothing security-relevant, and the pressure will be to weaken the check rather than fix the flake. | The closed vocabulary includes `skipped(reason)` with reasons as a runner constant, so a genuinely non-applicable child has a legal terminal state that is not `failed`; the Phase 2.1 negative control fixes that a child exiting non-zero *with valid findings* is findings, not a run failure. **Re-reviewed 2026-09-07, after the phase landed: the mitigation held and the residual is named rather than closed.** No child produces a `skipped` today — all five apply on every platform — so the state is exercised only through the runner seam in the failure corpus. It exists because the alternative to having it IS this risk: once a non-completing child blocks, a non-applicable child would have to be expressed as `failed`, and the fix for that would be to weaken `failed`. The flake half is unmeasured: no transient spawn failure has been observed since the repair, and one run is not evidence of a rate. | Phase 2 — The umbrella fails closed |
| 2 | The scan count is chosen to clear its own floor | implementation | `scanned: N` is emitted by the same script the floor judges, so a definition of N that counts children rather than artifacts would satisfy the guard while measuring nothing — precisely the failure `gate-coverage.yml` exists to stop. | 3.1's verify requires N to exceed the child count; 3.3 requires a negative control that drives the count below the floor and observes the guard fail. **Re-reviewed 2026-09-07: held, and the definition is now the load-bearing part.** N is 16989 against a floor of 12000 and a child count of 5 — three orders of magnitude apart, so the gamed definition cannot clear the floor. N is the SUM of the five children's own reported counts, i.e. artifact INSPECTIONS rather than distinct artifacts, which the coverage row states explicitly so nobody reads it as a file count. That choice is the stronger collapse detector: a distinct-union figure would stay high while one child stopped reading a directory another still covered. What the floor does NOT guard — a child's corpus reaching zero — is guarded better by each child's own dead-scope assertion feeding the fail-closed aggregate. | Phase 3 — The umbrella publishes what it read |
| 3 | Rooted scanning silently narrows the default scan | implementation | Adding `--root` to five linters risks a refactor in which the default root is computed differently, shrinking the real corpus while every test still passes. | 4.1's verify pins that a flagless run scans the same corpus as today; Phase 3's floor, landed first, turns any silent narrowing into a gate failure rather than a green run. **THIS RISK FIRED, 2026-09-07, in the inverse direction — recorded rather than closed.** The first `--root` wiring patched a COMMENT mentioning `sl.iter_corpus()` in `lint_confusables.ts` and left the real call site alone, so that child silently IGNORED the flag and reported 1655 files against an empty directory. The default corpus was never narrowed; the bounded mode simply did not apply, which no test asserting the default would have caught. What caught it was the empty-root probe built for 3.3's negative control — a scan reporting 1655 against a directory with no files. The exact construct was then swept across all five children: 1 of 5 affected, now 0, and every flagless count re-measured identical to before the change (10899 / 1655 / 1655 / 2060 / 720). | Phase 4 — The scout's security gate actually reads content |
| 4 | Fingerprint migration mis-binds a pragma and hides a real finding | implementation | Hashing the wrong unit — whole file instead of the matched evidence — would preserve today's over-broad suppression under a new name and be harder to audit. | 5.1 fixes the hashed unit as the normalized match plus location identity and requires a mutation fixture that proves the binding is content-sensitive; the population is 8 instances, small enough to read by hand as 5.2 requires. **THIS RISK FIRED IN ITS OTHER DIRECTION, 2026-09-07.** The hashed unit was correct; the APPLICATION was not. The first wiring wrapped only each `_scan`'s terminal return, and `lint_skill_frontmatter_safety._scan` has an early return for an artifact with no `execution:` block — so a bound pragma silently failed to apply to exactly that population, which is the whole `src/subagents/` surface. It surfaced as the tree going red rather than as a hidden finding, i.e. in the safe direction, and the fix removes the class: every `_scan` now routes every exit through one `finish` helper. Two further things the hand audit found that no mechanical migration would: this rule's own pragma in `untrusted-input-defense.md` suppressed nothing but its own reason string and was deleted; and the fingerprint had to become stable under the act of recording it, because two pragmas here ARE their own evidence. Population re-measured: 9 pragma-shaped lines in 8 files, of which 7 were live (now 6), not the 8 instances this row assumed. | Phase 5 — Suppressions bound to the evidence they accept |
| 5 | The prose corrections land and the mechanism does not | product | Phase 1 is cheap and Phase 2 is not; a plausible outcome is that the honest hedges ship, the claim is downgraded, and the repair stalls — leaving the package with a documented weakness instead of a fixed one. | 1.3's registry entry carries a `revisit_if` naming Phase 2.2, and 2.4 makes removing the hedges a step of the mechanism phase rather than an optional tidy-up, so `state: degraded` stays visible in a generated surface until the defect is actually closed. **Re-reviewed 2026-09-07: did not fire.** Phase 2 landed and 2.4 rode in the SAME commit as 2.2 rather than a later one, so the hedge was never absent while the defect was present and `degraded` was never a state anyone could read as settled. It survives in the registry entry's own history. | Phase 1 — Truth surfaces before any mechanism |
| 6 | Publish-surface classification blocks a legitimate release | product | A magic-byte classifier that mislabels a legitimate packed file as `binary` fails the publish path at the worst moment. | 6.2 routes exceptional entries through the Phase 5 bound-pragma grammar rather than a generic allowlist, so an accepted entry is recorded with a reason and a content binding and a later change to that entry re-fires the check. **Re-reviewed 2026-09-07: did not fire, and the adjacent surprise is the one worth recording.** No legitimate entry was mislabelled: 15 non-text entries, all 15 bound, 0 unaccounted, and the magic-byte classifier put three 69-byte PNGs in `binary` correctly. What the measurement refuted was this phase's own premise that `binary` would be zero — those three PNGs are part of the shipped media-adapter dry-run surface, so AC-6 is NOT met and stays open rather than being reinterpreted. A different mitigation than this row's also earned its place: an entry the check cannot OPEN is classified `unreadable` and refused, because a class it did not classify must not fall through to the one needing no exception. | Phase 6 — The published surface is classified, not just measured |

## Acceptance Criteria

- [x] AC-1 — No terminal outcome of any of the five umbrella children other than a completed run can produce an aggregate pass; each failure class has a fixture that was green before the repair and names its child after it.
- [x] AC-2 — `lint_agent_security` emits one `scanned: <N>` line counting inspected artifacts, is listed in `src/config/gate-coverage.yml` with a CI-identical `argv`, and a negative control drives its count below the floor and reddens `check_gate_coverage`.
- [x] AC-3 — `src/config/assurance-capability-registry.json` carries a `self-security-scan` entry whose `state` is `available`, and it reached `available` only after the fail-closed repair merged.
- [x] AC-4 — A quarantined candidate carrying a zero-width injection, a disclosure-suppression imperative, or a dangerous frontmatter key is refused by the scout with the flagging linter named, and a clean candidate is still accepted.
- [x] AC-5 — Every `security-lint: allow` pragma under `src/` and `docs/` carries a content fingerprint, altering the matched content stops the suppression from applying, and no allowlist file was added.
- [ ] AC-6 — The packed tarball is classified by type with `binary` and `archive` at zero, and any dotfile or extensionless entry is carried by a path-and-size-bound pragma rather than a generic allowlist.

  **AC-6 disposition, 2026-09-07 — NOT MET, and the criterion is deliberately
  left unchanged.** Both AI-council seats refused to rewrite this sentence
  inside the roadmap it governs, on the ruling this run had already applied to
  the `mcp-fingerprint-slot` blocker: relaxing a criterion so the roadmap may be
  called complete has the shape of goalpost movement. Evidence is appended here;
  the sentence above is verbatim as authored.

  **The mechanism is built and proven; the raw count is not zero.** Measured on
  the built payload at `d08656dfe` (3033 entries): `archive 0` · **`binary 3`** ·
  `dotfile 4` · `no-extension 8` · `text 3018` · **unaccounted 0**. Every entry
  outside `text` carries a path-and-size-bound exception —
  `sha256(path + "\n" + size)`, a written reason each, no allowlist file tracked
  or untracked. Step 6.2's own `verify` passes literally: an ELF header written
  to `src/scripts/zz-probe-binary.ts` made the check fail and NAME the file, the
  `.ts` extension buying it nothing; removing the file restored green.

  **The three binaries**, each with its bound digest recorded in
  `src/scripts/check_pack_size.ts`, are 69-byte placeholder PNGs at
  `src/scripts/media/lib/fixtures/{flux,gemini-image,ideogram}/asset-0001.png`.
  They are part of a shipped consumer surface, not stray artifacts:
  `src/scripts/media/lib/adapter-contract.md:7,355` declares
  `scripts/media/lib/fixtures/<adapter-id>/` as the location media adapters emit
  dry-run output into, and each directory's `result.json` names its PNG by that
  path.

  **The council split, and the split is recorded rather than resolved by the
  agent.** Seat 1 read "at zero" as the RATCHET ("zero unaccounted", which is
  how this file's pre-existing `CONTENT_CLASSES` already uses `limit: 0`
  alongside `measured_in` provenance) and would tick the box with this note.
  Seat 2 read it as the observed COUNT, noting that the exception clause names
  only dotfile and extensionless entries and that step 6.2 calls binary and
  archive "classes that should be empty" — so inserting the absent word
  "unaccounted" materially relaxes an observable requirement. A split escalates;
  and adopting the relaxing reading is the ACCEPTING direction on a governance
  control, which the run's own framework puts out of the agent's reach. **So the
  conservative reading stands and this box stays open.**

  **What closes it — an owner decision among four, none of them this agent's to
  take:** (1) remove the PNG fixtures from `package.json` `files[]`; (2)
  generate equivalent fixtures during tests or dry runs instead of shipping
  them; (3) ship a textual representation and materialize the PNG where needed,
  if the adapter contract permits; or (4) formally amend the requirement to
  permit individually bound binary exceptions — outside this roadmap's own
  self-certification. Options 1-3 are changes to a shipped consumer-facing
  surface owned by whoever owns the media adapters.

  *This roadmap keeps responsibility.* The work is NOT transferred to a stub:
  seat 2's condition for `[~]` is a real follow-on roadmap that explicitly
  accepts the work and its estate cost, and manufacturing one for archival
  convenience is the same shape as widening a ratchet for bookkeeping. The
  roadmap therefore does not archive, and that visible open state is the
  accountability mechanism.
- [x] AC-7 — `docs/CLAIMS.md` and `docs/threat-model.md` assert nothing about dependency auditing, Python pinning, or runtime posture that a grep of `.github/` and the repo root contradicts.
- [x] AC-8 — No new gate script, no new hook concern, no new CLI verb, and no second suppression system exists in the tree as a result of this roadmap.
