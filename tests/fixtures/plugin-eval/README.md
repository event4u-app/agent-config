# Pinned host case shape

`road-to-a-trigger-suite-the-host-grades` step 1.1. The shape
`compile_trigger_evals` emits, taken from the host's own scaffold rather than
from its documentation — D4 of that roadmap records why: the changelog and the
help text disagreed about graders and flags on this machine, and the help text
plus the scaffold are the source.

| | |
|---|---|
| Host | Claude Code **2.1.296** |
| Pinned on | 2026-10-12 |
| Command | `claude plugin eval init --bare pin-shape --eval-dir ./evals` |
| Produced | `evals/pin-shape/prompt.md` and `evals/pin-shape/graders/criteria.md` |

`case-prompt.md` and `case-grader.md` are **byte-identical** to those two
files. The version lives here and not in their headers on purpose: a pinned
shape whose bytes have been edited is no longer a pin, and the parity test in
step 2.2 compares against the shape, not against a header.

## Two corrections the reproduction forced

1. **`init --bare` writes TWO files, not one.** The step says "the produced
   case file", singular, and the roadmap's Context says the command "writes a
   blank single-case template" — one CASE, in two files: a prompt and a grader.
   The `case.yaml` form the host also accepts is not what the scaffold emits.
2. **`--eval-dir` is required outside a plugin root.** Run in a bare temporary
   directory the command refuses: *"… is not a plugin or skill folder — run
   `claude plugin eval init` from the plugin's root folder, or pass
   `--eval-dir` to scaffold here on purpose."* The step's instruction to run it
   in a temporary directory therefore needs that flag, and the temporary
   directory was deleted afterwards as the step requires.

Nothing was run. `init` makes no model call and spends nothing; the step's own
stop condition ("if the command makes a model call or asks for one, stop and
record that instead") did not fire.

## What a reader should check when the host moves

Risk 2 of that roadmap: a host update can change the case schema and every
compiled case is then silently ignored. The parity test is the detector; this
file is how you tell which host version the fixture was taken from when it
fires.
