#!/usr/bin/env tsx
/**
 * harvest_reference_tokens — the deterministic reference-token discovery pass
 * (`road-to-bounded-reference-harvest-loop` Phase 4).
 *
 * Six jobs, one script, in one order: **discover** the `ENC1:` tokens across
 * the roadmap estate, **decrypt** them, **classify** each resolved URL,
 * **canonicalize** the ones that are repositories, **deduplicate** on identity
 * plus pinned revision, and **write** a resumable manifest into the gitignored
 * local area. It is deliberately not a module family: every stage's output is
 * the next stage's only input, so a seam between them would buy nothing and
 * cost a contract.
 *
 * Why the census is printable and the findings are not:
 * The token census — occurrences, unique tokens, files, per-level breakdown —
 * names nothing, so it prints. The **resolved URLs are the source names this
 * repository's confidentiality programme exists to hide**, so they never reach
 * stdout except behind `--json` at a terminal, and they are written only under
 * `agents/.harvest-local/`, which `.gitignore` covers as a whole directory
 * rather than as a pattern one rename defeats.
 *
 * Refuse, never skip.
 * Extraction needs no key, so the census works without one. Everything past
 * extraction does, and with no key resolvable this **refuses with exit 2**
 * rather than reporting a quietly short classification. A zero that means
 * "nobody could look" is the failure this repository's scan-scope discipline
 * exists to prevent, and it is exactly the failure mode Risk 7 of the roadmap
 * names.
 *
 * Usage:
 *   harvest_reference_tokens [--dry-run] [--manifest <path>] [--limit <n>]
 *   harvest_reference_tokens --json            # plaintext, terminal only
 *   harvest_reference_tokens --resume [--refresh]
 *
 * Exit codes: 0 = the pass ran, 2 = usage error or no key resolvable.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { decrypt, resolve_keys } from './_lib/link_crypto.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The gitignored local area. `.gitignore` covers the whole directory. */
export const LOCAL_AREA = 'agents/.harvest-local';
/** One line per identity. The only place an opaque id resolves to a name. */
export const MANIFEST = `${LOCAL_AREA}/manifest.jsonl`;

/**
 * Bumped when the loop contract changes shape. Part of the freshness key, so a
 * contract change invalidates prior analyses; this package's own revision is
 * deliberately NOT part of it (§ freshnessKey).
 */
export const CONTRACT_VERSION = 1;

/**
 * The five levels of the roadmap estate. Enumerated here rather than read from
 * a shared library because no canonical estate reader exists in
 * `src/scripts/_lib/` — verified, not assumed.
 */
export const ESTATE_LEVELS = ['active', 'archive', 'later', 'stubs', 'skipped'] as const;
export type EstateLevel = (typeof ESTATE_LEVELS)[number];

/**
 * Mirrors the token scan in `sweep_source_surfaces.ts:587`, with one addition:
 * a minimum length. The shortest real token in the estate is 93 characters
 * (measured), so requiring 60 base64 characters excludes a short prose
 * placeholder such as `ENC1:abcd` while matching every genuine token.
 *
 * The character class and the minimum are two bounds against two different
 * placeholders, and only the first is load-bearing on today's tree: a plain
 * substring scan for `ENC1:` reports 77 estate files, the character class
 * brings that to the 63 that carry a token (the other 14 mention the bare
 * prefix in prose), and the minimum currently rejects nothing further. It is
 * kept because the defect it guards is the same one — documentation showing
 * the token *shape* counted as a token, which is what Risk 7 names.
 */
export const TOKEN_RE = /ENC1:[A-Za-z0-9+/=]{60,}/g;

/** Hosts whose `/owner/repo` path shape denotes a repository. */
const REPO_HOSTS = new Set([
    'github.com',
    'gitlab.com',
    'bitbucket.org',
    'codeberg.org',
    'gitea.com',
    'git.sr.ht',
    'sr.ht',
]);

/**
 * First path segments on a repository host that are the host's own product
 * surface, never an owner. A URL under one of these is not-a-repository even
 * though its host is a repository host.
 */
const NON_OWNER_SEGMENTS = new Set([
    'about', 'blog', 'collections', 'customer-stories', 'enterprise', 'explore',
    'features', 'marketplace', 'notifications', 'orgs', 'pricing', 'pulls',
    'search', 'security', 'settings', 'sponsors', 'topics', 'trending',
]);

/** Path segments that follow `<owner>/<repo>` and are collapsed away. */
const SUBPATH_SEGMENTS = new Set([
    'blob', 'tree', 'commit', 'commits', 'issues', 'pull', 'pulls',
    'discussions', 'releases', 'tags', 'wiki', 'actions', 'blame', 'raw',
]);

export type Classification = 'repository' | 'not-a-repository' | 'unresolvable';

/** One token occurrence, before decryption. */
export interface Occurrence {
    token: string;
    file: string;
    level: EstateLevel;
}

/** The countable half of the pass — names nothing, so it prints. */
export interface Census {
    occurrences: number;
    uniqueTokens: number;
    files: number;
    byLevel: Record<EstateLevel, number>;
}

/** One resolved token. `url` and `identity` are plaintext — never printed. */
export interface Resolved {
    token: string;
    url: string | null;
    identity: string | null;
    revision: string | null;
    classification: Classification;
    citedBy: string[];
}

export type Status =
    | 'pending'
    | 'running'
    | 'done'
    | 'skipped-as-not-a-repository'
    | 'skipped-as-duplicate'
    | 'skipped-as-fresh'
    | 'blocked-on-missing-key'
    | 'blocked-as-unresolvable'
    | 'failed';

/** Every status the manifest may carry. A value outside this set is a defect. */
export const STATUSES: readonly Status[] = [
    'pending', 'running', 'done',
    'skipped-as-not-a-repository', 'skipped-as-duplicate', 'skipped-as-fresh',
    'blocked-on-missing-key', 'blocked-as-unresolvable', 'failed',
];

/** One manifest line. One per identity-plus-revision, never one per token. */
export interface Entry {
    opaque_id: string;
    identity: string | null;
    revision: string | null;
    status: Status;
    cited_by: string[];
    tokens: number;
    contract_version: number;
    loops: number;
    focus: string | null;
    observed_at: string;
}

/**
 * The opaque id: `sha256(identity + '@' + revision)`, first 16 hex characters.
 *
 * The revision is inside the hash on purpose. It makes the id **stable** across
 * two runs at one revision — so a resumed run lands in the directory it already
 * populated — and **different** across revisions, so one repository at two
 * historical pins is two pieces of evidence instead of one silently
 * overwriting the other.
 */
export function opaqueId(identity: string, revision: string): string {
    return crypto.createHash('sha256').update(`${identity}@${revision}`).digest('hex').slice(0, 16);
}

/**
 * Collapse every spelling of one repository onto `<host>/<owner>/<repo>`.
 *
 * Handles the four spellings that occur in practice: the plain HTTPS URL, the
 * `.git` suffix, the `git@host:owner/repo.git` SCP form, and a deep link such
 * as `/tree/main/x` or `/blob/main/y`. Returns `null` when the URL is not a
 * repository at all — classification reads this return value rather than the
 * prose the token sat next to.
 */
export function canonicalize(raw: string): string | null {
    let s = raw.trim();
    if (s === '') {
        return null;
    }
    const scp = /^(?:ssh:\/\/)?git@([^:/]+)[:/](.+)$/.exec(s);
    if (scp) {
        s = `https://${scp[1]}/${scp[2] as string}`;
    }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
        s = `https://${s}`;
    }
    let u: URL;
    try {
        u = new URL(s);
    } catch {
        return null;
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const segs = u.pathname.split('/').filter((x) => x !== '');
    const dotGit = segs.length > 0 && (segs[segs.length - 1] as string).endsWith('.git');
    if (!REPO_HOSTS.has(host) && !dotGit) {
        return null;
    }
    if (segs.length < 2) {
        return null;
    }
    const owner = (segs[0] as string).toLowerCase();
    if (NON_OWNER_SEGMENTS.has(owner)) {
        return null;
    }
    let repo = (segs[1] as string).toLowerCase().replace(/\.git$/, '');
    if (repo === '') {
        return null;
    }
    if (segs.length > 2 && !SUBPATH_SEGMENTS.has((segs[2] as string).toLowerCase())) {
        // A third segment that is not a known sub-path is a different surface
        // (a host's nested group, a docs route) — do not guess it is a repo.
        if (host !== 'gitlab.com') {
            return null;
        }
        repo = segs.slice(1).join('/').toLowerCase().replace(/\.git$/, '');
    }
    return `${host}/${owner}/${repo}`;
}

/** `repository` iff `canonicalize` yields an identity. Reads the URL, never the prose. */
export function classifyUrl(raw: string): Classification {
    return canonicalize(raw) === null ? 'not-a-repository' : 'repository';
}

/** Which estate level a roadmap path sits at. */
export function levelOf(rel: string): EstateLevel {
    const m = /^agents\/roadmaps\/([^/]+)\//.exec(rel);
    const dir = m ? (m[1] as string) : '';
    return (ESTATE_LEVELS as readonly string[]).includes(dir) ? (dir as EstateLevel) : 'active';
}

/** Every `.md` under the estate, sorted so two runs enumerate identically. */
export function estateFiles(root: string = ROOT): string[] {
    const base = path.join(root, 'agents', 'roadmaps');
    const out: string[] = [];
    const walk = (dir: string): void => {
        let ents: fs.Dirent[];
        try {
            ents = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of ents.sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else if (e.name.endsWith('.md')) {
                out.push(path.relative(root, p));
            }
        }
    };
    walk(base);
    return out.sort();
}

/** Extract every token occurrence. Needs no key. */
export function discover(root: string = ROOT): Occurrence[] {
    const out: Occurrence[] = [];
    for (const rel of estateFiles(root)) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf-8');
        } catch {
            continue;
        }
        for (const m of text.matchAll(TOKEN_RE)) {
            out.push({ token: m[0], file: rel, level: levelOf(rel) });
        }
    }
    return out;
}

/** Counts only. Prints safely because it names nothing. */
export function census(occ: readonly Occurrence[]): Census {
    const byLevel: Record<EstateLevel, number> = {
        active: 0, archive: 0, later: 0, stubs: 0, skipped: 0,
    };
    const filesPerLevel: Record<EstateLevel, Set<string>> = {
        active: new Set(), archive: new Set(), later: new Set(),
        stubs: new Set(), skipped: new Set(),
    };
    for (const o of occ) {
        filesPerLevel[o.level].add(o.file);
    }
    for (const l of ESTATE_LEVELS) {
        byLevel[l] = filesPerLevel[l].size;
    }
    return {
        occurrences: occ.length,
        uniqueTokens: new Set(occ.map((o) => o.token)).size,
        files: new Set(occ.map((o) => o.file)).size,
        byLevel,
    };
}

/**
 * Decrypt, classify, canonicalize. One `Resolved` per **unique token**, with
 * the citing files fanned in — a token repeated in three roadmaps is one
 * resolution, not three.
 */
export function resolveAll(occ: readonly Occurrence[], keys: readonly string[]): Resolved[] {
    const cited = new Map<string, string[]>();
    for (const o of occ) {
        const l = cited.get(o.token) ?? [];
        if (!l.includes(o.file)) {
            l.push(o.file);
        }
        cited.set(o.token, l);
    }
    const out: Resolved[] = [];
    for (const token of [...cited.keys()].sort()) {
        const citedBy = (cited.get(token) as string[]).slice().sort();
        let url: string | null = null;
        try {
            url = decrypt(token, keys as string[]);
        } catch {
            out.push({ token, url: null, identity: null, revision: null, classification: 'unresolvable', citedBy });
            continue;
        }
        const identity = canonicalize(url);
        out.push({
            token,
            url,
            identity,
            revision: revisionFrom(url),
            classification: identity === null ? 'not-a-repository' : 'repository',
            citedBy,
        });
    }
    return out;
}

/**
 * The pinned revision, when the stored link carries one (`…@<sha>`, or a
 * `/tree/<sha>` deep link). `null` means unpinned, which is a distinct
 * identity from any pinned one — see `dedupe`.
 */
export function revisionFrom(url: string): string | null {
    const at = /@([0-9a-f]{7,40})\s*$/i.exec(url);
    if (at) {
        return (at[1] as string).toLowerCase();
    }
    const tree = /\/(?:tree|commit|blob)\/([0-9a-f]{7,40})(?:\/|$)/i.exec(url);
    return tree ? (tree[1] as string).toLowerCase() : null;
}

/**
 * One entry per identity **plus** pinned revision.
 *
 * Never per token: encryption is randomised, so two tokens for one repository
 * never compare equal and a token-keyed dedupe would report one repository
 * twice. And never per identity alone: one repository at two historical pins is
 * two pieces of evidence, so collapsing them would silently drop one.
 */
export function dedupe(resolved: readonly Resolved[], now: Date = new Date()): Entry[] {
    const stamp = now.toISOString().slice(0, 10);
    const byKey = new Map<string, Entry>();
    const out: Entry[] = [];
    for (const r of resolved) {
        if (r.classification === 'unresolvable') {
            out.push(mkEntry(r, 'blocked-as-unresolvable', stamp));
            continue;
        }
        if (r.classification === 'not-a-repository') {
            out.push(mkEntry(r, 'skipped-as-not-a-repository', stamp));
            continue;
        }
        const key = `${r.identity as string}@${r.revision ?? ''}`;
        const seen = byKey.get(key);
        if (seen) {
            seen.tokens += 1;
            for (const f of r.citedBy) {
                if (!seen.cited_by.includes(f)) {
                    seen.cited_by.push(f);
                }
            }
            seen.cited_by.sort();
            continue;
        }
        const e = mkEntry(r, 'pending', stamp);
        byKey.set(key, e);
        out.push(e);
    }
    return out;
}

function mkEntry(r: Resolved, status: Status, stamp: string): Entry {
    return {
        opaque_id: r.identity === null ? '' : opaqueId(r.identity, r.revision ?? 'HEAD'),
        identity: r.identity,
        revision: r.revision,
        status,
        cited_by: r.citedBy.slice().sort(),
        tokens: 1,
        contract_version: CONTRACT_VERSION,
        loops: 3,
        focus: null,
        observed_at: stamp,
    };
}

/**
 * The freshness key: identity, upstream revision, contract version, loop count
 * and focus.
 *
 * **This package's own revision is deliberately absent.** Including it would
 * change the key on every commit here, so every analysis would be permanently
 * stale and `skipped-as-fresh` would be unreachable — a freshness rule that
 * never fires is not a freshness rule.
 */
export function freshnessKey(e: Entry): string {
    return [e.identity ?? '', e.revision ?? '', String(e.contract_version), String(e.loops), e.focus ?? ''].join('|');
}

/** Read a manifest. A missing file is an empty manifest, never an error. */
export function readManifest(file: string): Entry[] {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return [];
    }
    const out: Entry[] = [];
    for (const line of text.split('\n')) {
        if (line.trim() === '') {
            continue;
        }
        try {
            out.push(JSON.parse(line) as Entry);
        } catch {
            continue;
        }
    }
    return out;
}

/** Serialise one entry per line, ordered so two runs write identical bytes. */
export function renderManifest(entries: readonly Entry[]): string {
    const keyed = entries.slice().sort((a, b) => (freshnessKey(a) < freshnessKey(b) ? -1 : 1));
    return keyed.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

/** A resume decision for one entry, with the reason the run must print. */
export interface ResumeDecision {
    entry: Entry;
    run: boolean;
    reason: string;
}

/**
 * Merge a fresh discovery against a prior manifest.
 *
 * An entry the prior manifest already carries as `done` is `skipped-as-fresh`
 * when its freshness key is unchanged — that is what makes an interrupted batch
 * resumable without re-running a completed repository. `--refresh` overrides
 * the skip and nothing else.
 */
export function planResume(
    fresh: readonly Entry[],
    prior: readonly Entry[],
    refresh = false,
): ResumeDecision[] {
    const done = new Map<string, Entry>();
    for (const p of prior) {
        if (p.status === 'done') {
            done.set(freshnessKey(p), p);
        }
    }
    const out: ResumeDecision[] = [];
    for (const e of fresh) {
        if (e.status === 'skipped-as-not-a-repository') {
            out.push({ entry: e, run: false, reason: 'not a repository — classification read the resolved URL' });
            continue;
        }
        if (e.status === 'blocked-as-unresolvable') {
            out.push({ entry: e, run: false, reason: 'token did not decrypt with any configured key' });
            continue;
        }
        const hit = done.get(freshnessKey(e));
        if (hit && !refresh) {
            out.push({ entry: { ...e, status: 'skipped-as-fresh' }, run: false, reason: `already done at ${hit.observed_at} — freshness key unchanged` });
            continue;
        }
        out.push({ entry: e, run: true, reason: refresh && hit ? 're-run requested by --refresh' : 'pending' });
    }
    return out;
}

/** What the fold pass decided for one capability gap. */
export type Disposition =
    | 'no-action'
    | 'already-planned'
    | 'extend-existing'
    | 'create-follow-up'
    | 'create-new'
    | 'contested';

/** One repository's contribution to one capability gap. */
export interface Candidate {
    opaque_id: string;
    /** Kebab-case slug naming what THIS package lacks — never the reference. */
    gap: string;
}

/** One gap after the fold. `sources` is why three repositories are not three roadmaps. */
export interface Fold {
    gap: string;
    roadmap: string | null;
    sources: string[];
    disposition: Disposition;
}

/**
 * Is a proposed roadmap filename free of every source's identity?
 *
 * The check is mechanical because the failure is mechanical: a tracked filename
 * is a published string, and `adopt-<owner>-<repo>.md` publishes the one thing
 * the confidentiality programme exists to withhold, in the surface no
 * `.gitignore` can retract. Compares against each identity's host, owner and
 * repository segments separately — `owner-repo` in a filename is caught by the
 * segment test even though the joined string never appears in the identity.
 */
export function roadmapNameIsSourceFree(name: string, identities: readonly string[]): boolean {
    const hay = path.basename(name).toLowerCase();
    for (const id of identities) {
        for (const seg of id.toLowerCase().split(/[/.]/)) {
            if (seg.length >= 4 && hay.includes(seg)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Fold candidates onto one roadmap per capability gap.
 *
 * **Three repositories showing one gap strengthen the evidence on one owning
 * roadmap; they never create three.** That inversion is the whole reason a
 * harvester exists rather than a loop that lands whatever each analysis
 * returns: the estate's growth budget is spent on gaps, and a gap is a property
 * of this package, so the count of references that happened to reveal it is
 * evidence about the gap and not a multiplier on it.
 *
 * A gap an active roadmap already owns folds onto that owner rather than
 * opening a second entry, and a proposed name carrying a source identity is
 * returned `contested` rather than silently renamed — a rename would hide the
 * fact that the finding was understood only as "what they have".
 */
export function foldCandidates(
    candidates: readonly Candidate[],
    ownedGaps: ReadonlyMap<string, string> = new Map(),
    identitiesById: ReadonlyMap<string, string> = new Map(),
): Fold[] {
    const byGap = new Map<string, string[]>();
    for (const c of candidates) {
        const l = byGap.get(c.gap) ?? [];
        if (!l.includes(c.opaque_id)) {
            l.push(c.opaque_id);
        }
        byGap.set(c.gap, l);
    }
    const out: Fold[] = [];
    for (const gap of [...byGap.keys()].sort()) {
        const sources = (byGap.get(gap) as string[]).slice().sort();
        const owner = ownedGaps.get(gap);
        if (owner !== undefined) {
            out.push({ gap, roadmap: owner, sources, disposition: 'already-planned' });
            continue;
        }
        const name = `agents/roadmaps/road-to-${gap}.md`;
        const ids = sources.map((id) => identitiesById.get(id)).filter((x): x is string => x !== undefined);
        if (!roadmapNameIsSourceFree(name, ids)) {
            out.push({ gap, roadmap: null, sources, disposition: 'contested' });
            continue;
        }
        out.push({ gap, roadmap: name, sources, disposition: 'create-new' });
    }
    return out;
}

function renderCensus(c: Census): string {
    const lv = ESTATE_LEVELS.map((l) => `${l}=${c.byLevel[l]}`).join(' ');
    return [
        `token occurrences: ${c.occurrences}`,
        `unique tokens:     ${c.uniqueTokens}`,
        `files:             ${c.files}`,
        `files by level:    ${lv}`,
    ].join('\n');
}

export function main(argv: readonly string[]): number {
    const has = (f: string): boolean => argv.includes(f);
    const val = (f: string): string | null => {
        const i = argv.indexOf(f);
        return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : null;
    };
    const occ = discover(ROOT);
    const c = census(occ);

    if (has('--dry-run') || argv.length === 0) {
        process.stdout.write(`${renderCensus(c)}\nscanned: ${estateFiles(ROOT).length} roadmap file(s)\n`);
        return 0;
    }

    const keys = resolve_keys(ROOT);
    if (keys.length === 0) {
        process.stderr.write(
            '❌  no link-encryption key resolvable — refusing to classify.\n' +
                '    Without a key every token is unresolvable, and a classification of\n' +
                '    zero repositories would be indistinguishable from a real absence.\n' +
                '    Set secrets.link_encryption_key in .agent-settings.yml (project or\n' +
                '    user-global) or EVENT4U_LINK_KEY, then re-run.\n',
        );
        return 2;
    }

    const resolved = resolveAll(occ, keys);
    const entries = dedupe(resolved);

    if (has('--json')) {
        if (!process.stdout.isTTY && process.env.HARVEST_ALLOW_NONTTY !== '1') {
            process.stderr.write(
                '❌  --json prints resolved source URLs and stdout is not a terminal.\n' +
                    '    Refusing: a redirect would write plaintext source attribution to a\n' +
                    '    file. Run it at a terminal, or set HARVEST_ALLOW_NONTTY=1 knowing\n' +
                    '    the destination is inside the gitignored local area.\n',
            );
            return 2;
        }
        process.stdout.write(`${JSON.stringify({ census: c, entries }, null, 2)}\n`);
        return 0;
    }

    const manifestPath = path.resolve(ROOT, val('--manifest') ?? MANIFEST);
    const prior = has('--resume') ? readManifest(manifestPath) : [];
    const plan = planResume(entries, prior, has('--refresh'));
    const limit = Number(val('--limit') ?? '0');
    const runnable = plan.filter((d) => d.run);
    const capped = limit > 0 ? runnable.slice(0, limit) : runnable;

    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, renderManifest(plan.map((d) => d.entry)), 'utf-8');

    const counts = new Map<string, number>();
    for (const d of plan) {
        counts.set(d.entry.status, (counts.get(d.entry.status) ?? 0) + 1);
    }
    process.stdout.write(`${renderCensus(c)}\n`);
    process.stdout.write(`manifest: ${path.relative(ROOT, manifestPath)}\n`);
    for (const s of STATUSES) {
        const n = counts.get(s) ?? 0;
        if (n > 0) {
            process.stdout.write(`  ${s}: ${n}\n`);
        }
    }
    process.stdout.write(`to run: ${capped.length}${limit > 0 && runnable.length > capped.length ? ` (of ${runnable.length}, --limit ${limit})` : ''}\n`);
    return 0;
}

/** Fixture self-test — the shapes the roadmap's Phase 4 verifies name. */
export function selfTest(): number {
    const id1 = opaqueId('github.com/o/r', 'abc1234');
    if (id1 !== opaqueId('github.com/o/r', 'abc1234') || id1 === opaqueId('github.com/o/r', 'def5678')) {
        process.stderr.write('selfTest: opaque id is not stable-and-revision-sensitive\n');
        return 1;
    }
    if (canonicalize('https://example.org/guide/intro') !== null) {
        process.stderr.write('selfTest: a documentation URL classified as a repository\n');
        return 1;
    }
    process.stdout.write('selfTest: ok\n');
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(process.argv.includes('--self-test') ? selfTest() : main(process.argv.slice(2)));
}
