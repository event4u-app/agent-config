/**
 * Who put a ranked skill on disk, and whether its body has been looked at.
 *
 * SPLIT OUT OF `neighbour_census.ts` FOR ONE CONCRETE REASON. The ranker
 * (`skill_tools/score_skill_relevance`) needs these primitives, and the ranker
 * runs inside the shared hook bundle on `user_prompt_submit`. The census module
 * reaches the host-hook merger, the secret detector and the install-ownership
 * reader; every byte of that would be inlined into one bundle that every concern
 * loads on every dispatch, under a ceiling `check_hook_bundle_composition` holds.
 * So the primitives live here, importing only the manifest reader, and the census
 * re-exports them — one definition, two call sites, no second module graph.
 *
 * ORIGIN IS READ FROM A CLAIM RECORD, NEVER INFERRED FROM A ROOT. The temptation
 * is to call `~/.claude/skills` foreign and the workspace ours. That is wrong in
 * both directions: `agent-config install` writes this package's own skills into
 * the host-global root, and a consumer's hand-written skills sit in the project
 * root. The one artifact that records what this package actually wrote is the
 * installed-tools manifest, so the manifest is the authority and the root is only
 * a tie-break between the two NON-package labels.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { manifest_path } from './installed_tools.js';

/**
 * Where a RANKED skill came from — a question about AUTHORSHIP.
 *
 * Deliberately not the census's `origin` id segment, which is WHERE a file was
 * found (`project`, `user`, `cursor`, …). Location does not answer authorship in
 * either direction, which is the whole reason this type exists beside that one.
 *
 * `home` is spelled `home` rather than the census's `user` because this value is
 * printed on a ROUTE LINE beside a skill name, where it has to read as a place a
 * reader can go and look.
 */
export type SkillOrigin = 'package' | 'project' | 'home';

/** One `compat` label per neighbour skill. Order decided in {@link classifyCompat}. */
export type Compat = 'shadowed' | 'overlapping' | 'unscanned' | 'unclassified';

/** The authored source tree, relative to a maintainer checkout's root. */
export const AUTHORED_SKILL_ROOT = path.join('src', 'skills');

/** Where the scan verdicts the ranker reads are written, relative to the root. */
export const SCAN_CACHE_RELATIVE = path.join('agents', 'reports', 'neighbour-scan.json');

/** Default scan-cache path for a project root. */
export function scanCachePath(projectRoot: string): string {
    return path.join(projectRoot, SCAN_CACHE_RELATIVE);
}

/**
 * What a route line prints: bare for ours, `origin:name` for a neighbour.
 *
 * One function, so the ranker, the census and every report agree on the
 * spelling. Two spellings of one name is how a collision stops being visible,
 * which is the defect this whole step exists to close.
 */
export function qualifiedSkillName(name: string, origin: SkillOrigin): string {
    return origin === 'package' ? name : `${origin}:${name}`;
}

/** Split a qualified name back apart. A bare name resolves to `package`. */
export function splitQualifiedName(qualified: string): { origin: SkillOrigin; name: string } {
    const m = /^(project|home):([\s\S]*)$/.exec(qualified);
    if (m) return { origin: m[1] as SkillOrigin, name: m[2] as string };
    return { origin: 'package', name: qualified };
}

/**
 * Every absolute path this package's installed-tools manifest claims, or `null`
 * when there is no manifest to claim anything.
 *
 * `null` and an empty set are different answers and callers must keep them
 * apart. An empty set means the manifest was read and claims nothing; `null`
 * means nothing recorded a claim at all, which is a tree that has never run an
 * install — this repository, for one.
 *
 * WHY THIS PARSES THE MANIFEST ITSELF, which is a thing to justify rather than
 * do quietly. Three readers of this file already exist and none answers this
 * question at a cost this path can pay. `installed_tools.read_manifest` drops
 * the nested `tools[].files[]` rows by design — its own header says so, and
 * those rows are the entire input here. `install_drift.collect_drift` and
 * `recordedOwnership.readRecordedHashes` both parse the YAML directly FOR THAT
 * REASON, so parsing it directly is the established answer rather than a new
 * idea; what is new is the fourth question — the PATHS only, with no sha, no
 * tool grouping and no hash map. `readRecordedHashes` would have answered it
 * and was measured costing 1,706 bytes of the shared hook bundle, which is the
 * budget this whole module was split out to protect. The `~` expansion below is
 * the same one all three use.
 */
export function packageClaimedPaths(projectRoot: string): ReadonlySet<string> | null {
    const manifest = manifest_path(projectRoot);
    let doc: unknown;
    try {
        doc = parseYaml(fs.readFileSync(manifest, 'utf-8'), { version: '1.1' });
    } catch {
        // Unreadable and absent are the same answer: nothing recorded a claim.
        return null;
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return null;
    const tools = (doc as Record<string, unknown>)['tools'];
    const out = new Set<string>();
    if (!Array.isArray(tools)) return out;
    for (const tool of tools) {
        if (tool === null || typeof tool !== 'object' || Array.isArray(tool)) continue;
        const files = (tool as Record<string, unknown>)['files'];
        if (!Array.isArray(files)) continue;
        for (const entry of files) {
            if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
            const raw = (entry as Record<string, unknown>)['path'];
            if (typeof raw !== 'string' || raw === '') continue;
            out.add(path.resolve(projectRoot, _expanduser(raw)));
        }
    }
    return out;
}

/** Expand a leading `~`, matching the three sibling manifest readers. */
function _expanduser(p: string): string {
    if (p === '~') return os.homedir();
    if (p.startsWith('~/') || (process.platform === 'win32' && p.startsWith('~\\'))) {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}

export interface SkillOriginOptions {
    /** Pre-read claim set, to avoid a second manifest read. `null` = no manifest. */
    claims?: ReadonlySet<string> | null;
    /** Maintainer checkout root whose `src/skills` is the authored tree. */
    packageRoot?: string;
}

/**
 * Resolve one `SKILL.md` path to the origin of the skill it defines.
 *
 * NO CLAIM RECORD MEANS NO QUALIFIER. With no manifest, nothing on disk carries
 * evidence that any skill is foreign, so everything resolves to `package`, the
 * ranker qualifies nothing, and its output is exactly what it was before this
 * function existed. That is deliberate rather than a gap being tolerated: a
 * `home:` prefix asserted without a claim record is a guess printed in the shape
 * of a fact, and a reader cannot tell the two apart. The cost is stated rather
 * than hidden — where no manifest exists a foreign skill is invisible here, and
 * the thing that fixes it is running an install, not loosening this rule.
 *
 * The authored tree is the one exception, and it is a construction rather than a
 * guess: `<root>/src/skills` exists only in a maintainer checkout of THIS
 * package and holds its source of truth, so nothing foreign can be under it.
 */
export function makeSkillOriginResolver(
    projectRoot: string,
    opts: SkillOriginOptions = {},
): (skillMdPath: string) => SkillOrigin {
    const claims = opts.claims !== undefined ? opts.claims : packageClaimedPaths(projectRoot);
    const root = path.resolve(projectRoot);
    const authored = path.join(path.resolve(opts.packageRoot ?? projectRoot), AUTHORED_SKILL_ROOT);
    const under = (abs: string, dir: string): boolean =>
        abs === dir || abs.startsWith(dir + path.sep);
    return (skillMdPath: string): SkillOrigin => {
        const abs = path.resolve(skillMdPath);
        if (under(abs, authored)) return 'package';
        if (claims === null) return 'package';
        if (claims.has(abs)) return 'package';
        return under(abs, root) ? 'project' : 'home';
    };
}

/**
 * The one label, and the order it is decided in.
 *
 *   `unscanned`    — the shape scan refused the body. FIRST, because an overlap
 *                    score is derived FROM a body this census declined to read,
 *                    and publishing it would be the refusal cancelling itself.
 *   `shadowed`     — one of ours carries the same bare name. Name-derived, so it
 *                    stays true under `unscanned`; it loses the slot only
 *                    because `unscanned` is the stronger call to action.
 *   `overlapping`  — content similarity against one of ours at or above the
 *                    threshold `audit_skill_overlap` already calibrates.
 *   `unclassified` — none of the above fired. Not a clearance.
 */
export function classifyCompat(args: {
    unscanned: string | null;
    shadows: readonly string[];
    overlaps: readonly string[];
}): Compat {
    if (args.unscanned !== null) return 'unscanned';
    if (args.shadows.length > 0) return 'shadowed';
    if (args.overlaps.length > 0) return 'overlapping';
    return 'unclassified';
}

/** One recorded scan verdict. `unscanned` is `null` when every shape passed. */
export interface ScanRecord {
    qualified: string;
    digest: string;
    unscanned: string | null;
}

export interface ScanCache {
    schema_version: 1;
    entries: ScanRecord[];
}

/** Read the scan cache, or `null` when it is absent or unreadable. */
export function readScanCache(file: string): ScanCache | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        return null;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = (parsed as Record<string, unknown>)['entries'];
    if (!Array.isArray(entries)) return null;
    return { schema_version: 1, entries: entries as ScanRecord[] };
}

/** sha256 of a file's bytes, or `null` when it cannot be read. */
export function fileDigest(file: string): string | null {
    try {
        return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    } catch {
        return null;
    }
}

/**
 * Whether a neighbour body may be indexed, and why not when it may not.
 *
 * THREE REFUSALS, REPORTED SEPARATELY, because they ask the maintainer for three
 * different things: run the census, re-run it, or read the finding. A missing
 * record is a refusal and not a pass — a gate that passes on missing evidence is
 * satisfied by deleting the evidence, which is the opposite of a floor. The
 * digest compare is what "a changed digest rescans first" means from the reading
 * side: a body edited after its scan is unscanned again until the census runs.
 */
export function scanVerdict(
    cache: ScanCache | null,
    qualified: string,
    digest: string | null,
): { ok: true } | { ok: false; kind: string } {
    if (cache === null) return { ok: false, kind: 'no-scan-record' };
    const rec = cache.entries.find((e) => e.qualified === qualified);
    if (rec === undefined) return { ok: false, kind: 'no-scan-record' };
    if (digest === null || rec.digest !== digest) return { ok: false, kind: 'digest-changed' };
    if (rec.unscanned !== null) return { ok: false, kind: rec.unscanned };
    return { ok: true };
}
