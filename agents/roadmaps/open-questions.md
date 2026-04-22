# Open Questions — Roadmap Blockers

> Central decision queue for all active roadmaps. Every entry here blocks
> at least one TODO in a roadmap. Once you answer, the corresponding
> checkbox in the linked roadmap can be ticked and execution continues.

## How to read this file

- **Grouped by roadmap** — scan vertically per area.
- **Each entry is a Question**, not a task. Answer it in the roadmap
  itself (or here and port over), then the roadmap TODO unblocks.
- **Cross-repo items** (everything under `agent-memory/`) are marked and
  cannot be resolved from this repo alone.
- **Autonomy-blocked items** are marked with `🛑 artifact-drafting` —
  these require the full Understand → Research → Draft user flow per
  [`artifact-drafting-protocol`](../../.agent-src.uncompressed/rules/artifact-drafting-protocol.md)
  and cannot be drafted silently.

## Triage summary — 2026-04-22 pass

Across 18 active roadmaps with **461 open TODOs**:

| Category | Count | Actionable by agent alone? |
|---|---|---|
| 🛑 Artifact drafting (new skill / rule / command / guideline / script) | ~280 | No — requires Understand→Research→Draft |
| 🌐 Cross-repo (belongs in `@event4u/agent-memory` or consumer repo) | ~70 | No — wrong codebase |
| 🎯 Strategic decision (phase start, priority, scope) | ~45 | No — user sign-off |
| 🔬 Architecture choice (contract shape, data model, option A/B/C) | ~40 | No — user sign-off |
| ⚙️ Mechanical / verification | ~15 | Yes — handled inline |
| 📦 Implementation of already-agreed spec | ~10 | Depends on size |

Autonomously resolvable right now: **the 15 mechanical items below**.
Everything else surfaces here as a question.

## Verified / shipped during this pass (autonomous, 2026-04-22)

| Item | Roadmap | Result |
|---|---|---|
| No hard dep on agent-memory in manifests | `road-to-memory-self-consumption.md` Phase 0 | ✅ Ticked off |
| No-circular-dep clause in `CONTRIBUTING.md` | `road-to-memory-self-consumption.md` Phase 0 | ✅ Ticked off |
| Skill count drift (roadmap said 116, reality 121) | `road-to-stronger-skills.md` | ✅ Roadmap text updated to match reality |
| `.gitattributes.fragment` template shipped | `road-to-memory-merge-safety.md` Phase 0 | ✅ Committed under `templates/agents/` |
| Arxiv citations (6 skills: Self-Refine, CoVe, Reflexion, ToT, CoT, LLM-as-Judge) | `road-to-autonomous-agent.md` §8 | ✅ All retrofits done, uncompressed + compressed in sync |
| Master-frame link to decision hub | `road-to-agent-outcomes.md` | ✅ Linked |
| Compression sync + hash verification | repo-wide | ✅ `compress.py --check-hashes` clean |
| CI checks (lint-skills, check-refs, check-portability) | repo-wide | ✅ All green |
| `package.json` / `marketplace.json` version drift to 1.8.0 + release guard | release-infra | ✅ Both synced, CI workflow asserts tag == package.json == marketplace.json on tag push; `task release:bump` keeps all three aligned going forward. Externally visible bug (Packagist showed 1.4.0 while git was at 1.8.0) flagged by a repo-review pass on 2026-04-22. |

## Questions by roadmap

### `road-to-trigger-evals.md` (2 open, both strategic)

- **Q1 — API budget + ownership.** Who approves the $50 Claude budget
  ceiling for Phase 2 evals? Who rotates the key? → [Prereq](road-to-trigger-evals.md#prerequisites)
- **Q2 — Model pin decision.** One model or two profiles (Augment +
  Claude-Code)? → [Open Q1](road-to-trigger-evals.md#open-questions)

### `road-to-role-modes.md` (12 open, all 🛑 artifact-drafting)

- **Q3 — Phase 1 start.** Build the `role-contracts` guideline with 6
  contract skeletons? Triggers artifact-drafting-protocol.
  → [Phase 1](road-to-role-modes.md#phase-1)
- **Q4 — Switch conflict rule.** `active_role=reviewer` + user says "fix
  this" → refuse or redirect to developer mode? → [Open Qs](road-to-role-modes.md#open-questions)

### `road-to-engineering-memory.md` (11 open, 🛑 new schemas)

- **Q5 — Four new YAML schemas + four guidelines?** Big Phase 1 commit.
  Confirm scope and naming before drafting. → [Phase 1](road-to-engineering-memory.md#phase-1)

### `road-to-project-memory.md` (25 open, 🛑 settings + schemas + scripts)

- **Q6 — Phase 0 scope.** New `.agent-project-settings` layering plus
  `config-agent-settings` command extension — big structural change.
  Confirm vs. defer. → [Phase 0](road-to-project-memory.md)

### `road-to-agent-memory-integration.md` (15 open, depends on agent-memory repo)

- **Q7 — Can we build the `scripts/memory_status.py` file-fallback path
  before `agent-memory` ships Phase 2 of the retrieval contract?** All
  Phase 0-1 items here assume the contract shape is frozen. → [Phase 0](road-to-agent-memory-integration.md#phase-0)

### `road-to-curated-self-improvement.md` (11 open, 🛑 new template + script + guideline)

- **Q8 — Phase 1 start.** Build `templates/agents/proposal`,
  `scripts/check_proposal.py`, and `guidelines/agent-infra/self-improvement-pipeline`
  in one PR? → [Phase 1](road-to-curated-self-improvement.md#phase-1)

### `road-to-memory-merge-safety.md` (15 open, 🛑 scripts + fixtures)

- **Q9 — Accept this doc as canonical?** Phase 1 item #1 is explicit
  acceptance. → [Phase 1](road-to-memory-merge-safety.md)

### `road-to-memory-self-consumption.md` (7 open after tick, 🛑 + cross-repo)

- **Q10 — Phase 0 Item #1 acceptance.** Reference no-circular-dep clause
  from contribution docs (README / CONTRIBUTING)? → [Phase 0](road-to-memory-self-consumption.md#phase-0-clauses-freeze)

### `road-to-defensive-agent.md` (24 open, 🛑 5 new skills + Wave-2 scope)

- **Q11 — Wave 2 start.** `dependency-risk-review`, `data-exposure-review`,
  `migration-safety`, `queue-safety`, `secrets-and-config-review` —
  five new skills. Batch all, or pilot one? → [Wave 2](road-to-defensive-agent.md)

### `road-to-stronger-skills.md` (70 open, 🛑 skill rewrites + count drift)

- **Q12 — Skill count drift.** Roadmap text references "116-skill total"
  — actual count is **121**. Update roadmap, or were 5 skills added
  out-of-process? → [L266](road-to-stronger-skills.md)
- **Q13 — Rewrite sequencing.** 70 skills across 4 batches (Tier 1-4).
  Which tier first, or parallel? This is months of work. → [Batches](road-to-stronger-skills.md)

### `road-to-autonomous-agent.md` (70 open, 🛑 spike + commands + skills)

- **Q14 — Spike-exec-runtime gate.** Phase 2 is a benchmark gate (≥70%
  token savings). Green-light the spike? → [Phase 2 gate](road-to-autonomous-agent.md)
- **Q15 — `/brainstorm`, `/plan`, `/implement` commands.** Phase 4.
  Three new top-level commands — strategic scope. → [Phase 4](road-to-autonomous-agent.md)
- **Q16 — `/reflect` command + new mcp-builder skill.** Phase 5-6. Big
  surface additions (rename `mcp` → `mcp-usage`, add companion
  authoring skill). → [Phases 5-6](road-to-autonomous-agent.md)
- **Q17 — Arxiv reference retrofit.** Phase 9 adds `## References` to
  ~6 skills. Small, but touches existing skills — confirm OK.
  → [Phase 9](road-to-autonomous-agent.md)

### External adoption feedback (2026-04-22 review pass)

Surfaced by two external review passes of the public repo. First pass was
tech-lead framing; second pass was user/product framing and sharpened the
priorities. Praise and non-actionable framing (productivity, "AI-OS",
"no real thinking") are not captured here — only items that imply a
concrete open decision.

**Headline finding from the second review:** the core failure mode is not
missing features, it is **Time to First Value**. A user who lands on the
README today cannot, within 3 minutes, (a) understand what the package
does in practice, (b) install it, and (c) see one concrete result. Q20–Q22
are three facets of the same problem and should be treated as one bundle.

#### 🎯 Strategic direction (confirmed by maintainer, not an open question)

- **Audience: ALL developers — multi-stack is the goal, not a trade-off.**
  The package targets Laravel, Symfony, Zend, plain PHP, frontend (JS/TS),
  and beyond. The current Laravel density is **Phase 1 reality**, not a
  product choice to stay there. Framing in README/AGENTS.md must reflect
  this: "Laravel-complete today, multi-stack by design, Symfony/Zend/
  frontend on the roadmap." **Do not** position the package as
  Laravel-first / Laravel-only. The second reviewer's "keep Laravel-first"
  suggestion was rejected on 2026-04-22.

- **Q18 (new) — Multi-stack expansion sequencing.** Audience direction is
  locked (all devs) but the ordering of stack coverage is open. Open
  decisions:
    1. **Which stack next after Laravel?** Candidates: Symfony (largest
       PHP overlap, reuses quality-tools / eloquent-like patterns),
       plain PHP (lowest effort, widest reach), frontend TS (largest
       non-PHP audience, biggest authoring gap today).
    2. **Per-stack scope.** Parity target = authoring skills + analysis
       skills + testing + quality tooling, or a narrower "good enough"
       shape per stack?
    3. **Shared vs. forked skills.** Does `quality-tools` split into
       `php-quality-tools` / `js-quality-tools`, or stay unified with
       stack-aware branches?
    4. **Community / maintainer bandwidth** — how much of this is
       internal vs. invited contributions, and how is per-stack quality
       enforced (lint-skills covers form, not framework correctness)?
  → No matching roadmap yet. Needs a new `road-to-multi-stack.md` or
     a Phase addition on `road-to-stronger-skills.md`.

#### 🔴 Open — the Time-to-First-Value bundle

- **Q19 — README refresh (outdated + missing the "I need this" moment).**
  The current README is factually outdated (e.g. skill/rule counts drift,
  version references) AND strategically weak — it describes structure
  ("122 skills, 42 rules, 64 commands") instead of demonstrating value
  ("paste this prompt, get this result"). Target state:
    1. **⚡ 2-Minute Demo section at the very top** — zero theory, pure
       outcome. Three stack-agnostic copy-paste prompts that trigger
       existing commands and produce visible, impressive results fast:

       ````
       ## ⚡ Try this in 2 minutes

       Install, open your AI IDE, paste one of these on any
       project — PHP, TypeScript, Python, whatever:

       1. "Review my current changes"
          → dispatches four specialized judges (bugs, security, tests,
            code quality) in parallel, gives you a consolidated verdict
            with file:line citations. ~60s.

       2. "Open a PR"
          → reads the Jira ticket from the branch name, self-reviews
            the diff, writes a structured description, creates the PR,
            suggests reviewers. ~90s.

       3. "Analyze this project"
          → auto-detects the stack (Laravel, Symfony, Next.js, Express,
            Zend, plain PHP, …), maps the boot flow, inventories
            modules, flags missing docs. ~2min. This is the prompt
            that proves "multi-stack by design".
       ````

       All three must work on a fresh clone with no configuration.
       No "set up your Jira token first" footnotes in the hero.
    2. "Install in 60s, first result in 3 min" section right after,
       with the exact install commands and a link to the longer flows
       doc (Q20).
    3. Kill the feature catalog above the fold — move counts/inventory
       below the demo section. Structure is for people who already
       said "I need this", not for first-timers.
    4. Explicit "Current coverage / Roadmap" table: Laravel ✅,
       Symfony / Zend / plain PHP / frontend 🚧 — so adopters see the
       direction and multi-stack intent, not just today's state.
    5. Reframe the narrative: **"We don't teach you our structure.
       We show you the outcome, then you come back for the structure."**
  → No matching roadmap. Highest externally visible lever right now.
  → Prerequisite: verify that the three demo prompts actually work
     end-to-end on a clean install today, and fix gaps before Q19
     ships. No broken copy-paste in the README hero.

- **Q20 — Real-world usage flows (the missing killer doc).** The repo
  explains structure (skills, rules, commands) but not **flows** — what
  actually happens when a user types "build a feature", "fix this bug",
  "open a PR"? Which skills trigger in what order, how do rules gate,
  what does the final output look like? Without this, the package stays
  theoretical. Options:
    1. New `docs/flows/` with 3–5 end-to-end walkthroughs (feature,
       bugfix, PR, code review, test authoring) — real transcripts,
       not abstract diagrams. Start with Laravel flows (current
       strongest coverage), add stack variants as coverage grows
       (see Q18).
    2. A `/demo` command that runs a scripted scenario on a throwaway
       branch and shows exactly which skills/rules fired.
    3. Both — written flows for skimming + executable demo for trying.
  → No matching roadmap. Second-highest lever after Q19.

- **Q21 — Progressive activation (reframes the earlier "lite preset"
  idea).** The problem is **not** that 122 skills is too many — it is
  that all of them activate at once with no onboarding ramp. Better
  framing: staged adoption levels, designed to be stack-agnostic once
  Q18 multi-stack expansion lands.
    - **Level 1 — Core (≈5 skills):** skill discovery, the one demo
      flow, commit + PR basics. Stack-agnostic. Enough to feel the
      value in a day.
    - **Level 2 — Everyday working set (per stack):** today = Laravel
      (laravel, eloquent, pest-testing, quality-tools, git-workflow,
      receiving-code-review). As Q18 lands, add `level-2-symfony`,
      `level-2-frontend`, etc. — same shape, different skill set.
    - **Level 3 — Full system:** everything, including memory, defensive
      review sub-skills, orchestration, analysis layer.
  Surface the level as `preset: level-1 | level-2-{stack} | full` in
  `.agent-settings.yml`, documented in the README. Touches
  `road-to-project-memory.md` Q6 but is an independent decision.
  → No matching roadmap.

- **Q22 — Immediate-value onboarding (not a tutorial).** Reframe the
  earlier "first-15-minutes" idea. The problem is **not** that new
  users don't understand what a skill/rule/command is. The problem is
  they drop off before they care. Good devs, AI-experienced users, and
  stack-matched developers still close the tab because the package
  doesn't show value fast enough. The goal is not education — it is:

  > ⚡ Holy-shit moment in 2 minutes.

  Concrete acceptance criteria:
    - From fresh clone to a visible, recognizable agent result in
      **under 3 minutes**, on a fresh laptop, with zero configuration
      beyond install.
    - The user has NOT been asked to read any doc. They pasted one
      prompt from the README hero (Q19) and watched it work.
    - After the result, the user is curious about *how* it worked.
      Structure-docs (skills, rules, commands) become pull not push.

  Options:
    1. The three README-hero demos from Q19 **are** the onboarding.
       No separate `/onboard` command. `scripts/first-run.sh` becomes
       a no-op pointer to the README demos.
    2. A thin `/onboard` command that only automates the "pick a
       preset (Q21) + pick one demo (Q19) + run it" wrapper — for
       CLI-first users who never read READMEs.
    3. Both — hero demos for evaluators, `/onboard` for hands-on users.
  → No matching roadmap. Completes the Q19–Q22 bundle. Explicitly
     **not** a "teach the user our model" doc.

**Sequencing note:** Q19 (README) depends on Q20 (flows) and Q21
(progressive activation) to have real content, AND on the three
demo prompts actually working end-to-end. Suggested order:
Q21 preset scaffolding → verify the three Q19 demo prompts work →
Q20 one flow documented → Q22 onboarding wrapper (if needed after
Q19 hero lands) → Q19 rewrites README around the result. Q18
(multi-stack expansion) runs in parallel on its own timeline and feeds
into all four as coverage grows. Doing Q19 first without verifying the
demos produces marketing without substance — and a broken first
impression is worse than no README rewrite at all.

#### 🔴 Open — new capability

- **Q23 — Multi-perspective review skill (brutally honest, 7 lenses).**
  Proposed by the same external review pass: a review skill that
  evaluates a repo / feature / PR / architecture decision from seven
  distinct perspectives and produces one structured verdict. The
  seven lenses:
    1. **Maintainer** — code quality, maintainability, scalability,
       upgrade risk, complexity.
    2. **Developer (User)** — usability, DX, learning curve, clarity
       of structure.
    3. **Senior Engineer** — architecture decisions, trade-offs,
       long-term risks, over- vs. under-engineering.
    4. **Product Owner** — business value, ROI, adoption likelihood,
       market positioning.
    5. **New User (smart, unfamiliar)** — first impression, time to
       first value, confusion points, drop-off risks.
    6. **Critical Challenger** — what is unnecessary, overcomplicated,
       fake complexity, should be deleted.
    7. **Optimizer** — highest-leverage single change, wasted effort,
       what to cut first.

  Overlap with existing skills — must be resolved before drafting:
    - `judge-bug-hunter`, `judge-security-auditor`, `judge-test-coverage`,
      `judge-code-quality` already cover the **code-level** Maintainer
      and Senior Engineer lenses. The new skill must NOT duplicate them.
    - `adversarial-review` already covers the **Critical Challenger**
      lens for single proposals. Relationship unclear — merge, extend,
      or compose?
    - `review-changes` already dispatches to the four judges above.
      Does the new skill become a sibling command (`/review-system`?
      `/review-product`?) or wrap/extend `review-changes`?

  What is genuinely new and not covered today:
    - Product-Owner, New-User, Optimizer, Developer-DX lenses — none
      of the existing judges hit these.
    - **System-level / repo-level / product-level** review scope, not
      just diff scope. The existing judges are diff-oriented.
    - Structured output format with a mandatory final verdict
      (YES / NO / CONDITIONAL) and Top-5-problems + highest-leverage
      improvements sections.

  Open decisions before drafting:
    1. One new skill or a skill + a companion `/review-system` command?
    2. Scope boundaries vs. existing judges — hard split (new lenses
       only) or full multi-lens skill that delegates to existing
       judges for the code lenses?
    3. Input contract — repo URL, local path, feature description,
       PR? All four with detection?
    4. Does this deserve its own roadmap (`road-to-review-skill.md`)
       given the overlap-resolution work, or can it land as a single
       PR against `road-to-stronger-skills.md` Tier 1?

  🛑 **Requires `artifact-drafting-protocol`** — Understand → Research
  → Draft with the maintainer. Do NOT silently draft this skill.
  **Blocked by Q24** (persona architecture) — the seven lenses above
  should be expressed as personas, not hardcoded prose, once Q24 is
  resolved.
  → No matching roadmap. High value, high overlap risk, needs
     explicit scoping decision first.

- **Q24 — Personas as first-class reusable building block
  (architecture, blocks Q23 + Q25).** Q23 hardcodes seven lenses. The
  proposed refine-ticket skill (Q25) hardcodes another six.
  Existing skills already carry implicit personas too:
  `adversarial-review` = Critical Challenger, `judge-*` = specialist
  reviewers, `receiving-code-review` = reviewee. Without a shared
  primitive, every new multi-lens skill re-invents the taxonomy and
  drifts. The architectural question: **introduce `personas/` as a
  first-class artifact kind, or keep hardcoding per skill?**

  Options:
    1. **Full persona primitive (`.agent-src.uncompressed/personas/`).**
       Each persona is a small file — `senior-engineer.md`,
       `product-owner.md`, `new-user.md`, `critical-challenger.md`,
       `optimizer.md`, `stakeholder.md`, `ai-agent.md`, `maintainer.md`,
       `developer-dx.md`, and one or two more. Each file defines the
       persona's focus, questions-to-ask, style rules, and anti-
       patterns. Skills reference personas by name in a
       `personas: [senior-engineer, product-owner]` frontmatter key.
       User invocation supports "one, several, or all personas" per
       call: `/refine-ticket --personas=po,senior-engineer`. Compress,
       linter, and docs-sync need extensions for the new artifact kind.
    2. **Frontmatter tag only, no persona files.** Add
       `personas: [...]` to skill frontmatter as pure documentation /
       discovery tags. No reusable content, each skill still writes
       its own perspective prose. Lightweight, but doesn't solve the
       DRY problem — only the taxonomy problem.
    3. **Status quo — hardcode per skill.** Accept duplication, document
       a shared persona vocabulary in a new guideline under
       `guidelines/agent-infra/` (exact filename TBD), skills cite the
       guideline. Zero infra change.

  Impact on existing artifacts if Option 1 lands:
    - `adversarial-review` → becomes a thin wrapper that invokes
      personas `[critical-challenger]` on an input.
    - `judge-bug-hunter` / `judge-security-auditor` /
      `judge-test-coverage` / `judge-code-quality` → reframed as
      specialist personas, with `review-changes` dispatching to them
      via the same persona contract.
    - `receiving-code-review`, `requesting-code-review` → persona-
      driven variants become possible (e.g. review from `new-user`
      lens for docs changes).

  Open decisions:
    1. Adopt the primitive (Option 1), lightweight tags (Option 2),
       or stay as-is (Option 3)?
    2. If Option 1: which ~10 personas are in the v1 canon? Is there
       a project-local override mechanism for teams to add their own?
    3. Compression semantics — does each persona compress separately,
       or only as part of the skills that cite them?
    4. Do personas get triggers/descriptions (like skills), or are
       they passive reference content?
    5. How does `.agent-settings.yml` interact? A
       `personas.enabled: [senior-engineer, po, ...]` key for default
       lens selection?

  🛑 **Requires `artifact-drafting-protocol`** — new artifact kind =
  new linter rules, new compression handling, new cross-ref semantics.
  Decide BEFORE drafting Q23 or Q25 so both land on the same
  primitive.
  → Likely needs its own `road-to-personas.md` if Option 1 wins.

- **Q25 — New skill proposal: refine-ticket (Jira/Linear ticket
  refinement from Dev/Arch/PO/Stakeholder/Challenger/AI lenses).**
  Proposed new skill (name TBD, `refine-ticket` suggested) that
  simulates a strong refinement session before implementation starts.
  Core promise: don't just critique tickets, **propose concrete
  wording, rewritten acceptance criteria, and a refined ticket
  version**. Six perspectives as proposed:
    1. Developer — implementation reality, ambiguity, edge cases.
    2. Senior Engineer — architecture impact, hidden complexity,
       conventions fit.
    3. Product Owner — clarity, testable acceptance criteria,
       scope boundaries.
    4. Stakeholder — business value, simplification, relevance.
    5. Critical Challenger — fake simplicity, split-worthy scope,
       hidden assumptions.
    6. AI Agent — automation-readiness, reuse references, safe
       execution by coding agents.
  Plus **repository-aware refinement** when codebase context is
  available (compare against existing patterns, naming, modules,
  conflicts, reuse opportunities).

  Overlap with existing skills — must be resolved before drafting:
    - `validate-feature-fit` — already covers duplicate-detection,
      scope creep, architectural misfit, contradictions. The AI-Agent
      and Senior-Engineer lenses of `refine-ticket` overlap heavily
      here. Merge, extend, or hand off to `validate-feature-fit`
      from inside `refine-ticket`?
    - `feature-plan`, `feature-explore`, `feature-refactor` — adjacent
      (feature planning). Is `refine-ticket` the upstream step
      (ticket → plan), or does it swallow parts of planning?
    - `jira-ticket` — implements tickets, doesn't refine them.
      Clear boundary, but both share Jira-input contract — reuse
      the ticket-loading helper.
    - `threat-modeling` — pre-implementation security lens. Does
      `refine-ticket` delegate security concerns to threat-modeling,
      or copy-paste a thin version of that lens?

  Proposed companion (not this Q, but inline note): `estimate-ticket`
  — size / risk / split recommendation / uncertainty. Keep
  `refine-ticket` focused on quality + clarity; split estimation into
  a sibling to avoid bloat.

  Open decisions before drafting:
    1. Persona architecture first (Q24) — then `refine-ticket` either
       hardcodes or references personas.
    2. Input contract — Jira URL, ticket key, pasted text, branch-
       name detection? Reuse from `jira-ticket`?
    3. Output contract — 10-section structure as proposed by the
       external reviewer, or collapsed shape? How does it interact
       with existing PR-review output conventions?
    4. Repo-aware mode — MCP-based, local file read, or agent
       context? Gracefully degrade when no repo is available.
    5. Command + skill vs. skill only? External reviewer proposed both.
    6. Own roadmap (`road-to-ticket-refinement.md`) covering
       `refine-ticket` + `estimate-ticket` as a family, or land under
       `road-to-stronger-skills.md`?

  🛑 **Requires `artifact-drafting-protocol`** — substantial new
  artifact. Blocked by Q24 (persona architecture).
  → No matching roadmap. Strong product-process fit, high overlap
     with `validate-feature-fit` — scope boundary is the main
     pre-draft decision.

## Cross-repo questions (`agents/roadmaps/agent-memory/*`)

All 6 specs (`road-to-consumer-integration-guide`, `road-to-promotion-flow`,
`road-to-decay-calibration`, `road-to-retrieval-contract`,
`road-to-cross-project-learning`, `road-to-agents-md-fix`) are **specs
authored from agent-config for agent-memory**. They are not actionable
in this repo. Open questions are either:

- **Cross-project decisions** carried in each spec under their own
  `Open questions` heading (they live with the spec).
- **Phase transitions** that depend on agent-memory repo work landing.

No entry for these in this file — the spec carries its own.

## How to reopen autonomous execution

After you answer questions above, the agent can unblock specific
phases. Recommended batch sizes:

- **1 roadmap at a time** for Phase 1 (new-artifact) work — keeps
  artifact-drafting-protocol runs focused.
- **Parallel small items** (Q1, Q17) OK if unrelated.
- **Never bundle** cross-repo work into a local PR.

## See also

- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame
- [`README.md`](../README.md) — repo-level overview (if present)
