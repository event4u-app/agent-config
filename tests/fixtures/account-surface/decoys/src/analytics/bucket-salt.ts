// Decoy: a `salt` that has nothing to do with passwords. It spreads visitors
// across experiment buckets and must produce no finding.
import { createHash } from 'node:crypto';

const BUCKET_SALT = 'experiment-bucket-v3';

export function bucketFor(visitorId: string, buckets: number): number {
  const digest = createHash('sha256').update(BUCKET_SALT + visitorId).digest();

  return digest.readUInt32BE(0) % buckets;
}
