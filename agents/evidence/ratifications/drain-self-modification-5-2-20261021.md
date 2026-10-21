---
proposed_by: claude-opus-5.5/drain-self-modification-20261021
implemented_by: claude-opus-5.5/drain-self-modification-20261021
reviewed_by: ai-council
subject: 7f5b65ce7c34ec876e00889c2edc4acc0aac63b2fb26fdc89323c73b81d10d83
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: ratified
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Step 5.2, round 7 of 7.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/escalation-shape-review-r7-20261021.question.md`, committed at `1f9ab5fca556dda143fcb6d815da72983fe01276` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `ratified`

```text
Matze, reviewing the ratification gate's round 7 escalation-message change.

## What behaviour changes

**New stderr output path**: The gate writes an escalation message to stderr on four triggers — `refused`/`non-convergent` records, provider-diversity shortage, or any council-answered change to the reviewer itself. Written unconditionally (every run, cannot be suppressed by flags) while `--quiet` keeps its stdout contract. Exit codes unchanged — failing records still fail (1), passing records over the mechanism still pass (0).

**What follows**: The CI log now carries a formatted question naming the verdict, dissenting seats, exact changed paths, and asking for gain/risk/rollback that the gate cannot infer. A mechanism change reaching CI without this heading would falsify the benefit; tests drive `main()` and verify stderr contains it.

## Authority boundaries

**Narrower**: Output sanitization (`printable()`, `UNPRINTABLE_RE`) prevents control/format/separator character injection from candidate-controlled ADR text. Bounded at 50 listed items with remainder counted, fields clipped to 200 code points before escaping. Test walks full Unicode range verifying every `Cc|Cf|Zl|Zp` character escapes. Paths listed first — records cannot crowd the change out.

**Not wider**: Explicitly advisory, states "no CI check enforces it", doesn't claim to block merges the tree cannot block. Exit codes unchanged. The `/pr:merge` classifier routes mechanism paths `needs-owner` (test verifies all paths, all change types M/A/D/R), but "nothing stops a merge made outside that command" — stated honestly as a limit, not papered over.

## Self-judgment concern

The gate adds code to judge changes to itself. Dangerous territory, but:

1. **Doesn't weaken validation** — authoring defects (no record, self-ratified, stale subject) still fail at exit 1, *including on the mechanism* (tests pin this for `SELF_PATH`).
2. **Doesn't change verdicts** — the escalation is additional information, not a replacement for the record. `gated.self && (anyRatified || escalated.length > 0)` triggers the `reviewer` case, but the exit code comes from the record validation, unchanged.
3. **Adds output only** — no new passing condition, no gate bypass.

The risk is **precedent** — if round 8 says "the question was asked, so we don't need a record anymore" or "stderr output means automatic approval", that would weaken the gate by building on this. This round does not do that, but it adds weight to a gate reviewing its own evolution.

## Specific issues

**src/scripts/check_kernel_edit_ratified.ts:422-427** — `MECHANISM_PATHS` must stay complete. The `isMechanismPath()` function now uses `.includes()` over this constant, so they cannot drift. Test verifies every path routes `needs-owner` in the merge classifier. **Severity: covered by test.**

**src/scripts/check_kernel_edit_ratified.ts:625-627** — Sanitization clips to code points, *then* escapes. A field with 1000 BEL characters becomes 200 `\u{7}` escapes. This is correct (clip prevents DOS, escapes prevent injection), and the test verifies it. **Severity: non-issue, working as intended.**

**docs/contracts/ratification-artifact.md:747-752** — "no required CI status enforces it" is accurate: the gate has no owner-acknowledgment primitive it could authenticate, so it cannot block on absence of approval. The tree holds that `/pr:merge` routes these paths `needs-owner` when an agent merges, nothing more. **But**: a direct forge merge or a workflow that removes the gate step bypasses this. Stated in the contract as "what the gate cannot stop". **Severity: honestly stated limit, not a defect.**

**src/scripts/check_kernel_edit_ratified.ts:1029-1036** — The stderr write is unconditional. A workflow parsing stderr for errors only might break, but: (a) the output has a distinctive heading, (b) it's marked advisory, (c) stderr is the right place for a question that must not be suppressed. **Severity: acceptable risk, correct stream choice.**

**Test coverage gap?** No. The adversarial-character test (`ADVERSARIAL` sample + full-range walk) is comprehensive. The polarity tests (authoring defects don't escalate, passing records over non-mechanism don't escalate) cover the negative cases. The `main()` tests verify stderr actually gets written. **Severity: none, coverage is thorough.**

## What it cannot stop, restated

A change that removes or skips the workflow step calling this gate — that edit is itself a mechanism change, carries a record, and nothing in the gate runs when the step does not. **This is the honest outer bound**: the gate is code in a workflow that is code. Stated in the contract, not hidden.

## Smaller change?

Sanitization + bounds are necessary for safety (candidate-controlled ADR text). Stderr vs stdout separation preserves `--quiet`'s contract while ensuring the question cannot be suppressed. Changing `--quiet` behaviour would break an existing CLI contract. The `MECHANISM_PATHS` constant and comprehensive test coverage add size but are necessary for correctness. **I don't see a smaller change that achieves the goals safely.**

## Precedent risk

My concern is not this diff — it's carefully defensive — but the **direction**: each round adds features to the gate that judges the gate. This round adds output. A future round might say "output means we asked, so validation can weaken" or "the question is a gate, so passage of the question is passage of the change". That would be the failure mode.

**This round does not do that.** It maintains all validation, changes no exit codes, and explicitly states the output is advisory. But complexity accumulates.

## Observation that would show benefit false

A mechanism change reaches the CI log without the escalation heading in stderr, or the heading appears but lists the wrong paths, or `--quiet` suppresses it. Tests directly verify these cannot happen by driving `main()` and reading both streams.

---

STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `refused`

```text
Matze, I would not greenlight this as satisfying the stated “run stops with one question” contract.

## Findings

- **High — must-fix:** `src/scripts/check_kernel_edit_ratified.ts:1023-1034` returns the original exit code after printing the escalation. A passing self-modification therefore exits `0`; CI and automation can proceed without any owner decision. The document calls this advisory, but the governing contract says the run “stops.” This is a substantive mismatch, not merely wording. Failure scenario: a mechanism change is ratified, the warning scrolls past in CI, and automated merge proceeds successfully.

- **High — must-fix:** `docs/contracts/ratification-artifact.md:758-770` explicitly concedes that no required status enforces owner approval and that removing/skipping the workflow bypasses the mechanism. Consequently the component being protected controls both its own detection and its own execution. The `/pr:merge` classifier is not an independent boundary: it resides in the same candidate-controlled tree and does not cover forge UI, API, other bots, or direct pushes. This widens effective authority for self-modification while presenting only a visibility control.

- **Medium — must-fix:** `src/scripts/check_kernel_edit_ratified.ts:606-612` does not actually print a question or capture a decision. It instructs another agent to “state each … then ask the user once.” There is no decision identifier, acknowledgment channel, or durable correlation between the displayed case and the eventual merge. Failure scenario: one log prints the advisory, while a later job or actor merges a different revision without proving which question—if any—the owner answered.

- **Medium — must-fix:** `src/scripts/check_kernel_edit_ratified.ts:347-367` makes `MECHANISM_PATHS` a shared dependency of both protection classification and the test claiming complete protection. A forgotten new mechanism path will be absent from the predicate and from the test iteration, so the test passes while the new surface is unprotected. Derive this set from an independently maintained policy/manifest, or add a completeness test against actual imports, workflow files, and governed anchors.

- **Medium — must-fix:** `tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts`, “the `/pr:merge` classifier routes every mechanism path,” tests `classifyChanges()` directly, not the `/pr:merge` command, workflow wiring, branch protection, or forge configuration. It proves local classification behavior only. The documentation overstates this as a property “the tree holds.”

- **Medium — deferred:** `src/scripts/check_kernel_edit_ratified.ts:825-833` reparses raw frontmatter with `readAdrFrontmatter()` and `readSeats()` after `readRatification()` has already established its interpretation. This couples presentation to parser internals and risks displaying seats under semantics different from those used for the verdict. Prefer structured, sanitized seat data returned by the authoritative reader.

- **Low — deferred:** `src/scripts/check_kernel_edit_ratified.ts:564-611` allows candidate-controlled records to manufacture escalations and visually confusing Unicode text. Controls, bidi formatting, and separators are escaped, which prevents the serious terminal-forging cases, but homoglyphs and combining characters remain. This is primarily an alert-fatigue/social-engineering risk rather than code execution.

- **Low — rejected as a blocker:** The shared 50-item output budget can omit gated paths after the first 50 (`src/scripts/check_kernel_edit_ratified.ts:576-590`). The total count remains visible, so this is acceptable if such a change is explicitly required to consult the diff; it should not be described as listing the entire exact change.

## Sequencing and rollback

Step 5.2 depends on an owner route that is neither authenticated nor enforced. Until such a route exists, later steps cannot safely treat this as a completed escalation boundary. The current rollback rule—revert if the exit code changes or the heading disappears—only detects implementation drift. It does not address false positives, ignored advisories, missing log retention, or merges completed without acknowledgment.

A meaningful kill switch should trigger if any self-mechanism change merges without a revision-bound owner acknowledgment, if the escalation is absent from retained check output, or if false escalations make operators routinely ignore it.

## Hardest pushback

The architectural call I oppose most is letting a self-modification check succeed while claiming the run stops for the owner. Evidence that would change my mind would be an independently administered required forge status that binds an authenticated owner decision to the exact commit SHA and cannot be changed or removed by the candidate branch.

The smaller honest change is to emit a clearly named informational diagnostic without claiming contractual enforcement. If the contract truly requires stopping, the minimum compliant change is a distinct non-success result plus a revision-bound acknowledgment mechanism outside the repository’s control.

Net effect: the patch improves visibility and does not weaken existing verdict parsing or thresholds, but it does not create the promised safety boundary. Its documentation carefully admits the bypasses while still treating the advisory as fulfillment of a stopping contract.

STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes
```

## Added by hand after rendering: all seven rounds and the disposition

Everything above this heading was rendered by `ratification_record` from round
7's session record — the step 3.4 writer, itself refused on this branch and
reachable at `1f9ab5fca` (see `drain-self-modification-3-4-20261021.md`); this
section was written afterwards and is not derived.

Step 5.2 of `road-to-self-modification-that-a-council-must-pass` — the
ratification gate prints the contract's one question for the user. Every round
went through the CLI seats (anthropic, openai), nothing billed; every prompt is
committed verbatim under `agents/evidence/council/escalation-shape-review-*`.

| Round | Date | anthropic | openai | What refused it, and what changed |
|---|---|---|---|---|
| 1 | 2026-10-18 | refused | refused | unqualified "the user decides" over exit 0; authoring defects escalated; raw record text — fixed |
| 2 | 2026-10-18 | refused | refused | sanitizer range list — now the `Cc`/`Cf`/`Zl`/`Zp` classes |
| 3 | 2026-10-21 | no stance line (REQUEST_CHANGES) | no stance line (REQUEST_CHANGES) | `--quiet` hid a passing run's question |
| 4 | 2026-10-21 | ratified | refused | advisory overclaimed a merge hold; output unbounded — reworded, bounded |
| 5 | 2026-10-21 | confirmed-non-expanding | refused | `--quiet` printing the question changed a CLI contract — withdrawn |
| 6 | 2026-10-21 | ratified | refused | a workflow could pass `--quiet`; records could crowd out paths — stderr channel, paths first |
| 7 | 2026-10-21 | ratified | refused | the block is advisory with exit 0 rather than a stop; no authenticated owner acknowledgment; the step can be skipped by its own workflow |

**Disposition.** Round 1 refused the block for implying a decision over exit 0;
round 7 refused it for not being a stop. Between them the openai seat's
dealbreakers moved from the block's content to the absence of an enforced,
authenticated owner-acknowledgment status — which the contract records does not
exist and ADR-281 § 5 (owner-directed) assigns to the owner's act on the forge.
Four consecutive rounds split with a different provider tried, which is
condition 1 of `ratification-artifact.md` § When the user decides: the owner
decides. The code was taken off the branch, file by file to `origin/main`,
because a `refused` record cannot carry it past the gate; it stays reachable at
`0e262c5c2`. No eighth round was run: on the same design it would be verdict
shopping, and the open question is an owner design decision, not a defect.
