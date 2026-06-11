// Fixture: writes to stdout AND stderr, then exits with the code given as
// the first argument — exercises channel fidelity + exit-code propagation.
process.stdout.write('to-stdout\n');
process.stderr.write('to-stderr\n');
const code = Number(process.argv[2] ?? '0');
process.exit(Number.isNaN(code) ? 1 : code);
