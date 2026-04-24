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

Release notes live in [`CHANGELOG.md`](CHANGELOG.md) and are generated by
`scripts/release.py` from [Conventional Commits](#commit-conventions) since
the last tag. Contributors do **not** edit the changelog by hand; writing
clean commit subjects is how notes are authored.

### Release process

Releases are driven by a single command that owns the entire pipeline from
version bump to npm publish:

```bash
task release                       # auto-detect bump from commits (default)
task release:major                 # force a major bump
task release:minor                 # force a minor bump
task release:patch                 # force a patch bump
task release:version -- 2.0.0      # pin an exact X.Y.Z target
task release -- --dry-run          # preview only, no git/gh mutations
```

All five tasks wrap [`scripts/release.py`](scripts/release.py). `task
release` auto-detects the bump level from Conventional Commits since the
last tag (`feat!:` / `BREAKING CHANGE:` → major, `feat:` → minor,
`fix:` / `perf:` → patch; no-signal history falls through to patch).
The `release:major` / `:minor` / `:patch` variants force a specific bump
level when the commit history disagrees with what you actually want to
ship, and `release:version` pins an exact target (e.g. to jump past a
yanked version). All variants share the same pipeline:

1. **Preflight** — asserts the invocation is on `main` with a clean tree,
   in sync with `origin/main`, that `gh` is authenticated, and that the
   target tag does not already exist.
2. **Plan + preview** — computes the target version, parses Conventional
   Commits since the last tag, renders the CHANGELOG section, and prints
   everything for review.
3. **Confirm** — a single `y/N` prompt (skippable with `--yes`).
4. **Branch + bump** — creates `release/X.Y.Z`, bumps `package.json` and
   `.claude-plugin/marketplace.json`, prepends the rendered section to
   `CHANGELOG.md`.
5. **Commit + push + PR** — commits as `release: X.Y.Z`, pushes the
   branch, opens the release PR via `gh pr create`.
6. **Wait for checks** — `gh pr checks --watch --required` (skippable with
   `--no-wait`).
7. **Merge** — `gh pr merge --merge --delete-branch` (merge-commit
   strategy, required for the tag to land on a main commit).
8. **Tag main** — fast-forwards `main`, tags the merge commit, pushes the
   tag. This is what triggers [`publish-npm.yml`](.github/workflows/publish-npm.yml):
   the workflow listens on bare-numeric tag pushes, verifies the tag
   matches `package.json.version`, and runs `npm publish` against
   https://registry.npmjs.org with
   [npm provenance](https://docs.npmjs.com/generating-provenance-statements).
9. **GitHub Release** — `gh release create X.Y.Z` with the rendered
   changelog body as notes.

The override tasks (`release:major` / `:minor` / `:patch`) exist for the
cases where commit signal alone doesn't capture the release intent —
e.g. shipping a major without a formal breaking-change commit, or
downgrading a `feat:` release to patch because the feature was
effectively internal. The preview always shows which level was chosen
and what the rendered CHANGELOG looks like, so there's no surprise at
merge time.

[`release-guard.yml`](.github/workflows/release-guard.yml) still runs on
every tag push and fails loudly if `package.json.version` or
`.claude-plugin/marketplace.json.metadata.version` disagree with the tag —
an independent cross-check that stays in place regardless of how the tag
was produced.

#### Previewing without side effects

```bash
task release -- --dry-run
```

This runs the preflight + plan and prints the preview, but stops before
creating the branch. Use it to sanity-check the rendered CHANGELOG or to
see which bump level matches your commits.

#### npm authentication

`publish-npm.yml` authenticates to npm via
[OIDC Trusted Publishing](https://docs.npmjs.com/trusted-publishers) — no
`NPM_TOKEN` secret is required. The trust link is configured on the package
settings page on npmjs.com and bound to:

- Repository: `event4u-app/agent-config`
- Workflow filename: `publish-npm.yml`

The workflow declares `id-token: write` so GitHub Actions can mint a
short-lived OIDC ID token with claims about the run (repo, workflow, ref).
`npm publish` sends that token to the registry, which verifies the claims
against the trust link and — on match — authorizes the publish and records
a provenance attestation. If the workflow file is renamed or moved, the
trust link on npm must be updated accordingly or the publish step will
fail.

## License of contributions

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE) that covers the rest of the project.

## Code of conduct

Be kind. Assume good intent. Criticize code, not people. Contributions that
carry personal attacks or harassment will not be merged, regardless of their
technical value.
