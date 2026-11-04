---
proposed_by: road-to-a-noted-that-is-a-write (roadmap:next run)
implemented_by: claude-opus-5.5 session on feat/road-to-a-noted-that-is-a-write
reviewed_by: ai-council
subject: 16159a21425e8d4465c2221005282faff79eea1de59fe1c66081dc1ed04e9b1a
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

self-repair concern moved into a lazy chunk; chunk ceiling 61,600 B; max_bytes unchanged

Verdict `confirmed-non-expanding`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/self-repair-lazy-chunk-ratification-r10-20261104.question.md`, committed at `fccd65c8e910dd085f8b5e77fb8726106e391578` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
Matze, reviewing this `self-repair` lazy-chunk change as an independent critic:

## Findings

**Scope analysis:**
- The concern code itself is untouched; only the loading mechanism changes (inline → lazy with spawn fallback)
- Execution triggers unchanged: `user_prompt_submit` and `stop`, `fail_closed: false`
- Write scope explicitly bounded: `agents/runtime/self-repair/` only
- The derivation claims "the chunk no longer reads anything outside the project" after removing the auto-memory reader, yet it also states the telemetry shadow "reads the settings layers" via `yaml`. This is a **documentation ambiguity** — settings typically live in `~/.claude/`, not the project. I interpret "no longer reads anything outside" to mean "no longer reads *auto-memory* outside", since settings-read is standard for telemetry concerns and `yaml` is already external for other chunks.

**Budget discipline:**
- Measured 55,991 B, ceiling 61,600 B (10% margin, consistent with `quota_notice`/`intake_pass` rows)
- Dispatch bundle freed 24,693 B (1,581,986 → 1,557,293 B), staying under 1,582,000 B ceiling
- The math checks out; the WHY-IT-WAS-MOVED rationale is clear (dispatch near ceiling, council-approved strategy)

**Test coverage:**
The description claims chunked and spawned paths produce identical records, and generic fallback tests pass. I don't see the test diff here, so I'm trusting the assertion. If the tests lie, this review is invalid.

**Red flags:**
- ❌ New read paths? No (actually removed auto-memory)
- ❌ New write paths? No (same runtime dir)
- ❌ Expanded triggers? No
- ❌ Changed fail-closed? No (stays false)
- ❌ New external services? No (`yaml` for local settings)

**What's missing:**
The derivation mentions "four detectors including persistence-claim" but doesn't name the other three. However, since this is a *move* not a *change*, those detectors already exist. Not a blocker, but opaque.

**Authority expansion check:**
Moving existing code from inline to lazy-loaded does not expand what the concern can do. The fallback to spawning on chunk corruption is a *safety feature*, not a risk. The external `yaml` dependency is standard for settings access.

## Verdict

This is a **non-expanding refactoring** with proper budget discipline and test-verified equivalence. The one documentation flaw (ambiguous phrasing about reading "outside the project" when settings are read) doesn't change the substance: the scope actually *shrank* by removing auto-memory access.

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `confirmed-non-expanding`

```text
The supplied diff is **non-authority-expanding**: it changes how an existing concern loads, without changing its event bindings, permissions, write scope, or failure policy.

- **Correctness / reuse:** `concern_registry.ts` removes the eager registration, while `lazy_concern.ts` and `hook_chunks.mjs` add matching lazy registration and chunk output. This composes the existing mechanism without introducing an unnecessary abstraction.
- **Shipping risk:** externalizing `yaml` makes installed-package resolution relevant. The reported package-layout fallback and record-equivalence tests provide useful coverage, although their implementation and results are not independently verifiable from this diff.
- **Low severity — documentation:** the new budget row’s `derivation` reserves growth for a future host-memory reader, despite the scope statement excluding that reader. Byte headroom does not authorize future reads, but this wording could encourage a tired reviewer to treat that work as preapproved. Its fallback-test description also understates the concern-specific tests now reported.
- **Security:** no new injection surface or authorization expansion is visible in these four changes. This conclusion covers the loading move, not detector changes absent from the supplied diff.

**APPROVE** — the move is coherent and narrowly scoped; the highest-leverage improvement before merge is to update the derivation to describe only current behavior and current test evidence.

STANCE: confirmed-non-expanding | CONFIDENCE: medium | DEALBREAKER: no
```
