---
title: "2A.4 worked example — direct-answers"
phase: 0.4
status: draft
sandbox:
  - agents/roadmaps/examples/2A4-direct-answers/direct-answers.slim.md
  - agents/roadmaps/examples/2A4-direct-answers/direct-answers-mechanics.md
target_rule: .agent-src.uncompressed/rules/direct-answers.md
---

# 2A.4 worked example — `direct-answers`

Phase 0.4 dry-run of the 2A.4 obligation-keyword diff contract on a
representative top-3 always-rule. Sandbox artefacts in
`agents/roadmaps/examples/2A4-direct-answers/`. **Nothing in
`.agent-src.uncompressed/rules/` is touched by this artefact** —
the rule itself only moves in Phase 2A.

## 1. Why `direct-answers`

Selected per **0.4.1** recommendation: smallest of the three
budget-critical always-rules with a clean MECHANICS / LOGIC split.
Each of its three Iron Laws has a normative core (the fenced caps
block) plus extension prose (anti-pattern bullets, severity table,
emoji whitelist/blacklist, failure-modes section) — exactly the
shape the 2A.2 / 2A.3 split assumes.

Known atypicality (R5 G5, roadmap risk #18): `direct-answers` has
**three** Iron Laws while `commit-policy`, `non-destructive-by-default`,
and `scope-control` each have one. The 2A.4 contract is keyword-based,
so multiple Iron Laws inflate the `Iron Law` row — flagged in §5
generalization notes; not a contract bug.

## 2. The split

| Layer | File | Chars |
|---|---|---:|
| Original (untouched) | `.agent-src.uncompressed/rules/direct-answers.md` | 4 722 |
| Slim rule (sandbox) | `…/direct-answers.slim.md` | 2 758 |
| Mechanics context (sandbox) | `…/direct-answers-mechanics.md` | 3 525 |
| **Slim + context total** | — | **6 283** |

**RULE+LOGIC kept in slim rule:**

- All three Iron Law fenced caps blocks (the normative core).
- Iron Law 3's "**Never overrides** `user-interaction` / command-mandated
  steps" carve-out (load-bearing override clause).
- Iron Law 2's hedging-language obligation (one sentence, kept inline
  because it is the in-turn behavior, not a reference).
- Frontmatter `load_context:` to the mechanics file.
- `## Interactions` cross-refs (sibling-rule resolution surface).

**MECHANICS extracted to context:**

- Iron Law 1's four anti-pattern bullets (positive-adjective opener,
  subjective judgments, "good catch" carve-out, mistake-acknowledge
  procedure).
- Iron Law 2's full severity table (High / Medium / Low) and the
  user-override phrases.
- Iron Law 3's six "what to skip" bullets.
- Full emoji Whitelist + Blacklist (six rows, all examples).
- Failure-modes section (four user-callout examples + slip handling).

## 3. Slim-rule budget

The slim rule is **2 758 chars**, comfortably under the 2A.3 target
of ≤ 4 000 chars. Top-3 sum projection (assuming similar 40–45% rule
shrinkage on `non-destructive-by-default` and `scope-control`):

| Rule | Original | Projected slim | Note |
|---|---:|---:|---|
| `direct-answers` | 4 722 | 2 758 (measured) | this example |
| `non-destructive-by-default` | TBD | TBD | Phase 2A measurement |
| `scope-control` | TBD | TBD | Phase 2A measurement |

Top-3 sum ≤ 12 000 char target unverified for the other two; will
be a 2A.3 measurement, not a 0.4 commitment.

## 4. Obligation-keyword diff

Format per **2A.4 contract** (roadmap §2A.4 lines 211–215):
`keyword | count_before_rule | count_after_rule | count_in_context | total_after | accept(Y/N) | rationale`.

Reproducible via `grep -coE` on the three sandbox files (see §6).

| Keyword | BEF | RUL | CTX | TOT | Accept | Rationale |
|---|---:|---:|---:|---:|:-:|---|
| `MUST` | 1 | 0 | 1 | 1 | Y | (a) total ≥ before. The single `MUST verify with tools` lives inside the severity table; table moved to context, slim references the table by name in Iron Law 2. |
| `NEVER` (caps) | 2 | 2 | 0 | 2 | Y | (a). Both fenced-caps `NEVER` lines (Iron Law 1, "no flattery" and "no praise") stayed in slim — they're the normative core. |
| `DO NOT` (caps) | 1 | 1 | 0 | 1 | Y | (a). Iron Law 2's `DO NOT CLAIM WHAT YOU HAVEN'T VERIFIED` is in the slim's fenced caps block. |
| `SHORTEST` (caps) | 1 | 1 | 0 | 1 | Y | (a). Iron Law 3's caps line preserved verbatim. |
| `Skip` (brevity bullet) | 4 | 0 | 4 | 4 | Y | (a). All four "Skip …" bullets moved cleanly to context; slim references "what to skip" by section name. No semantic loss because the caps line ("THE SHORTEST REPLY …") already encodes the obligation; the bullets are exemplars. |
| `verify` (any form) | 6 | 4 | 3 | 7 | Y | (a). Slim retained Iron-Law-2 caps phrase ("HARDER YOU VERIFY"), the explicit-hedging clause, and frontmatter description; context has the severity-table verifications. Total ↑ 6 → 7. |
| `ask` | 3 | 2 | 1 | 3 | Y | (a). Slim kept the caps `→ ASK`; context kept the user-override phrase. |
| `hedge / hedging` | 2 | 2 | 2 | 4 | Y | (a). Slim mentions "hedging is **explicit and short**" inline (load-bearing); context has the full hedging-language paragraph. Total ↑ 2 → 4. |
| `acknowledge` | 1 | 0 | 1 | 1 | Y | (a). Mistake-acknowledgement procedure is mechanics; the obligation ("acknowledge once, switch") is referenced in slim via § Failure modes pointer. |
| `switch` (behavior) | 2 | 0 | 2 | 2 | Y | (a). Same as `acknowledge` — both belong to the slip-handling procedure, which is mechanics. |
| `Iron Law` | 9 | 6 | 6 | 12 | Y | (a). Slim has "Three Iron Laws govern …" + three "## Iron Law N" headings + two cross-refs (6). Context has "Iron Law 1 — anti-pattern bullets" / "Iron Law 2 — severity tiers" / "Iron Law 3 — what to skip" headings + three failure-mode rows ("— Iron Law 1", etc.) (6). Total ↑ 9 → 12. |
| `Whitelist` | 2 | 1 | 2 | 3 | Y | (a). Slim references "Whitelist (📒 …)" inline; context has the section heading + full bullet list. |
| `Blacklist` | 2 | 0 | 2 | 2 | Y | (a). Same as `Whitelist` for the symmetric concept. Slim still names the **default** ("if unsure → blacklist") via the mechanics pointer. |
| `load-bearing` | 3 | 1 | 2 | 3 | Y | (a). Slim retained the Iron-Law-2 caps phrase referencing load-bearing claims; context has the carve-out bullets and the severity-table label. |
| `functional markers` | 2 | 2 | 0 | 2 | Y | (a). Both occurrences ("Emojis are **functional markers**" + alt phrasing) live in slim — the obligation IS the framing, so it stays at the top of the rule. |
| `override(s)` | 4 | 4 | 1 | 5 | Y | (a). All four override clauses ("override conversation momentum", "**Never overrides** `user-interaction`", "User override:", "numbered-options Iron Law overrides brevity") preserved in slim or via cross-ref. Context picks up one extra in the user-override paragraph. |
| `→` (flow marker) | 6 | 4 | 5 | 9 | Y | (a). Iron-Law caps blocks have `→ ASK`; mechanics has `→ ask`, `→ drop to Low`, `→ assume blacklist`, `→ bullets, not paragraphs`, etc. Total ↑ 6 → 9 because mechanics expands the procedural arrows. |
| `drop` | 1 | 1 | 1 | 2 | Y | (a). Slim retains "Drop the cushion, deliver the news" (Iron Law 1 close); context retains "drop to Low for that turn" (severity override). |

**Flag rule:** none triggered. Every keyword has `total_after ≥
count_before_rule`, satisfying acceptance branch **(a)** of the
contract (roadmap line 214). No row needed acceptance branch (b)
(human-rationale for `total_after < count_before`).

## 5. Generalization risk (R5 G5 / risk #18)

The 2A.4 contract's keyword classes that worked here:

| Class | Generalizes? | Why |
|---|:-:|---|
| Caps obligations (`MUST`, `NEVER`, `DO NOT`, `SHORTEST`) | ✓ | Always part of the normative core; stays in slim by definition. |
| Verb obligations (`verify`, `ask`, `hedge`, `acknowledge`, `switch`, `drop`) | ✓ | Move with the procedure they describe. Total preserved when procedure stays in context with a slim reference. |
| Flow markers (`→`) | ✓ | Inflate naturally when mechanics is split into procedural sub-paragraphs. Total ≥ before is the expected outcome, not a gaming risk. |
| Term-of-art (`Iron Law`, `Whitelist`, `Blacklist`, `load-bearing`, `functional markers`) | ✓ | Survives because both layers reference the term; same-name section headings on both sides. |
| Carve-out clauses (`override(s)`) | ✓ | Stays in slim because the carve-out IS the obligation. |

Class that did **not** generalize cleanly: **none for this rule**.

Watch-list for the other two top-3 rules (predicted before
measurement):

- `non-destructive-by-default` has a **trigger table** and a
  **production-branch list** — the 2A.4 contract should treat the
  trigger words (`merge`, `deploy`, `push`, `delete`, `rotate`,
  `apply`) as a single class, not individual keywords, otherwise
  multi-cell tables explode the count. **Recommendation for Phase 2A
  council review:** add a `class:` column to the contract template
  for table-row obligations.
- `scope-control` has a **decline / fenced-step / Hard-Floor**
  three-layer structure; the keyword diff should pick `decline`,
  `fenced`, `Hard Floor` separately rather than collapsing them.

Neither prediction blocks the contract; both can be accommodated by
how 2A.4 is **applied** per rule, not by changing 2A.4 itself.

## 6. Reproducibility

Sandbox files:

- `agents/roadmaps/examples/2A4-direct-answers/direct-answers.slim.md`
- `agents/roadmaps/examples/2A4-direct-answers/direct-answers-mechanics.md`

Re-run the diff (Bash). Counts in §4 are **matching-line counts**
(`grep -coE`), not occurrence counts — `grep -c` counts lines, not
hits per line. This is acceptable for the 2A.4 contract because
each Iron-Law obligation lives on its own line by markdown
convention; per-line is what governs reading-comprehension load.

```bash
RULE=.agent-src.uncompressed/rules/direct-answers.md
SLIM=agents/roadmaps/examples/2A4-direct-answers/direct-answers.slim.md
CTX=agents/roadmaps/examples/2A4-direct-answers/direct-answers-mechanics.md

# Patterns: word-boundary for single tokens; substring for multi-word
# and special chars. Mixing is intentional and matches §4 table.
declare -A PAT=(
  [MUST]='\bMUST\b'
  [NEVER]='\bNEVER\b'
  ['DO NOT']='DO NOT'
  ['Iron Law']='Iron Law'
  [verify]='\bverif(y|ied|ies|ication|ying)\b'
  [override]='\boverrid(e|es|ing)\b'
)
for kw in "${!PAT[@]}"; do
  pat="${PAT[$kw]}"
  b=$(grep -coE "$pat" "$RULE")
  r=$(grep -coE "$pat" "$SLIM")
  c=$(grep -coE "$pat" "$CTX")
  printf "%-12s BEF=%d RUL=%d CTX=%d TOT=%d\n" "$kw" "$b" "$r" "$c" "$((r+c))"
done
```

If a future revision of the contract demands occurrence-counts (one
hit per match, not per line), swap `-coE` for `-oE | wc -l`. The
acceptance verdict for `direct-answers` does **not** flip under
either counting mode — verified at run-time before this artefact
was committed.

## 7. Council-acceptance ask

Per roadmap **0.4.3**: lock the 2A.4 contract on the strength of
this artefact. **Pass-criteria proposal:**

1. The keyword classes in §5 generalize to the other two top-3
   rules (acknowledged predictions, not blockers).
2. No row triggered acceptance-branch (b) — pure (a) acceptance for
   all 17 measured keywords.
3. Slim rule is 42% smaller (4 722 → 2 758) without losing a single
   normative obligation; total surface (slim + context, 6 283) is
   33% **larger** because mechanics gained structure (headings,
   table caption rows). **The 2A.5 budget gate measures the slim
   rule cost vs. the context-load cost per the Phase-0.2 model**;
   it does **not** measure raw chars sum. Phase 0.4 demonstrates
   contract correctness, not budget delta — that's 2A.5's job.

**Fail-criteria** (per 0.4.3): if council finds either (i) a missing
keyword class that should have flagged, or (ii) a row whose
acceptance was wrong, the 2A.4 contract revises and a second
worked example runs before any 2A.3 slim ships.
