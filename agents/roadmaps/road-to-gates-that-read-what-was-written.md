---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t reproduced two gate-parse defects at 5fa963cec, both while running this package's own documented procedure. `lint_consolidation_lineage.ts:177` strips comments but not quotes from a block-list parent entry while its sibling branch at :168 strips both, so a declared, present parent is reported twice — once as `missing-parent` and once as `omitted-sibling`; measured over one real folder, 2 of 3 findings were this one defect. `block_speaking_inbox_dir.ts` scans every whitespace token of a raw shell command (`creatableTokens`, :224-238) with no distinction between a path being created and a path merely mentioned, so it refused a read-only `ls` on a directory that already existed and refused the `link_crypto encrypt` call its own error message prescribes as the remediation. No active, parked or stub roadmap owns either: a grep over agents/roadmaps/{*,later,stubs} for lint_consolidation_lineage, normalizeParent, block_speaking_inbox_dir and creatableTokens returns nothing. Archiving or parking costs more because both defects fire on every future inbox round and one of them blocks the documented fix for the other; merging into a neighbour would put two four-line parser fixes behind an unrelated plan's blockers."
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

- [ ] **1.1 Red first: pin the two inputs no test covers.** Add to
      `tests/scripts/lint_consolidation_lineage.test.ts`:
      `normalizeParent('"road-to-x" — note')` must equal `road-to-x`, and a
      `consolidates:` block list whose entries are quoted YAML scalars must
      resolve its parents.
      verify: both **red** against the current parser, and the failure names
      `:177`. A test that passes here has not reproduced M1.
- [ ] **1.2 Strip quotes in the block-list branch.** `:177` gains
      `.replace(/["']/g, '')`, matching its sibling at `:168`.
      verify: 1.1 green; re-running the gate over the round's own folder
      yields **1** finding, not 3.
- [ ] **1.3 Report the sweep.** The construct is `normalizeParent(` without a
      quote strip. 5 call sites, 1 affected (`:177`), 1 already correct
      (`:168`), 2 structurally immune (`:218`, `:231`), 1 lower-risk prose
      branch (`:198`). Record the count in the PR; zero further matches is a
      real answer and worth stating.
      verify: the PR body carries the count and the file list.

## Phase 2 — The lineage gate can express direction

- [ ] **2.1 A successor is not an omitted parent.** A sibling declaring
      `supersedes_proposals:` (or `supersedes:`) over the consolidating file
      is reported as a succession, or not reported at all — never as
      `omitted-sibling`.
      verify: a fixture pair where B supersedes A yields no omitted-sibling
      finding on A, and the inverse pair still does.
- [ ] **2.2 A prose-named parent gets its own finding class.** A parent named
      only in prose, with no slug and no backticks, reports as
      `unresolvable-parent` — distinct from `missing-parent`, which means a
      slug that resolves to nothing.
      verify: a fixture declaring a parent in prose yields
      `unresolvable-parent` and not `missing-parent`.
- [ ] **2.3 Re-run over the round that found this.** The folder that produced
      3 findings produces exactly 1, and that one is the genuine prose-named
      ghost.
      verify: the gate's output over
      `agents/tmp.old/inbox-2026-10-t/topic-2/` is pinned as a fixture
      expectation.

## Phase 3 — The guard judges a write, not a mention

- [ ] **3.1 Red first: the two commands this round was refused.** Pin both as
      polarity cases on `creatableTokens` and on the envelope path — a
      read-only `ls` of an existing inbox directory, and a `printf` whose
      single-quoted literal names one. Both must be **allowed**; a `mkdir -p`
      and a `> file` redirect into a new speaking directory must stay
      **blocked**.
      verify: the two allow-cases are red and the two block-cases are green
      before any change. A change that makes all four green without the first
      two having been red has not reproduced M5.
- [ ] **3.2 Reach the already-exists carve-out from the Bash path.** A token
      naming a directory that exists on disk takes the same
      `directory already exists — rename, do not re-refuse` branch the
      `_PATH_KEYS` path already takes (`:338-341`). This alone clears M6 and
      changes no policy: the name is still speaking, and a rename is still
      the fix.
      verify: the `ls` case from 3.1 passes; `mkdir -p` into a **new**
      speaking directory is still refused.
- [ ] **3.3 Do not judge a token inside a quoted literal as a target.**
      `creatableTokens` splits on `'` and `"` among other characters, so a
      path inside a single-quoted string becomes a bare token. Keep the
      conservative scan, and exclude only the case M7 names: a token whose
      sole occurrence is inside a quoted literal that is an argument to a
      command writing nothing.
      verify: the `printf | link_crypto encrypt` case from 3.1 passes; a
      heredoc body calling `makedirs` on a speaking directory — the case the
      raw-command scan exists for — is still refused.
- [ ] **3.4 Make the remediation reachable as written.** The command in the
      guard's error text must execute unchanged in a tree where the speaking
      directory exists.
      verify: a test runs the literal command from the message against a
      fixture and asserts it is not blocked.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Match the sibling branch rather than rewrite `normalizeParent` | `:168` already does the right thing on the same input shape; changing the shared helper would touch 4 call sites that are correct today | a sixth call site arrives with a different input shape |
| D2 | reversible-technical | evidence | Keep the guard's conservative token scan; narrow only the two reproduced false positives | the docstring records that a cleverer classification was tried and removed; widening it again is how the bypass comes back | a third false-positive class is measured |
| D3 | critical-technical | agent | The already-exists carve-out is a policy no-op for the Bash path | the `_PATH_KEYS` path already takes it; reaching it from the other path makes two entry points agree rather than loosening either | the carve-out is removed from the `_PATH_KEYS` path |
| D4 | deterministic | evidence | A prose-named parent is a distinct finding, not a missing one | the round's one genuine finding is exactly this shape, and reporting it as `missing-parent` sends the reader looking for a file | — |
| D5 | reversible-technical | agent | Both gates are fixed in one roadmap | they are the same failure — a parser reporting what its input does not say — and one of them blocks the documented remediation for the other | either fix grows past a few lines |

## What this roadmap deliberately does not do

- It does not change what either gate is for. The naming rule and the lineage
  obligation are unchanged; only what the parsers can see changes.
- It does not loosen the speaking-name policy. A new speaking directory is
  still refused, by both entry points.
- It does not touch `normalizeParent` itself, or the three call sites that are
  correct.
- It does not add a command classifier to the guard. D2 records why.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Narrowing the guard reopens the bypass its docstring records | implementation | A quoted-literal exemption is an exemption, and a creation can be written as one. | 3.3 excludes only a quoted literal passed to a command that writes nothing, and the heredoc-`makedirs` case — the exact input the raw scan exists for — is a block-case in the same test. Both polarities are asserted. | Phase 3 — The guard judges a write, not a mention |
| 2 | The already-exists carve-out lets a rename be skipped | product | A speaking directory that exists keeps working, so nobody renames it. | That is already the behaviour on the `_PATH_KEYS` path, and the carve-out's own comment states the reason: refusing every later write wedges the round without removing the name. The rename obligation is the naming rule's, not the guard's. | Phase 3 — The guard judges a write, not a mention |
| 3 | The lineage fix hides a real missing parent | implementation | Stripping quotes makes more strings resolve, so a genuinely absent parent could start resolving to something. | A stripped quote changes only the token boundary, never the slug; 1.1 asserts the resolved value exactly, and 2.3 pins the whole output over a real folder. | Phase 1 — The lineage gate parses what is declared |
| 4 | The succession check mis-reads a legitimate omission as a succession | implementation | A file that declares `supersedes_proposals:` loosely gets a free pass. | 2.1 asserts the inverse pair still reports; the exemption is keyed on an explicit declaration, not on a date or an inference. | Phase 2 — The lineage gate can express direction |

## Acceptance Criteria

- [ ] **AC-1** `normalizeParent('"road-to-x" — note')` returns `road-to-x`,
      and a quoted block-list `consolidates:` entry resolves; both cases were
      observed **red** first and the observation is in the PR.
- [ ] **AC-2** Re-running `lint_consolidation_lineage` over
      `agents/tmp.old/inbox-2026-10-t/topic-2/` yields exactly **1** finding,
      and it is the prose-named ghost.
- [ ] **AC-3** A sibling declaring supersession over the consolidating file
      produces no `omitted-sibling` finding; the inverse pair still does.
- [ ] **AC-4** A prose-named parent reports as `unresolvable-parent`, not
      `missing-parent`.
- [ ] **AC-5** A read-only `ls` of an **existing** inbox directory and a
      `printf` naming one inside a quoted literal are both allowed; a
      `mkdir -p`, a `>` redirect and a heredoc `makedirs` into a **new**
      speaking directory are all still refused. All five asserted in one
      polarity suite.
- [ ] **AC-6** The remediation command printed in the guard's own error text
      executes unblocked against a fixture.
- [ ] **AC-7** The defect-pattern sweep for `normalizeParent` without a quote
      strip is reported with its count and file list.
- [ ] **AC-8** `task ci` green.

## Notes — how this file was derived

Internally originated: both defects were reproduced by this round's own run,
not proposed by a source document, so no gap table or provenance block is owed
under template rule 19. The lineage defect was surfaced by the gate's own
output over a real folder and then traced to the parser; the guard defect was
hit twice while executing the guard's own instructions, which is the strongest
available evidence that the false-positive class is reachable in normal use
rather than contrived.
