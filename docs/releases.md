# Release cadence contract

> road-to-credible-install Phase 5. This contract describes release **types**,
> never version numbers or dates. It exists because 126 versions across 9
> majors in 94 days reads as "no contract" to an external evaluator — the
> cadence below is the promise `latest` consumers can plan around.

## Release types

| Type | Cadence | Channel |
|---|---|---|
| **Security patch** | Anytime — ships as soon as the fix is verified. Carries only the fix (plus its standing gate). | `latest` |
| **Batched minor** | Batched, at most ~weekly. Feature work accumulates on `main` and ships together. | `latest` |
| **Breaking release** | Rare, bundled, always with a migration note in [`MIGRATION.md`](../MIGRATION.md). | `latest` |
| **Experiment / preview** | As needed — prerelease versions (`X.Y.Z-next.N`). | `next` |

## Dist-tag channels

- **`latest`** receives only the batched, contract-respecting line above.
- **`next`** receives experiments and previews. Install explicitly with
  `npm i @event4u/agent-config@next`; nothing lands there implicitly for
  `latest` consumers.

The publish workflow routes by version shape: a prerelease version
(`-next.N` or any semver prerelease suffix) publishes with `--tag next`;
a plain `X.Y.Z` publishes to `latest`
(`.github/workflows/publish-npm.yml` § channel routing).

## The stability surface

These surfaces only change in a **breaking release**, each change named in
the migration note:

- **Config formats** — `.agent-settings.yml` keys and semantics
  (`src/config/agent-settings.template.yml` is the schema of record).
- **CLI verbs** — the public command set of `agent-config` (`--help`
  surface). Verb removal/rename is breaking; additive verbs are minor.
- **Hook protocol** — the dispatcher contract
  (`docs/contracts/hook-architecture-v1.md`): event vocabulary, envelope
  shape, exit-code semantics, registration command shape.
- **Installed-tree layout** — where the installer writes (`.claude/`,
  `.augment/`, `agents/`, the managed settings blocks).

Everything not listed is an internal surface and may change in a minor.

## Verification

- The cadence is observable from the registry:
  `npm view @event4u/agent-config time --json`.
- Post-flip observation window (pre-registered in
  `agents/roadmaps/road-to-credible-install.md` Phase 5): after the breaking
  release that carries the scoped-projection default flip, the first four
  weeks on `latest` are checked against this contract and the result is
  recorded here — met or honestly missed.
