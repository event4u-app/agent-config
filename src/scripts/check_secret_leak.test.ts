import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readAllowFile, scanRepo } from './check_secret_leak.js';

describe('check_secret_leak — .secret-allow', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-allow-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('parses path and path:line entries, dropping comments', () => {
        fs.writeFileSync(
            path.join(tmp, '.secret-allow'),
            '# audited: intentional fixture\nleak.txt:1\nwhole-file.txt\n\n',
        );
        expect(readAllowFile(tmp)).toEqual([
            { file: 'leak.txt', line: 1 },
            { file: 'whole-file.txt', line: null },
        ]);
    });

    it('is narrow — an allowed line is muted but a DIFFERENT secret in the same file is still caught', () => {
        // Two real-shaped (fake) AWS keys, one per line.
        fs.writeFileSync(
            path.join(tmp, 'leak.txt'),
            'aws_a = AKIA1234567890ABCDEF\naws_b = AKIAZZ99887766554433\n',
        );
        fs.writeFileSync(path.join(tmp, '.secret-allow'), 'leak.txt:1\n');

        const hits = scanRepo(tmp, 'explicit', { explicit: ['leak.txt'] });
        expect(hits).toHaveLength(1);
        expect(hits[0]?.line).toBe(2); // line 1 suppressed, line 2 still flagged
        expect(hits[0]?.kind).toBe('aws-access-key');
    });

    it('returns no entries when .secret-allow is absent', () => {
        expect(readAllowFile(tmp)).toEqual([]);
    });
});
