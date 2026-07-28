// VCS-agnostic secret detector (secret-hygiene-guardrail Phase 0).
//
// A pure, I/O-free, network-free module: given a blob of text it returns the
// secrets it finds. Callers (pre-commit hooks, CI scanners, editor lints)
// decide policy — this module only detects.
//
// Three detection layers, in confidence order:
//   1. Regex rule pack (HIGH) — reuses the exact `_SECRET` patterns from
//      `lint_mcp_config_security.ts` (sk-ant-, sk-proj-, AKIA, AIza, ghp_, JWT)
//      and extends them with Stripe, Slack, PEM private-key headers, DB
//      connection URLs with embedded credentials, and generic secret-ish
//      assignments. The reused patterns are NOT weakened.
//   2. Entropy layer (MEDIUM) — Shannon entropy over base64/hex-ish tokens
//      ≥ ENTROPY_MIN_TOKEN_LENGTH chars, flagging those above a tunable
//      per-charset threshold (base64 ≥ 4.5 bits/char, hex ≥ 3.0).
//   3. Keyword/context — a high-entropy token on a line that also mentions a
//      secret keyword is raised to HIGH; standalone entropy stays MEDIUM.
//
// False-positive suppression lives INSIDE the detector: a `secret-allow`
// marker mutes a line, placeholder-shaped values are demoted to LOW (still
// returned so callers can choose), and the masked preview never reproduces the
// full secret.

/** One detected secret. Never carries the raw value — see `masked`. */
export interface SecretFinding {
    rule: string;
    kind: string;
    line: number;
    column: number;
    masked: string;
    confidence: 'high' | 'medium' | 'low';
}

/** Options for a scan. `path` lets `.example` / `.sample` files demote hits. */
export interface ScanOptions {
    path?: string;
}

// ---------------------------------------------------------------------
// Entropy thresholds (exported so callers / tests can tune + assert them).
// ---------------------------------------------------------------------

/** Minimum token length before the entropy layer even considers a candidate. */
export const ENTROPY_MIN_TOKEN_LENGTH = 20;
/** base64/mixed-alphabet tokens above this bits/char are entropy hits. */
export const BASE64_ENTROPY_THRESHOLD = 4.5;
/** pure-hex tokens above this bits/char are entropy hits (with keyword ctx). */
export const HEX_ENTROPY_THRESHOLD = 3.0;

// ---------------------------------------------------------------------
// Regex rule pack (HIGH-confidence).
// ---------------------------------------------------------------------

interface Rule {
    rule: string;
    kind: string;
    regex: RegExp; // MUST carry the global flag
    valueGroup?: number; // capture group holding the sensitive value (default 0)
}

// Reused verbatim from lint_mcp_config_security.ts `_SECRET` (do NOT weaken),
// split into individually-kinded rules, plus the extension set from the spec.
const RULES: readonly Rule[] = [
    { rule: 'anthropic-api-key', kind: 'anthropic-api-key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
    { rule: 'anthropic-project-key', kind: 'anthropic-api-key', regex: /sk-proj-[A-Za-z0-9_-]{20,}/g },
    { rule: 'aws-access-key', kind: 'aws-access-key', regex: /AKIA[0-9A-Z]{16}/g },
    { rule: 'google-api-key', kind: 'google-api-key', regex: /AIza[0-9A-Za-z_-]{35}/g },
    { rule: 'github-pat', kind: 'github-pat', regex: /ghp_[0-9A-Za-z]{36}/g },
    // Fine-grained PATs (github_pat_…) were a measured detector gap: the
    // 2026-07-28 adversarial corpus pass flagged them as missed positives.
    { rule: 'github-fine-grained-pat', kind: 'github-pat', regex: /github_pat_[0-9A-Za-z_]{22,}/g },
    {
        rule: 'jwt',
        kind: 'jwt',
        regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    },
    // Extensions.
    { rule: 'stripe-secret-key', kind: 'stripe-secret-key', regex: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g },
    { rule: 'slack-token', kind: 'slack-token', regex: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
    { rule: 'pem-private-key', kind: 'pem-private-key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
    {
        rule: 'db-connection-uri',
        kind: 'db-connection-uri',
        regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@/g,
    },
    {
        rule: 'generic-assignment',
        kind: 'generic-assignment',
        regex: /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/gi,
        valueGroup: 1,
    },
];

// ---------------------------------------------------------------------
// Suppression + placeholder detection.
// ---------------------------------------------------------------------

// A line carrying any comment-style `secret-allow` marker is fully muted.
const SECRET_ALLOW = /secret-allow/;

// A high-entropy token that looks like a placeholder is demoted to LOW.
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
    /x{4,}/i,
    /example/i,
    /changeme/i,
    /your[_-].*here/i,
    /<[^>]+>/,
    /\.\.\./,
    /^your[_-]/i,
    /placeholder/i,
];

// A base64 data URI (embedded image/font) — its payload is not a secret.
const DATA_URI = /data:[\w.+-]+\/[\w.+-]+;base64,/i;

// A UUID is a benign identifier, not a credential.
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Secret-context keywords that raise an otherwise-MEDIUM entropy hit to HIGH.
const KEYWORD_CONTEXT = /password|secret|token|api[_-]?key|credential/i;

// Candidate high-entropy tokens (base64 / hex alphabets). `/` is deliberately
// excluded — it appears in URL paths far more than in inline credentials, and
// including it turns every long path slug into a false positive.
const ENTROPY_TOKEN = /[A-Za-z0-9+=_-]{20,}/g;
const IS_HEX = /^[0-9a-fA-F]+$/;
// Common digest lengths (MD5 / SHA-1 / SHA-256 hex). A token of exactly one of
// these is a hash — a commit SHA, lockfile digest, condensation hash — not a
// credential. Never flag it, even with a keyword nearby.
const HASH_HEX_LENGTHS: ReadonlySet<number> = new Set([32, 40, 64]);

function isAllSameChar(value: string): boolean {
    return value.length > 0 && /^(.)\1*$/.test(value);
}

// Minimum length + entropy for a `generic-assignment` value to count as a real
// credential. A bare `secret: moderate` / `token: modelName` / `key: request()`
// is a keyword-shaped assignment of a low-entropy WORD — not a secret. Real
// credentials assigned this way are long and high-entropy. Without this gate the
// generic rule floods on prose, config, and test data (the FP class the council
// warned about — precision over allowlist growth).
const GENERIC_MIN_LENGTH = 16;
const GENERIC_MIN_ENTROPY = 3.3;
// Code-expression shapes: an assignment RHS that is a reference / call /
// interpolation, not a literal credential (`opts.apiKey`, `${API_KEY}`,
// `load()`, `process.env.X`, `$this->get()`). Never a real inline secret.
const CODE_EXPR = /[()$`{}<>[\];,]|->|=>|\.\w/;

function looksLikeSecretValue(value: string): boolean {
    if (value.length < GENERIC_MIN_LENGTH) {
        return false;
    }
    if (CODE_EXPR.test(value)) {
        return false;
    }
    // A real credential carries entropy AND is not a plain lowercase word —
    // it has a digit or mixed case.
    const hasDigit = /[0-9]/.test(value);
    const mixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
    if (!hasDigit && !mixedCase) {
        return false;
    }
    return shannonEntropy(value) >= GENERIC_MIN_ENTROPY;
}

function isPlaceholderValue(value: string, pathHint?: string): boolean {
    if (pathHint !== undefined) {
        if (
            pathHint.endsWith('.example') ||
            pathHint.endsWith('.sample') ||
            pathHint.includes('.env.example')
        ) {
            return true;
        }
    }
    if (isAllSameChar(value)) {
        return true;
    }
    return PLACEHOLDER_PATTERNS.some((p) => p.test(value));
}

/** first ≤4 + `…` + last ≤2; guaranteed never to contain the full value. */
function maskSecret(value: string): string {
    const front = value.slice(0, 4);
    const back = value.length > 6 ? value.slice(-2) : '';
    if (front.length + back.length >= value.length) {
        // Too short for a 4+2 window without revealing everything — hide more.
        return `${value.slice(0, 1)}…`;
    }
    return `${front}…${back}`;
}

function shannonEntropy(value: string): number {
    const freq = new Map<string, number>();
    for (const ch of value) {
        freq.set(ch, (freq.get(ch) ?? 0) + 1);
    }
    const n = value.length;
    let entropy = 0;
    for (const count of freq.values()) {
        const p = count / n;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

function overlaps(spans: ReadonlyArray<[number, number]>, start: number, end: number): boolean {
    return spans.some(([s, e]) => start < e && s < end);
}

/**
 * Scan `text` for secrets. Pure — no I/O, no network. Line and column are
 * 1-based; column points at the sensitive value, not the surrounding syntax.
 */
export function scanText(text: string, opts: ScanOptions = {}): SecretFinding[] {
    const pathHint = opts.path;
    const findings: SecretFinding[] = [];
    const lines = text.split(/\r\n|\r|\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string;
        const lineNo = i + 1;

        // A `secret-allow` marker mutes the whole line — no findings at all.
        if (SECRET_ALLOW.test(line)) {
            continue;
        }

        const covered: Array<[number, number]> = [];

        // Layer 1 — regex rule pack (HIGH, demoted to LOW for placeholders).
        for (const rule of RULES) {
            rule.regex.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = rule.regex.exec(line)) !== null) {
                const value = rule.valueGroup !== undefined ? m[rule.valueGroup] : m[0];
                if (value === undefined) {
                    if (m.index === rule.regex.lastIndex) {
                        rule.regex.lastIndex += 1;
                    }
                    continue;
                }
                // The keyword-anchored generic rule needs a value-likeness gate:
                // a low-entropy word after `secret:`/`token:` is not a credential.
                if (rule.rule === 'generic-assignment' && !looksLikeSecretValue(value)) {
                    if (m.index === rule.regex.lastIndex) {
                        rule.regex.lastIndex += 1;
                    }
                    continue;
                }
                const valueStart = m.index + m[0].indexOf(value);
                const confidence: SecretFinding['confidence'] = isPlaceholderValue(value, pathHint)
                    ? 'low'
                    : 'high';
                findings.push({
                    rule: rule.rule,
                    kind: rule.kind,
                    line: lineNo,
                    column: valueStart + 1,
                    masked: maskSecret(value),
                    confidence,
                });
                covered.push([valueStart, valueStart + value.length]);
                if (m.index === rule.regex.lastIndex) {
                    rule.regex.lastIndex += 1;
                }
            }
        }

        // Layer 2 + 3 — entropy, raised by keyword context. Skip data URIs.
        if (!DATA_URI.test(line)) {
            const hasKeyword = KEYWORD_CONTEXT.test(line);
            ENTROPY_TOKEN.lastIndex = 0;
            let tm: RegExpExecArray | null;
            while ((tm = ENTROPY_TOKEN.exec(line)) !== null) {
                const token = tm[0];
                const start = tm.index;
                const end = start + token.length;
                if (token.length < ENTROPY_MIN_TOKEN_LENGTH) {
                    continue;
                }
                if (overlaps(covered, start, end)) {
                    continue; // already reported by the regex pack
                }
                if (UUID.test(token)) {
                    continue; // benign identifier
                }
                if (/^sha(?:256|384|512)-/.test(token)) {
                    // SRI / npm-lockfile integrity digest (`sha512-<base64>`) —
                    // a hash, not a credential. Measured FP class on the
                    // 2026-07-28 adversarial corpus pass.
                    continue;
                }
                const entropy = shannonEntropy(token);
                const isHex = IS_HEX.test(token);
                if (isHex && HASH_HEX_LENGTHS.has(token.length)) {
                    continue; // MD5 / SHA-1 / SHA-256 digest — a hash, not a secret
                }
                let confidence: SecretFinding['confidence'] | null = null;
                if (isHex) {
                    // Pure hex is usually a SHA / UUID / lockfile hash — only a
                    // keyword nearby lifts it out of benign territory.
                    if (entropy >= HEX_ENTROPY_THRESHOLD && hasKeyword) {
                        confidence = 'high';
                    }
                } else if (entropy >= BASE64_ENTROPY_THRESHOLD) {
                    confidence = hasKeyword ? 'high' : 'medium';
                }
                if (confidence === null) {
                    continue;
                }
                if (isPlaceholderValue(token, pathHint)) {
                    confidence = 'low';
                }
                findings.push({
                    rule: 'entropy',
                    kind: 'high-entropy-string',
                    line: lineNo,
                    column: start + 1,
                    masked: maskSecret(token),
                    confidence,
                });
            }
        }
    }

    return findings;
}
