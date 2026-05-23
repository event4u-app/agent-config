/**
 * Tests for the TypeScript CLI `--scope` consumer-global-only gate.
 *
 * road-to-global-only-install § Phase 3.4 / 3.5 — mirrors the bash
 * gate in `scripts/install` and the Python `_enforce_consumer_global_only`.
 * `--scope=project` is reserved for maintainers and requires
 * `AGENT_CONFIG_DEV_MODE=1`. Without the env flag we throw a directive
 * error pointing at `docs/maintainers/dev-mode.md`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveScope } from '../src/cli.js';

const ENV_KEY = 'AGENT_CONFIG_DEV_MODE';
let originalDevMode: string | undefined;

beforeEach(() => {
    originalDevMode = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
});

afterEach(() => {
    if (originalDevMode === undefined) {
        delete process.env[ENV_KEY];
    } else {
        process.env[ENV_KEY] = originalDevMode;
    }
});

describe('resolveScope — consumer-global-only gate', () => {
    it('defaults to global when --scope is omitted', () => {
        expect(resolveScope({})).toBe('global');
    });

    it('accepts --scope=global without dev mode', () => {
        expect(resolveScope({ scope: 'global' })).toBe('global');
    });

    it('rejects --scope=project without AGENT_CONFIG_DEV_MODE=1', () => {
        expect(() => resolveScope({ scope: 'project' })).toThrowError(
            /--scope=project is reserved for maintainers/,
        );
    });

    it('error message points at the maintainer doc', () => {
        expect(() => resolveScope({ scope: 'project' })).toThrowError(
            /docs\/maintainers\/dev-mode\.md/,
        );
    });

    it('error message cites ADR-020', () => {
        expect(() => resolveScope({ scope: 'project' })).toThrowError(/ADR-020/);
    });

    it('accepts --scope=project when AGENT_CONFIG_DEV_MODE=1', () => {
        process.env[ENV_KEY] = '1';
        expect(resolveScope({ scope: 'project' })).toBe('project');
    });

    it('rejects --scope=project when AGENT_CONFIG_DEV_MODE has another truthy value', () => {
        // Mirrors the Python gate: only the literal "1" opts in.
        for (const value of ['true', 'yes', 'on', '0', '']) {
            process.env[ENV_KEY] = value;
            expect(() => resolveScope({ scope: 'project' })).toThrowError(
                /reserved for maintainers/,
            );
        }
    });

    it('rejects unknown --scope values with a parser error', () => {
        expect(() => resolveScope({ scope: 'system' })).toThrowError(
            /--scope: invalid value 'system'/,
        );
    });

    it('coerces non-string scope option back to the global default', () => {
        // Commander hands us strings from the CLI, but a programmatic
        // caller could pass undefined / null — must still land on global.
        expect(resolveScope({ scope: undefined })).toBe('global');
        expect(resolveScope({})).toBe('global');
    });
});
