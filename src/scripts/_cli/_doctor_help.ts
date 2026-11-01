/**
 * `doctor --help` body — what each flag in the usage line does, and what a
 * default run touches.
 *
 * A separate module because `cmd_doctor.ts` is past the source-size budget
 * (`check_source_size_budget`): every line added there counts as excess.
 */

export const DOCTOR_HELP_BODY = `
Checks the agent-config install for this project and this machine and names
the next fix for anything wrong.

On a machine with no install it prints one line — not installed, run
\`agent-config init\` — and touches nothing. With an install, a default run
reads the install, asks each detected AI tool's CLI for its version, and
caches a scan of neighbouring packages under agents/reports/. It never
changes your settings or your install.

options:
  -h, --help            Show this help and exit
  --project PROJECT     Check this project root instead of the current one
  --json                Print the report as JSON
  --ci                  JSON report; any drift or failed check exits 1
  --check ID            Run one check only (exit 1 if it fails, 2 if skipped)
  --strict              Exit non-zero on failed checks in the readable report
  --strict-level LEVEL  With --strict: fail (default) or warn, which also fails on warnings
  --trace-root          Show how the project root was found, then exit
  --context             Show the resolved install context, then exit
  --anatomy             Show what the installed rules load into a session
  --no-forge            Skip the network read of branch protection (the default)
  --online              Read branch protection from the forge (network)
  --repair ID           Fix one known state; ID: wizard-state

exit codes:
  0  healthy, or nothing installed yet
  1  drift between the install and the files on disk
  2  no install found (with --json/--ci/--strict), or a usage error
`;
