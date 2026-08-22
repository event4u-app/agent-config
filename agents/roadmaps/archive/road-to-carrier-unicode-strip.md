---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
---
# Road to carrier unicode strip

> **Source:** agents/tmp.old/humanizer.txt — a dropped inbox artifact proposing
> an output-side hidden-character strip for humanized prose. Every claim below
> was re-checked against the tree on 2026-08-22 and the one reproducible
> mechanism was re-run offline before this file was written.

## Context

The tree already **detects** hidden Unicode carriers and never **removes** them
from a deliverable. `scanHiddenUnicode` is defined at
`src/scripts/detect_ai_tells.ts:94` and called at `:160`; it reports
bidi / zero-width / Unicode-tag findings and returns.

The humanize skill's step 0 is deliberate about this on the **ingestion** side:
`src/skills/humanizer/SKILL.md:41-50` says to run the scan on raw input and
"surface any finding as a warning — never silently strip it". That is correct
for untrusted input, and it is the only place hidden Unicode is handled at all.
Nothing covers the **output** side — the prose the skill hands back.

The one sanitiser that exists cannot be reused. `_sanitize` at
`src/scripts/lint_hidden_unicode.ts:451-464` drops **every** codepoint for which
`_classify` returns non-null, unconditionally, then applies `.normalize('NFKC')`
at `:461`. `_classify` (`:50`) routes through `_ZERO_WIDTH` (`:45`), which
contains `0x200c` and `0x200d` — so a blind pass destroys emoji ZWJ sequences
and complex-script joiners. It is a **file linter's** repair path, and it is
context-blind by design; pointing a deliverable's prose at it would corrupt the
deliverable.

The gap is therefore narrow and specific: a **context-aware** strip that keeps
`_classify` as the single source of truth for *what is a candidate* and adds one
predicate for *whether to remove it*.

**Not a duplicate.** An archived roadmap wired a hidden-unicode scan onto
*ingested* content as an injection vector and explicitly recorded "do not
silently strip"
(`agents/roadmaps/archive/road-to-humanizer-hardening.md:76-79`). This roadmap
is the other direction — the suite's own output — and touches none of it.

**Reproduced before authoring (6/6 assertions, offline, against the real
`_classify` export).** A neighbour predicate — remove a `_classify`-flagged
codepoint only when both adjacent codepoints are ASCII or absent — removes an
ASCII-flanked `U+200B`, `U+202E` and `U+E0041`, leaves an emoji ZWJ sequence and
a Persian ZWNJ byte-identical, and is a no-op (and idempotent) over clean prose.

## Goal

The humanize skill can, when the operator asks for it, hand back prose with
ASCII-flanked hidden-Unicode carriers removed and an auditable line saying what
was removed and what was preserved — while an emoji ZWJ sequence and a
complex-script joiner survive byte-identically. Detector evasion stays a
permanent, stated non-goal.

## Phase 1 — The strip function

- [x] **1.1 Add `stripCarrierUnicode` to `src/scripts/detect_ai_tells.ts`,
      beside `scanHiddenUnicode`.** Import `_classify` from
      `lint_hidden_unicode.ts` rather than forking its class list — one source
      of truth for what counts as a carrier, so a class added there is covered
      here without a second edit. The function adds only the neighbour
      predicate: a flagged codepoint is removed when the preceding and following
      codepoints are both ASCII (`< 0x80`) or absent; otherwise it is preserved.
      No `NFKC`, no new runtime dependency.
      verify: `grep -n 'stripCarrierUnicode' src/scripts/detect_ai_tells.ts`
      returns the export, and `grep -n "_classify" src/scripts/detect_ai_tells.ts`
      shows it imported rather than redefined.

      **LANDED 2026-08-22.** `stripCarrierUnicode` sits beside
      `scanHiddenUnicode` in `detect_ai_tells.ts`. `_classify` was **already**
      imported there at `:40` for the scanner, so the one-source-of-truth
      property was free rather than newly established — worth stating, because
      the step reads as though the import is new work and it is not. The
      function adds only the neighbour predicate: removed when both neighbours
      are ASCII (`< 0x80`) **or absent**, which makes a boundary carrier
      removable — a carrier at the start or end of a string has no neighbour to
      be joining. No `NFKC`, no new dependency.
- [x] **1.2 Return a removal/preservation summary, not just a string.** The
      shape is `{ out, removed, preserved }` plus per-codepoint records
      (codepoint, class from `_classify`, offset, disposition). A strip that
      returns only text cannot be audited, and the whole point of the opt-in is
      that the operator can see what left.
      verify: a targeted unit run asserts the record count equals
      `removed + preserved` on a mixed input.

      **LANDED.** `{ out, removed, preserved, records }`, one record per
      candidate carrying `codepoint` (`U+XXXX`), `cls` (from `_classify`,
      never a second list), `offset`, `disposition`, and `reason` — non-null
      exactly when preserved. **Offsets are CODEPOINT indices, not UTF-16
      units**, which the step did not specify and which matters: the emoji
      before a preserved `U+200D` is a surrogate pair, so a UTF-16 index would
      report a different number and make the audit line wrong for precisely the
      inputs the predicate exists to protect. Pinned by its own fixture.
- [x] **1.3 Do not touch `_sanitize`.** It stays exactly as it is — it is a
      file-repair path whose blind class drop and `NFKC` are correct for its own
      callers. This roadmap adds a sibling; it does not generalise the existing
      one.
      verify: `git diff --stat -- src/scripts/lint_hidden_unicode.ts` is empty
      at the end of Phase 1.

      **HELD — the diff is empty.** `_sanitize` is untouched, and step 3.3
      records the refusal in the skill's own `## Do NOT` so the shortcut is
      refused where an author would reach for it rather than only here.

## Phase 2 — The opt-in skill step

- [x] **2.1 Add step 5b to the humanize procedure as OPT-IN.** It sits between
      the mechanical verification (step 5) and the deterministic self-check
      (step 6) in `src/skills/humanizer/SKILL.md`. Default is off: the step runs
      only when the operator asks for a carrier strip. A silent default strip
      would be a silent edit to the deliverable, which the skill's own
      factual-integrity guard forbids.
      verify: `grep -n '5b' src/skills/humanizer/SKILL.md` resolves inside the
      `## Procedure` section, and the step text contains the word "opt-in".

      **LANDED, and labelled as documentation rather than implied to be wired.**
      Step 5b sits between 5 and 6, default off, running only on an explicit
      operator request. The blocker resolved as **(b)**: there is **no
      programmatic call site**. What exists is
      `docs/contracts/write-engine.md:109`, which invokes the humanizer skill
      for the step-4b humanize audit — a real consumer of the *skill*, but an
      agent-carried prose step that calls no function, and it invokes the audit
      rather than 5b. `src/domains/gtm-marketing/humanize/command.md:62` is the
      same shape ("Follow humanizer § Procedure"). Neither is a wiring, and
      claiming either would be the "defined but not wired" failure the
      engineering floor calls not-done.
- [x] **2.2 Emit the audit line.** When the step runs it prints the
      removal/preservation summary from 1.2 — how many carriers were removed, of
      which classes, and how many were preserved and why. An unexplained
      preservation is the interesting half: it is what tells the operator the
      predicate fired conservatively rather than failed.
      verify: the step text names the summary fields, and the Phase 3 fixture
      asserts both counts are reported.

      **LANDED.** 5b names `removed`, `preserved`, the classes removed, and the
      per-preservation reason, and says why the preserved half is the
      interesting one. The fixture asserts `records.length === removed +
      preserved` and that a preserved record's `reason` is non-null while a
      removed one's is null — so a summary that reported counts without
      accounting for every candidate would fail.
- [x] **2.3 Restate the load-bearing guard at the step.** Step 0's ingestion
      rule is unchanged — input findings are still surfaced, never stripped. Say
      so at 5b so the two directions cannot be read as one policy.
      verify: `sed -n '/5b/,/^6\./p' src/skills/humanizer/SKILL.md` contains a
      sentence distinguishing the output strip from the step-0 ingestion warning.

      **LANDED, with the reason and not only the rule.** 5b states that step 0
      scans *ingested* input and never strips **because there the hidden
      characters are an injection vector and removing them destroys the
      evidence**, whereas 5b's prose is the suite's own output and the operator
      asked. Two directions, two policies — the sentence exists so they cannot
      be read as one.

## Phase 3 — Fixtures and the two refusals

- [x] **3.1 Add `src/skills/humanizer/evals/strip_fixtures.json`.** The
      directory currently holds `triggers.json` only. The fixture set carries
      the six reproduced assertions: three ASCII-flanked carriers removed
      (`U+200B`, `U+202E`, `U+E0041`), an emoji ZWJ sequence preserved, a
      Persian ZWNJ preserved, and a clean-prose no-op that is also idempotent.
      verify: `npx tsx -e` over the fixture file asserts 6 cases, and a targeted
      vitest run of the strip test file exits 0.

      **LANDED — 6 cases, 11 assertions, and the blocker resolved as (b).**
      `tests/scripts/strip_carrier_unicode.test.ts` drives all six from the JSON
      and adds AC-1's single combined input plus the codepoint-offset case.
      Carriers in the fixture file are written as literal characters with an
      escape-form note, because a fixture whose payload is invisible in review
      is a fixture nobody can check.
      **`carrier-strip-script-property` → (b):** `recorded_limitation` in the
      JSON names the tested blocks (Arabic/Persian, emoji ZWJ) and states
      plainly that Indic, Thai, Khmer, Myanmar and Mongolian are **untested** —
      and why that is acceptable rather than merely admitted: the predicate errs
      toward preservation, so an untested script is preserved rather than
      corrupted. The failure mode cannot occur in the unsafe direction. It also
      records what WOULD change the answer — a script whose format characters
      legitimately sit between two ASCII characters; none is known.
      **Sensitivity verified:** forcing the predicate to always strip turns
      three fixtures red (both preservation cases and AC-1); restoring returns
      11/11.
- [x] **3.2 Add Fixture 3 to `src/skills/humanizer/references/fixtures.md`.**
      The file has Fixture 1 (`:8`) and Fixture 2 (`:32`) today. Fixture 3 is
      the worked before/after of a carrier strip, showing the audit line — a
      reader has to be able to see what "preserved" looks like without running
      anything.
      verify: `grep -n '^## Fixture 3' src/skills/humanizer/references/fixtures.md`
      returns a line.

      **LANDED at `:72`, and built around the preserved half.** The worked input
      carries all four carriers at once, and the audit line was **generated by
      running the real function rather than written by hand** — the first draft
      had an offset of 24 where the code reports 26, which is exactly the
      hand-written-example rot this fixture exists to prevent. Three readings
      are called out for the reader: `U+200B` and `U+200D` are the SAME class
      and get opposite dispositions (so any strip keyed on class alone destroys
      the emoji); offsets are codepoint indices; and a preservation always
      carries its reason, because an unexplained one is indistinguishable from a
      bug.
- [x] **3.3 Record the two refusals in the skill's `## Do NOT` section.**
      (a) The blind sanitiser and `NFKC` are forbidden on a deliverable — name
      `_sanitize` and say why (it drops `0x200c`/`0x200d` unconditionally).
      (b) No statistical-watermark rewrite and no detector-evasion mode — that
      exclusion already stands at `src/skills/humanizer/SKILL.md:100-108` and
      this step must not weaken it.
      verify: `grep -n 'NFKC\|_sanitize' src/skills/humanizer/SKILL.md` returns
      the refusal, and `git show HEAD:src/skills/humanizer/SKILL.md | sed -n '100,108p'`
      still matches the shipped exclusion text.

      **LANDED — both refusals in `## Do NOT`.** (a) names `_sanitize`, `NFKC`,
      and the two codepoints (`U+200C`, `U+200D`) that make the blind path
      corrupt a deliverable, and says outright that 5b exists *because* that
      shortcut is one import away and looks like the same job — Risk 2, placed
      where an author would reach for it. (b) restates the detector-evasion
      exclusion and adds why the strip cannot be repurposed toward it: it
      removes invisible characters and alters no visible prose. The original
      exclusion is unweakened; this adds to it.

## Blockers

### blocker: carrier-strip-script-property

- **Status:** resolved
- **Owner:** implementer
- **Blocks:** step 3.1
- **Class:** 3
- **What to do:** pick exactly one — (a) consult a Unicode Script property
  table so the complex-script preservation test is general, or (b) record in the
  fixture file that the test is a curated block set (Arabic/Persian, Indic,
  Thai) and therefore conservative-by-design, and state which scripts are
  untested.
- **Recommendation:** (b). The predicate errs toward preservation, so an
  unlisted script is preserved rather than corrupted; a full Script table is a
  new data dependency for a failure mode that cannot occur in the unsafe
  direction.
- **If you do nothing:** the fixture asserts a general claim it does not test,
  and the first non-Latin script outside the curated block set reads as an
  unverified pass.
- **Resolved when:** the fixture file either cites a Script-property lookup or
  carries the recorded-limitation paragraph naming the tested blocks.
- **Resolution (2026-08-22) — (b), the recommended option.**
  `src/skills/humanizer/evals/strip_fixtures.json` carries a
  `recorded_limitation` block naming the tested blocks (Arabic/Persian, emoji
  ZWJ) and the untested ones (Indic, Thai, Khmer, Myanmar, Mongolian, and every
  other script using a mid-word format character). It states *why* that is
  acceptable rather than merely admitting it: the predicate removes a carrier
  only when both neighbours are ASCII, so a format character inside a non-ASCII
  word is preserved whatever its script — an untested script is preserved, never
  corrupted, and the failure mode cannot occur in the unsafe direction. It also
  records what would change the answer: a script whose format characters
  legitimately appear between two ASCII characters. None is known. A test
  asserts the block is present, so the limitation cannot be quietly deleted.

### blocker: carrier-strip-wiring-point

- **Status:** resolved
- **Owner:** implementer
- **Blocks:** step 2.1
- **Class:** 3
- **What to do:** pick exactly one — (a) cite the write-engine consumer call
  site `file:line` where step 5b is invoked, or (b) scope the step to the skill
  procedure alone and record that no programmatic consumer calls it yet.
- **Recommendation:** (a) if the call site exists, (b) otherwise. A skill step
  with no located consumer is documentation, which is a legitimate first
  increment — but it must be labelled as one rather than implied to be wired.
- **If you do nothing:** step 2.1 claims a wiring that nothing performs, which
  is the "defined but not wired" failure the engineering floor calls not-done.
- **Resolved when:** step 2.1 carries either the consumer `file:line` or the
  explicit "skill-procedure only, no programmatic consumer" note.
- **Resolution (2026-08-22) — (b), after checking for (a).** No programmatic
  call site exists. Two consumers of the SKILL do:
  `docs/contracts/write-engine.md:109` (the step-4b humanize audit) and
  `src/domains/gtm-marketing/humanize/command.md:62` ("Follow humanizer §
  Procedure"). Both are agent-carried prose that call no function, and the
  write-engine one invokes the *audit* rather than 5b. Step 2.1 says so
  explicitly. Recording them rather than omitting them matters in both
  directions: citing either as a wiring would be the "defined but not wired"
  failure this blocker names, and omitting them would hide where 5b will
  actually be reached from when someone does wire it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The neighbour predicate is too coarse and preserves a real carrier | implementation | An attacker-planted carrier adjacent to any non-ASCII character survives the strip | Accepted and stated: the predicate is deliberately conservative, and the strip is a hygiene pass, not a security control — the injection vector is covered on the ingestion side by the step-0 scan, which is untouched | Context |
| 2 | Someone later "simplifies" 5b onto `_sanitize` | implementation | The blind path looks like the same job and is one import away; it would silently corrupt emoji and joiners in deliverable prose | Step 3.3 records the refusal in the skill's own `## Do NOT`, naming `_sanitize` and the two codepoints, so the shortcut is refused where an author would reach for it | Phase 3 — Fixtures and the two refusals |
| 3 | The opt-in default drifts to on | product | A strip that runs by default is a silent edit to the operator's text, which the skill's factual-integrity guard already forbids for other edits | 2.1 pins the default off in the step text; 2.2 makes any run produce an audit line, so an unnoticed strip is not reachable | Phase 2 — The opt-in skill step |
| 4 | `_classify` gains a class whose members are legitimate mid-word | implementation | A future class addition in `lint_hidden_unicode.ts` widens this strip's candidate set without a review here | The neighbour predicate still applies to every new class, so the widening can only remove ASCII-flanked instances; the fixture set is the regression net | Phase 1 — The strip function |

## Acceptance Criteria

- [x] AC-1 — ONE fixture simultaneously demonstrates all three properties: the
      three ASCII-flanked carriers are gone, the emoji ZWJ sequence and the
      Persian ZWNJ are byte-identical to their input, and re-running the strip
      over its own output changes nothing.
- [x] AC-2 — `src/scripts/lint_hidden_unicode.ts` is unchanged by this work, and
      `detect_ai_tells.ts` imports `_classify` rather than restating its class
      list, so the candidate set cannot drift between the two files.
- [x] AC-3 — Running the humanize skill without asking for a carrier strip
      produces output byte-identical to what it produces today; the step is
      reachable only on an explicit request.
- [x] AC-4 — The skill's `## Do NOT` section names `_sanitize` and `NFKC` as
      forbidden on a deliverable, and the detector-evasion exclusion at
      `SKILL.md:100-108` is present and unweakened.

## Out of scope — and why

- **An origin-aware content-integrity pipeline.** The source artifact proposed
  one. No defect in this tree was confirmed for it: nothing here mislabels
  content origin today, so the roadmap would be building a mechanism against an
  unobserved failure.
- **A media-sanitization roadmap.** Also proposed by the source. It runs against
  this suite's own disclosure floors, which require AI-generation provenance to
  be *non-removable*; a sanitiser whose job is stripping provenance markers from
  media is the opposite obligation and would need those floors reopened first.
- **Detector evasion, in any form.** Already excluded by the skill itself
  (`src/skills/humanizer/SKILL.md:100-108`). This roadmap keeps that exclusion
  as a permanent non-goal and adds nothing that could be repurposed toward it —
  the strip removes invisible characters, it does not alter visible prose.
