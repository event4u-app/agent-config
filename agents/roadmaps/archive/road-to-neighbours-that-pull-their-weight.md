---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "concern_count +1, and only that: step 3.3 lands the owner's option 3 (D12, 2026-10-06) — a separately named `mcp-usage-observation` concern on `post_tool_use`, because `telemetry-usage`'s exact-match `tools: [Skill]` filter meant the dispatcher never called the foreign-MCP recorder and a concern named for opt-in telemetry must not carry default-on local collection (council 2026-10-02, both seats). `check_estate_count` gives `concern_count` a zero allowance by design, so the concern takes the claim path; the manifest edit carries its own ratification artifact under `agents/evidence/ratifications/`. The same change closes the `mcp-recorder-unreachable-behind-the-tools-filter` blocker, so `open_blockers` falls by one."
estate_offset_exempt: "lane of road-to-leading-every-row; the set's growth is declared there. The skill ranker already unions neighbour skill roots into every route and silently drops a same-named second skill (score_skill_relevance.ts:182-193) — live behaviour with no owner in the estate; the fingerprint-slot stub it executes is a stub, not a roadmap, and is deleted on landing."
relates:
  - slug: road-to-leading-every-row
    relation: depends
    note: "the programme; blocker b6 there decides step 2.1"
  - slug: road-to-a-tree-that-keeps-its-neighbours
    relation: depends
    note: "the census (its 2.1-2.5) is the input every phase here reads"
  - slug: road-to-mcp-fingerprint-slot-binding
    relation: extends
    note: "step 3.2 executes that stub's decided binding and implementation list"
  - slug: road-to-a-stop-that-holds
    relation: disjoint
    note: "its per-layer shadow row already records stop_hook_active; step 3.1 adds who set it, serialised with its Q1 window"
depends: [road-to-leading-every-row, road-to-a-tree-that-keeps-its-neighbours]
---
# Road to neighbours that pull their weight

> **Source:** `agents/tmp.old/inbox-2026-10-b/` — the owner's directive in the round's
> chat (this suite orchestrates the packages installed beside it, uses them where they
> are better, and keeps their rules from cancelling each other), plus the owner's last
> question of the round: can neighbours loaded first ignore this suite? Every anchor
> re-read at `9bc8cd4`. Class: owner directive + external comparison corpus.

## Goal

A neighbour's skill, index or instruction is used where it is better and never trusted
more than it has earned; ADR-124's doctrine for code graphs — orchestrator first, owner
where it wins (`docs/decisions/ADR-124-*.md:136`) — extends to every neighbour artefact.
At `9bc8cd4`: the ranker unions skills under `.claude/skills` and `~/.claude/skills`
(`src/scripts/_lib/skill_catalogue.ts:88,98,183-206`; used by `hooks/skill_route_hook.ts:355`
and `mcp_server/suggest_skill.ts:49`) with no origin and no scan
(`_lib/security_lint.ts:55-61` covers our corpus only), and the first same-named skill
wins (`skill_tools/score_skill_relevance.ts:182-193`), so a foreign `design-system` can
silently hide ours; no order is stated between this suite's guidance and a neighbour's
always-on text (`src/agent-src/contexts/override-system.md:15-29` orders only
original→override), and a static detector was measured at 67 % false positives
(`docs/contracts/rule-interactions.md:18-29`); the stop gate's `stop_hook_active` path
records a shadow row but not who set it (`hooks/turn_end_gate_hook.ts:1329-1339`); the
third-party MCP fingerprint store is bound to no slot (`src/scripts/mcp_tool_fingerprint.ts:12-22`).

What this suite can guarantee against a neighbour is only what it enforces as an effect:
a deny, or the stop gate's exit 2. Anything stated in prose — including the precedence
rule below — is something the model may still not follow; the lane makes that visible,
never claims it away. A neighbour whose effects this suite can observe is orchestrated;
one it cannot observe is an ambient actor whose output is advisory evidence only.

## Phase 1 — A route line that says where the skill came from

- [x] **1.1 Origin from the lockfile, and both same-named skills ranked.** The catalogue
      returns each skill with `origin: package | project | home`, where `package` means
      claimed by the installed-tools lockfile — a consumer's own skills live in
      `~/.claude/skills`, so root is never origin. Drop the first-wins dedupe so two
      `design-system` skills both rank; a foreign one prints `project:design-system` or <!-- ref-ignore -->
      `home:design-system`, ours the bare name. `corrected-from-reproduction`.
      verify: fixture — a foreign `design-system` beside ours yields two ranked entries, one qualified

      **Landed in `src/scripts/_lib/skill_origin.ts` and the ranker.** The dedupe in
      `_load_skills_across` now keys on the QUALIFIED name, so a collision between two
      owners ranks twice and only the same package skill reached through two roots still
      collapses. Origin is read from `agents/installed-tools.lock`, never from the root —
      decision D6 records why, and why a tree with no manifest qualifies nothing.
- [x] **1.2 Overlap from a two-root mode of the existing audit.** `audit_skill_overlap`
      takes one `--root` (`:97,701-703`); add a cross-root pair mode (neighbour × ours),
      cached by the census digest, and print `also: <our-skill>` when a pair crosses its
      existing threshold. Each census entry gets one `compat` label computed without a
      model: `shadowed`, `overlapping`, `unscanned` or `unclassified`. Nothing is suppressed.
      verify: fixture — a near-duplicate foreign skill yields `also:` and `compat: overlapping`; a disjoint one `unclassified`

      **A cross product, not `find_pairs` over a merged list.** Merging the two
      sides would also pair our skills against each other, re-deriving the
      same-corpus report under another name and burying the pairs the caller
      asked for; the cross product is also the cheaper half. The threshold is the
      existing 0.70, so `compat: overlapping` is comparable to every historical
      number — a second, softer bar invented for neighbours would be comparable
      to nothing.

      The pairs run over the neighbour skills the census FOUND, never over whole
      roots: `~/.claude/skills` holds this package's own installed skills beside a
      neighbour's, so pairing the root would publish our own install as an
      overlap. Cached in `agents/reports/neighbour-overlap.json`, keyed by a
      digest over both sides' file bytes — risk-register row 3, closed as that row
      proposes.

      **The cache was written into a TRACKED directory, and that was fixed in
      this lane's branch rather than left.** Found 2026-10-06 while verifying
      this step against the tree: one `agent-config doctor neighbours` run left
      `agents/reports/neighbour-overlap.json` and `neighbour-scan.json` as
      untracked additions beside sixteen committed reports, covered by no
      ignore rule. The overlap cache carries each neighbour skill's ABSOLUTE
      path under the running user's home directory — so their account name —
      and the scan cache carries that user's whole installed-skill inventory
      with per-file digests. Both now ship in `src/config/gitignore-block.txt`
      and in this repository's own `.gitignore`, because the leak reproduces in
      any consumer tree that runs the command; neither file has ever been
      tracked here or in a release, so the entry ignores forward and unstages
      nothing.

      **The shape this did NOT take, recorded so it is owned rather than
      lost.** Decision D9 of this same lane puts step 3.3's sibling store under
      gitignored `agents/runtime/`, which is the tree's stated home for
      local-only machine state; these two caches should live there too, and the
      ignore entry is the containment, not the design. The move was not made
      because `SCAN_CACHE_RELATIVE` in `_lib/skill_origin.ts` is read on the
      hook path and is bundled, so changing it is a `check_hook_bundle_composition`
      question plus a cache-invalidation one — outside the bounded-remediation
      size for a defect found while verifying a closed step. Revisit-if: this
      lane reopens for any reason that already touches `skill_origin.ts`.
- [x] **1.3 Scan before inject.** A neighbour skill body passes `security_lint`'s shape
      checks before its body may be injected; a failing body ranks by name with
      `unscanned: <finding-kind>`; a changed digest rescans first.
      verify: fixture — a foreign SKILL.md with a planted `curl | sh` line ranks by name only and no line of its body reaches the injected context

      **Landed before 1.2, and the order is the finding.** `compat` has four
      values and `unscanned` outranks the other three, because an overlap score
      is derived from a body the census refused to read. Built the other way
      round, every 1.2 label read `unscanned` and its own fixture failed — so the
      scan is 1.2's precondition, not its sibling.

      Four shape checks (`instruction-smuggling`, `dangerous-frontmatter`,
      `hidden-unicode`, `mixed-script-confusable`), reused as functions over
      `security_lint`'s `ScannedFile` per D3. ANY finding refuses the body, not
      only a `HIGH` one: severity weighs a maintainer's own corpus, and a
      neighbour body is nobody's to weigh at rank time. The skill still ranks —
      by its name, with the finding kind visible — which is risk-register row 4
      resolved as that row proposes.

      The ranker reads a RECORDED verdict rather than scanning (D7); its half
      landed with 1.1 because `score_skill_relevance.ts` is one unit, and it was
      inert until this step shipped the producer.

## Phase 2 — One stated order, no detector

> **Landed 2026-10-06 — the note below is history.** `b6-neighbour-precedence` was
> resolved the same day (D1, D13) and all three steps shipped in one change; the
> payload lock was paid by an offsetting reduction, D16.
>
> **One blocker holds all three steps, so the mechanics are written once here.**
> `b6-neighbour-precedence` in `agents/roadmaps/archive/road-to-leading-every-row.md:226`
> is unanswered. Reproduced 2026-10-05 at `e6b71933a` by
> `grep -rn 'b6-neighbour-precedence' --include='*.md' .`, which returns exactly
> two lines — the blocker's own heading and step 2.1's `blocked-by` marker — and
> no answer anywhere in the tree. Control for that negative:
> `grep -rln 'b7-adr-088-premise' --include='*.md' .` returns
> `agents/roadmaps/archive/road-to-leading-every-row.md`, so the search reaches the file
> it is searching. 2.2 takes 2.1's rule as its rubric and 2.3's list is a section
> of that rule, so neither has an exit independent of 2.1.
>
> **A SECOND LOCK SITS UNDER b6 AND WOULD STOP 2.1 ON THE DAY IT IS ANSWERED.**
> `check_preamble_payload_budget` gates a bucket named `project-scope rules`,
> and that bucket is `censusRuleDir()` over `dist/agent-src/rules` — every `.md`
> in the directory, counted by raw file size, with no filter on `type`. The two
> anchors, both grep-citable rather than line-pinned:
>
> ```
> grep -n "id: 'project-scope-rules'" -A2 src/scripts/_lib/prefix_stable_surfaces.ts
>     root: 'dist/agent-src/rules',
> grep -n 'export function censusRuleDir' -A20 src/scripts/_lib/carrier_divergence.ts
>     if (!name.endsWith('.md')) continue;
>     chars += fs.statSync(path.join(dir, name)).size;
> ```
>
> A tier-2 routed rule is therefore charged exactly like an always-loaded one.
> Measured 2026-10-05 at `e6b71933a`:
>
> ```
> ./scripts-run src/scripts/check_preamble_payload_budget --as-of 2026-10-05T00:00:00Z
>   project-scope rules                      121426 tok
>   measured total                           137017 tok (baseline 102520, +34497; ceiling 137017)
>   ceiling 137017 tok = base 137017 — zero net growth, design 107646
> ```
>
> Zero headroom, and a probe says that is a hard edge rather than a rounding
> margin: a **ten-byte** file written into `dist/agent-src/rules/` moved the
> bucket to `121429` and the gate to
> `❌ per-spawn preamble payload grew past the ratchet: 137020 > 137017 tok`.
> The probe file was removed with `rm`.
>
> **2026-10-06 re-measurement of this lock** — moved verbatim to `agents/evidence/analysis/neighbours-that-pull-their-weight-evidence-2026-10.md` § Phase 2.
>
> The gate prints its own two exits and neither is a ceiling edit — *"The ceiling
> may NOT be widened to fit it — it is MEASURED at the base ref, so there is no
> number to edit"*. The two it does sanction:
>
> 1. **An offsetting reduction in the same diff**, anywhere in the three buckets.
> 2. **An approved, dated grant** in `src/config/preamble-payload-exceptions.json`.
>
> The size to offset or to grant is `ceil(bytes(src/rules/neighbour-precedence.md) / 4)`
> tokens. Measured over the 120 files already in `dist/agent-src/rules/`:
> median 3,752 B (≈ 938 tok), p75 5,387 B (≈ 1,347 tok), max 10,689 B. 2.3 adds
> its `prose-only` list to the same file, so the two steps share one charge. This
> is a four-figure token obligation on a bucket with zero headroom, not a
> rounding one, and it is the number the b6 answer does not by itself supply.
>
> **Fifth exit, checked and absent.** Capability-before-role (ADR-237) opens no
> exit here: the block is not an action an agent was conventionally barred from
> performing, it is a missing answer to a product question with three enumerated
> options, and no grant of authority supplies an answer the owner has not given.
> The payload lock above is a separate matter and IS agent-executable — which is
> why it is priced here rather than discovered on the day b6 lands.

- [x] **2.1 A projected rule `neighbour-precedence` below the four authority bands.** It
      leaves `src/rules/agent-authority.md:12-26` untouched — those bands govern autonomy,
      and the current-turn instruction never lifts band 1 — and orders *instruction
      sources* beneath them: the current-turn instruction → `agents/overrides/` → the
      project's own instruction file → this suite's routed guidance → a neighbour's
      always-on text → a neighbour skill body → a neighbour MCP tool description. Ties go
      to the project file; the agent names which instruction it followed, once per turn.
      One paragraph: a neighbour's completion signal is a provider status, never this
      suite's completion, which stays with the stop gate's detectors.
      verify: `./scripts-run src/scripts/compile_router` -> 0 and `grep -c 'neighbour-precedence' dist/router.json` -> /[1-9]/

      **Landed in `src/rules/neighbour-precedence.md`, with D1's eight-rank order** —
      the owner's answer to b6 split "a neighbour skill body" into an invoked one (rank
      5, above always-on text) and a merely discoverable one (rank 7, below it), and
      added the never-lower-a-floor clause and the one-global-install premise. `type:
      auto`, `self_contained`, routed; `agent-authority.md` is byte-identical. The rule
      costs ~800 tok on a zero-headroom payload; D16 records the offset that pays it.

      **2026-10-06 note on the `blocked-by` marker's visibility** — moved verbatim to `agents/evidence/analysis/neighbours-that-pull-their-weight-evidence-2026-10.md` § Step 2.1.
- [x] **2.2 Contradiction review on demand, council-seated, report-only.**
      `doctor neighbours --contradictions` forms candidate pairs only from strong signals —
      a shared subject noun with opposite modality, or a name collision from 1.2 — and
      hands them to one council seat with 2.1 as the rubric. Output `pair | verdict |
      which wins by 2.1`; it never edits or gates, and prints `n/a — no council configured`
      when `council:status` says so.
      verify: fixture — "spawn agents and wait" against "never end a turn waiting" yields one pair naming the project line

      **Landed in `_lib/neighbour_contradictions.ts` and `doctor neighbours
      --contradictions`; fixture in `tests/scripts/neighbour_contradictions.test.ts`.**
      Sources: the project's `CLAUDE.md` / `AGENTS.md` (rank 3), neighbour rule files
      (rank 6) and neighbour skill bodies (rank 7) — only bodies the 1.3 shape scan
      passed. Pairs form only across ranks; a name collision pairs a neighbour skill
      with ours (rank 4). The "which wins" column is the rule's order, computed; the
      verdict is one seat's (`council run --single`), and a pair it leaves unanswered
      reads `unclear`. The mode calls `census()` rather than `runCensus()`, so it writes
      neither cache — a test pins the project tree unchanged.
- [x] **2.3 Non-negotiables are effects.** Every obligation this suite means to hold
      against a neighbour is listed with its enforcing effect (a fail-closed `permission`
      concern or the stop gate's refusal); an obligation with no such effect is listed as
      `prose-only — may be outvoted`. The list is a section of 2.1's rule.
      verify: `grep -c 'prose-only' src/rules/neighbour-precedence.md` -> /[1-9]/

      **Landed as the rule's "Non-negotiables are effects" table.** Three fail-closed
      denies (`block-no-verify`, `block-kernel-rule-writes`, `block-plumbing-writes`) and
      `turn-end-gate`'s refusal are effects; commit, push, one-question-per-turn,
      threat-modelling and the order itself are `prose-only — may be outvoted`. The
      table says the stop gate lets a turn through when a neighbour set
      `stop_hook_active`, because 3.1 records exactly that.

## Phase 3 — The gate and the fingerprint know a neighbour acted

- [x] **3.1 Record who set `stop_hook_active`.** Extend the existing shadow row
      (`turn_end_gate_hook.ts:1332`, `layer: stop_hook_active`) with
      `set_by: ours | foreign | unknown` — `ours` iff our previous stop of the session
      refused, `unknown` when that record is missing. No new record kind; serialised with
      the stop-gate lane's Q1 window. `corrected-from-reproduction`.
      verify: fixture — a stop with `stop_hook_active` and no prior refusal of ours writes `set_by: foreign`
- [~] **3.2 Execute the fingerprint-slot stub.** Bind `mcp_tool_fingerprint` to <!-- deferred-resolution: carried-to=road-to-neighbours-that-pull-their-weight-carried -->
      `post_tool_use`, observe-only, per `agents/roadmaps/stubs/road-to-mcp-fingerprint-slot-binding.md`:
      its admissions-ledger row, `severity: advisory`, `fail_closed: false`, its three
      tests (first sighting silent, mutation reported, malformed input exit 0), the
      concern comment, then delete the stub. This raises the concern count, and
      the programme's growth claim does NOT cover that — corrected 2026-10-05, see
      the concern-count note under the blocker below.
      verify: fixture — the same foreign tool with a mutated description on the second call yields one context line and one ledger row

      **Attempted 2026-10-02, and the attempt refutes the step's premise.** The
      store digests `name`, `description` and `inputSchema`
      (`src/scripts/mcp_tool_fingerprint.ts:66-71`) and `recordFingerprint` takes an
      `McpToolDefinition`, not a tool call. A `post_tool_use` envelope carries
      `tool_name`, `tool_input` and `tool_response` — the CALL, never the
      DEFINITION. Verified from the dispatcher's own payload contract, whose two
      body classes are exactly `input` and `result`
      (`src/scripts/hooks/payload_stub.ts:20-70`), and by grepping every concern
      under `src/scripts/hooks/` for a description or schema key: there is none.
      Nothing else in the tree reads a third party's tool definitions either —
      `audit_mcp_tools.ts` and `build_mcp_catalog.ts` read THIS package's catalog,
      and `lint_mcp_config_security.ts` reads shipped config.

      The council of 2026-09-06 decided the pre-use-vs-post-use axis, which is a
      real trade-off and is correctly recorded in the stub. The axis it did not
      consider is whether the chosen slot can supply the module's input. Binding
      the concern anyway would produce a recorder that fires on every MCP call and
      records nothing — coverage on the manifest and in the admissions ledger with
      the observation floor still at zero, which is the stub's own
      "observe-only must never be cited as satisfying a preventive guarantee"
      failure one layer further down.

      **Deferred by decision D2 below, not parked.** This is a technical question
      and ADR-268 § 10 says a technical decision does not become owner-owned
      because it is hard, so it is decided here: the fingerprint store waits for a
      definition source, and the observation this slot CAN make is 3.3's name
      recorder. Revisit-if: a reader of third-party MCP tool descriptors exists in
      `src/scripts/`.

      **2026-10-06 execution of the revisit-if** (does not fire) — moved verbatim to `agents/evidence/analysis/neighbours-that-pull-their-weight-evidence-2026-10.md` § Step 3.2.

      **Iron Law 3, surfaced 2026-10-06 — NOT archived.** Every other step closed
      that day, so this `[~]` is now what holds the file open. Criterion: as written
      above. Blocker: D2 — no reader of third-party tool descriptors exists. The
      preserving dispositions are council-routed: carry into a follow-up, or merge
      into `stubs/road-to-mcp-fingerprint-slot-binding.md`, which already owns the
      binding. The archival sweep's automatic carry was run and reverted in this
      lane, because it rewrites inbound `verify:` paths in `road-to-leading-every-row`
      while another lane edits that file (D15's ground). Not resolved here; next
      run, or the owner.
- [x] **3.3 Foreign MCP servers counted by use.** `telemetry_usage_hook.ts` returns early
      for every non-`Skill` tool (`:250`), so a small recorder of foreign `mcp__*` tool
      names is new; the census gains distinct tools used per server in 30 days.
      Advertised counts stay `unknown` — nothing launches a server to ask.
      verify: fixture — the shipped `mcp-usage-observation` entry admits `mcp__acme__alpha` through `_concern_matches_tool` and is bound on every slot that binds `telemetry-usage` (`tests/scripts/neighbour_mcp_use.test.ts`)

      **Closed 2026-10-06 by the owner's option 3 (D12).** A separate
      `mcp-usage-observation` concern (`hooks/mcp_usage_observation_hook.ts`), no
      `tools:` key, no `needs_payload_bodies`, on the six `post_tool_use` rows; the
      branch left `telemetry-usage`. The verify line was rewritten as the struck
      oracle note asked: it now asserts the positive the old block asserted the
      negative of. Both seats' conditions ship — the header says default-on and
      opt-in-bypassing; a test proves names only, and another derives the keep-set
      from the shipped entry and stubs a marked envelope end to end. Ratified non-split
      by a two-seat council (`agents/evidence/ratifications/drain-neighbours-mcp-usage-observation.md`).
      `concern_count` 62 → 63 is claimed in the frontmatter. Three non-blocking
      council findings (receive-vs-persist wording, a name grammar and entry cap,
      the `effect: telemetry` qualifier) touch the manifest and the hook; applying
      them here was refused by the host's permission classifier as
      self-modification, so they are owner residue, recorded in the artifact.

      ~~**Not independent of Phase 1, which the phase split implied it was.** The
      verify line reads a `doctor neighbours` surface, and no such surface exists
      (`grep -rln neighbours src/ --include='*.ts'` names only unrelated modules).~~
      **Struck, not deleted: the claim was false when written and is kept so the
      correction below has something to point at.** The rest of that note stood —
      the census the step publishes into is built by 1.2, and the recorder half is
      independent of it.

      **What the grep got wrong.** `doctor neighbours` and
      `_lib/neighbour_census.ts` both existed at the time; the grep searched for a
      filename pattern the surface does not use. Phase 1 then added `origin`,
      `compat` and `also` to its skill entries, so the publishing half was there
      before this step started and only the recorder was missing.

      **Landed 2026-10-02 in three pieces.** `_lib/neighbour_tool_use.ts` holds the
      store contract — path, window, the tool-name parser and the reader — in one
      module both sides name. `telemetry_usage_hook.ts` writes it: the non-`Skill`
      early return now records an `mcp__*` name and its day first, rooted at the
      settings directory rather than the session cwd. `neighbour_census.ts` reads it
      and every `mcp_server` entry carries `tools_used_30d`, `tools_advertised:
      unknown` and the window it was counted over.

      **The slot's two halves, now both settled.** D2 above found that
      `post_tool_use` cannot supply a tool DEFINITION; this step is the observation
      that slot CAN make, and the pairing is deliberate — a name is not a
      fingerprint and the census never prints it as one. `tools_advertised` stays
      the literal `unknown` for the same reason: a denominator would need a
      handshake with a neighbour's process, and `0` therefore reads as "none
      observed", never as "none exist".

      **THE RECORDER DOES NOT RUN YET, AND THIS STEP IS REOPENED TO SAY SO.**
      It was marked `[x]` and merged in #2179 before this was found.
      `telemetry-usage` carries `tools: [Skill]` in `hook_manifest.yaml` — a
      per-concern dispatcher filter that was provable from the hook's source
      while `Skill` was its only branch surface. `_concern_matches_tool` matches
      EXACTLY, so no value of that key admits `mcp__<server>__<tool>`: the names
      are not enumerable. The dispatcher therefore skips the concern for every
      MCP call while every test above — all of which call `run()` directly —
      stays green. That is coverage on the manifest with the observation floor
      at zero, the failure 3.2's own deferral names one layer up.

      Removing the key was implemented and then REVERTED, because the manifest
      is a gated governance surface and the council split on it (2026-10-02,
      anthropic + openai, both seats answering): one `ratified` with conditions,
      one `refused` as implemented. They converged on the facts — it IS
      authority-expanding, so `confirmed-non-expanding` would be a false label;
      the "not telemetry" framing is a contested classification, not a fact; and
      a concern named `telemetry-usage` should not carry both opt-in network
      telemetry and default-on local collection — and on the alternative: a
      separately named concern receiving a dispatcher-reduced payload. A split
      is an escalation condition, not an approval, so the edit is held as the
      `mcp-recorder-unreachable-behind-the-tools-filter` blocker rather than
      landed on one seat's vote. What ships here is the correctness work the
      recorder needs either way, plus a test that asserts the gap and flips
      green when the blocker closes.

      **An independent reviewer over the whole delta found five more, and the
      two that mattered were in the matching itself.** Dispatched per
      `evaluator-independence` with a neutral prompt and no implementation
      context. (1) `serverSegment` maps every non-`[A-Za-z0-9_-]` character to
      `_`, so `Acme Inc. Tools` sanitises to `Acme_Inc__Tools` — a segment
      containing the separator — and a parser that split the tool name at its
      first `__` read the server as `Acme_Inc` and reported `0` for a server in
      daily use. That is the never-matched zero D10 exists to prevent,
      reintroduced one layer down. The parser is gone: matching is now driven by
      the KNOWN `.mcp.json` keys (`toolBelongsTo`), a finite candidate set that
      cannot be ambiguous. (2) The window compare is lexicographic, so
      `'TODO'`, `'unknown'` and `'hand edited'` all sorted ABOVE the cutoff and
      counted as in-window — a bad write reported MORE tools than were ever
      called. Values are now shape-checked, and a future date is rejected too.
      (3) The span was 31 days inclusive under a field named `tools_used_30d`.
      (4) Writer and reader rooted the store differently, so a monorepo whose
      `.mcp.json` sits under `packages/web` read `0`; both now resolve through
      one walk, pinned equal by a fixture rather than asserted. (5) The
      repeat-write test was a tautology — mtime never decreases and a third
      genuinely-writing call followed it, so it could not have failed if the
      skip were deleted; it now compares inode and mtime across the repeat
      alone. The hook's own "no directory creation" guarantee, which this step
      falsified, is narrowed in the same pass rather than left standing.

      **Measured against the bundle ceiling rather than asserted.**
      `check_hook_bundle_composition` read **1,549,697 B** of 1,550,000 before and
      **1,549,830 B** after — net +133 B, and `max_bytes` is untouched. The
      recorder as first written cost 669 B and went 366 over; three measured cuts
      in the same file brought it back: 475 B from moving the bundle guard to the
      call site (D11), 61 B from writing the store path as a literal instead of a
      top-level `path.join` whose `node:path` import outlived every tree-shaken
      function that used it, and ~190 B from moving one comment out of an argument
      list — esbuild strips a comment at module or statement level and PRESERVES
      one between call arguments, which is a per-byte fact this gate's own header
      does not state and the next author will otherwise rediscover.

      **Three 2026-10-05 notes** (seventh re-run, the weak verify oracle, the forward-looking window) — moved verbatim to `agents/evidence/analysis/neighbours-that-pull-their-weight-evidence-2026-10.md` § Step 3.3.
- [~] **3.4 Suggest `permissions.deny` for never-used foreign tools.** Deferred: writing a <!-- deferred-resolution: carried-to=road-to-neighbours-that-pull-their-weight-carried -->
      consumer's permission block is Class C and a product decision (K15).

      **Iron Law 3, surfaced 2026-10-06 — NOT archived.** A product decision
      (K15) on a Class C surface, so every disposition that drops or narrows it is
      the owner's; carrying it is council-routed and was not taken in this lane for
      the reason recorded under 3.2.

## Acceptance criteria

- Two same-named skills both appear on the route line, the foreign one qualified; our skills are unchanged.
- A neighbour skill failing the shape scan is never injected as a body.
- `neighbour-precedence` compiles, leaves `agent-authority.md` byte-identical, carries the provider-status paragraph and the prose-only list.
- `doctor neighbours --contradictions` prints a verdict table or `n/a` and changes no file.
- The stop-gate shadow row carries `set_by`; the fingerprint ledger gets one row on a mutated foreign tool and none on a stable one.

## Blockers

### blocker: mcp-recorder-unreachable-behind-the-tools-filter

- **Status:** resolved 2026-10-06 — option 3 landed (D12): `mcp-usage-observation` admits `mcp__acme__alpha`, the test asserting the gap now asserts the positive, and `agents/evidence/ratifications/drain-neighbours-mcp-usage-observation.md` records a non-split `ratified` (anthropic + openai)
- **Owner:** maintainer
- **Class:** 3
- **Ownership:** product-owned
- **Blocks:** step 3.3. The recorder, the store and the census field are all
  built, tested and merged (#2179, #2180); the dispatcher never calls them.
  `tools_used_30d` reads `0` on every install and will keep reading `0` until
  this closes, which is a number that looks like a measurement.
- **What to do:** `telemetry-usage` in `src/scripts/hook_manifest.yaml` carries
  `tools: [Skill]`. `_concern_matches_tool` (`src/scripts/hooks/dispatch_hook.ts`)
  matches EXACTLY — `names.includes(tool_name)`, no globbing — so the dispatcher
  skips the concern for every `mcp__<server>__<tool>` call, and no value of the
  key admits one because MCP tool names are not enumerable. Three shapes were
  identified; the last is the council's:
  1. **Remove the key.** One line. Implemented and reverted — see below.
  2. **Give the filter a prefix form.** Changes a dispatcher contract read by
     `lint_hook_manifest` and by every concern, and costs shared-hook-bundle
     bytes. ~~against a ceiling with 170 B of headroom~~ — **struck 2026-10-05:
     that figure is stale by two orders of magnitude and it is the number both
     option 2 and option 3 were priced against.** Re-measured at `e6b71933a`
     after `npm run build:hooks`:
     `./scripts-run src/scripts/check_hook_bundle_composition` ->
     `hook bundle: 1508987 B / 1550000 B ceiling, 287 modules`, i.e. **41,013 B
     of headroom**, not 170 B. The lanes that merged into `main` between
     2026-10-02 and 2026-10-05 took ~40.8 kB out of the bundle. Bundle bytes are
     therefore no longer the discriminator between these three shapes, and an
     owner choosing on the 170 B figure would be choosing on a tree that no
     longer exists.
     **Re-measured again 2026-10-06 at `0ea82b2b8` after `npm run build:hooks`:
     `hook bundle: 1515638 B / 1550000 B ceiling, 287 modules`, i.e. **34,362 B
     of headroom** — the third distinct figure in five days and the second
     correction to this one line. The conclusion is unchanged and is the only
     part worth carrying: bundle bytes do not discriminate between these three
     options at any of 170 B, 41,013 B or 34,362 B. The digits are kept only so
     a reader can see that each belongs to a different tree.**
  3. **A separately named concern** (e.g. `mcp-usage-observation`) with its own
     default-on local-observation semantics, receiving a dispatcher-reduced
     payload carrying only the tool name, and its own retention statement.
     Still a hook-plumbing edit, so still gated — but it is classified honestly
     rather than inheriting a telemetry concern's opt-in vocabulary.
     **A second lock sits under this option, measured 2026-10-05.** A new
     concern is +1 `concern_count`, and that metric's allowance is a hard zero:
     `grep -n 'concern_count: 0' -B8 src/scripts/check_estate_count.ts` quotes
     the reason in place — *"the concern axis joins `skill_count` in taking the
     claim path or nothing … it must not carry a per-change freebie"*. Live
     reading: `./scripts-run src/scripts/check_estate_count` ->
     `concern_count 62 (floor 62 at origin/main, +0)`. Step 3.2 of this roadmap
     said the programme's growth claim covers the rise; it does not — the
     `estate_growth_exempt` line in `road-to-leading-every-row.md:7` enumerates
     one programme file, six lanes, one parked file and the round's owner
     questions, and names no concern. So option 3 additionally carries an
     `estate_growth_exempt` claim for the concern, written into the frontmatter
     of whichever roadmap lands it, in that same diff. Options 1 and 2 do not
     raise `concern_count` at all. That is a real re-ordering of the three costs
     and it did not exist on the page the council read.
- **Why it is not an agent call:** `hook_manifest.yaml` is a gated governance
  surface and ADR-268 § 4 forbids an agent ratifying its own increase in power.
  Option 1 was implemented, put to the council on 2026-10-02 (anthropic +
  openai, both seats answering, subscription-authed, $0.00), and the council
  SPLIT: one `ratified` with conditions, one `refused` as implemented. They
  converged on everything except the verdict — it IS authority-expanding, so
  `confirmed-non-expanding` would be a false label; "the write is not telemetry"
  is a contested classification rather than a fact; a concern named
  `telemetry-usage` should not carry both opt-in network telemetry and
  default-on local collection; and option 3 is the right shape. A split is an
  escalation condition, not an approval, so the edit was reverted rather than
  landed on one seat's vote.
- **The fifth exit, looked for and reported as found-but-owner-reserved.**
  ADR-268 § 4's ratification ladder terminates in the owner *on
  non-convergence*, and non-convergence was measured for **option 1 only** — the
  council has never been asked about option 3, which both seats named as the
  right shape. A second council pass on option 3 is therefore an exit the ladder
  permits and this lane did not take, and that is a deliberate call rather than
  an oversight: option 3 is one of three options this blocker hands to the
  owner by name, both seats agreed the edit IS authority-expanding, and an agent
  picking among an owner's own enumerated set is the owner-reserved dimension
  the same § 4 ladder names beside non-convergence. What this run did instead is
  re-price the set, because the exit is only worth taking on correct numbers:
  the 170 B bundle figure was wrong by 41 kB and option 3 carries an estate claim
  nobody had written down. Both corrections are above.
- **Recommendation:** take option 3, and carry the two conditions both seats
  asked for: state plainly in the concern's own text that local neighbour-usage
  measurement is default-on and bypasses the telemetry opt-in, and ship a test
  proving the store holds tool NAMES only — no arguments, no responses, no
  session id. Option 1 remains defensible if the rename is judged not worth a
  new concern, but it needs a second council pass, not this one's split.
- **If you do nothing:** the census prints `tools_used_30d: 0` for every
  neighbour on every install, indistinguishable from a neighbour nobody uses.
  The cost is standing rather than compounding — the field is honest about being
  an observation floor, and the text surface prints `advertised: unknown` beside
  it — but it is the instrumentation artifact this step exists to replace.
- **Resolved when:** `_concern_matches_tool` admits `mcp__acme__alpha` for
  whichever concern owns the recorder, which the test
  `the recorder is NOT reachable through the dispatcher` in
  `tests/scripts/neighbour_mcp_use.test.ts` asserts the negative of today — it
  flips when this closes — AND a ratification artifact under
  `agents/evidence/ratifications/` records a non-split verdict for the manifest
  edit that does it.
- **2026-10-06 eighth reading and the no-second-council note** — moved verbatim to `agents/evidence/analysis/neighbours-that-pull-their-weight-evidence-2026-10.md` § Blocker.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | the source order of step 2.1, below the four bands of `src/rules/agent-authority.md`: the current-turn instruction → `agents/overrides/` → the project's own instruction files and `agents/` folder → this suite's routed guidance → a neighbour skill body the agent explicitly invoked → a neighbour's always-on text → a neighbour skill body merely discoverable → a neighbour MCP tool description; a project file may replace, override or extend workflow and never lower a floor of the four bands; the project file wins ties and the agent names what it followed; overlapping neighbour skills stay visible (D13, K16). The order presumes no project-local install of this suite — one global install is preferred | owner answers 2026-10-06 to programme blocker b6 limbs (i) and (ii) (`road-to-leading-every-row` D5 and the b6 record); council 2026-10-06 split on (i), unanimous on the safety-floor clause, both openai seats separating injection level from specificity for (ii) | a project file is observed lowering a floor through this order, or an invoked neighbour skill is observed overriding a project instruction it should not |
| D2 | reversible-technical | agent | the fingerprint store is not bindable at `post_tool_use`; the slot's concern is 3.3's foreign-tool-NAME recorder, and the store waits for a definition source | `mcp_tool_fingerprint.ts:66-71` digests `name`/`description`/`inputSchema`; the envelope carries `tool_input` and `tool_response` only (`payload_stub.ts:20-70`), and no concern under `src/scripts/hooks/` reads a description or schema key | a reader of third-party MCP tool descriptors exists in `src/scripts/`, at which point the session-start slot is the candidate, not this one |
| D2 | deterministic | evidence | no static contradiction detector | `rule-interactions.md:18-29` — 67 % false positives | a detector is measured below 20 % |
| D3 | reversible-technical | agent | scan with the existing `security_lint` shapes | `_lib/security_lint.ts` is the corpus scanner | a planted fixture slips through |
| D4 | reversible-technical | evidence | fingerprint observe-only on `post_tool_use` | the stub's council record, 2026-09-06 | the stub's owner record chooses refusal |
| D5 | deterministic | evidence | source precedence sits below the four bands, never beside them | `agent-authority.md:12-26` "Hard Floor wins, always"; the second author's eight-band order put the user's turn above the floor (K26) | the band table is superseded |
| D6 | reversible-technical | agent | a tree with NO installed-tools manifest qualifies nothing — every skill resolves `package` and the route line is byte-identical to before 1.1 | nothing on disk records a claim there, so a `home:` prefix would be a guess printed in the shape of a fact; the authored `src/skills` is the one exception and is a construction, not a guess | a second artifact records what this package wrote, at which point absence of the manifest stops meaning absence of evidence |
| D7 | reversible-technical | agent | the ranker reads a WRITTEN scan verdict rather than running the shape checks itself | the four linters plus `node:child_process` would be inlined into the shared hook bundle, which `check_hook_bundle_composition` caps; measured, the split keeps every one of them out and the census CLI is the only producer | the scan becomes cheap enough to run per prompt, or the bundle stops being shared |
| D8 | reversible-technical | agent | `skill_origin.ts` parses the installed-tools manifest itself instead of reusing `readRecordedHashes` | measured 1,706 bytes of the shared hook bundle for a hash map whose keys are the whole requirement; two of the three existing readers already parse it directly because the shared one drops the nested `files[]` rows | the shared reader gains a paths-only accessor, or the bundle stops being size-capped |
| D9 | reversible-technical | agent | 3.3's store is local-only under gitignored `agents/runtime/`, and is NOT gated on the telemetry opt-in | it feeds `doctor neighbours`, a report the consumer runs on their own tree — no transport reads it and the Class-A spool never sees it. Gating it on an org switch would print `0` on every install that never enabled one, which is the same instrumentation artifact the usage hook's own header records from the collector it replaced. What is recorded is a tool NAME the consumer's `.mcp.json` already lists — no arguments, no responses, no session id | a transport is ever pointed at this file, at which point it becomes a telemetry surface and inherits that gate |
| D10 | reversible-technical | agent | a server is matched on its SANITISED segment, both sides, not on the raw `.mcp.json` key | hosts rewrite the key before embedding it — `claude.ai Claude Docs` arrives as `mcp__claude_ai_Claude_Docs__…`. An exact-key match reports `0` for every server whose name carries a dot or a space, and a reader cannot tell that zero from "never used" | a host is observed embedding a key under a different transformation than `[^A-Za-z0-9_-] -> _` |
| D12 | product-owned | owner | option 3: a separately named, default-on local-observation concern (`mcp-usage-observation`) receives a dispatcher-reduced payload carrying the tool name only; its own text states that it bypasses the telemetry opt-in, a test proves the store holds tool names only (no arguments, responses or session id), and the diff that adds it carries an `estate_growth_exempt` claim for `concern_count` and a ratification artifact for the manifest edit | owner answer 2026-10-06 to blocker `mcp-recorder-unreachable-behind-the-tools-filter`; council 2026-10-02 (anthropic + openai) split on option 1 and named option 3 the right shape; re-priced 2026-10-05: 41,013 B bundle headroom, `concern_count` allowance 0 | the concern's store is found to hold more than tool names, or a host starts exposing MCP usage itself |
| D13 | contested-technical | council:leading-every-row-blockers-2026-10-06 | **overlapping neighbour skills stay visible — K16 stands.** This half of programme blocker b6 is answered; the rank order is the other half and stays at D1 | Two AI-council passes 2026-10-06 (anthropic `claude-sonnet-4-5` + openai `codex-default`, 3 and 2 rounds, subscription transport, $0 billed): no seat across the four opinions argued for hiding, and three argued to preserve K16 explicitly — hiding a skill the consumer deliberately installed makes their install silently inert, which is the ground K16 already recorded. Option (c) of b6 (reverse K16) is therefore not taken. The seats differed on whether *visibility* was owner-reserved, not on what the answer is; it is recorded as council-resolved because the enumerated owner-reserved set contains no row it matches — it lowers no floor, is reversible, creates no external commitment, and is bounded by evidence already in the tree | a consumer-facing measurement shows a visible overlapping neighbour skill degrades routing, at which point the cost is a number rather than a prediction |
| D14 | reversible-technical | agent | the two neighbour-census caches are IGNORED where they are written, not relocated to `agents/runtime/` where D9 puts the sibling store | `doctor neighbours` writes `neighbour-overlap.json` and `neighbour-scan.json` into TRACKED `agents/reports/`; the overlap cache carries each neighbour skill's absolute path under the user's home directory and the scan cache their whole installed-skill inventory, and no ignore rule covered either. Relocating is the shape D9 implies, but `SCAN_CACHE_RELATIVE` in `_lib/skill_origin.ts` is bundled on the hook path, so a path change is a bundle-ceiling plus cache-invalidation question rather than a bounded fix. Measured both directions: `git check-ignore` exit 1 before and 0 after, with `agents/reports/README.md` still exit 1 so the fix is not over-broad; `check_gitignore_freshness` reds naming the exact path when one block line is deleted | this lane reopens for a reason that already edits `skill_origin.ts` |
| D15 | reversible-technical | agent | the roadmap stays ACTIVE rather than moving to `later/`, although 100 % of its open work is owner-gated | the `later/` contract requires migrating inbound refs to the new path, and two LIVE `verify:` clauses in `road-to-leading-every-row.md` (`:131`, `:172`) grep this file at its active path, in a roadmap another lane of this same drain is editing concurrently — so the move would break a sibling's exit conditions and collide with a run under way. b6 was also narrowed on 2026-10-06, the same day, which is the opposite of a question that has gone quiet. The cost of staying active is that `/roadmap:process-*` keeps picking a file with nothing agent-doable in it, and that cost is paid by this record rather than hidden | b6 limb 1 is still unanswered at the next drain AND `road-to-leading-every-row` has landed, at which point the inbound refs are stable and the park is cheap |
| D11 | reversible-technical | agent | `telemetry_usage_hook.ts`'s bundle guard moves from the top of `_isCliEntry` to its call site | measured: inside the function esbuild folds the define to `if (true) return false` and still emits the nine unreachable lines after it — 475 B of dead code in a bundle `check_hook_bundle_composition` caps at 1,550,000. At the call site the statement folds to `if (false)`, which is dropped, and the unreferenced function with it. Behavior outside the bundle is identical: `__AGENT_CONFIG_BUNDLE__` is undeclared there, the first operand short-circuits, and `!__AGENT_CONFIG_BUNDLE__` is never evaluated | esbuild starts eliminating the dead tail on its own, at which point the guard can move back and ~45 other hook files become the same saving |
| D16 | reversible-technical | agent | step 2.1's ~800 tok rule is paid by an OFFSETTING REDUCTION in the same diff, not a grant | `check_preamble_payload_budget` sat at zero headroom and a grant needs an owner-verified platform approval event. Moved verbatim, each leaving a pointer: `fix-what-you-see`'s two rationale sections → `active-remediation-mechanics`, and `token-budget-discipline`'s candidate table and size-band reasoning → `size-and-scope`; the new rule was cut to the order, the completion paragraph and the effects table. Measured 136,801 tok against a 136,826 ceiling. A third offset (`session-canary`'s enforcement prose) was refused by the host's permission classifier and not pursued | the bucket gains headroom, or a rule moved here is found to need its moved prose in the always-loaded text |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/lane-neighbours-pull-weight-20261006 -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The precedence rule is read as permission to ignore a neighbour | product | "The project file wins" is one reading away from "skip the neighbour". | 2.1 requires naming the followed instruction; D1 forbids suppression; 2.2 shows which rank won. | Phase 2 — One stated order, no detector |
| 2 | The precedence rule is read as a guarantee | product | A prose rule cannot outrank a neighbour's prose; the model follows what it follows. | 2.3 lists every non-negotiable with its enforcing effect and marks the rest `prose-only`. | Phase 2 — One stated order, no detector |
| 3 | The overlap pass slows the route hook | implementation | Pairwise over the corpus on every prompt is not a hook-budget shape. | 1.2 runs once per census and caches by digest; the route reads the cache. | Phase 1 — A route line that says where the skill came from |
| 4 | The shape scan cripples a legitimate neighbour skill | product | Shell snippets can be an installer skill's whole point. | The skill still ranks by name with the finding visible. | Phase 1 — A route line that says where the skill came from |
| 5 | `set_by` misattributes our own refusal | implementation | A crashed hook that recorded nothing makes the next stop look foreign. | A missing previous record writes `unknown`, counted separately. | Phase 3 — The gate and the fingerprint know a neighbour acted |
| 6 | A hook is bound to a slot that cannot supply its input | implementation | Observed, not hypothesised: 3.2's council chose `post_tool_use` without checking that the envelope carries a tool definition, and it does not. A recorder bound there would publish coverage and record nothing. | Decision D2 records the finding and what the slot can carry instead; the step is deferred with its revisit-if rather than bound to a slot that cannot feed it. | Phase 3 — The gate and the fingerprint know a neighbour acted |
| 7 | A step reads as one answer away from landing when a second, unrelated gate would stop it | implementation | Measured 2026-10-05: an answer to `b6-neighbour-precedence` unblocks 2.1's content and leaves `check_preamble_payload_budget` at exactly its ceiling, where a ten-byte rule file reds the gate. A reader of the `blocked-by` marker alone would plan for one lock. | The phase-level note above Phase 2 prices the second lock with the probe that measured it and names the gate's own two sanctioned exits; the same pattern is applied to option 3 of the blocker, where `concern_count` has a zero allowance. | Phase 2 — One stated order, no detector |
| 8 | A cost figure in a blocker goes stale and an owner decides on a tree that no longer exists | product | The blocker priced three options against a hook bundle with 170 B of headroom; three days later the measured figure was 41,013 B, which removes bundle bytes as the discriminator entirely. | Both figures are carried in place with the command that produced each, struck rather than overwritten, so the next reader can see which tree each belongs to; the re-run note on 3.3 restates every blocking condition as an executed command with a control. | Phase 3 — The gate and the fingerprint know a neighbour acted |
| 9 | A lane's own local cache is written into a tracked directory and leaks the consumer's home path | implementation | Observed, not hypothesised: Phase 1 cached `neighbour-overlap.json` and `neighbour-scan.json` under `agents/reports/`, where every other file is a committed report — so the normal act of staging that directory publishes each neighbour skill's absolute path under the user's home directory. The lane's own D9 had already chosen gitignored `agents/runtime/` for the sibling store, so the inconsistency was internal to one lane's output. | Both paths ship in `src/config/gitignore-block.txt` and in the repository `.gitignore`; `check_gitignore_freshness` is the backstop and its sensitivity to exactly these two lines was measured. D14 records why the containment is an ignore entry rather than the relocation D9 implies. | Phase 1 — A route line that says where the skill came from |
