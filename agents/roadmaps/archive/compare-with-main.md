# Rules / Guardrails Review — `main` vs PR #3

## Bottom line

The rules layer is **better overall in PR #3**, but the system around the rules is **less strict in a few important ways**.

What improved:

* rules are more formalized
* rule linting is stronger
* analysis routing is clearer
* source-of-truth workflow is safer for in-progress work
* guidelines coverage is much broader

What got weaker or riskier:

* some of the old strictness around execution quality moved from “enforced” to “advised”
* the new guideline layer is strong, but can accidentally make skills too dependent on guidelines
* the new source-of-truth workflow is safer during editing, but weaker at keeping compressed output continuously up to date
* the system is now better structured, but easier to make “clean but weaker” if the linter stays too flexible

---

## 1. Where rules are clearly better than `main`

### 1.1 Rule linting is much stronger in PR #3

This is one of the clearest improvements.

In PR #3, rule linting gained explicit checks for:

* YAML frontmatter
* `type`
* `source`
* `description` for auto rules
* required H1 heading
* exact newline / blank-line hygiene
* better procedural detection

The PR explicitly says all 26 existing rules pass after those checks were added. That is a real improvement over `main`, where that formalized rule validation layer did not yet exist in this stronger form. ([GitHub][1])

### Why this is better

Because rules are now less likely to silently drift into:

* malformed frontmatter
* unclear matching behavior
* inconsistent formatting
* pseudo-skills disguised as rules

### How to preserve this quality

Keep these rule-linter checks exactly as they are, and treat them as non-negotiable:

* frontmatter required
* valid `type`
* valid `source`
* description required for `auto`
* heading required
* exactly one trailing newline
* no extra blank-line noise

Do **not** relax these to “warnings only”.

---

### 1.2 `analysis-skill-routing` is a real improvement over `main`

This rule does not exist on `main`, and it is a meaningful addition in PR #3. It explicitly says:

* use the narrowest matching analysis skill
* use `universal-project-analysis` only for broad, unclear, or explicitly deep requests
* prefer framework-specific or root-cause analysis when the problem is already shaped clearly

That is a strong upgrade to your routing behavior. ([GitHub][2])

### Why this is better

Because on `main`, there was no dedicated rule-level safeguard against overusing broad analysis skills.
This new rule reduces:

* over-routing into expensive broad analysis
* vague “analyze everything” behavior
* context bloat

### How to preserve this quality

Keep the rule.

But add one small safeguard:

* routing must still verify that the chosen specialist skill is actually sharp enough
* do not let this rule send requests into weak, over-compressed target skills

Suggested addition:

* “Only route to a narrower skill if that skill still contains executable workflow and concrete validation.”

---

### 1.3 `markdown-safe-codeblocks` is better as a rule than as a skill

In `main`, there is no `markdown-safe-codeblocks.md` under rules. In PR #3 it becomes a dedicated rule with hard constraints:

* never nest triple backticks
* prefer plain text / `~~~` / safer outer fences
* always validate copyability and rendering stability

That migration is directionally correct. This behavior is truly “always apply” behavior, so rule form is better than skill form. ([GitHub][3])

### Why this is better

Because this is not a workflow that should be matched occasionally.
It is a default safety constraint that should always apply when generating markdown with code blocks.

### How to preserve this quality

Keep it as a rule.

But strengthen it slightly so the operational intent from the old skill is not lost:

* add “Do not wrap copy/paste templates in an outer triple-backtick fence unless explicitly requested”
* add “If code examples are embedded inside template output, prefer plain text first”

That keeps the rule short while preserving the strongest guardrails.

---

### 1.4 `guidelines.md` is broader and more useful in PR #3

On `main`, the guidelines rule points to a relatively small PHP guideline set: `php.md`, `controllers.md`, `eloquent.md`, `validations.md`, `resources.md`, `jobs.md`, `git.md`, and the patterns directory. ([GitHub][4])

In PR #3, the same rule expands significantly with many new focused guideline files, including:

* `api-design.md`
* `artisan-commands.md`
* `blade-ui.md`
* `database.md`
* `flux.md`
* `livewire.md`
* `logging.md`
* `naming.md`
* `performance.md`
* `security.md`
* `sql.md`
* `websocket.md` ([GitHub][5])

### Why this is better

Because the agent now has a richer, more precise convention layer and can check the relevant guideline instead of improvising.

This is especially valuable for:

* consistency
* framework conventions
* avoiding repeated background explanation inside skills

### How to preserve this quality

Keep the broader guideline index.

But add one explicit boundary line:

* “Guidelines contain conventions and reference knowledge. Skills contain executable workflows.”

That boundary is implied in `main` and PR #3, but it should become explicit now that the guideline layer is much larger. ([GitHub][4])

---

### 1.5 `augment-source-of-truth` is safer for active work in PR #3

On `main`, the workflow says:

1. edit in `.augment.uncompressed/`
2. compress into `.augment/`
3. mark done

That means compression is expected immediately after the edit. ([GitHub][6])

In PR #3, the workflow changes to:

1. edit in `.augment.uncompressed/`
2. **do not auto-compress**
3. before commit/push, check if compression is needed
4. run `/compress` only then

That is a real workflow improvement for active editing. ([GitHub][7])

### Why this is better

Because it avoids:

* compressing half-finished work
* constant interruption
* repeatedly mutating `.augment/` during active drafting

That is especially important now that compression itself is more opinionated.

### How to preserve this quality

Keep the new “compress before commit/push” model.

But add an explicit checkpoint rule:

* after any meaningful milestone, run `task sync-changed`
* before asking for review, verify whether compressed outputs are stale

That preserves the flexibility of PR #3 without losing situational awareness.

---

## 2. Where `main` was better, or where PR #3 became weaker / riskier

### 2.1 `main` was stricter about keeping source-of-truth and derived output aligned during work

This is the main place where `main` was actually stronger.

`main` effectively forces quick re-alignment because compression happens right after editing. PR #3 intentionally delays compression until commit/push. ([GitHub][6])

### What exactly was better on `main`

* derived output stayed closer to source edits during the whole work session
* less chance of forgetting compression for a long-lived branch
* easier to compare source and compressed versions early

### Why it was better in that narrow sense

Because consistency was enforced earlier, not only at the end.

### Why PR #3 is still directionally right

Because immediate compression is too disruptive for real editing.

### How to keep PR #3 quality without regressing

Do **not** go back to auto-compress-after-every-edit.

Instead add:

* a required `task sync-changed` check before review
* a CI consistency workflow
* a linter / reviewer note when `.augment.uncompressed/` changed but derived outputs were not regenerated

That preserves the better editing workflow while restoring the alignment guarantee that `main` enforced more aggressively.

---

### 2.2 `main` had a smaller guideline surface, which made accidental skill replacement less likely

This is subtle but important.

On `main`, `guidelines.md` points to a smaller and more focused set of docs. In PR #3, the guideline layer grows a lot. ([GitHub][4])

### What exactly was better on `main`

* fewer guideline targets
* lower risk that a skill becomes “go read the guideline”
* clearer separation in practice between “reference docs” and “workflow skill”

### Why it was better

Because a smaller guideline system naturally puts more pressure on skills to stay operational.

### Why PR #3 is still better overall

Because the richer guideline coverage is genuinely useful.

### How to keep PR #3 quality without regressing

Add this explicitly to either `guidelines.md` or a companion rule:

* “A skill must still contain the operational workflow.”
* “Do not replace procedural guidance with guideline references.”
* “Skills may reference guidelines, but may not outsource their core execution steps.”

This keeps the expanded guideline system while preventing it from hollowing out skills.

---

### 2.3 `main` had fewer opportunities for over-routing because the analysis routing rule did not exist yet

This sounds paradoxical, but it matters.

PR #3 adds `analysis-skill-routing`, which is good. But any new routing rule also creates a new failure mode: routing too early into a specialist skill that is not sharp enough. ([GitHub][2])

### What exactly was better on `main`

* no extra routing rule could misroute analysis tasks
* fewer automatic routing assumptions

### Why that was better in one narrow sense

Because a missing router cannot over-route.

### Why PR #3 is still better overall

Because broad-analysis overuse was a real problem, and this rule directly addresses that.

### How to keep PR #3 quality without regressing

Strengthen the rule with one extra constraint:

* “Only prefer the narrower analysis skill if it preserves concrete workflow, concrete validation, and real decision power.”

That makes the routing rule dependent on target skill quality, which is exactly what you want.

---

### 2.4 `main` had less chance of “formal cleanliness hiding weaker execution”

This is not because the rules themselves were better on `main`.
It is because PR #3 improves structure and rule formalization **while simultaneously** loosening parts of the skill-quality enforcement layer.

The PR history explicitly shows:

* rule linter got stronger
* then skill linter got more flexible
* `missing_validation` was downgraded to warning
* `Procedure` moved from required to recommended
* 20 skills were trimmed to procedure-only
* warnings were cleaned up partly by reducing recommended noise rather than always restoring stronger content ([GitHub][1])

### What exactly was better before

Not `main`’s rule text itself, but the older behavior of “stricter expectations create sharper skills.”

### Why that was better

Because once the rule layer becomes stronger, the execution layer must not become softer at the same time.

Otherwise you get:

* cleaner structure
* broader guidance coverage
* but weaker operational sharpness

### How to keep PR #3 quality without regressing

Restore these enforcement points:

* `Procedure` required again for skills
* `missing_validation` back to error
* compressed skill fails if it loses:

    * concrete validation
    * concrete example
    * critical anti-pattern
    * essential decision criteria

This is the biggest place where quality can still slip.

---

## 3. Concrete aftercare: what should be corrected now

### A. Keep the new rule architecture

Do not undo:

* `analysis-skill-routing`
* `markdown-safe-codeblocks` as rule
* expanded `guidelines.md`
* new source-of-truth workflow
* stronger rule-linter structure checks ([GitHub][7])

### B. Re-add the lost strictness around execution quality

Restore:

* `Procedure` required
* `missing_validation` = error
* compression-preservation checks
* explicit “guidelines do not replace skills” rule. ([GitHub][1])

### C. Strengthen three rules/files directly

#### 1. `guidelines.md`

Add:

* “Guidelines contain conventions and reference material.”
* “Skills contain executable workflows.”
* “Do not move a skill’s operational core into a guideline.”

Why:

* PR #3’s larger guideline system is useful, but this boundary now needs to be explicit. ([GitHub][5])

#### 2. `analysis-skill-routing.md`

Add:

* “Only route to the narrower skill if that skill still has executable workflow and concrete validation.”
* “If the narrow skill is too weak, route through the broader skill and mark the gap.”

Why:

* this prevents clean-but-weak specialist routing. ([GitHub][2])

#### 3. `augment-source-of-truth.md`

Add:

* “Before review or PR, run `task sync-changed`.”
* “Before merge, verify derived outputs are regenerated.”
* “Do not leave `.augment/` stale across review cycles.”

Why:

* `main` was better at continuous alignment; PR #3 is better for editing, but needs explicit checkpoints. ([GitHub][6])

---

## 4. Final judgment

### Are the rules better than on `main`?

Yes — **overall, clearly yes**.
The rule layer is more formal, more complete, and more useful than on `main`. ([GitHub][7])

### Where was `main` better?

`main` was better mainly in two narrow ways:

* tighter day-to-day alignment between source and compressed output
* lower risk that guidelines overshadow skills because the guideline surface was smaller. ([GitHub][6])

### What exactly must be corrected now?

Not the new rules themselves.

What must be corrected is the **system around them**:

* re-harden skill enforcement
* prevent guideline overreach
* add routing quality safeguards
* add pre-review consistency checkpoints. ([GitHub][1])

### Best summary sentence

PR #3 made the **rule layer better than `main`**, but to keep that gain, you now need to restore the **execution-quality guardrails** that stop stronger rules from being undermined by weaker skills. ([GitHub][1])

[1]: https://github.com/event4u-app/agent-config/pull/3 "docs: add skills audit baseline and results template by matze4u · Pull Request #3 · event4u-app/agent-config · GitHub"
[2]: https://raw.githubusercontent.com/event4u-app/agent-config/refs/pull/3/head/.augment.uncompressed/rules/analysis-skill-routing.md "raw.githubusercontent.com"
[3]: https://raw.githubusercontent.com/event4u-app/agent-config/refs/pull/3/head/.augment.uncompressed/rules/markdown-safe-codeblocks.md "raw.githubusercontent.com"
[4]: https://raw.githubusercontent.com/event4u-app/agent-config/main/.augment.uncompressed/rules/guidelines.md "raw.githubusercontent.com"
[5]: https://raw.githubusercontent.com/event4u-app/agent-config/refs/pull/3/head/.augment.uncompressed/rules/guidelines.md "raw.githubusercontent.com"
[6]: https://raw.githubusercontent.com/event4u-app/agent-config/main/.augment.uncompressed/rules/augment-source-of-truth.md "raw.githubusercontent.com"
[7]: https://raw.githubusercontent.com/event4u-app/agent-config/refs/pull/3/head/.augment.uncompressed/rules/augment-source-of-truth.md "raw.githubusercontent.com"
