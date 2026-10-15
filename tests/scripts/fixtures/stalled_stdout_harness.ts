// Runs a CLI script with stdout behaving like a pipe whose reader has fallen
// behind: every write is accepted, queued, and reaches fd 1 only later. That is
// what libuv does once a pipe or socketpair is full (EAGAIN → write queue), and
// it is the state in which `process.exit()` discards whatever is still queued.
//
// The delayed chunk goes out through the stream's own write, never `fs.writeSync(1)`:
// once `process.stdout` exists, libuv has put fd 1 in O_NONBLOCK, so a raw write
// to a full socketpair throws EAGAIN inside the timer and the harness dies with
// the tail undelivered (Linux CI, 2026-10-15: 169 of 213 lines). That loss was the
// harness's, not the gate's. The stream queues on EAGAIN and a natural exit drains
// the queue, so the only way left to lose output is the gate cutting the loop short.
//
// Usage: tsx stalled_stdout_harness.ts <script.ts> [args...]
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const target = path.resolve(process.argv[2] ?? '');
const deliver = process.stdout.write.bind(process.stdout) as (chunk: string | Uint8Array) => boolean;

process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    setTimeout(() => deliver(chunk), 20);
    return false;
}) as typeof process.stdout.write;

// The script must see itself as the CLI entry point, exactly as under `tsx <script>`.
process.argv.splice(1, 2, target);
await import(pathToFileURL(target).href);
