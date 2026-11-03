---
complexity: structural
status: ready
tree_pin: b234d08480
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps over the WIP cap of 5, owner-directed 2026-11-03 (agents/evidence/owner-directives/2026-11-03-process-inbox-2026-11-n-roadmaps.md): one of eight roadmaps of round inbox-2026-11-n landed active so /roadmap:process-full executes them in the same run."
estate_offset_exempt: "Owner search at b234d08480 (grep -rlF for parseFindings, partitionDiff, 'Low / Medium / High', 'none extracted', cleanupPeriodDays, autoMemoryDirectory, storeWindow, consume_handoff_context, exec_evidence over agents/roadmaps, later, stubs) returned nothing; verified_by hit only stubs/the-14-21-0-ledger-is-ingestible.md (ingest, disjoint); MAX_REVIEW_CHUNKS hit only the later/ ceiling owner, which this roadmap does not touch."
relates:
  - slug: road-to-a-release-record-that-says-what-it-reviewed-carried
    relation: disjoint
    note: "Owns the review ceiling (spend) and A.1 files-assessed-vs-sent. Steps 1.1 and 1.3 here change only what an unparseable chunk and the ceiling cut are recorded as; A.1 composes on top."
  - slug: road-to-compaction-survival-census
    relation: disjoint
    note: "Compaction detectability stays with the stub; nothing here binds pre_compact."
---
# Road to a record that says what it lost

> **Source:** `agents/tmp.old/inbox-2026-11-n/` (topic T0, P03, P11).
> **Arrivals:** 1 — `inbox-2026-11-n` (2026-11-03).

## Goal

Review and session records say what they dropped. At the pin, a
self-review chunk whose model answer does not parse counts as read with zero
findings (`src/scripts/self_review_gate.ts:1356-1357`, `:923-933`); the review
ceiling drops chunks in diff order, so workflow and script paths can be the
ones left unread (`:750-799`); a handoff section emptied by the word cap reads
`(none extracted)` (`src/scripts/_cli/handoff_generate.ts:434-439`); and a
finding disposition names a command but not the outcome it must produce
(92 of 92 in 16.1.0–16.5.0, `agents/evidence/release-findings/`).

## Phase 1 — A review chunk that was not read is not counted as read

- [x] **1.1 Unparseable answer = unreviewed chunk.** In <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/self_review_gate.ts -->
      `src/scripts/self_review_gate.ts` add `parseFindingsResult(text)` returning
      `{ findings, parsed }` (`parsed` false when no JSON object is found, it
      does not parse, or `findings` is not an array); keep `parseFindings` as a
      thin wrapper so existing callers are untouched. In the chunk loop
      (`:1356-1357`) increment `filesRead`/`reviewedChunks` only when `parsed`
      is true; otherwise push each `chunk.files` path to `unreviewed` with reason
      `model output not parseable as the findings shape`, mirroring the
      transport-error branch (`:1338-1354`). `{"findings":[]}` stays read.
      verify: `npx vitest run tests/scripts/self_review_unparsed_chunk.test.ts` -> 0 — cases: truncated JSON → `parsed:false`; prose-embedded JSON → parsed, 2 findings; `{"findings":[]}` → `parsed:true`, 0 findings.
- [x] **1.2 Findings carry `confidence`.** Extend the prompt schema <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/self_review_gate.ts -->
      (`self_review_gate.ts:602-605`) with
      `"confidence":"confirmed|plausible|unverified"` and the `Finding` type with
      an optional field; `parseFindings` stores a valid value and defaults a
      missing or invalid one to `unverified`, never dropping the finding
      (contract `docs/contracts/adversarial-review-protocol.md:191-208`).
      verify: `npx vitest run tests/scripts/self_review_unparsed_chunk.test.ts` -> 0 — added cases: missing confidence → `unverified`, `"high"` → `unverified`, `"confirmed"` kept.
- [x] **1.3 The ceiling drops the cheapest paths first.** Before packing in <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/self_review_gate.ts -->
      `partitionDiff` (`self_review_gate.ts:750`), stable-sort the input by risk
      tier: 1 `src/scripts/**`, `src/rules/**`, `.github/workflows/**`,
      `src/cli/**`, `src/install/**`; 2 other `src/**`, `docs/contracts/**`;
      3 `tests/**`, `docs/**`; 4 `agents/**` and everything else. Order within a
      tier is unchanged (determinism, docblock `:740-748`). The ceiling value is
      not touched.
      verify: `npx vitest run tests/scripts/self_review_prompt_budget.test.ts` -> 0 — with a new case: ceiling 1, inputs `[agents/x.md, src/scripts/y.ts]` each one chunk → `src/scripts/y.ts` read, `agents/x.md` unreviewed; two runs on the same input give identical partitions.

## Phase 2 — A disposition says what its check must produce

- [x] **2.1 Rewrite the six replay outliers with an expectation.** Ledger-only <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=unrecognised path shape: agents/evidence/release-findings/16.2.0.json -->
      edits, rationale and status unchanged: `16.2.0.json` `87a5d236cf23`
      append ` -> 1`; `6a8dd0cf9ed5` path → `agents/roadmaps/later/road-to-adversarial-verification-and-long-runs.md`, ` -> 1`;
      `16.3.0.json` `de7e020a458f` and `49c1459b49e9` ` -> 1`; `1b661735687e`
      ` -> 0`; `16.5.0.json` `114fa99927f1` → `grep -n write_bundle_digest src/scripts/hook_chunks.mjs -> 0`.
      Each expectation follows the finding's claim (a fix that removed a string
      expects 1), never the observed exit alone.
      verify: `./scripts-run src/scripts/check_finding_dispositions --release 16.3.0` -> 0
- [x] **2.2 The gate counts the oracle share, without refusing.** In <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_finding_dispositions.ts -->
      `src/scripts/check_finding_dispositions.ts` add exported
      `hasExpectation(verifiedBy)` built on `VERIFY_ARROW_SOURCE` from
      `src/agent-src/scripts/verify_clause.ts:85` (no second arrow parser), and
      extend the success line next to the existing tally (`DispositionTally`,
      `:370-385`) with `oracle: <n>/<m> fixed|false_positive rows name an expected outcome`.
      Exit semantics unchanged (a count, not a refusal — same pattern as the
      tally's own docblock).
      verify: `npx vitest run tests/scripts/check_finding_dispositions.test.ts` -> 0 — new cases: `grep -c x f -> 1` true, `grep -c x f -> "guidelines 121"` false, a prose sentence false; the success line contains `oracle:`.

## Phase 3 — One confidence vocabulary; reproduction has a column

- [x] **3.1 `security-audit` and `performance-analysis` adopt the contract <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      vocabulary.** Replace `Confidence: Low / Medium / High` in
      `src/skills/security-audit/SKILL.md:249` (keep "confirmed only with
      `proof: test`") and `src/skills/performance-analysis/SKILL.md:107`
      (and the "bounded vocabulary" sentence `:95`) with
      `confirmed | plausible | unverified`, pointing to
      `docs/contracts/adversarial-review-protocol.md` § confidence instead of
      restating it.
      verify: `grep -rn 'Confidence:\*\* Low / Medium / High' src/skills` -> 1 — exit 1, no matches; then `task lint-skills` -> 0
- [x] **3.2 The review-reply triage records the reproduction.** In <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `src/skills/receiving-code-review/SKILL.md` add a "Reproduced by" column to
      the response table (`:96-102`): a `verify:` clause in the expectation
      grammar or `not reproduced`; an accepted blocking comment without an entry
      stays open. State `enforcement: instruction-only` in prose; claim no gate.
      verify: `grep -n 'Reproduced by' src/skills/receiving-code-review/SKILL.md` -> /Reproduced by/

## Phase 4 — Session records say what they trimmed or set aside

- [x] **4.1 The handoff counts its trims.** In <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_cli/handoff_generate.ts -->
      `src/scripts/_cli/handoff_generate.ts` count removed items per section in
      the trim loop (`:457-467`); render an emptied section as
      `- [N trimmed by word cap]` and keep `(none extracted)` only when
      extraction itself was empty (`:434-439`); add a header line
      `Trimmed: <total>` when the total is > 0. The header line counts against
      the cap.
      verify: `npx vitest run tests/scripts/handoff_generate.test.ts` -> 0 — the existing cap fixture (`:138-157`) additionally asserts `Key decisions` does not contain `(none extracted)` and the `Trimmed:` total equals the removed count.
- [x] **4.2 Handoff-file drift is annotated like the recycle record.** In <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/handoff_context_hook.ts -->
      `consume_handoff_context` (`src/scripts/handoff_context_hook.ts:99-139`)
      read `Branch:` / `Last commit:` from the file and annotate via
      `describeDrift` (already used at `:303`); never refuse, and a header
      without `Branch:` gets no drift line.
      verify: `npx vitest run tests/scripts/handoff_context_hook.test.ts` -> 0 — new cases: other branch → drift line present; same branch → output byte-identical; no `Branch:` → no drift line.
- [x] **4.3 Set-aside transcript copies are not sessions.** In <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/cc_transcript.ts -->
      `listTranscriptFiles` (`src/scripts/_lib/cc_transcript.ts:284`) skip names
      matching `/\.orphaned-[^/]*\.jsonl$/`; expose the skipped count where the
      scan result is built so a report can print `set_aside: n`.
      verify: `npx vitest run tests/scripts/cc_transcript.test.ts` -> 0 — new fixture tree with `s.jsonl` and `s.orphaned-1700000000-ab.jsonl` lists 1 file, set-aside 1.
- [x] **4.4 The recall resolver honours `autoMemoryDirectory`, read-only.** In <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/memory_recall_hook.ts -->
      `resolveMemoryDir` (`src/scripts/hooks/memory_recall_hook.ts:303-325`)
      resolve in order `AGENT_CONFIG_MEMORY_DIR` → host `autoMemoryDirectory`
      (via the existing settings reader in
      `src/scripts/_lib/claude_settings_hooks.ts`) → slug walk. Never write
      host settings; an unreadable settings file falls through silently.
      verify: `npx vitest run tests/scripts/memory_recall_hook.test.ts` -> 0 — new cases: key set with a memory dir → that dir; key absent → resolution identical to today; unreadable settings → slug walk.

## Decisions

| Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|
| 4.4 reads `autoMemoryDirectory` from the host **user** settings file only (sibling of the projects root), not project or local settings | read project `.claude/settings.json` and `.claude/settings.local.json` too, in host precedence order | A checked-in project file redirecting where memory is read from is the riskier direction, and whether the host honours the key at project scope was not establishable from the tree; user-only is the narrower, reversible read | a host capture or host doc in the tree shows the key is honoured at project or local scope |
| 4.4 treats the configured value as the memory directory itself (no `<slug>/memory` appended); a configured but missing directory resolves to no store, as the env override does | append the slug path; fall through to the slug walk when the directory is missing | The host writes the store where the key points, so a missing directory means no store there; mirroring the env-override branch keeps one rule for an explicit location | a live store shows the host nests per-project directories under the configured path |
| 4.1 also renders `- [N trimmed by word cap]` under a section the cap shortened but did not empty | mark only emptied sections | Without it the `Trimmed:` total is not attributable to sections, and a partly trimmed section still reads as complete | the marker words measurably crowd out content under the default cap |
| 2.2 adds a separate `oracle_summary` to the success line instead of changing `disposition_summary` | extend `disposition_summary`'s string | The existing summary is pinned byte-exact by its test and read elsewhere; an additive segment changes no existing reader | — |

## Later (not active; each needs elapsed time, a host, CI infra, or an owner/council decision)

- Replay ledger commands in CI (P03 1.3/1.4): needs an ADR-128 amendment
  (quote-aware tokenizer, grep/rg allowlist entries in
  `src/scripts/_lib/exec_evidence.ts:46-84`) with council, and a secret-free
  `contents: read` job; one release in shadow first.
- Diff-scoped refusal of a new ledger row without expectation (P03 1.2) once
  2.2's count has a release of data.
- Blocking-class change keyed on confidence or failed exhibits (P03 2.3):
  council-only, needs >= 10 dispositioned blocking findings per cell.
- Ask the self-review model for `exhibits` in the prompt (pass-2 finding
  B-C21): prompt change measured over one paid release.
- Effective store window per transcript reader + shadow gate + doctor retention
  line (P11 3.1/3.2–3.5; `cleanupPeriodDays`, ~18–26 readers).
- PreCompact trigger field capture and counting (P11 0.1, 4.x): needs a live
  host capture; belongs with `stubs/road-to-compaction-survival-census.md`.
- Recall adoption reading from `rule-trips.json` (P11 5.1): pre-registered, needs N >= 20.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | 1.1 lowers reported coverage | product | Releases that silently lost chunks will now show them unreviewed; looks like a regression | It is the truth the coverage line already claims; changelog line names the cause | Phase 1 |
| 2 | 1.3 changes which files a capped run reads | product | Same span can now leave docs/agents unread instead of scripts | Intended; ceiling value untouched; determinism test | Phase 1 |
| 3 | 2.1 edits committed evidence | implementation | Ledgers are records; editing them could look like rewriting history | Only `verified_by` gains an expectation; status, rationale, commit untouched; gate re-run green | Phase 2 |
| 4 | 4.3 changes transcript report totals | product | Session and usage counts drop where set-aside copies existed | Additive set-aside count printed; no field renamed | Phase 4 |

## Non-goals

- No change to `MAX_REVIEW_CHUNKS` or any paid-request count (owner blocker review-ceiling-is-spend).
- No model call, no new settings key, no new concern ID, no write to host settings or host transcripts.
- No backfill or copy of host transcripts.
- No a11y `Not tested` state here (handed to the frontend-fidelity lane).
