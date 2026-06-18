// TypeScript twin of tests/conformance/retrieval/test_fixtures.py +
// tests/conformance/retrieval/validator.py (ADR-200 py2ts).
//
// Conformance: every shipped fixture validates against the v1 envelope.
//
// The Python validator lives test-side (no `src/` twin) and IS the spec, so
// the hand-written shape validator is ported inline here — a faithful 1:1 of
// `validator.py`, mirroring `internal/schemas/retrieval-v1.schema.json` with
// zero third-party runtime dependency. The fixtures and schema are unchanged.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Ported validator (validator.py 1:1).
// ---------------------------------------------------------------------------

const _SLICE_STATUSES = new Set(['ok', 'timeout', 'unknown_type', 'misconfigured', 'internal']);
const _ERROR_CODES = new Set(['timeout', 'unknown_type', 'misconfigured', 'internal']);
const _ENVELOPE_STATUSES = new Set(['ok', 'partial', 'error']);
const _HEALTH_STATUSES = new Set(['ok', 'degraded', 'error']);
const _DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+\-]\d{2}:\d{2})$/;

/** Raised with a dotted `.path` showing where the envelope failed. */
class ValidationError extends Error {}

function _fail(p: string, msg: string): never {
    throw new ValidationError(`${p}: ${msg}`);
}

function _isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _repr(v: unknown): string {
    // Python `!r` for str → 'value'; for others → str(). Good-enough parity for
    // the assertions below (which match on substrings, not exact repr).
    if (typeof v === 'string') return `'${v}'`;
    return String(v);
}

function _require(payload: Record<string, unknown>, p: string, ...keys: string[]): void {
    for (const k of keys) {
        if (!(k in payload)) _fail(p, `missing required key \`${k}\``);
    }
}

function _noExtras(payload: Record<string, unknown>, p: string, ...allowed: string[]): void {
    const allow = new Set(allowed);
    const extra = Object.keys(payload).filter((k) => !allow.has(k)).sort();
    if (extra.length > 0) _fail(p, `unexpected keys ${JSON.stringify(extra)}`);
}

function _entry(entry: unknown, p: string): void {
    if (!_isObject(entry)) _fail(p, 'entry must be object');
    const e = entry as Record<string, unknown>;
    _require(e, p, 'id', 'type', 'source', 'confidence', 'body');
    _noExtras(e, p, 'id', 'type', 'source', 'confidence', 'body', 'last_validated');
    if (typeof e['id'] !== 'string' || !e['id']) _fail(`${p}.id`, 'must be non-empty string');
    if (typeof e['type'] !== 'string' || !e['type']) _fail(`${p}.type`, 'must be non-empty string');
    if (e['source'] !== 'repo') _fail(`${p}.source`, `got ${_repr(e['source'])}`);
    const conf = e['confidence'];
    if (typeof conf !== 'number' || !(conf >= 0 && conf <= 1)) {
        _fail(`${p}.confidence`, `must be in [0,1], got ${_repr(conf)}`);
    }
    if (!_isObject(e['body'])) _fail(`${p}.body`, 'must be object');
    if ('last_validated' in e) {
        const lv = e['last_validated'];
        if (typeof lv !== 'string' || !_DT_RE.test(lv)) {
            _fail(`${p}.last_validated`, `must be RFC3339, got ${_repr(lv)}`);
        }
    }
}

function _sliceStatus(slc: unknown, p: string): void {
    if (!_isObject(slc)) _fail(p, 'slice must be object');
    const s = slc as Record<string, unknown>;
    _require(s, p, 'status', 'count');
    _noExtras(s, p, 'status', 'count');
    if (typeof s['status'] !== 'string' || !_SLICE_STATUSES.has(s['status'])) {
        _fail(`${p}.status`, `got ${_repr(s['status'])}`);
    }
    if (typeof s['count'] !== 'number' || !Number.isInteger(s['count']) || s['count'] < 0) {
        _fail(`${p}.count`, `must be non-negative int, got ${_repr(s['count'])}`);
    }
}

function _error(err: unknown, p: string): void {
    if (!_isObject(err)) _fail(p, 'error must be object');
    const e = err as Record<string, unknown>;
    _require(e, p, 'type', 'code', 'message');
    _noExtras(e, p, 'type', 'code', 'message');
    if (typeof e['type'] !== 'string' || !e['type']) _fail(`${p}.type`, 'must be non-empty string');
    if (typeof e['code'] !== 'string' || !_ERROR_CODES.has(e['code'])) {
        _fail(`${p}.code`, `got ${_repr(e['code'])}`);
    }
    if (typeof e['message'] !== 'string') _fail(`${p}.message`, 'must be string');
}

/** Validate a `retrieve()` response envelope against v1. */
function validateRetrieve(envelope: unknown): void {
    if (!_isObject(envelope)) _fail('$', 'envelope must be object');
    const env = envelope as Record<string, unknown>;
    _require(env, '$', 'contract_version', 'status', 'entries', 'slices');
    _noExtras(env, '$', 'contract_version', 'status', 'entries', 'slices', 'errors');
    if (env['contract_version'] !== 1) {
        _fail('$.contract_version', `expected 1, got ${_repr(env['contract_version'])}`);
    }
    if (typeof env['status'] !== 'string' || !_ENVELOPE_STATUSES.has(env['status'])) {
        _fail('$.status', `got ${_repr(env['status'])}`);
    }
    if (!Array.isArray(env['entries'])) _fail('$.entries', 'must be array');
    (env['entries'] as unknown[]).forEach((e, i) => _entry(e, `$.entries[${i}]`));
    if (!_isObject(env['slices'])) _fail('$.slices', 'must be object');
    for (const [name, slc] of Object.entries(env['slices'] as Record<string, unknown>)) {
        _sliceStatus(slc, `$.slices['${name}']`);
    }
    const errors = (env['errors'] as unknown[] | undefined) ?? [];
    errors.forEach((err, i) => _error(err, `$.errors[${i}]`));
}

/** Validate a `health()` response envelope against v1. */
function validateHealth(envelope: unknown): void {
    if (!_isObject(envelope)) _fail('$', 'health envelope must be object');
    const env = envelope as Record<string, unknown>;
    _require(env, '$', 'contract_version', 'status', 'backend_version', 'features');
    _noExtras(env, '$', 'contract_version', 'status', 'backend_version', 'features');
    if (env['contract_version'] !== 1) {
        _fail('$.contract_version', `expected 1, got ${_repr(env['contract_version'])}`);
    }
    if (typeof env['status'] !== 'string' || !_HEALTH_STATUSES.has(env['status'])) {
        _fail('$.status', `got ${_repr(env['status'])}`);
    }
    if (typeof env['backend_version'] !== 'string' || !env['backend_version']) {
        _fail('$.backend_version', 'must be non-empty string');
    }
    const feats = env['features'];
    if (!Array.isArray(feats) || new Set(feats).size !== feats.length) {
        _fail('$.features', 'must be unique string array');
    }
    (feats as unknown[]).forEach((f, i) => {
        if (typeof f !== 'string' || !f) _fail(`$.features[${i}]`, 'must be non-empty string');
    });
}

// ---------------------------------------------------------------------------
// Conformance suite (test_fixtures.py 1:1).
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
// test_fixtures.py: parents[2] / "fixtures" / "retrieval"
// (tests/conformance/retrieval → tests → fixtures/retrieval).
const FIXTURES_DIR = path.resolve(HERE, '..', '..', 'fixtures', 'retrieval');

const RETRIEVE_FIXTURES = [
    '01-empty.json',
    '02-single-type-hit.json',
    '03-multi-type-partial.json',
    '04-error-all-slices.json',
];
const HEALTH_FIXTURES = ['06-health-ok.json'];

function _load(name: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8'));
}

describe('retrieval v1 conformance', () => {
    it.each(RETRIEVE_FIXTURES)('retrieve fixture %s passes validation', (name) => {
        expect(() => validateRetrieve(_load(name))).not.toThrow();
    });

    it.each(HEALTH_FIXTURES)('health fixture %s passes validation', (name) => {
        expect(() => validateHealth(_load(name))).not.toThrow();
    });

    it('envelope status matches slice outcomes', () => {
        // every slice ok → envelope `ok`; every slice failed → `error`;
        // mix of ok + failed → `partial`.
        for (const name of RETRIEVE_FIXTURES) {
            const env = _load(name);
            const slices = env['slices'] as Record<string, { status: string }>;
            const vals = Object.values(slices);
            const oks = vals.filter((s) => s.status === 'ok');
            const fails = vals.filter((s) => s.status !== 'ok');
            const expected = fails.length === 0 ? 'ok' : oks.length === 0 ? 'error' : 'partial';
            expect(env['status'], `${name}: envelope status mismatch`).toBe(expected);
        }
    });

    it('every fixture on disk is wired to a test', () => {
        // Guards against a fixture file landing without being wired to a test.
        const shipped = new Set(
            fs
                .readdirSync(FIXTURES_DIR)
                .filter((n) => fs.statSync(path.join(FIXTURES_DIR, n)).isFile() && n.endsWith('.json')),
        );
        const declared = new Set([...RETRIEVE_FIXTURES, ...HEALTH_FIXTURES]);
        const missing = [...shipped].filter((n) => !declared.has(n)).sort();
        expect(missing, `fixture(s) on disk but not covered by a test: ${JSON.stringify(missing)}`).toEqual([]);
    });

    it('shadowed_by is non-null only for an operational source', () => {
        // Repo entries never get `shadowed_by` set — only operational losers do.
        for (const name of RETRIEVE_FIXTURES) {
            const env = _load(name);
            (env['entries'] as Record<string, unknown>[]).forEach((e, i) => {
                if (e['shadowed_by']) {
                    expect(e['source'], `${name} entry[${i}] id=${e['id']}: shadowed_by set`).toBe(
                        'operational',
                    );
                }
            });
        }
    });

    // ---- 5 rejection cases — validator actually catches drift ----

    it('rejects an unknown top-level key', () => {
        const env = _load('01-empty.json');
        env['unexpected_field'] = 'drift';
        let msg = '';
        expect(() => {
            try {
                validateRetrieve(env);
            } catch (err) {
                msg = (err as Error).message;
                throw err;
            }
        }).toThrow(ValidationError);
        expect(msg.includes('unexpected_field') || msg.includes('unexpected keys')).toBe(true);
    });

    it('rejects a wrong contract version', () => {
        const env = _load('01-empty.json');
        env['contract_version'] = 2;
        let msg = '';
        expect(() => {
            try {
                validateRetrieve(env);
            } catch (err) {
                msg = (err as Error).message;
                throw err;
            }
        }).toThrow(ValidationError);
        expect(msg).toContain('contract_version');
    });

    it('rejects confidence out of range', () => {
        const env = _load('02-single-type-hit.json');
        (env['entries'] as Record<string, unknown>[])[0]!['confidence'] = 1.5;
        let msg = '';
        expect(() => {
            try {
                validateRetrieve(env);
            } catch (err) {
                msg = (err as Error).message;
                throw err;
            }
        }).toThrow(ValidationError);
        expect(msg).toContain('confidence');
    });

    it('rejects an operational source', () => {
        const env = _load('02-single-type-hit.json');
        (env['entries'] as Record<string, unknown>[])[0]!['source'] = 'operational';
        let msg = '';
        expect(() => {
            try {
                validateRetrieve(env);
            } catch (err) {
                msg = (err as Error).message;
                throw err;
            }
        }).toThrow(ValidationError);
        expect(msg).toContain('source');
    });

    // 5th rejection: health envelope rejects a duplicate feature (the
    // unique-string-array guard) — exercises the `validateHealth` failure path
    // that the happy-path health fixture cannot.
    it('health rejects a non-unique feature array', () => {
        const env = _load('06-health-ok.json');
        env['features'] = ['file-fallback', 'file-fallback'];
        let msg = '';
        expect(() => {
            try {
                validateHealth(env);
            } catch (err) {
                msg = (err as Error).message;
                throw err;
            }
        }).toThrow(ValidationError);
        expect(msg).toContain('features');
    });
});
