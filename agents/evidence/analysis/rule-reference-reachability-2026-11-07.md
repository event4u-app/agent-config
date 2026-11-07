<!-- evidence-type: analysis -->

# Rule-reference reachability — the 17 and the 10

Step 2.4 of `road-to-a-reference-that-arrives-before-the-act`. Input:
`task report-rule-requires -- --json` at `7396b514ec`: 20 rules carry
`load_context`, 3 are reached by an act (`design-fidelity`, `source-of-truth`,
`user-interrupt-priority`, all references within budget), **17 are reached by no
act**, and **10 references exceed the 8,000-char inject budget** — all 10 belong to
the 17.

Hook rows cite `src/scripts/hook_manifest.yaml` at the concern's line; `severity`
is what the manifest states, never what the concern's name suggests.

## The 17 rules reached by no act

| Rule | Frontmatter (`src/rules/<rule>.md`) | Disposition | Rests on |
|---|---|---|---|
| `artifact-engagement-recording` | auto · per-task | **needs an act trigger** — `command: implement-ticket` / `work` (the kind exists) | the rule names those two commands as its occasion |
| `autonomous-execution` | auto · per-turn · authority-bypass | **prompt-only by design** — a disposition about asking vs acting | no tool call shows the obligation |
| `command-suggestion-policy` | auto · per-turn · authority-bypass | **prompt-only by design** — routes a user prompt | `skill-route` concern, `hook_manifest.yaml:1072` (advisory) |
| `commit-policy` | always | **needs an act trigger of a kind that does not exist** — shell command `git commit`; partly covered | `git-authorization`, `hook_manifest.yaml:768` (advisory, verification) |
| `decision-revisit-gate` | auto · per-task · authority-bypass · instruction-only | **prompt-only by design** | its own `enforced_by`: no gate can observe a decision it never opened |
| `delegation-policy` | auto · per-task | **covered by a carrier** | `delegation-nudge`, `hook_manifest.yaml:1048` (advisory) |
| `guidelines` | manual · per-edit | **needs an act trigger** — `path_prefix: docs/guidelines/` | manual rule; its reference is read on demand |
| `model-recommendation` | auto · per-task | **prompt-only by design** — routing of the turn | no tool call shows it |
| `non-destructive-by-default` | always · enforced_by none | **needs an act trigger of a kind that does not exist** — shell `git push`, `rm -rf`, `DROP`; partly gated | `block-no-verify`, `hook_manifest.yaml:213` (blocking) covers one flag only |
| `notes-first-reasoning` | auto · per-turn | **prompt-only by design** — reasoning disposition | no tool call shows it |
| `scope-control` | always | **needs an act trigger of a kind that does not exist** — shell `git checkout -b`, `gh pr create`; partly covered | `git-authorization`, `hook_manifest.yaml:768` (advisory) |
| `session-canary` | auto · per-task · authority-bypass · hook | **covered by a gate** | `session-canary`, `hook_manifest.yaml:823` |
| `source-discovery-gate` | auto · per-edit | **covered by a carrier, observe-only** | `source-first-gate`, `hook_manifest.yaml:1619` (advisory, telemetry) |
| `think-before-action` | auto · per-edit | **prompt-only by design** — analysis disposition | no tool call shows it |
| `token-efficiency` | auto · per-edit | **covered by carriers** | `chain-nudge` `:543` (advisory), `reread-guard` `:1316` |
| `user-interaction` | auto · per-turn | **covered by gates** | `one-question-per-ask` `:283` (blocking, permission); `turn-end-gate` `:1255` pending-decision detector |
| `verify-before-complete` | always · hook | **covered by gates** | `verify-before-complete` `:146` (advisory); `turn-end-gate` `:1255` |

**Tally:** prompt-only by design 6 · covered by a gate or carrier 6 · needs an act
trigger 5 — of which 2 use a kind that exists (`command`, `path_prefix`) and **3 need
a shell-command trigger kind that does not exist** (`commit-policy`,
`non-destructive-by-default`, `scope-control`). Those three are `always` rules today,
so nothing is lost now; they are the three that could not leave the always-loaded
layer without that kind.

## The 10 references over the 8,000-char budget

| Reference (`src/agent-src/`) | Chars | Rule | Disposition |
|---|---:|---|---|
| `contexts/execution/auto-dispatch-classification.md` | 16,193 | `delegation-policy` | **read-on-demand** — classification table looked up, not injected |
| `contexts/communication/rules-auto/token-efficiency-mechanics.md` | 15,906 | `token-efficiency` | **split** — the measured-evidence half is not needed at the act |
| `contexts/execution/autonomy-mechanics.md` | 15,762 | `autonomous-execution` | **read-on-demand** — prompt-only rule, no act to inject at |
| `contexts/execution/project-intelligence.md` | 15,130 | `source-discovery-gate` | **read-on-demand** — model reference |
| `contexts/communication/rules-auto/user-interaction-mechanics.md` | 13,923 | `user-interaction` | **law line plus pointer** — the gate message carries the format |
| `contexts/authority/scope-mechanics.md` | 12,661 | `scope-control` | **split** — the git-ops half is what a shell-command trigger would carry |
| `contexts/contracts/artifact-engagement-flow.md` | 10,999 | `artifact-engagement-recording` | **split** — only the recording cadence is needed at the command |
| `contexts/execution/evidence-discipline.md` | 10,373 | `source-discovery-gate` | **read-on-demand** |
| `contexts/model-recommendations.md` | 9,251 | `model-recommendation` | **read-on-demand** — prompt-only rule |
| `contexts/contracts/command-suggestion-flow.md` | 9,022 | `command-suggestion-policy` | **read-on-demand** — prompt-only rule |

**Tally:** read-on-demand 6 · split 3 · law line plus pointer 1. A split is only
worth doing for a reference whose rule gets an act trigger; the three splits line up
with the trigger findings above.

## What follows

- The shell-command trigger kind is the one new mechanism the reference duty needs,
  and it belongs to action-time delivery: `road-to-mixed-trigger-activation-cost`
  step 2.3.
- `artifact-engagement-recording` and `guidelines` can take an act trigger of an
  existing kind today; that is a rule-frontmatter change with its own trigger eval.
