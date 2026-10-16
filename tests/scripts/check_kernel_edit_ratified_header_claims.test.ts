import { describe, expect, it } from 'vitest';

import { check_envelope as kernelRuleGuard } from '../../src/scripts/hooks/block_kernel_rule_writes.js';
import { check_envelope as plumbingGuard } from '../../src/scripts/hooks/block_plumbing_writes.js';

/**
 * `check_kernel_edit_ratified`'s header says no tool-call guard denies an edit
 * of the dispatcher source or the kernel-rule list, so the record is their only
 * layer. These cases keep that sentence true: if a guard starts denying either
 * path, the header has to change with it.
 */

const UNGUARDED = ['src/scripts/hooks/dispatch_hook.ts', 'src/scripts/_lib/kernel_rules.ts'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Envelope = any;

function envelopes(filePath: string): Envelope[] {
    return [
        { tool_name: 'Write', tool_input: { file_path: filePath, content: 'x' } },
        { tool_name: 'Edit', tool_input: { file_path: filePath, old_string: 'a', new_string: 'b' } },
        { tool_name: 'Bash', tool_input: { command: `printf x > ${filePath}` } },
    ];
}

describe("the gate header's claim about tool-call guards", () => {
    it.each(UNGUARDED)('neither write guard denies an edit of %s', (rel) => {
        for (const env of envelopes(rel)) {
            expect(plumbingGuard(env)[0], `plumbing guard, ${env.tool_name}`).toBe(false);
            expect(kernelRuleGuard(env)[0], `kernel-rule guard, ${env.tool_name}`).toBe(false);
        }
    });

    it('the same envelopes do reach a deny on what each guard protects', () => {
        for (const env of envelopes('hooks/hooks.json')) {
            expect(plumbingGuard(env)[0], `plumbing guard, ${env.tool_name}`).toBe(true);
        }
        for (const env of envelopes('src/rules/non-destructive-by-default.md')) {
            expect(kernelRuleGuard(env)[0], `kernel-rule guard, ${env.tool_name}`).toBe(true);
        }
    });
});
