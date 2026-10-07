// The ratification fence follows the dispatcher's imports.
//
// Release finding 21900086c1a0: `_resolve_execution_failure` moved out of
// `dispatch_hook.ts` into `concern_failure_policy.ts`, and with it out of the
// gate's hand-written pattern — a diff changing whether a crashed blocking
// concern refuses carried no record. Three directions are pinned: the moved
// policy without a record fails; with a valid record it passes; an unrelated
// concern under `hooks/` still passes without one, because concerns stay
// outside the fence. A fourth pins the property the fix is for — a module the
// dispatcher newly imports that names an exit code joins the set with no edit
// to the gate.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { classifyPaths, closureArrivals, evaluate } from '../../src/scripts/check_kernel_edit_ratified.js';
import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';

const POLICY = 'src/scripts/hooks/concern_failure_policy.ts';
const UNRELATED_CONCERN = 'src/scripts/hooks/chain_nudge_hook.ts';

let root: string;

function writeRecord(): string {
    const rel = path.join(RATIFICATION_DIR, 'fence-fixture.md');
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(
        path.join(root, rel),
        [
            '---',
            'proposed_by: claude/session-a',
            'implemented_by: claude/session-a',
            'reviewed_by: council/anthropic+openai',
            'verdict: ratified',
            'effective_after: merge',
            'providers:',
            '  - anthropic',
            '  - openai',
            'seats:',
            '  anthropic: ratified',
            '  openai: ratified',
            '---',
            '',
            '<!-- evidence-type: ratification -->',
            '',
            'Review body.',
            '',
        ].join('\n'),
    );
    return rel;
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ker-closure-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the fence follows the dispatcher import closure', () => {
    it('a diff touching only the crashed-concern policy, with NO record, fails', () => {
        expect(evaluate([POLICY], root, 2).exitCode).toBe(1);
    });

    it('the same diff with a valid record passes', () => {
        const rec = writeRecord();
        expect(evaluate([POLICY, rec], root, 2).exitCode).toBe(0);
    });

    it('a diff touching only an unrelated concern passes without a record', () => {
        expect(evaluate([UNRELATED_CONCERN], root, 2).exitCode).toBe(0);
    });

    it('the stdin-failure policy and the bundle budget are watched too', () => {
        const gated = classifyPaths([
            'src/scripts/hooks/stdin_failure_policy.ts',
            'src/config/hook-bundle-budget.json',
        ]);
        expect(gated.plumbing).toEqual([
            'src/scripts/hooks/stdin_failure_policy.ts',
            'src/config/hook-bundle-budget.json',
        ]);
    });

    it('a module the dispatcher newly imports that names an exit code joins without a gate edit', () => {
        const hooks = path.join(root, 'src', 'scripts', 'hooks');
        fs.mkdirSync(hooks, { recursive: true });
        fs.writeFileSync(
            path.join(hooks, 'dispatch_hook.ts'),
            "import { decide } from './timeout_policy.js';\n",
        );
        fs.writeFileSync(
            path.join(hooks, 'timeout_policy.ts'),
            "import { EXIT_BLOCK } from './exit_codes.js';\nexport const decide = () => EXIT_BLOCK;\n",
        );
        fs.writeFileSync(path.join(hooks, 'exit_codes.ts'), 'export const EXIT_BLOCK = 2;\n');
        expect(evaluate(['src/scripts/hooks/timeout_policy.ts'], root, 2).exitCode).toBe(1);
    });
});

// The two gaps the first ratification round refused on, pinned in both
// directions. A name-based classifier cannot see a verdict module with neutral
// names, so the module is gated at the moment it becomes reachable; and a
// module the base classes as verdict cannot be declassified by an unrecorded
// diff that strips its names.
describe('what the classifier cannot see by name', () => {
    function headTree(files: Record<string, string>): void {
        for (const [rel, body] of Object.entries(files)) {
            fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
            fs.writeFileSync(path.join(root, rel), body);
        }
    }

    it('a neutrally-named module newly reachable from the dispatcher is gated, and named', () => {
        headTree({
            'src/scripts/hooks/dispatch_hook.ts': "import { acceptsExecution } from './gatekeeper.js';\n",
            'src/scripts/hooks/gatekeeper.ts': 'export function acceptsExecution(): boolean { return true; }\n',
        });
        expect(closureArrivals(root)).toContain('src/scripts/hooks/gatekeeper.ts');
        expect(evaluate(['src/scripts/hooks/gatekeeper.ts'], root, 2).exitCode).toBe(1);
    });

    it('a module already in the base closure as payload stays record-free', () => {
        expect(closureArrivals(root)).toEqual([]);
        expect(evaluate(['src/scripts/hooks/py_json_dumps.ts'], root, 2).exitCode).toBe(0);
    });

    it('stripping the names that classed a base verdict module does not declassify it', () => {
        headTree({
            'src/scripts/hooks/dispatch_hook.ts': "import { decide } from './concern_failure_policy.js';\n",
            'src/scripts/hooks/concern_failure_policy.ts': 'export function decide(): number { return 2; }\n',
        });
        expect(evaluate([POLICY], root, 2).exitCode).toBe(1);
    });
});
