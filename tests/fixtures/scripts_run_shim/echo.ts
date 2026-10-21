let stdin = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (c: string) => (stdin += c));
process.stdin.on('end', () => {
    process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), stdin, ppid: process.ppid }));
    process.stderr.write('to-stderr');
    process.exit(Number(process.argv[2] ?? 0));
});
