// The shared "is this a test path" predicate, and the callers that must answer
// with it. The paths below are the ones the four former copies disagreed on.
import { describe, expect, it } from 'vitest';

import { isTestPath } from '../../src/scripts/_lib/test_path.js';
import { isTestPath as adherenceIsTestPath } from '../../src/scripts/_lib/adherence_detectors.js';

const CASES: ReadonlyArray<readonly [string, boolean]> = [
    // PHP
    ['tests/Feature/LoginTest.php', true],
    ['app/Modules/X/Tests/FooTest.php', true],
    ['app/Models/User.php', false],
    // JS / TS
    ['src/foo.test.ts', true],
    ['src/foo.spec.tsx', true],
    ['src/foo-test.js', true],
    ['src/__tests__/foo.js', true],
    ['e2e/login.ts', true],
    ['src/contest.ts', false],
    // Python
    ['test_models.py', true],
    ['pkg/tests/test_api.py', true],
    ['pkg/models.py', false],
    // Go
    ['pkg/server_test.go', true],
    ['pkg/server.go', false],
    // Ruby
    ['spec/models/user_spec.rb', true],
    ['lib/user.rb', false],
    // Gherkin
    ['features/login.feature', true],
    // Windows separators
    ['src\\tests\\Foo.php', true],
];

describe('isTestPath — one answer across stacks', () => {
    it.each(CASES)('%s → %s', (p, expected) => {
        expect(isTestPath(p)).toBe(expected);
    });

    it('the adherence detectors answer with the same predicate', () => {
        expect(adherenceIsTestPath).toBe(isTestPath);
    });
});
