# Census for the discipline-default flip, and three measurements that outlive it

<!-- evidence-type: analysis -->

Produced 2026-08-20 by the autonomous drain run that closed
[`road-to-rule-coherence-followup.md`](../../roadmaps/archive/road-to-rule-coherence-followup.md).
Its Phase 1 states the division of labour verbatim — *"the agent's job is the
diff plus the census; the decision is the maintainer's"* — so this file is the
census half. The flip itself is transferred; see
[`stubs/road-to-discipline-default-flip.md`](../../roadmaps/stubs/road-to-discipline-default-flip.md).

Every number below was read from a command in this checkout on 2026-08-20, and
the command is printed next to it. Token figures are **exact BPE**
(`cl100k_base` via `js-tiktoken`), not the `chars / 4` proxy — the proxy is
named where it is the only figure available.

## 1. The finding that reframes the pre-registered criterion

F1.1 pre-registered its acceptance as *"fresh-install census — always-on rule
prose ≤ 30k tok"*, and recorded ~163k "as loaded" at audit time. That phrasing
has **two defensible readings with a 12× gap between them**, and which one the
criterion means decides whether the flip can ever pass it.

`grep -rn 'rule_loading_tier\|discipline_profile' src/scripts/condense.ts
src/scripts/generate_*.ts src/install/*.ts` returns **no hit in any of them**.
The only match anywhere near the projection path is a doc comment in
`src/scripts/generate_settings_reference.ts:71`. So:

```
NO PER-TOOL RULE-PROJECTION SURFACE READS `discipline_profile`.
FLIPPING IT DOES NOT CHANGE WHICH RULE BODIES A HOST RECEIVES.
```

The key is consumed by `resolve_discipline_profile` in the work-engine
(`src/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts:1232`) and
named in `compile_router.ts:283` as the *always-honoured* surface per tier —
`essential: ['__kernel__', 'downstream-changes']` — with that file's own comment
stating that trigger routing of tier-1/tier-2 **stays active under every
profile** (ADR-110 / ADR-040).

| Reading of "always-on rule prose" | Measured 2026-08-20 | Against ≤ 30k |
|---|---|---|
| The router's always-honoured surface under `essential` — 9 kernel rules + `downstream-changes` | **8,909 tok** (`dist/agent-src/rules`; 8,904 at source) | **passes**, 3.4× under |
| What a fresh install's rule projection actually emits every session | **111,035 tok**, and `discipline_profile` does not move it | **fails**, 3.7× over |

Kernel alone (`discipline_profile: off`) is **7,184 tok**; `downstream-changes`
is the 1,725-tok delta that makes `essential`.

Commands:

~~~bash
./scripts-run src/scripts/check_rule_activation_census
# ✅ 4 scoped · 17 mixed · 111035 unconditional tokens (exact BPE) · 119 rule file(s)
~~~

The per-profile totals were summed over the ids in
`compile_router.ts` § `profiles` with `gpt_tokens()` from
`src/scripts/_lib/token_count.ts` (`TIKTOKEN_AVAILABLE: true`).

**What this does not say.** It does not say the flip is worthless — the router
surface is a real mechanism and `essential` is the measured-lift tier. It says
the ≤ 30k criterion cannot be read as a property of the flip on the projection
path, because that path never consults the key. Whoever takes the decision has
to name which reading they are accepting; the roadmap could not, which is the
substantive reason its own note says nothing had yet measured `essential`'s
fresh-install cost.

The ~163k audit-time figure is a third, larger denominator again ("as loaded",
i.e. rule prose plus everything else in the session preamble). It is not
comparable to either row above and is not re-derived here.

## 2. `projection.rule_packs: auto` — the drop, re-measured

F1.3 claimed "exactly the 8 rules the template names (~8,308 GPT tok measured
today vs the archived 8,110)". Re-measured through the emitter's own predicates
(`rule_in_scope` from `src/install/ruleInScope.ts` + `resolve_rule_pack_scope`
from `src/scripts/_lib/scoped_projection.ts`), with the active-pack set derived
by `auto`:

| Reading | 2026-08-20 |
|---|---|
| Rules kept | 111 |
| Rules dropped | **8** |
| Dropped prose | **8,523 tok** exact BPE (34,605 chars) |

The dropped set, unchanged from the template's own list — the six domain
floors plus two: `finance-safety-floor`, `image-likeness-and-rights`,
`legal-safety-floor`, `media-governance-routing`, `media-sync-ground-truth`,
`provider-lifecycle-discipline`, `spreadsheet-source-quality`,
`strategy-safety-floor`.

Drift against the archived 8,110 is +5.1 %, against the roadmap's 8,308
+2.6 %, and the **count and the membership are identical**. Directionally
confirmed; the claim survives re-measurement.

## 3. `projection.scope_dedup` — the shared-scope reading, re-measured

F1.4 claimed "109 shared basenames between the user-global and project rule
scopes on a real install". `./scripts-run src/scripts/measure_scope_dedup`
today:

| Reading | 2026-08-20 |
|---|---|
| Rule files in the projection | 118 |
| Present at **both** scopes (shared basenames) | **115** |
| Absent at user scope | 3 |
| Byte-identical twins on this machine (the control) | **0 / 118** |
| Differ only in the ownership stamp | 107 / 118 |
| Differ in body | 8 / 118 |
| Fixture (consumer condition, versions aligned) removal | 119,481 tok of a 238,962-tok two-scope payload — **50.0 %**, or 51.8 % of the measured median cold-start |

115 shared basenames against the roadmap's 109 — the claim is directionally
confirmed and slightly larger. The control reading matters more than the
headline: on a maintainer checkout the dedup is **correctly inert**, because
the two scopes hold different releases. The 50 % figure is the consumer
condition, reachable by aligning versions (107 of the 118 differ *only* in the
ownership stamp).

## 4. F5.1's instrument is contaminated, and cannot be fixed by grepping harder

`context-hygiene`'s declared-protocol read cap of 8 carries a falsifiable
revisit trigger: **≥ 10 declared-protocol sessions** → set the cap at their
p95, or **90 days with fewer than 10** → drop back to the undeclared 5. The
trigger landed `cb126e88c`, 2026-08-06, so the 90-day branch fires
**2026-11-04**. On 2026-08-20 the elapsed window is 14 days: neither branch has
fired, and concluding early is exactly what round 3 rejected.

Counting the sessions is the other branch, and the obvious instrument does not
work. Over the 1,226 transcripts written since 2026-08-06:

~~~bash
tr '\n' '\0' < sessions.txt | xargs -0 grep -l -i 'declared protocol'   # 55 files
tr '\n' '\0' < sessions.txt | xargs -0 grep -l -i 'expected read count' # 28 files
~~~

Every hit inspected is the **rule's own prose**, echoed into the session
because `context-hygiene` is projected into the preamble — plus roadmap and ADR
text discussing the cap, plus, by the end of the exercise, this run's own
grep commands quoted back in its own transcript. The search vocabulary is the
rule's vocabulary, so the instrument measures its own delivery, not the
behaviour. Under the drain framework's Rule 4 that is a **broken instrument**,
not a measured zero — a distinction it draws precisely so a contaminated null
cannot be reported as evidence.

A working instrument has to mark a declaration at the moment it is made — a
session-scoped marker a later pass can count — not recover it from prose.
Transferred with that as its stated content:
[`stubs/road-to-declared-protocol-cap.md`](../../roadmaps/stubs/road-to-declared-protocol-cap.md).

## Reproducing

~~~bash
./scripts-run src/scripts/check_rule_activation_census   # 111,035 unconditional tok
./scripts-run src/scripts/rule_activation_census --json  # per-rule verdicts, kernel ids
./scripts-run src/scripts/measure_scope_dedup            # § 3 in full
~~~

§ 1's per-profile sums and § 2's pack-drop sum were computed ad hoc over the
exported predicates named above; both are a `readdirSync` plus one
`gpt_tokens()` call per file, and are re-derivable in a few lines rather than
kept as a script nothing else calls.
