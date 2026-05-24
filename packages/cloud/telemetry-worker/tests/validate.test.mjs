// Worker validator tests. Run with `node --test`.
//
// Imports the compiled .ts via tsx/loader at test time — but to keep
// the source-only worker dependency-free, the tests import from the
// `src/` folder using a one-off `register` of the TypeScript loader.
// In CI this runs under the same `tsx` runner used by the installer.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateEvent } from '../src/validate.ts';

const baseEvent = {
    schema_version: '1',
    event: 'install_stage',
    stage: 'started',
    ts: '2026-05-24T10:00:00Z',
    entry_path: 'npx',
    host_agent_family: 'cli',
    os: 'linux',
    node_major: '20',
    agent_config_version: '0.1.0',
    wizard_used: false,
    duration_bucket: '<30s',
};

test('accepts a minimal valid event', () => {
    const result = validateEvent(baseEvent);
    assert.equal(result.ok, true);
});

test('rejects unknown fields', () => {
    const result = validateEvent({ ...baseEvent, ip: '1.2.3.4' });
    assert.equal(result.ok, false);
    assert.match(result.reason, /unknown field/);
});

test('rejects invalid stage', () => {
    const result = validateEvent({ ...baseEvent, stage: 'rogue' });
    assert.equal(result.ok, false);
});

test('rejects non-UTC timestamp', () => {
    const result = validateEvent({ ...baseEvent, ts: '2026-05-24T10:00:00+02:00' });
    assert.equal(result.ok, false);
});

test('rejects non-hex session_id', () => {
    const result = validateEvent({ ...baseEvent, session_id: 'not-a-hex-token' });
    assert.equal(result.ok, false);
});

test('accepts a 32-char hex session_id', () => {
    const result = validateEvent({
        ...baseEvent,
        session_id: 'a'.repeat(32),
    });
    assert.equal(result.ok, true);
});

test('rejects out-of-enum pack_category', () => {
    const result = validateEvent({
        ...baseEvent,
        pack_categories: ['finance', 'rogue'],
    });
    assert.equal(result.ok, false);
});

test('accepts known pack_categories', () => {
    const result = validateEvent({
        ...baseEvent,
        pack_categories: ['finance', 'engineering', 'meta'],
    });
    assert.equal(result.ok, true);
});

test('rejects schema_version other than "1"', () => {
    const result = validateEvent({ ...baseEvent, schema_version: '2' });
    assert.equal(result.ok, false);
});
