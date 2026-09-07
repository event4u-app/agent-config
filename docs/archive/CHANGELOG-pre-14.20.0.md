# Changelog Archive — pre-14.20.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `14.20.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) by `scripts/release.py`
> once the active era's body crossed the drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md`. Entries
> here are not amended — git tags remain the canonical source
> for what shipped.
>
> Entry shape follows
> [`../contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).

## [14.19.0](https://github.com/event4u-app/agent-config/compare/14.18.0...14.19.0) (2026-09-07)

### Release highlights

- **Behaviour changes:** drop a comma from the three skill-reachability lines (be57b0c); skills are named or trigger-matched, not matched by topic (edbc6a5); keep autonomous-execution inside the size its pointer claims (a9d21e2); fit the directory-flag line inside the preamble ratchet (5d1d002); bump the skill schema patch for the corrected host claim (a5281be); pay for the host-wording correction in the preamble budget (26659d6); +4 more.
- **Default changes + migration:** move the column migration out of a file past its cap (03eedeb).
- **Security and correctness:** split the claim check out of the census into a check_ gate (88132c6); re-pin the gate-coverage canary line to 598 (3a8e3f7); separate repository drift from store drift in the staleness verdict (6d9284a); route the merged permission-decision envelope through the table (b4e4573); read the expiry verdict through the as-of seam (f6f862a); type the bridge reads instead of suppressing the lint (285c0e0); +8 more.
- **Honest nulls:** close road-to-the-ledger-two-releases-skipped (7cb1af8).
- **Known limitations:** _none_

> **Governance mix:** governance-only 52 vs consumer-only 17 (taxonomy 1.0.0).
> Next cycle ships the installed MCP bridge repair — a version-pinned server
> entry instead of an `npx -y` resolution of `latest`, a registration that
> migrates itself when the bridge shape changes under an update, and setup docs
> matching the command the installer actually writes — tracked in
> `agents/roadmaps/road-to-mcp-bridge-integrity-and-reach-truth.md`, which stands
> at zero of its seventeen steps at this tag.

> **Previous cycle:** the 14.18.0 head promised the installed MCP bridge repair —
> a version-pinned server entry instead of an `npx -y` resolution of `latest`, a
> registration that migrates itself when the bridge shape changes, and setup docs
> matching the command the installer writes. It **did not ship**. `MCP_BRIDGE_ENTRY`
> still resolves `npx -y @event4u/agent-config`
> (`src/scripts/_lib/mcp_bridge.ts:38-45`) and the roadmap carrying it,
> `road-to-mcp-bridge-integrity-and-reach-truth`, stands at zero of its seventeen
> steps. The promise is not withdrawn; it is outstanding, and from this release on
> a head that leaves the previous head's promise unanswered is refused by
> `check_release_highlights`.

### Features

* **ci:** call the activation census at release time and register it ([ec7282e](https://github.com/event4u-app/agent-config/commit/ec7282ef65bf1fb19c322242c6f7de38d00b71ba))
* **census:** give the activation census a record, a claim check and a self-test ([1ce9fc0](https://github.com/event4u-app/agent-config/commit/1ce9fc005491174adcdd5abe8171cd7fe025e4c4))
* **skills:** the design family becomes router-visible ([044a15c](https://github.com/event4u-app/agent-config/commit/044a15c8c1bda4ae4b682b71b53760cc07088976))
* **fe-design:** frequency and initiation are declared, never inferred ([5a051c6](https://github.com/event4u-app/agent-config/commit/5a051c691dfcd0cf6b04aa6863aa713d9890baf0))
* **design:** the Motion dial reads frequency and initiation ([027dc78](https://github.com/event4u-app/agent-config/commit/027dc7869de803f6859a1fe7e5d058b505edf01c))
* **evidence:** a feel type, for motion that is correct and still wrong ([0b25dc0](https://github.com/event4u-app/agent-config/commit/0b25dc0cf4fb06ccf006beae08e7ac3cc3df8b41))
* **design:** the antipattern catalog says what class a row is ([347c1d0](https://github.com/event4u-app/agent-config/commit/347c1d02cdecf7788ffcaa14de9c8806513d1034))
* **design:** one motion authority, and a gate that fails on drift ([a09dc6e](https://github.com/event4u-app/agent-config/commit/a09dc6e962500f3f559e112bc00c774da21be120))
* **measurement:** baseline the friction instead of asserting it ([6d4292e](https://github.com/event4u-app/agent-config/commit/6d4292ee351cddb5882bc9e071a0d86074215efe))
* **hooks:** give a host-capability fact an expiry, and enforce it ([407f657](https://github.com/event4u-app/agent-config/commit/407f657c65666b3a5960726c1499dee5e9f57f2f))
* **hooks:** record the surface a dispatch came from ([a3f0657](https://github.com/event4u-app/agent-config/commit/a3f06577fd74d99a898ba3a4f3f552553decc554))
* **hooks:** one table for host lowering, replacing five constants ([646fdab](https://github.com/event4u-app/agent-config/commit/646fdaba103a6dac42e9fd3df8742a5369337a20))
* **ledger:** record the consequence operations the owner named ([c299ece](https://github.com/event4u-app/agent-config/commit/c299ece07d4c01357eb444a21fbb183c54ac7e14))
* **doctor:** report the host permission settings that produce prompts ([473f4e1](https://github.com/event4u-app/agent-config/commit/473f4e18e3e7211f3edbc499ba81de8bc4ed4c4e))
* **hooks:** emit permissionDecision allow for category-A tool calls ([e9fef89](https://github.com/event4u-app/agent-config/commit/e9fef896b1680f19a7ff8ae78d5014b660a90f82))
* **gates:** give the RDP corpus a validator and the trigger contradiction a check ([6ff326c](https://github.com/event4u-app/agent-config/commit/6ff326ccce27a7f371e405c33be8c8900d7fc31a))
* **gates:** pin a coverage row to the workflow invocation it claims ([80cb0cb](https://github.com/event4u-app/agent-config/commit/80cb0cb10e3f0a3298121c631fe487036928316a))
* **gates:** an empty findings ledger must state why it is empty ([2db593c](https://github.com/event4u-app/agent-config/commit/2db593c51da43ef5e882acff82bda98577a59357))
* **release:** read the previous head's next-cycle promise back ([f6cae66](https://github.com/event4u-app/agent-config/commit/f6cae669502652899467ebdd56b90a2625e6ea69))
* **adr:** surface dated review triggers in the ADR index ([ead5eaf](https://github.com/event4u-app/agent-config/commit/ead5eaf8983d18b2bf42fb4d825d143f8f22bc6e))
* **adr:** decide a review trigger whose condition is a date ([2974a54](https://github.com/event4u-app/agent-config/commit/2974a54eb4d4e71f4072916c32ef40cb7e7494ef))
* **gates:** assert a coverage row runs its gate the way the pipeline does ([0ec7893](https://github.com/event4u-app/agent-config/commit/0ec789358261b47e0a92f7eec7e947fd255429a1))
* **gates:** measure the two README dimensions that regressed unseen ([d18aa13](https://github.com/event4u-app/agent-config/commit/d18aa139eed673e98f93cac281b0dc5acfa9e3bf))
* **gates:** report beta contracts about to lapse, not only those that have ([3c5b868](https://github.com/event4u-app/agent-config/commit/3c5b8685dca0b218985988b85026ed9b8ef503ed))

### Bug Fixes

* **gates:** split the claim check out of the census into a check_ gate ([88132c6](https://github.com/event4u-app/agent-config/commit/88132c6a98ebf9ddb8f7a09f099f5aa5400e452f))
* **roadmaps:** correct what `status: carrier` actually exempts ([80235da](https://github.com/event4u-app/agent-config/commit/80235dacdd6b4edf8d514b75c41423672097d7aa))
* **census:** separate repository drift from store drift in the staleness verdict ([6d9284a](https://github.com/event4u-app/agent-config/commit/6d9284a0f843bace0095305e0cf6250a3135bd2c))
* **design:** name the reduced-motion media query, not a bare rule token ([3b19777](https://github.com/event4u-app/agent-config/commit/3b19777e22d9e451d85049a3e3d4fcdf4e33e7d9))
* **hooks:** route the merged permission-decision envelope through the table ([b4e4573](https://github.com/event4u-app/agent-config/commit/b4e45734a91b4ddd4f26d4725654c97e0b126e12))
* **gates:** read the expiry verdict through the as-of seam ([f6f862a](https://github.com/event4u-app/agent-config/commit/f6f862aeb08e7968d6017e815072763996e42e10))
* **tests:** type the bridge reads instead of suppressing the lint ([285c0e0](https://github.com/event4u-app/agent-config/commit/285c0e0f717954dce7013f6af8ce0615b4e79f62))
* **rules:** keep autonomous-execution inside the size its pointer claims ([a9d21e2](https://github.com/event4u-app/agent-config/commit/a9d21e216216df071577df8458921cad57e53b3b))
* **schema:** bump the skill schema patch for the corrected host claim ([a5281be](https://github.com/event4u-app/agent-config/commit/a5281bea1f1c41288885637cfc904f9f8d6eb47c))
* **rules:** pay for the host-wording correction in the preamble budget ([26659d6](https://github.com/event4u-app/agent-config/commit/26659d642f2d7419a71fa1dbea283a63de8bc0b0))
* **skills:** address a directory by flag where the tool has one ([f4d757f](https://github.com/event4u-app/agent-config/commit/f4d757fd5efa75eb2331085e8dd231acdbe20b35))
* **gates:** drop the duplicate argv-parity mechanism, use the one main already has ([dbfd08e](https://github.com/event4u-app/agent-config/commit/dbfd08e64948f2a6131c413b95bbe3a9908aae82))
* **hooks:** parse git global options in the category-A classifier ([26f928b](https://github.com/event4u-app/agent-config/commit/26f928be6d0d4365455f76f05e74de126804c320))
* **hooks:** stop naming files the TypeScript port deleted ([6c897ef](https://github.com/event4u-app/agent-config/commit/6c897efd16d773bf9051aa943afa9df227e50082))
* **rule:** keep the directory-flag guidance stack-agnostic ([794ecd4](https://github.com/event4u-app/agent-config/commit/794ecd4db1052a62509325e855d230da1e64fe76))
* **canon:** address another directory by flag, not by `cd` ([3d0ad90](https://github.com/event4u-app/agent-config/commit/3d0ad90f0ba3df62ae3108ee249b83e0faed559d))
* **gates:** typecheck the unknown-key scan, and correct a docblock claim ([bedd18c](https://github.com/event4u-app/agent-config/commit/bedd18c2aca19ff59ca2174ee0f8b214fbb7cb7a))
* **rdp:** point the corpus at the successors that exist, not the deleted Python ([5be6ab9](https://github.com/event4u-app/agent-config/commit/5be6ab981fd92aa65cfb2526df545fea70a4f7db))
* **skills:** drop the auto-trigger keywords the descriptions contradict ([720eb73](https://github.com/event4u-app/agent-config/commit/720eb7333fcb248ba82d673dc9e779a6b20d76e2))
* **readme:** hoist only the wedge command, keep the audience-order contract ([14a7204](https://github.com/event4u-app/agent-config/commit/14a72049094907ca784d07a3d3df97d6f64412cc))
* **ci:** site.yml no longer reasons from a premise that stopped holding ([7de0594](https://github.com/event4u-app/agent-config/commit/7de05947159cc53ab49dd59f2176f3404ceb4061))
* **review-changes:** count the judges from the table, not by hand ([18b0070](https://github.com/event4u-app/agent-config/commit/18b00708d9a163502d68f66445fe1f30f60b9b5a))
* **proof:** publish the kernel-denied split beside the undeclared figure ([476d4c0](https://github.com/event4u-app/agent-config/commit/476d4c0af412f81018d3ea083efd425485112169))
* **roadmap:** the blocking-concern count was taken by grep, not by parse ([7f947fc](https://github.com/event4u-app/agent-config/commit/7f947fc0663aad038e89d0014878858300baad76))

### Performance

* **skills:** compress the ten design descriptions back under the preamble ratchet ([63640b1](https://github.com/event4u-app/agent-config/commit/63640b18a0c1279e5467145e673457eaf046c841))

### Documentation

* **census:** the exit-code contract now has three modes, not one ([776efc6](https://github.com/event4u-app/agent-config/commit/776efc6c7b3684d6ddff0266b5b92074de6a009a))
* skills are named or trigger-matched, not matched by topic ([edbc6a5](https://github.com/event4u-app/agent-config/commit/edbc6a5b2e69044069bbe56d66e4d92b2f56e950))
* **claims:** derive the census claim from its record and split the 299 ([265d095](https://github.com/event4u-app/agent-config/commit/265d095be07a9d9823bddecd3506d735476bb0a1))
* **roadmap:** close road-to-one-motion-authority with both blockers decided ([a6071a6](https://github.com/event4u-app/agent-config/commit/a6071a6f420cffa79741d7a815dfdd8088acd6d2))
* **review:** rebind the inbox-2026-09-t skip declaration after merging origin/main ([b4be39a](https://github.com/event4u-app/agent-config/commit/b4be39a346c37d4af6df3f8eeb0e6d6c459497a2))
* **decisions:** disclose what ADR-255 rests on ([e5238e9](https://github.com/event4u-app/agent-config/commit/e5238e9505a5f5b161479630283337ff3536e966))
* **roadmap:** close and archive road-to-authorization-that-reaches-further ([8061844](https://github.com/event4u-app/agent-config/commit/8061844dcfe99e9ec627e071933a7a69f774932f))
* **decisions:** record five scoped refusals and close the blockers ([9a3b6e5](https://github.com/event4u-app/agent-config/commit/9a3b6e5ac7801a2c45ac3324cc96b0066a91c148))
* **roadmap:** close road-to-host-enforcement-truth ([b1f3adf](https://github.com/event4u-app/agent-config/commit/b1f3adf053dc51e5da3dfae9aa1189fd9f643390))
* **review:** skip declaration for the inbox-2026-09-t completion ([c9c4298](https://github.com/event4u-app/agent-config/commit/c9c4298a999b39be3ce4272553ddf22326dc7f34))
* **evidence:** verification and disposition for inbox round 2026-09-t ([045afef](https://github.com/event4u-app/agent-config/commit/045afefb6baeb5d671f96c00355edc277b6088fb))
* **hosts:** say what this package binds, not what a host cannot do ([2b20145](https://github.com/event4u-app/agent-config/commit/2b2014509f26cd4b2177edefe70d01d91d57b734))
* **evidence:** record drain run 19 ([80a23d1](https://github.com/event4u-app/agent-config/commit/80a23d193a84f3fbee0b56b76e232bccffdb9207))
* **roadmaps:** close road-to-the-reasoning-surface-that-is-wired ([17f6b62](https://github.com/event4u-app/agent-config/commit/17f6b6261eb4f8fa3f0c11201ccd117e69d537ed))
* **roadmap:** close road-to-the-ledger-two-releases-skipped ([7cb1af8](https://github.com/event4u-app/agent-config/commit/7cb1af8bc91f87a45fe8e66d9249e812a39e5b95))
* **roadmap:** move the release-finding-ordering review date in ([aadd854](https://github.com/event4u-app/agent-config/commit/aadd854b0a2707cf6722ce510d60d7bfd6bd5675))
* **evidence:** record the two skipped release ledgers and write them ([73a50c6](https://github.com/event4u-app/agent-config/commit/73a50c6472213fddc13bd4446e3e71242becf4b0))
* **evidence:** record ADR-134s unrouted expiry and close the roadmap ([a42bf57](https://github.com/event4u-app/agent-config/commit/a42bf57a6fc75bb3b76ffccc45363601c46bcea4))
* **changelog:** answer the 14.18.0 next-cycle promise ([a9bd75d](https://github.com/event4u-app/agent-config/commit/a9bd75d559107ad3766f0f6af5ee44f958492f00))
* **roadmaps:** close road-to-a-readme-that-stays-short ([25e519d](https://github.com/event4u-app/agent-config/commit/25e519d4fdae30fba55837375df44ca06d3d72be))
* **readme:** reach the first command at line 26 and come back under budget ([52c326d](https://github.com/event4u-app/agent-config/commit/52c326d12bab0a5894e20d1794c085ea70d29d70))
* **roadmaps:** close road-to-a-beta-window-that-is-not-a-surprise ([8f78a41](https://github.com/event4u-app/agent-config/commit/8f78a413d8cca250db889c62525fee4460af054e))
* **roadmaps:** own the two beta dates that nothing owned ([d3982cc](https://github.com/event4u-app/agent-config/commit/d3982ccc8c45920ee03c0b1945096015d74c019a))
* **evidence:** repoint both records at the archived roadmap path ([f51ef0a](https://github.com/event4u-app/agent-config/commit/f51ef0a59214b8245b6c48b5efd806d49763d74e))
* **decisions:** ADR-225 Amendment 1 answers the fired skill-size park ([85f3249](https://github.com/event4u-app/agent-config/commit/85f3249ddf9fad47556ae4bc1230c45937f711d4))
* **evidence:** record the council on the ADR-225 skill-size park, prompt included ([252cb2f](https://github.com/event4u-app/agent-config/commit/252cb2f144a155745b1d395c3241123f8b87ff70))
* **evidence:** reproduce the ADR-225 skill-size park condition at HEAD ([99f09a1](https://github.com/event4u-app/agent-config/commit/99f09a11ae55b4b157c9d39e9c8fb869290e32e7))
* **review:** skip declaration for the inbox-2026-09-s completion ([437f500](https://github.com/event4u-app/agent-config/commit/437f5003bb0d385187caab78f4ce23983dbf67e4))
* **evidence:** verification and disposition for inbox round 2026-09-s ([832a48f](https://github.com/event4u-app/agent-config/commit/832a48f3cc351bda3d4e49f2481dbd47c1fbbc4e))
* **review:** rebind the inbox-2026-09-r skip declaration to the current review scope ([e0344f8](https://github.com/event4u-app/agent-config/commit/e0344f8be1596a353ee641a2e77bffe06e344f18))
* **review:** skip declaration for the inbox-2026-09-r completion ([ec522f9](https://github.com/event4u-app/agent-config/commit/ec522f91a532e665bd2bd6e6f563047ae97c130f))
* **evidence:** verification and disposition for inbox round 2026-09-r ([b132b36](https://github.com/event4u-app/agent-config/commit/b132b36cc557a59680bfdb992c29fce162651b9e))
* **review:** skip declaration for the inbox-2026-09-q completion ([b8be9d2](https://github.com/event4u-app/agent-config/commit/b8be9d22209f891d85cd176dfbd2f595f2c1531a))
* **evidence:** verification and disposition for inbox round 2026-09-q ([a2d7e1b](https://github.com/event4u-app/agent-config/commit/a2d7e1bfc9a03e346a1ec70e5a9bead59e60e4c9))

### Refactoring

* **rule:** fit the directory-flag line inside the preamble ratchet ([5d1d002](https://github.com/event4u-app/agent-config/commit/5d1d002a3c0d2003efa17f326eabdc8eef9338d6))
* move the round's additions out of two capped files ([6e9d41c](https://github.com/event4u-app/agent-config/commit/6e9d41cc7d84ae22027aa7cb73f6df57e70aab50))
* **journal:** move the column migration out of a file past its cap ([03eedeb](https://github.com/event4u-app/agent-config/commit/03eedebebc10651e5eb1e8e92a7eb84c9fe648e7))

### Tests

* **estate:** re-derive the two pins the description rewrites moved ([7b4b879](https://github.com/event4u-app/agent-config/commit/7b4b8798f94c30e29c729eaa4e61ba6ecda2cc04))
* **hooks:** measure the cross-load claim before guarding against it ([1a00c97](https://github.com/event4u-app/agent-config/commit/1a00c970c07a5f67d2465dead568934084e413ca))

### Build

* **install:** refresh the committed installer bundle ([0721e3c](https://github.com/event4u-app/agent-config/commit/0721e3c735755037b352ae9decb61f966ba45b00))

### CI

* run both new gates in a workflow, not only in `task ci` ([6cbf98c](https://github.com/event4u-app/agent-config/commit/6cbf98c163604b1fc0ff12b49f7a3c1c8c944bd7))
* run the findings-ledger gate outside the release/* condition ([fa92daa](https://github.com/event4u-app/agent-config/commit/fa92daa86855a239139a490ad8478d84cfc66676))

### Chores

* **security:** re-pin the gate-coverage canary line to 598 ([3a8e3f7](https://github.com/event4u-app/agent-config/commit/3a8e3f7552133f53e7dccdef596116d4a34d0e87))
* **docs:** regenerate the skill index and catalog ([d310e09](https://github.com/event4u-app/agent-config/commit/d310e09382ffac61349cfdd37ce4d0da980911fa))
* **roadmaps:** archive road-to-the-activation-census-consequence ([eb2491d](https://github.com/event4u-app/agent-config/commit/eb2491d37786335841fd09e16b283aaec5b954ab))
* **roadmap:** archive road-to-one-motion-authority ([e88e3bf](https://github.com/event4u-app/agent-config/commit/e88e3bfaf4484705590dcbd7d3441a88240b9ddd))
* **adr:** refresh the evidence census after ADR-255's disclosure section ([ef16d7f](https://github.com/event4u-app/agent-config/commit/ef16d7ff2583496bbf291c92d933ce379df65dbd))
* **gates:** walk the source-size ratchet down to the new measurement ([b5e448d](https://github.com/event4u-app/agent-config/commit/b5e448d7b28ccea353b5918aeebbac4786dbe690))
* **roadmaps:** archive road-to-host-enforcement-truth ([2dbe4d9](https://github.com/event4u-app/agent-config/commit/2dbe4d90208371fdbd69d79cacc5d44f328a84c6))
* **roadmaps:** archive road-to-the-reasoning-surface-that-is-wired ([814a361](https://github.com/event4u-app/agent-config/commit/814a3613d5b04ed9809dd774f9b3f62045c5394c))
* **secrets:** re-pin the gate-coverage canary line 551 to 563 ([ef863b9](https://github.com/event4u-app/agent-config/commit/ef863b9294184cc748ed94de4e4c57d06bd9f92f))
* **roadmap:** archive road-to-the-ledger-two-releases-skipped ([9fa962b](https://github.com/event4u-app/agent-config/commit/9fa962b3eb9ec1bc8e19493517119e8b94ab4684))
* **roadmaps:** archive road-to-a-dated-trigger-that-decides ([870dae2](https://github.com/event4u-app/agent-config/commit/870dae2cafa98037edaf18938a8a52863ed81db6))
* **roadmaps:** archive road-to-a-readme-that-stays-short ([213e5b9](https://github.com/event4u-app/agent-config/commit/213e5b9314e3e10ca1fe83ec372eeb0fa8e73ff2))
* **roadmaps:** archive road-to-a-beta-window-that-is-not-a-surprise ([4076ef9](https://github.com/event4u-app/agent-config/commit/4076ef9d576a27c2f56776b6e428d7177b894488))
* **docs:** regenerate command-flows for the corrected judge counts ([37d69cb](https://github.com/event4u-app/agent-config/commit/37d69cb4844e0739a89b00cd6af157aa518f1483))
* **evidence:** refresh the ADR evidence census after the ADR-225 amendment ([1a88ac4](https://github.com/event4u-app/agent-config/commit/1a88ac489f48d55aa9084727e820cb3540dc54c9))
* **roadmaps:** archive road-to-the-skill-size-park-fired ([497fb13](https://github.com/event4u-app/agent-config/commit/497fb1322a972e8377fb5ecb4a90667fe98c5d34))
* **index:** regenerate agents/index.md + docs/catalog.md ([a97717c](https://github.com/event4u-app/agent-config/commit/a97717cfa4ffb6a8ee27b633335418821fef8855))
* **roadmaps:** archive road-to-figures-that-name-their-denominator ([1972c62](https://github.com/event4u-app/agent-config/commit/1972c628d666ff9580e93c255893bfedc80ba1db))

### Other

* drop a comma from the three skill-reachability lines ([be57b0c](https://github.com/event4u-app/agent-config/commit/be57b0c09e6679dee791ffa6c42a8a9abaaf8102))
* close the activation-census consequence, carry its framing choice ([9278c13](https://github.com/event4u-app/agent-config/commit/9278c130d04bb27dc4d0f6a84aa8c53bf9c3282d))
* resolve the retirement blocker with option 1 and harden the end state ([64547a8](https://github.com/event4u-app/agent-config/commit/64547a8f4a0816dac401848daaba8e8439eba1ff))
* one continuity record, from inbox round 2026-09-t ([5e48184](https://github.com/event4u-app/agent-config/commit/5e4818468ebab9ef29e620ee1bd83f24e01d7787))
* write the continuity arrival counter onto its most recent archived epoch ([6bceab9](https://github.com/event4u-app/agent-config/commit/6bceab9073c09902801c905873eed6699bdc2444))
* **proof:** drop the section mark from the axis comment ([4ba967a](https://github.com/event4u-app/agent-config/commit/4ba967a2e70625e59a1034d5ea2ffb8f3095cabd))
* close road-to-figures-that-name-their-denominator ([c68fe04](https://github.com/event4u-app/agent-config/commit/c68fe041d1fdd0be207ff14fb2bbfcfe9deabf1d))
* measured prose tells, from inbox round 2026-09-s ([3b33220](https://github.com/event4u-app/agent-config/commit/3b33220c3b72c851a88d5107a7a83a7476837015))
* write the humanizer arrival counter onto its archived parent ([6b19271](https://github.com/event4u-app/agent-config/commit/6b1927134517f3833f0f429eb091eb82be0d9982))
* four roadmaps and one stub from inbox round 2026-09-r ([e3592b0](https://github.com/event4u-app/agent-config/commit/e3592b0995284597b2190c16f170474964819d29))
* write arrival counters onto four held objects that had none ([936fd33](https://github.com/event4u-app/agent-config/commit/936fd33d32c50fb6d590630d4f2eab50f10fa679))
* four roadmaps and one stub from inbox round 2026-09-q ([a3c09f0](https://github.com/event4u-app/agent-config/commit/a3c09f04c4287183fc5ac7a104e012d01671dc4c))

Tests: 21476 (+286 since 14.18.0)
