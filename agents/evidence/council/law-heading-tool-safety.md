# Law-heading review — `tool-safety`

<!-- evidence-type: analysis -->

verdict: owner

> **Scope:** step 4.2 of `road-to-a-thinned-layer-measured-in-one-unit`. The
> question is fidelity, not quality: does a standing law section change what the
> rule obligates, or omit a duty the body carries? It matters because
> `project_thin_rules` ships such a rule as a STUB PLUS ITS LAW SECTION.

## Verdict

**owner** — AI council 2026-10-10, three rounds, anthropic + openai, 2/2 in the
final round, $0.00 metered. **The heading did NOT land and has been reverted;
`tool-safety` stays in the `missing` baseline.**

The finding is not that a wording was poor. It is that this rule's duties do
not compress into a standing law: every round surfaced a different omitted
conditional duty, and each one was real on inspection.

## What each round found

| round | verdict | omission found, all verified against the body |
|---|---|---|
| 1 | split 1–1 | the audit-trail bullet is advisory ("should be observable and logged") and the law made it unconditional — a strengthening, not a restatement; and the Escalation section's affirmative step (flag as registry-extension suggestion, register before use) was absent, as was "reviewable" from the core principle |
| 2 | land / owner | the body's "prefer scoped-grant syntax over bare tool names **where the host supports it**" was not transmitted, so a thinned consumer could read `allowed_tools: [Bash]` as compliant where `Bash(npm test:*)` was available |
| 3 | owner, 2/2 | `disallowed_tools` precedence — optional to adopt, but binding once used: a deny entry overrides a matching allow pattern. Plus the numeric-threshold guidance, also prescriptive |

Each finding was repaired before the next round, in the body's own modality.
The verdict is about the pattern, not about the final text.

## The abort condition was pre-registered

Round 3's question stated, before the answer was known, that three rounds each
surfacing a NEW omission would be evidence about the approach rather than the
wording, and that the right verdict would then be `owner` on those grounds.
Both seats reached exactly that, and one named the sequence back:
advisory→unconditional, escalation steps, scoped-grant preference, precedence.

Writing the test first is what makes this verdict checkable. Without it, each
repair could have been followed by another round until a reviewer ran out of
findings, and exhaustion would have been recorded as convergence.

## Recorded but NOT part of this verdict

Seats raised three concerns about the RULE: the registry's own trust boundary
(who may modify it, how additions are reviewed, whether adapters enforce
declared scopes); the internal-capability carve-out treating file reading as
not-an-external-tool, when filesystem reads can expose credentials; and
approval ambiguity — "a write needs explicit approval" names no approver,
scope or lifetime. Out of scope for a fidelity review, kept here so they are
not lost.

## What the owner is being asked

Not to approve a wording. To decide whether `tool-safety` should carry a
standing law at all, given that four separate conditional duties resisted it —
or whether this rule is one that must ship whole, with its entry in `missing`
becoming a recorded decision rather than a backlog item.
