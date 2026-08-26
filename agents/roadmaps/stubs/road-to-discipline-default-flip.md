---
complexity: lightweight
review_by: 2026-09-19
---

# Stub: road to the discipline-default flip and its human-judged benchmark

> **Stub — not active work.** Holds the two transfers made out of
> [`road-to-rule-coherence-followup.md`](../archive/road-to-rule-coherence-followup.md)
> Phases 1–2 by the autonomous drain run of 2026-08-20. Decided by the AI
> council (2/2, anthropic + openai) — `default-flip-release-gate` **B —
> transferred** under its categorical Rule 3 (a shipped-default flip is
> externally visible, so it may only be transferred, never recorded as
> decided-and-done), `bench-spend-and-methodology` **D — satisfied** on the
> method, whose *run* is transferred here because the two independent human
> judges it names are not something repository automation supplies. Record:
> [`agents/evidence/council/drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md).
> Census the run produced:
> [`discipline-default-flip-census-2026-08-20.md`](../../evidence/analysis/discipline-default-flip-census-2026-08-20.md).

## Why one stub and not two

The two transfers are **ordered**, and the ordering is the shared content. The
council recorded its preferred choice on the flip as *"keep the current default
and ship the preset as opt-in **until the human benchmark passes**"* — so the
benchmark is the flip's own gate. Two stubs would put that dependency across a
document boundary with nothing to hold it, which is the failure
[`road-to-main-protection-ruleset-changes.md`](road-to-main-protection-ruleset-changes.md)
records for its own pair.

What one stub does **not** mean: the benchmark may be run and returned without
anyone flipping anything, and a null result is a complete outcome. Only the
reverse order is forbidden — the flip does not precede the benchmark.

## Promotion gates

The shared promotion criteria in [`README.md`](README.md) § Promotion criteria —
a recruited first customer and a funded security audit — **do not govern a
drain-run transfer** and are not gates here. Neither transfer introduces product
capability: one is a settings-default change on this repository, the other is a
measurement. Promote **per transfer**, by its own probe below.

Both pending acts are Hard-Floor in their own right. A shipped-default flip is
an externally visible release action and a paid benchmark run is spend — when a
human performs either, it needs its own this-turn approval naming the exact
object, exactly as it would have inside the parent roadmap.

## Transfer 1 — `default-flip-release-gate`

**Disposition:** B — transferred. **Outcome state:** transferred.

**Original `Resolved when` criterion, verbatim from the parent roadmap:**

> the maintainer merges the flip with the census attached, or records a decision
> to keep the current default and ship the preset as opt-in.

**Council's preferred choice, recorded and NOT enacted:** keep the current
default and ship the preset as opt-in until the human benchmark passes. The
preset already ships commented-out with its cost stated inline
(`src/config/agent-settings.template.yml:136-168`), so the preferred choice is
the tree's present state — what is missing is a maintainer *recording* it, which
is the half no agent may perform.

**Dependent steps moved — the complete list:**

1. **F1.1** — flip the shipped `discipline_profile` default to the measured
   configuration. Its census is done and attached (below).
2. **F1.2** — the `essential-plus` preset, formalized and versioned against
   `essential`, **including its mandatory addition of `agent-authority`**: the
   whitelist as used excludes the only conflict arbiter while loading
   conflicting absolutes. Downstream of a landing F1.1 by the parent's own
   wording, so it moves with it and never ahead of it.
3. **F1.3** — `projection.rule_packs: auto`. Re-measured 2026-08-20 and
   confirmed (§ 2 of the census).
4. **F1.4** — `projection.scope_dedup: true`. Re-measured 2026-08-20 (§ 3) and
   carrying a finding that changes its value, below.

**Named re-entry producer:** the release maintainer — the repository owner
**`matze4u` (m.berg@galawork.de)**, the one principal who can merge a
default change here; `gh api repos/event4u-app/agent-config --jq
.permissions.admin` returned `true` for that account on 2026-08-20.

**Detection probe** (two readings; re-entry is either one moving):

~~~bash
grep -n 'discipline_profile: ' src/config/agent-settings.template.yml
# 2026-08-20: line 134 → `discipline_profile: __DISCIPLINE_PROFILE__`  (unflipped)
grep -c 'OPT-IN PRESET' src/config/agent-settings.template.yml
# 2026-08-20: 1  → the opt-in comment block is the shipped state

grep -n '  rule_packs: ' src/config/agent-settings.template.yml
# 2026-08-20: line 105 → `rule_packs: []`   (axis inactive)
grep -c 'scope_dedup' src/config/agent-settings.template.yml
# 2026-08-20: 0  → the key is absent from the template; condense.ts defaults false
~~~

Or a dated decision-to-keep in the release record, which closes the criterion by
its second branch without any of these readings moving.

### What the census established, and the one thing it changed

Full working in the census artefact; three lines matter for whoever takes this.

- **The pre-registered ≤ 30k criterion is ambiguous, and the flip cannot pass
  it on the reading that mentions "fresh install".** No per-tool rule-projection
  surface reads `discipline_profile` — `condense.ts`, `generate_*.ts` and
  `install/*.ts` contain no reference to the key. On the router's
  *always-honoured* reading `essential` measures **8,909 exact-BPE tok** and
  passes 3.4× under; on the what-a-host-actually-receives reading a fresh
  install carries **111,035 tok** and the key does not move it. The decision has
  to name which reading it accepts. The parent could not, which is why its own
  note said nothing had yet measured `essential`'s cost.
- **F1.3 survives re-measurement**: exactly 8 rules, the same 8 the template
  names, 8,523 exact-BPE tok (+2.6 % against the parent's 8,308).
- **F1.4's value is currently zero for consumers, and its enabling condition is
  closed by a standing maintainer refusal.** `preamble-payload-budget.json:69`
  records the dedup as FIXTURE-ONLY: `install.ts` stamps `package:` /
  `source_path:` into every installed rule while the in-repo projection stamps
  nothing, so aligning versions yields **0** byte-identical twins, not all of
  them. Re-measured 2026-08-20: 115 of 118 basenames shared, **0/118**
  byte-identical, **107/118 differing only in the ownership stamp**. Reachability
  was closed with a **maintainer refusal** on 2026-07-31 rejecting both candidate
  mechanisms —
  [`dedup-reachability-refusal`](../../settings/contexts/dedup-reachability-refusal.md).
  Flipping the default today changes nothing any consumer receives. Surfaced
  rather than quietly dropped, per `decision-revisit-gate`: reopening that
  refusal is a maintainer call, and F1.4 should be read as *blocked behind it*
  rather than as a pending win.

## Transfer 2 — `bench-spend-and-methodology`

**Disposition:** D — satisfied on the **method**, which is pre-registered in the
parent's F2.1 and reproduced verbatim below. **Outcome state:** transferred, for
the **run**.

**Original `Resolved when` criterion, verbatim from the parent roadmap:**

> thresholds are pre-registered here and the run is authorized, or F2.1 is
> cancelled and the preset ships documentation-only.

Its first leg is **discharged in the tree**: the thresholds are written into
F2.1 in the parent, and spend is authorized. What remains is the run.

**The pre-registered method (council, 2026-08-20 — fixed before any run):**

- 100 paired tasks per arm, randomised and double-blind.
- The same frozen task corpus and the same rubric across both arms.
- **Two independent human judges**, with adjudication on disagreement.
- ≥ 95 % valid completions.
- No primary-quality regression greater than 5 percentage points.
- A positive efficiency result whose **95 % bootstrap confidence interval
  excludes zero**.
- Honest-null clause, inherited from F2.1: a non-inferior-failure demotes
  `essential-plus` to documentation rather than narrating it as a win.
- The arms are **zero vs `essential-plus`**, never `essential` vs `full` — that
  comparison is already measured (p = 0.37) and `full` will never ship.

**Why this is registered and not run.** The two independent human judges are the
part no agent supplies, and they are load-bearing rather than procedural: the
council was explicit that an LLM-judged probe has no power against the
human-judged production measurement this claim would have to be comparable with.
An agent-run substitute would not be a smaller version of this method; it would
be a different method with no power, reported in this one's name.

**Dependent steps moved — the complete list:**

1. **F2.1** — the A/B run itself, and any claim derived from it.
2. F1.2's promotion from "formalized preset" to "recommended configuration",
   which the parent gates on this benchmark via the council's preferred choice
   on Transfer 1.

**Named re-entry producer:** the release maintainer **`matze4u`
(m.berg@galawork.de)**, who authorizes the spend and recruits the two judges.
Judge recruitment is the concrete gap; nothing else in the method is missing.

**Detection probe:**

~~~bash
ls docs/benchmark.md && grep -c 'essential-plus' docs/benchmark.md
# 2026-08-20: file exists, 0 occurrences of `essential-plus`
grep -rl 'essential-plus' agents/evidence/ 2>/dev/null | wc -l
# 2026-08-20: 0  → no run, no report, no arm defined in evidence
~~~

Re-entry has happened when a report exists naming both arms, both judges, the
n per arm, and the bootstrap interval — or when the maintainer cancels F2.1 and
the preset ships documentation-only, which closes the criterion by its second
branch.

## What promotion looks like

Promotion is **not** moving this file up a directory. Transfer 1 is a settings
diff plus a recorded decision; Transfer 2 is one measurement report. When a
producer performs either, close it by recording the artefact against the probe
above and striking that transfer from this file. The stub is deleted when both
are struck.
