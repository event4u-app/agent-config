#!/usr/bin/env tsx
/**
 * The invocation plan as a command: the agent splits one input into stages,
 * hands them over as JSON on stdin, and reads back the executed order, the
 * coalesced sinks and the one `Order:` line (contexts/execution/invocation-plan.md).
 *
 * Usage:
 *   echo '<InvocationInput JSON>' | ./scripts-run src/scripts/invocation_plan
 *   ... | ./scripts-run src/scripts/invocation_plan --done <id,id>   re-plan what remains
 *   ... | ./scripts-run src/scripts/invocation_plan --failed <id>    partial delivery for what is done
 *
 * Exit codes: 0 a plan was printed · 2 unreadable input or an unknown stage — never a plan.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    InvocationPlanError,
    deliveryOnFailure,
    linearize,
    replan,
    type InvocationInput,
} from './_lib/invocation_plan.js';

export interface Io {
    out: (s: string) => void;
    err: (s: string) => void;
}

const STD_IO: Io = {
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
};

function flag(argv: readonly string[], name: string): string | null {
    const at = argv.indexOf(name);
    if (at < 0) return null;
    const value = argv[at + 1];
    if (value === undefined || value.startsWith('--')) throw new InvocationPlanError(`${name} needs a value`);
    return value;
}

export function main(argv: readonly string[], stdin: string, io: Io = STD_IO): number {
    try {
        let input: InvocationInput;
        try {
            input = JSON.parse(stdin) as InvocationInput;
        } catch {
            throw new InvocationPlanError('stdin is not a JSON invocation input');
        }
        const done = flag(argv, '--done');
        const failed = flag(argv, '--failed');
        const result =
            failed !== null
                ? deliveryOnFailure(linearize(input), failed)
                : done !== null
                  ? replan(input, done.split(',').filter(Boolean))
                  : linearize(input);
        io.out(`${JSON.stringify(result, null, 2)}\n`);
        return 0;
    } catch (err) {
        if (!(err instanceof InvocationPlanError)) throw err;
        io.err(`invocation_plan: ${err.message}\n`);
        return 2;
    }
}

function isCliEntry(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return pathToFileURL(path.resolve(entry)).href === pathToFileURL(fileURLToPath(import.meta.url)).href;
}

if (isCliEntry()) {
    process.exit(main(process.argv.slice(2), fs.readFileSync(0, 'utf8')));
}
