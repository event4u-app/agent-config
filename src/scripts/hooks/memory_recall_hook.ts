#!/usr/bin/env node
/**
 * Memory recall — `pre_tool_use` concern. Delivers a memory the store ALREADY
 * holds, at the moment the tool call it is about would run, instead of after
 * it has gone wrong.
 *
 * The finding it is built from, measured rather than supposed: in one long
 * autonomous run the agent walked into four distinct traps that each already
 * had a memory file, some weeks old. The store's own index records the same
 * shape on an earlier day — "of eleven error classes in one session, nine had
 * a file here already and all nine were read AFTER the failure". So the store
 * is not the gap; retrieval is. `memory_lookup` exists as a CLI and nothing
 * calls it automatically, which makes recall model-carried and therefore
 * weakest exactly when the agent is busy.
 *
 * Per `recurring-criticism`, a criticism that arrives again is evidence about
 * the system. Writing a fifth memory file is the item response; delivering the
 * four that exist, before the action, is the system one.
 *
 * A committed trigger table, never a similarity score. `RECALL_RULES` is a
 * short, hand-authored table. Each row names ONE memory slug and ONE
 * precisely-decidable condition on the tool payload. There is no ranking, no
 * threshold, no lexical match against 467 files: a fuzzy matcher over the
 * whole store would fire on most calls, and the sibling concern that measured
 * this (`skill-route`, silent on ~86% of prompts by design) is why the floor
 * here is a predicate rather than a score. A predicate is also falsifiable —
 * every row is replayed against the real payload shape in
 * `tests/scripts/memory_recall_hook.test.ts`, so a row that cannot fire fails
 * a test instead of degrading quietly into noise.
 *
 * Advisory only — never a block. It binds on the slot that carries the
 * blocking guards and never returns exit 1 on any path. A recall hook that can
 * refuse a tool call is a larger failure mode than the one it closes: a stale
 * trigger row would then deny work over a bookkeeping artefact. Delivery
 * mirrors `reread_guard_hook.ts` exactly — `{decision:"warn", reason,
 * additional_context}` at exit 2, which `host_semantics.emitFor` turns into a
 * host-facing exit 0 unconditionally on the verified `claude` platform.
 *
 * Budget. `pre_tool_use` fires once per tool call, the most expensive slot
 * there is. ONE memory per fire, pointer plus the memory's own one-line
 * description, truncated to `CAP_BYTES` (768 — declared BELOW the 1024 default
 * in `src/config/hook-token-budget.json` deliberately, so a later change that
 * starts injecting memory BODIES fails the build instead of quietly tripling a
 * per-call slot). Injecting a whole memory file would be 1.5-6 kB per fire.
 *
 * Cost of the silent path. The overwhelmingly common case is no match, and it
 * costs a payload parse and a few regex tests — zero filesystem work. An
 * `lstat` runs only after a build-shaped command has already matched; the
 * store is resolved and the latch touched only after a rule has fired.
 *
 * An unreadable store is not the same answer as no match. When a rule matches
 * and the memory directory cannot be resolved, the concern still emits the
 * pointer (the slug is actionable on its own) and writes a one-line diagnostic
 * to stderr naming the directories it tried. Silence there would report
 * "nothing to recall" for a store that was merely unreachable.
 *
 * ROBUSTNESS: malformed payload, any fs error, any throw -> exit 0 silently.
 * No network, no writes outside the session latch under `agents/runtime/`.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DEFAULT_PROJECTS_ROOT, projectStoreSlug } from '../_lib/cc_transcript.js';
import { EDIT_TOOLS } from '../minimal_safe_diff_hook.js';
import { COMMAND_TOOLS } from '../before_complete_hook.js';
import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json } from './state_io.js';

const EXIT_ALLOW = 0;
/**
 * Severity comes from the exit code, not from the `decision` field. See the
 * header: this never blocks, and never returns 1 on any path.
 */
const EXIT_WARN = 2;

/** Hard ceiling on `reason` + `additional_context`, matching the registered row. */
export const CAP_BYTES = 768;

/** How many ancestor directories the store walk inspects before giving up. */
const MAX_ANCESTOR_WALK = 8;

/** One tool call, reduced to the fields a rule may read. */
export interface ExtractedCall {
    tool: string;
    /** Every target path the payload names, normalized to forward slashes. */
    paths: readonly string[];
    /** The shell command, for command tools; empty string otherwise. */
    command: string;
    /** The session's own working directory, when the host payload carries one. */
    cwd: string;
}

/**
 * Context a rule's environment predicate may inspect. Filesystem reads only.
 *
 * `roots` is a LIST, and that is the whole point. The dispatcher sets
 * `workspace_root` from `--project-dir`, which the Claude hook command fills
 * with `$CLAUDE_PROJECT_DIR` — the PARENT CHECKOUT when the session runs in a
 * git worktree. A parent checkout has a real `node_modules`, so a predicate
 * reading `workspace_root` alone would go silent in exactly the topology the
 * symlink rule exists for. The payload's own `cwd` carries the worktree, so
 * both are offered and a rule fires when EITHER satisfies it.
 */
export interface RuleContext {
    roots: readonly string[];
}

export interface RecallRule {
    /** Stable id, used in diagnostics and in the test roster. */
    id: string;
    /** The memory file's slug — `<slug>.md` in the store. */
    slug: string;
    /** Tool names this row reacts to. */
    tools: ReadonlySet<string>;
    /** Pure predicate over the extracted call. No I/O. */
    test: (call: ExtractedCall) => boolean;
    /**
     * Optional environment condition, evaluated ONLY after `test` passes, so
     * the silent path never pays for it.
     */
    requires?: (ctx: RuleContext) => boolean;
    /**
     * One clause saying why this memory matters for THIS call. Authored here,
     * never derived from the memory — the memory supplies its own description.
     */
    why: string;
}

/** Commands that produce a bundle whose module paths record their resolution. */
const BUILD_COMMAND_RE =
    /\bnpm\s+run\s+build\b|\bbuild:(?:install-bundle|cli|hooks)\b|\besbuild\b/;

/** A decision record, in either of the two directories this tree has used. */
const ADR_PATH_RE = /(?:^|\/)docs\/(?:decisions|adr)\/ADR-[^/]*\.md$/i;

/** Sources whose build output is committed twice — tsc per-file and esbuild bundle. */
const INSTALL_SOURCE_RE = /(?:^|\/)src\/install\/|(?:^|\/)src\/scripts\/install\.ts$/;

/** The hook-latency bench and its pre-registered budget. */
const LATENCY_BENCH_RE = /bench_hook_latency|hook-latency-budget/;

/** True when `<root>/node_modules` exists and is a symbolic link. */
export function nodeModulesIsSymlink(root: string): boolean {
    if (root === '') return false;
    try {
        return fs.lstatSync(path.join(root, 'node_modules')).isSymbolicLink();
    } catch {
        return false;
    }
}

/** True when ANY candidate root carries a symlinked `node_modules`. */
export function anyRootHasSymlinkedNodeModules(ctx: RuleContext): boolean {
    return ctx.roots.some(nodeModulesIsSymlink);
}

/**
 * The committed trigger table. Order is priority order: the first matching row
 * wins and at most one memory is ever emitted.
 *
 * Each row is seeded from a real incident in which the memory existed and was
 * read only after the failure. Adding a row is cheap; adding a row that cannot
 * be shown to fire on a real payload is the failure mode this table exists to
 * avoid, so every row carries a replay case in the test file.
 */
export const RECALL_RULES: readonly RecallRule[] = [
    {
        id: 'build-in-symlinked-worktree',
        slug: 'worktree-build-poisons-install-bundle',
        tools: COMMAND_TOOLS,
        test: (call) => BUILD_COMMAND_RE.test(call.command),
        requires: anyRootHasSymlinkedNodeModules,
        why:
            'node_modules here is a SYMLINK, so esbuild resolves every dependency ' +
            'outside the repo root and bakes ../../../node_modules/ paths into the ' +
            'TRACKED dist/install/install.mjs',
    },
    {
        id: 'adr-edit',
        slug: 'adding-an-adr-downstream-surface',
        tools: EDIT_TOOLS,
        test: (call) => call.paths.some((p) => ADR_PATH_RE.test(p)),
        why:
            'an ADR has TWO generated consumers — the INDEX and the evidence census; ' +
            'census staleness reds the Rule-backstops CI job and no local preflight ' +
            'gate catches it',
    },
    {
        id: 'install-source-edit',
        slug: 'adding-a-src-install-module-needs-two-builds',
        tools: EDIT_TOOLS,
        test: (call) => call.paths.some((p) => INSTALL_SOURCE_RE.test(p)),
        why:
            'this source is committed twice — build:cli AND build:install-bundle are ' +
            'both required, and neither freshness gate is in task preflight',
    },
    {
        id: 'hook-latency-bench',
        slug: 'hook-latency-gate-has-runner-variance',
        tools: COMMAND_TOOLS,
        test: (call) => LATENCY_BENCH_RE.test(call.command),
        why:
            "reading main's own most recent run of the same job is step ONE, not the " +
            'fallback — measuring locally first answered nothing and cost a CI cycle',
    },
];

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}

/** Keys across host spellings that carry the tool's target file path. */
const PATH_KEYS: readonly string[] = [
    'file_path',
    'path',
    'target_file',
    'filename',
    'filePath',
    'notebook_path',
];

/** Reduce a `pre_tool_use` payload to the fields a rule may read. */
export function extractCall(payload: JsonObject): ExtractedCall {
    const tool = str(
        (payload['tool_name'] ?? payload['toolName'] ?? payload['tool']) as JsonValue | undefined,
    );
    const tiRaw = payload['tool_input'] ?? payload['toolInput'] ?? payload['input'];
    const ti: JsonObject = isObject(tiRaw) ? tiRaw : {};

    const paths: string[] = [];
    for (const key of PATH_KEYS) {
        const v = ti[key];
        if (typeof v === 'string' && v !== '') {
            paths.push(v.replace(/\\/g, '/'));
        }
    }
    // A payload carrying a `paths` array (batch edit shapes) is read too; the
    // single-file keys above already cover MultiEdit, which names one file
    // plus a list of edits.
    const many = ti['paths'];
    if (Array.isArray(many)) {
        for (const v of many) {
            if (typeof v === 'string' && v !== '') paths.push(v.replace(/\\/g, '/'));
        }
    }

    const command = str((ti['command'] ?? payload['command']) as JsonValue | undefined);
    const cwd = str((payload['cwd'] ?? payload['workspace_root']) as JsonValue | undefined);
    return { tool, paths, command, cwd };
}

/** Candidate roots for an environment predicate, most specific first, deduped. */
export function ruleRoots(call: ExtractedCall, workspaceRoot: string): RuleContext {
    const roots: string[] = [];
    for (const r of [call.cwd, workspaceRoot]) {
        if (r !== '' && !roots.includes(r)) roots.push(r);
    }
    return { roots };
}

/**
 * First matching rule, or null. Pure over the call except for a matched row's
 * own `requires` predicate, which is deliberately evaluated last.
 */
export function matchRule(
    call: ExtractedCall,
    ctx: RuleContext,
    rules: readonly RecallRule[] = RECALL_RULES,
): RecallRule | null {
    for (const rule of rules) {
        if (!rule.tools.has(call.tool)) continue;
        if (!rule.test(call)) continue;
        if (rule.requires !== undefined && !rule.requires(ctx)) continue;
        return rule;
    }
    return null;
}

export interface StoreResolution {
    /** Absolute path to the memory directory, or null when none was found. */
    dir: string | null;
    /** Every candidate inspected, in order — the stderr diagnostic's content. */
    tried: readonly string[];
}

/**
 * Resolve the host's memory directory for `startDir`.
 *
 * The store lives at `<projectsRoot>/<slugged cwd>/memory`, and in a git
 * worktree the worktree's OWN slug has a project directory with no `memory/`
 * in it — the store belongs to the parent checkout. So this walks ancestors
 * rather than assuming one slug, which also covers a subdirectory cwd.
 *
 * `AGENT_CONFIG_MEMORY_DIR` overrides everything, for tests and for a user
 * whose store is elsewhere.
 */
export function resolveMemoryDir(
    startDir: string,
    projectsRoot: string = DEFAULT_PROJECTS_ROOT,
    env: NodeJS.ProcessEnv = process.env,
): StoreResolution {
    const override = env['AGENT_CONFIG_MEMORY_DIR'];
    if (typeof override === 'string' && override !== '') {
        return { dir: isDirectory(override) ? override : null, tried: [override] };
    }
    const tried: string[] = [];
    let cur = path.resolve(startDir);
    for (let i = 0; i < MAX_ANCESTOR_WALK; i += 1) {
        const candidate = path.join(projectsRoot, projectStoreSlug(cur), 'memory');
        tried.push(candidate);
        if (isDirectory(candidate)) {
            return { dir: candidate, tried };
        }
        const parent = path.dirname(cur);
        if (parent === cur) break;
        cur = parent;
    }
    return { dir: null, tried };
}

function isDirectory(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * The memory's own `description:` frontmatter line, or null. Reads at most the
 * file's head — the body is never loaded, and never injected.
 */
export function readMemoryDescription(memoryDir: string, slug: string): string | null {
    let head: string;
    try {
        const fd = fs.openSync(path.join(memoryDir, `${slug}.md`), 'r');
        try {
            const buf = Buffer.alloc(4096);
            const n = fs.readSync(fd, buf, 0, buf.length, 0);
            head = buf.subarray(0, n).toString('utf8');
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return null;
    }
    const m = /^description:\s*(.*)$/m.exec(head);
    if (m === null) return null;
    let value = (m[1] as string).trim();
    if (
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
        value = value.slice(1, -1);
    }
    return value === '' ? null : value;
}

/** Truncate to at most `max` BYTES of UTF-8, on a character boundary. */
export function truncateBytes(text: string, max: number): string {
    if (Buffer.byteLength(text, 'utf8') <= max) return text;
    const ell = '...';
    const room = Math.max(0, max - Buffer.byteLength(ell, 'utf8'));
    let out = '';
    let used = 0;
    for (const ch of text) {
        const w = Buffer.byteLength(ch, 'utf8');
        if (used + w > room) break;
        out += ch;
        used += w;
    }
    return out + ell;
}

export interface RecallEmission {
    reason: string;
    additional_context: string;
}

/**
 * Build the emission, guaranteed under `CAP_BYTES` for `reason` +
 * `additional_context` combined. The description is the elastic part: the
 * pointer and the why-now are what make the line actionable, so they are
 * reserved first and the description absorbs the truncation.
 */
export function buildEmission(
    rule: RecallRule,
    store: StoreResolution,
    description: string | null,
    cap: number = CAP_BYTES,
): RecallEmission {
    const reason = `memory-recall: ${rule.slug}`;
    const pointer =
        store.dir === null
            ? `memory store not resolvable here — the slug is still the key: grep the store for ${rule.slug}`
            : `read: ${path.join(store.dir, `${rule.slug}.md`)}`;
    const head =
        `memory-recall — you have a memory for this, written before today: ${rule.slug}. ` +
        `Why now: ${rule.why}. ${pointer}`;
    const budget = cap - Buffer.byteLength(reason, 'utf8');
    if (description === null) {
        return { reason, additional_context: truncateBytes(head, budget) };
    }
    const room = budget - Buffer.byteLength(`${head} It says: ""`, 'utf8');
    if (room <= 16) {
        return { reason, additional_context: truncateBytes(head, budget) };
    }
    return { reason, additional_context: `${head} It says: "${truncateBytes(description, room)}"` };
}

/** Hashed session key — mirrors `reread_guard_hook.deriveSessionKey`. */
export function deriveSessionKey(envelope: JsonObject, payload: JsonObject): string {
    const raw =
        str(envelope['session_id'] as JsonValue | undefined) ||
        str((payload['session_id'] ?? payload['sessionId']) as JsonValue | undefined);
    return crypto
        .createHash('sha256')
        .update(raw || 'unknown-session')
        .digest('hex');
}

export function latchFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(
        workspaceRoot,
        'agents',
        'runtime',
        'state',
        'memory-recall',
        `${sessionKey}.json`,
    );
}

/**
 * Per-session, per-slug latch. A memory delivered once has been delivered; a
 * second copy on the next build command is the noise that gets a nudge tuned
 * out. Slug keys and a timestamp only — the record type has no field able to
 * hold a path, a command, or any free text.
 */
export function readLatch(workspaceRoot: string, sessionKey: string): Record<string, number> {
    try {
        const parsed = JSON.parse(fs.readFileSync(latchFile(workspaceRoot, sessionKey), 'utf8'));
        return isObject(parsed) ? (parsed as unknown as Record<string, number>) : {};
    } catch {
        return {};
    }
}

function writeLatch(
    workspaceRoot: string,
    sessionKey: string,
    latch: Record<string, number>,
): void {
    try {
        atomic_write_json(latchFile(workspaceRoot, sessionKey), latch as unknown as JsonObject);
    } catch {
        // a state-write failure must never affect the tool call
    }
}

export function main(): number {
    try {
        const [envelope, payload] = unwrap(readHookStdin(), 'claude');

        const event = str(envelope['event'] as JsonValue | undefined);
        if (event !== '' && event !== 'pre_tool_use') return EXIT_ALLOW;

        const call = extractCall(payload);
        if (call.tool === '') return EXIT_ALLOW;

        const workspaceRoot =
            str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();

        const ctx = ruleRoots(call, workspaceRoot);
        const rule = matchRule(call, ctx);
        if (rule === null) return EXIT_ALLOW;

        const sessionKey = deriveSessionKey(envelope, payload);
        const latch = readLatch(workspaceRoot, sessionKey);
        if (latch[rule.slug] !== undefined) return EXIT_ALLOW;

        const store = resolveMemoryDir(workspaceRoot);
        if (store.dir === null) {
            process.stderr.write(
                `memory-recall: rule ${rule.id} matched but no memory store was ` +
                    `resolvable; tried ${store.tried.join(', ')}\n`,
            );
        }
        const description = store.dir === null ? null : readMemoryDescription(store.dir, rule.slug);
        if (store.dir !== null && description === null) {
            process.stderr.write(
                `memory-recall: rule ${rule.id} matched but ${rule.slug}.md was ` +
                    `unreadable under ${store.dir}\n`,
            );
        }

        latch[rule.slug] = Date.now();
        writeLatch(workspaceRoot, sessionKey, latch);

        process.stdout.write(
            `${JSON.stringify({ decision: 'warn', ...buildEmission(rule, store, description) })}\n`,
        );
        return EXIT_WARN;
    } catch {
        return EXIT_ALLOW; // malformed payload / any error — never touch the tool call
    }
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
