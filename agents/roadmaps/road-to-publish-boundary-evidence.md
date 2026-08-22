---
complexity: lightweight
status: ready
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

- [ ] **1.1 Extend `prepack-check.mjs` with a content-class pass.** Classes:
      source maps, credential-shaped files, IDE metadata, compiled test
      artefacts. Each class reports a count and, above its threshold, the
      offending paths. Feed it from `check_pack_size.ts`'s existing
      `parsePackJson` / `PackFile` surface rather than a second pack run.
      verify: `PREPACK_SKIP_BUILD_CHECK=1 node src/scripts/prepack-check.mjs`
      prints a per-class line, and
      `git show HEAD:src/scripts/prepack-check.mjs | grep -ci 'js.map'` is 0,
      pinning that the pre-state had no such check.
- [ ] **1.2 State the tree the thresholds were measured in.** Every threshold
      carries the build state it came from, because the unbuilt worktree
      reports a fifth of the source maps and three quarters of the entries.
      verify: the threshold constants carry a comment naming the built-tree
      measurement, and running the check in an unbuilt tree reports a
      not-measurable state rather than a false pass.
- [ ] **1.3 One canary per class.** Register each new class in
      `src/config/gate-coverage.yml` with a `canary:` block per the shape
      documented at `:192-202`, so each check has been observed red.
      verify: `./scripts-run src/scripts/check_gate_coverage` is green and each
      new class's row carries a `canary:` key.

## Phase 2 — Let the secret gate see what actually ships

- [ ] **2.1 Add a pack-payload scope to `check_secret_leak`.** A fourth resolution
      alongside `diff` / `explicit` / `all` that takes its file set from the
      pack payload rather than from `git ls-files`. The three existing modes
      are untouched; this is additive, so no current caller changes behaviour.
      verify: `git show HEAD:src/scripts/check_secret_leak.ts | sed -n '268p'`
      shows the three-mode line as the pre-state, and the new mode scans at
      least one path under `dist/cli/` that `git ls-files dist/cli` does not
      return.
- [ ] **2.2 Preserve the dead-scope discipline.** The existing scope assertion
      exits 2 on a resolved-empty set rather than passing quietly. The new mode
      inherits that: an empty pack payload is a gate that could not run, never
      a clean bill.
      verify: with a forced-empty payload the new mode exits 2, not 0.
- [ ] **2.3 Canary the untracked-path case specifically.** The seeded violation
      must live at a path that is shipped and gitignored, because that is the
      exact blind spot; a canary in a tracked file would pass under the old
      modes too and prove nothing.
      verify: the canary path satisfies `git check-ignore -q <path>` and the
      pre-existing `diff` mode does not flag it while the new mode does.

## Phase 3 — Make `files[]` and `.npmignore` drift reviewable

- [ ] **3.1 Emit the shipped-root set as a committed artefact.** The 26 roots
      and the `.npmignore` rule set become a generated file, so a change to
      either shows up as a diff in review rather than as a silent change to
      what ships.
      verify: the artefact regenerates deterministically — two consecutive
      runs produce byte-identical output — and
      `git show HEAD:package.json | node -e "..."` confirms the pre-state root
      count of 26.
- [ ] **3.2 Fail on undeclared drift, not on every change.** Changing what
      ships is legitimate; changing it without the artefact moving is the
      defect. The check compares the artefact to the live config.
      verify: editing `files[]` without regenerating fails the check; editing
      both passes.

## Blockers

### blocker: b-sourcemap-intent

- **Status:** open
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

The two options are not equivalent and the threshold cannot be set before the
question is answered. 127 source maps in a published package is either a
debugging affordance someone chose or a build artefact nobody pruned, and the
file list alone cannot distinguish them. The 8 test maps are the sharper half:
a compiled test's source map has no plausible consumer-facing purpose, so it is
the strongest evidence for (b) — but it is evidence, not the decision.

### blocker: b-sbom-scope

- **Status:** open
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

- [ ] AC-1 — The prepack path reports a per-class count over the published file
      list, and each of the four classes has one committed canary in
      `gate-coverage.yml` proving that class's check has been observed red.
- [ ] AC-2 — A credential-shaped string placed under a shipped-but-gitignored
      path is caught. The same probe under the pre-existing `diff` mode is not,
      which is what makes the new scope load-bearing rather than decorative.
- [ ] AC-3 — Every threshold names the build state it was measured in, and the
      check reports not-measurable rather than passing when run against a tree
      that lacks the built output.
- [ ] AC-4 — The 127 shipped source maps are either declared intentional with
      the count pinned as a ratchet, or removed with the class threshold at
      zero. Neither the count nor the intent is left implicit.
- [ ] AC-5 — A change to `files[]` or `.npmignore` that is not reflected in the
      generated artefact fails the check, so drift in what ships is a diff a
      reviewer sees rather than a silent change.
