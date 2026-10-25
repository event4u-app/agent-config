/**
 * Whether a path holds tests, across the stacks this suite's consumers use.
 *
 * One answer for every generic detector, because four copies used to disagree:
 * `app/Modules/X/Tests/FooTest.php` was a test to two of them and
 * `spec/foo_spec.rb` to a different two. The union is the safe direction for
 * each caller — the turn-end gate allows more test edits, the adherence
 * detectors credit more tests, the tampering detector scans more files.
 *
 * `_lib/test_delta.ts` keeps its own predicate: it scopes this repository's CI
 * to `tests/` and `*.test.ts`, which is a different question.
 */
const TEST_DIR_RE = /(?:^|\/)(?:tests?|specs?|__tests__|__specs__|e2e|cypress|playwright|features)(?:\/|$)/i;
const TEST_FILE_RE = /[._-](?:test|spec)\.[a-z]+$|(?:^|\/)test_[^/]+$|Test\.php$|Spec\.php$|\.feature$/i;

export function isTestPath(p: string): boolean {
    const f = p.replace(/\\/g, '/');
    return TEST_DIR_RE.test(f) || TEST_FILE_RE.test(f);
}
