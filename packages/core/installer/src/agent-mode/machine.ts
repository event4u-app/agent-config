/**
 * Agent-mode state machine for `init --agent`.
 *
 * State is encoded in repeated `--answer <id>=<value>` flags so the
 * machine is stateless across invocations (ADR-016 § 4): an agent may
 * re-issue from scratch any turn and replay every prior answer in the
 * `next_call` payload. Order: `q1.workspaces` → `q2.packs` →
 * `q3.confirm` (skipped when no auto-added packs) → write + `done`.
 */

import { computeInstallPlan, executeInstallPlan } from '../install-plan.js';
import { resolvePacks } from '../resolver.js';
import {
    UnknownPackError,
    UnknownWorkspaceError,
    packsForWorkspaces,
    parseCsv,
    validatePackIds,
    validateWorkspaces,
} from '../selection.js';
import { sha256OfString } from '../io/sha256.js';
import { lockfileToYaml } from '../lockfile.js';
import { collectAdvisoryPacks, formatTrustSummary } from '../tui.js';
import { AGENT_CONFIG_VERSION, PACK_VERSION } from '../version.js';
import { done, emit, error, question } from './protocol.js';
import type { AgentResponse } from '../types.js';
import type { DiscoveryManifest } from '../types.js';

export interface AgentRunInputs {
    readonly manifest: DiscoveryManifest;
    readonly manifestSha256: string;
    readonly packageRoot: string;
    readonly projectRoot: string;
    readonly dryRun: boolean;
    readonly answers: readonly string[];
    readonly stdout?: NodeJS.WritableStream;
    readonly now?: () => string;
}

const Q_WORKSPACES = 'q1.workspaces';
const Q_PACKS = 'q2.packs';
const Q_CONFIRM = 'q3.confirm';
const Q_ADVISORY = 'q4.advisory';

interface ParsedAnswers {
    readonly map: ReadonlyMap<string, string>;
    readonly error?: AgentResponse;
}

function parseAnswers(answers: readonly string[]): ParsedAnswers {
    const map = new Map<string, string>();
    for (const raw of answers) {
        const eq = raw.indexOf('=');
        if (eq < 0) {
            return { map, error: error('answer_malformed', { received: raw }) };
        }
        map.set(raw.slice(0, eq), raw.slice(eq + 1));
    }
    return { map };
}

function buildNextCall(answers: ReadonlyMap<string, string>, nextId: string): string {
    const parts: string[] = ['init --agent'];
    for (const [k, v] of answers) parts.push(`--answer ${k}=${v}`);
    parts.push(`--answer ${nextId}=<value>`);
    return parts.join(' ');
}

export async function runAgentInit(input: AgentRunInputs): Promise<number> {
    const stdout = input.stdout ?? process.stdout;
    const parsed = parseAnswers(input.answers);
    if (parsed.error !== undefined) {
        emit(parsed.error, stdout);
        return 2;
    }
    const a = parsed.map;

    // Step 1 — workspaces.
    if (!a.has(Q_WORKSPACES)) {
        emit(question({
            id: Q_WORKSPACES,
            prompt: 'Which workspaces does this project need? (multi, comma-separated)',
            multi: true,
            choices: input.manifest.workspaces.map((w) => ({ value: w.id, label: w.label })),
            nextCall: buildNextCall(a, Q_WORKSPACES),
        }), stdout);
        return 0;
    }
    let workspaceIds: readonly string[];
    try {
        workspaceIds = validateWorkspaces(input.manifest, parseCsv(a.get(Q_WORKSPACES)));
    } catch (err) {
        if (err instanceof UnknownWorkspaceError) {
            emit(error('unknown_workspace', { expected: Q_WORKSPACES, received: err.id }), stdout);
            return 2;
        }
        throw err;
    }
    if (workspaceIds.length === 0) {
        emit(error('empty_selection', { expected: Q_WORKSPACES }), stdout);
        return 2;
    }

    // Step 2 — packs scoped to chosen workspaces.
    const candidatePacks = packsForWorkspaces(input.manifest, workspaceIds);
    if (!a.has(Q_PACKS)) {
        emit(question({
            id: Q_PACKS,
            prompt: 'Which packs do you want? (multi, comma-separated)',
            multi: true,
            choices: candidatePacks.map((p) => ({ value: p.id, label: p.label })),
            nextCall: buildNextCall(a, Q_PACKS),
        }), stdout);
        return 0;
    }
    let packIds: readonly string[];
    try {
        packIds = validatePackIds(input.manifest, parseCsv(a.get(Q_PACKS)));
    } catch (err) {
        if (err instanceof UnknownPackError) {
            emit(error('unknown_pack', { expected: Q_PACKS, received: err.id }), stdout);
            return 2;
        }
        throw err;
    }
    return await finishAgentInit(input, a, workspaceIds, packIds, stdout);
}

async function finishAgentInit(
    input: AgentRunInputs,
    a: ReadonlyMap<string, string>,
    workspaceIds: readonly string[],
    packIds: readonly string[],
    stdout: NodeJS.WritableStream,
): Promise<number> {
    const resolved = resolvePacks(input.manifest, packIds);
    if (resolved.missing.length > 0) {
        emit(error('unknown_pack', { expected: Q_PACKS, received: resolved.missing.join(',') }), stdout);
        return 2;
    }
    const autoAdded = resolved.packs.filter((p) => p.autoSelected);

    // Step 3 — confirm auto-added packs (skipped when none).
    if (autoAdded.length > 0 && !a.has(Q_CONFIRM)) {
        emit(question({
            id: Q_CONFIRM,
            prompt: `These packs were pulled in by requires_hint: ${autoAdded.map((p) => p.id).join(', ')}. Accept? (yes/no)`,
            multi: false,
            choices: [{ value: 'yes', label: 'Accept auto-added packs' }, { value: 'no', label: 'Abort' }],
            nextCall: buildNextCall(a, Q_CONFIRM),
        }), stdout);
        return 0;
    }
    if (autoAdded.length > 0) {
        const confirm = a.get(Q_CONFIRM);
        if (confirm !== 'yes') {
            emit(error('aborted_by_agent', { expected: Q_CONFIRM, received: confirm ?? '' }), stdout);
            return 2;
        }
    }

    // Step 4 — trust gate (Phase 5.1 / ADR-018): advisory/restricted/
    // experimental artefacts require explicit acknowledgment.
    const advisoryPacks = collectAdvisoryPacks(
        input.manifest.packs,
        resolved.packs.map((p) => p.id),
    );
    if (advisoryPacks.length > 0 && !a.has(Q_ADVISORY)) {
        const summary = advisoryPacks
            .map((p) => `${p.id}: ${formatTrustSummary(p.trustSummary, p.humanReviewRequired)}`)
            .join(' | ');
        emit(question({
            id: Q_ADVISORY,
            prompt: `These packs include advisory/restricted/experimental artefacts and require explicit acknowledgment: ${summary}. Accept? (yes/no)`,
            multi: false,
            choices: [{ value: 'yes', label: 'Accept advisory artefacts' }, { value: 'no', label: 'Abort' }],
            nextCall: buildNextCall(a, Q_ADVISORY),
        }), stdout);
        return 0;
    }
    if (advisoryPacks.length > 0) {
        const advisory = a.get(Q_ADVISORY);
        if (advisory !== 'yes') {
            emit(error('aborted_by_agent', { expected: Q_ADVISORY, received: advisory ?? '' }), stdout);
            return 2;
        }
    }

    // Step 5 — execute and emit done.
    const plan = computeInstallPlan({
        manifest: input.manifest,
        workspaces: workspaceIds,
        packs: resolved.packs,
        packageRoot: input.packageRoot,
        projectRoot: input.projectRoot,
    });
    const result = executeInstallPlan({
        plan,
        projectRoot: input.projectRoot,
        manifestSha256: input.manifestSha256,
        agentConfigVersion: AGENT_CONFIG_VERSION,
        packVersion: PACK_VERSION,
        manifest: input.manifest,
        ...(input.now !== undefined ? { now: input.now } : {}),
        ...(input.dryRun ? { dryRun: true } : {}),
    });
    const lockfileSha = sha256OfString(lockfileToYaml(result.lockfile));
    emit(done(result.filesWritten, lockfileSha), stdout);
    return 0;
}
