/**
 * Memory recall — `pre_tool_use` concern
 * (`src/scripts/hooks/memory_recall_hook.ts`).
 *
 * The load-bearing layer here is the INCIDENT REPLAY block: each of the four
 * seeded rules is driven through the spawned hook with the envelope shape the
 * dispatcher actually writes, reconstructed from the real tool call that went
 * wrong. A matcher proven only against a fixture someone wrote to flatter it
 * has demonstrated nothing, which is why each replay is paired with its
 * NEAR-MISS — the call that differs in exactly the one condition the rule
 * depends on, asserted silent.
 *
 * The memory store is a temp directory carrying the four real slugs and their
 * real frontmatter descriptions, pointed at via `AGENT_CONFIG_MEMORY_DIR`.
 * Reading the developer's actual `~/.claude` store would make these results
 * environment-dependent; the ancestor-walk that finds the real store is tested
 * separately against a synthetic projects root.
 *
 * All fixtures live under `os.tmpdir()` — no tracked file is ever written.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    CAP_BYTES,
    RECALL_RULES,
    buildEmission,
    deriveSessionKey,
    extractCall,
    latchFile,
    matchRule,
    nodeModulesIsSymlink,
    readMemoryDescription,
    resolveMemoryDir,
    ruleRoots,
    truncateBytes,
} from '../../src/scripts/hooks/memory_recall_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'memory_recall_hook.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

/**
 * The four memories, with the `description:` line each really carries in the
 * store as of 2026-09-12. Two are short and two are long on purpose: the long
 * pair is what exercises the cap.
 */
const REAL_DESCRIPTIONS: Record<string, string> = {
    'worktree-build-poisons-install-bundle':
        '`npm run build` inside a worktree with a symlinked node_modules bakes ../../../node_modules/ paths into the TRACKED dist/install/install.mjs — revert it before committing, and revert the secret-scanner report date too',
    'adding-an-adr-downstream-surface':
        'A new ADR needs INDEX.md AND the evidence census regenerated — the census staleness reds the Rule-backstops CI job, and no local preflight gate catches it',
    'adding-a-src-install-module-needs-two-builds':
        'A new file under src/install/ (or an edit to src/scripts/install.ts) reds TWO CI freshness gates that no local battery or `task preflight` covers — `npm run build:cli` AND `npm run build:install-bundle` are both required, and the bundle must be built with a REAL node_modules or it leaks the developer’s home path',
    'hook-latency-gate-has-runner-variance':
        'bench_hook_latency --gate is the one CI gate that fails on a loaded runner rather than on your diff — read main’s numbers for the same job FIRST (step one, not the fallback), then re-run the job on the same SHA. Measured seven times; the trunk has drifted 72 ms in under an hour with no diff to explain it, and the observed band now reaches 194 ms — do NOT treat 159 as its ceiling.',
};

const tmp_dirs: string[] = [];

afterEach(() => {
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

function mkTmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix));
    tmp_dirs.push(d);
    return d;
}

/** A temp memory store carrying the four real slugs with their real descriptions. */
function makeStore(): string {
    const dir = path.join(mkTmp('memory-recall-store-'), 'memory');
    fs.mkdirSync(dir, { recursive: true });
    for (const [slug, description] of Object.entries(REAL_DESCRIPTIONS)) {
        fs.writeFileSync(
            path.join(dir, `${slug}.md`),
            `---\nname: ${slug}\ndescription: "${description}"\nmetadata:\n  type: project\n---\n\nbody that is never read\n`,
        );
    }
    return dir;
}

/**
 * A workspace whose `node_modules` is a SYMLINK — the condition that separates
 * a poisoning build from an ordinary one.
 */
function makeSymlinkedWorktree(): string {
    const base = mkTmp('memory-recall-ws-');
    const real = path.join(base, 'checkout', 'node_modules');
    fs.mkdirSync(real, { recursive: true });
    const wt = path.join(base, 'worktree');
    fs.mkdirSync(wt, { recursive: true });
    fs.symlinkSync(real, path.join(wt, 'node_modules'), 'dir');
    return wt;
}

/** A workspace with a real `node_modules` directory. */
function makeRealCheckout(): string {
    const root = mkTmp('memory-recall-main-');
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    return root;
}

/** The dispatcher envelope, shaped as `src/scripts/hooks/envelope.ts` documents it. */
function envelope(root: string, payload: unknown, session = 'sess-1'): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'pre_tool_use',
        native_event: 'PreToolUse',
        session_id: session,
        workspace_root: root,
        payload,
    });
}

/** The Claude Code PreToolUse payload for a shell call. */
function bashPayload(command: string, root: string): unknown {
    return {
        session_id: 'sess-1',
        transcript_path: '/dev/null',
        cwd: root,
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command, description: 'a description the hook never reads' },
    };
}

/** The Claude Code PreToolUse payload for an edit call. */
function editPayload(filePath: string, root: string, tool = 'Edit'): unknown {
    return {
        session_id: 'sess-1',
        transcript_path: '/dev/null',
        cwd: root,
        hook_event_name: 'PreToolUse',
        tool_name: tool,
        tool_input: { file_path: filePath, old_string: 'a', new_string: 'b' },
    };
}

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
}

function run(input: string, cwd: string, store: string | null): Run {
    const env = { ...process.env };
    if (store === null) delete env['AGENT_CONFIG_MEMORY_DIR'];
    else env['AGENT_CONFIG_MEMORY_DIR'] = store;
    const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd, input, env });
    expect(r.status).not.toBeNull();
    return { status: r.status, stdout: r.stdout as string, stderr: r.stderr as string };
}

function parseEmission(r: Run): { decision: string; reason: string; additional_context: string } {
    return JSON.parse(r.stdout.trim()) as {
        decision: string;
        reason: string;
        additional_context: string;
    };
}

describe('incident replay: each seeded rule fires on the real tool call', () => {
    it('1. a build command in a worktree whose node_modules is a symlink', () => {
        const ws = makeSymlinkedWorktree();
        const store = makeStore();
        const r = run(envelope(ws, bashPayload('npm run build', ws)), ws, store);

        expect(r.status).toBe(2);
        const out = parseEmission(r);
        expect(out.decision).toBe('warn');
        expect(out.reason).toBe('memory-recall: worktree-build-poisons-install-bundle');
        expect(out.additional_context).toContain('SYMLINK');
        expect(out.additional_context).toContain('dist/install/install.mjs');
        expect(out.additional_context).toContain(
            path.join(store, 'worktree-build-poisons-install-bundle.md'),
        );
    });

    it('1b. NEAR MISS — the same build in a checkout with a real node_modules is silent', () => {
        const ws = makeRealCheckout();
        const r = run(envelope(ws, bashPayload('npm run build', ws)), ws, makeStore());
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('');
    });

    it('1c. the narrower build spellings fire too, and an unrelated npm script does not', () => {
        const ws = makeSymlinkedWorktree();
        const store = makeStore();
        for (const cmd of ['npm run build:install-bundle', 'npx esbuild src/x.ts --bundle']) {
            const r = run(envelope(ws, bashPayload(cmd, ws), `s-${cmd}`), ws, store);
            expect(r.status, cmd).toBe(2);
        }
        const quiet = run(envelope(ws, bashPayload('npm run typecheck', ws), 's-q'), ws, store);
        expect(quiet.status).toBe(0);
    });

    it('2. an edit whose target is docs/decisions/ADR-*.md', () => {
        const ws = makeRealCheckout();
        const store = makeStore();
        const target = path.join(ws, 'docs', 'decisions', 'ADR-260-a-new-decision.md');
        const r = run(envelope(ws, editPayload(target, ws)), ws, store);

        expect(r.status).toBe(2);
        const out = parseEmission(r);
        expect(out.reason).toBe('memory-recall: adding-an-adr-downstream-surface');
        expect(out.additional_context).toContain('evidence census');
        expect(out.additional_context).toContain('Rule-backstops');
    });

    it('2b. NEAR MISS — a non-ADR file in the same directory is silent', () => {
        const ws = makeRealCheckout();
        const target = path.join(ws, 'docs', 'decisions', 'INDEX.md');
        const r = run(envelope(ws, editPayload(target, ws)), ws, makeStore());
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('');
    });

    it('3. an edit to a src/install/ module (the narrowed form of the commit case)', () => {
        const ws = makeRealCheckout();
        const store = makeStore();
        const target = path.join(ws, 'src', 'install', 'rule_scope.ts');
        const r = run(envelope(ws, editPayload(target, ws, 'Write')), ws, store);

        expect(r.status).toBe(2);
        const out = parseEmission(r);
        expect(out.reason).toBe('memory-recall: adding-a-src-install-module-needs-two-builds');
        expect(out.additional_context).toContain('build:install-bundle');
    });

    it('3b. src/scripts/install.ts fires; a look-alike path does not', () => {
        const ws = makeRealCheckout();
        const store = makeStore();
        const hit = run(
            envelope(ws, editPayload(path.join(ws, 'src/scripts/install.ts'), ws), 's-hit'),
            ws,
            store,
        );
        expect(hit.status).toBe(2);
        const miss = run(
            envelope(ws, editPayload(path.join(ws, 'src/installer/thing.ts'), ws), 's-miss'),
            ws,
            store,
        );
        expect(miss.status).toBe(0);
    });

    it('4. a local hook-latency bench, which the memory says is the wrong first move', () => {
        const ws = makeRealCheckout();
        const store = makeStore();
        const r = run(
            envelope(ws, bashPayload('./scripts-run src/scripts/bench_hook_latency --runs 50', ws)),
            ws,
            store,
        );

        expect(r.status).toBe(2);
        const out = parseEmission(r);
        expect(out.reason).toBe('memory-recall: hook-latency-gate-has-runner-variance');
        expect(out.additional_context).toContain('step ONE');
    });

    it('4b. NEAR MISS — an unrelated bench invocation is silent', () => {
        const ws = makeRealCheckout();
        const r = run(
            envelope(ws, bashPayload('./scripts-run src/scripts/bench_hook_injection', ws)),
            ws,
            makeStore(),
        );
        expect(r.status).toBe(0);
    });

    it('every rule in the committed table has a replay above', () => {
        // The roster guard: a row added without a replay case reds here rather
        // than shipping as an unproven matcher.
        expect(RECALL_RULES.map((r) => r.id).sort()).toEqual(
            [
                'adr-edit',
                'build-in-symlinked-worktree',
                'hook-latency-bench',
                'install-source-edit',
            ].sort(),
        );
    });
});

describe('the silent path', () => {
    it('an ordinary command, an ordinary edit and a Read all stay silent', () => {
        const ws = makeRealCheckout();
        const store = makeStore();
        const cases: unknown[] = [
            bashPayload('git status --porcelain', ws),
            bashPayload('ls -la src/', ws),
            editPayload(path.join(ws, 'src', 'scripts', 'hooks', 'envelope.ts'), ws),
            {
                tool_name: 'Read',
                tool_input: { file_path: path.join(ws, 'docs/decisions/ADR-001-x.md') },
            },
        ];
        for (const [i, payload] of cases.entries()) {
            const r = run(envelope(ws, payload, `s-${String(i)}`), ws, store);
            expect(r.status, JSON.stringify(payload)).toBe(0);
            expect(r.stdout).toBe('');
        }
    });

    it('a non-pre_tool_use event is ignored', () => {
        const ws = makeSymlinkedWorktree();
        const raw = JSON.parse(envelope(ws, bashPayload('npm run build', ws))) as Record<
            string,
            unknown
        >;
        raw['event'] = 'post_tool_use';
        const r = run(JSON.stringify(raw), ws, makeStore());
        expect(r.status).toBe(0);
    });

    it('malformed stdin never touches the tool call', () => {
        const ws = makeRealCheckout();
        for (const input of ['', 'not json', '{"payload":']) {
            const r = run(input, ws, makeStore());
            expect(r.status, input).toBe(0);
        }
    });
});

describe('advisory only', () => {
    it('no replayed call returns exit 1', () => {
        const wt = makeSymlinkedWorktree();
        const ws = makeRealCheckout();
        const store = makeStore();
        const inputs = [
            envelope(wt, bashPayload('npm run build', wt), 'a'),
            envelope(ws, editPayload(path.join(ws, 'docs/decisions/ADR-9-x.md'), ws), 'b'),
            envelope(ws, editPayload(path.join(ws, 'src/install/x.ts'), ws), 'c'),
            envelope(ws, bashPayload('bench_hook_latency', ws), 'd'),
            'garbage',
        ];
        for (const input of inputs) {
            const cwd = input.includes('worktree') ? wt : ws;
            expect(run(input, cwd, store).status).not.toBe(1);
        }
    });

    it('the manifest declares the concern advisory and not fail-closed', () => {
        const manifest = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'),
            'utf8',
        );
        const block = /\n {2}memory-recall:\n((?: {4}.*\n)+)/.exec(manifest);
        expect(block, 'memory-recall has no concern block in the manifest').not.toBeNull();
        expect((block as RegExpExecArray)[1]).toContain('severity: advisory');
        expect((block as RegExpExecArray)[1]).toContain('fail_closed: false');
    });
});

describe('byte budget', () => {
    it('every rule emits under the cap against its real description', () => {
        const store: { dir: string; tried: string[] } = {
            dir: '/Users/someone/.claude/projects/-Users-someone-projects-a-long-project-name/memory',
            tried: [],
        };
        for (const rule of RECALL_RULES) {
            const e = buildEmission(rule, store, REAL_DESCRIPTIONS[rule.slug] ?? null);
            const bytes =
                Buffer.byteLength(e.reason, 'utf8') +
                Buffer.byteLength(e.additional_context, 'utf8');
            expect(bytes, `${rule.id} emitted ${String(bytes)} bytes`).toBeLessThanOrEqual(
                CAP_BYTES,
            );
        }
    });

    it('the registered budget row matches the constant the code enforces', () => {
        const budget = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'src', 'config', 'hook-token-budget.json'), 'utf8'),
        ) as { per_concern_caps_bytes: Record<string, unknown> };
        expect(budget.per_concern_caps_bytes['memory-recall']).toBe(CAP_BYTES);
    });

    it('a pathological description is truncated rather than over-emitted', () => {
        const e = buildEmission(RECALL_RULES[0] as (typeof RECALL_RULES)[number], { dir: '/m', tried: [] }, 'x'.repeat(9000));
        const bytes =
            Buffer.byteLength(e.reason, 'utf8') + Buffer.byteLength(e.additional_context, 'utf8');
        expect(bytes).toBeLessThanOrEqual(CAP_BYTES);
        expect(e.additional_context).toContain('...');
    });

    it('truncateBytes cuts on a character boundary, never mid-codepoint', () => {
        const out = truncateBytes('é'.repeat(20), 12);
        expect(Buffer.byteLength(out, 'utf8')).toBeLessThanOrEqual(12);
        expect(out.endsWith('...')).toBe(true);
        expect(Buffer.from(out, 'utf8').toString('utf8')).toBe(out);
    });
});

describe('per-session per-slug latch', () => {
    it('the same memory is delivered once, not on every matching call', () => {
        const ws = makeSymlinkedWorktree();
        const store = makeStore();
        const first = run(envelope(ws, bashPayload('npm run build', ws)), ws, store);
        expect(first.status).toBe(2);
        const second = run(envelope(ws, bashPayload('npm run build:cli', ws)), ws, store);
        expect(second.status).toBe(0);
        expect(second.stdout).toBe('');
    });

    it('a different session is told again', () => {
        const ws = makeSymlinkedWorktree();
        const store = makeStore();
        expect(run(envelope(ws, bashPayload('npm run build', ws), 'one'), ws, store).status).toBe(2);
        expect(run(envelope(ws, bashPayload('npm run build', ws), 'two'), ws, store).status).toBe(2);
    });

    it('the latch file holds slug keys and timestamps only — no path, no command', () => {
        const ws = makeSymlinkedWorktree();
        run(envelope(ws, bashPayload('npm run build --workspace secret-name', ws)), ws, makeStore());
        const file = latchFile(ws, deriveSessionKey({ session_id: 'sess-1' }, {}));
        const latch = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
        expect(Object.keys(latch)).toEqual(['worktree-build-poisons-install-bundle']);
        expect(typeof latch['worktree-build-poisons-install-bundle']).toBe('number');
        expect(fs.readFileSync(file, 'utf8')).not.toContain('secret-name');
    });
});

describe('store diagnostics', () => {
    it('an unresolvable store still emits the pointer and says so on stderr', () => {
        const ws = makeSymlinkedWorktree();
        const missing = path.join(mkTmp('memory-recall-absent-'), 'nope');
        const r = run(envelope(ws, bashPayload('npm run build', ws)), ws, missing);

        expect(r.status).toBe(2);
        const out = parseEmission(r);
        expect(out.reason).toBe('memory-recall: worktree-build-poisons-install-bundle');
        expect(out.additional_context).toContain('not resolvable');
        expect(r.stderr).toContain('no memory store was resolvable');
        expect(r.stderr).toContain(missing);
    });

    it('a resolvable store missing the file emits the pointer and a second diagnostic', () => {
        const ws = makeSymlinkedWorktree();
        const empty = mkTmp('memory-recall-empty-');
        const r = run(envelope(ws, bashPayload('npm run build', ws)), ws, empty);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('was unreadable under');
    });
});

describe('extractCall', () => {
    it('reads the tool name and target across host spellings', () => {
        expect(extractCall({ tool_name: 'Edit', tool_input: { file_path: 'a/b.md' } }).paths).toEqual(
            ['a/b.md'],
        );
        expect(extractCall({ toolName: 'Write', input: { path: 'c\\d.md' } }).paths).toEqual([
            'c/d.md',
        ]);
        expect(extractCall({ tool: 'Bash', tool_input: { command: 'x' } }).command).toBe('x');
        expect(extractCall({}).tool).toBe('');
    });
});

describe('matchRule', () => {
    const ctx = { roots: ['/nope'] };
    it('returns the first matching row and null otherwise', () => {
        const hit = matchRule(
            { tool: 'Edit', paths: ['docs/decisions/ADR-1-x.md'], command: '', cwd: '' },
            ctx,
        );
        expect(hit?.slug).toBe('adding-an-adr-downstream-surface');
        expect(
            matchRule({ tool: 'Edit', paths: ['README.md'], command: '', cwd: '' }, ctx),
        ).toBeNull();
    });

    it('an environment predicate that fails suppresses an otherwise matching row', () => {
        const call = { tool: 'Bash', paths: [], command: 'npm run build', cwd: '' };
        expect(matchRule(call, { roots: ['/definitely/not/a/repo'] })).toBeNull();
    });
});

describe('ruleRoots — workspace_root alone is not enough in a worktree', () => {
    it('offers the payload cwd first, then workspace_root, deduped', () => {
        const call = { tool: 'Bash', paths: [], command: 'x', cwd: '/wt' };
        expect(ruleRoots(call, '/checkout').roots).toEqual(['/wt', '/checkout']);
        expect(ruleRoots({ ...call, cwd: '/checkout' }, '/checkout').roots).toEqual(['/checkout']);
        expect(ruleRoots({ ...call, cwd: '' }, '/checkout').roots).toEqual(['/checkout']);
    });

    it('fires when the WORKTREE is symlinked though the project dir is not', () => {
        // The live topology: the Claude hook command passes $CLAUDE_PROJECT_DIR
        // as --project-dir, and the dispatcher makes that workspace_root. In a
        // worktree session that is the parent checkout, whose node_modules is
        // real. Only the payload cwd carries the symlinked worktree.
        const worktree = makeSymlinkedWorktree();
        const parent = makeRealCheckout();
        const call = { tool: 'Bash', paths: [], command: 'npm run build', cwd: worktree };
        expect(matchRule(call, ruleRoots(call, parent))?.slug).toBe(
            'worktree-build-poisons-install-bundle',
        );
        // ...and stays silent when neither root is a worktree.
        const flat = { ...call, cwd: parent };
        expect(matchRule(flat, ruleRoots(flat, parent))).toBeNull();
    });
});

describe('nodeModulesIsSymlink', () => {
    it('separates a symlinked worktree from a real checkout, and tolerates neither', () => {
        expect(nodeModulesIsSymlink(makeSymlinkedWorktree())).toBe(true);
        expect(nodeModulesIsSymlink(makeRealCheckout())).toBe(false);
        expect(nodeModulesIsSymlink(mkTmp('memory-recall-bare-'))).toBe(false);
    });
});

describe('readMemoryDescription', () => {
    it('reads the frontmatter line and strips its quotes', () => {
        const store = makeStore();
        expect(readMemoryDescription(store, 'adding-an-adr-downstream-surface')).toBe(
            REAL_DESCRIPTIONS['adding-an-adr-downstream-surface'],
        );
        expect(readMemoryDescription(store, 'no-such-memory')).toBeNull();
    });
});

describe('resolveMemoryDir', () => {
    it('walks ancestors, because a worktree slug has no memory dir of its own', () => {
        const projects = mkTmp('memory-recall-projects-');
        const checkout = mkTmp('memory-recall-checkout-');
        const worktree = path.join(checkout, '.claude', 'worktrees', 'lane');
        fs.mkdirSync(worktree, { recursive: true });

        const slug = checkout.replace(/[^A-Za-z0-9-]/g, '-');
        const store = path.join(projects, slug, 'memory');
        fs.mkdirSync(store, { recursive: true });

        const found = resolveMemoryDir(worktree, projects, {});
        expect(found.dir).toBe(store);
        // The worktree's own slug was tried first and had no memory dir.
        expect(found.tried.length).toBeGreaterThan(1);
        expect(found.tried[0]).not.toBe(store);
    });

    it('reports every candidate when nothing resolves', () => {
        const projects = mkTmp('memory-recall-empty-projects-');
        const found = resolveMemoryDir(mkTmp('memory-recall-lonely-'), projects, {});
        expect(found.dir).toBeNull();
        expect(found.tried.length).toBeGreaterThan(0);
    });
});
