/**
 * Deterministic Markdown projection of an `ExplainTrace`.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/render.py` (ADR-200).
 * Behaviour mirrors the Python original EXACTLY — same fixed section
 * order, same skip-empty-chunk join, same `rstrip()` + trailing newline,
 * same tip-footer text and `with_footer` gate. No behaviour changes.
 *
 * Pure-function `render(trace) -> str`. Same input `ExplainTrace` always
 * yields byte-identical Markdown — Phase 4 snapshot tests rely on this.
 * Each section lives in its own module under `sections/`; the orchestrator
 * only fixes the order.
 */
import * as sections from './sections/index.js';

const _SECTION_ORDER: ReadonlyArray<(trace: Record<string, unknown>) => string> = [
    sections.header.render,
    sections.route.render,
    sections.inputs.render,
    sections.memory.render,
    sections.council.render,
    sections.halt.render,
    sections.provider.render,
    sections.assumptions.render,
    sections.pack.render,
];

export const TIP_FOOTER =
    '_tip: pass `--json` to emit machine-readable trace; '
    + '`--quiet` to drop this footer._\n';

/** Python `str.rstrip()` — strips trailing ASCII + Unicode whitespace. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

export function render(
    trace: Record<string, unknown>,
    options: { with_footer?: boolean } = {},
): string {
    const with_footer = options.with_footer ?? true;
    const parts: string[] = [];
    for (const section of _SECTION_ORDER) {
        const chunk = section(trace);
        if (chunk) {
            parts.push(chunk);
        }
    }
    let body = `${_rstrip(parts.join('\n'))}\n`;
    if (with_footer) {
        body += `\n${TIP_FOOTER}`;
    }
    return body;
}
