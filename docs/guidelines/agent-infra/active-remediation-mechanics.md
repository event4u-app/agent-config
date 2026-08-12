# Active Remediation — Mechanics

> Ladder detail, version-gated modernization, and anti-nagging guardrails for the `active-remediation` rule

_Origin: migrated from `src/rules/active-remediation.md` per the P4 pattern of `road-to-kernel-and-router.md`. The Iron Law, the ladder tier names, and the live-security carve-out stay in the rule; this file carries the per-tier criteria and the modernization gates._

## The ladder — classify, then act

### Fix now (autonomous, inline) — a bounded amendment to `minimal-safe-diff`

Allowed **only** when ALL hold — this is the testable "small + task-aligned" definition:

- **Same request path / module** as the current task (not an unrelated feature).
- **≤ ~10 changed lines** in one production file plus its test file — no wider cross-file ripple.
- **No public-API / response-shape change**, no new parameter.
- **No dependency bump, no migration, no data change.**
- **Its verification ships in the same commit** — e.g. the security fix's negative test, or the correctness fix's case.

Under those constraints the fix is auditable in the same diff and is *not* scope creep — it corrects a boundary the agent touched. Anything outside them → the fix is **note + ask**, never auto. (`minimal-safe-diff` still governs everything else: no reformatting, no opportunistic refactor, no drive-by rename.)

### Note + ask (batched)

Bigger, or diverges from the task → do **not** refactor inline, do **not** interrupt the flow. Note the site (file:line + the issue). Surface the batch as **one** numbered-options prompt (per `user-interaction`, one recommendation line) **after the task is delivered** — or mid-work only when the flow makes it natural. Each option must carry a real trade-off (`no-cheap-questions`). Refactor only on an explicit yes, as a separate scoped change (`scope-control`, `downstream-changes`).

#### Option anatomy — a pickable fix, not a yes/no

The user should be able to answer with one number and get a change they can predict. Each numbered option therefore names four things, in a line or two:

1. **What changes** — the concrete edit, in the vocabulary of the code ("replace the three `array()` literals with `[]`", not "clean up the file").
2. **Where** — file, or the group of files if the option covers a batch.
3. **How large** — line count or an honest size class, so the user can weigh it without opening the diff.
4. **What it costs** — the risk, the review burden, or the reason it was not simply done inline.

Group findings by **fix shape**, never one option per finding: seven lint errors that are three `no-unused-vars`, three `prefer-const` and one genuine type hole are three options, not seven. The final option is always an explicit **leave it as is** — its absence is what turns a menu into pressure. One recommendation line under the block names your pick (`user-interaction` Iron Law 1).

#### Carry-over — undecided is not finished

An item the user has not answered stays live: raise it once more at the next natural task boundary, in the same batched form. Two bounds keep that from becoming nagging:

- **A decline is terminal.** An explicit "leave it" / "ignore" closes the item for the task; re-raising it is the re-ask `scope-control` § Decline = silence forbids.
- **Once per boundary, not once per reply.** The batch is a task-close artifact. Repeating it between steps is the continuation prompt `no-cheap-questions` Iron Law 4 forbids.

### Propose a follow-up PR (many spots)

When the issues are too many to fold in without blowing the current diff's scope, propose **one or more separate follow-up PRs** (or a roadmap under `agents/roadmaps/`, using the shared-prefix convention) so the user reviews the changes before merge. Creating the PR/roadmap is **permission-gated** — propose, get a yes, then create (`scope-control`, `commit-policy`).

## Observed failing checks — classifying the red you already have

The rule puts a check result you have already seen into the same ladder as a defect you read in a file. Running a command, reading seven errors, and walking past them is not scoping the work — it is looking away.

The rule's two bounds, in full:

- **Only output you already have.** The clause never obliges a check run; it fires on a result already in front of you. What runs locally stays the user's call — this package records "no proactive quality tools, remote CI gates only" as a standing preference — and the remote CI remains the authoritative gate. An obligation to *hunt* for red would contradict that outright; an obligation not to walk past red you already read does not.
- **Ownership picks the tier, never the silence.** Caused by your diff → it is the task. Pre-existing and inside the fix-now bar → fix it. Pre-existing and wider, or many, or unrelated → note + ask, or a follow-up PR. There is no seventh option called "mention it in the closing summary" — that line reads as a status report and closes nothing.

Classification is the whole of the work, and it runs on two axes:

| | Inside the fix-now bar | Outside it |
|---|---|---|
| **Caused by this diff** | Fix it — it is the task, not remediation. | Fix it; a diff you cannot make green is not deliverable. Blocked → surface it as a blocker, never as a caveat. |
| **Pre-existing** | Fix it with the work, and say in the commit body that it was pre-existing. | Note + ask with candidate fixes, or a follow-up PR when the batch is large. |

Two failure shapes this table exists to name:

- **"Not mine, so not mentioned."** Pre-existing red is the most common thing an agent walks past, because `minimal-safe-diff` reads like permission to ignore it. It is not: that rule bounds the *diff*, this one bounds the *silence*. The two are satisfied together by noting the finding and asking, which changes no line of code.
- **"Mine, so quietly worked around."** A gate that goes green because the check was narrowed, an assertion loosened, or a file excluded is a defect with a green light on top. Route it through the ladder as an issue, and say what was narrowed.

### Worked example — a red gate seen mid-task

> `task check` fails; the lint step reports 7 errors, all pre-existing on `main`, in files this branch does not touch.

Wrong, and the canonical shape of it: finish the task, and close with *"the only thing still open is the lint finding — 7 errors on main, which makes `task check` unusable as a chain"*. The sentence is accurate, the issue is named, and nothing about it is decided — the next session inherits it verbatim.

Right: the errors are pre-existing, outside the fix-now bar (unrelated files, more than ~10 lines), so they are **note + ask** — after the task is delivered, one block:

1. Fix the 3 `no-unused-vars` in `src/a.ts`, `src/b.ts` — ~6 lines, mechanical, ships in this PR.
2. Fix all 7 in a separate follow-up PR — keeps this diff single-purpose; needs a branch (permission-gated).
3. Suppress the two in generated output with a scoped ignore, fix the rest — smallest green path, adds a suppression to review.
4. Leave as is — `task check` stays unusable as a chain until someone else picks it up.

One recommendation line names the pick. Whatever the user answers, the item is closed. If they answer nothing, it is raised once at the next task boundary — not carried silently into a third session.

## Version-gated modernization

Update stale idioms to the version the project **actually runs** — but only when that version is **verified**:

- **Establish the version first** from the manifest constraint (`composer.json` `require`, `package.json` `engines`, `.tool-versions`, lockfile) — use the **lowest** bound; on an ambiguous/monorepo range, ask once. **Unknown version → do not touch** (must fit the project structure — this is the `source-discovery` gate).
- **Syntax-only, behavior-preserving idioms** (e.g. `array()` → `[]`, `isset($x)?$x:$d` → `$x ?? $d`, string concat → template) that are provably equivalent → treat as a small fix (auto per the ladder).
- **Behavioral changes** (`readonly`/typed properties, new language semantics) and **any dependency/version bump** → **ask only**, never auto (a version bump stays under `minimal-safe-diff`'s no-dependency-bump prohibition; a pure syntax idiom is categorically different).

## Guardrails — don't become a nagging machine

- Subordinate to `no-cheap-questions` (self-check items 3 & 14 — real trade-off, not a disguised continuation/commit ask), `autonomous-execution` (the end-of-session batch must not read as "shall I continue?"), `user-interaction`, `ask-when-uncertain` (one batched prompt = one question).
- Threshold to surface at all: a **real, nameable** improvement with a concrete benefit. Cosmetic nitpicks with no trade-off → drop silently. The live-security carve-out is the only case that interrupts or overrides autonomy.

## See also

- [`active-remediation`](../../../src/rules/active-remediation.md) — the rule this file details (Iron Law + ladder + live-security carve-out).
- [`minimal-safe-diff`](minimal-safe-diff-mechanics.md) — the diff-shape mechanics the fix-now tier amends.
