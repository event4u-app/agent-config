# Changelog Archive — pre-17.0.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `17.0.0`, split out of the main
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

## [16.5.0](https://github.com/event4u-app/agent-config/compare/16.4.0...16.5.0) (2026-10-12)

### Release highlights

- **Behaviour changes:** give hand-authored SVG a witness, an owner, and five recorded runs (#2300) (bdeb65c).
- **Default changes + migration:** _none_
- **Security and correctness:** close the two real findings of the third 16.5.0 review, plus road-to-svg-witness-provenance (#2309) (d1f7c3b); close the security findings from the 16.5.0 re-cut review (#2307) (9904258); close the five medium-security findings from the 16.5.0 release review (#2305) (5593838); close the sixth review round of #2302 (#2303) (c88865f); strip only generic glob classes from an inbox name (fda00b3); admit a date suffix only on the families that are dated (fd5be56); +3 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 6 vs consumer-only 1 (taxonomy 1.1.0; range d411219277ce..d1f7c3b834bb).

### Features

* **svg:** close all three SVG roadmaps — routing, review follow-ups and the live-session findings (#2302) ([5098697](https://github.com/event4u-app/agent-config/commit/50986972088029db18a90c6f7d198c5ab0e26da5))
* give hand-authored SVG a witness, an owner, and five recorded runs (#2300) ([bdeb65c](https://github.com/event4u-app/agent-config/commit/bdeb65c37533825c2a3061fb7a33ef5778454d11))

### Bug Fixes

* **svg:** close the two real findings of the third 16.5.0 review, plus road-to-svg-witness-provenance (#2309) ([d1f7c3b](https://github.com/event4u-app/agent-config/commit/d1f7c3b834bb43b8937dee44b7e38733d5eb70f2))
* **svg:** close the security findings from the 16.5.0 re-cut review (#2307) ([9904258](https://github.com/event4u-app/agent-config/commit/990425836285eded0a6cb4370f8ded95823dd6c8))
* **svg:** close the five medium-security findings from the 16.5.0 release review (#2305) ([5593838](https://github.com/event4u-app/agent-config/commit/5593838c01fab686e0856fba227ae4f37cd7b8f0))
* **svg-engine:** close the sixth review round of #2302 (#2303) ([c88865f](https://github.com/event4u-app/agent-config/commit/c88865fdc1aad9337b4f98a868483d571848d7ea))
* **hooks:** strip only generic glob classes from an inbox name ([fda00b3](https://github.com/event4u-app/agent-config/commit/fda00b35ef5a0d2b603b56511a986081a261dc11))
* **hooks:** admit a date suffix only on the families that are dated ([fd5be56](https://github.com/event4u-app/agent-config/commit/fd5be56f6f17ebe96b17579ffdd452cbef3dfc39))
* **hooks:** accept only wildcard-suffixed family heads and keep bracket payloads ([8446cc0](https://github.com/event4u-app/agent-config/commit/8446cc05e322c6d084df502319daff8c1bc79e63))
* **hooks:** let a glob over an opaque family prefix through block-speaking-inbox-dir ([22904a5](https://github.com/event4u-app/agent-config/commit/22904a51d58dd8d3bbed7a6db08b717b7336adb1))
* **lineage:** count a present non-road-to parent as present ([4b40ab6](https://github.com/event4u-app/agent-config/commit/4b40ab692f85bbc2b642f98603a9d601879cd5a1))

### Documentation

* **contracts:** point the hook-concern row at the manifest instead of a count ([3406ae5](https://github.com/event4u-app/agent-config/commit/3406ae53848f7cf2ca866c2d03d297ad549743d1))

### Tests

* **hooks:** table-drive the opaque-family glob cases over all five heads ([52c9e0e](https://github.com/event4u-app/agent-config/commit/52c9e0e40ebd736aadcf8f37831f994ba1fe0dc6))

### Chores

* **ratification:** record the council review of the inbox-name guard change ([a03c9e9](https://github.com/event4u-app/agent-config/commit/a03c9e95a6b7cb58065fd9e9c30b104ebcb4911b))

### Other

* add road-to-svg-from-a-live-session from the continued raster-to-SVG session (#2301) ([a17bd4a](https://github.com/event4u-app/agent-config/commit/a17bd4aa2bcca14cc787096be644647be6188f2e))
* road-to-svg-review-followups from two reviews of the SVG roadmaps (#2299) ([b015b74](https://github.com/event4u-app/agent-config/commit/b015b747f7c2eea4a8206aba846b82dcc6e84f40))
* add two ready SVG roadmaps from inbox-2026-10-l (#2298) ([fd02787](https://github.com/event4u-app/agent-config/commit/fd02787ef8e0e9eb21e9a0256e5f3ea9bca21492))
* give six added verify clauses an expectation that can fail ([9a5338a](https://github.com/event4u-app/agent-config/commit/9a5338aebd49923a894e803b7e21f0d5dbb5d7d3))
* add thirteen ready roadmaps from inbox-2026-10-g..k ([d8a9e43](https://github.com/event4u-app/agent-config/commit/d8a9e43a881bcf6ad9a8a96c83a4e4958f321098))
* record inbox-2026-10-g..k arrivals on held stubs and parked roadmaps ([243b6f3](https://github.com/event4u-app/agent-config/commit/243b6f30251da478e03a5f9aa3d60636a14ea0e1))

Tests: 27325 (+127 since 16.4.0)
