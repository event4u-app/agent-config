---
proposed_by: claude-opus-5/drain-hooks-every-host-2026-10-01
implemented_by: claude-opus-5/drain-hooks-every-host-2026-10-01
reviewed_by: council/anthropic+openai-2026-10-01-hooks-every-host-ratification
providers:
  - anthropic
  - openai
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — a docs-drift watcher over `host_lowering.yaml`, and a recorded host probe

`check_kernel_edit_ratified` fires on this branch because the diff edits
`src/scripts/hooks/host_lowering.yaml`, which sits on its `PLUMBING_SOURCE_RE`
list. No other gated surface is touched: no kernel rule, no `block_*` governance
hook, no budget file, and not the ratification mechanism itself.

## What was proposed

Closing `road-to-hooks-on-every-host` (7 steps, 4 acceptance criteria), in five
parts:

1. **`src/scripts/check_host_docs_digest.ts`** — the docs-drift watcher the
   table's own header already named as a consumer and which did not exist. It
   re-fetches each row's `docs_url`, compares the sha256 of the body against
   `verified.docs_digest`, and on a change rewrites that row's `expires` to the
   day *before* detection, which hands the question to the pre-existing
   `lint_hook_manifest._check_host_lowering`.
2. **8 digests recorded** in `host_lowering.yaml` (the ninth row, `cowork`,
   cites no page, so there is no body to hash).
3. **A weekly workflow**, `permissions: contents: read`, running `--fetch` only.
4. **A live deny probe of `codex`**, recorded with its negative result.
5. **Tests** and a correction to `docs/enforcement-by-host.md`.

**This list describes the diff AS RATIFIED and the diff has grown since**, which
a completion reviewer checked rather than assumed. The additions are a sanitize
import, a read-surface contract row, a compiled-table regen, and the
post-review hardening below. The verdict's own scope — no `block_exit`, no slot
added, `contents: read`, no `--write` in CI — was re-checked against the current
diff and still holds; that, not this list, is what the verdict was about.

## Why this is `confirmed-non-expanding` rather than `ratified`

Both seats returned `confirmed-non-expanding` independently and converged on the
same discriminator, which is worth stating in their terms rather than mine:

> "The decisive fact is the separation between **detecting invalidated
> evidence** and **creating enforcement authority**. … Moving `expires`
> backward withdraws trust in previously recorded evidence; it does not
> establish a new refusal capability."

Concretely, and checkable against the diff: no `block_exit` is added or changed,
no slot is added to any row, `codex` and `copilot` keep `slots: {}`, and the
workflow has `contents: read` with no `--write` and no commit step. The only
refusal that can result comes from a gate that already existed, and only on a
row that already carried a blocking binding — which today means `claude` alone.

## The strongest argument against, and what the seats did with it

Argument 1 of the review question: `--fetch` exits nonzero on any body change,
so an upstream vendor can red a scheduled workflow with no change to this
repository. **The seats split on its interpretation and neither dismissed it.**

One held it is the mechanism working: "If vendor documentation is your source of
truth for enforcement contracts, detecting changes to that source is exactly
what you need." The other refined that and declined to call it simply a feature:
"Detecting drift is the feature; allowing arbitrary page bytes to fail a
workflow is one implementation of it, with a meaningful availability and noise
cost." Both classified it as a CI-reliability concern rather than an authority
expansion, which is the question this artifact decides.

## Four corrections the reviewers made, three adopted in this diff

Both seats, independently, asked for the same two hardenings. Both are in:

1. **"Add a test proving plain `--fetch` cannot alter `host_lowering.yaml`"** /
   "State explicitly whether `--fetch` ever mutates the working tree." Three
   tests added (`a read-only run never touches the tree`) covering the offline
   path and the `--write`-without-`--fetch` refusal, plus the docstring now
   states that the single `writeFileSync` sits inside `if (doWrite)`.
2. **"Report the affected host, URL, prior digest, new digest, and detection
   time on mismatch."** A drift line now prints all four.
3. **"Phrase the conclusion as *refusal not established by this probe*"** — the
   `codex` row already did, and is unchanged; recorded here because one seat
   explicitly corrected the *other seat's* reading of the probe as having shown
   the vendor's documented claim "was wrong". It did not, and this diff does not
   say it did.

**Not adopted, and named rather than dropped:** normalised or
contract-scoped hashing instead of raw-body hashing. Both seats raised it; one
called raw-body "defensible for an initial version". It is a real limitation —
a nav link and a rewritten refusal contract hash identically — bounded only by
the observation that two independent fetches returned 8 unchanged, which
demonstrates short-term reproducibility and not semantic precision. Left as
future work rather than smoothed over.

## On the probe, since it is the part a reader will weigh hardest

It is **n=1, one build, one operator, and partly inconclusive by its own
account**, and the row says so in those terms. It did not separate "the hook
fired and was ignored" from "the matcher never matched", because the
instrumented re-run was refused by the harness the probe ran under; and the
installed `codex-cli 0.148.0` is 24 stable releases behind the `0.159.3` the read
page describes. What it does establish is narrow and is the only thing claimed:
this package has not demonstrated a refusal path on that host, so `block_exit`
stays `null` — which is precisely what a null means in this file.

The alternative was to arm a binding from a documentation read. That is what the
row previously implied was possible, and it is the failure mode this table was
built to prevent.

## What would have changed the verdict

The seats named these, and none is true of this diff: the script able to modify
`block_exit` or `slots`; the workflow carrying `contents: write` or a commit/PR
step; the probe claiming enforcement where the measurement found none; or the
script adopting upstream text without human review.

## Independence

Council, two distinct providers (anthropic, openai), `2/2 present, needed 1 —
concluded`, meeting `required_providers: 2`. Both seats are subscription-authed;
spend was $0.0000. The prompt stated no expected outcome and offered all four
verdicts symmetrically; it put six arguments **against** the change in front of
the seats, including the two the author considered strongest, before either seat
spoke. The observable evidence that the framing did not steer is that both seats
returned refinements the author had not written — one correcting the other's
reading of the probe, one declining the author's own framing of argument 1 — and
that three of their recommendations changed the diff after the verdict.

A first run returned `0/2 present … INCONCLUSIVE — DEGRADED` and is recorded
rather than hidden: the cause was a missing per-worktree availability record
(`agents/runtime/state/council-probes.json` is gitignored, so a fresh worktree
has none), not a provider refusal. No verdict was taken from that run.

Per `docs/contracts/ratification-artifact.md` § Honest enforcement: this
artifact records who decided and on what basis. It is not proof that they
decided, and the trust anchor is the base revision plus the platform, never
these strings. The council **question** is reproduced in full in the
pull-request body — `evaluator-independence` requires the prompt to ship with
the verdict, and `agents/runtime/council/` is gitignored and auto-pruned, so a
link there would resolve for nobody. The seats' responses are quoted here where
they carry the argument; their full text is not reproduced, and this sentence
says so rather than implying a completeness the artifact does not have.

## Post-ratification: an independent completion review, and what it changed

Two fresh reviewers (no implementation context) ran over the branch afterwards.
The second found a **high** defect the council did not, and it is the defect
this whole roadmap family exists to catch: the `copilot` row asserted
`preToolUse` "fail-closed on exit 2", and the cited page — re-fetched, hashing
byte-identical to the committed `docs_digest`, so provably the pinned body —
contains **no exit-code semantics at all**. The claim was inherited rather than
invented on this branch, and it had survived two readings. Corrected at the row,
in the roadmap, and in D2, with a new D3 recording the lesson: a digest pins a
body, it does not read it.

That finding does not change this verdict — an unsupported prose claim is not an
authority expansion — but it is recorded here because the ratification cited the
probe's honesty as a strength, and the same diff was carrying an unverified host
claim two rows away.
