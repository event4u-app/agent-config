
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

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

interface DriverOut {
  package_source_basename: string | null;
  package_source_is_none: boolean;
  ok: boolean;
  msg_kind: string;
  is_installed: boolean;
  target_exists: boolean;
  content: string | null;
}
