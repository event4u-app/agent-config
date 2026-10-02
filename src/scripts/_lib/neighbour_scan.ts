/**
 * The shape scan a neighbour skill body passes before any of it may be indexed.
 *
 * SCAN BEFORE INJECT. A foreign `SKILL.md` is a file another package put on
 * disk, and the ranker reaches it through the catalogue union. Nothing about
 * being in `~/.claude/skills` makes its prose safe to fold into a term index
 * whose output names skills to a model — the body is untrusted content in the
 * sense `untrusted-input-defense` means it, and the floor here is the same one
 * that rule states: it is data until something has looked at it.
 *
 * THE SHAPES ARE THE ONES THIS SUITE ALREADY SCANS ITS OWN CORPUS WITH. Four
 * `security_lint` checks, reused as functions rather than re-implemented
 * (decision D3 of the lane): instruction smuggling, hidden Unicode, mixed-script
 * confusables and dangerous frontmatter. Re-declaring their patterns here would
 * create a second copy to drift against the first, and the first is the one CI
 * keeps honest.
 *
 * ANY FINDING REFUSES THE BODY — severity is NOT the discriminator. In the
 * corpus linters, `HIGH` fails a build and `MED` warns, because the corpus is
 * this package's own prose and a warning there is a maintainer's to weigh. A
 * neighbour body is nobody's to weigh at rank time, and the cost of refusing is
 * known and small: the skill still RANKS, by its name, with the finding kind
 * printed. Risk-register row 4 is exactly this trade and resolves the same way —
 * a shell snippet can be an installer skill's whole point, so the skill is never
 * hidden, only un-indexed.
 *
 * WHY THIS IS NOT IMPORTED BY THE RANKER. It pulls four linter modules and,
 * through one of them, `node:child_process`. The ranker runs inside the shared
 * hook bundle on `user_prompt_submit`, where every byte is paid by every concern
 * on every dispatch and `check_hook_bundle_composition` holds the ceiling. So
 * the scan runs in the census CLI and its verdict reaches the ranker as a cached
 * record — see `neighbour_census.scanVerdict`, where a missing record is a
 * refusal rather than a pass.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as sl from './security_lint.js';
import { fileDigest, type ScanCache, type ScanRecord } from './skill_origin.js';
import { _scan as scanSmuggling } from '../lint_instruction_smuggling.js';
import { _scan as scanHiddenUnicode } from '../lint_hidden_unicode.js';
import { _scan as scanConfusables } from '../lint_confusables.js';
import { _scan as scanFrontmatter } from '../lint_skill_frontmatter_safety.js';

/** The shape checks, in the order their findings are reported. */
const SHAPES: ReadonlyArray<readonly [string, (sf: sl.ScannedFile) => sl.Finding[]]> = [
    ['instruction-smuggling', scanSmuggling],
    ['dangerous-frontmatter', scanFrontmatter],
    ['hidden-unicode', scanHiddenUnicode],
    ['mixed-script-confusable', scanConfusables],
];

export interface ScanResult {
    /** `null` when every shape passed; otherwise the first finding's check id. */
    kind: string | null;
    /** Every finding, for a report that wants more than the first kind. */
    findings: sl.Finding[];
}

/**
 * Scan one `SKILL.md`.
 *
 * An unreadable file is a refusal, not a pass (`unreadable`): a body nobody
 * could open is in exactly the state this gate exists to keep out of the index,
 * and returning `kind: null` for it would make an IO error look like a clean
 * scan. A THROWING check is reported under its own id rather than swallowed, for
 * the same reason.
 */
export function scanNeighbourBody(skillMdPath: string): ScanResult {
    let sf: sl.ScannedFile;
    try {
        sf = sl.scan_file(skillMdPath);
    } catch {
        return { kind: 'unreadable', findings: [] };
    }
    const findings: sl.Finding[] = [];
    for (const [id, scan] of SHAPES) {
        try {
            findings.push(...scan(sf));
        } catch {
            findings.push(
                new sl.Finding(sf.rel, 0, id, 'HIGH', 'shape check threw on this body', 1.0),
            );
        }
    }
    return { kind: findings.length === 0 ? null : (findings[0] as sl.Finding).check, findings };
}

/**
 * Record what the scan found, for the ranker to read on the hook path.
 *
 * The digest is the FILE's, not the finding's: the ranker re-digests the body it
 * is about to index and compares, so a body edited after its scan reads as
 * `digest-changed` and goes back to name-only ranking until the census runs
 * again. That compare is the whole mechanism behind "a changed digest rescans
 * first" — without it a one-time pass would keep clearing a file forever.
 *
 * A write failure is reported to the caller rather than thrown: the scan is
 * correct either way, and a read-only report directory must not fail a census.
 */
export function writeScanCache(file: string, entries: readonly ScanRecord[]): boolean {
    const payload: ScanCache = {
        schema_version: 1,
        entries: [...entries].sort((a, b) => (a.qualified < b.qualified ? -1 : 1)),
    };
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
        return true;
    } catch {
        return false;
    }
}

/** A `ScanRecord` for one file, digest included. */
export function scanRecordFor(qualified: string, skillMdPath: string): ScanRecord {
    return {
        qualified,
        digest: fileDigest(skillMdPath) ?? '',
        unscanned: scanNeighbourBody(skillMdPath).kind,
    };
}
