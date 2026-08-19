/**
 * run_continuation through the LIVE dispatcher — road-to-long-horizon-execution
 * Phase 1.2, the half its unit suite could not cover.
 *
 * Why a second test file rather than more cases in the unit suite.
 *
 * `tests/scripts/hooks/run_continuation.test.ts` calls `ladder()`,
 * `scanOpenSteps()` and `refusedThisTurn()` directly. That pins the decision
 * logic and nothing about the wiring — and the wiring is where this concern's
 * two most expensive assumptions live:
 *
 *   1. **Chain order.** The defer branch reads `turn-end-gate`'s refusal marker
 *      off disk and calls itself "race-free by chain order: concerns run
 *      sequentially and this concern is registered after the gate". A unit test
 *      cannot see the chain. If the manifest ever lists `run-continuation`
 *      before `turn-end-gate`, every unit test still passes and the concern
 *      re-engages turns the gate refused.
 *   2. **Reachability.** A concern reaches the in-process path only via
 *      `CONCERN_REGISTRY`. This concern shipped WITHOUT its registry line, and
 *      no unit test noticed — the parity test did, which is the same lesson
 *      from the other direction: the unit suite proves the function, the
 *      integration proves it runs.
 *
 * So this file drives the real `dispatch_hook` binary over the real manifest
 * with a real stop envelope, and asserts the two things only that can show.
 *
 * Honest scope: it does NOT make `turn-end-gate` itself refuse. Doing that
 * needs the gate's own trigger conditions, and the assertion here is about the
 * ORDER and the READ, not about the gate's detection. The marker is written
 * exactly as the gate writes it, via the gate's own module.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

import { deriveSessionKey, sessionRefusalFile } from '../../src/scripts/_lib/turn_end_refusals.js';
import { claim_file, roadmap_claim_rel } from '../../src/scripts/session_register_hook.js';
import { EVENTS_RELPATH } from '../../src/scripts/hooks/run_continuation_hook.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MANIFEST = path.join(REPO, 'src', 'scripts', 'hook_manifest.yaml');

const SLUG = 'road-to-lh-dispatch-fixture';
const SESSION = 'lh-dispatch-fixture-session';

const cleanups: string[] = [];
afterEach(() => {
    while (cleanups.length > 0) {
        const d = cleanups.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

/**
 * A transcript has to resolve under `os.homedir()` and end in `.jsonl` —
 * `isSafeTranscriptPath` refuses anything else, and a fixture under `/tmp`
 * would make every case here pass for the wrong reason (no transcript → the
 * concern returns ALLOW before reaching any of its own logic).
 */
function writeTranscript(userTurns: number): string {
    const dir = fs.mkdtempSync(path.join(os.homedir(), '.agent-config-lh-test-'));
    cleanups.push(dir);
    const lines: string[] = [];
    for (let i = 0; i < userTurns; i++) {
        lines.push(JSON.stringify({ type: 'user', message: { content: `prompt ${i}` } }));
        lines.push(JSON.stringify({ type: 'assistant', message: { content: 'reply' } }));
    }
    const file = path.join(dir, 'transcript.jsonl');
    fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf-8');
    return file;
}

/** A workspace carrying a claimed, autonomous roadmap with one open step. */
function writeWorkspace(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-dispatch-ws-'));
    cleanups.push(root);
    const roadmapDir = path.join(root, 'agents', 'roadmaps');
    fs.mkdirSync(roadmapDir, { recursive: true });
    // R2 finding 7: this used to carry a byte-identical inline copy of
    // `fixtureRoadmap()`, so exactly one of the two fixtures in this file used
    // the shared helper. Both fixtures share `SLUG` and cases below assert
    // open-step counts against it — one edit to the helper would have pinned
    // two different roadmaps under one name.
    fs.writeFileSync(path.join(roadmapDir, `${SLUG}.md`), fixtureRoadmap(), 'utf-8');
    const claim = path.join(root, roadmap_claim_rel(SESSION));
    fs.mkdirSync(path.dirname(claim), { recursive: true });
    fs.writeFileSync(claim, JSON.stringify({ slug: SLUG, session_id: SESSION }), 'utf-8');
    return root;
}

/** The roadmap body every fixture in this file uses. */
function fixtureRoadmap(): string {
    return [
        '---',
        'complexity: structural',
        'execution:',
        '  mode: autonomous',
        '---',
        '',
        '# Fixture',
        '',
        '## Phase 0 — one open step',
        '',
        '- [x] **0.0** done',
        '- [ ] **0.1** the open one <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->',
        '',
    ].join('\n');
}

/**
 * `git` against a fixture tree, with the ambient repository pointers stripped.
 *
 * R2 finding 4: `_lib/git_common_dir.ts` refuses to shell out to git at all,
 * and its docblock names inherited `GIT_DIR` / `GIT_WORK_TREE` as the reason.
 * This helper did shell out and inherited them, so running the suite from
 * inside a git hook — which exports `GIT_DIR` — resolved every call against the
 * HOOK's repository instead of the temp dir: `git config user.email` would
 * rewrite the real repo's local identity and `git commit` could commit the real
 * staged index, silently, instead of failing loudly.
 */
function git(cwd: string, ...args: string[]): void {
    const env = { ...process.env };
    delete env['GIT_DIR'];
    delete env['GIT_WORK_TREE'];
    delete env['GIT_INDEX_FILE'];
    delete env['GIT_COMMON_DIR'];
    // Round 3 finding 7: stripping the four pointers closed the ENV axis and
    // left the CONFIG axis open. A maintainer with a global `core.hooksPath`
    // had their real hook set run against the fixture repo on `commit`, and a
    // global `commit.gpgsign = true` without an available key made the fixture
    // commit throw — reding three cases for a reason unrelated to the concern.
    // Pointing both config scopes at /dev/null is the documented way to run git
    // against nothing but the repository-local config.
    env['GIT_CONFIG_GLOBAL'] = '/dev/null';
    env['GIT_CONFIG_SYSTEM'] = '/dev/null';
    const r = spawnSync('git', args, { cwd, encoding: 'utf-8', env });
    if ((r.status ?? -1) !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    }
}

/**
 * A REAL main checkout plus a REAL linked worktree, with the claim written
 * through `claim_file` — i.e. the exact arrangement in which the shipped defect
 * was invisible, and the only one that can prove the fix.
 *
 * Every other fixture in this file uses a plain temp directory, which is not a
 * git repository at all: there `git_dir` and `git_common_dir` are both empty and
 * the claim resolves to the per-tree fallback. That is a legitimate degenerate
 * case, and it is also the case the two-tree property cannot be observed in — so
 * asserting the property needs this.
 */
function writeWorktreePair(): { main: string; worktree: string } {
    const main = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-dispatch-main-'));
    cleanups.push(main);
    git(main, 'init', '--quiet', '--initial-branch=main');
    git(main, 'config', 'user.email', 'fixture@example.com');
    git(main, 'config', 'user.name', 'fixture');
    fs.writeFileSync(path.join(main, 'README.md'), 'fixture\n', 'utf-8');
    git(main, 'add', 'README.md');
    git(main, 'commit', '--quiet', '-m', 'fixture base');

    // Outside `main` on purpose: a worktree nested inside its own checkout would
    // make the two roots share a prefix and hide a path-prefix mistake.
    const worktree = path.join(path.dirname(main), `${path.basename(main)}-wt`);
    cleanups.push(worktree);
    git(main, 'worktree', 'add', '--quiet', '-b', 'fixture-wt', worktree);

    // In BOTH trees, because a real parent checkout carries `agents/roadmaps/`
    // as well — and the parent-rooted-reader case below reads the roadmap from
    // the parent. A fixture that only wrote it into the worktree would make
    // that case return ALLOW on an unreadable roadmap instead of exercising the
    // provenance it exists to pin.
    for (const tree of [worktree, main]) {
        const roadmapDir = path.join(tree, 'agents', 'roadmaps');
        fs.mkdirSync(roadmapDir, { recursive: true });
        fs.writeFileSync(path.join(roadmapDir, `${SLUG}.md`), fixtureRoadmap(), 'utf-8');
    }

    // Through the production writer, never a hand-built path: the whole defect
    // was writer and reader disagreeing, so a fixture that hard-codes the
    // location cannot catch a regression in either half.
    const claim = claim_file(worktree, SESSION);
    fs.mkdirSync(path.dirname(claim), { recursive: true });
    fs.writeFileSync(claim, JSON.stringify({ slug: SLUG, session_id: SESSION }), 'utf-8');

    return { main, worktree };
}

/** Drive the real dispatcher over the real manifest for a claude `stop`. */
function dispatchStop(
    root: string,
    transcript: string,
    payloadCwd?: string,
): { code: number; err: string; out: string } {
    const r = spawnSync(
        'npx',
        [
            'tsx',
            path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts'),
            '--platform',
            'claude',
            '--event',
            'stop',
            '--native-event',
            'Stop',
            '--project-dir',
            root,
        ],
        {
            input: JSON.stringify(
                payloadCwd === undefined
                    ? { session_id: SESSION, transcript_path: transcript }
                    : { session_id: SESSION, transcript_path: transcript, cwd: payloadCwd },
            ),
            encoding: 'utf-8',
            cwd: REPO,
            timeout: 180_000,
        },
    );
    return { code: r.status ?? -1, err: r.stderr ?? '', out: r.stdout ?? '' };
}

function events(root: string): Array<Record<string, unknown>> {
    const file = path.join(root, EVENTS_RELPATH);
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf-8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('run-continuation — chain order in the shipped manifest', () => {
    // The race-freedom claim in `refusedThisTurn`'s docblock is a claim about
    // THIS list. Asserted against the manifest rather than trusted from a
    // comment, because a reordering is a one-line edit that breaks the concern
    // silently and passes every unit test.
    it('is registered strictly after turn-end-gate on the claude stop chain', () => {
        const doc = parseYaml(fs.readFileSync(MANIFEST, 'utf8')) as {
            platforms?: Record<string, Record<string, string[]>>;
        };
        const chain = doc.platforms?.['claude']?.['stop'];
        expect(chain).toBeDefined();
        const gate = (chain as string[]).indexOf('turn-end-gate');
        const cont = (chain as string[]).indexOf('run-continuation');
        expect(gate).toBeGreaterThanOrEqual(0);
        expect(cont).toBeGreaterThanOrEqual(0);
        expect(cont).toBeGreaterThan(gate);
    });

    it('is LAST on that chain — nothing may run after the continuation decision', () => {
        const doc = parseYaml(fs.readFileSync(MANIFEST, 'utf8')) as {
            platforms?: Record<string, Record<string, string[]>>;
        };
        const chain = doc.platforms?.['claude']?.['stop'] as string[];
        expect(chain[chain.length - 1]).toBe('run-continuation');
    });
});

describe('run-continuation — driven through the live dispatcher', () => {
    it('engages on an autonomous claimed roadmap with an open step', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);
        const res = dispatchStop(root, transcript);
        const log = events(root);
        // Two assertions, and the second one exists because its absence hid a
        // critical defect. The event log proves the concern was REACHED and
        // decided; the exit code proves the decision REACHED THE HOST. The
        // original version of this test asserted only the first and said so
        // deliberately — that pinning an exit code would make it "a claim about
        // Claude's protocol". It is exactly that claim, and it is the one worth
        // making: the concern shipped `severity: advisory`, the dispatcher's
        // severity ceiling downgraded its EXIT_BLOCK to WARN, and stop+warn maps
        // to exit 0. The concern ran, logged `engage`, injected its text as
        // context — and did not stop the stop. Every assertion below passed the
        // whole time.
        expect(log.length).toBeGreaterThan(0);
        const engaged = log.filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        expect(engaged[0]?.['roadmap']).toBe(SLUG);
        expect(engaged[0]?.['open']).toBe(1);

        // The continuation names the next step AND its verify line — a bare
        // "keep going" is the anti-pattern the harvest section rejects. It is
        // asserted on the dispatcher's OUTPUT rather than in the event log,
        // because the log records that an engagement happened and its counts,
        // never the text injected. Two different questions: the ledger answers
        // "how often did this fire", the output answers "what did the agent
        // actually receive", and only the second one can catch a degenerate
        // continuation.
        const seen = `${res.out}${res.err}`;
        expect(seen).toContain('0.1');
        expect(seen).toContain('lint_hook_manifest');
        expect(res.code).not.toBe(-1);
        // exit 2 is the ONLY value that makes Claude Code refuse the Stop and
        // feed the reason back to the model (`host_semantics.emitFor`, stop is
        // block-capable). exit 0 here means the continuation was delivered as
        // passive context on a turn that ended anyway — the inert shape.
        expect(res.code).toBe(2);
    });

    // The observation this concern exists to make auditable is "an engagement
    // crossed a tree boundary". Before these fields the ledger recorded that an
    // engagement happened and nothing about WHERE — so a reader could not tell
    // a two-tree run from a same-root one, which is precisely the arrangement
    // in which the original defect was invisible. AI council 2026-08-19 (2/2):
    // record the concrete roots, never a `worktree_started` boolean, because a
    // boolean is another assertion by the system under observation.
    it('records the two-tree provenance on the engage event, from a real worktree', () => {
        const { main, worktree } = writeWorktreePair();
        const transcript = writeTranscript(3);
        dispatchStop(worktree, transcript);
        const engaged = events(worktree).filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        const ev = engaged[0] as Record<string, unknown>;

        // Realpath on every comparison: macOS hands `os.tmpdir()` back as
        // `/var/folders/…` while the resolvers report `/private/var/folders/…`,
        // so a raw compare fails on the symlink rather than on the property.
        const real = (p: unknown): string => fs.realpathSync(p as string);

        // 1. The tree the CONCERN resolved under — the `--project-dir` half.
        expect(real(ev['workspace_root'])).toBe(real(worktree));

        // 1b. And the tree the SESSION itself works in. With no `cwd` in the
        // payload `session_checkout` degrades to `workspace_root`, which is the
        // honest reading for this case: the reader is already rooted in the
        // worktree, so there is no second tree to disagree about. The
        // parent-rooted case below is where the two diverge.
        expect(real(ev['session_root'])).toBe(real(worktree));

        // 2. THE falsifiable fact. `git_dir` is this worktree's private gitdir,
        // `git_common_dir` is the main checkout's `.git`. They differ EXACTLY
        // when the session runs in a linked worktree, which is the condition
        // under which the defect existed at all. Both are derived from
        // `session_root`, never from the reader's root — R2 finding 1.
        const gitDir = ev['git_dir'] as string;
        const commonDir = ev['git_common_dir'] as string;
        expect(gitDir).not.toBe('');
        expect(commonDir).not.toBe('');
        expect(real(gitDir)).not.toBe(real(commonDir));
        expect(real(commonDir)).toBe(real(path.join(main, '.git')));

        // 3. And the contract was read out of the SHARED root, not this tree —
        // the fix, stated as a path relation a third party can check with no
        // access to the machine beyond the ledger line.
        const claimPath = real(ev['claim_path']);
        expect(path.isAbsolute(claimPath)).toBe(true);
        expect(claimPath.startsWith(`${real(commonDir)}${path.sep}`)).toBe(true);
        expect(claimPath.startsWith(`${real(worktree)}${path.sep}`)).toBe(false);
    });

    it('records the two-tree split when the READER is rooted in the parent checkout', () => {
        // The arrangement the roadmap documents as the LIVE one, and the one no
        // case covered: `CLAUDE_PROJECT_DIR` resolves to the parent even for a
        // worktree session, so the dispatcher runs with `--project-dir <main>`
        // while the session itself sits in the worktree.
        //
        // R2 finding 1 was invisible precisely here. The first version derived
        // both git fields from the READER's root, where `git_dir(main)` and
        // `git_common_dir(main)` are the SAME path — so the documented
        // discriminator `git_dir !== git_common_dir` read FALSE for every real
        // worktree-started run while the worktree-rooted case above stayed
        // green. That is the "green suite over the arrangement that never fails"
        // shape this file's own header warns about.
        const { main, worktree } = writeWorktreePair();
        const transcript = writeTranscript(3);
        const res = dispatchStop(main, transcript, worktree);
        expect(res.code).toBe(2);

        const engaged = events(main).filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        const ev = engaged[0] as Record<string, unknown>;
        const real = (p: unknown): string => fs.realpathSync(p as string);

        // The reader's tree and the session's tree, both recorded, and DIFFERENT
        // — which is the defect condition itself, now readable per event.
        expect(real(ev['workspace_root'])).toBe(real(main));
        expect(real(ev['session_root'])).toBe(real(worktree));
        expect(ev['workspace_root']).not.toBe(ev['session_root']);

        // Round 2 finding 3: every `session_root` assertion wrapped BOTH sides
        // in `real()`, so dropping `normalizeDir` from that branch — passing the
        // envelope value verbatim, the precise regression finding 3 fixed —
        // stayed green on macOS, where `/var` resolves to `/private/var`. Pinned
        // as an exact string, the way the two sibling fields already were.
        expect(ev['session_root']).toBe(real(worktree));
        expect(ev['session_cwd']).toBe(real(worktree));

        // The discriminator now holds where it has to: derived from the
        // session's tree, these differ. Derived from the reader's tree — the
        // shipped behaviour this replaces — they would be equal.
        const gitDir = ev['git_dir'] as string;
        const commonDir = ev['git_common_dir'] as string;
        expect(real(gitDir)).not.toBe(real(commonDir));
        expect(real(commonDir)).toBe(real(path.join(main, '.git')));

        // Pinned as a regression on the old derivation specifically: had the
        // fields come from `workspace_root`, this is the value they would carry.
        expect(real(gitDir)).not.toBe(real(path.join(main, '.git')));

        // Every path realpath-normalised at the source, so the containment test
        // works for a reader holding nothing but the line (R2 finding 3).
        expect(ev['git_common_dir']).toBe(real(commonDir));
        expect(ev['workspace_root']).toBe(real(main));
        const claimPath = ev['claim_path'] as string;
        expect(claimPath.startsWith(`${real(commonDir)}${path.sep}`)).toBe(true);
    });

    it('keeps the degraded resolution distinguishable — cwd inside a worktree subdirectory', () => {
        // Round 2 finding 1. `session_checkout` requires the cwd to BE a
        // checkout root, and a session started with `cd <worktree>/src` is not:
        // `session_root` therefore collapses onto the reader's root and BOTH
        // path discriminators read FALSE for a genuine two-tree run — the
        // round-1 false negative re-entering through the degradation path.
        //
        // The fields cannot prevent the degradation (the guard's three
        // conditions are the register's, and loosening them is a change to the
        // register). What they must do is make it VISIBLE, which is what
        // `session_cwd` is for: a raw path that is neither `session_root` nor
        // under it, a shape no healthy resolution produces.
        const { main, worktree } = writeWorktreePair();
        const sub = path.join(worktree, 'src');
        fs.mkdirSync(sub, { recursive: true });
        const transcript = writeTranscript(3);
        dispatchStop(main, transcript, sub);

        const engaged = events(main).filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        const ev = engaged[0] as Record<string, unknown>;
        const real = (p: unknown): string => fs.realpathSync(p as string);

        // The degradation itself, pinned as the honest current behaviour rather
        // than asserted away.
        expect(ev['session_root']).toBe(real(main));
        expect(ev['session_root']).toBe(ev['workspace_root']);

        // And the fact that makes it readable: the raw cwd is the subdirectory,
        // which is NOT under the resolved session root. A reader comparing the
        // two can tell this line apart from a genuine same-tree run, where the
        // cwd would sit under `session_root`.
        expect(ev['session_cwd']).toBe(real(sub));
        expect(
            (ev['session_cwd'] as string).startsWith(`${ev['session_root'] as string}${path.sep}`),
        ).toBe(false);
    });

    it('reports an empty session_cwd when the host sends no cwd at all', () => {
        // The other half of finding 1: host silence and a failed resolution are
        // different facts, and a reader must not have to guess which one a line
        // records. Every other case in this file dispatches without a `cwd`, so
        // this pins what those lines say about it.
        const root = writeWorkspace();
        const transcript = writeTranscript(3);
        dispatchStop(root, transcript);
        const engaged = events(root).filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        expect(engaged[0]?.['session_cwd']).toBe('');
    });

    it('records the provenance on a non-engage event too — the defer branch', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);
        const marker = sessionRefusalFile(root, deriveSessionKey(SESSION));
        fs.mkdirSync(path.dirname(marker), { recursive: true });
        fs.writeFileSync(
            marker,
            JSON.stringify({
                refused_at: '2026-08-19T00:00:00.000Z',
                refused_turn: 3,
                detector: 'verification',
            }),
            'utf-8',
        );
        dispatchStop(root, transcript);
        const deferred = events(root).filter((e) => e['event'] === 'deferred-quality-gate');
        expect(deferred.length).toBe(1);
        // Asserted on a SECOND branch on purpose: provenance carried only by the
        // happy path would leave every halt and defer unattributable, and those
        // are the lines a reader reaches for when asking why a run did NOT
        // continue.
        expect(fs.realpathSync(deferred[0]?.['workspace_root'] as string)).toBe(
            fs.realpathSync(root),
        );
        // R2 finding 8: this pinned only `typeof === 'string'`, which an empty
        // string satisfies — so a regression that dropped the one field
        // locating the contract would have left the assertion green. The
        // fixture's claim path is deterministic, so pin it exactly, normalised
        // the same way `provenance` normalises it.
        const expectedClaim = path.join(root, roadmap_claim_rel(SESSION));
        expect(deferred[0]?.['claim_path']).toBe(
            path.join(
                fs.realpathSync(path.dirname(expectedClaim)),
                path.basename(expectedClaim),
            ),
        );
        // This fixture is a plain temp directory, not a repository — so both git
        // fields are empty, and that is the honest degenerate reading rather
        // than a gap. Pinned so a future change cannot start emitting a guessed
        // path where git could not be read.
        expect(deferred[0]?.['git_dir']).toBe('');
        expect(deferred[0]?.['git_common_dir']).toBe('');
    });

    it('DEFERS when turn-end-gate refused this turn — the quality gate always wins', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);
        // Written through the gate's own module, at the ordinal this transcript
        // yields (3 genuine user turns → ordinal 3), so the shape cannot drift
        // from what the gate actually writes.
        const marker = sessionRefusalFile(root, deriveSessionKey(SESSION));
        fs.mkdirSync(path.dirname(marker), { recursive: true });
        // The full `RefusalRecord` shape, not just `refused_turn`: `parseRecord`
        // requires `refused_at` and a valid `detector` too and returns null
        // otherwise — a partial fixture reads as "never refused" and the test
        // would pass for the wrong reason on the engage branch.
        fs.writeFileSync(
            marker,
            JSON.stringify({
                refused_at: '2026-08-19T00:00:00.000Z',
                refused_turn: 3,
                detector: 'verification',
            }),
            'utf-8',
        );

        dispatchStop(root, transcript);
        const log = events(root);
        expect(log.some((e) => e['event'] === 'deferred-quality-gate')).toBe(true);
        // And it did NOT also engage: a defer that still emits a continuation
        // would override the refusal it was supposed to respect.
        expect(log.some((e) => e['event'] === 'engage')).toBe(false);
    });

    it('does not engage without a claim — the contract gate is the hard requirement', () => {
        const root = writeWorkspace();
        fs.rmSync(path.join(root, roadmap_claim_rel(SESSION)));
        const transcript = writeTranscript(3);
        dispatchStop(root, transcript);
        expect(events(root)).toEqual([]);
    });

    it('does not engage when the roadmap is not autonomous', () => {
        const root = writeWorkspace();
        const roadmap = path.join(root, 'agents', 'roadmaps', `${SLUG}.md`);
        fs.writeFileSync(
            roadmap,
            fs.readFileSync(roadmap, 'utf-8').replace('mode: autonomous', 'mode: phase-checkpoints'),
            'utf-8',
        );
        const transcript = writeTranscript(3);
        dispatchStop(root, transcript);
        expect(events(root)).toEqual([]);
    });

    it('the kill switch silences it through the whole chain', () => {
        const root = writeWorkspace();
        const transcript = writeTranscript(3);
        const r = spawnSync(
            'npx',
            [
                'tsx',
                path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts'),
                '--platform',
                'claude',
                '--event',
                'stop',
                '--native-event',
                'Stop',
                '--project-dir',
                root,
            ],
            {
                input: JSON.stringify({ session_id: SESSION, transcript_path: transcript }),
                encoding: 'utf-8',
                cwd: REPO,
                timeout: 180_000,
                env: { ...process.env, AGENT_CONFIG_NO_RUN_CONTINUATION: '1' },
            },
        );
        expect(r.status ?? -1).not.toBe(-1);
        expect(events(root)).toEqual([]);
    });
});
