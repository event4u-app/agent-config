import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { credentialFileClass, segmentVerdict, type CredentialFileClass } from "./credential_files.js";
import { CREDENTIAL_DENY_ROWS, readCredentialDenyTier, renderCredentialDenyTier } from "./credential_deny_rows.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TSX = path.join(REPO, "node_modules", ".bin", "tsx");
const made: string[] = [];
afterEach(() => {
    while (made.length > 0) fs.rmSync(made.pop() as string, { recursive: true, force: true });
});
const tmp = (p: string): string => {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), p)));
    made.push(d);
    return d;
};

const deps = (files: Record<string, string>, homeDir = "/h", projectRoot = "/p") => ({
    homeDir,
    projectRoot,
    readFile: (p: string) => files[p] ?? null,
});
const settings = (deny: string[]) => JSON.stringify({ permissions: { deny } });
const ALL = CREDENTIAL_DENY_ROWS.map((r) => r.rule);

describe("credential deny rows — the guard's list, as host rows", () => {
    it("every Read row's sample is a path the read guard refuses, under the row's class", () => {
        for (const row of CREDENTIAL_DENY_ROWS) {
            if (row.sample === null) continue;
            expect(credentialFileClass(row.sample, "posix"), row.rule).toBe(row.class);
            expect(row.rule).toMatch(/^Read\(.+\)$/);
        }
    });

    it("every Bash row names a command the guard refuses as a process-environment dump", () => {
        for (const row of CREDENTIAL_DENY_ROWS.filter((r) => r.sample === null)) {
            const cmd = /^Bash\((.+)\)$/.exec(row.rule)?.[1] ?? "";
            expect(segmentVerdict(cmd, "posix")?.class, row.rule).toBe("process-environment");
        }
    });

    it("covers every class the guard refuses", () => {
        const classes: CredentialFileClass[] = ["env-file", "private-key", "cloud-credentials", "registry-credentials", "process-environment"];
        for (const c of classes) expect(CREDENTIAL_DENY_ROWS.some((r) => r.class === c), c).toBe(true);
    });

    it("offers no row that would deny an env template the guard lets through", () => {
        expect(credentialFileClass("app/.env.example", "posix")).toBeNull();
        for (const r of CREDENTIAL_DENY_ROWS.filter((x) => x.class === "env-file")) {
            const name = r.rule.slice(r.rule.lastIndexOf("/") + 1, -1);
            expect(name, r.rule).not.toContain("*");
            expect(credentialFileClass(`app/${name}`, "posix"), r.rule).toBe("env-file");
        }
    });

    it("has no duplicate rule", () => {
        expect(new Set(ALL).size).toBe(ALL.length);
    });
});

describe("readCredentialDenyTier — reads the three layers, writes nothing", () => {
    it("reports none and offers every row on a machine without them", () => {
        const r = readCredentialDenyTier(deps({}));
        expect(r.tier).toBe("none");
        expect(r.missing).toEqual(ALL);
        const out = renderCredentialDenyTier(r).join("\n");
        for (const rule of ALL) expect(out).toContain(JSON.stringify(rule));
    });

    it("reports complete and offers none once every row is in force, across layers", () => {
        const half = Math.floor(ALL.length / 2);
        const r = readCredentialDenyTier(
            deps({
                "/h/.claude/settings.json": settings(ALL.slice(0, half)),
                "/p/.claude/settings.local.json": settings(ALL.slice(half)),
            }),
        );
        expect(r.tier).toBe("complete");
        expect(r.missing).toEqual([]);
        const out = renderCredentialDenyTier(r).join("\n");
        expect(out).not.toContain("Paste into");
        for (const rule of ALL) expect(out).not.toContain(JSON.stringify(rule));
    });

    it("reports partial with only the rows still missing, and names an unreadable layer", () => {
        const r = readCredentialDenyTier(
            deps({ "/p/.claude/settings.json": settings([ALL[0] as string]), "/h/.claude/settings.json": "{not json" }),
        );
        expect(r.tier).toBe("partial");
        expect(r.present).toEqual([ALL[0]]);
        expect(r.missing).not.toContain(ALL[0]);
        expect(r.unreadable).toEqual(["/h/.claude/settings.json"]);
    });
});

describe("hooks:doctor — the offered rows on a real run", () => {
    const run = (home: string, project: string) =>
        spawnSync(TSX, [path.join(REPO, "src", "scripts", "hooks_doctor.ts"), "--project-root", project], {
            encoding: "utf8",
            timeout: 60_000,
            env: { ...process.env, HOME: home, EVENT4U_CONFIG_HOME: path.join(home, ".event4u", "agent-config") },
        });

    it("prints every row without them, none with them pasted, and leaves the settings bytes alone", () => {
        const home = tmp("deny-home-");
        const project = tmp("deny-proj-");
        const file = path.join(home, ".claude", "settings.json");
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const before = JSON.stringify({ theme: "dark" }, null, 2) + "\n";
        fs.writeFileSync(file, before);

        const first = run(home, project);
        expect(first.status, first.stderr).toBe(0);
        expect(first.stdout).toContain("Native deny tier (Claude Code): none");
        for (const rule of ALL) expect(first.stdout).toContain(JSON.stringify(rule));
        expect(fs.readFileSync(file, "utf8")).toBe(before);

        const pasted = JSON.stringify({ theme: "dark", permissions: { deny: ALL } }, null, 2) + "\n";
        fs.writeFileSync(file, pasted);
        const second = run(home, project);
        expect(second.status, second.stderr).toBe(0);
        expect(second.stdout).toContain(`Native deny tier (Claude Code): complete — ${ALL.length}/${ALL.length}`);
        for (const rule of ALL) expect(second.stdout).not.toContain(JSON.stringify(rule));
        expect(fs.readFileSync(file, "utf8")).toBe(pasted);
    }, 120_000);
});
