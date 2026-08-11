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
 *
 * Exit codes: 0 written (or template printed) · 1 invalid / refused · 2 usage.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolve_project_root } from '../_lib/agent_settings.js';
import {
    RECYCLE_ENVELOPE_MAX_BYTES,
    RECYCLE_ENVELOPE_REL,
} from '../_lib/recycle_envelope_paths.js';
import {
    CAPSULE_SCHEMA_VERSION,
    validateRecycleEnvelope,
} from '../_lib/subagent_capsule.js';
import { collectGrounding } from '../_lib/envelope_grounding.js';
import { atomic_write_json } from '../hooks/state_io.js';

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
        decisions: ['<decision — one-line rationale>'],
        constraints: ['<binding constraint>'],
        open_worker_envelopes: [],
        artifact_paths: ['<path to a deliverable / note / evidence file>'],
        assumptions: [],
        next_task: '<the ONE task this envelope is written for — select content for it>',
        suggested_skills: ['<skill the successor should invoke>'],
        failed_approaches: ['<tried X, failed because Y — or the single entry "none">'],
    };
}

interface ParsedArgv {
    ok: boolean;
    message?: string;
    file?: string;
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
    opts: { cwd: string; now?: Date; verify?: boolean },
): RecycleResult {
    const out: string[] = [];
    const err: string[] = [];
    const [projectRoot] = resolve_project_root(null, { cwd: opts.cwd });

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
    const grounding = collectGrounding(projectRoot);
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

    // `--verify` stops HERE: every rejection above has already run, and the
    // only thing skipped is the write. Validating through a different path
    // than the one that writes would make the check a second implementation
    // to keep in sync — the failure this suite refuses elsewhere.
    if (opts.verify === true) {
        out.push(`recycle envelope VALID — ${bytes} bytes, not written (--verify).`);
        return { code: 0, out, err };
    }

    const target = path.join(projectRoot, RECYCLE_ENVELOPE_REL);
    try {
        atomic_write_json(target, envelope);
    } catch (exc) {
        return { code: 1, out, err: [`could not write ${target}: ${String(exc)}`] };
    }

    out.push(`recycle envelope written — ${RECYCLE_ENVELOPE_REL} (${bytes} bytes)`);
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
            'usage: agent-config session:recycle [--file <envelope.json>] [--template] [--verify]',
            '  --file <path>   read the envelope JSON from a file (default: stdin)',
            '  --template      print a skeleton envelope and exit',
            '  --verify        validate only — same rejections, no write',
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
    });
    for (const line of result.out) process.stdout.write(`${line}\n`);
    for (const line of result.err) process.stderr.write(`${line}\n`);
    return result.code;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
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
