<!-- evidence-type: analysis -->

# Test review — a conditional skip in the generated bash differential test

You are reviewing one test-suppression in the `event4u/agent-config` repository. The repository's rule (`src/rules/evaluator-independence.md` § Tests are evaluators) says an implementer may not silently skip a test; a skip needs an independent verdict. Judge this one.

## The test

`tests/scripts/shell_acts_bash_fuzz.test.ts` generates seeded shell commands from a fixed grammar, runs each through bash (with stubbed `git` / `gh` executables), and checks that the recogniser `src/scripts/_lib/shell_acts.ts` names the same acts bash runs.

## The suppression

```ts
const MAJOR = hasBash ? oracleBashMajor() : 0;
// Linux CI runners ship bash 5; macOS runners ship 3.2 and skip, as a Mac does locally.
if (process.env['CI'] && process.platform === 'linux' && MAJOR < 4) throw new Error(`the generated bash test needs bash >= 4 on Linux CI, found ${oracleBashVersion()}`);

describe.skipIf(MAJOR < 4)('generated commands: the recogniser agrees with bash', () => {
```

## Facts relevant to it

- The recogniser follows bash 5 where bash versions differ. Measured differences: bash 3.2 runs time(1), not the `time` keyword, after `!`, `if`, `elif`, `while`, `until`, and reads none of the chains `time ! time …`, `time time …`, `! time ! …`; bash 5.2 reads all of them as keyword prefixes. The generator produces such forms.
- macOS ships `/bin/bash` 3.2. The CI matrix runs this suite on ubuntu-latest (bash 5.2) and macos-26 (bash 3.2). There are no Windows runners.
- On Linux CI the test cannot skip: it throws if bash is older than 4. On macOS it skips unless `BASH_ORACLE_IMAGE` points the harness at a container with bash 5 (one long-lived container, used for local sweeps).
- The curated oracle `tests/scripts/shell_acts_bash_oracle.test.ts` (155 cases) runs on every platform without skipping; where bash 3.2 reaches fewer acts it records the 3.2 result per case (`BASH3` map) and still checks the recogniser against the bash-5 expectation.

## Questions

1. Is skipping the generated comparison on bash < 4 a legitimate suppression, or does it hide a defect that should instead be tested on that platform?
2. If you would change it, what is the change, and what does it cost?
3. Does anything in the arrangement let the suppression widen silently later (for example, Linux CI losing coverage without failing)?

End with exactly one line in this form:
`STANCE: <ratified|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`
