// Tests for src/scripts/hooks/block_kernel_rule_writes.ts — Layer 1 of kernel
// immutability (road-to-ai-employee-borrowings Phase 1).
//
// Unit tests over the exported pure functions (targets_kernel_rule,
// check_envelope). Mirrors the block_no_verify.test.ts structure: no stdin
// spawning — main() is thin wiring over these pure functions.
import { describe, expect, it } from 'vitest';

import {
    check_envelope,
    targets_kernel_rule,
} from '../../../src/scripts/hooks/block_kernel_rule_writes.js';

// --- targets_kernel_rule -----------------------------------------------------

describe('block_kernel_rule_writes — targets_kernel_rule', () => {
    it('matches a kernel rule in the source tree', () => {
        expect(targets_kernel_rule('src/rules/commit-policy.md')).toBe('commit-policy');
    });
    it('matches a kernel rule in the dist projection', () => {
        expect(targets_kernel_rule('dist/agent-src/rules/scope-control.md')).toBe(
            'scope-control',
        );
    });
    it('matches a kernel rule under .claude/**/rules/', () => {
        expect(targets_kernel_rule('.claude/skills/foo/rules/verify-before-complete.md')).toBe(
            'verify-before-complete',
        );
    });
    it('matches a kernel rule under .augment/rules/', () => {
        expect(targets_kernel_rule('.augment/rules/non-destructive-by-default.md')).toBe(
            'non-destructive-by-default',
        );
    });
    it('normalizes backslashes (Windows-style paths)', () => {
        expect(targets_kernel_rule('dist\\agent-src\\rules\\ask-when-uncertain.md')).toBe(
            'ask-when-uncertain',
        );
    });
    it('does not match a non-kernel rule under rules/', () => {
        expect(targets_kernel_rule('src/rules/telegraph-speak.md')).toBeNull();
    });
    it('does not match a kernel-named file OUTSIDE a rules/ directory', () => {
        expect(targets_kernel_rule('docs/notes/commit-policy.md')).toBeNull();
    });
    it('does not match an ordinary file', () => {
        expect(targets_kernel_rule('src/scripts/hooks/block_no_verify.ts')).toBeNull();
    });
    it('returns null for an empty path', () => {
        expect(targets_kernel_rule('')).toBeNull();
    });
});

// --- check_envelope -----------------------------------------------------------

describe('block_kernel_rule_writes — check_envelope (red)', () => {
    it('DENIES a Write targeting src/rules/commit-policy.md', () => {
        const [blocked, reason] = check_envelope({
            payload: {
                tool_name: 'Write',
                tool_input: { file_path: 'src/rules/commit-policy.md', content: 'x' },
            },
        });
        expect(blocked).toBe(true);
        expect(reason).toContain('commit-policy');
        expect(reason).toContain('immutable');
    });
    it('DENIES an Edit targeting dist/agent-src/rules/scope-control.md', () => {
        const [blocked, reason] = check_envelope({
            payload: {
                tool_name: 'Edit',
                tool_input: {
                    file_path: 'dist/agent-src/rules/scope-control.md',
                    old_string: 'a',
                    new_string: 'b',
                },
            },
        });
        expect(blocked).toBe(true);
        expect(reason).toContain('scope-control');
    });
    it('DENIES a cross-platform save-file targeting a kernel rule', () => {
        const [blocked] = check_envelope({
            payload: {
                tool_name: 'save-file',
                tool_input: { path: '.augment/rules/direct-answers.md' },
            },
        });
        expect(blocked).toBe(true);
    });
    it('reads a top-level (unwrapped) envelope, not only payload.*', () => {
        const [blocked, reason] = check_envelope({
            tool_name: 'Write',
            tool_input: { file_path: 'src/rules/no-cheap-questions.md' },
        });
        expect(blocked).toBe(true);
        expect(reason).toContain('no-cheap-questions');
    });
});

describe('block_kernel_rule_writes — check_envelope (green)', () => {
    it('allows a Write to a non-kernel rule', () => {
        expect(
            check_envelope({
                payload: {
                    tool_name: 'Write',
                    tool_input: { file_path: 'src/rules/telegraph-speak.md', content: 'x' },
                },
            })[0],
        ).toBe(false);
    });
    it('allows a kernel-named file outside a rules/ directory', () => {
        expect(
            check_envelope({
                payload: {
                    tool_name: 'Write',
                    tool_input: { file_path: 'docs/notes/commit-policy.md', content: 'x' },
                },
            })[0],
        ).toBe(false);
    });
    it('allows an ordinary file write', () => {
        expect(
            check_envelope({
                payload: {
                    tool_name: 'Write',
                    tool_input: { file_path: 'src/scripts/foo.ts', content: 'x' },
                },
            })[0],
        ).toBe(false);
    });
    it('allows a non-edit tool (e.g. Read) even against a kernel rule path', () => {
        expect(
            check_envelope({
                payload: {
                    tool_name: 'Read',
                    tool_input: { file_path: 'src/rules/commit-policy.md' },
                },
            })[0],
        ).toBe(false);
    });
    it('never crashes on a payload without a file path — allows', () => {
        expect(check_envelope({ payload: { tool_name: 'Write', tool_input: {} } })[0]).toBe(
            false,
        );
        expect(check_envelope({ payload: { tool_name: 'Write' } })[0]).toBe(false);
        expect(check_envelope({ payload: {} })[0]).toBe(false);
        expect(check_envelope({})[0]).toBe(false);
    });
});
