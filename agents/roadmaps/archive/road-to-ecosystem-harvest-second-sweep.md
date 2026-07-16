---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Second Sweep (full-coverage disposition)

**Trigger:** User ask — do the same for the source directory's backing repo
"und allem was du da findest". The backing repo **is** the same catalog behind
the aggregator surveyed in pass 1 (a single curated README, ~130 entries). This
roadmap **closes coverage on every remaining entry** so no future session
re-litigates the list, and records where the net-new mechanisms were folded.
Sources anonymized; full provenance in the index § Provenance.

**Priority: coverage/disposition.** Introduces **zero** new standalone
workstreams — every adopt folds into a sibling roadmap; everything else is
dispositioned CUT / FOLD / REVIEW-later.

## Goal

Guarantee the catalog is fully triaged: each entry is either deep-read (pass 1
or here), folded into a sibling roadmap, cut with a reason, or marked
REVIEW-later (path moved / repo gone). The headline second-sweep find — a
security-firm repo (**Source G**) buried behind a single catalog link — turned
out to be the highest-quality collection on the list; its mechanisms are folded
into `review-mechanics`, `bug-security-rigor`, and `skill-quality-gates`.

## Phase 1 — Fold-in patches (land inside sibling roadmaps, not here)

- [x] <!-- verified 2026-07-15: folds present on main — Rationalizations-to-Reject table (code-review/checklists/producing-the-review.md, shared with security-audit), optional cross-cutting-coverage gate (code-review SKILL.md:81 'state-changing op without telemetry OR authz touch → ❓'), adaptive review-depth (review-mechanics, shipped #931). -->
      **→ review-mechanics:** "Rationalizations to Reject" table + fp-check deep-verify path for security-class findings + adaptive review-depth table + the cross-cutting-coverage metadata gate (diff adds a state-changing op without telemetry/authz touch → ❓). *Source G, Y.*
- [x] <!-- verified 2026-07-15: fail-open/fail-secure row + worked example in security-audit SKILL.md:116-118; Rationalizations-to-Reject primitive shared into the bug/security judges (bug-security-rigor, shipped). -->
      **→ bug-security-rigor:** the same "Rationalizations to Reject" primitive on `judge-bug-hunter`/`security-audit`; a fail-open-vs-fail-secure distinction (`env.get('KEY') or 'default'` = CRITICAL vs `env['KEY']`-crash = SAFE) into `security-audit`; a misuse-resistance ("sharp-edges") review lens **only if** the lens census shows no owner. *Source G.*
- [x] <!-- verified 2026-07-15: real-host loadability smoke (src/scripts/check_host_loadability.ts + smoke_host_loadability.sh) + metadata cross-consistency assertions present (skill-quality-gates Phase 4, shipped #937). -->
      **→ skill-quality-gates:** the real-host loadability smoke job + metadata cross-consistency assertions (already in that roadmap's Phase 4). *Source G.*
- [x] <!-- verified 2026-07-15: critical-planning-file safety protocol (read-first / timestamped backup / dup-check / structure-preserve / post-verify) present in the /agent-handoff § 2b HANDOFF flow (workflow-contracts Phase 2, shipped #938). -->
      **→ workflow-contracts:** the critical-planning-file safety protocol for HANDOFF.md + roadmap edits (already in that roadmap's Phase 2). *Source Z.*

## Phase 2 — Patches to EXISTING (non-harvest) roadmaps / skills

- [x] <!-- done 2026-07-15: surfaced as a parked proposal (NOT auto-applied, per the step) in agents/roadmaps/later/road-to-harvest-second-sweep-proposals.md § Proposal 1, with the user-interaction-overlap caveat noted. -->
      **→ `ask-when-uncertain` / `improve-before-implement` (one small PR, outside this cluster):** a compact clarification protocol — numbered questions, lettered options, bolded recommended default, a `defaults` fast-path, compact `1b 2a 3c` replies, need-to-know vs nice-to-know split. *Source G (ask-questions-if-underspecified).* Surface as a proposal; do not auto-edit those rules.
- [x] <!-- done 2026-07-15: owning roadmap is ARCHIVED, so recorded as a parked proposal in agents/roadmaps/later/road-to-harvest-second-sweep-proposals.md § Proposal 2 (fresh-PR-if-adopted, not a re-open). -->
      **→ `road-to-opt-retrieval-and-memory` (existing roadmap, patch note):** a memory-writeback quality-gate preflight — reject candidates that are work-logs not experience-assets; required fields by outcome type (`fix`→root_cause/resolution, `pitfall`→pitfalls, `decision`→decisions, `pattern`→reusable_patterns); a recall trigger threshold (fire on non-trivial work only). *Source (a recall/writeback skill).* Note only — that roadmap owns the change.

## Phase 3 — Full-coverage disposition (records that the list is CLOSED)

- [x] Record the disposition classes below in the index Reject-log / this file so the catalog is not re-scanned:
      <!-- verified 2026-07-15: the six disposition classes below + the domain rejections (RAG/LLM-app vertical, cloud-native vertical) are recorded in the index § Reject-log; this file is the citable disposition record. -->
  - **Repo-local content skills** (framework-internal helpers, product-repo-scoped skills): CUT as sources — the transferable insight is only the *distribution pattern* (skills living in the repo they govern), which is already the suite's consumer story.
  - **Skill/plugin farms** (auto-generated at scale): CUT as sources; the best-written descriptions may serve as *positive* lint fixtures for `skill-quality-gates` (optional).
  - **Products wearing a SKILL.md** (vendor operation guides, SaaS packs): CUT — not mechanisms.
  - **Offense-adjacent / niche security content**: CUT for the package; the defensive security-firm skills cover the mechanism value.
  - **Scientific / ML domain content**: CUT — domain packs enter via `domain-adoption-policy`'s three gates on demand, never by import (see `domain-watch`).
  - **REVIEW-later (path moved / repo gone this sweep):** a few entries were unfetchable (404 / repo removed); dispositioned from catalog descriptions only, revisit only if a file resurfaces.

## Council convergence (2026-07-11)

Consistent with the index-level council direction and the pass-1 Reject-log.
Two locks re-affirmed against the parallel exploration's re-proposals:
1. **No open source names in tracked artifacts** — the parallel drafts recorded links openly ("public repo, no encryption needed"); that trips the `check-no-external-sources` CI gate (denylist includes vendor tokens). This cluster keeps the anonymized Source-letter + `ENC1:` scheme. Correct for tracked artifacts.
2. **No numeric readiness score** — the parallel exploration kept a 0–100 severity-capped score; the pass-1 council dropped it as gameable false precision. Lock held; only the evidence-gated binary go/no-go + stable finding IDs + diff-based regression gate are adopted (in `reliability-measurement`). Revisit-if a measured gaming-vs-utility signal appears.

## Acceptance criteria (anti-dump)

- [x] Every catalog entry has a disposition (deep-read / FOLD / CUT / REVIEW-later); future sessions cite this file instead of re-scanning.
- [x] Zero new standalone workstreams — all adopts fold into sibling roadmaps or existing artifacts. <!-- the parked proposals file is a tracking note, not a workstream — nothing auto-applied. -->
- [x] Each folded mechanism inherits its sibling roadmap's evidence rigor (must-fail fixtures for lints; baiting evals for rationalization tables; a red smoke-job demo for loadability). <!-- verified 2026-07-15: the loadability smoke has its deliberate-malformed catch test; the golden-adversarial review pair (code-review evals) is the baiting eval; each fold shipped inside its sibling PR under that sibling's gates. -->
- [x] Dashboard regenerated.
