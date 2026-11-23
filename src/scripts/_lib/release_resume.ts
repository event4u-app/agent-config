/**
 * Whether a release run resumes, and whether the CHANGELOG already holds a
 * version's section. Its own module because `release.ts` is over the 1500-line
 * source ratchet, so any line added there is a gate failure.
 *
 * An in-flight release is a STATE, not a flag. `_detect_in_flight_target`
 * already reads it to pick the target (HEAD on `release/X.Y.Z`, or a
 * `package.json` version whose tag is not PUBLISHED — on a clean `main` after a
 * completed release it returns null, so a fresh release is unaffected; 14.20.0
 * is why it runs unconditionally). Every skip decision in `execute()` must read
 * the same fact: measured on 20.7.0, two re-runs without `--resume` released the
 * in-flight version AND redid its completed steps, prepending the CHANGELOG
 * section twice more.
 */

/** True when the flag is set, or the target is the release already in flight. */
export function effective_resume(o: { flag: boolean; in_flight: string | null; target: string }): boolean {
    return o.flag || (o.in_flight !== null && o.in_flight === o.target);
}

/** True when `changelog` already has a `## [X.Y.Z]` heading for the version `entry` opens with. */
export function changelog_has_version(changelog: string, entry: string): boolean {
    const version = /^## \[?(\d+\.\d+\.\d+)\]?/m.exec(entry)?.[1];
    if (version === undefined) return false;
    return new RegExp(`^## \\[?${version.replace(/\./g, '\\.')}(?![\\d.])`, 'm').test(changelog);
}
