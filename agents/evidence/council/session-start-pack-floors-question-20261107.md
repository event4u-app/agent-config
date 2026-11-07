<!-- evidence-type: analysis -->

# Council question — inactive-pack safety floors at session start (2026-11-07)

Roadmap: `road-to-a-session-start-under-the-host-limit`, steps 2.2 and 2.4.

## Facts (verified in the tree at origin/main 389fc895e9)

- Claude Code loads every file under `~/.claude/rules/` at session start unless it carries
  `paths:`. The host warns when the instruction layer exceeds 120,000 chars (200K window) /
  150,000 (1M window). The package-owned part of that layer measures 342,342 chars today.
  The roadmap's target is at most 80,000 chars for the package-delivered part.
- Each high-consequence or safety-floor rule is being given a self-contained **startup
  contract** (≤2,000 chars: activation, binding obligation/prohibition, exceptions, stop and
  escalation conditions, precedence, numeric bounds) that replaces its full body at session
  start; the full body stays reachable through a file pointer. Per-rule deterministic tests
  check every audited clause is in the contract.
- `src/install/ruleInScope.ts` (council decision of 2026-10-25, "D14"): a rule with a
  `consequence_class` whose `routes_to` names a `skill:` ships **regardless of its pack**,
  because claude-code lists every skill whatever the active packs are, so the skill the floor
  guards is reachable even when the pack is inactive.
- Floors affected by that branch today: `legal-safety-floor` (packs: legal-review-prep;
  full body 6,773 chars), `finance-safety-floor` (finance-basic/advanced; 4,842),
  `strategy-safety-floor` (founder-strategy; 5,249), `image-likeness-and-rights`
  (ai-image; 3,232). Together ~20,100 chars of full body.
- `brand-source-of-truth`, `scale-discipline`, `history-discipline` carry a `packs:` key but
  **no** `consequence_class`, so the branch does not apply: they already ship only when
  their pack is active.

## Question

When the pack of one of the four floors is inactive, what should ship at session start?

1. The full body (status quo, D14 unchanged).
2. The floor's startup contract only (≤2,000 chars), body behind the pointer.
3. Nothing at session start; the floor arrives with its skill (e.g. a `paths:`-free stub
   is dropped and the skill body itself states the floor), or by trigger only.
4. Something else — name it.

Answer for the four floors (they may differ), name the failure each option risks, and give a
`revisit-if` condition. Also state whether the three pack-following floors
(brand/scale/history) should change.

## Answers (2026-11-07, anthropic + openai, both seats answered, design mode, $0 billed)

| Floor | anthropic | openai |
|---|---|---|
| `legal-safety-floor` | 4 — split: ≤500-char session floor at start, rest with the skill | 2 — startup contract |
| `finance-safety-floor` | 4 — same split | 2 — startup contract |
| `strategy-safety-floor` | 3 provisionally; 2 if the audit finds session obligations | 2 — startup contract, provisional |
| `image-likeness-and-rights` | 2 — startup contract | 2 — startup contract |
| brand / scale / history | keep pack-following; audit for session obligations first | keep pack-following |

Common ground: neither seat keeps the full body (option 1); neither accepts option 3 for legal,
finance or image; both keep the three pack-following floors as they are. openai explicitly
defers option 4 "until measured duplication justifies it".

Conditions raised (openai, must-fix): preservation wins over the size cap (a rule that cannot
fit keeps its full body under a recorded exception); stale full-body copies are replaced on
upgrade without touching user-edited files; a changed layer takes effect in a fresh session;
contract and body ship together from one source file, and an unreadable body never weakens
the contract. anthropic asks for a session/skill scope classification per clause.
