<!-- evidence-type: analysis -->

# Ratification question — hook-plumbing gated content of feat/subagent-system-2583-rest, round 2

You are reviewing a change to files that `check_kernel_edit_ratified` gates as hook plumbing. Decide
whether the gated content below is ratified, and name any finding. Answer with one line
`VERDICT: ratified` or `VERDICT: not-ratified`, then your findings.

## Scope

The gated set of this branch against `origin/main` is five files:
`src/config/hook-bundle-budget.json`, `src/scripts/_lib/egress_rules.ts`,
`src/scripts/hook_manifest.json`, `src/scripts/hook_manifest.yaml`, `src/scripts/hooks/dispatch_hook.ts`.

The last four are byte-identical to the content a council round ratified on 2026-10-22 (record
`agents/evidence/ratifications/subagent-system-2583-rest-20261022.md`, subject `df2fa29c…`; the gate
matched that subject on this branch before the edit below). The only new gated content is this diff
to `src/config/hook-bundle-budget.json`, a text edit inside one `raise_log` entry:

```diff
             "from": 28000,
             "to": 32000,
             "by": "agent, during the feat/subagent-system-2583 run",
-            "what_was_added": "The queued engine work the 28,000 ceiling was sized for, landed together: the validated identifier rows of one-detector 2.3 (IBAN, card, e-mail with a keyed-digest allowlist, three phone shapes, German tax id, US SSN), the invisible-character and lookalike-letter normalisation of 2.5, and three free-tier credential rows (Hugging Face, NVIDIA, Replicate) of free-hands 1.2. Measured 30,445 bytes when the raise landed; 30,493 bytes at the ratified revision, after the round-6 IBAN rows.",
+            "what_was_added": "The queued engine work the 28,000 ceiling was sized for, landed together: the validated identifier rows of one-detector 2.3 (IBAN, card, e-mail with a keyed-digest allowlist, three phone shapes, German tax id, US SSN), and three free-tier credential rows (Hugging Face, NVIDIA, Replicate) of free-hands 1.2. The invisible-character normalisation of one-detector 2.5 (`egress_normalize.ts`) is not in this chunk: the engine does not import it (corrected 2026-10-23, road-to-a-tick-the-shipped-path-earns 1.4). Measured 30,445 bytes when the raise landed; 30,493 bytes at the ratified revision, after the round-6 IBAN rows.",
             "why_it_could_not_be_avoided": "Each addition is a detection row or the normalisation that keeps one from being hidden; the 2026-10-18 derivation already counted them as the chunk's planned growth and underestimated their sum by about 2.4 KB. The chunk is loaded only when a caller needs detection, so no dispatch pays these bytes; the dispatch bundle itself is unchanged.",
             "what_would_have_caught_it": "Re-measuring the queued items' sum when the ceiling was set, rather than estimating each."
         }
```

Context for the edit: the entry's `what_was_added` text listed the invisible-character
normalisation of one-detector step 2.5 (`src/scripts/_lib/egress_normalize.ts`) as content of the
`egress_engine` chunk. `src/scripts/_lib/egress_engine.ts` does not import that module; the only
production importer of it is `src/scripts/_lib/knowledge_global_redaction.ts`, which imports one
regex. No ceiling, byte figure or other field changes.
