---
stability: beta
---

# Linear AI — rules inclusion list

> Phase 3 Step 1 deliverable for [`road-to-universal-distribution.md`](../../agents/roadmaps/road-to-universal-distribution.md).
> Per-rule decision for the Linear AI rules digest. The digest is a
> Markdown blob the user pastes into Linear's `Settings → Agents →
> Additional guidance` (workspace / team / personal). The third-party
> agent (Codegen, Charlie, Cursor's Linear app, …) reads it verbatim —
> no skill triggering, no script execution, no `.augment/` access.
>
> Source of tier data: `python3 scripts/audit_cloud_compatibility.py
> --details` (47 rules: T1=20, T2=19, T3-S=8).
>
> Last refreshed: 2026-04-29.

## Inclusion criteria

- **Workspace** — universal coding posture and interaction discipline.
  Survives without filesystem, scripts, or this package's tooling.
- **Team** — framework-specific (Laravel, PHP, E2E with Playwright).
  Only applied where the team uses that stack.
- **Personal** — empty by default; reserved for individual preferences
  the user may add manually.
- **Excluded** — meta-rules about authoring this package, Augment Code
  specifics, or rules already declared `cloud_safe: noop`.

Two transformations the digest builder (Phase 3 Step 2) must apply
to *included-degraded* rules:

1. Strip references to scripts, `.agent-settings.yml`, `.agent-src/`,
   `.augment/`, `agents/`, and `task <foo>` invocations.
2. Replace `[link](path)` to other rules/skills/files with a footnote
   or inline summary, since the path won't resolve outside this repo.

## Workspace digest (18 rules)

Universal coding posture — applies to every team regardless of stack.

| Rule | Tier | Mode | Notes |
|---|---|---|---|
| `ask-when-uncertain` | T1 | as-is | One-question-per-turn iron law; strip cross-refs to `user-interaction` / `artifact-drafting-protocol` |
| `commit-conventions` | T1 | as-is | Generic Conventional Commits |
| `context-hygiene` | T1 | as-is | Conversation freshness, 3-Failure Rule, tool-loop detection; strip Augment-specific `.augmentignore` section |
| `direct-answers` | T1 | as-is | Iron Laws (no flattery, no invented facts, brevity); strip emoji whitelist refs to other rules |
| `markdown-safe-codeblocks` | T1 | as-is | Generic markdown safety |
| `minimal-safe-diff` | T1 | as-is | Universal coding discipline |
| `reviewer-awareness` | T1 | as-is | Anchor reviewer choice in paths and risk |
| `scope-control` | T1 | as-is | Universal scope discipline + git-ops permission gating |
| `security-sensitive-stop` | T1 | as-is | Stop-and-threat-model on security-sensitive paths |
| `think-before-action` | T1 | degraded | Strip `memory-access` guideline ref (no shared memory on Linear) |
| `verify-before-complete` | T1 | as-is | Evidence gate; the tool list (PHPStan etc.) is illustrative, harmless |
| `cli-output-handling` | T2 | degraded | Keep "use targeted output, not full dumps"; strip `rtk` Iron Law (rtk is a local tool) |
| `downstream-changes` | T2 | as-is | Universal post-edit propagation |
| `improve-before-implement` | T2 | as-is | Challenge weak requirements before implementing |
| `language-and-tone` | T2 | degraded | Keep mirroring + tone; strip "all `.md` docs must be English" clause (no `.md` files on Linear) |
| `missing-tool-handling` | T2 | as-is | Don't install silently |
| `token-efficiency` | T2 | degraded | Strip `.agent-settings.yml` references (`personal.minimal_output`, `personal.play_by_play`) |
| `user-interaction` | T3-S | degraded | Numbered-options Iron Law, single-source recommendation; strip `scripts/check_reply_consistency.py` reference |

## Team digest (4 rules)

Framework-specific. Only paste into the Team layer of teams that use
the stack. Each rule already names the stack in its own trigger line,
so nothing to strip.

| Rule | Tier | Stack | Notes |
|---|---|---|---|
| `docker-commands` | T1 | Docker / Laravel | Container-prefixed CLI for artisan/composer/phpunit |
| `laravel-translations` | T1 | Laravel | `__()` helper, `lang/de`, `lang/en` |
| `e2e-testing` | T2 | Playwright | Locators, Page Objects, fixtures, flake prevention |
| `php-coding` | T2 | PHP | Strict types, naming, comparisons, Eloquent conventions |

## Personal digest (0 rules)

Empty by default. The user may paste individual preferences (preferred
naming, IDE-specific shortcuts, response language overrides) into this
layer manually. The digest builder emits an empty stub with a comment.

## Excluded (25 rules) — categorised

### Meta — about authoring this package (20)

These rules govern how skills/rules/commands are created, kept in sync,
and shipped from this repository. They have no meaning for a third-party
agent that does not maintain `event4u/agent-config`.

`agent-docs`, `architecture`, `artifact-drafting-protocol`,
`augment-portability`, `augment-source-of-truth`, `capture-learnings`,
`docs-sync`, `guidelines`, `package-ci-checks`, `preservation-guard`,
`review-routing-awareness`, `roadmap-progress-sync`,
`role-mode-adherence`, `rule-type-governance`, `runtime-safety`,
`size-enforcement`, `skill-improvement-trigger`, `skill-quality`,
`tool-safety`, `upstream-proposal`.

### Augment Code specifics (3)

These reference Augment-only mechanics — model identity in Augment's
system prompt, Augment's `/slash` command surface, and the Augment
onboarding flow gated by `.agent-settings.yml`.

`model-recommendation`, `onboarding-gate`, `slash-commands`.

### Skill-routing only (1)

`analysis-skill-routing` — routes to one of our `analysis-*` skills.
Skills do not exist on Linear AI; the third-party agent has its own
capability surface.

### Already declared inert on cloud (1)

`chat-history` — carries `<!-- cloud_safe: noop -->` by design. No
persistence on cloud platforms; the rule is a no-op.

## Open follow-ups

- **Phase 3 Step 2** (`scripts/build_linear_digest.py`) implements the
  two transformations above (strip script/path/setting refs, replace
  cross-refs with inline summaries or footnotes). Pin the *degraded*
  set in the script's source so a human can audit which rules ship
  modified vs. as-is.
- **Phase 3 Step 4 char-budget test** — Linear's per-field char limit
  is still unresearched (Open Question #1 in the roadmap). Before the
  test is wired, run a quick recon and capture the value. The
  conservative fallback (~30 KB) probably fits this 18-rule workspace
  digest without contention; team layer is far smaller.
- **Phase 3 Step 3 three-layer split** — this document already
  partitions workspace / team / personal. Step 3 only needs to
  document the three-layer rationale for the README.
- Re-classify on every audit run; if a rule is added to
  `.agent-src.uncompressed/rules/`, this document MUST gain a row.

## Source of tier data

```
python3 scripts/audit_cloud_compatibility.py --details --format json
```

47 rules: T1=20, T2=19, T3-S=8. Counts in this document derive from the
above; if they drift, this document is stale and the digest builder
must refuse to emit until reconciled.
