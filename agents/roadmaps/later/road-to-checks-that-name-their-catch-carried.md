---
complexity: lightweight
status: parked
parent_roadmap: road-to-checks-that-name-their-catch
owner: maintainer
review_by: 2027-01-31
entry_condition:
  what: "the owner ratifies the one-field gate_ledger addition, or decides the field is not wanted"
  when: "blocker b-ledger-is-ratification-import closes"
  who: maintainer
estate_offset_exempt: "Carried suffix of road-to-checks-that-name-their-catch (archived 2026-11-02), parked under later/; adds no active roadmap. Preserves step 1.1 instead of dropping it."
relates:
  - slug: archive/road-to-checks-that-name-their-catch
    relation: extends
    note: "Its step 1.1 is carried here with its blocker."
---

# Road to checks that name their catch — carried

> **Source:** `agents/tmp.old/inbox-2026-11-h/` via the archived parent.

## Goal

A ledger gate's report line carries `failed=N`, so a self-test can assert
"it found exactly this, and nothing else".

### blocker: b-ledger-is-ratification-import

`src/scripts/_lib/gate_ledger.ts` is imported by `check_kernel_edit_ratified`,
so any edit to it is a change to the ratification mechanism and needs a
ratification artifact under `agents/evidence/ratifications/` (ADR-268 § 4).
An agent may not ratify its own change. **Owner:** maintainer. **Closes when:**
the owner ratifies the one-field addition, or decides the field is not wanted.

## Steps

- [ ] **1** Append `failed=${tally.failed}` to the `GateLedger.report` line, with a ratification artifact.
      verify: `tests/scripts/gate_ledger.test.ts` still passes (it asserts by `toContain`); a ledger gate's output carries `failed=N`.
