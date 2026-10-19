<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-19, committed verbatim below this header so the verdict can be checked against what was asked. -->

# Two decisions on one roadmap of a governed agent-instruction package

Repository: a package of skills, rules and slash-command files for AI coding
tools (markdown + TypeScript scripts). A roadmap, `road-to-an-analysis-family-that-deepens-itself`,
builds one analysis engine behind four slash-command "doors". Two of its open
steps need a decision that the roadmap routes to this council. Answer each
question separately, pick exactly one option per question (or name a better one),
and give the reason and what would change your answer.

## Shared background

- `docs/CLAIMS.md` holds a pre-registered claim `reference-loop-upgrade-value`
  (registered 2026-08-12, 180-day window, `status: unbacked`). It says five
  mechanisms folded into the foreign-repository analysis command (anchor table
  before fetch, bound-claim collision gate, interop probe, verdict convergence,
  bounded `--deep` tier) produce findings the pre-upgrade command structurally
  could not. Bar: each of the next two real reference analyses produces >= 1
  interop-probe finding at file:line AND >= 1 bound-claim routing. Falsification
  criterion 1: the comparison is against a shadow run of the pre-upgrade command
  text on the same reference, decided by diffing two documents.
- The observation that would test the claim lives in a parked roadmap
  (`later/road-to-first-reference-analysis-observation`). It has two OPEN blockers:
  (1) `shadow-pin-is-post-upgrade` - the frozen shadow pin points at a
  post-upgrade text; corrected pre-upgrade coordinates (commit `97e293760`, the
  immediate parent of the upgrade commit, 207 lines, zero mechanism markers) are
  derived but not ratified; ratification venue: "a full-strength council or the
  owner"; (2) the outbound fetch of the third-party reference - since 2026-10-15
  the owner's answer says an invocation that names a source authorises the
  read-only fetch of exactly that source for that run.
- The command file today is `src/domains/analysis-workbench/analyze/repo/command.md`
  (name `analyze-repo`, alias `analyze:reference-repo`). It was already renamed
  once on 2026-09-07 (`reference-repo` -> `repo`, commit `8488bf078`), after
  registration; the observation roadmap lists that rename among five known
  deltas between registration and a claim pin recorded 2026-10-17 (commit
  `835660b0d`). The pin's stated purpose: make later drift checkable with
  `git diff 835660b0d..HEAD -- <the file>`. The analysis roadmap keeps its own
  edits outside the five mechanisms' sections from the pin on.
- An accepted ADR (ADR-288 D1, naming decided by a 2-seat council on 2026-10-18)
  names this door `analyze:reference`, with `analyze:repo`, `analyze-repo`,
  `analyze:reference-repo`, `analyze-reference-repo` kept as `replaces:` aliases.
  About 19 tracked files reference the current path or name.

## Q1 - step 6.2b: rename now, or wait?

Step text: "Moving `analyze/repo/command.md` moves the file whose five mechanisms
carry the pre-registered claim pinned in 4.1, so the rename waits on that claim's
owner: either the observation roadmap records the move as a known delta, or the
rename lands after the observation runs." Verify: `analyze/reference/command.md`
exists with the four aliases in `replaces:`, and the observation roadmap names
the move.

Options:
- (a) Rename now as a pure move (`git mv`, frontmatter `name`/`replaces:` and
  references updated, no hunk inside the five mechanisms' sections), and record
  in the observation roadmap's claim-pin section: the move as a sixth known
  delta, the new path, and the drift check rewritten as
  `git diff -M 835660b0d..HEAD -- <old path> <new path>`.
- (b) Wait: leave step 6.2b open until the observation runs (or the claim
  window, 2027-02-08, expires).
- (c) Another option you name.

## Q2 - step 6.5: the offer of observation slots

Step text: "Offer the first two source-door runs on this repository as the
observation runs of `reference-loop-upgrade-value`, with the shadow arm its
protocol requires - or decline, recorded." Verify: the observation roadmap
records the offer and its answer. Zero source-door runs exist so far. The
observation roadmap's own binding points: an upgraded-only run is not a
substitute and consumes no slot; both arms are one atomic observation; an
invalid or incomplete run consumes no slot; until a valid run completes the
claim row stays `unbacked` with empty `last_verified`.

Options:
- (a) Accept conditionally: record in the observation roadmap that the first two
  source-door runs against a reference meeting its step 1.1 criteria are its
  candidate observation runs, each valid only as an atomic upgraded+shadow pair,
  and only once `shadow-pin-is-post-upgrade` is resolved; until then a
  source-door run is an ordinary run and consumes no slot.
- (b) Decline: record that source-door runs are not observation runs; the
  observation keeps its own step 1.1 route.
- (c) Ratify the corrected shadow coordinates now (this council as the
  full-strength venue) and accept as in (a) without the pin condition.
- (d) Another option you name.

State, for each question, whether the decision is reversible and internal, or
whether it belongs to the repository owner instead of this council, and why.
