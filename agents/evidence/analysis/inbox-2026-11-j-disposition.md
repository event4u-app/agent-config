# inbox-2026-11-j — disposition

> **Source:** `agents/tmp.old/inbox-2026-11-j/` (`t1/`, `t2/`; true sources in the
> round's encrypted intake note). Verified at `c183b82358` on 2026-11-02.
> Roadmaps: `road-to-a-lead-the-user-can-reach` (active → archived in the same PR),
> `later/road-to-a-lead-the-user-can-reach-carried`.

## Scope

Two topic folders, one theme: *this package against one peer harness, three loops
each*. A third candidate, the 1.4 MB multi-repo link program, is over the lane
threshold (~400 KB) and is left in the inbox for its own round — not consumed.

Census (`inbox_source_census`): 3 topics · 8 files · 0 revision sets · 490 anchors.
The two `.md` drafts in `t2/` beside the final proposal are earlier loop outputs of
the same transcript, not a revision set by name; their items are subsumed by the
final proposal's change log (v1–v8) and were read for anything it dropped — nothing
the proposal's kill register does not name.

## Transcript walk — user turns

| Turn | Demand | Disposition |
|---|---|---|
| t1·1 | Compare in depth with the peer; what can we learn, use, adapt; plan a roadmap; three loops | adopted — this file + both roadmaps |
| t2·1 | Same for a code-minimalism peer | adopted — ladder findings routed to the existing stub and the carried roadmap |
| t2·2 | Same for a token-compression peer: "can we optimize further?" | adopted — the answer is yes for effort per slice, return bytes and repeat-script reading (active 2.2, carried 2.2–2.4). The draft's other levers (voice, log compression, router service, warm cache) are the agent's proposals, not the owner's words, and are killed with reasons (K11–K14) |
| t2·2 | Constraint (agent reply, endorsed by the next owner turn): adapt selectively, no second always-on governance layer | adopted as the active roadmap's owner constraint and non-goal — no concern, no always-on rule, no default flip |

## Point ledger

```
claims        57 extracted (t1 A1–A24, t2 D1–D15 + P1.1 law census, overlaps merged)
              → still-true 41 · overtaken 4 · never-true 2 · unverifiable 10
instructions  27 extracted (t1 P0–P9 steps, t2 P0–P8 steps)
              → reproduced 6 · diverged 0 · unexecutable 1 · out-of-bound 9 · not-attempted 11
demands        4 extracted (owner turns above; owner demands are never declined)
              → adopted 4 · already-satisfied 0 · declined 0 · owner-decision 0
```

- `unverifiable` = the peer-side figures (`E*`, `W*`, the peer's own benchmark
  numbers): read from the drafts, not re-derived — no network in this run.
- `never-true`: A24 (`source-first-gate` is a frontend-capture shadow concern, not
  fact-forcing before destructive commands) and the half of A8 that says `internal`
  has no reason — ADR-041 forbids `security` as a visible leading token.
- `overtaken`: bench `--plugin-dir` and `--strict-mcp-config` (D8), landed since t2's
  pin; plus two A-row line numbers that moved.
- `unexecutable` 1: t1 P1.2 "visibility public, no new CLI verb" — the visible name
  breaks ADR-041 and the command's own call needs `scripts-run`, which a consumer
  lacks. **Corrected-from-reproduction:** reach through the `audit` cluster
  (`/audit config` + `agent-config audit:config`), exactly as `audit:deps` and
  `audit:agents` did.
- Reproduced: the A7 visibility read, the A11 env-var census, the A13 suppression
  grep, the A19 plugin listing, the D11 `effort:` grep, the P1.1 Iron-Law census.
- Corrected-from-reproduction, t2 D8: the peer's isolation recipe adds
  `--disable-slash-commands`; `claude --help` says it disables all skills and
  commands, so in the package arm it would remove what is measured. Not adopted.
- Out-of-bound (spend or weeks of window): t1 P2.5, P4, P9; t2 P0.1–P0.3, P2, P7.3, P8.
- Not attempted (outside the selection — no asserted outcome, not a reusable
  procedure): the remaining t1 P5–P8 and t2 P3–P6 authoring steps, all carried.

## Readings

**Fact-forcing before destructive commands (t1 P0.2).** Not covered by
`source-first-gate`. The obligation exists as prose (`non-destructive-by-default`:
"the approval names the exact object") and as the `staged_confirmation`
declaration, which binds nothing yet (its schema description names the blocker:
only one host both binds `pre_tool_use` and honours a deny). No new gate here.

**Cross-host equality census (t1 P6.0).** `check_host_tree_parity` seeds from
`dist/agent-src/rules` only. Skills and commands are covered by the CI step that
regenerates every host tree and fails on `git diff` (`consistency.yml`, "Check for
unexpected changes"). The claim and a hand-edit fixture are carried (3.2).

## Where every phase went

| Source item | Went to |
|---|---|
| t1 D1/P1 consumer scan reachable | active 1.1–1.3 |
| t1 D2/P2 hook presets, per-concern disable | carried 1.1 (owner) |
| t1 D3/P3 inline suppressions | arrival on `later/road-to-adversarial-verification-and-long-runs` 12.2 |
| t1 D4/P4 learning A/B | carried 2.1 |
| t1 D5/P5 cost guide | carried 3.3 |
| t1 D6/P6 equality claim | carried 3.2 |
| t1 D7/P7 plugin quirks | carried 3.4 |
| t1 D8/P8 IOC watch | carried 3.5 |
| t1 P9 head-to-head | carried 3.6 |
| t2 D1/P1 code-shape laws reach workers | carried 1.2 |
| t2 D2–D3/P2 ladder measurement | arrival on `stubs/road-to-solution-minimalism-full-tier-run` |
| t2 D4/P3 reuse instrument, D5/P4 repo map, D7/P5 closing line, D13/P6 cards, D10/P8 ablation | arms of the stub's run (arrival text) |
| t2 D8 bench isolation | active 2.1 (`no_session_persistence`) |
| t2 D11/P7 effort per slice | carried 2.4 |
| t2 D12/P0.4 repeated scripts | carried 2.3 |
| t2 D14/P0.5 return bytes | active 2.2 (field) + carried 2.2 (reading) |
| t2 D15 handle contract | confirmed, no work |
| t1 K1–K12, t2 K1–K17 | kill registers, active roadmap (merged) |
