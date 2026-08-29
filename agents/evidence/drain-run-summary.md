<!-- evidence-type: analysis -->
# Autonomous roadmap-drain run — 2026-08-29

One PR per roadmap, every decision routed to the AI council, no user in the
loop. This file is the run's only report.

## The queue, recomputed rather than taken

The seed order supplied with the run was stale — pinned at `c536dbd`, listing
36 roadmaps. The live inventory at `origin/main` was **7**, one of which
(`road-to-source-silence`) already carried an open PR (#1707, since merged by
another session) and was excluded as claimed. Six entered the queue.

| # | Roadmap | Start | End | PR |
|---|---|---|---|---|
| 1 | runtime-event-journal | 20/21 | archived | [#1712](https://github.com/event4u-app/agent-config/pull/1712) — merged |
| 2 | supervised-telemetry-collector | 0/28 | 3/28, `draft` → `ready` | [#1714](https://github.com/event4u-app/agent-config/pull/1714) — merged |
| 3 | experience-loop-broadening | 0/47 | 1/47 | [#1716](https://github.com/event4u-app/agent-config/pull/1716) — merged |
| 4 | capability-native-execution | 1/54 | 2/54 | [#1717](https://github.com/event4u-app/agent-config/pull/1717) — merged |
| 5 | governed-harness-evolution | 0/58 | 0/58 | [#1718](https://github.com/event4u-app/agent-config/pull/1718) — merged |
| 6 | council-topology-evidence | 3/77 | 4/77 | this PR |

**One roadmap archived. Five did not, and that is the honest outcome rather
than a shortfall.** They are large structural roadmaps whose remaining work is
engineering measured in weeks, and three carry conditions no autonomous run can
satisfy: a 21-day observation window, CI runners on two platforms that do not
exist in this repository, and two owner-reserved ADR questions.

## The recurring defect: three blockers no gate could see

Three live, maintainer-owned blockers across two files were written
`### <slug>` instead of `### blocker: <slug>`.
`src/scripts/lint_roadmap_blockers.ts:40` matches only the prefixed form, so
none of them parsed: `agent-config gates --all --json` reported **zero**
blockers for files carrying three between them, and `check_estate_count`
counted none. Every linter was green throughout, because a linter validates the
blockers it can see.

Both files come from the same inbox-harvest cohort. That makes it a pattern,
not a slip.

## Blockers whose `Resolved when` no single authority could discharge

Three blockers bundled a council-decidable half with an owner-reserved one, so
they were unsatisfiable as written. Each was split rather than quietly narrowed:

- **`b-adr-088-external-runtime-federation`** — parking the two AI-runtime
  classes is council-decidable and is recorded; declaring the four browser-engine
  adapters *outside* ADR-088's boundary narrows an accepted floor and is
  owner-reserved. The council caught the substitution that made the exception
  look safe: the argument reads "external **agent** runtimes" where the ADR says
  "external **tool** runtimes".
- **`merge-authority`** — Phases 1–6 are legal while ADR-239 § Decision 3 stays
  open; granting or refusing preauthorized merge authority is owner-reserved.
- **`b-requires-key-reserved`** — closed, on two premises that were **false**:
  `runtime_requires` is not unused (four skills carry it in frontmatter), and
  `CAPABILITIES.yaml` is not the draft's file (it exists, 323 lines,
  CI-drift-checked, landed in #1679).

## Council decisions

Seven council sessions, all 2/2 present, all subscription-authed at $0.00.

| Question | Verdict |
|---|---|
| Step 1.4's deferred disposition | **4/4 across two runs → B.** A `stubs/` file does not keep a criterion active in the estate |
| Phases 2–6 of supervised-telemetry-collector | **2/2 → B.** Rule 12 binds on the **execution frontier**, not eventual closability |
| Two blockers + E1 on experience-loop | **2/2 → 1(c), 2(c), 3(b).** Retention structure council-decidable, its privacy parameters owner-reserved |
| Two blockers on capability-native-execution | **2/2 → (a), and Decision 2 is divisible** |
| merge-authority + E2 transfer | **2/2 → (c) scoped; E1 transfers only by copying its exact matrix** |
| The ownership matrix E1 required and never wrote | **2/2.** Criterion: **acceptance authority** |
| N=3 escalation on the one-resolver guard | **SPLIT** — see below |

**The E1 gap is worth naming.** E1 was resolved to "stay separate, one
authoritative roadmap per shared mechanism" and then **never assigned the
mechanisms**. It recorded an obligation and did not discharge it. Both seats
refused to infer the assignments — *"sequence position is not an ownership
criterion"* — and required a fresh deliberation, which was held and
back-propagated to both roadmaps.

## The one-resolver guard: seven review rounds, 33 findings

Step 0.5 asked for an invariant to be locked "in documentation **and** in a
test". Six fresh-subagent R2 rounds — none of whose prompts this session
authored — killed four implementations:

| Round | Approach | Defect |
|---|---|---|
| 1 | no comment/string handling | false positive; **and the test named "guards the guard" never called the scanner**, so one walking zero files passed it |
| 2 | ordered regexes | a `//` comment containing a glob deleted real code — **12 files lost exports** |
| 3 | hand-written scanner | a backtick in a *regex literal* opened a template — **54 files, 231 exports** |
| 4 | TypeScript parser | four isolated omissions; model judged **adequate** |
| 5 | + `.tsx` in the file list | `ScriptKind.TS` hard-coded, so `.tsx` parsed as non-JSX — **rounds 2 and 3 live again inside round 4's repair** |
| 6 | confirmation | blocking finding **closed**; 4 recorded as `accepted-risk` |
| 7 | binding | 0 blocking; 3 documentation inaccuracies in this summary and the roadmap, **including a findings total that understated by five** |

Two principles the council asked be recorded, both now in the module:

> A gate must not implement a partial lexer or parser for a language when an
> authoritative parser for it is already a dependency.

> A repair is tested against the violated PROPERTY and representative
> mutations, never against the reproducer's literal spelling.

The second recurred in **five** of the six rounds, including in this session's
own final test: three of four JSX arms discriminate and one does not, because it
uses a balanced backtick pair where the reproducer had an odd one.

**The N=3 council split**, and how it resolved: one seat for withdrawing the
guard, one for parsing. Both refused further hand-lexing and **both classified
withdrawal and narrowing as owner-reserved**, so parsing was the only option
either seat permitted a council to execute. **Withdrawing the guard entirely
remains a live owner decision** — the argument for it does not expire with the
defects that prompted it.

## What is owner-reserved and was NOT forged

1. Whether deterministic browser engines fall outside ADR-088's "external tool
   runtimes".
2. ADR-239 § Decision 3 — preauthorized merge authority.
3. Folding `experience-loop-broadening` and `governed-harness-evolution` into
   one roadmap.
4. Cancelling or weakening step 1.4 of `runtime-event-journal`.
5. Withdrawing the one-resolver guard in favour of review-only enforcement.
6. Privacy-sensitive retention **parameters** for the experience ledger.

## Descopes

None. No step was cancelled, no criterion weakened, and no stub was created to
absorb work. The single deferred item encountered (step 1.4) was resolved by
promoting its receiver into the active estate, which is what made its carry
legal in the first place.
