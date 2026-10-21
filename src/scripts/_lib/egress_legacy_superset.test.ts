/**
 * Moving a consumer onto the rule table must not narrow what it catches
 * (road-to-one-detector-and-the-senders-we-own 2.2). Each consumer's detection as
 * it stood before the move is frozen here as the regexes it spelled, and an
 * adversarial corpus — glued to a preceding word, after an underscore, in quotes,
 * in a URL, with a tail longer than a row's fixed length, with `_` and `-` in the
 * tail — is run through old and new. Wherever the old consumer acted, the new one
 * must act too, and a masking consumer must leave none of the old match behind.
 *
 * The drift matrix asks "does every consumer catch every row"; this asks "does
 * any consumer now miss something it used to catch". Values are built at runtime
 * and never printed.
 */
import { describe, expect, it } from 'vitest';

import { CLASS_SPELLED_PREFIXES, CREDENTIAL_PREFIXES, EGRESS_RULES } from './egress_rules.js';
import { FUZZY, scan as workspaceScan, scrub as workspaceScrub } from './workspace_secrets.js';
import { redact_low_impact_entry } from '../ai_council/redact_low_impact_entry.js';
import { REDACTION_PATTERNS as memoryRedactions } from '../check_memory.js';
import { REDACTIONS as reachRedactions } from '../check_reach_channels.js';
import { PATTERNS as fencePatterns } from '../lint_example_fences.js';
import { scrub_string as explainScrub } from '../_cli/explain_last/scrubber.js';
import { redact as bundlerRedact } from '../ai_council/bundler.js';
import { _RAW_KEY_PREFIXES as councilRefPrefixes } from '../ai_council/config.js';
import { redact as crossRepoRedact } from '../cross_repo_retrieve.js';
import { hasInlineSecret } from '../lint_mcp_config_security.js';

const SK = 'sk' + '-';
const GH = 'gh';

// The pre-move spellings, verbatim except that prefixes are assembled.
const OLD = {
    workspace: [
        /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
        /AKIA[0-9A-Z]{16}/g,
        new RegExp(`${GH}[pousr]_[A-Za-z0-9]{36,}`, 'g'),
        new RegExp(`${SK}[A-Za-z0-9]{20,}`, 'g'),
    ],
    crossRepoKv: /(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-+/=]{12,}['"]?/gi,
    bundler: [new RegExp(`${SK}ant-[A-Za-z0-9_\\-]{8,}`, 'gu'), new RegExp(`${SK}[A-Za-z0-9_\\-]{20,}`, 'gu')],
    explain: new RegExp(
        `(?:${['sk_live_', 'sk_test_', `${GH}p_`, 'github_pat_', `${GH}o_`, `${GH}s_`, `${GH}u_`, 'xoxb-', 'xoxp-', 'AIza', 'AKIA']
            .map((p) => p.replace(/-/g, '\\u002d'))
            .join('|')})[A-Za-z0-9_-]{6,}`,
        'gu',
    ),
    mcp: new RegExp(
        `${SK}ant-[A-Za-z0-9_\\-]{20,}|${SK}proj-[A-Za-z0-9_\\-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\\-]{35}|` +
            `${GH}p_[0-9A-Za-z]{36}|eyJ[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}`,
    ),
    councilRef: [SK, `${SK}ant-`, 'ya29.', 'AIza', 'xai-', 'pplx-', 'gsk_'],
};

const ALNUM = 'Qw3Er5Ty7Ui9Op2As4Df6Gh8Jk1Lz3Xc5Vb7Nm9';
const run = (n: number, shift = 0): string => {
    let s = '';
    for (let i = 0; i < n; i += 1) s += ALNUM[(i + shift) % ALNUM.length];
    return s;
};

const VALUES: readonly string[] = [
    `${SK}${run(20)}`,
    `${SK}${run(48, 3)}`,
    `${SK}ant-api03-${run(40, 1)}`,
    `${SK}ant-${run(8, 2)}`,
    `${SK}proj-${run(24, 4)}`,
    `${SK}${run(10)}_${run(10, 5)}-${run(6, 6)}`,
    `AKIA${'ABCDEFGHIJ234567'}`,
    `AIza${run(35, 7)}`,
    `${GH}p_${run(36, 8)}`,
    `${GH}p_${run(44, 9)}`,
    `${GH}s_${run(40, 10)}`,
    `${GH}r_${run(36, 11)}`,
    `${GH}o_${run(6, 12)}`,
    `github_pat_${run(30, 13)}`,
    `sk_live_${run(24, 14)}`,
    `sk_test_${run(6, 15)}`,
    `xoxb-${run(24, 16)}`,
    `xoxp-${run(6, 17)}`,
    `eyJ${run(12)}.${run(12, 1)}.${run(12, 2)}`,
    '-----BEGIN RSA PRIVATE KEY-----\nMIIab3cd4ef5\n-----END RSA PRIVATE KEY-----',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIgh6ij7kl8\n-----END EC PRIVATE KEY-----',
];

const CONTEXTS: readonly ((v: string) => string)[] = [
    (v) => v,
    (v) => `see ${v} here`,
    (v) => `x${v} glued`,
    (v) => `my_${v}`,
    (v) => `"${v}"`,
    (v) => `https://h.example/p?k=${v}&a=1`,
    (v) => `KEY=${v}`,
];

const INPUTS: readonly string[] = VALUES.flatMap((v) => CONTEXTS.map((c) => c(v)));

function matches(res: readonly RegExp[], text: string): string[] {
    const out: string[] = [];
    for (const re of res) {
        const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
        for (const m of text.matchAll(g)) out.push(m[0]);
    }
    return out;
}

/**
 * Old matches any part of whose key material survives. Key material is every
 * six-character window carrying a digit — the corpus values are digit-dense and
 * the surrounding prose has none — so a mask that leaves a key's tail behind
 * counts, not only one that leaves the whole match.
 */
function survivors(old: readonly string[], output: string): string[] {
    return old.filter((m) => {
        for (let i = 0; i + 6 <= m.length; i += 1) {
            const w = m.slice(i, i + 6);
            if (/[0-9]/.test(w) && /^[A-Za-z0-9]+$/.test(w) && output.includes(w)) return true;
        }
        return false;
    });
}

describe('legacy superset: no consumer misses what it caught before the move', () => {
    it('the corpus exercises every frozen pattern', () => {
        for (const re of [...OLD.workspace, ...OLD.bundler, OLD.explain, OLD.mcp]) {
            expect(INPUTS.some((t) => matches([re], t).length > 0)).toBe(true);
        }
    });

    it('workspace_secrets scan reports every old HIGH hit', () => {
        const missed = INPUTS.filter((t) => matches(OLD.workspace, t).length > 0 && workspaceScan(t).length === 0);
        expect(missed.length).toBe(0);
    });

    it('workspace_secrets scrub leaves no old HIGH match behind', () => {
        const left = INPUTS.filter((t) => survivors(matches(OLD.workspace, t), workspaceScrub(t)[0]).length > 0);
        expect(left.length).toBe(0);
    });

    it('cross_repo_retrieve leaves no old secret match behind', () => {
        const left = INPUTS.filter(
            (t) => survivors(matches([...OLD.workspace, OLD.crossRepoKv], t), crossRepoRedact(t, {})[0]).length > 0,
        );
        expect(left.length).toBe(0);
    });

    it('the council bundler leaves no old key match behind', () => {
        const left = INPUTS.filter((t) => survivors(matches(OLD.bundler, t), bundlerRedact(t)).length > 0);
        expect(left.length).toBe(0);
    });

    it('the explain scrubber leaves no old raw-key match behind', () => {
        const left = INPUTS.filter((t) => survivors(matches([OLD.explain], t), String(explainScrub(t))).length > 0);
        expect(left.length).toBe(0);
    });

    it('the MCP config lint flags every old inline secret', () => {
        const missed = INPUTS.filter((t) => OLD.mcp.test(t) && !hasInlineSecret(t));
        expect(missed.length).toBe(0);
    });

    it('the council api_key_ref check still refuses every old prefix', () => {
        for (const p of OLD.councilRef) expect(councilRefPrefixes).toContain(p);
    });

    it('the MCP config lint keeps a keyword assignment out of its HIGH tier', () => {
        expect(hasInlineSecret(`"api_key": "${run(24, 3)}"`)).toBe(false);
        expect(hasInlineSecret(`"token": "${SK}ant-api03-${run(40, 1)}"`)).toBe(true);
    });
});

// Step 2.7: the shapes with no vendor literal, frozen as each consumer spelled
// them before they read the table. A regex the consumer exposes must be the
// frozen one byte for byte; one it keeps private is held to the frozen
// behaviour over an assignment corpus.
const UW = '[\\p{L}\\p{N}_]';
const OLD_SHAPES = {
    rowGeneric:
        /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/dgi,
    workspaceFuzzy: /(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-+/=]{12,}['"]?/i,
    memory: /\b(api[_-]?key|auth[_-]?token|access[_-]?token|bearer|secret|password|passwd|private[_-]?key)\b\s*[:=]\s*[A-Za-z0-9+/=_\-]{8,}(?![/.\w])/i,
    fences: /\b(api[_-]?key|apikey|password|passwd|secret|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["'][^"']{8,}["']/i,
    reachAuthorization: /(\bauthorization\s*:\s*)(\S.*)$/gi,
    reachDashKeys: /\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/gi,
    reachTokens: /\b(gh[pousr]|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}/gi,
    lowImpactApiKey: new RegExp(`(?<!${UW})api[_-]?key(?!${UW})\\s*[:=]\\s*[A-Za-z0-9+/=_\\-]{12,}`, 'giu'),
    explainApiKey: /\bapi[_-]?key\b\s*[:=]\s*[A-Za-z0-9+/=_-]{12,}/giu,
    bundlerAssignment: /(api[_-]?key|secret|token|password)\s*[:=]/iu,
    bundlerAuthorization: /^\s*Authorization:\s/iu,
};

const sameRegex = (actual: RegExp | undefined, frozen: RegExp): void => {
    expect(actual?.source).toBe(frozen.source);
    expect(actual?.flags).toBe(frozen.flags);
};

const KEYWORDS = ['password', 'passwd', 'pwd', 'secret', 'api_key', 'api-key', 'apikey', 'access_token', 'token', 'bearer'];
const ASSIGN_VALUES = [run(8, 3), run(12, 4), run(30, 5), 'hunter2hunter2', 'A1b2C3d4E5f6G7h8'];
const ASSIGN_INPUTS: readonly string[] = KEYWORDS.flatMap((k) =>
    ASSIGN_VALUES.flatMap((v) => [`${k}=${v}`, `${k}: "${v}"`, `  ${k.toUpperCase()} = '${v}'`, `x_${k}:${v}`]),
);

describe('legacy superset: the shapes with no vendor literal (2.7)', () => {
    it('the exposed regexes are the frozen spellings, byte for byte', () => {
        sameRegex(EGRESS_RULES.find((r) => r.rule === 'generic-assignment')?.pattern, OLD_SHAPES.rowGeneric);
        sameRegex(FUZZY.find(([name]) => name === 'kv_secret')?.[1], OLD_SHAPES.workspaceFuzzy);
        sameRegex(memoryRedactions.find(([, label]) => label === 'inline credential')?.[0], OLD_SHAPES.memory);
        sameRegex(fencePatterns.find((p) => p.id === 'secret-literal')?.pattern, OLD_SHAPES.fences);
        sameRegex(reachRedactions[0]?.[0], OLD_SHAPES.reachAuthorization);
        sameRegex(reachRedactions[2]?.[0], OLD_SHAPES.reachDashKeys);
        sameRegex(reachRedactions[3]?.[0], OLD_SHAPES.reachTokens);
    });

    it('each class-spelled family covers the table prefixes it claims', () => {
        for (const { family, covers } of Object.values(CLASS_SPELLED_PREFIXES)) {
            const re = new RegExp(`^${family}`, 'i');
            for (const p of covers) {
                expect(CREDENTIAL_PREFIXES).toContain(p);
                expect(re.exec(p)?.[0]).toBe(p);
            }
        }
    });

    it('the assignment corpus exercises every private frozen shape', () => {
        for (const re of [OLD_SHAPES.lowImpactApiKey, OLD_SHAPES.explainApiKey, OLD_SHAPES.bundlerAssignment]) {
            expect(ASSIGN_INPUTS.some((t) => new RegExp(re.source, re.flags).test(t))).toBe(true);
        }
    });

    it('the low-impact redactor refuses every input its old api-key shape refused', () => {
        const missed = ASSIGN_INPUTS.filter(
            (t) =>
                new RegExp(OLD_SHAPES.lowImpactApiKey.source, OLD_SHAPES.lowImpactApiKey.flags).test(t) &&
                !redact_low_impact_entry(t).violations.some((v) => v.note === 'inline api_key'),
        );
        expect(missed).toEqual([]);
    });

    it('the explain scrubber masks every input its old api-key shape masked', () => {
        const left = ASSIGN_INPUTS.filter((t) => {
            const m = new RegExp(OLD_SHAPES.explainApiKey.source, OLD_SHAPES.explainApiKey.flags).exec(t);
            return m !== null && String(explainScrub(t)).includes(m[0]);
        });
        expect(left).toEqual([]);
    });

    it('the council bundler replaces every line its old assignment and header shapes replaced', () => {
        const lines = [...ASSIGN_INPUTS, 'Authorization: Basic Zm9vOmJhcg==', '  authorization: Bearer abc'];
        const missed = lines.filter(
            (t) =>
                (OLD_SHAPES.bundlerAssignment.test(t) || OLD_SHAPES.bundlerAuthorization.test(t)) && bundlerRedact(t) === t,
        );
        expect(missed).toEqual([]);
    });
});
