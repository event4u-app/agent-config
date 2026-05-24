import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eventKey, isoWeekOf, sessionKey, weeklyAggregateKey } from '../src/kv-keys.ts';

test('sessionKey is namespaced', () => {
    assert.equal(sessionKey('abc'), 'session:abc');
});

test('eventKey embeds stage', () => {
    assert.equal(eventKey('abc', 'started'), 'event:abc:started');
});

test('weeklyAggregateKey is namespaced', () => {
    assert.equal(weeklyAggregateKey('2026-W21'), 'funnel:weekly:2026-W21');
});

test('isoWeekOf returns ISO 8601 week token', () => {
    // 2026-05-24 is a Sunday — ISO week 21 of 2026.
    assert.equal(isoWeekOf(new Date('2026-05-24T12:00:00Z')), '2026-W21');
});

test('isoWeekOf zero-pads single-digit weeks', () => {
    assert.equal(isoWeekOf(new Date('2026-01-05T00:00:00Z')), '2026-W02');
});
