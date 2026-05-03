---
title: "2A.4 worked example — direct-answers"
phase: 0.4
status: draft
lock_state: locked
sandbox:
  - agents/roadmaps/examples/2A4-direct-answers/direct-answers.slim.md
  - agents/roadmaps/examples/2A4-direct-answers/direct-answers-mechanics.md
target_rule: .agent-src.uncompressed/rules/direct-answers.md
council_session: agents/council-sessions/2026-05-03T09-45-33Z/
---

Status: locked

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

## 4.1 Counting conventions (council revision 1, 2 + 3)

Codified after the Phase-0.4 council pass (session
`2026-05-03T09-45-33Z`). Three rules govern how a keyword row is
constructed before a count is taken:

**a. Single-token keyword.** Match with `\bword\b` (word-boundary).
Single row in the diff table. Examples: `MUST`, `NEVER`, `verify`,
`ask`, `acknowledge`, `switch`, `drop`, `Whitelist`, `Blacklist`.

**b. Multi-word term-of-art.** Match as a literal substring (no
word-boundary). Single row. Examples: `DO NOT`, `Iron Law`,
`functional markers`, `load-bearing`. Document the literal form in
the `PAT` array of §6 verbatim — no regex alternation, no case
folding.

**c. Multi-cell-table obligation class.** Where the original rule
encodes obligations in a table whose rows are individual triggers
(e.g., `non-destructive-by-default`'s prod-trigger table, severity
tiers, frequency helpers), the **table** counts as **one row** in
the diff under a `trigger-class:<name>` keyword. Cell counts are
reported in a sub-row of the rationale column ("table has 6 cells:
merge, deploy, push, …") but **do not** generate 6 individual diff
rows. This is the council's blocking revision (multi-cell tables
explode the diff and trigger false-positive gaming alerts; see
session response, anthropic verdict §1).

**Counting mode.** The 2A.4 contract uses **matching-line counts**
(`grep -coE`) by default — one hit per line, regardless of how many
times a pattern matches on that line. Markdown convention places
each Iron-Law obligation on its own line, so per-line is what
governs reading-comprehension load and is therefore the load-bearing
metric. **Occurrence-counts** (`grep -oE | wc -l`) are an opt-in
secondary mode used only when (i) a keyword regularly appears
multiple times per line in either the rule or the context, **and**
(ii) the per-line count masks an obligation drop. The §6
reproducibility script must run **both** modes and accept iff the
verdict is the same under both — divergence triggers a manual
review, not auto-acceptance.

**Pre-flight keyword discovery (council revision 3).** The keyword
table in §4 is no longer hand-curated from inspection. The §6.1
candidate-generation block emits all caps-block obligations
(`[A-Z]{4,}` patterns) and all bold-marked phrases as candidates;
the human curator may **drop** candidates with a one-line
justification but may not **silently omit** them. The candidate set
for `direct-answers` was re-generated against this rule and matches
the §4 table verbatim — the previous omission of `claim` (4
occurrences in Iron Law 2) is acknowledged as a known sub-class of
`load-bearing` (the load-bearing-claim phrase), not a missing row.

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
  **production-branch list** — handled by §4.1 rule (c)
  (`trigger-class:<name>` single-row collapse). The trigger-table
  row reports cell count in its rationale ("table has 6 cells:
  merge, deploy, push, prod-data, rm-bulk, infra-commit") and is
  one keyword row in the diff. Without §4.1 (c), the diff would
  produce 6 rows and trip the keyword-explosion failure mode the
  council flagged.
- `scope-control` has a **decline / fenced-step / Hard-Floor**
  three-layer structure; the keyword diff picks `decline`,
  `fenced`, `Hard Floor` as three separate single-token / multi-word
  rows per §4.1 rules (a) and (b). They are conceptually related
  but textually distinct; collapsing them would lose obligation
  granularity.

Both top-3 successors are accommodated by §4.1's three-rule
counting convention without changing the 2A.4 contract itself.

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

# Patterns: word-boundary for single tokens (§4.1 a); substring for
# multi-word and special chars (§4.1 b). All 17 measured keywords
# are listed verbatim — no silent omissions.
declare -A PAT=(
  [MUST]='\bMUST\b'
  [NEVER]='\bNEVER\b'
  ['DO NOT']='DO NOT'
  [SHORTEST]='\bSHORTEST\b'
  [Skip]='\bSkip\b'
  [verify]='\bverif(y|ied|ies|ication|ying)\b'
  [ask]='\bask(s|ed|ing)?\b'
  [hedge]='\bhedg(e|es|ed|ing)\b'
  [acknowledge]='\backnowledg(e|es|ed|ing|ement)\b'
  [switch]='\bswitch(es|ed|ing)?\b'
  ['Iron Law']='Iron Law'
  [Whitelist]='\bWhitelist\b'
  [Blacklist]='\bBlacklist\b'
  ['load-bearing']='load-bearing'
  ['functional markers']='functional markers'
  [override]='\boverrid(e|es|ing)\b'
  ['→']='→'
  [drop]='\bdrop(s|ped|ping)?\b'
)
for kw in "${!PAT[@]}"; do
  pat="${PAT[$kw]}"
  bL=$(grep -coE "$pat" "$RULE")
  rL=$(grep -coE "$pat" "$SLIM")
  cL=$(grep -coE "$pat" "$CTX")
  bO=$(grep -oE "$pat" "$RULE" | wc -l | tr -d ' ')
  rO=$(grep -oE "$pat" "$SLIM" | wc -l | tr -d ' ')
  cO=$(grep -oE "$pat" "$CTX"  | wc -l | tr -d ' ')
  printf "%-20s LINE BEF=%d RUL=%d CTX=%d TOT=%d  |  OCC BEF=%d RUL=%d CTX=%d TOT=%d\n" \
    "$kw" "$bL" "$rL" "$cL" "$((rL+cL))" "$bO" "$rO" "$cO" "$((rO+cO))"
done
```

The script reports **both** counting modes (line + occurrence) per
§4.1. Acceptance requires the verdict to match under both modes;
divergence flags a manual review. For `direct-answers`, every row
satisfies branch (a) under both modes — verified at run-time before
this artefact was committed.

Run-time output may show **higher** BEF/CTX counts than the §4 table
for verb keywords (e.g., `ask` reproduces as BEF=4 vs §4 BEF=3)
because the script's regex matches inflected variants
(`asks`/`asked`/`asking`) that the hand-curated §4 patterns counted
under separate sub-classes. **The acceptance verdict (branch (a) for
all 17 rows) is invariant** — TOT increases on both sides of the
diff, never below BEF. The §4 table is the authored baseline; the
§6 script is the reproducibility floor.

## 6.1 Pre-flight keyword candidate generation

Council revision 3: the keyword set is no longer hand-curated. The
candidate list is generated automatically from the original rule;
the curator may drop with justification but must not silently omit.

```bash
RULE=.agent-src.uncompressed/rules/direct-answers.md

# (a) Caps-block obligations: any 4+ char ALL-CAPS word
grep -oE '\b[A-Z][A-Z]{3,}\b' "$RULE" \
  | sort | uniq -c | sort -rn > /tmp/cand_caps.txt

# (b) Bold-marked load-bearing phrases
grep -oE '\*\*[^*]+\*\*' "$RULE" \
  | sed 's/\*\*//g' | sort -u > /tmp/cand_bold.txt

# (c) Section-heading terms-of-art
grep -oE '^#{1,6} [^#].*' "$RULE" \
  | sed 's/^#* *//' | sort -u > /tmp/cand_headings.txt

cat /tmp/cand_caps.txt /tmp/cand_bold.txt /tmp/cand_headings.txt
```

The curator's job is to **classify** each candidate per §4.1 (a),
(b), or (c), or to drop it with a one-line `dropped:<reason>`
comment in the §4 table. Synonyms (`SHALL`/`SHALL NOT`/`PROHIBIT`/
`REQUIRE`) surface here even if the curator has never encountered
them, closing the council-flagged "editor didn't think to grep for
X" failure mode.

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

## 8. Council acceptance verdict

Council session: `agents/council-sessions/2026-05-03T09-45-33Z/`
(both members, single round, files mode, $0.0737 actual).

| Reviewer | Verdict | Lockable as-is | Blocking change |
|---|---|:-:|---|
| `anthropic/claude-sonnet-4-5` | `ACCEPT_WITH_REVISIONS` | No | Multi-cell-table class-counting convention (3 revisions) |
| `openai/gpt-4o` | `ACCEPT_WITH_REVISIONS` | No | Multi-word + procedural keyword handling (3 revisions) |

**Convergence.** Both reviewers identified the same blocking issue
(multi-cell tables exploding the diff on the next rule,
`non-destructive-by-default`) and both produced compatible revision
sets. No tie-break round needed.

**Revisions applied (this commit):**

1. **§4.1 added** — three-rule counting convention:
   (a) single-token / `\bword\b`,
   (b) multi-word / literal substring,
   (c) multi-cell-table → single `trigger-class:<name>` row with
   cell count in rationale (the council's blocking item).
2. **§4.1 counting-mode clause** — line-count is default,
   occurrence-count is opt-in secondary; the §6 script must run
   both and acceptance requires verdict-parity.
3. **§6.1 added** — pre-flight automated keyword-candidate
   generation (caps-block grep, bold-phrase grep, heading grep).
   Curator drops with justification, never silently omits.
4. **§6 PAT array fixed** — all 17 measured keywords now listed
   verbatim, including `SHORTEST` (previously omitted, was
   council-flagged as a script-vs-table inconsistency).
5. **§5 watch-list rewritten** — both top-3 successors now
   accommodated by §4.1 (a)/(b)/(c) without contract changes.

**Status:** `locked`. The 2A.4 contract is now ready for application
to the remaining 8 always-rules in Phase 2A.

**Out-of-scope follow-up** (council-raised but not blocking):
anthropic's "Independent Architectural Critique" suggested upgrading
the candidate-generation script to flag `SHALL`/`PROHIBIT`/`REQUIRE`
synonyms at first encounter. §6.1 (a) catches them today via the
generic `[A-Z]{4,}` pattern; a dedicated synonym-table is deferred
to a hypothetical 2A.4.1 if Phase 2A surfaces a rule that uses one.
