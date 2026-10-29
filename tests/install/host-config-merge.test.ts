// An install over a host settings file the installer cannot parse as strict
// JSON must never lose a foreign line: each case ends in a named status, and an
// overwritten file always has a `.agent-config.bak` beside it.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as inst from '../../src/scripts/install.js';

const PLUGIN = './plugin/agent-config';
const OURS = { 'chat.pluginLocations': { [PLUGIN]: true } };

let tmpRoot: string;
let project: string;
let settings: string;
let output: string;

beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'host-config-merge-'));
    project = path.join(tmpRoot, 'consumer');
    settings = path.join(project, '.vscode', 'settings.json');
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    output = '';
    const capture = (chunk: string | Uint8Array): boolean => {
        output += String(chunk);
        return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(capture);
    vi.spyOn(process.stderr, 'write').mockImplementation(capture);
});

afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function bridge(): void {
    inst.ensure_vscode_bridge(project, 'composer', false);
}

describe('JSONC host settings', () => {
    it('keeps a commented file byte-for-byte and reports skipped-jsonc', () => {
        const original = '{\n    // my editor setup\n    "editor.fontSize": 14\n}\n';
        fs.writeFileSync(settings, original);
        bridge();
        expect(fs.readFileSync(settings, 'utf-8')).toBe(original);
        expect(output).toContain('skipped-jsonc');
        expect(output).toContain('chat.pluginLocations');
    });

    it('reports unchanged when a commented file already carries our keys', () => {
        const original =
            '{\n    // ours, added by hand\n    "chat.pluginLocations": { "./plugin/agent-config": true },\n' +
            '    "editor.fontSize": 14,\n}\n';
        fs.writeFileSync(settings, original);
        bridge();
        expect(fs.readFileSync(settings, 'utf-8')).toBe(original);
        expect(output).toContain('unchanged');
        expect(fs.existsSync(`${settings}.agent-config.bak`)).toBe(false);
    });
});

describe('unparseable and ambiguous host settings', () => {
    it('leaves a truncated file untouched and reports skipped-invalid with the snippet', () => {
        const original = '{\n    "editor.fontSize": 14,\n    "files.exclude": {\n';
        fs.writeFileSync(settings, original);
        bridge();
        expect(fs.readFileSync(settings, 'utf-8')).toBe(original);
        expect(output).toContain('skipped-invalid');
        expect(output).toContain('chat.pluginLocations');
    });

    it('refuses a duplicated top-level key the merge would touch', () => {
        const original =
            '{\n    "chat.pluginLocations": { "./a": true },\n    "editor.fontSize": 14,\n' +
            '    "chat.pluginLocations": { "./b": true }\n}\n';
        fs.writeFileSync(settings, original);
        bridge();
        expect(fs.readFileSync(settings, 'utf-8')).toBe(original);
        expect(output).toContain('skipped-duplicate-key');
    });

    it('does not refuse a duplicated key the merge never touches', () => {
        fs.writeFileSync(settings, '{\n    "editor.fontSize": 12,\n    "editor.fontSize": 14\n}\n');
        bridge();
        const after = JSON.parse(fs.readFileSync(settings, 'utf-8')) as Record<string, unknown>;
        expect(after['chat.pluginLocations']).toEqual({ [PLUGIN]: true });
        expect(after['editor.fontSize']).toBe(14);
        expect(output).not.toContain('skipped-duplicate-key');
    });
});

describe('strict JSON host settings', () => {
    it('merges as before and writes a backup of the original bytes', () => {
        const original = '{\n    "editor.fontSize": 14\n}\n';
        fs.writeFileSync(settings, original);
        bridge();
        const after = JSON.parse(fs.readFileSync(settings, 'utf-8')) as Record<string, unknown>;
        expect(after).toEqual({ 'editor.fontSize': 14, ...OURS });
        expect(fs.readFileSync(`${settings}.agent-config.bak`, 'utf-8')).toBe(original);
    });

    it('writes the backup once, so a second overwrite keeps the first original', () => {
        const original = '{\n    "editor.fontSize": 14\n}\n';
        fs.writeFileSync(settings, original);
        bridge();
        inst.merge_json_file(settings, { 'editor.tabSize': 2 }, false, '.vscode/settings.json');
        expect(fs.readFileSync(`${settings}.agent-config.bak`, 'utf-8')).toBe(original);
        const after = JSON.parse(fs.readFileSync(settings, 'utf-8')) as Record<string, unknown>;
        expect(after['editor.tabSize']).toBe(2);
    });

    it('creates a missing file without a backup', () => {
        fs.rmSync(settings, { force: true });
        bridge();
        expect(JSON.parse(fs.readFileSync(settings, 'utf-8'))).toEqual(OURS);
        expect(fs.existsSync(`${settings}.agent-config.bak`)).toBe(false);
    });
});

describe('the merge module', () => {
    it('keeps a URL inside a string while stripping real comments', async () => {
        const { stripJsonc } = await import('../../src/install/hostConfigMerge.js');
        const text = '{\n  "u": "http://x/y", // trailing\n  /* block */ "v": "a//b",\n}\n';
        expect(JSON.parse(stripJsonc(text))).toEqual({ u: 'http://x/y', v: 'a//b' });
    });

    it('restores the original bytes when the readback does not match', async () => {
        const { mergeHostConfigFile } = await import('../../src/install/hostConfigMerge.js');
        const original = '{\n    "editor.fontSize": 14\n}\n';
        fs.writeFileSync(settings, original);
        const outcome = mergeHostConfigFile(settings, OURS, (existing, incoming) => ({ ...existing, ...incoming }), {
            write: (p, content) => fs.writeFileSync(p, content.replace('14', '15')),
        });
        expect(outcome.status).toBe('skipped-readback-mismatch');
        expect(fs.readFileSync(settings, 'utf-8')).toBe(original);
    });
});
