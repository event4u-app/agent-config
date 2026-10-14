/**
 * Retrieval regression for the threat-modeling corpus.
 *
 * `threats.csv` is BM25-retrieved with a four-result cap, so a new row can push
 * a more relevant one out of view without any test noticing. Each query below
 * names the defect one authentication row exists for, and the row must stay the
 * top result. Added with the `Authentication token in script-readable browser
 * storage` row (road-to-account-surface-detector Phase 2).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { search_domain } from "../../src/skills/corpus-grounding/scripts/decision_engine.js";
import { load_manifest } from "../../src/skills/corpus-grounding/scripts/schema_validator.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = load_manifest(
  path.join(here, "..", "..", "src", "skills", "threat-modeling", "data", "manifest.json"),
);

function threats(query: string): string[] {
  const result = search_domain(manifest, query, "threats") as { results?: { Threat?: string }[] };

  return (result.results ?? []).map((row) => String(row.Threat));
}

const TOP_ONE: [string, string][] = [
  ["remember me cookie and logout should end the server session", "Persistent login and incomplete logout"],
  ["session fixation after login", "Session fixation / insufficient invalidation"],
  ["credential stuffing against the login form", "Credential stuffing / brute force / password spraying"],
  ["validate the jwt issuer audience and signing algorithm", "Self-contained token validation bypass"],
  ["password reset link built from the host header", "Password reset beyond the token"],
  ["compare the one-time code with string equality", "Unsafe secret comparison and home-made credential primitives"],
  ["link the Google OAuth account by matching the email claim", "Federated sign-in account takeover"],
  ["store the password with a salted sha256 digest", "Fast or home-made password storage"],
  ["login error message reveals whether the email is registered", "Account enumeration through an observable difference"],
  ["enforce the two factor challenge on the server", "MFA enforced only in the interface or undercut by its recovery path"],
];

describe("threat-modeling retrieval", () => {
  it.each(TOP_ONE)("keeps %j on its own row", (query, row) => {
    expect(threats(query)[0]).toBe(row);
  });

  it("surfaces the script-readable storage row for a token written to localStorage", () => {
    expect(threats("store the access token in localStorage after the oauth callback")).toContain(
      "Authentication token in script-readable browser storage",
    );
  });
});
