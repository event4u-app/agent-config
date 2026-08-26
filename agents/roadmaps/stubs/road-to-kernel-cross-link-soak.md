---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to the kernel cross-link and its post-merge soak

> **Stub — not active work.** Transferred out of
> `road-to-skill-ecosystem-gate-integrity.md` Phase 3 on 2026-08-20 by the
> drain-run disposition framework
> `agents/evidence/council/drain-blocker-dispositions-b.md` <!-- ref-ignore -->
> (disposition **B** — outcome `transferred`). The framework's verdict line
> reads: *"Rule 3 requires B because bypassing the kernel write guard and
> merging the dedicated PR are externally controlled actions."*
>
> **Provenance, stated precisely because a stub is where a loose citation
> rots.** That framework document is **not on `main`**. It exists on
> `origin/drain/council-records` (PR #1463) and was read from there at
> `git show origin/drain/council-records:agents/evidence/council/drain-blocker-dispositions-b.md`
> on 2026-08-20, where its transfer row and its rationale paragraph both name
> `kernel-cross-link-soak`. Once #1463 merges the path resolves on `main`; until
> then the `ref-ignore` marker above is what keeps `check_references` honest
> instead of green-by-luck.
>
> Nothing here was rejected on merit and nothing is half-shipped. The two edits
> below are **fully drafted** — the residual gate is a write guard an agent
> cannot pass, not unfinished analysis.

## Why this is maintainer-owned and not merely maintainer-preferred

The `block-kernel-rule-writes` PreToolUse guard
(`src/scripts/hook_manifest.yaml:160-165`, `fail_closed: true`,
`severity: blocking`, bound in the `pre_tool_use` slot at `:895`) refuses every
agent write to any of the nine kernel rules outright. Measured on the attempt
2026-08-10, its deny message is: *"kernel rule verify-before-complete is
immutable — tighten-only via the override exception registry"*. That message
names the only legitimate bypass, and **both** available branches are human acts
outside the session: go through the override exception registry, or disable the
guard entry. `scope-control § Kernel-rule edits` independently requires one
kernel rule per pull request.

**The ≥ 24 h is a spacing constraint, not an unstarted waiting period**, and the
distinction decides whether this stub reads as nearly-closed or as gated. It
governs the interval between merges of consecutive kernel-rule PRs. Measured
2026-08-20: the last merge touching any of the nine kernel rules is `d74f1238a`
(2026-07-31 01:05:29 +0200, PR #1063). Twenty days have elapsed, so the spacing
is already satisfied and the merge may go out as soon as the maintainer opens
its PR. A screen that reads the 24 h as a fresh soak will wrongly conclude the
work is waiting on a clock.

## Transferred work — quoted as it stood

Phase 3 steps, verbatim from `road-to-skill-ecosystem-gate-integrity.md` at the
transfer commit, with the `_(BLOCKED …)_` prefix stripped:

- **Step 6** — "Add an ease tripwire to `verify-before-complete`'s red flags: a
  verification that was far easier than expected is a signal to check the path,
  not a signal of success. The existing red flags track confidence wording and
  not ease."
- **Step 7** — "Cross-link the new guideline from `verify-before-complete` and
  from the token-optimizer catalog row for that rule, per
  `token-optimizer-maintenance`."

The acceptance criterion, verbatim, whose **second half** transfers while its
first half is satisfied and closed in the transferring roadmap:

> `docs/guidelines/agent-infra/gate-authoring.md` and
> `docs/guidelines/agent-infra/false-green.md` exist and are cross-linked from
> `verify-before-complete`.

Also carried: regeneration of `internal/bench/reports/kernel-prefix.json`, the
dedicated single-rule pull request, and the post-merge spacing requirement.

## The two edits, drafted verbatim — apply, do not re-derive

Both were authored and corrected in-tree before the transfer. Apply them as
written to `src/rules/verify-before-complete.md`; nothing below needs deciding
again.

### Edit 1 — the ease tripwire

Add to the `## Red flags — STOP immediately` list (currently
`src/rules/verify-before-complete.md:47-54`, six bullets):

> - A verification that was **far easier than expected** — check the path
>   before believing the result, per [`false-green`](../../docs/guidelines/agent-infra/false-green.md)

The existing red flags track confidence *wording* ("should pass", "seems fine")
and not *ease*; every false green catalogued in `false-green.md` felt like a pass
at the moment it happened.

### Edit 2 — the cross-links

Add to `## Verification commands` (currently
`src/rules/verify-before-complete.md:56-58`):

> Authoring a new gate → [`gate-authoring`](../../docs/guidelines/agent-infra/gate-authoring.md).
> Ways a green result can be false, with detection commands →
> [`false-green`](../../docs/guidelines/agent-infra/false-green.md).

**Link depth corrected 2026-08-10 — keep the two-level form.** Both drafts
originally said `../docs/…`. From a source file under `src/rules/` that resolves
to `src/docs/`, which does not exist; `../../docs/` reaches the real repo-root
`docs/`. The two-level form is also what the majority of `src/rules/` uses when
it links a guideline, `direct-answers` (the other kernel rule in that set)
included — though three rules do carry the one-level form, so the tree is not
unanimous and the filesystem is the deciding evidence, not the count.

**No gate catches a wrong depth, which is why the source form has to be right.**
Probed by canary 2026-08-10: a deliberately nonexistent
`../../docs/guidelines/agent-infra/<bogus>.md` appended to a roadmap left
`check_references` at rc=0 over 1118 scanned references — it did not resolve the
path at all. So "the reference checker is green" is not evidence that either
form works, in either direction.

**No `token-optimizer` edit rides along.** Step 7's wording asks for the
`verify-before-complete` row in `src/skills/token-optimizer/SKILL.md` per
`token-optimizer-maintenance`. There is no such row: the catalog does not carry
`verify-before-complete`, and that rule's cited-asset list does not name this
file, so the maintenance obligation never fires. Do not invent a row to satisfy
it — that would add a catalog entry nobody asked for.

### The baseline regeneration is part of the same PR

Editing a kernel rule changes the always-loaded prefix, so
`check_kernel_prefix_stability` goes red until its baseline is re-anchored. Run
`./scripts-run src/scripts/check_kernel_prefix_stability --update-baseline` and
commit the regenerated `internal/bench/reports/kernel-prefix.json` **in the same
pull request**. Local preflight does not catch the miss.

## Probe and re-entry producer

Promotion is **not** "when someone gets round to it". One named producer, three
probes a reader can run today, each returning a decidable answer.

**Re-entry producer:** the repository maintainer, acting through the
override-exception registry named in the `block-kernel-rule-writes` deny message
(or by disabling that guard entry for the duration of the edit). No agent and no
command in this repository can produce this state.

| # | Probe | Command | Measured 2026-08-20 |
|---|---|---|---|
| P1 | The merged PR diff carries **both** `../../docs/` guideline links and the ease-tripwire bullet | `grep --line-number -e 'far easier than expected' -e '\.\./\.\./docs/guidelines/agent-infra/false-green\.md' -e '\.\./\.\./docs/guidelines/agent-infra/gate-authoring\.md' src/rules/verify-before-complete.md` | **FAIL (expected)** — zero matches; the file carries no reference to either guideline and its red-flag list ends at "ANY wording implying success without fresh evidence" (`:54`) |
| P2 | `kernel-prefix.json` is clean **after** regeneration | `./scripts-run src/scripts/check_kernel_prefix_stability` | **PASS, but on the pre-edit prefix** — `✅ kernel always-loaded prefix is byte-stable (9 rules, sha256 8a0cefa44535…)`. This is the value the edit invalidates: a green here today says nothing about P2, and the probe only becomes meaningful once the sha differs from `8a0cefa44535…` |
| P3 | Merge timestamps satisfy the kernel-rule spacing rule | `git log origin/main --first-parent --format='%h %ci %s' -1 -- src/rules/{agent-authority,ask-when-uncertain,commit-policy,direct-answers,language-and-tone,no-cheap-questions,non-destructive-by-default,scope-control,verify-before-complete}.md` | **PASS** — `d74f1238a 2026-07-31 01:05:29 +0200`, 20 days of spacing available; this is the one probe that is already satisfied |

P2 is worth reading twice. It is the probe most likely to be misread as done,
because it is green now and will be green again after the re-anchor — with a
different sha in between. The recorded sha above is what makes movement
distinguishable from noise: `8a0cefa44535…` means the edit has not landed,
whatever the ✅ says.

## Blockers carried across in full

**1. The write guard, not a waiting period.** Restated here because the
transferring roadmap's own text had to correct this once: the residual gate is
`block-kernel-rule-writes`, a `fail_closed: true` / `severity: blocking`
PreToolUse concern. The 24 h spacing is satisfied (P3). Nothing elapses this
blocker away.

**2. One rule per pull request.** `scope-control § Kernel-rule edits` requires a
dedicated PR with ≥ 24 h between kernel-rule merges — a soak guarantee no
autonomous mandate lifts. The two edits above touch one file, so they ride
together; they may not ride with any other kernel-rule change.

**3. The baseline miss is invisible locally.** See the regeneration note above.
The byte-stability gate stays red without the re-anchored
`internal/bench/reports/kernel-prefix.json`, and local preflight does not
surface it.

## Seed content on promotion

There is no design work left. Promotion is: open a single-rule PR, apply Edit 1
and Edit 2 verbatim, run
`./scripts-run src/scripts/check_kernel_prefix_stability --update-baseline` and
commit the result, merge, then record the closure against Phase 3 Steps 6 and 7
and the cross-link half of the acceptance criterion in
`road-to-skill-ecosystem-gate-integrity.md` — wherever that file sits at the
time, active or archived.

## What does NOT apply to this stub

The **Promotion criteria (shared)** in `README.md` — a recruited customer, a
funded security audit, a maintainer ADR lifting a Hard-Floor item — govern the
six org-mode stubs created by Phase 9 of the archived employee-product roadmap.
They do **not** govern this one. This is a drain-run transfer of an internal
two-paragraph documentation cross-link: it recruits no customer, introduces no
org surface, and needs no security audit. Its gates are P1-P3 above and nothing
else. Stating it explicitly is the point of registering the stub in a separate
row group rather than appending it to that table.
