# Copilot Repository Instructions

<!--
  copilot-instructions.md — read by GitHub Copilot Code Review (PR bot) and
  Copilot Chat when reviewing or editing this repo.

  This file was installed by `event4u/agent-config` as a starting template.
  Fill in the placeholders below and remove this HTML comment.

  Keep this file **self-contained**. Copilot Code Review CANNOT follow links
  to `.augment/` — so every rule Copilot must enforce lives here in full.
  Copilot Chat (in the IDE) can read other files, but still benefits from
  this overview.
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
`.agent-src/`, and `.agent-src.uncompressed/`. These trees use a
deliberate path convention; the following patterns are **correct by
design** — do not flag them as broken:

- **Relative cross-references inside markdown rules / skills** like
  `[x](../docs/guidelines/foo.md)` or `[y](../contexts/bar.md)`. The
  base resolves from the file's delivered location (e.g.
  `.augment/rules/<rule>.md`) — these paths are valid via the
  `.augment/` tree, even when the file is symlinked into
  `.claude/rules/`, `.cursor/rules/`, or `.clinerules/`.
- **`path_prefix:` triggers containing `.agent-src.uncompressed/`**
  in YAML frontmatter. This is a literal match pattern for the
  host's router, **not** a file reference — keeping the verbatim
  source path is required for the rule to fire on the right edits.
- **Symlinked rule files** under `.claude/rules/`, `.cursor/rules/`,
  `.clinerules/`. Targets resolve into `.augment/rules/`; missing-file
  reports here are renderer artifacts, not real bugs.

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
