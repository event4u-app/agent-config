---
adr: 053
status: accepted
date: 2026-06-05
decision: agents-namespace-dual-role-resolution
supersedes: —
superseded_by: —
phase: v6.0.x · workspace structural cleanup · Phase 2 (Step 4 design gate)
type: structural
---

# ADR-053 — The maintainer `agents/` namespace is the dogfooded consumer convention (collision resolution)

## Status

**Accepted** · 2026-06-05. Resolves the deferred Step-4 design gate of the
6.0.x workspace-structural-cleanup roadmap, closing the `agents/`-namespace
remainder that [`ADR-050`](ADR-050-workspace-vs-package-root-boundary.md)
explicitly deferred.
Routed through the AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
design mode, 2-round debate, 2026-06-05). Both members converged independently
on Option B in round 1; the round-2 adversarial pass steel-manned Option A and is
recorded under *Alternatives considered* with the reason it does not hold.

## Context

ADR-050 kept the maintainer `agents/` workspace at repo root ("workspace tooling
+ namespace") and deferred two coupled questions to this roadmap:

1. Resolve the **maintainer-vs-consumer `agents/` collision** — the directory
   `agents/` in this repo is simultaneously the maintainer workspace AND the
   consumer-facing convention the package ships.
2. Resolve the **settings-loader self-reference** — `agents/settings/.agent-settings.yml`
   is read at runtime by `src/scripts/_lib/agent_settings.py`, so a naive move of
   the workspace could brick the loader mid-move.

Three facts, verified against the codebase on 2026-06-05, define the decision space:

- **`agents/` is one name with two roles by design.** This repo's `agents/`
  (`roadmaps/`, `settings/`, `runtime/`, `decisions/`) is a *compliant instance*
  of the `agents/` tree the package installs into consumer projects
  (`agents/settings/`, `agents/overrides/`, `agents/roadmaps/`, `.event4u-bridge.yml`).
  The maintainer workspace and the shipped convention are the same directory name
  because the package dogfoods its own convention.
- **The loader is coupled to the convention, not to a maintainer-special path.**
  `agent_settings.py` keys on `LOCAL_PROJECT_SUBDIR = ("agents", "settings")`,
  anchors on a directory named `agents/` carrying any of `_AGENTS_DIR_MARKERS`
  (`roadmaps/`, `settings/.ai-council.yml`, `roadmaps-progress.md`,
  `.event4u-bridge.yml`), and defaults `MODULES_DEFAULTS["agent_folder"] = "agents"`.
  These are *convention* identifiers — the same strings a consumer project carries.
- **Reference scale.** 1106 tracked files outside `agents/` and `internal/`
  reference `agents/` (~511 `src/`, ~260 generated `.agent-src/`, ~220 `docs/`,
  ~93 `tests/`). The majority describe the *consumer convention* (templates,
  generators, skills, docs), not this repo's workspace.

## Decision

1. **Keep `agents/` at repo root. The "collision" is conceptual, not structural,
   and is resolved by naming the dual role — not by moving the directory.** The
   maintainer workspace *is* a dogfooded instance of the shipped `agents/`
   convention; that overlap is intentional and is the forcing function that keeps
   the convention usable. There is nothing to physically separate.

2. **Add an explicit, reviewable marker.** A tracked
   [`agents/.maintainer-workspace.md`](../../agents/.maintainer-workspace.md)
   names the dual role at the directory itself, so a reviewer encountering the
   overlap sees the intent in place rather than inferring a mistake.

3. **The loader needs no structural change; its relocation-safety is locked by a
   pre-flight test.** `agent_settings.py` already resolves the project root from
   `AGENT_CONFIG_PROJECT_ROOT` / `--root` / an anchor walk / `.git`, and reads
   settings via a cascade. A regression test
   (`tests/test_agent_settings_relocation_resilience.py`) proves the loader
   resolves a settings file at an arbitrary relocated root with the default
   location absent, and degrades to defaults (never bricks) when the file is gone.

4. **No mass ref repoint.** Because the directory name does not change, the ~1106
   `agents/` references stay valid. Step 6's "execute the disposition" reduces to
   landing the marker + ADR + loader test; the full path-audit surface is
   unchanged by this decision.

## Consequences

- **Positive.** The collision is resolved at the lowest defensible blast radius:
  zero ref churn, zero loader fork, dogfooding integrity preserved, and the dual
  role is now explicit rather than tribal knowledge.
- **Positive.** Consistent with ADR-050 (which already placed `agents/` at root)
  and with the package's "dogfood the convention" posture.
- **Negative / accepted.** A reviewer must understand the dual role; the marker
  file and this ADR are the mitigation. New contributors are pointed at both.
- **Negative / accepted.** The maintainer workspace can never diverge in *name*
  from the consumer convention without forking the loader — which is the point:
  the constraint keeps the shipped convention honest.

## Alternatives considered

- **Option A — rename the maintainer workspace (`agents/` → `.agents/` /
  `internal/agents/`).** Steel-manned in the round-2 debate as breaking a
  "circular dogfooding" dependency and claimed to need only ~47 maintainer-tooling
  ref changes with "no loader change". **Rejected** because the claim is
  self-refuting: `agents/settings/` *is* the convention path the loader hardcodes
  (`LOCAL_PROJECT_SUBDIR`), so moving the maintainer settings either (a) requires
  dual-path loader logic ("maintainer ⇒ `.agents/`, consumer ⇒ `agents/`") — which
  both members rejected in round 1 as strictly worse — or (b) leaves
  `agents/settings/` in place, which does not resolve the collision it set out to
  fix. Renaming a directory does not resolve a clash between that directory and a
  *shipped convention of the same name*.
- **Option C — relocate `agents/` contents to typed root homes
  (`roadmaps/`, `settings/`, `runtime/`).** Rejected: removes the `agents/`
  umbrella, breaks the loader anchor and the dogfooded convention, and forces a
  doc/template rewrite for the largest blast radius of the three.

## Inversion check

This verdict flips only if external consumer projects are shown to organize their
`agents/` tree identically to this maintainer workspace (project ADRs in
`agents/decisions/`, runtime logs in `agents/runtime/`) — which would make the
dual role convention-native rather than maintainer-specific and *strengthen* B —
**or** if a consumer integration is shown to require a maintainer-distinct
directory name, which would reopen A. Absent either, B stands.

## References

- [`ADR-050`](ADR-050-workspace-vs-package-root-boundary.md) — kept `agents/` at
  root and deferred this collision + loader self-reference to here.
- [`ADR-020`](ADR-020-global-only-consumer-scope.md) — the
  `.event4u-bridge.yml` consumer anchor that the loader keys on.
- [`agents/.maintainer-workspace.md`](../../agents/.maintainer-workspace.md) — the
  explicit dual-role marker landed by this decision.
- AI council, design mode, 2-round debate, 2026-06-05 (anthropic/claude-sonnet-4-5
  + openai/gpt-4o) — round-1 convergence on Option B; round-2 adversarial pass
  recorded above.
