// The one rule table for values that must not leave for a model provider in
// plaintext (docs/contracts/egress-placeholders-v1.md). Every credential and
// identifier pattern is defined here and nowhere else; consumers decide policy
// (refuse, replace, report), this module only detects.
//
// Pure: no import, no I/O, no network. Every rule states why it is linear on a
// hostile input; the parity test pins what the move from secret_detector kept.

export type EgressClass = 'credential' | 'identifier';

export interface EgressRule {
    readonly rule: string;
    /** Placeholder type a replacement prints, e.g. `APIKEY`. */
    readonly type: string;
    readonly class: EgressClass;
    /** Finding kind reported by the commit-time scanner; defaults to `rule`. */
    readonly kind?: string;
    /** MUST carry the global flag. */
    readonly pattern: RegExp;
    /**
     * Which bytes a replacement must remove. `'detection'`: the detection span is
     * the whole secret. A `through` function returns the end of the secret for a
     * detection span, or null when that end cannot be proven; the replacer then
     * refuses the whole text rather than replace part of it.
     */
    readonly replacement: 'detection' | { readonly through: (text: string, span: SpanBounds) => number | null };
    /**
     * Capture group holding the value; the whole match when absent. A rule that
     * sets it MUST carry the d flag. A list names alternatives of one value
     * shape — the first group that participated in the match is the value — so
     * a shape whose delimiter decides its extent stays one row.
     */
    readonly valueGroup?: number | readonly number[];
    /** `group` is the capture group the value came from, so a delimiter can change the test. */
    readonly validator?: (value: string, group: number | 'whole-match') => boolean;
    /** The rule fires only when `words` matches within `window` chars of the value. */
    readonly context?: { readonly words: RegExp; readonly window: number };
    readonly exclusions?: readonly RegExp[];
    /**
     * Literal vendor prefixes that mark a raw key by construction. Surfaces that
     * act on shape alone (a config ref, a masked log value) read these instead of
     * spelling their own list.
     */
    readonly prefixes?: readonly string[];
    /**
     * The row matches only at a token start (its pattern opens with a lookbehind
     * for a key character). A shape-only surface reading the prefixes holds them
     * to a token start exactly when this is set; a test checks it against what the
     * row actually matches.
     */
    readonly tokenStart?: true;
}

export interface SpanBounds {
    readonly start: number;
    readonly end: number;
}

/** A detected value: offsets into the scanned text, never the value itself. */
export interface EgressSpan {
    readonly rule: string;
    readonly type: string;
    readonly class: EgressClass;
    readonly start: number;
    readonly end: number;
    readonly validated: boolean;
}

export function shannonEntropy(value: string): number {
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

// A keyword-shaped assignment of a low-entropy word (`secret: moderate`) or of a
// code expression (`opts.apiKey`, `${API_KEY}`, `load()`) is not a credential.
const GENERIC_MIN_LENGTH = 16;
const GENERIC_MIN_ENTROPY = 3.3;
const CODE_EXPR = /[()$`{}<>[\];,]|->|=>|\.\w/;

export function looksLikeSecretValue(value: string): boolean {
    if (value.length < GENERIC_MIN_LENGTH || CODE_EXPR.test(value)) {
        return false;
    }
    const hasDigit = /[0-9]/.test(value);
    const mixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
    if (!hasDigit && !mixedCase) {
        return false;
    }
    return shannonEntropy(value) >= GENERIC_MIN_ENTROPY;
}

/**
 * The keyword names a credential assignment is spelled with (`password =`,
 * `api_key:`). They carry no vendor literal, so each consumer reads the ones it
 * always read, in its own order, and keeps its own threshold for the value.
 */
export const ASSIGNMENT_KEYWORDS = {
    password: 'password',
    passwd: 'passwd',
    pwd: 'pwd',
    secret: 'secret',
    apiKey: 'api[_-]?key',
    apikey: 'apikey',
    accessToken: 'access[_-]?token',
    authToken: 'auth[_-]?token',
    clientSecret: 'client[_-]?secret',
    privateKey: 'private[_-]?key',
    token: 'token',
    bearer: 'bearer',
} as const;

export type AssignmentKeyword = keyof typeof ASSIGNMENT_KEYWORDS;

export interface AssignmentShape {
    readonly keywords: readonly AssignmentKeyword[];
    /** Spelled around the keyword group, e.g. `\b` or a Unicode non-word lookaround. */
    readonly before?: string;
    readonly after?: string;
    /** The keyword group captures instead of `(?:…)`. */
    readonly capture?: boolean;
    /** What follows `\s*[:=]\s*`; absent, the shape ends at the operator. */
    readonly value?: string;
    /** The whitespace around the operator; `\s*` when absent, `[ \t]*` to stay on one line. */
    readonly gap?: string;
}

/** Source of a keyword-assignment shape: keyword group, operator, then the consumer's value. */
export function assignmentSource(shape: AssignmentShape): string {
    const alt = shape.keywords.map((k) => ASSIGNMENT_KEYWORDS[k]).join('|');
    const group = shape.capture === true ? `(${alt})` : `(?:${alt})`;
    const gap = shape.gap ?? '\\s*';
    const head = `${shape.before ?? ''}${group}${shape.after ?? ''}${gap}[:=]`;
    return shape.value === undefined ? head : `${head}${gap}${shape.value}`;
}

export function assignmentPattern(shape: AssignmentShape, flags: string): RegExp {
    return new RegExp(assignmentSource(shape), flags);
}

/** An HTTP `Authorization` header name; everything after its colon is the credential. */
export const AUTHORIZATION_HEADER = 'authorization';

/**
 * Raw-key prefix families spelled as a class, for a surface that keeps the
 * prefix and drops the value: group 1 is the prefix stem. Wider than the rows on
 * purpose (`pk-`, `rk-`); a test checks each family still covers the table
 * prefixes it claims.
 */
export const CLASS_SPELLED_PREFIXES = {
    dashKeys: { family: '(sk|pk|rk)-', covers: ['sk-'] },
    tokens: {
        family: '(gh[pousr]|github_pat|xox[baprs])[-_]',
        covers: ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_', 'xoxb-', 'xoxp-', 'xoxa-', 'xoxr-', 'xoxs-'],
    },
} as const satisfies Readonly<Record<string, { readonly family: string; readonly covers: readonly string[] }>>;

// The nearest key marker after the header decides: an END carrying the same
// label as the header ends the block; another BEGIN, an END with a different
// label, or no marker at all means the extent is unproven. One sticky scan from
// the header to the nearest marker keeps this linear even over many headers.
const KEY_MARKER = /-----(BEGIN|END) ([A-Z ]*)PRIVATE KEY-----/g;
const BEGIN_LABEL = /^-----BEGIN ([A-Z ]*)PRIVATE KEY-----/;

export function pemBlockEnd(text: string, span: SpanBounds): number | null {
    const label = BEGIN_LABEL.exec(text.slice(span.start, span.end))?.[1];
    if (label === undefined) return null;
    KEY_MARKER.lastIndex = span.end;
    const m = KEY_MARKER.exec(text);
    if (m === null || m[1] !== 'END' || m[2] !== label) return null;
    return m.index + m[0].length;
}

/**
 * End of the first key-end marker of any label after the header, or null. For a
 * masking surface that cannot refuse: when the block's extent is unproven it
 * masks too much rather than leaving the key body behind.
 */
export function pemMaskEnd(text: string, span: SpanBounds): number | null {
    KEY_MARKER.lastIndex = span.end;
    for (let m = KEY_MARKER.exec(text); m !== null; m = KEY_MARKER.exec(text)) {
        if (m[1] === 'END') return m.index + m[0].length;
    }
    return null;
}

// Identifier validators. A shape alone is never enough to replace an identifier:
// each row carries a checksum, a context word, or both, because a false positive
// here damages ordinary code and review text.

// IBAN length per country (ISO 13616 registry), packed as `CCnn` pairs.
const IBAN_LENGTHS =
    'AD24AE23AL28AT20AZ28BA20BE16BG22BH22BR29BY28CH21CR22CY28CZ24DE22DK18DO28EE20EG29ES24FI18FO18FR27GB22GE22GI23GL18GR27GT28HR21HU28IE22IL23IQ23IS26IT27JO30KW30KZ20LB28LC32LI21LT20LU20LV21MC27MD24ME22MK19MR27MT31MU30NL18NO15PK24PL28PS29PT25QA29RO24RS22SA24SC31SE24SI19SK24SM27ST25SV28TL23TN24TR26UA29VA22VG24XK20';

export function isValidIban(value: string): boolean {
    const iban = value.replace(/ /g, '').toUpperCase();
    const at = IBAN_LENGTHS.indexOf(iban.slice(0, 2));
    if (at === -1 || at % 4 !== 0 || Number(IBAN_LENGTHS.slice(at + 2, at + 4)) !== iban.length) return false;
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;
    let rest = 0;
    for (const ch of iban.slice(4) + iban.slice(0, 4)) {
        const n = ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 55;
        rest = n > 9 ? (rest * 100 + n) % 97 : (rest * 10 + n) % 97;
    }
    return rest === 1;
}

export function passesLuhn(value: string): boolean {
    const digits = value.replace(/[ -]/g, '');
    if (!/^[0-9]{13,19}$/.test(digits) || /^(.)\1+$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < digits.length; i += 1) {
        let d = digits.charCodeAt(digits.length - 1 - i) - 48;
        if (i % 2 === 1) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
    }
    return sum % 10 === 0;
}

/** E.164 bounds: a country code plus at most 15 digits in all; never a date after a diff marker. */
function phoneDigits(min: number, max: number): (value: string) => boolean {
    return (value) => {
        if (/^\+?[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(value)) return false;
        const n = value.replace(/[^0-9]/g, '').length;
        return n >= min && n <= max;
    };
}

/**
 * German tax identification number: 11 digits, no leading zero, one digit of
 * the first ten repeated two or three times and no other repeated, and an
 * ISO 7064 MOD 11,10 check digit.
 */
export function isValidGermanTaxId(value: string): boolean {
    const d = value.replace(/ /g, '');
    if (!/^[1-9][0-9]{10}$/.test(d)) return false;
    const counts = new Map<string, number>();
    for (const ch of d.slice(0, 10)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    const repeated = [...counts.values()].filter((c) => c > 1);
    if (repeated.length !== 1 || (repeated[0] as number) > 3) return false;
    let product = 10;
    for (let i = 0; i < 10; i += 1) {
        let sum = (d.charCodeAt(i) - 48 + product) % 10;
        if (sum === 0) sum = 10;
        product = (sum * 2) % 11;
    }
    const check = (11 - product) % 10;
    return check === d.charCodeAt(10) - 48;
}

/** US social security number: no 000, 666 or 9xx area, no 00 group, no 0000 serial. */
export function isValidUsSsn(value: string): boolean {
    const m = /^([0-9]{3})-([0-9]{2})-([0-9]{4})$/.exec(value);
    if (m === null) return false;
    const [area, group, serial] = [m[1] as string, m[2] as string, m[3] as string];
    return area !== '000' && area !== '666' && !area.startsWith('9') && group !== '00' && serial !== '0000';
}

// Addresses that name no one: documentation and reserved domains (RFC 2606,
// RFC 6761), no-reply senders, and image-density file names (`logo@2x.png`).
const EMAIL_EXCLUSIONS: readonly RegExp[] = [
    /^git@/i,
    /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|example|test|invalid|localhost|local)$/i,
    /^(?:no-?reply|do-?not-?reply|noreply\+[^@]*)@/i,
    /@users\.noreply\.github\.com$/i,
    /@[0-9]x\.[a-z]+$/i,
    /\.(?:png|jpe?g|gif|svg|webp|ico|js|mjs|cjs|ts|tsx|css|json|ya?ml|lock)$/i,
];

/**
 * The repository's own published identities (package author, copyright holder),
 * held as keyed 64-bit FNV-1a digests of the lower-cased address so the list
 * reads as noise. A digest hides an address from a reader, not from someone who
 * guesses it; the list exists to keep the tree's own metadata out of a review's
 * placeholder count.
 */
const EMAIL_ALLOWLIST_DIGESTS: ReadonlySet<string> = new Set(['924acfa874365f8a', '8066a43fc18158bf']);

export function emailAllowlistDigest(address: string): string {
    let h = 0xcbf29ce484222325n;
    for (const ch of `egress-email-allowlist-v1\u0000${address.toLowerCase()}`) {
        h ^= BigInt(ch.codePointAt(0) as number);
        h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h.toString(16).padStart(16, '0');
}

function isReportableEmail(value: string): boolean {
    return !EMAIL_ALLOWLIST_DIGESTS.has(emailAllowlistDigest(value));
}

// Quantifiers are unbounded where the pattern is linear without a bound, so a
// long value is matched whole and no suffix survives a replacement. Each rule's
// argument for why it is linear lives in `egress_rules_linearity.ts`, kept out
// of this module because no runtime path reads it; a test refuses a row without
// one. A bound remains only where the unbounded form was quadratic, and what
// that bound loses is published in DETECTION_CEILINGS.
export const EGRESS_RULES: readonly EgressRule[] = [
    {
        rule: 'anthropic-api-key',
        type: 'APIKEY',
        prefixes: ['sk-ant-'],
        class: 'credential',
        replacement: 'detection',
        kind: 'anthropic-api-key',
        pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g,
    },
    {
        rule: 'anthropic-project-key',
        type: 'APIKEY',
        prefixes: ['sk-proj-'],
        class: 'credential',
        replacement: 'detection',
        kind: 'anthropic-api-key',
        pattern: /sk-proj-[A-Za-z0-9_-]{20,}/g,
    },
    {
        rule: 'aws-access-key',
        type: 'APIKEY',
        prefixes: ['AKIA'],
        class: 'credential',
        replacement: 'detection',
        pattern: /AKIA[0-9A-Z]{16}/g,
    },
    {
        rule: 'google-api-key',
        type: 'APIKEY',
        prefixes: ['AIza'],
        class: 'credential',
        replacement: 'detection',
        pattern: /AIza[0-9A-Za-z_-]{35}/g,
    },
    {
        rule: 'github-pat',
        type: 'TOKEN',
        prefixes: ['ghp_'],
        class: 'credential',
        replacement: 'detection',
        pattern: /ghp_[0-9A-Za-z]{36}/g,
    },
    {
        rule: 'github-fine-grained-pat',
        type: 'TOKEN',
        prefixes: ['github_pat_'],
        class: 'credential',
        replacement: 'detection',
        kind: 'github-pat',
        pattern: /github_pat_[0-9A-Za-z_]{22,}/g,
    },
    {
        rule: 'openai-api-key',
        type: 'APIKEY',
        prefixes: ['sk-'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{20,}/g,
    },
    {
        rule: 'google-oauth-token',
        type: 'TOKEN',
        prefixes: ['ya29.'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])ya29\.[0-9A-Za-z_-]{20,}/g,
    },
    {
        rule: 'github-app-token',
        type: 'TOKEN',
        prefixes: ['gho_', 'ghu_', 'ghs_', 'ghr_'],
        class: 'credential',
        replacement: 'detection',
        pattern: /gh[ousr]_[A-Za-z0-9]{36,}/g,
    },
    {
        rule: 'xai-api-key',
        type: 'APIKEY',
        prefixes: ['xai-'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])xai-[A-Za-z0-9]{20,}/g,
    },
    {
        rule: 'perplexity-api-key',
        type: 'APIKEY',
        prefixes: ['pplx-'],
        class: 'credential',
        replacement: 'detection',
        pattern: /pplx-[A-Za-z0-9]{20,}/g,
    },
    {
        rule: 'groq-api-key',
        type: 'APIKEY',
        prefixes: ['gsk_'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])gsk_[A-Za-z0-9]{20,}/g,
    },
    {
        rule: 'huggingface-token',
        type: 'TOKEN',
        prefixes: ['hf_'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])hf_[A-Za-z0-9]{30,}/g,
    },
    {
        rule: 'nvidia-api-key',
        type: 'APIKEY',
        prefixes: ['nvapi-'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])nvapi-[A-Za-z0-9_-]{40,}/g,
    },
    {
        rule: 'replicate-api-token',
        type: 'TOKEN',
        prefixes: ['r8_'],
        class: 'credential',
        replacement: 'detection',
        tokenStart: true,
        pattern: /(?<![A-Za-z0-9])r8_[A-Za-z0-9]{30,}/g,
    },
    {
        rule: 'jwt',
        type: 'TOKEN',
        class: 'credential',
        replacement: 'detection',
        pattern:
            /(?<![A-Za-z0-9_-])(?=((?:(?!eyJ)[A-Za-z0-9_-])*))\1(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/dg,
        valueGroup: 2,
    },
    {
        rule: 'stripe-secret-key',
        type: 'APIKEY',
        prefixes: ['sk_live_', 'sk_test_'],
        class: 'credential',
        replacement: 'detection',
        pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g,
    },
    {
        rule: 'slack-token',
        type: 'TOKEN',
        prefixes: ['xoxb-', 'xoxp-', 'xoxa-', 'xoxr-', 'xoxs-'],
        class: 'credential',
        replacement: 'detection',
        pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g,
    },
    {
        rule: 'pem-private-key',
        type: 'PRIVATEKEY',
        class: 'credential',

        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
        replacement: { through: pemBlockEnd },
    },
    {
        rule: 'db-connection-uri',
        type: 'DBURI',
        class: 'credential',
        replacement: 'detection',
        pattern: /(?<![a-z0-9+.-])(?=((?:(?!\b[a-z])[a-z0-9+.-])*))\1(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@)/dg,
        valueGroup: 2,
    },
    {
        rule: 'generic-assignment',
        type: 'SECRET',
        class: 'credential',
        replacement: 'detection',
        pattern: assignmentPattern(
            {
                keywords: ['password', 'passwd', 'pwd', 'secret', 'apiKey', 'accessToken', 'authToken'],
                value: `['"]?([^'"\\s]{8,})['"]?`,
            },
            'dgi',
        ),
        valueGroup: 1,
        validator: looksLikeSecretValue,
    },
    {
        rule: 'iban',
        type: 'IBAN',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![A-Za-z0-9])[A-Z]{2}[0-9]{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g,
        validator: isValidIban,
    },
    {
        rule: 'payment-card',
        type: 'CARD',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])/g,
        validator: passesLuhn,
        context: {
            words: /\b(?:card|credit|debit|visa|mastercard|amex|maestro|kreditkarte|karte|kartennummer|payment|zahlung)\b/i,
            window: 48,
        },
    },
    {
        rule: 'email',
        type: 'EMAIL',
        class: 'identifier',
        replacement: 'detection',
        pattern:
            /(?<![A-Za-z0-9._%+\\-])[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.){1,8}[A-Za-z]{2,24}(?![A-Za-z0-9-])/g,
        exclusions: EMAIL_EXCLUSIONS,
        validator: isReportableEmail,
    },
    {
        rule: 'phone-international',
        type: 'PHONE',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![A-Za-z0-9+])\+[1-9][0-9]{0,2}(?:[ ./-]?(?:\([0-9]{1,6}\)|(?=([0-9]{1,6}))\1)){1,5}(?![0-9])/g,
        validator: phoneDigits(8, 15),
    },
    {
        rule: 'phone-national',
        type: 'PHONE',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![A-Za-z0-9+(])(?:\(0[1-9][0-9]{1,4}\)|0[1-9][0-9]{1,4})(?:[ ./-]?(?=([0-9]{2,8}))\1){1,3}(?![0-9])/g,
        validator: phoneDigits(7, 13),
        context: { words: /\b(?:tel|telefon|telephone|phone|mobil|mobile|cell|fax|handy|call|ruf)\b/i, window: 32 },
    },
    {
        rule: 'phone-nanp',
        type: 'PHONE',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![A-Za-z0-9+(-])(?:\+?1[ .-]?)?(?:\([2-9][0-9]{2}\) ?|[2-9][0-9]{2}[ .-]?)[2-9][0-9]{2}[ .-]?[0-9]{4}(?![0-9-])/g,
        context: { words: /\b(?:tel|telephone|phone|mobile|cell|fax|call)\b/i, window: 32 },
    },
    {
        rule: 'de-tax-id',
        type: 'TAXID',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![0-9])[1-9](?: ?[0-9]){10}(?![0-9])/g,
        validator: isValidGermanTaxId,
        context: {
            words: /\b(?:steuer-?id|steuer-?identifikationsnummer|identifikationsnummer|idnr|tax[ -]?id|tin)\b/i,
            window: 48,
        },
    },
    {
        rule: 'us-ssn',
        type: 'SSN',
        class: 'identifier',
        replacement: 'detection',
        pattern: /(?<![0-9-])[0-9]{3}-[0-9]{2}-[0-9]{4}(?![0-9-])/g,
        validator: isValidUsSsn,
    },
];

// A value that is a type word, a literal, a language keyword or a credential
// keyword itself (`password: 'password'`) is code, not a secret, whatever its key.
const TYPE_WORD =
    /^(?:string|number|boolean|bigint|unknown|any|never|void|undefined|null|true|false|none|nil|new|typeof|keyof|await|async|function|const|let|var|return|this|self|class|import|require|readonly|export|default|yield|password|passwd|pwd|secret|token|bearer|api[_-]?key|apikey)$/i;

/**
 * A credential keyword is a key, not a suffix: `mytoken=` and `notsecret=` are
 * other words that happen to end in one. A separator is not a letter, so
 * `client_secret` and `api-key` still read as the keyword they contain.
 */
const KEY_START = '(?<![A-Za-z0-9])';

/**
 * One value, whichever delimiter bounds it, as four alternatives read in order
 * by `valueGroup: [2, 3, 4, 5]`. The shape it replaces — an optional quote
 * around a capture that forbade whitespace — matched `"correct` of
 * `password = "correct horse battery staple"` and left the rest of the
 * credential in the outbound body (council, 2026-10-21, both seats).
 *
 * A complete quoted value is captured without its quotes, so the validator
 * still reads `password: 'password'` as the type word it is. An UNTERMINATED
 * quote takes the rest of the line: its extent is unprovable, and the house
 * rule for an unprovable extent is to cover too much rather than leave the
 * value behind (`pemMaskEnd`). Each alternative is anchored at the same
 * position and none can backtrack into another, so the shape stays linear.
 */
const QUOTED_OR_BARE_VALUE = `(?:"([^"\\n]*)"|'([^'\\n]*)'|["']([^\\n]+)|([^\\s'"]+))`;

/**
 * Credential shapes at a reviewer's threshold, for a surface that REPLACES a
 * value it would otherwise have masked with its whole line (the council
 * bundle, step 3.3). Not in EGRESS_RULES: a refusing surface or the commit
 * scanner would refuse ordinary code on them. Any value after a credential
 * keyword that is not a code expression or a type word, on the same line, and
 * every byte after the colon of a line that opens with an `Authorization`
 * header.
 *
 * The header row being HERE and not in EGRESS_RULES is a stated gap of the
 * main table: an `Authorization: Bearer <opaque token>` with no vendor prefix
 * and no JWT shape passes the replacing and refusing surfaces unchanged, and
 * so does any value under the `token`, `bearer`, `clientSecret` or
 * `privateKey` keywords, which no EGRESS_RULES row reads.
 */
export const REVIEW_CREDENTIAL_ROWS: readonly EgressRule[] = [
    {
        rule: 'review-assignment',
        type: 'SECRET',
        class: 'credential',
        replacement: 'detection',
        pattern: assignmentPattern(
            {
                keywords: ['apiKey', 'secret', 'token', 'password'],
                before: KEY_START,
                capture: true,
                gap: '[ \\t]*',
                value: QUOTED_OR_BARE_VALUE,
            },
            'dgi',
        ),
        valueGroup: [2, 3, 4, 5],
        // Group 5 is the bare value. A quoted one is a literal, where `,` `$`
        // or `.` is password punctuation rather than code, so only a bare value
        // is read as a code expression.
        validator: (v, g) => (g !== 5 || !CODE_EXPR.test(v)) && !TYPE_WORD.test(v),
    },
    {
        rule: 'review-authorization-header',
        type: 'TOKEN',
        class: 'credential',
        replacement: 'detection',
        pattern: new RegExp(`^[ \\t]*${AUTHORIZATION_HEADER}:[ \\t]*(\\S[^\\n]*)`, 'dgim'),
        valueGroup: 1,
    },
];

/** The credential rows alone, for consumers whose verdict reads credentials only. */
export const CREDENTIAL_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'credential');
export const IDENTIFIER_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'identifier');

/** Every raw-key prefix the table declares, longest first. */
export const CREDENTIAL_PREFIXES: readonly string[] = EGRESS_RULES.flatMap((r) => r.prefixes ?? []).sort(
    (a, b) => b.length - a.length,
);

/** The prefixes one row declares; throws on an unknown rule so a rename cannot go silent. */
export function prefixesOf(rule: string): readonly string[] {
    const row = EGRESS_RULES.find((r) => r.rule === rule);
    if (row === undefined) throw new Error(`egress rule ${rule}: no such row`);
    return row.prefixes ?? [];
}

/** A row's first declared prefix — the shape a key file of that vendor starts with. */
export function vendorPrefix(rule: string): string {
    const first = prefixesOf(rule)[0];
    if (first === undefined) throw new Error(`egress rule ${rule}: declares no prefix`);
    return first;
}

const TOKEN_START_PREFIXES: ReadonlySet<string> = new Set(
    EGRESS_RULES.filter((r) => r.tokenStart === true).flatMap((r) => r.prefixes ?? []),
);

/**
 * A raw-key prefix followed by at least `minTail` key characters. Coarser than
 * the rows on purpose: it is for surfaces that refuse or mask on shape alone,
 * where a short or truncated key must still be caught.
 *
 * `boundary: 'row'` (the default) holds a prefix to a token start exactly where
 * its own row declares `tokenStart`, so the pattern never misses what the row
 * would catch and a short prefix (`sk-`) does not fire inside a word.
 * `boundary: 'never'` drops the token start for every prefix: it is for a
 * consumer whose own pre-table reading matched mid-word, and dropping it there
 * is what keeps that consumer from narrowing. `tail` narrows the key class.
 */
export function rawKeyPrefixPattern(
    minTail: number,
    prefixes: readonly string[] = CREDENTIAL_PREFIXES,
    opts: { readonly boundary?: 'row' | 'never'; readonly tail?: string } = {},
): RegExp {
    const alt = [...prefixes]
        .sort((a, b) => b.length - a.length)
        .map((p) => {
            const lit = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return opts.boundary !== 'never' && TOKEN_START_PREFIXES.has(p) ? `(?<![A-Za-z0-9])${lit}` : lit;
        })
        .join('|');
    return new RegExp(`(?:${alt})[${opts.tail ?? 'A-Za-z0-9_-'}]{${minTail},}`, 'g');
}

/**
 * End of the bytes a replacement of `span` must remove, or null when the row
 * cannot prove it (the caller then decides: a refusing surface refuses, a
 * masking surface masks the detection span).
 */
export function replacementEnd(text: string, span: EgressSpan): number | null {
    const row = EGRESS_RULES.find((r) => r.rule === span.rule);
    if (row === undefined) return null;
    if (row.replacement === 'detection') return span.end;
    const end = row.replacement.through(text, span);
    return end === null || end < span.end ? null : end;
}

/**
 * End of the bytes a MASKING surface removes for `span`. A surface that cannot
 * refuse must not leave key material behind when the row cannot prove the extent:
 * an unproven key block is masked through the nearest END marker of any label,
 * and only a span with nothing better falls back to its detection span. Every
 * masking consumer reads this, so the fallback is decided once.
 */
export function maskingEnd(text: string, span: EgressSpan): number {
    return replacementEnd(text, span) ?? (span.rule === 'pem-private-key' ? pemMaskEnd(text, span) : null) ?? span.end;
}

/**
 * Returns a description of the first unbounded quantifier (`+`, `*`, `{n,}`)
 * outside a character class, or null. Escapes and classes are skipped.
 */
export function findUnboundedQuantifier(pattern: RegExp): string | null {
    const src = pattern.source;
    let inClass = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (ch === '\\') {
            i++;
            continue;
        }
        if (inClass) {
            if (ch === ']') inClass = false;
            continue;
        }
        if (ch === '[') {
            inClass = true;
            continue;
        }
        if (ch === '+' || ch === '*') {
            return `'${ch}' at ${i}`;
        }
        if (ch === '{') {
            const m = /^\{\d+,\}/.exec(src.slice(i));
            if (m) return `'${m[0]}' at ${i}`;
        }
    }
    return null;
}

const CLASS_RANK: Readonly<Record<EgressClass, number>> = {
    credential: 1,
    identifier: 0,
};

/** A global or sticky regex keeps lastIndex between calls; reset it so every call tests the whole value. */
function testWholeValue(re: RegExp, value: string): boolean {
    re.lastIndex = 0;
    return re.test(value);
}

/**
 * Applies every field of a row to one regex match: value extraction from the
 * engine's capture offsets, exclusions, the context window and the validator.
 * The single place both readers of the table evaluate a candidate.
 */
/**
 * The capture group this match put the value in. `'whole-match'` is a rule that
 * declares none. `null` is a rule that declares alternatives and matched none
 * of them — the match is then discarded, never silently read as the whole
 * match, which would hand a replacer the keyword along with the value.
 */
function valueGroupOf(r: EgressRule, m: RegExpExecArray): number | 'whole-match' | null {
    if (r.valueGroup === undefined) return 'whole-match';
    if (typeof r.valueGroup === 'number') return r.valueGroup;
    return r.valueGroup.find((g) => m[g] !== undefined) ?? null;
}

export function evaluateMatch(
    r: EgressRule,
    text: string,
    m: RegExpExecArray,
): { start: number; end: number; validated: boolean } | null {
    const group = valueGroupOf(r, m);
    if (group === null) return null;
    const value = group === 'whole-match' ? m[0] : m[group];
    if (value === undefined || value.length === 0) return null;
    const start = group === 'whole-match' ? m.index : (m.indices?.[group]?.[0] ?? -1);
    if (start < 0) {
        throw new Error(`egress rule ${r.rule}: a valueGroup rule needs the d flag for capture offsets`);
    }
    const end = start + value.length;
    if (r.exclusions?.some((x) => testWholeValue(x, value))) return null;
    if (r.context) {
        const lo = Math.max(0, start - r.context.window);
        const hi = Math.min(text.length, end + r.context.window);
        const around = text.slice(lo, start) + ' ' + text.slice(end, hi);
        r.context.words.lastIndex = 0;
        if (!r.context.words.test(around)) return null;
    }
    if (r.validator) {
        return r.validator(value, group) ? { start, end, validated: true } : null;
    }
    return { start, end, validated: false };
}

/** Candidate spans per rule, before overlap resolution. */
export function findSpans(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    const out: EgressSpan[] = [];
    for (const r of rules) {
        r.pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = r.pattern.exec(text)) !== null) {
            if (m[0].length === 0) {
                r.pattern.lastIndex += 1;
                continue;
            }
            const c = evaluateMatch(r, text, m);
            if (c === null) continue;
            const { start, end, validated } = c;
            out.push({
                rule: r.rule,
                type: r.type,
                class: r.class,
                start,
                end,
                validated,
            });
        }
    }
    return out;
}

/**
 * Resolves overlaps: the more sensitive class wins, then the validated span,
 * then the longer one, then the earlier one. Result is ordered by start.
 */
export function resolveOverlaps(spans: readonly EgressSpan[]): EgressSpan[] {
    const ranked = [...spans].sort(
        (a, b) =>
            CLASS_RANK[b.class] - CLASS_RANK[a.class] ||
            Number(b.validated) - Number(a.validated) ||
            b.end - b.start - (a.end - a.start) ||
            a.start - b.start,
    );
    const kept: EgressSpan[] = [];
    for (const s of ranked) {
        if (!kept.some((k) => s.start < k.end && k.start < s.end)) kept.push(s);
    }
    return kept.sort((a, b) => a.start - b.start);
}

export function detect(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
    return resolveOverlaps(findSpans(text, rules));
}

/**
 * Replaces non-overlapping spans right to left, so every offset still refers
 * to the original text. `index` is the span's position in start order.
 */
export function replaceSpans(
    text: string,
    spans: readonly EgressSpan[],
    replacement: (span: EgressSpan, index: number) => string,
): string {
    const ordered = [...spans].sort((a, b) => a.start - b.start);
    for (let i = 1; i < ordered.length; i++) {
        if ((ordered[i] as EgressSpan).start < (ordered[i - 1] as EgressSpan).end) {
            throw new Error('replaceSpans: spans overlap; resolve them first');
        }
    }
    let out = text;
    for (let i = ordered.length - 1; i >= 0; i--) {
        const s = ordered[i] as EgressSpan;
        out = out.slice(0, s.start) + replacement(s, i) + out.slice(s.end);
    }
    return out;
}

/** A case the pre-move rule pack detected and this table deliberately does not. */
export interface DetectionCeiling {
    readonly rule: string;
    readonly ceiling: string;
    /** Case ids in egress_rules_parity.test.ts that demonstrate the loss. */
    readonly cases: readonly string[];
}

export const DETECTION_CEILINGS: readonly DetectionCeiling[] = [];
