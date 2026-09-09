#!/usr/bin/env node
/**
 * One-shot handoff injection — `session_start` hook concern.
 *
 * road-to-agent-handoff-resume Phase 3. `agent-config handoff` (Phase 4)
 * writes a generated handoff for a PAST session to
 * `agents/runtime/state/handoff-context.md` (gitignored runtime state).
 * This concern injects that file into the NEXT session exactly once:
 *
 *   - Present file → wrap in a spotlight-as-DATA envelope, emit
 *     `{"decision":"allow","context":"<block>"}`, then DELETE the file
 *     (consume-once). Hot-context is overwritten on every stop; the handoff
 *     must survive exactly until consumed once — separate concern,
 *     separate file.
 *   - Staleness: a `Generated:` stamp older than 48 h (or unparseable)
 *     discards without injecting.
 *   - Source-gated (road-to-continuity-retirement-sequencing 3.3): a
 *     `session_start` carries a `source`, and `resume` / `fork` / anything
 *     unrecognised inject NOTHING. The gate runs before either consumer, so a
 *     suppressed source never destroys the file it declined to read — see
 *     {@link sourceGate}.
 *   - Never blocks: exit 0 on every path; failures are silent (stderr note).
 *   - `AGENT_CONFIG_REPLAY=1` → no-op (replay fixtures never mutate state).
 *
 * Data-never-instruction (road-to-cost-parity-3 Phase 2.6/2.8): every block
 * this concern emits is wrapped by `wrapAsPriorSessionData` — an explicit
 * boundary plus a label naming it as prior-session DATA — and a block that
 * somehow lacks that marker is refused rather than injected. That is the
 * GATEABLE half. The other half, that a marked block is *treated* as data
 * rather than followed, is model-carried and `enforced_by: none`; the guard
 * below must never be read as covering it.
 *
 * Reads the dispatcher JSON envelope on stdin
 * (`{platform, event, payload, workspace_root, …}`).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { collectRepoAnchor, describeDrift } from './_lib/envelope_grounding.js';
import { readHookStdin } from './hooks/hook_stdin.js';
import {
    RECYCLE_MAX_AGE_HOURS,
    predecessorTracePresent,
    recycle_consumed_rel,
    resolveContinuityRecord,
} from './_lib/recycle_envelope_paths.js';
import { env_session_id } from './sessions_cli.js';
import {
    hasBoundaryMarker,
    scanEnvelopeDirectives,
    validateRecycleEnvelope,
    wrapAsPriorSessionData,
} from './_lib/subagent_capsule.js';

export const HANDOFF_CONTEXT_REL = path.join('agents', 'runtime', 'state', 'handoff-context.md');
export const MAX_AGE_HOURS = 48;

/** Replay-fixture runs must never mutate state (same contract as hot-context). */
const REPLAY_ENV_VAR = 'AGENT_CONFIG_REPLAY';
function _is_replay_mode(): boolean {
    return (process.env[REPLAY_ENV_VAR] ?? '').trim() === '1';
}

function _handoff_context_path(root: string): string {
    return process.env.AGENT_HANDOFF_CONTEXT_FILE || path.join(root, HANDOFF_CONTEXT_REL);
}

export interface ConsumeDecision {
    action: 'inject' | 'discard' | 'absent';
    reason: string;
    context?: string;
}

/**
 * The 2.8a gate, as one choke point both consumers pass through: a block
 * WITHOUT its prior-session boundary and label never becomes an injection.
 * Exported so a fixture can prove the refusal on an arbitrary block —
 * otherwise the only way to reach this branch would be to break the
 * wrapper, and an unreachable guard is an untested one.
 */
export function guardedInjection(block: string, reason: string): ConsumeDecision {
    if (!hasBoundaryMarker(block)) {
        return {
            action: 'discard',
            reason: 'refused: injected block carries no prior-session boundary marker',
        };
    }
    return { action: 'inject', reason, context: block };
}

/**
 * Consume the one-shot handoff file: inject when fresh, discard when stale.
 * BOTH outcomes remove the file — the handoff never survives a second
 * session_start (consume-once is the contract, staleness is the guard).
 */
export function consume_handoff_context(root: string, now: Date = new Date()): ConsumeDecision {
    const target = _handoff_context_path(root);
    let text: string;
    try {
        text = fs.readFileSync(target, 'utf-8');
    } catch {
        return { action: 'absent', reason: 'no handoff file' };
    }

    const remove = (): void => {
        try {
            fs.unlinkSync(target);
        } catch {
            // fail-open
        }
    };

    const stampRaw = text.match(/^Generated: (.+)$/m)?.[1];
    if (!stampRaw) {
        remove();
        return { action: 'discard', reason: 'unparseable stamp' };
    }
    const stamp = Date.parse(stampRaw.trim());
    if (Number.isNaN(stamp)) {
        remove();
        return { action: 'discard', reason: 'unparseable timestamp' };
    }
    const ageHours = (now.getTime() - stamp) / (1000 * 60 * 60);
    if (ageHours > MAX_AGE_HOURS) {
        remove();
        return { action: 'discard', reason: `stale: ${ageHours.toFixed(1)}h > ${MAX_AGE_HOURS}h` };
    }

    const sourceSession = text.match(/^Source-Session: (.+)$/m)?.[1]?.trim() ?? 'unknown';
    const block = wrapAsPriorSessionData(text, {
        kind: `handoff session=${sourceSession}`,
        source: HANDOFF_CONTEXT_REL,
    });
    remove(); // consume-once: the file never outlives its first injection
    return guardedInjection(block, `handoff consumed (session=${sourceSession})`);
}

/**
 * Consume the one-shot RECYCLE ENVELOPE (road-to-token-economy-recycling
 * Phase 2.3) — the main-session sibling of the handoff file above, same
 * lifecycle discipline, stricter validation:
 *
 *   - schema: `validateRecycleEnvelope` (the main_session CHECKPOINT
 *     variant) — an invalid envelope is never injected;
 *   - identity (Risk 4): the envelope's `workspace` must resolve to THIS
 *     workspace root, so a hand-copied envelope cannot plant foreign
 *     constraints into an unrelated session;
 *   - staleness: `written_at` older than {@link RECYCLE_MAX_AGE_HOURS} is
 *     discarded;
 *   - consume-on-read, MOVED not copied: every outcome except `absent`
 *     relocates the file to `recycle-envelope.consumed.json` — it can never
 *     leak into a second session, while the last envelope stays
 *     inspectable for debugging;
 *   - drift (Phase 3.2): the envelope's recorded repo identity + branch +
 *     HEAD are compared against the tree it lands in, and any mismatch LEADS
 *     the injected block. Never a silent stale resume;
 *   - the BRANCH GATE (2026-09-09): a branch mismatch is a refusal rather than
 *     an annotation, and the refusal is `absent` so the record is left for a
 *     session on the right branch instead of consumed. It is the half of the
 *     resolution rule that keeps an unrelated session in the same checkout from
 *     resuming an ended peer, now that the resolver admits any record that is
 *     not the reader's own. Unknown on either side is not a mismatch;
 *   - focus (Phase 3.4): `AGENT_RESUME_FOCUS` narrows what the successor
 *     attacks first — the consumer-side mirror of `next_task`.
 */
export function consume_recycle_envelope(
    root: string,
    now: Date = new Date(),
    session_id: string | null | undefined = undefined,
): ConsumeDecision {
    // Phase 2.1: which record belongs to THIS session is a resolution, not a
    // path constant. `resolveContinuityRecord` returns `null` with a reason
    // when it cannot tell — the reader then starts clean and says the reason
    // out loud rather than resuming from whichever file is newest.
    //
    // The id is a PARAMETER with an env fallback, not an env read. The
    // dispatcher already carries `session_id` in the envelope, and reading the
    // ambient variable instead means any process that inherits a host's
    // `CLAUDE_CODE_SESSION_ID` — a test runner in an agent session, most
    // obviously — resolves a foreign identity and reports the record absent.
    const sessionId = session_id === undefined ? env_session_id() : session_id;
    const override = process.env.AGENT_RECYCLE_ENVELOPE_FILE;
    let target: string;
    if (override !== undefined && override !== '') {
        target = override;
    } else {
        const resolved = resolveContinuityRecord(root, sessionId);
        if (resolved.file === null) {
            return { action: 'absent', reason: resolved.reason };
        }
        target = resolved.file;
    }
    let text: string;
    try {
        text = fs.readFileSync(target, 'utf-8');
    } catch {
        return { action: 'absent', reason: 'no recycle envelope' };
    }

    const consume = (): void => {
        try {
            fs.renameSync(
                target,
                path.join(path.dirname(target), path.basename(recycle_consumed_rel(sessionId))),
            );
        } catch {
            try {
                fs.unlinkSync(target); // fallback — never let it survive
            } catch {
                // fail-open
            }
        }
    };

    let envelope: Record<string, unknown>;
    try {
        envelope = JSON.parse(text) as Record<string, unknown>;
    } catch {
        consume();
        return { action: 'discard', reason: 'recycle envelope is not valid JSON' };
    }

    const violations = validateRecycleEnvelope(envelope);
    if (violations.length > 0) {
        consume();
        return {
            action: 'discard',
            reason: `recycle envelope invalid: ${violations[0] ?? 'schema violation'}`,
        };
    }

    const stamp = Date.parse(String(envelope['written_at']));
    const ageHours = (now.getTime() - stamp) / (1000 * 60 * 60);
    if (Number.isNaN(stamp) || ageHours > RECYCLE_MAX_AGE_HOURS) {
        consume();
        return { action: 'discard', reason: `recycle envelope stale: ${ageHours.toFixed(1)}h > ${RECYCLE_MAX_AGE_HOURS}h` };
    }

    // Identity check (Risk 4): the envelope names its workspace; a mismatch
    // means it was copied here by hand — foreign constraints, do not inject.
    try {
        const envelopeWs = fs.realpathSync(String(envelope['workspace']));
        const thisWs = fs.realpathSync(root);
        if (envelopeWs !== thisWs) {
            consume();
            return { action: 'discard', reason: `recycle envelope belongs to ${envelopeWs}, not ${thisWs}` };
        }
    } catch {
        consume();
        return { action: 'discard', reason: 'recycle envelope workspace does not resolve' };
    }

    // Lineage (Phase 2.3): a record that NAMES a predecessor is claiming a
    // chain. If nothing in this workspace corroborates that session, the claim
    // is unverifiable and the record is refused — never resolved to whatever
    // else is lying about.
    const predecessor = String(envelope['predecessor'] ?? '').trim();
    if (predecessor !== '' && !predecessorTracePresent(root, predecessor)) {
        consume();
        return {
            action: 'discard',
            reason: `recycle envelope names predecessor "${predecessor}", which has no trace in this workspace`,
        };
    }

    // Drift first: a stale resume against the wrong tree is the failure the
    // reader must see before anything else in the block.
    const anchor = collectRepoAnchor(root);

    // The branch gate — an ADMISSION check, not an annotation, and the half of
    // the 2026-09-09 resolution rule that lives outside the resolver.
    //
    // Why it is needed at all: the resolver now admits the unique record that is
    // not the reader's own, so peer isolation no longer comes from the filename.
    // Without this, an unrelated session in the same checkout would resume an
    // ended peer's work simply by being the next one to start. AI council
    // 2026-09-09 was explicit that (d) is acceptable WITH this gate and not
    // without it.
    //
    // `absent`, deliberately, and this is the one place the invariant matters:
    // every other outcome consumes the record (moved, not copied), and consuming
    // here would destroy state the rightful successor could still use. `absent`
    // is the only outcome that leaves the file alone, and the 48-hour staleness
    // guard bounds how long it can sit unclaimed.
    //
    // Unknown on either side is NOT a mismatch. An envelope written before the
    // field existed, or a tree whose branch cannot be read, must not be refused
    // on a comparison neither side can make — that would turn a missing field
    // into a broken resume. `describeDrift` still annotates those.
    const envelopeBranch = String((envelope as Record<string, unknown>)['branch'] ?? '').trim();
    if (envelopeBranch !== '' && anchor.branch !== null && envelopeBranch !== anchor.branch) {
        return {
            action: 'absent',
            reason:
                `recycle envelope is for branch "${envelopeBranch}" and this tree is on ` +
                `"${anchor.branch}" — left unclaimed for a session on that branch rather than consumed`,
        };
    }

    const drift = describeDrift(envelope, anchor);
    // Proposal fields carrying an imperative LEAD the block as a stop
    // notice — surfaced, never executed, never silently stripped.
    const warnings = scanEnvelopeDirectives(envelope);
    const focus = (process.env.AGENT_RESUME_FOCUS ?? '').trim();
    const block = wrapAsPriorSessionData(JSON.stringify(envelope, null, 2), {
        kind: 'recycle-envelope',
        source: path.relative(root, target) || path.basename(target),
        warnings: [
            ...drift,
            ...(focus ? [`FOCUS: attack "${focus}" first — the rest of this envelope is context.`] : []),
            'Re-derive everything under not_carried_forward from source before trusting it.',
            ...warnings,
        ],
    });
    consume(); // moved, not copied: the envelope never outlives its first injection
    return guardedInjection(
        block,
        warnings.length > 0
            ? `recycle envelope consumed (${warnings.length} directive warning(s) surfaced)`
            : 'recycle envelope consumed',
    );
}

/**
 * What a `session_start` `source` means for the continuity record
 * (road-to-continuity-retirement-sequencing 3.3).
 *
 * A `session_start` is not one event. The host says WHY the session started,
 * and reading the wrong record for the wrong reason is how a continuation
 * acquires a stranger's state — the failure this step exists to prevent.
 *
 *   - `startup` (and an ABSENT source) — a fresh session. Inject: this is the
 *     ordinary case and the one every existing fixture exercises.
 *   - `clear` — the operator wrote the record and cleared. Inject. This is the
 *     recycle path the record was built for, and suppressing it would defeat
 *     the mechanism. Note that hot-context DISCARDS on the same source, and the
 *     two are right for opposite reasons: hot-context is a cache of a session
 *     that was deliberately thrown away, while the record is the thing the
 *     operator wrote in order to survive throwing it away.
 *   - `compact` — the SAME session continuing past a compaction. Inject: the
 *     resolver keys on session id, so what comes back is this session's own
 *     record rather than a predecessor's. That identity is the reason this is
 *     an inject rather than a suppression.
 *   - `resume` / `fork` — the host has already restored the conversation.
 *     Inject NOTHING. On `resume` an injection would duplicate context the host
 *     just replayed; on `fork` it is worse than duplication, because the fork
 *     would consume a record belonging to a session that is still alive.
 *   - anything else — inject nothing. An unrecognised source is a host this
 *     code has not been taught, and guessing is the failure mode, not the
 *     conservative choice.
 *
 * SUPPRESSION MUST NOT CONSUME. The gate runs BEFORE
 * {@link consume_recycle_envelope}, never inside it, because that function
 * moves the file aside on every outcome except `absent`. Calling it and then
 * discarding the result would destroy the record without anyone reading it —
 * the operator's recycle would silently evaporate on a `resume`.
 */
export const INJECTING_SOURCES: ReadonlySet<string> = new Set(['', 'startup', 'clear', 'compact']);

export interface SourceGate {
    inject: boolean;
    reason: string;
}

export function sourceGate(source: string): SourceGate {
    const s = source.trim();
    if (INJECTING_SOURCES.has(s)) {
        return { inject: true, reason: `source=${s === '' ? 'absent' : s}` };
    }
    if (s === 'resume' || s === 'fork') {
        return {
            inject: false,
            reason: `source=${s} — the host already restored this conversation; injecting would ` +
                (s === 'fork'
                    ? "consume a record belonging to a session that is still running"
                    : 'duplicate context the host just replayed'),
        };
    }
    return {
        inject: false,
        reason: `source=${s} is not a source this reader knows — injecting nothing rather than guessing`,
    };
}

// ---------------------------------------------------------------------
// CLI — dispatcher concern entry point
// ---------------------------------------------------------------------

export function main(): number {
    let envelope: Record<string, unknown> = {};
    try {
        const raw = readHookStdin().trim();
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

    try {
        if (_is_replay_mode()) {
            return 0; // replay fixtures: read-only, no state mutation
        }
        if (event === 'session_start') {
            const payload =
                envelope.payload && typeof envelope.payload === 'object' && !Array.isArray(envelope.payload)
                    ? (envelope.payload as Record<string, unknown>)
                    : {};
            // 3.3. The gate is evaluated FIRST and short-circuits, because both
            // consumers below move their file aside on every non-absent
            // outcome. Consuming and then dropping the result would delete the
            // record a suppressed source was supposed to leave alone.
            const gate = sourceGate(String(payload['source'] ?? envelope['source'] ?? ''));
            if (!gate.inject) {
                process.stderr.write(`handoff-context-hook: no injection (${gate.reason})\n`);
                return 0;
            }
            const handoff = consume_handoff_context(root);
            const recycle = consume_recycle_envelope(
                root,
                new Date(),
                String(envelope['session_id'] ?? '').trim() || env_session_id(),
            );
            const blocks: string[] = [];
            const reasons: string[] = [];
            // Recycle envelope first — it is the task-state restore the
            // successor bootstraps from; the generic handoff is companion
            // narrative when both are pending.
            if (recycle.action === 'inject' && recycle.context) {
                blocks.push(recycle.context);
                reasons.push(recycle.reason);
            }
            if (handoff.action === 'inject' && handoff.context) {
                blocks.push(handoff.context);
                reasons.push(handoff.reason);
            }
            if (blocks.length > 0) {
                process.stdout.write(
                    JSON.stringify({
                        decision: 'allow',
                        reason: reasons.join(' · '),
                        context: blocks.join('\n\n'),
                    }) + '\n',
                );
            }
        }
    } catch (exc) {
        process.stderr.write(`handoff-context-hook: ${String(exc)}\n`);
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
