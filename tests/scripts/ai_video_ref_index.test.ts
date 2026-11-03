/**
 * `check-ref-index.sh` — a prompt that cites image N when fewer than N input
 * images are supplied is refused before any spend. The model would otherwise
 * render against a reference that does not exist, and nothing would say so.
 *
 * Only explicit reference forms count (`@imageN`, `image N`, `Bild N`,
 * `Frame N`, `reference N`); the pass cases guard against reading ordinary
 * prose as a citation.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'lib', 'check-ref-index.sh');

function check(inputs: string, prompt: string): { status: number; stdout: string; stderr: string } {
    const r = spawnSync('bash', [SCRIPT, inputs], { encoding: 'utf-8', input: prompt });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('check-ref-index', () => {
    it('refuses Bild 5 when 2 inputs are supplied, naming the line', () => {
        const r = check('2', 'Szene am Strand.\nDie Frau aus Bild 5 läuft nach links.\n');
        expect(r.status).toBe(7);
        expect(r.stderr).toContain('line 2');
        expect(r.stderr).toContain('Bild 5');
        expect(r.stderr).toContain('2 input');
    });

    it('accepts Bild 2 with 2 inputs', () => {
        const r = check('2', 'Die Frau aus Bild 2 läuft nach links.\n');
        expect(r.stderr).toBe('');
        expect(r.status).toBe(0);
    });

    it('accepts @image3 with 3 inputs and refuses it with 2', () => {
        expect(check('3', 'match the jacket in @image3').status).toBe(0);
        const r = check('2', 'match the jacket in @image3');
        expect(r.status).toBe(7);
        expect(r.stderr).toContain('line 1');
    });

    it.each([
        ['image 4', 'keep the face from image 4'],
        ['Frame 3', 'start on Frame 3'],
        ['reference 2', 'palette of reference 2'],
    ])('recognises %s as a reference', (_form, prompt) => {
        expect(check('1', prompt).status).toBe(7);
    });

    it('reports every offending line, not just the first', () => {
        const r = check('1', 'image 2 left\nok line\nBild 3 right\n');
        expect(r.status).toBe(7);
        expect(r.stderr).toContain('line 1');
        expect(r.stderr).toContain('line 3');
    });

    it('does not read prose numbers as references', () => {
        const r = check(
            '1',
            'shot at 24 frames per second, 2 images of rain, frame rate 25, a 3-image collage, myimage 9, frame 24fps',
        );
        expect(r.stderr).toBe('');
        expect(r.status).toBe(0);
    });

    it('rejects a missing or non-numeric input count as usage', () => {
        expect(check('two', 'image 1').status).toBe(2);
    });
});
