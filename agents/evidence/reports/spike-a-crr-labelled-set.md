# Spike A — Correction-Repeat Rate (CRR): Labelled Set

Part of `road-to-ai-employee-borrowings`. Measures whether the "self-evolution"
category (an agent that learns from its own repeated corrections without
human rule-authoring) addresses a real, recurring problem in this operator's
actual usage, or a non-problem already handled by the existing
correction → rule-writing workflow.

## Method summary

**Data.** 77 Claude Code session transcripts (JSONL) for this project, at
the host agent's local per-project session store (path withheld per the privacy floor).

**Sample.** The 40 largest transcripts by usable-user-turn count (excluding
the in-progress session running this spike itself). All 40 had ≥ 1 usable
user turn — well above the ≥ 30 required. Turns extracted: **459** across 40
sessions.

**Extraction filter.** A user turn counts as "usable chat text" iff:
`type == "user"` AND `message.content` is a plain string (not a tool-result
array) AND `promptSource` ∈ `{typed, suggestion_accepted, queued}` AND
`isSidechain` is falsy. Excluded: tool-result feedback records (the majority
of `type: "user"` records), `promptSource: null` (slash-command invocations,
session-continuation summaries, local-command caveats/stdout), `promptSource:
"system"` (background task-completion notifications), and `promptSource:
"sdk"` (automated probes).

**Correction definition** (per pre-registered protocol). A user turn is a
CORRECTION iff it negates/redirects the agent's immediately-prior behavior or
output (negation/contradiction vocabulary — "no/nein", "nicht", "don't",
"wrong/falsch", "instead/stattdessen", "doch nicht", pushback on an action
taken) AND references what the agent just did. "Now do X" after the agent did
Y is a NEW INSTRUCTION, not a correction. Ambiguous cases were labelled
new-instruction (conservative, per protocol — keeps correction precision
high).

**Candidate pre-filter.** Since the definition requires negation/contradiction
vocabulary as a necessary condition, every one of the 459 turns was scanned
for a vocabulary hit (EN+DE: no/nein/nicht/don't/wrong/falsch/instead/
stattdessen/stop/halt/sondern/korrigiere/revert/rückgängig/undo/etc., word-
boundary regex). **91 of 459** turns hit the vocabulary filter; these are the
only turns that could possibly qualify as corrections, and each was manually
read (with ~350 chars of the immediately-preceding assistant text as context)
and labelled CORRECTION / NEW-INSTRUCTION by hand. The remaining 368 turns
have no negation vocabulary and are non-corrections by construction (not
individually re-verified — this is definitionally sound, not a sampling
shortcut).

**Semantic repeat criterion.** Two corrections in *different* sessions are
repeats iff they express the same corrective-intent triple: behavior-domain
(e.g. verify-before-complete, scope, tmp-inbox-workflow) × direction (stop-
doing / do-instead) × target-surface. Same ask in different words = repeat;
different asks in similar words = not. Session order for "earlier" vs later
is by file mtime (verified against in-transcript timestamps; both orderings
agreed for every repeat pair found).

## Manual labelling result

Of 91 vocabulary-flagged candidates: **18 labelled CORRECTION**, 73 labelled
NEW-INSTRUCTION (review/verification reports, clarifying questions, option
selections, additive requirements, terminal-output pastes, and bug reports
that did not reference-and-negate a specific immediately-prior agent claim
all fell on the new-instruction side once read in full).

### Labelled correction table (privacy-floor compliant)

Session ids are salted-SHA-256, first 12 hex chars. Gists are paraphrased,
English, ≤ 10 words — never verbatim quotes. No paths, repo names, secrets,
or customer identifiers appear below.

| session-hash | week | domain | gist | repeat-of |
|---|---|---|---|---|
| 38d423877d5f | 2026-W28 | verification-accuracy | claimed CI green and PR ready; both false | none |
| 0b6afc14fa31 | 2026-W28 | verification-accuracy | claimed tests passing; two were failing | 38d423877d5f |
| 1ae5562ff6de | 2026-W29 | verification-accuracy | marked a gate condition done though unmet | 38d423877d5f |
| 4cc1804d5dcc | 2026-W28 | decision-revisit-policy | old locked verdict shouldn't block a good change | none |
| df0ac1cd17aa | 2026-W28 | tmp-inbox-workflow | don't delete consumed input file, move it | none |
| 04c0dc253c50 | 2026-W30 | tmp-inbox-workflow | consumed tmp files weren't moved after processing | df0ac1cd17aa |
| e692aa82cf66 | 2026-W30 | feature-design-scope | requiring a CLI dependency for GUI-only users wrong | none |
| e2674dd9e8d4 | 2026-W28 | settings-scope | activate the feature globally, not session-only | none |
| e2674dd9e8d4 | 2026-W28 | engineering-hardening | shipped a report with no real data capture | none |
| 04c0dc253c50 | 2026-W30 | completeness-check | fewer draft roadmaps produced than feedback items | none |
| 2525c3e32cf4 | 2026-W26 | design-fidelity | agent still not following the provided design spec | none |
| 2525c3e32cf4 | 2026-W26 | autonomy-asking-behavior | stop asking, work autonomously, use council | none |
| 308e1816be51 | 2026-W28 | bug-diagnosis-accuracy | rejected agent's diagnosis of a fresh-session issue | none |
| a9396baa882e | 2026-W28 | remediation-completeness | flagged findings were left unaddressed silently | none |
| 58278570e0e3 | 2026-W29 | recommendation-override | use existing infrastructure instead of leaving idle | none |
| cae517359066 | 2026-W28 | roadmap-completion-policy | roadmap should reach 100 percent before merge | none |
| ed662522113d | 2026-W28 | settings-design | config design asks user to fudge numbers | none |
| 87899d9c5c78 | 2026-W29 | config-file-scope | config file must live in global scope | none |

**Repeat clusters found (2 of 18 corrections' worth of triples repeat):**

1. **verification-accuracy** (agent claims a status/completion that is
   false) — 3 occurrences across 3 sessions (weeks 28, 28, 29); 2 are
   repeats of the first. This domain maps directly onto the existing
   `verify-before-complete` kernel rule.
2. **tmp-inbox-workflow** (consumed inbox files must move to `tmp.old`, not
   be deleted or left in place) — 2 occurrences across 2 sessions (weeks 28,
   30); 1 is a repeat of the first. This maps directly onto the existing
   `roadmap-progress-sync` § inbox-workflow step.

All other 13 corrections were singletons — no semantic match to any other
labelled correction in the set.

## Raw counts

| Metric | Value |
|---|---|
| Sessions sampled | 40 (of 77 total; all had ≥ 1 usable turn) |
| Total usable user turns | 459 |
| Vocabulary-flagged candidates | 91 |
| Manually labelled CORRECTION | 18 |
| Manually labelled NEW-INSTRUCTION (candidates) | 73 |
| Corrections that repeat an earlier-session correction | 3 |
| Corrections that are singletons (no repeat) | 15 |
| Distinct repeat clusters | 2 |

## Extraction-reliability check (double-blind pass, N=50)

Per protocol, 50 of the 91 candidates (deterministic random sample, seed 42)
were labelled twice: once during the primary extraction pass above, once in
a second, independent re-read at the end of the labelling work, from the raw
text alone, without consulting the first pass's recorded verdicts.

- **Percent agreement: 50/50 = 100%.**
- **Cohen's κ: 1.0** (no disagreements → κ undefined by the standard formula
  when both marginals are non-degenerate, but with zero cross-tabulation
  error the practical statistic is reported as 1.0).
- **Threshold: κ > 0.6 required — met.**

**Honest caveat on this number.** This is a *solo* double-label exercise
inside one continuous reasoning session, exactly as the protocol
pre-registers ("two independent passes by one careful labeller is the
pre-agreed solo-cheap approximation"). True blind independence between pass
1 and pass 2 was not fully achievable — the labeller (this run) retained
awareness of its own pass-1 reasoning while re-reading the same 50 texts for
pass 2, so the 100%/κ=1.0 result reflects **self-consistency in applying the
stated rubric**, not independent inter-rater reliability in the classical
sense. The extraction rule itself (vocabulary-gated candidate set, then a
binary negates-and-references test) is narrow and mechanical enough that
self-consistency is a meaningful signal, but the number should not be read as
equivalent to two genuinely separate human coders agreeing.

## See also

- `agents/evidence/reports/spike-a-crr-verdict.md` — the applied verdict.
