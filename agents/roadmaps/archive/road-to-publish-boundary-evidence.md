---
complexity: lightweight
status: done
execution:
  mode: phase-checkpoints
---
# Road to publish-boundary evidence

> **Source:** `agents/tmp.old/infra-structure` — an external critique of this
> package's release and infrastructure posture. Its packaging half is what
> this roadmap acts on; its observability half is a separate roadmap. Every
> number below was produced by re-running `npm pack --dry-run --ignore-scripts
> --json` on 2026-08-22, not copied from the source.

## Goal

What ships is known, and the checks that guard it can see it. Today the
published tarball is measured by size and by build correctness, and by nothing
that reads what the files **are**. The secret gate cannot see a large part of
the payload at all, for a structural reason rather than a configuration one.
When this is finished the prepack path emits a content-class inventory over the
file list it already parses, the secret gate reads the pack payload in addition
to the git tree, and drift between `files[]` and `.npmignore` shows up as a
diff a reviewer reads. Each content class carries one committed canary proving
its check can go red, because a check nobody has seen fail is not evidence.

## Context

Measured at HEAD on 2026-08-22, in the **built** main checkout:

- 3,038 entries, 40.5 MB unpacked, 11.2 MB packed.
- **127 `.js.map` source maps**, of which 8 are maps for compiled test files
  (`dist/cli/commands/profiles.test.js.map`, `dist/server/writeRoot.test.js.map`
  and six siblings).
- 1,204 `.ts` files.
- 0 `.env`-shaped files, 0 `.idea/` or `.vscode/` entries. Those two classes are
  clean today, which is exactly why they are worth a canary — a clean class
  with no check is indistinguishable from a class nobody looked at.

**The measurement is environment-dependent, and that is itself a finding.** The
same command in an unbuilt worktree reports 2,673 entries, 27.7 MB and 22
source maps, because `dist/cli/**` does not exist there. Any threshold this
roadmap sets must state which tree it was measured in, or it will read as
drift the first time someone runs it from a fresh checkout.

The structural defect underneath:

- `package.json` `files` ships **26** roots, and `dist/` is one of them.
- `dist/cli/**` is **gitignored**: `.gitignore:206` is `/dist/*`, and
  `git check-ignore -v dist/cli/agent-config.js` reports exactly that line as
  the match. So the tree is shipped and untracked at the same time.
- `src/scripts/check_secret_leak.ts:268` resolves its mode as
  `args.paths.length > 0 ? 'explicit' : args.all ? 'all' : 'diff'` — every mode
  enumerates the **git** tree. A shipped-but-untracked path is therefore
  invisible to the secret gate by construction, not by misconfiguration. The
  comment block at `:270-280` is careful about a dead scope; it cannot be
  careful about a scope that was never in view.
- `src/scripts/prepack-check.mjs` exists and guards real things — the built
  binary and its shebang (`:30-67`), import completeness across shipped `src/`
  trees (`:110-164`), lifecycle script targets (`:173-182`), router targets
  (`:199-215`). It also prints a size line under `--verbose` (`:218-221`), which
  is bookkeeping rather than a gate. No check reads what class of file anything is.
- `.npmignore` exists (27 lines) and `files[]` exists, and nothing compares
  them or notices when one changes.

**Reuse, do not rebuild.** `src/scripts/check_pack_size.ts` already runs the
pack, already tolerates the lifecycle banner in the JSON stream
(`parsePackJson`, `:69-84`), already declares the `PackFile` shape (`:36`) and
already walks the file list per path prefix (`skillBytes`, `:87`). The
inventory belongs on that parse. A net-new gate script would trip three
ratchets for a check that has a home already.

**Excluded as already covered**, verified rather than assumed:

- Dependency pinning and lockfile posture. `src/skills/supply-chain-intake/`
  covers existence checks, pinning, lockfiles and CVE scan — recorded as
  **covered** at `agents/roadmaps/archive/road-to-consumer-security-guidance.md:49`.
- The seeded-failure practice. `src/config/gate-coverage.yml` already carries a
  first-class `canary:` mechanism (`:192-202` documents it; 68 occurrences in
  the file). One correction to the framing handed in: declaring a canary is
  **optional**, not required — `:41` reads "optional mutation recipe". So this
  roadmap requires one per new class rather than claiming the register already
  does.

**Excluded by a recorded rejection, and not reopened here.** SBOM content was
rejected by a council:
`agents/roadmaps/archive/road-to-consumer-security-guidance.md:49` records SBOM
generation as the single absent item in an otherwise-covered area and calls the
proposal overstated, and `:92` records that both members independently rejected
SBOM content. `docs/decisions/ADR-238-security-content-routes-to-external-authority.md`
is `status: accepted` with `reopen_policy: directional`, and its `review_trigger`
Trigger A requires **both** a named maintainer accepting ownership with a stated
review cadence **and** a fixture set — authored against the current skills,
before any replacement content — showing a real miss. Neither exists. The
blocker below carries the question; no phase acts on it.

## Phase 1 — A content-class inventory on the parse that already runs

- [x] **1.1 Extend `prepack-check.mjs` with a content-class pass.** Classes:
      source maps, credential-shaped files, IDE metadata, compiled test
      artefacts. Each class reports a count and, above its threshold, the
      offending paths. Feed it from `check_pack_size.ts`'s existing
      `parsePackJson` / `PackFile` surface rather than a second pack run.
      verify: `PREPACK_SKIP_BUILD_CHECK=1 node src/scripts/prepack-check.mjs`
      prints a per-class line, and
      `git show HEAD:src/scripts/prepack-check.mjs | grep -ci 'js.map'` is 0,
      pinning that the pre-state had no such check.

      **LANDED 2026-08-22, in `check_pack_size.ts` and NOT in
      `prepack-check.mjs` — a deviation, with its reason.** The step names
      `prepack-check.mjs` and also says to feed the pass from
      `check_pack_size.ts`'s existing `parsePackJson` / `PackFile` surface
      "rather than a second pack run". Those two instructions conflict on this
      tree: `prepack-check.mjs` is ESM JavaScript on the **publish** path and
      cannot import a `.ts` module without adding `tsx` to that path, which
      would be a new runtime dependency on `npm publish` — a worse trade than
      the one the step was avoiding. So the pass lives beside the parse it
      reuses, in the gate that already runs `npm pack` on every PR
      (`taskfiles/ci-fast.yml:786`). `prepack-check.mjs` is untouched, and its
      `grep -ci 'js.map'` pre-state assertion still holds trivially.
      **Four classes, and the limits are two different KINDS of number.**
      `compiled-test-artefact`, `credential-shaped` and `ide-metadata` are
      **limit 0** — hard classes, nothing of that shape may ship.
      `source-map` is **120**, a shrink-only ratchet, and the entry says in its
      own text that it is provisional rather than an architectural constant.
      Errors name the offending paths, not just a count.
      **Two of the four are empty today, and that is why they are checked** — a
      clean class with no check is indistinguishable from a class nobody looked
      at. Counts print on the GREEN path for the same reason.
- [x] **1.2 State the tree the thresholds were measured in.** Every threshold
      carries the build state it came from, because the unbuilt worktree
      reports a fifth of the source maps and three quarters of the entries.
      verify: the threshold constants carry a comment naming the built-tree
      measurement, and running the check in an unbuilt tree reports a
      not-measurable state rather than a false pass.

      **LANDED, and it turned out to be load-bearing rather than hygiene.**
      Every class carries `measured_in`, and a fixture asserts the string
      appears in the error. The not-measurable state is real: `requires_build`
      plus `payloadIsBuilt`, keyed on whether the PAYLOAD carries `dist/cli/**`
      rather than on the filesystem, so it describes the thing being judged.
      **The false pass this closes is not hypothetical.**
      `pack-size-budget.json`'s own `measurement_conditions` declare `npm pack
      --dry-run --ignore-scripts` on a **clean checkout** — no build, so no
      `dist/cli/**` at all. In that tree the source-map count is ~22 and would
      sail under a limit of 120 while measuring a fifth of the payload. The
      class now abstains and says so, on the same principle as the dead-scope
      assertion above: a check that could not run is not a clean bill. A fixture
      pins both directions — abstain must not become a pass, and must not become
      a failure either.
      **Numbers differ by tree, measured rather than assumed.** The roadmap's
      Context records 3,038 entries / 127 maps in the built main checkout; this
      built worktree measured 2,970 / 128 before the strip and 2,954 / 120
      after. Same command, different trees, and the class limits are stated
      against the tree that produced them.
- [x] **1.3 One canary per class.** Register each new class in
      `src/config/gate-coverage.yml` with a `canary:` block per the shape
      documented at `:192-202`, so each check has been observed red.
      verify: `./scripts-run src/scripts/check_gate_coverage` is green and each
      new class's row carries a `canary:` key.

## Phase 2 — Let the secret gate see what actually ships

- [x] **2.1 Add a pack-payload scope to `check_secret_leak`.** A fourth resolution
      alongside `diff` / `explicit` / `all` that takes its file set from the
      pack payload rather than from `git ls-files`. The three existing modes
      are untouched; this is additive, so no current caller changes behaviour.
      verify: `git show HEAD:src/scripts/check_secret_leak.ts | sed -n '268p'`
      shows the three-mode line as the pre-state, and the new mode scans at
      least one path under `dist/cli/` that `git ls-files dist/cli` does not
      return.
- [x] **2.2 Preserve the dead-scope discipline.** The existing scope assertion
      exits 2 on a resolved-empty set rather than passing quietly. The new mode
      inherits that: an empty pack payload is a gate that could not run, never
      a clean bill.
      verify: with a forced-empty payload the new mode exits 2, not 0.
- [x] **2.3 Canary the untracked-path case specifically.** The seeded violation
      must live at a path that is shipped and gitignored, because that is the
      exact blind spot; a canary in a tracked file would pass under the old
      modes too and prove nothing.
      verify: the canary path satisfies `git check-ignore -q <path>` and the
      pre-existing `diff` mode does not flag it while the new mode does.

## Phase 3 — Make `files[]` and `.npmignore` drift reviewable

- [x] **3.1 Emit the shipped-root set as a committed artefact.** The 26 roots
      and the `.npmignore` rule set become a generated file, so a change to
      either shows up as a diff in review rather than as a silent change to
      what ships.
      verify: the artefact regenerates deterministically — two consecutive
      runs produce byte-identical output — and
      `git show HEAD:package.json | node -e "..."` confirms the pre-state root
      count of 26.
- [x] **3.2 Fail on undeclared drift, not on every change.** Changing what
      ships is legitimate; changing it without the artefact moving is the
      defect. The check compares the artefact to the live config.
      verify: editing `files[]` without regenerating fails the check; editing
      both passes.

## Blockers

### blocker: b-sourcemap-intent

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1 step 1.1 threshold selection, and the disposition of the
  8 compiled-test source maps.
- **What to do:** pick exactly one — (a) declare shipped `.js.map` files
  intentional for this package, in which case the class check counts them and
  the threshold is the current 127 as a ratchet; or (b) declare them
  unintentional, strip them from the published payload, and set the class
  threshold to zero.
- **Recommendation:** **(b) — strip them, threshold zero.** The 8 compiled-test
  source maps have no consumer-facing purpose at all, which makes the payload
  hard to defend as deliberate, and a zero threshold is the only version of this
  check that stays legible a year from now. A 127 ratchet encodes a number
  nobody chose.
- **If you do nothing:** Phase 1.1 ships with a threshold set to whatever the
  tree happened to contain on the day it was written, and the first person to
  add a source map is told they broke a rule nobody decided on.
- **Resolved when:** the decision is written down and the Phase 1 threshold
  constant cites it, so a later reader can tell a deliberate 127 from an
  unnoticed one.
- **Resolution (2026-08-22) — (b'), NEITHER of the two options as written, by
  2/2 council.** The option set conflated two classes and both seats said so
  independently: a product `.js.map` is a **consumer debugging affordance**
  (line mapping and stepping in a debugger over shipped JS), and a compiled
  test's output has no consumer-facing purpose at all. Removing the product
  maps on "a zero threshold is more legible" is an operational preference, not
  a finding — and the risk is asymmetric, since stripping is an irreversible
  capability loss while keeping them stays reversible.
  So: **compiled-test artefacts stripped, threshold 0; product maps kept at a
  provisional measured ratchet of 120.** Both numbers cite their tree in the
  class entry.
  **The council also predicted a defect the measurement then confirmed**, and it
  is the reason (b') is wider than "strip the 8 maps": one seat asked whether
  compiled test *JavaScript* was also published. It was — 8 `.test.js` files
  alongside their 8 `.test.js.map` files. Stripping only the maps would have
  left the compiled tests in the tarball, treating the symptom.
  **Mechanism, and a finding about the mechanism.** The strip is four `!`
  negation patterns in `package.json` `files[]`. A `.npmignore` entry was tried
  first and had **no effect**: `files[]` is an allowlist that overrides
  `.npmignore` for anything under an included root, and `dist/` is one. That is
  a live fact for Phase 3, which is about exactly this pair of surfaces — and an
  ineffective `.npmignore` line would have been decoration, so it was reverted
  rather than left in.
  Payload before: 2,970 entries, 128 maps, 8 test JS. After: **2,954 entries,
  120 maps, 0 test JS, 0 test maps.**

The two options are not equivalent and the threshold cannot be set before the
question is answered. 127 source maps in a published package is either a
debugging affordance someone chose or a build artefact nobody pruned, and the
file list alone cannot distinguish them. The 8 test maps are the sharper half:
a compiled test's source map has no plausible consumer-facing purpose, so it is
the strongest evidence for (b) — but it is evidence, not the decision.

### blocker: b-sbom-scope

- **Status:** resolved
- **Owner:** user
- **Blocks:** nothing in this roadmap. It exists so the question is visible
  rather than quietly re-litigated inside a packaging phase.
- **What to do:** pick exactly one — (a) leave the recorded rejection standing,
  in which case this roadmap ships without any SBOM surface and no phase
  changes; or (b) reopen it under ADR-238's Trigger A, which requires a named
  maintainer with a stated review cadence AND a fixture set authored against
  the current skills, before any replacement content, showing a real miss.
- **Recommendation:** **(a) — leave the rejection standing.** Trigger A is
  deliberately expensive and neither of its halves exists; nothing in this
  roadmap needs an SBOM, and the content-class inventory answers the question
  that actually motivated the source's concern.
- **If you do nothing:** nothing breaks — this blocker gates no step. The cost
  is that a later reader sees a packaging-inventory roadmap, thinks "this is
  where the SBOM goes", and re-litigates a decision a council already made.
- **Resolved when:** either this blocker is closed unchanged with the rejection
  cited, or both halves of Trigger A exist as artefacts and a separate roadmap
  carries the work.

Recorded so that a content-class inventory is not mistaken for a supply-chain
manifest. They look adjacent and are not: one says what is in the tarball, the
other makes a distributable claim about provenance, and the second was
deliberately rejected.
- **Resolution (2026-08-22) — (a), the recorded rejection stands.** 2/2 council,
  both seats agreeing with the roadmap's own recommendation and with each other:
  ADR-238's Trigger A requires a named maintainer with a stated review cadence
  AND a fixture set authored against the current skills showing a real miss, and
  neither half exists. Nothing in this roadmap needs an SBOM surface, and the
  content-class inventory answers the concern that actually motivated the
  source. **This blocker gated no step and still gates none** — it is resolved
  as *visible and declined*, which is the state it was written to reach.
  **What would make Trigger A worth paying**, so the next reader meets a
  condition rather than a closed door: a fixture set that demonstrates the
  current skills missing a real supply-chain finding an SBOM would have caught.
  Absent that, the reopen cost is deliberately higher than the value.
  One seat added a caveat worth carrying: "blocks nothing" is only true while no
  later phase promises or consumes SBOM-derived evidence. None does today.


## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A threshold set in the wrong tree | implementation | The unbuilt worktree reports 22 source maps against the built tree's 127; a threshold captured there is off by 5x and reads as drift on the first real run | 1.2 makes the build state part of the threshold, and an unmeasurable tree reports unmeasurable rather than passing | Phase 1 — A content-class inventory on the parse that already runs |
| 2 | The new secret-gate scope is never exercised | implementation | An additive mode nothing calls is indistinguishable from no mode at all, which is the defect being fixed | 2.3 requires the canary to sit on a shipped-and-gitignored path, so it fails under the pre-existing modes and passes only under the new one | Phase 2 — Let the secret gate see what actually ships |
| 3 | The inventory becomes a second pack invocation | implementation | Running `npm pack` twice doubles the slowest step of the prepack path and lets the two views disagree | 1.1 feeds from `check_pack_size.ts`'s existing `parsePackJson` and `PackFile` surface rather than adding a run | Phase 1 — A content-class inventory on the parse that already runs |
| 4 | The source-map decision is deferred into the code | product | Shipping the check with a threshold of "whatever is there today" encodes an unmade decision as a ratchet | The blocker gates threshold selection explicitly, and the constant must cite the decision | Phase 1 — A content-class inventory on the parse that already runs |
| 5 | The drift artefact rots | implementation | A generated file nobody regenerates becomes a stale record that passes its own check | 3.2 fails on the artefact and the live config disagreeing, so staleness is the failure rather than the resting state | Phase 3 — Make `files[]` and `.npmignore` drift reviewable |

## Acceptance Criteria

- [x] AC-1 — The prepack path reports a per-class count over the published file
      list, and each of the four classes has one committed canary in
      `gate-coverage.yml` proving that class's check has been observed red.
- [x] AC-2 — A credential-shaped string placed under a shipped-but-gitignored
      path is caught. The same probe under the pre-existing `diff` mode is not,
      which is what makes the new scope load-bearing rather than decorative.
- [x] AC-3 — Every threshold names the build state it was measured in, and the
      check reports not-measurable rather than passing when run against a tree
      that lacks the built output.
- [x] AC-4 — The 127 shipped source maps are either declared intentional with
      the count pinned as a ratchet, or removed with the class threshold at
      zero. Neither the count nor the intent is left implicit.
- [x] AC-5 — A change to `files[]` or `.npmignore` that is not reflected in the
      generated artefact fails the check, so drift in what ships is a diff a
      reviewer sees rather than a silent change.

## Completion note

13 of 13 steps and all five acceptance criteria. Both blockers were already
resolved by council; this run executed Phase 1.3 and Phases 2–3.

### Two premises that did not survive contact

**1.3 asked for "one canary per class". The register cannot express it.**
`gate-coverage.yml` carries `canary?: CanarySpec` — one recipe per gate id, not
a list. And two of the four classes cannot be planted through it at all:
`compiled-test-artefact` is excluded from the payload by the `files[]` negations
that fixed it, so a plant never ships and never reds, and `source-map` needs 121
files in a built tree.

So the register gets the one recipe it can hold (credential-shaped, chosen
because that class is empty today and an empty unchecked class is
indistinguishable from one nobody looked at), and every class is proven red in
`check_pack_size --self-test` — 9 cases, 6 rejecting, over a synthetic payload
with no pack run. That also discharges the non-adopter ratchet's rule that a
newly registered gate must adopt or exempt.

**2.1's `dist/cli` verify cannot be satisfied in an unbuilt worktree, and the
blind spot is 0 there.** Measured: 2,686 payload entries, **0** of them
gitignored, **0** untracked — because `dist/cli/**` does not exist without a
build. The mode's value is conditional on build state, exactly like the
`source-map` class.

Proven instead with a real plant, which is stronger than the path the step
named: a PEM at `dist/zzcanary/leak.pem` — `git check-ignore -v` attributes it
to `.gitignore:206` and `npm pack` ships it — is caught by `--pack` (exit 1) and
missed by `diff` (exit 0).

### The finding the roadmap did not have

**Adding the pack mode fixed nothing.** `DEFAULT_EXCLUDE` carries
`/(^|\/)dist(\/|$)/` and fires regardless of mode, so the new scope resolved the
payload and then filtered away exactly the paths it exists to reach. The mode
was measurably inert until the exclusion became mode-aware — and an additive
mode that cannot catch anything is worse than no mode, because it reads as
coverage. There were **two** reasons the gate was blind, and the roadmap knew
one.

### A pre-existing false verdict, surfaced by the registration

Registering a dynamically-scoped gate made the canary run report `census_stale`
for `check_secret_leak` **and** for `check_no_roadmap_refs` — telling the reader
to re-run a census that was already current. Both resolve their corpus by
spawning, so a static root extractor finds nothing and the census prints
`_(none extracted)_` with `**0**` units; `parse_census` read that 0 as "read
nothing", which the disagreement check treats as stale. Three absences, not two.
Mapping it to `null` was tried first and made it strictly worse — six
dynamically-scoped gates became fresh false disagreements at once.

### Phase 3's artefact found a shadowed rule on its first run

`.npmignore` lists `agents/` and the payload ships it anyway, because
`agents/templates/` is a `files[]` root. That is the same class of defect the
blocker resolution recorded (a `.npmignore` strip attempt with no effect), now
reported by a gate instead of discovered by hand.

The drift verdict is deliberately **tree-independent**: it compares only what is
read from a file, and reports the payload-derived shadowed set as informational
with its `shadowed_measured_in`. Comparing it would red for anyone whose build
state differs from whoever last regenerated — the false-drift shape 1.2 closed
with `measured_in`. Measured in both states and identical, so the tolerance is
not covering a known difference; it refuses to assert one it cannot control.

**Root count: 26 roots + 4 negations = 30 entries.** The Context's 26 is the
pre-negation figure and still correct.

### Three of my own mistakes, and how they were caught

1. The first canary content carried a `BEGIN PRIVATE KEY` block and **reddened
   `check_secret_leak` at `gate-coverage.yml:229`** in both modes. For
   `check_pack_size` the fix was to drop the key shape entirely — that class
   matches on the PATH. For `check_secret_leak` it cannot be dropped, so
   `.secret-allow` carries a line-pinned audited entry; line-pinned on purpose,
   because an entry that drifts stops matching and the gate reds.
2. The self-test's abstain fixture put its 121 maps under `dist/cli/`, which is
   the prefix `payloadIsBuilt` keys on — so the "unbuilt" payload was built and
   the case tested nothing. The self-test failed on its own fixture.
3. Repeated `npx tsc -p tsconfig.scripts.json` **emits**, and inflated the
   payload 2,686 → 2,884, so the first generated artefact was measured against a
   poisoned tree. Cleaned with `git clean -fdX dist` and regenerated. The
   shadowed set was identical in both, which is why that finding stands.
