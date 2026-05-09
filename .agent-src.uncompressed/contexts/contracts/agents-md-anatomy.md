# AGENTS.md Anatomy — outboard reference

> Companion context to the
> [`agents-md-thin-root`](../../skills/agents-md-thin-root/SKILL.md)
> skill. Holds the long-form anatomy guidance that does not fit
> inside the skill body without breaching its size budget.

## Iron Law — Capabilities over Structure

Every entry in AGENTS.md describes **what the project can do** or
**where to learn more**, never **where individual files live**.

```
A FILE PATH WITHOUT A WHY-CLAUSE IS DEAD WEIGHT.
PATH ENUMERATION (≥ 3 PATHS WITHOUT POINTERS) IS A LINT WARNING.
```

Path lists rot every refactor; capability lists survive structural
churn because they describe intent. Concrete substitutions:

| Anti-pattern (path enumeration) | Capability rewrite |
|---|---|
| `- src/auth/`<br>`- src/auth/jwt.ts`<br>`- src/auth/middleware.ts` | `- **Authentication** — OAuth + JWT session handling: [`src/auth/`](src/auth/)` |
| `- packages/payments/`<br>`- packages/billing/` | `- **Billing** — Stripe Checkout + invoice generation, dunning + tax: [`docs/billing.md`](docs/billing.md)` |
| Three bullets listing test directories | One pointer to the testing strategy doc with a *why*-clause |

A pointer is **substantive** only if its surrounding sentence carries
a *why*-clause ≥ 60 chars. Bare paths get filtered out by the lint.

## 1-liner project description slot

The first prose line under the project title is the **only place** the
agent learns what the repo is in one sentence when retrieval is
degraded. Required content:

```
> {What it is} — {primary capability} for {audience}, {differentiator}.
```

✅ Right: `> Multi-tenant SaaS billing — Stripe-backed subscription
and invoicing for B2B sellers, audit-grade ledger.`
❌ Wrong: `> A modern web app built with Next.js and TypeScript.`
(stack ≠ capability; an agent already knows what those are.)

## Multi-tool symlink strategy

`AGENTS.md` is the canonical entry point. Tool-specific files
(`CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`) point at
the same content via a symlink-or-stub pattern. Two acceptable shapes:

**Symlink** (POSIX, monorepo-friendly):

```bash
ln -s AGENTS.md CLAUDE.md
ln -s AGENTS.md GEMINI.md
ln -s AGENTS.md .cursorrules
```

**Stub** (Windows-safe, generation-pipeline-friendly):

```markdown
<!-- CLAUDE.md -->
> See [`AGENTS.md`](AGENTS.md) — single source of truth for agent
> instructions in this repo.
```

Do not duplicate AGENTS.md content into the tool-specific files; the
agent ends up with two diverging versions and the budget is paid
twice. The package's `task generate-tools` pipeline produces stubs
deterministically — never hand-edit them.

## Monorepo — per-package AGENTS.md

Each top-level package (or app, depending on layout) gets its own
`AGENTS.md` at the package root, **not** a section inside the
monorepo-root file. Why:

1. Agents working in `packages/foo/` retrieve the nearest `AGENTS.md`
   first — irrelevant siblings stay out of the budget.
2. The monorepo-root `AGENTS.md` becomes a navigation surface that
   points at each package's entry, capability-style:
   `- **Web app** — Next.js storefront and customer dashboard:
   [`apps/web/AGENTS.md`](apps/web/AGENTS.md)`.
3. Per-package emergency-triage blocks answer the five canonical
   questions in the package's local idiom (own lint / test entry,
   own source-of-truth path).

Anti-pattern: a single 6 KB monorepo `AGENTS.md` with five
package-specific sections. Spend lives in the wrong budget and every
package edit touches the same hot file.

## Refactor recipe — bloated AGENTS.md → Thin-Root

1. **Snapshot.** `wc -c AGENTS.md` and stash a copy of the
   pre-refactor file (e.g. `AGENTS.md.before` in your scratch dir)
   so you can diff before / after.
2. **Section inventory.** List every `## ` heading + its char-count.
   Mark `keep-inline` (Iron-Law-adjacent, ≤ 200 chars) vs.
   `outboard-candidate`.
3. **Path-enumeration sweep.** Find every line that is just a path
   inside backticks with no *why*-clause; collapse runs of three or
   more into a single capability pointer.
4. **Outboard.** Move each `outboard-candidate` into
   `agents/contexts/`, `docs/contracts/`, an existing rule body, or
   an existing skill body. Replace in-file with a substantive
   pointer. Never invent a new top-level dir.
5. **Verify.** Run `python3 scripts/lint_agents_md.py` until green;
   `wc -c AGENTS.md` ≤ target cap; emergency-triage block intact.

## Common gotchas

- **"Quick reference" sections.** A two-line table of common commands
  feels useful but doubles every package release. Outboard to the
  README's quickstart and link with one pointer.
- **Tech-stack dumps.** "We use React, Tailwind, tRPC, Postgres, …"
  costs budget without unblocking decisions. Move to a single
  `## Stack` pointer at `docs/architecture.md#stack`.
- **Roadmap snippets.** Roadmaps move every sprint; pin the agent to
  the directory (`agents/roadmaps/`) and let it discover the active
  one rather than naming the current file.
- **Per-feature subsections.** "How auth works", "How billing works"
  belong in capability docs, not in the root entry. AGENTS.md
  references them with one *why*-clause line each.

## See also

- [`agents-md-thin-root`](../../skills/agents-md-thin-root/SKILL.md)
  — caps, pointer-ratio, pointer-anatomy, emergency-triage contract.
- [`emergency-triage-block`](emergency-triage-block.md) — canonical
  source for the five-question block both AGENTS.md variants embed.
- [`consumer-agents-md-guide`](consumer-agents-md-guide.md) — section
  templates a consumer fills in after install.
