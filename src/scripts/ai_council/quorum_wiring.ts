/**
 * The quorum seam between `quorum.ts` and the council CLI.
 *
 * `quorum.ts` is pure arithmetic: given n, present and a setting, it answers
 * whether a pass concluded. Everything here is the plumbing around that answer
 * — reading the setting out of a possibly hand-built config dict, re-deriving
 * presence from a round of responses, emitting the attendance event, and
 * rendering the operator-facing banner.
 *
 * **Extracted for the same reason its sibling `qualification_wiring.ts` was,
 * and the reason is worth stating rather than implying.** Adding provider
 * qualification to `council_cli.ts` pushed that file from 4,058 to 4,311
 * lines, and `check_source_size_budget` scores `Σ max(0, lines(f) − 1500)` —
 * so every added line in a file already 2,500 over the ceiling counts against
 * the ratchet, while the new modules beside it count zero. Moving the
 * qualification seam out recovered 164 of those lines; the residual 89 was
 * call-site wiring that cannot leave `council_cli.ts`. This module is the
 * operator's answer to that residual: pull the quorum plumbing — the same
 * layer, and the code the qualification change already reaches into — into a
 * file whose subject it actually is.
 *
 * That makes the extraction a real boundary rather than budget accounting. The
 * discriminator: every function here is about a k-of-n verdict and its
 * reporting, and none of them is about parsing argv, constructing clients, or
 * writing an output payload — which is what `council_cli.ts` is for.
 *
 * `Dict` is redeclared locally rather than imported: it is `Record<string,
 * unknown>` in the CLI too, and importing a type alias that shallow would
 * couple this module to the file it was just separated from.
 */

import type { CouncilResponse, ExternalAIClient } from './clients.js';
import type { QuorumSetting } from './config.js';
import {
    appendQuorumEvent,
    type QuorumAbsence,
    type QuorumCommand,
    type QuorumDispatch,
    type QuorumEventPhase,
} from './events_log.js';
import { evaluateQuorum, formatAttendanceCaveats, SOLO_FLOOR_MIN_PRESENT, type QuorumResult } from './quorum.js';
import { absentReasonFromCliFailure, classifyCliFailure } from './transport_resolver.js';

type Dict = Record<string, unknown>;

/**
 * `ai['quorum']` as forwarded by `_synthesize_ai_council_block` (already
 * validated by `config.ts::_build_quorum` on that path) — or, for a caller
 * that hands `build_members` a hand-built dict bypassing the loader
 * entirely, a defensive re-check that fails soft to `'majority'` rather
 * than throwing. `build_members` is not the config-validation layer;
 * `evaluateQuorum` degrades an unrecognisable setting toward
 * `inconclusive`, never toward a false `concluded`, so failing soft here
 * costs nothing on the safety side.
 */
export function _quorum_setting_from(ai: Dict): QuorumSetting {
    const raw = ai['quorum'];
    if (raw === 'majority') {
        return 'majority';
    }
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) {
        return raw;
    }
    return 'majority';
}

/**
 * `ai['quorum_min_present']` with the same fail-soft posture as
 * `_quorum_setting_from`: the loader has already validated it on the normal
 * path, and a hand-built dict that bypasses the loader falls back to the
 * ADR-224 default rather than throwing.
 *
 * Failing soft costs nothing on the safety side here, and less than it does
 * for `quorum`: this value feeds a counterfactual boolean that no gate reads,
 * so the worst outcome of a wrong fallback is one mis-recorded telemetry line,
 * never a pass that concluded when it should not have.
 */
export function _quorum_min_present_from(ai: Dict): number {
    const raw = ai['quorum_min_present'];
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1) {
        return raw;
    }
    return SOLO_FLOOR_MIN_PRESENT;
}

/**
 * Emit one `quorum_result` line for a resolved quorum.
 *
 * Both `evaluateQuorum` call sites route through here, tagged by `phase`, so
 * a solo-concluded pass is distinguishable from a full-attendance one in the
 * event log — the gap `road-to-always-on-orchestration`'s Risk 6 asserted was
 * already closed and was not.
 *
 * The emit sits at the call sites rather than inside `_postRunQuorum` on
 * purpose: that function is exported and unit-tested as a pure derivation,
 * and a write buried in it would make every test of it a log writer.
 *
 * `absent` entries arrive as the CLI's own `{member, reason, detail}` dicts;
 * `detail` is dropped by `appendQuorumEvent`'s input type, which cannot carry
 * free-form text at all.
 */
export function _emitQuorumEvent(
    phase: QuorumEventPhase,
    quorum: QuorumResult,
    absent: readonly Dict[],
    ctx: {
        command: QuorumCommand;
        dispatch?: QuorumDispatch;
        /** Enabled members before `--single` filtering; defaults to the roster that ran. */
        configuredTotal?: number;
        lens?: string;
        invocation?: string;
        /**
         * The ADR-224 shadow floor for this pass. `gateClass` is deliberately
         * NOT in this context object: no CLI path declares itself gate-class,
         * so a parameter here would be one no caller ever sets, and its
         * absence is what the `false` on every line honestly records.
         */
        minPresent?: number;
    },
): void {
    appendQuorumEvent({
        lens: ctx.lens ?? '',
        invocation: ctx.invocation ?? '',
        phase,
        command: ctx.command,
        dispatch: ctx.dispatch ?? 'full',
        configuredTotal: ctx.configuredTotal ?? quorum.total,
        result: quorum,
        ...(ctx.minPresent !== undefined ? { minPresent: ctx.minPresent } : {}),
        absent: absent.map(
            (a): QuorumAbsence => ({
                member: String(a['member'] ?? ''),
                reason: (a['reason'] as QuorumAbsence['reason']) ?? 'unavailable',
            }),
        ),
    });
}

/**
 * Re-derive quorum AFTER the provider calls, over what was actually USABLE —
 * never what merely CONSTRUCTED (M3, independent-review finding). `members`
 * and `responses` must be index-aligned (`consult()`'s own contract: one
 * `CouncilResponse` per member, from the final round); `members.length` is
 * the `n` — deliberately the roster that actually ran (post `--single` /
 * `--siblings` filtering), never the full config roster a filtered run
 * never attempted. A response carrying `.error` (or a missing response
 * entry altogether) counts as absent, classified through the same
 * `AbsentReason` vocabulary a static (pre-call) resolution failure uses, so
 * one artefact buckets every absence — construction-time and mid-flight —
 * under one taxonomy.
 */
export function _postRunQuorum(
    members: ExternalAIClient[],
    responses: CouncilResponse[],
    ai_cfg: Dict,
    parse_outcomes?: ReadonlyMap<string, string>,
): { quorum: QuorumResult; absent: Dict[] } {
    const absent: Dict[] = [];
    let present = 0;
    let unparsed = 0;
    for (let i = 0; i < members.length; i++) {
        const m = members[i] as ExternalAIClient;
        const r = responses[i];
        // Round 7 § 5.2 — attendance is a NON-EMPTY answer, not the absence of an
        // error. `!r.error` alone counted a member that returned zero bytes, and
        // that is not hypothetical: a 290 s curl timeout returned an empty body
        // with no error set in two sessions (`9fc9ba3e`, `4ac2f7ac`) and the
        // banner printed `2/2 present` — a single-voice verdict presented as
        // convergence, on a paid run. An empty answer contributes nothing to a
        // quorum by definition, whatever the transport thought of it.
        // Step 2.3 — the same argument, one rung further in. The byte check
        // below settles "did the transport deliver anything"; it cannot settle
        // "was what it delivered usable content", and a prose refusal passes it
        // unchanged. So a member whose findings answer reached `parse_failed`
        // is pulled out of `present` into its own bucket rather than folded
        // into `N/N present`. It is NOT merged with the error cases: those are
        // transport failures with an `AbsentReason` taxonomy the absent-member
        // table renders, and re-labelling one of them `unparsed` would lose the
        // auth/timeout/quota distinction. Hence the error branch below wins for
        // a member that both errored and parsed badly — the transport failure
        // is the stronger fact.
        //
        // `parse_outcomes` is optional because the run path derives it AFTER
        // the post-run attendance event is emitted: the event stays a
        // transport-level reading by design, and the rendered artefact is where
        // AC-2 asks for the distinction. A caller with no map gets the exact
        // pre-2.3 behaviour, key-for-key.
        if (r !== undefined && !r.error && r.text.trim() !== '') {
            if (parse_outcomes?.get(m.name) === 'parse_failed') {
                unparsed += 1;
                absent.push({
                    member: m.name,
                    reason: 'unparsed',
                    detail: 'answer present, no parser could read it',
                });
                continue;
            }
            present += 1;
            continue;
        }
        const raw = r?.error ?? (r !== undefined && r.text.trim() === '' ? 'empty response body' : 'no response');
        const failure = classifyCliFailure(raw);
        absent.push({
            member: m.name,
            reason: absentReasonFromCliFailure(failure) ?? 'unavailable',
            detail: raw,
        });
    }
    return { quorum: evaluateQuorum(members.length, present, _quorum_setting_from(ai_cfg), unparsed), absent };
}

/**
 * One-line k-of-n banner, mirrored from `orchestrator.ts::_render_quorum_line`
 * but for the CLI's own stdout stream rather than the rendered report —
 * "attendance is telemetry, never a silent drop" applies to the estimate
 * preview too, not only to a completed pass.
 */
export function _format_quorum_line(q: QuorumResult, phase?: QuorumEventPhase): string {
    // The phase tag is not decoration. A degraded run prints attendance TWICE —
    // the pre-run reading before the estimate table, the post-run reading after
    // the consult — and the two disagree by construction: `2/2 present …
    // concluded` then `0/2 present … INCONCLUSIVE`. Same prefix, opposite
    // content, and until 2026-08-12 neither line said which was which, so an
    // operator skimming (or anything grepping `council:quorum ·`) could take the
    // stale one. The event log had solved this from the start with an explicit
    // `phase` field; stdout had not. Optional, because the estimate path prints
    // exactly one line and a tag there would claim a distinction it does not make.
    const tag = phase === undefined ? '' : `${phase === 'pre_run' ? 'before the run' : 'after the run'} · `;
    const verdict = q.status === 'concluded' ? 'concluded' : 'INCONCLUSIVE — release gate holds';
    // Round 7 § 5.3 — a degraded pass says so. `1/2 present, needed 1 —
    // concluded` is literally true and reads as agreement; with a threshold of 1
    // a solo answer concludes, and nothing in the line distinguishes "both
    // members agreed" from "one member answered". The counts were always there;
    // what was missing is the word that stops a reader inferring convergence.
    // Step 2.3 moved the wording into `formatAttendanceCaveats` so this line and
    // its mirror in `orchestrator.ts` cannot drift apart, and added the
    // present-unparsed clause there — see that function for why the two counts
    // are disjoint.
    return `council:quorum · ${tag}${q.present}/${q.total} present, needed ${q.threshold} — ${verdict}.${formatAttendanceCaveats(q)}`;
}
