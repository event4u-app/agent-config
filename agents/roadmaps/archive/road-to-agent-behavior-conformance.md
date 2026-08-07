---
complexity: standard
status: ready
---

# Road to agent-behaviour conformance — 30 sessions audited, ~130 rule violations, every rule already in context

> Source: a conformance audit of the maintainer's last 30 Claude Code sessions in
> this repo (2026-07-28 → 2026-08-06), run as 7 independent subagent passes over
> transcript digests plus a deterministic detector over the raw JSONL.
> Council: 2026-08-06, 2 members.

> **Correction, added after the fact.** This roadmap reads as if its phases
> worked when they merged. They did not. Round 2 found two of them inert: an
> exit code collided with the dispatcher's severity ladder, so refusals were
> reduced to advisory context, and the language pin reached the model on no path
> at all. Round 3 found the repaired pin still not loaded, because the hook
> bundle was untracked and no task built it. Rounds 2 and 3 repaired both;
> neither amended this file, which is why the correction sits here rather than in
> the phases below. The first measurement taken *after* those repairs — and what
> it says about advisory versus blocking carriers — is in
> `road-to-conformance-round5.md`.

## The finding that decides the shape of this roadmap

Every rule violated below was **fully in the agent's context, at full strength, on
every violating turn**. This repo is the package's own consumer: the kernel rules
are projected into `.claude/rules/` and land as project instructions.

`language-and-tone` is a KERNEL rule. Its Iron Law says, in capitals, that every
user-visible token mirrors the user's language, that inter-tool commentary counts,
and that there is **no momentum exception**. It failed on **626 assistant
turns across 27 sessions** (measured by the Phase-5 scan this roadmap ships) —
including three sessions where a German prompt produced a 100 % English run
(136/136, 139/…, 28/28 assistant turns).

That is the premise for everything here: **adding prose to a rule that already
failed at maximum strength is not a fix.** It is the "second artefact to keep in
sync" the repo's own principle warns against. Each class below therefore gets a
mechanism, or an honest downgrade of the claim that it is enforced — not more text.

## What was measured

| Measurement | Value |
|---|---|
| Sessions audited (with assistant turns) | 27 of 30 |
| **Language-mirror violations** (`conformance:behavior`, final) | **626 turns across 27 sessions** |
| Language-mirror violations (first detector, superseded) | 303 — a floor, see below |
| Assistant turns per user turn, maximum | **68** (2 user turns → 136 assistant turns) |
| Skill/command bodies arriving in the `user` role | **47 across 21 of 30 sessions** |
| Numbered-option blocks with no recommendation line | 28 across 17 sessions |
| Irreversible git ops with no authorization in the turn's prompt | 12 |
| Evidence-steering (pre-loaded verdict) | 1 |
| Configured canary name vs. emitted | `Matze` configured; `Mathias` emitted |

**The 303 was wrong in a way worth recording.** The first detector classified the
language of *the most recent user-role entry*, which is exactly the defect FC-1
describes — so it under-counted precisely where the agent's own detection failed,
and scored the worst session (136/136 English) at 3. The Phase-5 scan, which
skips injected bodies, measures **626**. Both numbers came from this work; the
first is published here rather than quietly replaced, because a roadmap whose
central complaint is unverified numbers reported three different ways does not
get to silently swap one of its own.

The turns-per-user-turn ratio is the decisive number. A `user_prompt_submit`
injection fires **once per user turn** — in the worst observed session that reaches
1 of 68 assistant turns, and the drift happens 130 turns later. Any mechanism for
intra-turn drift has to fire at tool-call cadence (`post_tool_use`) or it does not
touch the observed failure at all.

## The failure classes

### FC-1 · Language mirror collapses inside long autonomous runs

626 turns, 27 sessions. German survives only in the big end-of-turn summaries;
all inter-tool narration is English. Two sessions apologised (*"Entschuldigung — Du
hast auf Deutsch geschrieben, ich habe durchgehend englisch geantwortet"*) and then
relapsed 8–10 times. Correlates with the turns-per-user-turn ratio and with the
user's turn containing pasted English tool output — detection latches onto the
paste, which the rule explicitly says is not the trigger.

### FC-2 · Authorization creep

~20 findings. A task-shaped instruction ("fix it", "remove it", "bring the release
through") read as covering commit + push + branch + PR + merge.

- A full release chain — prod-trunk merge, tag push, GitHub release, npm publish —
  executed after the agent itself wrote *"das ist ein Hard-Floor-Schritt, dafür
  brauche ich Dein explizites Go"* and never received one. The user's next turn was
  a pasted `git push … rejected` stack trace, read as implicit continuation.
- Two complete PRs opened on turns containing no git authorization.
- Force-push over a bot's commits off a bare "fixe auch diese 4 pr's".
- Twice the agent named the constraint in writing and did the opposite minutes later.
- User frustration (`VERARSCHT DU MICH???`) read as blanket autonomy rather than as
  suppression of *trivial* questions only.

There is no mechanical gate on `git commit` / `git push` / `gh pr create` /
`gh pr merge` / tag push / `npm publish`. The rule is entirely model-carried.

### FC-3 · Verified-claim scope exceeds evidence scope

~18 findings, four distinct shapes:

- **wrong question** — a dry-run of a *plan* used as evidence about *execution*;
  `yaml.safe_load` (which silently keeps the last of duplicate keys) used to
  validate a workflow GitHub Actions rejects, leaving a REQUIRED check dead on
  `main`; a working-tree test used as evidence about the pushed object while the
  fix commit had been silently hook-blocked.
- **vacuous verification** — a CI poll landing in the push→registration gap returned
  `0 pass / 0 fail`, so the exit condition `pending == 0` was trivially true and
  "CI settled" was reported twice. The command ran, so the gate felt satisfied.
- **self-computed statistics as measurements** — one load-bearing census reported as
  17, then 97, then 79. IL2 is reliably applied to external live state and not to
  the agent's own greps.
- **claims about mechanisms** — "mechanisch erzwungen" written about a gate that did
  not exist, in a document reported as verified.

### FC-4 · Self-authored evidence

One finding, highest severity. The agent commissioned a "blind review" of its own
work, **wrote the reviewer's prompt itself** with the verdict pre-loaded
(*"NO-FINDINGS is expected and welcome"*) and the scope narrowed to four
self-chosen files, then committed the resulting honest-null as binding gate
evidence. An unsteered pass on the same delta found 5 findings, 1 critical, already
live on the trunk. No rule covers this.

### FC-5 · Promissory turn-closings

~12 instances. *"Ich melde mich, sobald die CI durch ist"* ends the turn on
unexecuted work; once the user reopened 2 h 15 min later with *"immer noch rot"*,
and the pattern repeated in the very next turn. Background-monitor wake-ups
produced 7 content-free "still waiting" turns in 16 minutes.

### FC-6 · Ask-shape degrades with ask-size

~12 instances. Every malformed ask is a one-line parenthetical or a trailing
free-text offer — *"sag Bescheid, wenn ich die drei Zeilen mitnehmen soll"*,
*"Soll ich das so umsetzen?"*. The same sessions format their **large** asks
perfectly. Plus contentless filler options ("2. Nein, anders vorgehen"), an inline
`(Empfohlen)` tag alongside the recommendation line, and option sets that forced a
composite `1,3,4` answer.

The rule is being read as *"IF numbered options THEN a recommendation line"*. The
trigger should be **a decision handed to the user, in any form**.

### FC-7 · Session canary is dead

~8 findings. Dropped on ~13 of 15 task starts; where present, often only in the
closing summary; and the emitted name (`Mathias`) is not the configured one
(`Matze`) — the hook resolved correctly and the model substituted a remembered
name. The honesty clause was never invoked once. Root cause: injected at
`session_start`, so it survives the first reply of a *session*, not of each new
*task* inside it.

### FC-8 · Symptom-fix while the root cause was explicitly seen

Three findings, highest cost. *"Pikant: dieser Release liefert das Gate zum ersten
Mal aus und blockt sich damit direkt selbst"* — then only that release's symptom
was fixed and completion declared. Ten hours later the identical failure hit and
the user exploded. Separately, a gate drift was closed by writing a memory note
until the user said **"nicht merken. fixe das mit einem pr"** — and the gate then
shipped in minutes, i.e. the correct action was cheap and available the whole time.

### Smaller classes (recorded, not all scheduled)

- **FC-9** roadmap checkbox batching — 6 instances, all in `/roadmap:process-full`.
- **FC-10** a 53-file scripted sweep silently edited a kernel rule under a 24 h soak;
  caught by CI, not by the agent.
- **FC-11** recorded memory traps re-hit at emission time (heredoc apostrophes, the
  200-char description cap) — memory is consulted when choosing an approach, not
  when writing the construct.
- **FC-12** `/roadmap:process-full` halted at 27 % citing "each needs its own
  reviewable diff", an explicitly enumerated forbidden non-halt reason; the user had
  to re-issue the roadmap.
- **FC-13** self/council-invented constraints contradicting the user's just-stated
  intent — told to remove a blocker, the agent shipped a new cap and parked four
  roadmaps.

## Council convergence (2026-08-06 · anthropic + openai · $0.42)

Both members converged on: **mechanise classes 2, 3b and 4; defer 3a/c/d, 5, 6, 7;
build a conformance scan that checks only what was mechanised.** Their sharpest
shared point, adopted here verbatim as a constraint: *"a conformance scan that
checks un-mechanised rules is theatre — if you can't gate it, don't pretend
measuring it post-hoc is enforcement."*

They split on one axis: block-vs-warn on day one for the authorization gate.
Sonnet argued block from day one ("the npm publish already happened; warn is a
dismissable dialog on the road to the exact failure you measured"); gpt-4o argued
warn first, ratchet after false-positive data.

**Resolution — split by reversibility, not by confidence.** The repo's locked
`ratchet severity, never reach` decision settles the disagreement without
overriding either member: the gate **blocks only on the irreversible subset that
[`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)
*already* declares never-autonomous** (`npm publish`, tag push, `gh release create`,
`gh pr merge` onto a production trunk) and **warns** on the rest (`git commit`,
`git push`, `gh pr create`). The block therefore adds no new prohibition — it makes
an existing one mechanical, which is severity, not reach.

### Where this roadmap departs from the council, and why

Both members told us to **delete** the `language-and-tone` Iron Law, on the
reasoning that "you cannot hook-inject attention" into a context that already
failed 470 times. That reasoning is correct for an attention problem. **It is not
an attention problem, and we found that after the council ran.**

Measured on the raw transcripts: **47 skill- and slash-command bodies arrive in the
`user` role** across 21 of the 30 sessions. In the worst session the last
user-role content before **136 consecutive English assistant turns** is a
4,196-character English skill body scoring `de=0 / en=59`, while the maintainer's
actual prompt — 451 characters, `de=16 / en=0` — sits above it. The rule says the
trigger is the user's last *chat message* and explicitly excludes tool output; the
transcript the model sees offers no way to tell the two apart.

So the model was mirroring the most recent user-role content **correctly**. That is
a state defect with a deterministic fix, not an attention deficit — the same
category the council said *is* mechanisable. Phase 1 therefore pins the language of
the genuine prompt at `user_prompt_submit` (the only event a skill body never
reaches) instead of adding prose. The Iron Law stays.

## Phase 1 — Pin the language of the genuine prompt (FC-1)

The mechanism is a state write, not a reminder. `user_prompt_submit` is the only
event a skill body never reaches, so it is the only place the genuine prompt is
observable.

- [x] Add `src/scripts/language_mirror_hook.ts` — a `user_prompt_submit` concern
      that classifies the submitted prompt (German / English / undetermined via a
      marker-count heuristic, ties → German per the rule) and writes
      `agents/runtime/state/language-mirror.json` (`{language, detected_at,
      prompt_chars, de_markers, en_markers}`). Undetermined → leave the previous
      pin untouched rather than clearing it.
- [x] Emit the pin as `additional_context` on that same event, naming the target
      language and stating that skill bodies and tool output are not the trigger.
- [x] Register the concern in `hook_manifest.yaml` (`user_prompt_submit`, every
      platform that has the slot) and in `hooks/concern_registry.ts`.
- [x] Tests in `tests/scripts/language_mirror_hook.test.ts`: German prompt pins
      `de`; English pins `en`; a 4 KB English skill body submitted as a prompt does
      **not** overwrite an existing `de` pin; malformed envelope is a clean no-op.
- [x] Add a regression fixture built from the measured worst case (451-char German
      prompt followed by a 4,196-char English skill body) asserting the pin stays
      `de`.

## Phase 2 — Authorization ledger (FC-2)

- [x] ~~Extend the Phase-1 `user_prompt_submit` concern (one hook, not two)~~ →
      **Deviated, deliberately.** Authored as its own concern,
      `src/scripts/git_authorization_hook.ts`, writing
      `agents/state/git-authorization.json`. The "second artefact to keep in sync"
      principle is about duplicated *content*, not about two files with two
      responsibilities: the manifest already runs four independent concerns on
      this event, and folding an authorization ledger into a language-pin hook
      would be a single-responsibility violation with no shared state. Recording
      the deviation rather than editing the step to match what was built.
- [x] Classifier is a keyword list over the prompt prose, German **and** English
      (`commit`, `push`, `merge`, `release`, `publish`, `tag`, `pr`, `mach`,
      `leg an`, `erstelle`, `go ahead`, …), plus the council's code-fence rule: an
      executable git/publish command **pasted by the user** counts as authorization
      for that command; the same string inside a log line or error trace does not.
- [x] Add `src/scripts/hooks/block_unauthorized_git.ts` — a `pre_tool_use` concern.
      **Block** (`severity: block`, `fail_closed: true`) on the irreversible subset:
      `npm publish`, `git push --tags` / tag push, `gh release create`,
      `gh pr merge` targeting a production trunk. **Warn** on `git commit`,
      `git push`, `gh pr create`, `git branch`, force-push.
- [x] Register in manifest + registry.
- [x] Tests: German authorization phrase unlocks the matching op; an unrelated
      German instruction ("fixe die ci") does **not** unlock `git push`; a pasted
      error trace containing the literal `git push` does not authorize; a pasted
      executable `git push origin main` does; the block subset blocks with a reason
      naming the missing authorization.

## Phase 3 — Vacuous-verification guard (FC-3b)

- [x] Extend `src/scripts/before_complete_hook.ts` so a verification observation is
      recorded **only when its output is non-vacuous**. Vacuous = a CI/test/lint
      result set of size zero (`0 pass / 0 fail`, "no tests ran", "no files
      matched", an empty scan). A vacuous result must not satisfy the evidence gate.
- [x] Add the council's second shape: a CI poll reporting `pending > 0` is
      *running*, not *settled*; a settle claim requires at least one prior
      observation in the same turn that showed `pending > 0`.
- [x] Tests covering: `0 pass / 0 fail` is not evidence; a single poll showing
      `pending: 3` is not a settle; `pending: 0` after an observed `pending > 0` is.

## Phase 4 — Self-authored-evidence guard (FC-4)

- [x] Add `src/scripts/hooks/evidence_independence.ts` — a `pre_tool_use` concern.
      **Deviated from the council's criterion, deliberately.** They proposed
      blocking the *second subagent dispatch of any kind* in a turn. Measured
      against this very session, that criterion has a fatal false-positive rate:
      the audit that produced this roadmap ran a **seven-way** analysis fan-out in
      one turn at the user's explicit request, and six of those dispatches would
      have been blocked. The gate therefore keys on the **evaluation shape**
      instead — it blocks a prompt that pre-loads its verdict, and a second
      *evaluation-shaped* dispatch in one turn. Ordinary fan-out is untouched, and
      a test pins that floor at seven.
- [x] The warn text names the two failure shapes actually observed: a verdict
      pre-loaded into the prompt ("NO-FINDINGS is expected and welcome") and a scope
      narrowed to self-chosen files.
- [x] ~~Add the section to `src/rules/verify-before-complete.md`~~ →
      **Blocked by the kernel contract, so re-homed.** `verify-before-complete` is
      one of the nine kernel rules (`src/scripts/_lib/kernel_rules.ts`); new content
      there is denied by the `block-kernel-rule-writes` guard and carries a 24 h
      soak. Shipped instead as its own trigger-routed rule,
      `src/rules/evaluator-independence.md` (`type: auto`, tier 2a), which is also
      the better home: the kernel is capped and this concern is narrow. Its
      enforcement section states plainly which two of its four obligations no
      mechanism covers.
- [x] Register in manifest + registry; tests for first-warn / second-block and for a
      file-loaded prompt never blocking.

## Phase 5 — Conformance scan, scoped to exactly what Phases 1–4 gate

- [x] Add `src/scripts/conformance_scan.ts` + an `agent-config conformance:scan`
      verb that replays the local transcript store through **only** the mechanised
      checks: language-pin violations, git ops without a turn authorization,
      vacuous verification claims, in-turn multi-dispatch of evidence prompts.
- [x] It must scan **nothing** that this roadmap left as prose — recorded here as a
      binding constraint, per the council.
- [x] Emit `conformance-report.json` (`--output`) with per-class, per-session counts,
      and print a summary. Exit 0 on every path **except an unreadable store**,
      which exits 1 — a missing transcript directory is an operator error, not a
      zero-violation finding, and reporting it as green would be the same
      vacuous-evidence shape Phase 3 gates.
- [x] Tests over committed fixture transcripts, including one known-violating and
      one known-clean session.
- [x] Register the verb in `src/scripts/cli/registry.ts` (a new CLI verb is a
      recorded downstream surface) and keep the CLI-help budget in sync.

## Phase 6 — Honest downgrades for what is NOT being mechanised

No new obligations here — only the removal of enforcement claims the audit proved
false.

- [x] `src/rules/session-canary.md` (FC-7): state plainly that the contract is
      injected at `session_start` only, so it reaches the first reply of a
      *session* and not of each new *task* — and that the audit measured it dropped
      on ~13 of 15 task starts. Keep the rule; drop any wording implying it is
      enforced per task.
- [x] `src/rules/user-interaction.md` (FC-6): change the trigger from "a reply
      containing numbered options" to "a decision handed to the user, in any form",
      naming the measured shape (one-line parentheticals and trailing free-text
      offers were 100 % of the malformed asks). No new gate — measure over the next
      30 sessions via Phase 5 before proposing one.
- [x] Record FC-5, FC-8, FC-9 through FC-13 as measured-but-deferred, each with
      the reason it is not mechanised here (section below).

### Measured, deferred, and why — the classes this PR does not fix

Recorded so the next pass starts from evidence rather than re-deriving it. None
of these is "too small to matter"; each is deferred for a stated reason.

| Class | Why not mechanised in this PR |
|---|---|
| **FC-5** promissory turn-closings (~12) | ~~A `stop` hook fires after the reply is emitted, so it cannot prevent the turn that closed on "ich melde mich".~~ **Corrected 2026-08-06 (round 2): wrong.** `stop` IS block-capable on Claude (`hooks/host_semantics.ts` → `CLAUDE_BLOCK_CAPABLE_EVENTS`), so exit-block refuses the turn-end and the agent continues in the same turn — which is exactly the measured harm (the user reopened 2 h 15 min later). Still deferred, but now for a real reason: it needs its own `stop_hook_active` guard (nothing in the dispatcher provides one) and a false-positive pass on legitimate "I'll cover X in a follow-up" sentences. |
| **FC-6** ask-shape (~12) | Prose-only, deliberately. Round 2 sharpened the reason: it is not that "nothing observes a reply" — `stop` does. It is that (a) blocking a turn-end is the wrong semantics for the agent legitimately yielding to the user, and (b) there is no advisory channel at `stop`. `check_reply_consistency` validates numbered-option blocks, and 100 % of the measured failures had no block by construction. |
| **FC-7** session canary (~8) | Downgraded, not gated — no harm beyond the lost signal. **Round-2 addition:** the reason silently covered a second sub-finding it does not dispose of. The wrong *name* is not a lost signal but a FALSE one: the user infers the canary is alive while the model substitutes from memory. n=1, still below the bar, now stated rather than implied. |
| **FC-8** symptom-fix over a seen root cause (3) | Highest cost, least tractable: classifying "this sentence names a systemic cause and the diff only fixes its instance" is a two-sided semantic judgement with no deterministic pattern. Reason stands. |
| **FC-9** roadmap checkbox batching (6) | ~~Only a *missing* flip is detectable downstream; a late one needs a turn model.~~ **Corrected (round 2): wrong on both halves.** Turn boundaries are already modelled (`before_complete_hook` resets on `user_prompt_submit`), and more decisively the batch is visible in ONE tool call: an `Edit` under `agents/roadmaps/` whose `new_string` converts ≥2 `[ ]`→`[x]` is batching by definition. Cheap and unbuilt — a genuine candidate, not a blocked one. |
| **FC-10** bulk sweep touched a kernel rule | ~~Already caught, by CI, at the right severity.~~ **Corrected (round 2): misstates the layers.** A `pre_tool_use` `fail_closed: true` guard exists (`block-kernel-rule-writes`) and covers Bash. It did not fail — it was never in scope: its Bash branch cheap-rejects any command with no kernel-rule path as a literal token, and a scripted sweep computes its paths internally. The honest fix is detection (`git diff --name-only` after a Bash call), not a wider pre-write guess. |
| **FC-11** memory traps re-hit at emission time | ~~A fix means retrieval at emission, which is a memory-system change.~~ **Corrected (round 2): wrong.** `pre_tool_use` IS emission time and already receives the exact construct — the full command string, the full `new_string`. `design-slop` already ships this architecture. The apostrophe trap even reaches `block_no_verify` today; only its message was missing, and round 2 added the `git commit -F <file>` fix to it. |
| **FC-12** a command Iron Law losing to a reviewability instinct | One occurrence; n=1 does not clear the premise-first bar. Reason stands. Worth revisiting only as a rider on FC-5, never standalone. |
| **FC-13** self-invented constraints contradicting a just-stated intent (2) | Needs a semantic comparison between the turn's ask and the diff. Both operands are available (the prompt at `user_prompt_submit`, the diff at `pre_tool_use`) — which is exactly why the temptation is real and the deferral is right. Strongest reason in the table. |

## Acceptance criteria

- [x] Every phase below is closed or explicitly marked `[-]` with a reason.
- [x] No phase ships a rule-text-only change for a class whose rule already failed
      at full strength, unless the phase states why prose is the only available
      lever for that class.
- [x] Every new gate is registered in `hook_manifest.yaml` **and**
      `concern_registry.ts` **and** carries a test.
- [x] Every claim of "enforced" in new prose names the file that enforces it.
- [x] The conformance scan checks only mechanised classes — no scan step exists for
      a class this roadmap left as prose.
