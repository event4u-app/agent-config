// Standalone journal writer, spawned as a REAL separate process by
// `runtime_journal_concurrency.test.ts` (road-to-runtime-event-journal 1.3 /
// AC-3).
//
// It is a separate file rather than an inline worker for one reason: the
// acceptance criterion is about two OS processes contending for one database
// file. A worker thread shares the process and would exercise nothing.
//
// argv: <root> <session_id> <task_id> <capability> <count> <start_at_ms>
//
// Every process busy-waits until `start_at_ms` before its first write, so the
// writes genuinely overlap instead of relying on spawn-time jitter. Exits 0
// only when every intended record was written; any failure exits 1 with the
// message on stderr, so the test reports WHY rather than just a count.

import { openJournal, recordEvent } from '../../src/scripts/_lib/runtime_journal.js';

function main(argv: string[]): number {
    const [root, sessionId, taskId, capability, countRaw, startAtRaw] = argv;
    if (
        root === undefined ||
        sessionId === undefined ||
        taskId === undefined ||
        capability === undefined ||
        countRaw === undefined ||
        startAtRaw === undefined
    ) {
        process.stderr.write('usage: <root> <session_id> <task_id> <capability> <count> <start_at_ms>\n');
        return 2;
    }
    const count = Number(countRaw);
    const startAt = Number(startAtRaw);

    const h = openJournal(root);
    try {
        // Barrier: both processes leave this loop at the same instant.
        while (Date.now() < startAt) {
            /* spin */
        }
        for (let i = 0; i < count; i += 1) {
            recordEvent(h, {
                event: 'post_tool_use',
                session_id: sessionId,
                task_id: taskId,
                capability,
                at: new Date().toISOString(),
            });
        }
    } catch (exc) {
        process.stderr.write(`${exc instanceof Error ? exc.message : String(exc)}\n`);
        return 1;
    } finally {
        h.close();
    }
    process.stdout.write(`${h.location.path}\n`);
    return 0;
}

process.exit(main(process.argv.slice(2)));
