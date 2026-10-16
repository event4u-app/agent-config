/**
 * One value per typography question, across the three carriers an agent reads.
 *
 * Body line-height is owned by `typography-system`; the design-rules checklist
 * and the antipattern catalogue may state a floor (Q8) but never a second
 * default. The form-control font-size floor — the 16 px trigger behind the iOS
 * focus zoom — belongs to inputs, selects and textareas, never to body text,
 * whose floor is Q2.
 *
 * The detectors run twice: once over a pinned copy of the text these carriers
 * held before the single authority landed, where they must fire, and once over
 * the live files, where they must not. The first half is what keeps the test's
 * sensitivity known after the live text goes green.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Carrier {
    readonly name: string;
    readonly authority: boolean;
    readonly text: string;
}

const CARRIER_PATHS: ReadonlyArray<{ name: string; authority: boolean; rel: string }> = [
    { name: 'typography-system', authority: true, rel: 'src/skills/typography-system/SKILL.md' },
    {
        name: 'design-rules-checklist',
        authority: false,
        rel: 'src/skills/design-intelligence/references/design-rules-checklist.md',
    },
    { name: 'design-antipatterns', authority: false, rel: 'docs/guidelines/design-antipatterns.md' },
];

const FLOOR = /≥|>=|\bfloor\b/i;
const POINT = /\b1\.\d+\b/g;
const RANGE = /\b1\.\d+\s*(?:[-–]|to)\s*1\.\d+\b/g;

function bodyLineHeightLines(text: string): string[] {
    return text
        .split('\n')
        .filter((line) => /line-?height/i.test(line) && /\bbody\b/i.test(line) && !FLOOR.test(line));
}

/** Point values (ranges removed first, so a band's endpoints are not points). */
function pointValues(line: string): string[] {
    return line.replace(RANGE, ' ').match(POINT) ?? [];
}

function lineHeightFindings(carriers: readonly Carrier[]): string[] {
    const findings: string[] = [];
    const defaults = new Set<string>();
    for (const carrier of carriers) {
        for (const line of bodyLineHeightLines(carrier.text)) {
            const points = pointValues(line);
            const ranges = line.match(RANGE) ?? [];
            if (!carrier.authority && (points.length > 0 || ranges.length > 0)) {
                findings.push(`${carrier.name} restates body line-height: ${line.trim()}`);
            }
            if (carrier.authority) {
                points.forEach((value) => defaults.add(value));
            }
        }
    }
    if (defaults.size > 1) {
        findings.push(`typography-system carries ${defaults.size} body line-height defaults: ${[...defaults].join(', ')}`);
    }
    return findings;
}

function controlFloorFindings(carriers: readonly Carrier[]): string[] {
    const findings: string[] = [];
    const values = new Set<string>();
    for (const carrier of carriers) {
        for (const line of carrier.text.split('\n')) {
            if (!/auto-?zoom|focus[- ]zoom|zooms? on focus/i.test(line)) continue;
            if (/\bbody\b/i.test(line)) {
                findings.push(`${carrier.name} attaches the zoom trigger to body text: ${line.trim()}`);
            }
            if (!/\b(?:input|select|textarea|form[- ]control)s?\b/i.test(line)) {
                findings.push(`${carrier.name} names the zoom trigger without a form control: ${line.trim()}`);
            }
            (line.match(/\b\d+\s?px\b/g) ?? []).forEach((v) => values.add(v.replace(/\s/g, '')));
        }
    }
    if (values.size > 1) {
        findings.push(`control font-size floor has ${values.size} values: ${[...values].join(', ')}`);
    }
    return findings;
}

/** The carrier lines as they read before the single authority landed. */
const PRIOR: readonly Carrier[] = [
    {
        name: 'typography-system',
        authority: true,
        text: '   xl / 2xl / 3xl`; set `line-height` (1.5 for body, 1.2 for display);',
    },
    {
        name: 'design-rules-checklist',
        authority: false,
        text: [
            '| 6 | Typography & Color | MEDIUM | `typography`, `color` | Base 16px, Line-height 1.5, Semantic color tokens | Text &lt; 12px body, Gray-on-gray, Raw hex in components |',
            '- `readable-font-size` - Minimum 16px body text on mobile (avoids iOS auto-zoom)',
            '- `line-height` - Use 1.5-1.75 for body text',
        ].join('\n'),
    },
    {
        name: 'design-antipatterns',
        authority: false,
        text: '| Q8 | `line-height` ≥ 1.3 on body text | Computed `line-height` | Agent self-check |',
    },
];

function liveCarriers(): Carrier[] {
    return CARRIER_PATHS.map(({ name, authority, rel }) => ({
        name,
        authority,
        text: fs.readFileSync(path.join(REPO, rel), 'utf8'),
    }));
}

describe('typography value drift', () => {
    it('prior-text-fires-both-detectors', () => {
        expect(lineHeightFindings(PRIOR).length).toBeGreaterThanOrEqual(2);
        expect(controlFloorFindings(PRIOR).length).toBeGreaterThanOrEqual(1);
    });

    it('a-floor-row-is-not-a-second-value', () => {
        expect(lineHeightFindings([PRIOR[2]!])).toEqual([]);
    });

    it('live-carriers-hold-one-body-line-height', () => {
        expect(lineHeightFindings(liveCarriers())).toEqual([]);
    });

    it('live-carriers-hold-one-control-font-size-floor', () => {
        expect(controlFloorFindings(liveCarriers())).toEqual([]);
    });

    it('the-authority-still-states-the-default', () => {
        const authority = liveCarriers().find((c) => c.authority)!;
        const points = bodyLineHeightLines(authority.text).flatMap(pointValues);
        expect(points).toContain('1.5');
    });
});
