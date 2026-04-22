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

- **Q1 — API budget + ownership. ✅ DECIDED (2026-04-22).** Maintainer
  owns both: approves the $50/month Claude budget ceiling for Phase 2
  evals AND rotates the API key. No separate approver or rotation
  policy needed. → [Prereq](road-to-trigger-evals.md#prerequisites)
- **Q2 — Model pin decision. ✅ DECIDED (2026-04-22).** One primary
  model (Claude Sonnet) as the default baseline. Other models (e.g.
  Claude Opus, Haiku, Augment-model) only spun up **on demand** — if
  Sonnet fails to produce usable results, the maintainer explicitly
  requests a second-model run. No permanent multi-profile setup.
  → [Open Q1](road-to-trigger-evals.md#open-questions)

### `road-to-role-modes.md` (12 open, all 🛑 artifact-drafting)

- **Q3 — Phase 1 start. ✅ DECIDED (2026-04-22) — MERGE INTO Q24.**
  Role-modes is semantically adjacent to personas (Q24). Rather than
  building a parallel `role-contracts` system with 6 skeletons, the
  role/mode axis gets absorbed into the persona primitive — likely
  via a `mode:` field on each persona (e.g. `advisory` vs `executing`)
  or a separate mode concept owned by the same linter/compression
  infra. `road-to-role-modes.md` will be folded into
  `road-to-personas.md` when the latter is drafted.
  → [Phase 1](road-to-role-modes.md#phase-1)
- **Q4 — Switch conflict rule. ✅ DECIDED (2026-04-22) — Warn + Ask.**
  When the active role/mode forbids the requested action (e.g.
  `active_role=reviewer` + "fix this bug"), the agent does NOT
  silently switch and does NOT hard-refuse. It surfaces a
  numbered-option warning: `1. Switch to developer mode and apply
  the fix  2. Stay in reviewer mode and only comment`. Aligns with
  `ask-when-uncertain` + `user-interaction` rules. Applies to the
  unified persona/mode system once Q3 folds into Q24.
  → [Open Qs](road-to-role-modes.md#open-questions)

### `road-to-engineering-memory.md` (11 open, 🛑 new schemas)

- **Q5 — Four new YAML schemas + four guidelines. ✅ DECIDED
  (2026-04-22) — Pilot first, scale on success.** Start with **one
  pilot schema + guideline** (`architecture-decisions` — highest
  consumption frequency) end-to-end: schema draft → linter
  integration → guideline → validation against existing entries in
  `agents/memory/`. **If the pilot holds up**, pull the remaining
  three (`domain-invariants`, `incident-learnings`, `product-rules`)
  forward using the same template — goal is to reach the full
  Option-1 coverage, just not in a single big-bang commit. If the
  pilot exposes structural issues, adjust before scaling. Prevents
  throwaway work on schemas that don't survive first contact.
  → [Phase 1](road-to-engineering-memory.md#phase-1)

### `road-to-project-memory.md` (25 open, 🛑 settings + schemas + scripts)

- **Q6 — Phase 0 scope. ✅ DECIDED (2026-04-22) — Adopt two-file
  split with merge helper.** Rationale clarified by maintainer:
    - `.agent-settings.yml` = **personal / per-developer** settings
      (stays gitignored — name, IDE, minimal-output preferences,
      model choice, etc.).
    - `.agent-project-settings.yml` = **team-wide / committed**
      settings (memory config, persona defaults, role-mode defaults,
      rtk filters enabled, etc.). Lives in git, one per project.
    - **Python merge helper** (e.g. `scripts/load_settings.py` with
      `get_merged_settings()`) returns a single unified view:
      project as base + personal as override. All internal
      consumers read through the helper so they see one settings
      object and don't care about the split.
  Implementation shape (open for `road-to-project-memory.md`):
    1. Merge semantics — deep merge vs shallow per key? Which keys
       are personal-only (never overridable by project) and vice
       versa?
    2. `config-agent-settings` command gains a target flag
       (`--personal` / `--project`, default = personal) so the user
       knows which file gets edited.
    3. Template pair — a personal-settings stub and a project-
       settings stub, both under `templates/` (exact filenames
       TBD during drafting). Install script scaffolds both.
    4. Validation — both files validated by the same schema, with
       disjoint key-set rules where applicable.
    5. Migration note for consumer repos that already have a
       `.agent-settings.yml` with team-wide content: command flag
       / helper to move relevant keys into the project file.
  → [Phase 0](road-to-project-memory.md)

### `road-to-agent-memory-integration.md` (15 open, depends on agent-memory repo)

- **Q7 — `scripts/memory_status.py` file-fallback timing. ✅ DECIDED
  (2026-04-22) — Build now, isolate contract surface.** Implement the
  file-fallback path against the local `agents/memory/` layout now.
  Keep the external-retrieval surface **behind a thin adapter**
  (`scripts/memory_adapter.py` or equivalent) so `agent-config`
  stays fully functional stand-alone. When `agent-memory` ships
  its Phase 2 contract, only the adapter implementation is swapped,
  callers stay untouched.
  **Track future adapter-switch work in an open roadmap** — keep
  `road-to-agent-memory-integration.md` open (or spawn a focused
  `road-to-memory-adapter-swap.md`) with a running TODO list for
  the contract-swap phase. Do NOT close the roadmap just because
  the file-fallback is done.
  → [Phase 0](road-to-agent-memory-integration.md#phase-0)

### `road-to-curated-self-improvement.md` (11 open, 🛑 new template + script + guideline)

- **Q8 — Phase 1 start. ✅ DECIDED (2026-04-22) — Split, ship
  template + linter first.** Ship the foundation PR now:
  `templates/agents/proposal/` + `scripts/check_proposal.py`. The
  guideline (`guidelines/agent-infra/self-improvement-pipeline.md`)
  lands **in a separate later PR** once the template schema has been
  validated against real proposals — prevents writing a guideline
  that describes a linter that changes under it.
  **Track remaining Phase-1 work in the roadmap** — guideline +
  any schema iterations stay open on
  `road-to-curated-self-improvement.md` so the follow-up is not
  lost. Scope-overlap check with `learning-to-rule-or-skill`,
  `propose-memory`, `memory-promote` happens as part of the
  template draft (don't duplicate fields).
  → [Phase 1](road-to-curated-self-improvement.md#phase-1)

### `road-to-memory-merge-safety.md` (15 open, 🛑 scripts + fixtures)

- **Q9 — Accept `road-to-memory-merge-safety.md` as canonical.
  ✅ DECIDED (2026-04-22) — Accepted.** The `.gitattributes.fragment`
  template is already shipped and in use, so the design survived
  first contact. Phase 1 is now unblocked for the remaining items
  (merge-driver scripts + fixtures). The doc is the official
  merge-safety reference for memory YAML files going forward.
  → [Phase 1](road-to-memory-merge-safety.md)

### `road-to-memory-self-consumption.md` (7 open after tick, 🛑 + cross-repo)

- **Q10 — No-circular-dep clause reference location. ✅ DECIDED
  (2026-04-22) — CONTRIBUTING.md only.** The clause lives in
  `CONTRIBUTING.md` (already shipped per triage). README stays
  value-first (Q19 TTFV direction) and links to CONTRIBUTING.md
  for anything audience-internal. No prominent README mention.
  → [Phase 0](road-to-memory-self-consumption.md#phase-0-clauses-freeze)

### `road-to-defensive-agent.md` (24 open, 🛑 5 new skills + Wave-2 scope)

- **Q11 — Wave 2 start. ✅ DECIDED (2026-04-22) — Pilot with
  `dependency-risk-review`, scale on success.** Build the single
  pilot skill end-to-end (frontmatter → procedure → examples →
  linter pass → validated against the Q24 unique-questions
  heuristic). **If the pilot holds up**, pull the remaining four
  (`data-exposure-review`, `migration-safety`, `queue-safety`,
  `secrets-and-config-review`) forward using the same template.
  If the pilot exposes overlap with existing
  `judge-security-auditor` / `threat-modeling`, adjust scope
  before scaling. **Track remaining four in the roadmap** — keep
  `road-to-defensive-agent.md` open with explicit TODOs so they
  aren't lost. Goal is still full Wave-2 coverage, just not in one
  big-bang commit.
  → [Wave 2](road-to-defensive-agent.md)

### `road-to-stronger-skills.md` (70 open, 🛑 skill rewrites + count drift)

- **Q12 — Skill count drift. ✅ DECIDED (2026-04-22) — Update text,
  extend auto-sync to cover roadmaps.** Roadmap text gets corrected
  to the true count mechanically. **Finding during triage:** the
  auto-sync already exists — `scripts/update_counts.py` (run via
  `task sync` / `task ci`) keeps counts in sync across `README.md`,
  `AGENTS.md`, and `docs/getting-started.md`. It does **not** yet
  cover `agents/roadmaps/*.md`, which is why `road-to-stronger-
  skills.md` drifted to "116". **Follow-up TODO:** extend
  `TARGETS` in `scripts/update_counts.py` to include roadmap
  files that quote skill/rule/command/guideline counts, so this
  class of drift self-heals in CI going forward. Tracked under
  `road-to-stronger-skills.md` cleanup.
  → [L266](road-to-stronger-skills.md)
- **Q13 — Rewrite sequencing. ✅ DECIDED (2026-04-22) — Reverse
  serial: Tier 4 → 3 → 2 → 1, no gaps.** Start with the lowest-
  impact / lowest-visibility tier and work upward. Two benefits:
    1. The rewrite template stabilizes on low-risk skills first,
       so by the time Tier 1 (highest-visibility) is touched the
       pattern is battle-tested.
    2. Tier 1 rewrites can absorb Q24 (personas) + Q23/Q25
       outcomes since those ship in parallel while Tiers 4-2 are
       being worked through — avoids throwaway Tier-1 work.
  **Strictly serial**, no parallel tiers (drift risk on pattern
  changes). But **no deferral gaps between tiers** — each tier
  flows directly into the next to keep momentum.
  → [Batches](road-to-stronger-skills.md)

### `road-to-autonomous-agent.md` (70 open, 🛑 spike + commands + skills)

- **Q14 — Spike-exec-runtime gate. ✅ DECIDED (2026-04-22) — Green-
  light with explicit baseline prereq.** Spike is approved. **Before**
  the spike runs, define the baseline: which workload, which
  current execution mode, which model (Q2 ✅ Sonnet), which token-
  counting method, which exact percentage target (≥70% savings
  vs. what?). Without a frozen baseline the 70% gate can be
  gamed or misread. Budget + key unblocked by Q1 ✅. If the spike
  clears the gate, Phases 3-9 unlock; if not, the autonomous-
  agent direction is killed cheaply as designed.
  → [Phase 2 gate](road-to-autonomous-agent.md)
- **Q15 — `/brainstorm`, `/plan`, `/implement` commands. ✅ DECIDED
  (2026-04-22) — Adopt as the canonical three, consolidate existing
  feature-* and do-* families into them.** The three new commands
  are kept as-is — simple, self-explanatory, complete as a workflow
  triad. The existing overlapping commands are **not rebuilt side
  by side**; their specializations fold back in as flags / rules /
  modes inside the three.

  **Guiding principle going forward:** commands must stay simple
  and self-explanatory. Specialization comes from flags, personas
  (Q24), and internal routing — not from proliferating near-
  duplicate top-level commands.

  Consolidation map (scope TBD during drafting):
    - `/feature-explore` → folded into `/brainstorm`.
    - `/feature-plan`, `/feature-refactor`, `/feature-roadmap` →
      folded into `/plan` (likely as modes / sub-flows).
    - `/do-and-judge`, `/do-in-steps`, `/do-competitively`,
      `/do-in-parallel` → folded into `/implement` (as
      execution-mode flags, e.g. `/implement --mode=and-judge`).
    - Commands **out of scope** for this consolidation:
      `/create-pr`, `/commit`, `/fix-ci`, `/fix-pr-*`,
      `/agent-handoff`, `/review-changes`, `/judge`, `/threat-model`
      — these are workflow-specific, not brainstorm/plan/implement
      variants. Do not touch in this pass.

  Implementation implications (open for
  `road-to-autonomous-agent.md` Phase 4):
    1. Deprecation path for the old commands — hard-remove or
       alias + warning for one release?
    2. Does the consolidation block on Q24 (personas)?
       `/implement --mode=and-judge` is persona-adjacent.
    3. Documentation — a single "how workflows work" page replaces
       the current scatter.

  🛑 Requires `artifact-drafting-protocol` for the three new
  commands. Overlap resolution happens as part of drafting.
  → [Phase 4](road-to-autonomous-agent.md)
- **Q16 — `/reflect` command + mcp-builder companion. ✅ DECIDED
  (2026-04-22) — Split decision, verify overlap before skipping.**

  **Part A — `/reflect` command:** Skip as a new top-level command
  (overlap with `learning-to-rule-or-skill`, `propose-memory`,
  `memory-promote`, `skill-improvement-pipeline`). **But do NOT
  blind-skip** — run an explicit overlap audit first:
    1. Read the `/reflect` spec in `road-to-autonomous-agent.md`.
    2. Enumerate each behavior it proposes.
    3. For each behavior, identify which existing skill/rule
       already covers it (or note the gap).
    4. **Salvage useful parts** — if `/reflect` adds something
       new (e.g. a specific prompt pattern, a session-end
       trigger, a reflection rubric), fold that into the
       relevant existing skill as an enhancement rather than
       throw it away.
    5. If no net-new content remains, close the item with the
       audit as evidence.
  Tracked as pre-drafting work under `road-to-autonomous-agent.md`
  Phase 5.

  **Part B — `mcp` rename to `mcp-usage` plus mcp-builder companion:**
  Defer. Only worth doing if the maintainer genuinely builds MCP
  servers as a recurring workflow. Current signal is weak
  (`mcp` skill already exists and handles usage). **Trigger to
  revisit:** first real request to author an MCP server against
  this package's conventions, or a consumer project reporting
  the gap. Until then, keep `mcp` as-is.
  → [Phases 5-6](road-to-autonomous-agent.md)
- **Q17 — Arxiv reference retrofit. ✅ DECIDED (2026-04-22) —
  Confirmed, Phase 9 closed.** The 6 skills (Self-Refine, CoVe,
  Reflexion, ToT, CoT, LLM-as-Judge) already have their
  `## References` section shipped and synced (uncompressed +
  compressed). CI is green. No further review needed.
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

- **Q18 — Multi-stack expansion sequencing. ✅ DECIDED (2026-04-22)
  — Broad coverage, parallel tracks, dedicated roadmap.**
  Maintainer wants all three directions pursued as parallel tracks:
    1. **Symfony + plain PHP** (highest code-sharing with Laravel,
       fast wins).
    2. **Frontend — Next.js and/or React** (expands audience beyond
       PHP world, distinct authoring stack).
    3. **Zend / Laminas** (covers legacy migration audience).
  No single "next" stack — this is the backlog, prioritized inside
  a dedicated `road-to-multi-stack.md` roadmap (to be drafted).
  Prioritization inside that roadmap follows maintainer bandwidth
  + external demand signals. Not blocked on a single-stack pick.

  **Architecture baseline for all tracks:**
    - **Shared-by-default.** Stack-agnostic skills (`php-coder`,
      `composer-packages`, `git-workflow`, `quality-tools`,
      `security`, `github-ci`, etc.) stay shared. Only truly
      stack-specific skills (Eloquent, Blade, Livewire, Flux,
      Symfony-messenger, Zend-servicemanager, Next.js-routing,
      React-hooks, …) live in stack-namespaced form.
    - **`check_portability.py`** enforcement stays strict —
      shared skills may not leak project-specific or stack-
      specific names.
    - **New stack-specific skills** trigger `artifact-drafting-
      protocol` individually.
  → Blocks on a dedicated `road-to-multi-stack.md` being drafted
     to own the scheduling + audience-signal collection.



#### 🔴 Open — the Time-to-First-Value bundle

- **Q19 — README refresh. ✅ DECIDED (2026-04-22) — Hero layout
  locked, counts demoted, honest coverage table.**
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

  **✅ SUB-DECISIONS (2026-04-22):**
    - **Hero layout order (locked):**
      1. **Before/After hook** (emotional) — one-line contrast
         showing time saved or confusion avoided on a concrete
         task. Kept nüchtern-factual, no marketing prose. Example
         shape: "PR descriptions: 20 min by hand → 90s with
         `/create-pr`, Jira + diff auto-pulled in."
      2. **⚡ 2-Minute Demo** (the three copy-paste prompts
         above).
      3. **Install one-liner** (`composer require` + `npm
         install` + `task sync`) — explicit, copy-paste ready.
      4. **Current coverage / Roadmap table** (Laravel ✅ ·
         Symfony 🚧 · Zend 🚧 · Next.js 🚧 · React 🚧 · plain
         PHP 🚧 · Frontend JS/TS 🚧) — honest state + direction
         right in the fold.
    - **Skill / rule / command counts** get moved below the hook
      into an "About the package" section for readers who want the
      structural facts. They are not in the headline area.
    - **Before/After framing** stays factual (time, steps, keys
      pressed), not marketing adjectives. No "game-changing" /
      "revolutionary" language.
  → No matching roadmap. Highest externally visible lever right now.
  → Prerequisite: verify that the three demo prompts actually work
     end-to-end on a clean install today, and fix gaps before Q19
     ships. No broken copy-paste in the README hero.

- **Q20 — Real-world usage flows (the missing killer doc). ✅ DECIDED
  (2026-04-22) — Hybrid format, 3 core flows, maintainer-picked.**
  The repo explains structure (skills, rules, commands) but not
  **flows** — what actually happens when a user types "build a
  feature", "fix this bug", "open a PR"? Which skills trigger in
  what order, how do rules gate, what does the final output look
  like? Without this, the package stays theoretical.

  **Format (locked):** Hybrid — one `.md` per flow under
  `docs/flows/`, each containing:
    1. **Real session transcript** (exported from an actual run,
       not constructed). Credibility anchor.
    2. **Structured "what happened here" overlay** above/around the
       transcript — names the skills that fired, the rules that
       gated, the outputs produced, with file:line citations where
       useful.
    3. Short "how to reproduce" footer so a reader can run the
       same flow on their own repo.

  **Three core flows (locked):**
    1. **`feature-build.md`** — full green-field cycle: idea →
       `/brainstorm` → `/plan` → `/implement` → `/create-pr`
       (uses the Q15 consolidated commands).
    2. **`bug-fix.md`** — reactive cycle: Sentry/Jira ticket →
       `/bug-investigate` → `/bug-fix` → `/commit`. Shows the
       investigation → fix → verify loop and how memory / rules
       gate each step.
    3. **`pr-review.md`** — collaborative cycle: branch ready →
       `/review-changes` (four judges in parallel) → `/create-pr`
       → `/fix-pr-comments`. Covers self-review + reviewer
       handling end-to-end.

  **Deferred (follow-ups, not blockers):**
    - `project-onboarding.md` (empty `.augment` → `/project-
      analyze` → curated contexts).
    - `daily-dev-loop.md` (small-scope `/do-and-judge` iteration).

  **Rationale for the three picks:**
    - They cover the three distinct agent phases: planning
      (green-field), reactive (debugging), collaborative (review).
    - They map back to two of the three README hero demos (Q19),
      so a reader who sees the demo can immediately deep-dive.
    - They use commands that survive the Q15 consolidation — no
      rewrites once commands are renamed.

  → No matching roadmap. Second-highest lever after Q19.
  → Prereq: at least one real session per flow must exist to
     export a transcript from. If a flow has no real run yet, run
     it once on a small sample repo before writing the doc.

- **Q21 — Progressive activation (Level 1/2/3 presets). ❌
  REJECTED (2026-04-22) — Not the right lever.**
  The original framing assumed that 122 skills at once is an
  onboarding hurdle. Maintainer rejects that premise: if a user
  installs `agent-config`, they installed it **because** they want
  the full skill set. Starting small is not a feature for them —
  it is friction.

  The onboarding hurdle is already handled by the Q19 + Q20 bundle
  (2-minute demo + three flow docs). "Time-to-First-Value" is
  solved by **showing value fast**, not by **hiding capability**.
  Presets would add a knob the user must understand and eventually
  unlearn — opposite of TTFV.

  **Consequences:**
    - No `preset: level-1 | level-2-{stack} | full` field added
      to `.agent-settings.yml`.
    - No `.agent-src/presets/` manifests.
    - No `/upgrade-level` command.
    - `.augmentignore` stays user-owned, not auto-generated from
      a preset.
    - Stack-aware **defaults** remain out of scope here — if they
      become needed later (e.g. a Next.js user shouldn't load
      Laravel-only skills by default), that is a separate, much
      narrower decision tracked on the multi-stack roadmap
      (Q18), not a preset system.
  → No roadmap. Closed.

- **Q22 — Immediate-value onboarding. ✅ DECIDED (2026-04-22) —
  README demos ARE the onboarding + a thin orchestrated `/onboard`
  command as second entry point.** Goal unchanged:

  > ⚡ Holy-shit moment in 2 minutes.

  **Acceptance criteria (unchanged):**
    - Fresh clone → visible agent result in **under 3 minutes**,
      zero configuration beyond install.
    - No required reading. User pasted one prompt from the README
      hero (Q19) OR ran `/onboard` and watched it work.
    - After the result, structure-docs (skills / rules / commands)
      become pull, not push.

  **Primary path — Q19 README hero:** The three hero demos ARE
  the onboarding for the vast majority of users (IDE-first,
  README-readers, evaluators). No tutorial, no doc, just
  copy-paste → result. `scripts/first-run.sh` is a thin pointer
  to the README demos, not a standalone flow.

  **Secondary path — `/onboard` command for CLI-first users:**
  Not a wrapper that just runs one demo. Instead, a small
  **orchestrated sequence** of 2–3 sensible commands/skills
  chained into one concrete, visible example. The user runs
  `/onboard` on their own repo and sees:
    1. The agent detects their stack + picks a small, safe target
       (one file, one method, one recent commit).
    2. Runs a 2–3 step chain that shows real package value —
       draft sequence (to be locked during drafting):
         - `project-analyze` (small scope: one module or the
           current directory) → prints a mini overview.
         - `review-changes` on the last commit → produces a
           judge verdict with file:line citations.
         - Optional 3rd step: `create-pr-description` in dry-run
           mode → shows the structured PR description it would
           produce, without pushing or creating anything.
    3. Ends with a short "here's what just happened" summary
       that names the skills that fired and links to the Q20
       flow docs.
  → The orchestration IS the demo. The value is not "it ran a
     command" — it is "three commands worked together and
     produced one coherent result".
  → Dry-run / read-only by default. No writes, no pushes, no
     external API calls without explicit flag. Safe to run on
     any repo.
  → Command routing to be drafted via
     `artifact-drafting-protocol` before implementation; the
     2–3-step sequence above is a baseline proposal, not locked.

  → No matching roadmap. Completes the Q19–Q22 bundle.

**Sequencing note (revised after Q21 ❌):** The original plan
assumed preset scaffolding gated Q19. With Q21 rejected, the
sequence is now:
  1. Verify the three Q19 demo prompts work end-to-end on a fresh
     clone (prereq — no broken copy-paste in the README hero).
  2. Q20 — ship at least one flow doc (transcript + overlay).
  3. Q19 — rewrite README around the demos + flow links.
  4. Q22 `/onboard` command — drafted after the README lands, so
     its orchestrated sequence can point at the same flows.
Q18 (multi-stack expansion) runs in parallel on its own timeline
and feeds into all four as coverage grows. Doing Q19 first without
verifying the demos produces marketing without substance — and a
broken first impression is worse than no README rewrite at all.

#### 🔴 Open — new capability

- **Q23 — Multi-perspective review skill (brutally honest, 7 lenses).
  ✅ SCOPING DECIDED (2026-04-22) — Core-6 default, Optimizer +
  New-User as modes. Blocked on Q24 implementation.**
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
  **Blocked by Q24 implementation** (persona files + linter).

  **✅ LENS-TO-PERSONA MAPPING DECIDED (2026-04-22):**
  The seven original lenses are reconciled with Q24's Core-6 as
  follows:
    - **Core-6 personas (default for every review run):**
      Senior Engineer, Product Owner, Critical Challenger,
      Developer (covers Developer / User / DX), Stakeholder,
      AI Agent.
    - **Dropped — absorbed by Core-6:**
      - *Maintainer* — overlaps Senior Engineer + Critical
        Challenger; no net-new perspective. Removed.
    - **Demoted to review modes (flags, not personas):**
      - *New User* — not a distinct voice, a **framing** applied
        to Developer + Product Owner personas. Exposed as
        `--fresh-eyes` (or equivalent) flag that reweights those
        two personas toward first-time-reader confusion.
      - *Optimizer* — not a review voice, a **post-processing
        pass** over the Core-6 output ("of everything we just
        found, which single change has the highest leverage?").
        Exposed as `--rank-by-leverage` flag that appends a
        Top-5-Hebel ranking to the final verdict.
    - **Specialist personas** (Security, Performance, Compliance,
      …) stay possible but are **opt-in per run** (`--with
      security`), never default.

  **Verdict format (locked):** Structured output with a mandatory
  final verdict (YES / NO / CONDITIONAL), Top-5-problems, and
  highest-leverage improvements. Each persona section is labeled
  with the persona id from Q24's persona files so the output is
  traceable back to the prompt that produced it.

  → No matching roadmap. High value, high overlap risk, needs
     explicit scoping decision first.

- **Q24 — Personas as first-class reusable building block
  (architecture, blocks Q23 + Q25). ✅ DIRECTION DECIDED — Option 1
  + two-tier model.** Q23 hardcodes seven lenses. The proposed
  refine-ticket skill (Q25) hardcodes another six. Existing skills
  already carry implicit personas too: `adversarial-review` =
  Critical Challenger, `judge-*` = specialist reviewers,
  `receiving-code-review` = reviewee. Without a shared primitive,
  every new multi-lens skill re-invents the taxonomy and drifts.

  **Decision (confirmed by maintainer):**
    - Adopt **Option 1 — Full Persona Primitive** at
      `.agent-src.uncompressed/personas/`. Each persona is a small
      file. Skills reference personas by name in a
      `personas: [senior-engineer, product-owner]` frontmatter key.
      User invocation supports "one, several, or all personas":
      `/refine-ticket --personas=po,senior-engineer`.
    - **Two-tier model** (Core always available, Specialists opt-in).
      Rejected: splitting into fine-grained developer variants
      (frontend/backend) by default — creates overhead and overlap
      without new signal.

  **Core personas (v1 canon — always loaded by default):**
    1. `developer` — implementation reality, ambiguity, edge cases.
    2. `senior-engineer` — architecture impact, long-term risk,
       trade-offs, over-/under-engineering.
    3. `product-owner` — outcome, testable acceptance criteria,
       scope boundaries.
    4. `stakeholder` — business value, simplification, relevance.
    5. `critical-challenger` — fake clarity, hidden complexity,
       split-worthy scope, brutal honesty.
    6. `ai-agent` — automation-readiness, reuse references, safe
       execution by coding agents.

  **Specialist personas (opt-in, add only when they ask questions
  nobody else asks):**
    - `qa` — testability, edge cases, failure scenarios. **Strong
      recommendation** — produces unique signal.
    - `security`, `performance` — candidates for v1.1+. Delegate to
      existing `threat-modeling` / `performance-analysis` where a
      dedicated skill already owns the lens.
    - **Under review (maintainer unsure, leaning NO):**
      `frontend-developer`, `backend-developer`, `devops`. Add ONLY
      if they produce questions that the Core six don't. Decision
      deferred to persona drafting.
    - **Rejected for v1 canon:** `maintainer`, `new-user`,
      `optimizer`, `developer-dx` — these were in Q23's lens list,
      but either overlap with Core (maintainer ≈ senior-engineer +
      challenger) or are better expressed as review MODES than as
      personas (new-user, optimizer are question frames, not
      stable recurring mindsets). Revisit if drafting reveals a gap.

  **Canonical heuristic for every future persona proposal:**
  > A persona is only worth adding if it asks questions that none
  > of the existing personas ask. No unique questions → no persona.

  **Smart activation (deferred, v1.1+):** agent auto-adds specialist
  personas based on ticket/PR content — "UI" → `frontend`, "API" →
  `backend`, "auth/payment" → `security`. Out of scope for v1.

  **Impact on existing artifacts:**
    - `adversarial-review` → thin wrapper invoking personas
      `[critical-challenger]` on an input.
    - `judge-bug-hunter` / `judge-security-auditor` /
      `judge-test-coverage` / `judge-code-quality` → reframed as
      specialist personas. `review-changes` dispatches via the same
      persona contract.
    - `receiving-code-review`, `requesting-code-review` → persona-
      driven variants become possible.

  **Open implementation decisions (for `road-to-personas.md`):**
    1. Persona file schema — frontmatter fields, required sections
       (Focus / Mindset / Questions / Output Expectations /
       Anti-Patterns), size budget.
    2. Compression semantics — each persona compresses separately
       (symmetric with skills/rules), OR only via the skills that
       cite them? Open.
    3. Do personas get triggers/descriptions (like skills), or are
       they passive reference content loaded on demand? Leaning
       passive — they're invoked BY skills, not by triggers.
    4. `.agent-settings.yml` interaction — a
       `personas.enabled: [...]` key for default lens selection? A
       `personas.specialists: [qa]` key to auto-include QA on
       every run?
    5. Project-local override mechanism — `.agent-src/personas/`
       in consumer repos for team-specific personas (same pattern
       as skills/rules)?
    6. Linter rules — every persona must validate, every skill
       `personas:` entry must resolve, unknown persona = CI fail.
    7. Compatibility with `.augmentignore` — can a user ignore a
       persona the same way as a skill?

  🛑 **Requires `artifact-drafting-protocol`** — new artifact kind =
  new linter rules, new compression handling, new cross-ref
  semantics. Draft `road-to-personas.md` BEFORE writing Core files
  so Q23 and Q25 land on the finalized primitive.
  → Needs its own `road-to-personas.md`. Creation blocks Q23 + Q25
     implementation; direction above unblocks scoping work on both.

- **Q25 — New skill proposal: refine-ticket. ✅ SCOPING DECIDED
  (2026-04-22) — Skill + command, collapsed output, orchestrates
  sub-skills, auto repo-aware, own roadmap. Blocked on Q24
  implementation.** (Jira/Linear ticket refinement from
  Dev/Arch/PO/Stakeholder/Challenger/AI lenses.)
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

  **Persona alignment with Q24:** the six perspectives above map
  1:1 to the Q24 Core-6 (Developer, Senior Engineer, Product Owner,
  Stakeholder, Critical Challenger, AI Agent) — no new personas
  required. `refine-ticket` becomes the reference skill for
  default Core-6 invocation. QA specialist is a strong candidate
  for `--personas=+qa` opt-in since tickets benefit from
  testability-first questions.

  **✅ SCOPING DECIDED (2026-04-22):** All pre-draft decisions
  locked. `artifact-drafting-protocol` can start as soon as Q24
  implementation (persona files + linter) has shipped.

    1. **Persona architecture** — ✅ Q24 Core-6. `personas:`
       frontmatter shape + invocation syntax finalized during
       `road-to-personas.md` drafting.
    2. **Command + skill** — ✅ **Both.** `/refine-ticket
       <jira-key-or-url>` as user-facing entry point, skill in
       the background. Maximizes visibility, lowest barrier to
       trigger.
    3. **Output shape** — ✅ **Collapsed form.** Three sections:
       - **Refined ticket version** (rewritten, ready to paste
         back into Jira/Linear).
       - **Top-5 risks** (ordered).
       - **Persona voices, summarized** (one short paragraph per
         persona, not full transcripts).
       10-section shape rejected as too heavy for real use. Can
       be revisited later if feedback says the summary is too
       thin — easier to expand than to trim.
    4. **Delegation vs. duplication** — ✅ **Orchestrates, does
       not duplicate.** When trigger conditions match,
       `refine-ticket` runs `validate-feature-fit` (duplicate /
       scope / architecture misfit) and `threat-modeling`
       (security-sensitive keywords) automatically and folds
       their findings into the output. It never re-implements
       their logic. The value is in the **orchestration**; a
       pure citation-only version is just a checklist.
    5. **Repo-aware mode** — ✅ **Auto-detect, graceful
       degrade.** If the skill runs inside a repo clone, it
       reads `agents/contexts/`, nearby tickets, and naming /
       module conventions without a flag. Outside a repo
       (standalone ticket URL, nothing on disk), it runs the
       generic lens set. No `--repo-aware` flag.
    6. **Input contract** — ✅ Jira/Linear URL, ticket key,
       pasted text, and branch-name detection. Reuses the
       ticket-loading helper from `jira-ticket` (same pattern,
       same code path).
    7. **Delegation boundary** (reminder) — `threat-modeling`
       owns security deep-dive; `validate-feature-fit` owns
       duplicate/scope detection; `feature-plan` owns downstream
       planning. `refine-ticket` cites + orchestrates, never
       copies their logic.
    8. **Roadmap home** — ✅ **Own roadmap:
       `road-to-ticket-refinement.md`.** Covers `refine-ticket`
       + `estimate-ticket` as a family (size / risk / split /
       uncertainty). Not folded into `road-to-stronger-skills.md`
       — the family has enough scope to justify its own plan.

  **Revisit triggers** (open the decision back up if):
    - Collapsed output shape proves too thin in the first 5 real
      runs → promote sections from "summarized" to full.
    - Auto-orchestration surprises users (unexpected
      threat-modeling runs) → add an opt-in flag, not a flag to
      opt out.
    - `estimate-ticket` turns out not to share enough with
      `refine-ticket` to justify shared roadmap → split.

  🛑 **Requires `artifact-drafting-protocol`** — substantial new
  artifact. Blocked by Q24 **implementation** (persona files +
  linter must ship first). Scoping now unblocked.
  → Own roadmap: `road-to-ticket-refinement.md` (to be drafted).

#### 🟢 Absorbed — Killer-Flow bundle (external feedback 2026-04-22, round 3)

A third external-review pass surfaced a "proof of power" thesis:
the package reads as a strong governance / skills system but lacks
one visible end-to-end delivery outcome. The thesis landed as four
questions (Q36–Q39) plus one meta-guardrail (Q40). Q36/Q37/Q39 are
absorbed into a dedicated roadmap so the plan lives in the
standard roadmap surface, not as a floating Q-list. Q38 and Q40
remain as open questions below — they span multiple flows and are
not scoped to one roadmap.

- **Q36 — Showcase / killer flow.** ✅ **ABSORBED** into
  [`road-to-implement-ticket.md`](road-to-implement-ticket.md).
  The "one visible end-to-end flow" becomes `/implement-ticket`.
  No standalone question remains.
- **Q37 — Delivery orchestrator shape.** ✅ **ABSORBED** into
  [`road-to-implement-ticket.md`](road-to-implement-ticket.md) +
  [`../contexts/implement-ticket-flow.md`](../contexts/implement-ticket-flow.md).
  Linear, eight-step, block-on-ambiguity contract locked; runtime
  TBD in Phase 0 spike.
- **Q39 — Narrative framing (README / AGENTS.md lead with the
  flow).** ✅ **ABSORBED** into the roadmap's Phase 4. Coordinates
  with Q19 hero rework so there is one README pass, not two.

#### 🟢 Decided — Killer-Flow metrics & guardrails

- **Q38 — Outcome metrics for `/implement-ticket`.** ✅ **DECIDED
  (2026-04-22) — Option 2: structured append-only log in
  `agents/logs/implement-ticket/`.**
  Five metrics emitted as JSON lines per run:
  `time_to_verified_change_ms`, `block_rate`, `memory_decision_rate`,
  `repeat_user_runs_per_week`, `report_rejections`.
  Log directory is gitignored by default; opt-in to commit for team
  review. A small `task metrics:implement-ticket` target renders the
  last N runs as a readable table. No external telemetry, no
  OpenTelemetry, no aggregation service — matches the package's
  "governance / no hidden external dependencies" posture. Phase 0
  spike now knows where to emit; ADR can proceed.
  → Unblocks Phase 0 in
  [`road-to-implement-ticket.md`](road-to-implement-ticket.md#phase-0--technology-spike-1-pr-throwaway-allowed).

- **Q40 — Surface-growth guardrail for delivery flows.** ✅
  **DECIDED (2026-04-22) — all four gates mandatory.**
  A second delivery flow (`/implement-bug`, `/implement-spike`,
  `/ship-hotfix`, …) may only be drafted when ALL of the following
  hold:
    1. ≥10 real `/implement-ticket` runs per week across ≥2 users,
       sustained for 4 weeks (demand signal, not speculation).
    2. Written justification for why the new flow cannot be a
       persona + a branch inside `/implement-ticket` (avoids
       duplicating the orchestrator).
    3. Named retirement candidate OR explicit statement that the
       new flow is additive, with rationale.
    4. Roadmap amendment + `implement-ticket-flow.md` context
       update BEFORE the new flow drafts its first artifact (no
       PR-rider expansions).
  The growth rule is as opinionated as the flow itself — this is
  the explicit firebreak against turning one opinionated flow into
  a kingdom of flows.
  → Blocks any future `road-to-implement-*` roadmap from being
  drafted until all four gates are passed.

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
