---
name: agents-md-thin-root
description: "Use when editing AGENTS.md (package root) or templates/AGENTS.md (consumer) — enforces Thin-Root contract: hard char ceilings, ≥40% pointer ratio, mandatory emergency-triage block."
domain: process
execution:
  type: assisted
  handler: internal
  allowed_tools: []
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# agents-md-thin-root

<!-- cloud_safe: noop -->

## When to use

Use when:
- Editing `AGENTS.md` at the package root.
- Editing `packages/core/.agent-src.uncondensed/templates/AGENTS.md` (consumer-shipped template).
- Reviewing a PR that changes either file.
- Running `/optimize/agents`.
- A budget meter (`scripts/measure_augment_budget.py`) flags the package-root AGENTS.md as the dominant cost.

## Do NOT

- Edit `.github/copilot-instructions.md` with this skill (use `copilot-agents-optimization` instead).
- Edit other `.md` files under `.augment/`, `packages/*/.agent-src.uncondensed/`, or `agents/` with this skill.
- Add a section to AGENTS.md without first checking whether an outboard target already exists in `agents/settings/contexts/` or `docs/contracts/`.
- Replace prose with a bare link `[label](path)` — every pointer needs a *why*-clause ≥ 60 chars or it does not count toward the 40 % ratio.
- Reuse the package-root anatomy in the consumer template — caps and target paths differ.

## Why Thin-Root

Augment Code injects `AGENTS.md` verbatim into every workspace prompt. Each kilobyte spent here permanently consumes the 49,512-char workspace-guidelines budget shared with always-rules and auto-rule registry stubs. The Thin-Root pattern keeps the entry point a navigation surface (pointers + intent) and pushes deep detail into files Augment loads on demand via `load_context` or that other tools fetch only when their search retrieves them. Strategic council R2 (2026-05-08, Sonnet 4.5 / Opus 4.1 / gpt-4o / o1) converged on the contract codified below as the minimum guard against AGENTS.md re-bloat.

## Iron Law — Capabilities over Structure

Every entry describes **what** the project does or **where** to learn more — never **where** individual files live. Path lists rot every refactor and poison context; capability pointers survive structural churn. Full anatomy with rewrite recipes, monorepo guidance, and multi-tool symlink strategy: [`agents-md-anatomy`](../../contexts/contracts/agents-md-anatomy.md).

## The contract — hard caps

| File | FAIL above | WARN above | Target |
|---|---|---|---|
| `AGENTS.md` (package root) | 3,000 chars | 2,800 chars | ≤ 2,800 |
| `packages/core/.agent-src.uncondensed/templates/AGENTS.md` (consumer) | 2,500 chars | 2,300 chars | ≤ 2,300 |

Char-count is raw file size (`wc -c`), frontmatter included. Enforcement: `scripts/lint_agents_md.py` (Phase 7), wired into the package's CI pipeline via the `lint-agents-md` task. WARN is a soft signal in CI; FAIL blocks merge.

The R2 council originally proposed 2,500 / 2,000 caps. Phase 6.4 empirical refactor demonstrated that the mandatory emergency-triage block (≈ 700 chars) plus operational must-haves (source-of-truth disclaimer, `task` quickstart, six substantive pointers) raise the achievable floor by ≈ 500 chars. The caps above are the post-refactor baseline; the previous numbers stayed unattainable without dropping mandatory content.

## The contract — pointer ratio

≥ 40 % of non-blank lines must be **substantive pointers**. A substantive pointer is a Markdown link `[label](path[#anchor])` whose surrounding sentence carries a *why* clause ≥ 60 chars explaining what the reader will learn there. Decorative links (table-of-contents, badges, repeated cross-refs) do not count. Lint formula:

```
pointer_ratio = (substantive_pointer_lines / non_blank_lines) >= 0.40
```

## The contract — pointer anatomy

Every substantive pointer specifies, on the same line or the immediately following line:

1. **Target file path** — repo-relative, no leading `./`.
2. **Optional anchor** — `#section-slug` when the linked file's content is large enough that landing in the middle saves the reader. Skip only when the linked file is itself short.
3. ***Why* clause** — ≥ 60 chars, present-tense, names the concrete decision the pointer unblocks. Not "see also", not "more info", not the file's title repeated.

### Wrong vs. right

❌ **Wrong** — bare link, no *why*, no anchor:
> See [`commit-policy`](.agent-src/rules/commit-policy.md).

❌ **Wrong** — *why* present but < 60 chars:
> Commit rules: [`commit-policy`](.agent-src/rules/commit-policy.md).

✅ **Right** — full anatomy, anchor, *why* ≥ 60 chars:
> Commit policy — never auto-commit, four named exceptions, Hard Floor list of bulk-deletion / infra triggers: [`commit-policy § Iron Law`](.agent-src/rules/commit-policy.md#the-iron-law).

✅ **Right** — anchor optional when target is short:
> Mirror the user's language every reply, single Iron Law that overrides any momentum: [`language-and-tone`](.agent-src/rules/language-and-tone.md).

## The contract — emergency-triage block

Every Thin-Root AGENTS.md MUST contain an **Emergency Triage** section verbatim from `packages/core/.agent-src.uncondensed/contexts/contracts/emergency-triage-block.md` (Phase 6.4 will create that file as the canonical source). The block lists the five questions a host agent answers from the root file alone when network / tool access is degraded:

1. What is this repository?
2. What language(s) does this repository accept?
3. Where do I edit (source-of-truth path)?
4. What is the lint / test / sync entry point?
5. Where do the always-active behavior rules live?

Each answer must fit on one line. The block exists so the root never silently degrades to "useful only when every linked file is reachable".

## Procedure — apply Thin-Root to AGENTS.md

1. **Measure baseline.** `wc -c AGENTS.md` and `python3 scripts/measure_augment_budget.py`. Record current char-count and the gap to 2,200 / 2,500.
2. **Inventory sections.** List every `## ` heading and its char-count. Mark each as `keep-inline` (Iron-Law-adjacent, ≤ 200 chars, no good outboard target) or `outboard-candidate` (longer-form prose, table-only sections, narrative).
3. **Identify outboard targets.** For each `outboard-candidate`, name the destination — `packages/core/.agent-src.uncondensed/contexts/`, `docs/contracts/`, an existing rule body, an existing skill body. Never invent a new top-level directory.
4. **Move content; insert pointer.** Cut the section into the target file. Replace it in AGENTS.md with a single substantive pointer per anatomy above. Verify the *why*-clause length.
5. **Re-measure.** `wc -c AGENTS.md` again. If above 2,200, repeat steps 2–4 on the next-largest section. Above 2,500 = must outboard further before commit.
6. **Validate pointer ratio.** Count non-blank lines and substantive-pointer lines. Ratio < 0.40 = collapse decorative or boilerplate lines into a single pointer or remove.
7. **Verify emergency-triage block.** Diff the in-file block against `packages/core/.agent-src.uncondensed/contexts/contracts/emergency-triage-block.md`. Drift = revert to canonical.
8. **Run lints.** `task lint-agents-md && task check-refs && task lint-skills`. All green before commit.

## Procedure — apply Thin-Root to consumer template

Same procedure, applied to `packages/core/.agent-src.uncondensed/templates/AGENTS.md`. Hard cap shifts to 2,000 / 1,700. The consumer template intentionally lacks the package-self-references — its pointers target files that exist in the **consumer's** repo (`.augment/skills/`, `agents/settings/contexts/`, ...), not this package's authoring tree.

## Gotchas

- **Outboarding to a new top-level dir.** Inventing `agents/explainers/` or `docs/notes/` for the moved content silently widens the contract surface. Outboard only into `packages/core/.agent-src.uncondensed/contexts/`, `docs/contracts/`, an existing rule body, or an existing skill body.
- **Pointer-ratio inflation by decoration.** Adding boilerplate "Browse all skills" / "See also" links to lift the ratio above 40 % defeats the purpose. The lint counts only substantive pointers (with a *why*-clause ≥ 60 chars); decorative links get filtered out and the ratio drops back below threshold.
- **Emergency-triage drift.** Editing the in-file emergency-triage block instead of the canonical `packages/core/.agent-src.uncondensed/contexts/contracts/emergency-triage-block.md` causes the package-root and consumer-template versions to diverge silently. Always edit the canonical file and let the lint diff pull both back in sync.
- **Cap inversion under WARN.** A 2,250-char AGENTS.md (above 2,200 WARN, below 2,500 FAIL) is a yellow signal not a green one — every additional sentence raises the probability of the next FAIL. Treat WARN as the spend boundary, not a buffer.
- **Char-count includes frontmatter.** `wc -c` counts every byte including the YAML preamble, blank lines, and the trailing newline. Stripping a section to "look smaller" without re-running `wc -c` understates the true budget impact.
- **Path enumeration.** A run of three or more bare `` `path/to/dir/` `` bullets without *why*-clauses is the classic re-bloat pattern. The lint emits a WARN at ≥ 3 such lines. Collapse them into one capability-style pointer — see the recipe in [`agents-md-anatomy § Iron Law`](../../contexts/contracts/agents-md-anatomy.md#iron-law--capabilities-over-structure).
- **Tool-specific duplicates.** Copy-pasting AGENTS.md into `CLAUDE.md` / `GEMINI.md` / `.cursorrules` doubles the budget cost across tools. Use the symlink-or-stub pattern in [`agents-md-anatomy § Multi-tool symlink strategy`](../../contexts/contracts/agents-md-anatomy.md#multi-tool-symlink-strategy) instead.

## Output format

When invoked as a planning step, produce:

1. Current size + gap to target (one line per file).
2. Inventory table (section, chars, keep-inline / outboard-candidate, target).
3. Pointer ratio before / after (predicted).
4. Specific outboarding edits as a numbered diff plan.
5. The four lint commands the agent must run before claiming completion.

## Cloud Behavior

Inert on cloud surfaces. The skill governs the package-root `AGENTS.md` and the consumer-shipped template — both authoring artifacts inside this repository. Cloud agents working on consumer projects never edit those files directly; their copy is delivered by the package install pipeline and refreshed by the package sync pipeline. The Thin-Root contract therefore has no cloud-side procedure to execute, which is why this skill is marked `cloud_safe: noop`.

## See also

- [`agents-md-anatomy`](../../contexts/contracts/agents-md-anatomy.md) — Capabilities-over-Structure Iron Law, multi-tool symlink strategy, monorepo per-package layout, refactor recipe, full gotcha catalog.
- [`copilot-agents-optimization`](../copilot-agents-optimization/SKILL.md) — sibling skill for `.github/copilot-instructions.md`; runs alongside Thin-Root in `/agents optimize`.
- [`agent-docs-writing`](../agent-docs-writing/SKILL.md) — broader documentation-structure context for navigating outboard targets.
- [`size-enforcement`](../../rules/size-enforcement.md) — covers per-skill / per-rule / per-command size budgets; AGENTS.md caps live in this skill instead.
- [`ADR-004-rule-governance-pruning`](../../../docs/decisions/ADR-004-rule-governance-pruning.md) — captures the rule-governance pruning that freed the workspace-guidelines budget; the Thin-Root caps build on that headroom.
