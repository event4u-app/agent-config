# Roadmap: Drafting Protocol

> **Status:** Closed (2026-04-21) — archived after Phases 1–4 shipped on
> `feat/improve-agent-setup-8`. The rule (`artifact-drafting-protocol`),
> four writing skills (`skill-writing`, `rule-writing`, `command-writing`,
> `guideline-writing`), the `description-assist` helper, and the Phase 4
> eval integration are all in production.

> When the user says *"build me a skill / rule / command / guideline for X"*, the
> agent must follow a three-phase protocol — **Understand → Research → Draft** —
> before writing a single line. The agent proposes actively; the human decides
> everything. Zero autopilot, maximum collaboration.

- **Source inspiration:** [`skills/skill-creator` in `anthropics/skills`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md) — the front-end (Understand/Research/Draft), stripped of the autopilot back-end (`run_loop.py`, `.skill` packaging, blind comparison)
- **Source analysis:** [`agents/analysis/compare-anthropics-skills.md`](../../analysis/compare-anthropics-skills.md) — revised scope after 2026-04-20 discussion
- **Status:** Phase 1 + 2 + 3 + 4 shipped, 2026-04-21 (branch `feat/improve-agent-setup-8`)
- **Author:** Split out of the anthropic alignment track after narrow-rejection was revised

## Guiding principle

The agent sees things the human cannot: similar existing artifacts, description
phrasings that undertrigger, size budgets close to their limit, duplicated
patterns across rules. The human sees things the agent cannot: business intent,
team conventions, the "why" behind a request. **Neither is sufficient alone.**

Today, when the user asks for a new artifact, the agent's default is to start
writing. This roadmap forces a structured collaboration instead: agent proposes
questions, research findings, and draft variants; user approves, rejects, or
modifies at every step. The existing governance (`skill-quality`,
`size-enforcement`, `skill-reviewer`, `learning-to-rule-or-skill`) remains the
quality backstop — this roadmap adds a **quality front-stop**.

## What this roadmap is for

Four artifact types benefit from the same protocol:

| Type | Current writing support | Gap |
|---|---|---|
| Skills | `skill-writing` skill + `skill-quality` rule + linter | No explicit pre-draft protocol; agent starts writing too fast |
| Rules | None (implicit conventions only) | No planned skill `rule-writing`; no draft protocol |
| Commands | None | No planned skill `command-writing`; no draft protocol |
| Guidelines | None | No planned skill `guideline-writing`; no draft protocol |

The protocol is artifact-type-agnostic. One rule, four small writing skills,
one shared "agent-proposes / human-approves" interaction model.

## What this roadmap is explicitly **not**

- **Not** autopilot. Every agent proposal ends with a numbered-options prompt.
  The user picks.
- **Not** a replacement for `skill-quality`, `size-enforcement`, or
  `skill-reviewer`. Those still run. This adds a step **before** them.
- **Not** content generation via Claude API calls during drafting. The agent
  drafts from its existing context. Claude API calls are reserved for
  `road-to-trigger-evals.md` only.
- **Not** a mandatory step for trivial fixes (typos, one-line rule edits).
  Triggers only on "create new artifact" or "significant rewrite".

## Mental model — what the agent does in each phase

### Phase A: Understand (agent asks, user answers)

Before any file exists, the agent asks **up to 5** clarifying questions using
numbered options (per `user-interaction` rule):

- What problem does this solve that no existing artifact solves?
- When should this fire — on what user phrasings, in what scenarios?
- What are 2-3 should-trigger examples, in the user's own words?
- What are 2-3 near-miss cases that must **not** trigger?
- Is this a skill, a rule, a command, or a guideline? (With a 3-line primer if unclear.)

Questions are **numbered** and include a "skip / I don't know yet" option.

### Phase B: Research (agent reads, reports findings)

The agent searches `.agent-src.uncompressed/` for overlap **before** drafting:

- Top 3-5 most-similar artifacts by name + description similarity
- Reports: *"`laravel-validation` already covers form-request rules — you might
  want to extend it instead of creating a new skill. Want me to show the overlap?"*
- Scans for the same phrasings in rule triggers
- Flags if this is actually a `learning-to-rule-or-skill` promotion case

Human decides: extend existing, create new, rename, or cancel. The research
output is summarized in the final artifact's commit message ("Reviewed: X, Y, Z
before drafting").

### Phase C: Draft (agent proposes variants, user picks)

Agent proposes **two or three** description variants, labeled:

- **Conservative** — short, polite, probably undertriggers
- **Pushy** — follows `skill-quality`'s pushy-description pattern
- **Concrete** — includes a specific trigger example

User picks one, or merges fragments. Agent then drafts the body following
artifact-type conventions. Every major choice (size class, section order,
examples) surfaced as a numbered option if the agent has doubt.

Size budget is enforced live: *"Body is at 420/500 lines. Consider splitting
into `foo-basics` + `foo-advanced`."*

## Prerequisites

- [x] [`road-to-anthropic-alignment.md`](road-to-anthropic-alignment.md) Phase 2
      merged — `skill-quality` rule carries the "pushy description" pattern, so
      the Draft phase has authoritative guidance to cite.
- [x] `improve-before-implement` and `ask-when-uncertain` rules reviewed for
      scope overlap — this roadmap extends them for artifact creation; it must
      not duplicate them.
- [x] Branch off `main` after v1.7.1.

## Phase 1 — The protocol rule (v1.8.0) ✅ Shipped 2026-04-21

### 1.1 New rule: `artifact-drafting-protocol.md` ✅

Location: `.agent-src.uncompressed/rules/artifact-drafting-protocol.md`.

Trigger phrasing (examples; the rule doc itself holds the canonical list):

- "create a new skill / rule / command / guideline"
- "build me a skill for X"
- "I need a rule that does Y"
- "add a command for Z"
- German equivalents: "bau mir ein Skill", "neue Regel für", "Command für"

The rule defines the three phases as **mandatory** for new-artifact creation
and **opt-in** for significant rewrites. Triggered once per creation task,
not once per edit.

### 1.2 Integration with existing rules ✅

- **`ask-when-uncertain`** — this rule extends it for artifact creation with
  a specific question template. No duplication; the new rule cross-links.
  Cross-link added in `ask-when-uncertain.md` pointing to the protocol.
- **`improve-before-implement`** — already says "validate the request against
  existing code". This roadmap operationalizes it for artifacts: the Research
  phase *is* validation. Cross-link added.
- **`user-interaction`** — numbered-options requirement is reused verbatim.

### 1.3 Size budget for the rule itself ✅

Target: ≤120 lines. Artifact-type-agnostic, no code, just protocol.
Shipped: 121 lines uncompressed / 104 lines compressed. `long_rule` linter
warning is acceptable — protocol content is not compressible without losing
the numbered trigger table.

### 1.4 Follow-ups (not in Phase 1 scope)

- AGENTS.md table updated with new rule entry.
- Roadmap moved to "shipped" status; Phase 2 (writing skills) remains
  open for a future branch.

## Phase 2 — Writing skills (v1.8.1) ✅ shipped 2026-04-21

### 2.1 Extend `skill-writing` ✅

Section 0 of the Procedure now points at
`artifact-drafting-protocol` (Understand → Research → Draft) instead of the
ad-hoc "Analyze before creating" checklist. No content duplicated; the
protocol rule is the single normative source.

### 2.2 Create a new skill: `rule-writing` ✅

New skill at `.agent-src.uncompressed/skills/rule-writing/SKILL.md`. Mirrors
`skill-writing`'s structure: trigger wording conventions, `always` vs
`auto` governance (cites `rule-type-governance`), size budget (cites
`size-enforcement`), linter + CI validation gate. 143 lines uncompressed.

### 2.3 Create a new skill: `command-writing` ✅

New skill at `.agent-src.uncompressed/skills/command-writing/SKILL.md`.
Covers slash-command shape: `disable-model-invocation` frontmatter, numbered
steps, safety gates (no auto-apply of destructive actions), size budget,
Claude symlink verification. 142 lines uncompressed.

### 2.4 Create a new skill: `guideline-writing` ✅

New skill at `.agent-src.uncompressed/skills/guideline-writing/SKILL.md`.
Covers guideline shape: minimal frontmatter (no `type`, no routing), topic
folder selection, inbound-link requirement (cites `preservation-guard`),
relaxed size budget. 145 lines uncompressed.

Total new code shipped: 430 lines of markdown across three skills + 21 lines
extended in `skill-writing`. Skill count 100 → 103.

## Phase 3 — Description assist (agent proposes, human approves) ✅ shipped 2026-04-21

This is the **bounded** version of anthropic's `run_loop.py`: the agent
participates in description iteration, but every change is an approval-gated
proposal. No Claude API calls. No silent edits.

**Shipped as:** `.agent-src.uncompressed/skills/description-assist/SKILL.md`
(143 lines). Cross-linked from all four writing skills
(`skill-writing`, `rule-writing`, `command-writing`, `guideline-writing`).
Skill count 103 → 104.

### 3.1 Behavior

Triggered manually by user: *"make this description pushier"*, or *"check if
this description undertriggers"*, or auto-triggered during the Draft phase
of new-artifact creation.

Agent response (scripted by the rule, not by Claude API):

1. Show the current description in full
2. Propose 2-3 alternative phrasings, each labeled with rationale
3. Present numbered options (per `user-interaction` rule)
4. Wait for user pick; apply only the picked variant
5. If the user rejects all, ask one clarifying question; then stop

### 3.2 What the agent explicitly does **not** do

- Write the new description to disk without approval
- Propose changes to fields other than `description` in the same turn
  (trigger phrasing, name, body sections each get their own turn)
- Use a separate AI pass to grade its own suggestions
- Loop more than twice (propose → reject → refine → reject → stop)

### 3.3 Scope gate

Available for all four artifact types. Each type gets its own phrasing
corpus in the writing skill (`skill-writing` / `rule-writing` / etc.).

## Phase 4 — Integration with trigger evals ✅ shipped 2026-04-21

Unblocked once `road-to-trigger-evals.md` Phase 1 shipped (runner +
mock router + pilot triggers). No API spend required — Phase 4 only
**reads** last-run.json when it exists.

### 4.1 Auto-scaffold trigger evals during skill creation ✅

Shipped as `skill-writing` § 1c and cross-referenced from
`artifact-drafting-protocol` Phase C. When the Drafting Protocol creates
a new skill, the agent proposes a stub `evals/triggers.json` with
5 should-trigger + 5 should-not-trigger queries drawn from the user's
Phase A answers. Numbered-options prompt: accept / edit / skip. Nothing
committed without approval. Rules, commands, and guidelines skip this.

### 4.2 Description-assist informed by eval results ✅

Shipped as `description-assist` § 2b and § 3. If
`.agent-src.uncompressed/skills/{name}/evals/last-run.json` exists, the
assist extracts failure patterns and requires at least one variant in
step 3 to address the dominant failure (labelled *"addresses eval
failure: …"*). If no last-run exists, step 2b is silently skipped.
The assist does **not** invoke the runner — eval execution stays a
separate user action (token cost).

Still proposal-gated. Still no autopilot.

## Explicitly rejected

| Pattern | Why rejected |
|---|---|
| Auto-rewrite loop (Claude→Claude) | Every change must have a human approval step. Proposals only. |
| Multiple-turn self-optimization (run_loop.py loop) | Max 2 propose-reject cycles, then stop. |
| Claude API call during drafting | Costs money, adds latency. The agent drafts from existing context. |
| Blind A/B between two description variants | User can compare variants directly; no judge agent needed. |
| `.skill` packaging of drafted artifacts | Out of scope; see `road-to-anthropic-alignment.md`. |
| Auto-commit of the drafted artifact | Drafts land in the working tree only. Commit is a separate user action. |

## Success criteria

| Signal | Target |
|---|---|
| Phase 1 rule size | ≤120 lines |
| Phase 2 three new writing skills | ≤350 lines total |
| Phase 3 propose-approve cycles per description | ≤2 before stop |
| New-artifact creations using the protocol | ≥80% (measured by commit-message tag "Protocol: used") |
| Duplicate-artifact creations | 0 after one month of protocol adoption |

## Open questions

1. Should Phase 3's propose-approve cycle integrate with the IDE (showing
   diffs side-by-side), or stay in chat output? Simplicity argues chat; UX
   argues IDE.
2. Does every rule creation need the Understand phase, or only rules above a
   certain impact class? Current answer: yes, always — but the 5 questions
   can collapse to 2 if the user declares it trivial.
3. How do we prevent the protocol from becoming bureaucracy for one-line
   edits? Current answer: the trigger phrasing requires "create" or
   "significant rewrite". Pure edits bypass.

## Related

- [`road-to-anthropic-alignment.md`](road-to-anthropic-alignment.md) — Phase 2 prerequisite (pushy description pattern)
- [`../road-to-trigger-evals.md`](../road-to-trigger-evals.md) — integrated in Phase 4
- [`road-to-9.md`](road-to-9.md) — archived sibling (runtime depth, closed 2026-04-21)
- [`road-to-mcp.md`](road-to-mcp.md) — archived sibling (MCP config generation, closed 2026-04-21)
- [`agents/analysis/compare-anthropics-skills.md`](../../analysis/compare-anthropics-skills.md) — origin finding (Finding §2 pushy description + §3 trigger evals + revised §7 interactive drafting)
