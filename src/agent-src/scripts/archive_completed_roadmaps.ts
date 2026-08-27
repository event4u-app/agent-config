#!/usr/bin/env tsx
/**
 * Archive completed roadmaps — the PR-gate (council 2026-06-14).
 *
 * TypeScript twin of `src/agent-src/scripts/archive_completed_roadmaps.py`
 * (ADR-200, Python→TypeScript migration). The CLI contract is mirrored EXACTLY
 * — the `--all` / `--base` / `--dry-run` flags, the argparse usage / error text
 * (`-h`/`--help` → exit 0, unknown arg → exit 2), the `git`-shell-out semantics
 * (argv / cwd / returncode / stdout / stderr captured via `spawnSync`, matching
 * `subprocess.run(..., capture_output=True, text=True)`), byte-identical stdout
 * (the `ℹ️` / `✅` summary) and stderr (the `⚠️` warnings), the
 * `urp.collect()` completion criterion, and exit code 0. snake_case kept.
 *
 * A roadmap that has reached `count_open == 0` and `count_deferred == 0` is
 * **complete**. This sweep moves it to `agents/roadmaps/archive/`, rewrites
 * inbound references (`agents/roadmaps/<x>.md` → `agents/roadmaps/archive/<x>.md`)
 * across tracked files so links never break, and regenerates the dashboard.
 *
 * It replaces the old **merge-gate** (keep one item open + a manual post-merge
 * archival step that got forgotten — leaving finished roadmaps to rot in `main`)
 * with a deterministic **PR-gate**: `/create-pr` runs this before the PR is
 * created, so the roadmap lands already-archived in the PR and merges clean.
 *
 * Default `--changed-only`: only archive roadmaps that appear in this branch's
 * history since it diverged from `origin/main` (`git log origin/main..HEAD`),
 * so a PR archives exactly the roadmaps it completed — never an unrelated complete
 * roadmap. `--all` archives every complete active roadmap. No agent-set
 * annotation is required — completion is detected from the checkbox counts.
 *
 * Usage:
 *     ./scripts-run src/scripts/archive_completed_roadmaps            # --changed-only (default)
 *     ./scripts-run src/scripts/archive_completed_roadmaps --all
 *     ./scripts-run src/scripts/archive_completed_roadmaps --base origin/main --dry-run
 *     ./scripts-run src/scripts/archive_completed_roadmaps --repo-root /path/to/proj
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)` →
 *   `spawnSync(cmd[0], cmd.slice(1), { cwd, encoding: 'utf-8' })`, wrapped in a
 *   `CompletedProcess`-shaped object. A spawn that fails to launch surfaces as
 *   `returncode = -1` with the error message on `stderr` (the Python path would
 *   raise; no test exercises a missing-git environment).
 * - The Python `sys.path.insert(0, …); import update_roadmap_progress as urp`
 *   becomes an eager static import of the `.ts` twin — same `collect()`
 *   surface, no observable difference.
 * - `_regen_dashboard` runs `[sys.executable, str(script)]`; the twin spawns
 *   the dashboard twin via the same `tsx` runtime so the regen + `git add`
 *   side effects match. It only fires on a non-dry-run with archived roadmaps.
 * - JSON is not emitted. `set[str]` (touched paths) → `Set<string>`; iteration
 *   order is never rendered, so the unordered semantics match.
 * - `process.exitCode` is set; `process.exit()` is never called. argparse
 *   usage errors throw `ArgparseExit(2)`; `-h`/`--help` throws `ArgparseExit(0)`.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { collect } from './update_roadmap_progress.js';

const _HERE = fileURLToPath(import.meta.url);

interface CompletedProcess {
    returncode: number;
    stdout: string;
    stderr: string;
}

class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`ArgparseExit(${code})`);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

/** subprocess.run(cmd, cwd=cwd, capture_output=True, text=True). */
function _run(cmd: string[], cwd: string): CompletedProcess {
    const res = spawnSync(cmd[0] as string, cmd.slice(1), { cwd, encoding: 'utf-8' });
    if (res.error) {
        return { returncode: -1, stdout: res.stdout ?? '', stderr: String(res.error.message ?? '') };
    }
    return {
        returncode: res.status === null ? -1 : res.status,
        stdout: res.stdout ?? '',
        stderr: res.stderr ?? '',
    };
}

function _repo_root(): string {
    const cp = _run(['git', 'rev-parse', '--show-toplevel'], process.cwd());
    return cp.returncode === 0 ? cp.stdout.trim() : process.cwd();
}

/** `str.splitlines()` over LF/CRLF/CR (subprocess text output). */
function _splitlines(s: string): string[] {
    if (s === '') return [];
    const parts = s.split(/\r\n|\r|\n/);
    if (parts.length && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/**
 * Repo-relative paths touched in any commit since divergence from base.
 *
 * Returns null when the base ref is unavailable — callers treat null as
 * "cannot scope, fall back to --all".
 */
function _branch_touched_paths(root: string, base: string): Set<string> | null {
    const cp = _run(
        ['git', 'log', `${base}..HEAD`, '--name-only', '--pretty=format:'],
        root,
    );
    if (cp.returncode !== 0) {
        return null;
    }
    const out = new Set<string>();
    for (const line of _splitlines(cp.stdout)) {
        const t = line.trim();
        if (t) {
            out.add(t);
        }
    }
    return out;
}

/**
 * Paths where a repo-relative path is DATA, not a live reference — so
 * rewriting it falsifies a record instead of keeping a link resolvable.
 *
 * Two classes, and the second is why this predicate exists at all:
 *
 * - `agents/evidence/**` — a committed record of what was true, or of what a
 *   reviewer was shown, at one point in time. Retroactively editing it makes it
 *   claim something that did not happen, which is the failure
 *   `evaluator-independence` exists to prevent ("the prompt ships with the
 *   verdict" is worthless if a later sweep can edit the prompt).
 * - `*.patch` anywhere — a patch's `diff --git a/… b/…` and `+++ b/…` lines are
 *   the payload. Rewriting them detaches the patch from the commit it records
 *   AND makes `git apply` target a path the diff never created.
 *
 * Measured 2026-08-11: archiving one roadmap rewrote four frozen artifacts
 * under `agents/evidence/reviews/`, including the `diff.patch` headers of a
 * recorded review input. Nothing caught it — the sweep reported it as
 * "4 ref(s) migrated", which reads like success.
 */
const _FROZEN_RECORD_PREFIXES: readonly string[] = ['agents/evidence/'];

/** Is `rel` a frozen record whose path strings must not be rewritten? */
export function _is_frozen_record(rel: string): boolean {
    const norm = rel.split(path.sep).join('/');
    return _FROZEN_RECORD_PREFIXES.some((p) => norm.startsWith(p)) || norm.endsWith('.patch');
}

/**
 * Rewrite full-path references `old_rel` → `new_rel` in tracked files.
 *
 * Only the exact repo-relative path is rewritten (bare-filename mentions are
 * left alone). The archived file's own path never matches because the search
 * string is the un-archived path. Frozen records are skipped — see
 * `_is_frozen_record`; a link left dangling in a historical record is correct,
 * because the record describes a tree that no longer exists.
 */
function _inbound_ref_rewrite(
    root: string,
    old_rel: string,
    new_rel: string,
    dry_run: boolean,
    tracked = true,
): string[] {
    const changed: string[] = [];
    // Tracked repo → `git grep` (fast, index-aware). Untracked fallback (gap A)
    // → walk the filesystem, since `git grep` only sees committed content and
    // would miss every inbound ref in a pre-first-commit consumer.
    let candidates: string[];
    if (tracked) {
        const grep = _run(['git', 'grep', '-l', '--', old_rel], root);
        if (grep.returncode === 1) {
            return changed; // no matches
        }
        candidates =
            grep.returncode === 0
                ? _splitlines(grep.stdout).map((l) => l.trim())
                : _fs_grep_files(root, old_rel); // git grep unusable → fs walk
    } else {
        candidates = _fs_grep_files(root, old_rel);
    }
    for (const line of candidates) {
        const rel = line.trim();
        if (!rel || rel === old_rel) {
            // skip the roadmap file itself
            continue;
        }
        if (_is_frozen_record(rel)) {
            // A record of a past state — rewriting it falsifies the record.
            continue;
        }
        const fp = path.join(root, rel);
        let text: string;
        try {
            text = fs.readFileSync(fp, { encoding: 'utf-8' });
        } catch {
            continue;
        }
        if (!text.includes(old_rel)) {
            continue;
        }
        if (!dry_run) {
            fs.writeFileSync(fp, _replaceAll(text, old_rel, new_rel), { encoding: 'utf-8' });
        }
        changed.push(rel);
    }
    return changed;
}

/** str.replace(old, new) — replace every occurrence (Python str.replace). */
function _replaceAll(text: string, oldStr: string, newStr: string): string {
    return text.split(oldStr).join(newStr);
}

interface MoveResult {
    /** the move (or dry-run no-op) succeeded */
    ok: boolean;
    /** the move went through `git mv` (tracked); false → plain filesystem
     *  rename was used because the repo has no commits / the file is untracked.
     *  The caller rewrites inbound refs on the filesystem (not via `git add`)
     *  when this is false. */
    tracked: boolean;
}

/**
 * Move `src_rel` → `dst_rel`, preferring `git mv`.
 *
 * Untracked-safe (road-to-roadmap-archival-robustness, gap A): a consumer that
 * closed a roadmap in a pre-first-commit / untracked working tree cannot use
 * `git mv` (it errors). Instead of printing `git mv failed` and leaving the
 * completed roadmap to rot in the active tree, fall back to a plain
 * `fs.renameSync`. The TS-only enhancement post-dates the deleted Python twin
 * (ADR-200), so there is no byte-parity obligation on this failure path.
 */
function _git_mv(root: string, src_rel: string, dst_rel: string, dry_run: boolean): MoveResult {
    const dst = path.join(root, dst_rel);
    if (dry_run) {
        return { ok: true, tracked: true };
    }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const cp = _run(['git', 'mv', src_rel, dst_rel], root);
    if (cp.returncode === 0) {
        return { ok: true, tracked: true };
    }
    // Fallback: untracked file or a repo with no commits — plain rename.
    try {
        fs.renameSync(path.join(root, src_rel), dst);
        return { ok: true, tracked: false };
    } catch {
        return { ok: false, tracked: false };
    }
}

/**
 * Repo-relative paths of files containing `needle`, by walking the filesystem.
 *
 * The untracked fallback for `_inbound_ref_rewrite`: `git grep` only sees
 * tracked content, so in a pre-first-commit consumer it misses every inbound
 * reference. Walk the tree (skipping `.git` / `node_modules` and obvious binary
 * trees), read text files, and match the literal path. Bounded by skipping the
 * heavy dirs; an untracked consumer's tree is small.
 */
function _fs_grep_files(root: string, needle: string): string[] {
    const SKIP = new Set(['.git', 'node_modules', '.augment', 'dist']);
    const hits: string[] = [];
    const walk = (dirAbs: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dirAbs, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (e.name.startsWith('.git') || SKIP.has(e.name)) {
                continue;
            }
            const abs = path.join(dirAbs, e.name);
            if (e.isDirectory()) {
                walk(abs);
            } else if (e.isFile() && /\.(md|json|ya?ml|ts|js|txt)$/.test(e.name)) {
                let text: string;
                try {
                    text = fs.readFileSync(abs, { encoding: 'utf-8' });
                } catch {
                    continue;
                }
                if (text.includes(needle)) {
                    hits.push(path.relative(root, abs).split(path.sep).join('/'));
                }
            }
        }
    };
    walk(root);
    return hits;
}

interface ArchiveRecord {
    roadmap: string;
    archived_to: string;
    refs_migrated: string[];
}


/** One `[~]` step and whatever resolution annotation follows it. */
export interface DeferredItem {
    /** The step text, trimmed, for the operator message. */
    text: string;
    /** `carried-to` / `merged-into`, or `null` when no annotation was found. */
    kind: 'carried-to' | 'merged-into' | null;
    /** Destination roadmap slug, or `null`. */
    destination: string | null;
}

/**
 * `<!-- deferred-resolution: carried-to=<slug> -->` — the resolved-deferral
 * annotation. `merged-into=<slug>` is the second accepted form.
 */
const DEFERRED_RESOLUTION_RE = /<!--\s*deferred-resolution:\s*(carried-to|merged-into)\s*=\s*([A-Za-z0-9._-]+)\s*-->/;

/** `- [~] …` — a deferred step, at any indent, with `-` or `*`. */
const DEFERRED_STEP_RE = /^[ \t]*[-*][ \t]+\[~\][ \t]*(.*)$/;
/** Any other checkbox, or a heading — where a step's block ends. */
const BLOCK_END_RE = /^[ \t]*[-*][ \t]+\[[ xX~-]\]|^#{1,6}[ \t]/;

/** Every `[~]` step in a roadmap, with the annotation that follows it (if any). */
export function parseDeferredItems(text: string): DeferredItem[] {
    const lines = text.split('\n');
    const out: DeferredItem[] = [];
    for (let i = 0; i < lines.length; i++) {
        const m = DEFERRED_STEP_RE.exec(lines[i] as string);
        if (m === null) continue;
        // The annotation may sit on the step line itself or anywhere in the
        // step's continuation block, which ends at the next checkbox or heading.
        let block = lines[i] as string;
        for (let j = i + 1; j < lines.length; j++) {
            if (BLOCK_END_RE.test(lines[j] as string)) break;
            block += '\n' + (lines[j] as string);
        }
        const a = DEFERRED_RESOLUTION_RE.exec(block);
        out.push({
            text: (m[1] ?? '').trim().slice(0, 120),
            kind: a === null ? null : (a[1] as 'carried-to' | 'merged-into'),
            destination: a === null ? null : (a[2] as string),
        });
    }
    return out;
}

/**
 * Decide whether a roadmap's `[~]` items are RESOLVED, per the AI council of
 * 2026-08-27 (2 seats, convergent on option (c)).
 *
 * Iron Law 3 says a deferral must be resolved before archival, and the
 * preservation test routes four dispositions to the council — but three of them
 * (carry to a follow-up, merge into existing work, restore to open) leave the
 * `[~]` glyph in place, and this sweep used to require `deferred === 0`
 * unconditionally. So a genuinely UNEXECUTABLE item — one needing elapsed time
 * rather than effort — had no council-reachable path to an archived roadmap, and
 * the only glyph that cleared the gate was `[-]`, which is owner-reserved AND
 * pinned to mean "won't happen at all". Using it for a carried item would make
 * cancellation and transfer indistinguishable to every later reader.
 *
 * **Fail-closed at every step**, which is the condition both seats attached to
 * their verdict: a bare `[~]` blocks, a malformed annotation blocks, a
 * destination that does not exist blocks, a destination that is itself archived
 * or skipped blocks, and a missing back-link blocks. The annotation is cheap to
 * write and must therefore be expensive to satisfy.
 *
 * NOT checked, and named rather than implied: that the destination's copy of the
 * criterion is faithful. Both seats asked for stable item identity over verbatim
 * text matching, and neither a text match nor an id exists today — the back-link
 * plus the source-slug mention is the strongest link this sweep can verify
 * without inventing an identity scheme. The reviewer of the carry still reads it.
 *
 * @returns `problems` empty ⇒ every deferral is resolved and archival may proceed.
 */
export function deferralProblems(root: string, rel: string, text: string): string[] {
    const sourceSlug = rel.replace(/\.md$/, '');
    const problems: string[] = [];
    for (const item of parseDeferredItems(text)) {
        const label = item.text === '' ? '(unnamed step)' : item.text;
        if (item.kind === null || item.destination === null) {
            problems.push(
                `deferred step ${JSON.stringify(label)} carries no ` +
                    '`<!-- deferred-resolution: carried-to=<slug> -->` annotation',
            );
            continue;
        }
        // Active or parked are both live. Archived and skipped are not: carrying
        // an item into a dead roadmap is the silent loss the annotation exists
        // to prevent, and it is exactly the "broken promise" case one seat asked
        // to be detectable.
        const candidates = [
            path.join(root, 'agents', 'roadmaps', `${item.destination}.md`),
            path.join(root, 'agents', 'roadmaps', 'later', `${item.destination}.md`),
        ];
        const found = candidates.find((c) => fs.existsSync(c));
        if (found === undefined) {
            const dead = ['archive', 'skipped'].find((d) =>
                fs.existsSync(path.join(root, 'agents', 'roadmaps', d, `${item.destination ?? ''}.md`)),
            );
            problems.push(
                dead === undefined
                    ? `deferred step ${JSON.stringify(label)} names destination \`${item.destination}\`, which does not exist`
                    : `deferred step ${JSON.stringify(label)} names destination \`${item.destination}\`, which is in \`${dead}/\` — a dead roadmap cannot receive a carried item`,
            );
            continue;
        }
        const destText = fs.readFileSync(found, 'utf-8');
        if (item.kind === 'carried-to' && !new RegExp(`^parent_roadmap:[ \t]*${sourceSlug}[ \t]*$`, 'm').test(destText)) {
            problems.push(
                `destination \`${item.destination}\` carries no \`parent_roadmap: ${sourceSlug}\` back-link — ` +
                    'the link must be verifiable from both ends',
            );
            continue;
        }
        if (!destText.includes(sourceSlug)) {
            problems.push(
                `destination \`${item.destination}\` never mentions \`${sourceSlug}\` — the carried item is not traceable back`,
            );
        }
    }
    return problems;
}

/** Archive every complete active roadmap: no open steps, and every `[~]` resolved. */
function archive_completed(
    root: string,
    opts: { changed_only: boolean; base: string; dry_run: boolean },
): ArchiveRecord[] {
    const { changed_only, base, dry_run } = opts;
    const roadmap_root = path.join(root, 'agents', 'roadmaps');
    if (!_isDir(roadmap_root)) {
        return [];
    }
    const touched = changed_only ? _branch_touched_paths(root, base) : null;
    // changed_only requested but base unavailable → conservative: archive nothing.
    if (changed_only && touched === null) {
        process.stderr.write(
            `  ⚠️  cannot resolve \`${base}\` — skipping the changed-only ` +
                'archival sweep (run with --all to force).\n',
        );
        return [];
    }

    const archived: ArchiveRecord[] = [];
    for (const stats of collect(roadmap_root)) {
        if (stats.open_ !== 0) {
            continue; // not complete
        }
        // A `[~]` no longer blocks unconditionally: it blocks unless it carries a
        // validated resolution annotation. See `deferralProblems` for why, and
        // for every way that check fails closed.
        if (stats.deferred !== 0) {
            const abs = path.join(roadmap_root, stats.rel);
            const problems = deferralProblems(root, stats.rel, fs.readFileSync(abs, 'utf-8'));
            if (problems.length > 0) {
                process.stderr.write(
                    `  ⚠️  ${stats.rel}: ${problems.length} unresolved deferral(s) — not archived.\n`,
                );
                for (const p of problems) process.stderr.write(`        · ${p}\n`);
                continue;
            }
        }
        // An unresolved blocker outlives its steps. Closing every box does not
        // answer a question the roadmap raised for a human, and archiving on
        // step-count alone is how `b-highlights-mechanism` left the active tree
        // unanswered in the 9.29 roadmap — four releases before the failure it
        // predicted shipped in the 9.36.0 changelog head. Same discipline
        // `roadmap-progress-sync` Iron Law 3 applies to `[~]` steps: a roadmap
        // carrying an open decision stays visible until the decision is made.
        const open_blockers = stats.open_blockers;
        if (open_blockers.length > 0) {
            const ids = open_blockers.map((b) => b.id).join(', ');
            process.stderr.write(
                `  ⚠️  ${stats.rel}: all steps closed but ${open_blockers.length} ` +
                    `blocker(s) still open (${ids}) — not archived. Resolve them, ` +
                    'or record the decision, then re-run the sweep.\n',
            );
            continue;
        }
        const old_rel = `agents/roadmaps/${stats.rel}`;
        if (changed_only && !(touched as Set<string>).has(old_rel)) {
            continue; // complete, but not this branch's work
        }
        const new_rel = `agents/roadmaps/archive/${stats.rel}`;
        const mv = _git_mv(root, old_rel, new_rel, dry_run);
        if (!mv.ok) {
            process.stderr.write(`  ⚠️  could not archive ${old_rel} (mv failed)\n`);
            continue;
        }
        const refs = _inbound_ref_rewrite(root, old_rel, new_rel, dry_run, mv.tracked);
        // Stage rewritten refs only in a tracked repo; an untracked consumer's
        // files are not in the index, so the filesystem rewrite is the whole job.
        if (!dry_run && refs.length && mv.tracked) {
            _run(['git', 'add', '--', ...refs], root);
        }
        archived.push({ roadmap: old_rel, archived_to: new_rel, refs_migrated: refs });
    }
    return archived;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _regen_dashboard(root: string, dry_run: boolean): void {
    if (dry_run) {
        return;
    }
    const script = path.join(path.dirname(_HERE), 'update_roadmap_progress.ts');
    // Python: `_run([sys.executable, str(script)], root)`; the twin spawns the
    // dashboard generator twin through the same `tsx` runtime, cwd=root.
    _runTwin(root, script);
    // The dashboard is NOT staged. It is gitignored in this repository, and
    // `git add -- <ignored-path>` exits 1 with "The following paths are ignored"
    // -- a code `_run` returns and this call site discarded, so the previous
    // `git add` here was a silent no-op from the moment the file was untracked
    // (2026-08-21) and nothing objected. Regenerating it is still correct; the
    // developer reads it on disk, and `task roadmap-progress-check` compares a
    // present copy against a fresh render.
}

/**
 * Rebuild the archive index after a move, when the builder is present.
 *
 * The sweep is the one operation that changes what `agents/roadmaps/archive/`
 * contains, so it is the one operation that can leave the generated index
 * stale — and the drift gate on that index runs in the same PR the sweep runs
 * in. Regenerating here keeps the two from disagreeing by construction rather
 * than by remembering.
 *
 * `build_archive_index` is package-internal (`src/scripts/`), while this sweep
 * is projected into consumer installs that carry no such script. Absent
 * builder → nothing to regenerate, and that is a normal consumer state, not a
 * failure. The spawn is best-effort for the same reason `_regen_dashboard` is:
 * a sweep that archived correctly must not report failure because a
 * regeneration could not run.
 */
function _regen_archive_index(root: string, dry_run: boolean): void {
    if (dry_run) {
        return;
    }
    const script = path.join(root, 'src', 'scripts', 'build_archive_index.ts');
    if (!_isFile(script)) {
        return;
    }
    _runTwin(root, script);
    for (const rel of ['agents/roadmaps/archive/INDEX.md', 'agents/roadmaps/archive/index.json']) {
        if (_isFile(path.join(root, rel))) {
            _run(['git', 'add', '--', rel], root);
        }
    }
}

/** Spawn the dashboard generator twin (tsx) with cwd=root, mirroring `[sys.executable, script]`. */
function _runTwin(root: string, script: string): void {
    // Python uses `sys.executable` — the interpreter already running this
    // script, which is always present. The TS analog is the `tsx` that owns
    // THIS twin, found by walking up from the script's own dir (matching the
    // canonical `run.ts` resolver), NOT the `git rev-parse` consumer-repo root
    // (which need not carry a node_modules). Fall back to `npx tsx`.
    const binName = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
    let dir = path.dirname(_HERE);
    for (;;) {
        const candidate = path.join(dir, 'node_modules', '.bin', binName);
        if (fs.existsSync(candidate)) {
            spawnSync(candidate, [script], { cwd: root, encoding: 'utf-8' });
            return;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    spawnSync('npx', ['tsx', script], { cwd: root, encoding: 'utf-8' });
}

const _PROG = 'archive_completed_roadmaps.py';

function _usage(): string {
    return `usage: ${_PROG} [-h] [--all] [--base BASE] [--dry-run] [--repo-root REPO_ROOT]\n`;
}

interface Args {
    all: boolean;
    base: string;
    dry_run: boolean;
    repo_root: string | null;
}

function _parseArgs(argv: readonly string[]): Args {
    let all = false;
    let base = 'origin/main';
    let dry_run = false;
    let repo_root: string | null = null;
    const emitError = (msg: string): never => {
        process.stderr.write(_usage());
        process.stderr.write(`${_PROG}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };
    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '-h' || tok === '--help') {
            process.stdout.write(_usage());
            throw new ArgparseExit(0);
        } else if (tok === '--all') {
            all = true;
            i += 1;
        } else if (tok === '--dry-run') {
            dry_run = true;
            i += 1;
        } else if (tok === '--base') {
            const val = argv[i + 1];
            if (val === undefined) {
                emitError('argument --base: expected one argument');
            }
            base = val as string;
            i += 2;
        } else if (tok.startsWith('--base=')) {
            base = tok.slice('--base='.length);
            i += 1;
        } else if (tok === '--repo-root') {
            const val = argv[i + 1];
            if (val === undefined) {
                emitError('argument --repo-root: expected one argument');
            }
            repo_root = val as string;
            i += 2;
        } else if (tok.startsWith('--repo-root=')) {
            repo_root = tok.slice('--repo-root='.length);
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    return { all, base, dry_run, repo_root };
}

function main(argv?: readonly string[]): number {
    const ns = _parseArgs(argv ?? process.argv.slice(2));

    // An explicit `--repo-root` wins over the `git rev-parse` resolution. The
    // dashboard generator passes it so a monorepo sub-project sweep cannot walk
    // up to the enclosing repo and archive the PARENT's roadmaps.
    const root = ns.repo_root ?? _repo_root();
    const archived = archive_completed(root, {
        changed_only: !ns.all,
        base: ns.base,
        dry_run: ns.dry_run,
    });
    if (archived.length === 0) {
        process.stdout.write('  ℹ️  No completed roadmaps to archive.\n');
        return 0;
    }
    _regen_dashboard(root, ns.dry_run);
    _regen_archive_index(root, ns.dry_run);
    const verb = ns.dry_run ? 'Would archive' : 'Archived';
    for (const rec of archived) {
        process.stdout.write(
            `  ✅  ${verb}: ${rec.roadmap} → ${rec.archived_to}` +
                (rec.refs_migrated.length
                    ? `  (${rec.refs_migrated.length} ref(s) migrated)`
                    : '') +
                '\n',
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via `.augment/scripts` → `dist/agent-src/scripts`,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the symlink
    // path. Compare realpaths so the entry guard still fires (without this the
    // archival sweep silently no-ops when run through the symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}
if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exitCode = main();
    } catch (exc) {
        if (exc instanceof ArgparseExit) {
            process.exitCode = exc.code;
        } else {
            throw exc;
        }
    }
}

export {
    archive_completed,
    main,
    _branch_touched_paths,
    _inbound_ref_rewrite,
    _git_mv,
    _repo_root,
};
export type { ArchiveRecord, CompletedProcess };
