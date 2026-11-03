---
complexity: lightweight
status: ready
tree_pin: b234d08480
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps over the WIP cap of 5, owner-directed 2026-11-03 (agents/evidence/owner-directives/2026-11-03-process-inbox-2026-11-n-roadmaps.md): one of eight roadmaps of round inbox-2026-11-n landed active so /roadmap:process-full executes them in the same run."
estate_offset_exempt: "New from inbox-2026-11-n lane F; no active roadmap is archived to offset it. Owner search at b234d08480 (grep -rlF for domain-safety-retention, source_urls, check_rule_evidence_declaration, 'Source-tag + currency', 'model knowledge — verify', 'raw body', AI_POLICY, data-handling-judgment, commands/create-pr.md over agents/roadmaps, later, stubs; agents/roadmaps-owned.md) returned nothing."
relates:
  - slug: archive/road-to-retired-claims-stay-retired
    relation: extends
    note: "Built the evidence: block and the presence gate (Phase 3). This makes the block name its source."
  - slug: archive/road-to-legal-pack
    relation: extends
    note: "Ticked Iron-Law element (f) currency + source-tag vocabulary (:85-92); the four legal skills never reference it."
  - slug: later/road-to-breadth-with-depth
    relation: disjoint
    note: "Owns model licence and territory fields (V12)."
  - slug: later/road-to-rule-triggers-and-links-that-hold
    relation: disjoint
    note: "Owns media-policy reach; its recorded 'none ever will' is routed to the council, not changed here."
  - slug: later/road-to-web-launch-readiness-benchmark
    relation: disjoint
    note: "No catalog rows change here, so the frozen protocol input is untouched."
---
# Road to floors that cite or route

> **Source:** `agents/tmp.old/inbox-2026-11-n/` (topic T0, P10).
> **Arrivals:** 1 — `inbox-2026-11-n` (2026-11-03).

## Goal

A consumer floor routes statutory figures to their source instead of stating them. At the pin
`src/rules/domain-safety-retention.md:55` ships single per-country retention figures under a
`verified_on: 2026-08-30` stamp, `check_rule_evidence_declaration` is green because it checks
presence only, and 0 of 122 rules carry `source_urls`. This roadmap removes the figures without
substituting new ones from memory, makes the stamp name a source, and wires the existing
source-tag vocabulary into the skills that were meant to carry it.

## Phase 1 — Route the numbers instead of carrying them

- [x] **1.1 Retention floor, Track 1.** In `src/rules/domain-safety-retention.md:55` replace
      "Then provide ranges if known (US-federal-tax: …; EU VAT: … UK post-Brexit)." with:
      "Then state the floor only from a primary source for that jurisdiction, tagged
      `[verified — source, date]`; without one, tag it `[model knowledge — verify]` and ask. Never
      quote one figure per country: tax codes split floors by record class (books, vouchers,
      invoices, other correspondence)." Add no replacement figure. Leave `verified_on` unchanged
      (it moves only in the later re-verification item). Update the `why` string for
      `domain-safety-retention` in `src/scripts/check_rule_evidence_declaration.ts` SCOPE so it no
      longer says the rule cites floors "by jurisdiction".
      verify: `grep -cE "10 years in DE|7 years from filing|6 in UK" src/rules/domain-safety-retention.md` prints 0 and `grep -c "model knowledge — verify" src/rules/domain-safety-retention.md` ≥ 1.
- [x] **1.2 Retention floor, Track 2 clock.** In `src/rules/domain-safety-retention.md:62` replace
      "on a DSR clock (typically 30 days under GDPR)" with "on the regime's response clock (for
      GDPR, Art. 12(3) — quote the period from the text, tagged, never from memory)".
      verify: `grep -c "typically 30 days" src/rules/domain-safety-retention.md` prints 0.
- [x] **1.3 Same defect in a skill example.** `src/skills/data-handling-judgment/SKILL.md:156`:
      "billing-dispute = 7 years (contractual + tax authority)" → "billing-dispute = the longest
      applicable contractual or tax floor for the named jurisdiction, `[model knowledge — verify]`".
      Repair, do not delete the example; `:158` stays.
      verify: `grep -c "7 years (contractual + tax authority)" src/skills/data-handling-judgment/SKILL.md` prints 0.
- [x] **1.4 The sentence in the two sibling floors.** One line each in
      `src/rules/finance-safety-floor.md` (Assumptions block, `:69`) and
      `src/rules/domain-safety-disclaimer.md`: "A normative value (period, article, threshold, rate)
      carries `[verified — source, date]` from a primary source or `[model knowledge — verify]`;
      never stated from memory as fact."
      verify: `grep -c "model knowledge — verify" src/rules/finance-safety-floor.md src/rules/domain-safety-disclaimer.md` shows ≥ 1 for each.

## Phase 2 — A stamp names its source; the vocabulary is wired

- [x] **2.1 `source_urls` required when a source is claimed.** In
      `src/scripts/check_rule_evidence_declaration.ts`, a rule whose `source_type` is not
      `own-analysis` must carry ≥ 1 `source_urls` entry, unless it is listed in a new
      `SOURCE_URLS_PENDING` constant (rule → reason), which is shrink-only: a listed rule that now
      has URLs fails as "remove from pending". Populate `src/rules/broken-access-control.md` with
      the two primary URLs already in the tree (`https://owasp.org/Top10/A01_2021-Broken_Access_Control/`,
      `https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/`) and
      list the other six with reason "primary URL not yet fetched". Add self-test cases:
      external-standard without URLs and not pending → reject; pending rule with URLs → reject.
      Not report-only.
      verify: `./scripts-run src/scripts/check_rule_evidence_declaration --self-test` passes with ≥ 8 cases and `./scripts-run src/scripts/check_rule_evidence_declaration` exits 0.
- [x] **2.2 Legal skills point at the vocabulary.** One line in each of
      `src/skills/{contract-review,nda-triage,dpa-review,legal-intake-triage}/SKILL.md` pointing at
      `legal-practice-profile` § Source-tag + currency vocabulary. Add check 1.4 (presence of the
      pointer, never output content) to `src/scripts/lint_legal_pack.ts`, exempting
      `legal-practice-profile` itself, with a test in `tests/scripts/lint_legal_pack.test.ts` that a
      fixture skill without the pointer fails.
      verify: `npx vitest run tests/scripts/lint_legal_pack.test.ts` passes and `./scripts-run src/scripts/lint_legal_pack` exits 0.
- [x] **2.3 Webhook receiving in the existing corpus row.** Extend
      `src/skills/threat-modeling/data/threats.csv:30`: Required Controls gain "verify the signature
      over the raw request bytes before any parsing; acknowledge 2xx within the provider timeout and
      enqueue the work; 4xx on verification failure"; Negative Tests gain "re-serialised body →
      rejected". No new skill, no numeric tolerance (ADR-238). Record the extension in
      `src/skills/threat-modeling/data/manifest.json` `sha` note as recalled, not re-read, so
      `last_checked` stays unchanged (existing precedent in that note).
      verify: `grep -c "raw request bytes" src/skills/threat-modeling/data/threats.csv` ≥ 1 and `./scripts-run src/scripts/check_corpus_staleness` exits 0.

## Phase 3 — Two small reachability fixes

- [x] **3.1 Dead freshness-gate link.** `src/agent-src/contexts/authority/scope-mechanics.md:121`:
      `../../commands/create-pr.md` → `../../commands/pr/create.md` (target
      `dist/agent-src/commands/pr/create.md` holds Step 1b).
      verify: `grep -c "commands/create-pr.md" src/agent-src/contexts/authority/scope-mechanics.md` prints 0 and `test -f dist/agent-src/commands/pr/create.md`.
- [x] **3.2 A foreign repo's AI-contribution policy in the existing confirmation.** One paragraph
      in `src/domains/git/pr/create/command.md` § 1 Check prerequisites: when the target repo is not
      the user's (fork PR, foreign issue or comment), read its `AGENTS.md`, `CONTRIBUTING*` and
      `AI_POLICY*`, quote the AI-relevant lines inside the existing Hard-Floor confirmation; if they
      forbid AI-authored contributions, hand the draft to the human instead of posting; never add
      `Signed-off-by` on the human's behalf. No new question beyond the existing confirmation.
      verify: `grep -cE "AI_POLICY|Signed-off-by" src/domains/git/pr/create/command.md` ≥ 2.

## Phase 4 — Projection and gates

- [ ] **4.1 Regenerate and run the touched gates.** `task sync` and `task generate-tools`, then the
      gates for every file changed above.
      verify: `bash src/scripts/condense.sh --changed` lists nothing; `./scripts-run src/scripts/check_references`, `./scripts-run src/scripts/check_rule_evidence_declaration`, `./scripts-run src/scripts/lint_legal_pack` and `./scripts-run src/scripts/check_source_size_budget` exit 0.

## Later (not active — each needs network, spend, a frozen benchmark or a council verdict)

- Re-verify `domain-safety-retention`, `domain-safety-pii`, `untrusted-input-defense`,
  `lethal-trifecta-guard`, `tool-safety`, `code-provenance` against fetched primary sources, fill
  their `source_urls`, empty `SOURCE_URLS_PENDING`, and only then move each `verified_on`.
- Absent is not zero: five deterministic `domain-truth` cases where treating a missing value as 0
  and naming it as missing give numbers outside tolerance; measure today's skills first (model
  runs), then a shared section in `src/agent-src/contexts/execution/evidence-discipline.md` only if
  fewer than 4/5 pass.
- Web-launch rows (`shop` site type, order-button label, accessibility statement, AI-interaction
  disclosure): need primary statute text for `authority`, and change the frozen protocol input of
  `later/road-to-web-launch-readiness-benchmark`.
- Art. 50 line in `agents/settings/policies/media/disclosure.md` and the "fully synthetic"
  exemption check: needs the Official Journal text.
- Shipping the media policies to consumers: council re-evaluation of the recorded disposition first.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A corrected figure from memory replaces a wrong one | product | The obvious fix re-creates the defect with new numbers | Steps 1.1–1.3 add no figure; any value only via the later re-verification | Phase 1 — Route the numbers instead of carrying them |
| 2 | The pending list becomes a permanent allowlist | product | Six rules stay unsourced indefinitely | Shrink-only, reasons per row, later item owns emptying it | Phase 2 — A stamp names its source; the vocabulary is wired |
| 3 | `verified_on` now predates a body change | product | Schema reads a stale stamp as a signal | Intentional: the stamp moves only after a sourced re-check | Phase 1 |
| 4 | Source-size ratchet reds on added lines | implementation | `check_source_size_budget` tracks a live total | Follow that gate's own recorded procedure in the same PR | Phase 4 — Projection and gates |

## Non-goals

- Asserting any statutory period, GDPR clock, licence territory or AI Act date in this roadmap.
- A heuristic "normative number" lint over all skills (most matches are business metrics).
- New skills, new rule files or new settings keys.
- Changing the media-policy projection or the web-launch catalog.
