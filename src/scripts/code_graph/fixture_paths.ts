/**
 * Which repository paths describe something other than the project itself:
 * test and fixture trees, benchmark corpora, documentation and examples.
 *
 * Every test is on the path RELATIVE to the scanned root, never on the root's
 * own location: a fixture repository scanned as its own root (`tests/fixtures/
 * p1-blog` → `database/migrations/…`) is a project like any other, while the
 * same files reached from the enclosing repository are its fixtures.
 */

/** A directory segment holding tests, fixtures or benchmark corpora. */
const FIXTURE_DIR = /(?:^|\/)(?:tests?|__tests__|specs?|testdata|fixtures?|__fixtures__|bench|benches|benchmarks?)\//i;
/** A directory segment holding documentation or examples. */
const DOC_DIR = /(?:^|\/)(?:docs?|examples?|samples?)\//i;
const DOC_EXT = /\.(?:md|mdx|markdown|rst|adoc)$/i;
const TEST_FILE = /\.(?:test|spec)\.[a-z]+$|_test\.go$|Tests?\.(?:java|cs|php)$/;

/** True for a file in a test, fixture or benchmark tree, or a test file by its name. */
export function isFixturePath(rel: string): boolean {
    return FIXTURE_DIR.test(rel) || TEST_FILE.test(rel);
}

/** True for documentation or an example: a doc/example tree, or a prose file anywhere. */
export function isDocOrExamplePath(rel: string): boolean {
    return DOC_DIR.test(rel) || DOC_EXT.test(rel);
}
