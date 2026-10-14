// Runs a CLI script with stdout behaving like a pipe whose reader has fallen
// behind: every write is accepted, queued, and reaches fd 1 only later. That is
// what libuv does once a pipe or socketpair is full (EAGAIN → write queue), and
// it is the state in which `process.exit()` discards whatever is still queued.
//
// Usage: tsx stalled_stdout_harness.ts <script.ts> [args...]
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const target = path.resolve(process.argv[2] ?? '');

process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    setTimeout(() => fs.writeSync(1, text), 20);
    return false;
}) as typeof process.stdout.write;

// The script must see itself as the CLI entry point, exactly as under `tsx <script>`.
process.argv.splice(1, 2, target);
await import(pathToFileURL(target).href);
