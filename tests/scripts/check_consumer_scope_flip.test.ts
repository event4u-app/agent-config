import { strict as assert } from 'node:assert';
import { test } from 'vitest';

import {
    is_exclusively_maintainer,
    verify_flip,
} from '../../src/scripts/check_consumer_scope_flip.js';

test('is_exclusively_maintainer: only the single-maintainer tag qualifies', () => {
    assert.equal(is_exclusively_maintainer(['agent-config-maintainer']), true);
    assert.equal(is_exclusively_maintainer(['agent-config-maintainer', 'engineering']), false);
    assert.equal(is_exclusively_maintainer(['engineering']), false);
    assert.equal(is_exclusively_maintainer([]), false);
});

test('verify_flip on the real tree: flip verified, only maintainer rules drop', () => {
    const v = verify_flip();
    assert.equal(v.pass, true, `violations: ${v.violations.join(' · ')} golden-dropped: ${v.golden_rules_dropped.join(' · ')}`);
    assert.equal(v.violations.length, 0);
    assert.equal(v.golden_rules_dropped.length, 0);
    // The audited lever (incl. the source-of-truth compat exclusion). Was 16 until
    // ADR-201 made telegraph-speak dormant by default: it no longer projects into
    // dist/agent-src/rules at all, so it cannot appear in a set of rules that DROP
    // under a consumer scope flip. A consumer never sees it either way — which is
    // the point of dormancy — so 15 is the correct count, not a lost exclusion.
    assert.equal(v.excluded.length, 15);
    assert.ok(v.excluded.includes('source-of-truth.md'));
    // safety floors must survive the default scope
    for (const floor of ['finance-safety-floor.md', 'legal-safety-floor.md', 'strategy-safety-floor.md']) {
        assert.ok(!v.excluded.includes(floor), `${floor} must ship under the default scope`);
    }
});
