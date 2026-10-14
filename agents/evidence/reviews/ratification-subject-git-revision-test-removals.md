# Test removals: the ratification subject moves to Git objects

<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-14 -->

**Who wrote this, and what it is not.** This is the implementer's own account
of the tests removed when the ratification subject stopped reading the working
tree. It is not an independent verdict. The independent pass over the same
diff is round 6 of the modification review, whose question lists every removal
below in its scope; its verdict is recorded in
`agents/evidence/ratifications/drain-self-modification-narrowed-20261013.md`.

## Why tests were removed at all

Rounds 3, 4 and 5 of that review each refused the working-tree reader on a new
filesystem defect. The subject is now computed from Git objects at an explicit
revision (`git ls-tree` + `git cat-file`), so the functions those tests drove —
`readGatedFile`, `readGatedLink`, `asErrno`, the `O_NOFOLLOW` / `O_NONBLOCK`
open flags, the `lstat` kind check — no longer exist. A test of a deleted
function cannot be kept; the question for each is whether the PROPERTY it
pinned is still pinned, gone because its threat left the surface, or lost.

Measured against `origin/main` the net change is not a weakening —
`check_test_weakening` reports "8 test file(s), no net weakening" — because the
removed cases were all added on this branch. They are listed anyway, because a
reviewer of round 5 saw them.

## Every removal, with its disposition

| Removed | Property it pinned | Disposition |
|---|---|---|
| `tests/scripts/ratification_subject_fs_faults.test.ts` (whole file: close failures, read-then-close ordering, `lstat` programming error, `O_NOFOLLOW`/`O_NONBLOCK` flag presence and absence, FIFO trapped before open, non-regular `fstat`) | the working-tree reader fails closed on every OS fault and never blocks | **gone with its threat.** No file descriptor is opened on a gated path; the content comes from `git cat-file`, whose failure is one typed refusal (`GitReadFailed`) |
| `ratification_subject.test.ts` — "throws rather than hashing it as absent" (parent directory mode 000) | an unreadable gated path is not a deletion | **replaced** by "an unreadable directory on disk leaves the committed digest unchanged": a working-tree permission fault cannot reach the digest at all |
| `ratification_subject.test.ts` — "an unreadable FILE whose stat succeeded is a typed refusal", "the happy path still returns the bytes" | post-`lstat` read failures are refusals | **gone with its threat**; the happy path is covered by every digest case |
| `ratification_subject.test.ts` — the symlink-swap describe (`O_NOFOLLOW` refuses a link, `EINVAL` on a link swapped to a file) | a race between `lstat` and read cannot pull foreign bytes | **replaced** by `ratification_subject_revision.test.ts`: a symlinked ancestor, a symlink over a committed file and a deletion on disk all leave the digest of `HEAD` unchanged |
| `ratification_subject.test.ts` — the three `asErrno` / `ERR_INVALID_ARG_TYPE` cases | a Node programming error is not translated into a refusal | **replaced** by "a programming error is not translated — a non-string revision still crashes" |
| `ratification_subject.test.ts` — the absent-file case's equality with a file holding `DELETED_MARKER` | a deletion is entered with the marker | **strengthened**: the case now computes the expected entry by hand from the documented serialisation, and asserts a file holding the marker bytes is NOT a deletion (the mode slot separates them) |
| `ratification_subject_binding.test.ts` — "the digest follows the LINK", "a BROKEN link is a link", "a regular file whose bytes equal a link target" | a gated symlink was hashed as its target string | **reversed by decision D13**: a gated path committed as a symlink is now refused; pinned by three cases in the revision suite |
| `check_kernel_edit_ratified_subject.test.ts` — "a read that fails AFTER the stat is a refusal" | `evaluate()` turns a post-stat read failure into a refusal | **gone with its threat**; the one catch boundary it proved is still pinned by the escape, directory and unknown-revision cases |
| `ratification_subject_cli.test.ts` — "an unreadable gated file exits 1" | the CLI refusal path on `EACCES` | **replaced** by "an unknown revision through the CLI exits 1 with nothing on stdout" |

Nothing in the table is a property that was pinned before and is unpinned now
while its threat still exists. If round 6 names one, this table is wrong and
the record says so.
