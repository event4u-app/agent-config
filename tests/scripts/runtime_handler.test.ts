// Tests for the runtime handler — port of the handler-isolation half of
// tests/test_runtime_handler.py (py2ts Phase 8 / Wave 8h).
//
// The pytest suite's E2E section (test_dispatcher_run_*) imports
// `runtime_dispatcher.run`, which has NO TypeScript twin in this wave
// (runtime_dispatcher is the sensitive hot path, ported in a separate wave).
// Those three tests are intentionally NOT ported here — they exercise the
// dispatcher, not the handler. The handler-in-isolation tests + `_build_env`
// are ported 1:1.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillRuntime } from '../../src/scripts/runtime_registry.js';
import {
    DEFAULT_ENV_ALLOWLIST,
    ExecutionResult,
    HandlerError,
    _build_env,
    execute_shell,
} from '../../src/scripts/runtime_handler.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-handler-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function skill(
    command: string[],
    handler = 'shell',
    timeout = 30,
    name = 'probe',
): SkillRuntime {
    return new SkillRuntime({
        name,
        path: 'test',
        description: '',
        execution_type: 'assisted',
        handler,
        timeout_seconds: timeout,
        safety_mode: null,
        allowed_tools: [],
        command,
    });
}

describe('runtime_handler — handler in isolation', () => {
    it('test_execute_shell_success', () => {
        const result = execute_shell(skill(['node', '-e', "console.log('ok')"]), tmp);
        expect(result.status).toBe('success');
        expect(result.exit_code).toBe(0);
        expect(result.stdout).toContain('ok');
        expect(result.duration_ms).toBeGreaterThanOrEqual(0);
        expect(result.timed_out).toBe(false);
        expect(result.cwd).toBe(path.resolve(tmp));
    });

    it('test_execute_shell_non_zero_is_failure', () => {
        const result = execute_shell(skill(['node', '-e', 'process.exit(3)']), tmp);
        expect(result.status).toBe('failure');
        expect(result.exit_code).toBe(3);
        expect(result.is_success).toBe(false);
    });

    it('test_execute_shell_captures_stderr', () => {
        const result = execute_shell(
            skill(['node', '-e', "process.stderr.write('boom'); process.exit(1)"]),
            tmp,
        );
        expect(result.status).toBe('failure');
        expect(result.stderr).toContain('boom');
    });

    it('test_execute_shell_timeout', () => {
        const result = execute_shell(skill(['node', '-e', 'setTimeout(() => {}, 5000)'], 'shell', 1), tmp);
        expect(result.status).toBe('timeout');
        expect(result.timed_out).toBe(true);
        expect(result.exit_code).toBe(-1);
        expect(result.error ?? '').toContain('Timed out');
    });

    it('test_execute_shell_command_not_found', () => {
        const result = execute_shell(skill(['this-binary-does-not-exist-xyz']), tmp);
        expect(result.status).toBe('error');
        expect(result.exit_code).toBe(-1);
        expect((result.error ?? '').toLowerCase()).toContain('not found');
    });

    it('test_execute_shell_rejects_empty_command', () => {
        expect(() => execute_shell(skill([]), tmp)).toThrow(/no 'command' declared/);
        expect(() => execute_shell(skill([]), tmp)).toThrow(HandlerError);
    });

    it('test_execute_shell_rejects_non_runtime_handler', () => {
        expect(() => execute_shell(skill(['true'], 'internal'), tmp)).toThrow(
            /not a real-execution handler/,
        );
        expect(() => execute_shell(skill(['true'], 'internal'), tmp)).toThrow(HandlerError);
    });

    it('test_build_env_scrubs_secrets', () => {
        const saved = { ...process.env };
        try {
            process.env.PATH = '/usr/bin';
            process.env.AWS_SECRET_ACCESS_KEY = 'leak-me';
            process.env.GITHUB_TOKEN = 'leak-me-too';
            const env = _build_env(DEFAULT_ENV_ALLOWLIST);
            expect(env.PATH).toBe('/usr/bin');
            expect('AWS_SECRET_ACCESS_KEY' in env).toBe(false);
            expect('GITHUB_TOKEN' in env).toBe(false);
        } finally {
            // Restore the environment.
            for (const k of Object.keys(process.env)) {
                if (!(k in saved)) {
                    delete process.env[k];
                }
            }
            Object.assign(process.env, saved);
        }
    });

    it('execute_shell returns an ExecutionResult instance', () => {
        const result = execute_shell(skill(['node', '-e', '0']), tmp);
        expect(result).toBeInstanceOf(ExecutionResult);
    });
});
