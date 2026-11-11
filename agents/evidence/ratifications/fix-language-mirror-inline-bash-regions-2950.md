---
proposed_by: claude-code session fixing issue #2950 (2026-11-11)
implemented_by: claude-code session fixing issue #2950, same session — see § Independence
reviewed_by: ai-council 2026-11-11 (round 1) — anthropic (cli) + openai (cli)
subject: c2be9fa9a569979d731973777f98eba7dad82f642fb941b816b1cd061c05a4c0
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `fix/language-mirror-inline-bash-regions` (issue #2950)

Named for the branch, because the gate reads this file on the first push,
before a PR number exists.

## What was proposed

Issue #2950: Claude Desktop writes a terminal-pane command into the prompt as
inline `<bash-input>`/`<bash-stdout>`/`<bash-stderr>` tags on one line, and the
app's English advisory inside them pinned English in a German session. The fix
in `src/scripts/_lib/prompt_shape.ts` removes closed regions of those three
tags before scoring. It adds 118 B to the hook bundle (1,594,895 B on
origin/main 417e7b56df → 1,595,013 B, both read by the gate through the CI
mirror); origin/main sat 5 B under its ceiling.

| Surface | Change |
|---|---|
| `src/config/hook-bundle-budget.json` | `max_bytes` 1,594,900 → 1,595,100; one new `raise_log` entry whose `to` is 1,595,100. No chunk ceiling, chunk group, `max_yaml_packages` or `shrink_only` change. |

## Round

One invocation, 2026-11-11, subscription CLI, $0. The response is a runtime
artefact and is not cited by path; the prompt is committed verbatim at
`agents/evidence/council/hook-bundle-budget-2950-r1-20261111.question.md`.

- anthropic: `VERDICT: ratified`, `DEALBREAKER: no`. Read the raise as a
  documented relaxation of the gate, not a removal. Findings: the
  "no smaller form" claim is asserted rather than shown (a `/s`-flag regex is a
  few bytes shorter); no offsetting removal was explored; regression coverage
  was not visible in the prompt.
- openai: APPROVE, naming `ratified` as the fitting verdict ("raising
  `max_bytes` relaxes the gate … the gate remains enforcing"). Minimum raise
  113 B, proposed 200 B, 87 B headroom; requiring offsetting removals is not
  in the stated policy. Asked for tests on German text around an inline region
  and on inline regions together with the standalone-wrapper strip.

The record's `ratified` verdict is the one both seats named: the change widens
what the bundle may weigh by 200 B, which is a (small) relaxation rather than a
non-expansion.

## Follow-ups applied

- Tests added in `tests/scripts/language_mirror_hook.test.ts`: German text on
  both sides of an inline region classifies `de`; an inline terminal line plus
  a `<launch-selected-element>` block are both removed. The issue's three-turn
  sequence, the multi-line and unclosed-tag cases were already covered.
- Not applied: the `/s`-flag rewrite would save ~4 B and does not change the
  need for a raise (113 B over); left as is to keep the measured figure in
  `raise_log` exact.

## Independence

Proposer and implementer are the same agent session. Review came from two
providers through the configured council, neither of which wrote the diff. No
authority beyond bundle weight is granted: no slot, permission, gate or
enforcing step changes.

## Gain, risk, rollback

- Gain: German sessions using the Code tab's terminal pane keep their pin.
- Risk: the hook bundle may grow by up to 200 B more than before, loaded on
  every dispatch; negligible against 1.59 MB.
- Rollback: revert the PR; the ceiling returns to 1,594,900 with the strip.
