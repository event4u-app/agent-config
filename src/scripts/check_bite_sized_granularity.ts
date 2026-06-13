#!/usr/bin/env tsx
/**
 * Bite-sized task granularity gate for structural roadmaps (P1.5).
 *
 * TypeScript twin of `src/scripts/check_bite_sized_granularity.py` (ADR-092,
 * Phase 4 / Wave 4c). This module is a pure library (no CLI / main); the
 * Python module is imported as a test surface. The exported API mirrors the
 * Python public API EXACTLY:
 *
 *     read_complexity(text)   -> 'structural' | 'lightweight' | null
 *     scan_placeholders(text) -> Placeholder[]
 *     check_granularity(text) -> Result(complexity, gated, violations)
 *
 * `gated` is true only when `complexity === 'structural'`. Violations are
 * empty when the gate is not active, regardless of placeholder presence.
 * No behaviour changes — placeholder patterns, frontmatter slice, and the
 * task-bullet prefixes are replicated.
 */

// Placeholder patterns in (kind, regex) order. Mirrors Python re flags:
// IGNORECASE for the angle/tbd patterns. JS uses `i`. The angle pattern
// is global-less here; we use `.test()` per line (re.search semantics).
const PLACEHOLDER_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['angle-placeholder', /<[a-z][a-z0-9 _\-/]*>/i],
    ['todo', /\bTODO\b/],
    ['fixme', /\bFIXME\b/],
    ['xxx', /\bXXX\b/],
    ['tbd', /\btbd\b/i],
    ['triple-question', /\?\?\?/],
];

const COMPLEXITY_PAT = /^complexity:\s*(lightweight|structural)\s*$/m;

interface Placeholder {
    kind: string;
    line: number;
    text: string;
}

interface Result {
    complexity: string | null;
    gated: boolean;
    violations: Placeholder[];
}

function _frontmatter(text: string): string {
    if (!text.startsWith('---\n')) {
        return '';
    }
    const end = text.indexOf('\n---\n', 4);
    return end !== -1 ? text.slice(4, end) : '';
}

function read_complexity(text: string): string | null {
    const fm = _frontmatter(text);
    if (fm === '') {
        return null;
    }
    const m = COMPLEXITY_PAT.exec(fm);
    return m ? m[1]! : null;
}

const _TASK_PREFIXES = ['- [ ]', '- [x]', '- [/]', '- [-]'];

/** Mirror Python `str.lstrip()` — strip leading whitespace (incl. tabs). */
function _lstrip(s: string): string {
    return s.replace(/^\s+/, '');
}

/** Mirror Python `str.rstrip()` — strip trailing whitespace. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/, '');
}

function scan_placeholders(text: string): Placeholder[] {
    const hits: Placeholder[] = [];
    const lines = text.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
        const line_no = idx + 1;
        const line = lines[idx]!;
        const stripped = _lstrip(line);
        if (!_TASK_PREFIXES.some((p) => stripped.startsWith(p))) {
            continue;
        }
        for (const [kind, pat] of PLACEHOLDER_PATTERNS) {
            if (pat.test(line)) {
                hits.push({ kind, line: line_no, text: _rstrip(line) });
                break;
            }
        }
    }
    return hits;
}

function check_granularity(text: string): Result {
    const complexity = read_complexity(text);
    const gated = complexity === 'structural';
    if (!gated) {
        return { complexity, gated: false, violations: [] };
    }
    return {
        complexity,
        gated: true,
        violations: scan_placeholders(text),
    };
}

export {
    type Placeholder,
    type Result,
    PLACEHOLDER_PATTERNS,
    COMPLEXITY_PAT,
    read_complexity,
    scan_placeholders,
    check_granularity,
};
