import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { createHash } from 'node:crypto';

import * as lib from '../../src/scripts/_lib/ratification_subject.js';
import {
    assertContained,
    gatedFilesOf,
    DELETED_MARKER,
    DELETED_MODE,
    GatedPathEscapes,
} from '../../src/scripts/_lib/ratification_subject.js';
import {
    classifyPaths,
    expectedSubjectFor,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { commitAll } from './ratification_git_fixture.js';

function tmpTree(files: Readonly<Record<string, string>>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-'));
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body);
    }
    commitAll(root);
    return root;
}

/**
 * The digest is read from Git objects at HEAD, so every edit a case makes to a
 * fixture is committed before the digest is taken — these cases are about what
 * a commit contains, and the working tree is covered by
 * `ratification_subject_revision.test.ts`.
 */
function subjectDigest(root: string, files: readonly string[], derived?: readonly string[]): string {
    commitAll(root);
    return lib.subjectDigest(root, files, derived);
}

function subjectOf(
    root: string,
    files: readonly string[],
    derived?: readonly string[],
): lib.SubjectReading {
    commitAll(root);
    return lib.subjectOf(root, files, derived);
}

const KERNEL = 'src/rules/commit-policy.md';
/**
 * A document the gate does not watch — the artifact contract itself.
 *
 * THIS FIXTURE MOVED AND MOVED BACK, and both moves are recorded because the
 * second was a finding. On 2026-10-12 step 4.1 put the contract on the gate's
 * reviewer list, these cases went red correctly, and the fixture was
 * re-pointed at `docs/architecture.md`. On 2026-10-13 step 4.1 was staged off
 * the branch on a council's `smaller-change` answer — and the re-pointed
 * fixture stayed, with a comment still saying the contract was gated. Both
 * seats of the next review caught it and said what it actually was: a fixture
 * kept green across a revert, documenting a reach the gate no longer has.
 *
 * So it is back, and the case below asserts the classification DIRECTLY rather
 * than only through the digest, which is what the reviewers asked for: a test
 * that says in one line whether this path is gated in THIS revision cannot
 * survive the next move of that boundary silently.
 */
const UNGATED = 'docs/contracts/ratification-artifact.md';

/**
 * A path gated ONLY through the derived plumbing closure.
 *
 * It matches no kernel-rule, governance-hook or plumbing-source name rule and
 * is not in the self set, so `classifyPaths(p, [])` returns it ungated and
 * `classifyPaths(p, derived)` returns it as plumbing. That asymmetry is what
 * makes it usable as evidence that a `derived` list actually reached the
 * classifier — which a self-gated path cannot show.
 */
const DERIVED_ONLY = 'src/scripts/hooks/host_semantics.ts';

describe('2.1 — the gated set, assembled from the gate’s own constants', () => {
    it('keeps a kernel rule and drops an ungated file', () => {
        const g = gatedFilesOf([KERNEL, UNGATED, 'README.md']);
        expect(g).toContain(KERNEL);
        expect(g).not.toContain(UNGATED);
        expect(g).not.toContain('README.md');
    });

    it('the artifact contract is NOT gated in this revision, said directly', () => {
        // The reach of the gate, asserted as a fact about this revision rather
        // than inferred from a digest that happens not to move. Step 4.1 of
        // `road-to-self-modification-that-a-council-must-pass` is what would
        // make this red, and when it lands this case is the one that says so.
        expect(classifyPaths(['docs/contracts/ratification-artifact.md']).self).toBe(false);
        expect(gatedFilesOf(['docs/contracts/ratification-artifact.md'])).toEqual([]);
        // The polarity partner, so the assertion above is not green because
        // `classifyPaths` returns false for everything.
        expect(classifyPaths(['src/scripts/check_kernel_edit_ratified.ts']).self).toBe(true);
    });

    it('keeps a self path — which `classifyPaths` reports only as a boolean', () => {
        const g = gatedFilesOf(['src/scripts/check_kernel_edit_ratified.ts', 'README.md']);
        expect(g).toEqual(['src/scripts/check_kernel_edit_ratified.ts']);
    });

    it('is sorted and deduplicated, so a caller’s order cannot change the digest', () => {
        const a = gatedFilesOf([KERNEL, 'src/config/ratification-policy.json']);
        const b = gatedFilesOf(['src/config/ratification-policy.json', KERNEL, KERNEL]);
        expect(a).toEqual(b);
        expect([...a]).toEqual([...a].sort());
    });
});

describe('2.1 — the digest binds paths AND contents', () => {
    it('is stable across repeated calls on an unchanged tree', () => {
        const root = tmpTree({ [KERNEL]: 'one\n' });
        expect(subjectDigest(root, [KERNEL])).toBe(subjectDigest(root, [KERNEL]));
    });

    it('MOVES when one byte of a gated file changes', () => {
        const root = tmpTree({ [KERNEL]: 'one\n' });
        const before = subjectDigest(root, [KERNEL]);
        fs.writeFileSync(path.join(root, KERNEL), 'onf\n');
        expect(subjectDigest(root, [KERNEL])).not.toBe(before);
    });

    it('does NOT move when an ungated file changes', () => {
        const root = tmpTree({ [KERNEL]: 'one\n', [UNGATED]: 'a\n' });
        const before = subjectDigest(root, [KERNEL, UNGATED]);
        fs.writeFileSync(path.join(root, UNGATED), 'b\n');
        expect(subjectDigest(root, [KERNEL, UNGATED])).toBe(before);
    });

    it('a deleted gated file is entered as deleted, not skipped', () => {
        const present = tmpTree({ [KERNEL]: 'one\n' });
        const absent = tmpTree({ 'README.md': 'x\n' });
        const withDeleted = subjectDigest(absent, [KERNEL]);
        // Deleting is not the same as never having been in the set …
        expect(withDeleted).not.toBe(subjectDigest(present, [KERNEL]));
        // … and not the same as an empty gated set either.
        expect(withDeleted).not.toBe(subjectDigest(absent, []));
        expect(DELETED_MARKER.length).toBeGreaterThan(0);
    });

    it('two different paths with identical content do not collide', () => {
        const a = tmpTree({ [KERNEL]: 'same\n' });
        const b = tmpTree({ 'src/rules/scope-control.md': 'same\n' });
        expect(subjectDigest(a, [KERNEL])).not.toBe(
            subjectDigest(b, ['src/rules/scope-control.md']),
        );
    });

    it('renaming a file changes the digest even with identical bytes', () => {
        const root = tmpTree({ [KERNEL]: 'same\n', 'src/rules/scope-control.md': 'same\n' });
        expect(subjectDigest(root, [KERNEL])).not.toBe(
            subjectDigest(root, ['src/rules/scope-control.md']),
        );
    });

    it('an empty gated set has a digest of its own rather than throwing', () => {
        const root = tmpTree({ 'README.md': 'x\n' });
        expect(subjectDigest(root, [])).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('a working-tree fault is not a property of the revision', () => {
    /**
     * The defect earlier review rounds pinned here was a permission error on
     * a gated path digested as a deletion. The content is now read from the
     * object store, so a working-tree permission fault cannot reach it at
     * all: the case below makes the gated file's directory unreadable after
     * the commit and the digest is unchanged. Root ignores permission bits,
     * so the case skips there rather than passing vacuously.
     */
    const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;

    it.skipIf(asRoot)('an unreadable directory on disk leaves the committed digest unchanged', () => {
        const root = tmpTree({ [KERNEL]: 'one\n' });
        const reviewed = lib.subjectDigest(root, [KERNEL]);
        const dir = path.dirname(path.join(root, KERNEL));
        fs.chmodSync(dir, 0o000);
        try {
            expect(() => fs.readdirSync(dir)).toThrow();
            expect(lib.subjectDigest(root, [KERNEL])).toBe(reviewed);
        } finally {
            fs.chmodSync(dir, 0o755);
        }
    });

    it('a genuinely absent gated file is encoded AS the deletion marker', () => {
        // The entry an absent path contributes, computed by hand from the
        // documented serialisation `path NUL mode NUL sha256hex(content) LF`.
        // Equality with it proves the absent file was entered with
        // `DELETED_MODE` and `DELETED_MARKER` rather than skipped.
        const absent = tmpTree({ 'README.md': 'x\n' });
        const entry = createHash('sha256').update(DELETED_MARKER).digest('hex');
        const expected = createHash('sha256')
            .update(`${KERNEL}\u0000${DELETED_MODE}\u0000${entry}\n`)
            .digest('hex');
        expect(subjectDigest(absent, [KERNEL])).toBe(expected);

        // And a FILE whose bytes are the marker is not a deletion: the mode
        // slot tells them apart, which the content slot alone could not.
        const literal = tmpTree({ [KERNEL]: DELETED_MARKER });
        expect(subjectDigest(literal, [KERNEL])).not.toBe(expected);
    });

    it('a file with the same bytes and a different mode digests differently', () => {
        const plain = tmpTree({ [KERNEL]: 'one\n' });
        const before = subjectDigest(plain, [KERNEL]);
        fs.chmodSync(path.join(plain, KERNEL), 0o755);
        expect(subjectDigest(plain, [KERNEL])).not.toBe(before);
    });
});

describe('the serialisation is unambiguous — a byte cannot move between path and content', () => {
    /**
     * Framing, asked for by both seats of the 2026-10-13 review.
     *
     * The encoding is `path NUL mode NUL sha256hex(content) LF`. NUL cannot
     * occur in a Git path, the mode is six octal digits and the content slot
     * is a fixed 64 hex characters, so no (path, content) pair can be re-cut into another one.
     * The two cases below demonstrate that on the shapes this gate can
     * actually be handed: the slugs are a CLOSED set of nine, so a
     * prefix-pair of gated paths cannot be constructed at all, and saying so
     * is more honest than a contrived fixture that proves a different gate.
     */
    const OTHER = 'src/rules/scope-control.md';

    it('content cannot be re-attributed from one gated path to another', () => {
        const a = tmpTree({ [KERNEL]: 'x\n', [OTHER]: 'y\n' });
        const b = tmpTree({ [KERNEL]: 'y\n', [OTHER]: 'x\n' });
        expect(subjectDigest(a, [KERNEL, OTHER])).not.toBe(subjectDigest(b, [KERNEL, OTHER]));
    });

    it('two gated files are not the concatenation of one', () => {
        const two = tmpTree({ [KERNEL]: 'x\n', [OTHER]: 'y\n' });
        const one = tmpTree({ [KERNEL]: 'x\ny\n' });
        expect(subjectDigest(two, [KERNEL, OTHER])).not.toBe(subjectDigest(one, [KERNEL]));
    });
});

describe('a path the caller supplies cannot escape the tree', () => {
    /**
     * Question 9 of the modification review, answered by a measurement rather
     * than by a claim — and the measurement found a hole rather than
     * confirming its absence.
     *
     * The gate's `KERNEL_RULE_PATH_RE` is `(?:^|\/)rules\/([a-z0-9-]+)\.md$`,
     * unanchored at the start, so `../../elsewhere/rules/commit-policy.md`
     * classifies as a kernel rule. Harmless while the gate read only names;
     * not harmless once the content binding looks those names up — no tree
     * entry can carry one, so it would be digested as a deletion. The digest
     * refuses such a path, and refuses rather than dropping it, so its
     * coverage never falls short of what the gate gated.
     */
    it('a traversing gated path is refused, not read', () => {
        expect(() => gatedFilesOf(['../../elsewhere/rules/commit-policy.md'])).toThrow(
            GatedPathEscapes,
        );
        expect(() => gatedFilesOf(['/elsewhere/rules/commit-policy.md'])).toThrow(
            GatedPathEscapes,
        );
        expect(() => gatedFilesOf(['src/rules/../rules/commit-policy.md'])).toThrow(
            GatedPathEscapes,
        );
    });

    it('the bound holds on its own input, under either separator and any absolute shape', () => {
        // `gatedFilesOf` normalises backslashes to `/` before this check, so through it
        // a backslash `..` is already caught; these cases call the bound
        // directly so that it is the bound, not the normalisation, that holds.
        for (const rel of [
            '..\\..\\elsewhere\\rules\\commit-policy.md',
            'src\\rules\\..\\..\\x.md',
            '\\\\server\\share\\rules\\commit-policy.md',
            '//server/share/rules/commit-policy.md',
            '\\rules\\commit-policy.md',
            'C:\\rules\\commit-policy.md',
            'C:rules/commit-policy.md',
        ]) {
            expect(() => assertContained(rel), rel).toThrow(GatedPathEscapes);
        }
    });

    it('the bound does not refuse a name that merely contains dots or a colon later on', () => {
        // Polarity: a bound that refused every `.` or `:` would satisfy the
        // case above and red ordinary paths.
        for (const rel of [KERNEL, 'src/rules/..md', 'src/rules/a..b.md', 'src/x:y/rules/a.md']) {
            expect(() => assertContained(rel), rel).not.toThrow();
        }
    });

    it('a path that is not gated at all is simply dropped, not refused', () => {
        // Polarity, in the direction that matters: the refusal above must fire
        // on gated traversal only. A `..` in an ungated path is noise in the
        // diff, and turning it into a red would red every PR that renames a
        // file through a relative path.
        expect(gatedFilesOf(['../../etc/passwd', '/etc/passwd', 'README.md'])).toEqual([]);
        expect(gatedFilesOf([KERNEL])).toEqual([KERNEL]);
    });
});

describe('the covered list and the digest come from one classification', () => {
    it('every file the reading names moves the digest, and nothing else does', () => {
        const root = tmpTree({ [KERNEL]: 'one\n', [UNGATED]: 'a\n', 'README.md': 'r\n' });
        const reading = subjectOf(root, [KERNEL, UNGATED, 'README.md']);
        expect(reading.gatedFiles).toEqual([KERNEL]);

        for (const rel of reading.gatedFiles) {
            const before = subjectOf(root, [KERNEL, UNGATED, 'README.md']).digest;
            fs.writeFileSync(path.join(root, rel), 'moved\n');
            expect(subjectOf(root, [KERNEL, UNGATED, 'README.md']).digest).not.toBe(before);
        }
        const steady = subjectOf(root, [KERNEL, UNGATED, 'README.md']).digest;
        fs.writeFileSync(path.join(root, UNGATED), 'b\n');
        fs.writeFileSync(path.join(root, 'README.md'), 's\n');
        expect(subjectOf(root, [KERNEL, UNGATED, 'README.md']).digest).toBe(steady);
    });

    it('the gate hands the CLI the same two halves it judges with', () => {
        // The divergence the review found was the CLI classifying a second
        // time with a different `derived` input. There is one call now, and
        // this is what pins it: the list and the digest are one object.
        //
        // THE FIXTURE IS DERIVED-ONLY, on a 2026-10-13 finding. This case used
        // to name the gate's own script, which is gated through the SELF set
        // and would therefore stay green even if `derived` were dropped from
        // the call again — the exact regression the case exists to catch.
        // `host_semantics.ts` is in the plumbing closure and matches no
        // name-based rule, so it is gated if and only if the derived list
        // reached the classifier.
        // An explicit base: this checkout is the gate's own tree, whose base
        // side is read at a ref, and a shallow CI clone carries no `origin/main`.
        const reading = expectedSubjectFor([DERIVED_ONLY, 'README.md'], process.cwd(), 'HEAD', 'HEAD');
        expect(reading.gatedFiles).toEqual([DERIVED_ONLY]);
        expect(reading.digest).toMatch(/^[0-9a-f]{64}$/);

        // The half that makes the fixture load-bearing: with no derived list
        // the same path is not gated at all.
        expect(gatedFilesOf([DERIVED_ONLY], [])).toEqual([]);
    });
});

describe('the import cycle stays survivable, and a regression reds here', () => {
    it('the gated set resolves when THIS module is the entry point', async () => {
        // A council reviewer named the cycle fragile: the gate imports
        // `subjectDigest` and this module imports the gate's path constants, so
        // whichever Node evaluates second sees the other half-evaluated, and a
        // module-scope read of those `const`s throws on the temporal dead zone.
        // The mitigation is a read deferred to call time, and "a comment
        // explains why" is not a control — this case is.
        //
        // The import below is deliberately dynamic and deliberately FIRST: it
        // makes this module the entry point of the cycle, which is the order
        // that breaks if the deferral is ever removed.
        const mod = await import('../../src/scripts/_lib/ratification_subject.js');
        expect(() => mod.gatedFilesOf([KERNEL])).not.toThrow();
        expect([...mod.gatedFilesOf([KERNEL])]).toContain(KERNEL);

        // And the self surface resolves through it, which is the half that
        // reads the gate's binding rather than its own constants.
        expect([...mod.gatedFilesOf(['src/scripts/check_kernel_edit_ratified.ts'])]).toContain(
            'src/scripts/check_kernel_edit_ratified.ts',
        );
    });
});
