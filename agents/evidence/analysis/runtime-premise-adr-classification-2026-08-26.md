---
complexity: lightweight
---

<!-- evidence-type: analysis -->

# The runtime-premise ADRs, classified — 10 of 21 load-bearing

> `road-to-decision-conformance` step 3.0, measured 2026-08-26. The step's own
> rule: *"a rejection that merely MENTIONS daemons is not one that RESTS on
> them."*

## Population

```bash
command grep -ln -iE 'no runtime|no daemon|no persist|resident (service|process)|runtime daemon' \
  docs/decisions/ADR-*.md
```

**21 ADRs.** The roadmap says 20. The 22nd grep hit,
`docs/decisions/engine-reclassification-2026-07.md`, is not an ADR — it is the
ADR-124 reclassification worksheet, which is why the count reads 21 and not 22.

## The counts

| mark | count |
|---|---:|
| `premise-load-bearing` | **10** |
| `premise-incidental` | **11** |
| `premise-unclear` | 0 |
| **sum** | **21** ✓ |

**Load-bearing:** ADR-040, 059, 088, 098, 099, 100, 105, 109, 124, 126.

**Incidental:** ADR-042, 055, 057, 116, 117, 118, 135, 138, 212, 224, 227.

## The finding: a grep-driven flip would have touched all 21

Eleven of the twenty-one match on a line that is **structurally incapable of
carrying a rejection** — a Consequences section, a rollback note, a risk table, a
Status scoping line, a References entry. And ADR-088's grep hit is in its
References line while its load-bearing clause sits 60 lines earlier, so
**keyword position is not a reliable guide even inside a load-bearing record.**

### Three rows where keyword matching gets the POLARITY wrong

These are the sharpest cases, and each was verified verbatim rather than taken
on report:

1. **ADR-116** — *"rejected in the tie-break: no persistence layer; the 'zero new
   deps' advantage evaporated"* (`:121-123`). The missing persistence is the
   **defect that killed the candidate**. The ADR decides **for** persistence
   (`node:sqlite` FTS5). A grep-driven sweep reads this as a no-persistence lock;
   it is the opposite.
2. **ADR-117** — *"non-producible in this package's harness (no runtime executes
   model `Task`/`Agent` tool calls)"* (`:24-25`), quoted as a premise that **had
   already failed**, and retired two paragraphs later: *"The harness now executes
   subagents."*
3. **ADR-227** — *"Its pre-registered Risk 1 was that `paths:` would be
   **projection-inert**, by analogy to `triggers:` having no runtime consumer on
   any host"* (`:47-48`). The premise appears **only as a hypothesis the ADR
   refutes**.

**ADR-212 belongs beside them** and is the strongest single piece of evidence
that the premise and the rejections are separable: it names ADR-040's premise
**stale in its own Context** (`:49-52`) and still rejects the resolver, on
matcher-equivalence, validation-before-infrastructure, failure asymmetry and
replay determinism.

### A cross-roadmap note on ADR-227

Its analogy — *"`triggers:` having no runtime consumer on any host"* — is itself
now false. `rule_inject_hook.ts` reads `dist/router.json` via `loadRouter` and is
bound on three slots; that correction landed under
`road-to-ten-across-the-board` step 3.3 on the same day. **This does not change
ADR-227's mark:** its decision rests on a saturation measurement, and the analogy
was already carried as a refuted hypothesis. It is recorded because the next
reader of that line deserves to know it went stale in both directions.

## The ten load-bearing rows — what each becomes if the premise is lifted

| ADR | if the premise lifts |
|---|---|
| **040** | Mid-session / background re-projection reopens as a design question. The second leg (static files, zero integration) survives — **weakens, does not collapse.** |
| **059** | § 4 becomes "a TTL/cron reaper is admissible". § 5 still fails on its own negative-ROI argument. |
| **088** | Federation stops being a category boundary and becomes an ordinary cost/benefit question — which is exactly the "own ADR" its Decision 3 defers to. |
| **098** | Decision-10's kill of the global layer loses its reason. **Already moot** — ADR-100 reversed it. |
| **099** | `src/patterns/` still ships; "file-first" stops being mandatory, and the rejected runtime store returns as a live option. |
| **100** | **Decision 1 evaporates** — it asserts nothing but the premise — and with it the justification for unversioned, unlocked, last-write-wins storage. |
| **105** | Automatic cohort-disable becomes buildable. Decisions 1-5 and 7 untouched. |
| **109** | The non-dispatch guarantee loses its ground and `auto_dispatch` becomes expressible — the one thing the record says is impossible. |
| **124** | Class B stops being prohibited in core; the three-class doctrine and its central table have to be rewritten. |
| **126** | Decision 1's Class-A confinement widens. **But the reach skill stays cancelled** — that came from a pre-registered 0-of-12 benchmark null, so the admissible shape changes and the shipped outcome does not. |

## Status flags — where a careless flip would do damage

**None of the 21 is `superseded`, `deprecated` or `rejected`.** Twenty carry
`status: accepted`; **ADR-224 is `proposed`**, so a change there is a maintainer
*acceptance*, not a status reversal — and its own Status section says it *"changes
no runtime behaviour by itself"*.

**Two carry PARTIAL supersession, which is a third act again** — the record is
live, one clause is not:

- **ADR-088** — `superseded_by: ADR-124`, `superseded_scope: engine-adoption
  interpretation only`. Its no-runtime **coordinator** boundary is still live.
- **ADR-098** — `superseded_by: ADR-100`, `superseded_scope: Decision-10 only`.
  Its load-bearing premise clause sits in the reasoning behind **the one Decision
  that is already superseded**. Flipping ADR-098 on the premise would be
  re-deciding a dead clause.

Both are load-bearing rows. Both are precisely where a careless status flip
would do damage, and both were only visible because 1.1 had already migrated the
scope out of a parenthetical and into a field.
