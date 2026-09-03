<!-- evidence-type: analysis -->
# Inbox round `inbox-2026-09-c` — verification and disposition

Five sets, 21 files, roughly 800 KB of external analysis, all pinned at
`main@319713d` or `main@022c0d240`. Every claim below was re-checked against
`022c0d240` in this repository. Three roadmaps were written; two architectures
were declined. This note records what was verified, what was corrected, and why
the declined material was declined, so the round does not have to be re-argued
from the transcripts.

## Reproduced defects

Five prompts probed directly against `classifyAuthorization`
(`src/scripts/git_authorization_hook.ts`), each returning the wrong polarity:

| prompt | expected | observed |
|---|---|---|
| `Merge PR #12 auf keinen Fall.` | deny | **authorized** |
| `Merge #12 under no circumstances.` | deny | **authorized** |
| `Du sollst nicht z.B. den PR #12 mergen.` | deny | **authorized** |
| `Bitte unter keinen Umstaenden diesen Pull Request jetzt mergen` | deny | **authorized** |
| `Do not push. Merge PR #12.` | allow | **denied** |

Four causes, distinguished: `negatedBefore` (`:728-743`) inspects only the
window before and inside the match, so a trailing negation is invisible; its
boundary scan treats the dot in `z.B.` as a sentence start and amputates the
window; the window is thirty characters and the fourth prompt's negation sits
forty-one characters upstream; and the fifth prompt is denied by
`isInterrogative` (`:448-465`), which tests the whole prose block, so any prompt
opening with `do`, `does`, `is`, `can` or `should` authorizes nothing.

Owned by `agents/roadmaps/road-to-binding-findings.md`.

## The finding-disposition gate went green on a race

PR #1828 (release 14.15.0) merged carrying two high-severity blocking security
findings. `agents/evidence/release-findings/` holds only `9.14.0.json`. The
`finding-dispositions` check reported **pass**. The measured cause:

| event | time |
|---|---|
| `finding-dispositions` job completed | 2026-09-03T12:51:54Z |
| self-review comment created | 2026-09-03T12:53:25Z |
| pull request merged | 2026-09-03T12:58:10Z |

The `--pr` trigger reads the comment list; it ran ninety-one seconds before the
comment existed and nothing re-ran it. Reproduce with
`gh api repos/event4u-app/agent-config/actions/runs/33757633537/jobs` and
`gh pr view 1828 --json comments,mergedAt`.

## Two source claims corrected

- **"Stage-2 impact scan exposes diff content in hook stderr" (reported high,
  security).** Does not reproduce. `describeImpact`
  (`src/scripts/hooks/merge_impact.ts:184-207`) emits fixed marker labels from a
  closed table, a file count, two digit capture groups and three fixed `reason`
  strings; `fetchPatch` runs its subprocesses with
  `stdio: ["ignore","pipe","ignore"]`, so neither git's nor gh's stderr is read
  at all. The residue is that nothing asserts the property — a contract gap, not
  a leak.
- **"The ledger gap is caused by an `enforce: false` gate never posting a
  machine block."** Wrong on the evidence: the comment on #1828 does carry
  `<!-- release-findings-json: … -->`, because `renderReview`
  (`src/scripts/self_review_gate.ts:335-367`) appends it whenever
  `findings.length > 0`, independent of `enforce`. The cause is the race above.

## Recurrence

`agents/roadmaps/archive/road-to-merge-op-split-and-negation-guard.md` closed
the negation defect on 2026-08-22 with a positive-control corpus and a sabotage
probe, and its own notes observed that "the negation defect is not merge-only".
Four further shapes leak at `022c0d240`. The disposition was not wrong; it was
under-specified — the corpus enumerated the phrases its source named rather than
asserting the polarity property, so every shape nobody thought to type stayed
open. The learning is carried in the corpus header, not only here.

## Smaller verified findings

- `src/rules/security-sensitive-stop.md` is `type: auto`; its `triggers:`
  (`:11-17`) carry `auth`, `billing`, `tenant`, `webhook`, `oauth`,
  `signing key`, while its own § table names file uploads, external
  integrations, public endpoints and data exposure, and its `description:`
  (`:5`) advertises uploads. No sibling rule in the set carries `upload`,
  `SSRF`, `public endpoint` or `serializer` either.
- `src/skills/accessibility-auditor/` claims WCAG 2.2 AA in four places. Of the
  nine criteria 2.2 added over 2.1, a grep finds two — 2.5.7 and 2.5.8, each
  once, inside `data/aria-patterns.csv`. 2.4.11 (AA), 2.4.12, 2.4.13, 3.2.6,
  3.3.7 and 3.3.8 (AA) return zero hits.
- `src/skills/iconography/SKILL.md:40-44` opens its pick step with "Default open
  sets: **Lucide**" and hard-wires `react-shadcn-ui → Lucide`, while
  `src/rules/icon-consistency.md` names defaulting to Lucide as the anti-pattern.
- A grep over `docs/guidelines/design-antipatterns.md`,
  `src/scripts/design_slop_rules.ts` and
  `src/skills/motion-choreographer/SKILL.md` for `scroll-reveal`, `spotlight`,
  `cursor-follow`, `grain` and `noise` returns zero hits in all three.

Owned by `road-to-declared-coverage-truth.md` and `road-to-tell-currency.md`.

## Declined, with reasons

- **A production-safety control spine (set-3).** A registry plus resolver plus a
  control lifecycle, layered over `threat-modeling`, `data-flow-mapper` and the
  assurance registry. Its own inventory section establishes that five closed
  vocabularies and both graphs already exist, and reduces its delta to two
  missing lifecycle states. Declined as authored: the two states are an
  amendment to the launch-checker report model, not a spine, and the roadmap's
  parents are themselves unadopted proposals. Reopen when the two states are
  wanted on their own terms.
- **A web quality and trust contract in fifteen phases (set-4).** Declined for
  scope and for a direct conflict with set-1, whose reviewer reads the same tree
  and concludes that web-launch-readiness expansion should stop. Its P3 item —
  the WCAG version drift — was verified and is carried by
  `road-to-declared-coverage-truth`. The remaining fourteen phases propose
  control families this tree largely covers, by the roadmap's own Loop 2.
- **An attributable-design master (set-5).** Its concrete half is
  `road-to-tell-currency`; the structured-intent and provenance-cluster waves
  are a design-authority architecture that needs an owner decision before any
  step of it is worth writing down.
- **Every score in every set.** Nine decimal scores across five sets, none with
  a measurement basis for any comparator column. They do not enter
  `docs/CLAIMS.md`, `docs/comparison.yaml`, the README or any proof surface.

## What was not reproduced

The set-1 transcripts carry roughly sixty further recommendations — an operation
registry, persistent code intelligence, a subagent return contract, an outcome
vocabulary freeze, decomposing `sync_pr_branch.ts`. None was reproduced, because
none states a defect that a probe can return the wrong answer to; they are
architecture proposals, and they are left where they are rather than
half-adopted into a roadmap that could not verify them.
