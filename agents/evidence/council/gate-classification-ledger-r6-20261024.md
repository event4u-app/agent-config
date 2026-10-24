<!-- evidence-type: analysis -->

# A flag scan is not a branch inventory

AI council, 2026-10-24, the twelfth round that day. anthropic/claude-sonnet-4-5
+ openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-classification-ledger-r6-20261024.question.md`.

## Verdict: convergent — not closed, one missing thing, not owner-reserved

- openai: Q1 *no* (0.93), Q2 *no* (0.95). *"Revision 6 repairs the named
  check-16 rows but does not prove assertion completeness."*
- anthropic: Q1 *no*, Q2 *no*. *"The flag scan closes the literal gap … but it
  doesn't close the semantic gap (complete mode discovery)."*

**The single missing thing (both seats):** a source-derived inventory of
**assertion-producing branches** and their controlling predicates, reconciled
against the ledger. The predicates include flags and flag combinations,
environment variables such as `AC_AS_OF`, file-state branches, network paths,
and helpers that emit several findings. openai requires it to be *"reproduced by
someone or something independent of the ledger author"*. Both seats say it
**does not need the owner-reserved second principal**.

## Concrete defects named

1. **Check 10 `--global`** names a helper (`_check_global_card`), not one
   assertion. Expand it into its independently failing properties, or show it
   is atomic. Must fix (openai).
2. **Check 16's usable-record row** cites `malformed > 0 && readings.length ===
   0`. A non-empty store of valid JSON lines that are not usable readings may
   be neither usable nor counted as malformed. Execute that case, or prove it
   impossible.
3. **Check 16 `--self-test`** has a row but no execution shown.
4. **No invalidation rule.** The verdict must go stale when a check's source,
   its wiring or the ledger changes without re-running the reconciliation.
5. **No stable row identifiers.** Prose aspect names are unsafe references for
   7.2, especially for current and target pairs.
6. **The flag categories in the reconciler are a trust boundary.** A wrong
   *presentation* label suppresses a mode.

## Rejected by openai

Exhaustive executions of all rows in 7.1. That would *"silently expand the
stated classification criterion into runtime conformance certification"*. It is
deferred, and required before enforcement in 7.2.
