/**
 * Which branch a git report says was PUSHED — read only inside a `To <remote>`
 * section.
 *
 * `git push` prints `To <url>` before its ref table; `git fetch` and `git pull`
 * print `From <url>` before theirs, and both tables use the same
 * `a..b  local -> remote` line. `push_settle_hook.pushedBranch` matches that
 * line anywhere, so a fetch that moved `origin/main` reads as a push of
 * `origin/main`, fires the settle reminder and writes a merge marker for a push
 * that never happened.
 *
 * NOT WIRED: no hook imports this module. Swapping it into `push_settle_hook.ts`
 * grows the live hook bundle, whose byte ceiling has no headroom for it.
 */

/** The same ref-advance shapes `push_settle_hook` reads. */
const REF_ADVANCED = /(?:\[new branch\]|\[new tag\]|[0-9a-f]{7,}\.\.[0-9a-f]{7,})\s+(\S+)\s+->\s+(\S+)/;

/** A ref git refused. Its `->` must never be read as an advance. */
const REJECTED = /^\s*!\s*\[(?:rejected|remote rejected)\]/;

/** `To <remote>` opens a push table; `From <remote>` opens a fetch table. */
const SECTION_HEADER = /^(To|From) \S/;

/** The lines of every `To <remote>` section, each up to the next header. */
export function pushSections(output: string): string[][] {
    const sections: string[][] = [];
    let current: string[] | null = null;
    for (const line of output.split(/\r?\n/)) {
        const header = SECTION_HEADER.exec(line);
        if (header !== null) {
            current = header[1] === 'To' ? [] : null;
            if (current !== null) sections.push(current);
            continue;
        }
        if (current !== null) current.push(line);
    }
    return sections;
}

/**
 * The remote branch of the first advanced ref in a push section, without a
 * `refs/heads/` prefix; null when no push section advanced a ref, or when the
 * push section that holds it also reports a rejection.
 */
export function pushedBranchFromReport(output: string): string | null {
    for (const section of pushSections(output)) {
        if (section.some((l) => REJECTED.test(l))) continue;
        for (const line of section) {
            const m = REF_ADVANCED.exec(line);
            const remote = m?.[2];
            if (remote !== undefined) return remote.replace(/^refs\/heads\//, '') || null;
        }
    }
    return null;
}
