<!-- evidence-type: analysis -->

# Council — the read-only advisory notice on session_start (2026-10-21, round 2)

AI council, `anthropic` + `openai`, CLI seats, one round, 2/2 present, $0.00.
Question: `advisory-session-notice-20261021.question.md` beside this file.

## Verdict: `ratified` (2/2), with conditions

| Q | Verdict |
|---|---|
| Q1 | (b) both seats — it IS a narrow authority expansion: a privileged hook gains influence by choosing what the agent sees and proposing an action, even though it executes nothing. It must be declared. |
| Q2 | (a) both seats — it may ship now on the existing handler; this round is the explicit narrow approval the open blocker asked for, and the action-capable update concerns stay blocked. |
| Q3 | (b) both seats — the refresh reminder is acceptable because it only appears once a project-local refresh already created the cache. |
| Q4 | cache-derived strings reach privileged context; JSON encoding protects transport, not the decoded text. |

## Conditions, and where each landed

| Condition | Landed |
|---|---|
| Declare the expansion, including that `notify` is a default and not an affirmative opt-in | ADR-296 |
| Strict single-line grammar and length cap for every cache-derived field | `safeField` / `enumField` in `src/scripts/_lib/advisory_notice.ts` |
| Adversarial cache tests (newline, control character, forged command, over-long) | `tests/scripts/advisories.test.ts` — seen red with the validation disabled, green with it |
| Verify the import tree is network-free | a transitive value-import walk in the same test file |
| A failing stamp write never breaks the session start | same test file |
| (minor) the `reason` field undercounted multiple blocks | `session_register_hook.ts` now names every block present |

## Seat text

### anthropic

## Round 2 Review

### Points of agreement with prior reviewers

**Agree with Reviewer B on Q1**: This IS an authority expansion under F2(b). Adding proactive advisory notices to session context expands that handler's influence, even though execution remains gated. The fact that it's read-only doesn't change that its scope has grown. The blocker explicitly asked to "declare an authority expansion as such" — transparency about the change is required, not refusal.

**Agree with both reviewers on Q2**: It may ship now, contingent on explicit declaration. The blocker targeted update-notice concerns "that may initiate actions"; this notice structurally cannot (offers are text). This review IS the requested narrow approval.

**Agree with Reviewer A on Q3(b)**, though (a) is defensible: Cache existence proves the user already ran the governed command once. However, since "no cache → no line" is already the behavior, both answers converge in practice.

**Strongly agree with Reviewer B on Q4**: Cache-derived strings entering agent context without demonstrated validation is the critical safety gap. `JSON.stringify` protects JSON framing, not decoded agent content.

### Points of disagreement

**Disagree with Reviewer A on Q1(a)**: "An information surface with an offer is not an authority expansion where the offer itself carries no authority to act" is technically correct but misses the blocker's ask. F2(b) didn't say "refuse expansions" — it said "declare them". The handler's influence **has** expanded; that's what needs declaration, regardless of execution authority.

**Partial disagreement with Reviewer B's verdict**: Labeling this "Mixed" then "ratified" creates confusion. The validation concern is serious but addressable — this should be `ratified` with explicit conditions (declaration + validation), not mixed approval.

### New points not raised in round 1

**Import tree verification**: The description claims "no fetch, no child process, no network code is reachable from the hook bundle" but doesn't show the actual import graph. Validate that `advisory_notice.ts` transitively imports only the stated modules (`node:fs`, `node:path`, settings loader, `git_common_dir`, type-only advisory imports).

**Stamp-write failure isolation**: The `try`/`catch` at line 957–961 degrades to null, but verify stamp write failure cannot crash session start or leave partial state. A blocked filesystem shouldn't break every session.

**Misleading reason field**: Line 968's `reason` inherits first-match pattern — if advisories ride with retro, reason says "retro queue" not "retro queue and advisories". Not unsafe, but undercounts when multiple blocks present. Consider appending instead of first-match, or document the truncation.

### Concrete next steps

Before merge:
1. **Declare the expansion**: Record in `docs/decisions/` or equivalent that session_start now surfaces advisories (satisfies F2(b))
2. **Add cache-field validation**: Every ID, version, enum, file:line from cache must be validated against strict single-line grammar (no newlines, control chars, injection sequences) before entering context
3. **Test adversarial cache**: Cover newlines, control characters, forged paths, absurdly long strings
4. **Verify import tree**: Confirm no network code transitively reachable
5. **Test stamp-write failure**: Confirm graceful degradation

### Final verdict

**`ratified`**

**Reasoning**: This is a narrow, bounded authority expansion that satisfies the blocker's substantive safeguards — local cache only, no automatic remediation, user-owned off switch, structurally cannot execute. The validation gap is serious but addressable pre-merge. Approving here provides the explicit narrow approval requested, contingent on: (1) declaring the expansion per F2(b), (2) adding cache-field validation per Reviewer B's safety concern.

### openai

Assessment: **Mixed, leaning approval.** The notice is operationally read-only, but adding proactive, command-shaped guidance to privileged `session_start` context is a narrow authority expansion.

**Q1. (b)** Yes; it expands the handler from reporting existing session/worktree state to steering dependency-remediation behavior, even though execution remains separately authorized.

**Q2. (a)** Yes, provided this review records that expansion and cache-derived fields are strictly validated before shipping; the unrelated action-capable concerns may remain blocked.

**Q3. (b)** Acceptable only after a project-local refresh has already created the cache, because that establishes prior participation while the refresh command must still independently enforce `advisories.egress`.

**Q4.** At `session_register_hook.ts:962`, cache-derived strings enter agent context without demonstrated rejection of newlines, control characters, or forged command-like fields; JSON encoding protects transport, not the interpreted context.

**Prior-round assessment**

1. I agree with Reviewer B that this is a narrow authority expansion and that strict single-line validation is required. I agree with Reviewer A’s Q3 conclusion that cache existence makes the refresh message a reminder rather than a first solicitation.

2. I disagree with Reviewer A’s claim that an information surface cannot expand authority merely because it performs no command. A privileged hook gains behavioral influence by deciding what the agent sees and explicitly proposing an action.

3. Neither review highlights that `advisories.mode: notify` being the default weakens the claim of meaningful user consent: it is a user-controlled gate, but not affirmative opt-in. The authority declaration should state that distinction explicitly.

The strongest argument for approval is the structural boundary: no network path, no remediation execution, a local cache prerequisite, and a user-controlled off switch. The strongest counter-argument is that privileged-context injection can steer agent behavior even without directly executing anything.

Next steps: document the authority expansion, enforce strict single-line allowlists and length limits for every cache-derived field, add adversarial cache tests, verify egress enforcement independently, and test stamp-write failure behavior.

Summary: Approve the existing-handler integration only after cache sanitization and explicit authority documentation.

ratified

