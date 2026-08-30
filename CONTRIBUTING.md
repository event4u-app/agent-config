# Contributing

Thanks for considering a contribution to `event4u/agent-config`. This file
describes how to propose changes and what the package's conventions are.

> **This project is currently single-maintainer (`matze4u`).** Contributions
> are welcome; expect direct review and potentially slower response than
> multi-maintainer projects. The process below describes the target workflow
> as the contributor base grows.

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

## Dependency direction — memory is file-first, with no external backend

`agent-config` is the upstream, standalone package. Its memory layer is
file-first and self-contained: curated YAML under `agents/memory/<type>/`
plus agent-written JSONL under `agents/memory/intake/`, read by `retrieve()`
in `src/scripts/memory_lookup.ts`. There is no external memory backend.

[ADR-094](docs/decisions/ADR-094-agent-memory-layer-removal.md) removed the
`@event4u/agent-memory` binding — the provider seam, the package detection,
and the MCP routing that used it "when present" — and explicitly rejected
leaving the integration surface inert: *"a dormant integration surface
advertising a capability the suite no longer has is misleading residue."*

Two rules survive that removal, and both are unconditional:

- **Never hard-depend on a package that depends on `agent-config`.** That was
  the case for `agent-memory`, so the dependency could only ever run one way;
  reversing it would create a cycle and break installs in consumer projects
  that want the rule/skill layer alone.
- **Adding any external memory backend is a Class-B decision** under
  [ADR-124](docs/decisions/ADR-124-embedded-engine-doctrine.md) § 5 — its own
  ADR, a named consumer demand signal, and a measured Class-A failure — never
  a dependency bump or a config entry.

## Quick start for contributors

```bash
git clone https://github.com/event4u-app/agent-config.git
cd agent-config
task ci            # full pipeline — must be green before PR
```

All checks must pass before a PR is merged:
`sync-check`, `consistency`, `check-condensation`, `check-refs`,
`check-portability`, `lint-skills`, `test`, `lint-readme`.

## Source of truth

`src/` is the single source of truth — the authoring layer you edit:
`src/skills/`, `src/rules/`, `src/agent-src/` (profiles, user-types, commands,
contexts, personas, packs), `src/domains/<pack>/`, `src/scripts/`.

- **Edit** `src/` — verbose, authored content.
- **Do not edit** `dist/agent-src/` directly — it is the **condensed output
  shipped in the package**, generated from `src/` by `task sync`.
- **Do not edit** `.augment/` directly either — it is a generated projection of
  `dist/agent-src/` for Augment Code (gitignored in this repo; the installed
  runtime tree in a consumer project — a deployment role, not source privilege).
- **Do not edit** `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`,
  `GEMINI.md` — generated projections for specific tools.

**The build chain:** `src/` → `task sync` condenses → `dist/agent-src/` (the
shipped, published artefact) → projected → `.augment/` + the per-tool trees. No
tool is privileged; every projection is read-only output. The condensed output
lands in `dist/agent-src/` (and, in a consumer install, in that project's
`.augment/`). Authoritative: the `source-of-truth` rule.

Helper commands:

```bash
task sync             # src/ → dist/agent-src/, then project → .augment/
task generate-tools   # Regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task test             # pytest tests/ + installer integration tests
task lint-skills      # ./scripts-run src/scripts/skill_linter --all
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

### Branch names, PR text and commit messages are a gated surface

A branch name, a PR title, a PR body and a commit message are **public on push
and effectively permanent once merged** — this repository does not rewrite trunk
history, by a recorded decision, so a source name that lands there stays
recoverable. None of them is a tracked file, so the tree-scanning gate
(`check_no_external_sources`) cannot see any of them.

Two checks cover that surface, and they run at different moments on purpose:

- **`.github/workflows/pr-metadata-sources.yml`** — on `pull_request`
  (including `edited`, because a title changed after opening is a new
  disclosure). This is the backstop; by the time it runs the branch and commits
  are already on the remote.
- **`src/scripts/hooks/prepush_metadata_sources.sh`** — a **pre-push** hook, and
  the only one of the two that runs while the metadata is still private. Opt-in,
  because this repository does not write to your `.git/hooks`:

  ```bash
  ln -s ../../src/scripts/hooks/prepush_metadata_sources.sh .git/hooks/pre-push
  ```

  If you already have a pre-push hook, call it from there instead. It checks the
  branch name and the commit messages the push would add; the PR title and body
  do not exist locally, so those two stay CI-only — a local pass is not a full
  pass. Bypass with `AGENT_CONFIG_SKIP_METADATA_GATE=1`.

Run it by hand at any time:

```bash
./scripts-run src/scripts/sweep_source_surfaces --gate-metadata \
  --branch "$(git rev-parse --abbrev-ref HEAD)" \
  --commit-range origin/main..HEAD
```

Use an opaque round identifier (`inbox-2026-08-h`, `round-a91f3c`, `S17`) where
a name is needed. See [`source-confidentiality`](src/rules/source-confidentiality.md).

## Reviewability and the self-imposed gate

This is a governance standard, so the maintainer holds themselves to the same
gate as any contributor — the point is that even a solo merge goes **through**
the review floor, not around it.

- [`.github/CODEOWNERS`](.github/CODEOWNERS) routes review on the sensitive
  surfaces (kernel rules, router compiler, install, hooks, claims/proof
  generators, release pipeline, schemas). Branch protection is configured to
  require Code-Owner review on those paths (maintainer, in GitHub → Settings →
  Rules; source of truth: [`docs/contracts/branch-protection-policy.md`](docs/contracts/branch-protection-policy.md)).
- **Honest bound:** an AI adversarial-review / security gate (when enabled)
  raises the floor and catches regressions and claim-drift, but it is **not**
  independent human review. The bus-factor is tracked truthfully in
  [`docs/succession.md`](docs/succession.md) — a bus-factor of 1 stated plainly
  beats one implied to be more.
- A realistic second-reviewer on-ramp starts small (docs/claims or a single
  pack), never "co-maintain the kernel on day one".

## Adding or editing skills, rules, and commands

- Skills and rules live in `src/skills/` and `src/rules/`; commands in
  `src/domains/<pack>/` and `src/agent-src/commands/`.
- Each skill must pass `task lint-skills` — frontmatter, structure, size
  budgets, and self-containment are enforced by the linter.
- Size budgets are enforced by the `size-enforcement` rule and the linter.
  See [`size-enforcement`](dist/agent-src/rules/size-enforcement.md)
  for the current limits.
- After editing content under `src/`, run `task sync` so
  `dist/agent-src/`, `.augment/`, and the tool-specific projections stay in sync.
- Skills must remain project-agnostic. Nothing in `dist/agent-src/` may reference a
  specific consumer project, domain, or stack. The
  [`augment-portability`](dist/agent-src/rules/augment-portability.md) rule and
  `scripts/check_portability.py` enforce this in CI.
- **External contributions get credited.** A merged community skill carries
  `provenance: community` in its frontmatter — the public catalog
  ([`docs/catalog.md`](docs/catalog.md)) renders it as `community` in the
  `source` column — and gets a row in [`CREDITS.md`](CREDITS.md)
  (§ Community contributions). Maintainers add both on merge; if you were
  missed, open an issue — attribution gaps are treated as bugs.
- **Originality is CI-gated.** Every PR touching skills, personas, or domain
  commands runs `lint_originality --changed` (the anti-reskin gate, see the
  `originality-gate` job in `.github/workflows/skill-lint.yml`). Run it
  locally before pushing:
  `./scripts-run src/scripts/lint_originality --changed <changed files>` —
  or run the whole contributor precheck in one pass via the
  [`/contribution-precheck`](src/domains/meta/contribution-precheck/command.md)
  command (frontmatter schema + skill lint + originality, Node-only).

## Agent-assisted contribution workflow

The package is **maintenance-assisted** and **learning-supported** — not
self-maintaining or self-learning. Automation handles structural quality
and proposes changes; humans own semantic judgment and approve every
change. The distinction matters: drafting a skill is fast, but
generalizing it correctly and writing a trigger phrase that actually
fires for the right intents still takes human review.

### What the agent does for you

Helper skills (`skill-writing`, `rule-writing`, `command-writing`,
`description-assist`, `skill-reviewer`, `check-refs`,
`agents-md-thin-root`) cover the mechanical work. You describe the
intent — *"a skill that validates JWT tokens"*, *"a rule banning
silent fallbacks"* — and the agent:

- picks the right artefact type (skill vs. rule vs. command vs. guideline);
- places it in the correct directory under `src/`;
- writes frontmatter, trigger phrase (≤ 200 chars, multi-trigger coverage),
  required sections, and a size budget that fits the linter;
- runs `task sync` so the condensed and projected copies stay aligned;
- runs `task lint-skills` and `task ci` and proposes fixes for any
  failures.

You do not need to memorise the directory layout, the kernel-rule budget,
the size enforcement table, or the condensation-hash registry. You do
need to know *what* you want, *why* it generalises beyond your project,
and *when* the agent's draft is wrong.

### What CI catches and what it does not

CI is structural, not semantic. `task ci` enforces frontmatter shape,
description length, size budgets, condensation-hash drift, broken
cross-references, missing language anchors, kernel-rule prominence, and
roadmap-dashboard sync. It will reject a malformed skill before review.

CI cannot tell you whether a trigger phrase actually fires when it
should, whether an example generalises beyond your project, or whether
a new rule contradicts an existing one in spirit. That judgment is
yours. Plan on one or two CI feedback rounds on a first contribution —
this is normal, not a sign the docs lied.

### Learning from real use — what it actually means

The `learning-to-rule-or-skill` skill, the `capture-learnings` rule,
and the `skill-improvement-pipeline` together let the agent **propose**
rules or skills based on patterns it observed during a task. They never
auto-promote anything. Every proposal lands as a draft for you to
accept, reword, or discard. There is no cross-project training loop —
each consumer project's learnings stay local unless you explicitly opt
in to upstream contribution.

Toggle: `pipelines.skill_improvement: true` in `.agent-settings.yml`
(default true; set false for a silent agent).

### Optional upstream contribution

A consumer project can opt in to feed learnings back as PRs against
this repository. Set `project.upstream_repo: "event4u-app/agent-config"`
in `.agent-settings.yml` (empty by default). With it set, the
`upstream-contribute` skill and `upstream-proposal` rule become active
and the agent may **propose** an upstream PR when a local learning
generalises.

The setting flip is the easy part. Before enabling it, confirm:

- **You have the right to contribute.** Check your employment contract
  and your company's IP / open-source policy. Code and prose written
  during work hours often belong to your employer.
- **No proprietary content leaks.** Generalisation must strip internal
  API names, customer identifiers, secrets, and project-specific
  domain language. The agent assists; you verify.
- **MIT license is acceptable.** Contributions ship under the package's
  [MIT License](LICENSE).
- **You review every PR before submission.** The skill's Iron Law is
  *never create a PR without explicit user consent*. Setting the config
  is not consent — clicking through the proposal is.

### Honest limits

- The agent drafts; you decide. *"It compiled, ship it"* is not a
  review.
- A structurally clean skill can still be semantically useless. Read
  the trigger phrase out loud and ask whether you would actually want
  the skill to fire on those words.
- The package improves when contributors push back on the agent's
  drafts. Silent acceptance is the failure mode that produces noisy,
  redundant, or misfiring rules.

## Installer and Python tooling

- Primary installer entry point: `scripts/install` (bash orchestrator).
  It chains `scripts/install.sh` (payload sync) and `scripts/install.ts`
  (bridge files; run via the bundled `dist/install/install.mjs`).
- Each stage stays independently callable (`bash scripts/install.sh`,
  `npx tsx scripts/install.ts`) and has its own CLI.
- The retired Python installer is gone (ADR-200); no Python runtime is
  required anywhere on the install path.
- Add integration tests to `tests/test_install.sh` (payload sync) or
  `tests/test_install_orchestrator.sh` (orchestrator + wrappers), and
  Python unit tests under `tests/`.

### npm workspaces — scope discipline

The root `package.json` declares no workspaces as of v4.0.0
(road-to-unified-setup § D1). The `@event4u/installer` workspace was
removed when the TypeScript installer at `packages/core/installer/{src,
tests}` was retired in favour of the unified setup engine at
`src/install/`. Subsequent maintainers should avoid re-introducing
workspaces unless a published sub-package genuinely needs root-level
script orchestration — `packages/cloud/telemetry-worker` deliberately
stays out because it is deployed via `wrangler`, not built through
the root.

Do **not** add `npm test --workspaces`, `npm run build --workspaces`,
or monorepo-style fan-out scripts without architectural review.

If the only need is "run an npm script inside a sub-package", prefer
`npm run <script> --prefix packages/<pack>` — it works without any
root `workspaces` field and avoids hoisting side effects.

## Versioning policy

The package follows [Semantic Versioning](https://semver.org). Because the
surface is mostly content (rules, skills, commands) rather than a classic API,
the policy is interpreted as follows:

| Bump | Triggers |
|---|---|
| **Major** (X.0.0) | Installer layout changes (files created/removed), breaking changes to `.agent-settings.yml` keys, removal of rules or skills that downstream projects relied on, breaking changes to the condensed content format. |
| **Minor** (x.X.0) | New skills, rules, commands, or guidelines. New tool support. New installer flags. New `.agent-settings.yml` keys with safe defaults. |
| **Patch** (x.x.X) | Wording fixes and improvements in existing skills, linter fixes, CI changes, documentation updates, internal refactors with no user-visible effect. |

Release notes live in [`CHANGELOG.md`](CHANGELOG.md) and are generated by
`scripts/release.py` from [Conventional Commits](#commit-conventions) since
the last tag. Contributors do **not** edit the changelog by hand; writing
clean commit subjects is how notes are authored.

The consumer-facing breaking changes per major are indexed for discovery in
[`BREAKING_CHANGES.md`](BREAKING_CHANGES.md) — one row per `X.0.0`, each pointing
back to the full `CHANGELOG.md` entry. That file is the discoverable index; this
section and [`docs/contracts/CHANGELOG-conventions.md`](docs/contracts/CHANGELOG-conventions.md)
remain the canonical policy.

### Runtime dependency floors — never pin to the freshest patch

`dependencies` in `package.json` are resolved on the **consumer's** machine
when they run `npx @event4u/agent-config …`. Many consumer projects set
`prefer-offline=true` in their `.npmrc` or resolve through a private-registry
mirror, so npm consults **cached** registry metadata that can lag behind by a
patch or a minor. A floor pinned to a just-published version (e.g.
`execa@^9.6.1` the day 9.6.1 ships) then fails resolution with
`ETARGET — No matching version found`, even though the version exists on public
npm.

Rule: keep runtime-dependency floors at a **settled minor** with the patch at
`.0` (`^9.5.0`, not `^9.6.1`). We only use the stable surface of these
libraries, so the floor is the minimum compatible version — not the latest
installed one. `npm install <pkg>@latest` re-pins the floor to the freshest
patch; if you run it, lower the resulting `^X.Y.Z` back to `^X.Y.0` (or a
settled minor) before committing. This does not apply to `devDependencies`,
which never reach a consumer.

### Release process

> **Inheritable runbook:** the exact, reproducible steps a second maintainer
> can follow cold — both entry points, the manual approval checkpoint, and
> recovery — live in [`docs/release-runbook.md`](docs/release-runbook.md), with
> the secret/operator-gated dependencies in [`docs/succession.md`](docs/succession.md).
> The summary below is orientation; the runbook is the source of truth.
>
> **Cadence contract:** release *types* (security patch anytime · minors
> batched ~weekly · breaking rare + migration note) and the `latest`/`next`
> dist-tag split are pinned in [`docs/releases.md`](docs/releases.md); the
> publish workflow routes by version shape.

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

## Visibility surface

The repository's outward-facing metadata (GitHub Topics, the *About*
description and homepage, and the MCP-registry manifest) is
**visibility-as-code**: every external claim about the package lives
in a checked-in file under `.github/` or `dist/mcp/`, and a lint
asserts agreement with the README. **Never edit Topics, description,
or homepage in the GitHub UI** — those edits are overwritten on the
next sync.

Changing the manifests in a PR is allowed and expected: the
`check-visibility-drift` workflow recognizes a PR whose net diff
touches `topics.yml` / `about.yml` as an **intentional pending
change** and reports the remote diff in advisory mode instead of
failing. Strict failure is reserved for the weekly sweep, manual
dispatch, and tooling-only PRs — there, observed drift means someone
edited the GitHub UI directly. After the PR merges, a maintainer
applies the pending change once via `sync-visibility.yml`
(`workflow_dispatch`, `dry_run=false`).

Sources of truth:

- [`.github/topics.yml`](.github/topics.yml) — the topic list +
  optional paraphrase map consumed by the positioning lint.
- [`.github/about.yml`](.github/about.yml) — description + homepage.
- `dist/mcp/registry-manifest.json` — registry listings (lifecycle
  status per entry); see
  [`docs/distribution/mcp-submission-checklist.md`](docs/distribution/mcp-submission-checklist.md).

Tooling:

- `task lint-topics-yaml` — shape gate (slug regex, length, dupes).
- `task build-mcp-registry-manifest` — render
  `dist/mcp/registry-manifest.json` + the rendered payloads
  (awesome-mcp-servers row, Cloudflare catalogue entry). Wired into
  `npm prepack` so every published tarball carries the manifest.
- `task lint-mcp-registry-manifest` — schema + payload-shape gate.
- `task lint-positioning` — asserts the README H1 anchor
  (the text after the em-dash in the README H1, currently *"every
  claim machine-checked, including \"zero runtime daemon\""*) appears
  in `package.json.description`
  and `.github/about.yml`, and that every topic in
  `.github/topics.yml` is discoverable in the README body (literal
  or via the optional `equivalents:` map).
- `task sync-github-topics` — dry-run diff against the live remote;
  pass `-- --apply` to mutate (requires `GITHUB_TOKEN` with
  `administration: write`).
- `task visibility-check` — runs every visibility lint in sequence
  (topics + MCP registry + positioning). Run this before opening any
  PR that touches `.github/topics.yml`, `.github/about.yml`,
  `package.json.description`, or the README tagline.

Adding a new external registry (e.g. `awesome-claude-code`) follows
the same contract: extend the schema vocabulary, add a renderer in
`scripts/build_mcp_registry_manifest.py`, and follow the per-registry
procedure in
[`docs/distribution/mcp-submission-checklist.md`](docs/distribution/mcp-submission-checklist.md).
Never a UI edit.

**Security trade-off (`administration: write`).** The
[`sync-visibility.yml`](.github/workflows/sync-visibility.yml)
workflow holds `administration: write` because
`PUT /repos/{owner}/{repo}/topics` requires it. That same permission
allows renaming the repo, changing visibility, or deleting it. The
workflow is therefore `workflow_dispatch`-only (never auto-triggered)
and runs under the `production-visibility` environment, which gates
manual approval. The read-only drift detector
([`check-visibility-drift.yml`](.github/workflows/check-visibility-drift.yml))
holds only `contents: read` + `metadata: read` and runs on every
push / PR. If `administration: write` becomes unacceptable, swap to
a fine-grained PAT in repo secrets and document the rotation cadence
here.

## License of contributions

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE) that covers the rest of the project.

## Code of conduct

Be kind. Assume good intent. Criticize code, not people. Contributions that
carry personal attacks or harassment will not be merged, regardless of their
technical value.
