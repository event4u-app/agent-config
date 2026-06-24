---
complexity: structural
status: ready
---

# Road to legal-safety hardening — RDG positioning + liability defense-in-depth

> **Why.** The legal pack (ADR-107/108) shipped a strong *civil-liability* shield
> (attorney-review line, disclaimers, OSS-forever). Expert review surfaced the
> load-bearing gap: that is **liability mitigation, not RDG compliance**. Under
> German RDG § 2(1) a regulated legal service needs three cumulative elements —
> activity · concrete **third-party** matter · **individual-case** legal
> examination. General legal *information* is explicitly allowed (BGH *Smartlaw*
> 2021); distributing an MIT skill suite is even more distant. **A disclaimer does
> NOT cure an RDG violation** — the real protection is *positioning + a hard
> individual-case guardrail*. Executed in the same PR as the OSS-forever hardening;
> one big revertable legal PR.

> **Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-24, 2 rounds, 2/2).**
> Converged must-build for this PR: **D1 individual-case guardrail · D2 LEGAL_NOTICE ·
> D4 no-definitive-language lint** (defense-in-depth — D1 is the RDG line, D2/D4 are
> the host-ToS / civil-liability / takedown line; neither alone suffices). Order
> debated, content agreed. Rejected: confidence scores, forced per-sentence hedging,
> a global (non-pack) rule, click-through consent. D3 install-notice: council leaned
> defer, but the maintainer explicitly required it → ship the low-friction version
> (pack description + FIRST_WIN), not a wizard rebuild.

## Phase 1 — D1: the individual-case guardrail (the RDG line)

- [x] **1.1 — Add an Iron Law to `legal-safety-floor`:** skills perform **general
  legal information + general drafting only**; they NEVER perform individual-case
  legal examination or success-prognosis. Refuse + refer to a qualified lawyer for:
  outcome prediction ("will I win", "are my chances", "is this enforceable in my
  situation"), definitive individual application ("this violates GDPR in your case",
  "you must terminate within 30 days"), and dispute-specific drafting ("draft the
  warning for my dispute with X"). The line: *applying legal norms to specific facts
  to predict an outcome or guide concrete action in a pending matter*. Err toward
  refusal when >~3 case-specific facts are needed to answer.
- [x] **1.2 — Add a "No definitive language" section to the floor (D4 prompt layer):**
  ban "this is GDPR compliant", "you are legally required", "this contract is valid";
  use "potential considerations include…", "based on the provided information…",
  "this may require legal review". Keep the `Jurisdiction:` tag (scope declaration,
  not hedging). No confidence scores, no forced per-sentence hedging.
- [x] **1.3 — Add a host-usage-policy note to the floor:** legal output must not
  drive the host model toward individualized legal advice (host ToS, e.g. OpenAI
  2025-10-29; Anthropic/others similar) — independent of German law.
- [x] **1.4 — Verify:** floor re-condensed, hashes clean, `lint-trust-coherence` green.

## Phase 2 — D2: LEGAL_NOTICE + references

- [x] **2.1 — Repo-root `LEGAL_NOTICE.md`** (minimal, ~4 points): legal information +
  templates for research/education only; not legal advice, no attorney-client
  relationship, no warranty; user is solely responsible, outputs must be reviewed by
  a qualified lawyer before use in any concrete matter; use may be subject to the AI
  provider's ToS.
- [x] **2.2 — Reference it** from the main `README.md` (one line) and from the legal
  pack's own notice (`src/domains/legal/LEGAL_NOTICE.md`, inline copy — lawyers don't
  click links) + the floor's See-also + disclaimer section (skills inherit via the floor).
- [x] **2.3 — Verify:** `check-refs` / `check-public-links` green; md-language green.

## Phase 3 — D3 (low-friction): selection / setup notice

- [x] **3.1 — Make the not-legal-advice notice prominent at pack selection:** lead the
  `legal` pack `description` in `packs.yml` with "Not legal advice / no substitute for
  a lawyer", and lead `src/domains/legal/FIRST_WIN.md` with the same (already present —
  strengthen). This is the install/selection surface without a wizard rebuild.
- [x] **3.2 — Watch item (deferred):** a dedicated setup-wizard consent step — revisit
  only if host-ToS enforcement escalates or a lawyer says it is table stakes.

## Phase 4 — D4: deterministic backstop lint

- [x] **4.1 — Extend `lint_legal_pack`:** (a) require each legal-pack skill body to
  carry the individual-case-refusal / consult-a-lawyer boundary; (b) a **narrow**
  definitive-language blocklist over skill bodies (e.g. "this is compliant", "you are
  required to", "you will win", "your chances of success") that **skips negative-example
  / quoted lines** to avoid false positives on guidance. Backstop, not primary — the
  floor is the primary enforcement.
- [x] **4.2 — Verify:** `lint-legal-pack` green on the 5 shipped skills; the test suite
  covers the new checks.

## Phase 5 — deferred / rejected (recorded)

- [x] **5.1 — Global (non-pack) legal rule — REJECTED.** Keep `legal-safety-floor`
  pack-scoped; base host models already refuse ad-hoc legal advice, a global rule adds
  per-request cost + false positives on finance/ops. Cross-pack contamination (legal
  questions hitting finance/ops) is a **watch item**, not a kernel rule.
- [x] **5.2 — Confidence scores, forced per-sentence hedging, click-through consent —
  NOT built** (hallucination-prone / degrade utility / legal theatre for MIT OSS).
- [x] **5.3 — D1 lint maturity** (output-phrasing detection beyond the narrow blocklist)
  — deferred until production data shows what the prompt layer misses.

## Acceptance criteria

- The floor carries the individual-case-refusal Iron Law + no-definitive-language +
  host-ToS note; re-condensed, hashes clean.
- `LEGAL_NOTICE.md` exists at repo root, referenced from the main README, the legal
  pack notice, and the floor.
- The `legal` pack description + FIRST_WIN lead with "not legal advice".
- `lint_legal_pack` enforces the individual-case boundary + a non-false-positive
  definitive-language blocklist; tests pass.
- All in one revertable PR with the OSS-forever hardening; `task ci`-relevant legal
  gates green.
