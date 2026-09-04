<!-- evidence-type: analysis -->
# Inbox rounds 2026-09-f and 2026-09-g — verification and disposition

> Analysed 2026-09-04 against `main@bd7dc08d8`. Two rounds, thirteen files,
> ~14,400 lines — both consisting of **draft proposal roadmaps written by other
> sessions**, not of review prose. Both arrived under speaking directory names
> and were renamed to opaque round ids before any file was quoted, per
> `/analyze:inbox` Phase 1.
>
> This is a different genre from the review rounds this command usually sees: a
> proposal nominates itself for adoption, so the question is not only "is it
> true" but "at what size, and against which locks".

## Triage

| round | files | genre | drafted-against | lineage | disposition |
|---|---|---|---|---|---|
| `f` code intelligence | 6 (3,025 lines of proposal + transcript) | external-review / proposal | `56aa348b3` (real, 8 commits behind HEAD) | `lint_consolidation_lineage`: clean, 3 files | deep-read, reproduced |
| `g` web checks | 7 (7,200 lines of proposal + seed + transcript) | external-review / proposal | `3d092a6f1` (real — the merge of PR #1839) | clean, 4 files | deep-read, reproduced |

**Neither round has an unambiguous final file, and that is a finding rather than
a reading failure.** In `f`, `master.md` (v3, declares all three parents) and
`supremacy-v4-deep.md` (v4, supersedes only v3) are parallel children of one
parent and neither cites the other. In `g`, `master.md` (v2, declares both
parents) and `v5` (later pin, declares both parents) are the same fork; `v4` is a
**strict subset of v5** and is dead. A reader applying "highest version wins"
adopts a different plan from one applying "most complete parent set wins".

Operative in `f`: `master.md` — the only file carrying new measurement.
Operative in `g`: `master.md` for the plan (46 checkbox steps, real paths); `v5`
as reference only (**zero** checkbox steps across 3,895 lines).

## The reproduction that decides round f

`master.md`'s § 1 is the only new evidence in either round, and both verification
passes reported it as the one thing they could not check. It was reproduced here,
with the shipped CLI, on the roots the v2 benchmark used:

```
$ ./scripts-run src/scripts/code_graph/cli build --root src/scripts/code_graph
✅  code-graph built — 11 files · 97 nodes · 660 edges
    edges: EXTRACTED 403 · INFERRED 0 · AMBIGUOUS 257
```

| Proposal claim | Reproduced | Verdict |
|---|---|---|
| node kinds are `function` + `file` only | `function` 86, `file` 11, nothing else | **still-true** |
| 414 of 660 edges point at `symbol:` pseudo-nodes | 414 / 660 = **63 %**; `push` 20, `get` 17, `has` 14, `join` 14, `map` 12 | **still-true, exact** |
| zero file→file edges | **0** | **still-true** |
| no `EXT_LANG` node, only `build.ts → symbol:EXT_LANG` | exactly that | **still-true** |
| false edge `node:path → query.ts#path` in 4 of 11 files | `build.ts`, `cli.ts`, `detect.ts`, `loader.ts` — all four | **still-true, and worse: every one is labelled `EXTRACTED`** |
| 98 nodes | 97 | off by one, immaterial |

`EXTRACTED` is the class `src/skills/code-intelligence/SKILL.md:53-56` defines as
*"syntactic fact"* and instructs the reader to trust. A false edge wearing it is
the finding, and it is now measured rather than asserted.

Verified in source alongside it: `extract.ts:316-317` states the exclusion of
`const`/`type` nodes in its own words (*"A `const x = 3` is data, not a symbol
this graph answers questions about"*) — and the v2 corpus's `references`
questions ask exactly that, scoring recall 0.333; `extract.ts:253-269` reads only
the import clause and never `childForFieldName('source')`; `build.ts:230-234`
resolves by repo-wide name with a first-hit `.find`.

→ `road-to-the-graph-that-lies-confidently`

## The locks round f did not cite

- **ADR-225** (accepted 2026-08-12) settled a structurally identical round — an
  external comparison, a seven-phase plan, four of seven claims falling on
  re-measurement — and locked it: *"Reopens on new retrieval evidence, never on a
  new plan over the same measurement"* (`:108-109`). **None of the three files
  names it.** `supremacy-v4-deep` and `BEYOND-10` are, by that standard, exactly
  what the lock excludes: new plans over the v2 numbers. `master.md` is not, and
  the reproduction above is why.
- **ADR-246** names this work as explicitly *not* a reopen trigger — *"Explicitly
  NOT a reopen trigger: an improvement in EXTRACTION quality"* (`:28-31`,
  repeated `:237`). Its first trigger was evaluated against v2 on 2026-08-29 and
  did not fire (0/4 classes). So the extractor may be repaired as a
  maintainer-tool fix; it may not be used to reopen the dependency question.

## What round g's defects are, measured

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| D10 | `UNDECIDABLE` covers 1 of 9 checks | **still-true, and understated** | `:784-786` holds one key. Worse: `isPage()` (`:478`) is `/\.html?$/i` and **five** checks skip every non-HTML file through it (`:499`, `:536`, `:568`, `:586`, `:612`), so a Vue/JSX/Svelte/Blade build passes five checks on a zero-file scan. The `Impl` contract at `:482-489` states the rule this breaks: *"A check that cannot decide must not return an empty array… That is the one rule keeping the silent-green defect out of this table."* |
| D1 | the gate has zero consumers | **still-true** | only its own two test files reference it. Its header justifies its command form by saying `production-validator` can call it; that subagent never mentions it and is `discovery.visible: false` + `requires_capability: claude_subagents` (`:34-35`) |
| D9 | no accounting invariant | **still-true, and the proposal states it wrong** | the invariant lives only in a test, and that test's union (`test.ts:90`) omits `unknown`. Five buckets, not three |
| D12 | region/site-type are CLI-only | **still-true** | `enabled()` (`:341-361`) reads one key; `--region` defaults to `unspecified` at `:943-944`. The DE escalation then never fires |
| D13 | stale "one implemented check" prose | **still-true, with a measured consequence** | `:363` and `test.ts:3` say one; nine are implemented. A sibling analysis in this same round read that prose and planned a phase around it |
| D3 | superseded contract cited as the live-app blocker | **still-true** | `no-runtime-boundary.md` is `stability: superseded` (ADR-249, 2026-08-27); `later/road-to-live-app-verdict.md` cites it. Structural correction: it is a prose blockquote, not a `### blocker:` entry |
| D8 | "Currently 7" against 9 checks | **still-true** | `web-launch-readiness.json:168` |

→ `road-to-the-check-that-cannot-see`

## Prevented — what verification stopped

- **A per-class routing change to the code graph.** The measurement shows
  `path-between` at 1.000/1.000 against grep's 0.917/0.778, which reads like a
  routing win. The tree already decided against it, explicitly and with the
  reason: *"No class is graph-first"* (`SKILL.md:116`), because +8.3 pp fell
  short of a +10 pp bar fixed before the run. Proposing it would have reopened a
  recorded decision on the same measurement — the thing ADR-225 locks.
- **Adopting `road-to-web-assurance-legal-trust-v4`.** It is a strict subset of
  v5. Both were kept in the inbox; a reader would have had no way to tell.
- **`master.md` (f) E4's citation of `CLAIMS.md:1068`.** That line is
  `claim: dispatch-event-capture-reliability` — an unrelated entry. **never-true.**
- **`master.md` (g)'s estate arithmetic.** It sizes against *"3 aktive Roadmaps +
  1 Carrier"*, true at its pin. The live floor is **10**. Every number in its E1
  needs redoing.
- **Both rounds' benchmark plans.** The closed stub
  `road-to-code-graph-benchmark-rerun` records that the earlier comparative
  corpus is *irrecoverable* — private third-party repositories, a permission
  fact, not a lost file. Neither round mentions it while planning a new
  multi-arm contest against an external pinned repo.

## Three findings about the rounds themselves

**1. The seed of round g was never obtained.** Its own transcript:
*"eine öffentlich auffindbare Kopie des konkreten Skills habe ich bei der Suche
nicht gefunden"*, and later *"Der TikTok-Skill selbst bleibt aktuell 'nicht
öffentlich gefunden'"*. The 25-repository corpus is a substitute the agent chose.
The expansion from a checklist to a "Web Assurance layer" was decided in the
agent's **first reply** — *"ich würde ihn deutlich größer und technischer denken
als der TikTok-Ansatz"* — citing *"unsere gestrige Web-Quality-Roadmap"*, an
agenda that predates the seed. The user's actual words were the opposite in
direction: *"aber auch die eigentliche idee, wirklich im detail analysieren"*.

**2. Both rounds stopped after loop 1 of the three that were asked for.**
`g`: *"Ich musste an der Werkzeug-Grenze dieser Antwort stoppen … die drei
Überarbeitungsschleifen und die Download-Datei stehen noch aus."*
`f`: *"Ich bin mitten in der Analyse an das Tool-Limit dieser Antwort gestoßen."*
Later "three complete loops" claims come from the other thread in the same file.

**3. At least one directive may be mis-attributed to the owner.** Round g's
transcript refers to *"deine Rechte-Direktive"* and *"deine dritte Direktive"*,
but the file contains **two** user turns and neither is that. The nearest
antecedent is a legal-expansion block produced by the other agent and relayed
into the thread. Round f's reading is also stronger than its source: the owner
wrote *"wir könnten ihn sogar kopieren"* — a hypothetical framing a question —
and the proposal reads it as a licence grant and as authority to supersede
ADR-246, an ADR the owner never named. Flagged, not asserted; it changes what
counts as owner-directed and therefore what an agent may execute.

## Declined — recorded so it is not re-proposed

- **The "Web Assurance layer" as authored** (v5: 20 waves, 21 process
  subsections, two new top-level directory trees, 12 config files, 23 TypeScript
  modules including 7 external-tool adapters, 4 new benchmark claims, zero
  checkbox steps, zero `file:line` readings against the tree it is pinned to).
  Its own W0.2 is the instruction to go and take those readings.
- **A DE/EU legal corpus outside the pack whose floor governs it.**
  `legal-safety-floor` is `packs: [legal-review-prep]` and triggers on
  contract/NDA/DPA words. A web-assurance run in a project without that pack
  activates none of its gates — not the consent gate, not the council gate, not
  the RDG § 2(1) STOP, not the jurisdiction lint. The proposals are careful in
  substance and their `compliance_verdict: prohibited` declaration is read by
  nothing (`grep -rn 'legal_posture' src/scripts/ docs/contracts/` → 0). This is
  a pack-boundary decision, not a roadmap step.
- **The "Code Intelligence Fabric" provider ladder** — SCIP, LSP, tsserver,
  rust-analyzer, gopls, PHPStan, CodeQL, taint analysis, control/data-flow
  providers. Killed by the round's own consolidation on the strongest available
  ground: *"kein einziger der gemessenen NULL-Fälle braucht Compiler-Präzision"*.
  `references` fails for want of `const` nodes, not of type inference.
- **Promoting the tree-sitter parsers to runtime dependencies.** ~51 MB per
  consumer for a path whose only retrieval measurement lost; the alternative is
  examined and rejected at ADR-246 `:85-91`.
- **A runtime/browser arm.** Needs a Class-A classification under ADR-124 first,
  which is a decision and not a step; and every probe runs against a *consumer's*
  site, making SSRF and rate-limiting load-bearing.
- **Twenty-language support and a permanent multi-arm benchmark programme.**
  Twenty golden corpora is a maintenance load this repository does not carry, and
  the one earlier comparative benchmark is already irrecoverable.

## Reproduction table (Phase 4b)

| # | step, as the round states it | author | verdict | observed |
|---|---|---|---|---|
| 1 | build both engines on identical roots and compare (f § 1) | user-derived | **reproduced (AC arm)** | 97 nodes / 660 edges / 63 % pseudo-nodes / 0 file→file — all four match; the external arm is `out-of-bound` (not in this tree, and cloning it is a network step) |
| 2 | `node:path` resolves to the local `path()` in 4 of 11 files | agent | **reproduced, and worse** | all four, every one at `EXTRACTED` |
| 3 | `check_finding_dispositions`-style probe: is `UNDECIDABLE` 1 of 9? | agent | **reproduced** | one key; plus five checks gated behind `isPage()` |
| 4 | `enabled()` reads only one key; region defaults to `unspecified` | agent | **reproduced** | `:341-361`, `:943-944` |
| 5 | the accounting invariant is three-way | agent | **diverged** | five buckets; the existing test's union already omits `unknown` |
| 6 | "the one implemented check" | agent | **diverged** | nine implemented; the prose misled a sibling analysis |
| 7 | supersede ADR-246 so parsers become runtime deps | agent | **out-of-bound** | consumer-facing dependency change + an accepted-ADR supersede; owner-reserved |
| 8 | run the three-arm benchmark with an LLM judge | agent | **out-of-bound** | spend-bearing, and its comparative corpus is recorded irrecoverable |
| 9 | clone and read the 25 external repositories | agent | **out-of-bound** | network |
| 10 | verify the licence distribution of those 25 | agent | **not-attempted** | outside the selection: it depends on step 9. The round's own numbers disagree with themselves (6 asserted unlicensed, 5 itemised) and cite no evidence — treat every licence statement in those files as unverified |

Ceiling: none fired. Ten steps selected of the rounds' directives.

## Owner-reserved — surfaced, not built

| item | why reserved |
|---|---|
| Promoting the tree-sitter parsers to `dependencies` | consumer-facing dependency change; ADR-246 examined and rejected it |
| Superseding ADR-246 | accepted record; its live reopen trigger is a consumer-named case nobody has |
| A Class-A ruling for a web runtime probe | ADR-124 classification decision |
| Bringing web-assurance legal rows under `pack-legal-review-prep` | pack-boundary decision that decides whether the legal floors engage at all |
| Whether to port external code at all | the owner's *"wir könnten ihn sogar kopieren"* is a hypothetical; a port is a derivative work with NOTICE obligations and would require naming the source in the tree, which is the opposite of the source-silence the same round applies |

## Estate note, stated because the last round's was

This change adds **two** active roadmaps against a floor of **10**, taking the
estate to 12. The previous round added six and said so; adding two more is the
same tension one round later. Both carry `estate_growth_exempt` and
`estate_offset_exempt` with a real reason, and no offset was available: nine of
the ten active roadmaps landed on 2026-09-03 or 2026-09-04 and are unstarted, and
the tenth is a carrier a recorded verdict forbids closing. `road-to-meta-ratio-measured`,
landed in the previous round, is the instrument that would make this a published
number instead of a paragraph — and by the classifier it proposes, this change is
again 100 % governance.
