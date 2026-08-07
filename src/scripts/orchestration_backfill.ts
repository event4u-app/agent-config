#!/usr/bin/env -S npx tsx
/**
 * Backfill orchestration telemetry from the host transcript corpus.
 *
 * Why this exists (road-to-orchestrator-first-execution Phase 1). Two roadmaps
 * are blocked on "≥20 orchestration lines in the current month", with the
 * stated remedy "use the agent on real delegable work". Measured 2026-08-07:
 * the agent was used on real delegable work **370 times** in this repo over one
 * month, and `orchestration_record` — a model-carried emit step — captured
 * exactly **one** of them. The blocker was never a usage problem; it is an
 * instrumentation defect, and the data it was waiting for is already on disk.
 *
 * What this reads. The host writes one JSONL transcript per session under
 * `~/.claude/projects/<slugified-project-path>/`. An `Agent` dispatch appears
 * as a `tool_use` block; its result appears as a `toolUseResult` object.
 *
 * The coverage limit, which is the point rather than a footnote. Only
 * SYNCHRONOUS dispatches carry cost: `totalTokens`, `totalDurationMs`,
 * `usage`. An ASYNCHRONOUS dispatch returns a launch acknowledgement
 * (`isAsync: true`, `status: "async_launched"`) and its completion never
 * writes cost back into the parent transcript. So the metric-bearing
 * population is a strict subset, and this script reports both counts rather
 * than the flattering one. Emitting 370 lines of which 331 carry a null cost
 * would inflate n against a gate that counts lines.
 *
 * What this deliberately does NOT do. It does not compute a `token_delta`
 * against an in-session baseline. That counterfactual is not on disk and is
 * not measured by anything, so synthesising one here and stamping it
 * `measured` is the exact laundering `orchestration-observed-dispatch-cost`
 * criterion (2) forbids. The orchestrated side is measured; the baseline is a
 * downstream decision that must name its own method.
 *
 * Read-only. Never mutates a transcript.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

/** One dispatch-family. `unclassified` is a real answer, never a guess. */
export type DispatchFamily =
    | 'read-only-fanout'
    | 'ordered-steps'
    | 'competitive'
    | 'verdict-judge'
    | 'unclassified';

export interface BackfilledDispatch {
    session_id: string;
    tool_use_id: string;
    timestamp: string | null;
    subagent_type: string | null;
    description: string | null;
    family: DispatchFamily;
    family_signal: string;
    resolved_model: string | null;
    /** Measured orchestrated-side cost. `null` on an async dispatch. */
    total_tokens: number | null;
    wall_clock_ms: number | null;
    tool_use_count: number | null;
    /** `measured` only when the host recorded the cost; never inferred. */
    cost_provenance: 'measured' | 'absent';
    async_launch: boolean;
}

/**
 * Slugify a project path the way the host names its transcript directory:
 * every character outside `[A-Za-z0-9]` becomes `-`.
 */
export function transcriptDirFor(projectPath: string, home = homedir()): string {
    return join(home, '.claude', 'projects', projectPath.replace(/[^A-Za-z0-9]/g, '-'));
}

/**
 * Classify a dispatch into a family from OBSERVABLE fields only.
 *
 * The council's round-2 finding was that eight dispatch templates were being
 * treated as one hypothesis. Family is therefore carried per line. Where no
 * enumerated signal matches, the answer is `unclassified` — the same
 * discipline `classifyTask` applies when no delegable signal matches. A
 * classifier that always produces a family would make the per-family split
 * meaningless.
 */
export function classifyFamily(
    subagentType: string | null,
    description: string | null,
    prompt: string | null,
): { family: DispatchFamily; signal: string } {
    const hay = `${description ?? ''}\n${prompt ?? ''}`.toLowerCase();

    // Verdict/judge first — it is the narrowest and can otherwise be swallowed
    // by the read-only signal, since most verdict passes are also read-only.
    if (subagentType === 'production-validator') {
        return { family: 'verdict-judge', signal: 'subagent_type=production-validator' };
    }
    if (/\b(verify|verdict|judge|adjudicat|audit this|review this|acceptance criterion)\b/.test(hay)) {
        return { family: 'verdict-judge', signal: 'verdict-shaped verb in description/prompt' };
    }

    if (subagentType === 'Explore') {
        return { family: 'read-only-fanout', signal: 'subagent_type=Explore' };
    }
    if (/\b(read-only|do not edit|never edit|investigation only|map |inventory|locate)\b/.test(hay)) {
        return { family: 'read-only-fanout', signal: 'read-only declaration in prompt' };
    }

    if (/\b(step \d|then |after (the )?previous|in order|sequentially|depends on step)\b/.test(hay)) {
        return { family: 'ordered-steps', signal: 'ordering language in prompt' };
    }

    if (/\b(variant|competing|alternative approach|candidate [ab]|independently propose)\b/.test(hay)) {
        return { family: 'competitive', signal: 'competitive framing in prompt' };
    }

    return { family: 'unclassified', signal: 'no enumerated family signal matched' };
}

interface Extraction {
    dispatches: BackfilledDispatch[];
    sessions_scanned: number;
    unparseable_lines: number;
}

/** Walk one project's transcript corpus and pair each `Agent` tool_use with its result. */
export function extract(dir: string): Extraction {
    if (!existsSync(dir)) {
        return { dispatches: [], sessions_scanned: 0, unparseable_lines: 0 };
    }
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    const dispatches: BackfilledDispatch[] = [];
    let unparseable = 0;

    for (const file of files) {
        const sessionId = file.replace(/\.jsonl$/, '');
        // tool_use_id → the dispatch we are still waiting on a result for.
        const pending = new Map<string, Partial<BackfilledDispatch> & { prompt: string | null }>();
        const emitted = new Map<string, BackfilledDispatch>();

        for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
            if (line.trim() === '') continue;
            let obj: Record<string, unknown>;
            try {
                obj = JSON.parse(line) as Record<string, unknown>;
            } catch {
                unparseable += 1;
                continue;
            }

            const message = obj.message as Record<string, unknown> | undefined;
            const content = message?.content;
            if (Array.isArray(content)) {
                for (const block of content) {
                    const b = block as Record<string, unknown>;
                    if (b.type !== 'tool_use' || b.name !== 'Agent') continue;
                    const input = (b.input ?? {}) as Record<string, unknown>;
                    const id = String(b.id ?? '');
                    if (id === '') continue;
                    pending.set(id, {
                        session_id: sessionId,
                        tool_use_id: id,
                        timestamp: typeof obj.timestamp === 'string' ? obj.timestamp : null,
                        subagent_type: typeof input.subagent_type === 'string' ? input.subagent_type : null,
                        description: typeof input.description === 'string' ? input.description : null,
                        prompt: typeof input.prompt === 'string' ? input.prompt : null,
                    });
                }
            }

            const result = obj.toolUseResult as Record<string, unknown> | undefined;
            if (!result || typeof result !== 'object') continue;
            // The result carries no tool_use_id of its own; the host pairs it via
            // the enclosing user message's tool_result block.
            let resultId: string | null = null;
            if (Array.isArray(content)) {
                for (const block of content) {
                    const b = block as Record<string, unknown>;
                    if (b.type === 'tool_result' && typeof b.tool_use_id === 'string') {
                        resultId = b.tool_use_id;
                    }
                }
            }
            if (resultId === null || !pending.has(resultId)) continue;
            const head = pending.get(resultId)!;
            pending.delete(resultId);

            const totalTokens = typeof result.totalTokens === 'number' ? result.totalTokens : null;
            const { family, signal } = classifyFamily(
                head.subagent_type ?? null,
                head.description ?? null,
                head.prompt,
            );

            emitted.set(resultId, {
                session_id: sessionId,
                tool_use_id: resultId,
                timestamp: head.timestamp ?? null,
                subagent_type: head.subagent_type ?? null,
                description: head.description ?? null,
                family,
                family_signal: signal,
                resolved_model: typeof result.resolvedModel === 'string' ? result.resolvedModel : null,
                total_tokens: totalTokens,
                wall_clock_ms: typeof result.totalDurationMs === 'number' ? result.totalDurationMs : null,
                tool_use_count: typeof result.totalToolUseCount === 'number' ? result.totalToolUseCount : null,
                cost_provenance: totalTokens === null ? 'absent' : 'measured',
                async_launch: result.isAsync === true,
            });
        }

        dispatches.push(...emitted.values());
        // A dispatch whose result never landed in this transcript (session ended
        // mid-flight) is reported as a gap rather than dropped silently.
        for (const [id, head] of pending) {
            const { family, signal } = classifyFamily(
                head.subagent_type ?? null,
                head.description ?? null,
                head.prompt,
            );
            dispatches.push({
                session_id: sessionId,
                tool_use_id: id,
                timestamp: head.timestamp ?? null,
                subagent_type: head.subagent_type ?? null,
                description: head.description ?? null,
                family,
                family_signal: signal,
                resolved_model: null,
                total_tokens: null,
                wall_clock_ms: null,
                tool_use_count: null,
                cost_provenance: 'absent',
                async_launch: false,
            });
        }
    }

    return { dispatches, sessions_scanned: files.length, unparseable_lines: unparseable };
}

/** Per-family roll-up. Medians, never means — one 530k outlier should not carry a family. */
export function summarize(dispatches: BackfilledDispatch[]): Record<string, unknown> {
    const byFamily = new Map<string, number[]>();
    for (const d of dispatches) {
        if (d.cost_provenance !== 'measured' || d.total_tokens === null) continue;
        const bucket = byFamily.get(d.family) ?? [];
        bucket.push(d.total_tokens);
        byFamily.set(d.family, bucket);
    }
    const families: Record<string, unknown> = {};
    for (const [family, tokens] of byFamily) {
        tokens.sort((a, b) => a - b);
        families[family] = {
            n: tokens.length,
            // criterion (1): n<5 is UNDERPOWERED and is never merged to reach n.
            power: tokens.length < 5 ? 'UNDERPOWERED' : 'reportable',
            median_tokens: tokens[Math.floor(tokens.length / 2)],
            min_tokens: tokens[0],
            max_tokens: tokens[tokens.length - 1],
            sum_tokens: tokens.reduce((a, b) => a + b, 0),
        };
    }
    const measured = dispatches.filter((d) => d.cost_provenance === 'measured').length;
    return {
        dispatches_total: dispatches.length,
        dispatches_with_measured_cost: measured,
        dispatches_without_cost: dispatches.length - measured,
        async_launches: dispatches.filter((d) => d.async_launch).length,
        cost_coverage_ratio: dispatches.length === 0 ? 0 : Number((measured / dispatches.length).toFixed(4)),
        families,
        models: dispatches
            .filter((d) => d.cost_provenance === 'measured')
            .reduce<Record<string, number>>((acc, d) => {
                const key = d.resolved_model ?? 'unknown';
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
            }, {}),
        baseline_note:
            'No in-session counterfactual exists on disk. token_delta is NOT computed here; ' +
            'any downstream comparison must name its own baseline method and stamp it estimated.',
    };
}

function main(argv: string[]): number {
    const projectArg = argv.indexOf('--project');
    const project =
        projectArg >= 0 && argv[projectArg + 1] !== undefined ? argv[projectArg + 1]! : process.cwd();
    const outArg = argv.indexOf('--out');
    const dir = transcriptDirFor(project);

    if (!existsSync(dir)) {
        process.stderr.write(`orchestration_backfill: no transcript corpus at ${dir}\n`);
        return 1;
    }

    const { dispatches, sessions_scanned, unparseable_lines } = extract(dir);
    const summary = summarize(dispatches);
    // Emit the corpus identity, never the absolute path: the transcript
    // directory is rooted at the operator's home and a committed report
    // carrying it leaks an identity-revealing local path for no analytical
    // gain (the basename already identifies which corpus was read).
    const report = {
        schema_version: 1,
        source_corpus: basename(dir),
        sessions_scanned,
        unparseable_lines,
        ...summary,
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

    if (outArg >= 0 && argv[outArg + 1] !== undefined) {
        const lines = dispatches
            .filter((d) => d.cost_provenance === 'measured')
            .map((d) => JSON.stringify({ input_kind: 'orchestration', orchestration: d }))
            .join('\n');
        writeFileSync(argv[outArg + 1]!, lines === '' ? '' : `${lines}\n`, 'utf8');
        process.stderr.write(
            `orchestration_backfill: wrote ${summary.dispatches_with_measured_cost} measured line(s) to ${argv[outArg + 1]}\n`,
        );
    }
    return 0;
}

if (process.argv[1] !== undefined && process.argv[1].includes('orchestration_backfill')) {
    process.exit(main(process.argv.slice(2)));
}
