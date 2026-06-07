# Changelog Archive — pre-2.20.0

> Frozen snapshot of `event4u/agent-config` changelog entries from
> `2.17.0` through `2.19.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-17 once the active
> era's body crossed the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 2.20.x".
> Entries here are not amended — git tags `2.17.0`, `2.18.0`, and
> `2.19.0` remain the canonical sources for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Earlier eras live in
> [`CHANGELOG-pre-2.17.0.md`](CHANGELOG-pre-2.17.0.md),
> [`CHANGELOG-pre-2.16.0.md`](CHANGELOG-pre-2.16.0.md),
> [`CHANGELOG-pre-2.15.0.md`](CHANGELOG-pre-2.15.0.md),
> [`CHANGELOG-pre-2.11.0.md`](CHANGELOG-pre-2.11.0.md),
> [`CHANGELOG-pre-2.7.0.md`](CHANGELOG-pre-2.7.0.md), and
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).

## [2.19.0](https://github.com/event4u-app/agent-config/compare/2.18.0...2.19.0) (2026-05-16)

### Features

* **user-types:** land three seed user-types (galabau, metalworking, truck) ([361745e](https://github.com/event4u-app/agent-config/commit/361745ec88d32c7f6faa8f50ac4d350f95f6b6d1))
* **refine-ticket:** add --user-type lens, orthogonal to --personas ([7d70138](https://github.com/event4u-app/agent-config/commit/7d7013840d92d53ead0b8dba15bf6613398dcd5b))
* **linter:** add user-type artifact-type support ([bce874c](https://github.com/event4u-app/agent-config/commit/bce874cdb7e925585b74b478b0f4f0e4a7f40380))
* **user-types:** wire compile pipeline + author scaffolding ([8637dae](https://github.com/event4u-app/agent-config/commit/8637dae4463796726b0d7e737d37169334a0283b))
* **user-types:** lock schema + ADR for runtime user-type axis ([0ce1549](https://github.com/event4u-app/agent-config/commit/0ce1549a1e5037521cb06e9d1c467fa4ebf87d06))
* **eval-findings:** add schema template for step-13 closure evidence ([2b2daa4](https://github.com/event4u-app/agent-config/commit/2b2daa46fbf348f5a2901b185c91901de06a1025))
* **recruits:** add intake template for step-13 P1 recruit walkthroughs ([a569071](https://github.com/event4u-app/agent-config/commit/a569071853d665ca57813fc4c4676bba38716fac))

### Bug Fixes

* **adr:** drop transient roadmap links from user-types axis ADR ([e8d30fe](https://github.com/event4u-app/agent-config/commit/e8d30fe80c2d0b87406571b2c3dbbdd031312998))
* **contracts:** clamp user-type beta-review markers to 90-day window ([25af8cc](https://github.com/event4u-app/agent-config/commit/25af8ccd650d6ea304f5060ebb55c2d034d746a2))
* **refine-ticket:** sync condensed SKILL.md with --user-type persona-voice bullet ([14b9dcd](https://github.com/event4u-app/agent-config/commit/14b9dcdab69f063e1dcfc8d9070892b4d56305b1))
* **refs:** inline AI Council Phase 4 convergence summary ([0e6a578](https://github.com/event4u-app/agent-config/commit/0e6a5780773fbabba6f98a01bd4b25726c996903))
* **adr:** drop transient roadmap links from MCP runtime ADR ([8f2691e](https://github.com/event4u-app/agent-config/commit/8f2691e90130a9333bd9e01d0863ecb0c9f7ec97))
* **template:** bump agent_config_version pin to 2.18.0 ([dd7441d](https://github.com/event4u-app/agent-config/commit/dd7441d2fc0fd785a70272b6520eb0eb29a61a66))

### Documentation

* **user-types:** cross-link personas↔user-types and surface metalworking-shop example ([ac0b0ce](https://github.com/event4u-app/agent-config/commit/ac0b0ce2e356654352d3c4caf1528b3d5772047c))
* **step-13:** link new recruit + eval-finding templates from prerequisites ([57b729a](https://github.com/event4u-app/agent-config/commit/57b729a236bf1b442df140fb2efbdecd9e73ffd9))
* **adr:** record MCP server runtime as Anthropic Python SDK ([5f5d689](https://github.com/event4u-app/agent-config/commit/5f5d6895d4369b313e1a5058eca21807e5566cfd))

### Tests

* **user-types:** add coverage audit script + tests ([ca403bb](https://github.com/event4u-app/agent-config/commit/ca403bb714fd505f539715fe25b7948714d0ee66))
* **user-types:** lock schema, lint, and composition contracts ([cfeb48a](https://github.com/event4u-app/agent-config/commit/cfeb48a9d04956ff9d6744383b44bcabeaa57702))

### Chores

* **roadmap:** close step-6 user-types axis and refresh progress dashboard ([2f50a96](https://github.com/event4u-app/agent-config/commit/2f50a96eeec1ea1bf832ed560553d4e940a94812))
* **roadmap:** close step-14 phases 1+2 against shipped MCP server ([2dcf04b](https://github.com/event4u-app/agent-config/commit/2dcf04bdf5f71bd546b7ec9cf27bbbb7fc6d0ec4))

Tests: 4493 (+17 since 2.18.0)

## [2.18.0](https://github.com/event4u-app/agent-config/compare/2.17.0...2.18.0) (2026-05-16)

### Features

* **lint:** user-type axis frontmatter audit + task wiring ([322bf1d](https://github.com/event4u-app/agent-config/commit/322bf1dc805550cb8c234808bde4235aaf0ba39e))
* **mcp:** filter skill prompts by personal.user_type ([0b09911](https://github.com/event4u-app/agent-config/commit/0b09911ea6ed2870b12b52ee67a922c3df1f919c))
* **install:** wire --user-type flag across install entrypoints ([6589c6b](https://github.com/event4u-app/agent-config/commit/6589c6bce4682d521c12727adc4903e7333a421d))
* **install:** add user_type schema + template placeholder + ADR ([3ede84d](https://github.com/event4u-app/agent-config/commit/3ede84d79ce0d3612ae6d2a862ae239cb01f8762))

### Documentation

* **roadmaps:** close step-9 user-types axis + flip parent step-12 ([f1926dc](https://github.com/event4u-app/agent-config/commit/f1926dc6905128bfcb909dc03e47a37c7754e4e3))

### Tests

* **install:** cover --user-type + sync user_type preservation ([349478f](https://github.com/event4u-app/agent-config/commit/349478fccc608a2a9818585f7c2a43368ee076c0))

### Chores

* **docs:** drop broken step-12 link from getting-started-by-role ([351505a](https://github.com/event4u-app/agent-config/commit/351505a8fbc6626db5dd26cea494d2a4dbaead89))
* **contracts:** inline council verdict + pragma roadmap source-trails ([4442030](https://github.com/event4u-app/agent-config/commit/4442030543b02511ced3643d9c6062e0722448d9))
* **contracts:** drop transient roadmap refs from stable artifacts ([ecad21e](https://github.com/event4u-app/agent-config/commit/ecad21e16b7269257ba95d104b2dce06a9f140a5))
* **contracts:** align keep-beta-until with 90-day window cap ([5c87588](https://github.com/event4u-app/agent-config/commit/5c8758854d19f5790b21bba41c4631e8460caa5e))
* **roadmaps:** retag step-13/14 complexity to lightweight ([e87cd35](https://github.com/event4u-app/agent-config/commit/e87cd35483cb16eb39574a10318c2f9cb720e9a7))
* **template:** bump agent_config_version pin to 2.17.0 ([f6bb24e](https://github.com/event4u-app/agent-config/commit/f6bb24e1267623bd49dffd1deb0c9ae071ea4906))
* **index:** regenerate index after upstream privacy-review desc edit ([fd7fe24](https://github.com/event4u-app/agent-config/commit/fd7fe248b2297021912ec41aff5dd5b1596c9989))

Tests: 4476 (+17 since 2.17.0)

## [2.17.0](https://github.com/event4u-app/agent-config/compare/2.16.0...2.17.0) (2026-05-15)

### Features

* **user-types:** seed install-time axis directory with 7 user-type YAMLs ([d3264a5](https://github.com/event4u-app/agent-config/commit/d3264a5fd2e76e671b415c4a40279427d738c21c))
* **eval:** measure skill-count reduction per user-type (step-12 P3) ([db74b3f](https://github.com/event4u-app/agent-config/commit/db74b3ff2f79499a29eb06ec12b64b054435e7d5))
* **eval:** wire task bench + non-dev baseline 93.75% (step-12 P1) ([b3a0cde](https://github.com/event4u-app/agent-config/commit/b3a0cde598b592de7150bc118190083f181a7279))
* **install:** add --interactive flag for user-type / stack / verbosity capture ([779c368](https://github.com/event4u-app/agent-config/commit/779c3680b22ec3afdd427dfcd32ed4816d541773))
* **schema:** add recommended_for_user_types to skill schema + tag 32 skills ([afb90af](https://github.com/event4u-app/agent-config/commit/afb90af34118036902fb9d2054b1b8c743e650aa))
* **rules:** add 12 domain-safety rules (PII, disclaimers, retention) ([dc9d7f7](https://github.com/event4u-app/agent-config/commit/dc9d7f70644d1b41df7af43f0acfeb8105472345))
* **eval:** add non-dev evaluation corpus for step-12 phase 1 ([9d4881e](https://github.com/event4u-app/agent-config/commit/9d4881e9c366c701f44fcfc9ac3c689665ec91ad))
* **ghostwriter:** enforce alias validation in lint_ghostwriter_source ([3862a08](https://github.com/event4u-app/agent-config/commit/3862a08194037433a721f58795bbc1a60a86b5d8))
* **ghostwriter:** resolve --as=<value> against aliases in write command ([5ae4933](https://github.com/event4u-app/agent-config/commit/5ae493334bd41956a839fd88f0036d6098fb0884))
* **ghostwriter:** add aliases schema + consumer settings toggle ([0d551c9](https://github.com/event4u-app/agent-config/commit/0d551c9818e40fec9fdc3320f1c5d615902f0e7f))
* **ghostwriter:** /ghostwriter:list, :show, :delete maintenance commands ([0cdc009](https://github.com/event4u-app/agent-config/commit/0cdc009c60082d323efe6e495ab84bb4ad6cb48f))
* **ghostwriter:** /post-as cluster (me · ghostwriter) + sync artifacts ([f6aca57](https://github.com/event4u-app/agent-config/commit/f6aca57a178d22cc865a1a0f81065fbae11b3dd1))
* **ghostwriter:** /ghostwriter:write command + disclosure footer ([2f7349e](https://github.com/event4u-app/agent-config/commit/2f7349ec7b40580ab2b9a3b5d19059cd3f750503))
* **ghostwriter:** /ghostwriter cluster dispatcher + /ghostwriter:fetch ([c4d9c09](https://github.com/event4u-app/agent-config/commit/c4d9c09609ddc3de063126ba8c5549069cc49595))
* **ghostwriter:** consumer-side README + gitignore-by-default block ([4ffcb01](https://github.com/event4u-app/agent-config/commit/4ffcb017149cba4ee3207bcfb537e42626831276))
* **ghostwriter:** add package-side fictional fixture + README ([c3daeea](https://github.com/event4u-app/agent-config/commit/c3daeea34dfbcf460930d115053ae439055c87d6))

### Bug Fixes

* **rules:** trim 8 domain-safety descriptions to ≤150 chars ([1f095c1](https://github.com/event4u-app/agent-config/commit/1f095c1c140d2f071a1b6143283b946e94c0d209))
* **contracts:** scrub roadmap refs from router-blending + universal-skills ([36dc8a4](https://github.com/event4u-app/agent-config/commit/36dc8a44012b4cad431c2d46223a738bf476f0a8))
* **contracts:** keep-beta-until within 90-day window (2026-08-13) ([c6f1082](https://github.com/event4u-app/agent-config/commit/c6f108246b48fafad9fd564d1e4d4a493642bc91))
* **schema:** allow applies_to_user_types in rule frontmatter ([80f73f6](https://github.com/event4u-app/agent-config/commit/80f73f639dcb0c8d347b4ccda88ad52ed091747e))

### Documentation

* **roadmaps:** step-12 closure run #2 — author step-9/13/14, flip in-scope, defer external ([6191506](https://github.com/event4u-app/agent-config/commit/6191506a7d70472d164385b4a7b3ab514bd5deb1))
* **roadmaps:** step-12 autonomous closure (Phases 0/1/3/5/7 closed) ([32f3177](https://github.com/event4u-app/agent-config/commit/32f317725f2a5000be0caf64d21d40103ec0be86))
* **announcements:** draft non-dev launch posts + case-study tpl (step-12 P7) ([d624ad6](https://github.com/event4u-app/agent-config/commit/d624ad65392d1994fc65dd1b6b7d33ba18fc80f1))
* **roadmaps:** close step-12 P6 L113 (GitHub repo metadata applied) ([b7099ee](https://github.com/event4u-app/agent-config/commit/b7099ee493d483e3aec07c6d33e767dbf99edc4d))
* **roadmaps:** step-12 final-push annotations + closure report ([0c0e575](https://github.com/event4u-app/agent-config/commit/0c0e5752300a25dfdf1cf09569df2dc37eaf5f6e))
* **contracts:** add init-telemetry v1 wire contract (step-12 P7 L127) ([dc9ea0a](https://github.com/event4u-app/agent-config/commit/dc9ea0a44b801a821ab3a6309c64fadf990eec3a))
* **roadmaps:** step-12 closure report — terminal in-branch state ([70cc0f8](https://github.com/event4u-app/agent-config/commit/70cc0f8adc6485a61c4f1c75ff8bf926f22f1aad))
* **readme:** drop duplicate Laravel-featured-domain section (5 lines) ([a7c332b](https://github.com/event4u-app/agent-config/commit/a7c332bdf61ccb2de358c65f14cb62caf24008bd))
* **contracts:** add stability frontmatter to router-blending + universal-skills ([3273392](https://github.com/event4u-app/agent-config/commit/3273392a9d87d82dd8baad8fc8a61914ffa2bed6))
* **readme:** reframe identity as Universal AI Agent OS ([4b2a328](https://github.com/event4u-app/agent-config/commit/4b2a3282a08ce4c568722597741931c47d21a6b8))
* **readme:** trim README under 750-line floor, extract docs/safety.md ([2b74b1b](https://github.com/event4u-app/agent-config/commit/2b74b1bffed90ea5495fb96de6d9cce2db9415fb))
* **readme:** add data governance & domain safety section ([8aa2b8e](https://github.com/event4u-app/agent-config/commit/8aa2b8edef5a29a3bcbef810c23083c4cfb4e237))
* add role-based + laravel getting-started + CI link check ([ea65555](https://github.com/event4u-app/agent-config/commit/ea655557c785631df83766dd1d63458bf83c876f))
* **ghostwriter:** cross-links, command counts, beta dates, roadmap-ref cleanup ([b8d0fb8](https://github.com/event4u-app/agent-config/commit/b8d0fb8ec230aa5992aedc00d78b0aa56e8ce430))
* **contracts:** write-engine v1 + register /post-as cluster ([94d0cd8](https://github.com/event4u-app/agent-config/commit/94d0cd89d046251ffed6a8c42f415a5c47451503))
* **roadmaps:** mark step-4 Phase 2 complete + regenerate progress ([7ec448d](https://github.com/event4u-app/agent-config/commit/7ec448dc872072ad93921dc0b9b166e5bf122237))
* **contracts:** register /ghostwriter cluster (fetch · write · list · show · delete) ([01b4525](https://github.com/event4u-app/agent-config/commit/01b4525e3272dfb089bdac215f52a6175b9ab47e))
* **roadmaps:** mark step-4 Phase 1 complete + regenerate progress ([5a574e2](https://github.com/event4u-app/agent-config/commit/5a574e27337fc598935281cda331cca0ecc34324))
* **contracts:** lock ghostwriter v1 schema with verification + attestation fields ([421fc2e](https://github.com/event4u-app/agent-config/commit/421fc2e5fee09834590ca2594bf06875e38acfb3))

### Build

* **ghostwriter:** wire lint + copy-as-is sync for package fixtures ([c5a3c79](https://github.com/event4u-app/agent-config/commit/c5a3c791bf51ceb23fde186d3b2f60675107c923))

### Chores

* **scripts:** draft update-github-metadata.sh (step-12 P6 L113) ([2a2c5c2](https://github.com/event4u-app/agent-config/commit/2a2c5c20cadb4ba653a5660797b28add7dfc43a6))
* **index:** regen index + catalog after description trimming ([f4915e4](https://github.com/event4u-app/agent-config/commit/f4915e47172a7b4482a5440f17d543072c90c303))
* **condensation:** propagate trimmed descriptions to dist/agent-src + hashes ([0a9352d](https://github.com/event4u-app/agent-config/commit/0a9352d7d20856301746a5839d25e2d52398920b))
* **ownership:** regen file-ownership matrix ([bc13dd2](https://github.com/event4u-app/agent-config/commit/bc13dd2fe67d5c571f05964b84702cb6d7b193c2))
* **index:** regen agents/index.md + docs/catalog.md ([20fefb0](https://github.com/event4u-app/agent-config/commit/20fefb043a25034a715cb7e76ec6174831357061))
* **roadmaps:** step-12 phases 3 / 5 / 6 done + regen dashboard ([f07a0b1](https://github.com/event4u-app/agent-config/commit/f07a0b15cbe784eb17b9b75d06cae91e726b08f8))
* **generated:** add 12 domain-safety rule symlinks to .claude/rules ([b95364a](https://github.com/event4u-app/agent-config/commit/b95364ae8e52a582ecb8c2598402782e06bfa83d))
* **roadmap:** close step-12 Phase 4 — domain safety rules shipped ([b02290f](https://github.com/event4u-app/agent-config/commit/b02290f50b034ede8f725b9558d1060578024855))
* **roadmaps:** add step-12 universal-os-reframe + regen dashboard ([89e06ca](https://github.com/event4u-app/agent-config/commit/89e06caf5ae21d21fa7f2705720e53888eb53c69))
* **ghostwriter:** close out step-4 — archive roadmap, regen index + ownership matrix, bump template version ([70521c4](https://github.com/event4u-app/agent-config/commit/70521c41bc9305f5d39a7f8f7775388b724c56a6))

Tests: 4459 (+54 since 2.16.0)

