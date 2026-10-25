import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { spawnSync } from 'node:child_process';

import {
    evaluate,
    expectedSubjectFor,
    main as gateMain,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
import {
    GatedPathUnsupported,
    GatedRevisionUnresolved,
    GatedSubjectRefusal,
    GitUnavailable,
    subjectOf,
} from '../../src/scripts/_lib/ratification_subject.js';
import { main as subjectCli } from '../../src/scripts/ratification_subject.js';
import { commitAll, writeEmptyConsequenceClass } from './ratification_git_fixture.js';

/**
 * Step 2.6 — the subject is read from Git objects at a named revision.
 *
 * Rounds 3, 4 and 5 of the 2026-10-13 review each refused the working-tree
 * reader on a new filesystem defect, the last being a symlinked ANCESTOR
 * directory, which `O_NOFOLLOW` does not guard because it applies to the final
 * component only. Both round-5 seats named the stronger shape: hash the
 * committed objects, so the filesystem is not consulted for gated content at
 * all. Each case below names the property it pins; every one of them is red
 * against the working-tree reader this replaces.
 */

const KERNEL = 'src/rules/commit-policy.md';

let root: string;

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

function recordText(subject: string, verdict: string): string {
    return [
        '---',
        'proposed_by: claude/session-a',
        'implemented_by: claude/session-a',
        'reviewed_by: council/anthropic+openai',
        `subject: ${subject}`,
        `verdict: ${verdict}`,
        'effective_after: merge',
        'providers:',
        '  - anthropic',
        '  - openai',
        'seats:',
        `  anthropic: ${verdict}`,
        `  openai: ${verdict}`,
        '---',
        '',
        '<!-- evidence-type: ratification -->',
        '',
        'Review body.',
        '',
    ].join('\n');
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-rev-'));
    writeEmptyConsequenceClass(root); // the gate refuses a commit without the class list
});

afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the working tree cannot change the digest of a revision', () => {
    it('an uncommitted edit to a gated file does not move the digest of HEAD', () => {
        write(KERNEL, 'reviewed\n');
        commitAll(root);
        const reviewed = subjectOf(root, [KERNEL], [], 'HEAD').digest;

        write(KERNEL, 'edited after the review, never committed\n');
        expect(subjectOf(root, [KERNEL], [], 'HEAD').digest).toBe(reviewed);

        // Polarity: committing the same edit DOES move it, so the case above
        // is not green because the digest ignores content altogether.
        commitAll(root);
        expect(subjectOf(root, [KERNEL], [], 'HEAD').digest).not.toBe(reviewed);
    });

    it('a symlinked ANCESTOR directory on disk does not redirect the read', () => {
        // Round 5's finding: `O_NOFOLLOW` guards the last component only, so a
        // symlinked `src/rules` pulled bytes from outside the revision.
        write(KERNEL, 'reviewed\n');
        commitAll(root);
        const reviewed = subjectOf(root, [KERNEL], [], 'HEAD').digest;

        write('elsewhere/rules/commit-policy.md', 'bytes from outside the revision\n');
        fs.rmSync(path.join(root, 'src/rules'), { recursive: true });
        fs.symlinkSync(path.join(root, 'elsewhere/rules'), path.join(root, 'src/rules'));
        // The redirect is real on disk — reading the path now yields the
        // foreign bytes — and the digest does not see it.
        expect(fs.readFileSync(path.join(root, KERNEL), 'utf8')).toBe(
            'bytes from outside the revision\n',
        );
        expect(subjectOf(root, [KERNEL], [], 'HEAD').digest).toBe(reviewed);
    });

    it('a gated path deleted only on disk is still the committed file', () => {
        write(KERNEL, 'reviewed\n');
        commitAll(root);
        const reviewed = subjectOf(root, [KERNEL], [], 'HEAD').digest;
        fs.rmSync(path.join(root, KERNEL));
        expect(subjectOf(root, [KERNEL], [], 'HEAD').digest).toBe(reviewed);
    });

    it('a record edited on disk but not committed does not make the gate pass', () => {
        // The record is read at the revision as well. Committed `refused`,
        // rewritten to `ratified` in the working tree: the gate judges the
        // commit, so it stays red.
        write(KERNEL, 'reviewed\n');
        commitAll(root);
        const digest = expectedSubjectFor([KERNEL], root, 'HEAD').digest;
        const rel = path.join(RATIFICATION_DIR, 'r.md');
        write(rel, recordText(digest, 'refused'));
        commitAll(root);
        write(rel, recordText(digest, 'ratified'));

        expect(evaluate([KERNEL, rel], root, 2, 'HEAD').exitCode).toBe(1);

        // Polarity: committed, the same record passes.
        commitAll(root);
        expect(evaluate([KERNEL, rel], root, 2, 'HEAD').exitCode).toBe(0);
    });
});

describe('the revision is explicit and is what is hashed', () => {
    it('two commits digest differently, and a named older revision reproduces the older one', () => {
        write(KERNEL, 'first\n');
        commitAll(root);
        const first = subjectOf(root, [KERNEL], [], 'HEAD').digest;
        write(KERNEL, 'second\n');
        commitAll(root);

        expect(subjectOf(root, [KERNEL], [], 'HEAD').digest).not.toBe(first);
        expect(subjectOf(root, [KERNEL], [], 'HEAD~1').digest).toBe(first);
    });

    it('the reading names the commit it hashed', () => {
        write(KERNEL, 'first\n');
        const commit = commitAll(root);
        expect(subjectOf(root, [KERNEL], [], 'HEAD').revision).toBe(commit);
    });
});

describe('a gated path committed as a symbolic link is refused', () => {
    /**
     * The decision, recorded in the module header and the contract: a gated
     * path stored with mode 120000 is REFUSED, neither hashed as its target
     * string nor followed. Its effective content lives at another path, which
     * the gate's classifier does not see, so no digest of the link describes
     * what a reviewer would be approving.
     */
    it('subjectOf refuses with a typed refusal naming the kind', () => {
        write('outside.txt', 'x\n');
        fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
        fs.symlinkSync('../../outside.txt', path.join(root, KERNEL));
        commitAll(root);

        let caught: unknown = null;
        try {
            subjectOf(root, [KERNEL], [], 'HEAD');
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(GatedPathUnsupported);
        expect((caught as GatedPathUnsupported).kind).toBe('symbolic link');
    });

    it('the gate turns it into a refusal, not an exception', () => {
        fs.mkdirSync(path.join(root, 'src/rules'), { recursive: true });
        fs.symlinkSync('../../outside.txt', path.join(root, KERNEL));
        commitAll(root);
        const r = evaluate([KERNEL], root, 2, 'HEAD');
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('symbolic link');
    });

    it('a symbolic link on disk over a committed REGULAR file is not a link to the digest', () => {
        // Polarity: the refusal is about the committed object, not the disk.
        write(KERNEL, 'reviewed\n');
        commitAll(root);
        const reviewed = subjectOf(root, [KERNEL], [], 'HEAD').digest;
        fs.rmSync(path.join(root, KERNEL));
        fs.symlinkSync('../../outside.txt', path.join(root, KERNEL));
        expect(subjectOf(root, [KERNEL], [], 'HEAD').digest).toBe(reviewed);
    });
});

describe('git failures are typed refusals', () => {
    it('an unknown revision is GatedRevisionUnresolved', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        expect(() => subjectOf(root, [KERNEL], [], 'no-such-revision')).toThrow(
            GatedRevisionUnresolved,
        );
    });

    it('a revision that looks like an option is refused rather than passed to git', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        expect(() => subjectOf(root, [KERNEL], [], '--output=/tmp/x')).toThrow(
            GatedRevisionUnresolved,
        );
    });

    it('a root that is not a repository is GatedRevisionUnresolved', () => {
        write(KERNEL, 'x\n');
        expect(() => subjectOf(root, [KERNEL], [], 'HEAD')).toThrow(GatedRevisionUnresolved);
    });

    it('git missing from PATH is GitUnavailable', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        vi.stubEnv('PATH', '');
        expect(() => subjectOf(root, [KERNEL], [], 'HEAD')).toThrow(GitUnavailable);
    });

    it('every git refusal is a GatedSubjectRefusal, so the callers catch it', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        expect(() => subjectOf(root, [KERNEL], [], 'no-such-revision')).toThrow(
            GatedSubjectRefusal,
        );
    });

    it('an unknown revision through the CLI exits 1 with nothing on stdout', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        let out = '';
        let err = '';
        const o = vi.spyOn(process.stdout, 'write').mockImplementation((c) => {
            out += String(c);
            return true;
        });
        const e = vi.spyOn(process.stderr, 'write').mockImplementation((c) => {
            err += String(c);
            return true;
        });
        let code: number;
        try {
            code = subjectCli(['--root', root, '--rev', 'no-such-revision', '--files', KERNEL]);
        } finally {
            o.mockRestore();
            e.mockRestore();
        }
        expect(code).toBe(1);
        expect(out).toBe('');
        expect(err).toMatch(/^error: .*no-such-revision/u);
    });

    it('an unknown revision through the gate is exit 1, not an exception', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        const r = evaluate([KERNEL], root, 2, 'no-such-revision');
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('no-such-revision');
    });

    it('a root that is a subdirectory of a repository is refused, not resolved upward', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        expect(() => subjectOf(path.join(root, 'src'), [KERNEL], [], 'HEAD')).toThrow(
            GatedRevisionUnresolved,
        );
    });

    it('a programming error is not translated — a non-string revision still crashes', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        let caught: unknown = null;
        try {
            subjectOf(root, [KERNEL], [], 42 as unknown as string);
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(TypeError);
        expect(caught).not.toBeInstanceOf(GatedSubjectRefusal);
    });
});

/** Run the gate's `main()` with stdout and stderr captured. */
function runGate(argv: readonly string[]): { code: number; out: string; err: string } {
    let out = '';
    let err = '';
    const o = vi.spyOn(process.stdout, 'write').mockImplementation((c) => {
        out += String(c);
        return true;
    });
    const e = vi.spyOn(process.stderr, 'write').mockImplementation((c) => {
        err += String(c);
        return true;
    });
    try {
        return { code: gateMain(argv), out, err };
    } finally {
        o.mockRestore();
        e.mockRestore();
    }
}

describe('one gate run reads one commit (step 2.7)', () => {
    /**
     * Round 6's finding: the changed-file list was taken from the revision
     * NAME and the digest and record resolved the name again, so a ref that
     * moved between the two paired one commit's list with another commit's
     * content. A `git` wrapper on PATH advances the branch right after the
     * first git call that names it — whichever call that is — so the case is
     * red for every shape that resolves the name more than once.
     */
    it('a branch that moves after the first read does not change what the gate judges', () => {
        const realGit = spawnSync('sh', ['-c', 'command -v git'], {
            encoding: 'utf8',
        }).stdout.trim();
        write('README.md', 'base\n');
        const base = commitAll(root);
        write(KERNEL, 'reviewed\n');
        const rel = path.join(RATIFICATION_DIR, 'r.md');
        write(rel, recordText('0'.repeat(64), 'ratified'));
        commitAll(root);
        // The record answers for the reviewed commit's content.
        write(rel, recordText(expectedSubjectFor([KERNEL, rel], root, 'HEAD').digest, 'ratified'));
        const reviewed = commitAll(root);
        write(KERNEL, 'edited after the review\n');
        const later = commitAll(root);
        spawnSync(realGit, ['-C', root, 'branch', 'feature', reviewed]);

        const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-git-'));
        const mark = path.join(bin, 'moved');
        fs.writeFileSync(
            path.join(bin, 'git'),
            [
                '#!/bin/sh',
                '"$REAL_GIT" "$@"',
                'status=$?',
                'if [ ! -e "$MOVE_MARK" ]; then',
                '  for a in "$@"; do',
                '    case "$a" in',
                '      feature|feature^*|*...feature)',
                '        : > "$MOVE_MARK"',
                '        "$REAL_GIT" -C "$MOVE_REPO" update-ref refs/heads/feature "$MOVE_TO"',
                '        break;;',
                '    esac',
                '  done',
                'fi',
                'exit $status',
                '',
            ].join('\n'),
            { mode: 0o755 },
        );
        vi.stubEnv('PATH', `${bin}${path.delimiter}${process.env.PATH ?? ''}`);
        vi.stubEnv('REAL_GIT', realGit);
        vi.stubEnv('MOVE_MARK', mark);
        vi.stubEnv('MOVE_REPO', root);
        vi.stubEnv('MOVE_TO', later);

        try {
            const r = runGate([
                '--root',
                root,
                '--base-ref',
                base,
                '--rev',
                'feature',
                '--policy-root',
                process.cwd(),
            ]);
            // The move happened mid-run, so the green below is not a run in
            // which nothing moved.
            expect(fs.existsSync(mark)).toBe(true);
            const moved = spawnSync(realGit, ['-C', root, 'rev-parse', 'feature'], {
                encoding: 'utf8',
            });
            expect(moved.stdout.trim()).toBe(later);
            expect(r.out).toContain('ratified by');
            expect(r.code).toBe(0);
        } finally {
            fs.rmSync(bin, { recursive: true, force: true });
        }
    });

    it('a gated file renamed away is listed under its old path, so the gate still sees it', () => {
        // Rename detection would report only the destination, which is not
        // gated, and the removal of the kernel rule would pass unratified.
        write('README.md', 'base\n');
        write(KERNEL, 'a kernel rule long enough to be detected as renamed\n'.repeat(4));
        const base = commitAll(root);
        fs.renameSync(path.join(root, KERNEL), path.join(root, 'src/moved.md'));
        commitAll(root);
        const r = runGate(['--root', root, '--base-ref', base, '--policy-root', process.cwd()]);
        expect(r.out).toContain(KERNEL);
        expect(r.code).toBe(1);
    });

    it('`--rev` with no value is refused by the gate, not defaulted to HEAD', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        const r = runGate(['--root', root, '--files', KERNEL, '--rev']);
        expect(r.code).toBe(1);
        expect(r.err).toContain('--rev takes a value');
    });

    it('`--rev` followed by another option is refused as having no value', () => {
        write(KERNEL, 'x\n');
        commitAll(root);
        const r = runGate(['--root', root, '--rev', '--files', KERNEL]);
        expect(r.code).toBe(1);
        expect(r.err).toContain('--rev takes a value');
    });
});
