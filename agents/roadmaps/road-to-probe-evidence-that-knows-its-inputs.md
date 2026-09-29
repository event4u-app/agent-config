---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "active_roadmaps 2 to 24 (+22, all 22 offset-exempt) — measured by check_estate_count on this diff, not predicted. This claim authorises the whole inbox-2026-09-ab round; the per-file justification follows. Verified 2026-09-29 at HEAD: `grep -c 'sha256\|createHash\|digest'` over `src/scripts/ui_conformance_probe.ts` returns 0, so `ui-conformance.json` records `generated_at` and nothing about what it looked at, and `conformanceVerdict` in `src/scripts/hooks/design_pass_hook.ts` prints a findings count with no freshness comparison — while the same file applies an mtime freshness rule to the audit artefact and states in its own comment that a stale artefact is worse than a missing one. The asymmetry is inside one file and nothing else in the tree reads it."
estate_offset_exempt: >-
  This work was scoped as a defect fix inside `road-to-behaviour-evidence-over-pixels`, which
  archived before it landed, so the intended host no longer exists and there is nothing to retire
  in its place. Merging it into the sibling ledger roadmap in this same source set would couple a
  probe-artefact schema change to three unrelated `apply.ts` fixes with a different shadow/flip
  schedule; parking it reproduces exactly the state that let it fall out of the archived host.
relates:
  - slug: road-to-behaviour-evidence-over-pixels
    relation: extends
  - slug: road-to-a-ledger-that-closes-the-loop
    relation: disjoint
---
# Road to probe evidence that knows its inputs

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t10/` — an external completion-discipline
> analysis delivered as a transcript plus two successive plan revisions. The source named this
> its smallest immediately shippable change and routed it into a roadmap that has since archived;
> that routing is `corrected-from-reproduction` here.

## Goal

`ui-conformance.json` records when it was generated and nothing about what it read, so a probe
run before the last UI edit is indistinguishable from one run after it. After this roadmap the
artefact carries a digest of each input it saw, the hook's reader recomputes those digests without
starting a browser and reports `stale` when they moved, and an absent artefact on a turn that
actually ported a provided handover stops reading as unremarkable.

## Non-goals

- No blocking. The design-pass reader stays advisory; its block branch is untouched.
- No new artefact, schema file, hook or command verb — the digests are fields on the JSON the
  probe already writes, and the reader is the function that already parses it.
- No browser work in the reader. Deciding `stale` is a file-hash comparison.

## Reproduction of this roadmap's own claims

Run before any implementation, because a roadmap's premises are claims like any other.

**Reproduced.** The `estate_growth_exempt` block's verification claim holds at the branch point:

```
$ grep -cE 'sha256|createHash|digest' src/scripts/ui_conformance_probe.ts
0
```

`ui-conformance.json` recorded `generated_at` and nothing about its inputs, and `conformanceVerdict`
printed a findings count with no freshness comparison while the same file applied an mtime rule to
the audit artefact. The asymmetry the roadmap describes was real and is what this work closes.

**Did NOT reproduce — two internal contradictions, both resolved in favour of the decision record.**

1. **Risk 3's mitigation is false under the only implementation that satisfies step 1.1's own
   verify line.** Risk 3 states "the digests are taken over input files the probe already opens, so
   no additional read is introduced". The probe opens none of these files from Node — it hands a
   `file://` URL to Chromium, which opens `styles.css` itself. And 1.1's verify line requires
   *"changing one byte of the target CSS changes the target digest"*, which a digest of `index.html`
   alone cannot deliver, because the CSS is a sibling file. So the target and reference records are
   **tree** digests over the surface directory, and they **do** introduce reads the probe did not
   previously make. Carrying Risk 3's number forward was therefore not possible; a measurement
   replaces it.

   > **Measurement unit, published before the number.** One unit = one wall-clock millisecond of
   > `collectInputs(target, reference)` over the committed `ui-conformance` fixture — two surface
   > directories, three files each — median of 200 consecutive calls in one warm Node process on a
   > darwin/arm64 host, `performance.now()` deltas, no page-cache clearing. Not a benchmark: an
   > order-of-magnitude reading, and it says nothing about a cold cache, a network filesystem, or a
   > surface directory larger than the fixture.

   ```
   collectInputs (probe write path): median 0.116 ms · p95 0.154 ms · n=200
   compareInputs (hook read path):   median 0.148 ms · p95 0.369 ms · n=200
   files folded into the target tree digest: 3
   files folded into the reference tree digest: 3
   ```

   Against a probe run that launches Chromium and reloads the page dozens of times per node, the
   added read is not measurable at this scale. The bound is explicit rather than assumed:
   `MAX_TREE_FILES = 2000`, past which the record reads `absent` with a reason instead of producing
   a digest over an arbitrary subset.

2. **Step 2.1's verify line contradicts decision D1.** 2.1 says *"touching the target after a probe
   run makes the line read stale"*. D1 chose content digests over mtime precisely so that a
   `touch` — which moves an mtime and no byte — does **not** report movement. Implemented per D1,
   which is the reasoned half; the verify line's "touching" is read as "editing". Both directions
   are asserted, so the distinction is pinned rather than left to a reader: an edit reports stale,
   an `fs.utimesSync` with identical bytes does not.

## Phase 1 — The artefact records what it read

- [x] **1.1 Add an `inputs` object to `ui-conformance.json`** carrying a content digest for the
      target, the reference and the declarations file, plus the probe's own version — written
      beside the existing `generated_at` (`src/scripts/ui_conformance_probe.ts:360,379`).
      verify: two runs over unchanged inputs produce identical `inputs` digests; changing one byte
      of the target CSS changes the target digest and nothing else.

      **Evidence.** `src/scripts/_lib/probe_inputs.ts` is the shared vocabulary — one definition
      imported by both the probe that writes the digests and the reader that recomputes them, because
      a producer and a consumer with separate copies of a hash rule agree only until one is edited.
      `ProbeArtefact.inputs` is written in `evaluate` and in `unavailableArtefact`, so a degraded run
      records what it *would* have compared rather than reading to the hook as a version skew.

      ```
      $ npx vitest run tests/scripts/probe_inputs.test.ts
      ✓ 1.1 > two collections over unchanged inputs produce identical digests
      ✓ 1.1 > changing one byte of the target CSS moves the target digest and nothing else
      ✓ 1.1 > the target digest covers the whole surface, not just its entry file
      ✓ 1.1 > a touch that changes no byte does NOT move a digest — decision D1
      ✓ 1.1 > the declarations path has ONE definition, shared with the probe
      Tests  16 passed (16)

      $ npx vitest run tests/scripts/ui_conformance_probe.test.ts
      ✓ the artefact knows what it read — Phase 1 > every artefact carries an inputs block with all three keys
      ✓ the artefact knows what it read — Phase 1 > two evaluations over unchanged inputs agree on every digest
      ✓ the artefact knows what it read — Phase 1 > the degraded artefact records its inputs too, rather than omitting them
      ✓ the artefact knows what it read — Phase 1 > the reader can compare the block the probe just wrote
      Tests  16 passed (16)
      ```

      **Shown red first.** The suite failed to collect at all before
      `src/scripts/_lib/probe_inputs.ts` existed:
      `Error: Failed to load url ../../src/scripts/_lib/probe_inputs.js … Does the file exist?`

      **Sensitivity.** Two probes, each restored from a `/tmp` copy rather than by `git checkout`.
      Replacing the tree digest with the constant `"sha256:CONSTANT"` failed 8 tests, exactly the
      digest-dependent ones across both suites. Deleting `inputs:` from `evaluate` failed the two
      artefact-level tests. The second probe also **found a weak assertion**: "two evaluations …
      agree on every digest" stayed green with the block deleted, because `undefined` equals
      `undefined`. A presence assertion was added ahead of the equality, and it is the reason the
      probe was worth running.

- [x] **1.2 An input the probe could not read is recorded as absent, never omitted.**
      verify: a run with the declarations file missing writes an explicit absent marker for it and
      the run still completes; a silently missing key fails the test.

      **Evidence.** An unreadable input produces `{ path, kind, state: 'absent', digest: null,
      reason }` — the key is always present, and the reason says which failure it was. Presence is
      asserted per key rather than by a whole-shape match, so a silently dropped key fails.

      ```
      $ npx vitest run tests/scripts/probe_inputs.test.ts
      ✓ 1.2 > a missing declarations file is recorded with an explicit absent marker
      ✓ 1.2 > a reference that was never supplied is absent with a reason, not null
      ✓ 1.2 > a target directory that does not exist is absent, and collection still completes
      ```

      The third case is the "run still completes" half: a target directory that does not exist
      returns a record, never an exception.

## Phase 2 — The reader says `stale`, and says nothing else

- [x] **2.1 `conformanceVerdict` recomputes the digests and compares them**
      (`src/scripts/hooks/design_pass_hook.ts`). On a mismatch the line reads that the inputs
      changed since the probe ran, and the findings count is not printed — a count against inputs
      that moved is the misleading half.
      verify: touching the target after a probe run makes the line read stale; the pre-change
      behaviour (a findings line) is asserted absent in the same test.

      **Evidence.** The comparison runs *before* anything is counted, so the withholding is
      structural rather than a later suppression. A recorded path is resolved against the reading
      root (`path.isAbsolute(p) ? p : path.join(root, p)`), mirroring `auditIsFresh`.

      ```
      $ npx vitest run tests/hooks/design_pass.test.ts
      ✓ the reader says stale … > unmoved inputs read as unchanged, and the findings count is still reported
      ✓ the reader says stale … > 2.1 — an edited target makes the line read stale, and withholds the count
      ✓ the reader says stale … > a touch that changes no byte does not report stale — decision D1
      ✓ the reader says stale … > resolves a recorded relative path against the root it is reading
      Tests  51 passed (51)
      ```

      The "withholds the count" half is asserted as an **absence**
      (`expect(v.line).not.toMatch(/behavioural finding/)`), which is what the step asks for: the
      pre-change behaviour gone, not merely accompanied by a warning. See the reproduction section
      above for why "touching" is read as "editing" — D1 requires a bare `touch` to stay silent, and
      that direction is pinned by its own test.

- [x] **2.2 An artefact written before the digests existed reads as unknown, not stale and not
      fresh.** Absence of `inputs` is a version skew, not evidence of movement.
      verify: a fixture artefact with no `inputs` key produces the unknown line and no false stale.

      **Evidence.** `compareInputs` returns `unknown` for a missing block, an unrecognised schema, a
      probe build this reader does not know, and a malformed record — four skew shapes, none of them
      guessed at.

      ```
      ✓ the reader says stale … > 2.2 — an artefact predating the inputs field reads unknown, not stale and not fresh
      ✓ 2.x > no inputs block at all is unknown — never stale, never fresh
      ✓ 2.x > a schema this reader does not know is unknown, not a guess
      ✓ 2.x > an artefact from a different probe build is unknown — the version is load-bearing
      ✓ 2.x > a malformed record is unknown rather than an exception
      ```

      Both negatives are asserted in the 2.2 test — `not.toMatch(/stale/)` and
      `not.toMatch(/inputs: unchanged/)` — so "neither stale nor fresh" is measured in both
      directions, which is Risk 1's mitigation. The probe-build check is what makes the roadmap's
      "plus the probe's own version" load-bearing rather than decorative metadata.

- [x] **2.3 No browser is started to decide any of this.**
      verify: the reader's module imports are asserted to contain no browser runtime; the stale
      decision runs with no browser binaries installed.

      **Evidence.** Both halves, and the positive one is the stronger.

      ```
      ✓ the reader says stale … > 2.3 — no browser runtime is reachable from the reader
      ✓ the reader says stale … > 2.3 — the stale decision runs with no browser binaries installed
      ```

      The first parses the `import … from '…'` specifiers of `design_pass_hook.ts` **and** of
      `_lib/probe_inputs.ts` — the module it delegates hashing to — and asserts none matches
      `playwright|puppeteer|chromium|webdriver`. Asserting only the hook would leave the real hazard
      one import away. The second is not "no import exists" but "the verdict is reached": the test
      process installs no browser binaries, so producing a `stale` line **is** the evidence.
      `probe_inputs.ts` imports `node:crypto`, `node:fs` and `node:path` and nothing else.

## Phase 3 — Absent becomes noteworthy, but only where it should be

- [x] **3.1 A missing artefact sets `noteworthy` when a provided handover was detected this turn**
      and otherwise stays as it is today. The existing handover routing trigger decides; no new
      matcher.
      verify: a clean UI write with no handover produces no new line; a turn touching a handover
      with no probe run produces exactly one.

      **Evidence.** No new matcher: `handoverTouched` calls `trigger_matches` from
      `_lib/router_match.ts` — the module whose own header calls a second implementation of these
      semantics a violation — over the file-based half of `design-fidelity.md`'s `triggers:` set.

      ```
      ✓ the ui-conformance shadow mount > an absent artefact becomes noteworthy when a handover was touched this turn
      ✓ 3.1 — the handover trigger decides … > matches the handover filenames the design-fidelity rule declares
      ✓ 3.1 — the handover trigger decides … > the trigger set is the rule's own, not a second copy that may drift
      ```

      Both halves of the verify line: `noteworthy` is `false` with no handover and `true` with one,
      and "exactly one" is asserted literally — `expect(loud.line.split('\n')).toHaveLength(1)`.

      **The trigger list is a constant, and the drift that invites is closed by a test.** Parsing the
      rule's frontmatter at hook time would put a YAML load on `post_tool_use`, the hottest slot this
      concern binds, on a rule path that differs between this repository and an installed consumer.
      So the list is copied and pinned by an equality assertion **in both directions**: a trigger
      added to the rule and not here is a handover the carrier goes silent on; one added here and
      not there is a matcher this package does not ship. Dropping `*.dc.html` from the constant
      failed both tests above.

      **Honest reach, stated rather than implied.** Only the two HTML patterns are reachable through
      this carrier. `.claude/design-system/` names JSON and token files, which `isUiSurface` does not
      admit, so `main` returns before the verdict is computed. Widening `isUiSurface` would change
      the UI-turn denominator the consultation-rate measurement is defined against — a different
      decision from this one. The prefix stays for parity with the rule and is documented as
      unreachable rather than quietly dropped.

- [x] **3.2 The line stays advisory.**
      verify: the hook's block branch is unchanged in the diff, asserted by the test that already
      pins the advisory path.

      **Evidence.** `decide()` is untouched by this diff — the change adds no argument to it and no
      call from it. The pre-existing pin still passes, and a new test pairs a stale verdict with a P0
      stop verdict to show the two do not interact.

      ```
      ✓ the ui-conformance shadow mount > appends the verdict to the render without reaching any decision
      ✓ the reader says stale … > 3.2 — a stale verdict changes nothing the pass decides
      ```

      The sharper assertion is `expect(decide.length).toBe(5)`: the block path cannot consult the
      conformance verdict because no parameter carries it, which is stronger than asserting that it
      does not. `main` still returns `EXIT_WARN`, never `EXIT_BLOCK`.

## Acceptance criteria

- [x] AC-1 A probe artefact older than any of its inputs reads `stale`, and the reader reaches that
  verdict without a browser. — 2.1 and 2.3. "Older" is by content, not by clock: D1's choice means a
  file whose bytes are unchanged is not stale however its mtime moved.
- [x] AC-2 An artefact predating the `inputs` field reads unknown, never stale and never fresh. —
  2.2, with both negatives asserted.
- [x] AC-3 A clean UI write with no handover produces no new advisory line. — 3.1; `noteworthy`
  stays `false` on an absent artefact with no handover, which is the pre-change behaviour.
- [x] AC-4 The design-pass reader still blocks nothing. — 3.2; `decide()` takes no conformance
  argument and `main` returns `EXIT_WARN`.

## Risk Register

<!-- risk-review: v2 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | Every existing artefact reads stale on the first run after the change | implementation | An artefact written before the `inputs` field exists has no digests to compare, and treating absence as a mismatch would report stale for every pre-existing run | 2.2 makes a missing `inputs` key read unknown rather than stale | Phase 2 |
| 2 | The new advisory line becomes noise and the reader is switched off | product | The design-pass concern already names carrier abandonment as its own risk; an absent-artefact line on every UI turn is the cheapest way to earn it | 3.1 scopes absent-is-noteworthy to turns where a provided handover was actually detected | Phase 3 |
| 3 | Digesting inputs makes the probe measurably slower on a large reference | implementation | Hashing target, reference and declarations adds work to every probe run, including runs nobody will read | **v1's mitigation was false and is retracted** — the probe opens none of these files from Node, so a tree digest DOES add reads (see § Reproduction). Replaced by a measurement: 0.116 ms median to collect, 0.148 ms to compare, over a 3-file surface, against a run that launches Chromium. Bounded by `MAX_TREE_FILES = 2000`, past which the record reads absent with a reason rather than digesting a subset | Phase 1 |
| 4 | `stale` is reported for a formatting-only change to the target | product | A digest moves on whitespace, so a reformat reports stale although no observed property changed, and a reader who learns to ignore it learns to ignore real movement | Accepted and stated: the line reports that inputs moved, never that evidence is wrong, and re-running the probe is cheap | Phase 2 |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Content digests over mtime, rather than reusing the mtime rule the same file already applies to the audit artefact | mtime moves on a checkout or a touch, so it would report stale on turns where nothing changed — a digest answers the question actually being asked | A digest proves measurably slower than mtime on a real reference |
| D2 | reversible-technical | evidence | Report stale instead of blocking, rather than making a stale artefact refuse the turn | The reader is advisory by design and this roadmap adds no refusal surface; a refusal would be a new authority, not a fix | The advisory line is measured as ignored across real turns |
| D3 | reversible-technical | evidence | The target and reference records are TREE digests over the surface directory, not file digests over the entry document | Step 1.1's own verify line requires a CSS edit to move the target digest, and the CSS is a sibling of `index.html` — a file digest cannot satisfy it. Measured cost 0.116 ms over the fixture; see § Reproduction | A real surface directory is measured slow enough to matter, or the probe grows a manifest of exactly the files the browser fetched, which would be a more precise input set than the directory |
| D4 | reversible-technical | evidence | The handover trigger list is a constant in the hook, pinned to `design-fidelity.md` by a two-directional equality test, rather than read from the rule at hook time | A YAML load on `post_tool_use` is the wrong cost, and the rule's path differs between this repository and a consumer install. The drift a constant invites is exactly what a test can close | The rule's trigger set starts changing often enough that the pin becomes the thing being edited |
