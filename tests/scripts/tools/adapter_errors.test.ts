// Tests for src/scripts/tools/adapter_errors.ts (py2ts Phase 1 — tools cluster).
//
// Pure-unit parity for the AdapterErrorType enum values, the AdapterError
// value shape + is_retryable predicate, and classify_http_error's status-code
// → error-type mapping. Plus a golden-parity layer (python3 vs tsx) that drives
// the same classify_http_error inputs through both languages and asserts the
// JSON shapes (incl. is_retryable) are byte-identical. Output is fully
// deterministic — no timestamps / measured fields.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    AdapterErrorType,
    classify_http_error,
    is_retryable,
    makeAdapterError,
} from '../../../src/scripts/tools/adapter_errors.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

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

const PY_HARNESS = `
import json, sys
sys.path.insert(0, "src/scripts")
from tools.adapter_errors import classify_http_error
codes = [401, 403, 404, 429, 500, 502, 400, 418, 301]
out = []
for c in codes:
    e = classify_http_error("github", "read_pr", c, "boom")
    out.append({
        "adapter": e.adapter,
        "action": e.action,
        "error_type": e.error_type.value,
        "message": e.message,
        "status_code": e.status_code,
        "retry_after": e.retry_after,
        "is_retryable": e.is_retryable,
    })
sys.stdout.write(json.dumps(out, indent=2, sort_keys=True))
`;

const TS_HARNESS = `
import { classify_http_error, is_retryable } from "./src/scripts/tools/adapter_errors.ts";
const codes = [401, 403, 404, 429, 500, 502, 400, 418, 301];
const out = codes.map((c) => {
    const e = classify_http_error("github", "read_pr", c, "boom");
    return {
        adapter: e.adapter,
        action: e.action,
        error_type: e.error_type,
        message: e.message,
        status_code: e.status_code,
        retry_after: e.retry_after,
        is_retryable: is_retryable(e),
    };
});
// Mirror json.dumps(out, indent=2, sort_keys=True): sort object keys.
function sortKeys(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const r: Record<string, unknown> = {};
        for (const k of Object.keys(o).sort()) r[k] = sortKeys(o[k]);
        return r;
    }
    return v;
}
process.stdout.write(JSON.stringify(sortKeys(out), null, 2));
`;

describe.skipIf(!py3)('adapter_errors — golden parity (python3 vs tsx)', () => {
    it('classify_http_error JSON shapes are byte-identical', () => {
        const p = spawnSync('python3', ['-c', PY_HARNESS], { cwd: REPO_ROOT, encoding: 'utf8' });
        const t = spawnSync(TSX_BIN, ['--eval', TS_HARNESS], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
        expect(p.status).toBe(0);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
    });
});
