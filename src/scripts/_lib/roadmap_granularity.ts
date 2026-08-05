/**
 * Bite-sized task-granularity check for structural roadmaps.
 *
 * A `complexity: structural` roadmap's task bullets must name real work. A
 * placeholder in a task bullet — `<something>`, TODO, FIXME, XXX, TBD, `???` —
 * means the step was filed before it was decided, which is the failure the
 * bite-sized standard exists to catch.
 *
 * ## Why this lives in `_lib/` and not in a gate of its own
 *
 * It used to be `src/scripts/check_bite_sized_granularity.ts`: a pure library
 * with no CLI, no `main`, no exit code, and — measured — no production caller
 * outside its own test. It was carried over from a retired Python module for
 * API parity and never wired up, so a real check that no other gate covers ran
 * nowhere, while the `check_` prefix kept it inside the gate population where
 * the scan-scope ratchet counted it as a gate that could not assert a scan
 * scope.
 *
 * AI council 2026-08-05 resolved it by folding rather than deleting: the checks
 * are the only placeholder coverage in the tree (`lint_roadmap_complexity`
 * covers the complexity tag, the lightweight caps, and the plate/horizon
 * prohibition, and greps clean for every placeholder pattern), so deleting them
 * would have discarded live value to reach a count. Folding into the gate that
 * already owns the roadmap corpus adds no gate script, no CI job, and no
 * manifest entry, and the population member disappears with the old file.
 *
 * ## Inline-code masking (the reason this is not a verbatim move)
 *
 * The original patterns matched inside backticked spans, which made CLI
 * metasyntax a violation. Measured across 22 structural roadmaps, the only hit
 * in the whole tree was `` `settings set <key> <value>` `` — argument
 * metasyntax in a code span, on a step that is otherwise fully specified. The
 * council flagged folding a check with an unaudited hit in an out-of-scope
 * directory as a time-bomb: it would fire the day the gate's scope widened. So
 * the fix is precision, not scope-limiting — inline code spans are masked
 * before matching, the same technique `lint_readme_serial_comma` already uses
 * on README prose. With masking the count is 0 across every structural roadmap,
 * `later/` and `stubs/` included, so widening the gate's scope later cannot
 * surprise anyone.
 */

/** Placeholder patterns in (kind, regex) order. */
const PLACEHOLDER_PATTERNS: ReadonlyArray<[string, RegExp]> = [
    ['angle-placeholder', /<[a-z][a-z0-9 _\-/]*>/i],
    ['todo', /\bTODO\b/],
    ['fixme', /\bFIXME\b/],
    ['xxx', /\bXXX\b/],
    ['tbd', /\btbd\b/i],
    ['triple-question', /\?\?\?/],
];

const COMPLEXITY_PAT = /^complexity:\s*(lightweight|structural)\s*$/m;

const TASK_PREFIXES = ['- [ ]', '- [x]', '- [/]', '- [-]'] as const;

export interface Placeholder {
    kind: string;
    line: number;
    text: string;
}

export interface GranularityResult {
    complexity: string | null;
    gated: boolean;
    violations: Placeholder[];
}

function frontmatter(text: string): string {
    if (!text.startsWith('---\n')) {
        return '';
    }
    const end = text.indexOf('\n---\n', 4);
    return end !== -1 ? text.slice(4, end) : '';
}

export function read_complexity(text: string): string | null {
    const fm = frontmatter(text);
    if (fm === '') {
        return null;
    }
    const m = COMPLEXITY_PAT.exec(fm);
    return m ? m[1]! : null;
}

const ANGLE_PLACEHOLDER = /<[a-z][a-z0-9 _\-/]*>/gi;

/**
 * Blank inline code spans that are COMMAND TEMPLATES, so CLI argument
 * metasyntax is not read as an undecided step.
 *
 * Blanking every backtick span (the first attempt) was too blunt, and the ported
 * test corpus proved it: `` `<file>` `` in *"Edit `<file>` and add the new
 * method"* is a real placeholder — the file is genuinely undecided — while
 * `` `settings set <key> <value>` `` on a step that goes on to specify
 * zod-validation, atomicity and key-class refusal is a command signature.
 *
 * The discriminator is what else the span holds: strip the placeholders and if
 * nothing but whitespace is left, the span IS the placeholder (violation); if
 * real content remains (`settings set`), it is a command template naming its
 * arguments (masked). Only the angle pattern gets this treatment — a literal
 * TODO / FIXME / XXX / TBD / `???` in a task bullet is unfinished work wherever
 * it sits, backticks included.
 */
function mask_command_templates(line: string): string {
    return line.replace(/`[^`]*`/g, (span) => {
        const withoutPlaceholders = span.slice(1, -1).replace(ANGLE_PLACEHOLDER, '');
        return withoutPlaceholders.trim() === '' ? span : ' ';
    });
}

export function scan_placeholders(text: string): Placeholder[] {
    const hits: Placeholder[] = [];
    const lines = text.split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx]!;
        const stripped = line.replace(/^\s+/, '');
        if (!TASK_PREFIXES.some((p) => stripped.startsWith(p))) {
            continue;
        }
        // Command-template masking applies to the angle pattern ONLY. A literal
        // TODO / FIXME / XXX / TBD / `???` is unfinished work wherever it sits,
        // so those patterns read the raw line.
        const masked = mask_command_templates(line);
        for (const [kind, pat] of PLACEHOLDER_PATTERNS) {
            const probe = kind === 'angle-placeholder' ? masked : line;
            if (pat.test(probe)) {
                hits.push({ kind, line: idx + 1, text: line.replace(/\s+$/, '') });
                break;
            }
        }
    }
    return hits;
}

/**
 * Gated only for `complexity: structural`. Violations are empty when the gate
 * is not active, regardless of placeholder presence.
 */
export function check_granularity(text: string): GranularityResult {
    const complexity = read_complexity(text);
    const gated = complexity === 'structural';
    if (!gated) {
        return { complexity, gated: false, violations: [] };
    }
    return { complexity, gated: true, violations: scan_placeholders(text) };
}

/** One human-readable problem line per violation, for a gate's problem list. */
export function granularity_problems(text: string): string[] {
    return check_granularity(text).violations.map(
        (v) =>
            `bite-sized granularity: line ${v.line} has a ${v.kind} placeholder in a ` +
            `task bullet — a structural roadmap's steps name decided work: ${v.text.trim()}`,
    );
}

export { PLACEHOLDER_PATTERNS, COMPLEXITY_PAT };
