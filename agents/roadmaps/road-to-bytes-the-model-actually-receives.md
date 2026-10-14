---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Second arrival of one subject: round inbox-2026-10-p asks that every item of the resource-economy plans consumed in inbox-2026-09-ab be implemented, and the two roadmaps that round produced are both archived. Nothing active owns what is left here: road-to-placeholders-on-the-wire owns the tool-result rewrite for privacy and no measurement, and later/road-to-a-byte-bound-and-a-public-figure owns only a ratchet and a public figure, both waiting on the census this roadmap corrects. Archiving or parking leaves a shipped metric mislabelled (it reports the host envelope as what reached the model, 19.5x too high for Edit and Write) and two package-owned traffic defects open; merging into the placeholders roadmap would put a measurement correction behind three owner and council blockers it does not need."
estate_growth_exempt: "First of a two-roadmap set from round inbox-2026-10-p; grows active_roadmaps by one and open_blockers by zero. The growth is the price of a shipped metric that misreports what reached the model and of two package-owned traffic defects that no open roadmap owns."
relates:
  - slug: road-to-placeholders-on-the-wire
    relation: disjoint
    note: "Owns the single rewrite stage, the composition ADR and the tool-output probe. This file emits no rewrite and edits no dispatcher stage; its Phase 1 corrects the before-figure that roadmap's step 3.2 will compare against."
  - slug: road-to-tool-results-that-leave-a-handle
    relation: extends
    note: "Sibling from the same round. It consumes Phase 1's model-visible distribution to choose which tool classes are worth reducing, and Phase 2's content key for the repeated-Read reference."
---
# Road to bytes the model actually receives

> **Source:** `agents/tmp.old/inbox-2026-10-p/` — two chat transcripts in which the
> owner asks, of the resource-economy plans consumed by round `inbox-2026-09-ab`,
> that "really everything" be implemented, and two agents compare those plans with
> the tree at `main@0f9c32e`. Every reading below was re-taken at
> `main@9a943f30c` on 2026-10-14. Readings marked *(executed)* ran against this
> tree or against this machine's own gitignored stores, read-only.

## Goal

Every byte figure this package records about a tool result says **which** bytes it
counted — the host's hook envelope or what reached the model — and the
model-visible figure exists per tool class, measured from transcripts that already
sit on disk. The repeated-read advisory claims "unchanged" only for unchanged
content. The package's own recurring traffic — the MCP server start and the CI
wait loops its commands teach — does no request it can avoid. Every item of the
two source plans carries a recorded disposition, so the next round meets a record
instead of a re-derivation.

## Context — read at `main@9a943f30c`

| # | Finding | Evidence |
|---|---|---|
| F1 | **The delivered-bytes metric counts the hook envelope, not what reached the model.** The recorder measures `JSON.stringify` of the host's `tool_response` (`src/scripts/hooks/tool_result_bytes_hook.ts:122`, `:160-162`) and its header calls the second field "what reached the model" (`:51-52`); the registry repeats it (`src/config/metric-registry.yml`, `tool-delivered-bytes`). For Edit and Write the host's envelope carries the whole original file. *(executed)* over 12 local session transcripts: Edit/Write 263 results, **59,306** model-visible characters against **1,159,162** envelope characters (19.5×); Bash 3,127 results, 2.69 M against 3.87 M (1.44×); Read within 0.1 %; in that sample 339 image Reads carry 85.2 M characters of encoded image, more than every text class together. In the census, Edit is the largest term — 136.1 MB of 372.5 MB since 2026-09-30 — which is an artefact of what was counted. |
| F2 | **The census holds two record shapes.** *(executed)* 142,709 lines carry `{bytes}` (written before the two-field schema), 65,006 carry `{raw_bytes, delivered_bytes}` (from 2026-09-30, 14 distinct dates). No reader exists yet (`src/config/hook-token-budget.json:110`, "stays unread"), so nothing has been misread — but the first reader must handle both. |
| F3 | **The parked ratchet's wake condition can never fire.** `later/road-to-a-byte-bound-and-a-public-figure.md` `entry_condition.what` reads `jq -r .date … \| sort -u \| wc -l`. *(executed)* no census line has a `date` field: the command prints `null` 207,715 times and counts **1**. The same question asked of `.ts[0:10]` reads **54** (14 for the two-field shape). The condition the file states is met on this machine; the command it gives to check it is not. |
| F4 | **The repeated-read advisory keys on mtime and size.** `src/scripts/hooks/reread_guard_hook.ts:262` compares `prior.mtime === mtime && prior.size === size` and the line it injects says "unchanged since (same mtime+size)" (`:190`). A copy that preserves mtime with an equal-length change reads as unchanged; a checkout restoring identical content reads as changed. |
| F5 | **The MCP server start resolves through the registry path.** `src/scripts/_lib/mcp_bridge.ts:57-60` writes `npx -y @event4u/agent-config@<version> mcp-server`; the version pin exists, `--prefer-offline` does not. The flag is already documented for this package's own install path (`docs/setup/enterprise-and-offline.md:78`). The documented end-user shape (`docs/getting-started-local-stdio.md:21`) is unpinned and also lacks it. |
| F6 | **Two commands teach a hand-written 45-second poll loop.** `src/domains/engineering-base/fix/ci/command.md:28-30` and `src/domains/git/pr/create/command.md:487-489` each carry `until … gh pr checks …; do sleep 45; done`, while the rule says "for CI use `ci_settle <pr>` rather than a hand-written loop" (`src/rules/context-hygiene.md:89`) and `src/scripts/ci_settle.ts` polls at 60 s by default (`:468`) with an exit contract the loop lacks. |
| F7 | **The deep-clone tier states no clone shape.** `src/domains/analysis-workbench/analyze/repo/command.md:171-173` permits "a read-only clone at a pinned SHA" and bounds operations, bytes read and wall-clock — but not the bytes transferred, and not whether an existing local copy is reused. |
| F8 | **A subagent leg starts cold, measured once, two months ago.** First-call cache-read share 2.8 %, median first-call uncached 242,891 tokens (`agents/evidence/analysis/downshift-vs-cache.md:49-51`, last changed 2026-08-16). The standing payload a leg loads has moved since (scoped projection); the figure has not been re-taken, and `src/scripts/hooks/delegation_nudge_hook.ts` reads no cost input. |

**Already present, no phase.** Byte metrics with a `basis` field, a derived
provider-bytes column, the claims gate for byte figures, an explicit `unavailable`
for the host's fetch tool and transport (archived `road-to-a-bytes-row-that-exists`);
documented host traffic variables and a `doctor --json` network block, with the
owner ruling of 2026-09-30 that this package never writes a variable that can
disable the host's updater (`src/scripts/_lib/host_env_write.ts:31-32`; archived
`road-to-host-traffic-knobs-that-ship`); one waiter per condition
(`src/rules/context-hygiene.md:85-91`); a token-based recycle threshold with a
written review date (`src/config/recycle-threshold-budget.json`).

## Phase 1 — Count what reached the model

- [x] **1.1 Name the bytes the recorder counts.** `tool-raw-bytes` and
      `tool-delivered-bytes` are re-described as the host's **hook envelope** in
      `metric-registry.yml` and in the recorder's header, with F1's ratio as the
      reason. No field is renamed — the census is append-only and F2 already shows
      what a schema change leaves behind. `corrected-from-reproduction`.
      verify: `grep -c 'hook envelope' src/config/metric-registry.yml src/scripts/hooks/tool_result_bytes_hook.ts` -> /:[1-9]/
- [x] **1.2 Measure model-visible bytes from the transcripts.** The transcript
      reader gains a tool-result pass: user records' `tool_result` content bytes,
      joined to the assistant `tool_use` name by id, aggregated per tool. A new
      registry row `tool-model-visible-bytes`, `basis: measured`, names this reader
      as its producer. Case `edit-envelope-is-not-model-visible` builds an Edit
      fixture whose envelope carries an original file and asserts the
      model-visible count is the confirmation text only; seen red first.
      verify: `npx vitest run tests/scripts/cc_transcript.test.ts -t edit-envelope-is-not-model-visible --reporter=verbose` -> /✓.*edit-envelope-is-not-model-visible/
- [x] **1.3 Read both census shapes.** Whatever reads
      `tool-result-census.jsonl` treats a `{bytes}` line as `raw_bytes` with
      `delivered_bytes` unknown, never as equal.
      verify: `npx vitest run tests/scripts/tool_result_bytes_hook.test.ts -t legacy-bytes-line-is-raw-only --reporter=verbose` -> /✓.*legacy-bytes-line-is-raw-only/
      *Correction 2026-10-14: no census reader existed to extend, so the reader is
      a new module, `src/scripts/_lib/tool_result_census.ts` (`readCensusLine`),
      kept out of the hook file so the post_tool_use bundle does not grow.*
- [x] **1.4 Record one dated distribution.** Per tool class: count, envelope
      bytes, model-visible bytes, p50/p95, with image and text Reads as separate
      classes — from this repository's own sessions,
      under `agents/evidence/analysis/`, labelled machine-local. This is the
      before-figure the sibling roadmap and the placeholders roadmap's step 3.2
      compare against.
      verify: `ls agents/evidence/analysis/ | grep -c model-visible-bytes` -> /^[1-9]/
      *Done 2026-10-14: `agents/evidence/analysis/model-visible-bytes-2026-10-14.md`,
      83,031 results over 678 transcript files. The full corpus corrects F1's
      12-session ratio: Edit 17.2x, Write 23.2x, Bash 1.58x.*

*Exit: 1.1–1.4 done; `npx tsx src/scripts/lint_metric_consumers.ts` green with the new row.*

## Phase 2 — "Unchanged" means the same content

- [x] **2.1 Pin both failure directions as tests.** In
      `tests/scripts/reread_guard_hook.test.ts`: `same-mtime-same-size-new-content-is-not-unchanged`
      (a file rewritten to equal length with its mtime restored) and
      `restored-identical-content-is-unchanged` (same bytes, new mtime). Seen red
      before 2.2.
      verify: `npx vitest run tests/scripts/reread_guard_hook.test.ts -t same-mtime-same-size-new-content-is-not-unchanged --reporter=verbose` -> /✓.*same-mtime-same-size-new-content-is-not-unchanged/
- [x] **2.2 Key the ledger on content.** A read record gains `sha256` of the file;
      the duplicate line fires on equal hash, and its text says "unchanged content".
      Above a size bound (D3) the record keeps mtime and size and the line says so.
      The ledger still holds numbers and hashes only — never content.
      verify: `npx vitest run tests/scripts/reread_guard_hook.test.ts -t restored-identical-content-is-unchanged --reporter=verbose` -> /✓.*restored-identical-content-is-unchanged/
- [x] **2.3 State the cost.** The PR states the hook bundle delta and the measured
      per-Read latency delta here, under *Cost Phase 2 added* (corrected from
      `src/config/hook-latency-budget.json`, see D10).
      verify: `grep -c 'reread-guard content hash' agents/roadmaps/road-to-bytes-the-model-actually-receives.md` -> /^[1-9]/
      *Correction 2026-10-14: the budget file carries no per-change ledger — the
      one precedent (`724329fd4`) wrote its cost into its roadmap and the file
      together — and the file is now a hook-plumbing surface that
      `check_kernel_edit_ratified` gates behind a two-provider ratification
      record. A note about a sub-millisecond delta does not warrant a governance
      record; the figure lives here instead (D10).*

**Cost Phase 2 added — reread-guard content hash.**

Measured 2026-10-14 on this branch, darwin, Apple silicon:

- **Hook bundle:** 1,523,151 B before, 1,523,892 B after (+741 B) against a
  1,550,000 B ceiling (`check_hook_bundle_composition`).
- **Per-Read latency:** the added work is one `sha256` over the file, on full
  Reads only. Mean of 200 runs: 0.011 ms at the p50 text-Read size (1,095 B),
  0.030 ms at the p95 (42,029 B), 0.749 ms at the 2 MB bound — the worst case,
  since above it nothing is hashed. Sizes from
  `agents/evidence/analysis/model-visible-bytes-2026-10-14.md`. Against a
  175 ms `pre_tool_use` p95 cap this is below the run-to-run noise the budget
  file records (42 ms).

## Phase 3 — The package's own recurring traffic

- [x] **3.1 The MCP entry prefers the local cache (D1).** `mcpBridgeEntry` writes
      `npx --prefer-offline -y <pkg>@<version> mcp-server`; the documented shape in
      `docs/getting-started-local-stdio.md:21` matches it. With an exact version, a
      warm cache answers without a registry request; a cold cache still resolves.
      verify: `npx vitest run tests/scripts/mcp_bridge_pin.test.ts -t entry-prefers-offline --reporter=verbose` -> /✓.*entry-prefers-offline/
      *Narrowed 2026-10-14: the flag is written only beside a pinned version.
      With no readable version the spec stays unpinned, and `--prefer-offline`
      there would serve a cached `latest` stale. The four snippets in
      `docs/mcp-server.md` and the npx line of `docs/setup/mcp-client-config.md`
      carry the same shape.*
- [x] **3.2 The two commands wait with `ci_settle` (D2).** Both loops in F6 become
      one background `ci_settle <pr>` call through the path the git-workflow skill
      already names (`src/skills/git-workflow/SKILL.md:110`), keeping each
      command's surrounding prose on what to do with each exit code.
      verify: `grep -rl 'do sleep 45' src/domains | wc -l` -> /^\s*0$/
- [x] **3.3 The deep clone states its shape and its transfer (D4).** `--deep`
      reuses an existing local clone that already holds the pinned SHA; otherwise
      it fetches only that commit at depth 1 into a fresh directory. The ceiling
      gains a fourth part, bytes transferred, read from git's own receive line.
      verify: `grep -c 'transfer' src/domains/analysis-workbench/analyze/repo/command.md` -> /^[1-9]/

## Phase 4 — Does a spawn still cost a quarter million tokens?

- [ ] **4.1 Re-take the cold-start reading.** Re-run the `downshift-vs-cache`
      method at the current tree: first-call cache-read share and median
      first-call uncached tokens per leg, dated, beside the 2026-08-16 figures.
      verify: `ls agents/evidence/analysis/ | grep -c subagent-cold-start` -> /^[1-9]/
- [ ] **4.2 Decide the nudge on the new figure (D5).** If a leg still starts
      above 100,000 uncached tokens, the delegation nudge gains one advisory clause
      — a slice of one to three direct reads does not amortise a leg — and never a
      block. Otherwise the reading is recorded and the nudge is unchanged. Either
      outcome closes the step; the decision and the figure go into this file's
      `## Decisions` as row D7.
      verify: `grep -c '^| D7 ' agents/roadmaps/road-to-bytes-the-model-actually-receives.md` -> /^1$/

## Disposition of every item of the source plans

The owner asked for **all** of it. This table is the record that answers that,
item by item, so a third arrival meets it. "Planned" names the open roadmap that
owns it; "here" or "sibling" names this file or
`road-to-tool-results-that-leave-a-handle`.

| Source item | Disposition | Where / why |
|---|---|---|
| W0.1–W0.3 byte rows, basis, raw vs delivered | already shipped | archived `road-to-a-bytes-row-that-exists`; the delivered half is corrected here (Phase 1) |
| W0.4 cold starts and turns, automated | here | Phase 4 re-takes the figure; turns per request already measured (`agent-turnaround-2026-08-30.md:30-35`) |
| W0.5 external bytes of package-owned fetches | declined | the package's GET fetchers are a weekly CI job (`.github/workflows/host-docs-digest.yml:50`) and two explicit maintainer commands; WebFetch is 436,658 of 372.5 M census bytes (0.12 %) and host-owned |
| W0.6 interface-counter calibration | declined | network sniffing on a working machine for a figure the registry already declares `unavailable`; no decision waits on it |
| W1.1 / Ph12 recycle by bytes | declined | provider bytes are tokens times a measured factor, so a byte trigger is the token trigger in another unit; the real gap (windows of 200 k and under) is recorded with `review_by: 2026-11-10` in `recycle-threshold-budget.json` |
| W1.2 / Ph6.2 cost-aware spawn admission | here | Phase 4 |
| W1.3 / Ph6.3 minimal spawn envelope | declined | the leg's first call is dominated by standing payload, owned by the scoped-projection work, not by the brief |
| W1.4 / Ph6.5 resume over respawn | declined | resuming a leg is a host primitive the agent already chooses per dispatch; the package has no surface to lower it onto |
| W1.5 `context: fork` | declined | corrected in the source itself: a fork is isolated and inherits no cache |
| W2.1 composition ADR, Ph1.2 probe, W2.4 rewrite axis | planned | `road-to-placeholders-on-the-wire` 0.1, 1.1, 6.1 |
| Ph1.3 capability states per host and tool | planned | same roadmap, 0.1 records `observed` / `not-observable` per tool and version; 6.1 the axis |
| W2.2 / Ph2 spool, content-addressed store | sibling | `road-to-tool-results-that-leave-a-handle` |
| W2.3 / Ph3.1 Write/Edit echo reducer | declined | *(executed)* the model already receives a ~265-character confirmation for an Edit; the bytes the plan attributed to the echo are envelope bytes (F1) |
| W2.3 / Ph3.2 content-keyed re-read | here + sibling | Phase 2 corrects the key; replacing the second read by a reference is the sibling's |
| W2.3 / Ph3.3 deterministic CLI reducers | sibling | the Bash class; `rtk` stays the advisory path where its binary is verified |
| W2.5 / Ph3.4 bench and net-win floor | sibling | its acceptance criteria |
| W3.1 / Ph9 `normal\|lean\|metered` profile | already decided | owner ruling 2026-09-30: never write a variable that can disable the host updater; size caps ship (`host_env_write.ts:31-32`); the source transcript agrees |
| W3.2 / Ph8.2 `--prefer-offline` on the MCP entry | here | 3.1 |
| Ph8.1 start the installed runtime directly | declined | breaks the documented `npx` path for projects without a local install; 3.1 removes the registry request on a warm cache without that cost (D1) |
| W3.3 update check joins the profile | declined | one registry request a day after a CLI subcommand (`check_update_banner.ts`), no profile to join (W3.1) |
| W3.4 / Ph8.3 one runtime, gate the built tarball (E7) | declined (owner, 2026-10-14) | would reverse the recorded 2026-08-04 release decision not to gate unpacked size (`src/config/pack-size-budget.json` `_comment`); the owner kept it — keep measuring, no gate — since no consumer cost has been measured since; D9 |
| W3.5 package-manager rule line | declined | a standing rule line is paid on every spawn and no repeated-reinstall incident is recorded |
| W4.1 / Ph4.1–4.2 HTTP validator cache, ETag/304 | declined | see W0.5: no repeated consumer-side download to save |
| W4.2 / Ph7 clone planner, persistent object store | here, narrowed | 3.3; a persistent bare store is declined — `--deep` runs on demand and rarely |
| W4.3 GitHub API shape | declined | no over-fetch by the harvest commands is measured; a guideline section without a measured defect is prose nobody is held to |
| W4.4 / Ph4.4 text-first browser mode | declined | the package runs no research browser; UI checks need full rendering |
| W5.1 / Ph5 tool-search verification | declined | host-native; a session of this repository on 2026-10-14 listed its MCP tools as deferred without any setting from this package, so there is nothing to lower |
| W5.2 / Ph11 council bytes, Responses adapter | declined | the council is a maintainer-run, spend-gated tool whose seats also run over provider CLIs (`src/scripts/ai_council/transport_resolver.ts:60`); a per-seat byte ledger serves no decision the existing spend ledger does not |
| W6.1 promotion rule | sibling | its acceptance criteria carry the outcome floor |
| W6.2 / Ph13 shrink-only bounds | parked | `later/road-to-a-byte-bound-and-a-public-figure.md`; its wake command is broken (F3), fix handed back with this round |
| W7 public network figures | parked | same file, 1.2 |
| Ph10 one waiter, adaptive polling | already shipped + here | rule and `ci_settle` exist; the two loops that contradict them go in 3.2 |
| Network budget with mid-task rerouting | declined | no producer of network bytes exists to budget against (host transport is `unavailable`) |
| E9 non-Claude hosts stated as `none` | planned | `road-to-placeholders-on-the-wire` 6.1–6.3: a rewrite axis per host and a generated coverage table with an `uncovered` state |
| E10 ledger scope | already shipped | recorder default-off outside the maintainer workspace (`tool_result_bytes_hook.ts` § default off) |
| Six evidence classes (exact, serialized, derived, calibrated, proxy, unavailable) | declined | the registry's four `basis` values already keep a counted figure apart from a derived one; `serialized` and `calibrated` would have no producer once W0.6 is declined |
| Never combine external, payload and token savings into one figure | adopted as a constraint | K6 below, and AC-1's "names which bytes it counts" |
| E1 fold every wave into an existing owner | declined | the named targets are archived (`road-to-agent-turnaround`), absent (`road-to-external-reads-that-hold`) or own a different subject (`later/road-to-token-economy-cache-followup`, hook-injection idempotency) |
| "Session length is unaddressed" | never-true at the source's own pin | a token recycle threshold with a carried envelope was registered on 2026-08-10 (`src/config/recycle-threshold-budget.json`), before the source was drafted |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | MCP entry gains `--prefer-offline`; the installed-path form is not taken | the flag is already this package's documented offline path (`enterprise-and-offline.md:78`); an absolute installed path breaks the `npx`-only setup the getting-started page documents | a consumer reports a stale server start that `--prefer-offline` caused |
| D2 | reversible-technical | agent | the two command loops call `ci_settle` rather than gaining their own exit handling | `context-hygiene.md:89` already prescribes it; one waiter with one exit contract | `ci_settle` is not reachable from a consumer install |
| D3 | reversible-technical | agent | content hashing is bounded at 2 MB per file; above it the ledger keeps mtime and size and says so | the Read tool already pays a full read; the bound keeps the hook off the large-file path | the latency delta stated in 2.3 exceeds the budget |
| D4 | reversible-technical | agent | `--deep` reuses a local clone holding the SHA, else a depth-1 fetch of that commit; no persistent bare store | `--deep` is opt-in and on-demand; a store is a maintenance surface for a rare path | the transfer part of the ceiling fires on more than one run |
| D5 | reversible-technical | agent | the spawn nudge gains an advisory clause only if a re-taken cold start still exceeds 100,000 uncached tokens | the 2026-08-16 reading is 242,891; the threshold is under half of it and stated, not derived | a re-taken figure lands near the threshold |
| D6 | reversible-technical | agent | one roadmap for measurement and package-owned traffic, one sibling for reduction | the reduction depends on another roadmap's ADR and probe; this file depends on nothing | the sibling's dependency closes before Phase 1 here starts |
| D10 | reversible-technical | agent | Phase 2's cost is recorded in this file, not in `src/config/hook-latency-budget.json` | the budget file is ratification-gated plumbing and carries no per-change ledger; the delta is 0.03 ms at the p95 Read size and 741 B of bundle | a dispatcher change's cost is ever required in the budget file by a gate |
| D9 | product-owned | owner | The built tarball stays ungated; size keeps being measured, and the 2026-08-04 release decision stands unreopened | Owner answer 2026-10-14 to the round's E7 residue (option 1); no consumer cost measured since that decision | a measured consumer cost from package size appears |
| D8 | reversible-technical | agent | Verify lines of 1.2, 1.3, 2.1, 2.2 and 3.1 name test titles the step itself creates; each is seen red before its implementation, so the name filter matches a real test by the time the step closes (closure listing C1–C5, non-blocking by that script's own contract) | `closure_scan` lists a name filter with no matching title today because the titles do not exist yet | a step closes with its filter still matching no title |

## What this roadmap deliberately does not do

- **K1** Emit a tool-result rewrite or add a dispatcher stage — `road-to-placeholders-on-the-wire` K1.
- **K2** Write any host variable that can disable the host's updater (owner ruling, 2026-09-30).
- **K3** Rename a census field or rewrite existing census lines.
- **K4** Put a percentage target or a network figure into README or ONBOARDING.
- **K5** Add a standing rule line.
- **K6** Add envelope bytes, model-visible bytes and derived provider bytes into one total, or report any of them as a traffic saving.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The model-visible pass joins a result to the wrong tool | implementation | A `tool_use_id` that is missing or repeated across a resumed session assigns bytes to the wrong class, and the distribution of 1.4 is wrong in a way nothing downstream can see. | Unjoined results are counted in their own `unknown` class, never dropped and never guessed; the fixture of 1.2 carries one orphan result. | Phase 1 — Count what reached the model |
| 2 | Hashing on every Read costs more than the advisory saves | implementation | The guard runs on `pre_tool_use` for every Read; a full-file hash adds disk and CPU time on the hot path. | The size bound of D3 and the measured delta of 2.3; a delta over the budget reverts 2.2 and keeps 2.1's tests as a recorded gap. | Phase 2 — "Unchanged" means the same content |
| 3 | `--prefer-offline` starts a stale server | product | With an exact version pin, the cache can only hold that version; the remaining risk is a cache entry that is corrupt. | npm verifies cache integrity on read; a failed integrity check falls back to the registry. The revisit condition of D1 names the report that would reopen it. | Phase 3 — The package's own recurring traffic |
| 4 | The advisory clause suppresses a spawn that was worth it | product | A slice that looked small turns out to need the leg, and the nudge talked the agent out of it. | Advisory only, no block (4.2); the clause names the slice size it applies to. | Phase 4 — Does a spawn still cost a quarter million tokens? |

## Acceptance Criteria

- [ ] AC-1 — Every byte figure recorded about a tool result names whether it counts
      the hook envelope or the model-visible content, and a model-visible figure per
      tool class exists for this repository's own sessions.
- [ ] AC-2 — The repeated-read advisory never states "unchanged" for a file whose
      content differs from the earlier read, within the stated size bound.
- [ ] AC-3 — The MCP entry this package writes resolves from a warm cache without a
      registry request, and no command this package ships teaches a hand-written CI
      poll loop.
- [ ] AC-4 — Every item of the two source plans has a disposition in this file.
