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
import {
    legacyStateRelPath,
    stateRelPath,
} from '../../src/scripts/hooks/run_continuation_hook.js';
import { claim_file, roadmap_claim_rel } from '../../src/scripts/session_register_hook.js';
import { EVENTS_RELPATH } from '../../src/scripts/hooks/run_continuation_hook.js';
import { CONTEXT_OBSERVATION_REL } from '../../src/scripts/_lib/context_observation.js';
import { RUN_TERMINAL_VOCABULARY_VERSION } from '../../src/scripts/_lib/outcome_vocabularies.js';

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

/**
 * A roadmap body with a chosen number of open steps, so the parent and the
 * worktree copies of the SAME slug can be made to disagree. That disagreement is
 * the whole instrument: it is what tells a reader which tree the concern actually
 * read, and no assertion about paths alone can establish it.
 */
function fixtureRoadmapWithOpen(openSteps: number): string {
    const lines = [
        '---',
        'complexity: structural',
        'execution:',
        '  mode: autonomous',
        '---',
        '',
        '# Fixture',
        '',
        '## Phase 0 — parameterised open steps',
        '',
        '- [x] **0.0** done',
    ];
    for (let i = 1; i <= openSteps; i++) {
        lines.push(`- [ ] **0.${i}** open ${i}`);
    }
    lines.push('');
    return lines.join('\n');
}

/**
 * A main checkout with the worktree NESTED INSIDE IT, at
 * `<main>/.claude/worktrees/wt` — this repository's own layout.
 *
 * `writeWorktreePair` deliberately places the worktree OUTSIDE `main`, to keep a
 * shared path prefix from hiding a prefix mistake. That choice also made the
 * whole nested class unreachable, which is how round 3 finding 2 survived two
 * review rounds: every signal the concern emits reads "healthy same-tree" when
 * the session sits in a SUBDIRECTORY of a nested worktree, because the degraded
 * session root lands on the parent and the raw cwd is under the parent too.
 *
 * Both fixtures are kept. Nested and non-nested are different topologies and the
 * concern has to be right in both.
 */
function writeNestedWorktreePair(): { main: string; worktree: string; sub: string } {
    const main = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-nested-main-'));
    cleanups.push(main);
    git(main, 'init', '--quiet', '--initial-branch=main');
    git(main, 'config', 'user.email', 'fixture@example.com');
    git(main, 'config', 'user.name', 'fixture');
    fs.writeFileSync(path.join(main, 'README.md'), 'fixture\n', 'utf-8');
    git(main, 'add', 'README.md');
    git(main, 'commit', '--quiet', '-m', 'fixture base');

    const worktree = path.join(main, '.claude', 'worktrees', 'wt');
    fs.mkdirSync(path.dirname(worktree), { recursive: true });
    git(main, 'worktree', 'add', '--quiet', '-b', 'fixture-nested-wt', worktree);

    // The parent copy carries TWO open steps, the worktree copy ONE. A concern
    // reading the parent reports 2; reading the worktree reports 1.
    const parentRoadmaps = path.join(main, 'agents', 'roadmaps');
    fs.mkdirSync(parentRoadmaps, { recursive: true });
    fs.writeFileSync(
        path.join(parentRoadmaps, `${SLUG}.md`),
        fixtureRoadmapWithOpen(2),
        'utf-8',
    );
    const wtRoadmaps = path.join(worktree, 'agents', 'roadmaps');
    fs.mkdirSync(wtRoadmaps, { recursive: true });
    fs.writeFileSync(path.join(wtRoadmaps, `${SLUG}.md`), fixtureRoadmapWithOpen(1), 'utf-8');

    const claim = claim_file(worktree, SESSION);
    fs.mkdirSync(path.dirname(claim), { recursive: true });
    fs.writeFileSync(claim, JSON.stringify({ slug: SLUG, session_id: SESSION }), 'utf-8');

    // The session stands in a SUBDIRECTORY of the worktree, which is the shape
    // `session_checkout`'s checkout-root condition used to reject.
    const sub = path.join(worktree, 'src');
    fs.mkdirSync(sub, { recursive: true });

    return { main, worktree, sub };
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

    it('walks up from a worktree subdirectory — the non-nested topology too', () => {
        // This case was written for round 2 finding 1 and PINNED THE OPPOSITE
        // BEHAVIOUR: `session_checkout` required the cwd to BE a checkout root,
        // so `cd <worktree>/src` degraded onto the reader's root, and the case
        // asserted that degradation as "the honest current behaviour" while
        // arguing that only its VISIBILITY could be fixed.
        //
        // Round 3 finding 2 refuted the premise: in a NESTED worktree layout the
        // degraded answer is not merely imprecise, it is confidently wrong, and
        // every signal then reads healthy same-tree. The council's fix walks the
        // resolver up, which makes the old assertion false. Retargeted rather
        // than deleted — the topology it covers (worktree OUTSIDE the parent) is
        // still one the walk has to get right, and it is the one this fixture has.
        const { main, worktree } = writeWorktreePair();
        const sub = path.join(worktree, 'src');
        fs.mkdirSync(sub, { recursive: true });
        const transcript = writeTranscript(3);
        dispatchStop(main, transcript, sub);

        const engaged = events(main).filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        const ev = engaged[0] as Record<string, unknown>;
        const real = (p: unknown): string => fs.realpathSync(p as string);

        expect(ev['session_root']).toBe(real(worktree));
        expect(ev['session_root']).not.toBe(ev['workspace_root']);
        // The raw cwd stays on the line, and now it sits UNDER the resolved root
        // — which is what a healthy resolution looks like, and is the reading the
        // field exists to make available either way.
        expect(ev['session_cwd']).toBe(real(sub));
        expect(
            (ev['session_cwd'] as string).startsWith(`${ev['session_root'] as string}${path.sep}`),
        ).toBe(true);
    });

    it('still falls back when the cwd belongs to a DIFFERENT repository', () => {
        // The same-repository bound the council named, and the reason
        // `session_cwd` keeps earning its place after the walk-up: degradation
        // did not disappear, it narrowed. A cwd in a foreign checkout resolves to
        // that checkout's root, fails the common-dir identity check, and falls
        // back — and the raw cwd is then a path outside the resolved root, which
        // is the shape that tells a reader a fallback happened.
        const { main } = writeWorktreePair();
        const foreign = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-foreign-'));
        cleanups.push(foreign);
        git(foreign, 'init', '--quiet', '--initial-branch=main');
        const transcript = writeTranscript(3);
        dispatchStop(main, transcript, foreign);

        const engaged = events(main).filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        const ev = engaged[0] as Record<string, unknown>;
        const real = (p: unknown): string => fs.realpathSync(p as string);

        expect(ev['session_root']).toBe(real(main));
        expect(ev['session_cwd']).toBe(real(foreign));
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

    it('reads the SESSION tree roadmap from a nested worktree subdirectory — no false stall', () => {
        // The fixture both council seats named independently (2026-08-19, 2/2 on
        // A/A), and it is the one that closes round 3's two highs together:
        //
        //   finding 2 — `session_checkout` required the reported cwd to BE a
        //   checkout root, so a session in `<worktree>/src` degraded onto the
        //   parent. With the worktree NESTED under the parent, every signal then
        //   reads healthy same-tree for a genuine two-tree run.
        //
        //   finding 1 — the progress scan read the roadmap from the READER's
        //   tree, so the count follows a file nobody is editing. The agent flips
        //   a checkbox in the worktree, the parent copy does not move, and the
        //   stall detector declares a working run finished.
        //
        // The two roadmap copies disagree ON PURPOSE — parent 2 open, worktree 1.
        // That disagreement is the instrument: no assertion about paths alone
        // can show which file was read.
        const { main, worktree, sub } = writeNestedWorktreePair();
        const transcript = writeTranscript(3);
        const res = dispatchStop(main, transcript, sub);
        expect(res.code).toBe(2);

        const engaged = events(main).filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        const ev = engaged[0] as Record<string, unknown>;
        const real = (p: unknown): string => fs.realpathSync(p as string);

        // 1. The resolver walked up out of the subdirectory to the worktree root.
        expect(ev['session_root']).toBe(real(worktree));
        expect(ev['session_root']).not.toBe(ev['workspace_root']);
        expect(ev['workspace_root']).toBe(real(main));

        // 2. Which tree was actually READ. The worktree copy has one open step,
        // the parent copy two — so this single number is the finding-1 assertion.
        expect(ev['open']).toBe(1);

        // 3. And the two-tree discriminators hold in the nested topology, where
        // before the fix all three read healthy same-tree.
        expect(real(ev['git_dir'] as string)).not.toBe(real(ev['git_common_dir'] as string));
        expect(real(ev['git_common_dir'] as string)).toBe(real(path.join(main, '.git')));
        expect(ev['session_cwd']).toBe(real(sub));

        // 4. The council's same-repository bound: walking up must not cross into
        // another repository, and the proof is the shared common dir.
        expect(real(ev['git_common_dir'] as string)).toBe(
            real(path.join(main, '.git')),
        );
    });

    it('names the roadmap file it read on the line', () => {
        // Round 4 finding 4: the line carried six path fields and not the path the
        // only tree-dependent NUMBER on it came from, so `open: 1` on a two-tree
        // line could not be told apart from `open: 1` after a silent fallback.
        const { main, worktree, sub } = writeNestedWorktreePair();
        dispatchStop(main, writeTranscript(3), sub);
        const ev = events(main).filter((e) => e['event'] === 'engage')[0] as Record<
            string,
            unknown
        >;
        expect(ev['roadmap_path']).toBe(
            path.join(fs.realpathSync(worktree), 'agents', 'roadmaps', `${SLUG}.md`),
        );
        // And the count on the same line comes from that file, not the parent's.
        expect(ev['open']).toBe(1);
    });

    it('ALLOWS when the session tree archived the roadmap — never falls back to the parent', () => {
        // Round 4 finding 1, and it is the fix's own failure mode rather than the
        // original defect's. `roadmap-progress-sync` mandates archival in the same
        // change that closes the last step, so a completing run `git mv`s the file
        // into `agents/roadmaps/archive/`. Resolving PER FILE, the next fire found
        // the session copy gone, silently read the parent's un-archived copy, saw
        // its still-open steps, and blocked with "continue with this step now"
        // against a path that no longer exists in the tree being edited — engaging
        // to the iteration cap instead of ever reaching complete.
        //
        // Resolving per DIRECTORY, the session tree stays authoritative and a
        // missing file means the roadmap is gone from this run, which the
        // unreadable-roadmap branch already handles by allowing the turn to end.
        const { main, worktree, sub } = writeNestedWorktreePair();
        const live = path.join(worktree, 'agents', 'roadmaps', `${SLUG}.md`);
        const archive = path.join(worktree, 'agents', 'roadmaps', 'archive');
        fs.mkdirSync(archive, { recursive: true });
        fs.renameSync(live, path.join(archive, `${SLUG}.md`));
        // The parent copy is deliberately left in place with its two open steps —
        // it is exactly what a fallback would have found.
        expect(fs.existsSync(path.join(main, 'agents', 'roadmaps', `${SLUG}.md`))).toBe(true);

        const res = dispatchStop(main, writeTranscript(3), sub);
        expect(res.code).toBe(0);
        expect(events(main).length).toBe(0);
    });

    it('ALLOWS on a claim slug that would escape the roadmaps directory', () => {
        // Round 4 finding 7. `_read_claim_file` accepts any non-empty trimmed
        // string as a slug, and the resolver now builds paths in TWO trees, so a
        // traversal slug would have made the concern read outside
        // `agents/roadmaps/` twice over. Refusing to name a file is the safe
        // direction for a concern whose only power is refusing to end a turn.
        const root = writeWorkspace();
        const claim = path.join(root, roadmap_claim_rel(SESSION));
        fs.writeFileSync(
            claim,
            JSON.stringify({ slug: '../../etc/passwd', session_id: SESSION }),
            'utf-8',
        );
        const res = dispatchStop(root, writeTranscript(3));
        expect(res.code).toBe(0);
        expect(events(root).length).toBe(0);
    });

    it('does not stall while the SESSION tree count keeps moving', () => {
        // The second half of the council's fixture: three fires with the worktree
        // count advancing between them. Reading the parent, the count is frozen
        // at 2 for all three and the third fire emits `halt-stall` — a working
        // run declared finished. Reading the session tree, it moves 3 → 2 → 1 and
        // no halt is emitted.
        const { main, worktree, sub } = writeNestedWorktreePair();
        const wtRoadmap = path.join(worktree, 'agents', 'roadmaps', `${SLUG}.md`);

        for (const [i, open] of [3, 2, 1].entries()) {
            fs.writeFileSync(wtRoadmap, fixtureRoadmapWithOpen(open), 'utf-8');
            // A fresh transcript per fire, with a growing user-turn count: the
            // concern keys its duplicate-fire guard on the turn ordinal, so
            // re-firing on the same transcript would be discarded as a duplicate
            // rather than counted as an engagement.
            dispatchStop(main, writeTranscript(3 + i), sub);
        }

        const log = events(main);
        expect(log.filter((e) => e['event'] === 'halt-stall').length).toBe(0);
        const opens = log.filter((e) => e['event'] === 'engage').map((e) => e['open']);
        expect(opens).toEqual([3, 2, 1]);
    });

    it('emits halt-roadmap-absent and clears the budget when a DRIVEN run archives its roadmap', () => {
        // Round 5 finding 2. The archival case was already covered for a run the
        // concern had never driven — it allows, silently, correctly. The half that
        // was broken is the one that matters: a run this concern DROVE, which then
        // completes and `git mv`s its roadmap in the same reply as the last
        // checkbox, per roadmap-progress-sync.
        //
        // Before the fix that fire returned a bare EXIT_ALLOW: no line said the run
        // had finished, and the state file survived with iterations and started_at
        // from the finished run — so a later claim by the same session id began with
        // part of the 25-iteration budget spent and the 4 h clock already running,
        // which the comment on the complete rung promises will not happen.
        const { main, worktree, sub } = writeNestedWorktreePair();
        // Fire once to create state — this run is now DRIVEN.
        dispatchStop(main, writeTranscript(3), sub);
        expect(events(main).filter((e) => e['event'] === 'engage').length).toBe(1);
        const stateFile = path.join(main, stateRelPath(deriveSessionKey(SESSION), SLUG));
        expect(fs.existsSync(stateFile)).toBe(true);

        // Now archive it the way a completing run does, in the SESSION tree only.
        const live = path.join(worktree, 'agents', 'roadmaps', `${SLUG}.md`);
        const archive = path.join(worktree, 'agents', 'roadmaps', 'archive');
        fs.mkdirSync(archive, { recursive: true });
        fs.renameSync(live, path.join(archive, `${SLUG}.md`));

        // FIRST absent fire: the line is written and the budget is NOT yet
        // reclaimed. Round 7 finding 1: one fire cannot tell an archival from a
        // non-atomic rewrite, and treating it as confirmation reset a live budget
        // to iteration 1 with a fresh 4 h clock, repeatably.
        const res = dispatchStop(main, writeTranscript(4), sub);
        expect(res.code).toBe(0);
        const absent = events(main).filter((e) => e['event'] === 'halt-roadmap-absent');
        expect(absent.length).toBe(1);
        expect(absent[0]?.['roadmap']).toBe(SLUG);
        expect(absent[0]?.['absent_fires']).toBe(1);
        expect(fs.existsSync(stateFile)).toBe(true);

        // SECOND consecutive absent fire confirms it: the budget is reclaimed, and
        // the ledger is NOT given a second identical line.
        dispatchStop(main, writeTranscript(5), sub);
        expect(events(main).filter((e) => e['event'] === 'halt-roadmap-absent').length).toBe(1);
        expect(fs.existsSync(stateFile)).toBe(false);
    });

    it('does not read a stall off the PREVIOUS source document', () => {
        // Round 5 findings 1 and 8 together: the reset existed and sat in the wrong
        // place — inside the engage branch, which runs after `ladder()` and after
        // the non-engage branch has already returned. So on the ONE fire where the
        // source changes, the stall test still compared counts from two files.
        //
        // The fixture is the reviewer's: the session tree has NO agents/roadmaps at
        // first, so three fires read the parent copy at a frozen count and build a
        // full stall window. Then the session tree gains its own copy AT THE SAME
        // COUNT. With the reset before the ladder, fire 4 engages on a cleared
        // window; with the reset after it, fire 4 returns halt-stall on the parent's
        // numbers and declares a working run finished.
        const { main, worktree, sub } = writeNestedWorktreePair();
        const wtRoadmaps = path.join(worktree, 'agents', 'roadmaps');
        fs.rmSync(wtRoadmaps, { recursive: true, force: true });
        // The parent copy is the only readable one, at a fixed two open steps.
        for (let i = 0; i < 3; i++) {
            dispatchStop(main, writeTranscript(3 + i), sub);
        }
        const before = events(main).filter((e) => e['event'] === 'engage');
        expect(before.length).toBe(3);
        expect(before.every((e) => e['open'] === 2)).toBe(true);
        expect(before.every((e) => e['roadmap_path'] === path.join(fs.realpathSync(main), 'agents', 'roadmaps', `${SLUG}.md`))).toBe(true);

        // The session tree gains its own copy, at the SAME count — the coincidence
        // the finding turns on.
        fs.mkdirSync(wtRoadmaps, { recursive: true });
        fs.writeFileSync(path.join(wtRoadmaps, `${SLUG}.md`), fixtureRoadmapWithOpen(2), 'utf-8');

        const res = dispatchStop(main, writeTranscript(6), sub);
        expect(events(main).filter((e) => e['event'] === 'halt-stall').length).toBe(0);
        expect(res.code).toBe(2);
        const after = events(main).filter((e) => e['event'] === 'engage');
        expect(after.length).toBe(4);
        expect(after[3]?.['roadmap_path']).toBe(
            path.join(fs.realpathSync(worktree), 'agents', 'roadmaps', `${SLUG}.md`),
        );
    });

    it('normalises a claim slug that carries the .md suffix', () => {
        // Round 5 finding 7: `claim_is_stale` strips a trailing `.md` before
        // resolving the same string and this did not, so such a claim rendered as
        // live work in the register while the concern resolved `<slug>.md.md`,
        // failed the read and allowed every stop.
        const root = writeWorkspace();
        fs.writeFileSync(
            path.join(root, roadmap_claim_rel(SESSION)),
            JSON.stringify({ slug: `${SLUG}.md`, session_id: SESSION }),
            'utf-8',
        );
        const res = dispatchStop(root, writeTranscript(3));
        expect(res.code).toBe(2);
        expect(events(root).filter((e) => e['event'] === 'engage').length).toBe(1);
    });

    it('accepts a legitimate slug containing a double dot', () => {
        // Round 5 finding 10: the containment guard tested the CHARACTERS for `..`
        // rather than the resulting structure, so `road-to-a..b` — a legal filename
        // — was refused and the concern silently allowed every stop.
        const root = writeWorkspace();
        const oddSlug = 'road-to-a..b';
        fs.writeFileSync(
            path.join(root, 'agents', 'roadmaps', `${oddSlug}.md`),
            fixtureRoadmap(),
            'utf-8',
        );
        fs.writeFileSync(
            path.join(root, roadmap_claim_rel(SESSION)),
            JSON.stringify({ slug: oddSlug, session_id: SESSION }),
            'utf-8',
        );
        const res = dispatchStop(root, writeTranscript(3));
        expect(res.code).toBe(2);
        const engaged = events(root).filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        expect(engaged[0]?.['roadmap']).toBe(oddSlug);
    });

    it('never erases a halt stamp when the roadmap goes absent', () => {
        // Round 6 finding 1, high. The absent rung cleared the state file
        // unconditionally, so one transient read failure of the roadmap — an
        // unlink-then-write by any tool, a git checkout or stash mid-run, an EACCES
        // — erased the halt stamp AND the budget. The next fire read no state,
        // started at iteration 0 with a fresh wall clock, and re-engaged with the
        // full 25-iteration cap: the unbounded loop `RunState.halted` exists to
        // prevent, restored by the branch meant to close a leak.
        const { main, worktree, sub } = writeNestedWorktreePair();
        const stateFile = path.join(main, stateRelPath(deriveSessionKey(SESSION), SLUG));
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(
            stateFile,
            JSON.stringify({
                started_at: '2026-08-19T00:00:00.000Z',
                iterations: 25,
                last_turn: 9,
                history: [1, 1, 1],
                roadmap: SLUG,
                halted: 'halt-max-iterations',
            }),
            'utf-8',
        );
        // The roadmap disappears from the session tree — archived, or mid-rewrite.
        fs.rmSync(path.join(worktree, 'agents', 'roadmaps', `${SLUG}.md`));

        const res = dispatchStop(main, writeTranscript(3), sub);
        expect(res.code).toBe(0);
        // No line: a halted run has already recorded its own end.
        expect(events(main).length).toBe(0);
        // And the stamp survives, which is the half that bounds the loop.
        expect(fs.existsSync(stateFile)).toBe(true);
        const kept = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;
        expect(kept['halted']).toBe('halt-max-iterations');
        expect(kept['iterations']).toBe(25);
    });

    it('does not inherit a halt stamped on a DIFFERENT roadmap, and does not destroy it', () => {
        // Round 6 finding 2 fixed the inheritance with an in-file slug guard; round 7
        // finding 3 showed that guard made the OTHER roadmap's halt stamp
        // destructible — nulling `prev` on a mismatch let the next write overwrite
        // it, so a halted roadmap became re-engageable with a full budget by the
        // detour of claiming something else once. The state is keyed on
        // (session, roadmap) now, so the two live in different files and neither
        // assertion below depends on a guard remembering to fire.
        const root = writeWorkspace();
        const otherSlug = 'road-to-some-other-thing';
        const otherFile = path.join(root, stateRelPath(deriveSessionKey(SESSION), otherSlug));
        fs.mkdirSync(path.dirname(otherFile), { recursive: true });
        const otherState = {
            started_at: '2026-08-19T00:00:00.000Z',
            iterations: 25,
            last_turn: 9,
            history: [7, 7, 7],
            roadmap: otherSlug,
            halted: 'halt-max-iterations',
        };
        fs.writeFileSync(otherFile, JSON.stringify(otherState), 'utf-8');

        const res = dispatchStop(root, writeTranscript(3));
        expect(res.code).toBe(2);
        const log = events(root);
        expect(log.filter((e) => e['event'] === 'engage').length).toBe(1);
        expect(log.filter((e) => String(e['event']).startsWith('halt-')).length).toBe(0);

        // A fresh budget for THIS roadmap.
        const mine = JSON.parse(
            fs.readFileSync(path.join(root, stateRelPath(deriveSessionKey(SESSION), SLUG)), 'utf-8'),
        ) as Record<string, unknown>;
        expect(mine['iterations']).toBe(1);
        expect(mine['roadmap']).toBe(SLUG);

        // And the other roadmap's halt is byte-identical — round 7 finding 3.
        expect(JSON.parse(fs.readFileSync(otherFile, 'utf-8'))).toEqual(otherState);
    });

    it('migrates a legacy per-session state file, and refuses a foreign one', () => {
        // The orphaning objection round 6 raised against keying the path is answered
        // by migrating rather than by avoiding: a pre-round-7 file is adopted once
        // when its recorded roadmap is absent or equal, and ignored when it belongs
        // to another roadmap.
        const root = writeWorkspace();
        const legacy = path.join(root, legacyStateRelPath(deriveSessionKey(SESSION)));
        fs.mkdirSync(path.dirname(legacy), { recursive: true });
        fs.writeFileSync(
            legacy,
            JSON.stringify({
                // NOW, not a fixed stamp: the wall-clock rung caps a run at 4 h, so a
                // midnight timestamp made this fixture halt instead of engaging and
                // the test measured the clock rather than the migration.
                started_at: new Date().toISOString(),
                iterations: 4,
                last_turn: 1,
                history: [1],
            }),
            'utf-8',
        );

        dispatchStop(root, writeTranscript(3));
        const engaged = events(root).filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        // The budget continued from 4 rather than restarting — the live-budget half
        // of the migration.
        expect(engaged[0]?.['iteration']).toBe(5);
        // And the keyed file is what gets written from now on.
        const keyed = path.join(root, stateRelPath(deriveSessionKey(SESSION), SLUG));
        expect(fs.existsSync(keyed)).toBe(true);
    });

    it('reports blocked — not complete — when the only open step is blocked, ONCE', () => {
        // Round 8 finding 3. `scanOpenSteps` excludes a `blocked-by:` step from the
        // open count, so this roadmap reads `open: 0, blocked: 1` — and the ladder
        // returned `complete` for it, reporting a completion the run never reached
        // and clearing the budget with it. ADR-235 defines exactly this state as
        // its own terminal outcome.
        const root = writeWorkspace();
        fs.writeFileSync(
            path.join(root, 'agents', 'roadmaps', `${SLUG}.md`),
            [
                '---',
                'complexity: structural',
                'execution:',
                '  mode: autonomous',
                '---',
                '',
                '# Fixture',
                '',
                '## Phase 0 — nothing runnable left',
                '',
                '- [x] **0.0** done',
                '- [ ] **0.1** gated <!-- blocked-by: some-human-gate -->',
                '',
            ].join('\n'),
            'utf-8',
        );

        dispatchStop(root, writeTranscript(3));
        dispatchStop(root, writeTranscript(4));

        const blocked = events(root).filter((e) => e['event'] === 'blocked');
        expect(blocked.length).toBe(1);
        expect(events(root).filter((e) => e['event'] === 'complete').length).toBe(0);
        expect(blocked[0]?.['blocked']).toBe(1);
        expect(blocked[0]?.['open']).toBe(0);
        // The header declares the provenance mandatory for EVERY event.
        expect(typeof blocked[0]?.['workspace_root']).toBe('string');
        expect(typeof blocked[0]?.['session_root']).toBe('string');
        expect(typeof blocked[0]?.['roadmap_path']).toBe('string');
        // Terminal AND cleared, like `complete`. Round 9 finding 1: keeping the
        // state here inherited a spent budget on the next claim, because `runId` is
        // a hash of the SESSION and not of the run — so the second fire above,
        // which stayed silent, must have stayed silent on the LEDGER rather than on
        // a field in a file that no longer exists.
        const keyed = path.join(root, stateRelPath(deriveSessionKey(SESSION), SLUG));
        expect(fs.existsSync(keyed)).toBe(false);
    });

    it('a re-claim after blocked starts a fresh budget, not the spent one', () => {
        // Round 9 finding 1, the consequence rather than the mechanism: `runId` is
        // `deriveSessionKey(sessionId)`, so this same session re-claiming this same
        // roadmap reuses the same keyed state path. With the state kept across
        // `blocked`, a run whose blocker was later cleared resumed on the previous
        // run's `iterations` — and since the ladder tests `blocked` BEFORE the
        // iteration cap, a spent budget meant `halt-max-iterations` without ever
        // engaging.
        const root = writeWorkspace();
        const blockedBody = [
            '---',
            'complexity: structural',
            'execution:',
            '  mode: autonomous',
            '---',
            '',
            '# Fixture',
            '',
            '## Phase 0 — nothing runnable left',
            '',
            '- [ ] **0.1** gated <!-- blocked-by: some-human-gate -->',
            '',
        ].join('\n');
        const roadmap = path.join(root, 'agents', 'roadmaps', `${SLUG}.md`);
        fs.writeFileSync(roadmap, blockedBody, 'utf-8');

        // Spend a budget first, then let the roadmap go blocked.
        const stateFile = path.join(root, stateRelPath(deriveSessionKey(SESSION), SLUG));
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(
            stateFile,
            JSON.stringify({
                started_at: new Date().toISOString(),
                iterations: 24,
                last_turn: 1,
                history: [1],
                roadmap: SLUG,
            }),
            'utf-8',
        );

        dispatchStop(root, writeTranscript(3));
        expect(events(root).filter((e) => e['event'] === 'blocked').length).toBe(1);

        // The blocker clears: the step becomes runnable again.
        fs.writeFileSync(roadmap, fixtureRoadmap(), 'utf-8');
        dispatchStop(root, writeTranscript(4));

        const after = events(root);
        expect(after.filter((e) => e['event'] === 'halt-max-iterations').length).toBe(0);
        const engaged = after.filter((e) => e['event'] === 'engage');
        expect(engaged.length).toBe(1);
        // Iteration 1, not 25: the budget was reclaimed by the blocked clear.
        expect(engaged[0]?.['iteration']).toBe(1);
    });

    it('clears the LEGACY state file too, so a migrated run cannot resume a spent budget', () => {
        // Round 8 finding 4: `readRunState` adopts the legacy per-session file, and
        // both clear sites removed only the keyed one — so on a migrated run every
        // clear was a no-op and the next read adopted the same spent budget again.
        const root = writeWorkspace();
        fs.writeFileSync(
            path.join(root, 'agents', 'roadmaps', `${SLUG}.md`),
            [
                '---',
                'complexity: structural',
                'execution:',
                '  mode: autonomous',
                '---',
                '',
                '# Fixture',
                '',
                '## Phase 0 — finished',
                '',
                '- [x] **0.0** done',
                '',
            ].join('\n'),
            'utf-8',
        );
        const legacy = path.join(root, legacyStateRelPath(deriveSessionKey(SESSION)));
        fs.mkdirSync(path.dirname(legacy), { recursive: true });
        fs.writeFileSync(
            legacy,
            JSON.stringify({
                started_at: new Date().toISOString(),
                iterations: 4,
                last_turn: 1,
                history: [1],
            }),
            'utf-8',
        );

        dispatchStop(root, writeTranscript(3));

        expect(events(root).filter((e) => e['event'] === 'complete').length).toBe(1);
        expect(fs.existsSync(legacy)).toBe(false);
    });

    it('leaves a legacy state file alone when this read did not adopt it', () => {
        // Round 9 finding 2: the first version of `clearRunState` reused the legacy
        // ADOPTION predicate as a DELETION predicate. A pre-round-7 legacy file
        // carries no `roadmap` field, so it is adoptable by every slug — right for
        // adopting and catastrophic for deleting: one slug's `complete` would take
        // another slug's live budget or halt stamp with it. Here a keyed file exists,
        // so the legacy file is NOT adopted, and the clear must not touch it.
        const root = writeWorkspace();
        fs.writeFileSync(
            path.join(root, 'agents', 'roadmaps', `${SLUG}.md`),
            [
                '---',
                'complexity: structural',
                'execution:',
                '  mode: autonomous',
                '---',
                '',
                '# Fixture',
                '',
                '## Phase 0 — finished',
                '',
                '- [x] **0.0** done',
                '',
            ].join('\n'),
            'utf-8',
        );
        const keyed = path.join(root, stateRelPath(deriveSessionKey(SESSION), SLUG));
        fs.mkdirSync(path.dirname(keyed), { recursive: true });
        fs.writeFileSync(
            keyed,
            JSON.stringify({
                started_at: new Date().toISOString(),
                iterations: 2,
                last_turn: 1,
                history: [1],
                roadmap: SLUG,
            }),
            'utf-8',
        );
        // Slug-less on purpose: this is the shape the adoption predicate accepts for
        // every slug, and therefore the one a deletion predicate must refuse.
        const legacy = path.join(root, legacyStateRelPath(deriveSessionKey(SESSION)));
        fs.mkdirSync(path.dirname(legacy), { recursive: true });
        fs.writeFileSync(
            legacy,
            JSON.stringify({
                started_at: new Date().toISOString(),
                iterations: 9,
                last_turn: 1,
                history: [1],
            }),
            'utf-8',
        );

        dispatchStop(root, writeTranscript(3));

        expect(events(root).filter((e) => e['event'] === 'complete').length).toBe(1);
        expect(fs.existsSync(keyed)).toBe(false);
        expect(fs.existsSync(legacy)).toBe(true);
    });

    it('writes ONE halt line, not one per subsequent stop fire', () => {
        // Round 6 finding 6: once `halted` is stamped the state file is immortal for
        // the session, so every later stop fire re-entered the non-engage branch and
        // appended another record with the same run_id and iterations — an unbounded
        // number of duplicates in the ledger the acceptance criteria count from.
        const root = writeWorkspace();
        const stateFile = path.join(root, stateRelPath(deriveSessionKey(SESSION), SLUG));
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(
            stateFile,
            JSON.stringify({
                started_at: '2026-08-19T00:00:00.000Z',
                iterations: 25,
                last_turn: 9,
                history: [1],
                roadmap: SLUG,
            }),
            'utf-8',
        );

        // First fire crosses the cap and stamps.
        dispatchStop(root, writeTranscript(3));
        expect(events(root).filter((e) => e['event'] === 'halt-max-iterations').length).toBe(1);
        // Two more fires say nothing new.
        dispatchStop(root, writeTranscript(4));
        dispatchStop(root, writeTranscript(5));
        expect(events(root).filter((e) => e['event'] === 'halt-max-iterations').length).toBe(1);
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

describe('run-continuation — the premise rung, through the live dispatcher', () => {
    // The reachability half. `ladder()` gains a `premiseInvalidated` parameter,
    // and a parameter nothing ever passes as `true` is a rung wired to nothing —
    // which is the defect class `road-to-wired-instruments` exists over,
    // reproduced inside its own fix. Only driving `main()` over a real
    // observation file can tell a live rung from a dead one.
    const writeObservation = (root: string, fingerprint: string): void => {
        const f = path.join(root, CONTEXT_OBSERVATION_REL);
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(
            f,
            JSON.stringify({ schema_version: 1, roadmap: SLUG, fingerprint, at: new Date().toISOString() }),
            'utf-8',
        );
    };

    it('an observation that MOVED after the run engaged halts it under the premise rung', () => {
        const root = writeWorkspace();
        writeObservation(root, 'fp-at-engage');
        // Fire 1 engages and records `fp-at-engage` as this run's premise.
        expect(dispatchStop(root, writeTranscript(3)).code).toBe(2);
        expect(events(root).filter((e) => e['event'] === 'engage').length).toBe(1);

        // The run re-probes and the world has moved.
        writeObservation(root, 'fp-after-a-peer-pushed');
        const second = dispatchStop(root, writeTranscript(4));
        expect(second.code).toBe(0);

        const halts = events(root).filter((e) => e['event'] === 'halt-premise-invalidated');
        expect(halts.length).toBe(1);
        // The crossing into the run vocabulary rides on the line, with the
        // version of the value domain it was written against.
        expect(halts[0]?.['terminal_state']).toBe('premise-invalidated');
        expect(halts[0]?.['terminal_vocabulary_version']).toBe(RUN_TERMINAL_VOCABULARY_VERSION);
        // NOT the counter rung: that is the whole point of 2.2.
        expect(events(root).filter((e) => e['event'] === 'halt-max-iterations').length).toBe(0);
    });

    it('an UNCHANGED observation across the same two fires never halts', () => {
        // Risk 1's negative case at the wiring level. A rung that fires whenever
        // an observation merely EXISTS would halt every autonomous run on its
        // second turn, and the positive case above cannot tell the two apart.
        const root = writeWorkspace();
        writeObservation(root, 'fp-steady');
        expect(dispatchStop(root, writeTranscript(3)).code).toBe(2);
        expect(dispatchStop(root, writeTranscript(4)).code).toBe(2);
        expect(events(root).filter((e) => e['event'] === 'halt-premise-invalidated').length).toBe(0);
        expect(events(root).filter((e) => e['event'] === 'engage').length).toBe(2);
    });

    it('no observation at all leaves the run exactly as it was before the rung existed', () => {
        const root = writeWorkspace();
        expect(dispatchStop(root, writeTranscript(3)).code).toBe(2);
        expect(dispatchStop(root, writeTranscript(4)).code).toBe(2);
        expect(events(root).filter((e) => e['event'] === 'halt-premise-invalidated').length).toBe(0);
        expect(events(root).filter((e) => e['event'] === 'engage').length).toBe(2);
    });
});
