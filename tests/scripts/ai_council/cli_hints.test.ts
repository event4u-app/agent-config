// Tests for src/scripts/ai_council/cli_hints.ts (py2ts Phase 1).
//
// Pure string formatting, stdlib-only. Unit-tests the table + the per-skip
// banner, plus a banner byte-parity differential against python3 for a
// representative skip list (known + unknown providers, binary_missing vs
// other reasons, missing keys).
import { describe, expect, it } from 'vitest';

import {
    INSTALL_HINTS,
    format_install_hints,
    hint_for,
} from '../../../src/scripts/ai_council/cli_hints.js';
import { hasPython3, runPyCode } from './_harness.js';

const py3 = hasPython3();

describe('cli_hints — INSTALL_HINTS table', () => {
    it('carries the five known providers', () => {
        expect(Object.keys(INSTALL_HINTS).sort()).toEqual(
            ['anthropic', 'gemini', 'openai', 'perplexity', 'xai'].sort(),
        );
    });

    it('anthropic tuple is [binary, docs, one-liner]', () => {
        expect(INSTALL_HINTS.anthropic).toEqual([
            'claude',
            'https://docs.anthropic.com/en/docs/claude-code/quickstart',
            'npm install -g @anthropic-ai/claude-code',
        ]);
    });
});

describe('cli_hints — hint_for', () => {
    it('returns the tuple for a known provider', () => {
        expect(hint_for('openai')).toEqual([
            'codex',
            'https://github.com/openai/codex',
            'npm install -g @openai/codex',
        ]);
    });

    it('returns null for an unknown provider', () => {
        expect(hint_for('nope')).toBeNull();
    });
});

describe('cli_hints — format_install_hints', () => {
    it('returns "" for an empty list (no leading blank line)', () => {
        expect(format_install_hints([])).toBe('');
    });

    it('renders an install line for a known binary_missing provider', () => {
        const out = format_install_hints([
            { member: 'anthropic', reason: 'binary_missing', detail: 'claude not found' },
        ]);
        expect(out).toBe(
            'council:cli-skip · anthropic · binary not found · ' +
                'install: npm install -g @anthropic-ai/claude-code · ' +
                'docs: https://docs.anthropic.com/en/docs/claude-code/quickstart',
        );
    });

    it('falls back to raw detail for an unknown binary_missing provider', () => {
        const out = format_install_hints([
            { member: 'mystery', reason: 'binary_missing', detail: 'mystery not found' },
        ]);
        expect(out).toBe('council:cli-skip · mystery · binary not found · mystery not found');
    });

    it('renders non-binary_missing reasons without an install line', () => {
        const out = format_install_hints([
            { member: 'openai', reason: 'auth_expired', detail: 'token expired' },
        ]);
        expect(out).toBe('council:cli-skip · openai · auth_expired · token expired');
    });

    it('uses "unknown" when reason is missing/empty', () => {
        const out = format_install_hints([{ member: 'gemini' }]);
        expect(out).toBe('council:cli-skip · gemini · unknown · ');
    });

    it('joins multiple entries with newlines (no trailing newline)', () => {
        const out = format_install_hints([
            { member: 'anthropic', reason: 'binary_missing', detail: 'a' },
            { member: 'openai', reason: 'binary_missing', detail: 'b' },
        ]);
        expect(out.split('\n').length).toBe(2);
        expect(out.endsWith('\n')).toBe(false);
    });
});

describe.skipIf(!py3)('cli_hints — banner byte-parity vs python3', () => {
    it('produces a byte-identical banner for a mixed skip list', () => {
        const skipped = [
            { member: 'anthropic', reason: 'binary_missing', detail: 'claude not found on PATH' },
            { member: 'unknownprov', reason: 'binary_missing', detail: 'foo not found' },
            { member: 'openai', reason: 'auth_expired', detail: 'token expired' },
            { member: 'perplexity', reason: 'binary_missing', detail: 'perplexity missing' },
            { member: 'gemini' },
        ];
        const tsOut = format_install_hints(skipped);

        const code = [
            'import json, sys',
            'from scripts.ai_council import cli_hints',
            'skipped = json.loads(sys.argv[1])',
            'sys.stdout.write(cli_hints.format_install_hints(skipped))',
        ].join('\n');
        const res = runPyCode(code, [JSON.stringify(skipped)]);
        expect(res.status, res.stderr).toBe(0);
        expect(tsOut).toBe(res.stdout);
    });
});
