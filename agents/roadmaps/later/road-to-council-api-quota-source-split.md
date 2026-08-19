---
complexity: small
status: later
---

# Road to the quota-source split — one opt-in, split by which quota ran out

> **Blocked until** `agents/evidence/council-api-fallback/quota-source-split-request.md` exists. <!-- ref-ignore -->
> *(The marker is deliberate: this path is a condition, not a reference. The
> file MUST NOT exist yet — its appearance is the resume trigger — so a
> reference checker reporting it broken is the checker doing its job on a line
> where broken is the intended state.)*
> **What that file must record:** which direction was requested — provider-quota
> fall-through without local-cap fall-through, or the reverse — and the
> operational observation behind it. It is created only when real operation
> produces such a request; nobody writes it speculatively, and writing it empty
> is not the trigger.
> **Origin:** migrated verbatim from `road-to-council-api-fallback.md` step 5.0
> (`P-QUOTA-SOURCE-SPLIT`), whose every other step is closed. Moved, **not
> cancelled** — the proposal is intact and this file is its carrier.

## Why this file exists rather than an archived `[~]`

The parent roadmap asserted of its own deferral that it "does not gate
archival". An **AI council** was asked whether that claim holds — anthropic +
openai, 2 of 2 present, one round, 2026-08-19 — and **both seats rejected it**,
each by its own route:

> *"Iron Law 3 exists precisely to prevent 'planned-for-later' work from
> vanishing into an archive. The gate is correct to refuse it — the roadmap's
> claim is a design intent, not a gate override."*

> *"A roadmap may say that an optional item does not block its implementation
> outcome, but it cannot exempt itself from the repository-wide preservation
> rule. That would make the gate discretionary precisely where it is intended to
> be structural."*

So the parent archives and the proposal gets a carrier. Both seats also named
the failure mode of doing this badly, and it is the reason for the resume
condition above: *"a follow-up without an owner or evidence-capture mechanism
merely converts buried work into parked-roadmap clutter"*, and the parent's own
phrase — *"real operation shows…"* — is not independently observable by any
probe in this tree.

The condition above is. `resume_probe` decides a single backticked
repo-relative file path under an existence predicate bound to that path, so this
note reports `unmet` today and flips to `fired` the moment the evidence file
lands. That decidability is not a lucky accident of phrasing: the second
decidable form was added by `road-to-estate-drawdown` Phase 2 batch 1, the same
change that parked this file's parent.

## Phase 1 — Only on evidence

- [ ] **1.1** *(P-QUOTA-SOURCE-SPLIT — proposal, migrated verbatim)* Split the
      opt-in by `quota_source`: `api_on_quota: local | provider | both | false`.
      Only if real operation shows the operator wants provider-quota
      fall-through but not local-cap fall-through, or the reverse. **Do not
      build ahead of that evidence.**
      `verify:` the setting accepts all four values, and a `local`-only config
      does not fall through on a provider-quota exhaustion (and the converse).

- **AC-1:** the evidence file names a direction; the shipped setting serves
  exactly that direction and refuses the other by configuration rather than by
  code path.

**Falsifier.** The evidence file lands and names **both** directions, or names
neither cleanly → the split is not the shape the operator wants; record the
reading and cancel this phase rather than building a four-valued setting nobody
asked for. `api_on_quota: both` already covers the undifferentiated case.

**Rollback.** One settings key with a documented default; `false` and the
current two-valued behaviour remain reachable.

## Non-goals

- **No speculative build.** The parent's "do not build ahead of that evidence"
  is carried over as the binding instruction, not as a caveat.
- **No second mechanism.** This splits an existing opt-in; it does not add a
  fallback rung, a transport, or a quota accountant.
- **No evidence manufactured to unblock it.** Writing the trigger file to make
  the probe fire would be the burial this file exists to prevent, inverted.
