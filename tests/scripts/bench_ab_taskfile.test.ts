/**
 * The guard that would have caught the silently-dropped spend cap.
 *
 * `bench:ab:live` is cost-bearing, and a roadmap blocker authorises it as
 * `task bench:ab:live -- --budget <N>` on the stated grounds that the command
 * "caps per-task spend". It did not: the target invoked
 * `bench_ab_task_runner` without `{{.CLI_ARGS}}`, so Task had nowhere to put
 * the trailing flag, the shell accepted it, and the run fell back to the
 * parser's own default. An operator who named a cap got a different one, on a
 * paid path, with nothing reporting the difference.
 *
 * The test reads the real taskfile rather than a fixture, because the property
 * that matters is what the shipped target does — a fixture would let the
 * passthrough disappear from the tree and still pass.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const BENCH_AB = path.join(process.cwd(), 'taskfiles/bench-ab.yml');
const VALUE = path.join(process.cwd(), 'taskfiles/value.yml');

/** The `cmds:` lines of one task, verbatim, without parsing all of YAML. */
function cmdsOf(taskName: string, file: string = BENCH_AB): string[] {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const head = lines.findIndex((l) => l.trimEnd() === `  ${taskName}:`);
    expect(head, `task ${taskName} not found in ${file}`).toBeGreaterThan(-1);

    let end = lines.length;
    for (let i = head + 1; i < lines.length; i++) {
        // The next task at the same indent ends this one.
        if (/^ {2}\S/.test(lines[i] as string)) {
            end = i;
            break;
        }
    }
    const body = lines.slice(head, end);
    const cmdsAt = body.findIndex((l) => /^ {4}cmds:\s*$/.test(l));
    if (cmdsAt === -1) return [];
    const out: string[] = [];
    for (let i = cmdsAt + 1; i < body.length; i++) {
        const l = body[i] as string;
        // Comments and blanks sit between entries in several of these lists —
        // `bench:ab:value` opens its cmds with a three-line comment, which is
        // what made the first version of this helper return nothing for it.
        if (/^ *(#.*)?$/.test(l)) continue;
        if (!/^ {6}- /.test(l)) break;
        out.push(l.trim());
    }
    return out;
}

describe('bench-ab taskfile — the spend cap has to reach the runner', () => {
    it('bench:ab:live forwards trailing args to the task runner', () => {
        const runner = cmdsOf('bench:ab:live').filter((c) =>
            c.includes('bench_ab_task_runner'),
        );
        expect(runner).toHaveLength(1);
        expect(runner[0]).toContain('{{.CLI_ARGS}}');
    });

    it('the clone step deliberately does NOT take them', () => {
        // `--budget` is not a clone flag; forwarding there would make the
        // runner's own arguments an error in a different process.
        const clone = cmdsOf('bench:ab:live').filter((c) => c.includes('bench_ab_clone'));
        expect(clone).toHaveLength(1);
        expect(clone[0]).not.toContain('{{.CLI_ARGS}}');
    });

    it('every cost-bearing sibling that dispatches also forwards them', () => {
        // The convention this target had broken: `bench:ab:track-b` already
        // passed CLI_ARGS to its dispatching script while cloning without.
        const dispatch = cmdsOf('bench:ab:track-b').filter((c) =>
            c.includes('bench_ab_cache_dispatch'),
        );
        expect(dispatch).toHaveLength(1);
        expect(dispatch[0]).toContain('{{.CLI_ARGS}}');
    });

    // The sibling search found the same construct on two further paid targets.
    // Neither claimed a cap, so neither was telling an untruth — but neither
    // could be bounded by an operator either, and the passthrough is inert
    // when no trailing args are given. Pinned so the shape cannot come back
    // on one target while the others stay fixed.
    it.each([
        ['bench:ab:value', BENCH_AB],
        ['value:behaviour', VALUE],
    ])('%s forwards trailing args to the task runner', (task, file) => {
        const runner = cmdsOf(task, file).filter((c) => c.includes('bench_ab_task_runner'));
        expect(runner).toHaveLength(1);
        expect(runner[0]).toContain('{{.CLI_ARGS}}');
    });
});
