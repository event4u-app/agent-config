# Emergency Triage Block — canonical source

> Canonical content of the **Emergency Triage** block referenced by the
> `agents-md-thin-root` skill. Both the package-root `AGENTS.md` and
> `.agent-src.uncondensed/templates/AGENTS.md` (consumer template)
> embed this block verbatim. Drift is caught by the `lint-agents-md`
> task in the package's CI pipeline.

The block exists so a host agent can answer five basic questions from
the root file alone when network access, context-engine retrieval, or
linked-file fetches are degraded. Each answer fits on one line.

## Package-root variant

Use this variant in `AGENTS.md` at the package root.

```
## Emergency triage — read this when nothing else is reachable

1. **What is this repo?** — `event4u/agent-config`, a governed skill / rule / command suite for AI coding tools (no application runtime).
2. **What language?** — All `.md` content is English; agents mirror the user's language at runtime.
3. **Where do I edit?** — `.agent-src.uncondensed/` only. Never `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`.
4. **Lint / test / sync entry point?** — `task ci` (full pipeline). Subsets: `task sync`, `task generate-tools`, `task lint-skills`, `task test`.
5. **Where do the always-active rules live?** — `.agent-src/rules/` (kernel = 9 Iron-Law rules; tier-1 / tier-2 routed via `.agent-src/router.json`).
```

## Consumer-template variant

Use this variant in `.agent-src.uncondensed/templates/AGENTS.md`. The
consumer's `AGENTS.md` lands at the consumer-project root after install.

```
## Emergency triage — read this when nothing else is reachable

1. **What is this repo?** — Consumer project; agent-config is installed as a shared skill / rule / command suite at `.augment/` and `.agent-src/`.
2. **What language?** — Project-specific; agents mirror the user's language at runtime.
3. **Where do I edit agent-config?** — Do not edit `.augment/` or `.agent-src/` here; they are installed artifacts. Project edits live in `agents/` and project source.
4. **Lint / test / sync entry point?** — Project-specific (see project README); agent-config itself reinstalls via `composer update event4u/agent-config` or `npm update @event4u/agent-config`.
5. **Where do the always-active rules live?** — `.agent-src/rules/` (kernel = 9 Iron-Law rules; tier-1 / tier-2 routed via `.agent-src/router.json`).
```

## Why two variants

The package-root and the consumer template answer the same five
questions but in different repos:

- The package-root variant points at this repo's authoring layer
  (`.agent-src.uncondensed/`) and the package's CI entry point.
- The consumer variant tells the agent it is in a **consumer** project
  where `.augment/` is an installed artifact and editing it is wrong.

The questions stay identical so a host agent can recognise the block
visually regardless of which repo it landed in.
