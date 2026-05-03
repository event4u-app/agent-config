---
status: complete
---

# Road to Rebalancing

**Status:** COMPLETE (2026-05-02) — Phase 0 audit + Phases 2 / 3 / 4 / 5 shipped; Phase 1 + Phase 6 closed-as-moot per audit findings.
**Started:** 2026-05-02
**Trigger:** Review feedback on PR #34 (`feat/road-to-governance` — F1–F7 cleanup + AI Council).
**Mode:** Audit-driven execution. Phase 0 finding flipped Phase 1 + Phase 6 to closed-as-moot; Phases 2 / 3 / 4 / 5 executed as a tightened minimum-viable scope.

## Phase 0 audit — findings (executed 2026-05-02)

The "implicit-expertise loss" premise from the five external reviews was tested against the actual PR #34 diff:

- **Numerical:** `git diff origin/main...HEAD -- .agent-src.uncompressed/rules/` shows 35 files, 202 ins / 204 del → **net -2 lines**. Largest delta `language-and-tone.md` 37 / 96 — but the 96 deleted lines were *extracted* to `docs/guidelines/language-and-tone-examples.md` (79 lines), not removed. ZERO rule files deleted outright.
- **Semantic (obligation-keyword diff):** 14 lines containing MUST / SHALL / NEVER / ALWAYS / FORBIDDEN / REQUIRED / MANDATORY were deleted; **16 lines containing the same were added** → net **+2 obligation lines**. Of the 14 deletions, 10 were frontmatter rewrites (`description:` / `type:`) and 4 were prose. Each of the 4 prose deletions was traced:
  - "Every piece of text inside `.md` files in `.augment/` and `agents/` must be in English" → SURVIVES as a stronger section header in `language-and-tone.md` (line 84) with explicit enumeration ("headings, paragraphs, bullets, example option labels, template placeholders, ASCII-art labels, table headers and content").
  - "A standing 'arbeite selbstständig' never lifts the floor" → SURVIVES in `non-destructive-by-default.md` § Hard Floor and `agent-authority.md` § Index rules ("Hard Floor wins, always. No autonomy setting, roadmap step, or standing instruction lifts it.").
  - "Templates, agent-rendered strings, and failure modes must be English" → SURVIVES in the `language-and-tone.md` line-87 enumeration above.
  - "Surrounding prose must still mirror. Keep proper nouns and code identifiers" → EXTRACTED to `docs/guidelines/language-and-tone-examples.md` § Failure modes.
- **Verdict:** zero obligation regression. The five external reviews were responding to *structural risk* (rule activation semantics, layered architecture) not *content loss*.

## Phase 0 council consultation — Option D adopted

External AI council (Anthropic claude-sonnet-4-5) confirmed the audit and recommended Option D over the original full-scope path:

- **Phase 1 pilot candidates were misselected.** `autonomous-execution`, `minimal-safe-diff`, `scope-control` were chosen by line-count volatility, not semantic risk. None of the three exhibits the failure mode the roadmap claims to address (`scope-control` is a 40-line *addition*, `minimal-safe-diff` is already auto-trigger, `autonomous-execution` shows 8 lines of churn with no extraction). With Phase 0-Extended showing zero obligation regressions, **Phase 1 closes as moot**.
- **Phases 2 / 4 / 5 form a coupled feature** (context-aware rule dispatch — when, whether, what-on-conflict). Sequence them as 2 → 4 → 5 with a kill-switch after the first demo proves the `load_context:` convention is sufficient.
- **Phase 3** reduces to one file relocation (the only flat guideline left after F4 already moved 46 of 47 into domain folders).
- **Phase 6** has no validation target without Phase 1, so skip.

## Revised scope (locked, executing)

| Phase | Original intent | Revised state | Action |
|---|---|---|---|
| 0 | Removed-knowledge audit | Done — zero regression | Findings recorded above |
| 1 | Pilot context split (3 rules) | **MOOT** — no over-deletion to repair | Documented and closed |
| 2 | `load_context:` convention + linter | Tightened — one pilot rule first | Schema + path resolution check |
| 3 | Guidelines domain folders | 46/47 done in F4 | Move the remaining flat file |
| 4 | Golden-Transcript demos | Substantially shipped via `docs/end-to-end-walkthroughs.md` | Verify coverage + decide on `examples/flows/` move |
| 5 | Priority hierarchy + interaction matrix | Matrix shipped (`rule-interactions.yml`) | Add `rule-priority-hierarchy.md` |
| 6 | Senior-agent behaviour tests | **MOOT** — no Phase 1 regressions to validate | Documented and skipped |

## Source — five rounds of external review

| Round | Headline |
|---|---|
| 1 | "Reduktions-PR. Klarheit ↑↑, Wartbarkeit ↑↑, Governance-Strenge leicht ↓, Risiko hoch wenn falsch validiert." |
| 2 | "Iron Laws preserved. 14 lint improvements, 0 FAIL. One real risk: `minimal-safe-diff` demoted to auto-trigger. Methodical critique: F1–F7 + AI Council in one PR." |
| 3 | "Rebalancing now. System schlank, jetzt Intelligenz zurückgeben — Edge Cases, Decision Logic, Failure Modes, Examples — über strukturelle Trennung Rules ↔ Knowledge." |
| 4 | Layered architecture proposal — Rules / Contexts / Guidelines / Examples / Contracts as five distinct layers with distinct loading strategies. |
| 5 | Reviewer endorsement of the layered model + three concrete additions: `contexts/communication/`, Golden-Transcript-backed `examples/flows/`, `load_context:` frontmatter convention with linter enforcement. Plus polished final spec with naming conventions and char budgets. |

## Headline finding

Cleanup is structurally sound. Iron Laws preserved. The risk surface is whether **implicit expertise** (edge cases, decision forks, failure modes, anti-patterns) was trimmed alongside the redundancy. Rebalancing means **restoring intelligence without re-inflating Always-rules** — by introducing a layered architecture so each kind of knowledge has its own loading strategy.

> **Small enough for token budget. Deep enough for senior behaviour.**

## Target architecture (layered)

| Layer | Answers | Loading | Char target |
|---|---|---|---|
| **Rules** | What must / must not happen? | Always or auto-trigger | Always 800–2,500 · Safety max 5,000 · Auto max 4,000 |
| **Contexts** | How does the agent decide in hard cases? | On demand via `load_context:` | Unbounded but scoped |
| **Guidelines** | How is this kind of work done well? | Referenced by skills / commands | 2–8 KB |
| **Examples** | What does good behaviour look like? | Referenced or as Golden-Transcript demos | Few, strong, test-backed |
| **Contracts** | What is the public, versioned API? | `docs/contracts/`, stability-tagged | n/a |

Folder layout target: `rules/{authority,quality,interaction,routing}/` · `contexts/{authority,execution,communication,memory,ui}/` · `docs/guidelines/{php,laravel,testing,frontend,git,product,architecture}/` · `examples/{rules,flows}/` · `docs/contracts/`.

## Design anchors (locked, not open for renegotiation)

| Anchor | Source | Decision |
|---|---|---|
| No Iron Law gets diluted | `non-destructive-by-default`, `commit-policy`, `verify-before-complete` | Restoration touches structure and depth, never Hard-Floor / NEVER-clauses. |
| Rules stay minimal | F1 budget math (37,879 / 49,000) | Restored content lands in `contexts/` / `docs/guidelines/`, not back into Always-rules. |
| Small spine, deep on demand | Round 5 endorsement | The agent carries a small rule spine at all times; deeper reasoning loads only when the situation demands it. |
| No release pinning | `scope-control` § Git operations | Phases describe work, never target releases, tags, or deprecation dates. |
| Capture before plan | This file | Phases below are **candidates**. The maintainer picks which ones run, in what order, after the follow-up review. |

## Phase 0 — Removed-Knowledge Audit  [x] DONE

Precondition for everything else: enumerate what was actually removed in PR #34 and classify it.

- [x] 0.1: Diff PR #34 against pre-cleanup baseline for content categories: edge cases, examples, failure modes, decision logic, anti-patterns. → 35 files, 202 ins / 204 del, ZERO rule files removed outright.
- [x] 0.2: Classify each deletion → `redundant` / `example` / `edge case` / `decision logic` / `anti-pattern`. → 4 prose obligation deletions all traced to surviving canonical homes; 10 frontmatter rewrites (cosmetic).
- [x] 0.3: Risk-rank: any `decision logic` deletion is a candidate for restoration into `contexts/`. → No `decision logic` deletions found. Examples route already happened (extraction to `language-and-tone-examples.md`).

**Outcome:** Audit findings recorded in the header above. Council consultation logged. Phase 0 closes the rebalancing premise — no obligation regression.

## Phase 1 — Pilot Context Split (2–3 rules)  [-] CLOSED-AS-MOOT

Pilot the layered split with the rules where the win is largest and the risk is smallest.

**Status:** Closed without execution. Phase 0 audit found zero obligation regressions; the three named candidates show no over-deletion (`scope-control` is a 40-line *addition* in PR #34, `minimal-safe-diff` is already auto-trigger, `autonomous-execution` shows 8 lines of churn with no extraction). Council consultation confirmed Phase 1 has no failure mode to repair. The structural goal (better activation semantics) survives in Phase 2.

- [-] 1.1: Candidates — `autonomous-execution`, `minimal-safe-diff`, `scope-control`. → No regression, no split needed.
- [-] 1.2: Add `load_context:` frontmatter from each piloted rule to its companion context. → Rolled into Phase 2.
- [-] 1.3: Success metrics — rule chars reduced, always-budget unchanged or improved, Golden Transcripts unchanged. → No baseline movement to measure.

## Phase 2 — Context Loading Convention + Linter  [x] DONE

Make `load_context:` a first-class, CI-enforced convention.

- [x] 2.1: Frontmatter schema defined in [`docs/contracts/load-context-schema.md`](../../docs/contracts/load-context-schema.md). Two keys: `load_context: list[str]` (lazy, default) and `load_context_eager: list[str]` (eager, opt-in only). Allowed roots: `.agent-src*/contexts/` and `agents/contexts/`. Stability `beta`.
- [x] 2.2: Linter shipped at [`scripts/lint_load_context.py`](../../scripts/lint_load_context.py). Checks: paths exist, paths end in `.md`, allowed-root only, public→project-local leak (warn), circular refs (across lazy + eager edges), combined char-budget for eager (rule + targets ≤ 2,500 / 4,000 / 5,000 by class). Self-tested against missing-target, disallowed-root, not-md, and happy-path inputs (4/4 pass).
- [x] 2.3: Wired into Taskfile (`task lint-load-context`) and `task ci` between `lint-rule-interactions` and `check-reply-consistency`. Currently passes as a no-op (zero declarers); the wiring exists so the first consumer ships under green CI.

## Phase 3 — Guidelines Domain Folders  [x] DONE

Subdivide `docs/guidelines/` by domain so referenced knowledge is discoverable.

- [x] 3.1: Move existing guidelines into `docs/guidelines/{agent-infra,docs,e2e,php}/` per their topic. → 46/47 already moved in F4. The remaining flat file `language-and-tone-examples.md` relocated to `docs/guidelines/agent-infra/language-and-tone-examples.md` (2026-05-02).
- [x] 3.2: Reference-existence check — every guideline link resolves. → `scripts/check_references.py` clean.
- [x] 3.3: Confirm guidelines stay never-auto-loaded. → No frontmatter `type: always` or `type: auto` on any guideline; only referenced via Markdown links from rules / skills / contexts.

## Phase 4 — Golden-Transcript-Backed Demos  [x] DONE-AS-SHIPPED

The "holy-shit demos" the package has been missing — built as test-backed proof, not free prose.

**Status:** Substantially shipped via [`docs/end-to-end-walkthroughs.md`](../../docs/end-to-end-walkthroughs.md) (4 traces × ~6.7 KB), each anchored to its golden transcript directory under `tests/golden/baseline/`. No `examples/flows/` move — the walkthroughs file is already linked from `README.md` and the catalog, so a cosmetic relocation would create churn without discovery benefit.

- [x] 4.1: Required demo cases —
  - `implement-ticket-demo` → § 1 *Backend ticket → ship*, anchor [`GT-1`](../../tests/golden/baseline/GT-1/)
  - `work-freeform-demo` → § 2 *Free-form prompt → ship*, anchor [`GT-P1`](../../tests/golden/baseline/GT-P1/)
  - `ui-track-demo` → § 3 *UI improvement → review-loop ship*, anchor [`GT-U2`](../../tests/golden/baseline/GT-U2/)
  - `blocked-path-demo` → § 4 *Blocked on ambiguity*, anchor [`GT-2`](../../tests/golden/baseline/GT-2/)
  - `mixed-flow-demo` → **deferred.** No `GT-MIX` baseline exists; authoring one is golden-transcript infrastructure work, out of scope for rebalancing. Tracked as a future addition to the regression suite, not a blocker for this roadmap.
- [x] 4.2: Each shipped demo cites a `Trace` block, the originating `directive_set`, and a `delivery-report.md` / `halt-markers.json` proof artefact. Reproducible via `python3 -m tests.golden.capture --scenarios GT-1 GT-P1 GT-U2 GT-2`.
- [x] 4.3: The walkthroughs file is the documentation surface; `tests/golden/baseline/` is the regression suite. Coupled by the anchor links and the `summary.json` rollup.

## Phase 5 — Rule Priority Hierarchy + Interaction Matrix  [x] DONE

Two artefacts, one human, one machine, both shipped under `docs/contracts/`.

- [x] 5.1: [`docs/contracts/rule-priority-hierarchy.md`](../../docs/contracts/rule-priority-hierarchy.md) — human-readable ordered list (Non-Destructive Floor → Security-Sensitive Stop → Scope Control → Ask When Uncertain → Commit Policy → Verify Before Complete → Autonomous Execution → Command Suggestion → Language / Tone) + four-line principle statement ("Safety beats autonomy. Scope beats helpfulness. Verification beats completion. User intent beats command suggestion."). Includes worked-examples table mapping common conflicts to winning bands.
- [x] 5.2: Machine-readable counterpart already shipped as [`docs/contracts/rule-interactions.yml`](../../docs/contracts/rule-interactions.yml) (titled "Rule-Interaction Matrix") plus the narrative diagram at [`rule-interactions.md`](../../docs/contracts/rule-interactions.md). CI-enforced via `scripts/lint_rule_interactions.py` (`task lint-rule-interactions`). Filename kept as `rule-interactions.yml` rather than the proposed `rule-interaction-matrix.yml` to avoid breaking existing references.
- [x] 5.3: Both files carry `stability:` frontmatter — `rule-priority-hierarchy.md` is `beta`, `rule-interactions.md` / `.yml` is `beta`. Per [`STABILITY.md`](../../docs/contracts/STABILITY.md), public-surface links may reference both with the standard beta marker.

## Phase 6 — Senior-Agent Behavior Tests  [-] SKIPPED-AS-MOOT

Empirical validation anchored to the Phase 4 Golden Transcripts.

**Status:** Skipped. Phase 6 was scoped as the validation pass for Phase 1 context splits — its exit criterion (line 143: "any regression flips the corresponding Phase 1 candidate from 'context-split' to 'restore-to-rule'") references a Phase 1 deliverable that no longer exists. With Phase 1 closed-as-moot, Phase 6 has no validation target. The four prompts (6.1–6.4) remain valuable as a future "senior-agent baseline" exercise but are out of scope for this roadmap.

- [-] 6.1–6.5: Skipped per Phase 0 audit. Re-open as a separate roadmap if a future regression suite is wanted.

## Anti-pattern to avoid

> Replacing one oversized rule system with oversized contexts that are always loaded.

The goal is **small rule → references context → context loads only when needed**, never **small rule → always loads huge context → same token problem**. Phase 2 linter must enforce the combined cap.

## Decisions Required — resolved by Phase 0 audit

| # | Original question | Resolution |
|---|---|---|
| 1 | Phase 1 pilot — accept the three candidates? | **Closed-as-moot.** No regression to repair. |
| 2 | `load_context:` schema — eager vs lazy, public-vs-internal? | **Eager + opt-in only.** Schema defined in Phase 2 (`load_context: list[str]`), enforced by linter. No default eager-load. |
| 3 | Phase 3 — move guidelines now or later? | **Now.** F4 already moved 46 of 47 into domain folders; only `language-and-tone-examples.md` remains flat. |
| 4 | Phase 4 demos — replay or authoring? | **Authoring + Golden-Transcript anchor.** Already shipped via `docs/end-to-end-walkthroughs.md`; gap is `mixed-flow-demo`. |
| 5 | `minimal-safe-diff` — auto-trigger + split, or promote-back? | **Stay auto-trigger.** No change required. |
| 6 | Are six phases right? | **No.** Audit collapses to 4 active phases (2 / 3 / 4 / 5). |

## Out of scope for this roadmap

- AI Council Phase 2c (Playwright) — already gated separately.
- New rules / skills / commands — this is restoration / structural work, not additions.
- Splitting PR #34 retrospectively — methodical lesson captured (two strands → one branch), not repaired.

## Cross-references

- [`archive/open-questions-3.md`](archive/open-questions-3.md) — Q36 (always-rule budget) is the precondition this rebalancing builds on.
- [`archive/road-to-governance-cleanup.md`](archive/road-to-governance-cleanup.md) — F1–F7 source of truth (post-archive).
- [`road-to-ai-council.md`](road-to-ai-council.md) — second strand of PR #34, separate from this rebalancing work.
