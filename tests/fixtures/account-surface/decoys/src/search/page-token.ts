// Decoy: a `token` that is a pagination cursor, not a credential. Comparing it
// with `===` is correct here and must produce no finding.
export type PageToken = { offset: number; query: string };

export function encodePageToken(token: PageToken): string {
  return Buffer.from(JSON.stringify(token), 'utf8').toString('base64url');
}

export function isSamePage(token: string, previousToken: string): boolean {
  return token === previousToken;
}
