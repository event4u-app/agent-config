/**
 * `userGlobalDrop` probes every user-global layer, not only the flat file.
 *
 * The defect these cases pin: the loader reads BOTH
 * `~/.event4u/agent-config/agent-settings.yml` and the canonical
 * `~/.event4u/agent-config/settings/.agent-settings.yml` that the setup wizard
 * writes, and the drop reporter opened only the first. For a wizard user — the
 * common case — a non-whitelisted key therefore read as a plain "not set" with
 * no warning at all, which is the same output as a key nobody ever set. The
 * warning is the only thing that distinguishes "you set it and we threw it
 * away" from "you never set it".
 *
 * Sensitivity: the canonical-file case fails on the pre-fix implementation by
 * construction — with no flat `agent-settings.yml` present, `resolve_with_fallback`
 * returns null, the fallback write target does not exist, `readFileSync` throws,
 * and the old body returned `{ dropped: false }`. Verified by re-running these
 * cases against that body before it was replaced.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { userGlobalDrop } from '../../../src/scripts/_cli/cmd_settings_get.js';

const tmps: string[] = [];
let saved: string | undefined;

/** A user-global root carrying the named files, pointed at by the env seam. */
function userGlobalRoot(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ugdrop-'));
    tmps.push(root);
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(root, ...rel.split('/'));
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    process.env['EVENT4U_CONFIG_HOME'] = root;
    return root;
}

const CANONICAL = 'settings/.agent-settings.yml';
const FLAT = 'agent-settings.yml';
// Not on MERGEABLE_KEYS, so setting it user-globally is exactly the discarded case.
const DROPPED_KEY = 'memory.learn_on_session_end';
const BODY = 'memory:\n  learn_on_session_end: true\n';

beforeEach(() => {
    saved = process.env['EVENT4U_CONFIG_HOME'];
});

afterEach(() => {
    if (saved === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = saved;
});

afterAll(() => {
    for (const d of tmps) fs.rmSync(d, { recursive: true, force: true });
});

describe('userGlobalDrop', () => {
    it('reports the drop when the key sits in the CANONICAL wizard file', () => {
        const root = userGlobalRoot({ [CANONICAL]: BODY });
        const v = userGlobalDrop(DROPPED_KEY);
        expect(v.dropped).toBe(true);
        expect(v.file).toBe(path.join(root, ...CANONICAL.split('/')));
    });

    it('still reports the drop when the key sits in the FLAT legacy file', () => {
        const root = userGlobalRoot({ [FLAT]: BODY });
        const v = userGlobalDrop(DROPPED_KEY);
        expect(v.dropped).toBe(true);
        expect(v.file).toBe(path.join(root, FLAT));
    });

    // Precedence: the loader takes the canonical layer last, so the reported
    // file must be the one whose value would have won had it been whitelisted.
    it('names the canonical file when both layers carry the key', () => {
        const root = userGlobalRoot({ [FLAT]: BODY, [CANONICAL]: BODY });
        const v = userGlobalDrop(DROPPED_KEY);
        expect(v.dropped).toBe(true);
        expect(v.file).toBe(path.join(root, ...CANONICAL.split('/')));
    });

    it('reports no drop for a key nobody set', () => {
        userGlobalRoot({ [CANONICAL]: BODY });
        expect(userGlobalDrop('personal.play_by_play').dropped).toBe(false);
    });

    // A whitelisted key is not dropped, it cascades — so the warning must stay
    // silent even though the key is present in the same file.
    it('reports no drop for a whitelisted key', () => {
        userGlobalRoot({ [CANONICAL]: 'design:\n  fidelity_mode: structural\n' });
        expect(userGlobalDrop('design.fidelity_mode').dropped).toBe(false);
    });

    it('reports no drop when no user-global file exists at all', () => {
        userGlobalRoot({});
        expect(userGlobalDrop(DROPPED_KEY).dropped).toBe(false);
    });
});
