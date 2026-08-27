<!-- evidence-type: analysis -->

# The owner decision that repeals the no-runtime doctrine, and the census of what it touches

Recorded 2026-08-27. This artefact exists because both council seats (2/2,
deep pass on `road-to-runtime-governance-flip.md`) independently found the same
provenance defect: a doctrine-level reversal whose authority was quoted from
`agents/tmp.old/uncle-bob-swarm/chat.txt:130` — a **gitignored, disposable**
inbox archive that is in no clone and may be deleted at any time. A roadmap
citing it, and an estate exemption justified by it, both rested on evidence a
reviewer could not reach.

## The decision, verbatim

Stated by the owner in the source session. The German is the original; the
English is the working translation.

DE: "Ok, und nun ergänze die Roadmap, ich will dass AC umgebaut wird, da ich aktiv entschieden habe, Zero Runtime ist nicht mehr unser Ziel. Alles was das behauptet, in Frage stellt oder uns von verbesserungen abhält soll deprecated oder entfernt werden. Auch die Readme soll angepasst werden. Wir werden runtime und deamons haben. Das ist ein Ziel, um die Qualität zu gewährleisten. - Passe auch die Roadmaps an, wenn es sein muss und hilfreich ist."

EN: "OK, and now extend the roadmap — I want AC rebuilt, because I have actively decided that Zero Runtime is no longer our goal. Anything that asserts it, questions it, or holds us back from improvements is to be deprecated or removed. The README is to be adapted as well. We will have runtime and daemons. That is a goal, in order to guarantee quality. — Adapt the roadmaps too, where necessary and helpful."

**What this authorises, and what it does not.** It authorises repealing the
no-runtime doctrine and rewriting the surfaces that assert it. It says nothing
about *how* a resident process is supervised, on which platforms, under whose
privileges, or with what data contract — those are architecture decisions the
sentence does not make, which is why they are blockers in
`road-to-supervised-telemetry-collector.md` rather than steps.

**It also does not reopen anything else.** Agent-memory (ADR-094), spawn
hardening (ADR-123, `docs/spawn-site-policy.md`) and the lethal-trifecta floor
are untouched by it.

## Why the ADR the source analysis named is the wrong one

The source set states `ADR-088` is "der Beschluss-Anker" for the prohibition.
Read at `f2ed85e`:

| Document | Status at read | What it actually decides |
|---|---|---|
| `ADR-088-no-external-runtime-federation.md:78` | `accepted`, but `superseded_by: ADR-124` (scope: engine-adoption interpretation) | That this suite does not **bridge to or drive other tools'** runtimes. A federation decision, not a decision about owning a process. |
| `ADR-124-embedded-engine-doctrine.md:13`, `:110`, `:111` | `accepted`, `superseded_by: —` | The live prohibition. Title: "the service/daemon prohibition stands". `:110` Class A (embedded engine) is **ADOPTABLE**; `:111` Class B (resident service / daemon) is **"PROHIBITED in core"**, and cites ADR-088/094 as authorities beneath itself. |
| `ADR-109-subagent-v1-contract.md:28` | `accepted`, `superseded_by: —` | A second, independent floor: "the no-runtime identity floor (no daemon, no auto-write…)". |
| `docs/contracts/no-runtime-boundary.md` | `stability: beta`, `keep-beta-until: 2026-08-17` | The Mission-Mode contract. Prohibited table bans background processes, cross-session state stores and event loops. **The beta deadline expired ten days before this record.** |

A repeal naming only ADR-088 would supersede a federation decision, leave both
live floors standing, and read as complete. That is the correction the roadmap
carries.

## Other public surfaces, each reproduced by its own grep

| Surface | Reading |
|---|---|
| `docs/CLAIMS.md:120`/`:121` | `claim: no-runtime-daemon`, `kind: qual` |
| `docs/proof.md:416` | **one** row — the source claimed three |
| `src/scripts/check_claims.ts:487` | a comment recording how a `kind: qual` marker once licensed an unrelated figure; not an exemption, but an interaction the retirement must not break |
| `README.md:3` / `:17` | headline carries the thesis; the body line carries the claim marker |
| `docs/comparison.yaml:31` | the `claim: "No resident runtime …"` row, `checkable: true`, whose `failure_mode` argues *against* daemons as a competitive position. Path corrected — the source said `src/config/` |
| `docs/positioning-evidence.md:56`–`:74` | records "zero runtime" as the load-bearing differentiator, and argues it is credible only *because* it is machine-checked. Also states "261 skills", against a measured 299 |
| `subagent-steering.md:107` | verbatim: "A CONFIG PACKAGE RUNS NO DAEMON. THERE IS NO AUTOMATIC COHORT-DISABLE." |

## The census, composed so it can be reproduced

```
grep -rniIlE 'zero.runtime|no.runtime|no daemon|runtime daemon' src/ docs/ README.md | sed 's#/[^/]*$##' | sort | uniq -c | sort -rn
```

**129 files** at `f2ed85e`. The roadmap's earlier phrasing named only the top
three directories (61 files) and a council seat correctly asked where the other
68 were. Full composition:

| Files | Directory | Files | Directory |
|---:|---|---:|---|
| 28 | `docs/decisions` | 1 | `src/skills/verify-repair-loop` |
| 20 | `src/scripts` | 1 | `src/skills/skill-improvement-pipeline` |
| 13 | `docs/contracts` | 1 | `src/skills/screenshot-hygiene` |
| 9 | `docs` | 1 | `src/skills/reasoning-orchestrator` |
| 7 | `src/agent-src/contexts/execution` | 1 | `src/skills/pdf-tools` |
| 5 | `src/scripts/_lib` | 1 | `src/skills/humanizer` |
| 5 | `src/config` | 1 | `src/skills/docx-authoring` |
| 3 | `src/scripts/hooks` | 1 | `src/skills/docker` |
| 3 | `docs/distribution` | 1 | `src/skills/deep-reading-analyst` |
| 2 | `src/scripts/schemas` | 1 | `src/server/schemas` |
| 2 | `src/rules` | 1 | `src/scripts/ai_council` |
| 2 | `src/cli/commands` | 1 | `src/scripts/_cli` |
| 2 | `docs/archive` | 1 | `src/patterns` |
| 1 | `src/install` | 1 | `src/domains/product-discovery/research` |
| 1 | `src/domains/meta/explain-run` | 1 | `src/domains/gtm-marketing/humanize` |
| 1 | `src/domains/engineering-base/mission/upgrade` | 1 | `src/config/profiles` |
| 1 | `src/config/discovery` | 1 | `src/agent-src/contexts/contracts` |
| 1 | `docs/wedge/production-validator` | 1 | `docs/maintainers` |
| 1 | `docs/guidelines/php` | 1 | `docs/guidelines/agent-infra` |
| 1 | `docs/guidelines` | 1 | `docs/adrs/cost` |
| 1 | `README.md` | | |

Sums to 129. **This is a reading, not a target**: the roadmap's own Phase 3
rewrites some of the matching wording, so the closure census re-runs the
expression rather than checking against this number.

## The estate accounting, made reachable

The second unreachable justification. `estate_offset_exempt` on the governance
roadmap claimed "sixteen source proposals reduced to two roadmaps plus one
stub", with the accounting visible nowhere. The inbox held **18** files:

| Count | What | Disposition |
|---:|---|---|
| 1 | `chat.txt` — the transcript | consumed; the decision above is its durable extract |
| 2 | index files | consumed as structure maps |
| 13 | superseded roadmap generations | reported, not deleted; all in `agents/tmp.old/uncle-bob-swarm/` |
| 1 | `road-to-runtime-native-evidence-operating-system-final.md` (1,952 lines, 21 phases) | split — governance and specification increments extracted, remainder stubbed |
| 1 | `road-to-runtime-native-quality-master.md` | folded into the stub's track table |

Landed: two roadmaps plus one stub, against a source set that proposed five
roadmaps in its own index plus a 21-phase master. The reduction is real; this
table is where it is checkable.
