/**
 * The host's own deny rows for the credential classes the `pre_tool_use` read
 * guard refuses — OFFERED by `hooks:doctor`, written nowhere.
 *
 * This package publishes that it writes no host setting, with one
 * owner-decided exception (`docs/mcp-server.md`); writing these rows would be a
 * second. So the doctor reads which rows are already in force across the
 * settings layers and prints the rest for the user to paste; nothing here opens
 * a file for writing.
 *
 * The classes are `credential_files.ts`'s. Each Read row carries a `sample`
 * path, and a test holds every sample to that module's classifier, so a row
 * that stops naming a class the guard refuses is a red test, not a quiet drift.
 * The converse is not held: a class added to the guard needs a row added here.
 *
 * Two residues of a native deny the guard does not have, stated rather than
 * hidden: a gitignore pattern cannot except a template, so `.env.*` is not
 * offered (it would deny `.env.example`) and the value-holding suffixes are
 * listed by name instead; and a `.pem` is offered only under key-shaped names.
 * Every other name stays the guard's alone.
 *
 * Spellings follow the grammar recorded in `src/install/hostPermissionsAdapter.ts`
 * (`Read(./.env)`, `Bash(npm run build)`), read 2026-10-13.
 */
import * as path from "node:path";

import type { CredentialFileClass } from "./credential_files.js";
import type { FloorPostureDeps } from "./floor_posture.js";

export interface CredentialDenyRow {
    readonly rule: string;
    readonly class: CredentialFileClass;
    /** A path this rule denies; `null` for a command row. */
    readonly sample: string | null;
}

const read = (spec: string, cls: CredentialFileClass, sample: string): CredentialDenyRow => ({
    rule: `Read(${spec})`,
    class: cls,
    sample,
});

const ENV_NAMES = [".env", ".envrc", ".env.local", ".env.development", ".env.production", ".env.staging", ".env.test"];
const KEY_GLOBS: ReadonlyArray<readonly [string, string]> = [
    ["*.key", "server.key"],
    ["*.p12", "client.p12"],
    ["*.pfx", "client.pfx"],
    ["*.ppk", "deploy.ppk"],
    ["*.jks", "release.jks"],
    ["*.keystore", "release.keystore"],
    ["*-key.pem", "server-key.pem"],
    ["*_key.pem", "server_key.pem"],
    ["private.pem", "private.pem"],
];
const SSH_KEYS = ["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"];
const HOME_TAILS: ReadonlyArray<readonly [string, CredentialFileClass]> = [
    [".aws/credentials", "cloud-credentials"],
    [".config/gcloud/application_default_credentials.json", "cloud-credentials"],
    [".config/gcloud/credentials.db", "cloud-credentials"],
    [".azure/accessTokens.json", "cloud-credentials"],
    [".azure/msal_token_cache.json", "cloud-credentials"],
    [".kube/config", "cloud-credentials"],
    [".docker/config.json", "cloud-credentials"],
    [".config/gh/hosts.yml", "cloud-credentials"],
    [".git-credentials", "cloud-credentials"],
    [".gem/credentials", "registry-credentials"],
    [".cargo/credentials", "registry-credentials"],
    [".cargo/credentials.toml", "registry-credentials"],
    [".composer/auth.json", "registry-credentials"],
    [".config/composer/auth.json", "registry-credentials"],
];
/** Registry files a project can carry too, so they are offered at both scopes. */
const ANYWHERE_TAILS = [".npmrc", ".pypirc", ".netrc", "_netrc", ".pgpass", ".my.cnf"];

export const CREDENTIAL_DENY_ROWS: readonly CredentialDenyRow[] = [
    ...ENV_NAMES.map((n) => read(`./**/${n}`, "env-file", `app/${n}`)),
    ...KEY_GLOBS.map(([g, sample]) => read(`./**/${g}`, "private-key", `certs/${sample}`)),
    ...SSH_KEYS.map((k) => read(`~/.ssh/${k}`, "private-key", `/home/u/.ssh/${k}`)),
    ...HOME_TAILS.map(([t, c]) => read(`~/${t}`, c, `/home/u/${t}`)),
    ...ANYWHERE_TAILS.flatMap((t) => [
        read(`~/${t}`, "registry-credentials", `/home/u/${t}`),
        read(`./**/${t}`, "registry-credentials", `app/${t}`),
    ]),
    read("//proc/*/environ", "process-environment", "/proc/self/environ"),
    { rule: "Bash(env)", class: "process-environment", sample: null },
    { rule: "Bash(printenv)", class: "process-environment", sample: null },
];

export type DenyTier = "none" | "partial" | "complete";

export interface CredentialDenyReport {
    tier: DenyTier;
    present: string[];
    missing: string[];
    /** Settings layers that exist and do not parse — their rows cannot be counted. */
    unreadable: string[];
}

/** The settings layers Claude Code merges, user first — the same three `floor_posture` reads. */
function layers(deps: Pick<FloorPostureDeps, "homeDir" | "projectRoot">): string[] {
    return [
        path.join(deps.homeDir, ".claude", "settings.json"),
        path.join(deps.projectRoot, ".claude", "settings.json"),
        path.join(deps.projectRoot, ".claude", "settings.local.json"),
    ];
}

/** Which offered rows are already in `permissions.deny` on some layer. Reads only. */
export function readCredentialDenyTier(
    deps: Pick<FloorPostureDeps, "homeDir" | "projectRoot" | "readFile">,
): CredentialDenyReport {
    const inForce = new Set<string>();
    const unreadable: string[] = [];
    for (const file of layers(deps)) {
        const raw = deps.readFile(file);
        if (raw === null) continue;
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            unreadable.push(file);
            continue;
        }
        const deny = (parsed as { permissions?: { deny?: unknown } } | null)?.permissions?.deny;
        if (Array.isArray(deny)) for (const r of deny) if (typeof r === "string") inForce.add(r.trim());
    }
    const present = CREDENTIAL_DENY_ROWS.map((r) => r.rule).filter((r) => inForce.has(r));
    const missing = CREDENTIAL_DENY_ROWS.map((r) => r.rule).filter((r) => !inForce.has(r));
    const tier: DenyTier = missing.length === 0 ? "complete" : present.length === 0 ? "none" : "partial";
    return { tier, present, missing, unreadable };
}

/** The doctor's section: the tier, and the rows still to paste — none when complete. */
export function renderCredentialDenyTier(report: CredentialDenyReport): string[] {
    const total = report.present.length + report.missing.length;
    const lines = [
        `Native deny tier (Claude Code): ${report.tier} — ${report.present.length}/${total} credential rows in force`,
        "    Offered, never written: this package writes no deny row into a host setting.",
    ];
    for (const f of report.unreadable) lines.push(`    ⚠️  unreadable, not counted: ${f}`);
    if (report.missing.length > 0) {
        lines.push("    Paste into permissions.deny of ~/.claude/settings.json to add them:");
        for (const r of report.missing) lines.push(`      ${JSON.stringify(r)},`);
    }
    lines.push(
        "    Stronger tiers stay yours to enable: the host sandbox (sandbox.enabled) and a",
        "    scrubbed environment for the session; the read guard covers names no row lists.",
    );
    return lines;
}
