/**
 * Ledger-adoption ratchet — classification, and the anchor that stops the
 * checker from silencing itself.
 *
 * The regression fixture at the bottom is the reason this file exists in the
 * shape it does. On its first run the gate reported ITSELF as exempt: its own
 * docblock names the `// ledger-exempt:` marker in order to explain it, and an
 * unanchored regex read that prose as a marker. A checker its own
 * documentation can switch off is precisely the false-green class this roadmap
 * removes, so the anchor is pinned here rather than trusted.
 */
import { describe, expect, it } from 'vitest';

import {
    EXEMPT_MARKER,
    MIN_REASON_CHARS,
    classifyGateSource,
    registeredGateIds,
} from '../../src/scripts/check_gate_completeness.js';

const LEDGERED = `import { GateLedger } from './_lib/gate_ledger.js';\nexport function main(): number { return 0; }\n`;

describe('classifyGateSource', () => {
    it('accepts a gate that imports the ledger', () => {
        expect(classifyGateSource('g', LEDGERED).status).toBe('ledgered');
    });

    it('accepts a gate carrying an exemption with a real reason', () => {
        const src = `${EXEMPT_MARKER} watch-list guard with no corpus to enumerate per target\nexport function main() {}\n`;
        const row = classifyGateSource('g', src);
        expect(row.status).toBe('exempt');
        expect(row.reason).toContain('watch-list guard');
    });

    it('accepts an indented exemption marker', () => {
        const src = `function main() {\n    ${EXEMPT_MARKER} single scalar probe, there are no per-target outcomes here\n}\n`;
        expect(classifyGateSource('g', src).status).toBe('exempt');
    });

    it('REJECTS a gate with neither', () => {
        expect(classifyGateSource('g', 'export function main() { return 0; }\n').status).toBe(
            'unledgered',
        );
    });

    it('REJECTS an exemption whose reason is too short to audit', () => {
        const row = classifyGateSource('g', `${EXEMPT_MARKER} n/a\n`);
        expect(row.status).toBe('malformed_exemption');
        expect(row.reason).toBe('n/a');
    });

    it('REJECTS an empty exemption reason', () => {
        expect(classifyGateSource('g', `${EXEMPT_MARKER}\n`).status).toBe('malformed_exemption');
    });

    it('treats a reason of exactly the minimum length as valid', () => {
        const reason = 'x'.repeat(MIN_REASON_CHARS);
        expect(classifyGateSource('g', `${EXEMPT_MARKER} ${reason}\n`).status).toBe('exempt');
    });
});

describe('the marker is not readable out of prose (self-exemption regression)', () => {
    it('ignores the marker named inside a docblock', () => {
        const src = [
            '/**',
            ' * A gate satisfies this check by either importing the ledger, or by',
            ` * carrying a \`${EXEMPT_MARKER} <reason>\` marker naming why per-target`,
            ' * accounting does not apply to it.',
            ' */',
            'export function main() { return 0; }',
        ].join('\n');
        expect(classifyGateSource('g', src).status).toBe('unledgered');
    });

    it('ignores the marker inside a string literal', () => {
        const src = `export const EXEMPT_MARKER = '${EXEMPT_MARKER}';\nexport function main() {}\n`;
        expect(classifyGateSource('g', src).status).toBe('unledgered');
    });

    it('ignores a ledger import mentioned in prose rather than imported', () => {
        const src = `// see ./_lib/gate_ledger.js for the accounting helper\nexport function main() {}\n`;
        expect(classifyGateSource('g', src).status).toBe('unledgered');
    });
});

describe('the registered population', () => {
    it('resolves a non-trivial gate set from the real task tree', () => {
        // A collapsed closure (a Taskfile parse that degrades to nothing) is the
        // dead-scan-root shape one level up; the gate's own scan assertion
        // catches zero, and this catches a near-zero that would still look sane.
        expect(registeredGateIds().length).toBeGreaterThan(100);
    });

    it('includes this gate itself — it is registered and must be judged', () => {
        expect(registeredGateIds()).toContain('check_gate_completeness');
    });
});
