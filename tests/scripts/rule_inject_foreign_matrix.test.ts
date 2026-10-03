// The carrier, end to end, in a project that is not this repository
// (`road-to-a-rule-carrier-that-works-outside-the-repo` step 1.8).
//
// WHY THIS CANNOT BE A UNIT TEST. Every other fixture for this concern calls
// `main()` in-process, which means it never exercises the two things that
// actually broke in consumers: the BUILT bundle's own idea of where the package
// is, and the dispatcher's env handling. Both are invisible from inside the
// module.
//
//   · `dispatch_hook.ts` computes `REPO_ROOT` from `import.meta.url` with a
//     `__AGENT_CONFIG_BUNDLE__` sentinel picking two levels instead of three,
//     so the answer is right only in a real build.
//   · `_run_concern_inproc` REPLACES `process.env` with
//     `hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT })` before
//     calling a concern. An externally-supplied package root is therefore
//     scrubbed — a consumer cannot spoof it, and a test cannot inject one.
//     That is the behaviour, and it is why the fixture below builds a tree that
//     IS an install rather than pointing an env var at one.
//
// So each case copies the built bundle, the manifest, the shipped config and a
// small router into a temp directory, and runs THAT. The tree carries no
// `src/scripts/**/*.ts` at all, which is the "no source checkout" column of the
// matrix and the state every consumer is actually in.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_REL = path.join('dist', 'hooks', 'dispatch.js');

/**
 * A router with one prompt-reachable rule per tier, on a nonsense keyword.
 *
 * `zzmigration` rather than a real word: the dispatcher runs every concern
 * bound to this slot, and a prompt that trips another one would put its output
 * in the same stdout this test greps.
 */
const ROUTER = {
    kernel: ['kernel-rule'],
    tier_1: [
        { id: 'kernel-rule', triggers: [{ keyword: 'zzmigration' }] },
        { id: 'prompt-rule', triggers: [{ keyword: 'zzmigration' }] },
    ],
    tier_2: [{ id: 'second-rule', triggers: [{ keyword: 'zzmigration' }] }],
};

/**
 * `prompt-rule` carries an Iron Law section and `second-rule` does not.
 *
 * That asymmetry is what the compaction column reads: a restore sends LAWS, so
 * a rule with one comes back as `law` and a rule without one is reported rather
 * than having its whole body sent in a slot that asked for its law.
 */
const BODIES: Record<string, string> = {
    'kernel-rule': 'KERNEL BODY\n',
    'prompt-rule': '# prompt-rule\n\n## Iron Law\n\n```\nPROMPT RULE LAW.\n```\n\n## Notes\n\nPROMPT RULE BODY\n',
    'second-rule': 'SECOND RULE BODY\n',
};

const PROMPT = 'please plan the zzmigration';
const tmp: string[] = [];
/** Set when the environment cannot support the fixture; every case then skips. */
let unsupported: string | null = null;
let INSTALL = '';

function mkdtemp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmp.push(d);
    return d;
}

/** A directory shaped like an INSTALLED package: bundle, manifest, config, corpus. */
function makeInstall(): string {
    const root = mkdtemp('rule-inject-install-');
    const copy = (rel: string): void => {
        const dst = path.join(root, rel);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(path.join(REPO_ROOT, rel), dst);
    };
    copy(BUNDLE_REL);
    copy(path.join('src', 'scripts', 'hook_manifest.yaml'));
    const hooksDir = path.join('src', 'scripts', 'hooks');
    for (const f of fs.readdirSync(path.join(REPO_ROOT, hooksDir))) {
        if (f.endsWith('.yaml') || f.endsWith('.json')) copy(path.join(hooksDir, f));
    }
    fs.cpSync(path.join(REPO_ROOT, 'src', 'config'), path.join(root, 'src', 'config'), {
        recursive: true,
    });
    // The bundle resolves `yaml` at runtime. A real install has it as a
    // dependency; a symlink is the cheap equivalent and costs no copy. It is
    // NOT the bundle-inflating symlink the build warns about — nothing is
    // built here, only run.
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'), 'dir');

    fs.mkdirSync(path.join(root, 'dist', 'agent-src', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(ROUTER), 'utf-8');
    for (const [id, text] of Object.entries(BODIES)) {
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', `${id}.md`), text, 'utf-8');
    }
    return root;
}

interface Fired {
    status: number | null;
    /** Rule ids whose BODY reached the payload. */
    ids: string[];
    stdout: string;
    stderr: string;
}

/**
 * A home directory with no `~/.claude/rules` in it.
 *
 * Since step 1.3 the carrier scopes delivery to the host's rule layers, and
 * `os.homedir()` reads `$HOME` on POSIX. Without this the matrix would read the
 * DEVELOPER's installed corpus and answer differently on a maintainer machine
 * than in CI — and every column below would be a statement about one laptop.
 * `opts.home` lets a case stage a user layer of its own.
 */
let HOME = '';

function dispatch(
    install: string,
    workspace: string,
    session: string,
    opts: { cwd?: string; home?: string; event?: string; payload?: Record<string, unknown> } = {},
): Fired {
    const r = spawnSync(
        process.execPath,
        [
            path.join(install, BUNDLE_REL),
            '--platform', 'claude',
            '--event', opts.event ?? 'user_prompt_submit',
            '--project-dir', workspace,
        ],
        {
            encoding: 'utf-8',
            input: JSON.stringify(
                opts.payload ?? {
                    session_id: session,
                    cwd: workspace,
                    hook_event_name: 'UserPromptSubmit',
                    prompt: PROMPT,
                },
            ),
            cwd: opts.cwd ?? workspace,
            env: {
                ...process.env,
                AGENT_CONFIG_REPLAY: '',
                AGENT_CONFIG_SESSION_ROLE: '',
                HOME: opts.home ?? HOME,
            },
        },
    );
    const stdout = r.stdout ?? '';
    // The payload is JSON, so the attribute quotes arrive escaped.
    const ids = [...stdout.matchAll(/<rule id=\\?"([^"\\]+)/g)].map((m) => m[1] as string);
    return { status: r.status, ids, stdout, stderr: r.stderr ?? '' };
}

function settings(root: string, body: string, canonical = true): void {
    const rel = canonical
        ? ['agents', 'settings', '.agent-settings.yml']
        : ['.agent-settings.yml'];
    const p = path.join(root, ...rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
}

beforeAll(() => {
    if (!fs.existsSync(path.join(REPO_ROOT, BUNDLE_REL))) {
        const build = spawnSync('npm', ['run', 'build:hooks'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            timeout: 180_000,
        });
        if (build.status !== 0 || !fs.existsSync(path.join(REPO_ROOT, BUNDLE_REL))) {
            unsupported = 'dist/hooks/dispatch.js is absent and `npm run build:hooks` did not produce it';
            return;
        }
    }
    HOME = mkdtemp('rule-inject-home-');
    try {
        INSTALL = makeInstall();
    } catch (e) {
        // A platform that refuses the symlink (unprivileged Windows) cannot run
        // this fixture. Say so rather than passing vacuously.
        unsupported = `could not stage an install tree: ${e instanceof Error ? e.message : String(e)}`;
    }
}, 200_000);

afterAll(() => {
    while (tmp.length > 0) {
        const d = tmp.pop();
        if (d !== undefined) fs.rmSync(d, { recursive: true, force: true });
    }
});

/** Fail loudly when the fixture could not be staged — never pass by accident. */
function requireStaged(): void {
    if (unsupported !== null) throw new Error(`rule-inject foreign matrix unsupported here: ${unsupported}`);
}

describe('rule-inject — foreign-project matrix on the built bundle (1.8)', () => {
    it('empty project, settings absent — the template default delivers', () => {
        requireStaged();
        const ws = mkdtemp('rim-empty-');
        const r = dispatch(INSTALL, ws, 'rim-1');
        expect(r.status).toBe(0);
        // The shipped template is `delivery` on `claude-code`, so a consumer who
        // configured nothing still receives bodies — step 1.2's requirement,
        // through the bundle rather than through the resolver directly.
        expect(r.ids).toContain('prompt-rule');
        expect(r.stdout).toContain('PROMPT RULE BODY');
        // Kernel is standing context already and is never injected.
        expect(r.ids).not.toContain('kernel-rule');
    });

    it('no source checkout — the install carries no src/scripts/**/*.ts at all', () => {
        requireStaged();
        // The column stated as a property of the tree rather than asserted about
        // an emission: if this ever finds a `.ts`, the fixture has stopped
        // testing what it claims and every case above it is weaker than it reads.
        const hooks = path.join(INSTALL, 'src', 'scripts', 'hooks');
        const ts = fs.readdirSync(hooks).filter((f) => f.endsWith('.ts'));
        expect(ts).toEqual([]);
        expect(fs.existsSync(path.join(INSTALL, 'src', 'scripts', 'hooks', 'rule_inject_hook.ts'))).toBe(false);
    });

    it('settings eager-all — the carrier is silent', () => {
        requireStaged();
        const ws = mkdtemp('rim-eager-');
        settings(ws, 'lean_projection:\n  mode: eager-all\n');
        const r = dispatch(INSTALL, ws, 'rim-2');
        expect(r.status).toBe(0);
        expect(r.ids).toEqual([]);
    });

    it('settings delivery in the CANONICAL file the installer writes — delivers', () => {
        requireStaged();
        const ws = mkdtemp('rim-canon-');
        settings(ws, 'lean_projection:\n  mode: delivery\n  hosts: [claude-code]\n');
        const r = dispatch(INSTALL, ws, 'rim-3');
        expect(r.ids).toContain('prompt-rule');
    });

    it('settings delivery in the LEGACY root file — delivers', () => {
        requireStaged();
        const ws = mkdtemp('rim-legacy-');
        settings(ws, 'lean_projection:\n  mode: delivery\n  hosts: [claude-code]\n', false);
        const r = dispatch(INSTALL, ws, 'rim-4');
        expect(r.ids).toContain('prompt-rule');
    });

    it('settings naming another host — this host is not thinned, so nothing is delivered', () => {
        requireStaged();
        const ws = mkdtemp('rim-cursor-');
        settings(ws, 'lean_projection:\n  mode: delivery\n  hosts: [cursor]\n');
        const r = dispatch(INSTALL, ws, 'rim-5');
        expect(r.ids).toEqual([]);
    });

    it('agents/overrides/ in the consumer wins over the package copy', () => {
        requireStaged();
        const ws = mkdtemp('rim-override-');
        const dir = path.join(ws, 'agents', 'overrides');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'prompt-rule.md'), 'OVERRIDDEN IN THE CONSUMER\n', 'utf-8');
        const r = dispatch(INSTALL, ws, 'rim-6');
        expect(r.stdout).toContain('OVERRIDDEN IN THE CONSUMER');
        expect(r.stdout).not.toContain('PROMPT RULE BODY');
    });

    it('maintainer scope — a workspace carrying its own corpus answers from itself', () => {
        requireStaged();
        // The maintainer-checkout column. A tree that HAS `dist/agent-src/rules`
        // is served by it, never by the installed package, so this repository's
        // own behaviour is unchanged by the package fallback existing. A change
        // that repaired consumers by moving the maintainer tree would be one
        // nobody could review against a known-good reading.
        const ws = mkdtemp('rim-maintainer-');
        const own = path.join(ws, 'dist', 'agent-src', 'rules');
        fs.mkdirSync(own, { recursive: true });
        fs.writeFileSync(path.join(ws, 'dist', 'router.json'), JSON.stringify(ROUTER), 'utf-8');
        fs.writeFileSync(path.join(own, 'prompt-rule.md'), 'LOCAL CHECKOUT BODY\n', 'utf-8');
        const r = dispatch(INSTALL, ws, 'rim-10');
        expect(r.stdout).toContain('LOCAL CHECKOUT BODY');
        expect(r.stdout).not.toContain('PROMPT RULE BODY');
    });

    it('cwd elsewhere mid-session — delivery follows the workspace, not the process cwd', () => {
        requireStaged();
        const ws = mkdtemp('rim-cwd-');
        const elsewhere = mkdtemp('rim-elsewhere-');
        const r = dispatch(INSTALL, ws, 'rim-7', { cwd: elsewhere });
        expect(r.status).toBe(0);
        expect(r.ids).toContain('prompt-rule');
    });

    it('package corpus missing — one diagnostic line, never a silent empty delivery', () => {
        requireStaged();
        // The "package moved after install" column, in the only form reachable
        // from here: the bundle must still be where it is to run at all, so what
        // is removed is the corpus beside it.
        const broken = makeInstall();
        fs.rmSync(path.join(broken, 'dist', 'router.json'), { force: true });
        fs.rmSync(path.join(broken, 'dist', 'agent-src'), { recursive: true, force: true });
        const ws = mkdtemp('rim-broken-');
        const r = dispatch(broken, ws, 'rim-8');
        expect(r.ids).toEqual([]);
        // WHERE THE DIAGNOSTIC LANDS, pinned because it is not where writing it
        // would suggest. A concern's own stderr is captured by
        // `_run_concern_inproc` and re-emitted only at rc >= 3, so a concern
        // exiting allow is silent by construction. The concern therefore warns
        // with a `reason`, and `emitFor` translates an advisory warn on this
        // slot into `additionalContext` at exit 0 — so the line reaches the
        // MODEL. Exit 0 matters as much as the text: an advisory concern must
        // never block a prompt, and on this host exit 2 on UserPromptSubmit
        // would erase it.
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('rule-inject: no rule source');
        expect(r.stdout).toContain('additionalContext');
    });

    it('a consumer .claude/rules directory IS the delivery scope (1.3)', () => {
        requireStaged();
        // The install declares WHICH rules a consumer is under; the package
        // supplies the text. `second-rule` routes and its body exists in the
        // package corpus, and it is still not delivered, because this consumer's
        // install never wrote it.
        const ws = mkdtemp('rim-scope-');
        const rules = path.join(ws, '.claude', 'rules');
        fs.mkdirSync(rules, { recursive: true });
        fs.writeFileSync(path.join(rules, 'prompt-rule.md'), 'INSTALLED STUB\n', 'utf-8');
        const r = dispatch(INSTALL, ws, 'rim-9');
        expect(r.ids).toContain('prompt-rule');
        expect(r.ids).not.toContain('second-rule');
        // And the body is the package's, not the stub the host layer carries.
        expect(r.stdout).toContain('PROMPT RULE BODY');
        expect(r.stdout).not.toContain('INSTALLED STUB');
    });

    it('the compaction restore reaches the concern through the DISPATCHER (1.6)', () => {
        requireStaged();
        // The binding, not the function. `rule-inject` was added to `claude`'s
        // `session_start` list in the manifest, and the dispatcher decides which
        // concerns a slot reaches: a suite that only calls `main()` stays green
        // over a concern the dispatcher never invokes.
        const ws = mkdtemp('rim-compact-');
        const session = 'rim-12';
        const first = dispatch(INSTALL, ws, session);
        expect(first.ids).toContain('prompt-rule');

        const compacted = dispatch(INSTALL, ws, session, {
            event: 'pre_compact',
            payload: { session_id: session, cwd: ws, hook_event_name: 'PreCompact' },
        });
        expect(compacted.status).toBe(0);

        const restored = dispatch(INSTALL, ws, session, {
            event: 'session_start',
            payload: {
                session_id: session,
                cwd: ws,
                hook_event_name: 'SessionStart',
                source: 'compact',
            },
        });
        expect(restored.status).toBe(0);
        expect(restored.stdout).toContain('prompt-rule=law');
        expect(restored.stdout).toContain('PROMPT RULE LAW.');
        // The law, not the body, for the rule that HAS one.
        expect(restored.stdout).not.toContain('PROMPT RULE BODY');
        // `second-rule` has no law section, so there is nothing to send in that
        // form and no budget decision was made about it. It comes back as its
        // body rather than carrying a label that blames a budget — which is
        // what every label on a restore has to be true of.
        expect(restored.stdout).toContain('second-rule=full');
        expect(restored.stdout).toContain('SECOND RULE BODY');
    });

    it('a rule only the USER layer carries is in scope — the host loads both', () => {
        requireStaged();
        const ws = mkdtemp('rim-scope-user-');
        const home = mkdtemp('rim-scope-home-');
        const rules = path.join(home, '.claude', 'rules');
        fs.mkdirSync(rules, { recursive: true });
        fs.writeFileSync(path.join(rules, 'second-rule.md'), 'INSTALLED STUB\n', 'utf-8');
        const r = dispatch(INSTALL, ws, 'rim-11', { home });
        expect(r.ids).toEqual(['second-rule']);
    });
});
