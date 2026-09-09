# Changelog Archive — pre-14.23.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `14.23.0`, split out of the main
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

## [14.22.0](https://github.com/event4u-app/agent-config/compare/14.21.0...14.22.0) (2026-09-08)

### Release highlights

- **Behaviour changes:** clear the last two ratchets, one of them by correcting a false line (9929006); pay the standing-payload charge at the source, not at the ceiling (640d126); collapse the blank-line run the migration left (aad5201); move the detail to the on-demand mechanics file (d6c3a8d); state the substitution without naming a build tool (2beb484); one command per Bash call, and drop the line that said otherwise (8d106b0); +3 more.
- **Default changes + migration:** no host reads a skill's triggers: frontmatter, and by default nothing in-tree does (6bb8690); migrate the three carriers to ready, and give them a plan back (b880cf8); collapse the blank-line run the migration left (aad5201).
- **Security and correctness:** discharge the variant pin, and rename fixtures off the cache linter (483bb66); drop a box-rule comment and re-measure the coverage corpus (7442c39); clear two gates this branch reddened, neither by weakening one (f090905); export the Run type so the delta test typechecks (d1188cf); a counter must be wider than the gate it reports on (cc7819b); reopen the binary class under a mechanically verified predicate (5b4ce1f); +15 more.
- **Honest nulls:** replace the nudge with a context line that carries staleness (706e20c).
- **Known limitations:** _none_

> **Governance mix:** governance-only 77 vs consumer-only 18 (taxonomy 1.1.0).

### Features

* **council:** build Phase C1 — dissent retention, stage attribution, ZMV rate ([91d83ac](https://github.com/event4u-app/agent-config/commit/91d83ac0b9b93ae2bee631de759cf9a94578a556))
* **continuity:** add the `continuity_record` variant and make readers tolerant first ([76290ae](https://github.com/event4u-app/agent-config/commit/76290aea5ff7cc86f592854625122a381bc21387))
* **gates:** derive the five continuity end-state numbers instead of asserting them ([69ffe9f](https://github.com/event4u-app/agent-config/commit/69ffe9f6261cf2b2fd7253ef189e72abe4539f4f))
* **rdp-eval:** the paid candidate-forms measurement, steps 3.1 and 3.2 ([00273f6](https://github.com/event4u-app/agent-config/commit/00273f66a892f74f2fdb0b9f10cc3d2d322ce307))
* **rdp-eval:** instruct the candidates line in the treatment arm, and compute the delta ([4da86f3](https://github.com/event4u-app/agent-config/commit/4da86f395ddb812cc7a7eb862ce982846334a45c))
* **candidate-lines:** the shape checker, and the blockers on its shipping half ([393df5e](https://github.com/event4u-app/agent-config/commit/393df5e57b5feb57d845469d93f6c33c71de5e4d))
* **mandated-lines:** build the counter the lock asks for, and read a null ([0cce3e7](https://github.com/event4u-app/agent-config/commit/0cce3e784a196a95f061a9ff8d36c4a7eaffe3c1))
* **hooks:** chain-nudge carries the one-command-per-call rule to tool-call time ([0a201d6](https://github.com/event4u-app/agent-config/commit/0a201d67967638ba1425cc584ff5ad46c50cec9e))
* **hook-hosts:** separate "slot bound" from "body arrived", and give the native forms their triggers ([ab57f10](https://github.com/event4u-app/agent-config/commit/ab57f10840a0802c339e9ee323d6cc2e9175f413))
* **code-graph:** resolve tsconfig aliases and PSR-4 namespaces before guessing ([aa58ed5](https://github.com/event4u-app/agent-config/commit/aa58ed5ac9835414e5813d61673b2f17ab621d64))
* **code-graph:** every edge records how it resolved and which engine made it ([1c8765b](https://github.com/event4u-app/agent-config/commit/1c8765b35a38a7dc228f1eecc6e848f363803965))
* **code-graph:** make the SQLite twin an index instead of a blob transport ([8a49bc9](https://github.com/event4u-app/agent-config/commit/8a49bc96a50453dddd8c37255b652e3fce1cc5d4))
* **code-graph:** refresh the index from git hooks, single-flight, no daemon ([b908dcb](https://github.com/event4u-app/agent-config/commit/b908dcb5b250020961c131afd5a081b103e80c62))
* **code-graph:** replace the nudge with a context line that carries staleness ([706e20c](https://github.com/event4u-app/agent-config/commit/706e20c6f6aa78f0dd6fa978d37d4816048745d3))
* **rdp-eval:** score stored transcripts, and publish the dim-5 baseline ([6f833d7](https://github.com/event4u-app/agent-config/commit/6f833d7257e6c2fa432ca9ac00cea4a4fb669ba0))
* **code-graph:** the parsers ship to consumers, as the three the engine can load ([d52a960](https://github.com/event4u-app/agent-config/commit/d52a9602330f6e89efd13360e1517bc4bfd67a07))
* **rdp-eval:** a fifth rubric dimension for form-alternative surfacing ([631ebce](https://github.com/event4u-app/agent-config/commit/631ebce9fff151f2329a27b27885b47a9a2703e5))
* **skill-menu:** census every skill by what can actually reach it ([67d08d3](https://github.com/event4u-app/agent-config/commit/67d08d3661be76d8fecc605d9c152c0814660868))
* **roadmaps:** candidate-moves floor and limited-commitment horizon ([2be364d](https://github.com/event4u-app/agent-config/commit/2be364d9c9bef8463d8c898afca3ecc66737663e))
* **inbox:** read the source set three times, and prove the artefacts carry it ([5ff3d44](https://github.com/event4u-app/agent-config/commit/5ff3d44a896a4c42f69fe132a7401c9164d36f39))
* **inbox:** add the source census that gives a run a denominator ([74ff9d5](https://github.com/event4u-app/agent-config/commit/74ff9d53802dcd4935dc283dffa1c8b67918cef0))
* **skills:** rank the UNION of every readable catalogue root ([d834520](https://github.com/event4u-app/agent-config/commit/d834520f6d67ca3fccc555c3a3b0a18cd856315f))

### Bug Fixes

* **metrics:** label the skill-usage report non-evidentiary ([b981dad](https://github.com/event4u-app/agent-config/commit/b981dadd5610297fe1d1f65f705f69b2eda78ce4))
* **roadmap:** correct two file:line citations to the merged tree ([2411b46](https://github.com/event4u-app/agent-config/commit/2411b463e0463b915298b77d19a63ed029b57315))
* **tests:** discharge the variant pin, and rename fixtures off the cache linter ([483bb66](https://github.com/event4u-app/agent-config/commit/483bb660024c584bd644b9177b541fa7fc363e20))
* drop a box-rule comment and re-measure the coverage corpus ([7442c39](https://github.com/event4u-app/agent-config/commit/7442c3914522666fd38e451ca02b48acc18a8cfa))
* **gates:** dispose of the state leaves origin/main added, and drop the one it retired ([2f711c5](https://github.com/event4u-app/agent-config/commit/2f711c5f7aacec67576e6a8953f7ac71d989b6bf))
* **roadmaps:** state the estate cost as deltas, not as one base ref's reading ([51283b8](https://github.com/event4u-app/agent-config/commit/51283b830e26c53c4f66876a8e92a5275111a949))
* **roadmaps:** correct the estate claim to what the gate actually measured ([f682101](https://github.com/event4u-app/agent-config/commit/f6821010749dab91f5d9d23bede114dd04eadf2c))
* **settings:** reconcile the four surfaces that disagreed about one flag ([6093fec](https://github.com/event4u-app/agent-config/commit/6093fec7d506c84a82fc53c595233e259233df49))
* **ci:** clear the last two ratchets, one of them by correcting a false line ([9929006](https://github.com/event4u-app/agent-config/commit/9929006568e31f20d7f555f1d836eec46b3a7e8c))
* **ci:** record two consequences of a decision that is already on the trunk ([7ea18fe](https://github.com/event4u-app/agent-config/commit/7ea18fe892f51057951569840e598fc12394483e))
* **ci:** clear two gates this branch reddened, neither by weakening one ([f090905](https://github.com/event4u-app/agent-config/commit/f09090554c35011f7ee43cadc965ddb20479baaa))
* **secret-allow:** re-pin the gate-coverage canary, 630 to 634 ([c9106cc](https://github.com/event4u-app/agent-config/commit/c9106cc45d28198829c634b14681708182577e70))
* **rdp-eval:** export the Run type so the delta test typechecks ([d1188cf](https://github.com/event4u-app/agent-config/commit/d1188cf6a1959551c1f1113d5734c9782adaf18a))
* **roadmap:** date the PR-1923 mergeability claim instead of asserting it ([b8180e9](https://github.com/event4u-app/agent-config/commit/b8180e9fccdb85040f62226c1c2236e6680c7820))
* **gate-coverage:** re-measure the honest denominator, 306 to 322 ([1d653ac](https://github.com/event4u-app/agent-config/commit/1d653ac150bb74f0f29b0cc3f570c4672ab227ba))
* **mandated-lines:** a counter must be wider than the gate it reports on ([cc7819b](https://github.com/event4u-app/agent-config/commit/cc7819b9bb02587ef85be0def8b9443be195e638))
* **roadmap:** mark the ADR-262 path as a deliberate dangling reference ([dcc1e9a](https://github.com/event4u-app/agent-config/commit/dcc1e9a4763f678684d45099027ee591a895b93f))
* **observation:** the previous commit claimed purely additive and was wrong once ([063a24a](https://github.com/event4u-app/agent-config/commit/063a24a39f9fbee6f57d35657e078b188758e082))
* **observation:** the council answered the re-pin, and the fetch was never its to grant ([03d65c6](https://github.com/event4u-app/agent-config/commit/03d65c6b74f8467bacdcb532e3757372918c692e))
* **observation:** the pinned shadow is a post-upgrade text, so the run stops before it starts ([d5b61a3](https://github.com/event4u-app/agent-config/commit/d5b61a333317ba93edf4cbad658561326263d85e))
* **token-efficiency:** state the substitution without naming a build tool ([2beb484](https://github.com/event4u-app/agent-config/commit/2beb484c668c25aa768f7e18c22e79e6d611ae9b))
* **token-efficiency:** one command per Bash call, and drop the line that said otherwise ([8d106b0](https://github.com/event4u-app/agent-config/commit/8d106b00b607588ac643d566912a7f4690d45d97))
* **pack-size:** reopen the binary class under a mechanically verified predicate ([5b4ce1f](https://github.com/event4u-app/agent-config/commit/5b4ce1f46920e62db482737e8236bc9c9cf6b754))
* **tests:** the exact-pin exception list is one entry now, not zero ([a36a346](https://github.com/event4u-app/agent-config/commit/a36a346aecfc34e44f10c889b40e1c360dc40dec))
* **tests:** type the dispatch-hook fixtures instead of casting them to any ([7659b95](https://github.com/event4u-app/agent-config/commit/7659b951df75431d94cb32d2896118c600dcc985))
* **cli:** the two per-invocation probes survive being bundled ([6d182bd](https://github.com/event4u-app/agent-config/commit/6d182bdb8a15d97e494db2d0781e703bbc60977c))
* **roadmap-scripts:** fire the entry guard inside the delegate bundle ([0be2043](https://github.com/event4u-app/agent-config/commit/0be2043cab9077fa42475339fe561d16579f3175))
* **cli:** bundle the roadmap command family, and make the bundle reachable at all ([7ff85c6](https://github.com/event4u-app/agent-config/commit/7ff85c6e4c227da05a187f358e41ed080c369c4b))
* **contracts:** the RDP beta extension was 8 days past the 90-day ceiling ([02a860f](https://github.com/event4u-app/agent-config/commit/02a860f38b32db154d5c4908cb9e6023b787390e))
* **pack-size:** binary and archive become closed classes, at an observed zero ([f573d62](https://github.com/event4u-app/agent-config/commit/f573d628c4bed6d401595a173aff2819d8b8a5e8))
* **analyze-repo:** the bound-claim gate pointed at a ledger field that does not exist ([f1d5f3f](https://github.com/event4u-app/agent-config/commit/f1d5f3f3adebc67844d5aee845f9cfb657e6c17b))
* **release:** disposition the five 14.21.0 findings that are provable from the tree ([6ef7c0a](https://github.com/event4u-app/agent-config/commit/6ef7c0a7f88f6265cf67ceea72c7e31ccf75efb5))
* **release-findings:** disposition the 14.21.0 blocking findings, and name why the ledger recurs ([0fbb6c2](https://github.com/event4u-app/agent-config/commit/0fbb6c27e4615490e2ff41593986120ac4941216))
* **release-findings:** the two 14.21.0 findings that were fixable in place ([848c628](https://github.com/event4u-app/agent-config/commit/848c6284d10f34cd875cf9e53c30c853a6dd45cc))
* **release:** ingest the 14.21.0 self-review findings ([969250d](https://github.com/event4u-app/agent-config/commit/969250dfe9899410f9054e856572c4b5b9ce2e0d))
* **build:** rebuild dist/install after the comment pass, refresh the ADR census ([9a81414](https://github.com/event4u-app/agent-config/commit/9a814140319d0fafbf01851cce7175dbae680b51))
* **delivery:** act on the second review — two of my own fixes were defects ([701ddfa](https://github.com/event4u-app/agent-config/commit/701ddfad2cf8ea8205305ab9e77d13ca35214411))
* **inbox:** clear the two ratchets the new prose tripped ([9835782](https://github.com/event4u-app/agent-config/commit/983578206ce07b9d305b5d1e628cea52b9d5a3da))
* **delivery:** act on the neutral review — six real defects, two of them mine to own ([110af8f](https://github.com/event4u-app/agent-config/commit/110af8fe356eaa248554b403deacfe259617e050))
* **inbox:** narrow the --root argument before resolving it ([9edf09a](https://github.com/event4u-app/agent-config/commit/9edf09a9faea8a81c561e5df6f0bedbc0ed780ca))
* **build:** rebuild the install bundle without a symlinked node_modules ([424e438](https://github.com/event4u-app/agent-config/commit/424e438c2e46bd9f218bf114fec832594755e182))
* **skills:** resolve the skill catalogue from the authored tree first ([35eed59](https://github.com/event4u-app/agent-config/commit/35eed590333f93837cc11c14458a1e3a40586846))
* **gates:** key the commands row on the cluster subpath, not the cluster dir ([d72da97](https://github.com/event4u-app/agent-config/commit/d72da97a23e4722b803dfce7794ab31d78879e5b))
* **delivery:** withhold per artefact name, never on installed.lock ([0e80440](https://github.com/event4u-app/agent-config/commit/0e80440e5225da26df32aef150a931bc6a79eec1))

### Performance

* **rule:** pay the standing-payload charge at the source, not at the ceiling ([640d126](https://github.com/event4u-app/agent-config/commit/640d126ebc57920f242ade3773648b4a27d84054))
* **chain-nudge:** read no file until the call is known to be chained ([819aae0](https://github.com/event4u-app/agent-config/commit/819aae0d4f880d70282c6400ed4bdd165ea3c502))

### Documentation

* **evidence:** transcribe the 2026-09-08 continuity-writer disposition council ([ef855e2](https://github.com/event4u-app/agent-config/commit/ef855e2a4011d024a8da61c358297a49c5a76c2d))
* **evidence:** transcribe the 2026-09-08 council run and the C1 verification ([759813e](https://github.com/event4u-app/agent-config/commit/759813ef2b48e946edd946401eb5f8c34b909b53))
* **roadmap:** claim the one-in-one-out exemption the new roadmap needs ([0773039](https://github.com/event4u-app/agent-config/commit/0773039b42d2f1083e7155d72ba564e8adcc0853))
* **roadmap:** correct the blocker count in the archived outcome ([5fd63d2](https://github.com/event4u-app/agent-config/commit/5fd63d2148ded3ec4ec1b57f4f273b4b4e81848f))
* **evidence:** name the new guideline without a path it cannot resolve ([c2132cf](https://github.com/event4u-app/agent-config/commit/c2132cfad5725b2562345977c10af230e5624a9a))
* **evidence:** record the 2026-09-08 PR-drain run ([a5bb0bf](https://github.com/event4u-app/agent-config/commit/a5bb0bfe9572c365f97a3b14578f1b3f8604f395))
* **roadmap:** close five of nine items, carry four with measured reasons ([31fb561](https://github.com/event4u-app/agent-config/commit/31fb561e43be8c067225c06312322c7bc48601ee))
* **roadmaps:** correct the peer-review attribution in the disposition record ([d6c4fad](https://github.com/event4u-app/agent-config/commit/d6c4fad98321fd5ed25fe6e35c7f197e13adefa5))
* **evidence:** transcribe the 2026-09-08 continuity-scope council ([cec0ff3](https://github.com/event4u-app/agent-config/commit/cec0ff316aa32c169b95b52cdbbe10377b314eb5))
* **roadmaps:** repoint the two inbound pointers at the parked receiver ([01bb6ad](https://github.com/event4u-app/agent-config/commit/01bb6ad79c527be51074065b84d230dfa306cacd))
* **concerns:** record the admission the concern rename left missing ([183cbc0](https://github.com/event4u-app/agent-config/commit/183cbc0d03fda8082e8942784909ae2f8cfa8f87))
* **evidence:** prepend run 21 to the drain-run ledger ([33871a0](https://github.com/event4u-app/agent-config/commit/33871a08d625d29245ccf663be4b8c62d25d0c37))
* **roadmap:** give AC-4 the blocked-by marker its sibling steps carry ([2059eab](https://github.com/event4u-app/agent-config/commit/2059eab994536eebbc596e1d4a93af7152439067))
* **roadmap:** make risk-row 6 test count precise instead of aggregated ([b926379](https://github.com/event4u-app/agent-config/commit/b9263792a569ae42704e3d9af6b1d779d1b6568e))
* **roadmap:** re-review the risk register — four of six rows have outcomes now ([f1cb3b5](https://github.com/event4u-app/agent-config/commit/f1cb3b53d06886cde538b2abd456e4f357fc2b2e))
* **roadmap:** align the shipping blocker with the corrected finding and the verdict ([14514e6](https://github.com/event4u-app/agent-config/commit/14514e6ac480bcac7835ef7c702ef369bce320dc))
* **roadmap:** the verdict is a fourth outcome, and the arithmetic settles why ([a173c81](https://github.com/event4u-app/agent-config/commit/a173c81425dab95eddd87e87d480c80ca7faa1cf))
* **review:** declare the completion-review skip for a zero-code-path branch ([b6364bd](https://github.com/event4u-app/agent-config/commit/b6364bdc5f9bb432ea01708a5304dc9eb472fcab))
* **stub:** tell the named producer about the bad pin before they run ([ca509de](https://github.com/event4u-app/agent-config/commit/ca509dea6afba4ab2ba5d48ae2139c27230b563f))
* **evidence:** the menu-exclusion lever step 1.2 names does not exist ([4cd105a](https://github.com/event4u-app/agent-config/commit/4cd105a7d6de122c444a40ed6e5cf6f4cbaa14d1))
* **adr:** ADR-262 discloses what it rests on ([d043ed7](https://github.com/event4u-app/agent-config/commit/d043ed7945ee38759b718153c9fc5e349561c1b5))
* **roadmap:** migrate the three carriers to ready, and give them a plan back ([b880cf8](https://github.com/event4u-app/agent-config/commit/b880cf806e430325243c111e86673f9c42bda2b9))
* **adr:** ADR-262 — delete `status: carrier`; the repo does not gate the maintainer ([565c58f](https://github.com/event4u-app/agent-config/commit/565c58f6351a0a362edeeb09875ff603c21c4386))
* **roadmap:** re-review the register — Risk 4 fired and the mitigation caught it ([3e88f50](https://github.com/event4u-app/agent-config/commit/3e88f50917b340f9e5ce3181f0f5b2694f58b28e))
* **roadmap:** record why the two carriers were not executed, and by whose ruling ([a88a7ea](https://github.com/event4u-app/agent-config/commit/a88a7ea46471deac9d7fda90fc8443b4bbd585d3))
* **adr-204:** record what the decision missed and what it never reached ([2e47469](https://github.com/event4u-app/agent-config/commit/2e47469320a1c4005dd1dc8748d86f38c9c416e4))
* **roadmap:** record the acceptance criteria this run actually discharged ([7975528](https://github.com/event4u-app/agent-config/commit/7975528536e51b41f84fe9674952b65051c48fc3))
* **roadmap:** re-scope Phase 2 around a lock this roadmap walked into ([448eed6](https://github.com/event4u-app/agent-config/commit/448eed68d2ea84b724ef61c3c6eff7fb2c6962a2))
* **roadmap:** grant the run-specific fetch authorization the roadmap asks for ([ebcf8dd](https://github.com/event4u-app/agent-config/commit/ebcf8dd2c541aa55443138af3ca18f8de96df3c2))
* **roadmap:** correct the base-ref direction in the menu-economy probe note ([9691169](https://github.com/event4u-app/agent-config/commit/9691169177b3d13f776abcc2c5ce3ea034ba5940))
* **roadmap:** close AC-6 of road-to-scan-that-fails-closed at 26/26 ([4ce11ae](https://github.com/event4u-app/agent-config/commit/4ce11aef8c9e3110257e56bcd0ff6b08951a07a5))
* **claims:** record option C beside the census claim, and say what it does not close ([96f2362](https://github.com/event4u-app/agent-config/commit/96f2362acb0b1ce55bc19e76889e5269195d4a5c))
* **stubs:** the 14.21.0 findings ledger is ingestible, and its recorded cause is refuted ([32f7264](https://github.com/event4u-app/agent-config/commit/32f726439a1e3ea65a08b55413ea4ddd29fb4f65))
* **roadmaps:** stub the 14.21.0 findings ledger, and refute the carried prediction ([d7e7f8f](https://github.com/event4u-app/agent-config/commit/d7e7f8ffaf49e36b6d96a8af7d44639bb4316fa1))
* name the limits the review found, including the one not fixed ([c17b9eb](https://github.com/event4u-app/agent-config/commit/c17b9eb474fd86bef67e5cc0f5d40caeb1cc66b2))
* **rules:** re-derive the requirement, do not inherit the shape ([fdd3703](https://github.com/event4u-app/agent-config/commit/fdd3703c6f0c7a456c40451735ea0927bf6fd3eb))
* **stubs:** record the lineage gate that does not see the inbox folder ([ba558b6](https://github.com/event4u-app/agent-config/commit/ba558b61fa8b9d0edebea2fdca4397916051613d))
* **adr:** record the ADR-236 withhold amendment ([aa073f9](https://github.com/event4u-app/agent-config/commit/aa073f973afd5062d3996d944b6fb32f0a024636))

### Refactoring

* **gates:** delete `status: carrier`; rename the carry gate to lint_deferral_integrity ([1a7126d](https://github.com/event4u-app/agent-config/commit/1a7126d17792d06618d95d8fee270fbcb363f2e7))
* **token-efficiency:** move the detail to the on-demand mechanics file ([d6c3a8d](https://github.com/event4u-app/agent-config/commit/d6c3a8dd0220e4a98bf652a8b56d5219d9b267fb))
* **agent-src:** one CLI-entry guard for the scripts that also import each other ([2eed2c7](https://github.com/event4u-app/agent-config/commit/2eed2c7e60e42a85189c457c86ab850f544b9699))
* **rules:** move the re-derive clause out of the preamble, on the gate's evidence ([75b5f22](https://github.com/event4u-app/agent-config/commit/75b5f222b795ac978a1ead53e4926724ea9f1cab))

### Tests

* **cli-delegate:** pin both new roots, and execute what they emit ([f5b7316](https://github.com/event4u-app/agent-config/commit/f5b7316e3817f9ebdd4d936e12d8c76d678d64f9))
* **contracts:** red when the delivery side and the reader side disagree ([e221d3d](https://github.com/event4u-app/agent-config/commit/e221d3d1defdc275a406ba49a06bdd35d6510e91))
* **projection:** make the rule-projection assertion partition-aware ([1417c02](https://github.com/event4u-app/agent-config/commit/1417c02869c05a83fe25d3c5ca73f74c52b2666e))

### Build

* **install:** rebuild dist/install tsc output for the applies_when helpers ([14b4cae](https://github.com/event4u-app/agent-config/commit/14b4cae5e50b75e6db5512261a065b6b17f09f00))

### CI

* run the continuity-surface gate remotely, not only in `task ci` ([cc320e4](https://github.com/event4u-app/agent-config/commit/cc320e43da46cf24e7f3b5f1b6fe38227294d0cb))

### Chores

* **roadmap:** repair the continuity-writer dependency model, split the retirement blocker ([686aa33](https://github.com/event4u-app/agent-config/commit/686aa33f435dd77a00a5934fd49c13d6f75ad0bc))
* **roadmap:** close Phase C1 and park the blocked remainder in later/ ([3e780b6](https://github.com/event4u-app/agent-config/commit/3e780b660d803fcf4fd2a23685471bce26f35b98))
* refresh the ADR evidence census after ADR-263 gained its Evidence section ([04df444](https://github.com/event4u-app/agent-config/commit/04df444526d9461f3c07393b8473edcec22ff77b))
* **evidence:** rebind the completion-review skip after merging origin/main ([0136a4e](https://github.com/event4u-app/agent-config/commit/0136a4edb343e088de29272de83946f553ac44df))
* **evidence:** rebind the completion-review skip after the estate-delta fix ([634eb56](https://github.com/event4u-app/agent-config/commit/634eb562c3a90a9fd73cb64da52fe7a1a9ecd478))
* **roadmap:** count the receiver — status ready, not draft ([3b9aed6](https://github.com/event4u-app/agent-config/commit/3b9aed66551a4fced89689c551596621e07d045a))
* **roadmap:** archive continuity-retirement-sequencing and re-read its probe ([ae156f2](https://github.com/event4u-app/agent-config/commit/ae156f2f8ba34c899518c047e100d06b20ae847f))
* **evidence:** rebind the completion-review skip to the current scope ([6400851](https://github.com/event4u-app/agent-config/commit/640085173151f8488b6393c79bef0f9f5093c583))
* **evidence:** declare the completion-review skip for this docs-only diff ([1c84057](https://github.com/event4u-app/agent-config/commit/1c84057a93a538ca968e22849877388967af275c))
* **roadmaps:** park road-to-first-reference-analysis-observation in later/ ([7b91922](https://github.com/event4u-app/agent-config/commit/7b919220ca7a56fe83b8d5c47be5cc48a014761e))
* **adr:** refresh the evidence census for ADR-262 ([ef6b843](https://github.com/event4u-app/agent-config/commit/ef6b84339d56d29476cb330db413ae248b44318f))
* **budgets:** record what chain-nudge costs, in the three ledgers that ask ([f0f5229](https://github.com/event4u-app/agent-config/commit/f0f52296d437640510b700066a804a05116a81ec))
* **pack:** regenerate the meta token passport ([06445b5](https://github.com/event4u-app/agent-config/commit/06445b58e0d0cb5f112fa3e1e8ba95dc4b07e437))
* **adr-census:** refresh the census artifact after the ADR-204 amendment ([9d99092](https://github.com/event4u-app/agent-config/commit/9d990924707f3b01cb7e64017fdae689e73ddae6))
* **meta:** regenerate the token passport after the main integration ([1a479dd](https://github.com/event4u-app/agent-config/commit/1a479ddcdabbfe7ee558a83ddcca47b676eac840))
* **roadmap:** archive road-to-scan-that-fails-closed at 26/26 ([91b0428](https://github.com/event4u-app/agent-config/commit/91b042800311752db0b224f2d2d06d813c38e8fc))

### Other

* count the two parks separately instead of summing them ([d439a53](https://github.com/event4u-app/agent-config/commit/d439a53f0eb9b80ac1d3c08604b590083ad6658e))
* record drain run 22, and point the current-binding file at it ([880e905](https://github.com/event4u-app/agent-config/commit/880e905d6aab5386a9781f3c2199fa921e986dce))
* the ADR-number collision recurred within a day — record it, do not re-defer silently ([ab0ce5d](https://github.com/event4u-app/agent-config/commit/ab0ce5df32245f2bd3452a420b969fd04f2e3ca3))
* fix the risk-type enum the draft flip exposed, and mark risk 2 realised ([8d23e0c](https://github.com/event4u-app/agent-config/commit/8d23e0c829e6ea23ef9e20bf4b58c1517222e8e4))
* roadmap+adr: the grace ceiling may not rise; the Iron Law reserve is designed, not shipped ([f50af89](https://github.com/event4u-app/agent-config/commit/f50af893d8c9f3bbd506aab0034b476198657861))
* condition (ii) of the menu-exclusion blocker is satisfied by ADR-263 ([ef829d9](https://github.com/event4u-app/agent-config/commit/ef829d987f4b4a5176aec93fe1834b67e0491b86))
* record the K6 disposition on delivery-on-hook-hosts — it stays active ([5f666eb](https://github.com/event4u-app/agent-config/commit/5f666eb18845b591a40257c1605195846c05e444))
* a prohibition-shaped roadmap step closes with [x] and a scoped negative verify ([6688f30](https://github.com/event4u-app/agent-config/commit/6688f305fd4b50991c87ff0623ff1b8acec439cd))
* close road-to-candidate-moves-floor on two convergent council verdicts ([f193c58](https://github.com/event4u-app/agent-config/commit/f193c58d7c62477dab618deab5cdcace95ab694a))
* land the two in-place retractions the archive commit dropped ([36a74a3](https://github.com/event4u-app/agent-config/commit/36a74a3e20e0a7dbc2961b8e1f92e9013ec47655))
* archive road-to-the-skill-surface-framing-choice, and retract the claim that it could not be ([d2ea451](https://github.com/event4u-app/agent-config/commit/d2ea45173eabe164de15bb33aadd61a835fc3dc2))
* inline the council convergence instead of linking the pruned question file ([2804447](https://github.com/event4u-app/agent-config/commit/2804447a6f79b4df88adba10ceb599f555179ca0))
* add the ## Evidence section check_new_adr_evidence requires ([025d821](https://github.com/event4u-app/agent-config/commit/025d821af31392dcc1c01ce7e65f96501c725f40))
* resolve blocker skill-surface-framing-ab-choice with ADR-263 ([9c13f05](https://github.com/event4u-app/agent-config/commit/9c13f0579b9f3a751c1b9ec29eaf5de4d40d2a5f))
* ADR-263 — skills are explicitly-invoked reference material; no automatic routing claimed ([38def70](https://github.com/event4u-app/agent-config/commit/38def70a8fcc5b434e50bd0366c97f4cd0bc623d))
* no host reads a skill's triggers: frontmatter, and by default nothing in-tree does ([6bb8690](https://github.com/event4u-app/agent-config/commit/6bb869016e679a556fb5436d64e85b219c6a194f))
* **delivery-on-hook-hosts:** the ADR-262 collision is silent, and here is the tie-break ([a03c317](https://github.com/event4u-app/agent-config/commit/a03c31750d3e3badd3d1c2c0819f027dd8553586))
* **delivery-on-hook-hosts:** carry the two blockers this file already had ([1cf4f6c](https://github.com/event4u-app/agent-config/commit/1cf4f6cce0f68cffbfaa7b88f082b75b16bdbd41))
* **skill-menu-economy:** re-review the risk register against the correction ([ca51791](https://github.com/event4u-app/agent-config/commit/ca5179124b2cd24e932a59eef28ea77439377f7f))
* **skill-menu-economy:** record the unbuilt lever, correct the step that named it ([6e41200](https://github.com/event4u-app/agent-config/commit/6e4120085d9cf62ff14fe473e5b4f57d1d2d4d9d))
* **mechanics:** house dialect on the one line this diff authored ([2846b10](https://github.com/event4u-app/agent-config/commit/2846b10f981dc09056f1809ac9360bcce2295f53))
* **token-efficiency:** collapse the blank-line run the migration left ([aad5201](https://github.com/event4u-app/agent-config/commit/aad5201f8b0719108871419f3eafffb495d62710))
* **comments:** drop markdown headings and a provenance path from source comments ([85a50a9](https://github.com/event4u-app/agent-config/commit/85a50a9da60948123d3d63f9ae335e18e6f9eda3))

Tests: 22145 (+290 since 14.21.0)

## [14.21.0](https://github.com/event4u-app/agent-config/compare/14.20.0...14.21.0) (2026-09-07)

### Release highlights

- **Behaviour changes:** `task release` no longer asks the releaser to write prose about the next cycle — the governance-versus-product written answer, its promise read-back, the `## [Unreleased]` staging channel and the interactive prompt are deleted, and `> **Governance mix:**` is a pure measurement (ADR-261); one repo-analysis engine with a bounded three-lens loop (8488bf0); record that an unpaid route may propose and score, never decide (10c8c16).
- **Default changes + migration:** _none_
- **Security and correctness:** place the worktree gate where neither neighbour's pin breaks (e4ff296); harden the scan scope through the shared reporter (80514a3); read the in-flight target off state, not off --resume (9dafbc7); re-pin the council-template payload exception at its measured size (23dc5bd); guard the humanizer bench entry point (e998ce5); make the bound table say what the scanner does (20fd4c0); +4 more.
- **Honest nulls:** record the 14.20.0 findings null, and correct the growth claim (065aeba); re-pin the council-template payload exception at its measured size (23dc5bd); disarm the rule-of-three over ordinary lists, floor the densities (ee2fb2f); pre-register the jury claim and build its aggregator (3b3c7e0); report a disabled seat and why it ships off (47a1d1c).
- **Known limitations:** _none_

> **Governance mix:** governance-only 31 vs consumer-only 10 (taxonomy 1.0.0).

### Features

* **gates:** refuse a push that leaves this branch's own work uncommitted ([e64d35f](https://github.com/event4u-app/agent-config/commit/e64d35fce403f665035f55eee16a70d22a30c81f))
* **release:** make the written obligation answerable, not only refusable ([d61cab7](https://github.com/event4u-app/agent-config/commit/d61cab76ab46f5dea883b7664bd040948116aed3))
* **scripts:** add harvest_reference_tokens, the one discovery pass ([22eed08](https://github.com/event4u-app/agent-config/commit/22eed08890e33f83479343871e81d3be86218530))
* **analyze:** add the roadmap-repos harvester as a thin orchestrator ([64da6d4](https://github.com/event4u-app/agent-config/commit/64da6d43fd61e68e851c2a49dbf5d58a260cd7be))
* **analyze:** one repo-analysis engine with a bounded three-lens loop ([8488bf0](https://github.com/event4u-app/agent-config/commit/8488bf078d484028f280e6a8df6a41307da019e5))
* **humanizer:** locate findings, read a consistent pattern as intent, add --audit ([288f451](https://github.com/event4u-app/agent-config/commit/288f451a59b4a0b4f193bd1135e46ea738bc3f68))
* **humanizer:** attribute the blind preference, and decline real-draft collection ([89fa350](https://github.com/event4u-app/agent-config/commit/89fa350b34bb2ab99956c73fecf3308d9a847f72))
* **ai-tells:** land six English and seven German families, one epoch each ([40c77ed](https://github.com/event4u-app/agent-config/commit/40c77ed28d7498444ddb0bcf78b46d5035f848fa))
* **hooks:** one question per structured-ask call, where a deny is honoured ([f9ee563](https://github.com/event4u-app/agent-config/commit/f9ee5638a37ad7e9791712fb1db06cc9d32d859d))
* **feature-plan:** one decision per ask, and a summary that follows the asking ([b7222ea](https://github.com/event4u-app/agent-config/commit/b7222ea864482e7ddfb621771caa92b41644bcc2))
* **roadmap:** ask before park, and stop Open questions reading as storage ([5442cbd](https://github.com/event4u-app/agent-config/commit/5442cbde880117da5300e4d5cd491caa329c26d9))
* **host-capability:** make the structured-ask capability a recorded fact ([de33df2](https://github.com/event4u-app/agent-config/commit/de33df2e0f424b84013d6077bd57fa655ea52aeb))
* **ask:** record the native-ask rate in the census artefact ([0ea82ea](https://github.com/event4u-app/agent-config/commit/0ea82eadd5df1df58d64ae50959d242aacb08bec))
* **ask:** measure the ask surface before changing it ([1b27f7a](https://github.com/event4u-app/agent-config/commit/1b27f7a944d4cfb4031f58311620d760cf8c5340))
* **council:** pre-register the jury claim and build its aggregator ([3b3c7e0](https://github.com/event4u-app/agent-config/commit/3b3c7e0c7d4c1c77b51af888b83974a18b63b2be))
* **council:** make a policy refusal sayable, and fail closed on it ([f52115d](https://github.com/event4u-app/agent-config/commit/f52115d5931e349de035409559c6d7c1729ce9ba))
* **council:** report a disabled seat and why it ships off ([47a1d1c](https://github.com/event4u-app/agent-config/commit/47a1d1cc2424c5f66f2f32fd17ffb09269a45ae4))
* **council:** give gemini, xai and perplexity a live api transport ([92193b8](https://github.com/event4u-app/agent-config/commit/92193b8c0c1d2c8f06dc0761fdebdb17124a718e))

### Bug Fixes

* **decisions:** disclose ADR-260 evidence ([458ab51](https://github.com/event4u-app/agent-config/commit/458ab5148d61acc88c573341a7e933af8224c1af))
* **decisions:** repair the provenance kind and scope the ADR-255 supersession ([df0057c](https://github.com/event4u-app/agent-config/commit/df0057cc51fa7bc72e1905f471c54a570e4d7b6e))
* **evidence:** scrub the speaking round name the drafts cited ([fa8a8bf](https://github.com/event4u-app/agent-config/commit/fa8a8bf98771988a77b0d2d08dd4bc9e428af676))
* **hooks:** place the worktree gate where neither neighbour's pin breaks ([e4ff296](https://github.com/event4u-app/agent-config/commit/e4ff2969f598397fd36a2a4c58870ee28065c44c))
* **gates:** harden the scan scope through the shared reporter ([80514a3](https://github.com/event4u-app/agent-config/commit/80514a3fe81a3b1d6aee7a566b6e206059fdc35c))
* **evidence:** give shipped 14.20.0 the findings ledger it shipped without ([182d84c](https://github.com/event4u-app/agent-config/commit/182d84cb2bb48d1df7d4fe9e7797f3c0da71beed))
* **release:** record the 14.20.0 findings null, and correct the growth claim ([065aeba](https://github.com/event4u-app/agent-config/commit/065aeba595c887b23c2a82288bb49036f0b91f3a))
* **gates:** pay the two ratchets this branch moved ([ff6c84d](https://github.com/event4u-app/agent-config/commit/ff6c84d8bc7306d2cf7cbf0a6766c56cfc9732ed))
* **release:** read the in-flight target off state, not off --resume ([9dafbc7](https://github.com/event4u-app/agent-config/commit/9dafbc72419517607d4e523faab37652814bba4e))
* **gates:** re-pin the council-template payload exception at its measured size ([23dc5bd](https://github.com/event4u-app/agent-config/commit/23dc5bde2be254b55173de68f65c3ce76dc8cb06))
* **analyze:** keep the repo argument-hint inside the 120-char schema cap ([3862664](https://github.com/event4u-app/agent-config/commit/38626642214cd223a5ab93d8abb3959e114883b0))
* **bench:** guard the humanizer bench entry point ([e998ce5](https://github.com/event4u-app/agent-config/commit/e998ce5a154ae25b66c38922100888ca887b72f4))
* **humanizer:** make the bound table say what the scanner does ([20fd4c0](https://github.com/event4u-app/agent-config/commit/20fd4c0a802c982d1e3136c2b3da4225e979c64c))
* **ai-tells:** disarm the rule-of-three over ordinary lists, floor the densities ([ee2fb2f](https://github.com/event4u-app/agent-config/commit/ee2fb2f03ab4a79c8741b1219f37954c23b9767b))
* **handoff:** use the house dialect for handoff ([ffd42f0](https://github.com/event4u-app/agent-config/commit/ffd42f0445a877e56ebfc502b944e9e2014636f9))
* **comments:** drop report structure and evidence paths from source ([b346418](https://github.com/event4u-app/agent-config/commit/b346418b12c47d5ab422f92c95a81a47c0f26fbd))
* **claims:** use the house dialect in the jury claim ([dc82a5c](https://github.com/event4u-app/agent-config/commit/dc82a5caae2230cdf02444a9a49d3de330400894))
* **lint:** satisfy the two eslint rules the new council modules tripped ([162056e](https://github.com/event4u-app/agent-config/commit/162056e2bfd63fcb5fd4e1219b4882343a2acf29))
* **hooks:** carry rung-3 and rung-4 verdicts on the runtime carrier ([1a1f57a](https://github.com/event4u-app/agent-config/commit/1a1f57ae5e1e8352bced0b212a51af63410fea14))

### Documentation

* **evidence:** declare the completion-review skip for this docs-only diff ([b273d3f](https://github.com/event4u-app/agent-config/commit/b273d3f6bd0428d1b06e311bd13e632631522fda))
* **evidence:** the inbox-2026-09-u verification and reproduction ledger ([3927a27](https://github.com/event4u-app/agent-config/commit/3927a27c224b9f6c828aec47e888c5748e690853))
* **roadmaps:** land the standing-payload and code-graph plans, corrected against the tree ([165c154](https://github.com/event4u-app/agent-config/commit/165c1545b9a7ff40e14d735982f987ac1988d78d))
* **decisions:** record the two owner rulings as ADR-259 and ADR-260 ([b53b182](https://github.com/event4u-app/agent-config/commit/b53b18202e1242e2492437df454aa1d481c0366c))
* **evidence:** add the sixth drain position and the cross-session guard finding ([cb809ed](https://github.com/event4u-app/agent-config/commit/cb809ed2ec8f400b5f7e2d0bb594db498e5031c7))
* **changelog:** record the pre-push worktree gate ([ad04f23](https://github.com/event4u-app/agent-config/commit/ad04f2363997b336d4fe56f4bb962fa68458de29))
* **evidence:** record the 2026-09-07 PR drain run ([f5cad4c](https://github.com/event4u-app/agent-config/commit/f5cad4cfd6803c14513d629a0bbf8ad6d241668b))
* **evidence:** correct the run-20 PR states, and record how the shared red cleared ([5bcc8b8](https://github.com/event4u-app/agent-config/commit/5bcc8b840c6c9bd236179a689cd20fb5b6c1c73d))
* **evidence:** record the run-20 autonomous roadmap drain ([6aedb31](https://github.com/event4u-app/agent-config/commit/6aedb311a297281ce6de50c994132f1a63d73540))
* **release:** record the three answer routes and the in-flight target fix ([c7e320b](https://github.com/event4u-app/agent-config/commit/c7e320bac67aa2ebbc3571efc000bdc083804409))
* **roadmap:** close road-to-bounded-reference-harvest-loop, carry the observation ([1f1df17](https://github.com/event4u-app/agent-config/commit/1f1df17ceb0e49428ecce3f6c7fa8ef0c55f7684))
* **adr:** record the 2026-07-11 prose-tell verdicts as ADR-256 ([8dcc259](https://github.com/event4u-app/agent-config/commit/8dcc259b1d9541c38149f9379550617df6b97d07))
* **decisions:** record the one-question-per-ask concern admission ([03b865f](https://github.com/event4u-app/agent-config/commit/03b865fd8517604d8e81acd7ca8439e58f84dee9))
* **evidence:** the post-change ask-block census ([1390aa7](https://github.com/event4u-app/agent-config/commit/1390aa7502d1fc8f00f0aa3528c052540f2ef83e))
* **evidence:** freeze the ask-block census baseline ([27c7d40](https://github.com/event4u-app/agent-config/commit/27c7d4051241e44d716d500a8cb7b06e254ebdcd))
* **adr:** disclose ADR-256's evidence in the body, not only its frontmatter ([a37a12e](https://github.com/event4u-app/agent-config/commit/a37a12ebf497b542dcfb290e6dbf4dfcc935ee34))
* **proof:** regenerate after the jury claim landed in the ledger ([0753cb8](https://github.com/event4u-app/agent-config/commit/0753cb8d43fd86a396129a47c415534696b19913))
* **roadmaps:** resolve three blockers on admissible-council-seats ([bb8cef5](https://github.com/event4u-app/agent-config/commit/bb8cef53fe4814c94b25f0fe3926a06e127c74b9))
* **adr:** record that an unpaid route may propose and score, never decide ([10c8c16](https://github.com/event4u-app/agent-config/commit/10c8c169c4c6c2c76f0aeea4e57dd925b81e789c))

### Chores

* **evidence:** refresh the ADR evidence census after the main merge ([a2544fc](https://github.com/event4u-app/agent-config/commit/a2544fc61d45d9c90578633b49e84398269f28c9))
* **baselines:** carry the merge reconciliation that was never committed ([33e811f](https://github.com/event4u-app/agent-config/commit/33e811f330ba41f9e81dafeda2bba9d047ab427c))
* **evidence:** record the 14.20.0 findings ledger ([3bfb9b5](https://github.com/event4u-app/agent-config/commit/3bfb9b540e588358b06182bad3e60694b557d24f))
* **install:** rebuild the install bundle for the merged capability field ([395c0b6](https://github.com/event4u-app/agent-config/commit/395c0b61d61a492b0a0b2bba9368521ccea879de))
* **roadmap:** archive road-to-bounded-reference-harvest-loop ([0b3d0a8](https://github.com/event4u-app/agent-config/commit/0b3d0a8af6bad3f76f44b8c7857a8807c405bd50))
* **generated:** regenerate projections, catalogs and artefact counts ([1187cd6](https://github.com/event4u-app/agent-config/commit/1187cd6932b28d42ebea49b576ba4edb885b1138))
* **proof:** regenerate docs/proof.md for the re-scoped humanizer claim ([86951f2](https://github.com/event4u-app/agent-config/commit/86951f26bab10dfd83b8955e137b273c6c5608bd))
* **adr:** regenerate the evidence census for ADR-256 ([f3b0054](https://github.com/event4u-app/agent-config/commit/f3b00549b87b7f04f82849738233c211655d15e5))
* **index:** regenerate for the /humanize description change ([97d1b1d](https://github.com/event4u-app/agent-config/commit/97d1b1d61a2857166b7e2f755018979038e39613))
* **estate:** claim the one dimension this change grows ([8203323](https://github.com/event4u-app/agent-config/commit/8203323a620c1a7a855ae62cd6f38c6292e3c26d))
* **roadmap:** archive road-to-asked-not-parked ([952a011](https://github.com/event4u-app/agent-config/commit/952a01120d29eab49091e087b5921dfbd0c3e202))
* **host-capability:** project the contract edit and escape the artefact pointer ([9331bbf](https://github.com/event4u-app/agent-config/commit/9331bbf59e872983ada34cfeb34e41894abe191b))
* **census:** refresh the ADR evidence census for ADR-256 ([9379a5b](https://github.com/event4u-app/agent-config/commit/9379a5b278e5a33469ec7e3a017afc50c5f6c1bb))
* **baselines:** lower check_source_size_budget 18,062 -> 18,061 ([51708b1](https://github.com/event4u-app/agent-config/commit/51708b18f7f06853ca5936eaf6b7ce4c8d28f596))
* **roadmaps:** archive road-to-admissible-council-seats ([9a7ac52](https://github.com/event4u-app/agent-config/commit/9a7ac524922d65bfc85a476a0afdab039dfb415c))

### Other

* **measured-prose-tells:** archive, and correct the parent's stale note ([5c1baf5](https://github.com/event4u-app/agent-config/commit/5c1baf5cc78fdaf8747cae55601f6da3ad5b8f7b))
* **measured-prose-tells:** close all 25 boxes and resolve the blocker ([224de7f](https://github.com/event4u-app/agent-config/commit/224de7f7b7ed814894830a36ab0ba41fce0406b3))
* **humanizer:** split the fixture corpus into tune and holdout ([1c6f4ea](https://github.com/event4u-app/agent-config/commit/1c6f4eae62453d90d19086c97601c6d277be1bbf))
* **prose-tells:** publish run 1 and run 2, including two falsified predictions ([fb03dba](https://github.com/event4u-app/agent-config/commit/fb03dba730b86980e81203a3d3c16ee10100fa89))
* **prose-tells:** build the clean corpus and the per-rule FP instrument ([b1c95eb](https://github.com/event4u-app/agent-config/commit/b1c95eb4d9aabca793d52feb4d7679429e30d4d7))
* **prose-tells:** pre-register the false-positive instrument before measuring ([822b5b2](https://github.com/event4u-app/agent-config/commit/822b5b2ddcfc7f4f7de225b803941373d78d2e60))
* **asked-not-parked:** resolve both blockers and close every step ([1a8cb04](https://github.com/event4u-app/agent-config/commit/1a8cb04709314b7c19a4c7e2339e4901a062ad80))

Tests: 21855 (+249 since 14.20.0)

## [14.20.0](https://github.com/event4u-app/agent-config/compare/14.19.0...14.20.0) (2026-09-07)

### Release highlights

- **Behaviour changes:** drop a stale self-referential suppression from untrusted-input-defense (3fb3405); bind every suppression pragma to the evidence it accepts (98e9af2).
- **Default changes + migration:** _none_
- **Security and correctness:** a parity-pinned pair carries one bound hash per identity (8a08504); house dialect in the lines this branch authored (085279f); drop a stale self-referential suppression from untrusted-input-defense (3fb3405); bind every suppression pragma to the evidence it accepts (98e9af2); the scout's security gate reads what a candidate says (35bcf7e); the agent-security umbrella publishes what it read, and carries a floor (a416ef8); +8 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 16 vs consumer-only 3 (taxonomy 1.0.0).
> Next cycle ships the ask surface: a decision this package needs from its user
> reaches the user instead of parking in a roadmap `blocked-by:` marker, an
> `## Open questions` section nothing obliges the next session to read, or a
> printed `{count}` where a question belonged — tracked in
> `agents/roadmaps/road-to-asked-not-parked.md`, which stands at zero of its
> twenty-five steps at this tag.

> **Previous cycle:** the 14.19.0 head promised the installed MCP bridge repair —
> a version-pinned server entry instead of an `npx -y` resolution of `latest`, a
> registration that migrates itself when the bridge shape changes under an update,
> and setup docs matching the command the installer actually writes. It **shipped**,
> in this span: `mcpBridgeEntry` now emits `@event4u/agent-config@<version>` read
> from the installed manifest and leaves the spec unpinned rather than guessed when
> the version cannot be read (`src/scripts/_lib/mcp_bridge.ts:52-60`, commit
> d01873a88); the documented client snippets are gated against the installer entry
> (21c215e54) and `grep -c "/absolute/path/to/agent-config" docs/mcp-server.md`
> returns 0; MCP registration is gated on the capability axis with the consent
> residual named (55de37904). `road-to-mcp-bridge-integrity-and-reach-truth` closed
> at seventeen of seventeen steps. The promise stood outstanding across 14.18.0 and
> 14.19.0 and is now discharged.

### Features

* **publish:** classify the packed surface by type, bound per entry ([d08656d](https://github.com/event4u-app/agent-config/commit/d08656dfe50bee05579691b9229b9b1dfb23870c))
* **security:** bind every suppression pragma to the evidence it accepts ([98e9af2](https://github.com/event4u-app/agent-config/commit/98e9af29744a8ad76192eb48615764a5bc3fa8d2))
* **security:** the scout's security gate reads what a candidate says ([35bcf7e](https://github.com/event4u-app/agent-config/commit/35bcf7e972679dae961b7c812a6e397c5a1d68c2))
* **security:** the agent-security umbrella publishes what it read, and carries a floor ([a416ef8](https://github.com/event4u-app/agent-config/commit/a416ef8ce3b89e35aa2459f5204599ff5d9066db))
* **handoff:** carry falsifiable uncertainty, and capture rather than chase ([83de12e](https://github.com/event4u-app/agent-config/commit/83de12e0760a592060f30a94575d9dc9898215bf))
* **self-repair:** give a model-noticed observation a target-addressed record ([32c8302](https://github.com/event4u-app/agent-config/commit/32c83025e421072ed6084f06e612622b0b9da965))
* **continuity:** key the record by session and give the schema what worked ([72c0962](https://github.com/event4u-app/agent-config/commit/72c096257210e9f12f9dfdc7a24be686aed30eea))
* **install:** gate MCP registration on the capability axis, and name the residual ([55de379](https://github.com/event4u-app/agent-config/commit/55de379047c3e1ae6cbeabfa563290117e20bc6e))
* **telemetry:** publish the MCP-lite reading, zero included ([b2e3f20](https://github.com/event4u-app/agent-config/commit/b2e3f207b737f725dfd28b9a9ce0c06a329d56fc))
* **mcp:** emit one collector row per stdio-lite tools/call ([6fb0fe9](https://github.com/event4u-app/agent-config/commit/6fb0fe90c21114096507406c58158a312792bb4b))
* **mcp:** serve the standard resource annotations, and add the MCP capability axis ([3dfd70a](https://github.com/event4u-app/agent-config/commit/3dfd70a028ef6e9f60f75c4d28fc9f76ed75658f))
* **mcp:** make the documented client snippets match the installer, and gate it ([21c215e](https://github.com/event4u-app/agent-config/commit/21c215e54d423a6abda8a47b9fdafb2c2475497b))
* **mcp:** pin the bridge entry to the installed version, and repair it on update ([d01873a](https://github.com/event4u-app/agent-config/commit/d01873a88cd2800dd49f201cbb64f2cf4c640488))

### Bug Fixes

* **security:** a parity-pinned pair carries one bound hash per identity ([8a08504](https://github.com/event4u-app/agent-config/commit/8a0850449d8f9f89b262a74af218a5f895aa4412))
* **security:** drop a stale self-referential suppression from untrusted-input-defense ([3fb3405](https://github.com/event4u-app/agent-config/commit/3fb34055b2df64b21d435f221c7cb967d0e0c5ef))
* **deps:** bump open from 11.0.1 to 11.0.2 in the npm-production group ([0dd9c23](https://github.com/event4u-app/agent-config/commit/0dd9c2364436dad56a308fccf15a595f7ade93d8))
* **security:** the agent-security umbrella fails closed on a child that did not answer ([6a9411f](https://github.com/event4u-app/agent-config/commit/6a9411fc60f226b16c9efcaa1c6c5cf209e06207))
* **ci:** clear lint_code_comments on this branch's own new comments ([e2589b0](https://github.com/event4u-app/agent-config/commit/e2589b0d7b21a7a78c4c5dd353861326f7c9a96d))
* **gates:** make the park gate read a wake condition, not a status word ([4636ad8](https://github.com/event4u-app/agent-config/commit/4636ad80da321fce0012bd20b5b52bee4515428b))
* **audit:** make rules_applied an observation, retiring the constant and its card ([bffae3d](https://github.com/event4u-app/agent-config/commit/bffae3dd1d1f8feee8fbb86ca3557b7a803b34fa))
* **ci:** rewrite two docblocks as prose, and record the 14.19.0 review null ([83bc671](https://github.com/event4u-app/agent-config/commit/83bc671e6653110877ff525add31b66ff6f9e955))
* **release:** record why 14.19.0's findings ledger is empty ([e6aab8f](https://github.com/event4u-app/agent-config/commit/e6aab8fdaa0ceb62a10d7c17f870d2d142890436))
* **release:** make the curated-head refusal recoverable from where it stops ([5affd8a](https://github.com/event4u-app/agent-config/commit/5affd8adcb8f56e9bd4999e483d5bfeef5530710))

### Documentation

* **roadmap:** re-review the risk register against what the six risks actually did ([79f05a1](https://github.com/event4u-app/agent-config/commit/79f05a1a78aa187c8b96deba664a17f9a5b92d58))
* **roadmap:** resolve both blockers of road-to-scan-that-fails-closed ([1b7de23](https://github.com/event4u-app/agent-config/commit/1b7de235ffdb6649194223b988594ee0f4e6eee6))
* **roadmaps:** drain 20 disposition -- 0 of 38 closed, every trigger re-measured ([0d39f15](https://github.com/event4u-app/agent-config/commit/0d39f1502d88a0cc5729d0de63dbf9a420162a5b))
* **roadmaps:** record the carrier-transition-vocabulary trigger as fired ([82da6e9](https://github.com/event4u-app/agent-config/commit/82da6e9f006f62f57a7bfc5b70761aed36a5a0b0))
* **security:** state the umbrella's child-completion gap before repairing it ([e9ccd26](https://github.com/event4u-app/agent-config/commit/e9ccd26ecfa9b16a3e20f01a072071acd120108b))
* **roadmap:** close road-to-observed-learning-signal and its four blockers ([07f47bd](https://github.com/event4u-app/agent-config/commit/07f47bdcd896dd959846aeeac8b384f555c84c5b))
* correct the two documents that mislead the next reader ([2f319f7](https://github.com/event4u-app/agent-config/commit/2f319f7882e80113f606a1652dbe14684c41a4ef))
* **roadmap:** close Phases 1-2, record the council sequencing for 3-4 ([5378030](https://github.com/event4u-app/agent-config/commit/5378030e0f93b71d4a6696fd32816baface27ac5))
* **adr:** disclose what ADR-256 rests on, and what it does not ([b634daa](https://github.com/event4u-app/agent-config/commit/b634daadb43a9d3c182caf86e33336a07f26c20c))
* **hosts:** reconcile the enforcement surface with what the manifest binds ([909e606](https://github.com/event4u-app/agent-config/commit/909e606e443e9fb46b230bf2db7c0bfb85827b45))
* **adr:** record the four MCP blocker rulings, and close the roadmap ([adedaf4](https://github.com/event4u-app/agent-config/commit/adedaf485a8379051012692b1c5b39867638d398))

### Refactoring

* **mcp:** pay the size ratchet rather than raise it, and fix two CI reds ([08e011a](https://github.com/event4u-app/agent-config/commit/08e011ab8837213ea86aefcc632ebabd85b5fa8b))
* **release:** move the start-position verdict into _lib ([97b74ad](https://github.com/event4u-app/agent-config/commit/97b74ad48eda3a96ef5e4830dd4963041decab79))
* **continuity:** retire HANDOFF.md and decide the two colliding words ([ffd8dd7](https://github.com/event4u-app/agent-config/commit/ffd8dd754fc85ab8c928e45522d8c21f7c2460dd))

### Tests

* **security:** freeze the umbrella's failure corpus against today's fail-open ([b4bed8c](https://github.com/event4u-app/agent-config/commit/b4bed8c563348a94592083466859367b0352aed3))

### Chores

* **gates:** recount the coverage denominator on the merged tree, re-pin the canary ([1918abb](https://github.com/event4u-app/agent-config/commit/1918abb972748b52868cc8e6f2ab79104ad9319d))
* **deps:** bump the github-actions group across 1 directory with 3 updates ([720bc5e](https://github.com/event4u-app/agent-config/commit/720bc5e17a6263f525e2c2e4e949d8687a0009ae))
* **deps-dev:** bump the npm-development group with 6 updates ([a449541](https://github.com/event4u-app/agent-config/commit/a449541c4961ab8f72588158b204aff7212224d9))
* **evidence:** use the reconciled 14.19.0 ledger text ([a692fe3](https://github.com/event4u-app/agent-config/commit/a692fe39443e0b2bb1e68f6e809133fc922c3abd))
* **roadmap:** archive road-to-observed-learning-signal ([b52fed5](https://github.com/event4u-app/agent-config/commit/b52fed5f44dd23fb377f4e060de67dfd6ae1d827))
* **reports:** regenerate skill-overlap after the TDD skill edit ([67f2c16](https://github.com/event4u-app/agent-config/commit/67f2c168adaf7ad7fdb076064f5c805e5466edbe))
* **census:** refresh the ADR evidence census for ADR-256 ([5aa4e7c](https://github.com/event4u-app/agent-config/commit/5aa4e7cbb8852edb2f2704dbf881f6580c6fd983))
* **evidence:** record the 14.19.0 findings ledger ([88ba528](https://github.com/event4u-app/agent-config/commit/88ba5286a58314e4a027f28ce76d489072f27a68))
* **roadmap:** archive road-to-mcp-bridge-integrity-and-reach-truth ([02c016e](https://github.com/event4u-app/agent-config/commit/02c016e367128f2b9e604cef9b4fc906a8922e56))

### Other

* **security:** house dialect in the lines this branch authored ([085279f](https://github.com/event4u-app/agent-config/commit/085279f9cc1e84ea87a48c56bc21021873ef7704))
* carry the closure content the archival move left behind ([cbf0b5d](https://github.com/event4u-app/agent-config/commit/cbf0b5dd69bd69ba2b5be88e12eb66d8df016876))
* close road-to-one-continuity-record around the sequenced half ([ffab0c2](https://github.com/event4u-app/agent-config/commit/ffab0c262e0a72817e41a2b13a25ae8fabc63ff6))

Tests: 21606 (+130 since 14.19.0)
