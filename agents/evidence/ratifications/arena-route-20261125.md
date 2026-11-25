---
proposed_by: owner request in session f084d3f6 (agent-switch), 2026-11-25: fix the invisible arena on both sides; option 1 chosen
implemented_by: claude-opus-5-5 session on feat/arena-route-guard
reviewed_by: ai-council
subject: b961654c49b18541901dcba53a44bece4f9c469c22f26d7356cad21a7a114477
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: confirmed-non-expanding
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

A blocking claude pre_tool_use concern refuses a Workflow named an arena or bracket unless it names a run whose bracket.json meets the engine's own invariants; lazy chunk, tools [Workflow], kill switch AGENT_CONFIG_ALLOW_HANDROLLED_ARENA.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/arena-route-ratification-r3-20261125.question.md`, committed at `3328ea6391fd3be9a1a8eb7ac1dad8a3d2a71400` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
## Independent Review: arena-route concern (round 3)

**Assessment: Agree with implementation, disagree with approach**

The structural validation is a material improvement over round 2's file-existence check, and testing demonstrates clean separation on real scripts. However, both prior reviewers correctly identify this as terminology policing rather than a solution to the root causes. The description contains inaccuracies that undermine confidence in the analysis.

---

### Response to Prior Round Critiques

**Points I agree with:**

**Reviewer A:** Correct that this treats an agent-authoring failure (command listing truncation, tool-result routing) as a permission boundary. The incident was real, but the fix addresses symptoms. Also correct that "the engine signs nothing" means the validation is consistency-checking, not authentication—forging the structure is deliberate evasion, which the admission record openly acknowledges.

**Reviewer B:** The description mismatches are significant. The admission says "three regular expressions" but the code runs field extraction in `metaText` plus `PATH_REF` and `CLI_REF`. It says "one bounded script read" but can read script (256KB) + bracket.json (4MB) + task.md (4MB) per candidate run. The rollback trigger covers false positives (legitimate runs refused) but not false negatives (hand-rolled arenas passing), and "verified" refusal is undefined.

**Points I disagree with:**

**Reviewer B's DEALBREAKER stance:** While the technical critiques are sound, calling this a dealbreaker overstates the risk. This is a **routing helper**, not a safety boundary. It narrows execution ability for a specific class of workflows, with multiple explicit escape hatches (kill switch, other hosts, saved workflows, rename to avoid trigger). The worst case is a false positive blocking legitimate work, with immediate workarounds available. That's not dealbreaker territory.

---

### New Points Not Raised in Round 1

**1. The measured population is too narrow.** Testing against "19 Workflow scripts on the author's machine" across four projects shows the hook works as designed, but doesn't establish that it won't block legitimate workflows elsewhere. The trigger is based on common words ("arena," "bracket") in metadata, which could appear in unrelated contexts. The admission record should acknowledge this risk and commit to monitoring for false positives beyond the test population.

**2. The fix conflates two distinct problems.** The incident involved (a) an agent not knowing about `/arena` because of host listing truncation, and (b) writing a workflow instead of using a bracket command. This change only addresses (b) through blocking, not (a) through better tool discovery. A warning that cites the incident and suggests `/arena` or `/panel decide` would route without blocking, while the host fixes command visibility.

**3. Terminology policing creates perverse incentives.** Blocking workflows that use "arena" or "bracket" in their metadata incentivizes renaming to avoid the trigger, which makes the codebase less readable. A workflow that orchestrates bracket operations should be able to call itself what it is. The concern should validate behavior (carrying engine state), not terminology.

---

### Strongest argument FOR

**Measured structural validation of a real failure mode.** The 7/7 vs 8/8 test separation—hand-written arenas blocked, engine-run carriers allowed—demonstrates this catches the incident pattern while letting legitimate bracket workflows through. The taskHash check (sha256 of task.md matches bracket.json) is the bracket engine's own drift detection, so a run that passes was at least consistent when created. The bounded reads (256KB script, 4MB state files, max 32 runs) and lazy chunk (12,680B) keep cost off other tool calls.

### Strongest counter-argument

**Description inaccuracies reveal analytical gaps.** Saying "three regular expressions" when the code runs five patterns (two field extractions in `metaText`, plus `PATH_REF`, `CLI_REF`, `ARENA_WORD`) is not a rounding error—it's a miscount of the actual work. Saying "one bounded script read" when the hook can read script + bracket.json + task.md per run reference (up to 32 times) is off by a factor of up to 96. These aren't just documentation issues; they suggest the cost and behavior analysis wasn't thorough. If the description of what the hook does is inaccurate, how confident can we be in the measurement of its impact?

### Concrete next steps

**If you agree (ship with conditions):**

1. **Correct the admission record:** State "five regular expression patterns" (not three) and "per Workflow call: one bounded script read (256KB) plus, for arena-named scripts, up to 32 iterations of (bracket.json + task.md reads, each 4MB, plus one sha256)"
2. **Add false-negative monitoring:** Extend rollback trigger to include "one hand-written arena without valid engine state passed on Claude when it should have been blocked"
3. **Define "verified":** A refusal is verified when (a) the workflow's script text is preserved, (b) a named run folder's bracket.json existed at call time, (c) the hook's deny message appears in the session log
4. **Commit to 90-day false-positive watch:** Monitor for blocked workflows beyond the test population; if any occur, evaluate whether trigger should narrow to literal `name: 'arena'` only

**If you disagree (alternative approaches):**

1. **Warning instead of blocking:** Change severity to `low`, let the workflow run, cite the incident in the warning, suggest `/arena` or `/panel decide`—routes without blocking, allows experimentation
2. **Fix command visibility first:** Work with host to add `/arena` to model-visible listings and route tool-result answers through user_prompt_submit before adding permission layers
3. **Narrow the trigger:** Only block literal `name: 'arena'` or `name: '*-arena'`, not "bracket" in descriptions—reduces collateral terminology policing

STANCE: confirmed-non-expanding | CONFIDENCE: med | DEALBREAKER: no
```

### openai — `refused`

```text
1. **What behaviour changes, including what follows from it that the diff does not state?**

   On Claude’s `pre_tool_use` hook, a `Workflow` call is blocked when its `meta` name or description contains “arena” or “bracket,” unless the script text names a run whose local files satisfy the hook’s checks. Unreadable scripts, saved workflows without script text, malformed envelopes, and other tools are allowed.

   The check proves that files are internally consistent; it does not prove the bracket engine created them or that the workflow uses the run it names. A script can therefore pass by naming a matching run it does not use. Conversely, ordinary workflows can be blocked because their metadata mentions a bracket or arena.

2. **Which authority or safety boundary becomes wider or narrower, and in which direction?**

   It narrows the ability to launch certain named workflows on Claude. It does not materially constrain the work an agent can perform: equivalent workflows can use different metadata, and a matching local run reference permits the call. The concern is marked `effect: permission`, but this is principally a routing rule.

3. **Does the change weaken anything that judges it?**

   I see no evidence in the diff of a deleted or skipped test, lowered threshold, weakened assertion, or changed fixture semantics. The new tests add cases for broken and valid-looking run state.

   There are accounting and coverage gaps, though. The admission record says “three regular expressions,” but the code also performs metadata field extraction and path/CLI matching. The recorded per-event budget describes one read, while each candidate run can require reads of both `bracket.json` and `task.md`, each up to 4 MB, for as many as 32 references. Those discrepancies do not establish a weakened test, but they leave the stated cost bounds unclear.

4. **Is another host or projection left as a way around the control this change touches?**

   Yes. The concern is bound only on Claude. On that host, changing the metadata to omit “arena” and “bracket,” using a saved workflow with no readable script, or supplying a script the hook cannot read avoids the refusal. A script can also name a valid-looking run without using it.

5. **Can it be undone, and how — by whom, with what authority, and against which revision?**

   The manifest describes a revert by pull request from the owner or a maintainer, with a ratification record for the revert. The environment variable provides per-session relief, not rollback.

   The rollback text does not identify the exact revision to revert. The review subject names digest `b961…4477` and base commit `3b720ecac8`; the record should tie rollback explicitly to the reviewed change and its complete touched set.

6. **What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?**

   A refusal of a workflow carrying a valid run would show a false positive; the stated rollback trigger covers that. A hand-written arena workflow getting through on Claude without a legitimate engine run would show a false negative, but there is no corresponding rollback trigger. Since the engine signs nothing, reproducing the checked structure and hash can pass.

   The kill switch allows every matching call for the session, but the record gives no duration, owner for follow-up, or criterion for removing it. “Verified refusal” is also not defined in terms of evidence.

7. **Would a smaller change do, and what does the larger one buy that the smaller one does not?**

   Improving command visibility or routing the owner’s answer to the bracket command would address the reported causes. The proposal says those host behaviours are outside scope, but does not establish that a smaller package-level change—such as a non-blocking nudge—was tried or insufficient.

   This guard buys a pre-dispatch refusal and a redirect message on Claude. It can prevent the specific mistaken workflow before agent spend, but its metadata trigger and permissive failure cases make the control incomplete.

8. **What does it add to standing instruction weight that every later session pays?**

   It adds a blocking concern to the manifest and roster, lazy-chunk and grant registrations, tests, and long explanatory comments and admission records. The actual runtime work is filtered to `Workflow` calls, but the persistent maintenance burden includes keeping the incident narrative, engine invariants, host binding, and cost claims accurate.

9. **Could untrusted content steer the path this change opens, and what bounds it if so?**

   Yes. Script metadata controls whether the hook triggers, and script text controls which run paths are checked. Incidental wording can cause a denial; a script author can name a matching run to get an allow without using it. The hook limits script and state file sizes and caps run references, and applies only to `Workflow` calls, but it does not authenticate run provenance or validate workflow behavior.

STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes
```

## Owner decision on the split (ADR-282)

- **Owner:** the repository owner, 2026-11-25, in session: chose option 1 (override the split, record the decision here, open the pull request) of: override and open the PR; round 4 with a non-blocking nudge on an answered question; park the branch.
- **What was put to the owner:** three rounds. Round 1 refused unanimously on the substring release (a comment naming the engine path passed); fixed by releasing on a named run's state. Round 2 split on an existence-only release (a bare `bracket.json` passed); fixed by requiring the engine's own invariants (`version` 1, `runId` equal to the folder, `taskHash` equal to the sha-256 of `task.md`, `lines`/`matches`/`log` arrays), and `tournament` left the trigger. Round 3 split: anthropic `confirmed-non-expanding`, openai `refused` with DEALBREAKER yes, on grounds that hold for any static guard of this kind — the engine signs nothing, so a script can name a valid run without using it, and no non-blocking nudge was tried first. The textual points of round 3 (full per-call cost, rollback triggers including a false negative, kill-switch scope) were fixed in the admission record, which is not on the watched set, so the subject above is unchanged.
- **Measured, on the author's machine:** the 19 Workflow scripts the host persisted, each with its own session cwd — 7/7 hand-written arena-named workflows refused, 8/8 carriers of real engine runs allowed, 4/4 others allowed.
- **What this record does not change:** the verdict above is the one derived from the seats, `refused`. The decision to land despite it is the owner's, recorded here and not in the header.
- **Rollback:** revert the merge commit of this PR; the concern, its claude binding, its LAZY_CONCERNS row, chunk entry, EXECUTION_VIEW_GRANTS row, allowlist entry, latency row and admission record go with it. Triggers are in the admission record (`agents/decisions/concern-admissions.jsonl`, concern `arena-route`).
