---
complexity: structural
status: parked
owner: maintainer
review_by: 2027-01-31
tree_pin: c183b82358
estate_growth_exempt: "Carried residue of road-to-a-lead-the-user-can-reach (inbox-2026-11-j): owner-gated, measurement-bound or spend-bearing items that cannot run in the invocation that produced them. Parked rather than dropped so each keeps its trigger."
relates:
  - slug: archive/road-to-a-lead-the-user-can-reach
    relation: extends
    note: "The parent landed the reachable items; this file holds what waits on a decision, a window or spend."
---

# Road to a lead the user can reach — carried

> **Source:** `agents/tmp.old/inbox-2026-11-j/`, via
> `road-to-a-lead-the-user-can-reach` § Decisions. Every item below was verified
> at `tree_pin` and is still-true there; none is started.

## Why parked

Each item needs something the producing run could not supply: an owner ruling on
a guard, a measurement window of weeks, or spend. Pulled when an active roadmap
closes (WIP cap five, owner directive 2026-10-24).

## Phase 1 — Decisions the owner holds

- [ ] **1.1 Hook-concern presets and a per-concern disable.** A `presets:` column
      per concern in `hook_manifest.yaml` reusing the installer's
      `minimal|balanced|full` axis; pre-tool-use safety floors in every preset;
      `AGENT_CONFIG_DISABLED_CONCERNS` reported by `doctor` like the global kill
      switch (`_lib/runtime_wiring_checks.ts:310-336`). Owner question: may a
      consumer switch off a single guard? Measure dispatch latency per preset
      before any default moves.
      verify: every concern carries `presets:`; a disabled concern appears in
      `agent-config doctor` output.
- [ ] **1.2 Code-shape Iron Laws and the worker floor span.** `minimal-safe-diff`,
      `improve-before-implement` and `test-first` gain an Iron Law section that
      condenses what each already requires; `generate_subagent_floor.ts` then
      emits a derived `CODE-SHAPE` span ≤ 2,048 B into the code-writing worker
      templates. Kernel-adjacent edits: own PRs with soak. Gate: a citation
      probe showing workers lose these laws once the installed layer is thinned.
      verify: lawText() in `src/scripts/_lib/rule_law_section.ts` returns non-null
      for all four rules; `generate_subagent_floor --check` exits 0 with the span
      ≤ 2,048 B and byte-identical across siblings; `ac-researcher` carries no span.

## Phase 2 — Measurements that need a window

- [ ] **2.1 Learned-lesson injection A/B.** Arm A injects a capped lessons block
      at session start, arm B none; metric is the repeated-failure class of the
      existing unbacked `experience-loop-repeated-failure-effect` claim. Honest
      null keeps `learn_on_session_end: false`.
      verify: a pinned report with both arms; the claim's status moves from it.
- [ ] **2.2 Return bytes: record, then read.** First land the field carried from the
      parent's 2.2 — `return_bytes` on the `subagent_stop` ledger line, UTF-8 byte
      length of the final message, `null` when none, `0` when empty, never the text.
      It costs ~260 B of hook bundle, so it needs a ratified ceiling raise
      (`agents/evidence/ratifications/`, ADR-268 § 4) or an equal shrink elsewhere
      first. Then read one week: p50/p95 per agent type. Only then decide whether compressed return
      shapes are worth a design.
      verify: an evidence file with the distribution and the decision.
- [ ] **2.3 Repeated ad-hoc script reading.** Hash normalised heredoc /
      `python -c` / `node -e` Bash calls across the transcript store; share of
      repeats in calls and bytes. Threshold set before the read (proposal: < 2 %
      of Bash bytes → measured-null, nothing built).
      verify: an evidence file with the threshold dated before the numbers.
- [ ] **2.4 Effort per slice.** The read-only fan-out downshift bench re-run on
      the effort axis with the July ground truth; an effort column in
      `subagent-routing.md` only for classes that held, reported per difficulty
      stratum.
      verify: a pinned report; no column row without a stratum result.

## Phase 3 — Claims and surfaces

- [ ] **3.1 `consumer-config-audit` claim.** Recall on a frozen corpus of planted
      backdoor patterns (hidden Unicode, instruction smuggling, MCP tool
      poisoning) and false-positive rate on clean configs; registered `unbacked`
      until the run.
      verify: the claim entry exists with its corpus path.
- [ ] **3.2 `cross-host-content-equality` claim.** Backed by the regenerate-and-diff
      step plus a fixture where a hand-edited host copy reds it; extend
      `check_host_tree_parity` to skills and commands first if the fixture shows
      the step alone misses a class.
      verify: the claim is `backed` with an `exec:` pointer that exits 0.
- [ ] **3.3 Generated cost-and-context guide.** One user guide rendered from the
      benchmark cost sweep, `discipline_profile` and host capabilities; every
      number bound to a claim id, regenerated by a drift gate.
      verify: zero unbound numbers in the rendered guide.
- [ ] **3.4 Plugin manifest quirk register.** Which fields a host auto-discovers
      versus requires declared, with a regression test per quirk, before a
      `plugin.json` ships.
      verify: the register exists and each row has a test.
- [ ] **3.5 Supply-chain IOC watch.** A scheduled check of the lockfile against a
      maintained indicator list, inside an existing scheduled workflow.
      verify: a planted indicator in a fixture lockfile reds the check.
- [ ] **3.6 Pre-registered head-to-head.** Baseline vs. a peer's default install
      vs. this package's default install on identical tasks; pass rate, tokens,
      wall clock. Published at any outcome. Spend-bearing — owner approves the cap.
      verify: a pinned report rendered into `docs/benchmark.md`.

## Decisions

| # | Question | Resolution | Rung |
|---|---|---|---|
| C1 | What closes 1.2? | Non-null `lawText()` for all four rules plus a green `--check` on the span; the citation probe is the entry gate, not the acceptance. The closure scan's `ambiguous-acceptance` hit is the rule name `improve-before-implement` matching its "improve" pattern | agent (closure pass) |
