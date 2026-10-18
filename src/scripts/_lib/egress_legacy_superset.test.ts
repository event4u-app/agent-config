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

import { scan as workspaceScan, scrub as workspaceScrub } from '../../cli/python/workspace_secrets.js';
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
});
