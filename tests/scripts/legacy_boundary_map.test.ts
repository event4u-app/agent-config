// Tests for src/scripts/_lib/legacy_boundary_map.ts —
// road-to-consumer-repo-reality Phase 4 (4.1).
//
// The step's verify has three clauses and each is a test below: every path gets
// a verdict; a file mixing both halves is reported MIXED rather than assigned to
// one side; and the mixed verdict names the governing convention PER REGION
// rather than for the file as a whole. The third is the one that matters — "a
// verdict that says only 'mixed' leaves the caller exactly where it started."
import { describe, expect, it } from 'vitest';

import { classifyText, conventionAt } from '../../src/scripts/_lib/legacy_boundary_map.js';

const MODERN = `<?php

declare(strict_types=1);

namespace Acme\\Billing;

use Acme\\Support\\Clock;

final class InvoiceService
{
    public function total(): int
    {
        return 0;
    }
}
`;

const LEGACY = `<?php

require_once __DIR__ . '/../lib/db.php';

global $config;

function calculate_total($rows) {
    return array_sum($rows);
}
`;

// The shape the phase describes: the two halves meeting INSIDE one file — a
// strict-typed, namespaced service importing non-namespaced global singletons.
const MIXED = `<?php

declare(strict_types=1);

namespace Acme\\Billing;

final class InvoiceService
{
    public function total(): int
    {
        return 0;
    }
}

require_once __DIR__ . '/../lib/legacy_helpers.php';

global $legacy_config;

function acme_legacy_total($rows) {
    return array_sum($rows);
}
`;

describe('4.1 — a per-path verdict, never a per-repository one', () => {
    it('classifies a namespaced strict-typed file as modern', () => {
        const v = classifyText('src/Billing/InvoiceService.php', MODERN);
        expect(v.convention).toBe('modern');
        expect(v.reason).not.toBe('');
    });

    it('classifies an include-and-dispatch file as legacy', () => {
        expect(classifyText('lib/totals.php', LEGACY).convention).toBe('legacy');
    });

    it('reports a file containing BOTH halves as mixed, not assigned to one side', () => {
        const v = classifyText('src/Billing/InvoiceService.php', MIXED);
        expect(v.convention).toBe('mixed');
        expect(v.convention).not.toBe('modern');
        expect(v.convention).not.toBe('legacy');
    });

    // The load-bearing clause.
    it('names the governing convention PER REGION, not for the file as a whole', () => {
        const v = classifyText('src/Billing/InvoiceService.php', MIXED);
        expect(v.regions.length).toBeGreaterThan(1);
        expect(new Set(v.regions.map((r) => r.convention))).toEqual(new Set(['modern', 'legacy']));
        for (const r of v.regions) {
            expect(r.signal).not.toBe('');
            expect(r.endLine).toBeGreaterThanOrEqual(r.startLine);
        }
        expect(v.reason).toMatch(/L\d+-\d+/);
    });

    it('answers what an edit at a given line must follow', () => {
        const v = classifyText('src/Billing/InvoiceService.php', MIXED);
        const lines = MIXED.split('\n');
        const requireLine = lines.findIndex((l) => l.includes('legacy_helpers')) + 1;
        const namespaceLine = lines.findIndex((l) => l.startsWith('namespace ')) + 1;
        expect(conventionAt(v, namespaceLine)).toBe('modern');
        expect(conventionAt(v, requireLine)).toBe('legacy');
    });

    it('covers every line, including those before the first signal', () => {
        const v = classifyText('x.php', MIXED);
        expect(conventionAt(v, 1)).not.toBeNull();
        expect(conventionAt(v, MIXED.split('\n').length)).not.toBeNull();
        expect(v.regions[0]?.startLine).toBe(1);
    });

    // THREE DEFECTS A REVIEW FOUND, each an ordinary file shape this module
    // classified wrongly. Every fixture above segregates the two halves, which is
    // why none of them caught these: the failure mode is a foreign signal INSIDE
    // otherwise uniform code.
    it('does not call the canonical PSR-4 bootstrap mixed', () => {
        const boot = [
            '<?php',
            '',
            'declare(strict_types=1);',
            '',
            "require __DIR__ . '/../vendor/autoload.php';",
            '',
            'use App\\Kernel;',
            '',
            'final class Boot {}',
        ].join('\n');
        const v = classifyText('public/index.php', boot);
        expect(v.convention).toBe('modern');
        expect(conventionAt(v, 5)).toBe('modern');
    });

    it('does not read a comment about legacy code as legacy code', () => {
        const src = [
            '<?php',
            'declare(strict_types=1);',
            'namespace App;',
            "// never touch $GLOBALS['cfg'] from here",
            'final class Svc {}',
        ].join('\n');
        expect(classifyText('src/Svc.php', src).convention).toBe('modern');
    });

    it('treats a lone foreign signal as a POINT, so the lines after it keep their convention', () => {
        const src = [
            '<?php',
            'declare(strict_types=1);',
            'namespace App;',
            'final class Svc',
            '{',
            '    public function bar(): void {',
            "        $x = $GLOBALS['legacy_cfg'] ?? null;",
            '    }',
            '',
            '    public function baz(): int { return 1; }',
            '}',
        ].join('\n');
        const v = classifyText('src/Svc.php', src);
        expect(v.convention).toBe('modern');
        // The point itself is kept — an edit AT line 7 does touch a global.
        expect(v.foreignPoints.map((f) => f.line)).toEqual([7]);
        expect(conventionAt(v, 7)).toBe('legacy');
        // ...and line 10, plain modern code, is not dragged along with it.
        expect(conventionAt(v, 10)).toBe('modern');
    });

    it('still reports a genuinely mixed file as mixed — two signals each side', () => {
        const src = [
            '<?php',
            'declare(strict_types=1);',
            'namespace App;',
            'final class Svc {}',
            "require_once __DIR__ . '/../lib/legacy.php';",
            'global $config;',
        ].join('\n');
        expect(classifyText('src/Svc.php', src).convention).toBe('mixed');
    });

    it('returns unknown rather than a default for a file with no signal', () => {
        const v = classifyText('README.md', '# Notes\n\nSome prose.\n');
        expect(v.convention).toBe('unknown');
        expect(v.regions).toEqual([]);
        expect(conventionAt(v, 1)).toBeNull();
    });

    it('merges consecutive same-convention signals into one region', () => {
        const v = classifyText('x.php', MODERN);
        expect(v.regions).toHaveLength(1);
        expect(v.regions[0]?.convention).toBe('modern');
    });

    it('uses language constructs only — no project naming or directory convention', () => {
        // Same content, two unrelated paths: the verdict must not move.
        const a = classifyText('src/Modern/Thing.php', LEGACY);
        const b = classifyText('legacy/old/thing.php', LEGACY);
        expect(a.convention).toBe(b.convention);
        expect(a.convention).toBe('legacy');
    });
});
