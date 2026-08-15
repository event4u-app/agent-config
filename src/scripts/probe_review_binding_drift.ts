#!/usr/bin/env node
/**
 * Phase 1 of `road-to-inbox-harvest-2026-08-c-evidence-lifecycle` — measure
 * which of the R2 manifest's THREE hash segments actually moves, and what
 * moved it.
 *
 * The premise under test: `agents/roadmaps/` sits inside the review scope
 * (`REVIEW_SCOPE_EXCLUDES` holds two entries, neither of them the roadmap
 * tree), so flipping one checkbox changes `scope_hash` and invalidates a
 * binding that no code change touched. That is a mechanism read from source.
 * Whether it is what has ACTUALLY been costing re-binds is an incidence
 * question, and only a measurement answers it.
 *
 * What this probe does NOT do: it never re-derives the scope definition. The
 * flag list, the exclude list and the hash come from `dispatch_r2_reviewer`,
 * so a scope this probe reports is a scope the gate would produce.
 *
 * Reading the segments:
 *
 *   - `scope_hash` — compared against the STORED `diff.patch` in the binding's
 *     `*.review-input/` directory. That file is the recorded revision's scope
 *     body, so its sha256 is the scope the reviewer actually read. A mismatch
 *     means the artefact was re-bound after dispatch and the stored input no
 *     longer describes what the artefact binds.
 *   - `roadmap_hash` / `ac_hash` — recomputed from the roadmap named in the
 *     manifest, at the working tree, following the file into `archive/` when
 *     the roadmap has since closed.
 *
 * Attribution: for every binding whose `scope_hash` moved, walk the commits
 * that touched the findings artefact, find the commit where the recorded
 * `scope_hash` changed value, and report the in-scope paths that changed
 * between that commit and its predecessor. Those paths are what moved the
 * hash. Paths are classified `roadmap` / `docs` / `agents-other` / `code`.
 *
 * Output: `agents/evidence/analysis/review-binding-drift.md` with `--write`,
 * stdout otherwise. Exit 0 always — this measures, it does not gate.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    extractAcceptanceCriteria,
    parseManifest,
    reviewScopeDiffArgs,
    reviewScopeNameOnlyArgs,
    sha256,
} from './dispatch_r2_reviewer.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const REVIEWS_DIR = path.join(ROOT, 'agents', 'evidence', 'reviews');
const OUT_REL = path.join('agents', 'evidence', 'analysis', 'review-binding-drift.md');

/**
 * The release span the roadmap asks about by name ("the four 12.0.0-era
 * re-binds"). Derived from tags rather than a hardcoded commit list so the
 * section stays correct if the era's boundaries are re-cut, and skipped
 * entirely where the tags do not resolve.
 */
const RELEASE_ERA = { from: '11.0.0', to: '12.0.0' };

type SegmentVerdict = 'same' | 'moved' | 'none' | 'no-input' | 'missing' | 'prose-bound';
type PathClass = 'roadmap' | 'docs' | 'agents-other' | 'code';

/**
 * What moved a binding's scope hash.
 *
 *   - `code` — at least one code path changed between the two binding states.
 *     The review correctly noticed it; this churn is the gate working.
 *   - `non-code` — every changed path was roadmap, dashboard, docs, or other
 *     `agents/` content. This is the class the roadmap's Phase 2 would address.
 *   - `base-moved` — NO in-scope path changed at all, yet the hash differs.
 *     The scope is `base...HEAD`, so merging the trunk into the branch moves
 *     the merge base and rewrites the diff without anyone touching a reviewed
 *     file. Counting these as `code` would overstate the gate's usefulness;
 *     counting them as `non-code` would overstate the roadmap mechanism.
 */
type RebindCause = 'code' | 'non-code' | 'base-moved';

interface Attribution {
    /** Commit at which the artefact's `scope_hash` changed value. */
    commit: string;
    subject: string;
    /** In-scope paths that changed since the previous binding state. */
    paths: string[];
    classes: PathClass[];
    cause: RebindCause;
}

interface Row {
    slug: string;
    scope: SegmentVerdict;
    roadmap: SegmentVerdict;
    ac: SegmentVerdict;
    roadmapPath: string;
    dispatched: string;
    /** Every recorded re-bind of this artefact, newest first. */
    rebinds: Attribution[];
    note: string;
}

/** `git`, but a failure is an answer. stderr is swallowed: asking a commit for
 *  a file it predates is a normal outcome here, not a fault to report. */
function gitOrNull(...args: string[]): string | null {
    try {
        return execFileSync('git', args, {
            cwd: ROOT,
            encoding: 'utf-8',
            maxBuffer: 256 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return null;
    }
}

/**
 * `agents/roadmaps-progress.md` is the generated dashboard, so it counts as
 * roadmap content even though it sits beside the directory rather than in it —
 * it is regenerated on every roadmap touch, which is precisely why a single
 * checkbox produces two in-scope file changes.
 */
/**
 * The scope hash an artefact binds, and where it was found.
 *
 * A SKIP / honest-null artefact carries no `context-manifest` block — its
 * scope hash lives in the declaration prose (`… scope <64-hex>, declared …`).
 * Reading only the manifest would therefore drop 11 of the 52 artefacts in
 * this tree from the measurement, and they are not a random 11: the skip
 * grammar asserts "no code surface for this completion", so the population
 * excluded is exactly the one where a non-code re-bind is most likely. A
 * ratio computed over manifests alone would have been biased in the direction
 * of its own conclusion.
 */
function scopeHashOf(text: string): { hash: string; source: 'manifest' | 'prose' } | null {
    const manifest = parseManifest(text);
    if (manifest !== null) return { hash: manifest.scope_hash, source: 'manifest' };
    const prose = /\bscope ([0-9a-f]{64})\b/.exec(text);
    return prose === null ? null : { hash: prose[1] as string, source: 'prose' };
}

function classifyPath(p: string): PathClass {
    if (p.startsWith('agents/roadmaps/') || p === 'agents/roadmaps-progress.md') return 'roadmap';
    if (p.startsWith('docs/')) return 'docs';
    if (p.startsWith('agents/')) return 'agents-other';
    return 'code';
}

/**
 * Resolve the roadmap named in a manifest against the working tree, following
 * it into `archive/` — a roadmap that closed since the review was dispatched
 * moved, and reporting `missing` for it would count a rename as drift.
 */
function resolveRoadmap(rel: string): string | null {
    const direct = path.join(ROOT, rel);
    if (fs.existsSync(direct)) return direct;
    const base = path.basename(rel);
    for (const sub of ['archive', 'skipped', 'later']) {
        const candidate = path.join(ROOT, 'agents', 'roadmaps', sub, base);
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

/**
 * Every commit that changed the artefact's `scope_hash`, newest first, each
 * carrying the in-scope paths that moved it.
 *
 * The span for a transition ends at the PREVIOUS commit that touched the
 * artefact, not at the transition's own parent. A re-bind is frequently its
 * own commit carrying nothing but the artefact — and the artefact sits under
 * `agents/evidence/reviews`, which the scope excludes, so a parent-to-child
 * diff of that commit is EMPTY and would attribute the re-bind to nothing.
 * What actually moved the hash is everything that landed between the two
 * binding states.
 *
 * An artefact introduced in a single commit already carrying its final hash
 * has no earlier state to measure against and yields an empty list.
 */
function transitions(findingsRel: string): Attribution[] {
    const log = gitOrNull('log', '--format=%H', '--', findingsRel);
    if (log === null) return [];
    const commits = log.trim().split('\n').filter(Boolean); // newest first

    const hashAt = (commit: string): string | null => {
        const blob = gitOrNull('show', `${commit}:${findingsRel}`);
        if (blob === null) return null;
        return scopeHashOf(blob)?.hash ?? null;
    };

    const found: Attribution[] = [];
    for (let i = 0; i < commits.length - 1; i++) {
        const commit = commits[i] as string;
        const previousState = commits[i + 1] as string;
        const now = hashAt(commit);
        const before = hashAt(previousState);
        if (now === null || before === null || now === before) continue;

        const names = gitOrNull(...reviewScopeNameOnlyArgs(previousState, commit));
        if (names === null) continue;
        const paths = names.trim().split('\n').filter(Boolean);
        const classes = [...new Set(paths.map(classifyPath))];
        const cause: RebindCause =
            paths.length === 0 ? 'base-moved' : classes.includes('code') ? 'code' : 'non-code';
        found.push({
            commit: commit.slice(0, 9),
            subject: (gitOrNull('log', '--format=%s', '-1', commit) ?? '').trim(),
            paths,
            classes,
            cause,
        });
    }
    return found;
}

function buildRows(): Row[] {
    const files = fs
        .readdirSync(REVIEWS_DIR)
        .filter((f) => f.endsWith('.findings.md'))
        .sort();

    const rows: Row[] = [];
    for (const file of files) {
        const slug = file.replace(/\.findings\.md$/, '');
        const abs = path.join(REVIEWS_DIR, file);
        const rel = path.posix.join('agents/evidence/reviews', file);
        const text = fs.readFileSync(abs, 'utf-8');
        const manifest = parseManifest(text);
        if (manifest === null) {
            const prose = scopeHashOf(text);
            rows.push({
                slug,
                scope: prose === null ? 'missing' : 'prose-bound',
                roadmap: 'none',
                ac: 'none',
                roadmapPath: '—',
                dispatched: '—',
                rebinds: prose === null ? [] : transitions(rel),
                note: prose === null ? 'no scope hash at all' : 'skip artefact — scope hash in prose',
            });
            continue;
        }

        // scope segment — the stored review input IS the recorded revision.
        const patch = path.join(REVIEWS_DIR, `${slug}.review-input`, 'diff.patch');
        let scope: SegmentVerdict;
        if (!fs.existsSync(patch)) {
            scope = 'no-input';
        } else {
            scope = sha256(fs.readFileSync(patch, 'utf-8')) === manifest.scope_hash ? 'same' : 'moved';
        }

        // roadmap + ac segments — recomputed at the working tree.
        let roadmap: SegmentVerdict = 'none';
        let ac: SegmentVerdict = 'none';
        let note = '';
        if (manifest.roadmap !== 'none') {
            const resolved = resolveRoadmap(manifest.roadmap);
            if (resolved === null) {
                roadmap = 'missing';
                ac = 'missing';
                note = 'roadmap not found in tree';
            } else {
                const text = fs.readFileSync(resolved, 'utf-8');
                roadmap = sha256(text) === manifest.roadmap_hash ? 'same' : 'moved';
                const acText = extractAcceptanceCriteria(text);
                ac =
                    manifest.ac_hash === 'none'
                        ? 'none'
                        : sha256(acText) === manifest.ac_hash
                          ? 'same'
                          : 'moved';
                if (path.dirname(resolved) !== path.dirname(path.join(ROOT, manifest.roadmap))) {
                    note = 'roadmap archived since dispatch';
                }
            }
        }

        rows.push({
            slug,
            scope,
            roadmap,
            ac,
            roadmapPath: manifest.roadmap,
            dispatched: manifest.dispatched,
            rebinds: transitions(rel),
            note,
        });
    }
    return rows;
}

type Tier = 'active' | 'recent' | 'archived' | 'unknown';

interface Retention {
    slug: string;
    tier: Tier;
    bytes: number;
    /** Head revision the review was dispatched at, read from `prompt.md`. */
    head: string | null;
    headReachable: boolean;
    /** How the stored patch was re-derived, or why it could not be. */
    reproducible: string;
}

function dirBytes(dir: string): number {
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        total += entry.isDirectory() ? dirBytes(p) : fs.statSync(p).size;
    }
    return total;
}

/**
 * Attempt to RE-DERIVE the stored `diff.patch` and report what happened.
 *
 * The manifest records no base revision — only `prompt.md` names the head the
 * review was dispatched at — so reproducibility cannot be asserted from the
 * record alone; it has to be tried. Two base candidates are attempted, in the
 * order that makes them meaningful:
 *
 *   1. The first parent of the merge commit that brought the head into the
 *      trunk. That IS the trunk as it stood at merge time, which is what
 *      `base...HEAD` resolved against for a branch that has since landed.
 *   2. `origin/main` as it stands now — correct only for a branch not yet
 *      merged, where the merge base has not moved.
 *
 * A patch that matches under neither is not proven irreproducible in
 * principle; it is unproven, which is the only honest verdict available and
 * the one that keeps the stored copy.
 */
function tryReproduce(head: string, patchSha: string): string {
    const candidates: Array<{ base: string; how: string }> = [];

    const merge = gitOrNull('rev-list', '--ancestry-path', '--merges', `${head}..origin/main`);
    const mergeCommits = (merge ?? '').trim().split('\n').filter(Boolean);
    const firstMerge = mergeCommits[mergeCommits.length - 1];
    if (firstMerge !== undefined) {
        const parent = gitOrNull('rev-parse', `${firstMerge}^1`);
        if (parent !== null) {
            candidates.push({ base: parent.trim(), how: `trunk at merge \`${firstMerge.slice(0, 9)}\`` });
        }
    }
    candidates.push({ base: 'origin/main', how: 'current `origin/main`' });

    for (const c of candidates) {
        const diff = gitOrNull(...reviewScopeDiffArgs(c.base, head));
        if (diff !== null && sha256(diff) === patchSha) return `yes — ${c.how}`;
    }
    return 'no — not re-derivable from the recorded head alone';
}

function retention(rows: Row[]): Retention[] {
    const out: Retention[] = [];
    for (const r of rows) {
        const dir = path.join(REVIEWS_DIR, `${r.slug}.review-input`);
        if (!fs.existsSync(dir)) continue;

        const promptPath = path.join(dir, 'prompt.md');
        const prompt = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf-8') : '';
        const head = /branch head ([0-9a-f]{40})/.exec(prompt)?.[1] ?? null;
        const headReachable = head !== null && gitOrNull('cat-file', '-e', head) !== null;

        let tier: Tier = 'unknown';
        if (head !== null && headReachable) {
            const merged = gitOrNull('merge-base', '--is-ancestor', head, 'origin/main') !== null;
            tier = merged ? 'archived' : r.scope === 'same' ? 'active' : 'recent';
        }

        const patchPath = path.join(dir, 'diff.patch');
        const patchSha = fs.existsSync(patchPath)
            ? sha256(fs.readFileSync(patchPath, 'utf-8'))
            : null;

        out.push({
            slug: r.slug,
            tier,
            bytes: dirBytes(dir),
            head,
            headReachable,
            reproducible:
                head === null
                    ? 'no — no head revision recorded'
                    : !headReachable
                      ? 'no — recorded head unreachable (history rewritten or pruned)'
                      : patchSha === null
                        ? 'n/a — no stored patch'
                        : tryReproduce(head, patchSha),
        });
    }
    return out;
}

/**
 * Abbreviated commits in the release era, or `null` when the tags do not
 * resolve — a consumer checkout carries neither tag and must not fail here.
 */
function eraCommits(): Set<string> | null {
    const log = gitOrNull('log', '--format=%H', `${RELEASE_ERA.from}..${RELEASE_ERA.to}`);
    if (log === null) return null;
    return new Set(
        log
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((c) => c.slice(0, 9)),
    );
}

function render(rows: Row[]): string {
    const withInput = rows.filter((r) => r.scope === 'same' || r.scope === 'moved');
    const movedScope = rows.filter((r) => r.scope === 'moved');

    // The ratio is counted over re-bind EVENTS, not over bindings: a binding
    // re-bound three times cost three re-binds, and the question Phase 2 turns
    // on is what has been costing them.
    const events = rows.flatMap((r) => r.rebinds.map((a) => ({ slug: r.slug, a })));
    const nonCode = events.filter((e) => e.a.cause === 'non-code');
    const code = events.filter((e) => e.a.cause === 'code');
    const baseMoved = events.filter((e) => e.a.cause === 'base-moved');

    const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)} %`);

    const out: string[] = [];
    out.push('## Measurement');
    out.push('');
    out.push('Generated by `./scripts-run src/scripts/probe_review_binding_drift --write`.');
    out.push('Re-run it rather than editing the tables by hand; every number below is derived.');
    out.push('Everything outside the two markers is preserved across runs.');
    out.push('');
    out.push(`- Findings artefacts scanned: **${rows.length}**`);
    out.push(`- Carrying a stored \`review-input/diff.patch\`: **${withInput.length}**`);
    out.push(
        `- \`scope_hash\` still reproduces that stored input: **${withInput.length - movedScope.length}**`,
    );
    out.push(`- \`scope_hash\` moved after dispatch: **${movedScope.length}**`);
    out.push(`- Recorded re-bind events across all artefacts: **${events.length}**`);
    out.push('');
    out.push('## The ratio Phase 2 turns on');
    out.push('');
    out.push('Counted per re-bind **event** — one artefact re-bound three times cost three');
    out.push('re-binds. A re-bind is attributed to the in-scope paths that changed between');
    out.push('the previous binding state and the commit that moved the hash.');
    out.push('');
    out.push('| Cause of the re-bind | Events | Share |');
    out.push('|---|---:|---:|');
    out.push(
        `| Code changed — the review correctly noticed it | ${code.length} | ${pct(code.length, events.length)} |`,
    );
    out.push(
        `| Only non-code paths changed (roadmap / dashboard / docs / other \`agents/\`) | ${nonCode.length} | ${pct(nonCode.length, events.length)} |`,
    );
    out.push(
        `| No in-scope path changed at all — the merge base moved | ${baseMoved.length} | ${pct(baseMoved.length, events.length)} |`,
    );
    out.push('');
    out.push('The third row is a cause the roadmap did not anticipate and Phase 2 would not');
    out.push('address: the scope is `base...HEAD`, so merging the trunk into a branch rewrites');
    out.push('the diff — and therefore the hash — without anyone touching a reviewed file. A');
    out.push('segment-aware verdict consults roadmap and AC content; neither moved in these.');
    out.push('');
    out.push('## Non-code-only re-binds, in full');
    out.push('');
    if (nonCode.length === 0) {
        out.push('None. No binding in the tree was invalidated by a change that touched no code.');
    } else {
        for (const e of nonCode) {
            out.push(`- \`${e.slug}\` @ \`${e.a.commit}\` — ${e.a.subject}`);
            out.push(`  - paths: ${e.a.paths.join(', ')}`);
        }
    }
    out.push('');
    const era = eraCommits();
    out.push(`## The ${RELEASE_ERA.to}-era re-binds`);
    out.push('');
    if (era === null) {
        out.push(
            `Tags \`${RELEASE_ERA.from}\` / \`${RELEASE_ERA.to}\` do not resolve here — section skipped.`,
        );
    } else {
        const inEra = events.filter((e) => era.has(e.a.commit));
        out.push(
            `Re-bind events landing in \`${RELEASE_ERA.from}..${RELEASE_ERA.to}\`: **${inEra.length}**.`,
        );
        out.push('');
        if (inEra.length === 0) {
            out.push('None.');
        } else {
            out.push('| Binding | Commit | Caused by | Paths |');
            out.push('|---|---|---|---|');
            for (const e of inEra) {
                out.push(
                    `| \`${e.slug}\` | \`${e.a.commit}\` | ${e.a.cause} | ${e.a.paths.join(', ') || '(none in scope)'} |`,
                );
            }
        }
    }
    out.push('');
    out.push('## Per-binding segment verdicts');
    out.push('');
    out.push('`same` = segment reproduces its recorded hash · `moved` = it does not ·');
    out.push('`none` = the manifest recorded none · `no-input` = no stored `review-input/`.');
    out.push('');
    out.push('| Binding | scope | roadmap | ac | re-binds | causes | note |');
    out.push('|---|---|---|---|---:|---|---|');
    for (const r of rows) {
        const causes =
            r.rebinds.length === 0
                ? '—'
                : [...new Set(r.rebinds.map((a) => a.cause))].join(', ');
        out.push(
            `| \`${r.slug}\` | ${r.scope} | ${r.roadmap} | ${r.ac} | ${r.rebinds.length} | ${causes} | ${r.note || '—'} |`,
        );
    }
    out.push('');
    const ret = retention(rows);
    const mb = (n: number): string => `${(n / 1024 / 1024).toFixed(2)} MB`;
    const byTier = (t: Tier): Retention[] => ret.filter((r) => r.tier === t);
    const proven = ret.filter((r) => r.reproducible.startsWith('yes'));
    const unproven = ret.filter((r) => r.reproducible.startsWith('no'));

    out.push('## Retention tiers');
    out.push('');
    out.push('`active` = the artefact still binds the scope its stored input records ·');
    out.push('`recent` = re-bound, and the reviewed head is not yet in the trunk ·');
    out.push('`archived` = the reviewed head is an ancestor of `origin/main`.');
    out.push('');
    out.push('| Tier | Dirs | Bytes |');
    out.push('|---|---:|---:|');
    for (const t of ['active', 'recent', 'archived', 'unknown'] as Tier[]) {
        const g = byTier(t);
        if (g.length > 0) out.push(`| ${t} | ${g.length} | ${mb(g.reduce((s, r) => s + r.bytes, 0))} |`);
    }
    out.push(`| **total** | **${ret.length}** | **${mb(ret.reduce((s, r) => s + r.bytes, 0))}** |`);
    out.push('');
    out.push('### Regeneration guarantee');
    out.push('');
    const provenBytes = proven.reduce((s, r) => s + r.bytes, 0);
    const totalBytes = ret.reduce((s, r) => s + r.bytes, 0);
    out.push(`Re-derived successfully: **${proven.length}** of ${ret.length} — ${mb(provenBytes)}.`);
    out.push(
        `Not re-derivable from the record: **${unproven.length}** — ${mb(totalBytes - provenBytes)}, which stays regardless.`,
    );
    out.push('');
    out.push(
        'That bounds the `evidence-compaction-approval` blocker: the most any compaction',
        `could reclaim is **${mb(provenBytes)}** of ${mb(totalBytes)} (${((provenBytes / totalBytes) * 100).toFixed(0)} %), and only`,
        'from the directories listed as re-derivable below.',
    );
    out.push('');
    out.push('A stored patch counts as reproducible only when it was ACTUALLY re-derived');
    out.push('here, byte-for-byte. The manifest records no base revision, so reproducibility');
    out.push('is never assertable from the record alone — it is attempted, and the attempt is');
    out.push('what the verdict reports.');
    out.push('');
    out.push('**Irreproducible directories — these patches are the only copy and stay:**');
    out.push('');
    if (unproven.length === 0) {
        out.push('None.');
    } else {
        for (const r of unproven) {
            out.push(`- \`${r.slug}.review-input\` (${mb(r.bytes)}, ${r.tier}) — ${r.reproducible}`);
        }
    }
    out.push('');
    out.push('| Directory | Tier | Bytes | Re-derivable |');
    out.push('|---|---|---:|---|');
    for (const r of ret) {
        out.push(
            `| \`${r.slug}.review-input\` | ${r.tier} | ${(r.bytes / 1024).toFixed(0)} kB | ${r.reproducible} |`,
        );
    }
    out.push('');
    out.push('## Every re-bind event');
    out.push('');
    out.push('| Binding | Commit | Subject | Path classes |');
    out.push('|---|---|---|---|');
    for (const e of events) {
        out.push(
            `| \`${e.slug}\` | \`${e.a.commit}\` | ${e.a.subject} | ${e.a.classes.join(', ') || '(none in scope)'} |`,
        );
    }
    out.push('');
    return out.join('\n');
}

const BEGIN = '<!-- BEGIN probe_review_binding_drift -->';
const END = '<!-- END probe_review_binding_drift -->';

/**
 * Splice the generated tables into the target between the two markers,
 * leaving everything outside them untouched.
 *
 * The measurement and the DECISION it feeds live in the same file by the
 * roadmap's own step 2.1 ("write the decision into the analysis file either
 * way"), and a decision is prose a human owns. Rewriting the whole file would
 * delete it on the next re-run, which would make the numbers re-derivable and
 * the conclusion disposable — the wrong way round.
 */
function splice(existing: string | null, generated: string): string {
    const block = `${BEGIN}\n\n${generated}\n${END}\n`;
    if (existing === null) return block;
    const start = existing.indexOf(BEGIN);
    const end = existing.indexOf(END);
    if (start === -1 || end === -1 || end < start) {
        // No markers yet: keep the human prose, append the block.
        return `${existing.trimEnd()}\n\n${block}`;
    }
    return existing.slice(0, start) + block + existing.slice(end + END.length).replace(/^\n/, '');
}

const write = process.argv.includes('--write');
const text = render(buildRows());
if (write) {
    const target = path.join(ROOT, OUT_REL);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : null;
    fs.writeFileSync(target, splice(existing, text), 'utf-8');
    process.stdout.write(`wrote ${OUT_REL}\n`);
} else {
    process.stdout.write(text);
}
