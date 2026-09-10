<!-- evidence-type: analysis -->

# Host confirmations — why they recur, measured over real traffic

The operator reported the same complaint the friction corpus was built for, in
its plainest form: the operator no longer wants to have to give confirmations
like this one, said with a blocked call attached and the host's own note that
**20 actions were blocked this session**. This record establishes what caused that call to prompt,
what the population of such calls looks like, and which half of the cause this
package can reach.

| | |
|---|---|
| **Instrument** | `./scripts-run src/scripts/autonomy_friction_traffic --store <store> --limit 40` (new in this change) |
| **Store** | `~/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config` |
| **Window** | the 40 most recent transcripts by mtime, less the measuring session → **39 read** |
| **Distinct Bash calls** | **7,569** (deduplicated by tool-use id) |
| **Measured on** | **2026-09-10** |
| **Base SHA** (`main` at branch point) | `7bf325f3b3e659d9d568780fe9ed46a10d6e502a` |
| **Instrument** | new on this branch — the base SHA above does NOT contain it, and a re-run needs this branch or its successor |

## 1. The reported call, and the three causes stacked in it

```
cd /…/ac-packcap && sed -i '' -e 's/…/…/' -e … docs/decisions/ADR-273-….md \
  && grep -c '…' docs/decisions/ADR-273-….md
```

The operator's user-global settings already allow `Bash(cd *)`, `Bash(sed *)`,
`Bash(sed:*)` and `Bash(grep *)`, with `defaultMode: auto`. Every segment
matched a rule and the call still asked. Three independent reasons, each
sufficient on its own:

1. **An allow entry does not decide anything in auto mode.** The host's
   permission documentation records the rules and the auto-mode classifier as
   two layers: the rules are consulted first, the classifier then judges what
   passes through. Auto mode auto-approves edits **in the working directory**;
   this write went to a sibling worktree, outside the session's working
   directory. No allowlist entry lifts that.
2. **A write-shaped grant does not persist.** "Yes, and don't ask again" saves a
   permanent rule for a read-only command and a session-lifetime one for a
   write-shaped command. So the operator can approve this exact shape today and
   meet it again tomorrow — which is precisely the complaint, and it is a
   property of the host, not a misconfiguration.
3. **The call was written in the most expensive available shape.** The same edit
   through the **Edit** tool is one call, needs no chain, and falls under a grant
   that does not expire. The shell path was chosen where a cheaper one existed.

Cause 1 is unreachable from here and cause 2 is not ours to change. **Cause 3
is, and it is the one this change addresses.**

## 2. What the population looks like

| Measure | Count | Share |
|---|---|---|
| Distinct Bash calls | 7,569 | — |
| Category A (this package hands the host an `allow`) | 126 | **1.7 %** |
| No allow emitted | 7,443 | 98.3 % |
| … disqualified by a shell metacharacter, before argv | 7,143 | 96.0 % of the uncovered |
| … naming a consequence operation | 21 | 0.3 % of the uncovered |
| … refused after the shape and the operation cleared | 279 | 3.7 % of the uncovered |
| Carrying the chain shape class | 5,585 | 73.8 % of all calls |
| Carrying the write-through-shell class | 306 | 4.0 % of all calls — **a floor** |

Top head tokens **among the uncovered** — a different denominator from the two
shape classes above, which are counted over every call: `cd` 3,573 · `git` 481 ·
`grep` 376 · `gh` 334 · `sed` 238 · `./scripts-run` 228 · `python3` 209.

Write shapes: `cat >` 216 · `sed -i` 66 · `python3 -c` opening a path for
writing 16 · `perl -i` 7 · `tee` 1.

**Why the write share is a floor and not a measurement.** The rules are a
positive list of five commands, so `echo >`, `printf >`, `jq >`, `awk >`,
`git show >` and `cp` all fill a file and none is counted; a heredoc whose body
performs the write is invisible by the same construction. A generic redirect
scanner would fire on `grep x f > out.txt`, where the shell is not the thing
writing — that is the trade the positive list buys, and 4.0 % is therefore
"at least".

**The load-bearing consequence: widening the head allowlist cannot move the
coverage figure.** 7,143 of 7,443 uncovered calls fail on the shape before their
argv is read, so the lever is the shape and not the list. The 279 that reach the
head list are an **upper bound** on head misses, not a count of them: a simple
command is also refused for a directory flag whose value escapes the working
tree, and that case is not separable from this bucket without reimplementing the
argv walk. The conclusion survives either reading — it is a ceiling, and the
ceiling is 3.7 %.

## 3. A lock, evaluated rather than cited

`autonomy_friction_corpus` pins two cases with their reasons recorded: a bare
`cd` costs one confirmation because *"the canon's answer is a directory flag,
not an allow for changing directory"*, and a compound command costs one because
*"a compound command is refused before its argv is read — a safe head token
must not be able to carry a second command"*. Both are the mechanism this
measurement puts pressure on, so the lock applies and was not routed around.

It was also not reopened here, for a reason the measurement itself supplies:
**the substitution the canon teaches is not covered either.** `category_a`
refuses a global option whose value is absolute, and every cross-worktree
invocation in this checkout writes an absolute path — so `git -C /abs/tree
status` carries no metacharacter and still gets no allow. Composing chains
per segment would therefore convert a large uncovered class into a slightly
smaller uncovered class. Reopening the lock is a live option; doing it on this
evidence, in this change, would have bought approximately nothing.

Pinned so a later run cannot mistake it for a preference:
`tests/scripts/autonomy_friction_traffic.test.ts` §
*"the recommended substitution is only covered with a RELATIVE path"*.

## 4. What changed, and the honest ceiling

The `chain-nudge` concern carries a second shape class — a Bash command that
fills a file — whose line names Edit and Write and states the expiry that makes
the substitution cheaper rather than merely tidier. The latch became per class,
so the write line is not silenced by an earlier chain line.

**The ceiling, stated plainly.** This is an advisory injection. It never blocks,
it fires at most once per class per session, and nothing observes whether the
agent then used Edit. It moves what the agent knows at the moment it matters,
which is more than the rule text alone reached — `token-efficiency` is
`type: auto` and its triggers match the prompt, and no prompt announces that
the next tool call will be a `sed -i`. It is not enforcement and this record
does not claim it as such. On a host with no `pre_tool_use` slot nothing fires
at all.

**What would falsify the choice.** A re-run of the probe over a later window
where the write-through-shell share has not fallen. The number to beat is
**4.0 % (306 of 7,569)** on 2026-09-10; the store, the window and the command
are in the table above.

**What that comparison can and cannot control, stated because the first draft
of this record overclaimed it.** Two confounders are now removed by the
instrument: calls are deduplicated by tool-use id, so a resumed session's
recopied turns are not counted twice, and the measuring session's own transcript
is excluded, because every call the probe makes lands in a file it is about to
read — two runs minutes apart reported 7,518 and 7,653 for the same tree before
that was fixed. What remains uncontrolled is the **window**: `--limit 40` names
the 40 most recent transcripts, and which files those are moves as new sessions
appear. So a later figure measures the window as well as the tree, and the date
above is part of the number rather than a note beside it.

## 5. What was deliberately not done

- **No widening of category A.** Whether a `pre_tool_use`
  `permissionDecision: allow` even suppresses the auto-mode classifier is not
  documented; the package's own note records the host string
  `permissionDecision=allow ignored: a confined session takes grants only from
  its command line`. Widening a boundary on an undocumented premise would buy
  an unmeasurable benefit for a real loss of a refusal.
- **No settings edit.** The user-global settings file and
  `.claude/settings.local.json` are outside this repository or gitignored, so
  neither is a change this package can ship.
- **No new rule prose.** The always-loaded budget has no headroom, and the
  obligation already exists in `token-efficiency`; what was missing was reach at
  tool-call time, which is a carrier and not a sentence.

## 6. Round 2 — what the neutral review changed

The completion review returned thirteen findings, five medium and eight low,
committed unedited before any of them was touched
(`agents/evidence/reviews/feat-confirmation-friction-write-shape.findings.md`).
Four had been executed against the shipped modules rather than read off the
diff, and all four reproduced here. What they cost, because the pattern is worth
recording rather than just the fixes:

- **Three false negatives and one false positive in a detector whose own comment
  claimed the opposite.** `cat <<'EOF' > out.txt` lost its redirect to the
  heredoc stripper — the most common spelling of the largest write shape.
  `tee -a f` was excluded by a lookahead meant to require a path. `sed -ri` was
  invisible because `-i` was required as its own token. And a quoted *mention* of
  the interpreter shape fired the rule — on a string this very change ships in a
  substitution table. The write count read 293 before and 306 after, but the
  window moved between the two runs, so that delta is **not** attributable to
  the fixes — the same caution § 4 states about a later comparison applies to
  this one, and the honest claim is only that each fix was reproduced
  individually.
- **A test row that was green for the wrong reason.** `tee -a` sat in the
  silence list described as passing for want of a path, while it actually passed
  on the flag. It was the false negative above, asserted as correct behaviour.
- **Three contradictory populations for one instrument**, because the first two
  figures came from throwaway scripts before the detectors were shared. Every
  number in the change now comes from the single run recorded above.
- **A private copy of the classifier's metacharacter class** in the probe, while
  the probe's header claimed shared detectors — and that copy computed the split
  the whole report turns on. Now imported, and pinned by an identity test.

None was critical or high, and the direction of the conclusion survived all of
them. That is the honest summary: the review did not overturn the finding, it
removed four ways the finding could have been wrong without anyone noticing.

## 7. Round 3 — the review of the fixes found four regressions in them

A second neutral review, over the fixed tree, returned twelve findings (4 medium,
8 low). Eleven of round 1's thirteen dispositions held; **four of the round-1
fixes had introduced new defects**, which is what most of round 3 was:

- **A crash on a shipped path.** Consolidating two latch reads into one dropped
  the shape guard the replaced helper had, and `JSON.parse` returns `null` for a
  latch file holding `null` without throwing — so a corrupted latch crashed the
  hook with an uncaught TypeError, against a header that promises every failure
  path returns allow. Reproduced end-to-end through the hook binary, fixed, and
  now driven by a test.
- **A false negative traded for a false-positive class.** Dropping the `tee`
  path lookahead to admit `tee -a f` made `tee -a`, `foo | tee | wc -l` and even
  `tee -a /dev/null` fire. The path token is now matched explicitly.
- **A letter match that was not a flag match.** The `perl` in-place rule matched
  an `i` anywhere in a flag cluster, so `perl -Mstrict`, `perl -MList::Util` and
  `perl -Ilib` all reported an in-place edit — the characters after `-M` and `-I`
  are a module name and a directory. The letter set is now closed.
- **The heredoc problem, moved rather than solved.** Reading the write rules off
  a quotes-only view fixed the lost redirect and created its mirror: a heredoc
  *body* mentioning `sed -i` fired the nudge. Neither existing view is right, so
  the write rules now read a third — heredoc bodies removed, the command line
  they sit on kept.

Each of the four spends the session's single write-class line on a false
positive, which the concern's own header calls worse than shipping nothing. That
is why they are recorded here rather than filed as nits: the failure mode of this
carrier is not a wrong verdict, it is a wasted one.
