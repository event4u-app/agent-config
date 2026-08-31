<!-- evidence-type: analysis -->

# Trigger-corpus holdout partition — frozen 2026-08-30

`road-to-governed-harness-evolution` step **2.5**: *"Freeze the holdout
partition here, before any proposer exists. If the pipeline that later optimises
against the corpus also grew it, the holdout is compromised before it is used."*
Its verify asks for a partition **content-hash pinned in a committed file whose
hash predates the first Phase 5 commit**.

This is that file. It is committed now, in Phase 2, and Phase 5 has no commits —
so the ordering the verify asks for is a property of the git history rather than
a claim made here.

## The frozen set

Every `src/skills/*/evals/triggers.json` present on this tree at the moment of
freezing: **100 files**, 18 holdout and 82 train.

## The partition rule — deterministic, name-derived, no discretion

```
holdout  iff  sha256(<skill-directory-name>).digest()[0] < 51
train    otherwise
```

51/256 targets 19.9 %; the realised split is 18/100 = 18.0 %.

**Why a name hash and not a sample.** Risk 3 in the roadmap's register is *"the
corpus becomes the overfitting vehicle — if the pipeline that optimises against
the trigger corpus also grew it, the holdout is compromised before the first
candidate runs."* A partition anybody could have *chosen* is one somebody could
have chosen to flatter a candidate. This rule is recomputable from the skill
name alone by anyone, at any later date, with no reference to this file — so the
file is a **witness**, not the authority. If the two ever disagree, the rule
wins and the disagreement is the finding.

**The rule is fixed as of this freeze.** Changing the constant, the hash, or the
input re-partitions the corpus and voids every holdout result that came before
it. A change is legal; a *silent* change is the compromise this step exists to
prevent.

## The set hash

```
SET-SHA256  0667fbd96d7d1da88368d4d587545ff03475208ab9d07ca5212975e8cdaaa4d6
```

Computed over the lines `<skill> <sha256-of-file> <partition>\n` for all
100 files, byte-sorted as one list (`LC_ALL=C`) — NOT per partition. The two
tables below split that same list in two for reading; the hash is over the
undivided, byte-sorted whole, and the reproduce command below is the
authority on the order. It pins the partition **and** the corpus content: editing any one
of the 100 files changes it. A later run recomputing a different value
has either grown the corpus or edited a frozen file, and either is a finding
before it is a bug.

**Reproduce:**

```bash
for f in $(ls -1 src/skills/*/evals/triggers.json | sort); do
  s=$(basename $(dirname $(dirname "$f")))
  b=$(printf '%s' "$s" | shasum -a 256 | cut -c1-2)
  p=$([ $((16#$b)) -lt 51 ] && echo holdout || echo train)
  printf '%s %s %s\n' "$s" "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$p"
done | LC_ALL=C sort | shasum -a 256
```

## Correction 2026-08-31 — the pin was stale on arrival, and is re-pinned here

```
THE PIN WAS WRONG. THE CORPUS WAS NOT.
RE-PINNED TO THE FROZEN BYTES, WHICH HAVE NOT MOVED SINCE THE FREEZE COMMIT.
THE ORDERING CLAIM SURVIVES THE RE-PIN AND IS RE-VERIFIED BELOW.
```

**What was wrong.** The `SET-SHA256` published in this file's first revision,
`7e091dfc…`, did not reproduce from this file's own documented recipe. Running
that recipe on the tree yields `0667fbd9…`, and two near-variants — dropping the
partition column, and tab separators — yield two further values, neither of them
the pin. So the mismatch was not a formatting ambiguity in the recipe.

**The corpus was checked before the pin was blamed, and it is intact.** The file
set is identical to the freeze commit `34318f7f5` — 100 files, `git ls-tree`
diff empty — and every file's bytes are unchanged since it.

**The actual cause.** `34318f7f5`, the commit that RECORDED the freeze, also
edited three of the files it was freezing. `markitdown`, `security-audit` and
`threat-modeling` were pinned at their **pre-edit** hashes; the other 97 rows
reproduce exactly, and the set hash inherited the three wrong rows. A hash
computed from bytes that the same commit then replaced is stale the moment it is
written, which is why this was never a drift and could never have been caught by
re-running the recipe later and trusting the old number.

**What was re-pinned**, to the frozen bytes as they stand at `34318f7f5` and
today — `git diff 34318f7f..HEAD` over the three paths is empty:

| Row | Was (pre-edit, stale) | Now (frozen bytes) |
|---|---|---|
| `SET-SHA256` | `7e091dfc…` | `0667fbd9…` |
| `threat-modeling` | `0cc498c5…` | `6bdb1d3b…` |
| `markitdown` | `ccaac56a…` | `663ee4c4…` |
| `security-audit` | `8005676c…` | `27ccbdcd…` |

**The ordering claim is re-verified, not assumed to survive.** AC-6 asserts the
holdout partition's content hash predates the first commit of any proposer
capability. `git merge-base --is-ancestor 34318f7f ac2501313` returns true:
`34318f7f5` (2026-08-30 22:11:43) is a topological ancestor of `ac2501313`
(2026-08-31 00:44:37), which added `src/scripts/_lib/candidate_proposer.ts` and
`evolution_lab`'s `propose` verb. The near-miss was checked rather than waved
past: `src/scripts/_lib/harness_evolution_guards.ts` (2026-08-30 17:55:29) names
"proposer" but is the guard that REFUSES disclosure to one, not a proposer
capability.

Because the bytes have not moved since a commit that precedes the first proposer
commit, the re-pin changes which number is written down and changes nothing about
what the number certifies.

## Holdout — 18 files, sealed

Sealed means: **no proposer, curator, or analyzer authored in Phase 5 may read
these files, and no candidate may be selected against them.** Phase 4's cascade
opens the sealed set for promotion candidates only — decision E7, which is still
open and which this file does not settle.

| Skill | sha256 of `evals/triggers.json` |
|---|---|
| `analysis-autonomous-mode` | `b2498906765699c666097683f819e0bff816ff3e94b5bb684564e5b19e5e75c7` |
| `authz-review` | `2dffacd346e8d656affa0af1ea56c7661e7b0c99e3a8ac2c92be50981b2c970c` |
| `brand` | `43abaf7937a73ea8b041e18d977ce6a080b2226f6c0f49bb55cf59bc4545df36` |
| `canvas-design` | `63229b3cfc336241f96140baf7c41c695a0f4fdbe8c30c9f1f787cd84ddfe02b` |
| `code-intelligence` | `350a6d29f264800744fe9b1a4fcc48e9f7acba25cdd325f33df5b3a0aa1aaac2` |
| `decision-record` | `5003c69b353baf1a6cd25b679d029f1988a83482cf2664f316d7c451d7a906d1` |
| `fe-design` | `bfc10d1fce9264a9b9e6a542354b1f679dec12331a605c97c4615795a804cc3e` |
| `image-generation` | `0ed76f9ddca3cd10b73aad8e00dbe643da9c3f0dc44e7e170dbd5e7304235381` |
| `judge-injection-defense` | `dad5757b5ee71d78b761467d007d18c18fb3d440d1e1f5eb54ca10b4ce6d156f` |
| `judge-spec-compliance` | `6d7e5525d88e4c4b26c963103f43f7e95d997337ff3d624fea31a757363f653e` |
| `license-compliance-borrow-check` | `2c23f14c168f6de1f99689e420e29b2b86bbd27e0fdfff68dcdf80b483aa2d0f` |
| `logo-generation` | `fcf30c295c85f8b24f0ee6cb374229c39dbe87959469d7b04b19660e727e9a08` |
| `overbuild-review-lens` | `32ef2f64da160c5cbc5fef3b4e3d38d83e8f39b918ba4574e43e2f9256ae69f2` |
| `php-coder` | `25950ef2e90e4055ba30de21b32204727dd953275a681f99ac60c5a59592be83` |
| `playbook-authoring` | `e615f614da3c14439fca70f3477272a8323e579ac4961ce2ce83c3c0f099949b` |
| `schema-review` | `7c98b3409de8ebb6ef3ee999a46e9c07f69574809c42283b25d2ab384f6cd53f` |
| `threat-modeling` | `6bdb1d3b44939ac8f6ba78bb6145ca3bea91adb50991cd44bd700987adf903f2` |
| `worktree-lifecycle` | `1cdde59eaaadc1cb7dfa1cd86d9852326c352a7dcd884dbcbaa414f36d176326` |

## Train — 82 files

| Skill | sha256 of `evals/triggers.json` |
|---|---|
| `adr-create` | `18995bba7bbdc905296f545a25c90cd94fa306909d78af8fc79e3d5621f313f6` |
| `adversarial-review` | `4656cdc7fd9bc9517d7a2a27cb48c1dfa863c93bf87531292e46bdc85b6dc7d4` |
| `agent-security-review` | `8c87aad7d61400da983130cef3415fb9e146d088ff30f47215481c5f692a4d1f` |
| `ai-code-blindspots` | `27a9e87dabf2d158b5f646739c69222b534b3ea2420a099a67bf85c00ea3ba23` |
| `alerting-doctrine` | `bded213edcbeeee6e3bf078e478ab4fdaa553855bdafda147813cf6198d8b8ba` |
| `analysis-skill-router` | `df90b10374f26c8c267ff0bdecc5039d9cfb58e501ed000f02a70d4b3b8269fd` |
| `architecture-review-lens` | `0aea3490d1337d4d72688e35164191f510fbf0dbda3db2408585d18d0746aada` |
| `blameless-post-mortem` | `719dabb662d9937dabb178d097dc73e458c6b31210532b309896580aefd6c48c` |
| `blast-radius-analyzer` | `353806c436295cd6e83c4e9e7ac0e4de61501e01cec65a9b0d57e2c183f9a391` |
| `brand-asset-generation` | `ebbc94b7467f4240ec56d8b95ee2aae225540e8e51f665edfd7a9704be5dd731` |
| `brand-audit` | `77bbac810a28d2c0fba32c6ce75e38e50aff783ce8775e4bc215893e04a42a8c` |
| `brand-identity` | `50be404a9317ca4321de6966c84815d23721bfb092bf90c4f24ae781b26c1caf` |
| `brand-strategy` | `8a9a7ea586b7de9e0a3b7a8e0b3ffd776ca1260ab79d77b2804ed4c9e6911606` |
| `brand-to-tokens` | `b58dc2a919d0f8a242120e4b04853546c226c4e22645919f0bee39e799bcc094` |
| `bug-analyzer` | `c2eb95aada033854401cdb6a951fac9b7cac633b0ee4142f126eece78b1953eb` |
| `code-refactoring` | `a6147167bd6c11a4c4f2b0a4bae924f403f54d16aa0334b089b6bba744d66f77` |
| `code-review` | `68dfc344a28c8d4b7bf79ff57c57642b6904ad25cc3f1815d34a1ab73de99224` |
| `competitive-moat-analysis` | `e149d75967c3d407ba74512527934b77fb3ede128c1bbcdecdd88e3c51448b67` |
| `complexity-first-planning` | `7377795a8aca39c574ed4a1bc2074f7da451bf1ce7095bdb0ccdc50e60b9757b` |
| `contract-review` | `9b5e4a70563ed2e07e463d59a1f179b79f44d37f38323b23013227bbd5aec73b` |
| `corpus-grounding` | `f87d7497f5705b0ef84bd61137623984faaac39f202bf9f5fea206855fbd6c3f` |
| `customer-research` | `be1760092dfc0e70006ac1313709d8acdd48a62b1e3b81f354590df95e23fbc6` |
| `data-flow-mapper` | `535e42defa307b3a40d68cdcd6eeeef101c120d5c5c1b9740330199a5acc2203` |
| `design-intelligence` | `81361d4cd038b77ae78ddc988e3fdc247b93112f217ed455ce9437ac3576ac21` |
| `design-tokens` | `a39661a7b95f92c7f649d4a82b33c07be346053d4529ae7a6a9626609b30be40` |
| `design-variations` | `ab58c78688a1f4f41cbbdd9c6302c3eea975bc2c25a565b67fcfb961cea9d590` |
| `doc-coauthoring` | `025530a4b9bb40834cd9054c40e8c9518c55e55d2adcead638b1a8919d856f1b` |
| `docx-authoring` | `75b784449debd2009b332b91edd75116ceccd8ae18866405dd689c48b2e8fb67` |
| `dpa-review` | `e0ded718f20941ad84a7ce87cb69aa3e1059d68234ca312c4846f5fb601d1279` |
| `eloquent` | `d61c6ada4b28e29f5e7a97aca87917cf6942e5da7f39741d9f4ef0b7ade27185` |
| `estimate-ticket` | `4f882334316f1d694cb605854527736d237f5c21288e18e427601e184d2dfe69` |
| `evaluate-llm-feature` | `0208ae44de28e4a96ebc116d329250e4a6006b00cbb0b2d638aaf4a005423f13` |
| `existing-ui-audit` | `1cec11b0fc1696d5186a30c8a73fe3b10efa7ccb9a956d17a995e7415180a35e` |
| `experiment-loop` | `7b64978277e8b29b2e58080914329d14274375f0195b59119cad7cede6ec55c0` |
| `forensics-report` | `ae4a0a37cd21eeb99b798839d99195e580dbd5bdb017642ace5e462db0593234` |
| `frontend-render-security` | `a881e51be1fb62289f71f02ae53177629734e23e5fd5aa3a4a43c972fb23b7f1` |
| `gated-reach` | `8d39468e75ff725b8e4454fc3a783c2490447ac3f8658ec91e62dbc48352c8a1` |
| `history-design` | `50825f6db0683e20a9c16c6a190b52e197caa9a8f20ea85dfa1f6294e70f5145` |
| `html-deck` | `6bad648f124ea1af4c39f9af19f3fedfb077edc595d63816a8abcf450d2be35d` |
| `humanizer` | `76c89f2ed3146d11d0f08c97d2595b60b35c1c912ad5c8c9707c0799c52dd221` |
| `iconography` | `6a94e7c7811e8e893654620ccb6ee2f04ed747671174eaf218846c7f75be3720` |
| `image-analyser` | `47735add726cdb3b86e8a08c66fca17a824acc63ac4a788fe29083b61f5a8ebb` |
| `image-creator` | `0c4b5598b10ae0f53ccbef2a6e0c863f353b849e152dcf51a197652266954292` |
| `image-editing` | `2b3fe1109fb8be12a9e42bcfb9ff587f07a37ad3fb926dc538b335f5c8fbf3b8` |
| `image-provider-routing` | `b55853630843300a0e6c8911b5a70069158c28c701af8060646012411945083c` |
| `incident-commander` | `7e9371f328c7b1751c083688f77a34af2db2b901befc78eed7c8400ae5b2019e` |
| `js-library-packaging` | `8b64d0222ee1228950056004a752b4dc168f8f571e037ec38791258ec305bacd` |
| `judge-artifact-completeness` | `4b1d517726313827781746169d30009b2b0655bbc0392740ebcd6e712c58cd50` |
| `judge-synthesis` | `378e0eec013fbf2a96cda58a6ba318884fc141fc0f722fae23a488a8a7ca6155` |
| `learning-tutor` | `3facfb90fa1ee593cf779862bfc79f88f70a915dc9638dc4af6ef5bbf98d9fd7` |
| `legal-intake-triage` | `4b6afb88a3a7912ab8666d5e000172224e3e26f5940bbf09988e750a0d89b6fc` |
| `legal-practice-profile` | `be472d98368803e6b0f31652069f2ce01b802b97a3ec7976635a602667a6ba14` |
| `license-compliance-audit` | `6ea08eade2a25c2f95c44a727084adbd4f4f2b073d9eae6e95bc169ab4cfdf93` |
| `license-compliance-credits` | `d2838c7b4b722351d54ae91fd226a3314752a038769093f59b505a6e29d63bdf` |
| `llm-provider-knowledge` | `9cfb3639dd7dee51520aebf2f180ce41ae752229b76716774468f6a9598461a1` |
| `logging-monitoring` | `5e8406b3c814db3d1e100a1c817a9fce388afd40f4f3caa8230cd8f69e44f0f4` |
| `markitdown` | `663ee4c4f9d5c707ff96208d1723d9817639fca7c00b346e43be2cb557610f6a` |
| `monorepo-workspace` | `766a958aae4898bd938e493be8597b6d8b9ee38914ed95ab87ed867422e38233` |
| `nda-triage` | `01e4becd20b129780d82d2889099f07a8fe4ee241b31f909d1084af427f4323d` |
| `operational-readiness` | `da1b223e882ce0a02637befb436d97df4264f96003ce1c55425c75ec62535322` |
| `pdf-tools` | `3f7814305369b9e2b5d367fa0253caf2448aa93435989e2dfa9f2149241e90bc` |
| `persona-improvement` | `510402b135807db3ead05e2e6ab3c315d86caeb55b7bf45b4919d2ba69e56804` |
| `prediction-pool-optimizer` | `5eab312a114476b7fc8dc1ef3846b40d759c0db580c75e14b7abbdc541bc2b7f` |
| `prompt-engineering-image` | `d00e1aeb325be93ad2b510e3438f54368b9130eb0688f177dd5c68e473f87237` |
| `prompt-engineering-patterns` | `4c7db08fbc25fdca01a72f2175785d5b8e0d805c1479a7b18bd972968e6d4240` |
| `prompt-validator` | `daeecf1063775e3c4671de74f3b292fe30fb6d3e4ce8e1c490c2935ef5e5af07` |
| `reasoning-orchestrator` | `a968ef1f04693b46eb3838b43eb83b092429149069599c3aef2c2e4628701b85` |
| `refine-ticket` | `bab09021f8664cd0676e9613bd511a3f87d115583ea5f4639fb4800df9715328` |
| `screenshot-hygiene` | `2493ae6cee8869c659e34610c7ec6a7d7a6f5c76098136c98fa35c90484adb2c` |
| `security-audit` | `27ccbdcd02b8cf7fbd6b85da1043c680233a6ed840697eac6ef9dace37cb0993` |
| `security-maturity-assessment` | `071894293d4c9a1997843d9bfc78f69b2fc64c0e5306544756cb6853bfd31b30` |
| `server-hardening` | `8301bedcbcd9129f8c55d3640e66164baec4753e92a55a8b56df54449e3f3f46` |
| `skill-writing` | `d2beba3976f5918450cc4fa5c96f7fdae488ef5ffebe1f3b05fe3519acbb8a26` |
| `spreadsheet-authoring` | `959466aba0e7f34aae0d8eb69ee427d94049627d905410b322045ac6be0a1599` |
| `storybook-workshop` | `3aff4c3fddd06e0e265ca4afbb02cdbce16b000dd2d3fd6405504d015a1efd27` |
| `supply-chain-intake` | `e61b2fcb6409cf0817ea8527a1fda3b1cdabb35e28264146a0d449991e9fe87c` |
| `test-case-discovery` | `ab3208cc89e8c4c18c4ad4886e6a8893a184d801c57699f6037dbf2bc9d46ef3` |
| `typography-system` | `ab3dbde9a42077d682115a1707d6fa4686e5d3155eef0998f1e240b0b86bb73a` |
| `ui-apply-generic` | `e3f02e3ba53fb96def30fca6752f400d15b6b63209072928bff9e239aaac7ec5` |
| `verify-repair-loop` | `0e66da5e7daac823b400f9493cc2865f9521a40dc7a01bf74ed81702680cb47b` |
| `wireframe` | `a8d5417a0cdc00557cbc7e55db8184943d971f60d279b4d68eb549cb2ab6a77a` |
| `workspace-link` | `b4733d41b6460c62cfb91bbbdaf6e764124d115035ee6d780f782ca4e3aae675` |

## What this freeze does NOT establish

- **It does not seal anything mechanically.** No code reads this file today.
  Nothing prevents a future proposer from opening a holdout corpus; what exists
  is a recomputable partition and a hash that makes a violation *detectable
  afterwards*. The enforcing check belongs with the proposer, in Phase 5, and
  saying so is cheaper than implying a gate that is not here.
- **It does not make the corpus adequate.** 100 of 287 routable skills
  carry a corpus at all; the holdout is 18 % of a third of the population. A
  paired verdict over it will be underpowered for most questions, and
  `paired_verdict` refuses to call `underpowered` a pass.
- **It freezes the files that exist, not the ones that will.** A corpus authored
  in wave 2 is outside this frozen set. Whether it joins the holdout, joins the
  train set, or forms a second frozen generation is a Phase 5 decision; the
  honest default is that this generation's hash stops describing the corpus the
  moment a file is added, which the set hash makes visible rather than silent.
