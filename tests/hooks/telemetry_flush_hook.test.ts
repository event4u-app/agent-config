/**
 * The session-end flush concern (road-to-org-telemetry Phase 2, step 2.1).
 *
 * Two things are asserted and they pull in opposite directions, which is the
 * point: an ACTIVE install must actually start a sender, and every
 * not-fully-opted-in shape must perform zero telemetry file operations and
 * start no process at all. The second half mirrors
 * `telemetry_usage_hook.test.ts` § "inactive installs write nothing", because
 * acceptance criterion 1 covers the whole telemetry surface rather than one
 * concern of it.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { flushFor, resolveSenderScript } from '../../src/scripts/hooks/telemetry_flush_hook.js';
import { _resetSettingsCache } from '../../src/scripts/hooks/telemetry_usage_hook.js';
import { spool_path_for } from '../../src/agent-src/templates/scripts/telemetry/transport.js';

const roots: string[] = [];

function makeRoot(settingsBody: string | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-flush-'));
    roots.push(dir);
    if (settingsBody !== null) {
        fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settingsBody, 'utf-8');
    }
    _resetSettingsCache();
    return dir;
}

const ACTIVE = `telemetry:
  remote:
    enabled: true
    endpoint: http://127.0.0.1:9/ingest
    org_id: acme
    salt: org-pack-salt
    flush: session-end
`;

const ACTIVE_NEVER = ACTIVE.replace('flush: session-end', 'flush: never');

function spoolIn(root: string): string {
    return spool_path_for(path.join(root, '.agent-telemetry.jsonl'));
}

/** A stand-in sender that records that it ran, instead of sending. */
function markerSender(root: string): string {
    const p = path.join(root, 'marker_sender.mjs');
    fs.writeFileSync(
        p,
        [
            "import * as fs from 'node:fs';",
            `fs.writeFileSync(${JSON.stringify(path.join(root, 'ran.txt'))}, process.argv.slice(2).join(' '));`,
        ].join('\n'),
        'utf-8',
    );
    return p;
}

afterEach(() => {
    while (roots.length > 0) {
        fs.rmSync(roots.pop() as string, { recursive: true, force: true });
    }
    _resetSettingsCache();
});

describe('telemetry-flush — the active path', () => {
    it('spawns the sender with the derived spool and the org endpoint', async () => {
        const root = makeRoot(ACTIVE);
        const spool = spoolIn(root);
        fs.writeFileSync(spool, '{"schema_version":1,"skill":"brand"}\n');

        expect(flushFor(root, markerSender(root)).result).toBe('spawned');

        const ran = path.join(root, 'ran.txt');
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline && !fs.existsSync(ran)) {
            await new Promise((r) => setTimeout(r, 20));
        }
        expect(fs.existsSync(ran)).toBe(true);
        const argv = fs.readFileSync(ran, 'utf-8');
        expect(argv).toContain(`--spool ${spool}`);
        expect(argv).toContain('--endpoint http://127.0.0.1:9/ingest');
        // The bar the step names: "a timeout at or below one second".
        expect(argv).toContain('--timeout 1000');
    });

    it('does not spawn when the spool is empty — an idle session costs one stat', () => {
        const root = makeRoot(ACTIVE);
        expect(flushFor(root, markerSender(root)).result).toBe('empty-spool');
        expect(fs.existsSync(path.join(root, 'ran.txt'))).toBe(false);
    });

    it('does not spawn under flush: never, even with a full spool', () => {
        const root = makeRoot(ACTIVE_NEVER);
        fs.writeFileSync(spoolIn(root), '{"schema_version":1}\n');
        expect(flushFor(root, markerSender(root)).result).toBe('flush-never');
        expect(fs.existsSync(path.join(root, 'ran.txt'))).toBe(false);
    });

    it('degrades to no-flush rather than spawning something else when the sender is missing', () => {
        const root = makeRoot(ACTIVE);
        const spool = spoolIn(root);
        fs.writeFileSync(spool, '{"schema_version":1}\n');
        expect(flushFor(root, null).result).toBe('no-sender');
        // The batch is not lost — it is still queued for the next flush.
        expect(fs.readFileSync(spool, 'utf-8')).toContain('schema_version');
    });
});

describe('telemetry-flush — inactive installs start nothing', () => {
    it.each([
        ['no settings file at all', null],
        ['no telemetry section', 'discipline_profile: essential\n'],
        ['enabled but no endpoint / org / salt', 'telemetry:\n  remote:\n    enabled: true\n'],
        [
            'endpoint and org but no salt',
            'telemetry:\n  remote:\n    enabled: true\n    endpoint: http://x/y\n    org_id: acme\n',
        ],
        [
            'fully configured but not enabled',
            ACTIVE.replace('enabled: true', 'enabled: false'),
        ],
    ])('%s', (_label, body) => {
        const root = makeRoot(body as string | null);
        // A spool cannot exist on such an install, but plant one anyway: the
        // claim is that the concern does not act, not that it lacks input.
        fs.writeFileSync(spoolIn(root), '{"schema_version":1}\n');
        expect(flushFor(root, markerSender(root)).result).toBe('inactive');
        expect(fs.existsSync(path.join(root, 'ran.txt'))).toBe(false);
    });
});

describe('telemetry-flush — sender resolution', () => {
    it('resolves the shipped flush_sender.mjs from this module', () => {
        const resolved = resolveSenderScript();
        expect(resolved).not.toBeNull();
        expect(path.basename(resolved as string)).toBe('flush_sender.mjs');
        expect(fs.statSync(resolved as string).isFile()).toBe(true);
    });
});
