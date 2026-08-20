<!-- evidence-type: analysis -->

# Cost-parity part 1 — drain-run readings

Measured 2026-08-20 on `drain/road-to-cost-parity-1-rule-payload-diet`
@ `46837f58b`, merged from `origin/main` @ `b593d8c00`. Every figure below is a
command reading taken on that tree, not a restatement of the roadmap's text.

Scope: the readings needed to close
`road-to-cost-parity-1-rule-payload-diet.md` honestly — the facts its steps
cite, the one measurement its own stop-condition (3.5c) demanded before Phase 3
could commit, and the drift check on the one baseline it had just refreshed.

Regeneration state: **not regenerated in this checkout.** The projections read
below are the committed / inherited trees as merged. `dist/agent-src/rules/` and
`.augment/rules/` are tracked and therefore checkout-stable; `.claude/rules/`,
`.clinerules/` and `.windsurfrules` are generator outputs and their *absolute*
byte totals are machine-dependent. Nothing here depends on an absolute total —
the load-bearing reading is a **structural** one (which keys survive per
carrier), which is a property of the emitter and not of staleness.

## 1 — Two facts this area is usually argued from, both refuted

The sibling drain of `road-to-skill-description-measurement` refuted two of the
three facts in this roadmap's blocker text. Both re-verified here rather than
inherited.

```
./scripts-run src/scripts/report_skill_activation      # run from the PARENT checkout
  skills shipped                         290
  with a machine-matchable trigger key   4 (1.4%)
  with a deterministic obligation        30 (10.3%)
  sessions= 30  asst= 11547  Skill calls= 13
  invocations total                      13
  distinct skills invoked                5 of 290 (1.7%)
      pr:create, roadmap-writing, roadmap:process-full, using-git-worktrees, worktree:create
```

Run from the parent checkout deliberately: a worktree has its own empty
transcript store and reports zero invocations, which is a measurement artefact
and not a reading.

**(a) "0 skills declare a machine-matchable trigger" is FALSE. Four do.**

| skill | declaration site |
|---|---|
| `merge-conflicts` | `src/skills/merge-conflicts/SKILL.md:10` |
| `systematic-debugging` | `src/skills/systematic-debugging/SKILL.md:11` |
| `threat-modeling` | `src/skills/threat-modeling/SKILL.md:13` |
| `authz-review` | `src/skills/authz-review/SKILL.md:14` |

A naive `grep -rln '^triggers:' src/skills/` returns **five** files. The fifth,
`src/skills/rule-writing/SKILL.md:195`, is a worked example of *rule*
frontmatter inside that skill's body, not a declaration of its own. The
instrument's count of 4 is correct and the grep is the trap; recorded because
the next reader will run the grep.

`src/scripts/report_skill_activation.ts:27` still asserts in its own docstring
that "There are none: 0 of 288 skills carry a `triggers:` key" — stale on both
numbers while the code above it prints the right ones. Left in place: it is the
sibling roadmap's surface, and this drain edits no file another roadmap owns
(6.9 below).

**(b) "6 of 288 ever invoked" is window-dependent, and its denominator is stale.**
Today's reading is 5 distinct of 290 over 30 sessions. Two further censuses of
the same instrument exist and disagree with each other, which is the point: 6 of
288 over 59 sessions, and 4 of 288 over 30 sessions. The substance — single-digit
distinct skills against a ~290 catalogue — survives every reading; the specific
integer does not, and no bar may be anchored on it.

## 2 — Stale-figure inventory

Every figure this roadmap's steps cite as a "measured baseline", re-read. Five
of six had moved, all in the direction that weakens the step citing them.

| step | figure as written | reading 2026-08-20 | direction |
|---|---|---|---|
| header | 289 skills, 116 rules | **290 skills, 119 rules** | up |
| 1.3 | enforcement coverage 12.9 %, 15 of 116, 32 declared / 84 undeclared | **12.6 %, 15 of 119, 34 declared / 85 undeclared** | denominator up, coverage down |
| 2.1b | 6 of 288 skills invoked, 0 declare a trigger | **5 of 290; 4 declare a trigger** | refuted (§ 1) |
| 3.6 | norm inventory 171 MUST/NEVER/ALWAYS across 116 rules | **194 across 119 rules** | up |
| 4.2 | CLI registry baseline 97 verbs | **101 verbs** | up |
| 4.3 | per-host chain census, refreshed 2026-08-18 | **drifted on 7 of 8 hosts in 2 days** (§ 4) | up |

```
./scripts-run src/scripts/check_enforcement_coverage --quiet
  enforcement coverage · 15/119 rules (12.6%) have a backstop that fails a CI build
    declared 34 · local-only 0 · observer 9 · unwired 0 · missing 0 · undeclared 85

./scripts-run src/scripts/check_cli_registry_budget_sync --quiet
  ✅  cli_help_command_count in sync — registry (101) == budget == committed record.

grep -ohE '\b(MUST|NEVER|ALWAYS)\b' src/rules/*.md | wc -l   →  194
ls src/rules/*.md | wc -l                                    →  119
ls -d src/skills/*/ | wc -l                                  →  290
```

The 4.2 reading deserves its own line. That step says the registry budget
"ratchets **down** after the census". The registry has instead gone 97 → 101
while the census that was to precede the ratchet has not been built. The gate is
green because budget and registry agree; agreement at a *higher* number is not
what the step was written to produce.

## 3 — Phase 3.5c: the measurement its own stop-condition required

Step 3.5c is explicit: *"Measure the payload delta before Phase 3 commits,
because norm-lines can make it worse… if the net is positive, Phase 3 stops and
the design is reconsidered."* That measurement is available today without
building anything, and it was never taken. Taken here.

### 3a — Which frontmatter keys survive, per carrier

This is the structural reading, and it is the one that decides the phase.

| carrier | files | with frontmatter | keys that survive | bytes |
|---|---:|---:|---|---:|
| `src/rules/` (source) | 119 | 119 | all | 483,120 |
| `dist/agent-src/rules/` | 118 | 118 | all (`dist == rewrite(src)`) | 477,923 |
| `.augment/rules/` | 118 | 118 | all (mirrors `dist` by symlink) | 477,923 |
| `.clinerules/` | 114 | 114 | all | 476,028 |
| **`.claude/rules/`** | **113** | **4** | **`paths:` only** | **390,021** |
| `.windsurfrules` | 1 | — | single concatenated file | 390,254 |

```
withfm=0; nofm=0
for f in .claude/rules/*.md; do
  if [ "$(head -1 "$f")" = "---" ]; then withfm=$((withfm+1)); else nofm=$((nofm+1)); fi
done
echo "files: $((withfm+nofm))  with frontmatter: $withfm  without: $nofm"
  → files: 113  with frontmatter: 4  without: 109

# and the only key present in those four:
  → 4 × paths:
```

**The Claude rule emitter carries `paths:` and nothing else.** 109 of 113
projected files carry no frontmatter at all.

### 3b — The arithmetic

Empirical proxy for "one authored line": the length of the existing
`description:` field across all 119 rules — same shape, same authoring
constraint, already length-capped in the tree. 119 samples, median **108**
chars, mean 115, range 54–187.

| item | per rule | × 110 non-kernel rules | lands in |
|---|---:|---:|---|
| 3.1 `norm:` frontmatter line (`"norm: "` + 108 + newline) | 115 B | **12,650 B** | frontmatter |
| 3.4 three section markers | 51 B | **5,610 B** | **body** |

Non-kernel scope is 110: 119 rules less the nine write-denied kernel rules,
derived from the contract (§ 5).

### 3c — Net per carrier, and the verdict

| carrier | 3.1 delivered? | 3.1 Δ | 3.4 Δ | net Δ | as % of carrier |
|---|---|---:|---:|---:|---:|
| `dist/agent-src/rules/` | yes | +12,650 | +5,610 | **+18,260** | +3.8 % |
| `.augment/rules/` | yes | +12,650 | +5,610 | **+18,260** | +3.8 % |
| `.clinerules/` | yes | +12,650 | +5,610 | **+18,260** | +3.8 % |
| **`.claude/rules/`** | **no — key stripped** | **+0** | **+5,610** | **+5,610** | **+1.4 %** |

**The net is positive on every carrier, so 3.5c's stop-condition fires as
written.** But the reason it fires on Claude is worse than the arithmetic, and
it is the finding:

- On Claude the `norm:` line **costs nothing and delivers nothing.** The
  frontmatter key does not survive the emitter, so the authored norm never
  reaches the session it was authored for.
- What *does* reach a Claude session is 3.4's section markers: **+5,610 bytes of
  pure delivery cost carrying none of the norm content.**
- Step 4.3 of this same roadmap establishes that **"claude is the binding host on
  every slot"**. On the binding host, Phase 3 as designed is cost without
  delivery.

Two of the roadmap's own load-bearing statements do not survive this reading:

- **Risk 2** ("The norm-line drifts from the body it fronts — a stale index line
  delivers a wrong norm to **every session**") assumes the norm is delivered. On
  the Claude carrier it is not delivered at all, so the risk it mitigates does
  not exist there and the drift lint (3.2) would be guarding an undelivered
  field.
- **6.8** infers from "110 rules reach a Claude session" that "a norm-line is in
  the payload whatever its type says." The inference does not hold: the *rule
  body* reaches the session, the *frontmatter* does not. 6.8's byte ceiling is
  therefore not threatened by 3.1 — and that is bad news, not good, because it
  is the same fact as the norm not arriving.

This is a measurement about the design, not about effort. Phase 3 stops here on
its own instruction, and the design question it hands forward is a real one:
either the norm must be authored into the rule **body** (where it is delivered,
and where `preservation-guard` governs it), or the Claude emitter must carry the
field — and neither is a variant of what Phase 3 was written to do.

## 4 — Step 4.3's baseline drifted again within two days

The table in 4.3 was refreshed on 2026-08-18 with an explicit note that a cap
anchored on a stale census "ages in the one direction that matters — upward, so
the cap admits growth it was written to refuse." Re-counted straight off
`src/scripts/hook_manifest.yaml` today:

| host | `user_prompt_submit` | `pre_tool_use` | `post_tool_use` | `stop` | `session_start` | `session_end` |
|---|---:|---:|---:|---:|---:|---:|
| augment | — | 11 | **11** *(was 10)* | 6 | **14** *(was 13)* | 4 |
| claude | 10 | **13** *(was 12)* | **12** *(was 11)* | **12** *(was 11)* | **14** *(was 13)* | 4 |
| cowork | 8 | **13** *(was 12)* | **11** *(was 10)* | 6 | **14** *(was 13)* | 4 |
| cursor | 8 | — | **11** *(was 10)* | 6 | **14** *(was 13)* | 4 |
| cline | 8 | — | **11** *(was 10)* | 6 | **14** *(was 13)* | 4 |
| windsurf | 7 | — | — | 5 | **13** *(was 12)* | — |
| gemini | 8 | — | **11** *(was 10)* | 6 | **14** *(was 13)* | 4 |
| copilot | — | — | — | — | — | — |

Seven of eight hosts moved; every movement is upward; the elapsed time is two
days. A dash remains "no binding on that slot for that host", never headroom.

The finding is about the mechanism, not the integers: this census has now been
refreshed twice and gone stale twice, in the same direction, inside one drain
run. A cap whose baseline decays faster than the cap can be authored is not a
cap — it is a number that will be raised to admit whatever landed since. The
honest conclusion is that 4.3 needs a *computed* cap (a gate that reads the
manifest at run time, as 3.5 requires for the kernel set) rather than a
transcribed table, and that is a different piece of work from the one 4.3
describes.

## 5 — Statements that verified true

Not every step failed its check. Three verified as written.

**3.5 — the kernel set is derivable at run time, and the count is nine.**
`docs/contracts/kernel-membership.md § 4` carries the locked set as a table:
`agent-authority`, `ask-when-uncertain`, `commit-policy`, `direct-answers`,
`language-and-tone`, `no-cheap-questions`, `non-destructive-by-default`,
`scope-control`, `verify-before-complete`. A sweep can read it; 3.5's refusal to
hardcode nine names is implementable exactly as specified.

**5.4 — `agents/settings/contexts/` ships to nobody. Confirmed.**

```
node -e "const p=require('./package.json'); ..."
  files[] entries: 26
  NO entry matching /context/
  agents/ entries: [ 'agents/templates/' ]
```

The only `agents/` path in `package.json` `files[]` is `agents/templates/`. The
directory is a maintainer working tree; tidying it is maintenance and counts
toward no payload target. Its size has grown since the roadmap measured it —
88 files today against the 78 recorded — which strengthens rather than weakens
the step: the more tempting the number gets, the more the exclusion needs
stating.

**5.3 — the shipped contexts surface, re-measured.** `src/agent-src/contexts/`
holds 58 files today against the 57 recorded. The species separation the step
asks for is real work that nothing blocks; it is simply not work this drain had
the room to do, and it is recorded as unstarted rather than as anything else.

## 6 — What this artefact does not establish

- **No consolidation was attempted.** Phase 2's clusters are untouched. The
  activation instrument that would detect a merge breaking activation is
  human-gated, and § 1(b) shows the baseline integer is not stable enough to
  anchor a bar on — which is the transferred blocker, not a finding.
- **No census was built.** Phase 1 needs the surface-consolidation sweep's
  verdict vocabulary, which is time-gated. The three readings above that Phase
  1.3 wanted (enforcement coverage, skill activation, and the counts) are here;
  the manifest that would hold them per-skill and per-rule is not.
- **The Phase 3 arithmetic is a projection, not a landed diff.** It multiplies a
  measured per-rule cost by a measured rule count. The *structural* half — which
  keys survive per carrier — is a direct reading and is the half the verdict
  rests on.
- **No absolute payload total here is checkout-portable** except the two tracked
  trees. Stated in the header and repeated because a later reader comparing
  totals across machines will otherwise read generator staleness as a diet.
