# Copilot Repository Instructions

<!--
  copilot-instructions.md — the ONE file GitHub Copilot Code Review (PR bot)
  loads from `.github/`. Also read by Copilot Chat when editing this repo.

  This file was installed by `event4u/agent-config` as a starting template.
  Fill in the placeholders below and remove this HTML comment.

  Keep this file **self-contained**. Copilot Code Review CANNOT follow links
  to `.augment/` — so every rule Copilot must enforce lives here in full.
  Copilot Code Review only reads the **first 4000 characters**; keep the
  highest-priority rules (Scope Control, Known False Positives) up top.
  Copilot Chat (in the IDE) can read other files, but still benefits from
  this overview.

  For path-specific rules, use `.github/instructions/<NAME>.instructions.md`
  with an `applyTo:` frontmatter glob — that is GitHub's documented
  convention for narrowing instructions to a subtree.
-->

This repository contains {{project_description_oneline}}.

> **For Copilot Chat users:** Deeper context lives in `.augment/` (skills,
> rules, guidelines) and `AGENTS.md`. The instructions below are
> self-contained for Copilot Code Review.
>
> For most tickets — feature, bug fix, or refactor — start with
> `/implement-ticket` (see `.augment/commands/implement-ticket.md`). It drives
> the linear flow `refine → memory → analyze → plan → implement → test →
> verify → report`, blocks on ambiguity instead of guessing, and never
> commits, pushes, or opens PRs on its own.

## ✅ Scope Control

- Do not introduce architectural changes unless explicitly requested.
- Do not replace existing patterns with alternatives.
- Do not suggest new libraries unless explicitly requested.
- Stay within the established project structure.

## ✅ Architecture

<!-- Describe your layering. Example for a Laravel project:
  - Controllers thin, no business logic
  - Business logic in Service classes
  - Validation in FormRequests
  - Authorization in Policies
-->

{{architecture_notes}}

## ✅ Coding Standards

<!-- Language-specific standards. Keep them concrete and enforceable.
  Examples:
  - PHP: declare(strict_types=1), typed properties, constructor promotion
  - TypeScript: strict mode, no `any`, prefer `readonly`
  - Python: type hints on public APIs, `from __future__ import annotations`
-->

{{coding_standards}}

## ✅ Framework Conventions

<!-- Framework-specific patterns your team follows.
  Examples:
  - Laravel: Policies over Gates, Resource classes, Eloquent relationships
  - Next.js: Server components by default, client components explicitly marked
  - Rails: Service objects for complex logic
-->

{{framework_conventions}}

## ✅ Testing

- Test framework: **{{test_framework}}**
- Run all tests: `{{test_all_command}}`
- Run targeted tests: `{{test_targeted_command}}`

{{testing_extra_notes}}

## ✅ Legacy / Existing Code Handling

- Do NOT refactor existing code solely to comply with these rules.
- Only modify existing code if directly related to the current change,
  bug fix, security, or explicitly requested.
- New or newly modified code MUST follow all rules in this document.

## ✅ Code Review Scope

- Review **only the actually modified lines** and their direct dependencies.
- Do NOT review or suggest changes to unmodified code in the same file.
- Do NOT nitpick style issues that linters/formatters auto-fix.

## ✅ Known False Positives — Do NOT Flag

The repo ships agent-config rules and skills under `.augment/`,
`.agent-src/`, and (during authoring) `.agent-src.uncompressed/`.
Cross-references inside those trees resolve via the **delivered**
`.augment/` layout — not via raw git checkout. Copilot's static
checker walks the git tree, so it sees broken paths where there are
none. **Intentional, not a bug.** The installer projects
`.agent-src/` → `.augment/` and creates the symlinks that make paths
resolve at agent runtime. The patterns below are correct by design:

- **Relative cross-references inside markdown rules / skills /
  commands** like `[x](../docs/guidelines/foo.md)` or
  `[y](../contexts/bar.md)`. The base resolves from the file's
  delivered location (e.g. `.augment/rules/<rule>.md`) — these paths
  are valid via the `.augment/` tree, even when the file is symlinked
  into `.claude/rules/`, `.cursor/rules/`, or `.clinerules/`.
- **`path_prefix:` triggers containing `.agent-src.uncompressed/`**
  in YAML frontmatter. This is a literal match pattern for the
  host's router, **not** a file reference — source-of-truth meta-rules
  (`augment-source-of-truth`, `augment-portability`, `skill-quality`,
  `docs-sync`, `rule-type-governance`) legitimately match against the
  authoring tree.
- **Symlinked rule / skill / command files** under `.claude/`,
  `.cursor/`, `.clinerules/`. Targets resolve into `.augment/rules/`,
  `.augment/skills/`, `.augment/commands/` via installer-managed
  symlinks. Missing-file reports here are renderer artifacts.
- **Body-link forms `../docs/guidelines/...`** (single-up). This is
  the post-rewrite shape produced by `scripts/compress.py`. The
  compressed `.agent-src/rules/` tree is one level deeper than the
  source `.agent-src.uncompressed/rules/`, so the rewriter collapses
  `../../docs/...` to `../docs/...`. Both forms are expected — one in
  source, one in compressed output.

**What TO flag:** code defects, security issues, broken tests, type
errors, and any new `.agent-src.uncompressed/` substring introduced
into `.agent-src/rules/` body content (the `check-compressed-paths`
task gates this — flag it as a regression if it slips through).

## ✅ Code Review Comment Behavior

- **Never create duplicate comments** — one comment per concern per location.
- **Never re-raise rejected suggestions** — if the developer said no, accept it.
- Answer questions concisely; do not argue.
- Resolve conversations once the issue is addressed.

## ✅ Language Rules

- Code comments: English.
- Parameter / variable / method / class names: English.
- Commit messages: English, Conventional Commits.
- User-facing strings: {{user_facing_strings_strategy}}

## ✅ Package Management

- Always use the package manager (`composer require`, `npm install`,
  `pip install`) — never hand-edit `composer.json`, `package.json`, or
  `requirements.txt`. The manager handles version resolution and lock files.

## ✅ Copilot Behavior

- Generate {{target_language_level}} code only — avoid features from newer
  versions unless the project has upgraded.
- Prioritize **readable, clean, maintainable** code over cleverness.
- Default to **immutability**, **dependency injection**, and **encapsulation**.
- Be direct and concise — no "Sure!", "You're right!" or similar filler.
