---
complexity: structural
status: ready
tree_pin: 811cea61d6
review_by: 2026-12-21
execution:
  mode: autonomous
estate_growth_exempt: "Owner-requested on 2026-11-21: the owner asked for one roadmap per P0 and P1 measure of the session retro of the same day, to be planned and worked through. This file carries measures 8 and 21. No active, later, stub or archived roadmap owns a per-episode ledger over session transcripts: roadmap:context over 1294 roadmap files found four keyword hits, all on a different subject (see relates)."
estate_offset_exempt: "Created in an authoring run that archives no roadmap, so no disposed file is available as an offset. The nearest owner of the subject, archive/road-to-delivered-cost-truth, is already closed and is extended here, not reopened. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-delivered-cost-truth
    relation: extends
    note: "archive/. Built the static side: payload delivered per session and per asset (_lib/config_cost.ts, _lib/asset_delivery_ledger.ts) and the effect probe. This file adds the observed side (what a control cost the owner when it fired) and reuses its per-asset payload as the delivery column of 3.1."
  - slug: road-to-inbox-harvest-2026-08-b-ledger-truth
    relation: disjoint
    note: "archive/. Served-model truth and price-table agreement for agents/cost-tracking rows. This ledger reads token usage from transcripts through cc_transcript.ts and never writes a cost-tracking row."
  - slug: road-to-per-pack-cost-delta-emitter
    relation: disjoint
    note: "stubs/. Per-PR, per-pack payload delta for a PR comment. Static payload by pack, not observed cost by control."
  - slug: road-to-reach-cost-primary-bench
    relation: disjoint
    note: "later/. A benchmark on research token cost of the reach surface. No session transcripts, no controls."
  - slug: the-14-21-0-ledger-is-ingestible
    relation: disjoint
    note: "stubs/. Release findings ledger ingestion. Shares only the word ledger."
  - slug: road-to-a-lite-profile-pilot
    relation: disjoint
    note: "Added in the same authoring run (measure 16). It may read this ledger's by-control view to compare a lite and a full profile; this file builds the ledger and decides nothing about profiles."
---
# Road to an episode ledger with cost per control

> **Source:** the owner's session retrospective of 2026-11-21 over about 380
> Claude Code sessions in all local profiles (643 incidents in 23 chunks, three
> audits), and the AI council round of the same day (analysis mode, one round,
> members anthropic `claude-sonnet-4-5` and openai `codex-default`, 2 of 2
> answered, $0 billed). This file carries the retro's measures **8** (a
> deduplicated episode list per session with active configuration, triggering
> control and owner cost; each blockage traced through profile, rule precedence,
> host permission and the deciding hook) and **21** (cost per rule in money and
> hours). The council's convergence, inlined: the openai seat named the missing
> deduplicated, traceable session-level evidence as the retro's blind spot and
> asked for blocked actions to be traced to the control that decided them; the
> anthropic seat asked for a cost measurement in dollars. The owner's own verdict
> in the retro: the claim that permission, ceremony and budget rules cost more
> than they bring is a **hypothesis** until this ledger measures it.

## Goal

One command, `agent-config sessions:episodes`, reads the Claude Code transcripts
of every local profile and writes a local, gitignored ledger. Each row is one
deduplicated episode: a run of blocked tool calls on the same control. A row
carries the active configuration, the deciding layer and control, the trace
(profile → rule precedence → host permission → deciding hook) and the owner cost
(turns, minutes, billable tokens). A `--by-control` view sums cost per control.
A command, `/analyze:sessions`, runs the whole retro again with this ledger as
its deduplicated denominator. The ledger holds no prompt or reply text, and no
part of it is written by hand.

## Context

- **Why the retro could not answer its own question.** Its counts describe
  extracted chunks, not episodes. Several chunks can show one episode, so the
  107 rule-and-hook friction incidents are lower bounds with no ranking. The
  retro had to downgrade its central conclusion to a hypothesis for that reason.
- **The transcript already records the blockage classes (measured 2026-11-21,
  46 main transcripts of this repository in the `MathiasB` profile):**
  `tool_result` records with `is_error: true` include 87 `PreToolUse:<Tool> hook
  error:` (package hook deny), 22 `Permission for this action was denied by the
  Claude…` (host classifier), 21 `This session is isolated in the worktree`
  (host worktree guard), 3 `doesn't want to proceed with this tool use` (owner
  rejection), and 251 plain `Exit code 1` (a failure, not a block). The 87 hook
  denies carry the deciding guard's own message: 45 of them are the
  speaking-inbox-dir guard, which names `src/rules/source-confidentiality.md`.
- **Hook time is recorded too.** 1,351 `hook_success` attachments carry
  `hookName`, `exitCode` and `durationMs`, 543 s in total in the same store.
  `src/scripts/_lib/main_session_census.ts:8`, `:111` already reads these
  attachments.
- **Substrate that exists and is reused, not rebuilt:**
  `src/scripts/_lib/cc_transcript.ts:8` (billable input = input + cache read +
  cache creation, and replay dedup for resumed sessions);
  `src/scripts/_lib/session_catalog.ts:72`, `:450` (every profile on the
  machine, including agent-switch profiles); `src/scripts/_lib/transcript_reads.ts`
  (one `.jsonl` file is one leg); `src/scripts/retro_facts.ts` (a field is
  `measured`, `missing` or `not-applicable`, and a missing field is never 0);
  `src/scripts/routing_trace_ledger.ts:12` (prompt text stays on the machine,
  the ledger is gitignored, an export carries hashes only).
- **Where the dispatcher stops.** `src/scripts/hooks/dispatch_hook.ts:934`
  `_record_rule_trips` counts block and warn per concern into
  `agents/runtime/state/rule-trips.json`, with no session, tool call or time.
  So the deciding concern cannot be joined to an episode from it.
  `dispatch_hook.ts` sits at 1,500 lines, the source budget's cap
  (`hooks/concern_timings.ts` header records the same refusal), so any new
  per-trip record has to live in a sibling module.
- **The currency constraint.** `src/scripts/check_no_currency_in_cost_surfaces.ts:39`
  bans currency on four named cost surfaces, because the suite does not know a
  consumer's contract. Measure 21 asks for dollars. Step 3.2 settles this by
  council. The ban is not widened or bypassed silently.
- **What `/retro` is and is not.** `src/domains/meta/retro/command.md` draws at
  most one durable learning from one merged PR or session. It has no episode
  ledger and no per-control cost. This file does not change it.
- **Unverified:** the retro's raw per-chunk journal named in the run input was
  not present on disk when this file was written. Every count above was
  re-measured from transcripts, not taken from it.

## Phase 1 — Episodes from transcripts

- [ ] **1.1 Write the failing fixture test first.** Add
      `tests/scripts/session_episodes.test.ts` with synthetic transcripts: a
      main leg, a resumed leg that replays three of its turns, and a subagent
      leg. Together they cover the five classes from Context: hook deny, host
      classifier, worktree guard, owner rejection, plain failure. Expected: plain
      failures produce no episode. Consecutive blocks on one control in one leg
      are one episode. Replayed turns are not counted twice.
      verify: `npx vitest run tests/scripts/session_episodes.test.ts` fails on
      the missing module, and on nothing else.
      uses: test-driven-development
- [ ] **1.2 Implement `src/scripts/_lib/session_episodes.ts`.** Discover legs
      through `session_catalog.ts`. Dedup turns through `cc_transcript.ts`.
      Classify blocked `tool_result` records into `hook-deny`,
      `host-permission`, `host-worktree`, `owner-reject`. The episode key is
      leg id + first blocked `tool_use_id`, and stays stable across reruns.
      verify: the 1.1 test passes, and two runs over one fixture give
      byte-identical JSON.
- [ ] **1.3 Owner cost per episode, test-first.** Add fixture cases, then the
      fields. `owner_turns` counts human turns from the first block to the next
      successful call of the same tool, or to the end of the leg. `minutes`
      comes from record timestamps. `owner_ran_it` is set when the owner ran the
      command in bash input mode. `billable_tokens` uses the `cc_transcript.ts`
      metric. An unresolved episode reads `resolution: unresolved`. A field the
      transcript lacks is `missing`, never 0.
      verify: the fixture with no resolving call reports `unresolved`, and the
      fixture with no timestamps reports `minutes: missing`.
- [ ] **1.4 Active configuration per episode, test-first.** Record the profile
      (`CatalogProfile` from `session_catalog.ts`), the rule files from the
      leg's first `instructions` attachment (the reader in
      `main_session_census.ts`), and the hook names from `hook_success`
      attachments in that leg. Before writing the field, check one real
      transcript for a package version. If none is recorded, the field is
      `missing`, with that reason.
      verify: a fixture test asserts all three fields. A fixture with no
      `instructions` attachment yields `missing`, not an empty list.

## Phase 2 — Trace each blockage to the control that decided it

- [ ] **2.1 Generate the control fingerprint table.** Add
      `src/scripts/generate_control_fingerprints.ts`. It extracts each blocking
      concern's deny-message constants and its rule link from
      `hooks/concern_registry.ts` and `src/scripts/hook_manifest.yaml`, and
      writes a generated JSON. Wire a drift check into `task ci`. No row is
      written by hand.
      verify: a test regenerates the table into a temp dir and compares it with
      the committed file, and the CI drift task exits 0 on a clean tree.
- [ ] **2.2 Measure attribution coverage on the local stores.** Run the
      attribution over every `hook-deny` episode on this machine and print
      `attributed / total`, with the unattributed messages hashed.
      verify: the command prints both numbers and exits 0. A run that finds no
      `hook-deny` episode prints that as an honest null.
- [ ] **2.3 Close the residual, council first.** Below 95 % coverage in 2.2,
      run `/council` on these options as the step's first action: (a) a per-trip
      JSONL row (session id, tool use id, concern, exit code) written from a
      sibling module, since `dispatch_hook.ts` is at its line cap; (b) a stable
      machine tag in each deny message; (c) keep the residual as
      `unattributed`. Record the verdict as D4. Implement it test-first. At or
      above 95 %, record D4 as option (c) with the measured figure.
      verify: D4 is in `## Decisions`, and its chosen path has a passing test.
- [ ] **2.4 Build the trace chain, test-first.** Each episode gets
      `trace: {profile, rule, host_permission, deciding_layer, control}`.
      `rule` is the rule file the deciding concern links in the 2.1 table.
      `host_permission` is the matching allow or deny entry from that
      profile's current `settings.json`, labelled `as-of-analysis`, because
      transcripts do not record historical settings.
      verify: fixture tests cover one episode per deciding layer, and a
      `host-permission` episode with no matching entry reports `no-rule-matched`.

## Phase 3 — Cost per control

- [ ] **3.1 Write the `--by-control` aggregation, test-first.** Per control:
      episodes, distinct sessions, owner turns, minutes, billable tokens,
      unresolved count, and delivery payload per session from
      `_lib/asset_delivery_ledger.ts`. Add a benefit proxy: `held` (the
      agent changed approach and the owner did not reissue the action) against
      `overridden` (the owner reissued it, ran it, or set a bypass variable).
      The output labels it `proxy, descriptive of the measured traffic`.
      verify: a fixture with two controls produces exact sums, and the proxy
      label is in both the JSON and the text output.
- [ ] **3.2 Settle the money column by council (measure 21).** First action:
      `/council` on (a) tokens only; (b) a USD list-price equivalent, priced
      through `_lib/price_freshness.ts` refusal rules and labelled `list-price
      equivalent, not billed`; (c) (b) behind a flag. Include the rationale at
      `check_no_currency_in_cost_surfaces.ts:39`. Record the verdict as D5. If
      the council escalates it as product-owned, file a `## Blockers` entry
      with `Routed:` and ship tokens only until it resolves.
      verify: D5 or the blocker exists, and a test pins the chosen output shape.
- [ ] **3.3 Report time in hours per control, with no hourly rate.** Show
      `minutes` summed to hours, labelled as wall-clock spans between records.
      Do not convert time to money.
      verify: a grep of the by-control output for a currency marker returns
      nothing on the time columns.

## Phase 4 — A repeatable command

- [ ] **4.1 Add the CLI `agent-config sessions:episodes`.** Flags: `--since
      <day>`, `--profile <name>`, `--by-control`, `--json`. Register it in the
      CLI dispatcher the way `sessions_catalog_cli.ts` is registered. Write
      under `agents/runtime/state/episodes/`. Confirm with `git check-ignore`
      that the path is ignored before the first write.
      verify: a test runs the CLI on the fixtures, then greps the output for
      each fixture prompt and reply string. It finds 0 matches.
- [ ] **4.2 Add `/analyze:sessions`.** First check that no command already has
      that name. The command runs `sessions:episodes`, condenses the
      transcripts, spreads incident extraction over subagents by chunk,
      synthesizes against the ledger's deduplicated counts, and runs one
      `/council` analysis round. Every input is generated from transcripts. The
      command takes no owner-written context.
      verify: `./scripts-run src/scripts/lint_commands` (or the command linter
      `task ci` runs) exits 0 on the new file, and `task sync` regenerates the
      projections.
      uses: command-writing
- [ ] **4.3 Document the contract.** Add `docs/contracts/session-episodes-v1.md`
      with the row schema, the five classes, the episode key, the privacy floor,
      and the `as-of-analysis` limit of `host_permission`. Link it from both
      surfaces.
      verify: `task check-refs` (or the reference checker `task ci` runs) exits
      0.
- [ ] **4.4 Dogfood on this machine.** Run `agent-config sessions:episodes
      --by-control` over all local profiles. Write the generated report to
      `agents/evidence/analysis/session-episodes-first-run.md`, using the
      command's own `--report` output. Name the top five controls by owner
      minutes, and state the profile and transcript count measured.
      verify: the report exists, its numbers match a second `--json` run, and it
      states its scope as one machine's traffic.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | The ledger stays local and gitignored. It stores hashes and control names, never prompt or reply text. | `routing_trace_ledger.ts:12` precedent; transcripts hold owner prose | the owner asks for an export that leaves the machine |
| D2 | reversible-technical | agent | Episodes come from transcripts in a batch, not from a new recording hook. | the five classes are in transcripts (Context counts); `dispatch_hook.ts` is at 1,500 of 1,500 lines | 2.3 chooses a per-trip record, which then joins in alongside transcripts |
| D3 | reversible-technical | agent | Benefit is a held/overridden proxy, labelled descriptive. No defects-prevented figure is claimed. | the council (openai seat): no estimate of defects prevented exists | a defect-attribution source appears in the tree |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Attribution too thin to rank controls | implementation | A deny message that does not identify its concern puts most hook-deny episodes under `unattributed`, so the by-control view ranks the wrong things. | 2.2 measures coverage before anything is ranked. 2.3 runs the council on a per-trip record below 95 %. | Phase 2 — Trace each blockage to the control that decided it |
| 2 | Prose leaks into the ledger | product | A field copied from a `tool_result` brings owner or third-party text into a file that other tools later read. | D1. 4.1 greps the output for every fixture string. Messages are hashed before storage. | Phase 4 — A repeatable command |
| 3 | The proxy is read as proof | product | `held` against `overridden` gets quoted as the value of a rule and used to justify removing a gate. | 3.1 puts the label in the output itself. 4.4 states the one-machine scope. D3. | Phase 3 — Cost per control |
| 4 | Host transcript shape drifts | implementation | A host update renames the error strings or the attachment types, and the classes silently fall to zero. | 1.2 counts unclassified `is_error` records and prints the count. A run with zero matches in every class reports drift, not zero cost. | Phase 1 — Episodes from transcripts |

## Acceptance Criteria

- [ ] AC-1 — Running `agent-config sessions:episodes --json` twice over the same
      transcripts gives byte-identical output. No replayed turn appears in two
      episodes.
- [ ] AC-2 — Every episode carries a `trace` with all five fields. Each field
      is `measured`, `missing` or `as-of-analysis`, and none is empty.
- [ ] AC-3 — `--by-control` prints owner turns, hours, billable tokens and the
      labelled benefit proxy per control. The money column has the shape D5
      decided, or is absent while a blocker on it is open.
- [ ] AC-4 — Searching the ledger and the report for any fixture prompt or
      reply string finds 0 matches.
- [ ] AC-5 — `/analyze:sessions` exists, passes the command linter, and takes
      no hand-written context file as input.
- [ ] AC-6 — `agents/evidence/analysis/session-episodes-first-run.md` exists,
      generated by 4.4.
- [ ] AC-7 — `task ci` exits 0.

<!-- Release holds — none. Considered per template rule 28 and not needed.

     resequenced: every phase adds a reader or a new, unwired CLI entry. No
     shipped surface changes behaviour until 4.1 registers the command, and the
     command is complete when it is registered. No intermediate tree state is
     broken, so no window is opened.
-->
