/**
 * The rewrite axis of `host_lowering.yaml`: what a host may let this package do
 * to each channel. Imports nothing, so the egress engine chunk can carry it
 * without pulling the lowering table's YAML reader into the chunk.
 */

/** The three channels a host may let this package rewrite, and the slot each rides on. */
export const REWRITE_CHANNELS = ['output', 'input', 'prompt'] as const;
export type RewriteChannel = (typeof REWRITE_CHANNELS)[number];
export const REWRITE_CHANNEL_SLOT: Readonly<Record<RewriteChannel, string>> = {
    output: 'post_tool_use',
    input: 'pre_tool_use',
    prompt: 'user_prompt_submit',
};

/**
 * `offered`: the host documents a rewrite field and no live probe has shown a
 * substitution delivered. No mode authorizes anything by itself: authority is a
 * capability only `resolveRewriteCapability` (rewrite_capability.ts) issues.
 */
export const REWRITE_MODES = ['replace', 'offered', 'gate', 'none'] as const;
export type RewriteMode = (typeof REWRITE_MODES)[number];

/** One dated answer on the rewrite axis. `mode` stays a raw string so the linter can name a bad one. */
export interface RewriteAnswer {
    mode: string;
    answered_at: string | null;
    docs_url: string | null;
    /** Repo-relative probe record a `replace` rests on, and the host version it probed. */
    probe: string | null;
    host_version: string | null;
}

export type ParsedAxis =
    | { readonly ok: true; readonly answers: ReadonlyMap<string, RewriteAnswer> }
    | { readonly ok: false; readonly error: string };

function asString(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
}

/**
 * The answers of one row's `rewrite:` value, keyed by channel as written,
 * unknown keys included. Absent is an empty map. A value that is not a mapping,
 * or an answer that is not one, is an error rather than an empty map: a
 * malformed axis read as "unstated" would hide the mistake.
 */
export function parseRewriteAxis(where: string, raw: unknown): ParsedAxis {
    const answers = new Map<string, RewriteAnswer>();
    if (raw === undefined) return { ok: true, answers };
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { ok: false, error: `${where} \`rewrite:\` is not a mapping` };
    }
    for (const [ch, av] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof av !== 'object' || av === null || Array.isArray(av)) {
            return { ok: false, error: `${where}/${ch} rewrite answer is not a mapping` };
        }
        const a = av as Record<string, unknown>;
        answers.set(ch, {
            mode: String(a['mode'] ?? ''),
            answered_at: asString(a['answered_at']),
            docs_url: asString(a['docs_url']),
            probe: asString(a['probe']),
            host_version: asString(a['host_version']),
        });
    }
    return { ok: true, answers };
}

/**
 * The stated mode, or `unstated` where nobody answered — absence of a claim,
 * never a dated `none`. An unknown mode string, and a malformed axis, are
 * `unstated` too; the lint names both.
 */
export function rewriteModeFor(row: { readonly rewrite_raw: unknown }, channel: RewriteChannel): RewriteMode | 'unstated' {
    const parsed = parseRewriteAxis('', row.rewrite_raw);
    const mode = parsed.ok ? parsed.answers.get(channel)?.mode : undefined;
    return (REWRITE_MODES as readonly string[]).includes(mode ?? '') ? (mode as RewriteMode) : 'unstated';
}
