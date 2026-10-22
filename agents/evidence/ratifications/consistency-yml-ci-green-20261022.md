---
proposed_by: claude-opus-5-5 session d50bc995 (ci/green-in-minutes, inbox round inbox-2026-10-w)
implemented_by: claude-opus-5-5 session d50bc995 (ci/green-in-minutes)
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), 2026-10-22, run 2
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: SUBJECT_PLACEHOLDER
---

<!-- evidence-type: ratification -->

# `consistency.yml` on the CI-speed branch — governance surface touched, no authority expanded

**Gated file:** `.github/workflows/consistency.yml` only (it hosts the ratification
gate step). Three changes: a `merge_group` trigger (inert until an admin enables a
queue), `timeout-minutes: 25` on the required job, and a rewritten cost comment
above the "Gate coverage floors" step. The step itself is unchanged; the behaviour
change of `check_gate_coverage` lives in `src/scripts/check_gate_coverage.ts`.

**Prompt:** `agents/evidence/council/consistency-yml-ratification-2026-10-22.question.md`,
the complete diff of the gated file embedded verbatim.

## Review record — two runs, stated because the second is not a re-ask for a different answer

| Run | Mode | anthropic | openai |
|---|---|---|---|
| 1 | `--prompt-mode pr` | `confirmed-non-expanding` | "No blocking findings … fail-closed … APPROVE" — no token from the closed vocabulary |
| 2 | default prompt, same question file | `confirmed-non-expanding` | `confirmed-non-expanding` |

Run 1's openai answer agreed in substance but used the PR reviewer's own format, so
it carried no verdict the gate's vocabulary can record; reading "APPROVE" as
`confirmed-non-expanding` would have been the author writing the seat's verdict.
Run 2 asked the same question in the mode that keeps the requested format. No seat
moved between runs; the recorded seats are run 2's.

## Reasons, the seats' own

- `merge_group` broadens *when* the workflow runs, not anyone's authority; PR-only
  steps stay excluded by `github.event_name == 'pull_request'` or an empty
  `github.base_ref`, and the trigger does not enable a queue.
- The timeout fails closed: a hang turns the required check red, it cannot bypass it.
- The remaining edits are comments.

## Conditions, landed in the tree

- **Before a merge queue is enabled**, verify that every merge-blocking invariant
  skipped on `merge_group` is either enforced elsewhere or intentionally PR-only
  (openai, run 2). Written onto `agents/roadmaps/stubs/road-to-main-protection-ruleset-changes.md`,
  which holds the queue decision.
- The 25-minute fence derives from one historical maximum (openai, run 1); its
  post-change runtime is recorded in `road-to-a-required-check-that-does-not-rerun-the-gates`
  AC-2 and the fence is re-read against it.
