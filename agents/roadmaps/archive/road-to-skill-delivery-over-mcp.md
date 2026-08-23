---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "FLIPPED TO READY on the owner's explicit instruction, 2026-08-22 — the estate charge this key said would wait for the owner's flip is now due, because the owner has taken that decision for every draft the previous /analyze:inbox run landed. What the key covers from here is the +1 active_roadmaps the flip itself creates, un-offset on that instruction; the file files no blockers, so open_blockers is unchanged. The draft-era text that follows is kept as history and no longer describes this file: Ships status: draft, so the estate charge waits for the owner's flip. Nothing to offset: its subject — how the skill catalogue reaches the host at all — is covered by no active roadmap, and its own harvest establishes that the two existing MCP servers are the reason a third must NOT be built. Landed by /analyze:inbox with six of seven defects re-verified at 577bdbf88."
---
# Road to skill delivery over MCP — without losing the skills the host can still route

> **Corrected on landing (`/analyze:inbox`, 2026-08-22):** frontmatter said
> `status: proposal`, which is not in the vocabulary — `update_roadmap_progress.ts:97`
> recognises exactly one draft value (`draft`), so the file read as an ACTIVE
> roadmap and tripped three gates at once: `check_estate_count` (active 17 → 18),
> `lint_plan_risk_register` (drafts are exempt, non-drafts are not) and
> `lint_roadmap_blockers`. Set to `draft`, which is what the header already means
> by calling everything below a proposal. The flip to `ready` — and with it the
> estate charge, the register and the blocker decidability — is the owner's.
>
> **Source:** `agents/tmp.old/skill-retrieval-mcp/road-to-skill-delivery-over-mcp.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Source:** external-source harvest of 2026-08-22
> (`agents/evidence/analysis/skill-delivery-over-mcp-harvest-2026-08-22.md`,
> proposed location), inverted per ADR-211 C/D: every phase below starts from a
> defect verified at `d1861bad2d276e78268d5515444b9ef36897dda2` and draws
> sources in only where they bear on it. **Iteration 3 of 3**; the iteration
> log is in `road-to-skill-delivery-over-mcp.iterations.md`.
>
> **This is a proposal.** Nothing in it is adopted, and nothing in it may be
> cited elsewhere as a foundation until the phase that would establish it has
> its `verify:` line green.

## Outcome — `measured-null`, closed 2026-08-23

Closed by an autonomous drain run. **22 of 25 boxes ticked, 3 transferred**, no
deferred item.

**What shipped.** The turnkey server serves two read-only discovery tools
(`suggest_skill_for_task`, `read_skill`) at 222 tok; the installer registers it
in `.mcp.json`, so the Iron Law in `missing-skill-recovery.md` is fulfillable on
the documented end-user path for the first time; that rule gained the branch it
lacked for when the tool is still absent; the host's listing budget is modelled
and checked; `projection.mode: tiered` exists, opt-in; the relevance formula is
single-sourced so the two servers cannot drift; and skill-trigger coverage is a
ratchet with one seeded tranche.

**The verdict on the roadmap's own hypotheses.** H2 holds arithmetically and its
useful reading is the opposite of the flattering one — on a default install
`tiered` costs **more** standing context than `legacy-all` (2,259 tok against
1,956), because the host already caps delivery at roughly the Tier A set. H1 —
whether tiering improves selection — is **not established and not establishable
without a live host arm**, which is the pre-registered `measured-null` branch of
4.4. So `tiered` stays opt-in with no context-saving fallback argument, and both
nulls are in `docs/CLAIMS.md`.

**Six premise defects were found while executing, each recorded at its step:**
the 496-line matrix carries expected *rules* and cannot score a skill ranker; it
holds 499 prompts, not 496; the catalogue is 294 skills, not 290; the kernel
server's standing cost is 3,886 tok (payload) / 1,791 (descriptions), not ~1,972;
**4** skills declared `triggers:`, not 19; and `mcp:turnkey-parity` /
`agents/roadmaps/roadmaps-progress.md` do not exist (`mcp:parity-stdio` and
`agents/roadmaps-progress.md` do, the latter generated).

**One decision was routed to the AI council and came back INCONCLUSIVE** — both
members `quota_exhausted` — so 1.3's mechanism was decided on written tree
evidence instead, choosing the option that required no acceptance criterion to be
weakened. Details at the step.

## Goal

On the default Claude Code install, every one of the 290 projected skills is
**reachable by task description** — through the host's native listing where
the host's own budget allows it, and through a tool the default install
actually registers where it does not — and the package can **predict** which
skills fall on which side of that line before the host ever truncates them,
instead of learning it one bare catalogue entry at a time.

"Smaller context" is a *consequence* this roadmap measures, not a goal it
assumes: the catalogue bucket is 14,408 tok today and the host already discards
most of it; the honest target is *routable skills per standing token*, with the
pre-registered possibility that the answer is "tiering does not beat
`legacy-all` on this corpus", in which case Phase 4 records the null and
Phases 1–2 still stand on their own defects.

## Context

Re-verified against the tree at `d1861bad` on 2026-08-22. Full defect table
with provenance in the harvest note; the five that shape the phases:

- **D1 — the turnkey server has no tools.** `src/cli/mcp/dispatch.ts:195-196`
  returns `tools: []`. `suggest_skill_for_task` exists only in the kernel
  server (`src/scripts/mcp_server/tools.ts:1270`).
- **D2 — the recovery rule promises that tool to everyone.**
  `src/rules/missing-skill-recovery.md:37-39` (Iron Law) and `:45-48`. A
  consumer on the documented end-user path (`docs/getting-started-local-stdio.md:9`)
  cannot comply.
- **D3 — Claude Code gets no server at all.** `mcp.json:1-3` is empty;
  `src/scripts/mcp_render.ts:11-14` never targets `.mcp.json`; `install.ts`
  writes no `mcpServers`.
- **D4 — the host's listing budget is deterministic upstream and unmodelled
  here.** Claude Code lists every skill name but keeps descriptions only up to
  1% of the context window (≈8,000 chars on 200k), filling by invocation
  frequency, capping each entry at 1,536 chars, configurable via
  `skillListingBudgetFraction` (code.claude.com/docs/en/skills, 2026-08-22;
  anthropics/claude-code#64606). The repo's 2026-08-08 observation — 5 of 8
  sampled entries bare, 414/414 described on disk
  (`agents/evidence/analysis/skill-catalogue-description-delivery.md`) — is
  that mechanism, unnamed. `grep -rn skillListingBudgetFraction src docs agents`
  → 0 hits.
- **D6 — routing is near-dead and the ranker ignores the trigger schema.**
  `skill-usage-report.md:9`: 337 tracked, 0 active. The ranker
  (`score_skill_relevance.ts:15-21`) reads `name + description` only; 19 skills
  already declare `triggers:` (`skill.schema.json:290`) and none of that text
  is indexed.

Two external facts bind the design and are carried as risks, not as
assumptions:

- **R1 (AAIF / MCP Skills-over-MCP WG, 2026-06-18):** in the WG's early
  experiments models *often ignored* skills served over MCP and went straight
  to tools; a server-instruction nudge helped, and adherence still declined as
  context grew. The pull path therefore cannot be the only path; the existing
  `skill-route` push hook stays primary.
- **R2 (Claude Code Tool Search, docs + #19890):** MCP tool definitions are
  deferred only above ~10% of context. A small server loads upfront. The
  kernel server's allowlist descriptions measure ≈1,972 tok (chars/4 over
  `tools.ts`), so registering it as-is to fix D3 would *add* standing cost.
  The surface this roadmap registers must be ≤3 tools and its cost a gated
  number.

## Phase 0 — Pin the host model and the baseline before touching delivery

- [x] **0.1 Write the host listing-budget model into the tree as a checked
      artefact, with its upstream provenance and date.** A small pure
      function: given `(context_window, fraction=0.01, per_entry_cap=1536,
      usage_order)` and the projected catalogue, return the set of skills whose
      descriptions survive. Name the assumptions that are upstream prose
      rather than repo measurement (fill order, wrapper overhead).
      verify (discharged): `tests/scripts/host_listing_model.test.ts` (10 tests) pins `src/scripts/_lib/host_listing_model.ts`. The model DISAGREES with the 2026-08-08 observation on **four of eight** sampled entries, and the test asserts the disagreement by name rather than tuning it away — `context-document` and `mcp` predicted bare where observed described, `comp-banding` and `composer-packages` the reverse. The gap is structural, not a coding error: `context-document` sorts strictly between two observed-bare neighbours, so NO position-ordered fill over an alphabetical catalogue can reproduce that session. All five upstream-prose assumptions are returned by id with a reason (`fill-order-is-invocation-frequency` is the one that fails here). What the model IS good for: the budget arithmetic, the per-entry cap and the direction — 44 of 294 descriptions survive an 8,000-char budget.
- [x] **0.2 Record the kernel server's standing tool cost and the threshold it
      sits under.** One row in `agents/evidence/metrics/` with the chars/4
      figure over `tools.ts` allowlist descriptions, the Tool Search threshold
      and the source date, so "registering the kernel server is free" can never
      be asserted again without a re-measurement.
      verify (discharged): `agents/evidence/metrics/mcp-tool-standing-cost.jsonl` exists; `grep -c "1972\|tool_search_threshold"` = **2**; `docs/CLAIMS.md` gains `claim:mcp-registered-server-standing-cost` (backed, pointer resolves) and the derived denominator in `internal/reports/exec-evidence-feasibility.json` was moved 49 → 50 in the same change. DEFECT IN THE PREMISE: the ~1,972 tok figure is not reproducible — descriptions measure **1,791** — and it counts the wrong thing, because the host loads the whole `tools/list` payload, schemas included, which is **3,886 tok**, roughly 2.2x. Both are recorded AND asserted in `tests/scripts/mcp_lite_tools.test.ts`, so the row cannot age silently.
- [x] **0.3 Freeze the routing-matrix baseline for the incumbent ranker.**
      Run `trigger_coverage.ts --scope skill` and `score_skill_relevance` over
      the 496-line corpus and record top-1 / top-3 hit rate against the
      corpus's expected skill per line. This is the number Phase 3 and Phase 4
      must beat and it does not exist yet.
      verify (discharged): `agents/evidence/metrics/skill-ranker-baseline.json` carries `ranker: keyword-v1`, `top1: 0.615`, `top3: 0.769`, `corpus_lines: 499`, `commit: 53ac0adb4`. Regenerate with `./scripts-run src/scripts/measure_skill_ranker_baseline`. TWO DEFECTS IN THE PREMISE, both recorded in the file: (a) the 496-line routing matrix is labelled with the expected **rule** and never a skill, so no top-1/top-3 can be computed over it — the rates are measured against `tests/eval/corpus-{dev,non-dev}.yaml`, the 26 prompts that DO carry expected skills, and the matrix is reported beside them as coverage-without-accuracy (495 of 499 answered, mean top score 19.98); (b) 496 is stale, the matrix holds **499**, and the old figure still stands in five other sites. Also found: `score_skill_relevance`'s own `DEFAULT_SKILLS_DIR` points at `.agent-src.uncondensed/skills`, which is EMPTY in a normal checkout — a caller taking the default ranks nothing.

## Phase 1 — Make the promised tool reachable on the default path (D1, D2, D3)

- [x] **1.1 Add a minimal skill-discovery surface to the lite server.** Exactly
      two tools, ported from the kernel handlers, read-only, shell-free:
      `suggest_skill_for_task` (unchanged contract: `task`, `limit`, returns
      names + scores + personas, never bodies) and `read_skill`
      (`name` → SKILL.md body from the projected tree, path-guarded to the
      catalogue root, refuses traversal). No `list_skills` — the host already
      lists names, and a 290-name tool result is the context cost this
      roadmap exists to avoid.
      verify (discharged): `tools/list` returns exactly 2 entries, checked by NAME not count (`read_skill`, `suggest_skill_for_task`) in `tests/scripts/mcp_lite_tools.test.ts` and in `src/cli/mcp/dispatch.test.ts`. Standing cost **222 tok** (887 chars) against the 600 cap, asserted. Both tools are pure over the content tree; `read_skill` resolves `skill://<name>` through the uri map and builds no path, so traversal is unexpressible — the separator guard is kept anyway so a future path-based backend inherits it. PARITY: the task is `mcp:parity-stdio`, not `mcp:turnkey-parity` (which does not exist); it asserted `tools/list` was EMPTY, so it was updated to assert the two names and is green — `✅ node tools/list: read_skill,suggest_skill_for_task`, 493 prompts and 228 resources matching. Risk 6 is discharged structurally as well as by that check: the formula now lives once, in `src/shared/skillRanking.ts`, imported by both servers.
- [x] **1.2 Add server `instructions` that tell the host when to search.**
      One paragraph, derived from `missing-skill-recovery.md`'s Iron Law, so
      Tool Search (if active) and the model (if not) both know the tool is the
      recovery path for a truncated listing. This is the AAIF WG's one
      positive finding; it is applied, and its decay (R1) is measured in 4.3.
      verify (discharged): `initialize` carries `instructions`; **325 bytes** against the 400 cap, pinned in the same test as 1.1, together with the requirement that it names both tools and the still-exists clause.
- [x] **1.3 Render the server into Claude Code's project-scope config.** Extend
      `mcp_render.ts` with a `.mcp.json` target whose entry is
      `{"agent-config": {"command": "npx", "args": ["-y", "@event4u/agent-config", "mcp-server"]}}`
      (the exact shape already documented at
      `docs/getting-started-local-stdio.md:21`). Default **on** for the
      `claude-code` projection, because a rule that is unfulfillable by
      default is a defect, not a feature; opt-out via `.agent-tools.yml`.
      verify (discharged), WITH THE MECHANISM AMENDED — see the note below the step. A fresh consumer install produces `.mcp.json` with the documented entry (`ensure_mcp_bridge`, gated on `_is_tool_enabled(tools, 'claude-code')`), MERGING so a consumer's own servers survive; `lint_mcp_config_security`'s `_scan` produces zero FAIL findings on the produced file (`npx -y` is a documented MED warn); and `mcp:check` treats `.mcp.json` as a target as CONTAINMENT — `ok`/`absent`/`missing-entry`/`unreadable` — never equality with a rendering. 12 tests in `tests/scripts/mcp_json_bridge.test.ts`; replacing the merge with a plain write reddens 3 of them.
- [x] **1.4 Close the rule's unreachable branch.** Add to
      `missing-skill-recovery.md` the case "the tool is not registered": say
      so explicitly, point at the rendered `.mcp.json`, and proceed without a
      skill — the rule may never instruct a call it cannot verify is possible.
      Re-anchor the `# obligation:` line marker.
      verify (discharged): `trigger_coverage --scope rule` reports **26/26 pass**, byte-identical before and after the edit; the rule's activation contribution replayed through `fired_rules` over all **499** matrix prompts is **0**, matching the 2026-08-16 review. The `# obligation: line 41` marker still resolves to the Iron Law fence — the insert lands 20 lines below it, so no re-anchor was needed and none was invented.

## Phase 2 — Tier the projection against the modelled budget (D4, D5)

- [x] **2.1 Compute the tier split at install time, from data, and write it
      down.** Using 0.1's model: Tier A = skills predicted to survive the
      host's listing budget under the consumer's observed usage order
      (`agents/runtime/metrics/skill-usage.jsonl`, falling back to pack scope
      then alphabetical when usage is empty — and saying which fallback was
      used). Tier B = everything else. The split is emitted as
      `agents/runtime/state/skill-tiers.json` with the model inputs, so the
      next session can see *why* a skill was Tier B.
      verify (discharged): `agents/runtime/state/skill-tiers.json` carries `model_inputs` (`context_window_tokens` 200000, `fraction` 0.01, `per_entry_cap_chars` 1536, `usage_rows_used` 0, `fallback: "alphabetical"`, `fill_order`) and `tier_a` 44 / `tier_b` 250 whose union equals the projected catalogue of 294 — asserted, not eyeballed. `agents/runtime/metrics/skill-usage.jsonl` does not exist here, so the fallback path is the one actually exercised, which is why it is named in the output. 9 tests in `tests/scripts/compute_skill_tiers.test.ts`. `fallback: "pack-scope"` is in the type and deliberately unreachable — naming a fallback that never runs would be worse than naming none.
- [x] **2.2 Project Tier B as MCP-reachable only, behind a Human Gate.** In
      `install.ts`, a new projection mode `tiered` writes Tier A to
      `.claude/skills/` as today and Tier B **only** into the lite server's
      content tree. Default stays `legacy-all`; `tiered` is opt-in until
      Phase 4 says otherwise. `scoped` remains as the pack-level lever it is.
      verify (discharged): under `tiered`, `capture_skill_catalogue --projection-modes` reports `tier A 44 native + tier B 250 MCP-only = 294` and flags the sum against `legacy-all` as STALE if they diverge. **294, not the 290 this line assumed** — the figure is read, not retyped. `read_skill` resolves every one of the 250 Tier B names through the REAL handler over the REAL projected tree, each with a non-empty body (`tests/scripts/tiered_projection.test.ts`) — that is the claim `tiered` rests on, so it is asserted against the tree rather than a fixture. `_prune_tier_b_modules` removes exactly the Tier B SKILL.md dirs and nothing else. `legacy-all` remains the default; `_resolve_tier_b` returns `null` (never an empty set) on a missing or malformed split and the tiered branch then warns and ships the full surface, because pruning on absence would delete the catalogue.
- [x] **2.3 Surface the consumer-side host setting as an alternative, not a
      default.** Document `skillListingBudgetFraction` as the *other* lever —
      raising it restores descriptions at a measured token price (14,408 tok at
      100% delivery) — and add it to the install's `--doctor` output as a
      recommendation only when Tier B is non-empty. Never write the
      consumer's `settings.json` for them.
      verify (discharged): `grep -c skillListingBudgetFraction docs/` = **2 hits in docs/mcp-server.md** (≥ 1). `_tier_b_advisory` returns `null` unless a split exists AND `tier_b` is non-empty — both branches asserted — and it returns a STRING, with a test proving it writes nothing to disk. The doc gives both levers with the token price of each and recommends neither.

## Phase 3 — Index what routes, not what reads (D6)

- [x] **3.1 Extend the ranker's term source to `triggers:`.** `name +
      description + triggers.keyword/phrase` become the indexed text; body
      prose stays out (the one design note every surveyed skill-MCP converged
      on, and the reason the K-Dense design needed a 250 MB embedding backend
      this package will not ship). Scoring stays deterministic; no model
      download, no network.
      verify (discharged) — AND THE RESULT IS A NULL. `keyword-v2` measures **identical** to v1: top1 0.615, top3 0.769. top3 does not regress, so the keep-condition holds and the change stays; it buys nothing measurable, and the reason is honest — only **4** skills declared `triggers:` before this roadmap (the phase's premise says 19; a `^triggers:` grep returns 5 files, one of which is `rule-writing` matching inside a fenced example), and none of them is an expected skill in the 26-prompt labelled corpus. Per-prompt cost, local darwin, 40 samples over 294 skills: v1 p95 9.3 ms, v2 p95 9.2 ms — indistinguishable, against the 175 ms `pre_tool_use` p95_ci in `hook-token-budget`'s sibling `hook-latency-budget.json`; and v2 is off by default, so the `skill-route` hook path is unchanged either way. Body prose stays out. `INDEXED_TRIGGER_KEYS` is shared so the two readers cannot disagree about what a trigger contributes.
- [x] **3.2 Make trigger coverage a ratchet, Tier B first.** A Tier B skill
      with no `triggers:` is reachable only through whatever its description
      happens to share with the prompt. Seed triggers for Tier B skills in
      tranches, each measured against the matrix before merge, exactly as
      Phase 3.3 of the archived routing roadmap did for the first 19.
      verify (discharged): `trigger_coverage --scope skill --ratchet` is the mechanism — coverage is a FLOOR, matrix activations a CEILING, and a missing baseline exits 1 rather than silently passing. Tranche 1 seeded eight Tier-B skills with eighteen `phrase` triggers and no bare `keyword`: coverage **4 → 12**, activations **3 → 3**, i.e. zero of the 499 matrix prompts fire on any seeded phrase. Sabotage-checked both ways — removing one skill's triggers fails the floor (12 → 11), replacing one phrase with `"the"` fails the ceiling (3 → 329). ON THE 433 CEILING: that census is RULE-side, and `--scope skill` states in its own output that it cannot move from this scope. Verified rather than assumed — `--scope rule` is 26/26 before and after, and a replay of all 499 prompts shows this tranche moving no rule activation. The ratchet is NOT wired into CI: that would touch `gate-coverage.yml`, the gate ledger and two budget files, which is a larger decision than this phase authorises.
- [x] **3.3 Stop `suggest_skill_for_task` from returning Tier A.** When the
      host already lists a skill with its description, returning it from the
      recovery tool is noise. Filter on `skill-tiers.json` when present; when
      absent, return everything and say `tiers: unknown`.
      verify (discharged): `tests/scripts/mcp_lite_tools.test.ts` covers both branches with a fixture tier set — no tiers file returns the full ranked list and `tiers: "unknown"`; a fixture split drops the Tier A name and reports `tiers: "tier-b-only"`. `loadTierA` returns `undefined` for absent or malformed and an EMPTY SET for a genuinely empty Tier A, because absent is not empty. One guard this step did not ask for: the filter is BYPASSED rather than allowed to empty the result (`tier_filter: "bypassed-to-avoid-empty"`), because a list emptied only by tiering is indistinguishable to the caller from "no skill covers this" — the conclusion this rule exists to prevent. Disabling the filter reddens 2 tests; removing the bypass reddens 1.

## Phase 4 — The falsifier (pre-registered; decides the default)

Hypothesis H1: on this corpus, a `tiered` install (Tier A native + Tier B via
the two-tool server) yields **more correct skill invocations per session**
than `legacy-all`, and **not more** unintended activations.
Hypothesis H2: the server's push-side cost (1.1 + 1.2) plus Tier A listing is
**below** the current 14,408-tok catalogue bucket.
The AAIF WG null is the prior for H1 being false. Both are recorded either
way.

- [x] **4.1 Routing-matrix arm (deterministic).** Replay the 496-line corpus
      under `legacy-all` (modelled listing from 0.1) vs `tiered`, counting
      lines whose expected skill is (a) listed with description, (b) listed
      bare, (c) reachable only via the tool. This is computable without a
      host.
      verify (discharged): `agents/evidence/analysis/skill-tiering-matrix-arm.md` carries the three counts per mode at commit `53ac0adb4` — `legacy-all` described 5 / bare 21 / tool-only 0, `tiered` described 5 / bare 0 / tool-only 21, over the 26 labelled prompts (the 499-prompt matrix carries expected RULES and cannot answer this; both facts recorded in the note). **81% of that corpus has its expected skill in Tier B**, so `tiered` moves four fifths of it from listed-but-bare to tool-only. H2 holds as written — 2,259 tok against a **13,003**-tok bucket (not 14,408; the catalogue changed) — and the flattering reading of it is wrong: the host already caps delivery at roughly the Tier A set, ~1,956 tok, so on a default install `tiered` costs **MORE** standing context than `legacy-all`, 2,259 against 1,956. Published as `claim:skill-tiering-h2-costs-more-by-default`. Consequence stated rather than buried: the case for `tiered` now rests ENTIRELY on H1.
- [-] **4.2 Live arm (observed, small N, stated as such).** ≥ 20 sessions per
      arm on one machine, same repo, `skill-usage.jsonl` + MCP telemetry
      (`mcp_telemetry_query.ts`) as the only instruments. Report invocations,
      distinct skills, `suggest_skill_for_task` calls and their hit rate. No
      survivor count is inferred from host silence (the repo's standing rule).
      verify (TRANSFERRED — `agents/roadmaps/stubs/road-to-skill-tiering-live-arm.md`): needs ≥ 40 real interactive sessions across two install configurations on one machine. An autonomous repository run has none of that, and scripting forty headless prompts would measure a script rather than a model — producing a number in exactly the shape H1 wants while answering a different question. Measured baseline on the transfer date: `agents/runtime/metrics/skill-usage.jsonl` **absent** (not zero rows — no file), `skill-usage-report.md` 337 tracked / **0 active**, sessions available for either arm **0**. The stub carries the criterion verbatim, the named producer, and a one-command probe with 20-per-arm as the bar.
- [-] **4.3 Measure R1 directly.** From the live arm, the fraction of sessions
      where a Tier B skill was *needed* (matrix says so) and the tool was
      *called* — by context position in the session. If adherence decays with
      context as the WG saw, the number is published and the `skill-route`
      push hook is confirmed as primary.
      verify (TRANSFERRED — same stub): 4.3 reads its buckets out of 4.2's sessions, so it cannot precede them. The R1 prior it would test is recorded in the stub and in the matrix-arm note as the unfavourable one it is.
- [x] **4.4 Decide the default, once.** If H1 and H2 hold, flip `tiered` to
      default for `claude-code` in a single PR that cites 4.1–4.3 by file. If
      either fails, `tiered` stays opt-in, the null is written into
      `docs/CLAIMS.md`, and this roadmap closes with outcome `measured-null`.
      verify (discharged) — outcome **`measured-null`**, which is this step's own pre-registered second branch. H1 is not established and is not establishable here: three unobservables decide its sign (whether a bare name still routes, whether the tool is called, and the accuracy of the split itself, which used the fallback order the pinned observation refutes on four of eight entries). So `tiered` stays opt-in — it was never made default — and the null is published as `claim:skill-tiering-h1-unmeasured`, beside `claim:skill-tiering-h2-costs-more-by-default`. Three evidence paths: `agents/evidence/analysis/skill-tiering-matrix-arm.md`, `agents/roadmaps/stubs/road-to-skill-tiering-live-arm.md`, `docs/CLAIMS.md`. DEFECT IN THE PREMISE: this line names `agents/roadmaps/roadmaps-progress.md`, which does not exist — the dashboard is `agents/roadmaps-progress.md` and is GENERATED, so recording an outcome there would be a hand-edit of generated output, forbidden by `source-of-truth`. The outcome is recorded here, in the authored file, instead.

## Phase 5 — Tracking only: SEP-2640 `skill://` alignment

Not executable today. Carried so it is not re-proposed as new.

- [-] **5.1 Re-verify SEP-2640's status quarterly** (pending as of the
      2026-06-18 AAIF post; not re-verified on 2026-08-22). When it merges
      *and* a second host implements Resources-based skill discovery, add a
      `skill://index.json` resource to the lite server that mirrors
      `skill-tiers.json` Tier B. Until then, the existing `prompts/` +
      `resources/` surface is the same content under a different name, and
      renaming it for a pending spec would be an unmeasured change.
      verify (TRANSFERRED — `agents/roadmaps/stubs/road-to-sep-2640-skill-resources.md`): the dated line is discharged and the checkbox is not tickable. Checked today rather than assumed — `modelcontextprotocol/modelcontextprotocol` PR **#2640 "SEP-2640: Skills Extension" is `state: open`**, last updated `2026-08-23T02:00:42Z`, read via `gh api search/issues`. Not merged, so this step's own verify makes the checkbox unreachable. A **quarterly** obligation also cannot be discharged by finishing one roadmap, so it becomes a date carrier: check log, one-command probe, next check **2026-11-23**, and both promotion conditions (merged **and** a second host implementing Resources-based skill discovery) named in the stub.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Models ignore skills served over MCP | product | The AAIF WG measured models going straight to tools and ignoring served skills, with adherence declining further as context grew — a pull-only delivery path would ship a catalogue nothing reads | The deterministic `skill-route` push hook stays primary and 1.2 adds the WG's one positive finding as server `instructions`; 4.3 measures the adherence decay by context bucket instead of assuming the nudge holds | Phase 4 — The falsifier (pre-registered; decides the default) |
| 2 | The registered server costs more standing context than tiering saves | implementation | MCP tool definitions are deferred only above ~10% of context, so a small server loads upfront; registering the kernel server as-is would add its ≈1,972-tok allowlist surface to every session | 0.2 records that figure and the Tool Search threshold as a metric row so "registering it is free" cannot be re-asserted, and 1.1 caps the two-tool surface at ≤600 tok asserted in a test | Phase 1 — Make the promised tool reachable on the default path |
| 3 | The host listing-budget model is upstream prose, not repo measurement | implementation | Fill order and wrapper overhead are documented behaviour rather than something this tree measured, and every tier decision in Phase 2 inherits whatever the model gets wrong | 0.1 names which assumptions are upstream prose and pins the model against the 2026-08-08 sampled projection — five bare and three described — recording disagreement as a known gap rather than suppressing it | Phase 0 — Pin the host model and the baseline before touching delivery |
| 4 | Tiering makes a skill unreachable rather than merely undescribed | product | Tier B is projected only into the server content tree, so on a host that never calls the tool a Tier B skill goes from bare-but-listed to absent — strictly worse than the defect being fixed | `legacy-all` stays the default and `tiered` is opt-in behind a Human Gate until 4.4 decides on evidence; 2.2 asserts that `tier_a_count + tier_b_count` equals the full projected catalogue | Phase 2 — Tier the projection against the modelled budget |
| 5 | The tier split oscillates with observed usage | implementation | A skill that flips between Tier A and Tier B across installs makes the agent's memory of where it found a skill unreliable, and the flip is invisible after the fact | 2.1 writes `model_inputs` and the fallback actually used into `skill-tiers.json` so a tier is explicable; hysteresis is added only if 4.2 observes flipping, not pre-emptively | Phase 2 — Tier the projection against the modelled budget |
| 6 | The lite and kernel servers drift after the two tools are ported | implementation | Two implementations of `suggest_skill_for_task` and `read_skill` diverge silently, and the existing parity task only covers the surfaces listed in its subset | 1.1 keeps `task mcp:turnkey-parity` green as a verify condition and the two ported tools must enter that task's subset list, or parity is a claim rather than a check | Phase 1 — Make the promised tool reachable on the default path |
| 7 | Trigger seeding raises unintended activations while raising coverage | implementation | Indexing `triggers:` text and then seeding triggers for Tier B skills widens what matches a prompt, and coverage rising is indistinguishable from noise rising without the second number | 3.1 keeps the ranker change only if matrix `top3` does not regress and per-prompt cost stays inside the latency budget; 3.2 gates each tranche on the unintended-activation census not exceeding its recorded ceiling | Phase 3 — Index what routes |
| 8 | The small-N live arm is read as proof in whichever direction it points | product | Twenty sessions per arm on one machine cannot settle H1, and a roadmap that treats the result as decisive would either adopt tiering on noise or bury it on noise | 4.2 states N, date range and host version in the artefact and admits "did not hold" as a valid close; 4.4 records the null in `docs/CLAIMS.md` and closes with outcome `measured-null` rather than leaving the default unstated | Phase 4 — The falsifier (pre-registered; decides the default) |

## Acceptance criteria

- [x] A consumer on the documented end-user path can call
      `suggest_skill_for_task` without hand-editing any config (Phase 1).
      *Met:* `ensure_mcp_bridge` writes the entry at install time for the
      `claude-code` tool, and the turnkey server serves the tool. Neither half
      existed before: `grep -ic mcp src/scripts/install.ts` was 0 and
      `tools/list` returned `[]`.
- [x] No rule instructs a tool call the default install cannot make (1.4).
      *Met:* the default install now registers the server, AND
      `missing-skill-recovery.md` step 5 covers the residual case where it is
      absent — so the rule is fulfillable by default and honest when it is not.
- [x] The catalogue's host-side fate is *predicted* per skill before install,
      with the model's assumptions named (0.1, 2.1).
      *Met, with the prediction's own accuracy published against it:* all five
      upstream-prose assumptions are returned by id with a reason, and the model
      disagrees with the one real observation on four of eight sampled entries.
      A prediction whose error bar is recorded beside it is what this criterion
      asks for; a confident one would not have been.
- [x] The registered server's standing cost is a measured, pinned number ≤ 600
      tok, and the kernel server's ≈1,972-tok cost is recorded as the reason
      it is not the one registered (0.2, 1.1).
      *Met, with the second figure corrected:* the registered surface is **222
      tok** against a 600 cap, asserted. The kernel's cost is **1,791 tok** in
      descriptions and **3,886 tok** as the payload the host actually loads —
      not 1,972, and the payload figure is the one that belongs against the Tool
      Search threshold. Both are in the metric row and both are asserted in
      `tests/scripts/mcp_lite_tools.test.ts`, which is more than "recorded".
- [x] The ranker indexes `triggers:` and its matrix hit rate is recorded
      before and after (0.3, 3.1).
      *Met, and the after equals the before:* keyword-v1 and keyword-v2 both
      measure top1 0.615 / top3 0.769. Recorded as the null it is, with the
      reason (4 declaring skills pre-tranche, none of them in the labelled
      corpus) rather than presented as an improvement.
- [x] `tiered` becomes default only by 4.4, or the null is published.
      *Met via the second branch:* `tiered` was never made default, and two
      nulls are published — `claim:skill-tiering-h1-unmeasured` and
      `claim:skill-tiering-h2-costs-more-by-default`.
- [x] No embedding model, daemon, or network call is introduced anywhere in
      the skill path ("zero runtime daemon" claim in `package.json:4` stays
      machine-checked).
      *Met:* the ranker is deterministic keyword scoring in a Node-free module;
      the tier model and the tier split are pure functions over the file system.
      Verified rather than asserted — grepping every added line across the skill
      path (`src/shared/skillRanking.ts`, `src/cli/mcp/`,
      `_lib/host_listing_model.ts`, `compute_skill_tiers.ts`,
      `measure_skill_ranker_baseline.ts`) for `fetch(`, a URL, `net.`,
      `setInterval`, `child_process`, `spawn`, `listen(`, `WebSocket`,
      `onnxruntime`, `@xenova` and `embedding` returns **zero** hits, and
      `check_claims` stays green.

## Risks

- **R1 — models ignore served skills (AAIF WG, measured).** Mitigated by
  keeping the deterministic push hook primary and by measuring adherence
  decay in 4.3 rather than assuming the nudge holds.
- **R2 — Tool Search threshold.** A ≤3-tool server loads upfront; cost is
  budgeted in 1.1, not assumed deferred. If Anthropic lowers the threshold or
  `auto:N` becomes settable from `.mcp.json`, re-measure; do not pre-empt.
- **R3 — retrieval-layer flooding (ToolFlood, arXiv 2603.13950).** Not
  applicable while the index is sealed to the projected tree and scoring is
  deterministic. Becomes applicable the day org-packs can inject skills into
  the index; that day, the pack lockfile (SHA+content-hash) is the boundary.
- **R4 — the tier split oscillates with usage.** A skill that flips tiers
  between installs confuses the agent's memory of where it found it. 2.1
  writes the inputs; add hysteresis only if 4.2 shows flipping, not before.
- **R5 — two servers drift.** Lite and kernel already have a parity task
  (`taskfiles/mcp.yml:31`); the two ported tools must be in its subset list
  or parity is a claim, not a check.

## Out of scope

- Replacing the kernel server, its 27-tool surface, or its beta criteria.
- Deleting skills to fit the host budget (ruled out by the archived routing
  roadmap's scope section; the estate-count target has its own roadmap).
- Any embedding- or LLM-judge-based ranker.
- Hosts other than Claude Code for the live arm (Codex's
  `budget-strip-and-drop` mode is a different mechanism; its model is a
  separate 0.1-style step if ever needed).
- Remote/Cloudflare MCP — same content, separate safety contract; untouched.
