---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
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

- [ ] **2.1 A projected rule `neighbour-precedence` below the four authority bands.** It
      leaves `src/rules/agent-authority.md:12-26` untouched — those bands govern autonomy,
      and the current-turn instruction never lifts band 1 — and orders *instruction
      sources* beneath them: the current-turn instruction → `agents/overrides/` → the
      project's own instruction file → this suite's routed guidance → a neighbour's
      always-on text → a neighbour skill body → a neighbour MCP tool description. Ties go
      to the project file; the agent names which instruction it followed, once per turn.
      One paragraph: a neighbour's completion signal is a provider status, never this
      suite's completion, which stays with the stop gate's detectors.
      <!-- blocked-by: b6-neighbour-precedence | asked: no — programme blocker, inbox round authored without the owner present -->
      verify: `./scripts-run src/scripts/compile_router` -> 0 and `grep -c 'neighbour-precedence' dist/router.json` -> /[1-9]/
- [ ] **2.2 Contradiction review on demand, council-seated, report-only.**
      `doctor neighbours --contradictions` forms candidate pairs only from strong signals —
      a shared subject noun with opposite modality, or a name collision from 1.2 — and
      hands them to one council seat with 2.1 as the rubric. Output `pair | verdict |
      which wins by 2.1`; it never edits or gates, and prints `n/a — no council configured`
      when `council:status` says so.
      verify: fixture — "spawn agents and wait" against "never end a turn waiting" yields one pair naming the project line
- [ ] **2.3 Non-negotiables are effects.** Every obligation this suite means to hold
      against a neighbour is listed with its enforcing effect (a fail-closed `permission`
      concern or the stop gate's refusal); an obligation with no such effect is listed as
      `prose-only — may be outvoted`. The list is a section of 2.1's rule.
      verify: `grep -c 'prose-only' src/rules/neighbour-precedence.md` -> /[1-9]/

## Phase 3 — The gate and the fingerprint know a neighbour acted

- [x] **3.1 Record who set `stop_hook_active`.** Extend the existing shadow row
      (`turn_end_gate_hook.ts:1332`, `layer: stop_hook_active`) with
      `set_by: ours | foreign | unknown` — `ours` iff our previous stop of the session
      refused, `unknown` when that record is missing. No new record kind; serialised with
      the stop-gate lane's Q1 window. `corrected-from-reproduction`.
      verify: fixture — a stop with `stop_hook_active` and no prior refusal of ours writes `set_by: foreign`
- [~] **3.2 Execute the fingerprint-slot stub.** Bind `mcp_tool_fingerprint` to
      `post_tool_use`, observe-only, per `agents/roadmaps/stubs/road-to-mcp-fingerprint-slot-binding.md`:
      its admissions-ledger row, `severity: advisory`, `fail_closed: false`, its three
      tests (first sighting silent, mutation reported, malformed input exit 0), the
      concern comment, then delete the stub. This raises the concern count, which the
      programme's growth claim covers.
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
- [x] **3.3 Foreign MCP servers counted by use.** `telemetry_usage_hook.ts` returns early
      for every non-`Skill` tool (`:250`), so a small recorder of foreign `mcp__*` tool
      names is new; the census gains distinct tools used per server in 30 days.
      Advertised counts stay `unknown` — nothing launches a server to ask.
      verify: `agent-config doctor neighbours --json` -> /"tools_used_30d":\s*[0-9]+/

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

      **A fourth piece the step did not anticipate, and the unit tests could
      not have caught.** `telemetry-usage` carried `tools: [Skill]` in
      `hook_manifest.yaml` — a per-concern dispatcher filter that was provable
      from the hook's source while `Skill` was its only branch surface.
      `_concern_matches_tool` matches EXACTLY, so no value of that key admits
      `mcp__<server>__<tool>`: the names are not enumerable. Left in place the
      dispatcher skips the concern for every MCP call and the recorder is
      unreachable while every test above — all of which call `run()` directly —
      stays green. That is coverage on the manifest with the observation floor
      at zero, which is the failure 3.2's own deferral names one layer up. The
      key is removed, and a test pins the shipped entry against an `mcp__` name
      with a negative control that re-adds `[Skill]` and watches it go red.

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
- [~] **3.4 Suggest `permissions.deny` for never-used foreign tools.** Deferred: writing a
      consumer's permission block is Class C and a product decision (K15).

## Acceptance criteria

- Two same-named skills both appear on the route line, the foreign one qualified; our skills are unchanged.
- A neighbour skill failing the shape scan is never injected as a body.
- `neighbour-precedence` compiles, leaves `agent-authority.md` byte-identical, carries the provider-status paragraph and the prose-only list.
- `doctor neighbours --contradictions` prints a verdict table or `n/a` and changes no file.
- The stop-gate shadow row carries `set_by`; the fingerprint ledger gets one row on a mutated foreign tool and none on a stable one.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | PENDING programme blocker b6 — proposed: the source order of 2.1, neighbours visible | ADR-124 doctrine; programme blocker b6 | the owner answers b6 differently |
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
| D11 | reversible-technical | agent | `telemetry_usage_hook.ts`'s bundle guard moves from the top of `_isCliEntry` to its call site | measured: inside the function esbuild folds the define to `if (true) return false` and still emits the nine unreachable lines after it — 475 B of dead code in a bundle `check_hook_bundle_composition` caps at 1,550,000. At the call site the statement folds to `if (false)`, which is dropped, and the unreferenced function with it. Behavior outside the bundle is identical: `__AGENT_CONFIG_BUNDLE__` is undeclared there, the first operand short-circuits, and `!__AGENT_CONFIG_BUNDLE__` is never evaluated | esbuild starts eliminating the dead tail on its own, at which point the guard can move back and ~45 other hook files become the same saving |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: claude/drain-neighbours-pull-weight -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The precedence rule is read as permission to ignore a neighbour | product | "The project file wins" is one reading away from "skip the neighbour". | 2.1 requires naming the followed instruction; D1 forbids suppression; 2.2 shows which rank won. | Phase 2 — One stated order, no detector |
| 2 | The precedence rule is read as a guarantee | product | A prose rule cannot outrank a neighbour's prose; the model follows what it follows. | 2.3 lists every non-negotiable with its enforcing effect and marks the rest `prose-only`. | Phase 2 — One stated order, no detector |
| 3 | The overlap pass slows the route hook | implementation | Pairwise over the corpus on every prompt is not a hook-budget shape. | 1.2 runs once per census and caches by digest; the route reads the cache. | Phase 1 — A route line that says where the skill came from |
| 4 | The shape scan cripples a legitimate neighbour skill | product | Shell snippets can be an installer skill's whole point. | The skill still ranks by name with the finding visible. | Phase 1 — A route line that says where the skill came from |
| 5 | `set_by` misattributes our own refusal | implementation | A crashed hook that recorded nothing makes the next stop look foreign. | A missing previous record writes `unknown`, counted separately. | Phase 3 — The gate and the fingerprint know a neighbour acted |
| 6 | A hook is bound to a slot that cannot supply its input | implementation | Observed, not hypothesised: 3.2's council chose `post_tool_use` without checking that the envelope carries a tool definition, and it does not. A recorder bound there would publish coverage and record nothing. | Decision D2 records the finding and what the slot can carry instead; the step is deferred with its revisit-if rather than bound to a slot that cannot feed it. | Phase 3 — The gate and the fingerprint know a neighbour acted |
