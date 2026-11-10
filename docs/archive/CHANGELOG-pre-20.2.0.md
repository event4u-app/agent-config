# Changelog Archive — pre-20.2.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `20.2.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) by `scripts/release.py`
> once the active era's body crossed the drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md`. Entries
> here are not rewritten — git tags remain the canonical source
> for what shipped. The one amendment an archive permits is a
> **correction that adds**: where a published entry says something
> the shipped tree contradicts, the correction is appended beside
> it and names the commit that decided the matter. Nothing is
> deleted, so both the original claim and its correction stay
> readable.
>
> Entry shape follows
> [`../contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).

## [20.1.0](https://github.com/event4u-app/agent-config/compare/20.0.0...20.1.0) (2026-11-04)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** do not re-dispatch tag workflows the tag push already started (5a762d3).
- **Honest nulls:** _none_
- **Known limitations:** _none_ in shipped code — the highlights gate matched label text in test fixtures (8b69b9e); #2843 scopes the scan to shipped files.

> **Governance mix:** governance-only 0 vs consumer-only 2 (mixed 0, maintenance 1; taxonomy 1.1.0; range ba83f4684fed..b06428236ad1).

### Features

* **analyze:inbox:** expand named targets to their change set and chain --process/--pr/--merge ([96c0ef9](https://github.com/event4u-app/agent-config/commit/96c0ef92f881171bc3a8dc4d21fe44c460efb609))

### Bug Fixes

* **analyze:inbox:** keep argument-hint under the 120-char schema limit ([179d0f1](https://github.com/event4u-app/agent-config/commit/179d0f1468cff0553c5c0f902bc9690d94085800))
* **release:** do not re-dispatch tag workflows the tag push already started ([5a762d3](https://github.com/event4u-app/agent-config/commit/5a762d337b572e6728f8e98217408162517b7f7d))

Tests: 37410 (+66 since 20.0.0)
