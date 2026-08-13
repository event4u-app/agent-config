<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
---

# Road to local-only gate reds — four red gates nobody sees

**Goal.** Clear the four gates that are red on `main` today, and answer the
question the four of them raise together: `task ci` runs gates the GitHub
workflows never run, so a gate can be red on the trunk indefinitely while every
PR reports green.

## Context — how these surfaced

Found while screening roadmaps for `/roadmap:next` on 2026-08-13, measured on a
clean checkout of `origin/main` at `8f9f44415` with an empty working tree. None
of the four is caused by the change that found them; each was verified by
running the gate itself, not inferred from a report.

The load-bearing observation is the one that connects them: **`gh run list` for
`main` is fully green while four gates in the `ci` task list fail.** Every one of
the four is registered in `Taskfile.yml`'s `ci` list and in a `taskfiles/*.yml`
file, and in **no** `.github/workflows/*.yml`. So the trunk can carry a red gate
for as long as nobody runs `task ci` locally — which the repository's own
settings discourage (`quality.local_auto_run` defaults to false, and
`roadmap-ci-steps-policy` forbids scheduling full-pipeline runs during roadmap
work).

That is not automatically a defect. There are legitimate reasons to keep a gate
out of CI — runtime, flakiness, a dependency the runner lacks. But the reason is
recorded nowhere, and the consequence is: the four below went unnoticed.

## Correction 2026-08-13 — the cause was found, and it is worse than the symptom

The paragraph above asked why the four went unnoticed. There is a checker whose
entire purpose is to notice: `check_ci_local_parity`, whose manifest header
defines the failure class as *"local-only — a gate `task ci` runs that no
workflow does. Nothing enforces it remotely, so a defect merges"* and cites a
measured case (16 stale index rows reached the trunk behind a local-only
`check-index`).

**It could not report that direction at all.** It builds its CI-side set by
regexing raw workflow text for `task <name>` and expanding each name's closure —
comments included. Several workflow comments contain the literal string
`task ci` *while stating that no workflow invokes it*. So `ci` was read as an
invocation, its 247-gate closure entered the "runs in CI" set, and
`undeclared_local_only` was **0 by construction**. The prose documenting the gap
was what suppressed the gate that would have reported it.

Measured at the repair, which ships with this roadmap:

| | before | after |
|---|---:|---:|
| `ci` extracted from workflow text | yes | no |
| CI-side gate count | 273 | 106 |
| `undeclared_local_only` | 0 | **167** |

167 of 247 local gates — **68 %** — have no remote reach. The four that started
this roadmap are a sample of that set, not the set.

One further fact bounds what the repair buys: **`check_ci_local_parity` itself
runs in no workflow.** It is its own finding, so the ratchet added here has no
remote reach either. Clearing the backlog is what would give it teeth; until
then it fails only a local `task ci`.

## Two more reds — found 2026-08-13; one repaired here, one filed

Running `check_gate_coverage` at the start of the next pass exits 1 on **two**
gates the original four did not include. The first draft of this section claimed
one, and the R2 completion review caught it: the grep that found the first was
keyed on the ratchet vocabulary, so it read past a red whose message shares none
of those words. A count is a claim, and this one was wrong by exactly the gate
this branch edits.

**Red 1 — `lint_rule_skill_pack_reach` had never reported a scan. Repaired.**

```
❌ lint_rule_skill_pack_reach: emitted no 'scanned: <N>' line
   — an enforced gate must report what it inspected
```

`SCANNED_RE` in `check_gate_coverage.ts` is `/^\s*scanned:\s*(\d+)\s*$/m` — the
count must **end** the line — while the gate emitted
`scanned: 116 rule(s), 289 skill(s), …`. So an entry registered `status:
enforced` with `min_scanned: 90` resolved to `null` from the moment `924cad87f`
registered it, which is the same commit Phase 2 Step 1 identifies by name. The
line is byte-identical on `origin/main`, so this is pre-existing rather than a
regression of this branch. Repaired by emitting the machine-readable contract
line first and the human breakdown second; the gate now reads
`✅ lint_rule_skill_pack_reach: scanned 116 ≥ 90`.

It is the roadmap's own thesis pointed at itself: a gate registered as enforced,
carrying a floor, and structurally incapable of meeting it — red for seven days
inside the branch whose subject is red gates nobody sees.

**Red 2 — the parity floor the repair itself moved. Not repaired here.**

```
❌ check_ci_local_parity: scanned 357, floor 380
   (CI + local gate invocations parsed from .github/workflows + taskfiles
    (443 at baseline)) — a gate inspecting this little cannot certify the corpus
```

The gate's own run is **green** — `✅ CI ↔ local parity: 107 CI gate(s), 250
local, 26 declared CI-only, 2 declared local-only`, exit 0. What is red is its
`min_scanned` floor in `src/config/gate-coverage.yml`, and the arithmetic is
exactly the repair: 107 + 250 = 357, where the 443 baseline was taken while the
CI-side set still carried the 167 comment-derived phantoms. So the floor and its
`corpus:` line now describe a population that no longer exists — the same shape
as a stale pin that still reads as authoritative.

This is **not** repaired here, deliberately. A `min_scanned` floor is a gate
threshold, and lowering one is a weakening whichever way the arithmetic points;
the honest re-anchor number is a judgement about margin, not a derivation. It is
recorded under `blocker: ci-reachability-decision` § 5 with the candidate
answers, because it is the same decision: what the tree does about a parity gate
whose measured population just fell by 20 %.

An AI council was asked to adjudicate the disposition and **could not be
reached** — anthropic `cli_quota_exhausted` (50/50), openai
`Not inside a trusted directory`, from both the worktree and the main checkout,
across two attempts. The shrink-only baseline below is therefore a **staged
choice made without the council**, deliberately the option that adds no
unfixable block; the alternatives stay open under
`blocker: ci-reachability-decision`.

## Prerequisites

- A clean checkout of `main`, no working-tree modifications — three of the four
  gates read the tracked tree and a dirty tree changes their verdict.
- `task` (go-task) available; gates are invoked directly with `npx tsx` in the
  verification steps so a missing `task` does not block the work.

## Phase 1 — the two mechanical repairs

Both are one-token frontmatter edits with no judgement left in them; the
measurements that decide each value are recorded here so the step does not
re-derive them.

- [x] ~~`agents/roadmaps/archive/road-to-always-loaded-corpus-scoping.md` declares
      `complexity: standard`~~ — **repaired 2026-08-13** in the PR that closed
      that roadmap, because it was the sole failure of
      `lint_roadmap_complexity` and it sat in a file that diff was already
      editing. `COMPLEXITY_PAT` in `src/scripts/lint_roadmap_complexity.ts`
      accepts `lightweight|structural` only, so the file reported `[untagged]`
      and the gate exited 1 on the whole corpus.
      **Re-measured at repair time — the value held, its evidence did not:**
      **247** lines (this step recorded 149, before the closing edits), 4
      `## Phase` headings; both still inside the lightweight caps (600 lines,
      6 phases), so `lightweight` is correct and `structural` would have been a
      false claim of contract-layer scope.
      *Verified:* `npx tsx src/scripts/lint_roadmap_complexity.ts` →
      `42 roadmap(s) complexity-clean`, `0 untagged`, exit 0.
      **Note for whoever resolves `august-program-disposition`:** that blocker's
      `Blocks:` line claims both mechanical repairs, but its body gates only the
      `road-to-august-program` disposition and `check_roadmap_trackable`. This
      half was never actually gated by it. The roadmap named above now lives
      under `agents/roadmaps/archive/`.

- [ ] Decide the disposition of `agents/roadmaps/road-to-august-program.md` and
      apply it. `check_roadmap_trackable` fails it for carrying no
      `## Phase <id>` heading and no `status: draft`, so the dashboard cannot
      count it and a reader sees no planned work.
      **Measured:** 243 lines, 8 `##` sections, **zero** checkboxes of any
      glyph, zero `Phase` headings. It is a pure coordination file that
      schedules three sibling roadmaps and carries no executable work of its
      own; its own Risk 1 pre-registers archival if the two real dependencies
      hold without it.
      The gate names exactly two remedies, and a third exists outside it —
      which is why this is a decision and not a repair. See
      `blocker: august-program-disposition`.
      *Verify:* `npx tsx src/scripts/check_roadmap_trackable.ts` exits 0.
      <!-- blocked-by: august-program-disposition -->

## Phase 2 — the self-test ratchet

- [x] Identify which registered gate crossed the
      `gate-self-test:registered-non-adopters` ratchet. It reads **25** against
      a baseline of **24**, i.e. one over, and the baseline note records the
      landing state as "24 of the 32 gates registered enforced" on 2026-08-06.
      The manifest now carries 35 enforced entries, so at least one gate was
      registered after that date without adopting `_lib/gate_self_test.ts` and
      without a `// self-test-exempt: <reason>` marker.
      The current 25, recorded so the next reader does not re-derive the list:
      `audit_skill_overlap`, `check_augment_description_cap`,
      `check_ci_local_parity`, `check_cli_registry_budget_sync`,
      `check_completion_review`, `check_condensation`, `check_context_paths`,
      `check_gate_completeness`, `check_iron_law_prominence`,
      `check_no_roadmap_refs`, `check_portability`, `check_review_dispositions`,
      `check_site_links`, `check_suppression_hygiene`,
      `lint_abstraction_thresholds`, `lint_artefact_frontmatter`,
      `lint_handoffs`, `lint_load_context`, `lint_namespace`,
      `lint_plan_risk_register`, `lint_profile_personas`,
      `lint_rule_skill_pack_reach`, `lint_token_budget_discipline`,
      `lint_trigger_collisions`, `skill_linter`.
      *Verify:* the crossing gate is named with the commit that registered it.
      → **`lint_rule_skill_pack_reach`, registered by `924cad87f`
      (2026-08-12, "fix(ci): three downstream surfaces the new triggers, key and
      gate opened").** Derived rather than guessed: the enforced manifest set was
      recomputed at `c94676978` (the last `gate-coverage.yml` commit on the
      baseline's landing date) and at HEAD, and `list_self_test_non_adopters` was
      run against both. 32 → 35 enforced, non-adopters 24 → 25. Exactly three
      gates were added — `check_review_prompt_binding`, `lint_rule_skill_pack_reach`,
      `lint_workflow_paths` — and only one of the three appears in the current
      non-adopter set, which is also the only id present in the now-set and
      absent from the then-set. Zero gates were removed, so the +1 has a single
      cause.

- [x] Give that gate a self-test, or an exemption marker carrying a real reason.
      Adoption is the default; an exemption is legitimate where a gate's
      rejection cannot be provoked by a fixture it can build in a temp
      directory. **Do not raise the baseline** — `check_gate_coverage` states in
      its own failure message that raising it is a defect, not a fix.
      *Verify:* `npx tsx src/scripts/check_gate_coverage.ts` reports the ratchet
      at 24 or below.
      → **Adopted, not exempted.** The exemption ground did not apply: the
      gate's three inputs (`src/rules/`, `src/skills/`, the pack registry) are
      ordinary tree reads, so a temp-directory fixture can provoke every verdict.
      Added `--root <dir>` plumbing and `--self-test` with **six cases (3
      rejecting, floor 6)**: an unreachable route under `--strict`, an empty
      rule corpus (the scanned-nothing refusal, exit 2), a valueless `--root`
      (added when the R2 review found that flag falling back to the real tree),
      and three accepts that pin the discrimination — the same route made
      reachable through `requires`, an unscoped rule, an unscoped skill.
      Default invocation is byte-identical:
      `116 rule(s), 289 skill(s), 34 pack(s) — 12 unreachable-route,
      14 unrouted-skill`, exit 0.
      The reject cases were checked against the failure this repository has
      recorded before — a negative test that passes for the wrong reason.
      Mutating `unreachableFrom.length === 0` to `>= 0` turned the first case
      red (`5/6 case(s) behaved`) and left the others green, so the case is
      bound to the detector and not to the fixture.

      The sixth case was mutation-checked separately, and the first attempt
      taught something worth recording. Deleting the guard body alone does
      **not** turn it red: `args.root` then holds `undefined`,
      `path.join(undefined, …)` throws, and the entry guard still exits 2 — the
      case would have passed for the wrong reason, which is the exact failure
      it exists to prevent. Restoring the original `argv[i + 1] ?? REPO`
      fallback — the real defect, not a paraphrase of it — does turn it red
      (`5/6`, exit 0 because the run silently scanned the live tree). So the
      case is bound to the silent fallback. It does **not** distinguish a clean
      refusal from a crash, since both exit 2; `runSelfTest` compares exit codes
      and nothing here asserts the message.

      Ratchet reads **24**, the baseline unchanged and not raised.

## Phase 3 — the roadmap that cannot archive

- [ ] Resolve or record the three open blockers on
      `agents/roadmaps/road-to-inbox-harvest-2026-08-b-release-integrity.md`:
      `release-head-cadence-decision`, `carrier-install-paths-decision`,
      `adr-221-acceptance`. The roadmap is 12/12 done with zero deferred steps,
      so `roadmap:progress-check` reports it as completed-but-unarchived and the
      archival sweep refuses it — correctly, since archiving a roadmap with open
      blockers would bury three decisions.
      All three are maintainer calls; see `blocker: release-integrity-blockers`.
      *Verify:* each blocker reads `Status: resolved` with the decision recorded
      in the roadmap.
      <!-- blocked-by: release-integrity-blockers -->

- [ ] Archive it and regenerate the dashboard.
      *Verify:* `npx tsx src/agent-src/scripts/archive_completed_roadmaps.ts`
      moves the file, and `agent-config roadmap:progress-check` exits 0.
      <!-- blocked-by: release-integrity-blockers -->

## Phase 4 — close the class, or state why it stays open

The three phases above clear four instances. This phase decides whether the
class recurs.

- [x] Establish, per gate, why the four are absent from every
      `.github/workflows/*.yml`. Distinguish a deliberate exclusion (runtime,
      runner dependency, known flakiness) from drift (nobody wired it). Report
      the split; do not assume it is all drift.
      *Verify:* a table of the four with a cited reason each, and the same
      question answered for the rest of the `ci` list — how many `ci` tasks have
      no workflow counterpart at all.
      → **Answered, and the step's own framing was too small.** The number is
      **167 of 247** local gates, not four. The reason none of them was reported
      is a defect in `check_ci_local_parity`, not a per-gate decision: it counted
      `task ci` mentions inside workflow COMMENTS as invocations, which made its
      local-only count 0 by construction. See § Correction 2026-08-13.
      The split the step asked for (deliberate vs drift) is therefore **not
      answerable per gate today** and is not claimed: with the count suppressed
      since the checker shipped, no gate was ever put to that question. The
      declared exemptions that do exist are the manifest's two `local_only`
      entries; the remaining 165 have no recorded reason in either direction.
      Repaired here: comments are stripped before extraction, the count is
      published, and the 167 are recorded as a shrink-only baseline so a NEW
      gate registered in `task ci` with no workflow reds immediately.

- [x] Pin the repair so it cannot silently regress.
      *Verify:* a test asserts that the real workflow corpus yields `ci` from raw
      text and NOT from stripped text, and that the local-only set is neither
      above its baseline nor silently empty.
      → Six assertions in `tests/scripts/check_ci_local_parity.test.ts`. One
      pre-existing assertion had to be **corrected rather than kept**: it read
      `expect(report.undeclared_local_only).toEqual([])` and passed for the wrong
      reason — the set was empty by construction, so the test had pinned the
      defect and would have forced any repair to preserve it.

- [x] Search the same defect class elsewhere: a checker whose extraction is fed
      by text that is not an instruction.
      **Started, one candidate, not proven.** `check_enforcement_coverage` seeds
      reachability with a bare `wiring.includes(stem)` over raw workflow text —
      the same shape — while its *script-body* expansion one function later does
      strip comments. Probed: 13 of 850 script stems appear in workflow text only
      inside comments, but all 13 are generic English words (`council`, `packs`,
      `prompts`, `replay`, `telemetry`, …) matching as substrings of prose. So the
      mechanism is confirmed and the consequence is coverage **inflation**, not
      the blindness above — a different severity, and unquantified.
      *Verify:* either a demonstrated false "reachable" verdict for a named
      script, or a recorded null saying the substring matches carry no verdict
      weight.
      → **Both halves answered: the mechanism is demonstrated on a named script,
      and the null is that no verdict moves — now quantified.**

      *Method, stated because it differs from the 13 above and the two numbers
      are otherwise read as contradicting.* The earlier probe asked which stems
      occur only inside comments. This one re-runs the gate's **own** seed
      disjunction — `wiring.includes(rel) || wiring.includes(stem)` — a second
      time against YAML with `#` comments removed, so a stem mentioned in prose
      whose path also appears in a `cmd:` survives, as it should. 851 scripts,
      **417 seeded**, 380 of them stem-only.

      *The demonstration.* Exactly **4** of the 417 leave the seed once comments
      are stripped, and one is a wrong-kind match rather than a generic word:
      `.github/workflows/tests.yml:425` is a NOTE about a workflow that MOVED,
      and it names `scripts/cmd_export.py` — a **Python** file that is not in the
      tree (`ls` fails). That prose seeds the TypeScript
      `src/scripts/_cli/cmd_export.ts` as reachable from CI. The other three are
      the generic-word class: `mcp_server/tool_catalog_source.ts` from a
      `tests.yml:272` comment, and `_cli/explain_last/assumptions.ts` plus its
      `sections/` twin from the English word "assumptions" in
      `evaluator-umbrella.yml:62`.

      *The null, and it is bounded rather than asserted.* The seed only reaches a
      verdict through `resolve_one`, which resolves a rule's frontmatter
      `enforced_by:` entry. The declared-enforcer vocabulary across all 33
      declaring rules is 15 `validator:src/scripts/*.ts` paths, 9 `hook:` ids,
      `none`, and `observer:maintainer-review`. **None of the four appears in
      it**, so today the inflation costs no rule a wrong coverage verdict. That
      turns the previous "unquantified" into a measured ceiling of four scripts.

      *Not repaired here, and the reason is a real edge case rather than
      caution.* The obvious fix — pass the seed through `strip_comments` — does
      not work: that helper strips `//` and `/* */`, and the wiring corpus is
      YAML, whose comments are `#`. A YAML-aware strip has to decide what to do
      with `#` inside a quoted scalar, which is a design question and not a
      one-line change. Filed as an option under
      `blocker: ci-reachability-decision` rather than smuggled in.

- [ ] Decide what follows from that number, and record the decision.
      The options are genuinely different in cost and none is obviously right:
      wire the local-only gates into an existing workflow; add one aggregate
      workflow job that runs the local-only remainder; or state explicitly that
      `task ci` is a superset local gate and that trunk-red on those gates is
      accepted, with a named cadence for checking it.
      See `blocker: ci-reachability-decision`.
      *Verify:* the decision is recorded as an ADR or in
      `docs/contracts/ci-green-floor.md`, whichever the decision's scope fits.
      <!-- blocked-by: ci-reachability-decision -->

## Acceptance criteria

- `npx tsx src/scripts/lint_roadmap_complexity.ts` exits 0.
- `npx tsx src/scripts/check_roadmap_trackable.ts` exits 0.
- `npx tsx src/scripts/check_gate_coverage.ts` reports
  `gate-self-test:registered-non-adopters` at 24 or below, with the baseline
  unchanged or lowered — never raised.
- `agent-config roadmap:progress-check` exits 0.
- The Phase 4 decision is recorded in a durable artefact, including the case
  where the decision is to change nothing.
- `npx tsx src/scripts/check_gate_coverage.ts` reports **no gate red that this
  roadmap opened** — specifically the `check_ci_local_parity` floor of
  § Two more reds is cleared or carries a recorded disposition. Added
  2026-08-13: without this criterion the roadmap could close green while
  leaving a red gate behind, which is the failure it exists to remove.

## Quality gates

Targeted per step, as each *Verify:* line names. The full pipeline is not
scheduled here: `quality.local_auto_run` is false in this repository and the
remote CI on the PR is the authoritative gate
([`roadmap-ci-steps-policy`](../../src/rules/roadmap-ci-steps-policy.md)).

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-13 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 4 concludes "wire everything into CI" | implementation | The `ci` list holds well over a hundred tasks; wiring the local-only remainder wholesale could add substantial runtime to every PR and turn a quiet problem into a loud one | Phase 4 step 1 measures the split between deliberate exclusion and drift BEFORE step 2 decides; the three options are pre-registered so the cheap one (accept, with a cadence) is on the table from the start | Phase 4 — close the class, or state why it stays open |
| 2 | The august-program disposition is decided by convenience | product | `status: draft` is the cheapest way to green the gate and is arguably false — the file is an accepted coordination layer, not an unfinished draft. Choosing it to silence a linter is the config-bending this repository has recorded before | The step is gated on an explicit blocker rather than left to the executing agent, and the blocker enumerates all three remedies with what each asserts about the file | Phase 1 — the two mechanical repairs |
| 3 | The self-test crosser is exempted rather than fixed | implementation | An exemption marker is one line and always available, so the ratchet can be satisfied without any gate gaining the ability to prove it discriminates | Phase 2 step 2 states adoption as the default and names the only legitimate exemption ground (a rejection that cannot be provoked by a temp-directory fixture); the reason field is read at review time | Phase 2 — the self-test ratchet |
| 4 | Three maintainer decisions block a roadmap indefinitely | product | Phase 3 cannot proceed without three calls only the maintainer can make, so this roadmap can stall at 4 of 6 steps | Phases 1, 2 and 4 step 1 are independent of it and carry their own value; if Phase 3 stalls, the roadmap moves to `later/` rather than sitting active, per the disposition rules | Phase 3 — the roadmap that cannot archive |

## Blockers

### blocker: august-program-disposition
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 — the two mechanical repairs
- **What to do:**
  1. Decide what `agents/roadmaps/road-to-august-program.md` is. It has 243
     lines, 8 sections, zero checkboxes and zero `Phase` headings, and
     coordinates three sibling roadmaps that each back-link to it.
  2. Pick one, knowing what each asserts:
     **(a) `status: draft`** — cheapest, greens the gate, and claims the file is
     unfinished, which it is not. **(b) Canonical `## Phase <id>` headings** —
     makes it dashboard-visible, but requires inventing executable steps a
     coordination file does not have. **(c) Archive it** — its own Risk 1
     pre-registers exactly this if the dependencies it coordinates hold without
     it; the three siblings' back-links would need migrating.
  3. Apply the choice and re-run
     `npx tsx src/scripts/check_roadmap_trackable.ts`.
- **Resolved when:** `check_roadmap_trackable` exits 0 and the choice is
  recorded in this roadmap with one sentence of reasoning.

### blocker: release-integrity-blockers
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 3 — the roadmap that cannot archive
- **What to do:**
  1. Read the three open blockers in
     `agents/roadmaps/road-to-inbox-harvest-2026-08-b-release-integrity.md`:
     `release-head-cadence-decision`, `carrier-install-paths-decision`,
     `adr-221-acceptance`.
  2. For each, either record the decision in that roadmap and flip
     `Status: resolved`, or state that it is not decidable yet — in which case
     the roadmap moves to `agents/roadmaps/later/` instead of archive.
- **Resolved when:** all three read `Status: resolved`, or the roadmap has been
  moved to `later/` with the reason recorded.

### blocker: ci-reachability-decision
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 4 — close the class, or state why it stays open
- **Observed 2026-08-13, a two-gate contradiction worth folding into the choice:**
  `archive_completed_roadmaps.ts:151` treats `agents/evidence/` as a
  `_FROZEN_RECORD_PREFIXES` entry and deliberately does **not** migrate roadmap
  references inside a committed record, after one such rewrite corrupted a
  hash-bound reviewer prompt. `check_references` requires those same references
  to resolve. So every roadmap archived while an evidence record cites it emits a
  red that only a hand-placed `<!-- ref-ignore -->` inside the frozen prefix can
  clear — one occurred in this PR
  (`agents/evidence/reviews/active-remediation-no-open-errors.findings.md`). The
  two gates disagree on ownership; neither is wrong on its own terms. Recorded,
  not repaired.
- **What to do:**
  1. The denominator is measured and is **167 of 247 local gates (68 %)**, not
     the four this roadmap opened with. None of the 167 has a recorded reason in
     either direction, because the checker that would have asked never reported
     them. Two `local_only` declarations exist; the other 165 have none.
  2. Choose: wire the local-only gates into an existing workflow · add one
     aggregate job for the remainder · accept the gap explicitly and name a
     cadence for checking trunk state · or keep the shrink-only baseline as the
     standing answer and drain it opportunistically.
  3. Note what the baseline already buys, so the choice is not overstated: a NEW
     gate registered in `task ci` with no workflow now reds. What it does not
     buy is remote reach — `check_ci_local_parity` runs in no workflow either, so
     the ratchet fires only in a local `task ci`. Wiring **that one gate** into a
     workflow is the smallest change that would give the whole mechanism teeth,
     and it is a legitimate answer on its own.
  4. Record the choice where its scope fits — an ADR for the wiring options, a
     paragraph in `docs/contracts/ci-green-floor.md` for the accept option.
  5. **Added 2026-08-13 — the same decision now also owns a live red.** The
     repair dropped `check_ci_local_parity`'s scanned population from 443 to
     **357** (107 CI + 250 local), below its `min_scanned: 380` floor, so
     `check_gate_coverage` reds on it while the parity gate itself exits 0. The
     floor and its `corpus:` line still describe the pre-repair population.
     Three answers, and they are not equivalent: **(a)** re-anchor the floor to
     the measured 357 with a stated margin and rewrite the `corpus:` line —
     cheapest, and a floor re-anchor is a weakening that should be argued rather
     than typed; **(b)** wire `check_ci_local_parity` into a workflow, which
     § 3 already names as the smallest change that gives the mechanism teeth and
     which makes the floor remotely meaningful for the first time; **(c)** drain
     enough of the 167 that the CI-side count rises back over the floor on its
     own, which is the only answer that fixes the floor by fixing the thing the
     floor measures. Whichever is chosen, the `corpus:` description is stale
     either way and needs the same edit.
- **Resolved when:** the decision exists in a tracked artefact and Phase 4
  step 2 can cite it, **and** the `check_ci_local_parity` floor red of § 5 is
  either cleared or carries a recorded, argued disposition. The second half is
  explicit because without it this roadmap can reach `count_open == 0` and
  archive while a gate it opened is still red — which is the exact failure the
  whole file is about, committed by the file itself.
- **Note:** an AI council was asked to adjudicate this and was unreachable
  (anthropic quota-exhausted, openai trusted-directory refusal, two attempts).
  The staged baseline was chosen without it, on the ground that it is the only
  option adding no unfixable block. It is not a council verdict and does not
  foreclose the others.
