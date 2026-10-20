---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t reproduced two gate-parse defects at 5fa963cec, both while running this package's own documented procedure. `lint_consolidation_lineage.ts:177` strips comments but not quotes from a block-list parent entry while its sibling branch at :168 strips both, so a declared, present parent is reported twice — once as `missing-parent` and once as `omitted-sibling`; measured over one real folder, 2 of 3 findings were this one defect. `block_speaking_inbox_dir.ts` scans every whitespace token of a raw shell command (`creatableTokens`, :224-238) with no distinction between a path being created and a path merely mentioned, so it refused a read-only `ls` on a directory that already existed and refused the `link_crypto encrypt` call its own error message prescribes as the remediation. No active, parked or stub roadmap owns either: a grep over agents/roadmaps/{*,later,stubs} for lint_consolidation_lineage, normalizeParent, block_speaking_inbox_dir and creatableTokens returns nothing. Archiving or parking costs more because both defects fire on every future inbox round and one of them blocks the documented fix for the other; merging into a neighbour would put two four-line parser fixes behind an unrelated plan's blockers."
estate_growth_exempt: "open_blockers 68 -> 69, measured by check_estate_count at this change: one blocker here (d1-reopen-helper-level-quote-strip). It creates no new hold. Step 1.1 has carried a dated `Held open, 2026-10-16` note in its body since the council split 1:1 on the helper-level quote strip, and AC-1 asserts the behaviour that split decided nothing about. Because `screenRoadmap` in src/scripts/roadmap_drain_queue.ts reads only `blocked-by` markers and dated waits, a prose hold is invisible to it and both items screened as runnable; one drain lane was spent on this file on 2026-10-19 for that reason. It blocks only 1.1's helper-level half and AC-1."
relates: []   # scanned: 27 active + 104 later + 131 stub roadmap file(s); 0 sibling hits for lint_consolidation_lineage, normalizeParent, block_speaking_inbox_dir, creatableTokens or isAcceptableInboxDir
---
# Road to gates that read what was written

> **Source:** round `inbox-2026-10-t`, 2026-10-16 — both defects were
> reproduced while running `/analyze:inbox` over
> `agents/tmp.old/inbox-2026-10-t/`, not read out of a supplied plan. The
> lineage defect was reported by the gate itself over a real folder; the guard
> defect was hit twice by the run that was obeying the guard's own remediation
> instruction.

## Goal

Two gates stop reporting a finding the thing in front of them does not
support. A declared, present parent is not reported as missing; a shell
command that only *mentions* an inbox path is not refused as if it were
creating one.

Both are parser defects with a reproduced failing input, a sibling branch in
the same file that already does it right, and a fix of a few lines. Neither
changes what either gate is for.

## Prerequisites

- `npx vitest` runs locally. No network, no install.

## Context — read at `main@5fa963cec`

| # | Defect | Evidence |
|---|---|---|
| M1 | **The lineage gate's block-list branch does not strip quotes.** `src/scripts/lint_consolidation_lineage.ts:177` calls `normalizeParent((item[1]).replace(/#.*$/, ''))` — comments stripped, quotes not. The inline-`[…]` branch twelve lines above, at `:168`, calls `normalizeParent(x.replace(/["']/g, ''))`. `normalizeParent` then takes the first whitespace token of a quoted YAML scalar, so a declared parent arrives with its opening `"` still attached and matches nothing. |
| M2 | **One defect, reported twice, as two different findings.** *(executed)* over `agents/tmp.old/inbox-2026-10-t/topic-2/` the gate reported 3 findings; **2 of them are this parse bug** on one slug — once as `missing-parent` for a file that is present, once as `omitted-sibling` for a parent that is declared. A reader cannot tell the real finding from the artefact without reading the parser. |
| M3 | **The affected call site is the only one, and no test covers it.** Defect-pattern sweep: `normalizeParent` has **5** call sites. `:168` already strips quotes; `:218` and `:231` take backtick-extracted input and are structurally immune; `:198` is the lower-risk prose branch; **`:177` is the single affected site**. `tests/scripts/lint_consolidation_lineage.test.ts` covers backticked, bare, `.md`-suffixed and glob forms — **no quoted block-list entry**. |
| M4 | **The gate has no arrow of time.** A sibling that declares `supersedes_proposals:` over the consolidating file is a **successor**, not an omitted parent; the gate compares a flat folder and cannot express that. Reproduced in the same run: one of the three findings is a succession reported as an omission. |
| M5 | **The speaking-inbox guard judges a mention as a creation.** `creatableTokens` (`src/scripts/hooks/block_speaking_inbox_dir.ts:224-238`) splits the raw command on whitespace and shell punctuation and returns **every** token, with no notion of which one is a write target. The docstring above it records the trade deliberately — "the classification that tried to be cleverer than this is gone" — so the behaviour is known; what is new is the cost measured below. |
| M6 | **It refuses a read on a directory that exists.** *(executed, twice, in this round)* `ls -la agents/tmp/<speaking>/` on an **existing** directory was blocked. The guard's already-exists carve-out (`:338-341`) is reached from the `_PATH_KEYS` path; the Bash token path does not reach it, so for a shell command "already created — a rename is the fix" never applies. |
| M7 | **It refuses its own prescribed remediation.** *(executed, in this round)* the guard's error text instructs the operator to record the true source encrypted — `printf '%s' '<the real source>' \| ./scripts-run src/scripts/_lib/link_crypto encrypt`. A plaintext naming the directory being renamed *is* the real source, so the command carrying it is refused by the guard that asked for it. The run worked around it by rewording the plaintext, which means the recorded provenance is weaker than the guard intended. |

## Phase 1 — The lineage gate parses what is declared

- [x] **1.1 Red first: pin the two inputs no test covers.** Add to
      `tests/scripts/lint_consolidation_lineage.test.ts`:
      `normalizeParent('"road-to-x" — note')` must equal `road-to-x`, and a
      `consolidates:` block list whose entries are quoted YAML scalars must
      resolve its parents.
      verify: both **red** against the current parser, and the failure names
      `:177`. A test that passes here has not reproduced M1.
      **Held open, 2026-10-16.** The block-list half landed and was observed
      red first (`"road-to-x` and `'road-to-y.md'` received). The
      helper-level half contradicts D1 and the "does not touch
      `normalizeParent`" fence below; the council split on it (record:
      `agents/evidence/council/lineage-gate-parse-and-direction-20261016.md`).
      Closing it is a reopen of D1, not an implementation step.
      **Reopened 2026-10-19 (D6, council 2/2):** the helper strips **one
      matching pair of wrapping quotes** — around the whole input and around
      the selected token — and the three caller-side `.replace(/["']/g, '')`
      strips (`:177`, `:186`, `:232`) are removed. Not the global regex
      moved verbatim: an embedded apostrophe survives. The red-first case
      gains `normalizeParent("road-to-it's-x")` → `road-to-it's-x`, and all
      six call sites carry a regression case.
      Landed 2026-10-20 (D6): observed red at `418a09379` — 4 cases, incl.
      the block-list branch turning `road-to-it's-a` into `road-to-its-a`;
      green after, 47/47.
- [x] **1.2 Strip quotes in the block-list branch.** `:177` gains
      `.replace(/["']/g, '')`, matching its sibling at `:168`.
      verify: 1.1 green; re-running the gate over the round's own folder
      yields **1** finding, not 3.
      Measured 2026-10-16: **2** after this step alone, not 1 — the
      omitted-sibling finding also named a sibling declaring `relation:
      extends` over the consolidating file. It reaches 1 after 2.1.
- [x] **1.3 Report the sweep.** The construct is `normalizeParent(` without a
      quote strip. 5 call sites, 1 affected (`:177`), 1 already correct
      (`:168`), 2 structurally immune (`:218`, `:231`), 1 lower-risk prose
      branch (`:198`). Record the count in the PR; zero further matches is a
      real answer and worth stating.
      verify: the PR body carries the count and the file list.

## Phase 2 — The lineage gate can express direction

- [x] **2.1 A successor is not an omitted parent.** A sibling declaring
      `supersedes_proposals:` (or `supersedes:`) over the consolidating file
      is reported as a succession, or not reported at all — never as
      `omitted-sibling`.
      verify: a fixture pair where B supersedes A yields no omitted-sibling
      finding on A, and the inverse pair still does.
      Landed with a third key the council converged on: a `relates:` entry
      with `relation: extends` (allowlist of one). The round's fourth file
      declares exactly that and nothing else, so without it 2.3 cannot read 1.
- [x] **2.2 A prose-named parent gets its own finding class.** A parent named
      only in prose, with no slug and no backticks, reports as
      `unresolvable-parent` — distinct from `missing-parent`, which means a
      slug that resolves to nothing.
      verify: a fixture declaring a parent in prose yields
      `unresolvable-parent` and not `missing-parent`.
- [x] **2.3 Re-run over the round that found this.** The folder that produced
      3 findings produces exactly 1, and that one is the genuine prose-named
      ghost.
      verify: the gate's output over
      `agents/tmp.old/inbox-2026-10-t/topic-2/` is pinned as a fixture
      expectation.
      The folder is gitignored, so the pin is over
      `tests/fixtures/consolidation-lineage/round-mirror/`, which mirrors its
      declaration shapes with neutral names: 3 findings at `origin/main` over
      both, 1 over both after the fix.

## Phase 3 — The guard judges a write, not a mention

> **Landed 2026-10-20 (D7, D8).** Council rounds 1 and 2 refused 2/2; round 3
> returned `confirmed-non-expanding` 2/2. Record:
> `agents/evidence/ratifications/drain-gates-read-written-20261020.md`. What
> landed is narrower than 3.2 and 3.3 were written: a shell token gets the
> exists-probe only when absolute (D7), and no command shape is exempt (D8).
> The history below is the record of how it got there.
>
> **Held, 2026-10-16 drain; built and refused 2/2, 2026-10-19.** Every step edits
> `src/scripts/hooks/block_speaking_inbox_dir.ts`, a `pre_tool_use` deny guard
> of the same class as `block_no_verify` and `block_config_weakening`, so the
> diff carries a two-provider ratification record under
> `agents/evidence/ratifications/`.
>
> **M6 was mis-attributed, and the probe says where it really lives.** The Bash
> token path already reaches `verdictFor` and its already-exists branch. What
> it did not reach is the right *base*: the guard read `project_dir`, a key no
> producer sets (the dispatcher sends `workspace_root`, the native payload
> `cwd`), so the exists-probe resolved against the hook's own cwd. With the
> process standing in the tree the `ls` was allowed; standing anywhere else —
> the parent checkout of a worktree session — it was refused. 3.2 fixes that
> base, which is the same carve-out reached from both entry points.
>
> **The 2026-10-19 build was refused by the council, 2/2, and reverted.** Record:
> `agents/evidence/ratifications/drain-road-to-gates-that-read-what-was-written-20261019z.md`.
> Two high findings, both convergent: the remediation exemption trusted the
> spelling `scripts-run` rather than a repository-anchored executable (a bare
> name resolves through `PATH`), and one shared base cascade let `project_dir`
> outrank the `cwd` a Bash command actually runs in. A next round needs a
> tool-specific base, an anchored executable, suppression of the known-safe
> plaintext occurrence rather than the whole command, and conflicting-field
> regressions. The red observations below stay valid; the landed notes on
> 3.1 and 3.3 describe the refused build, not the tree.

- [x] **3.1 Red first: the two commands this round was refused.** Pin both as
      polarity cases on `creatableTokens` and on the envelope path — a
      read-only `ls` of an existing inbox directory, and a `printf` whose
      single-quoted literal names one. Both must be **allowed**; a `mkdir -p`
      and a `> file` redirect into a new speaking directory must stay
      **blocked**.
      verify: the two allow-cases are red and the two block-cases are green
      before any change. A change that makes all four green without the first
      two having been red has not reproduced M5.
      Observed 2026-10-19 at `1a334dd16`: 5 allow-cases red (the `ls`
      against an envelope `cwd`, against `workspace_root`, against a wrapped
      payload; the remediation naming a renamed directory; the literal deny
      message line), every block-case green.
      Re-observed 2026-10-20 against the base guard for the suite that
      landed: 4 red — a relative Write under native `cwd`, the message
      wording, and two cases where `project_dir` naming another tree made the
      base ALLOW (a `mkdir -p`, a Write). Per D7 the allow-cases are written
      with absolute paths; the relative `ls` is a block-case.
- [x] **3.2 Reach the already-exists carve-out from the Bash path.** A token
      naming a directory that exists on disk takes the same
      `directory already exists — rename, do not re-refuse` branch the
      `_PATH_KEYS` path already takes (`:338-341`). This alone clears M6 and
      changes no policy: the name is still speaking, and a rename is still
      the fix.
      verify: the `ls` case from 3.1 passes; `mkdir -p` into a **new**
      speaking directory is still refused.
      Landed per D7: a path-keyed tool's relative path is probed against the
      native payload `cwd` (never `project_dir`, `workspace_root` or a
      wrapper-level `cwd`); a shell token is probed only when absolute. The
      `ls` passes by absolute path; a relative one, and a helper that `cd`s
      before creating its relative argument, are refused.
- [x] **3.3 Do not judge a token inside a quoted literal as a target.**
      `creatableTokens` splits on `'` and `"` among other characters, so a
      path inside a single-quoted string becomes a bare token. Keep the
      conservative scan, and exclude only the case M7 names: a token whose
      sole occurrence is inside a quoted literal that is an argument to a
      command writing nothing.
      verify: the `printf | link_crypto encrypt` case from 3.1 passes; a
      heredoc body calling `makedirs` on a speaking directory — the case the
      raw-command scan exists for — is still refused.
      Landed narrower than the step's wording: the exemption is the one
      remediation shape, matched on the whole command — a single-quoted
      `printf '%s'` literal piped into `link_crypto encrypt` and nothing else.
      D2 forbids a verb classifier; eight bypass shapes (a second segment,
      `;`, `&&`, a newline, a redirect, `$(…)`, `| sh`, `decrypt`) are
      block-cases in the same suite.
      Closed per D8, not as written: that exemption was refused three times
      (2026-10-19; rounds 1 and 2 on 2026-10-20) because nothing inside the
      hook can establish the identity of `./scripts-run`. No command shape is
      exempt; the deny message asks for the source itself, never an
      `agents/tmp` path, so the prescribed command carries no inbox token.
- [x] **3.4 Make the remediation reachable as written.** The command in the
      guard's error text must execute unchanged in a tree where the speaking
      directory exists.
      verify: a test runs the literal command from the message against a
      fixture and asserts it is not blocked.
      Landed 2026-10-20: the line is lifted from `denyMessage`, the
      placeholder filled with a source URL, and run with and without a `cwd`.
- [ ] **3.5 Word the absolute-path hint as guard recognition.** Both round-3
      seats (low): "a shell command reaches it only by its absolute path"
      describes shell resolution; `cd /tree && ls agents/tmp/<x>` reaches it
      relatively. Replace with the seats' wording — "this guard recognizes it
      in shell commands only when referenced by absolute path; relative
      arguments may resolve elsewhere and are judged as new" — and pin it.
      Built at `1418c8c8a`; the confirming round did not reach quorum (seat
      `exit_1`, then both) with the round cap spent, so the gated file was
      restored to the ratified bytes.
      verify: a ratification record over the reworded file, and an assertion
      on the new line in `tests/hooks/block_speaking_inbox_dir.test.ts`.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Match the sibling branch rather than rewrite `normalizeParent` | `:168` already does the right thing on the same input shape; changing the shared helper would touch 4 call sites that are correct today | a sixth call site arrives with a different input shape |
| D2 | reversible-technical | evidence | Keep the guard's conservative token scan; narrow only the two reproduced false positives | the docstring records that a cleverer classification was tried and removed; widening it again is how the bypass comes back | a third false-positive class is measured |
| D3 | critical-technical | agent | The already-exists carve-out is a policy no-op for the Bash path | the `_PATH_KEYS` path already takes it; reaching it from the other path makes two entry points agree rather than loosening either | the carve-out is removed from the `_PATH_KEYS` path |
| D4 | deterministic | evidence | A prose-named parent is a distinct finding, not a missing one | the round's one genuine finding is exactly this shape, and reporting it as `missing-parent` sends the reader looking for a file | — |
| D5 | reversible-technical | agent | Both gates are fixed in one roadmap | they are the same failure — a parser reporting what its input does not say — and one of them blocks the documented remediation for the other | either fix grows past a few lines |
| D7 | critical-technical | council:speaking-inbox-guard-mention-review-20261020-r3 | A shell token gets the exists-probe only when absolute; a path-keyed tool's base is the native payload `cwd` alone; supersedes D3 for the Bash path | rounds 1-2 refused a cwd-probed relative shell token 2/2 (`helper agents/tmp/<name>` that `cd`s first: refused at the base, allowed by the probe); round 3 `confirmed-non-expanding` 2/2 on the absolute-only form | a host supplies the effective cwd of every child process |
| D8 | critical-technical | council:speaking-inbox-guard-mention-review-20261020-r2 | No command shape is exempt from the token scan; the deny message asks for the source, not a path; supersedes 3.3's quoted-literal exemption | refused three times: a spelling, then a regular-file check, cannot establish the identity of a workspace-writable `./scripts-run` | an executable identity outside the tool workspace exists |
| D6 | reversible-technical | council:resolve-blockers-batch-20261019 | Reopen D1: `normalizeParent` strips one matching pair of wrapping quotes and the three caller strips go; supersedes D1 | D1's own revisit-if fired — 6 call sites, not 4, three duplicating `.replace(/["']/g, '')`; 2/2 seats chose (a), both bounding it to wrapping quotes so embedded apostrophes survive | a call site needs a quote-bearing token preserved |

## Blockers

### blocker: d1-reopen-helper-level-quote-strip

- **Status:** resolved 2026-10-19 — (a), D1 reopened as D6: the helper strips
  one matching pair of wrapping quotes and the three caller strips go; 1.1 and
  AC-1 rewritten to it (council: 2026-10-19, anthropic + openai, 2/2 (a), not
  owner-reserved, $0.00, on the new fact that D1's own revisit-if had fired —
  six call sites, three duplicating the strip; record
  `agents/evidence/council/resolve-blockers-batch-20261019.md`). The hold was
  dated 2026-10-16; this entry registered it.
- **Class:** 2 — council. The question is technical and reversible, so the
  ownership ladder does not reach the owner; it is parked only because the
  deciding body returned a 1:1 split, which is an escalation condition rather
  than a decision. Stated explicitly because an absent `Class` means 3, and a
  technical question would then land in the owner's batch unread.
- **Owner:** council
- **Blocks:** step 1.1's helper-level half and AC-1. Nothing else: 1.1's
  block-list half landed and was observed red first, 1.2 is closed, and Phase 2
  is unaffected. Phase 3 is held separately by its own council refusal (see
  **What to do** below), not by this blocker.
- **Question:** Does `normalizeParent` itself strip quotes — reopening D1 — or
  does AC-1's wording get amended to match the sibling-branch fix D1 chose?
- **Recommendation:** put it to the council as a D1 reopen with the evidence
  that now exists, rather than re-running the 2026-10-16 question unchanged. A
  split is not a decision, and repetition without new evidence is not a reason
  to expect a different one.
- **If you do nothing:** 1.1 and AC-1 keep reading as runnable work to every
  lane that screens this file, because `screenRoadmap` in
  `src/scripts/roadmap_drain_queue.ts` classes an open step runnable unless it
  carries a `blocked-by` marker or a dated wait — a hold stated in prose is
  invisible to it. One drain lane was already spent on this file on 2026-10-19
  for exactly that reason.
- **What to do:** the council of 2026-10-16 split 1:1
  (`agents/evidence/council/lineage-gate-parse-and-direction-20261016.md`):
  `openai` wanted the strip inside the helper with the global strip at `:168`
  removed; `anthropic` preferred centralising on the merits but held D1 as
  binding and recommended amending AC-1's wording instead. Pick one —
  (a) reopen D1 and move the strip into `normalizeParent`, removing the
  `:168` strip, with the four other call sites regression-tested; or
  (b) keep D1 and amend AC-1 so it asserts the sibling-branch behaviour that
  1.2 actually shipped.
- **Resolved when:** a council round records a non-split verdict on (a) or (b)
  in § Decisions, and 1.1 and AC-1 are closed or rewritten to match it.

## What this roadmap deliberately does not do

- It does not change what either gate is for. The naming rule and the lineage
  obligation are unchanged; only what the parsers can see changes.
- It does not loosen the speaking-name policy. A new speaking directory is
  still refused, by both entry points.
- It does not change `normalizeParent` beyond the wrapping-quote strip D6
  moved into it; the token, path and glob rules stay as they are.
- It does not add a command classifier to the guard. D2 records why.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Narrowing the guard reopens the bypass its docstring records | implementation | A quoted-literal exemption is an exemption, and a creation can be written as one. | **No exemption was built (D8).** Three attempts at one were refused; what landed exempts no command shape, so the bypass the docstring records stays closed. The shell probe was narrowed instead (D7: absolute tokens only), and the heredoc-`makedirs`, redirect, substitution and helper-script cases are asserted as block-cases in the same suite. Record: `agents/evidence/ratifications/drain-gates-read-written-20261020.md`. | Phase 3 — The guard judges a write, not a mention |
| 2 | The already-exists carve-out lets a rename be skipped | product | A speaking directory that exists keeps working, so nobody renames it. | That is already the behaviour on the `_PATH_KEYS` path, and the carve-out's own comment states the reason: refusing every later write wedges the round without removing the name. The rename obligation is the naming rule's, not the guard's. | Phase 3 — The guard judges a write, not a mention |
| 3 | The lineage fix hides a real missing parent | implementation | Stripping quotes makes more strings resolve, so a genuinely absent parent could start resolving to something. | A stripped quote changes only the token boundary, never the slug; 1.1 asserts the resolved value exactly, and 2.3 pins the whole output over a real folder. | Phase 1 — The lineage gate parses what is declared |
| 4 | The succession check mis-reads a legitimate omission as a succession | implementation | A file that declares `supersedes_proposals:` loosely gets a free pass. | 2.1 asserts the inverse pair still reports; the exemption is keyed on an explicit declaration, not on a date or an inference. | Phase 2 — The lineage gate can express direction |

## Acceptance Criteria

- [x] **AC-1** `normalizeParent('"road-to-x" — note')` returns `road-to-x`,
      an embedded apostrophe survives the helper, all six call sites keep their
      regression case (D6), and a quoted block-list `consolidates:` entry resolves; the cases were
      observed **red** first and the observation is in the PR.
- [x] **AC-2** Re-running `lint_consolidation_lineage` over
      `agents/tmp.old/inbox-2026-10-t/topic-2/` yields exactly **1** finding,
      and it is the prose-named ghost.
- [x] **AC-3** A sibling declaring supersession over the consolidating file
      produces no `omitted-sibling` finding; the inverse pair still does.
- [x] **AC-4** A prose-named parent reports as `unresolvable-parent`, not
      `missing-parent`.
- [x] **AC-5** A read-only `ls` of an **existing** inbox directory and a
      `printf` naming one inside a quoted literal are both allowed — by
      absolute path, per D7; a relative one is refused; a
      `mkdir -p`, a `>` redirect and a heredoc `makedirs` into a **new**
      speaking directory are all still refused. All five asserted in one
      polarity suite.
- [x] **AC-6** The remediation command printed in the guard's own error text
      executes unblocked against a fixture.
- [x] **AC-7** The defect-pattern sweep for `normalizeParent` without a quote
      strip is reported with its count and file list.
- [x] **AC-8** `task ci` green. CI on PR #2540 settled green, 39 checks on
      `5d35bc727` (2026-10-20).

## Notes — how this file was derived

Internally originated: both defects were reproduced by this round's own run,
not proposed by a source document, so no gap table or provenance block is owed
under template rule 19. The lineage defect was surfaced by the gate's own
output over a real folder and then traced to the parser; the guard defect was
hit twice while executing the guard's own instructions, which is the strongest
available evidence that the false-positive class is reachable in normal use
rather than contrived.
