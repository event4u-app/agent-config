<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-16, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Fold two pairs of roadmaps, or keep them apart?

You are deciding two independent questions about plan files in a repository
that ships rules, skills and hooks for AI coding agents. Plans are Markdown
roadmaps under `agents/roadmaps/`; an active file costs one slot in a ratchet
that counts active roadmaps. A fold moves every open step of the source into
the target, archives the source with a pointer, and must keep the total number
of open checkboxes across both files equal before and after. Answer each pair
separately on the evidence below: fold, or keep apart. For each, give the
strongest argument against your answer. Do not summarise the evidence back.

A third pair proposed on 2026-10-14 is moot: its source
(`road-to-what-was-built-and-never-ran`) was closed and archived by PR #2352.

## Pair 1 — `road-to-an-installed-layer-that-is-thinned` into `road-to-a-setup-that-decides-itself`

Source, 12 open of 20 steps, 2 open blockers. Goal: the rule layer a Claude
install writes under `~/.claude/rules` is the thinned one, first as an opt-in
and then as the default, with one setting to roll back; the default changes
only after the owner decides it on arrival records.

Target, 29 open of 29 steps, 1 blocker (resolved by the owner on 2026-10-15).
Goal: a consumer never sets, reads or reasons about how the package loads its
rule layer; per host and machine the package computes full or thinned from
evidence, and computes full whenever evidence is missing; the lean projection
keys are removed.

Facts:
- The source's own note (2026-10-12) says its criterion 3.5 is now gated on the
  target's step 5.3 and "not on any work left in this roadmap", because 3.1 was
  re-cut that day and the flip it names now happens in the target.
- The target's own exemption, written 2026-10-12, rejected the fold the other
  way: folding six phases into the source "would turn a three-phase opt-in file
  into the largest active roadmap and bury its own owner answer", and it states
  that the source's opt-in phases "stay valid; this file replaces only its 3.1
  form".
- The owner's 2026-10-15 answer on the target makes the target's steps 1.1–2.2
  absorb a stub step and resolves the source's blocker
  `arrival-record-needs-a-cancelled-observer` in the same change.
- The source's other open blocker, `default-flip-of-the-installed-layer`, was
  answered (a) by the owner on 2026-10-06 and waits on that arrival record.
- The source carries an owner directive the target reverses in form: the source
  keeps a rollback setting, the target removes the settings.
- A separate agent session is executing the target today.

## Pair 2 — `road-to-svg-witness-provenance` into `road-to-type-with-a-witness`

Source, 6 open of 9 steps, no blockers. Goal: the blocking SVG turn-end
obligation is discharged only by a render the hook itself saw succeed; no
command pattern list stands in; a declared `img` / `css-bg` delivery mode
downgrades a safety finding only when the project delivers the file that way;
a namespace prefix is resolved by its in-scope binding. It exists for three
release-review findings the owner shipped as accepted risk with this file as
the durable answer.

Target, 38 open of 47 steps, 1 blocker. Goal: one value per typography
question, a witness that reports which face actually painted text, original
font construction with outline, metric, coverage and fidelity gates, no font
binary and no Python.

Facts:
- The target's `relates:` row calls the source `disjoint`: "It hardens the SVG
  turn-end obligation and the declared delivery mode; Phase 1 here touches only
  the font sentinel inside the asset profile and adds no obligation, so neither
  waits on the other."
- The target's exemption rejected the fold explicitly: merging into the source
  "would bind a typography programme to a three-finding security follow-up".
- Both use the same asset render witness (`ui:render --profile asset`).

## The question

For each pair: fold, or keep apart — and if fold, what in the source must be
carried so that nothing is buried (open steps, blockers, owner answers,
release-finding dispositions)?
