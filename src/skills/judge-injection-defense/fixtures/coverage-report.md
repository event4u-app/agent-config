# Injection-defense perturbation coverage report

Per-category status of the pressure-corpus (Phase 1.5). Source data:
`perturbation-taxonomy.json`. Status legend: **COVERED** (existing detector) ·
**GAP-CLOSED** (detector added by this roadmap) · **DEFERRED** (behavioral,
judge-scored in Phase 2) · **OUT-OF-SCOPE** (no mitigation path; documented).

## Input-perturbation categories

| Category | Status | Detector |
|---|---|---|
| zero-width / bidi / tag-block insertion | COVERED | `lint_hidden_unicode.ts` (corpus) + `untrusted-input-defense` runtime mandate |
| visible-confusable homoglyph (mixed-script) | **GAP-CLOSED** | `lint_confusables.ts` (corpus, added this roadmap) + rule runtime mandate |
| leetspeak / ASCII substitution | DEFERRED | `untrusted-input-defense` semantic (no lexical detector — none needed) |
| mixed / alternating case | DEFERRED | `untrusted-input-defense` semantic |
| phonetic substitution | DEFERRED | `untrusted-input-defense` semantic |
| composite (≥2 categories) | GAP-CLOSED | both lexical linters + semantic leg |

## Prompt-structure categories (all behavioral → Phase 2 judge)

| Category | Status | Rule that must catch it |
|---|---|---|
| identity-dissolution / role-takeover | DEFERRED | `security-sensitive-stop` + `untrusted-input-defense` |
| fake boundary / divider token | DEFERRED | `untrusted-input-defense` § spotlight |
| boundary inversion | DEFERRED | `untrusted-input-defense` § boundary discipline |
| manufactured consent / authority | DEFERRED | `untrusted-input-defense` + `security-sensitive-stop` |
| refusal-suppression-by-coercion | DEFERRED (under-covered → named fixture) | `untrusted-input-defense` |
| dual-response / hidden-channel | DEFERRED (under-covered → named fixture) | `untrusted-input-defense` + `security-sensitive-stop` |

## The three named gaps — disposition

1. **Homoglyph / visible confusables** — **CLOSED.** `lint_confusables.ts` flags
   mixed-script tokens (Latin + TR39 Cyrillic/Greek confusable) in tracked `.md`;
   zero false positives over the full corpus; true positives unit-tested. Rule
   prose now mandates runtime flagging of mixed-script tokens.
2. **Zero-width runtime gate** — **CLOSED at the reachable surface.** Corpus
   enforcement is deterministic (`lint_hidden_unicode.ts`). A *universal* runtime
   ingestion hook is **OUT-OF-SCOPE** — runtime hooks fire on ~2 of ~7 host
   surfaces; building one there would falsely imply universal coverage. The rule
   prose mandates runtime flagging where a host hook exists; the corpus linter is
   the always-on backstop.
3. **Refusal-suppression / dual-channel** — **DEFERRED to Phase 2** behavioral
   fixtures (no lexical signal; only a judge-scored run can confirm the rules
   hold). Named fixtures added; the live cross-host behavioral run is the
   documented operator gate (per the roadmap's Automation & human gates).

## Actionability gate

Every DEFERRED entry has a concrete mitigation path (a named rule + a Phase-2
fixture). No category was padded with un-actionable fixtures. The ASCII-class
categories (leetspeak/case/phonetic) are DEFERRED-not-gap because AC's defense is
**semantic** (data-not-instructions), not lexical — proving AC does not rely on
literal keyword matching is the Phase-2 behavioral assertion, not a linter.
