<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for blocker host-sync-layout-at-current-host,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# One roadmap blocker — routing test and choice (round 2, input changed)

## The owner-reserved test

A transition is owner-reserved if the chosen option would: change the project's
purpose or a declared non-negotiable outcome; **lower** or remove a recorded
security / privacy / safety / data-handling floor; be irreversible or materially
destructive; spend or carry liability above a delegated threshold; create, remove
or weaken a legal, contractual, licensing, compatibility or public commitment;
amend governance itself (reopening authority, quorum, escalation, the
owner-reserved set); or **cannot be bounded from the available evidence**.
Strengthening a floor, or anything reversible inside these bounds, is
council-decidable. A roadmap step converted to cancelled, or a criterion weakened
or permanently dropped, is owner-reserved; a step kept open (or carried) is not.

A blocker's `Owner:` label is its author's first impression, not the test.

## Why this is a second round

Round 1 (2026-10-16, anthropic + openai) split. anthropic: DECIDE (b). openai:
ESCALATE (a), on the ground that "what step 5.2 delivers and what happens to 8.5
is absent, so the impact of (b) is unknowable" — the "cannot be bounded" row.
Since then, both facts were written into the roadmap (quoted below). That is the
changed input.

## The blocker — `host-sync-layout-at-current-host` (roadmap `road-to-a-canvas-the-code-owns`)

- **Status:** open — raised 2026-10-12; the host's design-sync bundle layout was
  taken from an extract of an older host version, and an offline read of host
  binary 2.1.296 finds only part of it.
- **Blocks:** steps 3.2, 5.2 and 8.5.
- **Options as written:**
  - (a) a maintainer runs the host's `/design-sync` once on a fixture React
    package with a canvas account and network, and commits the resulting listing
    of `.design-sync/` and the local build output as an observed fixture. No
    agent run may do this (account + network).
  - (b) narrow 3.2 to a user-exported snapshot directory only, and drop 5.2,
    keeping to the names the 2.1.296 binary carries (`.design-sync/config.json`,
    `previews/`, `.render-check.json`).
- **Resolved when:** the observed-fixture directory exists, or 3.2 and 5.2 are
  rewritten per (b) and the 3.2 test exits 0.

A third candidate, not in the original entry, is offered for evaluation on the
same footing:
  - (c) narrow 3.2 to a user-exported snapshot directory only (as in (b)), and
    keep 5.2 **open**, blocked on the observed fixture of (a), instead of
    dropping it. 3.2 can then be built now; 5.2 waits for whenever a maintainer
    runs (a).

## Step text

- **3.2 `claude-design` lane.** Reads a user-exported snapshot directory or the
  local bundle whose layout the blocker pins: tokens and the custom-property
  closure of the stylesheet, component contracts from the `.d.ts` files,
  guidelines into `_meta`. Every `var(--x)` with no definition in the closure is
  listed in `_meta.unresolved_custom_properties`. Offline, provenance mandatory,
  unknown files in `_meta.unmapped`, never dropped.
- **5.2 Conventions block.** `DESIGN.md` usage rules render into the host's
  human-editable conventions file between markers; text outside the markers
  stays byte-identical, and a drift check fails on a divergent block.
- **8.5 One live round trip, human-run.** Already marked deferred. "Needs a
  canvas account and network; never run by an agent." Its state is the same
  under every option.

## Facts written into the roadmap after round 1

- 5.2 delivers the conventions block described above; that is the capability
  (b) drops.
- 8.5 is unaffected: it is already deferred and human-run under either option.
- The three names in (b) come from reading the 2.1.296 binary; the older
  extract the original layout came from is of an obsolete host version.
- Nothing in the roadmap outside 3.2, 5.2 and 8.5 depends on this blocker
  ("Phases 0–2, 4, 6–8 land unchanged").

## Questions — answer in this order

1. **Owner-reserved?** yes / no per option (a), (b), (c), naming the clause.
2. **Choice** — the option the council takes if council-decidable, or the one it
   would recommend to the owner if not.
3. **The fact that would change the answer.**

Open your reply with `DECIDE <option>` or `ESCALATE <recommended option>`.
