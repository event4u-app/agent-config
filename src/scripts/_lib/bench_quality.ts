// Quality probe for `scripts/bench_run.py` — step-4 Phase 2 Step 3.
//
// Each prompt declares `rubric.must_include` / `must_not_include` or a
// `quality_assertion` regex (per docs/contracts/benchmark-corpus-spec.md).
// When an agent-output file is passed via --agent-output, we score the
// assertions against actual output. Without it, we emit `not_collected`
// per docs/contracts/benchmark-report-schema.md § quality invariants.
//
// TypeScript twin of `src/scripts/_lib/bench_quality.py` (ADR-092 py2ts
// Phase 2 / Wave 2a). Scoring math, rubric/regex semantics, and the
// `not_collected` shape are mirrored exactly; `quality_score` uses
// Python's round-half-to-even on `round(passing/total, 4)`.
import * as fs from 'node:fs';

export interface Rubric {
    must_include?: string[];
    must_not_include?: string[];
    length_words?: { min?: number; max?: number };
}

export interface Prompt {
    id: unknown;
    rubric?: Rubric;
    quality_assertion?: string;
    [key: string]: unknown;
}

/** Apply rubric.must_include / must_not_include / length_words to output. */
function _eval_rubric(rubric: Rubric, output: string): [boolean, string] {
    for (const phrase of rubric.must_include ?? []) {
        if (!output.includes(phrase)) {
            return [false, `missing: ${_pyRepr(phrase)}`];
        }
    }
    for (const phrase of rubric.must_not_include ?? []) {
        if (output.includes(phrase)) {
            return [false, `forbidden: ${_pyRepr(phrase)}`];
        }
    }
    const bounds = rubric.length_words ?? {};
    if (Object.keys(bounds).length > 0) {
        const words = _splitWords(output).length;
        const lo = bounds.min ?? 0;
        const hi = bounds.max ?? 0;
        if (lo && words < lo) {
            return [false, `length<${lo}: ${words}`];
        }
        if (hi && words > hi) {
            return [false, `length>${hi}: ${words}`];
        }
    }
    return [true, 'ok'];
}

function _eval_regex(pattern: string, output: string): [boolean, string] {
    let compiled: RegExp;
    try {
        compiled = _pyCompile(pattern);
    } catch (exc) {
        return [false, `bad_regex: ${exc instanceof Error ? exc.message : String(exc)}`];
    }
    const matched = compiled.test(output);
    return [matched, matched ? 'ok' : 'no_match'];
}

function _format_rubric(rubric: Rubric): string {
    const parts: string[] = [];
    if (rubric.must_include) {
        parts.push(`must_include=${_pyListRepr(rubric.must_include)}`);
    }
    if (rubric.must_not_include) {
        parts.push(`must_not_include=${_pyListRepr(rubric.must_not_include)}`);
    }
    if (rubric.length_words) {
        parts.push(`length_words=${_pyDictRepr(rubric.length_words)}`);
    }
    return parts.join(' ') || '<empty>';
}

export interface QualityPerPrompt {
    id: unknown;
    assertion: string;
    assertion_kind: string;
    passed: boolean | string;
}

export interface QualityBlock {
    source: string;
    prompts_with_assertion: number;
    prompts_passing: number;
    quality_score: number;
    per_prompt: QualityPerPrompt[];
}

/** Return the `quality` block per benchmark-report-schema § quality. */
export function score_corpus(prompts: Prompt[], agentOutputPath: string | null): QualityBlock {
    const declared = prompts.filter((p) => {
        const r = (p.rubric ?? {}) as Rubric;
        return Boolean(r.must_include) || Boolean(r.must_not_include) || Boolean(r.length_words) || Boolean(p.quality_assertion);
    });
    const totalDeclared = declared.length;

    if (agentOutputPath === null || !_isFile(agentOutputPath)) {
        return {
            source: 'not_collected',
            prompts_with_assertion: totalDeclared,
            prompts_passing: 0,
            quality_score: 0.0,
            per_prompt: declared.map((p) => ({
                id: p.id,
                assertion: p.quality_assertion || _format_rubric((p.rubric ?? {}) as Rubric),
                assertion_kind: p.quality_assertion ? 'quality_assertion' : 'rubric',
                passed: 'not_collected',
            })),
        };
    }

    const outputs = JSON.parse(fs.readFileSync(agentOutputPath, 'utf-8')) as Record<string, unknown>;
    const perPrompt: QualityPerPrompt[] = [];
    let passing = 0;
    for (const p of declared) {
        const pid = p.id;
        const outputText = String(outputs[String(pid)] ?? '');
        const rubric = (p.rubric ?? {}) as Rubric;
        const regex = p.quality_assertion;
        let ok: boolean;
        let kind: string;
        let assertion: string;
        if (regex) {
            [ok] = _eval_regex(regex, outputText);
            kind = 'quality_assertion';
            assertion = regex;
        } else {
            [ok] = _eval_rubric(rubric, outputText);
            kind = 'rubric';
            assertion = _format_rubric(rubric);
        }
        perPrompt.push({
            id: pid,
            assertion,
            assertion_kind: kind,
            passed: ok,
        });
        if (ok) {
            passing += 1;
        }
    }

    const score = totalDeclared ? _pyRound(passing / totalDeclared, 4) : 0.0;
    return {
        source: agentOutputPath,
        prompts_with_assertion: totalDeclared,
        prompts_passing: passing,
        quality_score: score,
        per_prompt: perPrompt,
    };
}

// ── Python-parity helpers ────────────────────────────────────────────────

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

// Python str.split() with no args: split on runs of whitespace, drop empties.
function _splitWords(s: string): string[] {
    const trimmed = s.trim();
    if (trimmed === '') {
        return [];
    }
    return trimmed.split(/\s+/);
}

// Python round() — round-half-to-even (banker's rounding).
function _pyRound(value: number, ndigits: number): number {
    const factor = Math.pow(10, ndigits);
    const scaled = value * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const tol = Math.max(Math.abs(scaled), 1) * 2 ** -40;
    let rounded: number;
    if (Math.abs(frac - 0.5) <= tol) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

/**
 * Translate a Python `re` pattern + `re.MULTILINE` flag into a JS RegExp.
 * The corpus assertions use simple patterns; we surface a thrown error for
 * patterns JS cannot compile so `_eval_regex` reports `bad_regex` like the
 * Python original (which catches `re.error`).
 */
function _pyCompile(pattern: string): RegExp {
    // re.MULTILINE → 'm'. Python `.search` is unanchored; RegExp.test is too.
    return new RegExp(pattern, 'm');
}

// Python repr() for a string (single-quoted, with the usual escapes). Used
// only inside diagnostic `_why` strings, which are discarded by score_corpus,
// but kept for fidelity should a caller surface them.
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}

// Python list repr for a list of strings: ['a', 'b'].
function _pyListRepr(items: string[]): string {
    return `[${items.map((i) => _pyRepr(i)).join(', ')}]`;
}

// Python dict repr for length_words: {'min': 1, 'max': 2}.
function _pyDictRepr(d: { min?: number; max?: number }): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(d)) {
        parts.push(`'${k}': ${v}`);
    }
    return `{${parts.join(', ')}}`;
}
