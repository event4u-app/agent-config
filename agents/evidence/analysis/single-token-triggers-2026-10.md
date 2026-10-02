# One-token keyword triggers, against the routing-matrix corpus

<!-- evidence-type: analysis -->

> **Produced by:** `./scripts-run src/scripts/report_single_token_triggers --table`
> on `main` @ `01b4a2219`, 2026-10-02. Step 1.3 of
> `road-to-rule-triggers-and-links-that-hold`. Re-run the command to reproduce
> every row; `--all` prints all 341 keywords, `--json` the same data machine-readable.

## The question

A single common word — `rename`, `delete`, `commit` — is a legitimate trigger
for the rule that owns the subject and a standing cost on every prompt that
merely uses the word. This sizes that cost. **Report only:** a trigger change
is a separate decision per rule, and a common word can be exactly right.

## What the step expected, and what the corpus returned

The step predicted `rename` and `delete` (`augment-edit-discipline`) as the
first rows above a 5 % share of prompts labelled against another rule.

**Nothing is above 5 %.** The highest share in the corpus is **3.9 %**
(`commit`, `secret-vcs-guard`), and `rename` and `delete` score **0.0 %** on
that axis. That fires D3's own `revisit-if` — "the report's top rows are not
the known common words" — so the threshold is reported as a finding rather than
quietly lowered to produce rows.

The reason is the corpus, not the triggers. `tests/eval/routing-matrix/`
holds **335 positive prompts**, each written for the rule whose file it sits
in. A fixture author writing a prompt for `downstream-changes` does not reach
for `rename` by accident — they write the prompt that rule should match. A
curated per-rule corpus is close to the worst possible instrument for measuring
accidental cross-firing, because accident is the one thing it has no supply of.

## The axis the corpus does answer

The same files carry **253 near-misses** — prompts a rule's fixture declares it
must NOT match. Those are ordinary developer sentences that belong to no rule,
which is exactly the population a common-word trigger over-fires on. Measuring
there turns the expected row up immediately:

| | Foreign positives | Foreign near-misses |
|---|---:|---:|
| `rename` (`augment-edit-discipline`) | 0 / 332 | **7** |
| `commit` (`secret-vcs-guard`) | 13 / 332 | 5 |
| `commit` (`commit-conventions`) | 12 / 332 | 5 |
| `fix` (`think-before-action`) | 8 / 332 | 5 |
| `invoice` (`domain-safety-pii`) | 4 / 332 | 5 |

`rename` is the single highest near-miss row in the corpus — the step's
prediction was right about the word and wrong about where it would show up.
Every occurrence of "Rename" in the matrix sits in a `near_misses` block: a
rename of a class, of a variable, of a test. That is the finding, and it is a
sharper one than a share would have been.

**79 of 341 one-token keywords hit at least one foreign near-miss.** The other
262 hit nothing on either axis — 249 of them hit nothing at all.

## What is NOT wrong

**No rule's one-token keyword fires on a near-miss its own fixture declares.**
Zero rows, out of 341 keywords. A rule saying "this prompt must not match me"
while carrying a keyword that matches it would be a contradiction visible in
the fixtures, and there is none. Whatever the cost of a common-word trigger is,
it is not that.

## How to read a row before acting on it

A high near-miss count is a question, not a verdict. `rename` scoring 7 means
`augment-edit-discipline` would be delivered on seven prompts about renaming
things that have nothing to do with portability — and also that it WOULD be
delivered on the one prompt where somebody renames a skill and forgets the
cross-references, which is the rule's reason to exist. The report deliberately
does not net those against each other: the trade is per rule, and the rule's
author is the one who knows which side is worth more.

Two bounds worth stating before anyone treats a number here as a rate:

- **335 + 253 prompts is a small corpus**, frozen, and curated per rule. A
  share computed on it is not a share of real traffic.
- **A near-miss is labelled against ONE rule**, not against all of them. It is
  evidence that the prompt is ordinary, not proof that no rule should fire.

## Method

Corpus: every `prompt` under `tests/eval/routing-matrix/*.yaml`, labelled with
its file's rule and its kind. Keywords: every `- keyword:` in a
`src/rules/*.md` frontmatter whose value contains no whitespace. A keyword
"occurs" when it appears at a Unicode word boundary, case-insensitively.

The share denominator is foreign **positives** only. Mixing near-misses into it
would conflate "belongs to another rule" with "belongs to no rule" — two
different claims, and only the first is what the step asked about. Both are
reported, in separate columns, for that reason.

## Per keyword — every row reportable on either axis

| Rule | Keyword | Foreign positives | Share | Own near-miss hits | Foreign near-miss hits | Mostly labelled against |
|---|---|---:|---:|---:|---:|---|
| `secret-vcs-guard` | `commit` | 13/332 | 3.9 % | 0/2 | 5 | `no-attribution-footers` 3, `commit-conventions` 2, `no-decorative-emojis-in-git-surfaces` 2, `slash-command-routing-policy` 2, `copilot-routing` 1 |
| `commit-conventions` | `commit` | 12/332 | 3.6 % | 0/2 | 5 | `no-attribution-footers` 3, `no-decorative-emojis-in-git-surfaces` 2, `slash-command-routing-policy` 2, `copilot-routing` 1, `council-availability` 1 |
| `think-before-action` | `fix` | 8/332 | 2.4 % | 0/2 | 5 | `minimal-safe-diff` 2, `php-coding` 2, `downstream-changes` 1, `no-pr-progress-comments` 1, `source-of-truth` 1 |
| `minimal-safe-diff` | `fix` | 7/332 | 2.1 % | 0/2 | 5 | `php-coding` 2, `downstream-changes` 1, `no-pr-progress-comments` 1, `source-of-truth` 1, `test-first` 1 |
| `broken-access-control` | `endpoint` | 7/332 | 2.1 % | 0/2 | 4 | `security-sensitive-stop` 2, `design-review-after-ui-write` 1, `laravel-routing` 1, `scale-discipline` 1, `senior-engineering-discipline` 1 |
| `commit-conventions` | `branch` | 7/332 | 2.1 % | 0/2 | 4 | `code-comment-discipline` 1, `evaluator-independence` 1, `fix-what-you-see` 1, `git-history-discipline` 1, `minimal-safe-diff` 1 |
| `senior-engineering-discipline` | `endpoint` | 7/332 | 2.1 % | 0/2 | 4 | `security-sensitive-stop` 2, `broken-access-control` 1, `design-review-after-ui-write` 1, `laravel-routing` 1, `scale-discipline` 1 |
| `source-discovery-gate` | `endpoint` | 7/332 | 2.1 % | 0/6 | 4 | `security-sensitive-stop` 2, `broken-access-control` 1, `design-review-after-ui-write` 1, `laravel-routing` 1, `scale-discipline` 1 |
| `prefer-enums-over-literals` | `migration` | 7/332 | 2.1 % | 0/2 | 3 | `autonomous-execution` 1, `communication-through-line` 1, `engineering-safety-floor` 1, `improve-before-implement` 1, `missing-skill-recovery` 1 |
| `question-not-instruction` | `why` | 7/332 | 2.1 % | 0/2 | 2 | `fast-path-marker-visibility` 1, `framework-neutrality-in-generic-skills` 1, `laravel-translations` 1, `notes-first-reasoning` 1, `onboarding-gate` 1 |
| `broken-access-control` | `session` | 6/332 | 1.8 % | 0/2 | 4 | `autonomous-execution` 1, `context-hygiene` 1, `model-recommendation` 1, `notes-first-reasoning` 1, `role-mode-adherence` 1 |
| `architecture` | `module` | 6/332 | 1.8 % | 0/2 | 3 | `active-remediation` 1, `improve-before-implement` 1, `linked-projects-onboarding-gate` 1, `minimal-safe-diff` 1, `reviewer-awareness` 1 |
| `engineering-safety-floor` | `migration` | 6/332 | 1.8 % | 0/2 | 3 | `autonomous-execution` 1, `communication-through-line` 1, `improve-before-implement` 1, `missing-skill-recovery` 1, `scale-discipline` 1 |
| `improve-before-implement` | `migration` | 6/332 | 1.8 % | 0/7 | 3 | `autonomous-execution` 1, `communication-through-line` 1, `engineering-safety-floor` 1, `missing-skill-recovery` 1, `scale-discipline` 1 |
| `scale-discipline` | `migration` | 6/332 | 1.8 % | 0/2 | 3 | `autonomous-execution` 1, `communication-through-line` 1, `engineering-safety-floor` 1, `improve-before-implement` 1, `missing-skill-recovery` 1 |
| `senior-engineering-discipline` | `migration` | 6/332 | 1.8 % | 0/2 | 3 | `autonomous-execution` 1, `communication-through-line` 1, `engineering-safety-floor` 1, `improve-before-implement` 1, `missing-skill-recovery` 1 |
| `code-comment-discipline` | `refactor` | 6/332 | 1.8 % | 0/2 | 1 | `active-remediation` 1, `design-review-after-ui-write` 1, `improve-before-implement` 1, `no-decorative-emojis-in-git-surfaces` 1, `php-coding` 1 |
| `senior-engineering-discipline` | `refactor` | 6/332 | 1.8 % | 0/2 | 1 | `active-remediation` 1, `design-review-after-ui-write` 1, `improve-before-implement` 1, `no-decorative-emojis-in-git-surfaces` 1, `php-coding` 1 |
| `cli-output-handling` | `git` | 5/332 | 1.5 % | 0/2 | 2 | `no-decorative-emojis-in-git-surfaces` 2, `secret-vcs-guard` 2, `git-history-discipline` 1 |
| `code-comment-discipline` | `implement` | 5/332 | 1.5 % | 0/2 | 2 | `artifact-engagement-recording` 1, `improve-before-implement` 1, `question-not-instruction` 1, `senior-engineering-discipline` 1, `think-before-action` 1 |
| `active-remediation` | `refactor` | 5/332 | 1.5 % | 0/2 | 1 | `design-review-after-ui-write` 1, `improve-before-implement` 1, `no-decorative-emojis-in-git-surfaces` 1, `php-coding` 1, `think-before-action` 1 |
| `improve-before-implement` | `refactor` | 5/332 | 1.5 % | 0/7 | 1 | `active-remediation` 1, `design-review-after-ui-write` 1, `no-decorative-emojis-in-git-surfaces` 1, `php-coding` 1, `think-before-action` 1 |
| `think-before-action` | `refactor` | 5/332 | 1.5 % | 0/2 | 1 | `active-remediation` 1, `design-review-after-ui-write` 1, `improve-before-implement` 1, `no-decorative-emojis-in-git-surfaces` 1, `php-coding` 1 |
| `domain-safety-pii` | `invoice` | 4/332 | 1.2 % | 0/2 | 5 | `active-remediation` 1, `architecture` 1, `minimal-safe-diff` 1, `symfony-routing` 1 |
| `invite-challenge` | `design` | 4/332 | 1.2 % | 0/2 | 4 | `council-availability` 1, `design-fidelity` 1, `image-likeness-and-rights` 1, `token-budget-discipline` 1 |
| `senior-engineering-discipline` | `component` | 4/332 | 1.2 % | 0/2 | 3 | `design-review-after-ui-write` 1, `output-discipline` 1, `playbook-precedence` 1, `ui-audit-gate` 1 |
| `code-comment-discipline` | `class` | 4/332 | 1.2 % | 0/2 | 2 | `architecture` 1, `output-discipline` 1, `php-coding` 1, `question-not-instruction` 1 |
| `council-availability` | `council` | 4/332 | 1.2 % | 0/2 | 2 | `decision-revisit-gate` 3, `fast-path-marker-visibility` 1 |
| `cross-source-consistency` | `roadmap` | 4/332 | 1.2 % | 0/2 | 2 | `council-availability` 1, `question-not-instruction` 1, `roadmap-progress-sync` 1, `user-interrupt-priority` 1 |
| `improve-before-implement` | `implement` | 4/332 | 1.2 % | 0/7 | 2 | `artifact-engagement-recording` 1, `question-not-instruction` 1, `senior-engineering-discipline` 1, `think-before-action` 1 |
| `senior-engineering-discipline` | `implement` | 4/332 | 1.2 % | 0/2 | 2 | `artifact-engagement-recording` 1, `improve-before-implement` 1, `question-not-instruction` 1, `think-before-action` 1 |
| `think-before-action` | `implement` | 4/332 | 1.2 % | 0/2 | 2 | `artifact-engagement-recording` 1, `improve-before-implement` 1, `question-not-instruction` 1, `senior-engineering-discipline` 1 |
| `invite-challenge` | `plan` | 4/332 | 1.2 % | 0/2 | 1 | `design-review-after-ui-write` 1, `roadmap-ci-steps-policy` 1, `roadmap-progress-sync` 1, `security-sensitive-stop` 1 |
| `architecture` | `service` | 3/332 | 0.9 % | 0/2 | 5 | `domain-safety-disclaimer` 1, `downstream-changes` 1, `invite-challenge` 1 |
| `cross-source-consistency` | `ticket` | 3/332 | 0.9 % | 0/2 | 2 | `artifact-engagement-recording` 1, `design-review-after-ui-write` 1, `domain-safety-pii` 1 |
| `code-comment-discipline` | `comment` | 3/332 | 0.9 % | 0/2 | 1 | `no-pr-progress-comments` 3 |
| `scale-discipline` | `queue` | 3/332 | 0.9 % | 0/2 | 1 | `notes-first-reasoning` 1, `self-repair-loop` 1, `user-interaction` 1 |
| `scale-discipline` | `schema` | 3/332 | 0.9 % | 0/2 | 1 | `source-discovery-gate` 2, `engineering-safety-floor` 1 |
| `domain-safety-pii` | `log` | 2/332 | 0.6 % | 0/2 | 2 | `history-discipline` 1, `scale-discipline` 1 |
| `reviewer-awareness` | `reviewer` | 2/332 | 0.6 % | 0/2 | 2 | `no-pr-progress-comments` 1, `role-mode-adherence` 1 |
| `scale-discipline` | `job` | 2/332 | 0.6 % | 0/2 | 2 | `fix-what-you-see` 1, `laravel-routing` 1 |
| `fix-what-you-see` | `broken` | 2/332 | 0.6 % | 0/2 | 1 | `downstream-changes` 1, `minimal-safe-diff` 1 |
| `fix-what-you-see` | `failing` | 2/332 | 0.6 % | 0/2 | 1 | `cli-output-handling` 1, `test-first` 1 |
| `prefer-enums-over-literals` | `status` | 2/332 | 0.6 % | 0/2 | 1 | `no-pr-progress-comments` 1, `security-sensitive-stop` 1 |
| `security-sensitive-stop` | `billing` | 1/328 | 0.3 % | 0/6 | 2 | `model-recommendation` 1 |
| `scale-discipline` | `index` | 1/332 | 0.3 % | 0/2 | 2 | `external-code-graph-interop` 1 |
| `broken-access-control` | `route` | 1/332 | 0.3 % | 0/2 | 1 | `playbook-precedence` 1 |
| `cli-output-handling` | `docker` | 1/332 | 0.3 % | 0/2 | 1 | `docker-commands` 1 |
| `code-comment-discipline` | `method` | 1/332 | 0.3 % | 0/2 | 1 | `external-code-graph-interop` 1 |
| `history-discipline` | `audit` | 1/332 | 0.3 % | 0/2 | 1 | `scale-discipline` 1 |
| `provider-lifecycle-discipline` | `adapter` | 1/332 | 0.3 % | 0/2 | 1 | `image-likeness-and-rights` 1 |
| `secret-vcs-guard` | `password` | 1/332 | 0.3 % | 0/2 | 1 | `security-sensitive-stop` 1 |
| `secret-vcs-guard` | `push` | 1/332 | 0.3 % | 0/2 | 1 | `git-history-discipline` 1 |
| `secret-vcs-guard` | `token` | 1/332 | 0.3 % | 0/2 | 1 | `token-optimizer-maintenance` 1 |
| `source-discovery-gate` | `schema` | 1/332 | 0.3 % | 0/6 | 1 | `engineering-safety-floor` 1 |
| `augment-edit-discipline` | `rename` | 0/332 | 0.0 % | 0/2 | 7 | — |
| `history-discipline` | `changelog` | 0/332 | 0.0 % | 0/2 | 3 | — |
| `invite-challenge` | `architecture` | 0/332 | 0.0 % | 0/2 | 3 | — |
| `history-discipline` | `history` | 0/332 | 0.0 % | 0/2 | 2 | — |
| `laravel-routing` | `laravel` | 0/332 | 0.0 % | 0/6 | 2 | — |
| `security-sensitive-stop` | `auth` | 0/328 | 0.0 % | 0/6 | 2 | — |
| `senior-engineering-discipline` | `seeder` | 0/332 | 0.0 % | 0/2 | 2 | — |
| `active-remediation` | `cleanup` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `analysis-skill-routing` | `analysis` | 0/335 | 0.0 % | 0/0 | 1 | — |
| `cli-output-handling` | `phpunit` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `cross-source-consistency` | `refine` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `delegation-policy` | `parallel` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `docker-commands` | `docker` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `downstream-changes` | `imports` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `guidelines` | `convention` | 0/335 | 0.0 % | 0/0 | 1 | — |
| `image-likeness-and-rights` | `logo` | 0/331 | 0.0 % | 0/2 | 1 | — |
| `legal-safety-floor` | `GDPR` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `runtime-safety` | `handler` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `secret-vcs-guard` | `secret` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `senior-engineering-discipline` | `dependency` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `senior-engineering-discipline` | `query` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `skill-improvement-trigger` | `pipeline` | 0/332 | 0.0 % | 0/2 | 1 | — |
| `symfony-routing` | `symfony` | 0/332 | 0.0 % | 0/6 | 1 | — |
| `user-interaction` | `recommendation` | 0/332 | 0.0 % | 0/2 | 1 | — |

