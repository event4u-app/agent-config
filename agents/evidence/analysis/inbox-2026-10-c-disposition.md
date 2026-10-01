# Disposition — inbox round inbox-2026-10-c

<!-- evidence-type: analysis -->

Processed 2026-10-01 by `/analyze:inbox`. The round arrived under a speaking
directory name and was renamed before triage; the true source is recorded once,
encrypted, in the round's intake note.

## Triage

One topic folder, 7 files, 161,821 bytes, 448 anchors (`inbox_source_census`).

| file | genre | drafted-against | recurrence | lineage | disposition |
|---|---|---|---|---|---|
| transcript | transcript | — | 22+ consumed rounds on the subject | n/a | primary demand source |
| draft A (v3) | feature-spec | `9bc8cd4f2` | as above | complete | parent; folded |
| draft B (external, first iteration) | feature-spec | unpinned | as above | n/a | parent; folded |
| draft v4 (external, second iteration) | feature-spec | `9bc8cd4f2` | as above | `ghost:` its parent B is named by slug; `omits` A and master | **unnamed parent of master**; folded item by item |
| master | feature-spec | `9bc8cd4f2` | as above | declares A and B only — **omits v4** | basis, corrected |
| two source annexes | scratch-note | — | — | — | read for context only, never quoted |

Only 12 documentation commits landed between the drafting pin and `a03f60c46`,
so no claim was overtaken by code.

## The lineage finding

The master draft states "two parents … no later synthesis over them exists".
False: v4 was written after parent B, supersedes it, extends A, and was the
answer to the transcript's second user turn. Its strongest items were absent
from master (64 v4 items mapped, 30 silent), and master's own E3 recommended the
delivery form v4 explicitly rejected. The conflict was put to the council
(`agents/evidence/council/inbox-2026-10-c-standing-form.md`, 2/2), which
rejected both as specified and set the hybrid the roadmaps now carry.

## Claims (master D1–D12 and cited steps, at `a03f60c46`)

D1–D12 still-true at the cited lines; K1, K2, K7, K8, K11, K12 still-true;
P1–P4 and the size rungs unverifiable without an install and a bundle run (kept
as the draft's measurement, labelled so). Stale or wrong, each corrected in the
landed text:

- "twelve active roadmaps" — 27 at HEAD.
- 137 dangling links — 160 with 23 repo-root links the draft missed.
- `hook-token-budget.json:41` — the `rule-inject` row is `:35`.
- `docs/CLAIMS.md:365` "98/101" — the endpoint now prints 99/102.
- The path-route stub and the mixed-trigger roadmap both misclassify
  `roadmap-progress-sync`; `_has_non_path_trigger` ignores `command`.
- "obligation IDs do not exist" (v4) — 107 rule files carry
  `# obligation: line N`; already satisfied for the indexing half.

## Emitted

| Roadmap | Carries |
|---|---|
| `road-to-a-rule-carrier-that-works-outside-the-repo` | W0 instruments and W1 carrier; arrival levels A0–A3; 8,000 budget and manifest |
| `road-to-rule-laws-that-can-stand` | W2 law sections, ceilings, per-body ceiling, consequence class, copied (not compiled) standing law |
| `road-to-an-installed-layer-that-is-thinned` | W3/W4/W6 as opt-in → records → owner-decided default; 65k target, 75k hard |
| `road-to-rule-triggers-and-links-that-hold` | W5 residue, the `command`-trigger defect, links, instruction-to-mechanism audit |

Held objects updated with arrival counts: the instructions-loaded observer stub
(4), the path-route stub (2), the standing-rule-delivery stub (22 rounds, owner
question posed), the mixed-trigger roadmap (50 rounds, owner question posed).

## Point ledger

```
claims        19 extracted (D1–D12, 7 stale/false) → still-true 12 · corrected 7 · never-true 0 · unverifiable 4 (probes)
instructions  0 reproduced — every draft step needs an install, a build or a new test; out-of-bound for this run, carried as roadmap steps
demands       transcript: 7 → adopted 5 · already-satisfied 1 · declined 1
parent items  A 73 · v4 64 · B 57 → adopted or already present in the four roadmaps, or declined below
```

Transcript demands: analyse the current state (adopted); find what to learn from
outside (declined here — this command makes no network fetch; the drafts'
external findings are used as claims and their sources stay in the annex);
plan a roadmap (adopted); loop three times (already satisfied by the drafts);
deep-dive again (adopted — v4 folded); worktree (adopted); one PR with all
roadmaps as ready (adopted).

Declined parent items, one line each: a `context:*` command cluster and a session
simulator (`route:explain`/`route:audit` exist); a compiled standing contract with
a fallback-action field (council: no authoritative second representation); a
per-prompt rule count (the character budget binds first); resume-overflow
handling (unverified host report, no step can test it here); `disable-model-
invocation` for the skill menu (owned by `later/road-to-skill-menu-economy`);
an installed `adr_cite_check` command and a visual-diff hook for design fidelity
(separate scope from delivery); mixed-trigger multi-carrier lowering (owned by
the path-route stub); minification of rule text (agreed non-goal).

## Coverage

```
batch     1 topic of 1
sources   7 files in 1 source set (no revision set; one transcript)
anchors   448 counted → mapped by three readers (A, v4+B, claims) plus the orchestrator's pass
passes    pass 1: 194 parent rows · pass 2: +16 rows (A +9, v4/B +7) · pass 3: 0 adopted-not-found
topics    1 → four roadmaps
```
