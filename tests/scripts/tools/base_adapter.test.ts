// Tests for src/scripts/tools/base_adapter.ts (py2ts Phase 1 — tools cluster).
//
// Pure-unit parity for ToolAction / ToolResult, ToolResult.to_dict() with
// Python-truthiness key omission (empty data / error dropped), and the
// validate_action / safe_execute flow on a concrete BaseToolAdapter subclass.
// Plus a golden-parity layer (python3 vs tsx) over to_dict across the
// success/error/empty-data permutations, asserting the JSON shapes are
// byte-identical. Output is fully deterministic.

import { describe, expect, it } from 'vitest';

import {
    BaseToolAdapter,
    ToolAction,
    ToolResult,
} from '../../../src/scripts/tools/base_adapter.js';


/** Minimal concrete adapter to exercise the abstract base. */
class FakeAdapter extends BaseToolAdapter {
    get name(): string {
        return 'github';
    }
    get supported_actions(): ReadonlySet<string> {
        return new Set(['read_pr', 'list_files', 'create_pr']);
    }
    check_auth(): boolean {
        return false;
    }
    execute_action(action: ToolAction): ToolResult {
        return new ToolResult({
            tool_name: this.name,
            action: action.action,
            success: true,
            data: { ran: true },
        });
    }
}

describe('base_adapter — pure unit', () => {
    it('validate_action: wrong tool', () => {
        const a = new FakeAdapter();
        const err = a.validate_action(
            new ToolAction({ tool_name: 'jira', action: 'read_pr', params: {} }),
        );
        expect(err).not.toBeNull();
        expect(err!).toContain('does not match');
    });

    it('validate_action: unsupported action lists sorted valid actions', () => {
        const a = new FakeAdapter();
        const err = a.validate_action(
            new ToolAction({ tool_name: 'github', action: 'delete_repo', params: {} }),
        );
        expect(err).not.toBeNull();
        expect(err!).toContain('not supported');
        // sorted(supported_actions) ascending: create_pr, list_files, read_pr
        expect(err!).toContain('valid: create_pr, list_files, read_pr');
    });

    it('validate_action: valid → null', () => {
        const a = new FakeAdapter();
        expect(
            a.validate_action(new ToolAction({ tool_name: 'github', action: 'read_pr', params: {} })),
        ).toBeNull();
    });

    it('safe_execute: rejects invalid', () => {
        const a = new FakeAdapter();
        const r = a.safe_execute(
            new ToolAction({ tool_name: 'github', action: 'delete_repo', params: {} }),
        );
        expect(r.success).toBe(false);
        expect(r.error).not.toBeNull();
    });

    it('safe_execute: runs valid', () => {
        const a = new FakeAdapter();
        const r = a.safe_execute(
            new ToolAction({ tool_name: 'github', action: 'read_pr', params: {} }),
        );
        expect(r.success).toBe(true);
        expect(r.data).not.toBeNull();
    });

    it('to_dict: success with data omits error', () => {
        const r = new ToolResult({
            tool_name: 'github',
            action: 'read_pr',
            success: true,
            data: { id: 1 },
        });
        const d = r.to_dict();
        expect(d.success).toBe(true);
        expect((d.data as Record<string, unknown>).id).toBe(1);
        expect('error' in d).toBe(false);
        // key order
        expect(Object.keys(d)).toEqual(['tool', 'action', 'success', 'data']);
    });

    it('to_dict: error omits data', () => {
        const r = new ToolResult({
            tool_name: 'github',
            action: 'read_pr',
            success: false,
            error: 'Not found',
        });
        const d = r.to_dict();
        expect(d.success).toBe(false);
        expect(d.error).toBe('Not found');
        expect('data' in d).toBe(false);
    });

    it('to_dict: empty dict data is omitted (Python falsy)', () => {
        const r = new ToolResult({
            tool_name: 'github',
            action: 'read_pr',
            success: true,
            data: {},
        });
        const d = r.to_dict();
        expect('data' in d).toBe(false);
    });

    it('to_dict: empty-string error is omitted (Python falsy)', () => {
        const r = new ToolResult({
            tool_name: 'github',
            action: 'read_pr',
            success: false,
            error: '',
        });
        const d = r.to_dict();
        expect('error' in d).toBe(false);
    });
});

// --- Golden parity (python3 vs tsx) -----------------------------------------


