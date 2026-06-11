// Fixture: .ts-only — echoes argv as JSON for exact passthrough assertions.
process.stdout.write(`ts:${JSON.stringify(process.argv.slice(2))}\n`);
