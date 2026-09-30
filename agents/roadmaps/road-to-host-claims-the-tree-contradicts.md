---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Three cells of prose that state a host fact the tree's own emitter and manifest already contradict; no active roadmap covers the format column or a hook header's capability sentence, the two `later` neighbours on this file work a different column, and archiving either to buy the slot would park live work to fix three lines."
relates: []
---
# Road to host claims the tree contradicts

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t01/` — an external comparative
> analysis round (a transcript plus two generations of a supplied plan) that
> measured this tree against a set of prompt corpora. Most of its programme was
> already built here or already parked; these three cells are what survived
> verification against `main` on 2026-09-29 and belong to no existing stem.

## Goal

Three sentences in this tree assert something about a host that another file in
the same tree already contradicts, and each is reachable by a reader who has no
way to know it is false. `docs/enforcement-by-host.md`'s Cursor row names a
format nothing emits; the same table records which slots are bound and not what
happens when a bound slot fails, on the one slot carrying thirteen concerns; and
`one_question_per_ask_hook.ts` opens with a sentence about every host that its
own manifest entry falsifies. Done means each of the three either states what
the tree does, or is deleted — and, for the format column, that the next drift
is caught by a check rather than by an external reader.

## Phase 1 — The format column says what the tree emits

- [x] **1.1 Correct the Cursor row, and only the Cursor row.**
      `docs/enforcement-by-host.md:23` reads `✅ .cursorrules`. Nothing in this
      tree writes that file: the projection maps `.cursor/rules` (`condense.ts:747`)
      and the installer's `emitCursor` writes `.cursor/rules/<name>.mdc`
      (`emit_host_rules_cli.ts:88-99`). The row becomes `.cursor/rules/*.mdc`.
      The neighbouring rows are NOT drift and must not be swept in with it —
      `emitWindsurf` still writes a concatenated `.windsurfrules`
      (`emit_host_rules_cli.ts:119`) beside `.windsurf/rules/`, and `.clinerules`
      is a real target (`condense.ts:748`). The source that raised this named
      both Cursor and Windsurf; only the first half reproduces.
      verify: `grep -n 'cursorrules' docs/enforcement-by-host.md` returns nothing
      outside the prose paragraph at `:8`, and `grep -rn "'\.cursorrules'" src/`
      still returns nothing
      **Evidence (2026-09-29).** `grep -n 'cursorrules' docs/enforcement-by-host.md`
      → no hits. The row reads `| Cursor | ✅ \`.cursor/rules/*.mdc\` | 5 |`.
      Windsurf and Cline are byte-identical to `origin/main` — confirmed by
      `git diff origin/main...HEAD -- docs/enforcement-by-host.md`, which shows
      no `-` line for either.
      **The verify's second half does not reproduce as written.**
      `grep -rn "'\.cursorrules'" src/` returns TWO hits, not zero:
      `security_audit_config.ts:47` and `_lib/install_reach_checks.ts:76` —
      both present on `origin/main`, and both a list of names to AUDIT or
      EXCLUDE, never a write. The roadmap's claim ("nothing in this tree writes
      that file") holds; its grep was the wrong instrument for it.

- [x] **1.2 Generate the format cell instead of maintaining it.**
      A check that reads the emitter's own target paths and fails when the
      table's format column names a path no emitter writes. The emitters already
      export their targets (`emitCursor`, `emitWindsurf`, `_emit_cursor_mdc`,
      `_emit_windsurf_rule`); the cell is derivable, so hand-maintaining it is
      what produced 1.1. Register it the way this repo registers a gate, with a
      self-test whose rejecting case is a table row naming an unemitted path.
      verify: a self-test case that plants `.cursorrules` back into a fixture
      table exits non-zero, and the same check exits 0 against the real tree
      **Evidence (2026-09-29).** `check_host_format_column` builds its oracle
      two ways and scrapes no source: `measuredEmitterSurfaces()` RUNS the two
      install-time rule emitters into a throwaway tree and walks what they
      wrote, and `declaredRoots()`/`anchorDirs()` import `ADAPTER_REGISTRY` and
      `USER_SCOPE_PATHS`. `--self-test` → `8/8 case(s) behaved (7 rejecting,
      floor 8)`: the historical `.cursorrules` defect planted back, a near-miss
      `.cursor/rules.mdc`, an invented surface on a correct neighbouring row, a
      document with no table (exit 2, never green over an empty corpus), and
      three argv shapes. Registered `status: enforced` in `gate-coverage.yml`
      with `min_scanned`, a declared `ci_invocation` and a `no_canary_reason`;
      `check_gate_coverage` → `every enforced gate cleared its coverage floor.`
      **Independent review found the green line overstated what the oracle
      proves** — it claimed every path was emitter-written when the declared
      half is a registry read, not an observation. Corrected on both the green
      and the red path. **It also found three argv shapes silently coalescing to
      `ROOT`**, so a fixture test could pass without opening its fixture; now
      refused, with three self-test cases constructed so the coalescing code
      would have exited 0 — the first two attempts were tautological and were
      rewritten.

- [x] **1.3 Record why the table was not swept wider.**
      One sentence under the table: the format column is generated from the
      emitters as of this change, and the slot-count column is not — it is
      measured elsewhere and is the subject of other work. Without it the next
      reader assumes both columns carry the same guarantee.
      verify: `grep -n 'generated from the emitters' docs/enforcement-by-host.md`
      **Evidence (2026-09-29).** `grep -n 'generated from the emitters'
      docs/enforcement-by-host.md` → line 32, in a paragraph that names what the
      slot-count column is instead (a hand-read of `hook_manifest.yaml`'s
      `platforms:` bindings) so the format column's guarantee cannot be carried
      across to it.

## Phase 2 — What happens when a bound slot fails

> **BLOCKED — all three steps, 2026-09-29.** An independent two-provider council
> review **refused** the rows this phase asks for, and the ground is one this
> phase cannot argue with: the three facts were cited as
> `Claude Code's own hooks reference, § hook execution / timeout` with **no URL,
> no host version and no retrieval date**, inside a document whose every other
> column is read off a file in this repository. One seat further held that the
> current primary source contradicts part of what the rows asserted. A
> provenance marker on an unanchored claim marks it as unanchored; it does not
> make it citable, which is the substitution
> `host-capability-manifest.md` § Observation protocol exists to refuse — and
> Risk 3 of this roadmap's own register predicted exactly this failure.
>
> **What the document says instead.** `docs/enforcement-by-host.md` now carries
> § *What this document does NOT record about a bound hook that runs too long*:
> it names the 13 concerns sharing `claude`'s `user_prompt_submit`, states that
> the timeout consequence is recorded nowhere here and why, names the shape a
> usable row would take (host + version, page + section + URL, retrieval date,
> and for the runtime half a session in which the timeout was actually
> reached), and keeps the two facts that ARE this tree's own — no `timeout` key
> anywhere, and `p95 81 ms` — together with 2.3's refusal to conclude anything
> from them. A stated gap is true; a row from an unpinnable source is not.
>
> **Resolved when** a session supplies that row. `2.3`'s obligation is already
> discharged in the replacement prose and is kept open only because it is
> written against rows that do not exist yet.

- [ ] **2.1 Add the slot-failure facts to the table.**
      The table records which concerns are bound per slot. It records nothing
      about the documented behaviour when a `user_prompt_submit` hook exceeds its
      timeout — that the hook is cancelled and its output, `additionalContext`
      included, is discarded while the prompt proceeds without it — nor that
      neither the plain-stdout nor the `additionalContext` channel produces a
      visible transcript entry. This tree binds thirteen concerns on that slot
      for `claude` (`src/scripts/hook_manifest.json`, `platforms.claude.user_prompt_submit`),
      so silent total loss on that slot is the largest undocumented failure mode
      the table covers. Record it as documented host behaviour with its source
      named, never as a measurement this tree took.
      verify: `grep -n 'discard' docs/enforcement-by-host.md` returns a row about
      timeout semantics, distinct from the existing `fail_policy: discard` rows

- [ ] **2.2 Say which of the three facts this tree has observed, and which it has only read.**
      `host-capability-manifest.md` § Observation protocol already refuses a row
      written from a vendor's documentation. The same discipline applies here:
      each of the three facts is labelled read-from-host-documentation until a
      session observes it. A documentation-sourced row labelled as measured is
      the defect this step exists to prevent, not a smaller version of it.
      verify: each added cell carries a provenance marker, and
      `grep -c 'observed' docs/enforcement-by-host.md` is unchanged by this step

- [ ] **2.3 Do not add a latency conclusion.**
      The tree measures p95 on that slot and the number is comfortably inside the
      documented timeout, which makes the risk look retired. It is not: the
      documented behaviour is total silent loss, and a p95 says nothing about the
      tail that matters. State the timeout; state the measured p95 beside it;
      draw no conclusion from the pair.
      verify: no sentence in the added rows asserts the timeout is not reached

## Phase 3 — The header that contradicts its own binding

- [x] **3.1 Rewrite the "fires on nothing" sentence to what is actually true.**
      `src/scripts/hooks/one_question_per_ask_hook.ts` opens with "On every host
      measured today it therefore fires on nothing". The manifest binds the
      concern on `claude` / `pre_tool_use` with
      `tools: ["AskUserQuestion", "AskQuestion", …]`, and the first of those is a
      name this host ships. The honest sentence is narrower and is the one the
      file's neighbour already uses: no host's delivered surface has been
      OBSERVED in this tree carrying a question-picker tool, so
      `STRUCTURED_ASK_SHAPES` is empty (`src/scripts/_lib/structured_ask.ts:56`)
      and no per-host shape row exists. "Not observed" and "fires on nothing" are
      different claims and only the first is supported.
      verify: `grep -n 'fires on nothing' src/scripts/hooks/one_question_per_ask_hook.ts`
      returns nothing, and `npm run test:ts -- tests/scripts/structured_ask.test.ts`
      stays green if such a test exists
      **Evidence (2026-09-29).** `grep -n 'fires on nothing'
      src/scripts/hooks/one_question_per_ask_hook.ts` → no hits. The header now
      states what has been looked at: no host's delivered surface has been
      OBSERVED carrying a question-picker tool, which is why
      `STRUCTURED_ASK_SHAPES` is empty. The measurement base is named as one
      row — `structured_ask: false` for `claude`, observed-absent on Claude Code
      2.1.263 on 2026-09-07 — against eight hosts with no row at all.
      The old wording is DESCRIBED rather than quoted, because 1.1's drift
      check is a grep and a grep cannot tell a refuted quotation from a live
      assertion; quoting it verbatim left the verify's own grep unsatisfiable.

- [x] **3.2 Leave the guard's behaviour untouched.**
      This phase edits one comment. The deny path, the `fail_closed: false`
      posture and the manifest `tools:` list are unchanged, because changing the
      form of an ask is a separate question that already has an answer — see the
      note below. A header repair that quietly becomes a behaviour change is the
      failure this step forbids.
      verify: `git diff --stat src/scripts/hooks/one_question_per_ask_hook.ts`
      shows comment lines only
      **Evidence (2026-09-29).** `git diff origin/main...HEAD --
      src/scripts/hooks/one_question_per_ask_hook.ts` → 22 insertions, 4
      deletions. Filtering the diff for non-comment lines returns EMPTY: the
      deny path, `fail_closed: false` and the manifest `tools:` list are
      untouched.

- [~] **3.3 Write the observed row.** Deferred, and named rather than dropped:
      the row `_lib/structured_ask.ts` asks for needs a real session on a host
      delivering a question picker, with host, host version, transcript reference
      and date. That is an observation, not a tree edit, and it is the only thing
      that turns 3.1's "not observed" into a measurement. It is also the input the
      parked decision below is waiting on.

## What this roadmap deliberately does not do

The round that produced these three cells also argued a two-delivery-regime
contract, a skill-description cap raise, a grant-provenance class and a
host-contract staleness instrument. None of them is here, and each for a
recorded reason: the delivery-regime split is held by a stub whose every closure
is an owner budget move; the description cap is parked in two `later` roadmaps;
the grant provenance axis already exists as a typed field in an accepted
decision record; and the staleness instrument is a proposal with no measurement
behind it. The question of whether a host's native multi-question block may
carry batched consent asks was put to the council and declined on 2026-09-07; it
is not reopened here.

## Acceptance criteria

- No cell in `docs/enforcement-by-host.md`'s format column names a path no
  emitter in this tree writes, and a check fails when one does.
- The Windsurf and Cline format cells are byte-identical to what they were
  before this change.
- The table states, per slot, what happens when a bound hook exceeds the
  documented timeout, and each such statement carries a provenance marker
  distinguishing read-from-documentation from observed.
- `one_question_per_ask_hook.ts` makes no claim about what it fires on beyond
  what the tree has observed.
- The guard's runtime behaviour is byte-identical before and after.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The format-column repair sweeps the correct neighbouring rows | implementation | The source that raised the Cursor cell named Windsurf in the same breath, and a reader repairing "the format column" will naturally correct both at once. But `emitWindsurf` really does write a concatenated `.windsurfrules` and `.clinerules` really is a projection target, so the sweep replaces two true cells with two false ones — a repair that leaves the table less accurate than it was. | Step 1.1 names both neighbours with their emitter line references and restricts the change to the Cursor row alone. An acceptance criterion requires the Windsurf and Cline cells to be byte-identical before and after, which turns the over-sweep into a failing criterion rather than a matter of judgement. | Phase 1 — The format column says what the tree emits |
| 2 | The generated check reports drift that is not there | implementation | Some emitter targets are built by interpolation, so a check that compares table cells against literal strings scraped from the emitter source can conclude that a correct cell names an unemitted path. A gate that reds on a true row gets disabled, and the column returns to being hand-maintained — which is exactly what produced the Cursor error in the first place. | Step 1.2 requires the check to read the emitters' exported targets rather than scrape their source, and to be registered the way this repo registers a gate: with a self-test whose rejecting case plants `.cursorrules` back into a fixture table. It must be seen red on a planted bad row and green on the real tree before it is trusted. | Phase 1 — The format column says what the tree emits |
| 3 | The slot-failure rows are read as facts this tree measured | product | The timeout and discard semantics come from the host's own documentation, not from a session observed here. Stated flatly in a table whose other columns are measured, they will later be cited as evidence this package collected — the exact substitution `host-capability-manifest.md` § Observation protocol exists to refuse, and it is harder to undo once quoted elsewhere. | Step 2.2 requires a provenance marker on each added cell labelling it read-from-host-documentation, and requires the file's `observed` count to be unchanged by the step. Step 2.3 forbids drawing any conclusion from the measured p95 that sits beside the documented timeout. | Phase 2 — What happens when a bound slot fails |
| 4 | The header repair is read as settling the ask-form question | product | `one_question_per_ask_hook.ts` sits on the boundary of a question the council declined on 2026-09-07 — whether a host's native multi-question block may carry batched consent asks. A comment rewrite that also touched the guard's `tools:` list or its deny path would look like that ruling being quietly reopened under cover of a documentation fix. | Step 3.2 restricts the diff to comment lines with `git diff --stat` as its verify, and an acceptance criterion requires the guard's runtime behaviour to be byte-identical. The "does not do" section names the declined ruling explicitly, so the boundary is stated rather than assumed. | Phase 3 — The header that contradicts its own binding |
| 5 | Step 3.3 is deferred and quietly never returns | implementation | Step 3.1 replaces a false claim with a narrower true one — "not observed" — which stays honest only while somebody is still trying to observe. Dropped, the narrower claim becomes permanent, `STRUCTURED_ASK_SHAPES` stays empty with no record of why, and the absence reads to the next maintainer as a settled fact rather than a missing measurement. | The step is carried as a deferred checkbox inside the roadmap rather than as a prose note, so the file cannot close while it is open, and it states the exact inputs the observation needs — host, host version, transcript reference and date — so a future session can discharge it without re-deriving the requirement. | Phase 3 — The header that contradicts its own binding |
