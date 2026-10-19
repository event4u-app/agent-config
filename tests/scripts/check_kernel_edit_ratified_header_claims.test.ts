import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { verdictFor as credentialReadVerdict } from '../../src/scripts/hooks/block_credential_reads.js';
import { check_envelope as kernelRuleGuard } from '../../src/scripts/hooks/block_kernel_rule_writes.js';
import { check_envelope as plumbingGuard } from '../../src/scripts/hooks/block_plumbing_writes.js';

/**
 * `check_kernel_edit_ratified`'s header names two guards and says neither
 * protects the dispatcher source or the kernel-rule list. These cases check
 * exactly those two guards, and nothing wider: the header's broader sentence,
 * that no bound `pre_tool_use` concern denies either path, was verified once by
 * sending both edits through the built dispatcher and is not automated here.
 * The last case is its trigger: the concerns bound to `pre_tool_use` in any
 * profile are pinned, so a new one fails here until it has been checked against
 * these two paths and added — and the header changed if it denies either.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Every concern bound to `pre_tool_use`, checked on 2026-10-16 against an edit of
 * both paths. The two that can deny besides the guards are `evidence-independence`,
 * which let both edits through the built dispatcher with the guards, and
 * `one-question-per-ask`, which reads only the question tool. The rest are
 * advisory in the manifest and cannot deny. `block-credential-reads` (bound
 * 2026-10-18) can deny, and refuses only a read of a credential-class file or of
 * the process environment; the case below sends the same three envelopes through
 * its `verdictFor` for both paths and asserts no refusal.
 *
 * When the last case fails because a concern was bound: if it can deny (its
 * manifest `severity` is `blocking`), send an edit of both paths through the
 * built dispatcher and see whether it refuses; if it refuses either, change the
 * header of `check_kernel_edit_ratified.ts`, which then needs a record. Either
 * way, add the concern here, sorted, and say how it was checked above.
 */
const REVIEWED_PRE_TOOL_USE = [
    'block-config-weakening',
    'block-credential-reads',
    'block-kernel-rule-writes',
    'block-no-verify',
    'block-plumbing-writes',
    'block-speaking-inbox-dir',
    'chain-nudge',
    'code-graph-context',
    'design-slop',
    'evidence-independence',
    'memory-recall',
    'one-question-per-ask',
    'reread-guard',
    'rtk-wrap',
    'ship-diff-volume',
    'source-first-gate',
    'spawn-guard-shadow',
    'ui-route-nudge',
];

function boundPreToolUse(): string[] {
    const manifest: unknown = parseYaml(fs.readFileSync(path.join(REPO, 'src/scripts/hook_manifest.yaml'), 'utf8'));
    const found = new Set<string>();
    const walk = (node: unknown): void => {
        if (node === null || typeof node !== 'object') return;
        for (const [key, value] of Object.entries(node)) {
            if (key === 'pre_tool_use' && Array.isArray(value)) {
                for (const id of value) found.add(String(id));
            } else {
                walk(value);
            }
        }
    };
    walk(manifest);
    return [...found].sort();
}

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

describe('the two guards the gate header names', () => {
    it.each(UNGUARDED)('neither the plumbing nor the kernel-rule guard denies an edit of %s', (rel) => {
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

    it.each(UNGUARDED)('the credential-read guard does not deny an edit of %s', (rel) => {
        for (const env of envelopes(rel)) {
            expect(credentialReadVerdict(env.tool_name, env.tool_input), env.tool_name).toBeNull();
        }
    });

    it('a pre_tool_use concern nobody checked against the two paths fails here', () => {
        expect(boundPreToolUse()).toEqual(REVIEWED_PRE_TOOL_USE);
    });
});
