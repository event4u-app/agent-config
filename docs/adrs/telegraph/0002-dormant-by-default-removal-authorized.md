---
adr: 0002
area: telegraph
status: accepted
date: 2026-07-29
decision: dormant-by-default-removal-authorized
supersedes: —
superseded_by: —
type: structural
review_trigger: >-
  Reopen when the deletion authorized in principle by § Decision part 3 is
  actually executed, when the `prose_only` bench the recorded dissent asks
  for is run and its result contradicts the dormancy decision, or when a
  consumer is found relying on the dormant telegraph surface.
---

# ADR 0002 — telegraph-speak: dormant by default (zero-cost), removal authorized but not executed

> Area: `telegraph` · Status: accepted · Date: 2026-07-29 · Type: structural
> Supersedes: — · Extends: [`0001`](0001-default-off-until-bench.md)
> Contract: [`condensation-default-kill-criterion.md`](../../contracts/condensation-default-kill-criterion.md)

## Context

ADR 0001 (2026-05-16, accepted) locked `telegraph.speak_scope` to **`off`** until a
bench passed. Three things had happened since, none of them recorded:

1. **The tree contradicted itself on the default.** `src/rules/telegraph-speak.md`
   claimed `prose_only` was the default; ADR 0001 and the kill-criterion contract
   said `off`. Meanwhile the key existed in **no** config file, **no** loader
   default (`_DEFAULTS: SettingsDict = {}`), and **no** schema property — so the
   runtime default lived only in prose, and the prose disagreed with itself.
2. **`off` never stopped the cost.** Verified 2026-07-29:
   `COMPILE_TIME_TOGGLES['telegraph-speak']` (`compile_router.ts:56-61`) gates the
   rule on `telegraph.enabled` / `telegraph.speak` and **never reads
   `speak_scope`** (0 hits across `compile_router`, `project_thin_rules`,
   `condense`). Under `lean_projection.mode: eager-all` the body is inlined
   regardless and the trigger is `intent: "any reply"`. So `speak_scope: off`
   removes the behaviour and keeps the ~982-token bill.
3. **The measurement was never written down as a decision.**

### Measurement (exact tiktoken `cl100k_base`, 2026-07-29)

**Cost — deterministic.** 982 GPT tok/session for the rule body (1,067 with
frontmatter), and **~1,964 as currently double-installed** in a maintainer session
(global `~/.claude` + the project projection). Carve-out sections are 438 tok =
44.6% of the rule's own cost.

Two structural facts that shape the decision:

- **Consumers pay zero.** `telegraph-speak` is one of the 16
  exclusively-maintainer rules pruned from consumer installs by the 2026-07-13
  `rule_workspaces` flip. The entire cost falls in this repo.
- **It is invisible to the repo's own budget gate.**
  `check_always_budget.ts:186` selects `type === 'always'`; this rule is
  `type: auto`. Its ~982 always-injected tokens sit outside the budget accounting
  that is supposed to catch exactly this.

**Saving — negative, and not deterministically measurable.** The rule condenses
reply prose at *generation* time, so there is no static artefact to count: the
only harness (`_lib/bench_telegraph.ts:1-12`) is a live, paid, non-reproducible
run. Best evidence remains the single n=10 run (`telegraph-v1`, 2026-05-16,
$0.0805): median `vs_terse` **−9.27%** (API counts). Re-analysis of the same 30
stored replies with exact `cl100k_base`: **−5.47%** — same sign, 41% smaller.
Corpus total: the condensed arm emitted **+88 tok MORE** than the terse control
over 10 replies.

Mechanism: telegraph wins only on pure prose (+53%, +57%) and loses hard on
carve-out-heavy prompts (−103%, −107%). It buys a prose discount and pays a
carve-out tax. Net at the 600-tok reference scale: **+33 tok/reply** → +1,014 on a
1-reply session, +2,631 on a 50-reply session. **Both sides cost.**

**Four independent in-tree locks already agreed:** telemetry multiplier suspended
at 0.9155 < 1.0; kill-criterion decision table row 1 ("criterion not met —
defer"); ADR 0001 accepted = `off`; `vs_terse` negative under both tokenizers.

### Confidence, stated honestly

- **HIGH** that the rule is not net-positive.
- **MEDIUM** on the magnitude: n=10, one run, **no repeats** (no variance estimate,
  no CI on the median), a corpus deliberately weighted 7/10 toward carve-outs,
  and the benched arm is `aggressive` — **the documented runtime default
  `prose_only` was never benched at all.**
- **A measurement-validity defect:** the rule declares **7** carve-outs; the bench
  detector implements **6** (rule #6 mode-markers and #7 deliverables are not
  regex-detectable) and *adds* markdown tables, which the rule does not list. The
  bench measured a **different carve-out set than ships** — and #6/#7, the two
  unenforceable ones, are the two worst-performing categories.

### Council (2026-07-29, `claude-sonnet-4-5` + `gpt-4o`, 2 rounds)

**Verdict: REMOVE — both members.** Sonnet's sharpest framing: this is not
"remove an underperforming optimization", it is *"stop paying 1,964 tok/session
for a rule we explicitly turned off"* — the cancellation is filed and the billing
continues.

**Recorded dissent (gpt-4o, round 2):** `prose_only` was never benched, MEDIUM
magnitude leaves room for targeted re-evaluation, and the open
`telegraph-vs-readability-tension` note argues for configurational versatility
rather than deletion. This dissent is the reason § Decision stops short of
deleting.

**Neither member named the lever that already exists** — see § Decision.

This session also discharges `agents/settings/contexts/telegraph-vs-readability-tension.md`,
whose recorded disposition was *"re-evaluate in the AI council. Not silently
flipped, not silently kept."*

## Decision

Three parts, deliberately separated by reversibility.

### 1. Router-dormant by default — DONE, but NOT zero-cost (corrected 2026-07-29)

> **An earlier draft of this section claimed "zero cost". That was wrong, and the
> correction matters more than the original claim.** Verified: `COMPILE_TIME_TOGGLES`
> appears in `compile_router.ts` and **nowhere in the projector** (`condense.ts`,
> `src/install/*`) — a `grep` for it across those returns nothing. So
> `telegraph.speak: false` removes the rule from `dist/router.json` and **leaves the
> file in place**: `dist/agent-src/rules/telegraph-speak.md` still exists and
> `.claude/rules/telegraph-speak.md` still symlinks to it.
>
> Whether that costs tokens depends on how the host injects. The evidence says it
> does: a maintainer session's context lists *"Contents of
> …/dist/agent-src/rules/telegraph-speak.md (project instructions, checked into the
> codebase)"* — the host read the **file**, and never consulted the router to decide.
> **So the ~982 project-side tokens are still being spent.**
>
> The router entry governs *trigger-routing*, not *always-loaded injection*. Those
> are different surfaces, and conflating them is what produced the false claim.
>
> **The coupling has since been built** (2026-07-29): `COMPILE_TIME_TOGGLES` moved to
> `src/scripts/_lib/compile_time_toggles.ts`, shared by the router compiler *and* the
> projector, so a compile-time-disabled rule is no longer emitted. Pinned by four
> tests — disabled→absent, enabled→present, ungated→unaffected, master-switch-wins —
> a self-falsifying pair rather than a single assertion.
>
> **But emission-skip is NOT deletion, and that limit is the honest remainder.**
> `_clean_modern_dir` reaps stale files under `.cursor/rules`, `.windsurf/rules` and
> the command dirs — **not** `dist/agent-src/rules/`. So the already-emitted
> `dist/agent-src/rules/telegraph-speak.md` **persists**, and `.claude/rules/` still
> symlinks to it. The coupling stops *future* emission and cleans the per-tool
> projections; it does not retract what already shipped.
>
> **Closing the project half therefore needs one more explicit step:** remove the
> stale `dist/agent-src/rules/telegraph-speak.md` (and let the symlink follow).
> That is a deliberate deletion of a shipped artifact, so it is left to the
> operator rather than swept in — the same boundary part 3 draws.

The compile-time toggle already provides zero-cost dormancy: with
`telegraph.speak` false the rule is **omitted from `dist/router.json` entirely**,
so no body ships and nothing is deleted. This is strictly better than
`speak_scope: off`, which leaves the bill.

Because the settings loader merges **no** template defaults
(`_DEFAULTS: SettingsDict = {}`), a template key alone would have had **zero
effect** — `compile_router` reads only the project's untracked
`.agent-settings.yml`. Setting it there instead would stamp one maintainer's local
preference into a tracked artifact and silently revert the next time anyone else
recompiled. So the durable mechanism is the **code-level fallback**: absent
`telegraph.speak` now resolves to **`false`** (dormant), matching ADR 0001's
"non-promoted" stance. Opting in stays one explicit `telegraph.speak: true` away.

### 2. Default corrected to `off` and written down — DONE

`speak_scope` now reads `off` in the rule, and `telegraph.speak_scope: "off"` is
explicit in `agent-settings.template.yml`. **Quoted deliberately:** bare `off` is
a YAML 1.1 boolean, and the same trap was found live in two pre-existing enum
keys (`subagents.auto: on`, `decision_engine.min_confidence: off`) — Zod
`z.enum` rejects booleans (tested), so **`subagents.auto: off` unquoted would not
have switched subagents off**, a kill-switch falling through to dispatch. All
three are now quoted.

### 3. Deletion — AUTHORIZED IN PRINCIPLE, NOT EXECUTED

Deleting `src/rules/telegraph-speak.md` and its machinery is authorized by the
council verdict but **deliberately not performed**, for two reasons: the recorded
dissent asks for a `prose_only` bench first (~$0.80 for 25 prompts × 4 arms × 3
repeats), and dormancy already captures the entire token benefit at zero risk. A
dormant rule costs nothing; a deleted rule costs a revert if the bench surprises.

Deletable surface when it happens: 5 scripts (~20,259 tok of TypeScript, costing
**0 session tokens** — build/CI time only), 4 test files,
`tests/golden/telegraph/*.json`, and the compile toggle itself. **There is no CI
gate** — `validate_telegraph_carveouts.ts` appears in no Taskfile target and no
workflow (verified: 0 hits); the rule itself calls it "Optional". The H2 roadmap
step claiming "+ its CI gate" was wrong and has been corrected.

## Consequences

- **982 tok/session stop being spent immediately** — with no deletion and a
  one-key revert. **Corrected 2026-07-29 (an earlier draft of this line claimed
  ≈1,964):** dormancy acts through `dist/router.json` and therefore removes only
  the **project** copy. The second copy —
  `~/.claude/rules/telegraph-speak.md`, verified a standalone regular file (not a
  symlink into this repo), body also exactly **982 tok** — belongs to a separate
  *global* install that this repo's router does not govern. So a
  double-installed maintainer session drops from ~1,964 → ~982, not to 0. Zeroing
  the remainder requires refreshing that global install; it is out of scope here.
- Absent-key semantics change: a fresh install gets telegraph **dormant** rather
  than active. This is the shipped intent per ADR 0001; the previous `true`
  fallback silently contradicted an accepted ADR.
- The MEDIUM-confidence magnitude problem is defused rather than decided: nothing
  irreversible rides on it. If the `prose_only` bench later clears the
  kill-criterion bar, `telegraph.speak: true` restores the feature intact.
- The `telegraph-vs-readability-tension` note can be closed as council-resolved.

## Operator action — CLOSED 2026-07-29

`~/.claude/rules/telegraph-speak.md` has been **deleted** (verified: the path no
longer exists). That removes the global install's **982 tok/session** for good — the
file *was* the injection source, so no further mechanism is needed on that half.

What remains open is the *project* half, and for a different reason than this ADR
first stated: see part 1 above — `speak: false` did not stop it, because the toggle
never reached the projector. Remaining options: couple file emission to the toggle
(small code change), or execute part 3 (deletion).

## Superseded framing — the second 982 tokens

**This repo cannot fix the remaining half.** `~/.claude/rules/telegraph-speak.md` is
a standalone regular file (verified: not a symlink into this repo) belonging to a
*global* install. No setting, toggle, or gate here reaches it, so **982 tok/session
keep being spent in every Claude Code session, project-independent**, until an
operator acts. Two options, both manual:

- delete the file, or
- re-sync the global install once the removal decision in § Decision part 3 lands.

Recorded here so it does not evaporate: it is the only part of this ADR's benefit
that is *not* self-executing.

## Evidence value: a quantified global-install drift instance

Beyond telegraph, this is the first **numbered** instance of a class that had only
ever been argued architecturally: a rule that is `workspaces: [agent-config-maintainer]`
— and therefore excluded from consumer *project* installs by the 2026-07-13
`rule_workspaces` flip — nevertheless sits in the global install, silently costing
982 tok/session, with its global half unreachable by any governance in this repo.

**Attribution is deliberately left OPEN**, because the obvious framing does not
survive checking. Verified 2026-07-29:

- `expandWizardSources` (`src/install/wizard-plan.ts`) **does** apply a rule filter
  to rule sources (`isRuleSource ? { fileFilter: ruleFilter } : {}`), so the global
  path is scope-*capable*, not structurally unscoped.
- `src/server/routes/install.ts` **does** pass a `ruleScope` (4 call sites).
- `src/scripts/_cli/cmd_preflight.ts` does **not**, so it defaults to `LEGACY_ALL`
  (= everything arrives).
- The "global deploy applies no exclude" claim traces to a comment about
  `scripts/install.py:2178-2222` — a **retired** Python path, not today's code.

So: the drift is measured and real; **which install path produced this machine's
global copy cannot be determined from the tree**, and the pre-scoping-flip
possibility (the file predating 2026-07-13) is not excluded. What the instance
does establish is that a scope-capable path with a `LEGACY_ALL` default plus an
unreachable global target is enough to leak a maintainer-only rule at measurable
cost — which is an argument for closing the default, not evidence that a specific
function ignores scoping. Follow-up belongs to the Pipeline-B / global-install
work, with this caveat attached.

## Alternatives considered

- **Delete now.** Rejected for this pass: dormancy captures 100% of the token
  benefit at 0% of the revert risk, and a recorded dissent asked for one cheap
  measurement first. Deletion stays on the table with no new evidence needed —
  only a decision.
- **`speak_scope: off` alone.** Rejected: verified not to stop the cost. This was
  the trap the measurement exposed.
- **Set it in the local `.agent-settings.yml`.** Rejected: untracked, so it stamps
  a personal preference into the tracked `dist/router.json` and silently reverts
  for the next maintainer. Not durable.
- **Keep it active pending a better bench.** Rejected: that is paying a measured
  negative for an unscheduled future measurement.

## References

- [`0001-default-off-until-bench.md`](0001-default-off-until-bench.md) — the
  accepted `off` lock this record finally implements
- H2 measurement: `road-to-token-saving-HUMAN-MEASUREMENT.md`
- `src/scripts/compile_router.ts` § `COMPILE_TIME_TOGGLES` — the dormancy lever
- `src/scripts/_lib/bench_telegraph.ts`, `internal/bench/reports/telegraph-v1.{json,md}`
- [`ADR-201`](../../decisions/ADR-201-remove-md-condensation.md) — the sibling
  build-time condensation decision
