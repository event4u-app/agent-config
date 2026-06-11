// Fixture: reads all of stdin and echoes it back prefixed — exercises
// stdin passthrough through the dispatcher.
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
    data += chunk;
});
process.stdin.on('end', () => {
    process.stdout.write(`stdin:${data}`);
});
