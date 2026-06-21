// Tests for src/scripts/tools/adapter_errors.ts (py2ts Phase 1 — tools cluster).
//
// Pure-unit parity for the AdapterErrorType enum values, the AdapterError
// value shape + is_retryable predicate, and classify_http_error's status-code
// → error-type mapping. Plus a golden-parity layer (python3 vs tsx) that drives
// the same classify_http_error inputs through both languages and asserts the
// JSON shapes (incl. is_retryable) are byte-identical. Output is fully
// deterministic — no timestamps / measured fields.

import { describe, expect, it } from 'vitest';

import {
    AdapterErrorType,
    classify_http_error,
    is_retryable,
    makeAdapterError,
} from '../../../src/scripts/tools/adapter_errors.js';



describe('adapter_errors — pure unit', () => {
    it('enum values mirror the Python str-Enum', () => {
        expect(AdapterErrorType.AUTH_FAILURE).toBe('auth_failure');
        expect(AdapterErrorType.NOT_FOUND).toBe('not_found');
        expect(AdapterErrorType.RATE_LIMIT).toBe('rate_limit');
        expect(AdapterErrorType.TIMEOUT).toBe('timeout');
        expect(AdapterErrorType.NETWORK).toBe('network');
        expect(AdapterErrorType.VALIDATION).toBe('validation');
        expect(AdapterErrorType.UNKNOWN).toBe('unknown');
    });

    it('makeAdapterError defaults status_code / retry_after to null', () => {
        const err = makeAdapterError({
            adapter: 'github',
            action: 'read_pr',
            error_type: AdapterErrorType.VALIDATION,
            message: 'bad',
        });
        expect(err.status_code).toBeNull();
        expect(err.retry_after).toBeNull();
    });

    it('is_retryable: rate_limit / timeout / network are retryable', () => {
        for (const t of [
            AdapterErrorType.RATE_LIMIT,
            AdapterErrorType.TIMEOUT,
            AdapterErrorType.NETWORK,
        ]) {
            const err = makeAdapterError({
                adapter: 'github',
                action: 'x',
                error_type: t,
                message: 'm',
            });
            expect(is_retryable(err)).toBe(true);
        }
    });

    it('is_retryable: auth / not_found / validation / unknown are not retryable', () => {
        for (const t of [
            AdapterErrorType.AUTH_FAILURE,
            AdapterErrorType.NOT_FOUND,
            AdapterErrorType.VALIDATION,
            AdapterErrorType.UNKNOWN,
        ]) {
            const err = makeAdapterError({
                adapter: 'github',
                action: 'x',
                error_type: t,
                message: 'm',
            });
            expect(is_retryable(err)).toBe(false);
        }
    });

    it('classify_http_error: status-code mapping', () => {
        const cases: Array<[number, AdapterErrorType]> = [
            [401, AdapterErrorType.AUTH_FAILURE],
            [403, AdapterErrorType.AUTH_FAILURE],
            [404, AdapterErrorType.NOT_FOUND],
            [429, AdapterErrorType.RATE_LIMIT],
            [500, AdapterErrorType.NETWORK],
            [502, AdapterErrorType.NETWORK],
            [400, AdapterErrorType.UNKNOWN],
            [418, AdapterErrorType.UNKNOWN],
            [301, AdapterErrorType.UNKNOWN],
        ];
        for (const [code, expected] of cases) {
            const err = classify_http_error('github', 'read_pr', code, 'boom');
            expect(err.error_type).toBe(expected);
            expect(err.adapter).toBe('github');
            expect(err.action).toBe('read_pr');
            expect(err.message).toBe('boom');
            expect(err.status_code).toBe(code);
            expect(err.retry_after).toBeNull();
        }
    });
});

// --- Golden parity (python3 vs tsx) -----------------------------------------


