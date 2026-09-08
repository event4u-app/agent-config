---
complexity: lightweight
review_by: 2026-12-08
---

# Stub: road to a path-activation route under `delivery`

> **Stub — not active work.** Created 2026-09-08 by the owner-delegated drain run
> holding `road-to-delivery-for-every-host`, as the receiver for R2 finding 1 on
> PR #1923. The finding is real and measured; every way to CLOSE it is a budget
> move reserved to the owner, so the closure is recorded here rather than taken
> drive-by. The finding's other half — the tree asserting the loss did not exist —
> was fixed on that branch.

## The finding, quoted

From `agents/evidence/reviews/drain-delivery-for-every-host.findings.md`, row 1
(high):

> `path_only_ids` classifies a rule path-only only when EVERY trigger is
> path-shaped (`kinds.every`). Rules with BOTH path and non-path triggers are
> therefore thinned on claude-code, and their path-shaped half then reaches the
> host at no scope: the stub carries no frontmatter and is written by `_writeText`
> (condense.ts:1186), so `_emit_claude_rule`'s host-native `paths:` key is
> bypassed; `pre_tool_use` lost the binding (hook_manifest.yaml:1283); and
> `user_prompt_submit` never populates `openFiles` (rule_inject_hook.ts:289-301),
> so a path trigger cannot match there.

## What is actually lost, measured rather than described

**18 rules** carry both path and non-path triggers, all non-kernel, all thinned
under `lean_projection.mode: delivery` with `hosts: [claude-code]`:
augment-edit-discipline, design-fidelity, doc-screenshot-hygiene,
domain-adoption-policy, framework-neutrality-in-generic-skills,
image-likeness-and-rights, laravel-translations, lethal-trifecta-guard,
linked-projects-onboarding-gate, low-impact-corpus-privacy-floor,
markdown-safe-codeblocks, onboarding-gate, persona-governance, php-coding,
provider-lifecycle-discipline, roadmap-ci-steps-policy, roadmap-progress-sync,
settings-ask-protocol.

Two corrections to the finding's own framing, both established by running branch
code and both narrowing it:

1. **They do not reach the model at no scope.** Every non-path route — keyword,
   phrase, command — still delivers the body through the concern. The shipped
   `user_prompt_submit` reach over the frozen corpus is 98/101 labelled rules, and
   the three that differ (`design-review-after-ui-write`, `source-of-truth`,
   `ui-audit-gate`) are the path-only rules the existing exemption already keeps
   full-bodied. **No thinned rule is unreachable.**
2. **They never had a separate host-native path route on this host.**
   `_claude_paths_plan` (`src/install/claudePathsPlan.ts:250`) emits no `paths:`
   for a mixed-trigger rule *on purpose*, because Claude Code reads the key as the
   whole gate and would discard every keyword the author wrote. So under
   `eager-all` these 18 loaded UNCONDITIONALLY.

What is therefore lost is the difference between **unconditional** and
**prompt-triggered**: a session that touches a matching file and says nothing that
matches its keywords gets nothing. `design-fidelity` on an attached
`*design.html` and `doc-screenshot-hygiene` on a write under `docs/media/` are the
sharp cases.

## Why no closure was taken on the branch

Two mechanisms could restore a path route, and both are budget moves an agent may
not make:

| Closure | Cost, measured | Why owner-reserved |
|---|---|---|
| Widen the exemption to `some` (keep every path-bearing rule full-bodied) | thin rule layer **23,592 → 39,921 GPT tok** (+16,329, +69 %) | erases most of the saving ADR-265 is licensed on, and needs `thin_rule_load` re-anchored by that magnitude |
| Re-bind `rule-inject` on `pre_tool_use` | that slot's measured gate-open p90 for the concern is **19,649 B** against a **2,048 B** slot sum | owner ruling E2 fixes `pre_tool_use` at 2,048 and removed the binding; raising it is the charge E2 declined to pay |

A third option was designed and rejected on the branch rather than left implied:
emit the host-native `paths:` key on the **stub** for a mixed rule, so a path
match loads the pointer and the body still arrives on a keyword match. It composes
under `delivery` and **breaks `thin`**, where the stub gated behind `paths:` would
take the keyword route with it — so it is mode-conditional emitter behaviour, which
is a design decision, not a repair.

## What closes this stub

One of:

- An owner decision to widen the exemption, with `internal/bench/reports/token-baseline.json`
  re-anchored in the same change and the attribution recorded in its `rebaseline_note`.
- An owner decision to raise the `pre_tool_use` slot sum in
  `src/config/hook-token-budget.json` and re-bind the concern there, with the
  latency budget re-measured.
- A measurement showing the loss does not matter: a corpus fixture per mixed rule
  whose ONLY positive is a path match, and a reading of how often such a turn
  occurs in real sessions. `agents/runtime/state/injection-census.jsonl` is the
  instrument; it records `{ts, slot, concern, bytes}` and would need the trigger
  kind added to answer this.

## What already landed, so this stub is not a substitute for it

- `model_rule_injection --endpoints` (b) publishes the shipped
  `user_prompt_submit` reach beside the pre-registered `open_files`-honoured
  reading, and names the rules reachable only via a path trigger. The loss is now
  measured on every run instead of invisible.
- `loadCorpus` parses the corpus `command:` field, which it had dropped — two
  `command`-triggered positives were scoring as unmatched plain prompts.
- `project_thin_rules.path_only_ids`, `hook_manifest.yaml`'s binding comment and
  ADR-265's Consequences all name the mixed class and what it loses. The manifest
  comment's "lose nothing" was accurate for the three path-only rules and silent
  about the 18 next to them; the silence read as coverage.

## Provenance

- Finding: `agents/evidence/reviews/drain-delivery-for-every-host.findings.md` row 1.
- Record: ADR-265, whose `review_trigger` this finding evaluates against.
- Council: NOT consulted — both enabled seats read 50/50 exhausted on 2026-09-08,
  so the disposition above is an agent decision and is recorded as one.
