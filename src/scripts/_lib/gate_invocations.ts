/**
 * Finds where a check script is invoked in the workflows and taskfiles, and
 * whether each invocation can fail its caller. Step 7.2 of
 * road-to-authority-routing-mechanism uses it to keep the live-tree check
 * classification honest: an invariant's invocation must stay blocking, and an
 * observation's must stay non-blocking, so neither can be changed silently.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse } from 'yaml';

export interface Invocation {
    /** Repository-relative file that carries the invocation. */
    file: string;
    /** The workflow step name, or the task name. */
    where: string;
    /** Flags passed to the check on that line, in order. */
    flags: string[];
    /** True when a non-zero exit of the check fails its step or task. */
    blocking: boolean;
}

const FLAG = /(?<![\w-])--[a-z][a-z0-9-]*/g;

function lineBlocks(run: string, check: string): { line: string; blocking: boolean }[] {
    const out: { line: string; blocking: boolean }[] = [];
    const exitsRc = /exit\s+"?\$\{?rc\}?"?/.test(run);
    for (const line of run.split('\n')) {
        if (!new RegExp(`src/scripts/${check}(?![\\w])`).test(line)) continue;
        let blocking = true;
        if (/\|\|\s*true\b/.test(line)) blocking = false;
        else if (/\|\|\s*rc=/.test(line)) blocking = exitsRc;
        out.push({ line, blocking });
    }
    return out;
}

function flagsOf(line: string, check: string): string[] {
    const after = line.slice(line.indexOf(`src/scripts/${check}`) + `src/scripts/${check}`.length);
    return [...(after.split('||')[0] ?? '').matchAll(FLAG)].map((m) => m[0]);
}

export function workflowInvocations(root: string, file: string, check: string): Invocation[] {
    const doc = parse(fs.readFileSync(path.join(root, file), 'utf8')) as { jobs?: Record<string, { steps?: Record<string, unknown>[] }> };
    const out: Invocation[] = [];
    for (const job of Object.values(doc.jobs ?? {})) {
        for (const step of job.steps ?? []) {
            const run = typeof step.run === 'string' ? step.run : '';
            const tolerated = step['continue-on-error'] === true;
            for (const { line, blocking } of lineBlocks(run, check)) {
                out.push({ file, where: String(step.name ?? '(unnamed step)'), flags: flagsOf(line, check), blocking: blocking && !tolerated });
            }
        }
    }
    return out;
}

export function taskfileInvocations(root: string, file: string, check: string): Invocation[] {
    const doc = parse(fs.readFileSync(path.join(root, file), 'utf8')) as { tasks?: Record<string, Record<string, unknown>> };
    const out: Invocation[] = [];
    for (const [name, task] of Object.entries(doc.tasks ?? {})) {
        const cmds: unknown[] = [];
        if (typeof task.cmd === 'string') cmds.push(task.cmd);
        if (Array.isArray(task.cmds)) cmds.push(...task.cmds);
        for (const c of cmds) {
            const text = typeof c === 'string' ? c : typeof (c as { cmd?: unknown }).cmd === 'string' ? String((c as { cmd: string }).cmd) : '';
            const ignored = task.ignore_error === true || (typeof c === 'object' && c !== null && (c as { ignore_error?: unknown }).ignore_error === true);
            for (const { line, blocking } of lineBlocks(text, check)) {
                out.push({ file, where: name, flags: flagsOf(line, check), blocking: blocking && !ignored });
            }
        }
    }
    return out;
}
