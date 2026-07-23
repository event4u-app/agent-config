---
adr: 125
status: accepted
date: 2026-07-23
decision: doc-screenshot-anonymization
supersedes: —
superseded_by: —
phase: road-to-doc-screenshot-anonymization
type: structural
---

# ADR-125 — Doc-screenshot anonymization: human-gated, capture-delegated, detection-as-helper

- **Status:** Accepted (2026-07-23)
- **Closes:** `agents/roadmaps/road-to-doc-screenshot-anonymization.md`
- **Related:** `src/rules/doc-screenshot-hygiene.md`; `src/skills/screenshot-hygiene/SKILL.md`; `src/rules/non-destructive-by-default.md` (the egress Hard Floor this routes into); `src/rules/domain-safety-pii.md` (text-surface sibling); `src/rules/lethal-trifecta-guard.md`; `src/skills/image-analyser/SKILL.md` (detection helper); `src/skills/readme-writing/SKILL.md` (unrequested-screenshot check).

## Context

The maintainer wants agents to create screenshots for documentation when
genuinely useful — e.g. when generating a Starlight docs site — and embed them,
with a hard requirement: **sensitive data visible on a screenshot must be
anonymized / pixelated before the screenshot ships.**

A code sweep established the gap: the package has image *generation* skills and a
Starlight docs path (`docs/media/` → `site/sync-docs.mjs` auto-copy/rewrite), but
**no screenshot-capture discipline and no anonymization of sensitive content
inside a captured screenshot.** `domain-safety-pii` scopes to text surfaces only
(drafts / logs / exports / legal privilege); media governance
(`media-governance-routing`, `image-likeness-and-rights`) scopes to *generated*-
image rights/likeness. Neither covers redacting sensitive data inside a captured
screenshot.

An AI council debate (2026-07-23, anthropic/claude-sonnet-4-5 + openai/gpt-4o,
2 rounds) surfaced the load-bearing tension: agents creating screenshots
autonomously + a "must anonymize" security guarantee + imperfect detection are
mutually constraining. Automated detection (OCR + pattern-match + allowlist)
cannot *prove* a screenshot is safe — it misses semantic leaks (aggregate counts,
real-vs-fake data tells, re-identification via name structure), and an allowlist
of "known-fake data" degenerates into an unmaintainable cross-cultural dictionary
and an identity-resolution hazard.

## Decision

Build the feature (the maintainer has decided *whether*; the council informed
*how*), with these locked choices:

1. **Capture is delegated to the host** (`claude-in-chrome` / Playwright). The
   package ships NO bundled capture engine — respects the no-runtime-floor
   doctrine (ADR-109 §7). The package owns only the anonymization + embedding
   discipline.

2. **Standalone rule + skill, not a "Surface 5" on `domain-safety-pii`.**
   Screenshots are opaque binary artifacts requiring OCR/vision, not the
   text-pattern surfaces `domain-safety-pii` contracts around. Bolting them on
   would break that rule's scope contract.

3. **Detection is a HELPER, never a CLEARANCE.** The automated OCR + pattern
   pass flags candidate regions and pre-redacts to make review cheap; it never
   certifies a screenshot as safe. **The gate is human confirmation** for
   data-bearing screenshots.

4. **Egress teeth via the kernel, not a new kernel rule.** A data-bearing
   screenshot embedded into shipped docs is an *irreversible published egress*.
   The rule's Iron Law routes that embed INTO the existing kernel
   `non-destructive-by-default` Hard Floor (publish/commit already require
   this-turn confirmation). This gives the gate real teeth **without** adding a
   new `always`/kernel rule — which would demand an ADR-gated kernel-membership
   re-run + 24 h soak and would fail the kernel cross-cutting criterion (the
   concern is docs/media-scoped, not cross-cutting across all work). The rule
   ships as `auto` tier-2a; its severity is borrowed from the kernel Hard Floor
   it routes into. ("Route, don't rebuild.")

5. **Conservative default:** uncertain / unresolved / cannot-confirm-safe →
   redact-or-refuse, never ship-and-hope.

6. **Terminal / CLI / IDE screenshots are forbidden.** They are the highest leak
   vector (absolute local paths, env tokens) and least reliably OCR-able. Steer
   to text code blocks with text redaction — cheaper and safer.

7. **Redaction is a deterministic opaque box/blur** over flagged regions; reject
   lossy provider inpaint (docs need visual accuracy). The redaction tool is
   **optional / tool-agnostic** — `sharp` is a `site` dependency only, not a
   package dependency; mandating it breaks framework-neutrality + no-runtime-
   floor. Missing tool → STOP and hand off to the maintainer; never silently
   downgrade the guarantee.

8. **The identity allowlist is the maintainer's OWN public handles + a small
   fake-data seed** (`screenshots.identity_allowlist`, default `[]`) — NOT a
   global fake-data dictionary and NOT identity-resolution. Default: everything
   is treated as sensitive unless a human decides or it matches the allowlist. A
   public handle co-located with a real name does not whitelist the name.

## Consequences

- New `auto` tier-2a rule `doc-screenshot-hygiene` (obligation surface + taxonomy
  + risk tiers) routing to a new `screenshot-hygiene` skill (the decide →
  capture → detect → redact → audit → embed workflow + the human-gate checklist).
- New `screenshots.*` config keys (allowlist + terminal-forbid policy + gate)
  with conservative defaults.
- `readme-writing` strengthens its unrequested-screenshot check for data-bearing
  shots; illustrative/no-data docs screenshots are the reconciled exception.
- The "must anonymize" requirement is honored as a **human-gated** guarantee,
  not a false-confidence automated one — the failure mode the council flagged
  (agent ships PII because the automated audit "passed") is structurally avoided.
- Cost: agents cannot autonomously embed data-bearing screenshots; a human
  confirmation is required. This friction is intentional and symmetric with the
  irreversibility of the egress.

## Alternatives considered

- **New `always`/kernel rule (Anthropic Round 1).** Rejected: fails the kernel
  cross-cutting criterion, and the ADR+24 h-soak gate is disproportionate. The
  route-into-Hard-Floor synthesis delivers the same teeth without kernel churn.
- **Fully automated redaction pipeline as the gate (OpenAI Round 1).** Rejected
  as a *clearance*: detection can't prove safety; "audit passed" would license
  agents to skip human review — the exact inversion the gate exists to prevent.
  Kept only as a *helper* that flags + pre-redacts.
- **Extend `domain-safety-pii` with Surface 5.** Rejected: breaks the text-
  surface scope contract of that rule.
- **Bundle a `sharp`-based capture+redaction engine.** Rejected: `sharp` is a
  site-only dep; bundling breaks framework-neutrality + no-runtime-floor.
- **"Don't build it at all" (Anthropic Round 1 core).** Out of scope — the
  maintainer decided to build; the ADR records the safe *how*.

## References

- AI council debate 2026-07-23 (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
  2 rounds), inlined in `agents/roadmaps/road-to-doc-screenshot-anonymization.md`.
- ADR-109 (no-runtime-floor doctrine); `src/rules/non-destructive-by-default.md`;
  `docs/contracts/kernel-membership.md`; `docs/threat-model.md`.
