import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    gatedFilesOf,
    readGatedFile,
    readGatedLink,
    subjectDigest,
    subjectOf,
    DELETED_MARKER,
    GatedFileUnreadable,
    GatedPathEscapes,
} from '../../src/scripts/_lib/ratification_subject.js';
import {
    classifyPaths,
    expectedSubjectFor,
} from '../../src/scripts/check_kernel_edit_ratified.js';

function tmpTree(files: Readonly<Record<string, string>>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-'));
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body);
    }
    return root;
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

describe('a gated file that cannot be read is not a gated file that was deleted', () => {
    /**
     * The defect this pins, named by both seats of the 2026-10-13 review.
     *
     * `catch { stat = null; }` turned EVERY `lstat` failure into the deletion
     * marker, so a permission error on a gated path produced the digest of a
     * tree in which that path had been removed — and anyone able to provoke
     * such an error could force a gated file's real content out of the digest.
     * It is the same fail-open shape a previous round of this review already
     * refused once, in a different function.
     *
     * The parent directory is what loses its mode, not the file: `lstat` reads
     * the parent's entry, so a mode-000 FILE still stats fine. Root ignores
     * permission bits entirely, so the case skips there rather than passing
     * vacuously.
     */
    const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;

    it.skipIf(asRoot)('throws rather than hashing it as absent', () => {
        const root = tmpTree({ [KERNEL]: 'one\n' });
        const dir = path.dirname(path.join(root, KERNEL));
        const deletedDigest = subjectDigest(tmpTree({ 'README.md': 'x\n' }), [KERNEL]);
        fs.chmodSync(dir, 0o000);
        try {
            expect(() => subjectDigest(root, [KERNEL])).toThrow(GatedFileUnreadable);
            // And specifically NOT the deletion digest, which is the outcome
            // the old shape produced silently.
            let produced: string | null = null;
            try {
                produced = subjectDigest(root, [KERNEL]);
            } catch {
                produced = null;
            }
            expect(produced).not.toBe(deletedDigest);
        } finally {
            fs.chmodSync(dir, 0o755);
        }
    });

    it('a genuinely absent gated file is encoded AS the deletion marker', () => {
        // The polarity partner: failing closed on EACCES must not make ENOENT
        // throw too, or every ordinary deletion would red the gate.
        //
        // STRENGTHENED on a 2026-10-13 finding. This case used to assert only
        // that nothing threw and that the constant contains the word
        // "deleted" — neither of which says the absent file was entered with
        // `DELETED_MARKER` rather than skipped, which is the property step 2.1
        // actually claims. It is provable without reaching inside the hash: a
        // tree whose gated file CONTAINS exactly those bytes must produce the
        // same digest as a tree where the file is missing, because the loop
        // hashes `Buffer.from(DELETED_MARKER)` in the absent case.
        const absent = tmpTree({ 'README.md': 'x\n' });
        expect(() => subjectDigest(absent, [KERNEL])).not.toThrow();

        const literal = tmpTree({ [KERNEL]: DELETED_MARKER });
        expect(subjectDigest(absent, [KERNEL])).toBe(subjectDigest(literal, [KERNEL]));

        // And it is that marker specifically, not any placeholder: a file
        // holding a different string digests differently.
        const other = tmpTree({ [KERNEL]: '\u0000removed\u0000' });
        expect(subjectDigest(absent, [KERNEL])).not.toBe(subjectDigest(other, [KERNEL]));
    });
});

describe('the serialisation is unambiguous — a byte cannot move between path and content', () => {
    /**
     * Framing, asked for by both seats of the 2026-10-13 review.
     *
     * The encoding is `path NUL sha256hex(content) LF`. NUL cannot occur in a
     * path on any supported filesystem and the content slot is a fixed 64 hex
     * characters, so no (path, content) pair can be re-cut into another one.
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
     * not harmless once the content binding joins those names to a root and
     * reads the bytes. The digest now refuses such a path instead of reading
     * it, and refuses rather than dropping it, so its coverage never falls
     * short of what the gate gated.
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
        const reading = expectedSubjectFor([DERIVED_ONLY, 'README.md'], process.cwd());
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

describe('a failure AFTER the stat is a refusal, not a raw Node error', () => {
    /**
     * Step 2.3, and the half round 2 of the 2026-10-13 review named:
     *
     * > "the `readFileSync(abs)` and `readlinkSync(abs)` calls ... are not
     * > wrapped, so a permission change or I/O error after the stat escapes as
     * > a raw Node error — exactly the TOCTOU window the fail-closed lstat was
     * > meant to close."
     *
     * The `lstat` above decides which of three things a gated path is. Every
     * one of those three branches then touches the filesystem a SECOND time,
     * and until this change the second touch had no translation at all.
     */
    const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;

    it.skipIf(asRoot)('an unreadable FILE whose stat succeeded is a typed refusal', () => {
        // The file loses its mode, not the directory — so `lstat` succeeds
        // (it reads the parent's entry) and the READ is what fails. That is
        // the post-stat window, reached deterministically.
        const root = tmpTree({ [KERNEL]: 'one\n' });
        const abs = path.join(root, KERNEL);
        fs.chmodSync(abs, 0o000);
        try {
            expect(() => fs.lstatSync(abs)).not.toThrow();
            expect(() => subjectDigest(root, [KERNEL])).toThrow(GatedFileUnreadable);
            // And it carries the errno rather than flattening it, so the
            // refusal says WHICH filesystem fact stopped it.
            try {
                subjectDigest(root, [KERNEL]);
                expect.unreachable('the digest must refuse an unreadable gated file');
            } catch (err) {
                expect(err).toBeInstanceOf(GatedFileUnreadable);
                expect((err as GatedFileUnreadable).errno.code).toBe('EACCES');
            }
        } finally {
            fs.chmodSync(abs, 0o644);
        }
    });

    it('the happy path still returns the bytes — the wrapper swallows nothing', () => {
        // Polarity for the two clauses above: a translation that also ate
        // successful reads would make every case in this file green for the
        // wrong reason.
        const root = tmpTree({ [KERNEL]: 'one\n' });
        expect(readGatedFile(KERNEL, path.join(root, KERNEL)).toString()).toBe('one\n');
    });
});

describe('the symlink-swap question, answered by measurement', () => {
    /**
     * One seat of the 2026-10-13 round named a path-substitution race between
     * the stat and the read and asked whether resisting it is inside this
     * gate's threat model. These two cases are the answer, each measured
     * rather than asserted in a comment.
     *
     * The race cannot be staged single-threaded, so what is measured is the
     * MECHANISM each branch relies on — which is the only honest thing a
     * deterministic suite can prove about a race, and strictly more than the
     * comment it replaces.
     */
    it('a read refuses a symlink rather than following it — the O_NOFOLLOW half', () => {
        // The dangerous direction: a path that `lstat` called a regular file
        // and that is a SYMLINK by the time the read happens. A plain
        // `readFileSync` dereferences and pulls bytes from outside the
        // revision into the digest. `readGatedFile` opens with `O_NOFOLLOW`,
        // so the swap becomes ELOOP and then a refusal.
        const root = tmpTree({ 'outside.txt': 'bytes from elsewhere\n' });
        const link = path.join(root, 'src/rules/linked.md');
        fs.mkdirSync(path.dirname(link), { recursive: true });
        fs.symlinkSync(path.join(root, 'outside.txt'), link);

        expect(() => readGatedFile('src/rules/linked.md', link)).toThrow(GatedFileUnreadable);
        // Specifically: it did NOT return the target's bytes. Asserting the
        // throw alone would stay green if the refusal came from somewhere else.
        let produced: string | null = null;
        try {
            produced = readGatedFile('src/rules/linked.md', link).toString();
        } catch {
            produced = null;
        }
        expect(produced).not.toBe('bytes from elsewhere\n');
    });

    it('a link replaced by a regular file is EINVAL, and EINVAL is a refusal', () => {
        // The other direction, and the one the seat asked about by name: the
        // path was a symlink at the stat, so the loop calls `readlinkSync` —
        // and a swap to a regular file makes that call fail. It is a typed
        // refusal now rather than a raw Node error out of `evaluate()`.
        //
        // A swap of the link's TARGET is not a leak at all: the digest records
        // the target STRING and never dereferences it, so the worst such a
        // swap can do is move the digest, which reds the gate. Both directions
        // therefore fail closed.
        const root = tmpTree({ [KERNEL]: 'one\n' });
        expect(() => readGatedLink(KERNEL, path.join(root, KERNEL))).toThrow(GatedFileUnreadable);

        // Polarity: on an actual link it returns the target string, so the
        // clause above is not green because the helper always throws.
        const link = path.join(root, 'src/rules/linked.md');
        fs.symlinkSync('../../elsewhere', link);
        expect(readGatedLink('src/rules/linked.md', link)).toBe('../../elsewhere');
    });
});
