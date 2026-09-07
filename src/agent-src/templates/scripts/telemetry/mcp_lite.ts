/**
 * MCP-lite call reading for `telemetry:report` (roadmap step 4.2).
 *
 * Reads the sink the stdio-lite MCP server writes — the same
 * `agents/runtime/mcp-telemetry/calls.jsonl` the kernel MCP server already
 * used, not a second store — and aggregates it per tool and per host.
 *
 * WHY THIS IS A SEPARATE MODULE. The engagement aggregator models artefacts
 * with a consulted/applied ratio; a `tools/call` has neither. Forcing MCP rows
 * through it would have meant either widening the engagement schema or
 * mislabelling a tool call as a "skill consulted", and both would have made the
 * quartile buckets mean two different things at once.
 *
 * PUBLISH THE ZERO. `render_mcp_lite_markdown` emits the section even when the
 * count is zero, and says so in words. The adjacent archived roadmaps in this
 * family closed at `measured-null` precisely because nulls were published
 * rather than buried; a section that disappears when empty would make "nobody
 * used it" and "nobody looked" indistinguishable.
 *
 * WHAT A ZERO DOES NOT MEAN. The emitter that fills this sink did not exist
 * before this roadmap, and it is gated off by default. A zero is therefore a
 * statement about the age and the default of the instrument first, and about
 * consumer behaviour only once a machine has run with the gate on. The rendered
 * section says this itself, so a reader cannot lift the number away from it.
 */

import * as fs from 'node:fs';
import { check_id_redaction } from './engagement.js';

/** Where the stdio-lite server writes, relative to the consumer root. */
export const MCP_LITE_LOG_REL = 'agents/runtime/mcp-telemetry/calls.jsonl';

/** The transport label the stdio-lite surface stamps on every row it writes. */
export const MCP_LITE_TRANSPORT = 'stdio-lite';

export interface McpLiteAggregate {
    /** The file that was read, whether or not it existed. */
    log_path: string;
    /** Rows on this transport that parsed and fell inside the window. */
    calls: number;
    /** Lines that did not parse as JSON, or carried no usable tool name. */
    skipped_lines: number;
    /** Rows that parsed but belong to another transport (the kernel server). */
    other_transport: number;
    by_tool: Map<string, number>;
    by_host: Map<string, number>;
    by_outcome: Map<string, number>;
    earliest_ts: string | null;
    latest_ts: string | null;
}

function _empty(log_path: string): McpLiteAggregate {
    return {
        log_path,
        calls: 0,
        skipped_lines: 0,
        other_transport: 0,
        by_tool: new Map(),
        by_host: new Map(),
        by_outcome: new Map(),
        earliest_ts: null,
        latest_ts: null,
    };
}

function _bump(m: Map<string, number>, k: string): void {
    m.set(k, (m.get(k) ?? 0) + 1);
}

/** Epoch ms for an ISO-8601 stamp, or `null` when it does not parse. */
function _ms(ts: unknown): number | null {
    if (typeof ts !== 'string') return null;
    const v = Date.parse(ts);
    return Number.isNaN(v) ? null : v;
}

/**
 * Aggregate the lite surface's calls.
 *
 * A missing file is an empty reading, never an error: the overwhelmingly common
 * case is a machine that has simply never run the server, and that is a zero,
 * not a failure. `since` is an epoch-ms lower bound, matching the engagement
 * aggregator's own window semantics; a row with an unreadable timestamp is
 * kept when there is no window and dropped when there is, because it cannot be
 * shown to fall inside one.
 */
export function aggregate_mcp_lite(
    log_path: string,
    opts: { since?: number | null } = {},
): McpLiteAggregate {
    const since = opts.since ?? null;
    const out = _empty(log_path);
    let text: string;
    try {
        text = fs.readFileSync(log_path, 'utf-8');
    } catch {
        return out;
    }
    for (const raw of text.split(/\r\n|\r|\n/)) {
        if (raw.trim() === '') continue;
        let rec: Record<string, unknown>;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                out.skipped_lines += 1;
                continue;
            }
            rec = parsed as Record<string, unknown>;
        } catch {
            out.skipped_lines += 1;
            continue;
        }
        if (rec.transport !== MCP_LITE_TRANSPORT) {
            out.other_transport += 1;
            continue;
        }
        const tool = typeof rec.tool_name === 'string' ? rec.tool_name : '';
        if (tool === '') {
            out.skipped_lines += 1;
            continue;
        }
        const ms = _ms(rec.ts);
        if (since !== null && (ms === null || ms < since)) continue;

        out.calls += 1;
        _bump(out.by_tool, tool);
        _bump(out.by_host, typeof rec.host === 'string' && rec.host !== '' ? rec.host : 'unknown');
        _bump(out.by_outcome, typeof rec.outcome === 'string' ? rec.outcome : 'unknown');
        const ts = typeof rec.ts === 'string' ? rec.ts : null;
        if (ts !== null) {
            if (out.earliest_ts === null || ts < out.earliest_ts) out.earliest_ts = ts;
            if (out.latest_ts === null || ts > out.latest_ts) out.latest_ts = ts;
        }
    }
    return out;
}

/** Descending by count, then by name, so the rendering is deterministic. */
function _sorted(m: Map<string, number>): [string, number][] {
    return [...m.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

const ZERO_NOTE =
    '_No calls recorded. The lite-surface emitter is default-off '
    + '(`telemetry.artifact_engagement.enabled`), so a zero here says the '
    + 'instrument was off or unused on this machine — it is not a measurement '
    + 'of what consumers do._';

/**
 * The markdown section. Always renders, zero included.
 *
 * Ids are re-validated through the engagement redaction floor even though the
 * emitter already clamps them: this renderer prints whatever is in the file,
 * and a file is not a boundary the emitter controls.
 */
export function render_mcp_lite_markdown(agg: McpLiteAggregate): string {
    const lines: string[] = [];
    lines.push('## MCP lite surface');
    lines.push('');
    lines.push(`- calls recorded: **${agg.calls}**`);
    if (agg.earliest_ts && agg.latest_ts) {
        lines.push(`- ts range: \`${agg.earliest_ts}\` → \`${agg.latest_ts}\``);
    }
    lines.push('');
    if (agg.calls === 0) {
        lines.push(ZERO_NOTE);
        lines.push('');
        return `${lines.join('\n')}`;
    }
    lines.push('| tool | calls |');
    lines.push('|---|---:|');
    for (const [tool, n] of _sorted(agg.by_tool)) {
        check_id_redaction('mcp_lite.by_tool.id', tool);
        lines.push(`| ${tool} | ${n} |`);
    }
    lines.push('');
    lines.push('| host | calls |');
    lines.push('|---|---:|');
    for (const [host, n] of _sorted(agg.by_host)) {
        check_id_redaction('mcp_lite.by_host.id', host);
        lines.push(`| ${host} | ${n} |`);
    }
    lines.push('');
    return `${lines.join('\n')}`;
}

/** Plain object for the JSON format. Same validation as the markdown path. */
export function mcp_lite_json(agg: McpLiteAggregate): Record<string, unknown> {
    const by_tool: Record<string, number> = {};
    for (const [tool, n] of _sorted(agg.by_tool)) {
        check_id_redaction('mcp_lite.by_tool.id', tool);
        by_tool[tool] = n;
    }
    const by_host: Record<string, number> = {};
    for (const [host, n] of _sorted(agg.by_host)) {
        check_id_redaction('mcp_lite.by_host.id', host);
        by_host[host] = n;
    }
    const by_outcome: Record<string, number> = {};
    for (const [outcome, n] of _sorted(agg.by_outcome)) {
        by_outcome[outcome] = n;
    }
    return {
        log_path: agg.log_path,
        calls: agg.calls,
        skipped_lines: agg.skipped_lines,
        by_tool,
        by_host,
        by_outcome,
        earliest_ts: agg.earliest_ts,
        latest_ts: agg.latest_ts,
    };
}
