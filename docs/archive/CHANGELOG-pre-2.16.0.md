# Changelog Archive — pre-2.16.0

> Frozen snapshot of `event4u/agent-config` changelog entries from
> `2.15.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-16 once the active
> era's body crossed the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 2.16.x".
> Entries here are not amended — git tag `2.15.0` remains the
> canonical source for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Earlier eras live in
> [`CHANGELOG-pre-2.15.0.md`](CHANGELOG-pre-2.15.0.md),
> [`CHANGELOG-pre-2.11.0.md`](CHANGELOG-pre-2.11.0.md),
> [`CHANGELOG-pre-2.7.0.md`](CHANGELOG-pre-2.7.0.md), and
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).

## [2.15.0](https://github.com/event4u-app/agent-config/compare/2.14.0...2.15.0) (2026-05-15)

### Features

* **agent-user:** add /agents user command cluster (init, show, review, accept, update) ([15d53d8](https://github.com/event4u-app/agent-config/commit/15d53d8d9a2365b044831cd42127e247a70d7e20))
* **agent-user:** add v1 schema contract for .agent-user.md persona file ([64f4eab](https://github.com/event4u-app/agent-config/commit/64f4eab62ccf6a2606fbca0c56d398372c05a7a0))

### Bug Fixes

* **agent-user:** inline council-reference summary per no-roadmap-references ([ee4d3ce](https://github.com/event4u-app/agent-config/commit/ee4d3cedf9f4429450d21ca5badc2ae5c2ecaaed))
* **agent-user:** drop roadmap references per no-roadmap-references rule ([c8ade8d](https://github.com/event4u-app/agent-config/commit/c8ade8d7c5b495e0e4295aa0cb801e59076ee0b0))
* **agent-user:** adjust keep-beta-until to fit 90-day window ([801b365](https://github.com/event4u-app/agent-config/commit/801b365117a2d1efb4505e504bdd730e4cbbc217))

### Documentation

* **persona:** README section + agent-settings legacy-fallback note ([4da7629](https://github.com/event4u-app/agent-config/commit/4da7629f1f0b5a35a64d0a861040ad8639a66ebe))
* **roadmap:** mark step-3-agent-user-persona phases as in-progress ([f29d3bc](https://github.com/event4u-app/agent-config/commit/f29d3bce2380c0ea9c67e6094540b88d920ed9ff))

### Chores

* **roadmap:** close out + archive step-3-agent-user-persona ([09c0229](https://github.com/event4u-app/agent-config/commit/09c0229efd67af9cad7b2ca8202f4caa351d028d))
* **ownership:** regenerate file-ownership-matrix for /agents user ([128890d](https://github.com/event4u-app/agent-config/commit/128890d880584704b4842a398555dd979ae54462))
* **docs:** bump command count from 109 to 115 ([f8c61b1](https://github.com/event4u-app/agent-config/commit/f8c61b1d0ec48034e0d66e8d32534056ca4aa1f0))
* **template:** bump agent_config_version pin to 2.14.0 ([fcb885f](https://github.com/event4u-app/agent-config/commit/fcb885fd19bdbca46ef91ec4d5e723cc6c186c6d))
* **index:** regenerate agents/index.md + docs/catalog.md for /agents user ([56b281d](https://github.com/event4u-app/agent-config/commit/56b281d69960d3e57adbd24b9ec6fd24fc1a5aff))
* **agent-user:** regenerate compressed sources + claude tool stubs ([f79b6d1](https://github.com/event4u-app/agent-config/commit/f79b6d1cfcf1caccde4a723ad779c65d9ed87198))

Tests: 4352 (+12 since 2.14.0)
