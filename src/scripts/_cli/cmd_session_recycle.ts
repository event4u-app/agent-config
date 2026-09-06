/**
 * `agent-config session:recycle` — write the main-session recycle envelope
 * (road-to-token-economy-recycling Phase 2.2).
 *
 * The producer half of the deliberate session recycle: the model composes
 * the envelope content it already knows (state, never a transcript
 * summary), this command VALIDATES it against the main_session CHECKPOINT
 * variant (`_lib/subagent_capsule.validateRecycleEnvelope`) and writes it
 * atomically to `agents/runtime/state/recycle-envelope.json`, then prints
 * the exact resume instruction. Deterministic — no model step in the write
 * path; the only values this command fills are provenance it can resolve
 * itself (`written_at` = now, `workspace` = project root,
 * `capsule_version`/`variant` = the constants).
 *
 * Hooks cannot inject `/clear` (host limitation, roadmap Context) — the
 * clear is the USER's action; the successor session's `handoff_context_hook`
 * consumes the envelope at session_start (moved, not copied).
 *
 * Usage:
 *   agent-config session:recycle --file <envelope.json>   # read from file
 *   agent-config session:recycle < envelope.json          # read from stdin
 *   agent-config session:recycle --template               # print a skeleton
 *   agent-config session:recycle --project <path>         # name the repo explicitly
 *
 * Exit codes: 0 written (or template printed) · 1 invalid / refused · 2 usage.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ORIGIN_CWD_FALLBACK, resolve_project_root } from '../_lib/agent_settings.js';
import {
    RECYCLE_ENVELOPE_MAX_BYTES,
    recycle_consumed_rel,
    recycle_envelope_rel,
} from '../_lib/recycle_envelope_paths.js';
import {
    CAPSULE_SCHEMA_VERSION,
    validateRecycleEnvelope,
} from '../_lib/subagent_capsule.js';
import { collectGrounding } from '../_lib/envelope_grounding.js';
import { atomic_write_json } from '../hooks/state_io.js';
import { env_session_id } from '../sessions_cli.js';

export interface RecycleResult {
    code: 0 | 1 | 2;
    out: string[];
    err: string[];
}

/** Skeleton the model fills — every list ships empty, nothing is invented. */
export function templateEnvelope(): Record<string, unknown> {
    return {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'main_session',
        summary: '<one- or two-sentence outcome so far>',
        task: '<the active task, one line>',
        acceptance_criteria: ['<what done means, one line each>'],
        remaining: ['<open work, one line each>'],
        not_carried_forward: ['<what the successor must re-derive from source>'],
        decisions: ['<decision — one-line rationale> [reversible]'],
        constraints: ['<binding constraint>'],
        // Ships EMPTY, unlike the prose lists above: the entries are path refs,
        // and a `<placeholder>` left in by a hurried writer would be a fake path
        // rather than obvious filler. An empty list is also the honest default —
        // nothing off limits is the common case.
        do_not_touch: [],
        open_worker_envelopes: [],
        artifact_paths: ['<path to a deliverable / note / evidence file>'],
        assumptions: [],
        next_task: '<the ONE task this envelope is written for — select content for it>',
        suggested_skills: ['<skill the successor should invoke>'],
        failed_approaches: ['<tried X, failed because Y — or the single entry "none">'],
        successful_approaches: ['<did X, it worked because Y — or the single entry "none">'],
        open_questions: ['<question the successor must not silently drop>'],
        // Producer-owned, like `written_at` and `workspace`: `runSessionRecycle`
        // deletes and re-derives it, so a value written here is discarded. It
        // ships in the skeleton anyway so the template is a VALID record on its
        // own — a template that cannot pass its own validator teaches the wrong
        // shape to everyone who copies it.
        predecessor: 'none',
    };
}

/**
 * Which session this one continues — read, never composed.
 *
 * The chain is derivable without any new artifact: when this session started,
 * its reader consumed the predecessor's record and MOVED it to this session's
 * consumed path (`recycle_consumed_rel`). So the file sitting there is, by
 * construction, the record this session resumed from, and its `session_id` is
 * the predecessor.
 *
 * Returns the explicit string `none` when there is nothing there. `none` is a
 * CLAIM — "this session starts a chain" — and is deliberately not an empty
 * value: a reader must be able to tell "no predecessor" from "nobody wrote the
 * field", because only the second one is a reason to go looking.
 */
export function resolvePredecessor(projectRoot: string, sessionId: string | null): string {
    try {
        const consumed = path.join(projectRoot, recycle_consumed_rel(sessionId));
        const raw = JSON.parse(fs.readFileSync(consumed, 'utf-8')) as { session_id?: unknown };
        const prior = String(raw.session_id ?? '').trim();
        return prior === '' ? 'none' : prior;
    } catch {
        return 'none';
    }
}

interface ParsedArgv {
    ok: boolean;
    message?: string;
    file?: string;
    project?: string;
    template?: boolean;
    verify?: boolean;
}

export function parseArgv(argv: readonly string[]): ParsedArgv {
    const parsed: ParsedArgv = { ok: true };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--template') {
            parsed.template = true;
        } else if (a === '--verify') {
            parsed.verify = true;
        } else if (a === '--file') {
            const value = argv[i + 1];
            if (!value) return { ok: false, message: '--file requires a path' };
            parsed.file = value;
            i += 1;
        } else if (a === '--project') {
            const value = argv[i + 1];
            if (!value) return { ok: false, message: '--project requires a path' };
            parsed.project = value;
            i += 1;
        } else if (a === '-h' || a === '--help') {
            return { ok: false, message: 'usage' };
        } else {
            return { ok: false, message: `unknown argument: ${a}` };
        }
    }
    return parsed;
}

/**
 * Validate + write. `input` is the raw JSON text the model composed;
 * provenance fields this command can resolve itself are filled when absent,
 * then the STRICT validator decides.
 */
export function runSessionRecycle(
    input: string,
    opts: { cwd: string; now?: Date; verify?: boolean; project?: string },
): RecycleResult {
    const out: string[] = [];
    const err: string[] = [];

    // `--project` is validated by the resolver (existence + directory), which
    // signals by THROWING. Uncaught, that would surface as a stack trace from
    // a command whose entire subject is legible failure.
    let projectRoot: string;
    let origin: string;
    try {
        [projectRoot, origin] = resolve_project_root(opts.project ?? null, { cwd: opts.cwd });
    } catch (exc) {
        return { code: 1, out, err: [`recycle envelope refused — ${String(exc)}`] };
    }

    // An unanchored cwd is the ONE case where a successful write is worse than
    // a refusal. `resolve_project_root` falls back to the cwd itself when it
    // reaches the filesystem root without finding an anchor, so a call from
    // outside any repo — the shape a consumer with a toolchain pin is forced
    // into — writes a valid envelope into a directory the successor session
    // never looks at, and then prints a resume instruction whose next step is
    // `/clear`. The exit code says it worked; the session is gone anyway.
    //
    // Refused BEFORE the parse: everything downstream reads this root, so a
    // wrong one also produces a wrong `workspace` field and grounding read
    // from the wrong git tree. `--verify` is refused too — validating against
    // a root the write would not use answers a question nobody asked.
    if (origin === ORIGIN_CWD_FALLBACK) {
        return {
            code: 1,
            out,
            err: [
                `recycle envelope refused — no project anchor at or above ${projectRoot}`,
                'Writing here would put the envelope where the successor session never reads it,',
                'and the resume instruction would then advise /clear on a session that cannot resume.',
                'Name the repository explicitly — it must be the WORKSPACE ROOT OF THE SESSION',
                'that will resume, because that is the directory the successor reads the envelope',
                'from; a path that merely happens to be a project is not enough:',
                `  agent-config session:recycle --project <session-workspace-root> …`,
                `  AGENT_CONFIG_PROJECT_ROOT=<session-workspace-root> agent-config session:recycle …`,
            ],
        };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(input);
    } catch (exc) {
        return { code: 1, out, err: [`envelope is not valid JSON: ${String(exc)}`] };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { code: 1, out, err: ['envelope must be a JSON object'] };
    }
    const envelope = parsed as Record<string, unknown>;

    // Deterministic provenance — filled only when the composer left them out.
    if (envelope['capsule_version'] === undefined) envelope['capsule_version'] = CAPSULE_SCHEMA_VERSION;
    if (envelope['variant'] === undefined) envelope['variant'] = 'main_session';
    if (envelope['written_at'] === undefined) {
        envelope['written_at'] = (opts.now ?? new Date()).toISOString();
    }
    if (envelope['workspace'] === undefined) envelope['workspace'] = projectRoot;

    // Scripted grounding (Phase 3.3): the factual fields are READ, never
    // composed. A model-written branch is a claim; this is a reading. The
    // composer cannot override them — a "next_task" it got wrong is a
    // proposal, a "head" it got wrong is a silent stale resume.
    // The session id is the ONLY channel to this session's verify state, which
    // the producer keys per session. `env_session_id` is the canonical resolver
    // (package variable first, then the host's `CLAUDE_CODE_SESSION_ID`) and is
    // imported rather than re-implemented — a second copy of that precedence
    // order would drift from the one a test covers. A host that exports neither
    // yields `null`, and `last_verify` is then simply absent from the envelope
    // (the delete-then-set below already treats an unreadable fact as absent).
    const sessionId = env_session_id();
    const grounding = collectGrounding(projectRoot, sessionId);

    // Identity and lineage are READ, exactly like the git anchors below, and for
    // the same reason: a model-composed predecessor is a guess about which
    // session came before, and a wrong one hands the successor a stranger's
    // chain. Both keys are dropped before being set so a composer cannot
    // supply either.
    delete envelope['session_id'];
    delete envelope['predecessor'];
    if (sessionId !== null && sessionId !== '') envelope['session_id'] = sessionId;
    envelope['predecessor'] = resolvePredecessor(projectRoot, sessionId);
    // Drop the composer's factual keys UNCONDITIONALLY first. Guarding each
    // assignment on `!== null` would leave a model-composed branch or head
    // standing whenever the git read fails — the consumer would then compare
    // a fabricated anchor against the real tree and produce either false
    // drift or, worse, false silence. An unreadable fact is absent, never
    // inherited from the composer.
    for (const key of ['repo_identity', 'branch', 'head', 'status_summary', 'last_verify', 'uncommitted_paths']) {
        delete envelope[key];
    }
    if (grounding.repo_identity !== null) envelope['repo_identity'] = grounding.repo_identity;
    if (grounding.branch !== null) envelope['branch'] = grounding.branch;
    if (grounding.head !== null) envelope['head'] = grounding.head;
    if (grounding.status_summary !== null) envelope['status_summary'] = grounding.status_summary;
    if (grounding.last_verify !== null) envelope['last_verify'] = grounding.last_verify;
    envelope['uncommitted_paths'] = grounding.uncommitted_paths;

    const violations = validateRecycleEnvelope(envelope);
    if (violations.length > 0) {
        return {
            code: 1,
            out,
            err: ['recycle envelope refused — schema violations:', ...violations.map((v) => `  - ${v}`)],
        };
    }

    const serialized = JSON.stringify(envelope, null, 2);
    const bytes = Buffer.byteLength(serialized, 'utf-8');
    if (bytes > RECYCLE_ENVELOPE_MAX_BYTES) {
        return {
            code: 1,
            out,
            err: [
                `recycle envelope refused — ${bytes} bytes > ${RECYCLE_ENVELOPE_MAX_BYTES} byte cap.`,
                'An envelope is selection and pointers, not a dump: move detail into artifact',
                'files and reference them via artifact_paths.',
            ],
        };
    }

    // Absolute, not `RECYCLE_ENVELOPE_REL`: the relative form is identical for
    // every root, so it cannot tell the reader WHICH tree was written — the
    // one thing in doubt at the moment this line is read.
    // Phase 2.1 — keyed by session, so two sessions in one checkout no longer
    // overwrite each other. No id resolvable falls back to the shared name,
    // which is exactly the pre-key behaviour rather than a lost record.
    const target = path.join(projectRoot, recycle_envelope_rel(env_session_id()));

    // `--verify` stops HERE: every rejection above has already run, and the
    // only thing skipped is the write. Validating through a different path
    // than the one that writes would make the check a second implementation
    // to keep in sync — the failure this suite refuses elsewhere.
    if (opts.verify === true) {
        out.push(`recycle envelope VALID — ${bytes} bytes, not written (--verify).`);
        out.push(`Target would be: ${target}`);
        return { code: 0, out, err };
    }

    try {
        atomic_write_json(target, envelope);
    } catch (exc) {
        return { code: 1, out, err: [`could not write ${target}: ${String(exc)}`] };
    }

    out.push(`recycle envelope written — ${target} (${bytes} bytes)`);
    out.push('');
    out.push('Resume instruction:');
    out.push('  1. End this session now: run /clear (or start a fresh session in this workspace).');
    out.push('  2. The successor session receives the envelope automatically at session_start');
    out.push('     (injected once as DATA, then consumed — moved, not copied).');
    out.push('  3. The successor re-derives everything on the not_carried_forward list from');
    out.push('     source before trusting it.');
    return { code: 0, out, err };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const parsed = parseArgv(argv);
    if (!parsed.ok) {
        const usage = [
            'usage: agent-config session:recycle [--file <envelope.json>] [--project <path>] [--template] [--verify]',
            '  --file <path>     read the envelope JSON from a file (default: stdin)',
            '  --project <path>  the workspace root of the session that will resume — required',
            '                    when the working directory is outside any project (the command',
            '                    refuses rather than writing an envelope the successor cannot',
            '                    find). The successor reads the envelope from ITS OWN workspace',
            '                    root, so a path that is merely a valid project is not enough.',
            '  --template        print a skeleton envelope and exit',
            '  --verify          validate only — same rejections, no write',
        ].join('\n');
        if (parsed.message === 'usage') {
            process.stdout.write(`${usage}\n`);
            return 0;
        }
        process.stderr.write(`${parsed.message}\n${usage}\n`);
        return 2;
    }

    if (parsed.template) {
        process.stdout.write(`${JSON.stringify(templateEnvelope(), null, 2)}\n`);
        return 0;
    }

    let input: string;
    try {
        if (parsed.file) {
            input = fs.readFileSync(parsed.file, 'utf-8');
        } else if (process.stdin.isTTY) {
            process.stderr.write('no envelope on stdin and no --file given (see --help)\n');
            return 2;
        } else {
            input = fs.readFileSync(0, 'utf-8');
        }
    } catch (exc) {
        process.stderr.write(`could not read envelope input: ${String(exc)}\n`);
        return 2;
    }

    const result = runSessionRecycle(input, {
        cwd: process.cwd(),
        ...(parsed.verify === true ? { verify: true } : {}),
        ...(parsed.project !== undefined ? { project: parsed.project } : {}),
    });
    for (const line of result.out) process.stdout.write(`${line}\n`);
    for (const line of result.err) process.stderr.write(`${line}\n`);
    return result.code;
}

/**
 * Bundle-safety: never auto-run when inlined into SOMEONE ELSE'S bundle.
 *
 * `__AGENT_CONFIG_BUNDLE__` alone cannot express that. All four esbuild targets
 * define it, `build:cli-delegate` included — and that bundle's entry points ARE
 * these files, so a guard refusing on the flag refuses to run the very bundle
 * built to run it. That shipped: `dist/cli-delegate/cmd_session_recycle.js`
 * produced zero bytes and exit 0 on every installed copy, so
 * `agent-config session:recycle` reported success while writing no envelope.
 * `cmd_doctor` and `cmd_migrate` carried the same guard and were dead the same
 * way.
 *
 * `__AGENT_CONFIG_CLI_DELEGATE__` is defined by that one build only, so the pair
 * says what a single flag could not: inlined elsewhere (install / hook / MCP
 * bundle) → never run; this bundle's own target → run, and let the `argv[1]`
 * comparison below decide whether THIS module is the entry or a shared chunk
 * pulled in beside it.
 */
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
declare const __AGENT_CONFIG_CLI_DELEGATE__: boolean | undefined;
function _isCliEntry(): boolean {
    const bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
    const cliDelegate =
        typeof __AGENT_CONFIG_CLI_DELEGATE__ !== 'undefined' && __AGENT_CONFIG_CLI_DELEGATE__;
    if (bundled && !cliDelegate) return false;
    if (process.argv[1] === undefined) return false;
    if (cliDelegate) {
        // `--splitting` turns the entry file into a re-export shim and moves this
        // module's body into a shared chunk, where `import.meta.url` is the
        // CHUNK's url and can never equal `argv[1]`. The comparison below then
        // silently never fires — which is why two sibling commands shipped dead
        // while others worked by accident, purely by where esbuild happened to
        // place their code. Inside this bundle the invoked file name is the only
        // reliable signal; the smoke test over every delegate bundle is what
        // keeps this literal honest if the file is ever renamed.
        if (path.basename(process.argv[1], '.js') === 'cmd_session_recycle') {
            return true;
        }
        // A miss falls THROUGH to the realpath comparison below rather than
        // returning false: a symlinked or renamed invocation is exactly the
        // case that fallback exists for, and swallowing it here would rebuild
        // the silent no-op this change removes.
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
