---
complexity: lightweight
status: ready
---

# Roadmap: Capability discoverability — disposition of "fable-feedback-3"

**Trigger:** User ran external LLMs over `agent-config` + a competitor list
(awesome-agent-skills, wshobson/agents, agent-skills-for-context-engineering,
AgentSkillOS [arXiv 2603.02176], Memento-Skills [arXiv 2603.18743]) asking
"can Sonnet be brought to Fable/Mythos level via skills + memory +
orchestration?". The external model proposed a 6-point integration plan
(`agents/tmp/fable-feedback-3.txt`). **The user already corrected it mid-thread:
drop the `@event4u/agent-memory` dependency entirely** ("agent-config has its
own, better memory skills") — consistent with the council-locked agent-memory
Layer-2 sunset.

**Mode:** Evidence-gated. Every build unit carries a **user-pain gate** (≥2
reports in issues/council/session logs OR reproducible in ≤30 min using
`agent-config`'s own workflows) **and** a kill-switch. Prefer
"reject / already shipped" over cargo-culting a competitor's surface.

> **Council convergence (2026-06-14, claude-sonnet-4-5 + gpt-4o, design mode,
> 2 peer-reviewed rounds).** Both members converged: the feedback nets to
> ~80% "already shipped" or scope-violating; the one substantive *new* idea
> (per-skill Skill-DAG) is **rejected** on a sequencing chicken-egg; the single
> highest-leverage action is `capabilities:index` (the package's coverage is
> invisible to LLMs and humans, which is *why* 4 of 6 points were redundant).
> Synthesis + the adversarial triage corrections are folded into this roadmap.

## Goal

Close the **one real gap** the feedback surfaced and make `agent-config`'s
existing coverage **discoverable** — so future external-LLM reviews stop
re-proposing what already ships — without adopting a runtime agent-loop, an
external memory dependency, or an unproven skill-DAG. The durable disposition
of all 6 feedback points (built / already-shipped / scope-violating / killed)
is recorded here so the same proposals are not re-litigated.

## Terminology — runtime vs. authoring-time (the scope line)

The feedback's value rests on a distinction the package must state explicitly:

- **Authoring-time (in scope).** Code that runs during prompt construction or
  in response to an explicit user command, assembling context/skills for the
  agent to review — `compile_router.py` (deploy-time routing table),
  `work_engine` (assembles directives when the user types `/work`; the agent,
  not the engine, decides whether to execute the next step — verified: no
  `while not task_complete:` LLM loop in `dispatcher.py`).
- **Runtime (out of scope).** Code that executes autonomously *during agent
  operation*, making decisions or LLM calls without per-step human approval —
  auto-retry loops, autonomous tool-calling, self-modifying skill selection.

The package is an **authoring-time orchestration toolkit, not an agent
runtime.** This line decides every item below.

## Phase 1 — Unblockers (cheap, do first)

- [x] **Rewrite `agents/settings/contexts/harvest-policy.md`** to distinguish
      **"automated-but-gated"** from **"manual"**. The current framing implies
      harvest is manual, but `skill_overlap.py`, `audit_overlap.py`, and
      `analyze-reference-repo` already automate it under a council gate. The
      real discipline is the **5-unit plate cap + source-anonymity + council
      gate**, not the absence of tooling. This unblocks the Phase 3 import-CLI
      decision and clarifies every future borrow.
- [x] Add the runtime-vs-authoring-time definitions block (above) to the
      package self-orientation contract (`docs/contracts/package-self-orientation.md`)
      so the scope line is citable, not folklore.

## Phase 2 — `capabilities:index` (the spine, highest leverage)

> Root cause of redundant feedback: coverage is invisible. Fix the class, not
> the instance.

- [x] Generate `CAPABILITIES.yaml` (repo root) from the projection logic —
      capability area → coverage estimate → backing skills/commands → named
      gaps. **Generated, never hand-maintained** (drift-checked in CI like the
      other generated docs). LLM-readable (YAML + one-line descriptions) so a
      future external model queries it before proposing gaps.
- [x] Expose as `capabilities:index` (and/or auto-run in CI). Output is the
      "what this package already covers" surface — the answer to every
      "does agent-config do X?" question.
- [x] **Kill-switch:** abort if generation takes > 5 s (blocks CI) or the index
      exceeds ~50 KB (defeats discoverability — split or summarize instead).

## Phase 3 — Evidence-gated gap-closers (build only on documented pain)

> **Disposition (2026-06-16 — evidence-gated, council-confirmed).** A
> read-only evidence sweep (repo, runtime logs, chat history, council sessions,
> memory store) cleared **none** of the three gates below. Per this roadmap's
> own anti-cargo-cult rule ("do not assume the pain from a competitor
> comparison"), the items are **not built** — marked `[-]` with a falsifiable
> re-open trigger, exactly as the Phase-4 register handles the skill-DAG. The
> AI council (claude-sonnet-4-5 + gpt-4o, design mode, 2 peer-reviewed rounds,
> 2026-06-16) converged: reject a junk-drawer follow-up roadmap (no thematic
> coherence → backlog drift); use the existing `[-]`-plus-re-open convention so
> `count_deferred == 0` and the roadmap closes cleanly without an Iron-Law-3
> hold. `[-]` here means **"not building now; re-opens when the named evidence
> appears"** — not "rejected forever".

- [-] **`context-load-budget`** — the **one substantive gap** (council:
      `token-efficiency` is verbosity-reduction, NOT budget-enforcement; budget
      enforcement is 0% shipped). A skill/rule that stops loading context at a
      token ceiling and surfaces what was dropped.
      - **User-pain gate:** build only if session logs show agents hitting
        token limits / choking on over-large context. If not reproducible in
        ≤30 min, defer — do not assume the pain from a competitor comparison.
      - **Kill-switch:** abort if it adds > 200 ms to prompt construction.
      - **Evidence verdict: NOT MET (0 instances).** No log-documented case of
        an agent hitting a token limit / choking on over-large context; the
        pain was only asserted by a prior council reviewer's hypothetical and
        the competitor comparison. **Re-open trigger:** ≥ 2 reproducible
        session-log instances of token-limit / over-large-context choking.
- [-] **`memory:conflicts`** — detect stale/contradicting memory entries
      (the only plausible memory gap; `memory-consolidation`, `condense-memory`,
      `memory:promote/propose/mine-session` already ship the rest).
      - **User-pain gate:** build only if ≥ 2 conflict-pain reports exist
        (conflicting memory entries causing a wrong recommendation). Otherwise
        defer — cargo-cult risk.
      - **Evidence verdict: NOT MET (0 of ≥ 2).** Only a prospective risk
        statement ("would mis-advise") exists; zero documented wrong
        recommendations traced to conflicting memory entries. `memory:propose`
        already ships supersession. **Re-open trigger:** ≥ 2 reports of
        conflicting memory entries causing a wrong recommendation.
- [-] **Import helper as a developer-only script** (NOT a user command).
      Finish `skill_overlap.py` → a `scripts/` import/normalize/dedupe helper
      for maintainers. **Never `skills:import` in `/help`** — a user-facing
      import command makes the 5-unit plate cap unenforceable (users bypass the
      gate). Lands under `road-to-competitive-borrow.md`'s plate, not a new
      adoption unit here. Gated behind the Phase 1 harvest-policy rewrite.
      - **Disposition: OUT OF SCOPE here + plate closed.** This was a
        scope-boundary statement ("not a new adoption unit here"), never a
        build item for *this* roadmap. Its target plate
        `road-to-competitive-borrow.md` is now **archived**; it shipped a
        duplicate-detection lint gate (`lint-skill-originality`, reusing
        `skill_overlap.py` primitives) but **not** an import/normalize/dedupe
        helper. So the helper is unbuilt and its plate is closed. **Re-open
        trigger:** a fresh evidence-gated harvest plate (`harvest-policy`
        automated-but-gated, Phase 1) surfaces ≥ 1 concrete external-skill
        import that needs normalize/dedupe — at which point it is a new
        developer-only `scripts/` helper under that plate, never a `/help`
        command.

## Phase 4 — Rejected / already-shipped register (do NOT build)

- [-] **Per-skill Skill-DAG metadata (`requires`/`suggests`/`conflicts`/`phase`/
      `risk_level` → auto-chains).** Rejected on the sequencing chicken-egg: a
      pilot can't prove value without metadata, but 230 skills shouldn't be
      annotated without proof — and all three sourcing routes are dead ends
      (hand-author = selection bias; infer from packs = wrong semantic level;
      LLM-generate = runtime creep). "Suggests a chain" is weasel-wording: the
      agent either follows it (runtime, out of scope) or ignores it (metadata
      pointless). **Re-open condition:** external reproduction of the
      AgentSkillOS claim showing a skill-chain beats flat selection by ≥ 20%
      task-success on a corpus where `agent-config` demonstrably fails today.
      Until then, no metadata, no pilot, no roadmap.
- [-] **`@event4u/agent-memory` dependency / mandatory module.** Rejected by the
      user this thread and by the council-locked Layer-2 sunset. Memory stays
      native (file-first skills/commands).
- [-] **Work-Engine as an LLM agent-loop** (intake→…→memory→proposal as
      autonomous control flow). The `work_engine` already ships the
      authoring-time pipeline (dispatcher / orchestration / scoring / directives
      / intent / state); a *runtime* loop violates the scope line above.
      Already shipped as authoring-time; nothing to build.
- [-] **Memento-style proposal/learning loop + `proposal:check/accept`.**
      Already shipped: `skill-improvement-pipeline`, `/memory:propose`,
      `learning-to-rule-or-skill`. Proposal *versioning* is out-of-scope state
      management.
- [-] **Context-engineering skills `context-priority-stack` / `evidence-first-
      planning`.** Already covered by `think-before-action`, RDP notes-first,
      `blast-radius-analyzer`, `scope-control`, `analysis-skill-router`,
      `verify-before-complete`. (Only `context-load-budget` survived — Phase 3.)

## Acceptance criteria

- [x] `harvest-policy` context rewritten (automated-but-gated vs. manual);
      runtime-vs-authoring-time block citable in the self-orientation contract.
- [x] `capabilities:index` ships generated + drift-checked + LLM-readable, with
      the size/latency kill-switch wired.
- [x] Each Phase 3 item is either built **with its user-pain evidence cited**
      and kill-switch wired, or explicitly deferred with the missing evidence
      named — never built on a competitor comparison alone. (All three disposed
      `[-]` with evidence verdict + falsifiable re-open trigger — none built on
      a competitor comparison.)
- [x] The Phase 4 register stands as the durable disposition; the skill-DAG
      re-open condition is recorded so it is not re-litigated without evidence.

## Council notes

- **2026-06-14 — claude-sonnet-4-5 + gpt-4o, design mode, 2 peer-reviewed
  rounds.** Convergence: KILL skill-DAG (sequencing chicken-egg; re-open only on
  ≥20% external reproduction); `capabilities:index` = single highest-leverage
  action (coverage invisible to LLMs); rewrite `harvest-policy` first (the
  "manual" claim is false — automated-but-gated); `context-load-budget` is the
  one real gap (token-efficiency ≠ budget enforcement); import CLI must be a
  developer script, never user-facing, or the plate cap is unenforceable;
  work_engine is authoring-time not runtime (verified, no LLM loop in
  `dispatcher.py`). Adversarial correction accepted: this roadmap's earlier
  triage **over-claimed** Point 2 as "mostly shipped".

## Provenance

- Feedback input: `agents/tmp/fable-feedback-3.txt` (2026-06-14), user-corrected
  mid-thread to drop the agent-memory dependency.
- Ground-truth checked against `src/` at HEAD: 0 of ~230 skills carry
  requires/suggests metadata; `work_engine` dispatcher is authoring-time;
  memory + learning-loop artifacts already ship.
- Sibling roadmaps: `road-to-competitive-borrow.md` (the locked 5-unit harvest
  plate — import helper lands there), `road-to-rdp-discoverability.md`
  (feedback-2's output, different topic).
