# Which rule obligations are already mechanical

<!-- evidence-type: analysis -->

> **Produced by:** `./scripts-run src/scripts/report_obligation_mechanism --table`
> on `main` @ `01b4a2219`, 2026-10-02. Step 1.5 of
> `road-to-rule-triggers-and-links-that-hold`. Re-run the command to reproduce
> every row; the summary form (no flag) prints the counts below.

## The question, and the one it is not

Per rule: **is the obligation already carried by something that can refuse**,
and **is there a host event that fires at the obligation's own frequency**.

Those are two columns because they are two questions, and the report would be
misleading if it merged them. The first is measured — a gate refuses or it does
not. The second is **necessary and never sufficient**: it says a slot exists to
bind a carrier to, not that the obligation is decidable from what that slot
sees. Whether a given obligation *could* be mechanised is a judgement about its
content, and a join over frontmatter cannot make it. Where a rule has already
made that judgement in its own body — `instruction-only`, with a reason — the
report reproduces it rather than overriding it.

Report only. Moving an obligation out of prose is a per-rule change with its
own review.

## What was joined

Three instruments that already existed and had never been read together:

| Instrument | What it contributed |
|---|---|
| `check_enforcement_coverage --json` | the only place `enforced_by` and `obligation_frequency` are already resolved per rule, plus what the declaration resolves TO |
| `report_obligation_carriers` | how many artifacts restate the same obligation — a different question from whether one enforces it |
| the `# obligation: line N` frontmatter marker | 107 of 121 rules carry one and nothing in the tree reads it; this is its first reader |

## The reading

| Class | Rules | What it means |
|---|---:|---|
| carried by a gate that can refuse | 16 | a validator, hook or test blocks the forbidden outcome |
| carried by an observer | 10 | something fires and records; nothing refuses |
| declared gap | 15 | the rule's own body says `instruction-only` or `none`, with a reason |
| no enforcement declaration at all | 80 | the `rule-enforcement-baseline.json` set — undeclared, not necessarily uncovered |
| **total** | **121** | |

Two further counts, both over the same 121:

- **91 rules are not gated and sit at a frequency a host event fires at.** That
  is the upper bound on what binding a carrier could ever reach, not a backlog.
  It is large because most obligations are `per-edit` or `per-turn`, which is
  exactly where hook slots exist — the number says the slots are not the
  scarce thing.
- **14 rules carry no `# obligation: line N` marker.** Nine are the kernel,
  where `block_kernel_rule_writes` refuses an agent write and
  `validate_frontmatter` exempts the frequency key; the remaining five are
  simply unmarked.

The marker itself is worth one honest sentence: **nothing produced it and
nothing but this report reads it.** It is a hand convention, it has been wrong
before (a recorded case where it pointed at a blank line), and a reader should
treat a line number in the table below as a claim by whoever last edited that
frontmatter, not as a measurement.

## Why "declared gap" is not a finding

A rule that says `instruction-only` and gives a reason has done the thing this
report exists to encourage: it looked at its own obligation and said out loud
that no gate can see it. `active-remediation` is the clearest case — the note,
the ask and the user's decision are all prose, so no gate can distinguish a
discharged issue from a mentioned one. Counting those 15 as a gap to close
would invert the incentive and reward silence over the declaration.

The 80 undeclared rules are the opposite shape: not a statement that nothing
carries the obligation, but no statement at all. That set is already a
shrink-only baseline under `lint_rule_enforcement_declaration`, so it is
narrowing by construction and needs nothing from this report.

## Per rule

| Rule | Tier | Marker | Frequency | `enforced_by` | Resolves to | Carried | Slot exists | Restatements |
|---|---|---:|---|---:|---|---|---|---:|
| `active-remediation` | 2b | 31 | per-edit | 1 | `none` | declared-gap | yes | 1 |
| `agent-authority` | 3 | — | — | 0 | `none` | undeclared | no | 0 |
| `analysis-skill-routing` | 3 | 19 | none | 0 | `none` | undeclared | no | 1 |
| `architecture` | 3 | 26 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `artifact-drafting-protocol` | 2a | 41 | per-task | 0 | `none` | undeclared | yes | 0 |
| `artifact-engagement-recording` | mechanical-already | 22 | per-task | 0 | `none` | undeclared | yes | 0 |
| `ask-when-uncertain` | 3 | — | — | 0 | `none` | undeclared | no | 0 |
| `augment-edit-discipline` | 2a | 28 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `autonomous-execution` | 3 | 4 | per-turn | 0 | `none` | undeclared | yes | 2 |
| `brand-consistency` | 2a | 20 | none | 0 | `none` | undeclared | no | 1 |
| `brand-source-of-truth` | 2a | 51 | per-edit | 0 | `none` | undeclared | yes | 1 |
| `broken-access-control` | 2a | 55 | per-edit | 0 | `none` | undeclared | yes | 1 |
| `cli-output-handling` | 2a | 42 | per-edit | 0 | `none` | undeclared | yes | 1 |
| `code-comment-discipline` | 2b | 5 | per-edit | 2 | `validator` | gate | yes | 1 |
| `code-provenance` | 2a | 40 | per-edit | 1 | `none` | declared-gap | yes | 0 |
| `command-suggestion-policy` | mechanical-already | 18 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `commit-conventions` | 2a | 19 | per-commit | 0 | `none` | undeclared | yes | 1 |
| `commit-policy` | safety-floor | — | — | 0 | `none` | undeclared | no | 2 |
| `communication-through-line` | 2b | 20 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `content-quoting-floor` | 2a | 19 | per-event | 0 | `none` | undeclared | yes | 0 |
| `context-hygiene` | 1 | 67 | per-turn | 1 | `observer` | observer | yes | 0 |
| `copilot-routing` | 3 | 19 | none | 0 | `none` | undeclared | no | 1 |
| `council-availability` | 2a | 27 | per-task | 1 | `none` | declared-gap | yes | 0 |
| `cross-source-consistency` | 2a | 71 | per-task | 0 | `none` | undeclared | yes | 0 |
| `decision-revisit-gate` | 2b | 31 | per-task | 1 | `none` | declared-gap | yes | 0 |
| `delegation-policy` | 2b | 35 | per-task | 0 | `none` | undeclared | yes | 0 |
| `design-fidelity` | 2a | 58 | per-edit | 1 | `none` | declared-gap | yes | 1 |
| `design-review-after-ui-write` | 2b | 39 | per-edit | 1 | `none` | declared-gap | yes | 0 |
| `devcontainer-routing` | 3 | 20 | none | 0 | `none` | undeclared | no | 1 |
| `direct-answers` | 3 | — | — | 0 | `none` | undeclared | no | 5 |
| `doc-screenshot-hygiene` | 2a | 49 | per-event | 0 | `none` | undeclared | yes | 0 |
| `docker-commands` | 3 | 22 | per-edit | 0 | `none` | undeclared | yes | 1 |
| `domain-adoption-policy` | 2b | 38 | per-task | 0 | `none` | undeclared | yes | 1 |
| `domain-safety-disclaimer` | 2a | 52 | per-task | 0 | `none` | undeclared | yes | 0 |
| `domain-safety-pii` | 2a | 52 | per-task | 0 | `none` | undeclared | yes | 0 |
| `domain-safety-retention` | 2a | 47 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `downstream-changes` | 2b | 30 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `engineering-safety-floor` | 2a | 49 | per-commit | 0 | `none` | undeclared | yes | 0 |
| `evaluator-independence` | 2a | — | per-edit | 1 | `observer` | observer | yes | 0 |
| `external-code-graph-interop` | 2a | 37 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `external-reference-deep-dive` | 2b | 20 | per-task | 0 | `none` | undeclared | yes | 0 |
| `fast-path-marker-visibility` | 1 | 30 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `finance-safety-floor` | 2a | 53 | per-task | 0 | `none` | undeclared | yes | 0 |
| `fix-what-you-see` | 2a | — | per-event | 1 | `none` | declared-gap | yes | 0 |
| `framework-neutrality-in-generic-skills` | 2a | 65 | per-edit | 1 | `validator` | gate | yes | 1 |
| `git-history-discipline` | 2a | 35 | per-commit | 1 | `hook` | gate | yes | 3 |
| `guidelines` | 3 | 16 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `history-discipline` | 2a | 35 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `icon-consistency` | 2a | 41 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `image-likeness-and-rights` | 2a | 32 | per-event | 0 | `none` | undeclared | yes | 0 |
| `improve-before-implement` | 2b | 45 | per-task | 0 | `none` | undeclared | yes | 0 |
| `invite-challenge` | 2b | 62 | per-task | 0 | `none` | undeclared | yes | 0 |
| `language-and-tone` | 3 | — | — | 1 | `validator` | gate | no | 1 |
| `laravel-routing` | 3 | 29 | none | 0 | `none` | undeclared | no | 1 |
| `laravel-translations` | 2a | 23 | per-edit | 0 | `none` | undeclared | yes | 1 |
| `legal-safety-floor` | 2a | 103 | per-task | 0 | `none` | undeclared | yes | 0 |
| `lethal-trifecta-guard` | 2a | 60 | per-edit | 1 | `validator` | gate | yes | 0 |
| `linked-projects-onboarding-gate` | 2b | 30 | per-session | 0 | `none` | undeclared | yes | 1 |
| `low-impact-corpus-privacy-floor` | 1 | 28 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `markdown-safe-codeblocks` | 2b | 23 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `media-governance-routing` | 2a | 46 | per-event | 1 | `validator` | gate | yes | 0 |
| `media-sync-ground-truth` | 2a | 31 | per-event | 0 | `none` | undeclared | yes | 0 |
| `minimal-safe-diff` | 2a | 25 | per-edit | 1 | `observer` | observer | yes | 0 |
| `missing-skill-recovery` | 2a | 41 | per-turn | 1 | `none` | declared-gap | yes | 0 |
| `missing-tool-handling` | 2a | 16 | per-event | 0 | `none` | undeclared | yes | 1 |
| `model-recommendation` | 2a | 4 | per-task | 0 | `none` | undeclared | yes | 1 |
| `no-attribution-footers` | 3 | 18 | per-commit | 0 | `none` | undeclared | yes | 0 |
| `no-cheap-questions` | 3 | — | — | 0 | `none` | undeclared | no | 0 |
| `no-decorative-emojis-in-git-surfaces` | 3 | 27 | per-commit | 0 | `none` | undeclared | yes | 0 |
| `no-pr-progress-comments` | 2a | 20 | per-commit | 0 | `none` | undeclared | yes | 0 |
| `no-roadmap-references` | mechanical-already | 47 | per-edit | 2 | `validator` | gate | yes | 1 |
| `non-destructive-by-default` | safety-floor | — | — | 1 | `none` | declared-gap | no | 2 |
| `notes-first-reasoning` | 2b | 35 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `onboarding-gate` | 1 | 18 | per-session | 1 | `observer` | observer | yes | 0 |
| `output-discipline` | 2a | 22 | per-edit | 1 | `validator` | gate | yes | 0 |
| `package-ci-checks` | mechanical-already | 17 | per-commit | 0 | `none` | undeclared | yes | 1 |
| `persona-governance` | 2a | 41 | per-edit | 1 | `validator` | gate | yes | 1 |
| `php-coding` | 3 | 25 | per-edit | 0 | `none` | undeclared | yes | 1 |
| `playbook-precedence` | 2a | — | per-task | 1 | `none` | declared-gap | yes | 0 |
| `prefer-enums-over-literals` | 2b | 27 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `preservation-guard` | 2b | 22 | per-edit | 2 | `validator` | gate | yes | 0 |
| `provider-lifecycle-discipline` | 2a | 41 | per-event | 0 | `none` | undeclared | yes | 1 |
| `question-not-instruction` | 1 | 32 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `recurring-criticism` | 2b | — | per-task | 1 | `none` | declared-gap | yes | 0 |
| `reviewer-awareness` | 2a | 20 | per-commit | 0 | `none` | undeclared | yes | 2 |
| `roadmap-ci-steps-policy` | 2a | 41 | per-edit | 0 | `none` | undeclared | yes | 1 |
| `roadmap-progress-sync` | 1 | 26 | per-edit | 1 | `observer` | observer | yes | 3 |
| `role-mode-adherence` | 2a | 23 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `rule-type-governance` | 2a | 17 | per-edit | 0 | `none` | undeclared | yes | 1 |
| `runtime-safety` | 2b | 32 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `scale-discipline` | 2a | 41 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `scope-control` | safety-floor | — | — | 0 | `none` | undeclared | no | 4 |
| `secret-vcs-guard` | 2a | 43 | per-edit | 1 | `validator` | gate | yes | 0 |
| `security-sensitive-stop` | 2a | 36 | per-edit | 1 | `none` | declared-gap | yes | 0 |
| `self-repair-loop` | 2a | 28 | per-turn | 1 | `observer` | observer | yes | 0 |
| `senior-engineering-discipline` | 2b | 69 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `session-canary` | 2a | 31 | per-task | 1 | `observer` | observer | yes | 5 |
| `settings-ask-protocol` | 2a | 39 | per-task | 1 | `none` | declared-gap | yes | 0 |
| `size-enforcement` | mechanical-already | 21 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `skill-improvement-trigger` | 2a | 17 | per-task | 0 | `none` | undeclared | yes | 1 |
| `skill-quality` | mechanical-already | 14 | per-edit | 1 | `validator` | gate | yes | 1 |
| `slash-command-routing-policy` | 1 | 18 | per-turn | 0 | `none` | undeclared | yes | 1 |
| `source-confidentiality` | mechanical-already | 46 | per-edit | 1 | `validator` | gate | yes | 0 |
| `source-discovery-gate` | 2b | 44 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `source-of-truth` | 1 | 44 | per-edit | 1 | `validator` | gate | yes | 0 |
| `spreadsheet-source-quality` | 2a | 49 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `strategy-safety-floor` | 2a | 55 | per-task | 0 | `none` | undeclared | yes | 0 |
| `symfony-routing` | 3 | 23 | none | 0 | `none` | undeclared | no | 1 |
| `telegraph-speak` | 1 | 66 | per-turn | 1 | `observer` | observer | yes | 0 |
| `test-first` | 1 | — | per-edit | 1 | `none` | declared-gap | yes | 0 |
| `think-before-action` | 2b | 50 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `token-budget-discipline` | 2a | 43 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `token-efficiency` | 2a | 21 | per-edit | 0 | `none` | undeclared | yes | 0 |
| `token-optimizer-maintenance` | 2a | 29 | per-commit | 1 | `validator` | gate | yes | 0 |
| `tool-safety` | 2b | 19 | per-edit | 1 | `validator` | gate | yes | 0 |
| `ui-audit-gate` | 2b | 39 | per-edit | 1 | `observer` | observer | yes | 1 |
| `untrusted-input-defense` | 2a | 38 | per-event | 1 | `none` | declared-gap | yes | 1 |
| `upstream-proposal` | 2a | 17 | per-task | 0 | `none` | undeclared | yes | 1 |
| `user-interaction` | 3 | 40 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `user-interrupt-priority` | 2a | 38 | per-turn | 0 | `none` | undeclared | yes | 0 |
| `verify-before-complete` | 2a | — | — | 1 | `observer` | observer | no | 0 |

