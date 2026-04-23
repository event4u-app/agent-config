# Contributing

Thanks for considering a contribution to `event4u/agent-config`. This file
describes how to propose changes and what the package's conventions are.

## Status and scope

The package is maintained by a small team at event4u:
[@matze4u](https://github.com/matze4u) (lead),
[@h3xa2](https://github.com/h3xa2),
[@php-jesus](https://github.com/php-jesus),
and [@phpjob](https://github.com/phpjob).

External contributions — bug reports, typo fixes, skill improvements,
documentation PRs, and new skills / rules — are welcome. Larger changes
(breaking changes, new architectural layers, new tool adapters) should
start with an [issue](https://github.com/event4u-app/agent-config/issues)
or a [discussion](https://github.com/event4u-app/agent-config/discussions)
so we can align on direction before code is written.

If you are unsure whether a change is in scope: open a discussion first.

## Dependency direction — no circular deps with `agent-memory`

`agent-config` is the upstream, standalone package. It must **never**
hard-depend on `@event4u/agent-memory`. The optional companion package
is declared in `suggest` (Composer) / `optionalDependencies` or
documentation only (npm) — never as a runtime or dev dependency that
`composer install` / `npm install` would pull automatically.

Reasoning: `agent-memory` depends on `agent-config` for its skills and
governance. Reversing that would create a circular dependency and break
installs in consumer projects that only want the rule/skill layer.

See [`agents/roadmaps/road-to-memory-self-consumption.md`](agents/roadmaps/road-to-memory-self-consumption.md)
for the full conflict-resolution contract between the two packages.

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
task test             # pytest tests/ + installer integration tests
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

- Primary installer entry point: `scripts/install` (bash orchestrator).
  It chains `scripts/install.sh` (payload sync) and `scripts/install.py`
  (bridge files). `bin/install.php` and `scripts/postinstall.sh` are
  thin wrappers that route through the orchestrator.
- Each stage stays independently callable (`bash scripts/install.sh`,
  `python3 scripts/install.py`) and has its own CLI.
- Python scripts must work on Python 3.10+ with only the standard library.
  No third-party runtime dependencies.
- Add integration tests to `tests/test_install.sh` (payload sync) or
  `tests/test_install_orchestrator.sh` (orchestrator + wrappers), and
  Python unit tests under `tests/`.

## Versioning policy

The package follows [Semantic Versioning](https://semver.org). Because the
surface is mostly content (rules, skills, commands) rather than a classic API,
the policy is interpreted as follows:

| Bump | Triggers |
|---|---|
| **Major** (X.0.0) | Installer layout changes (files created/removed), breaking changes to `.agent-settings.yml` keys, removal of rules or skills that downstream projects relied on, breaking changes to the compressed content format. |
| **Minor** (x.X.0) | New skills, rules, commands, or guidelines. New tool support. New installer flags. New `.agent-settings.yml` keys with safe defaults. |
| **Patch** (x.x.X) | Wording fixes and improvements in existing skills, linter fixes, CI changes, documentation updates, internal refactors with no user-visible effect. |

Release notes live in [`CHANGELOG.md`](CHANGELOG.md) and are generated
automatically by [release-please](https://github.com/googleapis/release-please)
from [Conventional Commits](#commit-conventions). Contributors do **not** edit
the changelog by hand; writing clean commit subjects is how notes are authored.

### Release process

Releases are fully automated by the
[release-please workflow](.github/workflows/release-please.yml):

1. Every push to `main` triggers release-please. It scans Conventional Commits
   since the last tag and opens (or updates) a **Release PR** — a single PR
   that bumps `package.json`, `.claude-plugin/marketplace.json`, and
   `CHANGELOG.md` in one atomic commit.
2. Review the Release PR when you're ready to ship. Merging it makes
   release-please push the matching git tag and create the GitHub Release.
3. On the same workflow run, the `publish-npm` job takes over: it checks
   out the tagged commit, verifies `package.json.version == tag`, and runs
   `npm publish` against https://registry.npmjs.org with
   [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
   so each tarball is cryptographically linked to the GitHub Actions run that
   built it.
4. The [Release Guard workflow](.github/workflows/release-guard.yml) runs on
   the pushed tag and fails loudly if `package.json.version` or
   `.claude-plugin/marketplace.json` disagree with the tag — an independent
   cross-check that stays in place even with release-please driving the flow.

Bump size is derived from commit types:
`feat:` → minor, `fix:` → patch, `feat!:` / `fix!:` / `BREAKING CHANGE:` → major.
Commits like `chore:`, `docs:`, `test:`, `ci:`, `refactor:` do not bump the
version on their own and ride along in the next Release PR.

#### Required repository secrets

| Secret | Purpose |
|---|---|
| `NPM_TOKEN` | Granular Access Token for `@event4u/agent-config` with read-write scope. Used by the `publish-npm` job. Create in [npm → Access Tokens](https://www.npmjs.com/settings/event4u/tokens) and store under `Settings → Secrets and variables → Actions`. |

#### Fallback: manual bump

`task release:bump -- X.Y.Z` is kept as an emergency fallback for the rare
case where release-please is unavailable (workflow disabled, GitHub outage,
hotfix on a branch other than `main`). In normal operation, do not use it —
let the Release PR drive every version change. A manual bump does **not**
publish to npm automatically; run `npm publish` locally after tagging.

## License of contributions

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE) that covers the rest of the project.

## Code of conduct

Be kind. Assume good intent. Criticize code, not people. Contributions that
carry personal attacks or harassment will not be merged, regardless of their
technical value.
