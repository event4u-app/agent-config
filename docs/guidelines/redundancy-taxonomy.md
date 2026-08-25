# Redundancy Taxonomy

> The one place this package names what duplication *is*, what may be decided
> about it, and how to tell a second explanation that adds information from one
> that only adds length. Cited by [`code-clarity`](code-clarity.md) at the
> authoring moment, by `skill:code-review` at the review moment, and by
> `skill:code-refactoring` at the refactoring moment. Those three cite it —
> they do not restate it, because three copies of a redundancy taxonomy would
> be the defect it describes.

Finding duplication is not a decision. Every finding reaches a **named verdict**
with a reason, and several of the verdicts keep the duplication. The goal is not
the lowest clone percentage — it is **one honest authority per shared fact**,
without marrying independent concepts through a wrong abstraction.

## The classes

**Implementation** — the same code exists twice.

| Class | What it is |
|---|---|
| Exact clone | Same tokens. |
| Renamed clone | Same structure; identifiers or literals differ. |
| Near clone | Shared core with local additions or deletions. |
| Structural pattern | Same shape, no copy/paste lineage. |
| Boilerplate | Framework, protocol, or generated ceremony. |
| Test repetition | Repeated setup or assertion structure. |
| Intentional independence | Similar today, meant to diverge. |
| Wrong abstraction | Already shared, now growing caller flags and modes. |

**Knowledge** — the same *fact* is encoded twice. Usually more actionable than
raw clone percentage, because a clone can be harmless and a divided fact rarely is.

| Class | What it is |
|---|---|
| Knowledge duplication | One business rule, constant, or algorithm encoded more than once. |
| Policy duplication | One governance decision represented across independent surfaces. |
| Contract duplication | One external protocol or CLI contract reimplemented instead of consumed. |
| Delivery-authority duplication | Two authored sources can produce the same shipped artifact. |

**Representation** — the same *meaning* is presented twice to a reader: a
comment, label, hint, tooltip, placeholder, badge, heading, caption, or toast.

| Class | What it is |
|---|---|
| Exact text echo | The same text repeated in the same context. |
| Paraphrase echo | A second surface restating the first in other words. |
| Structural narration | Prose naming what the code or UI already shows. |
| Decorative metadata | An eyebrow, badge, or heading with no scanning or semantic value. |
| Feedback echo | Status text duplicating already-obvious state. |
| Accessibility conflict | Removing it would delete required semantic information. |

An accessibility conflict is a **hard guard, never a deletion candidate**. A
reduction that improves the visual channel by breaking the semantic one is not a
reduction; it is a defect.

**Naming** — the *dual* of a representation echo. An echo says one meaning twice;
divergent naming says one meaning with two words, so the reader cannot tell
whether they are looking at one concept or two. It is a modelling defect rather
than a style preference: a concept carries one term across the whole model, and
several terms for one concept is the model telling you it has not decided.
<!-- harvest:one-language-per-concept-inconsistency-is-a-model-defect -->

| Class | What it is |
|---|---|
| Spelling variant | One word, two spellings (`artifact` / `artefact`). No semantic difference; decidable without judgement. |
| Synonym drift | One concept, several terms. Needs a term map, because the terms may denote different things. |
| Homonym collision | One term, several meanings. The opposite failure, and usually `keep-duplicated` when the meanings are module-local. |

Naming verdicts: `canonicalize-term` · `keep-distinct` (with the recorded reason
— an external compatibility value, a quoted name, a genuinely different concept)
· `defer-for-context`.

**Only a spelling variant is mechanically decidable, and the split between the
prose layer and the identifier layer is decisive.** Prose is a substitution;
filenames, symbols and their test and task references are a rename refactor with
its own blast radius, and the same cluster can be committed to different sides on
each layer. Measure both before proposing either — the measured example is in
`agents/evidence/analysis/wording-baseline-2026-08-25.md`, where nothing imports
across the split and the identifier layer is therefore `keep-duplicated` while
the prose layer is `canonicalize-term`.

Synonym drift is the class to be slowest about. Words that read as synonyms in
translation frequently denote different mechanisms — here `route`, `dispatch`,
`delegate`, `spawn` and `forward` are five mechanisms, not one concept spelled
five ways — so a sweep over them destroys information the echo classes exist to
protect.

## Why any of this is worth a gate at all

Generated code trends toward duplication rather than reuse: measured
longitudinally over roughly 211 million changed lines, copy/pasted code rose from
8.3 % to 12.3 % of changes over the period assistance became common.
<!-- harvest:ai-agents-raise-copy-paste-share --> The pressure this document
resists is therefore not a hypothetical — it is the default direction of the tool
writing the code, which is why `keep-duplicated` needs to be a recorded verdict
rather than an unstated outcome.

Where enforcement follows, the shape is already known: separate the term list
from the rules, and control false positives by **syntax awareness** — skip
frontmatter, fenced code and inline code rather than matching inside them.
<!-- harvest:prose-linter-vocabulary-accept-reject --> `check_md_language.ts`
already carries exactly that skip machinery.

## The verdicts

For implementation and knowledge findings: `extract-local` · `extract-module` ·
`canonicalize-knowledge` · `canonicalize-contract` · `single-copy-delivery` ·
`data-drive` · `compose-strategy` · `generate` · **`keep-duplicated`** ·
`defer-for-evidence` · **`de-abstract`**.

For representation findings: `keep` · `drop` · `consolidate` ·
`rewrite-for-signal` · `accessibility-block` · `defer-for-context`.

`keep-duplicated` and `de-abstract` are **successful outcomes**, not failures to
act. A wrong abstraction costs more than the duplication it replaced, so a
recorded decision to leave two copies alone — or to split one shared unit back
apart — closes a finding as legitimately as an extraction does. What is not
allowed is silence: a finding with no recorded verdict stays open.

## Before sharing an implementation

1. Is it the same knowledge, or two facts that currently look alike?
2. Would both copies change for the same reason?
3. Is there one honest domain name that fits every call site?
4. Can the common core stay free of caller-specific flags and modes?
5. Is the dependency direction healthy?
6. Does this reduce maintenance risk, or only line count?
7. Are public contracts preserved, and do tests prove behavioural equivalence?
8. Is this generated or protocol ceremony that should stay explicit?
9. **If the two copies diverged tomorrow, would that be a defect or legitimate
   evolution?**

A "legitimate evolution" answer to the last question is decisive: prefer
independence, verdict `keep-duplicated`.

## The Information Delta Test

Before adding any comment, docblock, label, hint, tooltip, placeholder, badge,
caption, empty-state line, or explanatory sentence, in code or in a user
interface:

- **A — Information delta.** What fact becomes unavailable if this text is
  deleted? A non-obvious reason, an invariant, a required format, a unit, a
  consequence, a safety warning, a recovery action, a privacy implication, an
  unfamiliar concept, an accessibility name, or necessary grouping all count. If
  the answer is "nothing", delete it.
- **B — Representation delta.** Is that fact already carried adequately by a
  nearby representation — the name, the type, the component structure, the
  semantic element, the visible control text, an icon, a test? If so,
  consolidate; do not repeat.
- **C — Channel preservation.** Would deleting it weaken visual comprehension,
  semantic accessibility, or both? Never optimise one channel by breaking the
  other.
- **D — Persistence.** Will it still be true after the next ordinary refactor?
  Text describing the current implementation rather than the durable constraint
  is noise with a delay fuse.
- **E — Actionability.** For user-facing copy: does it change what the reader
  understands, chooses, enters, expects, or does next? If not, it is a strong
  deletion candidate.

The rule is **not** "less text". It is: if removing the text loses no
information in any required channel, remove it — and if the information is
required, express it once, in the strongest native form available. A visible
form label is required information, so it stays; a placeholder repeating that
label is an exact text echo, so it goes.

## Legacy is baseline, new duplication is the finding

Existing duplication does not fail an unrelated change. A review or refactor
raises a finding when a change **introduces** high-confidence knowledge, policy,
contract, or delivery-authority duplication — or when it touches a surface that
already carries some. Anything else is debt with a measurement, not a blocker.

## See also

- [`code-clarity`](code-clarity.md) — the authoring moment; comment discipline
  and the banned classes this test generalises.
- [`abstraction-thresholds`](abstraction-thresholds.md) — how much repetition
  earns an abstraction, per artifact class.
