# Changelog Archive — pre-10.3.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `10.3.0`, split out of the main
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

## [10.2.0](https://github.com/event4u-app/agent-config/compare/10.1.0...10.2.0) (2026-08-13)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 1bb1076, 698aa3f, d805133, 973787a.
- **Default changes + migration:** _none_
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits in 0309b8e.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in c428ac6.
- **Known limitations:** _none_

### Features

* **process:** give operator symptoms a home and codify the loop that resolves them ([6e01a24](https://github.com/event4u-app/agent-config/commit/6e01a24bb9c0a2496feca0a5dfb69d50fefa5fbf))
* **gates:** warn on unresolved operator symptom entries past 30 days ([ef98cfa](https://github.com/event4u-app/agent-config/commit/ef98cfa7d02c98ec88abf0ec9b778af12b2b6e91))
* **rules:** size-gated reads — probe a large file before loading it whole ([1bb1076](https://github.com/event4u-app/agent-config/commit/1bb10767269e1d348a874b845f0176fc1c83deba))
* **hooks:** severity follows the input type — prose alone may not block ([2716d4f](https://github.com/event4u-app/agent-config/commit/2716d4f87280b71f7301a885a9c10da1f1f00ffd))
* **settings:** gate the deletion side of the surface, not just the addition side ([da3bc3c](https://github.com/event4u-app/agent-config/commit/da3bc3c536184462c73a7214be953b8a57f9c432))
* **settings:** delete the six keys no code path read ([973787a](https://github.com/event4u-app/agent-config/commit/973787a6026d9b18f86f9961d7286993c6a491b8))
* **settings:** add the disposition axis to lint_settings_classes ([4c9ced8](https://github.com/event4u-app/agent-config/commit/4c9ced8908a9e89e2f9b8684cb4f1f6642d55c55))
* **conformance:** give task-completeness a denominator, and cover it ([18e4a0c](https://github.com/event4u-app/agent-config/commit/18e4a0c85cd705e5f404ea5b08f7a1018b7a7c3b))
* **conformance:** measure task completeness before refusing on it ([11610f8](https://github.com/event4u-app/agent-config/commit/11610f85c46d0eeb024ccb224e9236d264ffe0fe))

### Bug Fixes

* **roadmap-writing:** fit the symptom-loop route without tripping the size check ([d5b3253](https://github.com/event4u-app/agent-config/commit/d5b3253f7875ab4da2da45a869cbbcb134a03763))
* **roadmaps:** anonymize the vendored corpus upstream outside its attribution file ([8406ac8](https://github.com/event4u-app/agent-config/commit/8406ac8c52a75355e0c704184aea123c7895d2fc))
* **roadmaps:** satisfy the complexity and blocker contracts on two active plans ([498cea7](https://github.com/event4u-app/agent-config/commit/498cea7c93bdbea57e00b5d6ba56ca828692e34f))
* **contracts:** the rule-router described a Claude Code gap that closed in PR #1231 ([f87240d](https://github.com/event4u-app/agent-config/commit/f87240d899e5418fa256e6462160b74466ad728d))
* **context-hygiene:** name the wait shape both loop clauses miss ([698aa3f](https://github.com/event4u-app/agent-config/commit/698aa3f65e704e3fa796be606c54a880c0736d01))
* **turn-end-gate:** stop refusing the honest "not done yet" line ([f85a8c7](https://github.com/event4u-app/agent-config/commit/f85a8c713d7bfa1d577ed1897261493ab1336d33))
* **git-guard:** classify the verb that is invoked, not the one that is named ([1b0d42d](https://github.com/event4u-app/agent-config/commit/1b0d42dd4135af012647853a469b1e43070d6502))
* **transcripts:** close the store-slug character class instead of widening it ([580f12d](https://github.com/event4u-app/agent-config/commit/580f12ddb9e1dc1c2d0a5ca9d0d2961707fa3b76))
* **evidence:** a worktree location is not a verdict subject ([351f245](https://github.com/event4u-app/agent-config/commit/351f245b946d5ec186d454888dfa65764003de32))
* **review:** stop the findings artefact citing a path that is the finding ([3dc1f86](https://github.com/event4u-app/agent-config/commit/3dc1f863d6c15b1afdccf0700897cc463eb80ccb))
* **council:** close the seven review findings, including two tests of mine that could not fail ([368c895](https://github.com/event4u-app/agent-config/commit/368c895d78d50b79520b686ade54e7d9aeddfe76))
* **council:** the spawned member answered the caller's hooks, and held tools it never needed ([67efa72](https://github.com/event4u-app/agent-config/commit/67efa720e380e54989c0e95b14285b729f5e279b))
* **council:** gemini rejects --system too, and two members dropped the system prompt entirely ([9faee19](https://github.com/event4u-app/agent-config/commit/9faee19e22fcf51cd21c04b7b12bd0a4da7bfb4e))
* **council:** close six of the eight review findings ([01c7b1f](https://github.com/event4u-app/agent-config/commit/01c7b1fb23ecfee991477d5c086ebc977fa5720b))
* **roadmap:** make the PR the end condition of /roadmap:next, not a step ([0184f3b](https://github.com/event4u-app/agent-config/commit/0184f3b92c8ce975c6f9eab815060f09e0479149))
* **council:** print the post-run quorum, not only the pre-run one ([cd8e518](https://github.com/event4u-app/agent-config/commit/cd8e518c115b2b873e2c85fc8aaf1c85edc37f67))
* **council:** codex exec has no --system flag, so stop passing one ([990d698](https://github.com/event4u-app/agent-config/commit/990d6982ff7f79c1979a96e5b8a37beaa788e65c))
* **review:** close the R2 findings, one of them by admitting the fix was half-built ([ff8be31](https://github.com/event4u-app/agent-config/commit/ff8be31c5aea39a2b85874b1d1224f463a12b0d7))
* **session-eol:** stop recommending /clear without checking the envelope exists ([ee27132](https://github.com/event4u-app/agent-config/commit/ee2713277230081929096719893739f64b416913))
* **session-recycle:** refuse a write into an unanchored working directory ([825df09](https://github.com/event4u-app/agent-config/commit/825df094771c44bbab37de44ea03c713e39980cd))

### Documentation

* **roadmaps:** archive the symptom-driven harvest loop, fully executed ([d8ddccb](https://github.com/event4u-app/agent-config/commit/d8ddccb8707be0e39b15106f5181964c6f32f531))
* **roadmaps:** adopt the four August plans plus their program layer ([f84ba70](https://github.com/event4u-app/agent-config/commit/f84ba70e4bc56c9413d05ae6f9aa0189c3e629d1))
* **review:** re-bind the skip declaration to the Phase 2 re-cut scope ([ceac026](https://github.com/event4u-app/agent-config/commit/ceac02600bc198309163b7d269b87c6c648e4049))
* **roadmap:** re-cut Phase 2 to the downstream evidence control, cancel Phase 3 ([614f3df](https://github.com/event4u-app/agent-config/commit/614f3dfdfe6f4eb3e0c805769bd19ad1846c61ed))
* **contracts:** correct the prompt-channel residual — the prompt IS readable ([35a7796](https://github.com/event4u-app/agent-config/commit/35a7796ce728c6c6e70d10d813eb0da083c343bb))
* **roadmap:** corpus knowledge skills — the compiler gap, with eight corrections to the source ([c428ac6](https://github.com/event4u-app/agent-config/commit/c428ac61f8da7aa8e83f0f71758166fcf7e2eb42))
* **review:** declare the structured-guard-input measurement a no-code-surface skip ([44c5092](https://github.com/event4u-app/agent-config/commit/44c5092c522fbf4cff0db2ade5e731266c521784))
* **evidence:** measure the three Phase-1 falsifiers before building the field ([e817d50](https://github.com/event4u-app/agent-config/commit/e817d5084d67d5d937e65fcf86926ab4e640a566))
* **contracts:** state which text a guard reads, pre- or post-expansion ([953e7c1](https://github.com/event4u-app/agent-config/commit/953e7c1efca019061ba37842726fcf8fd27a198e))
* **review:** declare the waiter-discipline completion a no-code-surface skip ([cf2019e](https://github.com/event4u-app/agent-config/commit/cf2019ea2da0473ee36906f99b98a76be50541fa))
* **roadmap:** regenerate the dashboard after resolving the merge ([f2e6179](https://github.com/event4u-app/agent-config/commit/f2e617964b360f61d3cf32cf3094564498f25f44))
* **roadmap:** risk register for the structured-guard-input plan ([224eda9](https://github.com/event4u-app/agent-config/commit/224eda90be5f1918bc0f59cf6aa0072ef0c259a1))
* **council:** record the convergence and the work it does not fit in ([806e40c](https://github.com/event4u-app/agent-config/commit/806e40c25dbc148d51cccd51438c6622c451f9bc))
* **roadmap:** close zero-settings 2.1, 2.2 and 4.1, and re-date the blocker ([9acf679](https://github.com/event4u-app/agent-config/commit/9acf679f83a5ec260cc0b8be73aa98cd5bb3a219))
* **roadmap:** regenerate the dashboard after the merge ([945d614](https://github.com/event4u-app/agent-config/commit/945d6148a4e1cda1f01bdd8da769b58bd66a880e))
* **roadmap:** record that a failed council attempt still spends quota ([d6e6f11](https://github.com/event4u-app/agent-config/commit/d6e6f11ab78b2ec593098b3e850be94e7e342800))
* **roadmap:** close zero-settings 2.1, 2.2 and 4.1; record why 3.1 and 3.2 stay open ([c5499d9](https://github.com/event4u-app/agent-config/commit/c5499d94529da815709afa2d9776b69acc6ee5b4))
* **settings:** the telegraph rule states its own scope, and four contracts stop naming a dead key ([d805133](https://github.com/event4u-app/agent-config/commit/d805133257302e0beaa732cb1dd33ee413ceb4a6))
* **settings:** republish the counts, the floor, and the reclassification argument ([e53a799](https://github.com/event4u-app/agent-config/commit/e53a7992f4eb49b0859a267c7814434a263fdf4e))
* **audit:** record the cross-project session audit and its refusals ([dddafe9](https://github.com/event4u-app/agent-config/commit/dddafe91e36f2eceb243d8292e1da087eeff00d0))
* **review:** re-bind the adapter-follow-up artefact to the fixed scope ([783b784](https://github.com/event4u-app/agent-config/commit/783b784456429ff897538f23ffd83250c8e67b89))
* **review:** record the R2 findings on the adapter follow-up before fixing them ([a910931](https://github.com/event4u-app/agent-config/commit/a910931b3fe915c97902b90ecdea9540d4b07284))
* **review:** re-bind the context manifest, not only the marker ([3a22d35](https://github.com/event4u-app/agent-config/commit/3a22d357e7d6f5c93e4a8b855a58dd423762c09f))
* **review:** re-bind the R2 artefact to the fixed scope ([e6b4ce8](https://github.com/event4u-app/agent-config/commit/e6b4ce8e968d54a5bb22ca0b8d9f0d36ee7069fb))
* **review:** record the R2 completion review before the fixes ([169fcfd](https://github.com/event4u-app/agent-config/commit/169fcfd9d454ef9951c698783ea8859ff94462a4))
* **evidence:** task-completeness measures 0 of 3 precision — detector D is not built ([a7f6ffd](https://github.com/event4u-app/agent-config/commit/a7f6ffd459c7b5f19db087b31ccd42de5a85504b))
* **roadmap:** close zero-settings Phase 1 + 4.2, file the consent blocker ([99e6df2](https://github.com/event4u-app/agent-config/commit/99e6df2aebfae9433eff3ba7ce24c46090706196))
* **settings:** classify all 140 leaves and ratchet the derivable surface ([4a40578](https://github.com/event4u-app/agent-config/commit/4a405780354a7432d615373577f2e2f0bba4efa6))
* **review:** ship the reviewer prompt and scope beside the verdict ([0e57c8e](https://github.com/event4u-app/agent-config/commit/0e57c8e27621350fe086304b6f8f4f9143ffb8f4))
* **review:** re-bind the R2 artefact to the fixed scope, dispositions terminal ([8492864](https://github.com/event4u-app/agent-config/commit/8492864e2a6540fad5d1970cf76ae6a0dea2259c))
* **evidence:** pre-register the bar for detector D, contamination disclosed ([ee3f43f](https://github.com/event4u-app/agent-config/commit/ee3f43faca834a44eaaf3dab1770e9f422aeae9c))
* **review:** record the R2 findings before fixing any of them ([a151f36](https://github.com/event4u-app/agent-config/commit/a151f368422afbd18cf1f81175e69129acfa0e05))
* **roadmap:** close the rootless-write roadmap and record the sibling inventory ([4f5447a](https://github.com/event4u-app/agent-config/commit/4f5447a5ce022adf8e356ebc93419cababa1af0a))

### Refactoring

* **settings:** delete the five keys nothing ever read ([94b9134](https://github.com/event4u-app/agent-config/commit/94b913481610deb1e981760280019c7ef0ae4aa1))

### Tests

* **settings:** pin what a deleted unread key can and cannot do ([db0c6bd](https://github.com/event4u-app/agent-config/commit/db0c6bdba4eef271ae6803e4adb12c202d14ee2b))
* **settings:** pin the inverted invariant per deleted key ([e87af34](https://github.com/event4u-app/agent-config/commit/e87af347d9f0eacfd5f753737fadc85813b181fb))

### Build

* take the trunk install bundle instead of a worktree rebuild ([f3ef74c](https://github.com/event4u-app/agent-config/commit/f3ef74c800b492cab4327953de7bb8af706e83bc))
* regenerate the derived outputs after the reconciliation merge ([50b4ce6](https://github.com/event4u-app/agent-config/commit/50b4ce6df13dff915ec0adbbe4f03f0f08475d02))
* rebuild the tracked install bundle after the schema deletion ([7b143ae](https://github.com/event4u-app/agent-config/commit/7b143ae4e0611f478e0ddd86c8e837d01a738940))

### Chores

* **index:** regenerate the artifact index and catalog for the new guideline ([5d2d563](https://github.com/event4u-app/agent-config/commit/5d2d56351048163930fba8c8871d4eaddb5d203b))
* **security:** backstop the anonymization obligation for one more harvest source ([0309b8e](https://github.com/event4u-app/agent-config/commit/0309b8efc7f304bdbbc1886701dad1706c22f543))
* **tests:** drop the template handle the trimmed assertion orphaned ([ed764a9](https://github.com/event4u-app/agent-config/commit/ed764a9e600d330e5a33d3c49981f2e7e84b840e))
* **tests:** finish the orphan chain the previous deletion opened ([9bc6020](https://github.com/event4u-app/agent-config/commit/9bc6020a9ddf9578b98898024a2191ffc480a906))
* **tests:** drop two dead declarations the changed-files linter surfaced ([2d7ff19](https://github.com/event4u-app/agent-config/commit/2d7ff19b3dba4584b83e393a5e6f6c2fdafdd816))
* **roadmap:** archive road-to-feedback-9-35, which merged complete but unarchived ([2e26094](https://github.com/event4u-app/agent-config/commit/2e26094de27c845466229c6e7842a8217ac3b21f))
* **roadmaps:** archive road-to-completion-loop, closed as a published null ([92f9b9a](https://github.com/event4u-app/agent-config/commit/92f9b9aa675cbc42cc81e7eb829e68d6ddd3c4b7))

Tests: 13506 (+95 since 10.1.0)

## [10.1.0](https://github.com/event4u-app/agent-config/compare/10.0.0...10.1.0) (2026-08-12)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 0992c92, 20a8606, 63aeba1.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in 0f3ce9b.
- **Known limitations:** _none_

### Features

* **untrusted-content:** tag external content where it enters, with an unforgeable boundary ([7a313ec](https://github.com/event4u-app/agent-config/commit/7a313ecfae4eadd06ff547a4a67d363a6758707b))
* **skill-schema:** structured runtime requirements, and the rule that gives them teeth ([63aeba1](https://github.com/event4u-app/agent-config/commit/63aeba1070af3d72bcaac0c7f999788d3b833354))

### Bug Fixes

* **roadmap,context:** satisfy the two gates this branch newly tripped ([e61d461](https://github.com/event4u-app/agent-config/commit/e61d46142a9dc41841c98360377cc89176ce1057))
* **roadmap-archival:** an open blocker outlives its steps, and the sweep did not look ([710dc26](https://github.com/event4u-app/agent-config/commit/710dc266a27a82aad9a527c525650e8d43accfdc))
* **review:** close all eight R2 findings, one of them by admitting a gap instead of papering it ([0992c92](https://github.com/event4u-app/agent-config/commit/0992c92219364bc646e78c29fa3072b5e46361ef))
* **diff:** drop a regenerated report my git add -A swept in ([3aec031](https://github.com/event4u-app/agent-config/commit/3aec031b160a8bc676053be370b2fddfbeab250c))
* **skill-schema:** rename requires to runtime_requires — the key was already taken ([20a8606](https://github.com/event4u-app/agent-config/commit/20a86065cc5d9c86e9fdf0710c51ddf850ca7ae4))
* **roadmap:** anonymize the harvest source per source-confidentiality ([195e444](https://github.com/event4u-app/agent-config/commit/195e444a7b1f9d7d05ac5cb768b0be17a1ac58ea))

### Documentation

* **changelog:** curate the 10.0.0 head, which shipped the same placeholder hours later ([0f3ce9b](https://github.com/event4u-app/agent-config/commit/0f3ce9b22c1858e12556a4b0fe95bec1931dde91))
* **roadmap:** the verified residue of five external release reviews ([a25579f](https://github.com/event4u-app/agent-config/commit/a25579fdf4d13cf6057ccdfeba5dc87990dd11e0))
* **analysis:** threat-model the confirmation store, and enumerate the buried decisions ([8b18f1c](https://github.com/event4u-app/agent-config/commit/8b18f1c4a850a9b08906aceccbe3562f381de7c3))
* **records:** three figures five reviews keep re-deriving, corrected at the source ([1612a70](https://github.com/event4u-app/agent-config/commit/1612a70e3e13daa0572fefb4803533708c1273f0))
* **changelog:** curate the 9.36.0 head that shipped its own placeholder ([83a3922](https://github.com/event4u-app/agent-config/commit/83a3922f63efbe5aca280e775acc85b36573c3f4))
* **review:** re-bind after the count correction ([9dd75ec](https://github.com/event4u-app/agent-config/commit/9dd75ecf178152641f8744a8f1b81f045befde7b))
* **roadmap:** correct the test count the review fixes moved ([ec52c42](https://github.com/event4u-app/agent-config/commit/ec52c421ba69dc85ee78095323f8495b93f3dd26))
* **review:** re-bind the R2 artefact to the fixed scope, dispositions terminal ([e601648](https://github.com/event4u-app/agent-config/commit/e6016487e883f611b2b7b989f23ed682796a6a73))
* **review:** record the R2 findings before fixing any of them ([1cf8d78](https://github.com/event4u-app/agent-config/commit/1cf8d787c015f51261bdd22b7388e47d127003f6))
* **roadmap:** add the Acceptance Criteria the completion review needs to bind to ([f35becd](https://github.com/event4u-app/agent-config/commit/f35becd885c09a5ac7f5a678adf29a360e776efa))
* **roadmap:** follow the schema key rename, and record why the obvious name was unavailable ([5720847](https://github.com/event4u-app/agent-config/commit/572084763fef97eb66fa91fd722d75a9c527440a))
* **roadmap:** the executable-payload harvest, with four source claims corrected ([2f4d8a8](https://github.com/event4u-app/agent-config/commit/2f4d8a8be5891d6045d4605a4a6d8fe3dc28a65e))

### Tests

* **council-cli:** the quota case asserted a property of the developer machine ([35037f9](https://github.com/event4u-app/agent-config/commit/35037f96d3e631d6ee1a235415e716e2a29f8f8c))

Tests: 13411 (+27 since 10.0.0)

## [10.0.0](https://github.com/event4u-app/agent-config/compare/9.36.0...10.0.0) (2026-08-12)

### Release highlights

- **Behaviour changes:** council transport is **resolved per machine rather than
  configured** — the breaking change this major carries (4eda4ff); every member
  now resolves as `auto`, so a configured CLI call budget applies wherever a
  council config exists. The turn-end gate is armed unconditionally and loses its
  settings surface (42cd613). Conformance round 7 records its downgrades rather
  than restating them (030ca0d, c1bc2aa).
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** a blocker whose resolution condition no passage of time could
  satisfy — a default-OFF gate cannot soak, so the switch removal discharges it
  and the original wording stays verbatim beside the resolution, because the
  unsatisfiable condition is itself the finding (7c6b404).
- **Known limitations:** _none_

### BREAKING CHANGES

* **council:** transport is resolved per machine, not configured ([4eda4ff](https://github.com/event4u-app/agent-config/commit/4eda4ff0f518cb30778dc139852576efd35bd57a))

### Features

* **ci:** the parity gate learns about preflight, which it never inspected ([44151b0](https://github.com/event4u-app/agent-config/commit/44151b02cd765aff16d7e95459752ec553c1d57b))
* **conformance:** a fifth check, an era guard, and the denominator the rate was missing ([f7edbdc](https://github.com/event4u-app/agent-config/commit/f7edbdc99533d433ff2b1857bac5bc7fb2929fe8))
* **hooks:** refuse a completion claim while the last CI read is unsettled ([1ea7536](https://github.com/event4u-app/agent-config/commit/1ea753629ce6a468e061af1ee2f7ac3f38f6bebd))
* **turn-end-gate:** arm it unconditionally, with no settings surface ([42cd613](https://github.com/event4u-app/agent-config/commit/42cd6131761a5b6681583abd8b7100f4415d84bf))

### Bug Fixes

* **round7:** close the R2 findings — the two high ones are in my own Phase 1 ([030ca0d](https://github.com/event4u-app/agent-config/commit/030ca0d6e1a6b27ebbebf74a34caa1403cc98dfa))
* **council:** validate the output path before spending, and count attendance from answers ([a23d6c8](https://github.com/event4u-app/agent-config/commit/a23d6c84d4963f17ca94838bdbc9f7067b72e77a))
* **hooks:** block-no-verify stops failing closed on heredoc prose ([7ac5cd2](https://github.com/event4u-app/agent-config/commit/7ac5cd227d34dbc92f9f0438746ff5cd1317e5d2))
* **taskfile:** block-scalar the bridge-derivation desc so the taskfile parses ([9b0f7b9](https://github.com/event4u-app/agent-config/commit/9b0f7b90ba9bac04c7b0e80dbeaeb99a3aab4cc3))
* **council:** use a Json-typed sentinel for the ignored-key presence check ([29b9f42](https://github.com/event4u-app/agent-config/commit/29b9f42e505c187f2b35abcb81cc6e7055d5507f))
* **detection:** find the Claude subscription in the macOS Keychain ([72de870](https://github.com/event4u-app/agent-config/commit/72de8706812ea2cf30940697887964ae1406a3e4))
* **gates:** scope bridge-derivation to the roots this checkout writes ([ea1b1d4](https://github.com/event4u-app/agent-config/commit/ea1b1d4e230375db0ae1c8e01226d8527a08a1e7))

### Documentation

* **review:** re-bind the R2 artefact to the fixed scope ([304b898](https://github.com/event4u-app/agent-config/commit/304b89866880c23f68106c096df20ce18ed207b7))
* **review:** record the R2 findings before fixing any of them ([bdf45c2](https://github.com/event4u-app/agent-config/commit/bdf45c2e86b2839f3c64d432d50285f043f08d3d))
* **roadmaps:** the fifth check makes two Context claims stale, in both directions ([6915456](https://github.com/event4u-app/agent-config/commit/6915456005fd164bc525103c6f0b59f05dbc8169))
* **analyze:** the conformance command documented four checks, there are five ([d05f97e](https://github.com/event4u-app/agent-config/commit/d05f97e13b03cc04036d83aba4df6635e0323932))
* **conformance:** round 7 — the honest downgrades and the archived roadmap ([c1bc2aa](https://github.com/event4u-app/agent-config/commit/c1bc2aaef41b04aa76024f9949c9e10eacd9886c))
* **council:** the template and contract stop documenting a setting that is gone ([49d58fa](https://github.com/event4u-app/agent-config/commit/49d58fa28778359416459465cf066b7d8fccb363))
* **roadmap:** close the stop-refusal blocker, open the two follow-up tracks ([7c6b404](https://github.com/event4u-app/agent-config/commit/7c6b4045c2cadf023d1f434ff851cec86372613a))

### Refactoring

* **condense:** expose the active-tool set root-parameterised ([d795d6a](https://github.com/event4u-app/agent-config/commit/d795d6a666f57be451d0dd5462b8725b56e44e75))
* **settings:** delete hooks.turn_end_gate.* and give REMOVED_KEYS per-key reasons ([f5b316b](https://github.com/event4u-app/agent-config/commit/f5b316b4bc531e2cf7ce0d65556c4a2737cbe0dc))

### Tests

* **hooks:** prove the completion detector is wired, not just correct ([4d284ef](https://github.com/event4u-app/agent-config/commit/4d284efa10ba939066edfc42c4a735d94e794def))

### Chores

* **condense:** re-project session-canary after the reproduction-command fix ([2d344c4](https://github.com/event4u-app/agent-config/commit/2d344c4d2183a608986f9dce485f1e5006e48863))

Tests: 13384 (+51 since 9.36.0)

## [9.36.0](https://github.com/event4u-app/agent-config/compare/9.35.0...9.36.0) (2026-08-12)

### Release highlights

- **Behaviour changes:** the demand gate reads `project.audience` and is inert at
  `self` — a market-demand ladder no longer fires on a project that intends no
  market (9f69017). The two UI rules stop claiming the `ui-route-nudge` concern
  reads their `keyword:` triggers; it does not, and six surfaces said it did
  (3c20d47). The design skills now reach the consumers they were written for
  (72bb1bc). The CI-side change in 924cad8 is internal to the pipeline and
  changes no consumer-visible behaviour.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **consultation-rate:** compute the half of the metric that is computable ([36064ef](https://github.com/event4u-app/agent-config/commit/36064efa1a85c9ea1c6c2beb427fe684177ca2a8))
* **analyze:** anchor-first direction, claim gate, interop probe and bounded --deep ([5bee62a](https://github.com/event4u-app/agent-config/commit/5bee62a5828ba6d3cf38a7d5d685004716d8addf))
* **lint-roadmap:** warn when a gate rests on a population the project cannot produce ([e5c0b56](https://github.com/event4u-app/agent-config/commit/e5c0b569417d80ee937fd7ec955680c724abe3e1))
* **demand-gate:** the L0-L4 ladder measures market demand, and now says so ([9f69017](https://github.com/event4u-app/agent-config/commit/9f69017632aead1f2a0e20eb8518ae4d8508ea1a))
* **fe-design:** outside the ticket engine, this skill is the executor ([2946655](https://github.com/event4u-app/agent-config/commit/294665543cfb1a3c896e25024fd08551af629bb2))
* **ui-route-nudge:** the first runtime consumer the UI rule triggers ever had ([6bf216e](https://github.com/event4u-app/agent-config/commit/6bf216e649febf3d95162e7f9b222f43ae2bd407))
* **pack-reach:** report where a rule and the skills it routes to cannot meet ([4bc28e6](https://github.com/event4u-app/agent-config/commit/4bc28e660f9eaef87b1e8f5ed4bbbd1914a7d3e4))
* **catalogue:** measure the skill-catalogue delivery defect, and publish the null ([b2adebe](https://github.com/event4u-app/agent-config/commit/b2adebe17320109a98a41eb4b0fc69233b567e47))
* **ui-surface:** one definition of a UI surface, and it covers Blade ([e9ba053](https://github.com/event4u-app/agent-config/commit/e9ba0533110da9aa9bbd276ab3ced2004c2d5d50))

### Bug Fixes

* **proof:** regenerate docs/proof.md after the new pre-registered claim ([6a8bc44](https://github.com/event4u-app/agent-config/commit/6a8bc446abcc06cee3cc55ffd75f7668037542ea))
* **baseline:** repair the measurement table split by the unit note ([afa1ea0](https://github.com/event4u-app/agent-config/commit/afa1ea0f1369293a8e392e132343dc05c126ccda))
* **consultation-rate:** close the R2 findings, unit first ([c53b3da](https://github.com/event4u-app/agent-config/commit/c53b3da53111a089d07c59186d1aa1124adc2d31))
* **agents-md:** keep the corrected pointer inside the Thin-Root char cap ([858963f](https://github.com/event4u-app/agent-config/commit/858963f956d516d5200d9e27c9014aee41938973))
* **agents-md:** the consumer template contradicted itself on always-active rules ([639ce5e](https://github.com/event4u-app/agent-config/commit/639ce5e26d8e4d3ca70d8e4f1f6953548f72322f))
* **dist:** rebuild the install bundle without build-machine paths ([55f4e64](https://github.com/event4u-app/agent-config/commit/55f4e6449ad0eb9d8c79bdeffea6c174ddda66f2))
* **cli-delegate:** close the six R2 findings, two of them on this fix ([6c26dd4](https://github.com/event4u-app/agent-config/commit/6c26dd45187b374a473df5bba241b0bd502accd2))
* **cli-delegate:** four shipped commands were silent no-ops in their own bundle ([1ea3f67](https://github.com/event4u-app/agent-config/commit/1ea3f67012929f7c00604bc9cda6a85b1d783e32))
* **ci:** three downstream surfaces the new triggers, key and gate opened ([924cad8](https://github.com/event4u-app/agent-config/commit/924cad87f91eb57acf4e8619015f3089e07a956c))
* **capture,lint,docs:** close the remaining R2 findings ([396d58f](https://github.com/event4u-app/agent-config/commit/396d58fbff2704cddce10577e2cbd82db9c5003c))
* **ui-surface,nudge,settings:** three predicates that were wider than their claims ([36e1632](https://github.com/event4u-app/agent-config/commit/36e1632287a85c0934bec8a43752b8761dfa19d6))
* **ui-rules:** the nudge does not read the rules, and six surfaces said it did ([3c20d47](https://github.com/event4u-app/agent-config/commit/3c20d47dee794e1c9ddbf6a895527953788c31ff))
* **ui-rules:** reach the consumers the design skills were written for ([72bb1bc](https://github.com/event4u-app/agent-config/commit/72bb1bc3943c8fb721db9d44b5daa5334bcb956f))

### Documentation

* **review:** re-bind the R2 artefact to the fixed scope ([0cc9057](https://github.com/event4u-app/agent-config/commit/0cc9057d97b78cf82fd957afd96ec9205bfc7fc0))
* **review:** record the R2 findings before fixing any of them ([b42227a](https://github.com/event4u-app/agent-config/commit/b42227a6e32b041c6b9b82f373bb23c2d15cc03a))
* **baseline,roadmap:** the first measurement, and what its denominator says ([347cb47](https://github.com/event4u-app/agent-config/commit/347cb4702b55f22723ecf4d7fb00fe202fb4d72c))
* **roadmaps:** archive the completed cross-repo differential loop roadmap ([f90b42b](https://github.com/event4u-app/agent-config/commit/f90b42b918813c0f354037abd5965bd45afb7a5d))
* **claims:** pre-register the reference-loop upgrade value claim ([67c1ba4](https://github.com/event4u-app/agent-config/commit/67c1ba400531ca0eead1c282a6dd802c55080eb5))
* **roadmap:** archive the cross-corpus verification roadmap, complete ([483acc6](https://github.com/event4u-app/agent-config/commit/483acc654e8d8a2a3b9cecbc96be6e79e8da12a0))
* **adr:** record what the cross-corpus proposal measurements survived ([87e81d8](https://github.com/event4u-app/agent-config/commit/87e81d8faadc35f070163d3ec3288b78cad19d1d))
* **roadmap:** the demand-gate audience roadmap and its follow-up ([079f22c](https://github.com/event4u-app/agent-config/commit/079f22cbd16df95ceebcccdb9a4ae3bcc73390ef))
* **review:** re-bind after the CI fixes, and name what is unreviewed ([f9e66de](https://github.com/event4u-app/agent-config/commit/f9e66de977d9a33766edcfd84936ef12ba09358d))
* **review:** state precisely what moved between the two re-binds ([8b2bdd4](https://github.com/event4u-app/agent-config/commit/8b2bdd4267307cbbaec410d6305b9d91f98cc7c1))
* **review:** re-bind the R2 artefact after the generated-file regen ([03e1029](https://github.com/event4u-app/agent-config/commit/03e102989d92f2cc913dc839b05986cf7d4db1f3))
* **roadmap:** the frontend-skill-application plan and its first run ([c1bd64f](https://github.com/event4u-app/agent-config/commit/c1bd64fe559a60a6b6f6248ffc3ff0127df5fe46))
* **dispatch:** a UI-shaped slice carries its design context across the boundary ([aae1e52](https://github.com/event4u-app/agent-config/commit/aae1e5242d3f5ed4a99c9a33d4551ca9183b8f77))

### Refactoring

* **skills:** one spelling for the disclosure directory, and an authoring section that names it ([3cd3103](https://github.com/event4u-app/agent-config/commit/3cd3103962d8d632c9fe18691016b6044ffc084b))

### Tests

* **demand-gate:** pin both halves, and name what these tests are not ([0a1da08](https://github.com/event4u-app/agent-config/commit/0a1da086689b0c3b5d4df3097df4e731b6506481))
* **cli-delegate:** execute every delegate bundle, because reading cannot see this ([5d8a741](https://github.com/event4u-app/agent-config/commit/5d8a7410da9caba0e77714dc9e5e92c370a1614e))

### Chores

* **roadmap:** archive the completed roadmap in the PR that completes it ([1d05116](https://github.com/event4u-app/agent-config/commit/1d05116c62f316b64fb1d6a8e86381d03f3f22fe))
* **review:** re-bind the artefact after the bundle rebuild ([b0bf837](https://github.com/event4u-app/agent-config/commit/b0bf837046718823c52f4db9216d27192f8a131b))
* **dist:** rebuild the committed install bundle after the guard change ([0d7b0ae](https://github.com/event4u-app/agent-config/commit/0d7b0ae2709d7a6fcf0eb5ecd9e1e0241a28c06d))
* **review:** re-bind the artefact after merging main ([ab4272b](https://github.com/event4u-app/agent-config/commit/ab4272b98a53628fa00544b134a49b7e97545ad4))
* **review:** re-bind the artefact and mark all six findings fixed ([c1eb64a](https://github.com/event4u-app/agent-config/commit/c1eb64ab051a663a45a1a76696a282a7e7dfb6c0))
* **review:** record six R2 findings before fixing them ([872fc7b](https://github.com/event4u-app/agent-config/commit/872fc7b0a7e735e7ebd13d357b7270b8a1140046))
* **index:** regenerate the artefact index and public catalog ([cfc75b6](https://github.com/event4u-app/agent-config/commit/cfc75b6b26bbf6bd09c0536ca0f553a52fbd09a9))
* **dist:** regenerate the router after merging main ([4bab07c](https://github.com/event4u-app/agent-config/commit/4bab07c67ec7d5778f957789bc6d427ec6274641))

Tests: 13333 (+120 since 9.35.0)
