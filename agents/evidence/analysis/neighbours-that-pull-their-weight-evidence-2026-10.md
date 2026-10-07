# Neighbours that pull their weight — dated evidence, 2026-10

<!-- evidence-type: analysis -->

> Moved verbatim out of `agents/roadmaps/road-to-neighbours-that-pull-their-weight.md`
> on 2026-10-06 so that roadmap fits the `lightweight` complexity cap of 600 lines.
> Each section is a dated reading; it asserts what was true when written and is
> never re-bound. The roadmap keeps a one-line pointer at each original position.

## Phase 2 — the payload lock re-measured 2026-10-06

> **Re-measured 2026-10-06 at `0ea82b2b8`, this lane's base after syncing
> `origin/main`. The lock holds in kind and is wrong in every digit.** The
> block above is kept rather than overwritten, per risk-register row 8: an
> owner needs to see which tree each reading belongs to.
>
> ```
> ./scripts-run src/scripts/check_preamble_payload_budget --as-of 2026-10-06T00:00:00Z
>   project-scope rules                      121236 tok      (was 121426)
>   measured total                           136827 tok (baseline 102520, +34307; ceiling 136827)
>   ceiling 136827 tok = base 136827 — zero net growth, design 107646
> ```
>
> The ceiling fell 190 tok because the base ref did; headroom is still exactly
> zero. The hard edge was **re-run rather than quoted**: ten bytes written into
> `dist/agent-src/rules/` moved the bucket to `121239` and the gate to
> `❌ per-spawn preamble payload grew past the ratchet: 136830 > 136827 tok`,
> whose rejection record names `attempted_delta: 3`. The probe file was removed
> with `rm`, and the working tree was confirmed clean afterwards.
>
> **The practical consequence is that no figure here may be carried forward.**
> The obligation is unchanged as an ORDER — a four-figure token charge against
> zero headroom — but the ceiling is a property of the base ref, and three
> drain lanes merged into `main` between the two readings above. Whoever pays
> it re-reads the gate on the day, and treats a quoted number as stale by
> construction.

## Step 2.1 — the `blocked-by` marker invisible to its own gate (2026-10-06)

      **The `blocked-by` marker on this step is invisible to its own gate, and
      making it visible would red the file. Measured 2026-10-06, both
      directions, with the probe removed afterwards.** `BLOCKED_BY_LINE_RE` in
      `src/scripts/lint_roadmap_blockers.ts` is anchored to the checkbox line
      itself, and this step's marker sits on a continuation line below it — so
      the linter parses no marker here and prints a clean verdict for the whole
      file. Control for that negative: a scratch copy carrying the identical
      marker moved onto the checkbox line yields
      `line 177: blocked-by references unknown blocker id 'b6-neighbour-precedence'
      (no matching '### blocker: b6-neighbour-precedence' in this file)` — the
      checker resolves ids within ONE file, and b6 is declared in
      `road-to-leading-every-row.md` by design, because it is a programme
      blocker holding three lanes.

      So the only two states reachable today are *invisible* and *illegal*, and
      this run took neither. Moving the marker would trade a silent gap for a
      red gate over a cross-file reference the estate uses on purpose; leaving
      it is the lesser failure and is now a recorded one rather than a silent
      one. Logged as an instance under
      `agents/roadmaps/stubs/road-to-blocker-parse-visibility.md`, which already
      owns the sibling shape (a bare `### <id>` heading without the `blocker:`
      prefix) and reaches the same "a gate that scans nothing exits green"
      conclusion.

## Step 3.2 — the revisit-if executed 2026-10-06

      **The revisit-if was EXECUTED 2026-10-06, not read, and it does not
      fire.** `grep -rn 'descriptor\|inputSchema\|description' src/scripts/*.ts
      src/scripts/_lib/*.ts | grep -i mcp` returns hits in exactly three
      modules, and every one of them reads THIS package's own surface:
      `build_mcp_catalog.ts` and `build_mcp_registry_manifest.ts` write the
      catalog from our own tool definitions, and `audit_initial_context.ts`
      prices `tools/list` triples read out of `MCP_CATALOG` — our file, loaded
      at `:418` and returning `{}` when absent. The grep is a real instrument
      rather than a zero: it returns 20 lines, three distinct modules and the
      literal `inputSchema`, so a reader of a THIRD party's descriptors would
      have been in its output had one existed. D2 therefore stands unchanged
      and this step stays deferred on the same ground it was deferred on.

## Step 3.3 — re-run, verify-oracle and undecidability notes (2026-10-05)

      **Re-run 2026-10-05 at `e6b71933a`: the block holds on its seventh reading,
      and the ceiling it was priced against has moved.** Both halves of the
      blocker's `Resolved when` were executed rather than read.
      `npx vitest run tests/scripts/neighbour_mcp_use.test.ts` -> **15 passed**,
      and the passing set includes `the shipped telemetry-usage entry still
      filters the recorder out`, which is the assertion that FLIPS when the
      blocker closes — so the recorder is still unreachable, measured rather
      than quoted. The ratification half:
      `grep -rl 'mcp-recorder-unreachable' agents/evidence/ratifications/`
      returns **0 files**; control for that negative,
      `grep -rl 'tree-keeps-neighbours' agents/evidence/ratifications/`, returns
      `drain-tree-keeps-neighbours.md`, so the directory and the search both
      work. Neither half has moved. The re-pricing of the three options — a
      bundle ceiling with 41,013 B of headroom rather than 170 B, and a
      `concern_count` allowance of zero that option 3 alone pays — is under the
      blocker.

      **The verify oracle on this step is weaker than its exit condition, and
      this run deliberately left the command alone.** No ratifying decision
      points at it: `grep -rl 'neighbours-that-pull-their-weight' docs/decisions/`
      returns 0 files, control `grep -rl 'ADR-237' docs/decisions/` returns 9, so
      strengthening is sanctioned. Two separate weaknesses, both reproduced:
      `"tools_used_30d":\s*[0-9]+` is satisfied by `0`, which is exactly what an
      unreachable recorder prints; and in a tree with no `.mcp.json` the census
      emits `mcp_servers: []`, so the regex matches nothing at all and the clause
      fails for a reason unrelated to the step — reproduced here, where
      `./agent-config doctor neighbours --json` yields `mcp_servers len 0` and the
      regex returns no line. What stopped the rewrite is that every candidate
      replacement prejudges the owner's choice. An oracle keyed to the
      `telemetry-usage` entry presumes option 1 or 2 and would never go green
      under option 3; one keyed to a non-zero count would be wrong for a
      consumer who genuinely calls no neighbour tool; a shape-neutral one — "some
      `post_tool_use` concern owning the recorder admits `mcp__acme__alpha`" —
      needs a script that does not exist, and new source here is a
      `check_source_size_budget` ratchet entry for an oracle nobody can use until
      the blocker closes. **The falsifiable oracle already exists and is named
      here so the next run does not re-derive it:** the exit condition is that
      `tests/scripts/neighbour_mcp_use.test.ts`'s `the recorder is NOT reachable
      through the dispatcher` block STOPS passing. Whoever lands the owner's
      chosen option rewrites that describe block to assert the positive, and that
      is the moment this step's verify line can be rewritten to point at it
      without presuming which option was chosen.

      **Nothing here is on course to become undecidable, and it was counted
      rather than assumed.** The store's window is forward-looking —
      `TOOL_USE_WINDOW_DAYS = 30` in `_lib/neighbour_tool_use.ts` is applied by
      the READER at query time, over days the writer stamps as it goes — so the
      30 days start when the recorder starts, and a long block costs nothing
      that a later measurement needs. This step carries no accumulating sample
      that could expire empty; what it carries is a published `0` on every
      install, which the blocker already records as standing rather than
      compounding.

## Blocker `mcp-recorder-unreachable-behind-the-tools-filter` — eighth reading (2026-10-06)

- **Both halves executed again 2026-10-06 at `0ea82b2b8`; neither has moved,
  and this is the eighth reading.** Run, not quoted:
  `npx vitest run tests/scripts/neighbour_mcp_use.test.ts` -> **15 passed**,
  the passing set still including `the shipped telemetry-usage entry still
  filters the recorder out`, which is the assertion that FLIPS on closure. The
  manifest half was read directly as well: `telemetry-usage` in
  `src/scripts/hook_manifest.yaml` still carries `tools: [Skill]`. Ratification
  half: `grep -rl 'mcp-recorder-unreachable' agents/evidence/ratifications/`
  -> **0 files**, with the control `grep -rl 'tree-keeps-neighbours'` on the
  same directory returning `drain-tree-keeps-neighbours.md`, so the directory
  and the search both work and the zero is a finding rather than a broken
  instrument. `concern_count` was re-read for option 3 and is unchanged:
  `./scripts-run src/scripts/check_estate_count` -> `concern_count 62 (floor 62
  at origin/main, +0)`.
- **No second council pass was opened on option 3, deliberately.** The
  fifth-exit paragraph above records why — option 3 is one of three options
  this blocker hands the owner by name, and an agent choosing among an owner's
  enumerated set is the owner-reserved dimension of the same ADR-268 § 4
  ladder. That reasoning was not re-derived here; re-running the council on a
  question a prior run routed to the owner would be verdict-shopping under
  `evaluator-independence`, and the re-pricing above is the only thing this run
  had standing to change. The blocker is handed on unchanged in substance and
  corrected in its numbers.
