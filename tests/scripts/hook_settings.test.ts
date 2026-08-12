/**
 * `hook_settings` — the default-OFF flag lookup, across indentation shapes.
 *
 * The failure this exists to catch is the worst one an opt-in hook can have:
 * reading a NEIGHBOURING section's `enabled: true` and turning itself on. The
 * first version closed a section on any line indented three spaces or fewer,
 * so a 4-space settings file — legal YAML, and the file is user-editable —
 * never closed the section and leaked the next flag into it.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { hookSectionEnabled } from '../../src/scripts/_lib/hook_settings.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-settings-'));

afterAll(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
});

let counter = 0;
function rootWith(content: string): string {
    counter += 1;
    const root = path.join(TMP, `case-${counter}`);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, '.agent-settings.yml'), content);
    return root;
}

describe('two-space indentation', () => {
    const root = () =>
        rootWith(`hooks:\n  design_slop:\n    enabled: true\n  ui_route_nudge:\n    enabled: false\n`);

    it('reads the flag of the named section', () => {
        const r = root();
        expect(hookSectionEnabled(r, 'design_slop')).toBe(true);
        expect(hookSectionEnabled(r, 'ui_route_nudge')).toBe(false);
    });
});

describe('four-space indentation', () => {
    const content = `hooks:\n    design_slop:\n        enabled: true\n    ui_route_nudge:\n        enabled: false\n`;

    it('does not leak a neighbouring section flag into an off section', () => {
        // The regression: ui_route_nudge is false, design_slop is true, and a
        // section that never closes reports true for both.
        const r = rootWith(content);
        expect(hookSectionEnabled(r, 'ui_route_nudge')).toBe(false);
    });

    it('still reads the section that IS on', () => {
        expect(hookSectionEnabled(rootWith(content), 'design_slop')).toBe(true);
    });
});

describe('ordering', () => {
    it('does not read a LATER section flag', () => {
        const r = rootWith(`hooks:\n  ui_route_nudge:\n    enabled: false\n  design_slop:\n    enabled: true\n`);
        expect(hookSectionEnabled(r, 'ui_route_nudge')).toBe(false);
    });

    it('does not read an EARLIER section flag', () => {
        const r = rootWith(`hooks:\n  design_slop:\n    enabled: true\n  ui_route_nudge:\n    enabled: false\n`);
        expect(hookSectionEnabled(r, 'ui_route_nudge')).toBe(false);
    });

    it('closes the section at a top-level key', () => {
        const r = rootWith(`hooks:\n  ui_route_nudge:\n    x: 1\nquality:\n  enabled: true\n`);
        expect(hookSectionEnabled(r, 'ui_route_nudge')).toBe(false);
    });

    it('ignores an `enabled: true` outside the hooks block entirely', () => {
        const r = rootWith(`quality:\n  ui_route_nudge:\n    enabled: true\n`);
        expect(hookSectionEnabled(r, 'ui_route_nudge')).toBe(false);
    });
});

describe('fail-closed reads', () => {
    it('returns false when the settings file is absent', () => {
        expect(hookSectionEnabled(path.join(TMP, 'nonexistent'), 'ui_route_nudge')).toBe(false);
    });

    it('returns false when the section is absent', () => {
        expect(hookSectionEnabled(rootWith(`hooks:\n  other:\n    enabled: true\n`), 'ui_route_nudge')).toBe(
            false,
        );
    });

    it('ignores a commented-out flag', () => {
        const r = rootWith(`hooks:\n  ui_route_nudge:\n    # enabled: true\n`);
        expect(hookSectionEnabled(r, 'ui_route_nudge')).toBe(false);
    });

    it('does not treat a section name as a regex', () => {
        const r = rootWith(`hooks:\n  ui.route.nudge:\n    enabled: true\n`);
        expect(hookSectionEnabled(r, 'ui_route_nudge')).toBe(false);
    });
});
