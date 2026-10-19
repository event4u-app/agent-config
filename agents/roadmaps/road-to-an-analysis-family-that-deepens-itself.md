---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-s verified at 085ec41ff that the practised analysis pipeline (independent analysts, three deepening loops each, an exchange that deepens three more times, a gain-gated extra round, a final inbox pass landing ready roadmaps, a ready PR) exists nowhere in the tree: no analyze command resolves its scope, the four exchange instruments in src/scripts/ai_council/ have zero production callers, analyze:inbox forbids the PR every round ends in, and a module without a marker resolves to the repository root (reproduced on a fixture). No active, parked or stub roadmap owns this: agent-config roadmap:context reports no sibling on the topic across 1,069 roadmap files, and a grep for repo-loop over agents/roadmaps and src returns nothing. This is the third arrival of the subject (inbox-2026-09-r, inbox-2026-09-aa, inbox-2026-10-s) and the first with an explicit owner order to build it; folding it into a neighbour would bury a four-command surface change inside a roadmap that owns a different defect."
estate_growth_exempt: "Authorises exactly two dimensions for this change: active_roadmaps +1 (this file, the only landing of a subject arriving for the third time, ordered by the owner on 2026-10-15) and open_blockers +2 (source-fetch-authorization and analyst-cli-agency). Both blockers are owner-reserved trust boundaries a council cannot clear: the first restates a fetch decision the parked observation roadmap already records as the maintainer's alone, the second widens the agency of binaries the council doctrine defines as oracles. Each blocks one deferred step only (4.2b, 2.4b); every other step, including the read-only first slice, runs without them."
relates:
  - slug: road-to-a-retro-the-merge-runs
    relation: extends
    note: "Step 6.4 adds one unit kind (`analysis-run`) to that file's fact readers. Triage, the one-learning-per-unit rule and every target stay the retro's; this file only produces the run record."
  - slug: later/road-to-an-intake-the-queue-can-carry
    relation: disjoint
    note: "Step 3.1 applies that file's owner-first landing rule (a finding with an owner lands as a step plus an `Arrivals:` line) by hand until that file ships it as a gate; nothing here re-plans it."
  - slug: road-to-steps-the-skill-cannot-skip
    relation: disjoint
    note: "Once its step engine ships, analyze:inbox (1,215 lines of instruction-only prose) is a candidate to split onto it. Not planned here."
  - slug: road-to-agent-throughput-recovery
    relation: disjoint
    note: "A pending revision of that file proposes that a new inbox roadmap lands `draft` above N ready-at-0-done roadmaps (its E3, owner-reserved, undecided). The owner's directive of 2026-10-15 (always `ready`) binds here; D4 records the collision and the owner-first landing that caps growth instead."
  - slug: road-to-first-reference-analysis-observation
    relation: extends
    note: "later/. Step 6.5 offers the first two source-door runs as that file's observation runs; blocker `source-fetch-authorization` restates the fetch question its entry condition already waits on, it does not answer it."
  - slug: road-to-self-modification-that-a-council-must-pass
    relation: disjoint
    note: "A run on this package that proposes a governing change still lands through that file's council verdict."
---
# Road to an analysis family that deepens itself

> **Source:** `agents/tmp.old/inbox-2026-10-s/` — the owner's transcript of
> 2026-10-15 (binding), two seed plans and two exchange-round plans from three
> separate sessions, and one two-seat council review of an earlier revision
> (all proposals; Source A = one outside session's seed and exchange final,
> Source B = a second outside seed, Source C = this host's exchange output).
> Verified claim by claim against `085ec41ff` on 2026-10-15;
> the plans were drafted against `0c2abb297`, and of the five commits between,
> only `26dd1905e` and `7c728f35b` touch this family (`analyze/repo` § 2b).
>
> **Arrivals:** 3 — latest `inbox-2026-10-s` (2026-10-15); earlier:
> `inbox-2026-09-aa` (declined: "a naming the owner stated wanting, not a
> defect"), `inbox-2026-09-r` (proposal not adoptable as written). What broke:
> both read a wish without a defect; the tree shows the defects (§ Context).

**Owner directives, 2026-10-15** (paraphrased from the transcript, binding):
(a) four commands — `analyze:inbox` as today with an optimised flow; a command
that analyses *other* repositories or projects and improves the one it runs in
(a better name than `analyze:repo` welcome); `analyze:and-optimize` for the
current project, repository or module; `analyze:pr` running the same loops and
councils on an existing PR, feedback by default and `--optimize` to apply;
(b) the target is found from a subfolder — walk up to the `agents/` folder or
detect the project otherwise — **unless we are inside a module**; (c) the
practised run: analyse → plan → roadmap, deepen against the plan three times, two
other analysts in parallel, then each receives the others' analysis and plan and
deepens three more times; (d) one more exchange only when it is worth it — judged
first (the council welcome), then the owner is asked whether and by how much the
analysis could still improve; (e) a final `analyze:inbox` pass honours every
instruction and piece of information from the earlier analyses and chats and
writes the roadmaps that are really executed, **always `status: ready`, never
draft**; (f) then a PR with exactly those roadmaps, **marked ready**; (g) the
purpose is that any project improves from foreign repositories or projects — new
features, better existing code — not only this package; (h) combine with the
retro where it makes sense; (i) the hand prompt is optimised, research on the web
included.

## Goal

One engine behind four commands. From any directory of this repository, a
consumer fixture project or a module in either, one invocation resolves and
prints its scope, runs independent analysts through three lens loops each, an
exchange that re-verifies foreign claims and deepens three more times, a council
over what stays contested, an evidence-based offer of one more round, and a final
inbox pass landing validated `ready` roadmaps in a non-draft PR (`analyze:pr`: a
verdict). Every loop is capped, every run leaves a `run.json` the retro reads.

## Context — what the tree shows at `085ec41ff`

Findings F1–F18, each with its anchor, moved verbatim to `agents/evidence/analysis/analysis-family-context-and-sources-085ec41ff.md`.

## Phase 1 — Decide the shape before building it

- [x] **1.1 Name the foreign-source door — the council decides.** Candidates:
      `analyze:source` (Source A), `analyze:harvest` (Sources B, C — the tree
      says harvest: `harvest_reference_tokens`, `provenance/harvests.jsonl`),
      keep `analyze:repo`. New evidence: "harvester" already names
      `analyze:roadmap-repos`' role (`archive/road-to-bounded-reference-harvest-loop.md`),
      so `harvest` collides with the command feeding this one. `analyze:repo`
      and `analyze:reference-repo` stay `replaces:` aliases. Reversible-internal.
      verify: `agents/evidence/council/analysis-family-naming.md` exists and names
      the chosen door, and step 1.2's ADR cites it. Done 2026-10-18: the council
      (2/2 seats, peer review, $0) converged on a fourth name, `analyze:reference`;
      ADR-288 D1 cites the record.
- [x] **1.2 One ADR for the family.** Records: the four doors (the foreign-source
      door per 1.1; `optimize:deep` renamed `analyze:and-optimize` with an alias;
      `analyze:pr` new; `analyze:inbox` as the final stage); the analyst class
      beside council member and implementer (D3); rounds under
      `agents/runtime/analysis/<round-id>/` (D9); the second chaining exception —
      a door invokes stages, never another door; the changed default end state
      (ready PR, `--mode=plan` and `--no-pr` stop after validation without a
      push — an explicit contract change, not a silent one); the push model
      (D7); the owner's fetch and analyst-agency answers (D17); ADR-118 conformance — every loop, round and fix cycle carries a
      numeric cap in the door's `limits:` block, no run-until-condition; no
      `docs/contracts/` loop contract (D10). Alternatives: keep the optimize
      cluster; one monolithic `/analyze`.
      verify: `./scripts-run src/scripts/check_adr_frontmatter` -> 0 — and one
      new file under `docs/decisions/` reads `status: accepted` and names all
      four doors. Done 2026-10-18:
      `docs/decisions/ADR-288-analysis-family-one-engine-four-doors.md`, both
      owner answers recorded as D7 and D8.
- [x] **1.3 The context file.** `src/agent-src/contexts/execution/analysis-loop.md`,
      loaded on demand (0 standing tokens): vocabulary (*pass* is an inbox
      extraction read, *loop* a deepening iteration, *round* one exchange); the
      brief lifecycle (frozen after scope resolution and at most one blocking
      scope question; a mid-run owner message opens a new brief revision,
      recorded); the loop shape (`Loop N/M — lens — falsifiable goal — inputs —
      must produce — stop-if`); the lenses of 2.3 and 2.5; evidence tiers
      (`executed`, `read`, `claimed`, `inferred` — only the first two count for
      stopping or "verified"); council roles (seat, synthesizer, gate judge;
      quorum two seats from two providers, else `single-voice`); the `handoff-v1`
      shape for external analysts (frontmatter `handoff: v1`, `phase`, `loop`,
      `pin`, `consolidates:` — the key `lint_consolidation_lineage` reads;
      sections Findings vs tree · Kills · Decisions · Steps with `verify:` · Loop
      log; source names only in an `*.annex.md`).
      verify: `./scripts-run src/scripts/check_references` -> 0 — and each of the
      four door files links the context file. Done 2026-10-19: `analyze:pr`
      (5.2) links it as the fourth door, beside `analyze:repo`, `analyze:inbox`
      and `analyze:and-optimize`; `check_references` -> 0.
- [x] **1.4 Pre-register before any code.** In the ADR of 1.2: the metric per
      door, always a count of decidable items — source door: rows anchored on
      both sides (today's `analyze/repo` metric); and-optimize: steps with a
      verified anchor and a falsifiable exit; pr: findings with a diff anchor and
      a reproduction or test; inbox: points discharged per the inbox's own
      ledger. Also the default analyst count (3), the gain rule of 2.6, the
      per-round token ceiling, the large-round slicing size, a fixture set of at
      least ten frozen inputs (this round's `agents/tmp.old/inbox-2026-10-s/`
      among them), and the falsification rule: a default whose stage moves the
      metric by zero on more than half of the first ten runs is lowered.
      verify: `grep -c 'falsification' docs/decisions/ADR-*analysis-family*.md` -> /[1-9]/
      ≥ 1 and the ADR names a metric for each of the four doors. Done 2026-10-18
      in ADR-288 D9. The 40-file small-scope size and the 1,500,000-token round
      ceiling are stated defaults under its Assumptions, not measurements; the
      slicing size is the inbox's own measured 400 KB / 5-topic threshold.

**Exit:** ADR accepted, council record present, context file linked. **Rollback:**
the ADR moves to `superseded`; nothing else exists yet.

## Phase 2 — The run core

- [x] **2.1 Scope from wherever the user stands (directive b).**
      `src/scripts/analysis_target.ts` returns `{project_root, scope_root,
      scope_kind: repo|module|subdir, anchor, vcs, ac_installed}` and every door
      prints it first: `Scope: <kind> <name> at <path> (anchor: <…>)`. It
      composes the existing walk and leaves `find_project_root` untouched (the
      settings cascade depends on it). Precedence: (1) `--project` /
      `AGENT_CONFIG_PROJECT_ROOT` fix `project_root`, `--scope` fixes
      `scope_root` and must lie inside it, `--scope=repo` widens; (2) a cwd
      inside a module from the outer root's `modules:` config
      (`enumerate_modules`, wins on conflict) or a `high` `detect_module_roots` candidate →
      `module`, with or without a marker in the module's `agents/`, and
      `project_root` stays the outer root; (3) otherwise `repo` at the root,
      `subdir` below it; (4) a nested `.git` below the outer root is a boundary
      (submodule = its own scope); symlinks resolve first and a resolved path
      outside `project_root` is refused; detached HEAD or an empty repository
      has no PR target; no git → `vcs: none`, which disables only 3.3.
      `corrected-from-reproduction`: with `agents/roadmaps/` in the module the
      walk returns the module *as the project*, so the outer walk is needed in
      both module cases, not only the unmarked one.
      verify: `npx vitest run tests/scripts/analysis_target.test.ts` -> 0 — covers root,
      subdir, module with and without its own `agents/roadmaps/`, `--scope`
      outside the root, submodule, symlink escape, detached HEAD, no git and no
      AC install — seen red with the outer walk removed. Done 2026-10-16; doors print it once wired (AC-1 open).
- [x] **2.2 Run core in code.** `src/scripts/analysis_run.ts`: run id; persisted
      states `initialized → pinned → seeded → deepened → exchanged → judged →
      awaiting-decision → emitted → validated → committed → pushed → pr-open →
      ci-settled → done`, plus `handed-back` from any state; legal transitions
      only, atomic writes; resume after re-validating every pin (a moved head is reported, never
      silently continued); an idempotency key per publication (run id + path set
      + base SHA); a token budget whose cap ends in `handed-back`;
      `schema_version` on every artifact, unknown major refused. State under the
      gitignored `agents/runtime/analysis/<round-id>/` (no continuity row).
      verify: `npx vitest run tests/scripts/analysis_run.test.ts` -> 0 — resumes a run
      killed in `emitted` without re-emitting, reports a moved head on resume,
      refuses an illegal transition, and stops at the budget cap in
      `handed-back`. Done 2026-10-16 (resume and budget cases seen red).
- [x] **2.3 Lenses and the loop ledger (directive c).** Each analyst runs seed +
      three loops, each over its analysis **and** its roadmap: **Coverage** (what
      is there; code, not the README; what is wrongly marked missing),
      **Adversary** (every retained item tested against named counter-hypotheses
      — already present, contradicts a recorded decision, only different, cost,
      license — killing nothing is legal when every test is recorded),
      **Overbuild & sequencing** (smallest rung, duplicates folded, order). Each
      loop appends a ledger row: lens, added / changed / killed items, each with
      an evidence object (source identity and digest, method, claim supported or
      refuted, tier). A loop with no `executed` or `read` evidence tied to a
      changed conclusion is `no-external-signal` and does not count. All three
      lenses always run; loops 4–5 (`--loops`, cap 5) run only while the previous
      loop added a top-tier item; the summary prints the real count.
      verify: `npx vitest run tests/scripts/analysis_ledger.test.ts` -> 0 — rejects a
      loop without top-tier evidence, never stops before the three lenses ran,
      and stops loop 4 after a plateaued loop 3. Done 2026-10-16 (seen red).
- [x] **2.4 The analyst class (directive c).** Reads the scope (the web once
      `source-fetch-authorization` allows), writes only into its own round
      folder, never runs project scripts, never pushes. Modes: `subagent` (same
      family, fresh context) and `external` (a `handoff-v1` file the owner drops
      into `agents/tmp/<round-id>/` — today's practice). Every
      analyst gets the same brief; outputs carry family and `context_relation`
      from `src/scripts/_lib/review_independence.ts`; no seed or deepen output
      sees another analyst's; a same-family analyst is never stamped
      cross-family. Default 3 analysts; `--quick` or a scope under the
      pre-registered size runs 1 analyst and no exchange.
      verify: a fixture round with two `subagent` analysts and one `external`
      drop yields three independence-stamped outputs with identical brief
      digests, none referencing another before the exchange; a `--quick` run
      records one analyst and no exchange. Done 2026-10-17 in `src/scripts/analysis_analysts.ts` (consulted and unknown-family cases seen red); `--quick` and the size threshold are inputs, the threshold value waits on 1.4.
- [x] **2.4b `cli:<provider>` analysts.** Cross-family read-only analysts reusing
      the council's binaries under a separate analyst bound in
      `cli_agency_bounds.ts`.
      verify: a probed binary runs a fixture analysis read-only and its output is
      stamped `cross-family`. Done 2026-10-18: `ANALYST_BOUNDS` in
      `cli_agency_bounds.ts` beside the unchanged seat bounds, `cli` mode and
      `cliAnalystCommand` in `analysis_analysts.ts` (seen red). Live probe
      `agents/evidence/analysis/analyst-cli-profile-probe-2026-10-18.md`: claude
      and codex read the fixture and refused the sentinel; gemini drops its
      bound in an untrusted folder and is refused.
- [x] **2.5 Exchange that deepens instead of agreeing (directive c).** Each
      analyst receives the others' final analysis and roadmap, relabelled A/B/C,
      and runs three reconcile loops: **Inventory** (every foreign claim checked
      at the pin — `still-true / never-true / unverifiable`, with tier),
      **Cross-exam** (`selectCrossExamTarget` picks the disputed claims; the
      prompt quotes each verbatim), **Converge** (own roadmap revised with a
      disagreement ledger). Facts are settled by the tree, never by majority; the
      synthesis passes `auditMinorityRetention` — a minority finding is accepted
      or rejected with a reason, never dropped.
      verify: a fixture exchange records the cross-exam targets verbatim, a
      disagreement ledger per analyst and a minority audit with zero silent
      drops. Done 2026-10-17 in `src/scripts/analysis_exchange.ts` (tier settlement and silent-drop cases seen red).
- [x] **2.6 Council as judge, then the gain gate (directive d).** The council
      receives the converged outputs (host unmarked, `council run --input-mode
      roadmap --peer-review`, prompts stored beside the verdict) and judges only
      what stays contested: priorities, integration risk, judgement calls.
      Conflicts resolve by tier; equal-tier contradictions stay named; on safety
      or data-integrity questions a critical dissent outweighs a majority; a
      failed seat degrades to `single-voice`, said. Then `evaluateStop`
      (anti-conformity repair before the cost stop) and `scoreNextCall` on the
      disagreement ledger, as an estimate. Until 6.6 calibrates it, one more
      round is offered only when a named open conflict or a high-impact
      `claimed`-tier item has an executable verification plan inside the
      remaining budget. The council decides first; on a split, or above the
      ceiling, the owner gets **one** question — items it would settle, cost, a
      gain band (low / medium / high with reasons, no uncalibrated percentage),
      options *one more / focused on the named items / stop*. Cap: three rounds.
      verify: ledger fixtures — plateaued, conflict with a plan, conflict without
      a plan, exhausted arguments — produce no offer, one offer, no offer, no
      offer; a one-seat fixture is labelled `single-voice`. Done 2026-10-17 in `src/scripts/analysis_gate.ts` (exhausted and critical-dissent cases seen red); the gate composes the instruments, the council call itself stays with the doors. Open owner question (council test review of PR #2432, 2026-10-17, both seats): the gate withholds a round when `evaluateStop` says the arguments are exhausted and reports no saved call or saved cost for it; whether a withheld round counts as a saved call, and where that figure is reported, is owner policy and is not decided here. The early-stop savings test pins today's behaviour and no longer claims savings are zero. The same review fixed three gate defects: the round cap is checked before the predicate, settleable items must fit the remaining budget together, and a conflict with no sides is refused.
- [x] **2.7 Questions: council first, owner once.** Each question is classified
      (`ai-council` classes): council-decidable → council; owner-reserved
      pre-action (gates a push, a destructive step, an unauthorised fetch, a
      Hard-Floor trigger) → asked before that action, alone; owner-reserved
      post-action → one batch at the end with a recommendation each, while the
      run continues on everything unblocked.
      verify: a fixture question set routes council-decidable items to the
      council, asks the pre-action item before the push, batches the rest. Done 2026-10-17 in `src/scripts/analysis_questions.ts`, routing by the ownership classes of `ai_council/ownership_classes.ts` (seen red).

**Exit:** 2.1–2.7 green on fixtures, read-only, no network. **Rollback:** the
two new scripts and the context file are additive; deleting them restores today.

## Phase 3 — The final stage: emit, validate, publish, and `analyze:inbox`

- [x] **3.1 Emit locally (directive e).** Roadmaps via `roadmap-writing`,
      `status: ready` (`draft` above the D18 intake limit, said in one line); blocked work stays `ready` with a body `> Blocked until …`
      note (`src/skills/roadmap-writing/SKILL.md:250-251`); English per
      `language-and-tone`; `relates:` with slug and relation; `ENC1:`
      provenance; recurrence via the inbox's Phase 4c and its `Arrivals:` line;
      **owner-first** — a finding with an existing owner lands as a step plus an
      `Arrivals:` line there, and a run producing more than one new file lands
      one central roadmap with the rest as phases and states its estate delta
      (D4). Output per door: inbox, source, and-optimize → roadmaps; pr → a
      verdict.
      verify: an emitter fixture produces `ready` roadmaps, an `Arrivals:` line
      on an owned fixture finding, and one central roadmap for a multi-file run. Done 2026-10-17 in `src/scripts/analysis_emit.ts` (owner-first and intake-limit cases seen red); `ENC1:` provenance, Phase 4c recurrence and the `pr` verdict stay with the door wiring of 3.4 and 5.2.
- [x] **3.2 Validate deterministically, before anything leaves the machine.**
      Every claim carries an anchor and a tier; every step a `verify:` line;
      dissent present when the council recorded any; the emitted files pass
      `lint_roadmap_complexity`, `lint_roadmap_blockers`,
      `lint_plan_risk_register`, `check_references` and `check_estate_count`;
      fixture findings recovered without invented ones. A failure stops the run
      in `emitted`. No model judge is the gate (K9).
      verify: a fixture with one unanchored claim and one step without `verify:`
      stops in `emitted` naming both. Done 2026-10-17 in `src/scripts/analysis_validate.ts` (seen red); the complexity and risk-register gates run on the emitted file itself, the other three read this package's tree.
- [x] **3.3 Publish (directive f).** Worktree, opaque branch, chunked commits,
      `/create-pr :ready` — never the silent-draft default — then `ci_settle`,
      at most three fix rounds, then `handed-back` naming the red. Before every
      push the staged path set must lie inside the allowed set (the emitted
      roadmaps, the dashboard regenerated for them, CI fixes inside those
      files); anything else stops publication. Push model per D7. PR body: point
      ledger, coverage ledger, open decisions. Never a merge.
      verify: a publication fixture refuses a staged file outside the allowed
      set, a re-run opens no second PR, a fourth red CI round ends in
      `handed-back`, and the opened PR reads `isDraft: false` in
      `gh pr view --json isDraft`. Done 2026-10-18; record: `agents/evidence/analysis/analysis-family-step-records.md` § 3.3.
- [x] **3.4 `analyze:inbox` becomes the final stage.** Replace the
      branch/worktree/PR ban (`analyze/inbox/command.md:47-72`) with the
      engine's publish step — default on when `vcs: git`, `--no-pr` to skip. The
      command reads a runtime round (`agents/runtime/analysis/<round-id>/`) plus
      the owner's drops under `agents/tmp/<round-id>/` as one union, skips the
      Phase 1 rename for opaque ids, and reads lineage from the round manifest.
      Directives by provenance: current-session user turns bind; user turns of a
      structurally valid transcript bind unless another input contradicts them;
      heuristically recovered roles never bind automatically (a material one
      joins 2.7's batch); AI turns are claims. One final Convergence loop runs
      over the surviving roadmaps against the tree, every transcript constraint
      and every owner directive. A round above 1.4's slicing size runs as
      parallel lanes, **each with its own census and point ledger**, folded once
      — the owner never types the split. `corrected-from-reproduction`: the plans
      sliced without per-lane ledgers, the shape the inbox's Phase 2b measured
      as the lossiest.
      verify: `grep -c 'NEVER CREATE A BRANCH'
      src/domains/analysis-workbench/analyze/inbox/command.md` is 0 (1 today);
      `analyze/inbox/evals/triggers.json` holds a `--no-pr` case; the final
      loop's ledger row names every directive it checked. Done 2026-10-19; record: `agents/evidence/analysis/analysis-family-step-records.md` § 3.4.
- [ ] **3.5 First slice: a read-only replay.** Before 3.3 is enabled, replay
      `agents/tmp.old/inbox-2026-10-s/` (three topic folders, one of them seven
      files) with `--no-pr`, no network and `subagent` analysts — the first slice
      both council seats converged on. `corrected-from-reproduction`: the plans
      named a replay target by a speaking folder absent from `agents/tmp.old/`.
      verify: the replay ends in `validated` with zero remote calls in the run
      log, a lineage table naming every input file, and at most three roadmaps
      per topic. *Open 2026-10-19: every stage it exercises now exists and the
      inbox reads a round union (3.4), but the replay is a model-driven run —
      three `subagent` analysts with seed, three lenses and an exchange over a
      452 KB round that lives only in the maintainer's local `agents/tmp.old/`
      — and needs its own session, not a drain lane.*

**Exit:** a replayed round lands validated `ready` roadmaps locally; 3.3 green on
a fixture remote. **Rollback:** revert 3.4's command edit; the inbox returns to
today's analysis-only behaviour.

## Phase 4 — The source door and `analyze:and-optimize`

- [x] **4.1 Claim pin, not claim freeze.** The five mechanisms named in
      `reference-loop-upgrade-value` (`docs/CLAIMS.md:497`) are not byte-identical
      to their registration (F15). Record the pin of the command as it stands
      when this phase starts, list the post-registration edits (`f1d5f3f3a`,
      `26dd1905e`, `7c728f35b`) as known deltas in
      `agents/roadmaps/later/road-to-first-reference-analysis-observation.md`,
      and keep 4.2–4.5 outside the five mechanisms' sections from that pin on.
      `corrected-from-reproduction`: the plans' verify
      (`git diff <claim-pin>..HEAD`) named no pin, and a pin from registration
      would already fail.
      verify: `git diff <recorded-pin>..HEAD --
      src/domains/analysis-workbench/analyze/repo/command.md` shows no hunk
      inside § 1b, § 2b, the interop probe, the convergence verdict or the
      bound-claim gate, and the observation roadmap names the three commits. Done 2026-10-17: pin `835660b0d` recorded in the observation roadmap. `corrected-from-reproduction`: the file moved in five commits since registration, not three — `8488bf078` and `386266422` are listed too.
- [x] **4.2 Local source adapters.** Local path (read in place, digest per
      file), archive (size cap, no `../`, no symlink out), an already-present
      local clone (pinned SHA, never executed) — each yielding one `SourceRef`
      (identity, kind, license, pin, digest, tier). Unsupported kinds fail with a
      diagnostic naming blocker `source-fetch-authorization`.
      verify: `npx vitest run tests/scripts/source_adapters.test.ts` -> 0 — pins each
      local kind, refuses an archive with a `../` entry, and fails a URL argument
      with the blocker's name. Done 2026-10-17 in `src/scripts/source_adapters.ts` (`../` and symlink refusals seen red).
- [x] **4.2b Network sources and the research step.** Repositories at depth 1 to
      a pinned SHA, URLs and articles (redirect and size caps, digest plus quoted
      anchor), and the research brief (code not README, other repositories,
      links, posts, the web); sources coded S1, S2, …, identity only as `ENC1:`
      in `intake.md`.
      verify: a connected fixture run's ledger carries one coded web row and no
      source name in any tracked output; a `--no-network` run completes labelled
      degraded. Done 2026-10-18; record: `agents/evidence/analysis/analysis-family-step-records.md` § 4.2b.
- [x] **4.3 Anchor profiles — defects and opportunities (directive g).** The
      anchor table reads what the scope has, in order: failing or skipped tests,
      open issues (`gh` when present), TODO/FIXME census, roadmaps, ADRs,
      `docs/CLAIMS.md` — this package's profile stays today's. None → feature
      mode, anchored on `--goal "…"`. Rows are typed `defect | capability_gap |
      product_opportunity | maintainability | security | performance`, never an
      opportunity as a defect; axes come from the stack `project-analysis-core`
      detects. The doors add the `engineering` workspace and stay
      `visibility: internal` (F17).
      verify: a run against a consumer fixture without `docs/CLAIMS.md` produces
      a non-empty typed anchor table or states feature mode, and
      `./scripts-run src/scripts/lint_framework_leakage` passes on the door files. Done 2026-10-18; record: `agents/evidence/analysis/analysis-family-step-records.md` § 4.3.
- [x] **4.4 Several sources, one gap one roadmap; prompts for external
      analysts (directive i).** `<door> <a> <b> …` runs one lane per source and
      folds so one gap is one roadmap; `analyze:roadmap-repos` keeps dispatching
      into the door. `--emit-prompts` prints the analyst brief and the exchange
      prompt with the `handoff-v1` shape embedded — the optimised hand prompt for
      sessions outside this host, replacing the re-typed one.
      verify: a two-source fixture yields one roadmap for a shared gap, and
      `--emit-prompts` output contains the `handoff: v1` frontmatter block and
      all three lens questions. Done 2026-10-18; record: `agents/evidence/analysis/analysis-family-step-records.md` § 4.4.
- [x] **4.5 `analyze:and-optimize` (directive a).** `optimize:deep` moves to
      `analyze/and-optimize/` with `replaces: [optimize-deep, optimize:deep]`;
      its `limits:` block and `tests/scripts/optimize_deep_limits.test.ts` carry
      over unchanged. Its steps are then re-expressed over 2.1–3.3, with the
      scope of 2.1 replacing its undefined `--scope`, and an analysis that reads
      code, not only roadmaps and ADRs. `optimize:project` and `project:analyze`
      stay as they are (D11).
      verify: the carried limits test passes at the new path, `optimize:deep`
      still resolves in the projected tree after `task generate-tools`, and in a
      module fixture every reader's path lies under the module root. Done 2026-10-19; record: `agents/evidence/analysis/analysis-family-step-records.md` § 4.5.

**Exit:** the source door and and-optimize complete a fixture run each from a
subfolder and from a module. **Rollback:** the `replaces:` aliases keep the old
names; revert the move and the aliases.

## Phase 5 — `analyze:pr`

- [x] **5.1 Find the PR (directive a).** Argument (URL or number), else the
      current branch's open PR (`gh pr view`), else the PR the conversation
      already named, else one question; zero or several candidates → ask for
      the link. Base and head SHAs pinned.
      verify: argument, branch and conversation fixtures resolve without a
      question; an ambiguous fixture asks once. Done 2026-10-18 in
      `src/scripts/analysis_pr_target.ts` (several-candidates case seen red); a
      named PR that is not open asks instead of falling through to the branch.
- [x] **5.2 Feedback by default, read-only.** PR head in a throwaway worktree;
      the PR body is a claim set (inbox Phase 4); `review:changes` judges on
      `base..head`, then 2.3–2.6, `council:pr` as seat runner, a disprove pass
      by a different model per finding, a confidence threshold, dedupe. Verdict
      per finding: severity · `file:line` · claim · evidence · fix · confidence ·
      introduced here or pre-existing. `--comment` posts; default posts nothing.
      verify: a fixture PR with a planted defect reports it with `file:line`; a
      clean fixture reports "no finding above threshold" and makes no `gh`
      write call. Done 2026-10-19; record: `agents/evidence/analysis/analysis-family-step-records.md` § 5.2.
- [x] **5.3 `--optimize` (directive a).** Eligibility first: PR open, head branch
      writable, not a fork — otherwise a patch file plus the verdict. Each fix
      records one test disposition (regression test seen red, existing test seen
      red, deterministic static check, or `infeasible` with a reason code the
      disprove pass reviews). Pushes per D7 with an expected-head check;
      re-review after each; stop when nothing new clears the threshold or after
      three rounds. Never merges, never approves its own changes.
      verify: a fixture PR converges in at most three rounds with one
      disposition per fix, a moved-head fixture stops before pushing, and a fork
      fixture yields a patch file. Done 2026-10-19; record: `agents/evidence/analysis/analysis-family-step-records.md` § 5.3.

**Exit:** the three fixtures above green. **Rollback:** delete the new command
file; `council:pr` is unchanged.

## Phase 6 — Router, registries, retro record and calibration

- [x] **6.1 Router.** `analyze/command.md` gains keyword rows and menu entries
      for inbox, conformance, roadmap-repos, the source door, and-optimize and
      pr; the escape lists every `routes_to` entry, counted from `routes_to`
      rather than written as a number.
      verify: the dispatcher's eval set routes one prompt per `routes_to` entry
      to that entry. Done 2026-10-19; record: `agents/evidence/analysis/analysis-family-step-records.md` § 6.1.
- [x] **6.2 Registries and references.** `docs/contracts/command-clusters.md`,
      `src/flows/surface-map.yaml`, `docs/command-flows.md`, `docs/catalog.md`,
      the analysis-workbench and meta READMEs, `pack.yaml`, the evals, both
      limits tests, and every skill or rule naming `analyze-repo` or
      `optimize-deep`.
      verify: `./scripts-run src/scripts/check_references` -> 0 — and
      `grep -rn 'optimize:deep' src docs | grep -v replaces` returns only alias
      lines. Done 2026-10-19; record: `agents/evidence/analysis/analysis-family-step-records.md` § 6.2.
- [ ] **6.2b The foreign-source door takes its decided name.** ADR-288 D1 names
      it `analyze:reference`; it still ships as `analyze-repo` (the skills and
      the `external-reference-deep-dive` rule name it correctly today). Moving
      `analyze/repo/command.md` moves the file whose five mechanisms carry the
      pre-registered claim pinned in 4.1, so the rename waits on that claim's
      owner: either the observation roadmap records the move as a known delta,
      or the rename lands after the observation runs.
      verify: `analyze/reference/command.md` exists with `replaces:` carrying
      `analyze-repo`, `analyze:repo`, `analyze-reference-repo` and
      `analyze:reference-repo`, and the observation roadmap names the move. *Council 2026-10-19 split (D19): owner decision.*
- [x] **6.3 Run record.** `run.json` per round: per stage, analyst, loop and
      exchange — top-tier items added / changed / killed, `already-fixed` rate,
      gain estimate, seats used and failed, roadmaps emitted, recurrence hits,
      tokens, wall-clock; question and CI-round counts via `probe_turnaround`.
      verify: after a fixture run `run.json` validates against its schema and
      carries one row per analyst and loop. Done 2026-10-18; record: `agents/evidence/analysis/analysis-family-step-records.md` § 6.3.
- [x] **6.4 Retro unit `analysis-run` (directive h).** Add the unit kind as a
      step plus an `Arrivals:` line to `road-to-a-retro-the-merge-runs` Phase 1
      (owner-first): its fact reader reads `run.json` and reports adoption (done
      vs cancelled steps of the run's archived roadmaps) per run, source and
      analyst. Offering `analyze:and-optimize --scope=<area>` at three
      recurrences on one area stays off by default.
      verify: `grep -c 'analysis-run' agents/roadmaps/road-to-a-retro-the-merge-runs.md` -> /[1-9]/
      ≥ 1 and the added step names `run.json`. Done 2026-10-18: the retro carries it
      as step 1.5 with an `Arrivals:` line; its fact reader is that file's to build.
- [ ] **6.5 Observation slots.** Offer the first two source-door runs on this
      repository as the observation runs of `reference-loop-upgrade-value`, with
      the shadow arm its protocol requires — or decline, recorded.
      verify: `agents/roadmaps/later/road-to-first-reference-analysis-observation.md`
      records the offer and its answer. *Council 2026-10-19 split (D19): owner decision.*
- [ ] **6.6 Calibrate.** After ten runs, re-read analyst count, loop count, gain
      rule and slicing size from `run.json` under 1.4's falsification rule (one
      vs three analysts, one vs three loops, with and without the exchange);
      publish nulls; lower a stage that moved nothing.
      verify: the ADR of 1.2 records the ten-run reading, or states that fewer
      than ten runs exist.

**Exit:** router and registries consistent; `run.json` read by the retro.
**Rollback:** router rows are additive; revert them.

> **Screen 2026-10-18 (PR #2461).** Open and buildable, next in order: 4.5, the `analyze:pr` command (5.2, then 1.3), 3.4, 6.1, 6.2, then the 3.5 replay.
> **Screen 2026-10-19.** 1.3, 3.4, 4.5, 5.2, 5.3, 6.1 and 6.2 closed. Open: 3.5 (a model-driven replay, own session), 6.2b (rename, waits on the 4.1 claim pin).
> Gated: 6.5 waits on the observation roadmap's answer; 6.6 waits on ten recorded runs (zero exist).

## Blockers

### blocker: source-fetch-authorization
- **Status:** resolved — owner chose (a) on 2026-10-15 in reply to the PR #2373 report: an invocation naming a source authorises read-only fetches of that source plus the research step for that run; secrets and private network content stay excluded. Step 1.2's ADR records it, and the observation roadmap's `entry_condition` now says so (D17); step 4.2b is open.
- **Owner:** user
- **Ownership:** product-owned
- **Blocks:** step 4.2b only (network sources and web research); local sources, every other phase and the read-only first slice run without it
- **Question:** Does an invocation that names a source (`<door> https://…`) authorise the read-only outbound fetches and the research step of that one run? The parked observation roadmap records the fetch as "the repository maintainer alone … a Hard Floor act" after a 2026-09-07 council; the Hard Floor's external-action row (`src/rules/non-destructive-by-default.md:37`) lists send, publish, post, purchase and submit, and its approval line names a download only as an example object. The transcript asks for web research every run, but as an instruction to outside sessions, not as a decision on this record.
- **Recommendation:** (a). A read of a public source is not on the external-action row, and the invocation names the exact object the approval line asks for; secrets and private network content stay excluded.
- **If you do nothing:** only local sources run; a URL argument fails with a diagnostic naming this blocker and every result is labelled `degraded: no-network`; outside sessions keep doing the web research (`--emit-prompts`, step 4.4).
- **What to do:** pick exactly one — (a) an invocation naming a source authorises read-only fetches of that source plus the research step for that run: add one sentence to the ADR of step 1.2 and to the `entry_condition` of `agents/roadmaps/later/road-to-first-reference-analysis-observation.md`; or (b) every run asks once before its first fetch, naming the sources, under step 2.7; or (c) no fetching by the engine — research stays with `external` analysts (step 2.4).
- **Resolved when:** the ADR of step 1.2 records the option and the observation roadmap's `entry_condition` agrees with it.

### blocker: analyst-cli-agency
- **Status:** resolved — owner chose (a) on 2026-10-15 in reply to the PR #2373 report: `cli:<provider>` analysts run under a separate read-only analyst profile in `src/scripts/ai_council/cli_agency_bounds.ts`; council seats stay oracles. Step 1.2's ADR records it (D17); step 2.4b is open.
- **Owner:** user
- **Ownership:** product-owned
- **Blocks:** step 2.4b only; `subagent` and `external` analysts proceed and are stamped `same-family` honestly
- **Question:** May a cross-family CLI binary that today serves as a council seat run as an analyst with read access to the scope? `src/scripts/ai_council/cli_agency_bounds.ts:4-6` defines seats as oracles that never read, run or fetch; an analyst is a separate class, but it would reuse the same binaries with a wider grant.
- **Recommendation:** (a). Model-family diversity is the one independence lever the source set's literature supports; read-only bounds are already probed per binary, and the seat doctrine stays untouched.
- **If you do nothing:** analysts are `subagent` or `external`; cross-family analysis happens only through owner-dropped `handoff-v1` files.
- **What to do:** pick exactly one — (a) allow `cli:<provider>` analysts under a separate read-only analyst profile in `src/scripts/ai_council/cli_agency_bounds.ts`, recorded in the ADR of step 1.2; or (b) cross-family analysis only through the `external` mode; or (c) postpone until `run.json` shows whether a same-family exchange adds top-tier items (step 6.6).
- **Resolved when:** the ADR of step 1.2 records the option.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Orchestration, state and budgets in code; lenses, briefs and the handoff shape in one on-demand context file; no new skill | F18; council (both seats): a prompt file cannot guarantee resume or idempotency | the engine must trigger outside these doors |
| D2 | reversible-technical | evidence | The three lenses run once each; plateau logic applies only beyond loop 3 | council (both seats): early stop must not skip a mandatory lens | ledgers show loop 4+ regularly adds top-tier items |
| D3 | reversible-technical | evidence | Analysts are a class of their own; council seats stay oracles and judge | F7 | blocker `analyst-cli-agency` resolves to (a) — then 2.4b adds a mode, the class stays |
| D4 | product-owned | owner | Final roadmaps `ready` (blocked work `ready` + `> Blocked until`), PR non-draft; growth is capped by owner-first folding and one central roadmap per round, not by `draft` | directives (e), (f) of 2026-10-15, later than and above the undecided E3 proposal of the throughput revision | the owner adopts that E3 rule explicitly |
| D5 | reversible-technical | evidence | Council first; owner pre-action items before the action, the rest once at the end | council (both seats) on the Hard Floor; owner complaint about council-decidable questions quoted in the source set | an owner-reserved answer blocks a whole run |
| D6 | reversible-technical | evidence | Scope composes the existing walk with an outer walk; `find_project_root` untouched | F3 reproduced; the settings cascade depends on the walk | a fixture target class the composition cannot place |
| D7 | reversible-technical | evidence | One invocation authorises a bounded push sequence: only the run's own new branch (inbox, source, and-optimize) or the named writable PR branch (`--optimize`), each push after an expected-head check, at most 1 + 3 CI-fix pushes (or three fix rounds); never a merge, never another branch | `optimize:deep` Step 0 precedent (`meta/optimize/deep/command.md:115-126`); council: the earlier revision claimed two push models at once | the owner wants a confirmation per push |
| D8 | reversible-technical | evidence | First slice read-only, `subagent` analysts, no network, replayed round (3.5) before 3.3 is enabled | council (both seats) converged on the read-only inbox replay | — |
| D9 | reversible-technical | evidence | Rounds live in `agents/runtime/analysis/`; owner drops for `external` analysts in `agents/tmp/<round-id>/` | F10 | the layout contract changes |
| D10 | reversible-technical | evidence | No new loop contract under `docs/contracts/` (Source C's `analysis-loop-v1`); the spec lives in the ADR and the context file | ADR-118 rejected a loop-design contract/checklist artifact (F16); mechanism-match: this family's spec is a command contract, so it sits with the commands, not as a generic loop contract | ADR-118 is amended |
| D11 | reversible-technical | evidence | `optimize:project` and `project:analyze` are not retired here | the owner asked for four doors; the sources disagree (one plan retires both, one exchange final keeps `project:analyze` as the inventory step); minimal diff | 4.5's and-optimize covers both on their own eval fixtures |
| D12 | reversible-technical | evidence | `complexity: lightweight` | no contract's rules change (D10); `command-clusters.md` gains registry rows only (6.2); the new surfaces are commands, scripts, a context file and one ADR | a step turns out to change a contract layer |
| D13 | reversible-technical | evidence | Analyst lanes share one brief; diversity comes from model family, not from role splits | a role split makes disagreement uninterpretable (Source C, Source B agree) | `run.json` shows same-brief analysts converge on identical findings |
| D14 | destructive-owned | owner | Push and PR creation (closure-scan typed-op hits on Phase 3 and 3.3): the invocation is the this-turn confirmation of exactly the objects D7 names — the run's own branch or the named PR branch — never a merge | directive (f); the Hard Floor's "approval names the exact object"; `optimize:deep` Step 0 precedent | the owner asks for a per-push confirmation |
| D15 | spend-exhaustion | evidence | Council and analyst spend (closure-scan spend hit on 2.6) pauses and reports at the per-run budget cap of 2.2 (`handed-back`), never raises it | ADR-268 § 8 routes spend to pause-and-report | a run ends `handed-back` on budget twice in its first ten |
| D16 | deterministic | evidence | The other 23 closure-scan hits are lexical, not open decisions: `merge`/`publish` inside a slug, a kill row or a calibration step; `contradicts` inside a rule clause (2.3, 3.4); `improve` inside the owner's quoted directives and evidence rows; each AC names its command or observable state | `./scripts-run src/scripts/closure_scan` on this file, 2026-10-15 | the scan's grammar changes and a hit survives a re-read |
| D17 | product-owned | owner | Both owner blockers → (a): naming a source in the invocation authorises read-only fetches of it and the research step for that run (`source-fetch-authorization`); cross-family CLI analysts run under a separate read-only analyst profile, seat doctrine unchanged (`analyst-cli-agency`) | owner answers 2026-10-15 to the PR #2373 report | a fetch reaches private or authenticated content, or a probed binary writes outside its profile |
| D18 | product-owned | owner | Step 3.1 encodes it, and AC-5's always-`ready` landing yields to the harvest intake limit decided in `road-to-agent-throughput-recovery` D8: while more than 8 `ready` roadmaps sit at 0 ticked steps, a new inbox roadmap lands `draft` | owner answered both on 2026-10-15; the later, explicit limit narrows the transcript's standing preference | the owner lifts or changes N |
| D19 | product-owned | owner (pending) | 6.2b (rename now vs wait) and 6.5 (accept the slots conditionally vs decline) split 1:1 in the council; both seats agree a run before the shadow pin is resolved consumes no slot | `agents/evidence/council/analysis-family-rename-and-observation-slots.md` | the owner answers either question |
## Source disposition

Lineage, kill register K1–K14 and the dropped-item discharges moved verbatim to `agents/evidence/analysis/analysis-family-context-and-sources-085ec41ff.md`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Estate flood | product | Always-`ready` plus deeper analysis lands more roadmaps than are ever started | owner-first landing and one central roadmap per round (3.1, D4); adoption read by the retro (6.4) | Phase 3 — The final stage: emit, validate, publish, and `analyze:inbox` |
| 2 | Cost explosion | implementation | Three analysts × loops × exchange multiply tokens many times over a single session | `--quick` and size-based effort scaling (2.4), budget cap (2.2), plateau beyond loop 3 (2.3), gain gate (2.6) | Phase 2 — The run core |
| 3 | Agreement mistaken for convergence | product | Analysts or seats converge under conformity and drop a correct minority | facts by the tree, `evaluateStop` before the cost stop, minority audit (2.5, 2.6) | Phase 2 — The run core |
| 4 | False depth | product | Loops that re-read their own draft are counted as progress | evidence tiers; `no-external-signal` loops do not count (2.3) | Phase 2 — The run core |
| 5 | Unbounded remote mutation | implementation | Pushes or PRs repeat, hit the wrong branch or carry unexpected files | run states, idempotency key, expected-head check, allowed path set (2.2, 3.3, D7); `analyze:pr --optimize` pushes only to an open, writable, same-repository PR branch on the expected head, else a patch file, and its port has no merge (5.3) | Phase 3 — The final stage: emit, validate, publish, and `analyze:inbox` |
| 6 | Untrusted input steers the run | implementation | Source files, articles or recovered transcripts carry instructions | adapters with caps, content as data, recovered turns never bind (3.4, 4.2) | Phase 4 — The source door and `analyze:and-optimize` |
| 7 | Claim voided by engine changes | product | Editing the five claimed mechanisms after the recorded pin voids the pre-registered claim | claim pin and known-delta record (4.1), observation slots (6.5); the source door's rename waits on that pin (6.2b) | Phase 4 — The source door and `analyze:and-optimize` |
| 8 | Silent default change | implementation | Standalone `analyze:inbox` and `--mode=plan` start pushing without the operator expecting it | the ADR records the changed default (1.2); `--no-pr` and `--mode=plan` stop before any push (3.3, 3.4) | Phase 1 — Decide the shape before building it |

## Acceptance Criteria

- [x] AC-1 — From a subfolder each of the four doors prints the scope line before
      any read; inside an enumerated or detected module it names the module, with
      or without a marker in the module's `agents/`, and keeps the outer project
      as `project_root`. Done 2026-10-19: `tests/scripts/analysis_target.test.ts` (subfolder, module with and without a marker) and `tests/scripts/analysis_doors_wiring.test.ts` (each door prints the line; the repo door lacked it, seen red).
- [x] AC-2 — Every loop, round and fix cycle of the four doors has a numeric cap in
      a `limits:` block, and no door runs until a condition without one (ADR-118). Done 2026-10-19: `analysis_doors_wiring.test.ts` — the inbox door had no `limits:` block (seen red), now pinned and restated.
- [ ] AC-3 — Each seed and deepen output carries independence stamps and
      references no other analyst; each exchange records its cross-exam targets
      verbatim, a disagreement ledger and a minority audit.
- [ ] AC-4 — After every exchange the run shows the gate's numbers, and a further
      round happened only on a recorded council or owner decision.
- [ ] AC-5 — `analyze:inbox` on a replayed round lands only `status: ready`
      roadmaps and, unless `--no-pr`, a PR whose `isDraft` is `false`, without an
      owner prompt for the PR and with at most one batched post-action question
      block.
- [x] AC-6 — A source-door run in a consumer fixture without `docs/CLAIMS.md`
      produces a typed anchor table or states feature mode, and never presents an
      opportunity as a defect. Done 2026-10-19: `tests/scripts/analysis_anchors.test.ts` (consumer fixture, feature mode, never-a-defect).
- [x] AC-7 — `analyze:pr` without an argument on a branch with an open PR finds it
      without asking, writes nothing to the PR by default, and with `--optimize`
      stops on a moved head and never merges. Done 2026-10-19: `analysis_pr_target`, `analysis_pr_review` and `analysis_pr_optimize` tests.
- [x] AC-8 — An interrupted run resumes from its last completed state without a
      second PR or duplicated output. Done 2026-10-19: `analysis_run.test.ts` (resume in emitted, publish once per key) and `analysis_publish.test.ts` (a re-run opens no second PR).
- [ ] AC-9 — `run.json` exists for every run, and the retro roadmap carries the
      `analysis-run` unit that reads it.
- [x] AC-10 — `analyze:repo`, `analyze:reference-repo` and `optimize:deep` still
      resolve as aliases in the projected tree. Done 2026-10-19: `dist/agent-src/commands/analyze/{repo,and-optimize}.md` carry the `replaces:` aliases after `task generate-tools`.
