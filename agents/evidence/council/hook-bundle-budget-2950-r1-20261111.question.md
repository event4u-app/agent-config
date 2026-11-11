<!-- evidence-type: original-review -->

# Ratification prompt, round 1 — hook bundle ceiling raised by 200 B for issue #2950 (verbatim, as sent 2026-11-11)

~~~text
Ratification review (modification review), round 1, of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set (hook-plumbing source).

subject: c2be9fa9a569979d731973777f98eba7dad82f642fb941b816b1cd061c05a4c0

Commit reviewed: 0b0726e1940a644a176daab3da9e2f3017965aff (branch fix/language-mirror-inline-bash-regions, base origin/main 417e7b56df).

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Context. hook-bundle-budget.json holds the byte ceiling (`max_bytes`) of the self-hosted hook bundle dist/hooks/dispatch.js, which every hook dispatch loads. The gate check_hook_bundle_composition fails when the rebuilt bundle exceeds the ceiling; the ceiling is shrink-only, and a raise must add a `raise_log` entry whose `to` equals the new value, naming what was added and why it could not be avoided.

The branch fixes issue #2950: Claude Desktop writes a terminal-pane command into the user prompt as inline `<bash-input>…</bash-input><bash-stdout>…</bash-stdout><bash-stderr></bash-stderr>` on one line. The language-mirror classifier only stripped host wrapper regions whose tags stand alone on a line, so the app's English advisory text pinned English in a German session. The fix adds, in src/scripts/_lib/prompt_shape.ts:

  const TERMINAL_PANE_REGION = /<(bash-input|bash-stdout|bash-stderr)>[\s\S]*?<\/\1>/g;
  // in stripInjectedRegions:
  const lines = text.replace(TERMINAL_PANE_REGION, "").split("\n");

That adds 118 B to the bundle (1,594,895 B on origin/main → 1,595,013 B, both measured by the gate through the CI mirror). origin/main sat 5 B under the 1,594,900 ceiling.

The diff to the gated file, complete:

  -    "max_bytes": 1594900,
  +    "max_bytes": 1595100,
  ...raise_log gains one entry:
  {
    "date": "2026-11-11",
    "from": 1594900,
    "to": 1595100,
    "by": "agent, fix/language-mirror-inline-bash-regions (issue #2950)",
    "what_was_added": "The inline terminal-pane region strip in `_lib/prompt_shape.ts` (`TERMINAL_PANE_REGION` and its one `replace` call in `stripInjectedRegions`), which keeps the app-written `<bash-input>`/`<bash-stdout>`/`<bash-stderr>` echo out of the language score. Measured 1,595,013 B with the change against 1,594,895 B on origin/main 417e7b56df (both readings by this gate through the CI mirror): +118 B.",
    "why_it_could_not_be_avoided": "The base sat 5 B under the 1,594,900 ceiling, so any byte added to the language-mirror path crossed it. The addition is one regex literal and one call; no smaller form keeps the three tag names closed-region-only. The ceiling moves by 200 B, the delta rounded up, with no growth queued.",
    "what_would_have_caught_it": "Nothing missed it: the gate fired on the first mirror run of the change, as it is meant to."
  }

No other field of the file changes: chunk ceilings, chunk groups, `max_yaml_packages` and `shrink_only` are untouched.

Question. Does this change expand what an agent may do, weaken a gate, or make an enforcing step non-enforcing? Answer with exactly one closed verdict on its own line as `VERDICT: <ratified|confirmed-non-expanding|refused>`, then `DEALBREAKER: yes|no`, then at most five findings.
~~~
