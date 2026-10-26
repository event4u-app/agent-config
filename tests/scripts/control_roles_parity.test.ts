// The CLI and the work engine carry the same control-role parser in two files
// (the CLI may not import the template tree). This holds them in step.
import { describe, expect, it } from 'vitest';

import * as cli from '../../src/scripts/_lib/control_roles.js';
import * as engine from '../../src/agent-src/templates/scripts/work_engine/_lib/control_roles.js';

const SAMPLES = [
    '<select name="s"></select>',
    '<x-select :options="$o" />',
    '<flux:select wire:model="s">',
    '<Select value={v}>',
    '<input type="date" name="d">',
    '<input type="hidden" name="t">',
    '<input type="radio" name="r">',
    '<input name="q" class="h-9 px-3">',
    '<Input name="q" />',
    '<DatePicker value={d} />',
    '<Switch checked />',
    '<button role="switch" aria-checked="true">',
    '<div role="combobox">',
    '<textarea rows="3"></textarea>',
    '<dialog open>',
    '<Sheet>',
    '<details><summary>x</summary></details>',
    '<div popover="auto">',
    '<DropdownMenu>',
    '<MenuButton>',
    '<Tooltip content="x">',
    '<Tabs defaultValue="a">',
    '<table class="w-full">',
    '<SelectPrimitive.Trigger className="h-9">',
    '<!-- select the dialog --> prose about a select box',
];

describe('control-role parser parity — CLI vs work engine', () => {
    it('declares the same role table', () => {
        expect([...cli.CONTROL_ROLES]).toEqual([...engine.CONTROL_ROLES]);
    });

    it.each(SAMPLES)('%s reads the same in both', (markup) => {
        const fromCli = [...new Set(cli.occurrences(markup).map((o) => o.role))].sort();
        const fromEngine = [...engine.rolesIn(markup)].sort();
        expect(fromEngine).toEqual(fromCli);
    });
});
