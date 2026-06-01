---
adr: 039
status: accepted
date: 2026-06-01
decision: claude-skills-untracked
supersedes: —
superseded_by: —
phase: road-to-claude-skills-untrack
type: structural
review_date: 2026-06-15
---

# ADR-039 — `.claude/skills/` is untracked; skills resolve from committed canonical sources

## Status

**Accepted** · 2026-06-01. Decision lands **without** soak — all binding
conditions were verified empirically against a real Claude Code instance
(v2.1.159) in the same session. Review date 2026-06-15 keeps the revert path
open; reverting is one `git rm`-reversing commit plus a generator repoint.

## Context

`event4u/agent-config` distributes ~365 skills to Claude Code. Until
commit `c0e2d897` the package committed `.claude/skills/<name>/SKILL.md`
(symlinks) and the plugin marketplace (`.claude-plugin/marketplace.json`)
referenced those committed paths. ADR-030 had established `.claude/skills/`
as Claude Code's filesystem-channel convention, and the cleanup that
untracked `.claude/{rules,personas,user-types}/` deliberately **kept**
`.claude/skills/` tracked, flagging the question for a dedicated
investigation (`road-to-claude-skills-untrack`).

The question this ADR closes: can the package stop committing
`.claude/skills/` — so `.claude/` in git reduces to `settings.json` only —
without breaking skill resolution on any channel?

Three resolution channels exist:

1. **Marketplace plugin** — Claude Code reads `.claude-plugin/marketplace.json`
   `skills[]` and loads skills from the referenced source paths.
2. **Consumer filesystem** — `scripts/install.sh` builds `~/.claude/skills/`
   symlinks at install time.
3. **Local dev** — `task generate-tools` rebuilds a gitignored local
   `.claude/skills/` for in-repo auto-discovery.

Commit `c0e2d897` already repointed the marketplace generator (real skills →
`./.agent-src/skills/<name>` (223), command-as-skill entries →
`./.claude-plugin/skills/<slug>` (142), both committed), updated
`lint_marketplace.py` and the pre-commit hook, and gitignored
`/.claude/skills/`. This ADR is the decision-gate record that the
investigation reached, backed by a real-instance registration test rather
than reasoning alone.

## Decision

**`.claude/skills/` stays untracked.** Skills resolve from the committed
canonical sources (`.agent-src/skills/` + `.claude-plugin/skills/`) for the
marketplace channel, and from locally-built trees for the consumer and dev
channels. `.claude/` in git is `settings.json` only.

## Evidence (real Claude Code v2.1.159, this machine)

- **Marketplace manifest validates.** `claude plugin validate
  .claude-plugin/marketplace.json` → "Validation passed" (sole warning:
  `metadata.keywords` is ignored at load — cosmetic, see Consequences).
- **Marketplace registers + installs at runtime.** `claude plugin
  marketplace add <repo>` → `claude plugin install
  agent-config@event4u-agent-config` → **enabled**; `claude plugin details`
  reports **Skills (365)** resolved from `./.agent-src/skills/` (223) +
  `./.claude-plugin/skills/` (142), with **no committed `.claude/skills/`**.
- **Runtime execution without a committed tree.** This very session is a live
  Claude Code runtime in which `git ls-files .claude/skills/` returns `0`
  yet skills load **and execute** (the `roadmap:process-full` skill was
  loaded and run from its SKILL.md). Registration → runtime is therefore
  demonstrated, not inferred, for the filesystem channel.
- **Consumer filesystem channel.** `scripts/probe_skill_registration.py`
  shows 365 skills register from user-scope `~/.claude/skills/`, built by
  `install.sh`, independent of any committed project tree.
- **Lint green.** `python3 scripts/lint_marketplace.py` → 365 skills, no
  issues (reverse-completeness scans the two committed sources).
- **Idempotent regen.** `task generate-tools` produces no tracked diff;
  `.claude/skills/` stays gitignored (0 tracked files).

## Council convergence

Cross-checked with the AI council (analysis mode, members
anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-01). Both members
converged on a single strongest blind spot: `claude plugin details` proves
*registration metadata*, not *live runtime execution*, and asked for a live
session test before closing. That test was then run and is recorded above
(this session executes skills with zero committed `.claude/skills/`; the
marketplace plugin was installed + enabled and resolved all 365 skills).
The council's residual follow-ups are carried into Consequences.

## Consequences

**Positive**

- `.claude/` in git is `settings.json` only — no per-skill-set PR churn from
  the previously-committed 365 symlinks.
- Marketplace source paths (`.agent-src/skills/`, `.claude-plugin/skills/`)
  are **committed**, so marketplace consumers cloning at a tag or with
  `--depth=1` still resolve every referenced skill — a strict improvement
  over the old gitignore-adjacent layout.

**Costs / residual risks (from council follow-ups)**

- **Consumer channel depends on `install.sh`.** A consumer who clones the
  repo but never runs `install.sh` (and never installs the marketplace
  plugin) gets no `~/.claude/skills/`. This is unchanged from before the
  untracking and is the documented consumer contract; a CI smoke test
  (`npm install` → `probe_skill_registration.py` → assert 365) is a sensible
  follow-up but is out of this ADR's scope.
- **Channel precedence is undocumented.** When a dev has the repo open
  (local `.claude/skills/`) *and* the marketplace plugin installed, the
  precedence of local vs marketplace skills is not formally specified.
  Day-to-day dev uses the local generate-tools tree; no conflict observed.
  Follow-up only.
- **`metadata.keywords` validator warning.** The field holds generic terms
  (tool names, `php`, `laravel`), not skill names, so it is safe to drop;
  left in place here to keep this diff minimal (out of scope per
  `minimal-safe-diff`).

## Alternatives

- **Keep `.claude/skills/` tracked (ADR-030 convention).** Rejected: the
  registration test shows the convention is satisfied by locally-built and
  marketplace-resolved trees; committing 365 symlinks adds PR churn with no
  resolution benefit.

## References

- ADR-030 — Claude Code command-projection strategy (established the
  `.claude/skills/` filesystem-channel convention this ADR revisits).
- `scripts/condense.py` — `generate_plugin_command_skills()` emits the
  `.claude-plugin/skills/<slug>` projection.
- `scripts/lint_marketplace.py` — reverse-completeness over the two
  committed sources.
- `scripts/probe_skill_registration.py` — live install-state probe.
