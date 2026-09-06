/**
 * Per-host MCP consent residuals (roadmap step 3.2).
 *
 * A RESIDUAL is what remains non-automatic after this package has installed:
 * the step the human still has to take before the MCP server actually runs.
 * The step's own framing is the design constraint — "a checklist of things that
 * did work is noise, a named residual is actionable" — so this module models
 * only what is left, and the surfaces that print it print nothing else.
 *
 * ## Provenance is carried, not assumed
 *
 * Every residual says where its text came from, and the surfaces print it:
 *
 * - `vendor-doc` — the host's own documentation says so. Nobody here watched it
 *   happen. Vendor documentation drifts, so this is a starting value, never a
 *   fact about the machine the reader is on.
 * - `observed` — a session on that host recorded it. Only an observation may
 *   replace a documented value, and only in that direction.
 *
 * ## An absent host is UNRECORDED, never "no residual"
 *
 * A host with no entry here has not been looked at. `residualFor` returns
 * `null` and the callers say so in words, because printing nothing would make
 * "this host needs no step" and "nobody checked this host" the same line — the
 * exact confusion the capability manifest's own `default` provenance exists to
 * prevent.
 */

import { describeHostCapabilities } from './host_capability.js';

/** Where a residual's text came from. Only an observation may replace a doc. */
export type ResidualSource = 'vendor-doc' | 'observed';

export interface ConsentResidual {
    /** Capability-manifest host id (`claude`), not the installer tool id. */
    hostId: string;
    /** The step the human still has to take. One sentence, imperative. */
    residual: string;
    source: ResidualSource;
    /** Why we believe it — a doc reference, or the session that observed it. */
    cite: string;
}

/**
 * Seeded residuals.
 *
 * DELIBERATELY SHORT. Only hosts whose residual is establishable today appear;
 * a row invented for a host nobody checked would be the "vendor-doc residuals
 * harden into asserted facts" risk this roadmap's own register names, arriving
 * one step earlier than predicted. Absence here is the honest state, and the
 * callers render it as such.
 */
const SEEDED: Readonly<Record<string, ConsentResidual>> = {
    claude: {
        hostId: 'claude',
        residual:
            'Approve the project-scoped `agent-config` server the first time the host '
            + 'prompts — the installer writes `.mcp.json` but does not pre-approve it.',
        source: 'vendor-doc',
        cite:
            'Host documentation: a project-scope MCP server requires explicit approval, '
            + 'suppressible only through the user-global `enabledMcpjsonServers` key, '
            + 'which this package deliberately does not write '
            + '(blocker `mcp-user-scope-approval-consent`).',
    },
};

/** Installer `--tools` id → capability-manifest host id, for the report. */
export const TOOL_TO_HOST: Readonly<Record<string, string>> = {
    'claude-code': 'claude',
    cursor: 'cursor',
    'gemini-cli': 'gemini',
    windsurf: 'windsurf',
    cline: 'cline',
    copilot: 'copilot',
    augment: 'augment',
};

/**
 * The residual for one host, or `null` when none is recorded.
 *
 * An OBSERVATION outranks the documented value, and in one direction only: a
 * host whose capability row explicitly records `mcp_needs_manual_activation:
 * false` — an observation, since the field's provenance reads `registry` only
 * when the row wrote it — has no residual left, and that clearance is itself
 * reported as `observed`. The reverse never happens: a documented residual is
 * not upgraded to `observed` by anything short of a session.
 */
export function residualFor(hostId: string): ConsentResidual | null {
    const { manifest, sources } = describeHostCapabilities(hostId);
    if (sources.mcp_needs_manual_activation === 'registry' && !manifest.mcp_needs_manual_activation) {
        return null;
    }
    return SEEDED[hostId] ?? null;
}

/** Was this host looked at at all? Distinguishes "cleared" from "unrecorded". */
export function isRecorded(hostId: string): boolean {
    const { sources } = describeHostCapabilities(hostId);
    return hostId in SEEDED || sources.mcp_needs_manual_activation === 'registry';
}

/** One rendered line per host, for the doctor check and the installer report. */
export interface ResidualLine {
    hostId: string;
    /** `residual` · `cleared` · `unrecorded` — the three honest states. */
    state: 'residual' | 'cleared' | 'unrecorded';
    text: string;
}

/** Render the state of one host. Never silent, in any of the three states. */
export function residualLine(hostId: string): ResidualLine {
    const r = residualFor(hostId);
    if (r !== null) {
        return {
            hostId,
            state: 'residual',
            text: `${hostId}: ${r.residual} (source: ${r.source} — not observed here)`,
        };
    }
    if (isRecorded(hostId)) {
        return {
            hostId,
            state: 'cleared',
            text: `${hostId}: nothing left to do (source: observed)`,
        };
    }
    return {
        hostId,
        state: 'unrecorded',
        text: `${hostId}: no residual recorded — nobody checked this host, which is not the same as nothing to do`,
    };
}

/**
 * The lines an installer run should print, for the tools it selected.
 *
 * Only hosts with a real residual OR an unrecorded state are returned: a host
 * whose residual was observed away has nothing actionable to say, and the step
 * asks for exactly the actionable set.
 */
export function residualReport(toolIds: Iterable<string>): ResidualLine[] {
    const seen = new Set<string>();
    const out: ResidualLine[] = [];
    for (const toolId of toolIds) {
        const hostId = TOOL_TO_HOST[toolId];
        if (hostId === undefined || seen.has(hostId)) continue;
        seen.add(hostId);
        const line = residualLine(hostId);
        if (line.state !== 'cleared') out.push(line);
    }
    return out;
}
