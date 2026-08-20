# Drain-run handoff notes

<!-- evidence-type: analysis -->

Working notes for the autonomous roadmap-drain run of 2026-08-20. The recycle
envelope points here rather than carrying this detail inline.

## What the run is

Drive every roadmap under `agents/roadmaps/*.md` to an honest close — one PR per
roadmap — with every blocker disposed by the AI council rather than by the user.
No user round-trips. Token and benchmark spend pre-authorised; a Hard-Floor act
is still never autonomous.

## Council framework (adopted, both seats convergent)

Recorded at `agents/evidence/council/drain-blocker-dispositions-a.md` and `-b.md`.
Round 1 was asked for dispositions and returned an architectural critique; the
critique was adopted in full and round 2 returned the tables against it.

1. A fifth disposition **abandon**, for work that is a declared Non-goal or
   depends on a capability nobody is building. Without it, permanently
   infeasible work is forced into stubs that become parking lots while
   completion percentages report success.
2. Four **outcome states** on every closure — `satisfied`, `narrowed`,
   `transferred`, `abandoned`. "Archived at 100 %" without one collapses four
   realities into one status.
3. **Rule 3 is categorical.** Repository creation, a legal signature, a
   shipped-default flip, a repo-admin setting, a host-env modification, or any
   externally visible / irreversible act may only be **transferred** — the
   council may record its preference inside the stub; the parent may not record
   the action as done.
4. **Measured null is not cannot-measure.** No instrument → transfer or abandon;
   the instrument ran and answered zero → accept the null as terminal; the
   instrument is broken → transfer.
5. **Duplicate-evidence blockers merge** into one disposition and one stub —
   three groups, seven blockers.
6. Every transfer carries the **three-point stub-integrity check**: the original
   criterion verbatim, the complete list of dependent steps moved, and a *named*
   re-entry producer with a detection probe measured on the transfer date.
   "When some subsystem exists for its own reason" names nobody.

`later/` is preferred over a stub when the roadmap **is** the artefact a human
applies — a stub would be a copy of it under another name.

## Gate traps this run paid for

- **`lint_roadmap_blockers` accepts exactly one closed token: `Status: resolved`**
  (`:193`). `transferred` / `abandoned` / `narrowed` read as **open** to every
  gate, are counted in `open_blockers`, and make the archival sweep refuse. Put
  the outcome state in the resolution prose, the stub and the README row.
- Correcting that token **tightens** `open_blockers`, and `check_estate_count`
  hard-fails on an un-walked tightening. Walk the baseline **down** with a
  `baseline_history` entry (`ensure_ascii=True`, `indent=2`) saying that nothing
  in the repository earned the drop. **Never raise a baseline** to let a new
  violation pass — pay a depth or size ratchet down by extraction.
- On an `estate-count-budget.json` merge conflict: keep **every** history entry
  from both sides and **measure** the baseline against the merged tree. Never
  adopt one side's number. Parking a `draft` roadmap is an *accounting* change —
  the file was counted by neither metric before — and needs its own entry, or
  `draft` becomes a permanent hiding place.
- `agents/roadmaps/stubs/README.md` is **one** table with four columns after the
  repair PR. Add a row, never a second section; on conflict keep `main`'s version
  and append only your own row. Six parallel union merges had produced two
  competing tables and non-rendering markdown.
- A **scope-bound** completion-review or `original-review` artefact citing a
  moved roadmap path gets a per-line `ref-ignore` marker, never a rewrite —
  rewriting falsifies what was reviewed at that scope.
- `./agent-config roadmap:progress` now archives completed roadmaps itself. Read
  what it did rather than assuming.
- `session:recycle` reads the envelope from **stdin** or `--file`; it does not
  generate one, caps it at 6144 bytes, and rejects prose in `do_not_touch`.

## Helpers written for this run

- `sync_push.sh <worktree> [attempts]` — merge `origin/main`, resolve only the
  three known generated/union conflicts (dashboard, stubs README,
  `hook_manifest.json`), regenerate, commit, push, retry while the trunk moves.
  **Refuses an unknown conflict** rather than guessing.
- `readme_ours_rows.py <worktree>` — resolve the stubs README by keeping the
  incumbent document and re-adding only rows this branch introduced.

Both live in the session scratchpad, which does not survive a new session; they
are ~40 lines each and cheaper to rewrite than to hunt for.

## Approaches that failed

- Polling `gh pr checks` across every PR in a loop — rejected by the maintainer.
  Fix a red PR when its failure is known; do not sweep.
- Resolving the stubs README as a union on every branch — each merge was
  individually correct and the document became incoherent.
- Delegating four large verbatim file splits to parallel subagents — all died on
  one API error, and a verbatim move across four files cannot be cross-checked by
  four independent agents. Sequential, one agent.
- Assuming a `Status` word that reads closed to a human is closed to a gate.

## Findings worth keeping

- The consolidated decision sheet renders **21** defaults, not thirteen, and all
  21 were already disposed — blanket acceptance would have silently reversed ten
  of the council's own round-1 dispositions. One default (`allow_delegate`) was a
  standing write authority and was pulled out.
- "0 skills declare a machine-matchable trigger" is **false — four do**, and
  `src/scripts/report_skill_activation.ts:27-28` still asserts the stale figure.
- The enforcement-projection null's selector (`tier: safety-floor`) matches
  **zero** files today, so it cannot be cited as terminal for a current question.
- The orchestration quality columns are **not payload-derivable at any hook slot
  by construction** — they are defined over events strictly after completion.
- `wall_clock_ms` is numeric on 582 rows but `> 0` on only 40, so "numeric 582"
  overstates latency coverage by roughly 14×.
