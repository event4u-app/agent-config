<!-- evidence-type: analysis -->

# The Node-22 floor, planned as the first `action` release

Step 4.5 of `road-to-an-update-that-installs-itself-only-when-it-is-safe`:
*plan* the Node-22 floor as the first `action` release, and move the Node-20 CI
pins in the same release, so the consent path is exercised on a real case
rather than on a fixture. This is that plan. **Nothing in it has been executed**
— cutting a release is the maintainer's action, and a semver-major that removes
a compatibility commitment is not one an agent takes.

## The decision this implements

`docs/decisions/ADR-290-node-floor-22-as-a-major.md`, option (a), decided by an
AI council 2/2 on 2026-10-18 under the owner's delegation: raise
`engines.node` to `>=22` as a semver-major, move every Node-20 CI site in the
same change, and cut it as the first `action` release, with migration notes
naming the last Node-20-compatible version and stating plainly that it receives
no security, bug or compatibility backports.

Both seats required the `engines.node` change and the CI pins to move
**atomically**. That is the load-bearing constraint on the sequencing below:
there is no intermediate commit in which `engines` says 22 and CI still proves
20, nor the reverse.

## The sites, re-measured at HEAD on 2026-10-20

The roadmap's blocker entry said 45, then corrected itself to 41 in 21 files on
2026-10-16. Re-measured here, because a plan that quotes a count owes a fresh
one:

| Where | Count | How it was counted |
|---|---|---|
| `node-version:` literal `20` in `.github/workflows/` | **45 lines in 26 files** | `grep -rn "node-version: *['\"]\?20" .github/` |
| `node: ['20', '22']` matrix lists | **3 lines in 2 files** (`smoke-public-install.yml`, `consumer-matrix.yml`) | `grep -rn "node: *\[" .github/` |
| `engines.node` in `package.json` | **1** | `>=20.11.0` |

**48 CI sites in 27 files, plus the `engines` field.** The figure rose from the
2026-10-16 reading of 41/21 because workflows have been added since; it is
expected to keep moving, which is why the release step below re-counts rather
than trusting this table.

Not in scope, and named so nobody widens the change by analogy: the
`--target=node20` esbuild flags in `package.json` and
`src/scripts/hook_chunks.mjs`. They name the ECMAScript feature level the
output is lowered to, not a runtime that must exist. Raising them is a separate,
independently reversible change with its own measurement (output size), and
bundling it into a compatibility major would make the major's diff unreadable.

## The release, in order

1. **Re-count.** Re-run the three greps above. The number in this table is a
   reading, not a contract; the release moves whatever is there on the day.
2. **One commit.** `engines.node` to `>=22.0.0`, every `node-version: 20` to
   `22`, every `node: ['20', '22']` to `node: ['22']`. Nothing else in the
   commit — it is the atomicity both council seats required, and a reviewer
   should be able to read the whole diff as one substitution.
3. **The trailer.** That commit carries `Consumer-Impact: action`. It is what
   puts the release into the impact map as an `action` entry, and it is what
   makes `classifyUpdate` refuse to install it unattended — the point of
   choosing this release as the first exercise of the consent path.
4. **The migration note.** `MIGRATION.md` gains a section naming the last
   Node-20-compatible published version by number, and stating that it receives
   no security, bug or compatibility backports (`SECURITY.md:21`). Both seats
   required this text; a note that says "upgrade your Node" without naming what
   staying costs is not the note they asked for.
5. **The curated head.** `Default changes + migration` carries the floor raise;
   `Known limitations` carries the stranded-install consequence.
6. **Cut it as a major.** The release run is the maintainer's, under
   `non-destructive-by-default`.

## What the release will exercise, and what it will not

**It will exercise** the `action` branch end to end on a real release:
`read_impact_range` finds `action` in range, `classifyUpdate` returns `ask`,
`unattended_decision` refuses, and `updateNotice` emits *"A release in range
needs a hand; it is never installed unattended."* That path is covered by
fixtures today; this is the first time real registry data drives it.

**It will not exercise** the `update.mode: ask` prompt, because no prompt ships
until the ring-0 exit (`agents/evidence/analysis/ring-0-unattended-record-2026-10-20.md`,
`ring-0-exit: no`). An install on a Node-20 machine gets the `action` notice and
installs nothing, which is the correct behaviour and is the whole safety claim —
but it is the refusal path being exercised, not the consent path. Saying
otherwise would overstate what one release can prove.

## The open coupling, carried not resolved

ADR-290 records that both seats prefer this major to also carry the settings-key
removals of `road-to-a-setup-that-decides-itself` Phase 4. That coupling is open
**there**, not here: this plan does not schedule those removals, and whoever
cuts the major decides whether to pull them in. If they are pulled in, step 2's
"nothing else in the commit" applies per commit, not per release — the removals
are their own commit in the same cut.

## When this plan is wrong

- The re-count in step 1 differs materially from 48/27 — then the table above
  is stale and the plan's shape, not its numbers, is what survives.
- A consumer-usage reading shows a material share of installs on Node 20
  (ADR-290's own `revisit if`). Nothing in this package measures that: install
  telemetry is inert and the privacy floor forbids consumer telemetry, so the
  revisit condition is one only an external signal can fire.
