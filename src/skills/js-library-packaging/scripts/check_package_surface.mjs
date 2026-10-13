// src/skills/js-library-packaging/scripts/check_package_surface.ts
import * as fs from "node:fs";
import * as path from "node:path";
var PEER_ONLY = ["react", "react-dom"];
var asRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};
var exportTargets = (exportsField) => {
  const out = [];
  const walk = (node) => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    for (const v of Object.values(asRecord(node))) walk(v);
  };
  walk(exportsField);
  return out;
};
var classify = (targets) => {
  if (targets.length === 0) return "undeclared";
  const built = targets.filter((t) => /(^|\/)(dist|build|lib|out)\//.test(t));
  if (built.length === targets.length) return "built-surface";
  if (built.length === 0) return "source-consumed";
  return "undeclared";
};
var checkPackage = (root) => {
  const manifestPath = path.join(root, "package.json");
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return {
      root,
      name: null,
      classification: "undeclared",
      findings: [{ code: "no-manifest", severity: "error", message: `no readable package.json at ${manifestPath}` }]
    };
  }
  const findings = [];
  const deps = asRecord(manifest["dependencies"]);
  const peers = asRecord(manifest["peerDependencies"]);
  const exportsField = manifest["exports"];
  const targets = exportTargets(exportsField);
  for (const p of PEER_ONLY) {
    if (Object.prototype.hasOwnProperty.call(deps, p)) {
      findings.push({
        code: "peer-as-dependency",
        severity: "error",
        message: `\`${p}\` is in dependencies; a library must declare it as a peerDependency or the consumer gets two copies (the "invalid hook call" failure)`
      });
    }
  }
  const hasLegacy = ["main", "module", "browser"].some((k) => typeof manifest[k] === "string");
  if (exportsField === void 0 && hasLegacy) {
    findings.push({
      code: "no-exports-map",
      severity: "warn",
      message: "main/module present without an exports map \u2014 the entry point resolves by bundler convention, not by declaration"
    });
  }
  const walkConditions = (node, at) => {
    const rec = asRecord(node);
    const keys = Object.keys(rec);
    if (keys.includes("types") && keys[0] !== "types") {
      findings.push({
        code: "types-not-first",
        severity: "warn",
        message: `\`types\` is not the first condition at \`${at}\` (order matters: a resolver matching \`${keys[0] ?? ""}\` first never sees it)`
      });
    }
    for (const [k, v] of Object.entries(rec)) {
      if (typeof v === "object" && v !== null) walkConditions(v, `${at}${k}/`);
    }
  };
  if (exportsField !== void 0) walkConditions(exportsField, "exports.");
  const UNPUBLISHABLE_RANGE_PREFIXES = ["workspace:", "catalog:"];
  const workspaceRanges = [
    deps,
    asRecord(manifest["devDependencies"]),
    peers
  ].flatMap(
    (m) => Object.entries(m).filter(
      ([, v]) => typeof v === "string" && UNPUBLISHABLE_RANGE_PREFIXES.some((pre) => v.startsWith(pre))
    )
  );
  if (workspaceRanges.length > 0 && manifest["private"] !== true && manifest["publishConfig"] === void 0) {
    const prefixes = [
      ...new Set(
        workspaceRanges.map(
          ([, v]) => UNPUBLISHABLE_RANGE_PREFIXES.find((pre) => v.startsWith(pre)) ?? ""
        )
      )
    ].sort();
    findings.push({
      code: "workspace-range-publishable",
      severity: "warn",
      message: `${String(workspaceRanges.length)} workspace-local range(s) (${prefixes.join(", ")}) in a package that is neither private nor carrying publishConfig \u2014 the protocol does not resolve outside the workspace`
    });
  }
  for (const t of targets) {
    if (!t.startsWith(".")) continue;
    if (!fs.existsSync(path.join(root, t))) {
      findings.push({
        code: "export-target-missing",
        severity: "error",
        message: `exports target \`${t}\` does not exist in the package`
      });
    }
  }
  const name = typeof manifest["name"] === "string" ? manifest["name"] : null;
  return { root, name, classification: classify(targets), findings };
};
var DEPRECATED_ITEM_TYPES = ["registry:build", "registry:mcp"];
var checkRegistry = (file) => {
  let doc = {};
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [{ code: "no-registry", severity: "error", message: `no readable registry JSON at ${file}` }];
  }
  const items = Array.isArray(doc["items"]) ? doc["items"] : [doc];
  const findings = [];
  for (const raw of items) {
    const item = asRecord(raw);
    const name = typeof item["name"] === "string" ? item["name"] : "(unnamed)";
    const deps = Array.isArray(item["dependencies"]) ? item["dependencies"] : [];
    for (const d of deps) {
      const dep = String(d).split("@")[0];
      if (PEER_ONLY.includes(dep)) {
        findings.push({
          code: "registry-item-bundles-peer",
          severity: "error",
          message: `registry item \`${name}\` lists \`${dep}\` in dependencies; the consuming app already has it, and installing a second copy is the same "invalid hook call" failure one layer up`
        });
      }
    }
    const type = typeof item["type"] === "string" ? item["type"] : "";
    if (DEPRECATED_ITEM_TYPES.includes(type)) {
      findings.push({
        code: "registry-item-deprecated-type",
        severity: "error",
        message: `registry item \`${name}\` uses \`${type}\`, deprecated in v4 \u2014 use \`registry:base\` or \`registry:font\``
      });
    }
  }
  return findings;
};
var selfTest = () => {
  let failed = 0;
  const check = (label, cond) => {
    if (!cond) {
      process.stderr.write(`\u274C  ${label}
`);
      failed += 1;
    }
  };
  check("a source target classifies as source-consumed", classify(["./src/index.ts"]) === "source-consumed");
  check("a dist target classifies as built-surface", classify(["./dist/index.js"]) === "built-surface");
  check("a MIXED declaration is undeclared, never guessed", classify(["./src/index.ts", "./dist/index.js"]) === "undeclared");
  check("no targets is undeclared", classify([]) === "undeclared");
  check(
    "nested conditions are all collected",
    exportTargets({ ".": { types: "./a.d.ts", import: "./b.js" } }).length === 2
  );
  process.stdout.write(
    failed === 0 ? "\u2705  check_package_surface: self-test passed\n" : `\u274C  ${String(failed)} failure(s)
`
  );
  return failed === 0 ? 0 : 1;
};
var main = () => {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest();
  const roots = argv.filter((a) => !a.startsWith("--"));
  if (roots.length === 0) {
    process.stderr.write("usage: check_package_surface <library-root> [...]\n");
    return 2;
  }
  const reports = roots.map(
    (r) => /registry(-item)?\.json$/.test(r) ? { root: r, name: null, classification: "undeclared", findings: checkRegistry(r) } : checkPackage(r)
  );
  process.stdout.write(`${JSON.stringify({ reports }, null, 2)}
`);
  return reports.some((r) => r.findings.some((f) => f.severity === "error")) ? 1 : 0;
};
if (process.argv[1] !== void 0 && process.argv[1].includes("check_package_surface")) {
  process.exit(main());
}
export {
  checkPackage,
  checkRegistry,
  classify,
  exportTargets
};
