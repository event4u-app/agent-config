# Second-brain delta — verdict: hot-context + tripwires, no Obsidian, no gates

**Decision (2026-07-07).** Extends the 2026-07-05 knowledge-system verdict
(Option C) with the "second brain" competitive delta derived from a file-level
comparison against an external Obsidian+Claude-Code reference ("Source O").
Council: anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, $0.19 actual.
Round 1 split only on Obsidian compat (adopt vs reject); round 2 converged
2/2 on reject. All other questions converged in round 1. Maintainer directive
honored: **zero roadmap gates** — every protection ships as a deterministic
tripwire, every decision is made now. The executable plan shipped via the
(archived) road-to-second-brain roadmap; this context is the durable record
of the verdict.

## The verdict, point by point

1. **Q1 — Bounded working-memory cache: ADOPT, dispatcher-wide.**
   `agents/runtime/state/hot-context.md`, gitignored, **400-word hard cap**,
   fixed schema (Last Updated / Key Facts / Recent Changes / Active Threads /
   Open Verifications). Written by **deterministic hook logic — no LLM
   summarization** — extracting from the chat-history JSONL (last user
   intents, last tool results, open verifications, files touched this
   session), privacy-redacted per the low-impact redactor classes. Injected
   by `session_start` on all 7 platforms; overwritten (cache, not journal) by
   `stop`. **Staleness:** writer stamps branch + timestamp; restore discards
   on branch change or >48 h; on Claude Code, `SessionStart source=compact`
   re-injects (this is the compact-survival win over Source O's single-platform
   hook). Budget tripwire: CI warns when the file parses to >600 tokens.

2. **Q2 — Obsidian-compatible vault view: REJECT.** No shipped `.obsidian/`
   config, no enforced `[[wikilink]]` convention beyond auto-memory's organic
   use, no Obsidian-integration docs beyond a one-line "read-only works, edits
   bypass the consolidate gate" warning. Load-bearing flaw (both members,
   round 2): the dangerous dual-write is *Obsidian edit → no commit → INDEX
   and recurrence counters silently diverge at next session-start* — a
   pre-commit linter fires too late or never. An editable vault also recreates
   the "knowledge as browsable truth" cognitive model that Option C rejected.
   Council-endorsed alternative for browsability: improve `INDEX.md`
   human-readability; a **read-only static HTML renderer** is the sanctioned
   future path if browsing demand materializes (revisit-if, not planned).

3. **Q3 — Fold-style compression: ADOPT intake-only; build now, wire later.**
   `fold_intake.ts` (~200 LOC): 2^k batching over the gitignored intake JSONL,
   deterministic content-hash fold IDs, children never mutated, parent
   link-backs, `--dry-run` determinism check. **Manual trigger only** — not
   wired into hooks/CI until the scale tripwire fires (intake >2000 events or
   `sessions/` >50 pages). Tracked files (`sessions/` pages) are NEVER
   fold-compressed without the consolidate gate.

4. **Q4 — Retrieval lock: KEEP index-first+grep.** Honest expected lift of
   BM25 at the measured corpus (85 auto-memory files / 412 KB, 1 knowledge
   page, 0 global cards): **zero** — grep returns the same 3–5 tiny files.
   Deterministic tripwire replaces any measurement gate: lint warns when any
   single memory/knowledge type >200 files or total corpus >500 files. The
   activation path is **pre-decided** so the tripwire firing needs no new
   debate: file-first in-memory BM25 (minisearch-class, re-index at
   session-start, no persistence, no service, no vectors — Layer-2 sunset
   stands).

5. **Q5 — Contradiction surfacing in `/memory promote`: ADOPT.** Durable
   types only (`incident-learnings`, `product-rules`, `domain-invariants`):
   same primary key + Jaccard similarity <0.3 → surface the pair to the human
   ("potential contradiction — approve new + mark old `contested`, or revise").
   Extension of the existing Jaccard dedup pass; warning, never a block;
   NEVER auto-resolve (parent REJECT list stands). No NLI/semantic detection.

## REJECT-list additions (on top of the Option-C list)

- LLM-generated hot-context summaries (deterministic extraction only).
- Unbounded working-memory files (hard caps ship with the feature).
- Obsidian vault integration (`.obsidian/` config, enforced wikilinks,
  editable-vault positioning).
- Fold compression of tracked files without the consolidate gate.
- BM25/ranked retrieval before the file-count tripwire fires.
- NLI/semantic contradiction detection.
- Reaffirmed: vector/semantic search; contradiction auto-resolution.

## Tripwires instead of gates

| Tripwire | Threshold | Fires → |
|---|---|---|
| Intake scale | >2000 events | wire `fold_intake.ts` into post-session/CI |
| Sessions scale | >50 pages | fold via consolidate gate (design then) |
| Type scale | >200 files in one memory/knowledge type | build the pre-decided BM25 CLI |
| Corpus scale | >500 files total | same |
| Hot-context budget | >600 tokens parsed | trim schema / fix writer |

All non-blocking CI warnings, shipped in Phase 0 of the roadmap.

## Honest framing (per the parent verdict's scope-creep warning)

This delta delivers **working-memory continuity across compactions and
sessions** (competitive parity-plus vs Source O: same mechanism, 7 platforms
instead of 1) plus deterministic scale tripwires. It does **not** deliver
"self-organizing intelligence" (the substrate is still governed files),
Obsidian integration, or ranked retrieval. Honest category claim: governed
second-brain substrate — deterministic where safe, human-gated where meaning
is at stake.
