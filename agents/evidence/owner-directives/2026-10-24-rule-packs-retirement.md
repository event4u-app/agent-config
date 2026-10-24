<!-- evidence-type: analysis -->

# Owner directive — retire `projection.rule_packs` under a step of its own

| Field | Value |
|---|---|
| Ordered by | the repository owner |
| Date | 2026-10-24 |
| Scope | `road-to-a-setup-that-decides-itself` AC-1: the one projection key no step covered |
| Source of the order | the owner's answer to the numbered question the AI council routed to them (`agents/evidence/council/setup-rule-packs-key-20261024.md`), relayed to the executing lane by the orchestrating session |
| Grants by itself | the transition named below, nothing else |

## The instruction, verbatim

> 1

## What it answers

Option 1 of the routed question: add a step that retires `projection.rule_packs`, under the
council's conditions —

1. the rule layer's pack axis is derived from the active-pack set (what `auto` does today);
2. the key gets a tombstone;
3. a one-release-window read of legacy values, in which an explicitly written legacy value wins;
4. the eight rules the derivation drops are audited for correct pack scoping;
5. `doctor` reports any difference between a legacy value and the derived set;
6. it ships in the next major, per ADR-300 and `CONTRIBUTING.md` (`Consumer-Impact: action`).

## What it does not grant

- Nothing about `projection.mode` (step 4.7), which is routed to the owner separately
  (`agents/evidence/council/setup-projection-mode-removal-20261024.md`).
- No release: an agent lane implements the step; cutting the major is the release process's.
