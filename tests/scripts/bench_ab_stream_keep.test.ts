import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { preserve_stream } from '../../internal/bench/core/_lib/bench_ab_workspace.js';

describe('preserve_stream', () => {
    it('keeps a trial stream under its own key, so a later sweep cannot overwrite it', () => {
        const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'streams-')), 'streams');
        const a = preserve_stream(dir, 'trapC-ambig-01|package|1', '{"type":"result"}\n', 'S1');
        const b = preserve_stream(dir, 'trapC-ambig-01|package|1', '{"type":"other"}\n', 'S2');
        expect(a).not.toBeNull();
        expect(b).not.toBe(a);
        expect(path.basename(a as string)).toBe('S1__trapC-ambig-01__package__1.stream.jsonl');
        expect(fs.readFileSync(a as string, 'utf8')).toBe('{"type":"result"}\n');
        expect(fs.readFileSync(b as string, 'utf8')).toBe('{"type":"other"}\n');
    });

    it('writes nothing for a trial without a stream', () => {
        const dir = path.join(os.tmpdir(), `streams-none-${process.pid}`);
        expect(preserve_stream(dir, 'x|y|0', '', 'S1')).toBeNull();
        expect(fs.existsSync(dir)).toBe(false);
    });
});
