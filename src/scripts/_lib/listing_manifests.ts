/**
 * The listing manifests outside the npm tarball that start the MCP server
 * through `npx`: the GitHub Copilot discovery plugin and the Gemini CLI
 * extension. Both carry the package version twice — in `version` and pinned
 * inside the `npx` argument — and a crawler installs whatever the default
 * branch says, so both copies follow `package.json` through the release.
 *
 * One module because three readers must agree on the same two facts: the
 * release writes them (`release_env`), the release-PR content gate admits a
 * change to them and nothing else (`check_release_manifest_content`), and the
 * marketplace lint fails a tree where they drifted (`lint_marketplace`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const LISTING_MANIFESTS = ['.github/plugin/plugin.json', 'gemini-extension.json'] as const;

export const PACKAGE_NAME = '@event4u/agent-config';

/** An `npx` argument pinning this package to an exact release, prereleases included. */
export const PINNED_PACKAGE_ARG_RE = /^@event4u\/agent-config@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;

export function pinnedPackageArg(version: string): string {
    return `${PACKAGE_NAME}@${version}`;
}

type Obj = Record<string, unknown>;

function _isObject(v: unknown): v is Obj {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Every `[serverName, args]` pair under `mcpServers`, args left `unknown` for the caller to judge. */
export function mcpServerArgs(manifest: unknown): Array<[string, unknown]> {
    if (!_isObject(manifest) || !_isObject(manifest['mcpServers'])) return [];
    return Object.entries(manifest['mcpServers']).map(([name, server]) => [
        name,
        _isObject(server) ? server['args'] : undefined,
    ]);
}

/**
 * Every way `manifest` disagrees with `version`: the `version` field, and each
 * server whose `npx` arguments do not pin exactly this release. An unpinned
 * `@event4u/agent-config` argument is a finding too — it resolves to whatever
 * is latest on the day a user installs, which is the drift being prevented.
 */
export function listingVersionFindings(label: string, manifest: unknown, version: string): string[] {
    const out: string[] = [];
    const declared = _isObject(manifest) ? manifest['version'] : undefined;
    if (declared !== version) {
        out.push(`${label}: version \`${String(declared)}\` does not match package.json version \`${version}\``);
    }
    const servers = mcpServerArgs(manifest);
    if (servers.length === 0) out.push(`${label}: declares no mcpServers entry`);
    for (const [name, args] of servers) {
        const own = Array.isArray(args)
            ? args.filter((a): a is string => typeof a === 'string' && a.startsWith(PACKAGE_NAME))
            : [];
        if (own.length !== 1 || own[0] !== pinnedPackageArg(version)) {
            out.push(
                `${label}: mcpServers.${name}.args must pin \`${pinnedPackageArg(version)}\` ` +
                    `(found ${own.length === 0 ? 'none' : own.map((a) => `\`${a}\``).join(', ')})`,
            );
        }
    }
    return out;
}

/** Rewrite `version` and every pinned package argument; `jsonDump` is the release's own serializer. */
export function setListingManifestVersion(p: string, version: string, jsonDump: (v: unknown) => string): void {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
    if (_isObject(data) && 'version' in data) data['version'] = version;
    for (const [, args] of mcpServerArgs(data)) {
        if (!Array.isArray(args)) continue;
        args.forEach((a, i) => {
            if (typeof a === 'string' && PINNED_PACKAGE_ARG_RE.test(a)) args[i] = pinnedPackageArg(version);
        });
    }
    fs.writeFileSync(p, jsonDump(data) + '\n', 'utf-8');
}

export function listingManifestPaths(root: string): string[] {
    return LISTING_MANIFESTS.map((rel) => path.join(root, rel));
}
