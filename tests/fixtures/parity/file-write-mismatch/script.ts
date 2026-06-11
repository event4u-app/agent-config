// Parity fixture: file-tree mismatch — written file content differs.
import { writeFileSync } from "node:fs";

writeFileSync("out.txt", "written by typescript\n");
