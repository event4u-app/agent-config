/**
 * The council channel's egress state (road-to-one-detector-and-the-senders-we-own
 * 3.3): one token scope per run, the bundler's replacement through it, and the
 * final check every member call passes immediately before its request is written.
 *
 * The values replaced in this run are held in memory so the final check can
 * look for them; they are never written, logged or returned. The retained
 * record carries what the members were sent, so it keeps the placeholders; a
 * restore is for a display in this process only, and resolves identifiers —
 * a credential token resolves to nothing (D5).
 *
 * Credentials are replaced whatever the settings say: the bundle masked every
 * credential line before this module existed, so replacing the value instead of
 * the line changes how much is lost, not whether. Identifiers are replaced — and
 * checked — only when `egress.placeholders.mode` is `protect` or `strict`;
 * whether any identifier is replaced by default for consumers is the owner's
 * decision D8, which this module does not take.
 */

import {
    detect,
    EGRESS_RULES,
    type EgressRule,
    type EgressSpan,
    maskingEnd,
    prefixesOf,
    rawKeyPrefixPattern,
    replaceSpans,
    resolveOverlaps,
    findSpans,
    REVIEW_CREDENTIAL_ROWS,
} from '../_lib/egress_rules.js';
import { parseTokens, TokenScope } from '../_lib/egress_token.js';
import { readEgressMode } from '../hooks/egress_stage.js';

/**
 * The bundler's own looser readings, kept so moving it from whole-line masks to
 * spans narrows nothing: an Anthropic key prefix with eight key characters, an
 * OpenAI or project key glued to a preceding word, and the path of this
 * package's own key files.
 */
const BUNDLER_OWN_ROWS: readonly EgressRule[] = [
    {
        rule: 'bundler-short-anthropic-key',
        type: 'APIKEY',
        class: 'credential',
        replacement: 'detection',
        pattern: rawKeyPrefixPattern(8, prefixesOf('anthropic-api-key')),
    },
    {
        rule: 'bundler-glued-openai-key',
        type: 'APIKEY',
        class: 'credential',
        replacement: 'detection',
        pattern: rawKeyPrefixPattern(20, [...prefixesOf('openai-api-key'), ...prefixesOf('anthropic-project-key')], {
            boundary: 'never',
        }),
    },
    {
        rule: 'bundler-key-path',
        type: 'KEYPATH',
        class: 'credential',
        replacement: 'detection',
        pattern: /~?\/?\.(?:event4u|config)\/agent-config\/[^/\s]+\.key/gu,
    },
];

export const BUNDLE_RULES: readonly EgressRule[] = [...EGRESS_RULES, ...REVIEW_CREDENTIAL_ROWS, ...BUNDLER_OWN_ROWS];

const CLASS_RANK = { credential: 1, identifier: 0 } as const;

/** Why a body was refused; never carries a byte of the body. */
export interface EgressRefusal {
    readonly reason: 'replaced-value-present' | 'high-confidence-finding';
    /** The rule that fired, or the type of the replaced value. */
    readonly what: string;
}

export class CouncilEgress {
    readonly scope = new TokenScope();
    private readonly replaced = new Set<string>();

    /** `identifiers`: replace and check the identifier class too (mode `protect` or `strict`). */
    constructor(private readonly opts: { readonly identifiers: boolean } = { identifiers: false }) {}

    /**
     * Every detected value becomes a token; a key block whose end cannot be
     * proven is replaced through the nearest END marker, as the line masks did.
     */
    replace(text: string): string {
        const spans = resolveOverlaps(findSpans(text, BUNDLE_RULES))
            .filter((s) => s.class === 'credential' || this.opts.identifiers)
            .map((s) => ({ ...s, end: maskingEnd(text, s) }));
        spans.sort((a, b) => a.start - b.start);
        const merged: EgressSpan[] = [];
        for (const s of spans) {
            const last = merged[merged.length - 1];
            if (last !== undefined && s.start < last.end) {
                const keep = CLASS_RANK[s.class] > CLASS_RANK[last.class] ? s : last;
                merged[merged.length - 1] = { ...keep, start: last.start, end: Math.max(last.end, s.end) };
            } else {
                merged.push(s);
            }
        }
        const tokens = merged.map((s) => {
            const value = text.slice(s.start, s.end);
            this.replaced.add(value);
            return this.scope.mint(s.type, s.class, value);
        });
        return replaceSpans(text, merged, (_s, i) => tokens[i] as string);
    }

    /** The final check: null when the body may be sent. */
    check(body: string): EgressRefusal | null {
        for (const value of this.replaced) {
            if (body.includes(value)) return { reason: 'replaced-value-present', what: 'value replaced in this run' };
        }
        for (const s of detect(body)) {
            const high = s.class === 'credential' ? s.rule !== 'generic-assignment' : s.validated && this.opts.identifiers;
            if (high) return { reason: 'high-confidence-finding', what: s.rule };
        }
        return null;
    }

    /** For a display in this process only: identifier tokens back to their spelling. */
    restoreForDisplay(text: string): string {
        let out = text;
        for (const t of parseTokens(text).reverse()) {
            const value = this.scope.resolve(text.slice(t.start, t.end));
            if (value !== null) out = out.slice(0, t.start) + value + out.slice(t.end);
        }
        return out;
    }
}

let current: CouncilEgress | null = null;

function fromSettings(): CouncilEgress {
    let mode: string;
    try {
        mode = readEgressMode(process.cwd());
    } catch {
        mode = 'protect';
    }
    return new CouncilEgress({ identifiers: mode === 'protect' || mode === 'strict' });
}

/** The run's egress state; one council run is one process. */
export function councilEgress(): CouncilEgress {
    current ??= fromSettings();
    return current;
}

/** A fresh scope, for a test or a second run in one process; the settings are read again unless `opts` is given. */
export function resetCouncilEgress(opts?: { readonly identifiers: boolean }): CouncilEgress {
    current = opts === undefined ? fromSettings() : new CouncilEgress(opts);
    return current;
}
