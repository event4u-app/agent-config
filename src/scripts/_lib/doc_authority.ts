/**
 * DESIGN.md / PRODUCT.md as authority signals (road-to-tells-a-near-miss-can-refute
 * 6.3): presence, and the register the document DECLARES — a frontmatter
 * `register:` field or the first word of a `## Register` section. A register
 * mentioned in passing is not a declaration, the same rule the slop context
 * gate applies to intent.
 */
import fs from "node:fs";
import path from "node:path";

export type DeclaredRegister = "brand" | "product";

export function declaredRegister(text: string): DeclaredRegister | undefined {
  const m =
    /^---\n[\s\S]*?^register:\s*["']?(brand|product)\b[\s\S]*?\n---/im.exec(text) ??
    /^##\s+register\s*\n+\s*\**`?(brand|product)\b/im.exec(text);
  return m?.[1]?.toLowerCase() as DeclaredRegister | undefined;
}

export interface DocSignal {
  present: boolean;
  register?: DeclaredRegister;
}

function read(file: string): DocSignal {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    return { present: false };
  }
  const register = declaredRegister(text);
  return register ? { present: true, register } : { present: true };
}

/** The two repo-level documents at `root`, in the shape `resolveUiAuthority` takes. */
export function readDocAuthority(root: string): { design_md: DocSignal; product_md: DocSignal } {
  return { design_md: read(path.join(root, "DESIGN.md")), product_md: read(path.join(root, "PRODUCT.md")) };
}
