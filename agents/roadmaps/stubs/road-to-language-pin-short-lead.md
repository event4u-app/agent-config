---
complexity: lightweight
review_by: 2027-02-19
probe: none
---

# Stub: a short typed lead makes the language pin follow the PASTE, in both directions

> **Stub — not active work.** Found 2026-08-23 while draining
> `road-to-council-evidence-integrity`, outside that roadmap's scope. Recorded
> rather than fixed in that PR because the fix changes a public behavioural
> surface and belongs in its own change (`minimal-safe-diff`), and recorded as a
> **stub** rather than an active roadmap so it does not move the estate ratchet.

## The defect, reproducible

`src/scripts/language_mirror_hook.ts::classify` pins the reply language for the
turn. Measured against the committed implementation:

| Prompt shape | Verdict | Should be |
|---|---|---|
| `Fix this file.` + a German paragraph | **`de`** (de=6 / en=1) | `en` |
| the same, **with** a `## Überschrift` heading | **`de`** (de=6 / en=1) | `en` |
| `Behebe das bitte.` + an English paragraph | **`en`** (de=2 / en=6) | `de` |

Reproduce by calling `classify` directly; no hook, no session state, no fixture
needed.

## Why it happens — and why the obvious diagnosis is wrong

The obvious reading is "the paste-stripping missed a prose paste". It is not
that. `classify` reads the **typed lead** first and only falls through to the
full body when the lead is undetermined — and a lead is undetermined below
`MIN_MARKERS = 2`. `Fix this file.` and `Behebe das bitte.` both carry fewer than
two markers, so the lead-first step returns `und` and the paste decides.

That is why row 2 of the table matters: adding the document heading does **not**
help. The mechanism is not failing to find the lead; it is finding it, scoring
it undetermined, and correctly falling through. The gap is that the fallback is
the whole body, which is exactly the text the lead was supposed to override.

**The most common prompt shape is the one that defeats it.** A short imperative
over a pasted document is the maintainer's normal way of asking for something.

## The over-claim in the file's own docstring

`classify`'s docstring states, unqualified:

> This is bidirectional by construction — it names no language, and an English
> instruction over a German paste resolves to English by the same step.

Row 1 falsifies that sentence as written. The mechanism *is* bidirectional; what
is not stated is that it only engages for leads carrying `MIN_MARKERS` or more,
which the sentence's own example does not. Row 3 shows the same failure in the
German→English direction the hook was built for, so this is not an
English-speaker's edge case.

## What a fix has to establish, before changing a threshold

- **Lowering `MIN_MARKERS` is not obviously right** and must not be the reflex.
  The constant exists so a two-word prompt does not re-pin a conversation off
  noise; `1` would let a single homograph flip a session. Any change needs the
  false-flip cost measured, not assumed.
- **A lead below the floor is a real `und`**, and `und` already has a defined
  behaviour: keep the previous pin. The question this stub opens is whether the
  *paste* should be allowed to decide when the lead is `und`, or whether `und`
  should mean "keep the pin" there too. That is a behaviour choice with a
  recorded rationale on both sides, not a bug with one right answer.
- **Both directions must be in the test.** The file's history shows this defect
  class has been fixed once already in one direction and reappeared in the
  other; a fix asserting only the English-lead case would repeat that.
- The red must be **observed before the fix**, per the same discipline the
  hook's own history documents.

## Why it is not fixed here

Changing when a session's reply language is pinned is a behavioural change to
every turn on every host. It needs its own change, its own red-first test in
both directions, and a decision on the `und`-fallback question above — none of
which belongs in a council-evidence PR.
