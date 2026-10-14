// Decoy: `sha256` over a file, for integrity, on no account surface.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export function fileDigest(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}
