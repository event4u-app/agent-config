/**
 * Turn an escaped {@link DeadScopeError} into a named refusal.
 *
 * A gate whose `main` let the error escape died on an uncaught exception, and a
 * crash used to share exit 1 with a finding, so its self-test could not tell
 * the two apart (road-to-checks-that-name-their-catch, A1). Kept out of
 * `scan_scope.ts` because that module is an import of the ratification gate.
 */
import process from 'node:process';

import { DeadScopeError } from './scan_scope.js';

export function exitOnDeadScope(run: () => number, write = process.stderr.write.bind(process.stderr)): number {
    try {
        return run();
    } catch (e) {
        if (!(e instanceof DeadScopeError)) throw e;
        write(`❌  ${e.message}\n`);
        return 2;
    }
}
