/**
 * Per-test-file guard: `src/skills` must never gain an entry the git index
 * does not track.
 *
 * WHY THIS EXISTS, measured rather than assumed. `Node Tests (ubuntu-latest,
 * shard 2/4)` failed on runs 33418425604 and 33424783559 with one assertion,
 * in `routing_signal_measurement.test.ts`:
 *
 *     "catalogue_size": 300,   <- fresh recompute, in CI
 *     "catalogue_size": 299,   <- the published artefact
 *
 * `loadCatalogue` (`src/scripts/_lib/routing_corpus.ts`) counts directories
 * under `src/skills` carrying a `SKILL.md`. Four independent counts of the
 * committed tree — `git ls-files`, `git ls-tree` on a clean worktree, `ls` on
 * disk, and `check_estate_count` — all say 299, so 300 was one more skill than
 * exists and something wrote it during the run.
 *
 * That writer is now known and fixed: `lint_originality.test.ts` puts a re-skin
 * fixture in the real tree, and `isScaffoldingSkillDir` makes the catalogue
 * readers ignore it. This guard is the OTHER half — it catches the next writer,
 * which will not have the courtesy of a `__` prefix.
 *
 * THE POINT OF PUTTING IT HERE rather than only fixing the one test. The
 * failure flipped between runs whose content differed by two markdown files
 * nothing reads, so it is order- and parallelism-dependent, and a single green
 * run is not evidence of absence. Hunting such a writer by re-running a race is
 * the expensive way; this makes the race name itself on first occurrence.
 *
 * WHAT IT DOES NOT CLAIM. Vitest runs test FILES in parallel workers, so the
 * file this fails in is where the pollution was OBSERVED, not necessarily the
 * file that wrote it. The `appeared during this file` line separates the two
 * cases as far as an observation can: an entry already present at `beforeAll`
 * came from somewhere else. That is a narrower claim than "this test did it",
 * and it is the honest one.
 *
 * The comparison is against the git INDEX, not a snapshot, so an entry a
 * previous run leaked and never cleaned up is reported too rather than being
 * baked into the baseline.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll } from 'vitest';

import { isScaffoldingSkillDir } from '../../src/scripts/_lib/routing_corpus.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILLS = path.join(REPO, 'src', 'skills');

/** Skill directories on disk that carry a `SKILL.md` — what `loadCatalogue` counts. */
function onDisk(): Set<string> {
    if (!fs.existsSync(SKILLS)) return new Set();
    const out = new Set<string>();
    for (const name of fs.readdirSync(SKILLS)) {
        // The same predicate the catalogue readers use, imported rather than
        // re-spelled: a guard and the thing it guards must not hold two
        // opinions about which entries count.
        if (isScaffoldingSkillDir(name)) continue;
        if (fs.existsSync(path.join(SKILLS, name, 'SKILL.md'))) out.add(name);
    }
    return out;
}

/**
 * The same set according to the git index.
 *
 * Cached on `globalThis` because vitest re-evaluates a setup file per test file
 * while reusing worker processes: without the cache this would spawn `git` 344
 * times a shard, with it a handful.
 */
const CACHE_KEY = '__ac_tracked_skill_dirs__';

function tracked(): Set<string> | null {
    const g = globalThis as Record<string, unknown>;
    if (g[CACHE_KEY] !== undefined) return g[CACHE_KEY] as Set<string> | null;
    let value: Set<string> | null = null;
    try {
        const out = execFileSync('git', ['ls-files', '-z', 'src/skills/*/SKILL.md'], {
            cwd: REPO,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const names = out
            .split('\0')
            .filter(Boolean)
            .map((rel) => rel.split('/')[2] as string)
            .filter((name) => !isScaffoldingSkillDir(name));
        // An empty answer means "not a git checkout" or "git unavailable", not
        // "no skills" — a guard that fires on its own inability to look is
        // worse than one that stands down and says so.
        value = names.length > 0 ? new Set(names) : null;
    } catch {
        value = null;
    }
    g[CACHE_KEY] = value;
    return value;
}

let atStart: Set<string> = new Set();

beforeAll(() => {
    atStart = onDisk();
});

afterAll(() => {
    const expected = tracked();
    if (expected === null) return;
    const now = onDisk();
    const untracked = [...now].filter((n) => !expected.has(n)).sort();
    if (untracked.length === 0) return;
    const appearedHere = untracked.filter((n) => !atStart.has(n));
    const lines = untracked.map(
        (n) =>
            `  src/skills/${n}/SKILL.md  (${atStart.has(n) ? 'already present at file start' : 'appeared during this file'})`,
    );
    throw new Error(
        `src/skills gained ${untracked.length} entr${untracked.length === 1 ? 'y' : 'ies'} the git index does not track:\n` +
            `${lines.join('\n')}\n\n` +
            `A test wrote a skill directory into the real repository root. Anything that ` +
            `counts the catalogue — loadCatalogue, check_estate_count, the routing-signal ` +
            `verdict — now reads a tree that does not match the commit, and which test ` +
            `sees the polluted count depends on scheduling.\n` +
            (appearedHere.length > 0
                ? `Write to a temp root instead, or name the directory with a leading '__' ` +
                  `so isScaffoldingSkillDir excludes it. Observed while this file ran; with ` +
                  `parallel workers that is where it was SEEN, not proof of who wrote it.\n`
                : `Present before this file started, so the writer is elsewhere — or a ` +
                  `previous run leaked it and never cleaned up.\n`),
    );
});
