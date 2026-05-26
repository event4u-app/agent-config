---
name: agents:optimize
tier: 2
cluster: agents
sub: optimize
description: Refactor AGENTS.md to the Thin-Root contract (caps, pointer ratio, capability bullets, emergency-triage) and propagate to tool stubs. Suggest only, never auto-apply.
skills: [agents-md-thin-root, copilot-agents-optimization, copilot-config, agent-docs-writing]
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "refactor AGENTS.md, shrink AGENTS.md, capability bullets, thin-root, optimize agent layer"
  trigger_context: "maintainer working on AGENTS.md (root or consumer template) or its tool stubs"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /agents optimize

Refactor of a single `AGENTS.md` file (project root, package root, or
consumer template) into the Thin-Root contract: hard char caps, ≥ 40 %
substantive-pointer ratio, Capabilities-over-Structure Iron Law,
mandatory emergency-triage block. Propagates the result to the
multi-tool stubs the consumer ships (`copilot-instructions.md`,
`CLAUDE.md`, `GEMINI.md`, `.cursorrules`) per the symlink-or-stub
strategy. **Suggest only — never auto-apply.**

**Source of truth:** the canonical contract lives in
[`agents-md-thin-root`](../../skills/agents-md-thin-root/SKILL.md);
the long-form anatomy lives in
[`agents-md-anatomy`](../../contexts/contracts/agents-md-anatomy.md).
This command orchestrates the diagnose-and-propose flow, it does not
restate the contract.

## When to invoke

- Lint emits FAIL or WARN on `AGENTS.md` size, pointer-ratio, or
  path-enumeration.
- A new section feels like it belongs at the root and you want a
  pre-flight check before adding it.
- A monorepo grew a 6 KB root `AGENTS.md` because every package
  appended its own section.
- Migrating from a hand-grown `AGENTS.md` (path enumerations, no
  emergency triage) to the package's contract.

## Steps

### 1. Identify the target file

Default: the AGENTS.md the user is editing right now. If unclear,
ask:

> 1. project root — `AGENTS.md`
> 2. consumer template — `.agent-src.uncondensed/templates/AGENTS.md`
> 3. package root — `AGENTS.md` of `event4u/agent-config` itself
> 4. monorepo package — `<path>/AGENTS.md` (specify path)

### 2. Measure baseline

```bash
target="<path-to-AGENTS.md>"
wc -c "$target"
python3 scripts/lint_agents_md.py 2>&1 | grep -A1 "$target" || \
  python3 scripts/lint_agents_md.py
```

Record: total chars, gap to FAIL/WARN cap, pointer-ratio output,
path-enumeration warning count.

### 3. Section inventory

```bash
awk '/^## / {if (h) print h, n; h=$0; n=0; next} {n+=length($0)+1} END {if (h) print h, n}' "$target"
```

For each section: classify as `keep-inline` (Iron-Law-adjacent,
≤ 200 chars, no good outboard target) or `outboard-candidate`
(longer-form prose, table-only sections, narrative). Reference the
anatomy refactor recipe.

### 4. Path-enumeration sweep

```bash
grep -nE "^[[:space:]]*[-*+][[:space:]]+\`[^\`]*/[^\`]*\`" "$target" | \
  grep -v "\[.*\](.*)" || echo "(none)"
```

Three or more bare path bullets without why-clauses → propose a
capability-style rewrite using the anatomy table.

### 5. Pointer audit

For every link in the file, verify:

- *Why*-clause ≥ 60 chars on the same line.
- Target file resolves on disk (the lint already checks this; flag
  failures here only for human readability).
- Anchor used when the linked file is large.

### 6. Emergency-triage diff

```bash
diff <(awk '/^## Emergency triage/,/^## [^E]/' "$target") \
     .agent-src.uncondensed/contexts/contracts/emergency-triage-block.md
```

Drift = revert in-file block to the canonical variant (package-root
or consumer-template).

### 7. Propose findings — numbered options

Present the user with a single numbered-options block:

```
> 1. apply suggested edits (I show the diff first, you approve)
> 2. apply only the highest-impact edit (the one that frees the
>    most chars or fixes a FAIL)
> 3. report only — no edits
```

Never auto-apply. Edits land only after explicit user approval per
[`scope-control`](../../rules/scope-control.md) and
[`commit-policy`](../../rules/commit-policy.md).

### 8. Multi-tool propagation

After AGENTS.md is updated, check for the four common tool stubs and
keep them in sync:

```bash
ls .github/copilot-instructions.md CLAUDE.md GEMINI.md .cursorrules 2>/dev/null
```

For each present file, decide per
[`agents-md-anatomy § Multi-tool symlink strategy`](../../contexts/contracts/agents-md-anatomy.md#multi-tool-symlink-strategy):

- **Symlink target** (`CLAUDE.md`, `GEMINI.md`, `.cursorrules` → `AGENTS.md`)
  → no edit needed; the link already resolves to the new content.
- **Stub** (one-line "see AGENTS.md" pointer) → no edit needed.
- **Independent file** (`.github/copilot-instructions.md` is the
  canonical one — Copilot reads its own path) → present a side-by-side
  diff against AGENTS.md and let the user choose what to copy across.
  Never auto-overwrite.

If a tool stub has drifted into a long independent file, surface that
as a finding in the step-7 numbered options instead of editing here.

### 9. Verify before claiming done

```bash
python3 scripts/lint_agents_md.py
python3 scripts/check_references.py
```

Both green = the refactor is finished. Surface fresh output in the
final reply per
[`verify-before-complete`](../../rules/verify-before-complete.md).

## Preservation gate — MANDATORY before any edit

- [ ] Emergency-triage block keeps all five canonical questions.
- [ ] No substantive pointer dropped without an outboard target.
- [ ] No new top-level directory invented for outboarded prose.
- [ ] Pointer ratio stays ≥ 0.40 after the edit.
- [ ] Char-count under FAIL cap; under WARN preferred.

## What this command does NOT do

- **No edits to** `.augment/` **or** `.agent-src/` — those regenerate
  from `.agent-src.uncondensed/`. Edit the source.
- **No commits, no push, no PR** — finishing the refactor is a user
  decision; cite [`commit-policy`](../../rules/commit-policy.md).
- **No broader agent-infra audit** — for token overhead, rule
  triggers, and skill-level findings, route to `/agents audit`.
- **No `agents/` folder ops** — scaffolding, folder-audit, and folder
  cleanup live in `/optimize agents-dir`.

## See also

- [`agents-md-thin-root`](../../skills/agents-md-thin-root/SKILL.md)
  — caps, pointer-ratio, anatomy, gotchas.
- [`agents-md-anatomy`](../../contexts/contracts/agents-md-anatomy.md)
  — Iron Law, refactor recipe, monorepo and symlink strategy.
- [`emergency-triage-block`](../../contexts/contracts/emergency-triage-block.md)
  — canonical block both AGENTS.md variants embed.
