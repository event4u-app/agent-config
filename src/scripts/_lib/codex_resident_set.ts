/**
 * The resident skill set for the second host (codex), and the one file this
 * package writes to keep the rest out of that host's listing budget.
 *
 * WHY THIS EXISTS. `road-to-skills-that-arrive-when-called` 0.3 observed what
 * this host does when the listing does not fit: it prints
 * `warning: Exceeded skills context budget. All skill descriptions were removed
 * and N additional skills were not included in the model-visible skills list.`,
 * drops every description as a block, and then drops whole entries from the
 * ALPHABETICAL TAIL of the user scope. That is the worst possible failure shape
 * for a package with ~300 skills: which skills survive is decided by their
 * name, nothing says so in the session, and the surviving ones arrive bare.
 *
 * THE LEVER, AND IT IS AN OBSERVATION NOT A GUESS. The same probe measured a
 * skill carrying `agents/openai.yaml` with `policy.allow_implicit_invocation:
 * false`: it leaves the model-visible list entirely AND stops occupying the
 * budget (omitted fell 554 → 481 when 60 of 120 were disabled). So a resident
 * set is enforceable from the package side alone, with no host setting and no
 * consumer configuration: keep the resident skills as they are, and write that
 * one file into every other OWNED skill directory.
 *
 * WHAT A NON-RESIDENT SKILL LOSES, MEASURED. Its listing entry; the directory,
 * the body and the name are untouched, so it stays installed. It is NOT still
 * reachable as a skill: probe row `unlisted-skill-not-in-model-list`,
 * two-armed, has the model answering `NONRESIDENT=NO` for a policy-disabled
 * skill against `RESIDENT=YES` for a resident one, and answering `UNAVAILABLE`
 * with no tool call when asked to invoke it. Its body stays readable by a
 * caller that already knows the path, which is a filesystem read.
 *
 * That is a real cost, and the remedy ships with the set: `codex_skill_finder`
 * writes one listed entry that indexes every non-resident name and routes to it
 * by exact name or through the shell ranker (`second-host-unlisted-reachability`,
 * remedy (a), AI council 2026-10-20). Its listing entry is paid for out of the
 * same budget before the split.
 *
 * What the trade is NOT is a reduction in reach. Without this, the host drops
 * 406 entries and strips every description, by alphabet, behind a warning
 * (5.2's control) — so those entries are already unreached and nobody can say
 * which. This replaces an arbitrary cut with a deterministic, recorded one.
 *
 * WHY NOT THE HOST'S DOCUMENTED ROOT. The host's page names
 * `$HOME/.agents/skills`; `GLOBAL_DEPLOY_SOURCES` writes `~/.codex/skills`. The
 * probe found the host reads BOTH, and lists a skill present under both TWICE —
 * so moving the deploy would be a frozen-install-ABI change that also risks
 * doubling the very budget this file is protecting. This writes where the
 * package already deploys.
 *
 * OWNERSHIP AND ROLLBACK. Every path written is recorded in a sidecar beside
 * the deploy inventory, and `removeCodexResidentSet` deletes exactly those
 * paths. A skill directory this package did not deploy is never touched,
 * because the owned set comes from the deploy inventory.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { atomicWriteFile } from '../../install/atomic.js';
import { ensureCodexFinder, FINDER_NAME, finderDescription, removeCodexFinder } from './codex_skill_finder.js';
import type { FinderOutcome } from './codex_skill_finder.js';
import * as user_global_paths from './user_global_paths.js';

/** Sidecar directory, beside `skill-overrides.json`: one record per host root. */
export const RECORD_DIRNAME = 'codex-resident-set';

/** Relative path, inside a skill directory, of the host's per-skill policy file. */
export const POLICY_REL = path.join('agents', 'openai.yaml');

/**
 * The host's documented skills-context budget, in characters.
 *
 * Mirrors `CODEX_UNKNOWN_WINDOW_BUDGET_CHARS` in `report_skill_host_census.ts`
 * rather than importing it, because that module is a CLI whose main-guard fires
 * inside the install bundle — the same reason `skill_listing_overrides` does not
 * import `compute_skill_tiers`.
 */
export const CODEX_BUDGET_CHARS = 8_000;

/** The file body. Two keys, because the probe set exactly these two. */
export const POLICY_BODY = 'policy:\n  allow_implicit_invocation: false\n';

/** One catalogue entry as this host is offered it. */
export interface CodexCatalogueEntry {
    name: string;
    descriptionChars: number;
}

/** A behaviour this model had to pin down that the host states as prose. */
export interface CodexResidentAssumption {
    id: 'entry-cost-is-name-plus-description' | 'per-entry-overhead' | 'fill-order-alphabetical';
    provenance: 'upstream-prose' | 'first-party-observation';
    why: string;
}

export interface CodexResidentResult {
    budgetChars: number;
    /** Names whose listing entry survives, in fill order. */
    resident: string[];
    /** Names whose implicit invocation is disabled so they leave the listing. */
    nonResident: string[];
    /** Characters the resident listing is modelled to consume. */
    listingChars: number;
    assumptions: readonly CodexResidentAssumption[];
}

const ASSUMPTIONS: readonly CodexResidentAssumption[] = [
    {
        id: 'entry-cost-is-name-plus-description',
        provenance: 'upstream-prose',
        why:
            'The host reports a "skills context budget" in characters and does not publish the ' +
            'serialisation it bills. This model bills a name plus its description, which is what ' +
            'the injected list visibly carries.',
    },
    {
        id: 'per-entry-overhead',
        provenance: 'upstream-prose',
        why:
            'Each entry also costs separators and a newline. The host quantifies none of it, so ' +
            'the default here is 5 characters per entry and the resulting resident set is therefore ' +
            'an estimate of what fits, never a guarantee — too small, never too large.',
    },
    {
        id: 'fill-order-alphabetical',
        provenance: 'first-party-observation',
        why:
            'The 0.3 probe observed the host itself dropping from the alphabetical tail of the user ' +
            'scope. With no usage ledger to order by, filling alphabetically makes the package pick ' +
            'the SAME set the host would have picked, so the resident set is the host\'s own survivors ' +
            'made explicit rather than a second, conflicting order.',
    },
];

export const DEFAULT_PER_ENTRY_OVERHEAD_CHARS = 5;

/**
 * Split an owned catalogue into the entries whose listing fits the budget and
 * the entries whose implicit invocation must be disabled so it does.
 *
 * Pure — no I/O, no clock, no process state.
 */
export function computeCodexResidentSet(
    catalogue: readonly CodexCatalogueEntry[],
    opts?: { budgetChars?: number; perEntryOverheadChars?: number },
): CodexResidentResult {
    const budgetChars = opts?.budgetChars ?? CODEX_BUDGET_CHARS;
    const overhead = opts?.perEntryOverheadChars ?? DEFAULT_PER_ENTRY_OVERHEAD_CHARS;

    const ordered = catalogue
        .slice()
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    const resident: string[] = [];
    const nonResident: string[] = [];
    let listingChars = 0;
    let overflowed = false;
    for (const e of ordered) {
        const cost = e.name.length + e.descriptionChars + overhead;
        // `stop-at-first-overflow`, same shape as `host_listing_model`: the host
        // describes filling a budget, not packing one, so a shorter later entry
        // does not get to slip in behind a longer one that did not fit.
        if (overflowed || listingChars + cost > budgetChars) {
            overflowed = true;
            nonResident.push(e.name);
            continue;
        }
        resident.push(e.name);
        listingChars += cost;
    }
    return { budgetChars, resident, nonResident, listingChars, assumptions: ASSUMPTIONS };
}

export interface CodexResidentRecord {
    schema_version: 1;
    anchor: string;
    /** Skill-directory-relative policy paths this package wrote, anchor-relative. */
    written: string[];
}

export interface EnsureResidentSetResult {
    changed: boolean;
    disabled: string[];
    reenabled: string[];
    /** Skills left alone because a policy file was already there and is not ours. */
    skipped_foreign: string[];
}

/**
 * The record for ONE host root.
 *
 * One file per root, named by a digest of the resolved root, because the host
 * reads more than one: `~/.codex/skills`, where this package deploys for it,
 * and `$HOME/.agents/skills`, its own documented root, which this package also
 * writes — for a different host. Measured 2026-10-20 on the maintainer machine:
 * 309 entries in the first and 459 in the second, and 0.3 observed the host
 * listing a name present in both TWICE. A resident set that covered one root
 * left the warning firing at 153 omitted where the control read 406, which is
 * the mechanism working on the root it was given and nothing more.
 */
export function recordPath(anchor: string, env?: user_global_paths.EnvMap | null): string {
    const key = createHash('sha256').update(path.resolve(anchor)).digest('hex').slice(0, 16);
    return path.join(user_global_paths.write_target(RECORD_DIRNAME, { env: env ?? null }), `${key}.json`);
}

/** The finder's ownership record for one host root, beside the policy record. */
export function finderRecordPath(anchor: string, env?: user_global_paths.EnvMap | null): string {
    return recordPath(anchor, env).replace(/\.json$/, '.finder.json');
}

/**
 * Every user skills root this host reads that this package writes, in listing
 * precedence order — the first that holds a name is where its description is
 * kept, and a copy in any later root is disabled so the budget is not spent
 * twice on the same skill.
 *
 * Both rows come from `GLOBAL_DEPLOY_SOURCES`: `~/.codex/skills` is the codex
 * row, `~/.agents/skills` is the antigravity row. The second is in this list
 * because the HOST reads it, not because it belongs to this host — and the
 * policy file written there is `agents/openai.yaml`, which only this host
 * reads, so another host's deploy is not affected by being listed here.
 */
export function codexSkillRoots(home: string): string[] {
    return [path.join(home, '.codex'), path.join(home, '.agents')].filter((a) =>
        fs.existsSync(path.join(a, 'skills')),
    );
}

/** The owned catalogue as deployed, read from disk. */
export function ownedCatalogue(skillsDir: string, owned: readonly string[]): CodexCatalogueEntry[] {
    const out: CodexCatalogueEntry[] = [];
    for (const name of owned) {
        let raw: string;
        try {
            raw = fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
        } catch {
            continue;
        }
        const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
        const line = fm ? /^description:[ \t]*(.*)$/m.exec(fm[1]!) : null;
        out.push({ name, descriptionChars: line ? line[1]!.replace(/^["']|["']$/g, '').length : 0 });
    }
    return out;
}

function loadRecord(file: string, anchor: string): CodexResidentRecord {
    const empty: CodexResidentRecord = { schema_version: 1, anchor, written: [] };
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        return empty;
    }
    const r = data as Partial<CodexResidentRecord> | null;
    if (!r || typeof r !== 'object' || !Array.isArray(r.written)) return empty;
    if (path.resolve(String(r.anchor)) !== path.resolve(anchor)) return empty;
    return { schema_version: 1, anchor, written: r.written.filter((x): x is string => typeof x === 'string') };
}

function saveRecord(file: string, rec: CodexResidentRecord): void {
    if (rec.written.length === 0) {
        fs.rmSync(file, { force: true });
        return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const sorted = { ...rec, written: [...rec.written].sort() };
    atomicWriteFile(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** Remove the policy file and any `agents/` directory it alone occupied. */
function dropPolicy(abs: string): void {
    fs.rmSync(abs, { force: true });
    const dir = path.dirname(abs);
    try {
        if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
        /* a non-empty or vanished directory is not ours to prune */
    }
}

/**
 * Idempotently bring the deployed tree to `nonResident`.
 *
 * Writes the policy file for every non-resident owned skill, removes the ones it
 * wrote for skills that rejoined the resident set or left the deploy, and never
 * touches a policy file it did not write.
 */
export function ensureCodexResidentSet(
    anchor: string,
    recordFile: string,
    nonResident: readonly string[],
): EnsureResidentSetResult {
    const skillsDir = path.join(anchor, 'skills');
    const rec = loadRecord(recordFile, anchor);
    const result: EnsureResidentSetResult = { changed: false, disabled: [], reenabled: [], skipped_foreign: [] };

    const want = new Set(nonResident);
    const ours = new Set(rec.written);
    const next: string[] = [];

    for (const rel of rec.written) {
        const abs = path.join(anchor, rel);
        const name = rel.split(path.sep)[1] ?? '';
        if (!fs.existsSync(abs)) continue; // gone with its skill; nothing to keep recorded
        if (fs.readFileSync(abs, 'utf-8') !== POLICY_BODY) continue; // edited: theirs now
        if (want.has(name)) {
            next.push(rel);
            continue;
        }
        dropPolicy(abs);
        result.reenabled.push(name);
    }

    for (const name of [...want].sort()) {
        const rel = path.join('skills', name, POLICY_REL);
        if (ours.has(rel) && next.includes(rel)) continue;
        const dir = path.join(skillsDir, name);
        if (!fs.existsSync(dir)) continue;
        const abs = path.join(anchor, rel);
        if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf-8') !== POLICY_BODY) {
            result.skipped_foreign.push(name);
            continue;
        }
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        atomicWriteFile(abs, POLICY_BODY);
        next.push(rel);
        result.disabled.push(name);
    }

    result.changed = result.disabled.length > 0 || result.reenabled.length > 0;
    saveRecord(recordFile, { schema_version: 1, anchor, written: next });
    result.disabled.sort();
    result.reenabled.sort();
    result.skipped_foreign.sort();
    return result;
}

export interface RemoveResidentSetResult {
    changed: boolean;
    removed: string[];
    kept_user: string[];
    /** What happened to the finder entry in this root, when there was one. */
    finder: FinderOutcome;
}

/** Remove exactly the recorded policy files whose body is still ours. */
export function removeCodexResidentSet(anchor: string, recordFile: string): RemoveResidentSetResult {
    const finder = removeCodexFinder(anchor, recordFile.replace(/\.json$/, '.finder.json'));
    const result: RemoveResidentSetResult = { changed: finder === 'removed', removed: [], kept_user: [], finder };
    if (!fs.existsSync(recordFile)) return result;
    const rec = loadRecord(recordFile, anchor);
    for (const rel of rec.written) {
        const abs = path.join(anchor, rel);
        if (!fs.existsSync(abs)) continue;
        if (fs.readFileSync(abs, 'utf-8') !== POLICY_BODY) {
            result.kept_user.push(rel);
            continue;
        }
        dropPolicy(abs);
        result.removed.push(rel);
    }
    fs.rmSync(recordFile, { force: true });
    result.changed = result.changed || result.removed.length > 0;
    result.removed.sort();
    result.kept_user.sort();
    return result;
}

/**
 * The installer's one call: compute one resident set across every root the host
 * reads, write it, report. Never throws — a failure here must not sink the
 * content deploy, same as the listing override.
 *
 * ONE set across ALL roots, not one per root, because the host sums them: it
 * lists every root and 0.3 observed it listing a name present in two of them
 * twice, without merging. So a resident name keeps its description in the FIRST
 * root that holds it and is disabled in every later one — which removes the
 * double entry as well as the overflow.
 *
 * Ownership is the deploy inventory for the root that has one; a root this
 * package writes under another host's row (`~/.agents/skills`) is owned through
 * that row. Either way this must run AFTER every prune: a skill a prune removed
 * is no longer owned and must not keep a policy file behind.
 */
export function applyCodexResidentSet(home: string, report: (msg: string) => void): void {
    try {
        const roots = codexSkillRoots(home);
        if (roots.length === 0) return;

        // The union, in root precedence order: the first root that carries a
        // name is the one that may describe it.
        const firstRootOf = new Map<string, string>();
        const catalogue: CodexCatalogueEntry[] = [];
        for (const anchor of roots) {
            const skillsDir = path.join(anchor, 'skills');
            const owned = fs
                .readdirSync(skillsDir, { withFileTypes: true })
                .filter((d) => d.isDirectory() && d.name !== FINDER_NAME && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
                .map((d) => d.name);
            for (const e of ownedCatalogue(skillsDir, owned)) {
                if (firstRootOf.has(e.name)) continue;
                firstRootOf.set(e.name, anchor);
                catalogue.push(e);
            }
        }
        // The finder is listed too, so its entry is paid for before the split
        // rather than squeezed in after it. Its description is sized for the
        // whole catalogue being unlisted, an upper bound on the real count.
        const finderCost = FINDER_NAME.length + finderDescription(catalogue.length).length + DEFAULT_PER_ENTRY_OVERHEAD_CHARS;
        let split = computeCodexResidentSet(catalogue);
        if (split.nonResident.length > 0) {
            split = computeCodexResidentSet(catalogue, { budgetChars: CODEX_BUDGET_CHARS - finderCost });
        }
        const resident = new Set(split.resident);

        let disabled = 0;
        let reenabled = 0;
        let foreign = 0;
        for (const anchor of roots) {
            const skillsDir = path.join(anchor, 'skills');
            const here = fs
                .readdirSync(skillsDir, { withFileTypes: true })
                .filter((d) => d.isDirectory() && d.name !== FINDER_NAME && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
                .map((d) => d.name);
            // Disabled here when it is not resident at all, OR when it is
            // resident but some earlier root already carries its description.
            const nonResident = here.filter((n) => !resident.has(n) || firstRootOf.get(n) !== anchor);
            const res = ensureCodexResidentSet(anchor, recordPath(anchor), nonResident);
            disabled += res.disabled.length;
            reenabled += res.reenabled.length;
            foreign += res.skipped_foreign.length;
        }
        // 5.2's S3: an unlisted skill is not reached unless something listed
        // routes to it. The finder lives in the first root and indexes every
        // non-resident name at the root whose copy the host would have used.
        const finder = ensureCodexFinder(
            roots[0]!,
            finderRecordPath(roots[0]!),
            split.nonResident.map((name) => ({ name, skillsDir: path.join(firstRootOf.get(name)!, 'skills') })),
        );
        report(
            `codex: resident set across ${roots.length} root(s) — ${split.resident.length} listed ` +
                `(${split.listingChars} of ${split.budgetChars} chars), ` +
                `${disabled} newly unlisted, ${reenabled} relisted` +
                (foreign > 0 ? `, ${foreign} existing policy file(s) untouched` : '') +
                `, finder ${finder}`,
        );
    } catch (e) {
        report(`codex: resident set skipped — ${String(e)}`);
    }
}
