// An honest `[~]` in an archived roadmap must not feed the Iron-Law-3 failure.
//
// The progress check's Iron-Law-3 set (`pending_iron_law_3`) is the pressure a
// roadmap author meets when a criterion is genuinely unmet: a `[~]` on a file
// at `count_open == 0` reds the dashboard check. That pressure belongs to
// ACTIVE roadmaps, which can still be resolved. Once a roadmap is archived it
// is a record, and the only honest glyph for "this half was not met" is `[~]`;
// if archived files fed the same set, the author would be pushed into a `[x]`
// over a clause the text itself calls unmet.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collect, pending_iron_law_3 } from '../../src/agent-src/scripts/update_roadmap_progress.js';

const BODY = [
    '---',
    'complexity: lightweight',
    '---',
    '# Road to a fixture',
    '',
    '## Phase 1 — the work',
    '',
    '- [x] **1.1 Done.**',
    '',
    '## Acceptance Criteria',
    '',
    '- [~] AC-1 — One half is NOT met and is carried.',
    '',
].join('\n');

let root: string;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'progress-archived-deferral-'));
    fs.mkdirSync(path.join(root, 'roadmaps', 'archive'), { recursive: true });
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('Iron-Law-3 set and archived deferrals', () => {
    it('counts a deferral in an active roadmap', () => {
        fs.writeFileSync(path.join(root, 'roadmaps', 'road-to-active.md'), BODY);
        const pending = pending_iron_law_3(collect(path.join(root, 'roadmaps')));
        expect(pending.map((r) => r.rel)).toEqual(['road-to-active.md']);
    });

    it('does not count the same deferral once the roadmap sits under archive/', () => {
        fs.writeFileSync(path.join(root, 'roadmaps', 'archive', 'road-to-archived.md'), BODY);
        const stats = collect(path.join(root, 'roadmaps'));
        expect(stats.map((r) => r.rel)).toEqual([]);
        expect(pending_iron_law_3(stats)).toEqual([]);
    });
});
