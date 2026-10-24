<!-- evidence-type: analysis -->

# Pin re-attestation: a trunk diff that changes no classified assertion

AI council, 2026-10-24, `anthropic/claude-sonnet-4-5` + `openai/codex-default`,
design mode, one round, CLI transport, `$0.00`, **2/2 present**. The prompt is
committed verbatim beside this file as
`gate-ledger-pin-reattest-20261024.question.md`.

This is the first use of the renewal rule recorded under D39. A trunk merge
changed two helpers on the 7.1 ledger's pinned helper closure,
`_lib/settings_removed_keys.ts` and `_lib/settings_renamed_keys.ts`, and the
reconciler reported the verdict stale. The accountable role, the lane holding
the claim, did not renew on its own reading. It put the diff to the council.

## Verdict: 2/2 *no change*, the pin may be renewed

- anthropic: *"No change … The stale helper pin may be renewed."* High
  confidence. The diff touches docstrings and the display text of
  `SETTINGS_REMOVAL_RULE`, and the runtime map `RENAMED_KEYS` is unchanged.
- openai: *"No classified check assertion changes; renew the pin, but correct
  the inaccurate use-site claim."* Confidence 0.93.

## Correction to the prompt (openai)

The prompt said `SETTINGS_REMOVAL_RULE` is used only in
`_lib/release_settings_surface.ts`. That is false. `applyRenamedKeys()` in
`_lib/settings_renamed_keys.ts` also interpolates it, into a `stderr` warning.
The asking agent's grep had excluded the defining file. The path is reachable
through `agent_settings.ts`, but none of the 16 checks executes it, because
`check_knowledge_cards` uses only `TIERS`, `SENSITIVITIES`,
`parse_provenance_footer` and `global_store_dir` from `knowledge_global`.

## Carried

openai's hardest pushback: an import trace is weaker evidence than execution.
A future renewal should distinguish statically reachable code, executed code,
and values that feed an assertion or the exit status. Running the affected
checks against a fixture that exercises the changed path would strengthen it.
