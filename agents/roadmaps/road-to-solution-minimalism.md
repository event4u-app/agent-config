---
complexity: structural
status: ready
---

# Road to solution minimalism — a first-class discipline against over-building

> This package guards hard against **under**-building: omitted controls, overfit
> tests, drive-by scope, unverified claims. It has fragments against
> **over**-building and no unified discipline. An MIT source (~90k★) ships that
> discipline as a solution-size ladder; an **independent** third-party A/B on 80
> paired tasks measured the effect direction on a benchmark the source's author
> did not choose. The borrow is unusually low-risk — an additive rule with every
> existing floor untouched — and unusually well-instrumented, because the same
> independent run also measured three ways the naive copy fails.
>
> Source + council cut:
> [`elder-ponytail-harvest-cut`](../settings/contexts/elder-ponytail-harvest-cut.md).

## Outcome

**Archived does not mean achieved, and this roadmap is not archived.** Two of its
six open items closed on evidence, three are `[-]` transferred to a stub, and one
stays open.

**The dashboard reads 97 %, and that number is not a claim about the goal.** It
counts checkboxes, and three of them are transferred rather than done — a
percentage cannot distinguish "the work was done" from "the work moved to
somewhere it can be done". The transfer is the reason the figure is high, so it
is stated here next to the figure rather than left for a reader to reconstruct:
**Phase 3 has never reported.** Per phase:

| Phase | Disposition | What that means |
|---|---|---|
| Phase 0 — spikes | **satisfied** | S0.1/S0.2/S0.3 all closed on evidence, unchanged by this pass. |
| Phase 1 — the ladder as rule text | **narrowed, then satisfied** | S0.1's 12-EXTEND tally re-scoped it from a new rule to edits of the colliding artefacts; that is what shipped. The credits step is `[-]` **abandoned** with its reasons recorded at the step. |
| Phase 2 — over-build review lens | **satisfied** | Golden set green, including the lean fixture and the longer-simpler-form fixture. |
| Phase 3 — pinned public-repo benchmark | **narrowed** | Repo pinning and the reproducibility deliverables are satisfied here. The ~30 oracles and the full-tier run are **transferred** to [`stubs/road-to-solution-minimalism-full-tier-run.md`](stubs/road-to-solution-minimalism-full-tier-run.md) (B, below). Phase 3 has never reported and does not report now. |
| Acceptance criteria | **4 of 6 satisfied, 1 transferred, 1 open** | The full-tier criterion is transferred to the stub. The quality-gates criterion stays open and is NOT claimed: see its own note for what actually ran, and note that it did **not** move to the stub — it is not gated on the run. |

### The blocker disposition (A — re-scope, narrowed)

`phase3-harness-deltas-9-10` is **removed**, not resolved: an AI council found it
was never a blocker. Deltas #9-#10 are ordinary repository implementation, and
the entry had converted "large" into "unavailable" for five steps. Record:
[`drain-blocker-dispositions-a`](../evidence/council/drain-blocker-dispositions-a.md).
Its substitute criterion, verbatim:

> Implement `repo` and `sha` corpus keys, add approximately 30 hand-written
> capability/discipline oracles, pin at least one task to a repository SHA, run
> the full tier, and publish its report.

**Satisfied here** — `repo` and `sha` corpus keys, and one task pinned to a
repository SHA. Implemented in `_lib/bench_ab_pinned_repo.ts`, wired through
`reset_fixture` and the offline complexity re-scorer, and scored in three
directions against the real pinned tree (§ Phase 3, Repo).

### Transferred (B) — the ~30 oracles and the full-tier run

**The transfer has a home, and that is the point.** It lives in
[`stubs/road-to-solution-minimalism-full-tier-run.md`](stubs/road-to-solution-minimalism-full-tier-run.md),
alongside the estate's other drain-run transfers and registered in their
[`README`](stubs/README.md) table with its baselines. The three items below carry
`[-]` here with a one-line pointer each. A transfer recorded only as prose in a
roadmap that stays open is indistinguishable from work nobody started — the stub
is what makes it a moved obligation rather than a note.

**Where the line falls, and why it is not "this is large".** Authoring oracles is
ordinary work; *calibrating* one is a claim about model behaviour, and the run
that would test it needs metered model calls. Verified rather than assumed in the
environment that closed the rest of this roadmap: `git ls-remote` against a
public remote succeeds (which is why delta #9 could land at all), and
`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_AUTH_TOKEN` are all
unset. On top of that, firing a paid sweep is a Hard-Floor action requiring
confirmation **on the turn it fires**; the 2026-08-14 pre-authorisation records a
decision, and a recorded decision is not a live confirmation. So the network half
of #9 was doable and was done; the metered half was not.

The three-point integrity check:

1. **Original criterion, verbatim** — the substitute criterion quoted above, and
   the acceptance criterion it feeds: *"Phase 3 either reports from the full tier
   with every pre-registered endpoint — added lines **paired** with cognitive
   complexity, plus search-adherence and the safety tier — or publishes the null;
   no number appears anywhere except rendered from the pinned report."*
2. **Complete list of dependent steps moved** — three, and no others: Phase 3
   **Tasks** (the mixed ~30-task corpus), Phase 3 **Hygiene** (the escalation
   ladder through the full tier), and the acceptance criterion in (1). Phase 3
   **Repo** and **Reproducibility** are *not* moved: they closed here. Nor did
   the quality-gates criterion move — it is not gated on the run.
3. **Re-entry producer and detection probe** — producer: the maintainer authoring
   the remaining pinned tasks against `pallets/click@150d1071d` (or a second
   pinned repo) and then running
   `./scripts-run src/scripts/bench_ab_v2_run --host claude --max-usd 250` in an
   environment carrying a credential, with a this-turn Hard-Floor confirmation.
   Probe, checkable without judgement: `internal/bench/corpora/ab-trackb-v2.yaml`
   carries **≥ 30** tasks declaring `repo` + `sha`, **and** `docs/benchmark.md`
   renders a `Gate verdict:` for the ladder arms from a pinned report whose own
   `sha` field is non-empty. Both halves false today: **1** pinned task, and no
   report.

**The residue, named rather than implied.** A transfer with a producer and a
probe is still a transfer: nothing in this change makes the run happen, and the
pre-registered thresholds stay committed and unfittable-to-data, which is the
strongest form of that guarantee and also the reason nobody is forced to hurry.
What this pass removes is the false report that Phase 3 was *blocked*. It was
two-thirds ordinary work and one-third genuinely gated, and the roadmap said
"gated" about all of it.

## Goal

Ship the missing over-building discipline as projected rule text plus a
deletion-hunting review lens, then measure it on a pinned public repo against a
bare-principle control — so the claim that survives is "the ladder **with the
floors routed**", not "the ladder".

Two axes, not one: **scope** (must this exist, and can something cheaper serve?)
and **shape** (of what must exist, which form carries the least cognitive load?).
Each axis gets its own endpoint — added lines for scope, cognitive complexity for
shape, the safety tier for the floors — so none can be optimised at another's
expense without the benchmark seeing it.

## Context (verified in-tree 2026-07-29, do not relitigate)

- **Coverage is partial, not absent.** `minimal-safe-diff-mechanics`
  § Anti-over-engineering already says "three similar lines beat a premature
  abstraction" and "no speculative features"; `improve-before-implement` already
  carries a demand gate ("should this exist?"). **Genuinely absent:** the
  **reuse → stdlib/framework → native platform → installed dependency**
  ordering, and any deletion-hunting review lens. The roadmap is scoped to the
  absent part; Phase 0 decides whether it lands as a new rule or an extension.
- **`internal/bench/ab` exists** (fixture-based, N=2 tasks × 12 seeds, placebo
  arm) — statistically stricter than the source's own benchmark, but with no
  public-repo run and no per-trial injection audit.
- **`hooks/hooks.json` dispatches six events** (SessionStart, SessionEnd, Stop,
  UserPromptSubmit, PreToolUse, PostToolUse). No SubagentStart/SubagentStop
  anywhere in `src/`; ~~whether the host exposes such an event is unverified~~ —
  **superseded by S0.2 (2026-08-02): the host does expose `SubagentStart` and
  `SubagentStop`**, and rules already reach subagents without either.
- The license here and at the source are both MIT.

## Findings that constrain the design (from the independent benchmark and the critic thread)

Each one is a measured fact about how this borrow fails when copied naively.

- **F1 — Description-triggered skills do not self-activate.** With the source's
  skill installed the normal way and a description saying "use on ANY coding
  task", self-activation across ten sessions was **zero**; only hook injection
  produced any effect. → the ladder ships as **projected rule** text through the
  existing projection/dispatch pipeline, never as a description-triggered skill.
  A skill-only variant would measure nothing and any null would really be an
  activation failure.
- **F2 — Marker conventions without a machine backstop are dead text.** Across
  80 trials with the ruleset demonstrably in context, the source's deferred-
  simplification marker was written **once**. → no marker convention ships in
  this roadmap; it is a gated follow-up with a kill condition.
- **F3 — Advertised vs. independently measured effect.** Source's own run: −54 %
  lines (mean, hand-picked over-build-trap tickets, n=4). Independent run on 80
  tasks nobody chose for the purpose: **−15.4 % code (p=0.088), −10.3 % cost
  (p=0.004)**, −31 % on large builds, ≈0 on lean tasks, no detectable quality
  difference (not powered for equivalence). → thresholds pre-register near the
  **independent** numbers, never the source's headline.
- **F4 — Small samples lie in both directions.** The same benchmark's 10-task
  smoke run showed +9.6 % cost and collapsing quality; the full 80 showed the
  opposite. → adopt the escalation ladder (self-test → smoke → k=3 → full) and
  publish **nothing** below full.
- **F5 — Effect is host-scoped and can invert.** On a terse reasoning model the
  token effect reverses. → claims stay host-scoped, matching the existing
  weak-host / strong-host labels.
- **F6 — Seven words nearly match the whole artefact, until safety.** A
  seven-word critic prompt beat the source on its own (flawed) single-shot
  benchmark, and in the agentic rebuild was cheap, erratic on size, and **the
  only arm that dropped a safety guard** — the ~3 lines it saved were a
  path-traversal check. → the benchmark **must** carry a bare-principle arm, or
  the floors' contribution is asserted rather than measured. And a size metric is
  never a scored target.
- **F7 — The source carries a stale claim surface.** One of its own skill files
  still renders a retracted scoreboard while its README shows the corrected
  figure. → every number this roadmap displays renders from a pinned report;
  hand-typed prose numbers are forbidden.
- **F8 — Diff size is a proxy, not ground truth** (council round-2 dissent,
  adopted as a constraint). The ladder enforces a **search discipline**; lines-of-
  code measures output volume. A run can shrink the diff without anyone having
  searched for an existing solution. → Phase 3 carries a **search-adherence
  endpoint** alongside the size endpoint, or it measures the wrong hypothesis.
- **F9 — Minimalism has a second failure mode, and a size metric rewards it.**
  Guard-drop (F6) is the first; **golfing** is the second — fewer lines, denser
  and harder to read. This is measured, not theorised: LLM-generated code is on
  average shorter but denser, with higher Halstead volume and greater token
  variety, i.e. higher cognitive load per line. Lines-of-code as the only size
  metric actively **rewards** that. Cognitive and cyclomatic complexity are
  established, deterministic, per-stack-tooled instruments in exactly this
  literature. → the size claim becomes a **metric pair** (Phase 3), and the rule
  gains a *shape* axis distinct from its *scope* axis (Phase 1). Independent
  arrival at the same conclusion as F8, from the opposite direction.

## Design constraints

1. **No floor is touched.** The ladder is additive prompt-side discipline that
   **routes to** `engineering-safety-floor`, `senior-engineering-discipline` and
   `security-sensitive-stop`. It never restates or weakens them. Disjointness
   with `minimal-safe-diff` is written down: that rule bounds **which lines
   change**; this one bounds **how much solution gets built**.
2. **No effect claim ships before Phase 3 reports.** The rule text may ship as
   discipline; the number may not.
3. **All displayed numbers render from a pinned report** (F7).
4. **License hygiene.** MIT source: mechanisms and structure are borrowed, every
   line of text is written here, and a credits entry lands in the same change as
   Phase 1.

## Phase 0 — Verification spikes (read-only, no authoring)

- [x] **S0.1 Overlap sweep — decides new-rule-vs-extension.** Rung-by-rung grep
      evidence against `minimal-safe-diff` (+ its mechanics guideline),
      `senior-engineering-discipline`, `architecture`, `improve-before-implement`,
      `supply-chain-intake`, `active-remediation`.
      **The disjointness test** (council-agreed, apply it literally): a rung
      lands as **new** rule text only if it fires at a *different decision point*
      than every existing statement (before implementation: "does a cheaper
      mechanism already do this?" vs. during design: "do not abstract yet"),
      **and** the existing statement is not merely a weaker phrasing of the same
      obligation. Any rung failing either half is an **extension** of the
      colliding artefact, not new prose.
      *Verify:* a table with one row per rung, a citation per collision, and a
      per-rung verdict new/extend. A majority-extend outcome re-scopes Phase 1
      into an edit of the colliding artefacts.
      **Machine-checked, not just stated:** the sweep's acceptance includes a
      **routing-collision check** — no two rules/skills colliding on their
      trigger sets — so disjointness is enforced by a gate rather than asserted
      in prose. Natural home: the existing skill linter.
      **Done 2026-08-02 — 12 EXTEND / 2 NEW (86 % extend).** The re-scope rule
      fires: Phase 1 becomes edits to the colliding artefacts. Only R4
      (native-platform rung) and R13 (second-system rewrite context) are
      disjoint. Three latent contradictions surfaced (two-vs-three repetitions ·
      fewest-lines-vs-least-load · profiler-gate vs the `scale-discipline` R-A2
      floor). The routing-collision gate **did not exist** and ships with this
      change as `lint_rule_trigger_collisions`. Table + citations:
      [`solution-minimalism-phase0-spikes § S0.1`](../evidence/investigations/solution-minimalism-phase0-spikes.md).
- [x] **S0.2 Subagent rule-propagation probe.** Two questions, in order: does the
      host expose a subagent-start event at all, and do this package's rules
      reach a subagent's context today? One live probe with transcript evidence.
      *Verify:* yes/no on both, with the transcript committed.
      **Escape clause:** if the event exists **and** rules do not reach
      subagents, this is not a step in this roadmap — it affects **every** rule's
      propagation and leaves as its own change. Record and hand back; do not fix
      it here.
      **Answered 2026-08-02 — YES / YES.** The host does expose `SubagentStart`
      (Claude Code 2.1.220, carrying an `additionalContext` injection payload),
      superseding finding 4 of `elder-ponytail-harvest-cut`; and a live
      zero-tool-call probe had a subagent reproduce two Iron Laws verbatim from
      its own context. The escape clause therefore does **not** fire — there is
      no propagation gap to hand back, and F1 needs no new hook. Evidence:
      [`solution-minimalism-phase0-spikes`](../evidence/investigations/solution-minimalism-phase0-spikes.md)
      + [committed transcript](../evidence/investigations/solution-minimalism-s02-subagent-probe.md).
- [x] **S0.3 Harness feasibility + cost sheet.** Can `internal/bench/ab` run
      arm-isolated headless sessions against a pinned public repo with a
      per-trial injection audit in **both** directions (treatment trials prove
      the ruleset reached the model; control trials prove it did not)? Estimate
      cost per (task × arm × k). **No paid full runs in this phase.**
      *Verify:* go/no-go plus a cost sheet that the Phase 3 spend authorization
      can be granted against.
      **Done 2026-08-02 — GO WITH CHANGES.** Arm isolation and headless
      execution are met; the per-trial injection audit, external-repo support
      and the cost sheet are all absent, with eleven named deltas (five small,
      four medium, two large). Working estimate for 30 tasks x 4 arms x 3 seeds
      on sonnet: 360 runs, ~180M tokens, **$150-250 as a floor**. Cost sheet +
      delta table:
      [`solution-minimalism-phase0-spikes § S0.3`](../evidence/investigations/solution-minimalism-phase0-spikes.md).

**Exit:** the authoring decision is evidence-backed and the benchmark cost is
known. **Rollback:** nothing shipped.

## Phase 1 — The ladder, as rule text

Shape decided by S0.1. If new: same projection class as `minimal-safe-diff`, so
it is always-on where it matters (F1). If extension: the colliding artefacts are
edited in place and no new file appears.

**S0.1 decided: EXTENSION.** 12 of 14 clauses collide with an existing statement
at the same decision point, so **no new rule file appears**. The colliding
artefacts are edited in place; nine clauses need no edit at all because the
statement already exists and the sweep found no weakness in it. Recording that
outcome honestly *is* the deliverable for those rungs — re-stating them in a new
file is the inflation the repo's own complexity budget forbids.

**Council convergence (2026-08-02 · anthropic + openai · 2 rounds · $0.09):**

- **Bulk-extend confirmed, no new rule file.** Both members landed here in round
  2. The disjointness test is necessity-framed ("only if"), and a thin two-clause
  file would still fail the complexity budget's questions 1 (Replaces?) and 2
  (Overlaps?) — R4 overlaps `improve-before-implement` on intake timing and R13
  overlaps the existing rewrite-trigger string on location.
- **Two vs three repetitions: the repo's *two* wins, the borrowed *three* is
  discarded.** Changing shipped text to match an external standard with zero
  local evidence is the anti-borrow shape. Recorded as a **split** — the openai
  member argued for three in round 1 on stability grounds and did not re-argue it
  in round 2.
- **Fewest lines vs least cognitive load: load wins**, and the loser is edited
  for precision rather than reversed — the existing "smaller diffs" payoff means
  *removing indirection*, not compressing.
- **Profiler gate vs the `scale-discipline` floor: the floor is untouchable**;
  the clause ships with an explicit carve-out. Unanimous.
- **The over-build lens is a new skill, not an extension of the quality judge.**
  Also a round-2 reversal. The disjoint axis: the existing judge asks *is this
  code malformed*; the lens asks *should this code exist at all*. The tag grammar
  encodes **why** something is over-built, which determines what evidence proves
  removal is safe — usage analytics for `yagni:`, API-equivalence for `stdlib:`.
- **No attribution entry ships** (see the cancelled credits step below).

- [x] The ordering, in house voice: need-to-exist → reuse-in-repo → stdlib /
      framework → native platform → installed dependency → smallest working
      form. Explicitly ordered **after** comprehension — the ladder shortens the
      solution, never the reading.
      *Verify:* the text contains no rung that S0.1 marked as an existing
      statement.
      **Landed** as `agent-interaction-and-decision-quality` § 8b-ladder (the
      ordered table + the after-comprehension clause) with a one-paragraph
      summary in `improve-before-implement`. Rungs 1/2/3/5/6 are labelled in the
      text as existing obligations the ladder **orders**, with a citation each —
      the ladder adds no rung S0.1 marked as already stated. **Rung 4
      (native platform) is the only new content**, with worked examples
      (`crypto.randomUUID`, `Intl`, `AbortSignal.timeout`, DB-native full-text /
      JSON, a filesystem watcher).
- [x] **The shape axis, distinct from the scope axis (F9).** The ladder above is
      *scope*: must this exist, and can something cheaper serve? The shape axis
      is: of what must exist, which form carries the least cognitive load —
      explicitly **not** the fewest keystrokes. Simple is not the same as short:
      a flat version one line longer beats a dense clever one. This clause is
      what keeps the smallest-working-form rung honest — a one-liner qualifies
      only if it is also the *simplest* form, not merely the shortest.
      *Verify:* the rung text cannot be satisfied by compression alone.
      **Landed** as § 8b-shape, plus the reconciliation the sweep demanded in
      `code-clarity` § Why this matters — its "smaller diffs" payoff now reads
      "by removing indirection, never by compression", and names the nested
      ternary / long optional-call chain as a regression. Compression alone
      cannot satisfy either text.
- [x] **Principle-precedence table** — the thing every principle collection
      omits, and the reason they produce contradictory simultaneous instructions:
      floors win → then explicit user-fenced scope → then shape (simplicity) →
      then scope (don't build it) → then de-duplication, with the Rule of Three
      as the de-duplication gate. One table, stated once.
      *Verify:* every principle named anywhere in the rule appears in the
      precedence order; a reviewer can resolve any pair from the table alone.
      **Landed** as § 8b-precedence — one ranked list, stated once: floors →
      user-fenced scope → shape → scope → de-duplication (gated on the existing
      repetition trigger). It is deliberately **not** an entry in
      `rule-interactions.yml`: that contract is pairwise and scoped to the
      always-on kernel rules, and forking it with a second prose ordering over a
      different kind of object is the drift the table exists to prevent. Council
      split on this — one member wanted both surfaces; the contract's own scope
      settled it.
- [x] **Rule of Three as the abstraction trigger, and known-constraints-only as
      the architecture trigger** — no extraction before the third occurrence
      confirms the pattern; architect for measured constraints (load, latency,
      team size), never for speculative scale. These give the first and last rung
      a checkable form instead of a vibe.
      *Verify:* both triggers are stated as conditions a reviewer can apply.
      **Landed as a correction, not an import.** The repo's operative abstraction
      trigger is the **second** real repetition (`architecture`,
      `component-oriented-and-oop-development`); the borrowed third-occurrence
      rule is explicitly **not adopted** — importing it would fork a threshold
      this repo already decided. `minimal-safe-diff-mechanics`
      § Anti-over-engineering now says so, resolving the in-tree confusion
      between its "three similar lines" phrasing and the second-caller action.
      The architecture trigger (known constraints only, never speculative scale)
      was already stated there as "no speculative features" — no edit.
- [x] **Reversibility clause (two-way doors).** The lazy rung is *preferred*
      where the choice is reversible; a one-way door — public API, DB schema,
      migration, wire format — always gets the full treatment. Corollary that
      keeps a later follow-up honest: a deferred-simplification marker is valid
      only on a **reversible** cut; an irreversible shortcut is not a defer, it
      is a decision, and it routes to the decision-record surface.
      *Verify:* the clause names the one-way-door categories explicitly rather
      than leaving "important" to judgement.
      **Landed** as the corollary on `decision-record` mental model 10, which
      already carried the two-way/one-way split. The new half is the one this
      roadmap needs: a shortcut through a one-way door is a **decision, not a
      defer** — public API shape, DB schema, migration, wire format, published
      identifier are enumerated, so the call is not a judgement about what feels
      important.
- [x] **Interface-surface rationale (Hyrum's Law), one paragraph.** Every
      observable behaviour eventually becomes a contract somebody depends on, so
      a smaller surface is fewer accidental contracts. Dual use: it justifies
      interface minimalism *and* warns the deleter — removing observable
      behaviour breaks someone.
      *Verify:* it reads as rationale, not as a new obligation.
      **Landed** in `downstream-changes` § Breaking changes as one paragraph of
      rationale above the existing ask-first list — no new obligation, and
      explicitly dual-use: a smaller exported surface is fewer accidental
      contracts, and the ask-first list is a floor rather than a ceiling because
      an undocumented observable behaviour can still break someone.
- [x] **Rewrite-context trigger (second-system effect).** Rewrites, v2s and
      large refactors are the peak over-build context; add those trigger keywords
      and one sentence naming the effect.
      *Verify:* the trigger set includes the rewrite vocabulary.
      **Landed** as `minimal-safe-diff-mechanics` § "The sanctioned-rewrite trap
      (second-system effect)" — deliberately a separate heading, because the
      existing "rewrite trigger" string fires mid-diff on your own bloated
      change while this one fires at **intake**. `minimal-safe-diff` already
      carried `keyword: rewrite`; `phrase: "from scratch"` and
      `phrase: "second system"` were added and clear the new trigger-collision
      gate.
- [x] **Profiler-gated optimization clause.** Performance complexity is a
      *claim* and needs measurement evidence: no cache, no index, no
      denormalisation until a profiler says so. This matches the house claims
      culture exactly rather than importing a new one.
      *Verify:* the clause demands evidence, not restraint.
      **Landed** in the `performance` skill at Step 0 — no cache, denormalised
      column, materialised view or read replica without a profile, a query log
      or a timing that names the bottleneck. It demands evidence, not restraint.
      Ships with the carve-out the sweep forced: the `scale-discipline` floor's
      mandated index parity (R-A2) and waivered denormalisation (R-A4) are
      structural defaults that ship **with** the query, not optimisations
      awaiting a profiler. Zero floor files changed.
- [x] Iron-Law block ending in **routing, not restatement**: floors win,
      invisible cross-cutting controls win, user-fenced scope wins.
      *Verify:* zero safety-floor files change in the same commit.
      **Re-scoped by S0.1 — no new rule file, therefore no new Iron-Law block.**
      The routing it would have carried is rows 1-2 of § 8b-precedence: floors
      win (naming `engineering-safety-floor`, `security-sensitive-stop`, and
      `senior-engineering-discipline`'s invisible cross-cutting controls), then
      user-fenced scope. Both route; neither restates. Zero safety-floor files
      are touched by this change.
- [x] A "relationship to existing rules" section written from the S0.1 table.
      *Verify:* every collision from S0.1 appears with its resolution.
      **Re-scoped: there is no new rule to write the section *in*.** Its content
      is the S0.1 table plus a resolution column, and it lives in
      [`solution-minimalism-phase0-spikes § S0.1`](../evidence/investigations/solution-minimalism-phase0-spikes.md)
      — all 14 clauses, each with its colliding artefact, and each with the
      outcome recorded on the Phase-1 step above (landed where / already stated /
      not adopted).
- [x] Examples in this repo's own stacks rather than the source's.
      *Verify:* framework-neutrality lint passes.
      Rung-4 examples are multi-stack peers (JS/TS runtime, `Intl`, a database's
      own full-text/JSON support, a filesystem watcher) rather than a single
      mandated framework; the ladder text names no framework as the procedure.
- [-] Credits entry lands in the same change.
      *Verify:* the borrow-check / credits gate passes.
      **Cancelled — the roadmap's own instruction is overridden by
      `source-confidentiality`, and the override is recorded rather than
      silently applied.** Three independent reasons, in order of force:
      (1) nothing is vendored — mechanisms and structure were re-derived and
      every line of text here is original — so MIT creates **no** attribution
      obligation and the confidentiality rule's single carve-out
      ("license-required attribution for genuinely vendored code") does not
      open; (2) `provenance/borrows.jsonl` is a **code**-borrow ledger whose
      closed 7-field schema requires `files:` paths that a prose borrow does not
      have, and `CREDITS.md`'s table is scoped to vendored/derived material;
      (3) the source name is already anonymised across this tree by the
      2026-06-13 confidentiality sweep and is recoverable only from an encrypted
      link, so a named entry cannot be written without reversing that decision.
      Council split: one member argued in round 2 for defaulting to transparency
      in an MIT repo. Recorded here per `decision-revisit-gate` — the lock is
      surfaced, not silently obeyed.
- [x] **No effect claim anywhere in this phase.**
      *Verify:* grep the diff for a percentage; there must be none.
      Verified mechanically —
      `git diff -U0 -- src/rules src/skills docs/guidelines | grep -c "^+.*%"`
      returns **0**. The shipped discipline carries no number; the measured
      claim waits on Phase 3, exactly as design constraint 2 requires.

## Phase 2 — Over-build review lens

- [x] A deletion-hunting review lens with a terse tag grammar — delete · stdlib ·
      native · yagni · shrink · **flatten** — one line per finding, a
      net-lines-removable summary, and a **mandatory honest-null output** when
      there is nothing to cut. `flatten:` is the shape-axis inverse of `shrink:`
      (F9): same logic, simpler form, **even when that costs a line or two**.
      Without it the lens only ever argues downward and becomes a golfing engine.
      *Verify:* the scope fence is explicit — correctness, security and
      performance are **out of scope** for this lens and route to the normal
      review pass; the minimum runnable check is never flagged for deletion. A
      fixture where the simpler form is *longer* must produce `flatten:`, not
      silence.
      **Landed** as `src/skills/overbuild-review-lens/SKILL.md` — a new skill,
      per the council's round-2 convergence. Disjoint axis, stated in the skill:
      the existing quality judge asks *is this code malformed*; this lens asks
      *should it exist*. All six tags ship, the scope fence is its own fenced
      Iron-Law block naming the measured guard-drop failure, and the
      `flatten-longer` fixture is the anti-golfing case (the correct rewrite is
      **+4 lines** and `shrink:` is a forbidden tag there).
- [x] **Every `delete:` finding carries a mandatory fence line** (Chesterton's
      Fence). Agents are documented as especially fence-blind: they see complex
      code and want to simplify it, when the complexity may exist for a reason
      they have no context for. The line states **why the code existed** —
      blame, tests, issue archaeology — and the **evidence that removal is
      safe**. This operationalises `minimal-safe-diff`'s existing "never delete
      code that *looks* dead without proof" clause inside the lens; it does not
      restate it.
      *Verify:* a `delete:` finding without a fence line is rejected by the
      lens's own output contract, and a fixture whose complexity has a
      non-obvious reason must survive the lens.
      **Landed and machine-enforced.** `src/scripts/_lib/overbuild_lens_contract.ts`
      parses the verdict block and returns a contract violation for any
      `delete:` without a valid `Fence: why= safe= covered=` line; the negative
      case is asserted in the gate, not asserted in prose. The `lean-crud`
      fixture is the survives-the-lens case — required controls (tenant scope,
      404) plus the minimum runnable check, all of which must come back
      untouched.
- [x] **Test coverage of the deleted path is the deterministic fence signal**
      (Beyoncé rule: if you liked it, put a test on it). Deleting *tested*
      behaviour trips a test and is visible; deleting *untested* behaviour breaks
      silently. So the fence line records whether the removed path was covered —
      the one machine-checkable input to an otherwise archaeological judgement.
      *Verify:* the fence line has a coverage field, and an uncovered deletion is
      surfaced as higher-risk rather than treated as equivalent.
      **Landed** — `covered=yes|no|partial` is a required, enum-validated field
      of the fence, and the skill states plainly that `covered=no` raises the
      risk of a deletion rather than leaving it equivalent (deleting tested
      behaviour trips a test; deleting untested behaviour breaks silently). The
      `trap-native` reference exercises the `covered=no` path.
- [x] Golden-set gate: ≥3 seeded over-built fixtures where the lens must find
      the plant, **plus ≥1 deliberately lean fixture where it must emit the null
      instead of inventing a finding.** The lean fixture is the gate — a lens
      that cannot say "nothing to cut" is a finding generator.
      *Verify:* the lean-fixture case fails the build if the lens invents a
      finding.
      **Landed** as `tests/scripts/overbuild_lens_contract.test.ts` (17 assertions,
      green) over five fixtures: three seeded traps (`trap-stdlib`,
      `trap-yagni`, `trap-native`), the lean gate (`lean-crud`), and the
      longer-is-simpler case (`flatten-longer`). The gate scores the reference
      reviews **and** feeds the scorer four deliberately wrong outputs that must
      be rejected — invented finding on the lean fixture, unfenced deletion,
      `shrink:` where `flatten:` was required, and a silent miss. A scorer that
      passes everything is worse than none, so it is proven to discriminate
      rather than assumed to.
      **Honest boundary:** this gates the **output contract** deterministically
      with no model call. Whether a live model finds the plant needs a scored
      eval run, which is human-invoked here; the fixtures and labels are that
      run's input. Recorded in the fixtures' README, not papered over.

## Phase 3 — Pinned public-repo benchmark (the proof exhibit)

**Correction 2026-08-16 — this header was wrong, and the sentence below it is
left standing so the wrong claim stays auditable.** The spend blocker has read
`Status: resolved` since 2026-08-14 (granted, $250 ceiling, pre-authorised), so
Phase 3 has not been spend-blocked for two days. Its real gate was
`phase3-harness-deltas-9-10` — a pinned external repo and its oracles.
Delta #11, the third member of that set, landed 2026-08-16 and is no longer a
gate.

**Superseded 2026-08-20 — that blocker is GONE, and it was never a blocker.** An
AI council reviewed every open blocker in the estate and disposed of this one
**A — re-scope, narrowed**: deltas #9-#10 are *ordinary repository
implementation*, not an external dependency and not a decision anyone owed this
roadmap. Large is not the same as unavailable, and the entry had converted the
second into the first for four days. Record:
[`drain-blocker-dispositions-a`](../evidence/council/drain-blocker-dispositions-a.md).
Delta #9 landed with that disposition — see § Outcome for what of the substitute
criterion is satisfied here and what is transferred, and why the split falls
where it does. This is the same defect the § Blockers
preamble names from the other direction: a roadmap that cites a resolved blocker
as standing overstates its own gating, and the cost lands on whoever screens the
backlog next.

~~Blocked on [`benchmark-spend-authorization`](#blocker-benchmark-spend-authorization)
— the structured entry under § Blockers, which the S0.3 cost sheet exists to be
granted against.~~

The second gate this note used to name — "the standing model-id verification
blocker" — **no longer exists**: delta #3 closed it on 2026-08-05
(`bench_ab_task_runner.run_live` records `models_seen` from the envelope's
`modelUsage`, and `main` refuses a bare alias with exit 2 before any spend). The
clause is struck rather than reworded, because a roadmap that cites a resolved
blocker as standing overstates its own gating.

> **Halted 2026-08-02 — the whole phase, with the cost sheet now in hand.** Two
> independent gates, either of which alone stops it:
>
> 1. **Spend, owner: user.** S0.3 priced it: 30 tasks × 4 arms × 3 seeds on
>    sonnet ≈ 360 runs ≈ 180M tokens ≈ **$150–250 as a floor**, higher on a real
>    repo. `benchmark-spend-authorization` is the grant this cost sheet exists to
>    be granted against, and it is the user's to give. Firing a paid external
>    run autonomously is a Hard-Floor action
>    ([`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md));
>    no autonomy setting or roadmap step lifts it.
> 2. **The harness does not support the phase yet, at any price.** S0.3's
>    deltas #9 (pinned external repo), #10 (~30 hand-written capability /
>    discipline oracles, sized **large**) and #11 (a cognitive-complexity
>    endpoint, which **does not exist anywhere in the repo** — sized **large**)
>    are prerequisites this roadmap never specified. #11 is not optional
>    decoration: the pre-registered acceptance below is a *metric pair*, so
>    without it the phase cannot report a pass at all.
>
> Deltas #1–#5 (all sized small, ~one sitting) are the difference between a
> publishable run and an unpublishable one — the per-trial injection audit above
> all, because the harness has **already produced a full set of invalid nulls**
> from an undetected activation leak and today's code would not catch a
> recurrence. Whatever else happens, they land before the first paid trial.
>
> **Deltas #1–#5 LANDED 2026-08-05** — see § Untracked prerequisite work below.
> ~~Both halt gates stand unchanged: the spend grant is still the user's, and
> #9/#10/#11 are still missing.~~ What changed is that the harness can no longer
> produce the specific invalid null it produced before.
>
> **Both halt gates have since moved, 2026-08-16.** Gate 1 (spend) was
> **discharged** on 2026-08-14 — granted at a $250 ceiling and pre-authorised, so
> it is no longer the user's to give again. Gate 2 (harness) is **narrowed**:
> **#11 landed** with its calibrated suite and mutation-verified refusals, so the
> metric-pair acceptance criterion is reachable; #9 and #10 remain, and they are
> now the whole of gate 2.
>
> Nothing from this phase is cancelled or reinterpreted; the steps stand as
> written. Full evidence, delta table, and price inputs:
> [`solution-minimalism-phase0-spikes § S0.3`](../evidence/investigations/solution-minimalism-phase0-spikes.md).

- [x] **Repo:** one public OSS repo pinned at a SHA. A second repo on this
      package's home stack is optional and cost-gated.
      *Verify:* the SHA is recorded in the pinned report.
      **Delta #9 LANDED 2026-08-20 — the corpus can pin an external repo, and one
      task does.** `repo` + `sha` are corpus keys; `_lib/bench_ab_pinned_repo.ts`
      materialises the pin once per SHA (shallow fetch + `git archive` into a
      `.git`-free tree, cached in tmp) and every per-trial workspace is a local
      copy of it, so a sweep touches the network once per pinned task and never on
      the metered path. `trapA-pinned-click-01` pins
      `pallets/click@150d1071d69c5cdad7de78590013ffe56cf9e3bb`.
      **Every refusal is a throw, not a fallback**, because the quiet alternative
      produces a report that *looks* pinned: `repo` without `sha`, a task carrying
      both a pin and a `fixture`, a non-`https` remote, and — the load-bearing one
      — a branch or tag in `sha`, refused because a ref moves and a report pinned
      to one records which repository answered but not which tree (F7).
      **Scored in three directions on the real tree**, so the oracle is known to
      discriminate rather than assumed to: the pristine clone has 0 changed files,
      the untouched tree fails `capability_pass`, the upstream ground-truth fix
      (`1f9cd54`, the direct child of the pin) passes both axes, and appending to a
      `forbidden_files_modified` path — exactly what the real `bc32a92` pager
      refactor did — drops `discipline_pass` to false at 0.667.
      *Verify (the SHA in a report) is NOT satisfied and is not claimed:* there is
      no report, because there has been no run. What this step asked for — a repo
      pinned at a SHA that the harness can actually run — exists.
      <!-- verify: BENCH_AB_PINNED_NETWORK=1 npx vitest run tests/scripts/bench_ab_pinned_repo.test.ts -->
- [-] **Tasks:** deliberately mixed — over-build-trap tickets **and** irreducible
      CRUD **and** this package's own discipline family — so the report can show
      where the effect lives and where it is honestly zero.
      *Verify:* the per-task table shows both.
      **TRANSFERRED 2026-08-20** to [`stubs/road-to-solution-minimalism-full-tier-run.md`](stubs/road-to-solution-minimalism-full-tier-run.md) item 1 — council disposition A on
      the parent blocker, outcome state `transferred`; probe: ≥ 30 tasks declaring
      `repo` + `sha`, at 1 today. One pinned task exists
      (`trapA-pinned-click-01`); the substitute criterion asks for ~30. Authoring
      them is ordinary work and is NOT blocked. What is blocked is *calibrating*
      them: the schema's own `notes` field asks why a trap is a trap, and that is
      a claim about model behaviour, so an oracle nobody has run a trial against
      is an assertion rather than an instrument. The one pinned task says
      `UNCALIBRATED` in as many words for exactly that reason. Thirty unvalidated
      oracles would be thirty unverified claims, which is the shape F2 and F7
      both warn about — so the count travels with the run it needs, and the
      transfer names its producer and its probe instead of leaving a number here
      that nothing checks.
- [x] **Arms:** vanilla · package (ladder off) · package + ladder ·
      **bare-principle control** (the seven-word prompt, F6 — isolates what the
      routed floors add over the naked principle; its safety-tier result is the
      exhibit for why the floors exist) · inert-prose placebo.
      *Verify:* per-trial injection audit in both directions for every arm.
      <!-- verify: npx vitest run tests/scripts/bench_ab_v2_run.test.ts -->
      All five arms now exist in `ARMS`; 29 assertions green.
      **"package (ladder off)" needed an interpretation, and it is a measurement,
      not a reading.** Phase 1 shipped the ladder *into*
      `improve-before-implement`, so there is no build of the package without it —
      but that rule is `type: auto`, `tier: 2b`, `alwaysApply: false`, triggered on
      the keywords `refactor|implement|migration`, and absent from
      `dist/router.json`'s preloaded tier lists. So under `package` the ladder
      reaches the model **only when a task's own wording happens to trip a
      keyword** — per-task, unmeasured. That is finding F1's failure class, where a
      null cannot be told apart from an activation gap. The pair therefore ships
      as: `package` = the shipped reality (trigger-dependent), `package-ladder` =
      the identical config with the ladder rule body injected via sysprompt so it
      is guaranteed in context. The contrast measures the ladder, not the trigger
      set. A projection-level ablation arm would measure the same thing more
      directly and is a bigger change than an arm definition; it is not needed for
      this contrast to be valid.
      **The bare-principle text is authored here, not borrowed.** F6's exact
      seven words are recorded nowhere in this tree, and reproducing an external
      prompt verbatim is what `code-provenance` forbids — so the arm ships a
      re-derived one-sentence principle. Nothing about its function depends on the
      exact wording: its job is to be floor-free and small, and the tests assert
      exactly that (no floor routed, no ladder rung, one line, < 200 chars).
      **One audit-shape decision, surfaced rather than smuggled.** The cross-arm
      direction of the audit requires a lift arm's prompt footprint to sit ≥ 1.2×
      above its paired vanilla run, which catches a treatment surface that
      collapsed to baseline. A one-sentence arm has no such lift by construction,
      so including it would fail legitimate runs — the failure the ratio's own
      calibration note warns about from the other side. `bare-principle` therefore
      declares `min_lift_ratio: null`, which narrows its audit to the **text**
      direction; that direction is checked both ways and pinned by tests, so the
      arm is never unaudited. `lift_audit_arms` is exported for exactly this
      reason: the exclusion set is asserted, not trusted, because silently
      widening it would be a reach reduction in the gate.

- [x] **Endpoints:** added lines from `git diff`; tokens as the **sum** of
      input + cache + output (a metric mismatch here is the known reporting
      trap); cost; wall-clock; the existing discipline rubric; a **safety tier**
      (adversarial-input execution on surgical tasks); and — per F8 — a
      **search-adherence endpoint**: did the run demonstrably consider a cheaper
      existing mechanism before writing new code (rubric-judged, k=2)?
      *Verify:* the search-adherence endpoint is defined and pre-registered
      before the first paid run; a size-only report does not satisfy this step.
      <!-- verify: npx vitest run tests/scripts/bench_ab_v2_stats.test.ts -->
      **Partially delivered, and staying open on purpose — the named *Verify* is
      satisfied but it is necessary, not sufficient.** Search-adherence and the
      safety tier are now defined and pre-registered as T5 and T4 in
      [`ab-v2-phase3-PREREG.md`](../../internal/bench/ab-v2-phase3-PREREG.md), which
      is exactly what this step's Verify asks for. Four of the seven endpoints are
      live: added lines and wall-clock were already there, tokens-as-**sum** landed
      with delta #2, and **cost landed here** (delta #6) — `cost_by_arm` prices the
      four buckets separately from `pricing.yaml`, because a blended rate over a
      token total is a different number and the buckets differ in price by up to
      125×. Two properties worth naming: an unpriceable model yields `null`, never
      `0` (a zero reads as "this arm was free", which is a different claim from
      "we cannot price it"), and Table 3b prints how many days old the prices are
      **measured against the report's own stamp**, so re-rendering a fixed artefact
      cannot change its numbers. The suite pins the 50×-apart mix case, the
      errored-run exclusion, the unpriceable direction, and the age arithmetic.
      **Not delivered:** the safety-tier and search-adherence *scorers* (both are
      rubric-judged, so both need model calls and their own oracles), ~~and the
      complexity endpoint (delta #11)~~. Flipping this step because its Verify passes
      would repeat the mistake refused one step down for Reproducibility — a step's
      Verify is a check on the step, not a substitute for it.
      **2026-08-16: the complexity endpoint is delivered** (delta #11), and added
      lines is now a first-class endpoint rather than a by-product of the
      `max_lines_changed` oracle — `diff_line_counts` splits the existing tally so
      T1 reads *added* while the oracle keeps its sum, from one implementation.
      Six of seven endpoints are live. The step stays open on the two
      rubric-judged scorers, which is the honest remainder.
      **2026-08-17: the last two endpoints are delivered and the step closes —
      but its own remainder sentence was wrong, and the correction is why the
      work was affordable.** "Both are rubric-judged, so both need model calls" is
      not what the pre-registration says: its threshold table tags **only T5**
      `rubric-judged`, and defines T4 as *"safety tier (adversarial-input
      **execution** on surgical tasks)"*. T4 therefore needs no judge, no key and
      no spend — it runs a hostile input against the code a trial produced and
      reads the exit code. Measuring the premise before building against it is the
      lesson this roadmap already records twice; this is the third.
      **T4** — `_lib/bench_ab_safety_tier.ts` + `bench_ab_v2_safety.ts`, plus the
      `safety_oracle` corpus key and three new `safeF-guard-*` tasks whose fixtures
      carry a guard one comment away from the line the task asks about (F6's exact
      shape). The tier is *exactly* the tasks carrying the key — no second
      `surgical` marker to fall out of sync. Each probe is calibrated by mutation:
      pristine → guard held, delete the guard block → breach, break the module →
      **unmeasured**. That third state is the load-bearing one; collapsing it into
      a failure would report every crashed trial as a dropped guard, on the one
      endpoint the record treats as a disqualifier.
      **T5** — `_lib/bench_ab_search_adherence.ts` + `bench_ab_v2_search.ts`, at
      the pre-registered k=2, crediting a rubric item only when both judges credit
      it, with one retry and then `null`. It needed a preserved **transcript**,
      which the runner did not write: it now lands beside the clone rather than
      inside it, because a transcript written into the workspace would appear as a
      file the run created and T5's evidence would corrupt T1's. Reports from
      sweeps before this change say so explicitly instead of scoring zero.
      **What this does NOT claim.** Neither scorer has been run against live
      judges or a paid sweep, and Phase 3 still cannot report: deltas #9/#10
      remain open. What closed is the endpoint definition and its producer — the
      thing this step actually asked for.
- [-] **Hygiene:** escalation ladder self-test → 10-task smoke → k=3 → full,
      **publishing nothing below full** (F4); paired non-parametric tests;
      errored pairs dropped from both arms.
      *Verify:* the report states which tier it is from.
      **TRANSFERRED 2026-08-20** to [`stubs/road-to-solution-minimalism-full-tier-run.md`](stubs/road-to-solution-minimalism-full-tier-run.md) item 2 — council disposition A on
      the parent blocker, outcome state `transferred`; probe: a `Gate verdict:` in
      `docs/benchmark.md` from a pinned report with a non-empty `sha`, none today. The ladder and the statistics
      are implemented; what is missing is a run. This is the one part of the
      substitute criterion that genuinely depends on something no repository
      change supplies: metered model calls. No credential is present in the
      execution environment that closed the rest of this roadmap
      (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_AUTH_TOKEN`
      are all unset), and firing a paid sweep is a Hard-Floor action needing
      confirmation **on the turn it fires** — the 2026-08-14 pre-authorisation
      records the *decision*, and a recorded decision is not a live confirmation
      ([`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)).
- [x] **Reproducibility deliverables, first-class not afterthoughts:** a no-API
      `--selftest` entry point, the pinned SHA, preserved per-run workspaces for
      offline re-scoring, and a one-page reproduce doc. The record shows the
      harshest critic becomes the most-cited validator once handed the
      reproduction path.
      *Verify:* `--selftest` runs green with no network and no key.
      <!-- verify: npx vitest run tests/scripts/bench_ab_v2_run.test.ts -->
      **Three of the four landed; the step stays open on the fourth, which is not
      ours to close.** The named *Verify* is satisfied — `--mode selftest` exits 0
      with `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_AUTH_TOKEN`
      stripped from the environment, and it substitutes only the model call: the
      fixture clone, the deterministic scorer, the per-trial activation stamp, the
      cross-arm audit, the report writer and every exit code run for real
      (delta #8). Preserved per-run workspaces landed with it (delta #7): keyed
      `task|arm|seed`, path recorded on each trial, 20 trials → 20 distinct
      workspaces where the old task-only key left one. The one-page reproduce doc
      is [`internal/bench/REPRODUCE-ab-v2.md`](../../internal/bench/REPRODUCE-ab-v2.md).
      **The pinned SHA cannot be delivered here, and marking it done would be the
      false claim F7 exists to forbid.** There is nothing to pin: the corpus has no
      `repo`/`sha` keys and every fixture is a self-contained in-repo tree, so a
      pinned SHA requires delta #9 — which the S0.3 sequencing ships together with
      #10 (~30 hand-written oracles, sized large), because a harness pointed at a
      real repo with no oracles runs nothing. That pair is the **Repo** and
      **Tasks** steps above, both spend-gated. Hence the `blocked-by` annotation
      rather than a `[~]`: this is blocked on a gate, not deferred by choice, and
      the difference matters to the archival gate.
      The reproduce doc states this residue in its own closing section instead of
      implying a full reproduction path exists.
      **Closed 2026-08-20 — the fourth deliverable landed.** The struck reasoning
      above was accurate when written and is left standing rather than rewritten:
      the corpus now carries `repo`/`sha` keys and one task pinned to
      `pallets/click@150d1071d`, so a pinned SHA is deliverable and delivered. The
      claim this step makes is about the *reproduction path*, and all four of its
      named parts now exist. It does **not** claim a run happened; the tier and
      the report are the Hygiene step's, transferred in § Outcome (B).
- [x] **The size claim is a metric PAIR, not a single number (F9).** The ladder
      arm must lower added lines **without raising median cognitive complexity
      per changed function**. Lines down **and** complexity up is golfing, and it
      **fails the size criterion** even at p<0.05 on lines alone. Cognitive
      complexity is computed deterministically per stack by mature tooling, needs
      no model call, and — because the per-run workspaces are preserved — can be
      **retro-fitted onto already-completed runs** via offline re-scoring. The
      anti-golfing gate therefore costs almost nothing to add.
      *Verify:* the scorer refuses to report a size win when the complexity arm
      regressed; prove it by feeding it a deliberately golfed fixture.
      <!-- verify: npx vitest run tests/scripts/_lib_bench_ab_complexity.test.ts tests/scripts/bench_ab_v2_stats.test.ts -->
      **Delta #11 LANDED 2026-08-16 — the endpoint exists, and the refusal is
      proven on a golfed fixture rather than asserted.**
      `_lib/bench_ab_complexity.ts` computes Campbell cognitive complexity per
      function over the ABI-pinned tree-sitter pair the repo already carries
      (`code_graph/loader.ts`), covering the three languages the corpus actually
      contains. It is a new implementation over an **existing** parser, not a new
      dependency: the ladder was walked and recorded in the module header —
      nothing in-repo computes complexity, the eslint built-in complexity rule is
      *cyclomatic* (the metric F9 rejects, since it scores a flat `switch` above
      a triply-nested `if`), and `eslint-plugin-sonarjs` is uninstalled and
      JS/TS-only, which would leave the PHP fixtures unmeasured.
      **It is calibrated, not merely written.** The suite scores Campbell's own
      worked examples (`sumOfPrimes` = 7, `getWords` = 1) plus hand-derived cases
      whose arithmetic is written out per case, so a future edit that shifts a
      score by one has to argue with the derivation. Two deviations are named in
      the module rather than buried: no recursion increment, and a nested closure
      is its own observation instead of rolling into its parent.
      **The refusal path is pinned by mutation, not by coverage.** Disabling the
      anti-golfing branch reds 2 tests; disabling the safety disqualifier reds 3.
      `size_claim_verdict` reaches `PASS` through exactly one path — all three
      endpoints measured, neither disqualifier fired, T1 met — and an **absent**
      endpoint returns `INCONCLUSIVE`, never a pass, which is what stops this
      from degrading into the lines-only report F9 forbids.
      **Retro-fit delivered too:** `bench_ab_v2_complexity.ts` re-scores a
      finished report off its preserved workspaces (delta #7), so a sweep that
      already cost money gains the endpoint without a re-run. It resolves each
      trial's fixture **from the corpus by task id**, so it needs nothing stamped
      into the report and every sweep that already ran is re-scorable as it
      stands.
      **One mechanism, not two — decided against this roadmap's own subject.**
      The first draft also had the runner stamp a `fixture` key onto each record
      so reports would be self-describing, with the corpus lookup as a fallback.
      The corpus already covers every report, so the field was a second mechanism
      for one fact, and its reader would have had no producer for any report
      written to date — the exact shape the completion review flagged for the
      safety tier. Removed rather than kept: this is the ladder's *reuse* rung
      applied to the roadmap's own change.
- [x] **Pre-registered thresholds (F3-calibrated, weak-host arm):** ladder arm
      vs. package arm — median added lines ≤ **−10 %** at p<0.05, **and** no
      significant rise in median cognitive complexity per changed function,
      **and** no significant regression on the discipline rubric, the safety
      tier, or the search-adherence endpoint → the ladder graduates to
      default-on. Miss any one → it stays opt-in and the null is published with
      the same honesty labels the existing nulls carry.
      *Verify:* thresholds are committed before the full run.
      Committed as [`internal/bench/ab-v2-phase3-PREREG.md`](../../internal/bench/ab-v2-phase3-PREREG.md),
      in the shape the tree's four existing `*-PREREG.md` records use (binding
      threshold table with a per-row "why this number", plus reopen terms).
      **Registered while the run is impossible, which is the strongest form of the
      guarantee**: thresholds fitted after seeing data are not thresholds, and both
      halt gates still stand, so there is no data to fit to. T1 is calibrated to the
      independent −15.4 % (p=0.088) rather than the source's −54 % headline, with
      the reason recorded per row.
      Two things the record states that this step's text did not, because writing
      them down is what pre-registration is for: **T1 cannot be evaluated without
      T2's endpoint** (the size claim is a pair, so half a pair is no result, not a
      partial one), and **granting the spend does not make the run possible** —
      preconditions 2–4 there are a harness-extension project, not money.
      A machine-readable companion was deliberately not shipped: no consumer exists
      to read it until the endpoints do, and a JSON nobody reads is the speculative
      form this roadmap argues against. Enforcement lands with the endpoints.
- [x] **Goodhart guard (hard, applies to any competitive setup, agent or human):**
      a size metric is a **measurement**, never a **scored target**. The safety
      tier is a disqualifier, not a side metric: an arm that saves a line and
      drops a guard has lost, not won (F6).
      *Verify:* the scoring code cannot rank an arm above another on size alone
      when its safety tier regressed.
      <!-- verify: npx vitest run tests/scripts/bench_ab_v2_stats.test.ts -->
      **Landed 2026-08-16, structurally rather than as a documented intention.**
      Two separate properties, both asserted:
      (a) `gate_verdict` — the L4 gate — reads capability, discipline and status
      buckets and **nothing else**, so no arm can be ranked above another there
      by producing a smaller diff. It declares `size_considered: false` and names
      the one function that owns the size question; the test builds two arms tied
      on capability and discipline and 500× apart on added lines, and asserts the
      gate stays `FALSIFIED-OR-INCONCLUSIVE`.
      (b) `size_claim_verdict` checks the safety tier **first**, before any
      endpoint can produce a win. A golfed *and* unsafe arm reports the
      disqualifier, not the golfing — the ordering is itself a test, because a
      guard that fires only when nothing else does is not a disqualifier.
      An unmeasured safety tier is `INCONCLUSIVE`, so the guard cannot be skipped
      by simply not implementing T4's scorer.

## Untracked prerequisite work (landed 2026-08-05)

S0.3 deltas **#1–#5** landed ahead of any spend, exactly as the Phase-3 halt
note requires. They close **zero checkboxes** — every open step above is gated
on the spend grant or on deltas #9/#10/#11 — so the dashboard does not move.
Recorded here rather than left invisible, and deliberately not spun off into a
roadmap of its own: a meta-roadmap tracking untracked work is the recursive
process debt this roadmap argues against.

| # | What landed | Where |
|---|---|---|
| 1 | Per-trial injection audit + the paired cross-arm audit; violations fail the sweep with exit 2 | `_lib/bench_ab_activation.ts`, wired in `bench_ab_v2_run.ts` |
| 2 | `tokens_breakdown` preserved on every trial record (unblocks #1 and #6) | `bench_ab_v2_run.integrity_fields` |
| 3 | Model-id read back from the CLI envelope's `modelUsage`; bare aliases refused before spend | `bench_ab_task_runner.ts` (`models_seen`), `bench_ab_v2_run.ts` |
| 4 | Sweep-level `--max-usd` abort, priced per bucket from `internal/bench/pricing.yaml` | `SweepBudget`, `collect_records` guard |
| 5 | Errored-pair attrition per arm-pair and per `status_bucket`, with the drop asymmetry | `bench_ab_v2_stats.compare` → report Table 4 |
| 11 | Cognitive complexity per changed function (T2), added lines as a first-class endpoint (T1), the anti-golfing + safety-disqualifier verdict, and an offline re-scorer for finished sweeps | `_lib/bench_ab_complexity.ts`, `_lib/bench_ab_scoring_v2.diff_line_counts`, `bench_ab_v2_stats.size_claim_verdict`, `bench_ab_v2_complexity.ts` |

**#11 is the exception to this section's own framing: it DOES close checkboxes.**
The paragraph above says the deltas close none, which was true of #1–#5 — those
made a run publishable without making one possible. #11 closes the metric-pair
step, the Goodhart guard, and the golfed-fixture acceptance criterion outright,
because those three ask for the endpoint itself rather than for a run that uses
it. Landed 2026-08-16.

**Why now, with the phase halted.** The harness has already produced one full
set of invalid nulls from an undetected activation leak, and the only activation
field on a record — `injected_chars` — is the length of a file the harness wrote
itself and is `0` by construction for the `package` arm. A disabled or
version-drifted plugin would have degraded every treatment run to `vanilla` and
produced a report that looks identical to a real one. These five close that hole
before the $150–250 grant is spent against it, not after.

**What did NOT change.** Both Phase-3 halt gates stand: the spend grant is the
user's to give, and #9 (pinned external repo), #10 (~30 oracles) and #11 (the
cognitive-complexity endpoint) are still absent. No effect claim, no number, and
no threshold was added anywhere.

## The principle-admission gate (this table is the scope boundary)

A minimalism rule attracts principles. Collecting them is how it becomes the
principle soup it exists to replace, so admission is a test, not a preference:
**a disjoint axis** (not already carried by scope, shape, or the floors)
**+ measurable or machine-checkable + maps onto infrastructure that already
exists here.**

Six admissions are folded into Phases 1–3 above: the fence and the coverage
signal (deletion side), reversibility (decision weight), the interface-surface
rationale, the rewrite-context trigger, and the profiler clause. A seventh —
**Gall's Law** (a working complex system evolves from a working simple one, never
from a designed-complex one) — passed the test as *rationale* but its only
landing site is the thinnest-vertical-slice argument in the **parked** product
vertical, so it is admitted and parked with its phase rather than smuggled into
the engineering rule where it has no work to do.

Everything below was tested and **rejected**, with the reason, so it does not
come back as a suggestion:

| Rejected | Why |
|---|---|
| **Boy Scout Rule** ("leave the code better than you found it") | An **anti-borrow**, and the most interesting result of the sweep: excellent for humans, and in agent hands it is *institutionalised scope creep*. It collides head-on with `minimal-safe-diff`'s no-drive-by-edits rule. |
| Occam's razor · not-invented-here avoidance · Muntzing | Restatements of ladder rungs already in Phase 1. |
| Principle of least astonishment · CUPID · "write idiomatic code" | Already carried by `standards-from-config` plus house conventions. |
| Postel's Law ("be liberal in what you accept") | Modern security guidance **inverts** it — be strict in what you accept. Admitting it would fight the floors. |
| SOLID · Law of Demeter, as rules | Per-principle injection is rejected outright (see non-goals); these are linter territory, not rule text. |
| Worse-is-better · Wirth's law · "grug-brained developer" | Philosophy and culture, not checkable. The last is licensed as *tone* material for a future review persona and nothing more. |

**Closure:** every direction of the minimalism space now has a named guard and
each guard has a check — under-building → floors + safety tier; over-building →
scope ladder + added lines; over-dense building → shape axis + cognitive
complexity; wrong deletion → fence + coverage signal; irreversible shortcut →
reversibility clause + decision-record routing; rewrite euphoria →
second-system trigger. Further principles enter only through the test above.

The next candidate axis, if one is ever wanted, is **duplication as a measured
endpoint** (a copy-paste detector rather than a DRY slogan) — and it is
explicitly not to be touched before Phase 3 has run, because adding a fourth
axis to an unmeasured rule is the planning-instead-of-executing failure this
whole roadmap argues against.

## Gated follow-ups (not open work — do not start these)

Named here so the information is not lost, each with the condition that un-parks
it. None is a step in this roadmap.

- **Deferred-simplification marker, enforce-or-kill.** Un-parks only after
  Phase 3, whose transcripts are the free adherence sample. Pre-registered kill
  condition: marker adherence below a threshold materially better than the
  independently measured 1-in-80 means prompt-side paperwork does not happen —
  publish that number and ship the convention as human/reviewer tooling only.
  A deterministic pattern detector is a further spike behind its own precision
  gate, and a per-project allowlist is load-bearing: a nudge tool without a
  false-positive escape hatch trains users to ignore it. If that detector is ever
  built, its **strongest signal is a cognitive-complexity threshold** — the one
  part of over-build detection that needs no heuristic at all, because the
  per-stack tooling is mature and deterministic. Heuristic shapes
  (single-implementation interface, config key nobody reads, wrapper that only
  delegates, dead flag) rank below it, not above.
- **Adoption exhibit.** Un-parks on Phase 3 passing. It does **not** get its own
  roadmap — the transcript pair and the rendered artefact belong to
  [`road-to-adoption-without-narrative-debt`](road-to-adoption-without-narrative-debt.md),
  whose distribution steps are already open. The framing recorded from the
  sources: the ecosystem's second-most-upvoted unanswered question is "how are
  you testing skills / ensuring quality?", and this package is the answer by
  existing — so the percentage is supporting evidence, never the headline.
- **Benchmark-obsolescence lifecycle** —
  [`later/road-to-benchmark-obsolescence-lifecycle`](later/road-to-benchmark-obsolescence-lifecycle.md).

## Non-goals (decided, with reasons)

- **Runtime intensity levels / statusline / mode flag file.** A writable runtime
  state surface contradicts the machine-checked zero-runtime-daemon posture; the
  install-time discipline profile already covers the knob. Revisit only if a user
  asks.
- **Host-adapter breadth race.** Every extra adapter is standing drift debt.
  Demand-driven only — the ladder's own first rung applies to this roadmap.
- **Product / PO vertical pilot.** The artifact-creation pattern does generalize
  (does it need to exist → does it already exist → does a standard mechanism
  cover it → thinnest form → full build), and the story-shaped anti-patterns are
  real. But a second vertical before the engineering one has any result is
  exactly the speculative breadth the first rung forbids — and its evidence class
  is weaker (rubric, not diff: story counts are gameable proxies). Un-parks on a
  published Phase 3 result, and its floors would have to be re-derived per
  domain, never copied from the engineering list.
- **Adversarial builder/deleter pairing and Council minimalism seat.** Same
  speculative-breadth reason, plus the standing Team-Mode Δ=0 null: multi-agent
  setups do not automatically beat a single agent with a good rule. If ever
  revisited, it must be **asymmetric** (a review pass, not a second builder) and
  clear a **cost-normalised** gate against the plain ladder arm. Symmetric
  builder-vs-builder competition is rejected outright: it doubles build cost
  against prior evidence.
- **A separate shape rule, or a skill per principle.** KISS does **not** get its
  own rule — it enters as the shape clause plus the precedence table inside the
  one rule, because the whole failure mode being avoided is parallel principles
  with no resolution order. One collection in the wild ships a separate skill
  for each of KISS, DRY, SOLID, YAGNI, Law of Demeter, Boy Scout and more. Two
  reasons that is the wrong shape, not merely a different one: the principles
  **overlap**, so parallel injection with no precedence rule produces
  contradictory simultaneous instructions; and **none of them publishes an
  evaluation result**, so the breadth is unfalsifiable. One rule, two axes, one
  precedence table — and the admission gate above keeps it that way.
- **Copying the source's benchmark statistics.** n=4 means on hand-picked
  tickets is below this package's bar. The setup is borrowed; the statistics stay
  the existing harness's.
- **Uninstall-completeness audit.** A real hygiene question raised by the same
  source (does uninstall remove state written outside the package dir, and only
  when it provably points at our own script?) but unrelated to minimalism.
  Recorded here, owned nowhere yet — it is not scope for this roadmap.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

Written at the point the grandfather exemption lifted, and the lift is the reason
it exists rather than a coincidence. `lint_plan_risk_register`'s substantial-change
heuristic matched its acceptance-criteria heading case-sensitively and
end-anchored, so for this roadmap — whose section is `## Acceptance criteria` —
the hash it compared was sha256 of the empty string, and no edit to these
criteria could ever read as substantial. Fixing the matcher in this change made
this file the one roadmap in the estate whose exemption lifts, which is what
makes the fix shippable here and nowhere else: clearing the resulting red is this
roadmap's own work, not a stranger's.

So this register covers what is still open and what this pass changed — not the
twenty-nine steps that already landed.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The transfer becomes an indefinite deferral and the roadmap reads as delivered | product | Five of six open items now close and the sixth is transferred with a producer and a probe. A reader scanning checkboxes sees a roadmap that looks finished while its proof exhibit has never run — the exact misreading the halt notes above kept having to repair | § Outcome opens by saying archived does not mean achieved and names the residue; no percentage or effect number is rendered anywhere in the file; the re-entry probe is two checkable facts (≥ 30 pinned tasks; a `Gate verdict:` from a report with a non-empty `sha`) so "is it done" needs no judgement | Outcome |
| 2 | The one pinned task's thresholds are treated as validated when no trial has tested them | implementation | `trapA-pinned-click-01` discriminates the real upstream fix from the real later refactors by construction. Whether a model actually takes the lure is a different claim, and a corpus row does not distinguish the two | The corpus entry says `UNCALIBRATED` in as many words and states what would calibrate it; the thresholds are anchored on measured upstream diffstats with the separation written down (72 changed lines against the cheapest lure's 151) rather than chosen; § Phase 3 Repo declines to claim the *Verify* clause about a report | Phase 3 |
| 3 | The pinned remote moves or disappears and the harness loses a task quietly | implementation | The pin is a shallow fetch of one commit from a third-party host. A force-pushed or deleted upstream makes the SHA unfetchable, and a harness that fell back to a fixture would run one tree and report another | `pinnedSpecFor` throws on every malformed or ambiguous pin instead of falling back; a failed fetch leaves no stamp so a partial checkout never reads as warm; the offline re-scorer reports `pinned repo not materialised locally` rather than scoring zero. Residual and unmitigated: nothing vendors a mirror, so an upstream deletion ends that task | Phase 3 |
| 4 | The matcher fix makes other roadmaps' registers go stale on a later edit | implementation | Eight of thirty-two ready roadmaps were invisible to the substantial-change heuristic. With the fix, an acceptance-criteria edit in any of them can now lift a grandfather exemption or stale a `reviewed:` date at a moment nobody planned | Measured over the whole tree before and after: exactly one file changes verdict today, this one, and this register clears it. The predicate now lives in one place (`_lib/ac_heading`) used by both the R1 gate and the R2 dispatcher, so the fourth instance of the same drift cannot be authored by fixing one call site | Acceptance criteria |
| 5 | The shipped ladder is largely inert and the roadmap cannot tell | product | Phase 1 landed the ladder inside `improve-before-implement`, which is `tier: 2b`, `alwaysApply: false`, keyword-triggered and absent from the preloaded router tiers. In a real session the discipline reaches the model only when a task's own wording trips a keyword — F1's failure class, where a null cannot be told from an activation gap | The Arms step states this outright and splits the pair so `package-ladder` injects the rule body via sysprompt: the contrast measures the ladder rather than the trigger set. Residual: whether the *shipped* configuration carries the discipline is unmeasured until a run, and the roadmap claims no effect | Phase 1 |

## Acceptance criteria

- [x] S0.1 produced a rung-by-rung table and the new-vs-extend decision follows
      the stated disjointness test, not preference.
      14 rows, one collision citation each, 12 EXTEND / 2 NEW. The re-scope
      followed the tally, and the repo's own complexity budget corroborated it
      independently.
- [x] S0.2 answered both questions with committed transcript evidence, and any
      real subagent-propagation gap left as its own change rather than being
      fixed here.
      YES / YES. No gap exists, so nothing was handed back and nothing was fixed
      here. The `SubagentStart` finding supersedes a prior "unverified" record.
- [x] The ladder ships as projected rule text (never a description-triggered
      skill), carrying **both axes** and the precedence table, with floors
      routed, zero safety-floor files touched, credits landed, and no effect
      claim anywhere.
      Ships as edits to `improve-before-implement` (a projected rule) and its
      routed guideline — never as a description-triggered skill, per F1. Both
      axes and the precedence ladder are in. Floors are **routed and untouched**:
      `engineering-safety-floor`, `security-sensitive-stop`,
      `senior-engineering-discipline` and `scale-discipline` have zero changed
      lines in this diff. No percentage appears anywhere in it. **Credits:
      cancelled, not forgotten** — see the cancelled Phase-1 step for the three
      reasons and the recorded council split.
- [x] The review lens passes its golden set **including** the lean fixture where
      it must emit the null and the fixture where the simpler form is longer, and
      no `delete:` finding can be emitted without its fence line.
      17 assertions green over five fixtures, with four negative cases proving
      the scorer discriminates. Contract-level, deterministic, no model call —
      the find-the-plant half is stated as needing a scored eval run rather than
      claimed.
- [-] Phase 3 either reports from the full tier with every pre-registered
      endpoint — added lines **paired** with cognitive complexity, plus
      search-adherence and the safety tier — or publishes the null; no number
      appears anywhere except rendered from the pinned report.
      **TRANSFERRED 2026-08-20** to [`stubs/road-to-solution-minimalism-full-tier-run.md`](stubs/road-to-solution-minimalism-full-tier-run.md) item 3 — council disposition A on
      the parent blocker, outcome state `transferred`; probe: item 2's, plus every
      pre-registered endpoint present in the rendered report. All four endpoints
      are implemented; reports rendered from them: 0.
      ~~**Open — blocked, see the Phase 3 halt note.** Spend is the user's grant;
      the metric pair additionally needs a complexity endpoint that does not
      exist yet.~~
      **Corrected 2026-08-16 — both halves of that sentence are now wrong, and it
      is struck rather than rewritten.** The spend grant was given 2026-08-14 and
      the complexity endpoint landed 2026-08-16. The criterion stays **open** for
      a third reason it never named: the run itself needs deltas #9/#10, and two
      of the pre-registered endpoints — the safety tier (T4) and search-adherence
      (T5) — are still unimplemented, so a run made today would report
      `INCONCLUSIVE` on them by design.
      **Corrected again 2026-08-20, and the correction runs in both directions.**
      T4 and T5 are **implemented** — `bench_ab_v2_safety.ts` and
      `bench_ab_v2_search.ts` are in the tree with their probes and their unit
      suites, so the "still unimplemented" clause above is itself now a stale
      claim and is superseded rather than deleted. Delta #9 landed the same day.
      The criterion stays open on the one thing left: a run. It is **transferred**
      (B) — original text, moved steps, producer and probe in § Outcome. No
      re-annotation to a blocker, because the council found there was none:
      [`drain-blocker-dispositions-a`](../evidence/council/drain-blocker-dispositions-a.md).
- [x] The scorer demonstrably refuses a size win that came with a complexity
      regression (proven on a golfed fixture, not asserted).
      ~~**Open — blocked with Phase 3.** The *lens* scorer already demonstrably
      refuses a golfed finding (`shrink:` where `flatten:` was required, proven
      on the `flatten-longer` fixture); the *benchmark* scorer this criterion
      names cannot exist before delta #11.~~
      **Closed 2026-08-16 — delta #11 landed, so the precondition this note named
      is spent.** The struck text is left in place rather than rewritten: it was
      an accurate reading at the time, and the pattern that keeps costing screens
      is a stale claim silently replaced instead of visibly superseded.
      The *benchmark* scorer refuses a golfed win on synthetic paired records: 8
      seeds where the ladder arm's median added lines fall from 30 to 10 while its
      median complexity rises from 3 to 9. Both moves are significant, and the
      verdict is `REFUSED-GOLFING` — the lines win is real, which is what makes
      the refusal load-bearing rather than an artefact of a weak sample.
      **The golfed *fixture* is the unit suite's, and it is a separate artefact
      from the scorer test — stated plainly because the first draft of this note
      implied one pair did both jobs.** There, a flat `classify` and its one-line
      nested-ternary twin are scored by the real parser: the shorter file scores
      strictly higher, which is the property that makes the T2 number able to see
      golfing at all. The scorer test then asks a different question — given such
      a pair of *distributions*, does the verdict refuse — and needs no parser.
      Neither test alone would be enough: a metric that cannot separate the
      fixtures makes the verdict vacuous, and a verdict that ignores the metric
      makes the fixtures decorative.
- [ ] All quality gates pass — see `quality-tools`.
      **Open, and deliberately not closed on a green local run (2026-08-20).**
      What ran, and passed: `task preflight` (exit 0, 22 gates), `task lint-ts`,
      `task check-source-size-budget` (at baseline, no growth — the two new
      modules sit under the ceiling), `lint_plan_risk_register`,
      `lint_roadmap_blockers`, `lint_roadmap_complexity`, `lint_roadmap_ci_steps`,
      `check_roadmap_trackable`, `check_no_roadmap_refs`, `lint_empty_roadmaps`,
      `lint_roadmap_later_disposition`, `lint_bench_ab`, `validate_frontmatter`
      (440 artefacts), `check_references` (1,436 scanned), `lint_evidence_artifacts
      --all`, and 251 vitest assertions across the eight suites this change
      touches. One advisory, non-blocking: no completion-review artefact for the
      branch scope.
      **Why that is still not this criterion.** `task preflight` documents its own
      scope in as many words — it reaches 22 gates while 209 CI-enforced gates run
      neither there nor anywhere else a local push reaches, and it says a green
      preflight is never a prediction that CI will be green. The authoritative
      gate is the remote CI on a pull request, and no pull request exists for this
      branch. Marking this `[x]` on a local subset would be precisely the
      claim-without-its-evidence that F7 and § Risk Register rank 1 exist to
      forbid, in the roadmap that argues for it.

## Blockers

This section was **missing while the roadmap was halted**, which is a defect in
how the roadmap reports itself rather than a detail: the generated dashboard
reads `### blocker:` as its only parse anchor, so it published **0 blockers** for
a roadmap whose only open phase had been stopped for four days by a gate only the
user can clear. A gate recorded as prose is invisible to every consumer of the
dashboard — including the next agent screening for "what can be worked on now",
which is exactly the reader that must not be misled.

### blocker: benchmark-spend-authorization

- **Status:** resolved
- **Owner:** user
- **Resolution (2026-08-14):** **spend GRANTED in-session**, at the pre-registered
  cost sheet — ceiling **$250**, to be passed as `--max-usd 250` so the
  `collect_records` guard aborts rather than overruns. The decision half of this
  blocker is permanently discharged; it never needs asking again.

  **But the run was NOT fired, and the reason is the blocker's own item 3 rather
  than a missing permission.** Deltas #10 (~30 hand-written oracles) and #11 (the
  cognitive-complexity endpoint) are still absent, and the metric-pair acceptance
  criterion **cannot report a pass without #11**. Firing a ~$150–250 sweep whose
  acceptance criterion is structurally unreachable would spend the grant on an
  unpublishable result — the grant unblocks the run, it does not unblock the
  harness, exactly as written. Delta #11 is deterministic and offline
  (implementable with no spend at all), so the cheap work comes first.

  **PRE-AUTHORIZED — executes without further ask when** deltas #10 and #11 land.
  No new spend question at that point; the ceiling above stands.
- **Blocks:** Phase 3 — Pinned public-repo benchmark (the proof exhibit)
- **What to do:**
  1. Read the cost sheet in
     [`solution-minimalism-phase0-spikes § S0.3`](../evidence/investigations/solution-minimalism-phase0-spikes.md):
     30 tasks × 4 arms × 3 seeds on sonnet ≈ 360 runs ≈ 180M tokens ≈
     **$150–250 as a floor**, higher on a real OSS repo.
  2. Decide the grant, and state the ceiling you are granting. The sweep enforces
     it: `--max-usd <ceiling>` aborts the sweep through the `collect_records`
     guard (delta #4), and an unpriceable model plus `--max-usd` is refused rather
     than silently uncapped.
  3. Note what the grant does **not** buy on its own: deltas #10 (~30 hand-written
     oracles) and #11 (the cognitive-complexity endpoint) are still absent, and
     the metric-pair acceptance criterion cannot report a pass without #11. The
     grant unblocks the run; it does not unblock the harness.
- **Resolved when:** the user states a spend ceiling for the Phase-3 sweep, or
  cancels Phase 3 against the cost sheet.

  **Update 2026-08-16 — delta #11 landed, so the pre-authorisation now hangs on
  #10 alone.** The cognitive-complexity endpoint and the anti-golfing refusal are
  in the tree with a calibrated unit suite and mutation-verified guards, which
  removes the reason this grant was left unspent: the metric-pair acceptance
  criterion is no longer structurally unreachable. What remains is #9/#10 (a
  pinned external repo and its ~30 hand-written oracles), tracked as its own
  blocker below rather than smuggled back into this one.

**Removed 2026-08-20 — `phase3-harness-deltas-9-10` was never a blocker.** The
entry that stood here recorded deltas #9 and #10 as a gate on Phase 3. An AI
council disposed of it **A — re-scope, narrowed**: both deltas are ordinary
repository implementation, so the entry was converting *large* into
*unavailable*, and it held five steps for four days on that conversion.
[`drain-blocker-dispositions-a`](../evidence/council/drain-blocker-dispositions-a.md)
carries the verdict and the substitute criterion verbatim. Delta #9 is done; the
remainder is transferred with a producer and a probe (§ Outcome), not
re-annotated to a fresh blocker.

**The repair note this replaces is worth keeping, because the pattern recurs.**
Those five items carried `<!-- blocked-by: benchmark-spend-authorization -->`
while that blocker read **Status: resolved**. Nothing was wrong with the *work*;
the roadmap was **misreporting its own cause**, so the dashboard published
`0 blockers` against five annotated open steps and every feasibility screen
re-derived the same wrong conclusion. A `blocked-by` annotation is a claim with a
shelf life, and nothing re-checks it when the blocker it points at is resolved.
Stated once more from the other side: the fix for that was a *second* entry, and
the second entry was itself a misclassification — so the lesson is not "annotate
more carefully" but "a gate needs an owner outside the repository, or it is
work".

**Hard-Floor note — it belongs to the spend blocker above.** It sat under the
removed harness entry, where "that grant" had no antecedent; with that entry gone
it reads under the entry it has always qualified.

Firing a paid external run **without a grant** is a Hard-Floor action
([`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md));
no autonomy setting, execution contract, or roadmap step lifts it. For *this*
sweep the grant exists (2026-08-14, $250 ceiling, pre-authorised), so the floor is
cleared for it and for nothing else — any other paid run starts from the floor
again.
