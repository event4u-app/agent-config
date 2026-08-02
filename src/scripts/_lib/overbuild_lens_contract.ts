/**
 * Output-contract parser + scorer for `overbuild-review-lens`.
 *
 * The lens's own SKILL.md states an output contract. This is the half of that
 * contract a machine can check: tag grammar, the mandatory Chesterton's-Fence
 * line on every `delete:` finding, the honest-null form, and the sign of the
 * net-lines figure. Whether a live model *finds the plant* in a fixture is not
 * checkable here — that needs a scored eval run — and the split is stated in
 * `tests/fixtures/overbuild-lens/README.md` rather than blurred.
 *
 * Deliberately dependency-free and side-effect-free: parse a string, return a
 * verdict. Nothing reads the filesystem or the network.
 */

/** The six tags the lens may emit. Anything else is a contract violation. */
export const LENS_TAGS = ['delete', 'stdlib', 'native', 'yagni', 'shrink', 'flatten'] as const;
export type LensTag = (typeof LENS_TAGS)[number];

export const LENS_VERDICTS = ['lean', 'trim', 'overbuilt'] as const;
export type LensVerdict = (typeof LENS_VERDICTS)[number];

export interface LensFinding {
    tag: LensTag;
    location: string;
    text: string;
    /** Present only on `delete:` findings; the contract requires it there. */
    fence?: { why: string; safe: string; covered: string };
}

export interface ParsedLensOutput {
    verdict: LensVerdict | null;
    findings: LensFinding[];
    isNull: boolean;
    netLines: number | null;
    /** Contract violations found while parsing. Empty means the shape is legal. */
    errors: string[];
}

const _TAG_RE = new RegExp(
    String.raw`^\s*\d+\.\s+(` + LENS_TAGS.join('|') + String.raw`):\s+(\S+)\s+(.*\S)\s*$`,
);
const _FENCE_RE =
    /^\s*Fence:\s*why=(.+?)\s+safe=(.+?)\s+covered=(yes|no|partial)\s*$/;
const _VERDICT_RE = /^\s*Verdict:\s*(\S+)\s*$/;
const _NET_RE = /^\s*Net:\s*([+-]?\d+)\s+lines?\s*$/;
const _NULL_RE = /^\s*Findings:\s*none\b/;
const _COVERED_VALUES = new Set(['yes', 'no', 'partial']);

/**
 * Parse a lens verdict block. Never throws — a malformed block comes back with
 * a populated `errors` array, because a parser that throws on bad input cannot
 * report *how many* ways the input was bad.
 */
export function parseLensOutput(raw: string): ParsedLensOutput {
    const lines = raw.split('\n');
    const errors: string[] = [];
    const findings: LensFinding[] = [];
    let verdict: LensVerdict | null = null;
    let netLines: number | null = null;
    let isNull = false;

    for (let i = 0; i < lines.length; i += 1) {
        const line: string = lines[i] ?? '';

        const v = line.match(_VERDICT_RE);
        if (v) {
            if ((LENS_VERDICTS as readonly string[]).includes(v[1] ?? '')) {
                verdict = v[1] as LensVerdict;
            } else {
                errors.push(`unknown verdict \`${v[1]}\` (allowed: ${LENS_VERDICTS.join('/')})`);
            }
            continue;
        }

        const n = line.match(_NET_RE);
        if (n) {
            netLines = Number.parseInt(n[1] ?? '0', 10);
            continue;
        }

        if (_NULL_RE.test(line)) {
            isNull = true;
            continue;
        }

        const m = line.match(_TAG_RE);
        if (!m) {
            // An unrecognised numbered line is a finding the grammar rejects.
            if (/^\s*\d+\.\s+\S+:/.test(line)) {
                errors.push(`line ${i + 1}: not a legal tag — \`${line.trim()}\``);
            }
            continue;
        }

        const finding: LensFinding = {
            tag: m[1] as LensTag,
            location: m[2] ?? '',
            text: m[3] ?? '',
        };

        if (finding.tag === 'delete') {
            const fenceLine: string = lines[i + 1] ?? '';
            const f = fenceLine.match(_FENCE_RE);
            if (!f) {
                errors.push(
                    `line ${i + 1}: \`delete:\` finding at ${finding.location} has no valid ` +
                        'Fence line (why= / safe= / covered=yes|no|partial)',
                );
            } else {
                const covered = f[3] ?? '';
                finding.fence = {
                    why: (f[1] ?? '').trim(),
                    safe: (f[2] ?? '').trim(),
                    covered,
                };
                if (!_COVERED_VALUES.has(covered)) {
                    errors.push(`line ${i + 2}: covered= must be yes|no|partial`);
                }
            }
        }

        findings.push(finding);
    }

    if (verdict === null) errors.push('no `Verdict:` line');
    if (netLines === null) errors.push('no `Net: <n> lines` line');
    if (isNull && findings.length > 0) {
        errors.push('emitted the null AND findings — pick one');
    }
    if (!isNull && findings.length === 0) {
        errors.push('no findings and no null block — the null is mandatory, not optional');
    }
    if (verdict === 'lean' && findings.length > 0) {
        errors.push('`lean` verdict with findings — a lean diff has nothing to cut');
    }
    if (verdict !== 'lean' && isNull) {
        errors.push('null block with a non-`lean` verdict');
    }

    return { verdict, findings, isNull, netLines, errors };
}

export interface ExpectedLabels {
    verdict: string;
    must_tags: string[];
    forbidden_tags: string[];
    must_be_null: boolean;
    net_sign: 'negative' | 'zero' | 'positive';
    requires_fence?: boolean;
}

/**
 * Score a parsed output against a fixture's expected labels. Returns the list
 * of failures — empty means the output is correct for that fixture.
 */
export function scoreAgainstExpected(
    parsed: ParsedLensOutput,
    expected: ExpectedLabels,
): string[] {
    const failures = [...parsed.errors];

    if (parsed.verdict !== expected.verdict) {
        failures.push(`verdict ${parsed.verdict} ≠ expected ${expected.verdict}`);
    }
    if (parsed.isNull !== expected.must_be_null) {
        failures.push(
            expected.must_be_null
                ? 'expected the honest null, got findings (invented a finding on a lean diff)'
                : 'expected findings, got the null (missed the plant)',
        );
    }

    const seen = new Set(parsed.findings.map((f) => f.tag));
    for (const tag of expected.must_tags) {
        if (!seen.has(tag as LensTag)) failures.push(`missing required tag \`${tag}:\``);
    }
    for (const tag of expected.forbidden_tags) {
        if (seen.has(tag as LensTag)) failures.push(`emitted forbidden tag \`${tag}:\``);
    }

    if (expected.requires_fence) {
        const unfenced = parsed.findings.filter((f) => f.tag === 'delete' && !f.fence);
        if (unfenced.length > 0) failures.push('a `delete:` finding is missing its fence');
    }

    const sign =
        parsed.netLines === null ? 'unknown'
        : parsed.netLines < 0 ? 'negative'
        : parsed.netLines > 0 ? 'positive'
        : 'zero';
    if (sign !== expected.net_sign) {
        failures.push(`net-lines sign ${sign} ≠ expected ${expected.net_sign}`);
    }

    return failures;
}
