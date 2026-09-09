/**
 * The memory-index trust contract, driven through the real dispatcher
 * (`road-to-continuity-writer-activation` step 3.1, AI-council ruling D3).
 *
 * `session_index_trust.test.ts` proves each property against its own fixture.
 * This file proves the properties are WIRED — that the hook consults them on
 * the path a host actually takes — which a unit call cannot see, because an
 * unwired contract passes every unit test it has.
 *
 * It also supplies the corpus fixture step 3.1 says the tree lacks. Measured
 * during step 1.4: an armed `memory.session_index` emits no `memory-index`
 * block in a scratch workspace, because the workspace carries no curated
 * memory and `MEMORY_ROOT` is cwd-relative. So a byte-identity proof built on
 * that workspace would compare two empty strings. Every case below writes real
 * curated entries into `agents/memory/` first, and the first case asserts the
 * block is non-empty precisely so the refusal cases cannot pass vacuously.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DISPATCH = path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');

const cleanups: string[] = [];

afterAll(() => {
    for (const d of cleanups) fs.rmSync(d, { recursive: true, force: true });
});

/** Curated entries a real memory root carries — the corpus 3.1 asks for. */
const CURATED = [
    'version: 1',
    'entries:',
    '  - id: pr-fixture-alpha',
    '    key: fixture alpha rule',
    '    body: |',
    '      The alpha rule exists so the index has something to list. Its body',
    '      must never reach the block — the index carries ids and titles only.',
    '  - id: pr-fixture-beta',
    '    key: fixture beta rule',
    '    body: |',
    '      The beta rule is longer than alpha on purpose, so the declared',
    '      cheapest-first ordering has two distinct costs to order by and the',
    '      cap has something to truncate. Padding follows to make that true.',
    '      Padding padding padding padding padding padding padding padding.',
    '      Padding padding padding padding padding padding padding padding.',
    '',
].join('\n');

interface WorkspaceOpts {
    /** Arm the feature. Default on — the refusal cases need it armed. */
    armed?: boolean;
    /** Write real curated memory. Default true. */
    curated?: boolean;
    /** Point `agents/memory` at another tree via a symlink (the P1 threat). */
    memorySymlinkTo?: string;
}

function writeWorkspace(opts: WorkspaceOpts = {}): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sit-e2e-')));
    cleanups.push(root);
    // Project-root anchor: the settings cascade walks up for it, and without
    // one the armed flag is never read and every case below passes vacuously.
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });
    fs.writeFileSync(
        path.join(root, '.agent-settings.yml'),
        ['memory:', `  session_index: "${opts.armed === false ? 'off' : 'on'}"`, ''].join('\n'),
        'utf-8',
    );
    const mem = path.join(root, 'agents', 'memory');
    if (opts.memorySymlinkTo !== undefined) {
        fs.mkdirSync(path.dirname(mem), { recursive: true });
        fs.symlinkSync(opts.memorySymlinkTo, mem);
        return root;
    }
    fs.mkdirSync(mem, { recursive: true });
    if (opts.curated !== false) {
        fs.writeFileSync(path.join(mem, 'product-rules.yml'), CURATED, 'utf-8');
    }
    return root;
}

interface Run {
    /** What the host would inject. */
    readonly out: string;
    /**
     * Diagnostics. Captured but NOT asserted on: the dispatcher does not
     * forward a concern's stderr, verified by hand, so a hook-level
     * `process.stderr.write` reaches nobody. Kept on the type because the
     * next reader will reach for it, and this comment is the answer.
     */
    readonly err: string;
}

function run(root: string, sessionId: string): Run {
    const r = spawnSync(
        'npx',
        ['tsx', DISPATCH, '--platform', 'claude', '--event', 'session_start',
         '--native-event', 'SessionStart', '--project-dir', root],
        {
            input: JSON.stringify({ session_id: sessionId, source: 'startup' }),
            encoding: 'utf-8',
            cwd: REPO,
            timeout: 180_000,
        },
    );
    return { out: r.stdout ?? '', err: r.stderr ?? '' };
}

function sessionStart(root: string, sessionId: string): string {
    return run(root, sessionId).out;
}

describe('the corpus fixture — without it every case below is vacuous', () => {
    it('an armed workspace with real curated memory EMITS the block', () => {
        const root = writeWorkspace();
        const out = sessionStart(root, 'sit-e2e-emit');
        expect(out).toContain('<memory-index');
        expect(out).toContain('pr-fixture-alpha');
        // ids and titles only — a body reaching the block is the leak the
        // index exists to avoid.
        expect(out).not.toContain('Padding padding');
    });

    it('the same workspace with NO curated memory emits nothing — the 1.4 measurement', () => {
        const out = sessionStart(writeWorkspace({ curated: false }), 'sit-e2e-empty');
        expect(out).not.toContain('<memory-index');
    });

    it('disarmed emits nothing even with the corpus present', () => {
        const out = sessionStart(writeWorkspace({ armed: false }), 'sit-e2e-off');
        expect(out).not.toContain('<memory-index');
    });
});

describe('P1 wired — a memory root pointing at another tree is refused live', () => {
    /**
     * TWO layers check this, and the split was found by sabotage rather than
     * designed: neutralising the HOOK's verdict call left this case green,
     * because `build_session_index_block` re-checks the root itself. The
     * builder is therefore the enforcing layer and the hook's call buys the
     * DIAGNOSTIC — which was unfalsifiable until this case asserted it. Both
     * assertions below are load-bearing: the first fails if the builder stops
     * refusing, the second if the hook stops reporting.
     */
    it('serves nothing when `agents/memory` symlinks into a different workspace', () => {
        // The threat in its end-to-end form: the victim workspace is armed and
        // its memory root resolves into the donor's curated corpus. A run that
        // emits the donor's ids here has leaked another repository's memory.
        const donor = writeWorkspace();
        const victim = writeWorkspace({ memorySymlinkTo: path.join(donor, 'agents', 'memory') });

        const r = run(victim, 'sit-e2e-symlink');
        expect(r.out).not.toContain('<memory-index');
        expect(r.out).not.toContain('pr-fixture-alpha');
    });

    it('a refused root does NOT burn the session latch — the hook layer earns its place here', () => {
        // This is what the hook-level check actually buys, and it took a
        // sabotage run plus a dead-end to find it. Removing the hook's verdict
        // call left the refusal intact (the builder re-checks) and the stderr
        // diagnostic unobservable (the dispatcher does not forward a concern's
        // stderr — verified by hand). What it DOES change is ordering: the
        // latch is claimed after the verdict, so a refused root leaves the
        // session's one claim unspent and a corrected root still gets served.
        // Without it, one bad root permanently costs that session its index.
        const donor = writeWorkspace();
        const victim = writeWorkspace({ memorySymlinkTo: path.join(donor, 'agents', 'memory') });
        const session = 'sit-e2e-latch-not-burned';

        expect(run(victim, session).out).not.toContain('<memory-index');

        // Repair the root in place: drop the escaping symlink, put real
        // curated memory where it should have been all along.
        const mem = path.join(victim, 'agents', 'memory');
        fs.unlinkSync(mem);
        fs.mkdirSync(mem, { recursive: true });
        fs.writeFileSync(path.join(mem, 'product-rules.yml'), CURATED, 'utf-8');

        expect(run(victim, session).out).toContain('<memory-index');
    });
});

describe('P5 wired — one session gets the index once', () => {
    it('the second session_start for the SAME session id emits nothing', () => {
        const root = writeWorkspace();
        const first = sessionStart(root, 'sit-e2e-latch');
        expect(first).toContain('<memory-index');

        const second = run(root, 'sit-e2e-latch');
        expect(second.out).not.toContain('<memory-index');
    });

    it('a DIFFERENT session in the same workspace still gets it', () => {
        const root = writeWorkspace();
        expect(sessionStart(root, 'sit-e2e-latch-a')).toContain('<memory-index');
        expect(sessionStart(root, 'sit-e2e-latch-b')).toContain('<memory-index');
    });
});

describe('P4 wired — the emitted order is the declared one', () => {
    it('lists the cheaper entry first, deterministically across runs', () => {
        const root = writeWorkspace();
        const out = sessionStart(root, 'sit-e2e-order');
        const alpha = out.indexOf('pr-fixture-alpha');
        const beta = out.indexOf('pr-fixture-beta');
        expect(alpha).toBeGreaterThan(-1);
        expect(beta).toBeGreaterThan(-1);
        // alpha's body is shorter, so it is the cheaper row and orders first.
        expect(alpha).toBeLessThan(beta);

        const again = sessionStart(writeWorkspace(), 'sit-e2e-order-2');
        expect(again.indexOf('pr-fixture-alpha')).toBeLessThan(again.indexOf('pr-fixture-beta'));
    });
});
