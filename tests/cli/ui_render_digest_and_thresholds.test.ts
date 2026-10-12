import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { staticWitness } from '../../src/cli/commands/uiRender.js';
import { readThresholds } from '../../src/cli/commands/uiRenderAsset.js';
import { ASSET_CLASSES } from '../../src/cli/commands/uiRenderAssetTypes.js';

/** Findings 2 and 3 of the sixth completion review. */
let root: string;
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-thresholds-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('one definition of a file digest, and thresholds that merge', () => {
    it('the digest is of the bytes, so a lossy decode cannot split it', () => {
        // Finding 2. Three places hash "the file" and two hashed the UTF-8
        // DECODED string while the render hashed the raw buffer. For any file
        // the decode is not byte-exact over, the two digests differ forever,
        // so the gate never matches a render to the file it rendered and the
        // obligation can never be discharged.
        const body =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" role="img">' +
            '<title>t</title><rect width="8" height="8"/></svg>\n';
        // A BOM is the common case and is byte-exact; a lone 0xFF byte is not,
        // and is what separates the two definitions.
        const abs = path.join(root, 'bom.svg');
        fs.writeFileSync(abs, Buffer.concat([Buffer.from([0xff]), Buffer.from(body, 'utf8')]));

        const bytes = fs.readFileSync(abs);
        const ofBytes = crypto.createHash('sha256').update(bytes).digest('hex');
        const ofText = crypto.createHash('sha256').update(bytes.toString('utf8')).digest('hex');
        // The premise of the finding: for this file the two differ.
        expect(ofBytes).not.toBe(ofText);
        // And the witness reports the byte digest, which is the one the render
        // writes and the gate compares.
        expect(staticWitness(abs)?.digest).toBe(ofBytes);

        // For an ordinary ASCII file both definitions agree, which is why the
        // split went unnoticed.
        const plain = path.join(root, 'plain.svg');
        fs.writeFileSync(plain, body);
        const plainBytes = fs.readFileSync(plain);
        expect(staticWitness(plain)?.digest).toBe(
            crypto.createHash('sha256').update(plainBytes).digest('hex'),
        );
    });

    it('a partial geometry manifest merges into the defaults', () => {
        // Finding 3. The validation checks ONE field per class and the spread
        // then replaced the whole class object, so a manifest naming every
        // class but supplying only `silhouette_iou_min` was accepted as
        // `manifest`-sourced with `max_boundary_distance_units` UNDEFINED — a
        // threshold that compares false against everything, so the boundary
        // check silently stopped existing.
        const file = path.join(root, 'thresholds.json');
        fs.writeFileSync(
            file,
            JSON.stringify({
                geometry_tolerances: Object.fromEntries(
                    ASSET_CLASSES.map((c) => [c, { silhouette_iou_min: 0.9 }]),
                ),
            }),
        );
        const t = readThresholds(file);
        expect(t.geometrySource).toBe('manifest');
        // The supplied field wins …
        expect(t.geometry.icon.silhouette_iou_min).toBe(0.9);
        // … and the one the manifest did not mention is still a number.
        expect(typeof t.geometry.icon.max_boundary_distance_units).toBe('number');
        for (const cls of ASSET_CLASSES) {
            expect(t.geometry[cls].silhouette_iou_min).toBe(0.9);
            expect(Number.isFinite(t.geometry[cls].max_boundary_distance_units)).toBe(true);
        }
        // No file at all is still the default source, unchanged.
        expect(readThresholds(undefined).geometrySource).toBe('default');
    });
});
