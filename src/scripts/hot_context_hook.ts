#!/usr/bin/env node
/**
 * Memory session-index restore — `session_start` hook.
 *
 * The working-memory CACHE this concern used to carry was retired
 * (road-to-continuity-writer-activation step 3.1, AI council 2026-09-09 under
 * the owner's written delegation; openai's mechanism operative). What survives
 * is the half the council kept: the `session_start` restore of the persisted
 * memory session index.
 *
 * The concern id `hot-context` is DELIBERATELY unchanged. Retiring the id was
 * the competing proposal and was rejected: the −1 on `concern_count` buys
 * nothing, while untagged running code costs the manifest its completeness
 * property. Its DESCRIPTION is what changed.
 *
 * Contract:
 *   - `session_start` only. The `stop` / `session_end` / `pre_compact` write
 *     bindings are gone, and the cache file they maintained is neither written
 *     nor read any more.
 *   - Emits `{"decision":"allow","context":"<block>"}` on stdout; the
 *     dispatcher forwards `context` so the host adds it to the session context.
 *     The block is spotlighted as DATA, not instructions
 *     (untrusted-input-defense).
 *   - Never blocks: exit 0 on every path; failures are silent (stderr note).
 *
 * No `loss_class` is declared on THIS file any more, and that is a real
 * coverage change rather than an omission. The two lossy transforms the class
 * described — the 400-word cap and the fail-closed `_redact_lines` drop — left
 * with the cache. The 30-row cap the memory index still applies lives in
 * `_lib/session_index_trust.ts`, which is not a concern script.
 *
 * A `loss_module:` pointer used to sit here, naming that module so the gate
 * could see it. It is gone because the gate now REACHES the module instead of
 * being told about it: `check_loss_class_declared` walks relative specifiers
 * from every context-emitting concern, and this file's `createRequire` load of
 * `_lib/session_index_trust.js` is one. The pointer's premise — that only a
 * static-import closure was on offer and it could not see a `createRequire`
 * load — is what changed; a specifier walk sees both.
 *
 * What that costs, stated because a pointer did catch one thing a walk cannot:
 * a module loaded through a COMPUTED specifier is now invisible again. Nothing
 * here does that, and if something ever does, the answer is to name the module
 * rather than to reason about the walk.
 *
 * Reads the dispatcher JSON envelope on stdin
 * (`{platform, event, payload, workspace_root, …}`).
 */

import { createRequire } from 'node:module';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { readHookStdin } from './hooks/hook_stdin.js';

/** Replay-fixture runs must never mutate state (same contract as chat_history). */
const REPLAY_ENV_VAR = 'AGENT_CONFIG_REPLAY';
function _is_replay_mode(): boolean {
    return (process.env[REPLAY_ENV_VAR] ?? '').trim() === '1';
}

// ---------------------------------------------------------------------
// opt-in memory session index (road-to-memory-retrieval-economy P5)
// ---------------------------------------------------------------------

/**
 * Build the compact memory index when `memory.session_index: on`; `null`
 * on the default-off path, empty corpus, a refused root, an already-served
 * session, or any failure (never blocks).
 *
 * Memory roots are cwd-relative (same contract as the MCP tool handlers), so
 * the build runs chdir-wrapped to the workspace root — and that relativity is
 * exactly why the trust contract exists: whatever cwd this lands on is where
 * `agents/memory` is read from. `_lib/session_index_trust.ts` carries the six
 * properties the 2026-09-07 D3 ruling required (identity, canonicalization,
 * freshness, ordering, duplicate invocation, size limits); this function is
 * where two of them bind, because they need runtime facts the module cannot
 * see — the workspace root and the session id.
 *
 * Refusals are logged with their code rather than swallowed. `null` alone
 * cannot distinguish "no curated memory here" from "this root pointed at
 * another tree", and that distinction is the whole point of the contract.
 */
function _session_index_block_or_null(root: string, sessionId: string): string | null {
    try {
        // Lazy require (ESM-safe via createRequire) keeps the default-off
        // fast path free of the memory_lookup + settings-cascade import cost.
        const req = createRequire(import.meta.url);
        const mod = req('./session_memory_index.js') as {
            session_index_enabled: (root: string) => boolean;
            serve_session_index_block: (grant: unknown, cap?: number) => string | null;
            session_index_trust: (workspaceRoot: string) => { ok: boolean; code?: string; detail?: string };
        };
        if (!mod.session_index_enabled(root)) return null;

        // P1-P3, computed ONCE here and handed to the server as a grant. The
        // builder used to re-check it, which R2 finding 7 named as a duplicate
        // for a diagnostic nothing forwards; `serve_session_index_block` now
        // takes the grant, so the check cannot be skipped and is not repeated.
        const verdict = mod.session_index_trust(root);
        if (!verdict.ok) {
            process.stderr.write(`hot-context-hook: session index refused [${String(verdict.code)}]: ${String(verdict.detail)}\n`);
            return null;
        }

        const prev = process.cwd();
        let block: string | null;
        try {
            process.chdir(root);
            block = mod.serve_session_index_block(verdict);
        } finally {
            process.chdir(prev);
        }

        // P5 — duplicate invocation, claimed LAST. `session_start` can fire
        // more than once for one session (resume, host reconnect, compaction
        // boundary on some hosts), and two injections double a fixed cost while
        // presenting two corpora as one session's memory.
        //
        // The ordering is the whole property and it took two corrections to get
        // right. Claiming before the verdict let a refused root burn the
        // session's one claim; claiming before the RENDER let an empty corpus
        // burn it too (R2 finding 5) — so a session that started before its
        // memory was curated would never receive an index afterwards. Nothing
        // is claimed until there is something to serve.
        if (block === null) return null;
        const trust = req('./_lib/session_index_trust.js') as {
            claimSessionOnce: (workspaceRoot: string, sessionId: string) => { ok: boolean; code?: string };
        };
        const claim = trust.claimSessionOnce(root, sessionId);
        if (!claim.ok) {
            process.stderr.write(`hot-context-hook: session index already served [${String(claim.code)}]\n`);
            return null;
        }
        return block;
    } catch (exc) {
        process.stderr.write(`hot-context-hook: session index skipped: ${String(exc)}\n`);
        return null;
    }
}

// ---------------------------------------------------------------------
// CLI — dispatcher concern entry point
// ---------------------------------------------------------------------

function _read_stdin(): string {
    return readHookStdin();
}

export function main(): number {
    let envelope: Record<string, unknown> = {};
    try {
        const raw = _read_stdin().trim();
        if (raw) {
            const parsed = JSON.parse(raw) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                envelope = parsed as Record<string, unknown>;
            }
        }
    } catch {
        // fail-open — empty envelope
    }

    const event = String(envelope.event ?? '');
    const root = String(envelope.workspace_root ?? process.cwd());
    const payload =
        envelope.payload && typeof envelope.payload === 'object' && !Array.isArray(envelope.payload)
            ? (envelope.payload as Record<string, unknown>)
            : {};

    try {
        if (_is_replay_mode()) {
            return 0; // replay fixtures: read-only, no state mutation
        }
        if (event === 'session_start') {
            // Opt-in compact memory index (road-to-memory-retrieval-economy
            // P5) — default OFF. Memory roots are cwd-relative, so resolve
            // from the workspace root.
            // R2 finding 1: reading the payload alone left P5 INERT whenever
            // the host supplied no payload id. `dispatch_hook.ts` resolves
            // `envelope.session_id` from the payload OR `AGENT_SESSION_ID`, and
            // every sibling concern reads the envelope first — proven by two
            // dispatcher runs that emitted the block twice and never latched.
            const sessionId = String(
                envelope.session_id ?? payload.session_id ?? payload.sessionId ?? '',
            );
            const indexBlock = _session_index_block_or_null(root, sessionId);
            if (indexBlock !== null) {
                process.stdout.write(
                    JSON.stringify({
                        decision: 'allow',
                        reason: 'memory session index',
                        context: indexBlock,
                    }) + '\n',
                );
            }
        }
    } catch (exc) {
        process.stderr.write(`hot-context-hook: ${String(exc)}\n`);
    }
    return 0; // never blocks
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main());
}
