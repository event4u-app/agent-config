# Killer-Flow Exploration

> Strategic memo — what a user-facing "killer flow" could look like for
> `event4u/agent-config`. External reviews (Claude 8.3/10, GPT) rated
> the package strong on infrastructure but called out a missing visible
> end-to-end nutzwert ("killer flow"). This doc lists candidate flows
> and tradeoffs. **No roadmap yet** — decision input, not implementation plan.
>
> Status: Draft, 2026-04-21. Author: follow-up to `feat/improve-agent-setup-8`.

## Problem statement

Current package is ambient enhancement: the user installs, the agent
quietly gets better, but there is no single moment where the user
*sees* the value. Adoption depends on patience + faith. A killer flow
would give a visible, measurable, demo-able win inside the first
30 minutes of use.

The active `road-to-autonomous-agent` roadmap (and the now-archived
`road-to-drafting-protocol`, closed 2026-04-21) improve **internal**
quality — they do not produce that visible win by themselves.

## Evaluation criteria

| Criterion | Why it matters |
|---|---|
| **Visible value in ≤ 30 min** | First impression determines whether the rest of the package is explored. |
| **Independent of user skill level** | Works for a junior dev installing the package alone. |
| **Leverages existing infrastructure** | Uses the 100 skills / 54 commands / runtime / adapters we already ship. |
| **Measurable delta** | Produces an artifact the user can share ("here is what my agent did"). |
| **Low maintenance cost** | Does not create a new subsystem that needs parallel upkeep. |

## Candidate flows

### A — Polished First-Run Showcase
Stitch `scripts/first-run.sh` (exists) + `docs/getting-started.md`
"3-test" (referenced but not yet a curated experience) into an
opinionated 3-step demo: (1) create a tiny feature (2) fix a
planted bug (3) generate a PR description. Each step shows which
skills fired, which rules enforced which check.

- ✅ Uses only existing skills/commands.
- ✅ Single `task first-run` command as the entry point.
- ❌ Requires a curated demo repo snippet or tolerates arbitrary target.
- ❌ Risk of feeling like a tutorial rather than a real workflow.

### B — `/repo-audit` Command
One command that produces a repo scorecard: linter warnings, stale
skills, missing contexts, agent-docs drift, test/quality gate
coverage, token overhead estimate. Output is a markdown report the
user can commit or share.

- ✅ Immediate, tangible artifact ("here is what my codebase looks like").
- ✅ Reuses `optimize-skills`, `optimize-agents`, `readme_linter`,
  `check_refs`, `check_portability`, `skill_linter`.
- ❌ Mostly meta ("the package audits itself") — less compelling for
  consumer projects unless the audit crosses into their code quality.

### C — Ticket-to-PR Flow (`/ship <ticket>`)
Chain existing commands into one supervised flow: read Jira ticket →
investigate → plan → implement → commit → PR. Each handoff pauses
for approval. Uses `bug-investigate`, `feature-plan`, `commit`,
`create-pr`, `fix-pr-comments` that already ship.

- ✅ Shows the package as a product, not a library.
- ✅ Leverages the Jira adapter (Full profile) that already exists.
- ❌ Requires `full` profile + Jira credentials → high setup friction.
- ❌ Coupling to Jira narrows the audience.

### D — `/capabilities` Demo Mode
Interactive "show me what you can do" command: agent lists its top
capabilities grouped by task type, offers a live demo for each
(dry-run mode, no writes). User picks one, agent executes it
against a sample file.

- ✅ Discoverability win — 100 skills become visible.
- ✅ Works without external credentials.
- ❌ Risks being a marketing gimmick if not tied to a real change.

### E — Quality Retrofit (`/retrofit`)
Point at an existing repo, produce a triage report: which rules
would flag which files, which skills would fire where, what the
first three governed PRs would look like. Optionally opens the
first PR as a proof-of-concept.

- ✅ Directly answers "what does this package do for **my** repo".
- ✅ Combines `project-analyze`, `rule-compliance-audit`,
  `optimize-skills`.
- ❌ Largest implementation surface of the five options.
- ❌ Tricky to keep deterministic / low-damage.

## Tradeoff summary

| Flow | Time to ship | Visible value | Reuse of existing | New risk |
|---|---|---|---|---|
| A — First-run showcase | **Low** | Medium | **High** | Low |
| B — /repo-audit | Medium | Medium-High | High | Low |
| C — /ship ticket→PR | Medium-High | **High** | **High** | Medium (credentials) |
| D — /capabilities demo | Low-Medium | Medium | High | Low-Medium |
| E — /retrofit | **High** | **High** | Medium | Medium-High |

## Recommendation (not decision)

Ship **A** as a credibility baseline (one sprint), then layer **C** on top
once A proves the demo surface works. A gives a risk-free "wow" in 30
minutes; C converts it into "I am using this every day". B and D make
good secondary entry points but do not change the adoption curve on
their own. E is a dedicated roadmap, not a follow-on.

## Open questions

1. Does the package want a killer flow now, or is the position still
   "infrastructure first, UX later"?
2. Is the target audience Laravel/PHP teams (who have Jira + clear
   tickets — favors C) or any PHP team (favors A/B)?
3. Would the maintainer accept a demo repo snippet shipped inside
   the package for A, or must A work against any target repo?

Answering these three gates the next step — no roadmap is written
until they are resolved.
