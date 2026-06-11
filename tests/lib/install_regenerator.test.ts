/**
 * Tests for `src/scripts/_lib/install_regenerator.ts`.
 *
 * No Python suite exists for `install_regenerator.py` (grep of tests/ finds
 * none), so this is a focused differential suite (ADR-088 Phase 2 / Wave 2a):
 * a 1:1 behavioral set of unit tests plus a `python3 -c` driver block asserting
 * the TS twin's `package_source` / `install_regenerator` / `is_installed`
 * outputs match the Python reference on identical synthetic package + consumer
 * trees (pattern: tests/spikes/yaml_rt_py_driver.py).
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as reg from "../../src/scripts/_lib/install_regenerator.js";

let tmp_path: string;

beforeEach(() => {
  tmp_path = fs.mkdtempSync(path.join(os.tmpdir(), "install-regen-"));
});

afterEach(() => {
  fs.rmSync(tmp_path, { recursive: true, force: true });
});

function tp(...parts: string[]): string {
  return path.join(tmp_path, ...parts);
}

function write_file(p: string, content: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
}

const REL = reg.REGENERATOR_REL;
const CONSUMER_REL = reg.CONSUMER_REGENERATOR_REL;

describe("install_regenerator", () => {
  it("test_package_source_prefers_src_agent_src", () => {
    const pkg = tp("pkg");
    write_file(path.join(pkg, "src", "agent-src", REL), "# src\n");
    write_file(path.join(pkg, "dist/agent-src", REL), "# dist\n");
    expect(reg.package_source(pkg)).toBe(path.join(pkg, "src", "agent-src", REL));
  });

  it("test_package_source_falls_through_priority_order", () => {
    const pkg = tp("pkg");
    // Only the dist projection exists → third candidate wins.
    write_file(path.join(pkg, "dist/agent-src", REL), "# dist\n");
    expect(reg.package_source(pkg)).toBe(path.join(pkg, "dist/agent-src", REL));
  });

  it("test_package_source_null_when_absent", () => {
    expect(reg.package_source(tp("empty-pkg"))).toBeNull();
  });

  it("test_consumer_target_is_canonical", () => {
    const consumer = tp("consumer");
    expect(reg.consumer_target(consumer)).toBe(path.join(consumer, CONSUMER_REL));
  });

  it("test_install_regenerator_copies_and_sets_exec_bit", () => {
    const pkg = tp("pkg");
    const consumer = tp("consumer");
    write_file(path.join(pkg, "src", "agent-src", REL), "#!/usr/bin/env python3\nprint('x')\n");
    const [ok, msg] = reg.install_regenerator(pkg, consumer);
    expect(ok).toBe(true);
    expect(msg).toContain("regenerator installed at");
    const target = reg.consumer_target(consumer);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, "utf-8")).toBe("#!/usr/bin/env python3\nprint('x')\n");
    // Executable bit set for owner.
    expect((fs.statSync(target).mode & 0o100) !== 0).toBe(true);
  });

  it("test_install_regenerator_idempotent_on_identical_content", () => {
    const pkg = tp("pkg");
    const consumer = tp("consumer");
    write_file(path.join(pkg, "src", "agent-src", REL), "same\n");
    reg.install_regenerator(pkg, consumer);
    const [ok, msg] = reg.install_regenerator(pkg, consumer);
    expect(ok).toBe(true);
    expect(msg).toContain("already current");
  });

  it("test_install_regenerator_refreshes_changed_content", () => {
    const pkg = tp("pkg");
    const consumer = tp("consumer");
    const src = path.join(pkg, "src", "agent-src", REL);
    write_file(src, "v1\n");
    reg.install_regenerator(pkg, consumer);
    write_file(src, "v2\n");
    const [ok] = reg.install_regenerator(pkg, consumer);
    expect(ok).toBe(true);
    expect(fs.readFileSync(reg.consumer_target(consumer), "utf-8")).toBe("v2\n");
  });

  it("test_install_regenerator_reports_missing_source", () => {
    const [ok, msg] = reg.install_regenerator(tp("empty-pkg"), tp("consumer"));
    expect(ok).toBe(false);
    expect(msg).toContain("regenerator source not found");
  });

  it("test_is_installed_false_when_absent", () => {
    expect(reg.is_installed(tp("consumer"))).toBe(false);
  });

  it("test_is_installed_true_after_install", () => {
    const pkg = tp("pkg");
    const consumer = tp("consumer");
    write_file(path.join(pkg, "src", "agent-src", REL), "x\n");
    reg.install_regenerator(pkg, consumer);
    expect(reg.is_installed(consumer)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Differential block — Python `install_regenerator.py` is the reference.
// Pattern per tests/spikes/yaml_rt_py_driver.py.
// ---------------------------------------------------------------------------

function python3_available(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

const PY_DRIVER = `
import json, os, sys
sys.path.insert(0, os.path.join(os.getcwd(), "src", "scripts"))
from _lib import install_regenerator as reg
from pathlib import Path

payload = json.load(sys.stdin)
pkg = Path(payload["pkg"])
consumer = Path(payload["consumer"])
src = reg.package_source(pkg)
ok, msg = reg.install_regenerator(pkg, consumer)
out = {
    "package_source_basename": (src.name if src is not None else None),
    "package_source_is_none": src is None,
    "ok": ok,
    # Normalise the message to a stable shape (drop the absolute target path).
    "msg_kind": (
        "missing" if "not found" in msg
        else "current" if "already current" in msg
        else "installed" if "installed at" in msg
        else "other"
    ),
    "is_installed": reg.is_installed(consumer),
    "target_exists": reg.consumer_target(consumer).is_file(),
    "content": (
        reg.consumer_target(consumer).read_text(encoding="utf-8")
        if reg.consumer_target(consumer).is_file() else None
    ),
}
sys.stdout.write(json.dumps(out))
`;

interface DriverOut {
  package_source_basename: string | null;
  package_source_is_none: boolean;
  ok: boolean;
  msg_kind: string;
  is_installed: boolean;
  target_exists: boolean;
  content: string | null;
}

describe.runIf(python3_available())("differential vs Python install_regenerator", () => {
  function ts_run(pkg: string, consumer: string): DriverOut {
    const src = reg.package_source(pkg);
    const [ok, msg] = reg.install_regenerator(pkg, consumer);
    const target = reg.consumer_target(consumer);
    const target_exists = fs.existsSync(target) && fs.statSync(target).isFile();
    const msg_kind = msg.includes("not found")
      ? "missing"
      : msg.includes("already current")
        ? "current"
        : msg.includes("installed at")
          ? "installed"
          : "other";
    return {
      package_source_basename: src === null ? null : path.basename(src),
      package_source_is_none: src === null,
      ok,
      msg_kind,
      is_installed: reg.is_installed(consumer),
      target_exists,
      content: target_exists ? fs.readFileSync(target, "utf-8") : null,
    };
  }

  function py_run(pkg: string, consumer: string): DriverOut {
    const stdout = execFileSync("python3", ["-c", PY_DRIVER], {
      input: JSON.stringify({ pkg, consumer }),
      encoding: "utf-8",
      cwd: REPO_ROOT,
    });
    return JSON.parse(stdout) as DriverOut;
  }

  it("src/agent-src source: install behaves identically", () => {
    // Two independent identical trees → run Python on one, TS on the other.
    const py_pkg = tp("py", "pkg");
    const py_consumer = tp("py", "consumer");
    const ts_pkg = tp("ts", "pkg");
    const ts_consumer = tp("ts", "consumer");
    for (const pkg of [py_pkg, ts_pkg]) {
      write_file(path.join(pkg, "src", "agent-src", REL), "#!/usr/bin/env python3\nbody\n");
    }
    expect(ts_run(ts_pkg, ts_consumer)).toEqual(py_run(py_pkg, py_consumer));
  });

  it("missing source: both report the same failure shape", () => {
    const py_pkg = tp("py2", "empty");
    const ts_pkg = tp("ts2", "empty");
    fs.mkdirSync(py_pkg, { recursive: true });
    fs.mkdirSync(ts_pkg, { recursive: true });
    expect(ts_run(ts_pkg, tp("ts2", "consumer"))).toEqual(py_run(py_pkg, tp("py2", "consumer")));
  });

  it("dist/agent-src fallthrough source: identical resolution", () => {
    const py_pkg = tp("py3", "pkg");
    const ts_pkg = tp("ts3", "pkg");
    for (const pkg of [py_pkg, ts_pkg]) {
      write_file(path.join(pkg, "dist/agent-src", REL), "dist-body\n");
    }
    expect(ts_run(ts_pkg, tp("ts3", "consumer"))).toEqual(py_run(py_pkg, tp("py3", "consumer")));
  });
});
