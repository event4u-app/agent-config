---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-skill-menu-economy
    relation: extends
    note: "Parked on its condition (iii). Phase 0.1 here produces the build-pinned observation that condition needs; the listing policy itself (which descriptions stay resident, and whether the package may write a host setting) stays on that file and is posed to the owner there. Nothing here marks, hides or lists a skill."
  - slug: road-to-a-menu-whose-precision-is-measured
    relation: disjoint
    note: "Parked. Owns ranker lift (scoring, idf, tie-break, a second ranker). Phase 1 here changes what the search answer RETURNS and which characters the tokenizer can see; it changes no scoring formula, and Risk 2 covers the baseline it moves."
  - slug: road-to-a-trigger-suite-the-host-grades
    relation: disjoint
    note: "Active. The host-graded reading of whether a richer search answer changes what the model opens belongs after that file's case set exists; this roadmap measures offline only."
  - slug: road-to-host-catalogue-contract
    relation: disjoint
    note: "Parked on a catalogue observation against a named host build. Phase 0.1 here is one such observation and is offered to it; that file still owns the projection rule."
estate_offset_exempt: "Adds one active roadmap with nothing to offset: no active roadmap owns the skill search answer, its tokenizer or the recovery rule's last step, and the two parked files that touch the subject (menu economy, precision) each exclude it in their own scope. Splitting it out keeps four reproduced defects from waiting on an owner decision that only the listing policy needs."
---
# Road to a search answer a model can choose from

> **Source:** `agents/tmp.old/inbox-2026-10-m/` — a maintainer transcript asking
> for a deep comparison of this tree against an external first-party skill
> catalogue, plus the two three-loop plans it produced on two hosts.
> Re-verified at `main@17f028941` (v16.5.0); the plans were drafted against
> `a17bd4aa2`, and the six commits between touch no file cited here except two
> skill bodies. Ranker readings were re-run offline through the repo's own
> scripts; the host contract was read statically from the installed host
> build, with no network and no settings write.

## Goal

ADR-263 makes search by task the package's claimed way to reach a skill. After
this roadmap the search answer carries the text a model needs to choose
between the rows it returns, at a depth the measured recall supports, with a
tokenizer that can see non-ASCII letters, and it is reachable from a shell on
a host that has no MCP server. The host contract that would let the package
shape the listing is read and recorded, so the parked listing roadmap can be
judged on evidence. Every skill stays installed, listed and invocable exactly
as today.

## Context — reproduced at `main@17f028941`

- **The search answer returns names, not choosing criteria.**
  `src/cli/mcp/dispatch.ts:289` maps each suggestion to
  `{ skill, score, personas }`; the kernel server's handler is
  `src/scripts/mcp_server/suggest_skill.ts`. The description — the one text
  written as routing criteria, including handoff clauses such as the one in
  `src/skills/adversarial-review/SKILL.md` — is not returned, so a model
  choosing among five names must guess or pay for a body read per row. Own
  analysis: the cheapest stage at which a handoff clause can act is the
  model reading the row, not the lexical scorer.
- **Recall at the returned depth is low.** One offline reading over the
  train slice of the trigger corpus (`routing_corpus.loadTrainCases`, holdout
  never opened; shipped `rank()`, default options): 475 positive prompts, the
  owning skill is first for 42.5 %, inside the default `limit` of 5
  (`dispatch.ts:193`) for 62.3 %, inside 8 for 68.6 %, inside 10 for 71.4 %,
  inside 20 for 77.9 %; 81 positives have no lexical overlap at all. The
  supplied plans quoted a 602-prompt reading; it opened the 27 sealed holdout
  corpora (`src/scripts/_lib/routing_corpus.ts:11-16`) and is not cited.
  `corrected-from-reproduction`
- **The tokenizer cannot see non-ASCII letters.**
  `src/shared/skillRanking.ts:39` extracts `/[a-z][a-z0-9]+/g`: reproduced,
  `Prüfung` indexes as `fung`, `Größe` as nothing, `Abhängigkeiten` as
  `abh` + `ngigkeiten`; the stopword list (`:42-49`) is English-only, so `das`
  and `die` survive as content terms. Train slice, `language: de` positives
  (42): first 21.4 %, inside 5 42.9 %.
- **A shell on a non-Claude workspace finds no catalogue.** The CLI ranker
  exists (`src/scripts/skill_tools/suggest_skill_for_task.ts`, `--task`) but
  no `agent-config` verb reaches it — `route:explain`
  (`src/cli/registry.ts:94`) traces rule routing only. Worse, the catalogue
  resolver reads only `src/skills`, `.claude/skills` and `~/.claude/skills`
  (`src/scripts/_lib/skill_catalogue.ts:88`, `:98`, `:183`): reproduced, a
  workspace carrying only another host's directory with an empty home
  resolves to zero roots, i.e. `no_catalogue`, even though the installed
  package ships `dist/agent-src/skills`. `corrected-from-reproduction` — the
  plans assumed a CLI path would work once wired.
- **The recovery rule is accurate today, and its last step is a dead end.**
  `src/rules/missing-skill-recovery.md:64-70` says the server is registered
  for `claude-code` only. The plans called that a contradiction of
  `src/scripts/_lib/mcp_bridge.ts:124-126`, which lists three hosts — but
  `mcpRegistrationTargets` (`:139-170`) gates the other two on a capability
  axis that reports false for every host, so the effective registration is
  `claude-code` alone. Not a defect. The real gap is that step 5 offers no
  second path.
- **The page that documents the listing contract is not watched.**
  `.github/workflows/host-docs-digest.yml:6-9` watches the pages recorded in
  `src/scripts/hooks/host_lowering.yaml`; every `docs_url` there is a hooks
  page (`:98`, `:128`, `:159`, `:191`, `:216`, `:242`, `:334`, `:396`). The
  skills page that `src/scripts/_lib/host_listing_model.ts:13-14` cites has no
  digest. A listing-contract change reaches the tree only by accident.
- **The host now carries a per-skill listing override, and the tree has never
  recorded it.** Read statically from the installed host build 2.1.296 (no
  session, no settings write): a settings key `skillOverrides` with the values
  `on`, `name-only`, `user-invocable-only`, `off`. Paraphrasing the build's
  own schema text: `name-only` keeps the entry without its description,
  `user-invocable-only` removes it from the model while keeping the slash
  command, `off` removes both; a plugin-sourced skill resolves to `on`
  regardless. `grep -rn skillOverrides
  src docs agents` returns nothing. This is the third consumed round to name
  the key (see the Arrivals line on `later/road-to-skill-menu-economy.md`).
  The behaviour — description absent, model invocation by name intact — is
  not yet observed in a session.

## Phase 0 — Read the contract, watch its page, measure the right slice

- [ ] **0.1 Observe the listing override on a pinned host build.** From an
      empty directory outside any checkout, with a scratch `HOME`, set
      `name-only` for one package skill and `user-invocable-only` for a
      second, and record per value: listed by name or not; description
      present or not; model invocation by name; `/name`; a project value
      overriding the user value. Write the result as
      `agents/evidence/analysis/host-skill-listing-override.md` <!-- ref-ignore --> with its
      evidence-type marker, the host build, the date and a transcript
      pointer, beside the static schema reading recorded in the Context.
      Offer the observation to `later/road-to-host-catalogue-contract.md`.
      `corrected-from-reproduction` — the plans put this row in
      `src/config/host-capabilities.yml`, which is the discipline-lift model
      list, not a host-behaviour store.
      verify: `./scripts-run src/scripts/lint_evidence_artifacts --all` -> 0
- [ ] **0.2 Put the skills page under the digest watch.** A sibling page list
      read by `check_host_docs_digest`, carrying `docs_url`, `docs_at`,
      `docs_digest` and `expires` like every hook row — not a new surface in
      `host_lowering.yaml`, whose rows are host-by-hook-slot and whose edits
      carry a ratification artifact. The list joins the same plumbing
      protection as the table it sits beside.
      `corrected-from-reproduction`
      verify: `npx vitest run tests/scripts/host_docs_digest.test.ts` -> 0
- [x] **0.3 A recall-at-depth arm on the train slice.** One arm on
      `measure_skill_ranker_baseline` that takes its cases from
      `routing_corpus.loadTrainCases` — no second loader over the corpus
      (`routing_corpus.ts:6-9`) — and scores with the shipped `rank()`. It
      prints recall at 1, 3, 5, 8, 10 and 20, the zero-overlap count, the
      near-miss first and top-3 counts, and the same split for
      `language: de`. A test asserts no holdout corpus file is opened.
      `corrected-from-reproduction`
      verify: `./scripts-run src/scripts/measure_skill_ranker_baseline --corpus triggers-train` -> /recall@8/

## Phase 1 — A search answer a model can choose from

- [ ] **1.1 Return the description with each row.** Both servers, one
      envelope: `description` beside `skill`, `score`, `personas`. The tool
      description says the model chooses among the rows by reading them and
      opens at most two bodies. Tool-definition cost stays under
      `LITE_TOOLS_TOKEN_CAP` (`dispatch.ts:171`); the result grows by one
      description per row, each already capped at 200 characters by the
      skill schema.
      verify: `npx vitest run src/cli/mcp/dispatch.test.ts tests/contracts/catalogue_layer_parity.test.ts tests/scripts/mcp_server_tools.test.ts` -> 0
- [ ] **1.2 Return to the depth recall supports.** Pre-registered before the
      change: the default `limit` moves to the smallest depth whose recall
      gain over 5 exceeds 5 points on the train slice, as printed by 0.3; if
      none does, 5 stays and the step closes as an honest null. The one
      offline reading in the Context puts that depth at 8 (+6.3 points); the
      committed 0.3 run decides, not this line.
      verify: `npx vitest run src/cli/mcp/dispatch.test.ts` -> 0
- [x] **1.3 Let the tokenizer see letters.** Replace the ASCII token class at
      `skillRanking.ts:39` with a Unicode letter class and add a German
      stopword block beside the English one. A correctness fix, not a lift
      claim: the 0.3 run before and after is attached to the change and the
      ranker baseline file is regenerated in the same change.
      verify: `npx vitest run tests/scripts/skill_ranking_tokenizer.test.ts --reporter=verbose` -> /✓.*keeps-non-ascii-letters/ <!-- ref-ignore -->

## Phase 2 — A search path on every host with a shell

- [ ] **2.1 One flag, no new verb.** `./agent-config route:explain --skills
      "<task>"` prints the same rows as 1.1. When no project or host root
      resolves, the catalogue resolver falls back to the installed package's
      own `dist/agent-src/skills` as the last root — never ahead of an
      existing root — and the output names which root answered.
      `corrected-from-reproduction`
      verify: `npx vitest run tests/scripts/suggest_skill_for_task.test.ts tests/scripts/tiered_projection.test.ts` -> 0
- [ ] **2.2 Give the recovery rule a second rung.** Step 5 of
      `missing-skill-recovery.md` becomes a ladder: the MCP tool, then the
      2.1 command, then say which rung failed and proceed. A rung that is not
      reachable is named, never retried in a loop and never answered from
      memory. The rewrite is net-neutral or smaller in bytes, and its
      `enforced_by` line stays `instruction-only` with its reason.
      verify: `grep -c 'route:explain --skills' src/rules/missing-skill-recovery.md` -> /^[1-9]/

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | evidence | The search path is its own roadmap; the listing policy stays on the parked menu-economy file | 1.1, 1.3 and 2.x help whether or not any description is ever dropped from the listing, and the menu-economy goal is the catalogue bucket, not the search answer | the owner folds both into one file on the menu-economy question |
| A2 | reversible-technical | evidence | The shell path is a flag on `route:explain`, not a new verb | the parked menu-economy kill register forbids a new top-level CLI verb; the ranker already exists as a script | `route:explain`'s single-purpose contract is pinned by a test that refuses a second mode |
| A3 | reversible-technical | evidence | This roadmap writes no host setting, `skillOverrides` included | `src/scripts/_lib/mcp_bridge.ts:348-351` and `docs/mcp-server.md:184-187`: the package never edits a consumer's host settings; an earlier consumed round proposed the same write and killed it on that ground | the owner answers the posed question on `later/road-to-skill-menu-economy.md` in favour of a write |
| A4 | reversible-technical | evidence | No step reads the sealed trigger holdout | `routing_corpus.ts:11-16` seals by refusal; the supplied 602-prompt figures read it | the holdout freeze artefact is superseded |
| A5 | reversible-technical | evidence | The skill-route hook keeps its pointer-only payload; descriptions go into the tool result, not the hook | the hook bundle has almost no byte headroom and the tool result is paid only when called | the hook budget is raised for another reason |
| A6 | reversible-technical | evidence | The registered-host sentence in the recovery rule is not a defect and is not offered to a truth carrier | `mcpRegistrationTargets` returns an empty list on today's capability axis, so `claude-code` is the only effective registration | the axis reports `reads_project_mcp_config` true for any host |

## Non-goals

No skill is removed, renamed, hidden from the listing or made un-invocable.
No host setting is written. No new skill, rule, command, verb or hook concern.
No embedding index, no daemon, no remote catalogue fetch. No scoring-formula
change (that is the precision roadmap's). No mass addition of "do not use"
clauses to descriptions. No rule obligation moves into a skill: safety and
permission rules never depend on which skill the model picks.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude-opus -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Richer rows cost more than they save | product | A description per row and a deeper default raise the result size of every search call | Each description is schema-capped at 200 characters; 1.2 moves the depth only past a pre-registered recall gain and closes as a null otherwise | Phase 1 — A search answer a model can choose from |
| 2 | The tokenizer fix silently moves published ranker numbers | implementation | Every committed ranker baseline and the precision roadmap's readings were taken with the ASCII tokenizer | 1.3 regenerates the baseline file in the same change and attaches the before/after 0.3 run, so no number drifts unrecorded | Phase 1 — A search answer a model can choose from |
| 3 | The fallback root shadows a real catalogue | implementation | Adding the package's own skills tree could rank above, or duplicate, a host catalogue that does resolve | 2.1 adds it only when no other root resolves and prints which root answered | Phase 2 — A search path on every host with a shell |
| 4 | The rule rewrite grows a routed rule | implementation | Rule prose is paid wherever the rule loads | 2.2 requires the rewrite to be net-neutral or smaller in bytes | Phase 2 — A search path on every host with a shell |
| 5 | The static host reading is mistaken for behaviour | product | A schema string in a host build says what a value is meant to do, not what a session does | 0.1 records observed behaviour per value in a session before the parked listing roadmap may cite it | Phase 0 — Read the contract, watch its page, measure the right slice |

## Acceptance Criteria

- [ ] AC-1 — The listing override has a build-pinned observation per value
      (0.1) and the page documenting it is under the digest watch (0.2).
- [ ] AC-2 — A committed run prints recall at depth over the train slice
      without opening a holdout corpus (0.3), and the default depth is the
      one the pre-registered bar in 1.2 selects, a recorded null included.
- [ ] AC-3 — Every search row on both servers and on the shell path carries
      its description (1.1, 2.1), and the shell path answers on a workspace
      with no host catalogue root (2.1).
- [ ] AC-4 — The tokenizer keeps non-ASCII letters, with the before/after run
      attached and the baseline regenerated (1.3).
- [ ] AC-5 — The recovery rule's last step names only rungs a test proves
      exist, at no growth in bytes (2.2), and every skill remains installed,
      listed and invocable as before.
