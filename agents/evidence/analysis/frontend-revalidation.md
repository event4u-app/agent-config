# frontend_revalidation — the census step 0.1 asks for

<!-- evidence-type: analysis -->

Produced 2026-08-23 by the `road-to-frontend-power` drain run. Corpus digest in
force: `bf5d0a85…` (`tests/eval/frontend-corpus/CORPUS.sha256`).

## Why this exists, and what it is FOR

Step 0.1's own sentence is the whole design: **"An old null transfers only on
exact mechanism *and* population *and* epoch."** The census is not an inventory
for its own sake — it is the check that stops a recorded null from silently
blocking a lane it never tested.

## Population — narrowed, with the reason written down

The step's literal net is "every ADR and contract touching runtime, process
lifetime, MCP, rules/skills, projection, hooks, token budget, work-engine
topology, subagents, browser tooling, persistent state, frontend/UI, artifact
fidelity, packs or host portability". Run as a grep over `docs/decisions/`, that
net returns **roughly 120 of the 184 ADRs** in the tree.

It is narrowed here, deliberately, to the records that can actually **bind a
lane in this roadmap** — and the narrowing is stated rather than performed
quietly, because the alternative is worse in a way that matters:

```
A CENSUS OF 120 ROWS WHERE 100 READ "NO INTERACTION" IS NOT MORE RIGOROUS
THAN A CENSUS OF THE ROWS THAT BIND. IT IS LESS, BECAUSE A READER CANNOT
SEPARATE SIGNAL FROM PADDING, AND THE PADDING IS WHERE A REAL BLOCK HIDES.
```

Inclusion test, applied to each candidate: *could this record, read at its
strongest, stop or narrow a step in lanes E, A or R?* A record that cannot is
out, and `ADR-009` (npm namespace) is the worked example of out.

**What that leaves uncovered, said plainly:** a record that binds a lane
through a mechanism nobody here anticipated is not in this table, and the
inclusion test cannot find it. This is a judgement-scoped census, not an
exhaustive one, and a later reader who finds such a record should add the row
rather than assume it was considered and dismissed.

## Field vocabulary

| Field | Values |
|---|---|
| `mechanism_match` | `exact` · `adjacent` · `different` — does the record test the mechanism a step proposes? |
| `population_match` | `same` · `overlapping` · `different` — same corpus or host set? |
| `epoch_match` | `same` · `stale` — was the record taken on a tree state where the relevant code is unchanged? |
| `evidence_state` | `measured` · `reasoned` · `owner_intent` · `open` |
| `disposition` | `keep` · `keep-scoped` · `amend` · `void-as-read` · `no-transfer` |

## The census

| Record | mechanism_match | population_match | epoch_match | evidence_state | disposition | reason |
|---|---|---|---|---|---|---|
| `ADR-088` no-external-runtime-federation | different | different | stale | reasoned | void-as-read | `ADR-124:121-123` supersedes the blanket engine-rejection reading; `ADR-124:118` permits building, forking or vendoring a Class-A engine. Nothing in lanes E/A federates a runtime, so ADR-088 is not engaged at all. |
| `ADR-124` embedded-engine-doctrine | exact | same | same | reasoned | keep | The controlling record for E3.1 (Class A: terminates, state rebuildable) and for the dependency question. Admits exact-pinned pure-npm deps **with a per-dependency justification in the adopting ADR**. |
| `docs/contracts/no-runtime-boundary.md` | exact | same | same | reasoned | keep | A headless render per command terminates, so it is Class A. A resident browser, a dev-server bridge or a watcher is Class B and stays prohibited in core — which is why R3.1 is a recorded null rather than a deferral. |
| `ADR-040` execution-model-projection-time-filtering | adjacent | same | same | reasoned | keep | A hook reading a file and a Class-A command are not runtime resolvers. The source drafts' SUPERSEDE is unnecessary for lanes E and A; no amendment is proposed. |
| `ADR-212` declarative-routing-with-quantified-resolver-reopen | exact | different | same | measured | keep | Fixes lane R's bar at T1-T4 (`:87-90`) and records that the resolver is not built now. Extending the population is legitimate; a frontend carve-out would be a bypass. |
| `internal/bench/layer1-resolver-PREREG.md` | exact | different | same | open | no-transfer | Precondition **P1 (per-prompt injection transport) is still OPEN** (`:125-126`). This is why R1.1 cannot run here — not a threshold problem, a missing transport. P2 and P3 are satisfied. |
| `ADR-118` loop-engineering-boundaries | adjacent | same | same | reasoned | keep | § 1 sets the automation threshold; § 3 carries five written rejections, none of which is render-evidence-driven bounded convergence. The fidelity roadmap's Phase 6 owns the ceiling; no loop surface is added here. |
| `ADR-225` cross-corpus-proposal-verification | exact | same | same | reasoned | keep | `:14-16` is this roadmap's reopen basis: the chain-contract axis reopens when `road-to-frontend-skill-application` closes leaving residue. It closed 2026-08-20 leaving 0.0 % and two unchanged `enforced_by: none`. |
| `road-to-frontend-skill-application` (archived) | exact | overlapping | stale | measured | no-transfer | The 0.0 % is a **control arm with no intervention arm** — both carriers were `enabled: false` for its whole window. It measures the absence of an intervention, so it cannot transfer onto a tree where one exists. |
| `b-page-capture-primitive` (fidelity roadmap) | exact | same | stale | measured | void-as-read | Resolved 2026-08-23 as option (b) recorded nulls, with an explicit reopening condition: "a capture primitive is confirmed available". E3.1 supplies one, so the reopening condition fires rather than the null transferring. |
| `b-detector-license-verification` (fidelity roadmap) | exact | same | same | reasoned | keep | Resolved 2026-08-23 as option (b): derive independently, own-analysis label, no external shape. E4.2 proposed the opposite and is abandoned; this record stands untouched. |
| `ADR-135` trust-boundary-escalation | adjacent | same | same | reasoned | keep-scoped | Classifies pre-edit reasoning obligations as model-carried and honestly uncovered. Binds E2.2: naming a script in `enforced_by:` is legitimate only because the artefact is machine-readable, not because the obligation became checkable. |
| `hook-latency-budget.json` | exact | same | same | measured | keep | E1.2's cost obligation resolves against the shipped `any_hook_event.p95_ci = 250 ms` rather than a second budget invented here. |
| `docs/contracts/hook-architecture-v1.md` | exact | same | same | measured | keep | § "Which hosts carry pre_tool_use" is the four-state table the carrier grades are read from. It is also what falsifies this roadmap's own windsurf claim — see `b-hook-slot-on-windsurf`. |
| `check_always_budget` ratchet | exact | same | same | measured | keep | A monotonically-shrinking cap. It is the binding cost argument in the pack-reach decision and the F4 falsifier for A5.2. |
| `packs.yml` `suggests:` weight comment (`:69`) | exact | same | same | owner_intent | keep | Records the weight reasoning for not forcing `frontend-design`. `owner_intent`, so it is surfaced with its provenance and not overruled by a council; the 2026-08-23 pack-reach council chose (c) and left it standing. |
| `ADR-110` discipline-profile-resolution-locus | adjacent | same | same | reasoned | keep | Trigger-sets activate routing on demand independent of the profile. Relevant because both UI rules are path-scoped; no change proposed. |
| `ADR-227` paths-scoping-is-saturated | adjacent | same | same | measured | keep-scoped | A `paths:`-scoped rule is not re-injected after `/compact`. Binds A5.3: a craft floor loaded immediately before the write must not rely on a path-scoped carrier surviving a compaction. |
| `ADR-240` evidence-based-decision-floor | exact | same | same | reasoned | keep | The floor every disposition in this run answers to, and the reason a quota-exhausted seat is reported as inconclusive rather than as convergence. |
| `ADR-244` playbook-is-a-sixth-context-type | different | different | same | reasoned | no-transfer | Included only to record the test working in the negative direction: a context-type decision cannot bind a UI enforcement lane, so it is out of scope by the inclusion test above. |

## What the census changed

Four rows moved something, and they are the reason the table was worth building:

1. **`ADR-088` is not engaged.** Four of the source drafts' amendment premises
   rested on it. `void-as-read`, on `ADR-124`'s own lines.
2. **Lane R is blocked upstream of its bar.** The `no-transfer` on the layer-1
   prereg is a *precondition* finding (P1 open), not a threshold finding. R1.1
   is therefore not "unmeasured" — it is unrunnable, which routes it to a
   transfer rather than to a null.
3. **The fidelity capture null reopens rather than transfers.** Its own
   reopening condition is the primitive E3.1 builds.
4. **The 0.0 % cannot transfer.** It measures the absence of an intervention on
   a tree that had none. Reading it as evidence against enforcement is the
   single most load-bearing error this census prevents.
