---
complexity: structural
status: ready
---

# Road to second brain — working-memory continuity, scale tripwires, contradiction surfacing

> Council-decided (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-07,
> 2 rounds, $0.19; round 2 converged 2/2 after a round-1 split on Obsidian
> compat). Durable verdict:
> [`second-brain-delta-verdict`](../settings/contexts/second-brain-delta-verdict.md)
> — extends the 2026-07-05 knowledge-system verdict (Option C), does not
> reopen it. **Zero gates by design**: every decision is made, every
> protection is a deterministic tripwire (non-blocking lint warning), and the
> two future builds (fold wiring, BM25 CLI) have pre-decided activation paths
> so a firing tripwire needs no new debate.

**Not in scope (decided, not deferred):** Obsidian vault integration
(`.obsidian/` config, enforced wikilinks, editable-vault positioning) —
rejected 2/2; LLM-generated hot-context summaries; fold compression of
tracked files without the consolidate gate; BM25 before the file-count
tripwire; NLI contradiction detection. Read-only static HTML renderer for
knowledge browsing = revisit-if browsing demand materializes.

## Phase 0 — Scale + budget tripwires

> These replace all roadmap gates. Non-blocking CI warnings, wired into the
> existing lint cadence.

- [x] **0.1 — `src/scripts/lint_knowledge_scale.ts`** — warn (exit 0) on: intake >2000 events · `agents/knowledge/sessions/` >50 pages · any single memory/knowledge type >200 files · total corpus >500 files · `agents/runtime/state/hot-context.md` parsing to >600 tokens. Each warning names its pre-decided activation path (fold wiring / BM25 CLI / schema trim) so firing is actionable without re-litigation. Run once locally to verify output on the current (tiny) corpus. <!-- carve-out: new-gate-verification -->
- [x] **0.2 — Wire into CI + Taskfile** — add to the lint aggregate (warning tier, never fails the build); verify with a targeted run of the new task only. <!-- carve-out: new-gate-verification -->

## Phase 1 — Hot-context cache (compact + session survival, all platforms)

> The competitive core: Source O's `hot.md` mechanism, but deterministic,
> privacy-redacted, and dispatcher-wide (7 platforms instead of Claude-only).

- [x] **1.1 — Schema + template** — `agents/runtime/state/hot-context.md` (gitignored; extend `.gitignore` template if needed): fixed sections `Last Updated / Branch / Key Facts / Recent Changes / Active Threads / Open Verifications`, 400-word hard cap documented in-file. Add the shape to the runtime-state docs.
- [x] **1.2 — Writer: `src/scripts/hot_context_hook.ts` (stop slot)** — deterministic extraction from the chat-history JSONL (last user intents, last tool results, open verifications, files touched this session); **no LLM**; overwrite-whole-file semantics (cache, not journal); stamp branch + ISO timestamp; enforce the 400-word cap by truncating lowest-priority sections first.
- [x] **1.3 — Privacy floor** — pass every extracted line through the existing redaction lib (`redact_hook_capture.ts` / low-impact classes: secrets, emails, project-rooted paths, customer names, hostnames, money, business SQL, >40-char code spans). Unit-test with one fixture per class.
- [x] **1.4 — Restore: session_start branch of the same hook** — inject file content wrapped in a clearly-delimited data block (untrusted-input spotlighting: content is data, never instructions). Discard silently when: stamped branch ≠ current branch · stamp older than 48 h · file missing/unparseable. On Claude Code `SessionStart source=compact`: re-inject (compact survival); on `source=clear`: discard.
- [x] **1.5 — Manifest wiring** — register `hot-context` in `src/scripts/hook_manifest.yaml` on `session_start` + `stop` for all 7 platforms (`fail_closed: false`); leave `pre_compact` unassigned (Claude's `source=compact` restore covers the need; other platforms get session-boundary continuity, which is their ceiling anyway).
- [x] **1.6 — Smoke test** — scripted: simulate stop→write, assert cap + redaction + stamp; simulate session_start fresh/stale-branch/stale-time/compact, assert inject vs discard. Targeted vitest run only. <!-- carve-out: new-gate-verification -->

## Phase 2 — Contradiction surfacing in `/memory promote` (durable types)

- [x] **2.1 — Detector** — extend the existing Jaccard pass (`check_memory_similarity.ts` / `_lib/text_similarity.ts`): for target types `incident-learnings` / `product-rules` / `domain-invariants`, same primary key + body similarity <0.3 → emit a "potential contradiction" pair report. Warning, never a block; one surfaced pair per promote is enough.
- [x] **2.2 — Promote-flow hookup** — `/memory promote` command doc gains the surfacing step: human resolves via the existing contested flow (approve new + mark old `contested` with provenance, or revise new). NEVER auto-resolve (REJECT list).
- [x] **2.3 — Fixture test** — one same-key contradictory pair, one same-key rewording (must NOT fire at ≥0.3), one different-key pair (must not fire). Targeted test run. <!-- carve-out: new-gate-verification -->

## Phase 3 — Fold script (build now, wire on tripwire)

- [x] **3.1 — `src/scripts/fold_intake.ts`** — idempotent extractive rollup over the gitignored intake JSONL only: 2^k batching, deterministic fold IDs (content hash), children never mutated, parent link-backs, output under `agents/memory/archive/fold-<id>.md`. Ships with `--dry-run` (prints plan + IDs, writes nothing).
- [x] **3.2 — Determinism check** — run `--dry-run` twice on a synthetic 32-event fixture; assert identical fold IDs and batch boundaries. Manual trigger only — deliberately NOT wired into hooks/CI; the Phase-0 intake tripwire names this script as its activation path. <!-- carve-out: new-gate-verification -->

## Phase 4 — Honest positioning + browsability floor

- [x] **4.1 — Docs** — add the honest framing to the memory/knowledge docs: "governed second-brain substrate — working-memory continuity across compactions on 7 platforms; deterministic where safe, human-gated where meaning is at stake; not self-organizing intelligence." Include the one-line external-viewer warning: read-only viewing of `agents/knowledge/` (any Markdown tool, incl. Obsidian) works; **edits outside `/team-knowledge consolidate` silently desync INDEX + recurrence counters** — no config shipped, on purpose.
- [x] **4.2 — `INDEX.md` readability pass** — `generate_knowledge_index.ts`: group by type, one-line summaries, stable ordering — the council-endorsed browsability alternative to a vault view. Verify by regenerating the index once.

## Acceptance criteria

- Hot-context survives a Claude Code compaction (manual check: `/compact` mid-session → next turn still has Key Facts / Active Threads).
- All five tripwires emit correct warnings on synthetic over-threshold fixtures and stay silent on the real (tiny) corpus.
- No step in this roadmap blocks on a measurement, adoption signal, or external decision.
