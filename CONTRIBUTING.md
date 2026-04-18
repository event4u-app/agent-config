# Contributing

Thanks for considering a contribution to `event4u/agent-config`. This file
describes how to propose changes and what the package's conventions are.

## Status and scope

The package is currently maintained by a single author. External
contributions — bug reports, typo fixes, skill improvements, documentation
PRs, and new skills / rules — are welcome. Larger changes (breaking changes,
new architectural layers, new tool adapters) should start with an
[issue](https://github.com/event4u-app/agent-config/issues) so we can align
on direction before code is written.

If you are unsure whether a change is in scope: open an issue first.

## Quick start for contributors

```bash
git clone https://github.com/event4u-app/agent-config.git
cd agent-config
task ci            # full pipeline — must be green before PR
```

All checks must pass before a PR is merged:
`sync-check`, `consistency`, `check-compression`, `check-refs`,
`check-portability`, `lint-skills`, `test`, `lint-readme`.

## Source of truth

- **Edit** `.agent-src.uncompressed/` — the authoring layer with verbose content.
- **Do not edit** `.agent-src/` directly — it is the compressed output shipped
  in the package, generated from the uncompressed layer by `task sync`.
- **Do not edit** `.augment/` directly either — it is a local projection of
  `.agent-src/` for Augment Code (gitignored), rebuilt by `task sync`.
- **Do not edit** `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` —
  they are generated projections for specific tools.

Helper commands:

```bash
task sync             # .agent-src.uncompressed/ → .agent-src/, then project → .augment/
task generate-tools   # Regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task test             # pytest tests/ + tests/test_install.sh
task lint-skills      # python3 scripts/skill_linter.py --all
```

## Branches, commits, and PRs

- Branch off `main`: `feat/short-description`, `fix/short-description`,
  `docs/short-description`, `chore/short-description`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit
  messages. Scope is optional but helpful — common scopes are `skills`,
  `rules`, `commands`, `installer`, `ci`, `docs`.
- Keep commits focused. Split mechanical renames from logic changes.
- Open the PR against `main` with a short description of the change,
  motivation, and any notes for reviewers.

## Adding or editing skills, rules, and commands

- Skills, rules, and commands live in `.agent-src.uncompressed/`.
- Each skill must pass `task lint-skills` — frontmatter, structure, size
  budgets, and self-containment are enforced by the linter.
- Size budgets are enforced by the `size-enforcement` rule and the linter.
  See [`size-enforcement`](.agent-src/rules/size-enforcement.md)
  for the current limits.
- After editing content under `.agent-src.uncompressed/`, run `task sync` so
  `.agent-src/`, `.augment/`, and the tool-specific projections stay in sync.
- Skills must remain project-agnostic. Nothing in `.agent-src/` may reference a
  specific consumer project, domain, or stack. The
  [`augment-portability`](.agent-src/rules/augment-portability.md) rule and
  `scripts/check_portability.py` enforce this in CI.

## Installer and Python tooling

- Canonical installer: `scripts/install.py`. `scripts/install.sh` and
  `bin/install.php` are thin wrappers.
- Python scripts must work on Python 3.10+ with only the standard library.
  No third-party runtime dependencies.
- Add integration tests to `tests/test_install.sh` and Python unit tests
  under `tests/`.

## Versioning policy

The package follows [Semantic Versioning](https://semver.org). Because the
surface is mostly content (rules, skills, commands) rather than a classic API,
the policy is interpreted as follows:

| Bump | Triggers |
|---|---|
| **Major** (X.0.0) | Installer layout changes (files created/removed), breaking changes to `.agent-settings` keys, removal of rules or skills that downstream projects relied on, breaking changes to the compressed content format. |
| **Minor** (x.X.0) | New skills, rules, commands, or guidelines. New tool support. New installer flags. New `.agent-settings` keys with safe defaults. |
| **Patch** (x.x.X) | Wording fixes and improvements in existing skills, linter fixes, CI changes, documentation updates, internal refactors with no user-visible effect. |

Every release must update [`CHANGELOG.md`](CHANGELOG.md). Unreleased work
goes under the `[Unreleased]` section; that section is renamed and dated on
release.

## License of contributions

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE) that covers the rest of the project.

## Code of conduct

Be kind. Assume good intent. Criticize code, not people. Contributions that
carry personal attacks or harassment will not be merged, regardless of their
technical value.
