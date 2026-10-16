---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-typed-grants-that-persist
    relation: extends
    note: "Owns the grant object, the ledger (3.1), the gate that reads it (4.3), the Hard Floor push-row narrowing (1.1) and the undecided kernel-deny crossing (blocker kernel-guard-first-crossing, K7). This roadmap builds none of those. Its typed-op ask (4.5) waits for 3.1, and its kernel-guard migration (1.9) waits for that blocker."
  - slug: later/road-to-adversarial-verification-and-long-runs
    relation: extends
    note: "Its 7.1 names four layers and landed only the observation-only watch (_lib/typed_op_watch.ts). This roadmap builds the host-hook layer it names. The daemon, its kill switch, the 30-session bar and the owed kernel enforced_by edit (7.2) stay there; Phase 5 here feeds that bar."
  - slug: road-to-self-modification-that-a-council-must-pass
    relation: disjoint
    note: "Builds the ratification review; it states the kernel deny is not retired, bypassed or cited as retirable (:508). Nothing here touches the ratification path, and 1.9 keeps the kernel guard off the shared segmenter until the owner crossing is decided."
  - slug: road-to-a-danger-gate-that-sees-what-governs
    relation: disjoint
    note: "Owns the PR-diff classifier and its base-revision run (2.1). This roadmap classifies a command before it runs, never a diff after it lands; the two share no object and are not merged."
  - slug: road-to-authorization-that-reaches-further
    relation: extends
    note: "Archived. Its 1.1 shipped the category-A allow, and its Risk 1 named the mitigation 'allow only inside the working tree with no consequence operation matched'. The Bash branch never received the working-tree half; Phase 0 here builds it."
estate_offset_exempt: "Adds one active roadmap with nothing to offset: the host-hook layer later/road-to-adversarial-verification-and-long-runs 7.1 names was never built and no active roadmap owns a pre_tool_use destructive-command concern, the category-A Bash confinement, or the shared shell segmenter; the two nearest active roadmaps (typed-grants, danger-gate) own the grant ledger and the PR-diff classifier and are related rather than offset."
---

# Road to a Hard Floor the shell cannot talk past

> **Source:** `agents/tmp.old/inbox-2026-10-m/` — a maintainer transcript asking for an
> in-depth comparison against an external command-string guard for coding agents, three
> challenge loops and a roadmap, plus the two three-loop plans it produced on two hosts and
> a provenance annex that is not quoted here. Drafted against `main@a17bd4aa2`; re-verified
> at `main@17f028941` on 2026-10-12. No guard file changed between the two (the six commits
> in the window touch the SVG engine, `verification_command.ts`, `verify_clause.ts`,
> `design_pass_hook.ts` and `turn_end_gate_hook.ts`). Every *(executed)* reading below was
> re-run offline under `tsx` against the tree's own exported functions.

## Goal

The one floor the owner kept — irreversible, external, production and out-of-scope
destructive actions — gets a mechanism at tool-call time on the host that can refuse
(`claude`). It adds **zero prompts on reversible work** (ADR-260 § 2 decision 11). Local
destruction inside the task becomes **recoverable by construction** instead of asked about.
And the existing category-A allow stops granting, without a prompt, commands it cannot
prove are harmless.

One sentence: **refuse less, prove more, and make what is allowed undoable.**

## Reproduced at `main@17f028941`

| D | Defect | Evidence |
|---|---|---|
| D1 | The Hard Floor has no mechanism. `non-destructive-by-default` declares `enforced_by: "none"`; none of the 17 `pre_tool_use` concerns on `claude` recognises a destructive command or a typed op. | `src/rules/non-destructive-by-default.md:10-11`; `src/scripts/hook_manifest.yaml:1607` |
| D2 | **Category A emits `permissionDecision: allow` for commands it has not proven harmless**, removing the host's own confirmation. *(executed through `_permission_for`, all `allow`)*: `git branch -D main`, `git branch -f main HEAD~20`, `git branch -M main old`, `cat ~/.ssh/id_rsa`, `find / -name x`, `sort -o /home/u/.bashrc /dev/null`, `git diff --output=/home/u/.bashrc`, `prettier --write /etc/hosts`. Causes: `branch` is a read subcommand; the Bash branch has no working-tree confinement (the read-tool branch has one); output-writing flags are not consequence words. The emitted reason says "inside the working tree" for every one of them. | `src/scripts/hooks/category_a.ts:79-82`, `:89-98`, `:276-288`; `src/scripts/hooks/permission_gate.ts:97-116` |
| D3 | `npm\|pnpm\|yarn run <name>`, `composer run-script <name>` and `make <target>` are category A by **name** (`build`, `test`, …); the body is never read. | `category_a.ts:113-116`, `:125-128`, `:254-256` |
| D4 | Five splitters, partly shared, no common segment model: whitespace split (`_lib/shell_write_shapes.ts:45`, `category_a.ts:152-153`); a POSIX-shlex port (`block_no_verify.ts:112`); a regex fallback (`block_no_verify.ts:410`); and the quote-aware segmenter with `sh -c` unwrapping and heredoc stripping (`git_command_classifier.ts:469`, `:569`, `:634`), already reused by `block_speaking_inbox_dir.ts:71` and, for `substitutionPayloads`, by `block_no_verify.ts:37`. | as cited |
| D5 | `block-kernel-rule-writes` is bypassed by prefixes, glued separators, interpreters, non-last destinations and `cd`. *(executed)* `rm P` → deny; `sudo rm P`, `true;rm P`, `python3 -c "open('P','w')"`, `mv /tmp/x P && true`, `cd src/rules && rm commit-policy.md` → allow. | `block_kernel_rule_writes.ts:169-198`; `_lib/shell_write_shapes.ts:45` |
| D6 | `block-no-verify` is bypassed by wrappers, `bash -c`, an abbreviated long flag and an environment hook switch. *(executed)* `git commit --no-verify` → deny; `sudo git commit --no-verify`, `bash -c 'git commit --no-verify'`, `git commit --no-verif`, `HUSKY=0 git commit -m x` → allow. | `block_no_verify.ts:330`, `:516` |
| D7 | Three op vocabularies for one floor: ADR-260 § 2 / ADR-268 § 1 name eleven typed ops; `typed_op_watch.ts` names a different eleven; the classifier carries 22 BLOCK and 11 WARN ops in a third spelling *(executed: sizes 22 / 11)*, the `GitOp` union it shares with the advisory ledger's `ALL_OPS`. | `docs/decisions/ADR-268-*.md:141-147`; `src/scripts/_lib/typed_op_watch.ts:31-43`; `git_command_classifier.ts:86-159` |
| D8 | The classifier is blind to common worktree-destroying commands. *(executed, `commandOp` → `null`)*: `rm -rf src`, `git checkout -- .`, `git restore .`, `docker system prune -af`, `php artisan migrate:fresh`. It sees `git reset --hard`, `git push --force`, `rm -rf ~/`. | `git_command_classifier.ts:690` |
| D9 | The watch cannot tell data from execution and says so — the false-positive source its own `< 1 %` bar must beat. | `typed_op_watch.ts:20-24` |
| D10 | Block telemetry keeps per-concern counters, never the command or the reason, so a false-positive rate cannot be computed from it. | `src/scripts/hooks/dispatch_hook.ts:915-980` |
| D11 | `block-config-weakening` inspects Edit/Write only; a Bash write to `.claude/settings.json` is not inspected. | `src/scripts/hooks/block_config_weakening.ts:596-599` |
| D12 | The trampoline exits `0` when neither node nor the CLI resolves (contracted at `docs/contracts/hook-architecture-v1.md:1079`); no hook entry sets a `timeout`. | `hooks/hooks.json:63-68`; `grep -c '"timeout"' hooks/hooks.json` → 0 |
| D13 | Surfaces overclaim. README says the safety floor "ships in **every** profile"; `docs/enforcement-by-host.md` marks `claude` as `destructive: hook`, which measures the binding, while no bound concern recognises a typed op (D1). | `README.md:282`; `docs/enforcement-by-host.md:417` |
| D14 | The live hook probe on the second CLI host used stderr plus exit 2 and the call was not refused; whether that host refuses only on a structured deny on stdout is not recorded. | `src/scripts/hooks/host_lowering.yaml:364-377` |

**Already in place — do not rebuild:** the quote-aware segmenter (`git_command_classifier.ts:469`,
`:634`); crash-to-BLOCK for blocking concerns (`src/scripts/hooks/concern_failure_policy.ts`);
read-only trampoline reporting (`src/scripts/hooks_doctor.ts`); the observation-only watch and
its refusal-on-absent-artefact unlock (`typed_op_watch.ts:138`); the council-may-veto-never-grant
asymmetry (`src/scripts/_lib/typed_op_grant.ts`); `docs/contracts/audit-log-v1.md` and its
compile-time privacy floor; the per-host destructive column (`docs/enforcement-by-host.md:396`);
report-not-write host permission checks (`src/scripts/_lib/host_permission_checks.ts`); the
`pre_tool_use` latency budget, p95 175 ms on CI (`src/config/hook-latency-budget.json`); the
private recovery-ref namespace precedent `refs/agent-config/rewrites/` (archived
`road-to-a-rebase-that-leaves-a-way-back` 2.2).

**Measured headroom that bounds this work:** the composed hook bundle is 1,540,885 B against a
1,550,000 B ceiling, 293 modules (`check_hook_bundle_composition`, 2026-10-12) — 9,115 B.

## Design principles

1. **Consequence, not command name** (ADR-268 § 6). Recognisers are grouped by what they
   destroy. A new tool is a new recogniser under an existing class, never a new class.
2. **A refusal is not a question.** The guard never authors a human gate (ADR-262). It votes
   allow, allow-with-snapshot, deny-with-alternative, or nothing.
3. **Recoverable beats refused.** Where a ref can be kept, keep it and let the command run —
   the *recoverable* leg of ADR-268 § 6's evidence triple, produced mechanically.
4. **Unknown is a verdict, not an allow** — only where a typed op or an unrecoverable class is
   in play. A dynamic payload feeding a shell sink near such a recogniser is `unverified`,
   with a stable reason id.
5. **One segmenter, one vocabulary.** No sixth parser, no fourth op list.
6. **Guardrail, not boundary.** Every surface says so. The OS sandbox is the boundary; this
   package reports its posture and never writes it.

## What this roadmap is NOT

- Not a port of the external guard's rule packs, code, regexes, corpus or binary, and not a
  benchmark or differential test against it (K2).
- Not the grant object, the grant ledger, the CI grant gate or the push-row narrowing
  (`road-to-typed-grants-that-persist` 1.1, 3.1, 4.3).
- Not per-host protocol work beyond handing D14 over as evidence (7.4).
- Not daemon enforcement (later K5) and not a new CLI verb (ADR-041).
- Not a PR-diff classifier change — `classify_merge_risk.ts` stays the danger gate's.

## Phase 0 — Category A stops granting what it cannot prove

Lands alone, first, as its own PR. It withdraws the allow **only** from irreversible forms and
from targets outside the working tree. Reversible in-tree forms keep their allow, so this phase
adds no prompt — neither an agent question nor a host prompt — on reversible work.

- [ ] **0.1 `git branch` keeps its allow except where it loses a ref.** Not category A: `-d`,
      `-D`, `--delete`, `-f`/`--force`, `-M`, `-C`, and `-m`/`--move` onto an existing name.
      Still category A: list forms and creating a new branch.
      verify: `npx vitest run tests/hooks/permission_decision.test.ts --reporter=verbose` -> /✓.*branch-loses-a-ref/
- [ ] **0.2 Bash path arguments get the read tools' confinement.** Every path-shaped argument
      (absolute, `~`, `..`-escaping, or `--flag=<path>`) must resolve inside the working tree
      through the same `isInsideWorkingTree` the read branch uses (`category_a.ts:143`, `:276-282`).
      verify: `npx vitest run tests/hooks/permission_decision.test.ts --reporter=verbose` -> /✓.*bash-path-confinement/
- [ ] **0.3 Output-writing flags count as paths.** A closed list per safe head: `--output`,
      `--output-directory` (git), `-o` (sort), `-fprint`/`-fprintf`/`-fls` (find), `--write`/`-w`
      (prettier, biome), `--fix` (eslint, stylelint, ruff, rubocop), `--outDir`/`--outFile` (tsc),
      as tokens and as `--flag=value`. Their target goes through 0.2; inside the tree the command
      stays category A.
      verify: `npx vitest run tests/hooks/permission_decision.test.ts --reporter=verbose` -> /✓.*output-flags-are-paths/
- [ ] **0.4 The allow says what it checked.** The reason string at `permission_gate.ts:112-114`
      names the confinement only when 0.2 actually ran for that call.
      verify: `npx vitest run tests/hooks/permission_decision.test.ts --reporter=verbose` -> /✓.*reason-names-what-was-checked/
- [ ] **0.5 Rows, both polarities, and sensitivity.** Every D2 row lands as a `false` case and
      `git branch`, `git branch -a`, `git branch new`, `cat src/x.ts`, `prettier --write src`,
      `eslint --fix .` as `true` cases; reverting each of 0.1–0.3 reds its own rows.
      verify: `npx vitest run tests/hooks/permission_decision.test.ts` -> 0

D3 (names standing in for bodies) closes in 2.4, behind the segmenter: withdrawing the allow
before then would put a host prompt on every `npm run build`.

## Phase 1 — One segmenter

- [ ] **1.1 Promote the best parser to a shared module.** Move `splitOutsideQuotes`,
      `substitutionPayloads` and `invokedSegments` out of `git_command_classifier.ts` into
      `src/scripts/_lib/shell_segments.ts` <!-- ref-ignore --> with no behaviour change.
      verify: `npx vitest run tests/scripts/consequence_vocabulary.test.ts tests/scripts/git_auth_destructive_coverage.test.ts tests/scripts/git_auth_merge_ops.test.ts` -> 0
- [ ] **1.2 Give a segment a shape.** `{ argv0, argv, provenance: direct|inline|heredoc|substitution|pipe-consumer, cwd: literal|unknown, verified, reason? }`, `argv0` the resolved executable basename.
      verify: `npx vitest run tests/scripts/_lib/shell_segments.test.ts --reporter=verbose` -> /✓.*segment-shape-is-closed/ <!-- ref-ignore -->
- [ ] **1.3 Normalise what the shell normalises.** Closed and tested: wrappers (`sudo`, `doas`,
      `env [-i] [K=V…]`, `command`, `builtin`, `exec`, `nice`, `nohup`, `time`, `timeout <n>`,
      `stdbuf`, `xargs`, `\cmd`, absolute paths, `busybox <cmd>`); separators glued to words;
      `( … )` and `{ …; }`; `$IFS`/`${IFS}`; ANSI-C `$'\x72\x6d'` in executable position;
      leading `K=V`; `cd <literal> &&` carried as the segment's `cwd`.
      verify: `npx vitest run tests/scripts/_lib/shell_segments.test.ts --reporter=verbose` -> /✓.*wrapper-equivalence/ <!-- ref-ignore -->
- [ ] **1.4 Follow the payload, bounded.** `bash|sh|zsh|dash -c`, `eval`, heredoc to a shell,
      `| sh`, and `python -c`, `node -e`, `perl -e`, `ruby -e`, `php -r` — interpreter payloads
      yield only literal shell sinks and literal file writes with a literal path. Depth ≤ 4,
      segments ≤ 64, input ≤ 64 KiB; past a bound the segment is `verified: false`, reason
      `bound-exceeded`. The parser never executes, expands or spawns anything.
      verify: `npx vitest run tests/scripts/_lib/shell_segments.test.ts --reporter=verbose` -> /✓.*bound-exceeded-is-unverified/ <!-- ref-ignore -->
- [ ] **1.5 Data is not execution.** A closed table of data positions: `git commit -m|--message|-F`,
      `git tag -m`, `gh … --body|--title`, `grep`/`rg` patterns, `echo`/`printf` not piped to a
      shell, heredoc to `cat`/`tee` into a non-executed path. Ambiguous → executed.
      verify: `npx vitest run tests/scripts/_lib/shell_segments.test.ts --reporter=verbose` -> /✓.*data-spans-never-hit/ <!-- ref-ignore -->
- [ ] **1.6 Dynamic sinks are `unverified`, never silently allowed.** `bash -c "$X"`,
      `eval "$(…)"`, `curl … | sh`, `base64 -d | sh`, a non-literal `$(…)` in executable
      position. A static `X=rm; $X …` is resolved, not flagged.
      verify: `npx vitest run tests/scripts/_lib/shell_segments.test.ts --reporter=verbose` -> /✓.*dynamic-sink-is-unverified/ <!-- ref-ignore -->
- [ ] **1.7 Keyword quick-reject first.** A precomputed keyword set (every recogniser's
      executables and subcommands) is tested before segmenting; no hit, no parse.
      verify: `./scripts-run src/scripts/bench_hook_latency --gate` -> 0
- [ ] **1.8 Migrate the guards that may be hardened; delete their old parsers.**
      `block_no_verify`, `block_plumbing_writes`, `category_a._argv`, `typed_op_watch` and
      `block_speaking_inbox_dir` consume `shell_segments`. D6 closes as a byproduct. The shlex
      port and the regex fallback in `block_no_verify.ts` are deleted in the same PR, which is
      also what pays for the new module inside the bundle ceiling.
      verify: `./scripts-run src/scripts/check_hook_bundle_composition` -> 0
- [~] **1.9 The kernel guard moves onto the segmenter only after the owner crossing.**
      `block_kernel_rule_writes` and `_lib/shell_write_shapes.ts` stay as they are: hardening the
      kernel deny now pre-empts `road-to-typed-grants-that-persist` blocker
      `kernel-guard-first-crossing` and its K7 (one mechanism, not two). D5 stays recorded,
      not fixed, until that blocker resolves.

## Phase 2 — One vocabulary

- [ ] **2.1 One consequence table**, in `src/config/operation-consequence-classes.json` <!-- ref-ignore -->
      (JSON, so the hook bundle gains no YAML reader; named apart from the unrelated
      `src/config/rule-consequence-class.json`). Classes:
      - the eleven typed ops of ADR-260 § 2 (authority: grant, later);
      - the three WARN ops of ADR-268 § 6 (authority: evidence triple);
      - git-recoverable local loss: `worktree-content-loss`, `untracked-loss`, `stash-loss`,
        `ref-loss` (authority: snapshot, Phase 3);
      - `unrecoverable-local` — local database resets, container and volume prunes, `shred`
        (authority: none; recorded only — local dev resets are reversible work in ADR-260's sense);
      - `outside-tree-destruction` — destruction whose target resolves to `/`, `~` or a device
        (authority: blocker `outside-tree-destruction-reading`).
      Each row: id, authority, recognisers (executable + argv shape).
      verify: `grep -c "outside-tree-destruction" src/config/operation-consequence-classes.json` -> /^[1-9]/ <!-- ref-ignore -->
- [ ] **2.2 The classifier's BLOCK/WARN sets, `git_authorization_hook.ALL_OPS` (the ledger's
      spelling, pinned by `tests/scripts/consequence_vocabulary.test.ts`) and
      `typed_op_watch.TYPED_OPS` become projections of the table.** A check reds on a
      hand-written op string outside it; it is named apart from the existing authorization
      vocabulary test.
      verify: `./scripts-run src/scripts/check_operation_class_vocabulary` -> 0 <!-- ref-ignore -->
- [ ] **2.3 Close D8 by adding recognisers, not classes:** `git checkout -- <p>`, `git restore`
      (not `--staged` alone), `git clean`, `git stash drop|clear`, `git update-ref -d`,
      `git reflog expire`, `git filter-branch|filter-repo`, `rm -r` inside the tree,
      `find -delete`, `truncate`, framework resets (`migrate:fresh`, `migrate reset`, `db:drop`,
      `db:reset`), container and volume prune, `dd of=`, `mkfs*`, `shred`, `chmod|chown -R` on
      `/` or `~`.
      verify: `npx vitest run tests/scripts/_lib/consequence_classes.test.ts --reporter=verbose` -> /✓.*every-recogniser-one-class/ <!-- ref-ignore -->
- [ ] **2.4 Script bodies, not script names (D3).** For `npm|pnpm|yarn run <name>`,
      `composer run-script <name>` and `make <target>`, the body is read from the manifest or
      Makefile in the working tree and segmented. Category A when the body has no typed op, no
      `unverified` segment and no outside-tree target; in-tree local loss in the body stays
      allowed and takes the Phase 3 snapshot. An unreadable body keeps today's allow and is
      recorded as `unverified` (Q4).
      verify: `npx vitest run tests/hooks/permission_decision.test.ts --reporter=verbose` -> /✓.*script-body-not-name/

## Phase 3 — Recoverable by construction

Turns the most common incident class — lost uncommitted work — from "ask or hope" into
"allowed and undoable", with no prompt.

- [ ] **3.1 Snapshot before git-recoverable local loss** — `corrected-from-reproduction`.
      Before a segment in a git-recoverable class runs, the concern keeps **two** refs without
      touching the worktree or the real index: the index tree (`git write-tree` on the real
      index, committed with `git commit-tree -p HEAD`) at
      `refs/agent-config/recovery/<session>/<n>-index`, and the worktree tree (a copy of the
      index as a temporary `GIT_INDEX_FILE`, `git add -A`, `git write-tree`, `git commit-tree
      -p HEAD`) at `refs/agent-config/recovery/<session>/<n>`. For `stash drop` and `branch -D`
      the ref is the dropped object itself. The one-ref form the source proposed restores
      content byte-for-byte but stages every file on restore, losing the staged/unstaged/untracked
      split — reproduced in a fixture repository.
      verify: `npx vitest run tests/scripts/hooks/recovery_snapshot.test.ts --reporter=verbose` -> /✓.*status-identical-after-restore/ <!-- ref-ignore -->
- [ ] **3.2 The allow names the way back.** The concern's message carries both refs and the
      restore, in order: `git checkout <ref> -- .` then `git read-tree <ref>-index`. The same ref
      is the *recoverable* leg of the ADR-268 § 6 triple for WARN ops.
      verify: `npx vitest run tests/scripts/hooks/recovery_snapshot.test.ts --reporter=verbose` -> /✓.*message-names-both-refs/ <!-- ref-ignore -->
- [ ] **3.3 Bounded cost.** Above Q2's size cap the snapshot is skipped and the segment is
      treated as `unverified`; refs older than Q3's TTL are pruned at session start; snapshot
      time is reported separately from the concern's own latency.
      verify: `npx vitest run tests/scripts/hooks/recovery_snapshot.test.ts --reporter=verbose` -> /✓.*over-cap-is-unverified/ <!-- ref-ignore -->
- [ ] **3.4 Zero prompts holds.** The ADR-260 reversible fixture set produces zero ask and zero
      deny across Phases 0–4.
      verify: `npx vitest run tests/hooks/destructive_consequence.test.ts --reporter=verbose` -> /✓.*reversible-set-zero-prompts/ <!-- ref-ignore -->

## Phase 4 — The floor gets its tool-call layer

- [ ] **4.1 Concern `destructive-consequence`**, `pre_tool_use`, `tools: [Bash]` plus the shell
      tool names already aliased in `host_lowering.yaml`. Votes by class: git-recoverable local
      loss → no vote, snapshot taken (host prompts exactly as today); typed op → no vote,
      recorded (Q5); `unrecoverable-local` → no vote, recorded; `unverified` touching a typed-op
      or unrecoverable recogniser → deny with reason id and a static alternative;
      everything else → no vote. The manifest edit carries its ratification artefact.
      verify: `npx vitest run tests/hooks/destructive_consequence.test.ts --reporter=verbose` -> /✓.*votes-by-class/ <!-- ref-ignore -->
- [ ] **4.2 Shadow first.** The concern ships `severity: advisory` and writes what it would do,
      the pattern `spawn-guard-shadow` uses (`hook_manifest.yaml:1411-1418`). The deny switches on
      only when Phase 5's artefact reads `< 1 %` false positives over at least 30 sessions —
      `typed_op_watch.enforcementAllowed`, reused.
      verify: `npx vitest run tests/hooks/destructive_consequence.test.ts --reporter=verbose` -> /✓.*deny-stays-off-without-artefact/ <!-- ref-ignore -->
- [ ] **4.3 Refusal budget.** The same reason id denied three times in one turn stops the
      variant loop: the fourth returns the deny plus "report this to the user in the turn
      summary", never a question, and repetition never lowers a class's severity.
      verify: `npx vitest run tests/hooks/destructive_consequence.test.ts --reporter=verbose` -> /✓.*fourth-deny-reports-not-asks/ <!-- ref-ignore -->
- [ ] **4.4 Bash writes to host settings go through `block-config-weakening` (D11).** A segment
      whose write target is a host settings file reuses its existing Class-C check.
      verify: `npx vitest run tests/hooks/destructive_consequence.test.ts --reporter=verbose` -> /✓.*bash-settings-write-checked/ <!-- ref-ignore -->
- [~] **4.5 Typed ops reach the native ask only once a grant is readable at hook time.** Waits
      for `road-to-typed-grants-that-persist` 3.1: before a ledger exists the hook cannot see
      the explicit invocation ADR-266 and ADR-282 already accept as the confirmation, so an ask
      would put a question back on a PR landing the owner authorised.
- [~] **4.6 The `outside-tree-destruction` vote.** Waits for blocker
      `outside-tree-destruction-reading`.

## Phase 5 — Evidence you can measure, without the command text

- [ ] **5.1 Every vote is a record** in `audit-log-v1`: reason id, class, command hash, segment
      provenance, mode (`record|enforce`), snapshot ref if any. **No command text, redacted or
      not** — the contract's privacy floor forbids snippets and the producer's input type must
      pass `NoFreeForm` (`docs/contracts/audit-log-v1.md:119-160`).
      verify: `npm run typecheck` -> 0
- [ ] **5.2 The false-positive rate is computable without storing commands.** An offline
      reader replays the Bash commands of local session transcripts through the classifier at
      measurement time, takes the labels from a reviewed sample, and persists counts only; its
      output is the artefact `enforcementAllowed` consumes, for this concern and for the later
      roadmap's daemon (closes D10).
      verify: `npx vitest run tests/scripts/destructive_fp_replay.test.ts --reporter=verbose` -> /✓.*persists-counts-only/ <!-- ref-ignore -->

## Phase 6 — An adversarial corpus that must flip

Clean-room, built from published bypass classes and this tree's own defects (K2).

- [ ] **6.1 `tests/fixtures/shell-consequence-corpus/`** <!-- ref-ignore -->, one file per class:
      `bypass` (quote removal `r''m`, `$IFS`, substitution, pipe-to-shell, `find -delete`/`dd`/
      `shred`, wrappers, glued separators, interpreters, redirect forms `>p` `1>p` `&>p`,
      non-last destinations, `cd`-relative, `--no-verif`, `-ccore.hooksPath=`, `HUSKY=0`,
      case-variant paths), `false-positive` (data spans), `reversible` (ADR-260 set),
      `typed-op`, `unverified`.
      verify: `find tests/fixtures/shell-consequence-corpus -type f -name "*.txt"` -> /reversible/ <!-- ref-ignore -->
- [ ] **6.2 `known_failing` must flip.** A row marked known-failing that starts passing reds the
      suite, so a fix cannot land silently. D5's rows are `known_failing` until 1.9.
      verify: `npx vitest run tests/hooks/shell_consequence_corpus.test.ts --reporter=verbose` -> /✓.*known-failing-must-flip/ <!-- ref-ignore -->
- [ ] **6.3 Reachability.** One test per recogniser fires through the production path
      (dispatcher → concern → segmenter), not only its unit.
      verify: `npx vitest run tests/hooks/shell_consequence_corpus.test.ts --reporter=verbose` -> /✓.*reachable-through-dispatch/ <!-- ref-ignore -->
- [ ] **6.4 Cheap mutation and malformed envelopes.** A generator applies the corpus's own
      transformations (wrap, glue, quote, prefix) to every `typed-op` row and every mutant
      classifies like its original; truncated, oversized and wrongly typed envelopes end in a
      bounded `unverified`, never a crash read as allow. No new dependency.
      verify: `npx vitest run tests/hooks/shell_consequence_corpus.test.ts --reporter=verbose` -> /✓.*mutants-classify-like-originals/ <!-- ref-ignore -->

## Phase 7 — Surfaces tell the truth

- [ ] **7.1 README and the profile table** (`README.md:282`) say, per host, which layer carries
      the floor (`hook` or `manual-only`) and that it is "a guardrail, not a security boundary".
      verify: `grep -c "a guardrail, not a security boundary" README.md` -> /^[1-9]/
- [ ] **7.2 The `claude` destructive cell separates binding from guard.** Until 4.2 enforces,
      `docs/enforcement-by-host.md:417` says the slot can refuse and no bound concern recognises
      a typed op; after, it names `destructive-consequence`.
      verify: `grep -c "no bound concern recognises" docs/enforcement-by-host.md` -> /^[1-9]/
- [ ] **7.3 `hooks_doctor.ts` reports posture, read-only**, in the `host_permission_checks`
      pattern: sandbox enabled, fail-if-unavailable, unsandboxed escape hatch, whether the hook
      runtime resolves (D12's `exit 0` path named "floor not running"), and whether another
      `PreToolUse` hook is registered that could rewrite the command after this verdict.
      verify: `npx vitest run tests/scripts/hooks_doctor.test.ts --reporter=verbose` -> /✓.*floor-not-running/ <!-- ref-ignore -->
- [ ] **7.4 Hand D14 to the hook-lowering line** as a re-probe spec — the second CLI host's
      `PreToolUse` with a structured deny on stdout and exit 0 — written into
      `agents/roadmaps/stubs/road-to-host-primitive-lowering.md`; recorded, not executed here.
      verify: `grep -c "structured deny on stdout" agents/roadmaps/stubs/road-to-host-primitive-lowering.md` -> /^[1-9]/
- [~] **7.5 The kernel `enforced_by:` edit.** `non-destructive-by-default` naming
      `hook:destructive-consequence` rides the human edit
      `later/road-to-adversarial-verification-and-long-runs` 7.2 already owes; an agent cannot
      make it (`block_kernel_rule_writes` refuses it).

## Kill register

| K | Killed | Why |
|---|---|---|
| K1 | Pack parity with the external guard (100+ tool packs, per-domain database/cloud packs) | ADR-268 § 6: classes grow by recogniser, not by tool; field reports put per-operation denylists far from complete |
| K2 | Any reuse of the external guard's code, regexes, corpus or binary, and benchmarking or differential testing against it | Its licence carries a rider withholding rights from named AI vendors and anyone acting for them, and defines use to include analysis and benchmarking. Ideas only, clean-room, source-silent |
| K3 | Allow-once codes, bypass environment variables, agent-visible confirmation tokens | an agent can redeem its own code; grants here are object-bound with a second seat (`typed_op_grant.ts`) |
| K4 | A grammar-based shell parser as the primary parser | the `pre_tool_use` budget is p95 175 ms on CI and a per-spawn grammar load does not fit (Q6) |
| K5 | Asking on any reversible operation | ADR-260 § 2 decision 11 acceptance criterion |
| K6 | Natural-language authorisation parsing | ADR-254 reopen text; ADR-260 decision 11 |
| K7 | Hardening `block_kernel_rule_writes` here | its future is the owner crossing in typed-grants; that roadmap's K7 forbids keeping both it and the CI gate |
| K8 | Per-host protocol implementation | the hook-lowering line owns it; D14 is handed over |
| K9 | Writing sandbox or permission settings | `host_permission_checks.ts` reports, never writes |
| K10 | A `scan`, `explain` or `simulate` CLI verb | ADR-041; the static-read idea survives as 2.4 |
| K11 | A second telemetry capture, or command text in the audit log | later K6; `audit-log-v1` privacy floor |
| K12 | Daemon enforcement | later K5, blocker `daemon-host-kill-switch` |
| K13 | A numeric risk score or vector with authority | ADR-268 § 6 names consequence classes; a score ranks, it never decides |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| Q1 | reversible-technical | evidence | Own roadmap; Phase 0 lands first as its own PR | later 7.1 landed observation only; typed-grants is `draft` and owns no hook concern | a roadmap appears that owns the `pre_tool_use` destructive concern |
| Q2 | reversible-technical | agent | Snapshot cap 200 MB of untracked content, configurable | 3.3 makes the overflow `unverified`, never a silent allow | a measured snapshot exceeds the latency budget below the cap |
| Q3 | reversible-technical | agent | Recovery refs live 14 days and are pruned at session start | the rewrite refs precedent removes its own refs; 14 days spans a long run plus review | a restore is needed for a ref already pruned |
| Q4 | reversible-technical | evidence | An unreadable script or recipe body keeps today's allow and is recorded `unverified` | ADR-260 § 2: no new prompt on reversible work | Phase 5 shows unreadable bodies hiding typed ops |
| Q5 | contested-technical | evidence | Typed ops are recorded, never asked, until a grant object is readable at hook time | ADR-266 makes an explicit merge invocation the confirmation and ADR-282 (`reopen_policy: owner`) authorises auto-merge on the owner's word; a hook cannot see either | typed-grants 3.1 lands |
| Q6 | reversible-technical | evidence | No grammar-based parser, not even as a second opinion, in this roadmap | `src/config/hook-latency-budget.json` budgets; the quote-aware segmenter already exists | Phase 6's residual bypass rate exceeds 5 % |
| Q7 | reversible-technical | evidence | The consequence table is JSON under a distinct name | `rule-consequence-class.json` is an unrelated rule class; the bundle carries one YAML reader | the bundle gains a second YAML consumer anyway |
| Q8 | critical-technical | evidence | The false-positive rate comes from an offline transcript replay; no command text is persisted | `audit-log-v1.md:119-160` forbids snippets and enforces it at compile time | the privacy floor is amended by its owner |
| Q9 | contested-technical | evidence | The kernel guard is not migrated here (1.9 deferred) | typed-grants K7 and blocker `kernel-guard-first-crossing`; `road-to-self-modification-that-a-council-must-pass.md:508` | that blocker resolves |
| Q10 | reversible-technical | evidence | The kernel `enforced_by:` edit rides the later roadmap's owed human edit | `block_kernel_rule_writes` refuses agent writes; later 7.2 already owes it | the kernel deny is retired |
| Q11 | destructive-owned | owner | Whether outside-tree destruction gets a deny — see blocker `outside-tree-destruction-reading` | ADR-268 § 1 maps the 2026-09-05 list 1:1 onto eleven ops, yet the classifier still carries `out-of-scope-destruction` (`git_command_classifier.ts:134`) | the owner rules |
| Q12 | reversible-technical | evidence | Local database and container resets are recorded, never denied | ADR-260 § 2 lists reversible branch-local work as question-free, and these are routine local development | Phase 5 shows a recorded reset that reached a non-local target |

## Blockers

### blocker: outside-tree-destruction-reading
- **Status:** resolved — **(a)**, AI council 2026-10-16, 2/2 concluded, no split.
  Both seats routed it `DECIDE`: (a) **adds** a denial and leaves ADR-268 § 1's
  eleven-operation set and ADR-260's zero-prompt criterion intact, so it
  strengthens a floor rather than lowering one, and the `owner` label below
  *"describes provenance, not decision authority"* (`openai`). Record:
  `agents/evidence/council/owner-blocker-routing-20261016.md`.
  **The rule is recorded by consequence, not by path shape** — see the
  amendment under `What to do`.
- **Owner:** owner — whether the 2026-09-05 destructive list covers out-of-scope destruction outside the eleven ops is a reading of the owner's own ruling. **The council read it instead, under the routing test, and the owner did not need to.**
- **Blocks:** step 4.6 and AC-6.
- **What to do:** **(a), as the council ruled — and the council amended how (a)
  is written.** Record that destruction reaching outside the working tree is
  denied with a static alternative as a **failed consequence proof**, not an
  authority op, so ADR-268 § 1's eleven-op set is unchanged. Superseded
  alternative, kept so the choice is legible: (b) leave it model-held with the
  concern only recording it.

  **Write the rule by the consequence, not by the path shape** (`openai`,
  unchallenged by the second seat). The category *"target resolves to `/`, `~`
  or a block device"* is simultaneously **too broad** — a read-only or
  non-destructive write outside the tree matches it if the implementation
  conflates location with destructive effect — and **too narrow**: a mounted
  filesystem, a symlink escape, a raw device reached through an alias, or an
  indirect operand all destroy without syntactically naming `/`, `~` or
  `/dev/*`. So the recorded rule names the prohibited consequence;
  `rm -rf ~`, `mkfs*` and `dd of=/dev/*` are examples of it, and path
  resolution plus command recognition are the enforcement mechanism rather
  than the rule.

  **The record is the authority source, not a description of the guard**
  (`anthropic`). A denial cites it — *"denied per <record>, implementing the
  2026-09-05 ruling"* — so the chain from ruling to refusal is auditable
  instead of reading as "the tool said no". It carries weight on four paths,
  only one of which is the blocked command: a guard bug in path resolution
  leaves the model a rule to refuse on; a plan is checked against it before a
  command is even formed; a user asking *why* gets the rule rather than the
  exit code; and a later change to the guard has a continuity anchor.
- **Resolved when:** ~~a file under `agents/evidence/owner-directives/` names
  this blocker slug and (a) or (b)~~ — **re-pointed 2026-10-16, because the
  named container became the wrong one the moment the council answered.** That
  directory holds orders the owner gave in their own session prompt; its single
  existing record says so in its first row (`Ordered by | the repository owner,
  in their own session prompt`). Writing (a) there would attribute to the owner
  a decision the owner never made, which is the one thing a directive file must
  never contain. The record goes where the decider is:
  `agents/evidence/council/owner-blocker-routing-20261016.md` names this slug
  and (a). Should the owner later wish to carry the rule under their own
  authority rather than the council's, a directive may be added then — it would
  strengthen the record, and nothing waits on it.
- **Recommendation:** (a). It adds no question and no grant, so ADR-260's zero-prompt criterion and ADR-268 § 1 both stand, and it covers the incident class with the least recovery (a home directory or a device) that no snapshot can undo.
- **If you do nothing:** the class is recorded only; every other phase proceeds and the floor for outside-tree destruction stays model-held, as today.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude-opus -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Every PR touches a ratified surface | implementation | `check_kernel_edit_ratified.ts:32-36` covers `hooks/block_*.ts`, `hook_manifest.yaml` and the dispatcher's import closure, so each phase's PR is refused at push without a ratification artefact reviewed by a different, provider-diverse seat. | Each PR carries `agents/evidence/ratifications/<branch>.md` from a council run on the main checkout; Phase 0 is sized to be ratifiable alone. | Phase 0 — Category A stops granting what it cannot prove |
| 2 | The hook bundle ceiling | implementation | 9,115 B of headroom; a shared module plus a concern can cross it. | 1.8 deletes the replaced parsers in the same PR and runs the composition check; raising the ceiling is not on this roadmap. | Phase 1 — One segmenter |
| 3 | Latency over budget | implementation | Segmenting every Bash call would push `pre_tool_use` past its p95. | 1.7 quick-reject before any parse; snapshot time measured separately (3.3). | Phase 1 — One segmenter |
| 4 | A written script is run later | implementation | A body written to disk earlier and executed by name is not segmented. | Documented limit; 2.4 covers manifest and Makefile bodies, nothing more is claimed. | Phase 2 — One vocabulary |
| 5 | Snapshot cost and ref accumulation | implementation | `git add -A` into a temporary index is slow on a large tree, and refs pile up. | Q2 cap with `unverified` fallback; Q3 TTL prune; refs under a private namespace `git push --tags` never publishes. | Phase 3 — Recoverable by construction |
| 6 | False positives stall a long run | product | A deny on a data span or a benign dynamic sink stops twelve hours of work. | 4.2 shadow window and the `< 1 %` bar; 4.3 refusal budget; every deny carries a static alternative. | Phase 4 — The floor gets its tool-call layer |
| 7 | The concern estate grows by one | implementation | A new `pre_tool_use` concern trips the concern-count ratchet. | The PR states the claim beside the ratchet: no existing concern recognises destructive commands, so there is nothing to trade. | Phase 4 — The floor gets its tool-call layer |
| 8 | The rate never becomes measurable | product | Fewer than 30 replayable sessions, or no labelled sample, keeps enforcement off. | `enforcementAllowed` refuses on an absent or thin artefact; shadow mode is never described as protective. | Phase 5 — Evidence you can measure, without the command text |
| 9 | A neighbour hook rewrites the command after this verdict | implementation | Another `PreToolUse` hook may return a modified input the concern never saw. | 7.3 reports any such registration; the limit is stated, not claimed solved. | Phase 7 — Surfaces tell the truth |
| 10 | The guard is read as a boundary | product | A green verdict is taken as proof a command is harmless. | 7.1 and 7.2 wording; 7.3 sandbox posture. | Phase 7 — Surfaces tell the truth |

## Fixtures

G1 category-A rows (Phase 0) · G2 wrapper and separator equivalence · G3 data-span
false-positive set · G4 D5/D6 bypass rows (D5 `known_failing`) · G5 recogniser → class map ·
G6 snapshot round trip with staged, unstaged and untracked edits · G7 ADR-260 reversible set ·
G8 typed op recorded, not asked · G9 `unverified` deny with reason id · G10 refusal budget ·
G11 Bash write to settings → config-weakening check · G12 trampoline without runtime → doctor
reports floor not running.

## Acceptance Criteria

- [ ] AC-1 — No command outside G1's true set receives a category-A allow, and the allow's
      reason names only checks that ran.
- [ ] AC-2 — Every D6 bypass row denies; D5's rows are `known_failing` and flip when 1.9 lands.
- [ ] AC-3 — `reset --hard`, `checkout -- .`, `clean -fd`, `stash drop` and `branch -D` are each
      undoable from the recorded refs with `git status --porcelain` identical before and after.
- [ ] AC-4 — Zero ask and zero deny on the ADR-260 reversible set across Phases 0–4.
- [ ] AC-5 — One consequence table and no second op list in the tree; the vocabulary check is green.
- [ ] AC-6 — The deny path is enabled only after Phase 5's artefact reads `< 1 %` over at least
      30 sessions, and outside-tree destruction votes only as the blocker's resolution says.
- [ ] AC-7 — No audit record holds command text; the producer type passes `NoFreeForm`.
- [ ] AC-8 — No ask on a typed op exists before a grant is readable at hook time; ADR-266 and
      ADR-282 PR-landing flows see no new question.
- [ ] AC-9 — The shell parser never executes, expands or spawns, and a malformed or oversized
      envelope ends in a bounded `unverified`, never an allow.
- [ ] AC-10 — README and `docs/enforcement-by-host.md` name the carrying layer per host and say
      "a guardrail, not a security boundary".

## Provenance

| Item from the round | Verdict | Where it lands |
|---|---|---|
| Promote the existing segmenter instead of a new parser | KEEP | Phase 1 |
| Category A grants more than it can prove | KEEP | Phase 0 |
| Snapshot instead of asking on local loss | KEEP, corrected | 3.1 — two refs, not one |
| Redacted command text in the audit log for the false-positive rate | CUT, replaced | 5.1–5.2 — the privacy floor forbids it |
| Typed ops reach a native ask now | MOVED | 4.5, behind typed-grants 3.1 (Q5) |
| Migrate the kernel guard onto the segmenter | MOVED | 1.9, behind the owner crossing (Q9) |
| Policy decision point separated from enforcement points | KEEP | Phase 1–2 versus Phase 4 |
| Per-host capability matrix from live host end-to-end tests | MOVED | the hook-lowering line; 7.4 hands D14 over |
| Base-trusted classifier for self-modification | MOVED | `road-to-a-danger-gate-that-sees-what-governs` 2.1 |
| Object-bound, single-use, replay-proof grants | MOVED | `road-to-typed-grants-that-persist` |
| Optional database, infrastructure and remote packs | CUT | K1 |
| A shared policy core with the PR-risk classifier (`classify_merge_risk.ts`) | CUT | the two classify different objects; danger gate owns the diff |
| PowerShell lexer | CUT | the one host that can refuse runs its shell tool as Bash |
| Owner reading of outside-tree destruction | OWNER | blocker `outside-tree-destruction-reading` |
