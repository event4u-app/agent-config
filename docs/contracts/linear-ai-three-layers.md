---
stability: beta
---

# Linear AI — three-layer split rationale

> Phase 3 Step 3 deliverable for [`road-to-universal-distribution.md`](../../agents/roadmaps/road-to-universal-distribution.md).
> Per-rule routing is in [`linear-ai-rules-inclusion.md`](linear-ai-rules-inclusion.md);
> this file documents *why* the split is workspace / team / personal and
> what belongs in each.

## The three slots Linear gives us

`Settings → Agents → Additional guidance` exposes three text fields:

| Field | Scope | Inheritance | Editable by |
|---|---|---|---|
| **Workspace** | Whole organisation | Inherited by every team and every member | Workspace admins |
| **Team** | One Linear team | Overrides workspace for that team's issues | Team admins |
| **Personal** | One member, on their own assigned issues | Layered on top of workspace + team | The member |

Linear's docs frame this as **most-specific-wins**: when an agent is
linked to a Linear issue, it reads workspace + team + personal
concatenated, with later layers overriding earlier ones. The third-party
agent (Codegen, Charlie, Cursor's Linear app, …) receives the bytes
verbatim — no filesystem, no skill triggering, no `.augment/` access.

## Our mapping — workspace / team / personal

The inclusion list partitions our 47 rules into three mutually exclusive
buckets. Counts and per-rule decisions live in
[`linear-ai-rules-inclusion.md`](linear-ai-rules-inclusion.md); this
section explains the *principle* behind each bucket.

### Workspace — universal coding posture (18 rules)

Goes into the **Workspace** field. Rules that:

- Apply regardless of stack (PHP, Node, Python, Go, …)
- Govern *interaction discipline* — when to ask, how to commit, how to
  surface options, how to push back on weak reviews
- Survive without filesystem, scripts, or this package's tooling
- Carry no Augment-specific or repo-authoring scaffolding

Examples: `ask-when-uncertain`, `commit-conventions`, `direct-answers`,
`minimal-safe-diff`, `scope-control`, `verify-before-complete`,
`user-interaction`. Anything that helps a generic third-party agent
behave like a competent engineer on *any* codebase.

A few rules in this bucket are **degraded** — the digest builder strips
the local-only sections (rtk, `.agent-settings.yml`, `.augment/` paths,
`.md`-files-must-be-English clause). The substance survives; the tooling
references don't.

### Team — framework-specific (4 rules)

Goes into the **Team** field of teams that match the stack. Rules that:

- Name a specific framework, language, or tool in their trigger line
- Carry conventions that only fire when that stack is touched
- Don't apply to teams using a different stack (a frontend-only team
  doesn't need the PHP rules)

Currently four rules: `docker-commands`, `laravel-translations`,
`e2e-testing` (Playwright), `php-coding`. Each rule already names its
stack, so the digest builder ships them as-is — no per-rule stripping.

If the org has a Node-only team, paste only `e2e-testing`. If a
Laravel-Docker team, paste all four. The Team layer is per-team, not
universal.

### Personal — empty by default (0 rules)

Goes into the **Personal** field of individual members. Empty stub by
default. Each developer pastes their own preferences into this layer
manually. Examples a member might add:

- Response language overrides ("respond in German on my issues")
- Personal naming conventions ("I prefer `result_` prefixes for outputs")
- Individual IDE shortcuts they want surfaced in PR descriptions
- Scoped opt-outs from a workspace rule, with a one-sentence reason

The digest builder emits an empty stub with a comment line so members
have a starting point, but the file is intentionally minimal — the
package does not own personal preferences.

## Why this split, not a flat blob

Three reasons we don't merge everything into one workspace digest:

1. **Stack-specific noise.** A frontend-only team doesn't need 4 KB of
   Laravel + PHP + Docker conventions cluttering their guidance field.
   Pushing those into Team layers keeps the workspace lean and
   universal.
2. **Per-team override surface.** When a team needs to override a
   workspace rule (e.g. their own commit-message convention), Linear's
   layering already gives them the surface. We don't need to fork the
   workspace digest per team.
3. **Personal autonomy.** Members own the Personal layer. The package
   never writes there; it's the user's escape hatch for individual
   preferences without lobbying for a workspace-wide rule change.

## Excluded from all three layers (25 rules)

[`linear-ai-rules-inclusion.md`](linear-ai-rules-inclusion.md) §
"Excluded" covers the four categories: meta-rules about authoring this
package (20), Augment Code specifics (3), skill-routing only (1),
already-cloud-inert (1). None of these benefit a third-party agent that
does not maintain `event4u/agent-config`.

## Future evolution

- **More stacks → more team rules.** When the package gains a Node,
  Python, or Go equivalent of `php-coding`, the Team digest grows. The
  decision criterion stays: stack-named in the trigger line → Team;
  stack-agnostic → Workspace.
- **Workspace stays bounded.** Adding new universal rules is fine, but
  the workspace digest should not grow to swamp Linear's per-field cap.
  Current digest is well under the 100 KB safety budget; if growth
  approaches the cap, split workspace by *concern* (interaction vs.
  code-shape vs. delivery) rather than relaxing the cap.
- **Personal layer stays empty in this package.** Even if patterns
  emerge, they belong in workspace (if universal) or team (if
  stack-bound), not in a curated personal blob the package owns.

## Source of truth

- Per-rule decision: [`linear-ai-rules-inclusion.md`](linear-ai-rules-inclusion.md)
- Builder script: [`scripts/build_linear_digest.py`](../../scripts/build_linear_digest.py)
- Generated digests: `dist/linear/{workspace,team,personal}.md` (gitignored)
- Roadmap: [`road-to-universal-distribution.md`](../../agents/roadmaps/road-to-universal-distribution.md) Phase 3
