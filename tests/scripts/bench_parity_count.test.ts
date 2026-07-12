import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    TASK_FILES,
    derive_floors,
    extract_task_prompt,
    median,
    render_user_prompt,
} from '../../src/scripts/bench_parity_count.js';

test('extract_task_prompt pulls the fenced block after the heading', () => {
    const md = '# t\n\n## Task prompt (paste)\n\n```\ndo the thing\nline two\n```\n\n## after\n';
    assert.equal(extract_task_prompt(md), 'do the thing\nline two');
});

test('extract_task_prompt throws without the heading', () => {
    assert.throws(() => extract_task_prompt('# nothing here'));
});

test('median: odd, even, empty', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([]), 0);
});

test('derive_floors: floor = max(1, min over hosts of median); controls excluded', () => {
    const rows = [
        {
            task: 't1',
            control: false,
            counts: { a: [4, 6, 5], b: [8, 9, 10] }, // medians 5, 9 → envelope 5
        },
        {
            task: 'ctl',
            control: true,
            counts: { a: [0, 0, 1], b: [0, 0, 0] },
        },
        {
            task: 't-low',
            control: false,
            counts: { a: [0, 0, 0], b: [2, 2, 2] }, // envelope 0 → floor clamps to 1
        },
    ];
    const floors = derive_floors(rows);
    assert.equal(floors[0]?.floor, 5);
    assert.equal(floors[0]?.envelope, 5);
    assert.equal(floors[1]?.floor, null); // control never yields a floor
    assert.equal(floors[2]?.floor, 1); // clamp
});

test('render_user_prompt inlines every mapped fixture file + the output contract', () => {
    for (const [id] of Object.entries(TASK_FILES)) {
        // resolves against the real repo fixtures — fails loudly if a mapped file vanishes
        const md = `## Task prompt\n\n\`\`\`\nprompt for ${id}\n\`\`\`\n`;
        const out = render_user_prompt(id, extract_task_prompt(md));
        assert.ok(out.includes(`prompt for ${id}`));
        assert.ok(out.includes('OUTPUT CONTRACT'));
        for (const rel of TASK_FILES[id]?.files ?? []) {
            assert.ok(out.includes(`### ${rel}`), `${id} missing inlined ${rel}`);
        }
    }
});
