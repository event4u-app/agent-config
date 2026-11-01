---
complexity: structural
status: done
tree_pin: 1255b23485
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_offset_exempt: "Opened and archived in the same change (round inbox-2026-11-c, executed in the invocation that authored it). Owner search at 1255b23485: grep -rlF for memory_lookup twin, resolve_template_script, knowledge_ingest, stop_reason, finish_reason, digestOf, destructiveHint over agents/roadmaps/*.md, later/ and stubs/ found no roadmap owning CLI/MCP parity, council truncation, host-docs claim drift or MCP annotations; road-to-a-memory-each-worker-is-handed hands memory to workers and does not own which implementation answers."
relates:
  - slug: road-to-a-memory-each-worker-is-handed
    relation: precedes
    note: "D1 decides which implementation answers a worker's memory lookup; Phase 1 lands before that roadmap's step 1.2."
---
# Road to twins that answer alike

> **Source:** `agents/tmp.old/inbox-2026-11-c/` (topic T1, supplied plan v3 + transcript + second plan).
> **Arrivals:** 1 — `inbox-2026-11-c` (2026-11-01).

## Goal

One operation, one answer: `./agent-config memory:lookup` and the MCP tool
`memory_lookup` resolve to the same implementation, documented sub-commands
resolve, a truncated council answer is not counted as a vote, the host-docs
watcher names the claim that broke instead of reacting to any byte, MCP tools
carry all four annotation hints, and swallowed input is counted.

## Verified defects at the pin (Phase 4 of the inbox run)

| ID | Defect | Evidence at `1255b23485` | Verdict |
|---|---|---|---|
| D1 | CLI `memory:lookup` runs the template copy (1,186 lines), MCP runs `src/scripts/memory_lookup.ts` (1,827). `./agent-config memory:lookup --types ownership --detail index` → `unrecognized arguments: --detail`; the src script accepts it. All 7 twin pairs differ byte-wise. | `src/scripts/_dispatch.bash` `cmd_memory_lookup`, `resolve_template_script`; `src/scripts/mcp_server/tools.ts:455,544,615` | still-true, reproduced |
| D2 | `./agent-config knowledge ingest .` → `invalid choice: 'ingest'`; the implementation `src/cli/python/knowledge_ingest.ts` has no dispatcher verb; `docs/deploy/small-team-recipe.md:87` names an unregistered `knowledge:ingest`. | dispatcher `cmd_knowledge`; `dist/agent-src/commands/knowledge/{ingest,list,forget}.md` | still-true, reproduced |
| D3 | Dispatcher target `src/cli/python/workspace_analytics.ts` is outside `package.json` `files[]`. | `cmd_analytics`; `package.json` `files` | still-true (maintainer-only command) |
| D5 | Zero reads of `stop_reason` / `finish_reason` / `finishReason` in `src/scripts/ai_council/`; a truncated, parseable answer counts as a vote. Same class reported for the self-review gate and the free-route client in two earlier inbox rounds. | `grep -rnE 'stop_reason\|finish_reason\|finishReason' src/scripts/ai_council/` → 0 | still-true |
| D6 | `digestOf` hashes the whole page body; any cosmetic edit turns the watcher red without naming a row. | `src/scripts/check_host_docs_digest.ts:121,198` | still-true |
| D7 | Only `readOnlyHint` is emitted; by MCP spec defaults additive tools read as destructive and open-world. | `src/scripts/mcp_server/tools.ts:1761` | still-true |
| D8 | Malformed intake lines and unreadable chunks are skipped with `continue`, envelope stays `ok`. | `src/scripts/memory_lookup.ts:437-441`, `:509-513` | still-true |
| D4 | Ingest writes chunks before the manifest; an aborted run leaves retrievable, unforgettable chunks. | `src/cli/python/knowledge_ingest.ts` | still-true, bound to D2 |

## Decisions

| # | Question | Resolution | Who | Revisit-if |
|---|---|---|---|---|
| E1 | Revive or retire the local `/knowledge` cluster? | **Revive under its own verb `knowledge:local`.** Retiring removes a documented surface (owner-reserved); reviving is additive and makes the existing guide and recipe true. | agent (reversible, additive) | measured zero use over two releases |
| E2 | Merge the twins or keep parallel copies? | **Dispatcher-level unification first:** `memory:lookup` / `memory:status` resolve a consumer override in `scripts/`, else the package's canonical `src/scripts/` file — the one MCP imports. Template copies stay for consumers that copy scripts; a parity ratchet pins every remaining byte divergence. | agent | a consumer reports a `.augment/templates/scripts` override they rely on |
| E3 | A truncated answer in quorum? | Counts as `incomplete` (abstention), visible in the record. | agent (findings, consensus, quorum) | — |
| E7 | Does a truncated stance abstain in the stance tally? | **Open — owner.** `stance_tally.ts` is a ratification-gated verdict rule; a change needs a ratification artifact under `agents/evidence/ratifications/`. Recommendation: abstain (counts in `w_total`, backs nothing), the fail-safe already applied to unparseable stances. | owner | — |
| E4 | Does the page hash stay a red trigger? | No. Red only on a claimed token that is absent; the digest stays as evidence. | agent | a real host change slips through with all claimed tokens present |
| E5 | `run_tests` open-world? | Stays `openWorldHint: true` until the runner is proven offline. | agent | — |
| E6 | Own stem or fold? | Own stem; no active roadmap owns these surfaces. | agent | — |

## Phase 1 — One implementation behind both surfaces (D1)

- [x] **1.1 Dispatcher resolves the canonical script.** `memory:lookup` and <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_dispatch.bash -->
      `memory:status` resolve `$CONSUMER_ROOT/scripts/<name>` (a real consumer
      override) else `src/scripts/<name>` — the file MCP imports.
      verify: `./agent-config memory:lookup --types ownership --detail index --format json` -> 0
- [x] **1.2 Parity witness.** A test drives the dispatcher and the MCP handler <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/memory_lookup.ts -->
      with the same fixture memory tree and arguments and compares the
      normalised envelopes.
      verify: `npx vitest run tests/scripts/memory_twin_parity.test.ts` -> 0
- [x] **1.3 Twin divergence ratchet.** Already satisfied at the pin: <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/memory_lookup.ts -->
      `lint_memory_twin_parity` with `src/config/memory-twin-verdicts.yml` pins
      every pair as `exact` or a shrink-only `bounded` ceiling. The behavioural
      witness of 1.2 also found the MCP wire serialising `confidence` as
      `{"value":0.8}` and dates as `{"pyStr":…}` (marker classes without
      `toJSON`); fixed in both twins.
      verify: `./scripts-run src/scripts/lint_memory_twin_parity` -> 0

## Phase 2 — Documented commands resolve (D2, D3, D4)

- [x] **2.1 `knowledge:local` verb.** Dispatcher routes `knowledge:local <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=dependency manifest: package.json -->
      {ingest|list|forget}` to `src/cli/python/knowledge_ingest.ts`; the three
      `/knowledge` commands, the guide and the deploy recipe name it.
      verify: `./agent-config knowledge:local list --format json` -> 0
- [x] **2.2 Sub-command level in `lint_documented_commands`.** A documented <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_documented_commands.ts -->
      `./agent-config <verb> <sub>` is checked against the sub-command choices
      the target CLI declares; `knowledge ingest` fails.
      verify: `npx vitest run tests/scripts/lint_documented_commands.test.ts` -> 0
- [x] **2.3 Dispatcher targets ship or are declared maintainer-only.** A test <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      checks every `resolve_script` target is inside `files[]` or on a
      maintainer-only list naming its reason.
      verify: `npx vitest run tests/scripts/dispatch_targets_shipped.test.ts` -> 0
- [x] **2.4 Atomic ingest (D4).** Chunks go to `<id>.partial/`, renamed after <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/python/knowledge_ingest.ts -->
      the manifest; an abort removes `.partial`; lookup ignores `*.partial`.
      verify: `npx vitest run tests/scripts/cli_python/knowledge_ingest.test.ts` -> 0

## Phase 3 — A truncated answer is not a vote (D5)

- [x] **3.1 `stop_class` on council responses.** Anthropic `stop_reason` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/stop_class.ts -->
      (`max_tokens`, `model_context_window_exceeded`), OpenAI-compatible
      `finish_reason === 'length'`, Gemini `finishReason === 'MAX_TOKENS'` map to
      `truncated`/`context_exceeded`; CLI seats report `unknown`, never a guess.
      verify: `npx vitest run tests/scripts/ai_council/stop_class.test.ts` -> 0
- [x] **3.2 Truncated answers abstain.** A truncated response is recorded as <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/consensus.ts -->
      `incomplete` and not counted as a full vote. No auto-continuation.
      verify: `npx vitest run tests/scripts/ai_council/stop_class.test.ts` -> 0

## Phase 4 — Drift on claims, not on bytes (D6)

- [x] **4.1 Claimed tokens per row.** Each watched row derives the tokens it <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: .github/workflows/host-docs-digest.yml -->
      itself claims (event names, keys); a changed page with every claim present
      is `CONFIRMED` (green, noted), a missing claim is `ABSENT` (red, names row
      and token), fetch failure stays `UNREACHABLE`.
      verify: `npx vitest run tests/scripts/host_docs_digest.test.ts` -> 0

## Phase 5 — Honest MCP annotations (D7)

- [x] **5.1 Four hints per tool.** `readOnlyHint`, `destructiveHint`, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/mcp_server/annotations.ts -->
      `idempotentHint`, `openWorldHint` derived from `side_effect` plus an
      optional `effect_shape`; additive tools are `destructiveHint: false`.
      verify: `npx vitest run tests/scripts/mcp_server/tool_annotations.test.ts` -> 0

## Phase 6 — Swallowed input is counted (D8)

- [x] **6.1 `skipped_malformed` / `skipped_unreadable`.** Additive envelope <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/memory_lookup.ts -->
      counters, emitted only when non-zero (default output byte-identical).
      verify: `npx vitest run tests/scripts/memory_lookup_swallowed.test.ts` -> 0

## Phase 7 — Independent re-check

- [x] **7.1 Re-measure D1–D8 at the final head** with the Phase-4 commands of <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      the inbox run; each row flips to fixed or stays named.
      verify: `npx vitest run tests/scripts/memory_twin_parity.test.ts` -> 0

## Outcome at the final head

| ID | State | Where |
|---|---|---|
| D1 | fixed | dispatcher resolves `src/scripts/memory_lookup.ts`; `tests/scripts/memory_twin_parity.test.ts` |
| D2 | fixed | `knowledge:local` verb; sub-command level in `lint_documented_commands` (proven red on the unfixed tree) |
| D3 | named | `workspace_analytics.ts` declared maintainer-only in `tests/scripts/dispatch_targets_shipped.test.ts` |
| D4 | fixed | `<id>.partial/` staging in `knowledge_ingest.ts` |
| D5 | fixed, one part with the owner | `ai_council/stop_class.ts`; a truncated answer parses as `truncated` in findings, is recorded without extraction or re-ask in the consensus round, and counts as absent for quorum. The stance tally (`stance_tally.ts`) is the verdict rule ADR-268 reserves to the owner, so whether a truncated stance abstains there is decision E7 |
| D6 | fixed | claimed-token classification in `check_host_docs_digest.ts`; a live run found `windsurf/any` ABSENT — its row needs a by-hand re-read, which the watcher's own issue routing carries |
| D7 | fixed | `mcp_server/annotations.ts`; catalog pins four hints. The `tools/list` payload band in `mcp_lite_tools.test.ts` rose ~4,900 → ~5,390 tokens (~17 per tool): a dropped hint brings back the wrong spec default, so the cost was taken over trimming descriptions |
| D8 | fixed | `skipped_malformed` / `skipped_unreadable` in both twins |

## Not adopted from the source set

- **Second supplied plan (research layer: evidence bundle, source registry,
  hybrid retrieval, claim validator, deep-research journey, external notebook
  adapters, media pipeline)** — declined: no tree defect at the pin backs any of
  its 18 tickets, and its own text marks its gaps as unverified inventory gates.
  The evidence-production and knowledge-view subjects are already owned by
  `later/road-to-governed-evidence-production` and `later/road-to-a-knowledge-atlas`.
- Vector index / embeddings, podcast pipeline, notebook-service integration,
  cassette framework, per-vendor docs parser, auto-continuation on
  `max_tokens`, a new provider-error taxonomy, a new CLI verb for parity
  reports — declined for the reasons in the supplied plan's kill list (no
  defect, existing coverage, or paid-call loops).

## Risk Register

| Risk | Mitigation |
|---|---|
| A consumer relied on `.augment/templates/scripts/memory_lookup.ts` as an override | `.augment/` is a package projection, not a consumer surface; `scripts/` stays the override path (E2 revisit-if). |
| Annotation change alters host prompting | Only additive tools move to `destructiveHint: false`; destructive tools keep `true`. |
| Claim-token watcher misses a semantic change | Digest kept as evidence; E4 revisit-if. |
